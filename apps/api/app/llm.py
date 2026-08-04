"""Meeting intelligence — Gemini 1.5 Flash (MVP) behind a swappable interface.

Month 6 replaces this with self-hosted Qwen 3 32B. Only this file changes: the
providers return the same `SummaryResult`, so routes, storage, and the dashboard
are unaffected.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from .config import settings
from .templates import MeetingTemplate, build_summary_prompt

logger = logging.getLogger(__name__)


@dataclass
class ActionItem:
    text: str
    owner: str | None = None
    due_hint: str | None = None


@dataclass
class Insight:
    kind: str  # decision | risk | question | blocker
    text: str


@dataclass
class SummaryResult:
    overview: str
    sections: dict[str, Any]
    action_items: list[ActionItem] = field(default_factory=list)
    insights: list[Insight] = field(default_factory=list)
    model: str = "unknown"


class LLMError(RuntimeError):
    pass


class LLMProvider(Protocol):
    model_name: str

    async def summarise(
        self, template: MeetingTemplate, transcript: str, **context: Any
    ) -> SummaryResult: ...


class GeminiProvider:
    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise LLMError(
                "GEMINI_API_KEY is required when LLM_PROVIDER=gemini. "
                "Obtain a free API key at https://aistudio.google.com or switch LLM_PROVIDER to 'groq' or 'ollama'."
            )
        self._api_key = api_key
        self.model_name = model

    async def summarise(
        self, template: MeetingTemplate, transcript: str, **context: Any
    ) -> SummaryResult:
        system_prompt, user_prompt = build_summary_prompt(template, transcript, **context)

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model_name}:generateContent"
        )
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 8192,
                "responseMimeType": "application/json",
            },
        }

        # Automatic retry with exponential backoff
        max_retries = 3
        backoff = 2.0
        response = None

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
                    response = await client.post(
                        url,
                        headers={
                            "Content-Type": "application/json",
                            "x-goog-api-key": self._api_key,
                        },
                        json=payload,
                    )
                if response.status_code < 500 and response.status_code != 429:
                    break
                logger.warning("Gemini attempt %d failed (%d), retrying...", attempt, response.status_code)
            except (httpx.TimeoutException, httpx.NetworkError) as err:
                if attempt == max_retries:
                    raise LLMError(f"Gemini connection failed after {max_retries} attempts: {err}") from err
                logger.warning("Gemini network error on attempt %d: %s", attempt, err)
            
            import asyncio
            await asyncio.sleep(backoff)
            backoff *= 2

        if response is None or response.status_code >= 400:
            status_code = response.status_code if response else "Unknown"
            text = response.text[:500] if response else "No response"
            raise LLMError(f"Gemini failed ({status_code}): {text}")

        body = response.json()
        try:
            candidate = body["candidates"][0]
        except (KeyError, IndexError):
            reason = body.get("promptFeedback", {}).get("blockReason", "no candidates")
            raise LLMError(f"Gemini returned no output: {reason}") from None

        text = "".join(
            part.get("text", "") for part in candidate.get("content", {}).get("parts", [])
        )
        if candidate.get("finishReason") == "MAX_TOKENS":
            logger.warning("Gemini hit MAX_TOKENS; summary may be truncated")

        return _parse_summary(text, template, self.model_name)


class GroqLLMProvider:
    """Free Cloud LLM (llama-3.3-70b-versatile) via Groq's OpenAI-compatible Chat endpoint."""

    def __init__(self, api_key: str, base_url: str, model: str):
        if not api_key:
            raise LLMError(
                "GROQ_API_KEY is required when LLM_PROVIDER=groq. "
                "Please set GROQ_API_KEY in apps/api/.env (obtain a free key at https://console.groq.com)."
            )
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self.model_name = model

    async def summarise(
        self, template: MeetingTemplate, transcript: str, **context: Any
    ) -> SummaryResult:
        system_prompt, user_prompt = build_summary_prompt(template, transcript, **context)

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }

        max_retries = 3
        backoff = 2.0
        response = None

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
                    response = await client.post(
                        f"{self._base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self._api_key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                if response.status_code < 500 and response.status_code != 429:
                    break
                logger.warning("Groq LLM attempt %d failed (%d), retrying...", attempt, response.status_code)
            except (httpx.TimeoutException, httpx.NetworkError) as err:
                if attempt == max_retries:
                    raise LLMError(f"Groq LLM connection failed after {max_retries} attempts: {err}") from err
                logger.warning("Groq LLM network error on attempt %d: %s", attempt, err)

            import asyncio
            await asyncio.sleep(backoff)
            backoff *= 2

        if response is None or response.status_code >= 400:
            status_code = response.status_code if response else "Unknown"
            text = response.text[:500] if response else "No response"
            raise LLMError(f"Groq LLM failed ({status_code}): {text}")

        body = response.json()
        try:
            raw_text = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError):
            raise LLMError("Groq LLM returned malformed choices output") from None

        return _parse_summary(raw_text, template, self.model_name)


