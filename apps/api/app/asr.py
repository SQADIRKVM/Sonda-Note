"""Speech recognition — pipeline layer 05.

Providers
---------
GroqWhisperProvider   — Whisper Large V3 via Groq cloud API (default / free tier).
ColabWhisperXProvider — WhisperX Large V3 on a Google Colab T4/A100 GPU exposed
                        via a cloudflared tunnel. Zero cost, no API key needed.
                        Update COLAB_GPU_URL in .env whenever you start a new session.

The provider interface is deliberately narrow so swapping providers touches only
this file. Pipeline, routes, and tests are unaffected.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

import httpx

from .config import settings

logger = logging.getLogger(__name__)

# Whisper's own limit. Longer audio must be split before submission; the
# extension's 30s chunking means we never approach this in practice.
_MAX_AUDIO_SECONDS = 1400


@dataclass
class ASRSegment:
    start: float
    end: float
    text: str
    # Word-level timings from WhisperX alignment. Needed to merge NeMo speaker
    # turns onto text in Month 3; unused in Month 1.
    words: list[dict] = field(default_factory=list)


@dataclass
class ASRResult:
    segments: list[ASRSegment]
    language: str
    duration: float

    @property
    def text(self) -> str:
        return " ".join(s.text.strip() for s in self.segments if s.text.strip())


class ASRProvider(Protocol):
    async def transcribe(self, audio_path: Path, language: str | None = None) -> ASRResult: ...


class GroqWhisperProvider:
    """Whisper Large V3 via Groq's OpenAI-compatible transcription endpoint."""

    def __init__(self, api_key: str, base_url: str, model: str):
        if not api_key:
            raise ASRError(
                "GROQ_API_KEY is required for speech recognition. "
                "Please set GROQ_API_KEY in apps/api/.env (obtain a free key at https://console.groq.com)."
            )
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def transcribe(self, audio_path: Path, language: str | None = None) -> ASRResult:
        data = {
            "model": self._model,
            "response_format": "verbose_json",
            "timestamp_granularities[]": "segment",
        }
        if language:
            data["language"] = language

        # Retry logic with exponential backoff for network timeouts / rate limits
        max_retries = 3
        backoff = 2.0
        response = None

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
                    with audio_path.open("rb") as fh:
                        response = await client.post(
                            f"{self._base_url}/audio/transcriptions",
                            headers={"Authorization": f"Bearer {self._api_key}"},
                            data=data,
                            files={"file": (audio_path.name, fh, "audio/wav")},
                        )
                if response.status_code < 500 and response.status_code != 429:
                    break
                logger.warning(
                    "Groq ASR attempt %d failed (%d), retrying in %.1fs...",
                    attempt,
                    response.status_code,
                    backoff,
                )
            except (httpx.TimeoutException, httpx.NetworkError) as err:
                if attempt == max_retries:
                    raise ASRError(f"Groq ASR connection failed after {max_retries} attempts: {err}") from err
                logger.warning("Groq ASR network error on attempt %d: %s. Retrying in %.1fs...", attempt, err, backoff)
            
            import asyncio
            await asyncio.sleep(backoff)
            backoff *= 2

        if response is None or response.status_code >= 400:
            status_code = response.status_code if response else "Unknown"
            text = response.text[:500] if response else "No response"
            raise ASRError(f"Groq ASR failed ({status_code}): {text}")

        payload = response.json()
        segments = [
            ASRSegment(
                start=float(seg.get("start", 0.0)),
                end=float(seg.get("end", 0.0)),
                text=(seg.get("text") or "").strip(),
                words=seg.get("words") or [],
            )
            for seg in payload.get("segments", [])
            if (seg.get("text") or "").strip()
        ]

        if not segments and (payload.get("text") or "").strip():
            segments = [
                ASRSegment(
                    start=0.0,
                    end=float(payload.get("duration") or 0.0),
                    text=payload["text"].strip(),
                )
            ]

        return ASRResult(
            segments=segments,
            language=payload.get("language") or language or "unknown",
            duration=float(payload.get("duration") or (segments[-1].end if segments else 0.0)),
        )


class ASRError(RuntimeError):
    pass


class ColabWhisperXProvider:
    """WhisperX Large V3 running on a Google Colab GPU, exposed via cloudflared.

    The Colab notebook starts a FastAPI micro-server with a POST /transcribe
    endpoint. This provider uploads the WAV file and parses the JSON response.

    The tunnel URL changes every Colab session — update COLAB_GPU_URL in .env
    after starting a new session. The notebook prints the URL on startup.
    """

    def __init__(self, base_url: str):
        if not base_url:
            raise ASRError(
                "COLAB_GPU_URL is required when ASR_PROVIDER=colab. "
                "Start the Colab notebook and paste the tunnel URL into "
                "COLAB_GPU_URL in apps/api/.env."
            )
        self._base_url = base_url.rstrip("/")

    async def transcribe(self, audio_path: Path, language: str | None = None) -> ASRResult:
        url = f"{self._base_url}/transcribe"
        params: dict = {}
        if language:
            params["language"] = language

        # WhisperX on a cold T4 can take 30–90s for a long meeting. Use a
        # generous timeout; the chunking keeps individual files small.
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
            with audio_path.open("rb") as fh:
                try:
                    response = await client.post(
                        url,
                        params=params,
                        files={"file": (audio_path.name, fh, "audio/wav")},
                    )
                except (httpx.ConnectError, httpx.TimeoutException) as err:
                    raise ASRError(
                        f"Cannot reach Colab GPU server at {self._base_url}. "
                        f"Is the notebook running? Error: {err}"
                    ) from err

        if response.status_code >= 400:
            raise ASRError(
                f"Colab ASR failed ({response.status_code}): {response.text[:300]}"
            )

        payload = response.json()
        segments = [
            ASRSegment(
                start=float(seg.get("start", 0.0)),
                end=float(seg.get("end", 0.0)),
                text=(seg.get("text") or "").strip(),
                words=seg.get("words") or [],
            )
            for seg in payload.get("segments", [])
            if (seg.get("text") or "").strip()
        ]

        if not segments and (payload.get("text") or "").strip():
            segments = [
                ASRSegment(
                    start=0.0,
                    end=float(payload.get("duration") or 0.0),
                    text=payload["text"].strip(),
                )
            ]

        return ASRResult(
            segments=segments,
            language=payload.get("language") or language or "unknown",
            duration=float(
                payload.get("duration") or (segments[-1].end if segments else 0.0)
            ),
        )


def get_asr_provider() -> ASRProvider:
    if settings.asr_provider == "colab":
        return ColabWhisperXProvider(base_url=settings.colab_gpu_url)
    # Default: Groq cloud Whisper
    return GroqWhisperProvider(
        api_key=settings.groq_api_key,
        base_url=settings.groq_base_url,
        model=settings.groq_asr_model,
    )
