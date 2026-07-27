"""Request/response models."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class CreateMeetingRequest(BaseModel):
    title: str = Field(default="Untitled meeting", max_length=300)
    meet_url: str | None = Field(default=None, max_length=1000)
    platform: str = Field(default="google_meet", max_length=50)

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str) -> str:
        return value.strip() or "Untitled meeting"


class MeetingResponse(BaseModel):
    id: str
    workspace_id: str
    title: str
    status: str
    platform: str
    meet_url: str | None = None
    error_message: str | None = None
    duration_secs: int | None = None
    language: str | None = None
    speaker_count: int | None = None
    started_at: str | None = None
    ended_at: str | None = None
    created_at: str | None = None


class FinaliseMeetingRequest(BaseModel):
    """Sent when the recording stops. Triggers the pipeline."""

    title: str | None = Field(default=None, max_length=300)
    # Client-observed duration; the server's ffprobe value takes precedence.
    duration_secs: int | None = Field(default=None, ge=0)
    # Run the summary immediately after transcription instead of a second call.
    auto_summarise: bool = False
    template: str | None = None


class TranscriptSegmentResponse(BaseModel):
    id: str
    seq: int
    speaker: str
    start_secs: float
    end_secs: float
    text: str
    raw_text: str
    language: str | None = None
    edited_at: str | None = None


class UpdateSegmentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)
    # When the edit is a single-word substitution, promote it to workspace
    # vocabulary so every future meeting benefits. This is the moat's feedback loop.
    learn_vocabulary: bool = True


class GenerateSummaryRequest(BaseModel):
    template: str = "client_meeting"


class SummaryResponse(BaseModel):
    template: str
    overview: str
    sections: dict[str, Any]
    action_items: list[dict[str, Any]] = Field(default_factory=list)
    insights: list[dict[str, Any]] = Field(default_factory=list)
    model: str


class VocabularyTermRequest(BaseModel):
    wrong: str = Field(min_length=1, max_length=200)
    right: str = Field(min_length=1, max_length=200, alias="right_term")

    model_config = {"populate_by_name": True}

    @field_validator("wrong", "right")
    @classmethod
    def _trim(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be blank")
        return cleaned


class VocabularyTermResponse(BaseModel):
    id: str
    wrong: str
    right_term: str
    source: str
    hit_count: int
    created_at: str | None = None


class ActionItemStatusRequest(BaseModel):
    status: Literal["open", "done"]


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    slug: str
    industry: str
    role: str | None = None


class HealthResponse(BaseModel):
    status: str
    environment: str
    backend: str
    asr_provider: str
    llm_provider: str
    ffmpeg: bool
    storage_ready: bool