class OllamaProvider:
    """100% Local offline LLM via Ollama (qwen2.5:7b / llama3.1). Zero API keys required."""

    def __init__(self, base_url: str, model: str):
        self._base_url = base_url.rstrip("/")
        self.model_name = model

    async def summarise(
        self, template: MeetingTemplate, transcript: str, **context: Any
    ) -> SummaryResult:
        system_prompt, user_prompt = build_summary_prompt(template, transcript, **context)

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2},
        }

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
                response = await client.post(
                    f"{self._base_url}/api/chat",
                    json=payload,
                )
        except (httpx.TimeoutException, httpx.NetworkError) as err:
            raise LLMError(
                f"Could not connect to Ollama at {self._base_url}. "
                "Ensure Ollama is running (`ollama serve`) and the model is pulled (`ollama pull qwen2.5:7b`)."
            ) from err

        if response.status_code >= 400:
            raise LLMError(f"Ollama failed ({response.status_code}): {response.text[:500]}")

        body = response.json()
        try:
            raw_text = body["message"]["content"]
        except KeyError:
            raise LLMError("Ollama returned invalid message payload") from None

        return _parse_summary(raw_text, template, self.model_name)


class OpenAICompatibleProvider:
    """Standard OpenAI API or OpenAI-compatible endpoint (OpenRouter, DeepSeek, LocalAI, vLLM)."""

    def __init__(self, api_key: str, base_url: str, model: str):
        if not api_key and "localhost" not in base_url and "127.0.0.1" not in base_url:
            raise LLMError("OPENAI_API_KEY is required for OpenAI provider.")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self.model_name = model

    async def summarise(
        self, template: MeetingTemplate, transcript: str, **context: Any
    ) -> SummaryResult:
        system_prompt, user_prompt = build_summary_prompt(template, transcript, **context)

        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers=headers,
                json=payload,
            )

        if response.status_code >= 400:
            raise LLMError(f"OpenAI-compatible LLM failed ({response.status_code}): {response.text[:500]}")

        body = response.json()
        try:
            raw_text = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError):
            raise LLMError("OpenAI-compatible LLM returned malformed choices output") from None

        return _parse_summary(raw_text, template, self.model_name)


def _find_due_hint(text: str) -> str | None:
    match = re.search(
        r"\b(?:by|before|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
        r"today|tomorrow|next week|end of (?:day|week|month)|\d{1,2}(?:st|nd|rd|th)?)",
        text,
        re.IGNORECASE,
    )
    return match.group(1) if match else None


def _parse_summary(raw: str, template: MeetingTemplate, model: str) -> SummaryResult:
    """Parse the model's JSON, tolerating markdown fences and stray prose.

    Anything malformed is dropped rather than raised: a summary missing one
    section is far better than a 500 on a meeting the user already recorded.
    """
    payload = _extract_json(raw)
    if payload is None:
        raise LLMError("Model did not return parseable JSON")

    valid_keys = {s.key for s in template.sections}
    section_kinds = {s.key: s.kind for s in template.sections}
    sections: dict[str, Any] = {}

    for key, value in (payload.get("sections") or {}).items():
        if key not in valid_keys:
            continue  # model invented a section — ignore it
        if section_kinds[key] == "text":
            sections[key] = str(value).strip() if value else ""
        elif isinstance(value, list):
            sections[key] = [str(v).strip() for v in value if str(v).strip()]
        elif value:
            # Model returned a string where a list was requested.
            sections[key] = [str(value).strip()]
        else:
            sections[key] = []

    # Guarantee every declared section exists so the dashboard never sees a hole.
    for section in template.sections:
        sections.setdefault(section.key, "" if section.kind == "text" else [])

    action_items = []
    for item in payload.get("action_items") or []:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        action_items.append(
            ActionItem(
                text=text,
                owner=_clean_optional(item.get("owner")),
                due_hint=_clean_optional(item.get("due_hint")),
            )
        )

    allowed_kinds = {"decision", "risk", "question", "blocker"}
    insights = []
    for item in payload.get("insights") or []:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or "").strip().lower()
        text = str(item.get("text") or "").strip()
        if kind in allowed_kinds and text:
            insights.append(Insight(kind=kind, text=text))

    return SummaryResult(
        overview=str(payload.get("overview") or "").strip(),
        sections=sections,
        action_items=action_items,
        insights=insights,
        model=model,
    )


