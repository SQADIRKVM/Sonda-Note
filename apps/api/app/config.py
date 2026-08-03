"""Runtime configuration, loaded from environment.

Every external service degrades to a stub when its key is absent, so the whole
pipeline runs offline for development (see ASR_PROVIDER=mock, LLM_PROVIDER=mock).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    environment: Literal["development", "production"] = "development"
    log_level: str = "INFO"

    # ── Backend selection ──
    # local    → SQLite + filesystem + locally-signed JWTs. Zero external services.
    # supabase → hosted Postgres + Storage + Supabase Auth.
    # postgres / neon → direct PostgreSQL connection via database_url.
    backend: Literal["local", "supabase", "postgres", "neon"] = "local"
    database_url: str = ""
    redis_url: str = ""

    local_db_path: str = "./data/sondanote.db"
    local_storage_dir: str = "./data/audio"
    # Signing key for locally-issued JWTs. Generated on first run and persisted
    # to data/.jwt_secret so sessions survive a restart; override in production.
    local_jwt_secret: str = ""
    local_token_ttl_seconds: int = 7 * 24 * 3600

    # ── Supabase ──
    supabase_url: str = ""
    supabase_anon_key: str = ""
    # Service-role key bypasses RLS. The backend uses it only after it has
    # verified the caller's JWT and resolved their workspace membership.
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_audio_bucket: str = "meeting-audio"

    # ── Colab GPU Inference Server ──
    # When ASR_PROVIDER=colab or LLM_PROVIDER=colab, all GPU work is forwarded
    # to a FastAPI inference server running in Google Colab and exposed via a
    # cloudflared / ngrok tunnel. Update COLAB_GPU_URL whenever you start a new
    # Colab session (the tunnel URL changes each time).
    colab_gpu_url: str = ""  # e.g. https://abc123.trycloudflare.com

    # ── ASR ──
    # groq  → Whisper Large V3 via Groq API (free tier)
    # colab → WhisperX Large V3 on a Colab T4/A100 GPU (free, no API key needed)
    asr_provider: Literal["groq", "colab"] = "groq"
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_asr_model: str = "whisper-large-v3"
    # Leave unset for auto-detection per chunk. Malayalam-heavy workspaces may
    # prefer pinning "ml" — auto-detect occasionally flips code-mixed audio to
    # Hindi or Tamil.
    asr_language: str = ""

    # ── LLM ──
    # groq   → Free Cloud LLM (llama-3.3-70b-versatile via GROQ_API_KEY)
    # gemini → Google AI Studio Gemini API (gemini-1.5-flash / gemini-2.0-flash)
    # ollama → 100% Local offline LLM (qwen2.5:7b / llama3.1 via http://localhost:11434)
    # openai → OpenAI or custom OpenAI-compatible endpoint
    # colab  → Qwen 2.5 7B (or larger) running on a Colab GPU via tunnel
    llm_provider: Literal["groq", "gemini", "ollama", "openai", "colab"] = "groq"
    
    # Groq LLM
    groq_llm_model: str = "llama-3.3-70b-versatile"
    
    # Gemini LLM
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    
    # Ollama Local LLM
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    
    # OpenAI / Compatible LLM
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    
    # 1M-token context handles a long meeting in one call; this caps runaway cost.
    llm_max_transcript_chars: int = 600_000

    # ── Audio ──
    ffmpeg_path: str = "ffmpeg"
    target_sample_rate: int = 16_000
    target_channels: int = 1
    # A 30s chunk of Opus-encoded WebM is well under 1 MB; 25 MB is a generous
    # ceiling that still rejects a runaway or malicious upload.
    max_chunk_bytes: int = 25 * 1024 * 1024
    max_meeting_seconds: int = 4 * 60 * 60

    # ── HTTP ──
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    # chrome-extension:// origins are added dynamically in main.py via regex,
    # since the extension ID differs between dev and published builds.

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def is_neon(self) -> bool:
        return self.backend in ("neon", "postgres") or (bool(self.database_url) and self.backend != "supabase")

    @property
    def is_local(self) -> bool:
        return self.backend == "local" and not bool(self.database_url)

    def resolve_jwt_secret(self) -> str:
        """Signing key for the active backend.

        In local or Neon mode without Supabase Auth, generate a random key on first run
        and persist it beside the database so sessions survive a restart.
        """
        if self.backend == "supabase" and self.supabase_jwt_secret:
            return self.supabase_jwt_secret

        if self.local_jwt_secret:
            return self.local_jwt_secret

        import secrets
        from pathlib import Path

        key_path = Path(self.local_db_path).parent / ".jwt_secret"
        key_path.parent.mkdir(parents=True, exist_ok=True)

        if key_path.exists():
            self.local_jwt_secret = key_path.read_text().strip()
        else:
            self.local_jwt_secret = secrets.token_urlsafe(48)
            key_path.write_text(self.local_jwt_secret)
            key_path.chmod(0o600)  # readable only by the owner

        return self.local_jwt_secret


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