def _clean_optional(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    # Models write the literal strings "null"/"N/A" instead of JSON null.
    if not text or text.lower() in {"null", "none", "n/a", "unknown", "unassigned"}:
        return None
    return text


def _extract_json(raw: str) -> dict | None:
    text = raw.strip()
    if not text:
        return None

    # Strip ```json fences if responseMimeType was ignored.
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1)

    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    # Last resort: take the outermost brace-balanced span.
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        char = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                try:
                    parsed = json.loads(text[start : i + 1])
                    return parsed if isinstance(parsed, dict) else None
                except json.JSONDecodeError:
                    return None
    return None


class ColabLLMProvider:
    """Qwen 2.5 / Llama 3 running on a Google Colab GPU, exposed via cloudflared.

    The Colab notebook runs Ollama internally and exposes a /summarise endpoint
    that accepts {template, transcript, context} and returns {SummaryResult JSON}.
    This is identical to OllamaProvider but routes through the tunnel URL instead
    of localhost.
    """

    model_name = "qwen2.5:7b-colab"

    def __init__(self, base_url: str, model: str = "qwen2.5:7b"):
        if not base_url:
            raise LLMError(
                "COLAB_GPU_URL is required when LLM_PROVIDER=colab. "
                "Start the Colab notebook and paste the tunnel URL into "
                "COLAB_GPU_URL in apps/api/.env."
            )
        self._base_url = base_url.rstrip("/")
        self.model_name = f"{model}-colab"
        self._model = model

    async def summarise(
        self, template: MeetingTemplate, transcript: str, **context: Any
    ) -> SummaryResult:
        system_prompt, user_prompt = build_summary_prompt(template, transcript, **context)
        url = f"{self._base_url}/summarise"

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
                response = await client.post(
                    url,
                    json={
                        "model": self._model,
                        "system": system_prompt,
                        "prompt": user_prompt,
                    },
                )
        except (httpx.ConnectError, httpx.TimeoutException) as err:
            raise LLMError(
                f"Cannot reach Colab GPU server at {self._base_url}. "
                f"Is the notebook running? Error: {err}"
            ) from err

        if response.status_code >= 400:
            raise LLMError(
                f"Colab LLM failed ({response.status_code}): {response.text[:300]}"
            )

        payload = response.json()
        # Colab /summarise returns {overview, sections, action_items, insights}
        return SummaryResult(
            overview=payload.get("overview", ""),
            sections=payload.get("sections", {}),
            action_items=[
                ActionItem(
                    text=a.get("text", ""),
                    owner=a.get("owner"),
                    due_hint=a.get("due_hint"),
                )
                for a in payload.get("action_items", [])
            ],
            insights=[
                Insight(kind=i.get("kind", "decision"), text=i.get("text", ""))
                for i in payload.get("insights", [])
            ],
            model=self.model_name,
        )


def get_llm_provider() -> LLMProvider:
    provider = settings.llm_provider.lower()
    if provider == "gemini":
        return GeminiProvider(settings.gemini_api_key, settings.gemini_model)
    elif provider == "ollama":
        return OllamaProvider(settings.ollama_base_url, settings.ollama_model)
    elif provider == "openai":
        return OpenAICompatibleProvider(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            model=settings.openai_model,
        )
    elif provider == "colab":
        return ColabLLMProvider(
            base_url=settings.colab_gpu_url,
            model=settings.ollama_model,  # reuse OLLAMA_MODEL for the Colab model name
        )
    # Default: groq (free cloud LLM using GROQ_API_KEY)
    return GroqLLMProvider(
        api_key=settings.groq_api_key or settings.groq_api_key,
        base_url=settings.groq_base_url,
        model=settings.groq_llm_model,
    )
