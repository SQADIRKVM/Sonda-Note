"""HTTP + WebSocket API.

Endpoint map (spec §FASTAPI ENDPOINTS, with REST-shaped names):

  POST   /api/meetings                        create a recording session
  POST   /api/meetings/{id}/chunks            upload one WebM chunk
  POST   /api/meetings/{id}/finalise          stop recording → run pipeline
  POST   /api/meetings/{id}/process           re-run the pipeline (retry)
  GET    /api/meetings                        list meetings for the workspace
  GET    /api/meetings/{id}                   meeting detail
  DELETE /api/meetings/{id}                   delete meeting + audio
  GET    /api/meetings/{id}/transcript        cleaned, speaker-labelled transcript
  PATCH  /api/segments/{id}                   inline correction (feeds vocabulary)
  POST   /api/meetings/{id}/summary           run LLM with a meeting template
  GET    /api/meetings/{id}/summary           stored summaries + insights
  GET    /api/tasks                           action items across the workspace
  PATCH  /api/tasks/{id}                      open / done
  GET    /api/vocabulary                      workspace dictionary
  POST   /api/vocabulary                      add or update a correction
  DELETE /api/vocabulary/{id}                 remove a correction
  GET    /api/templates                       template catalogue
  GET    /api/workspaces                      caller's workspaces
  WS     /ws/record/{meeting_id}              live chunk streaming
"""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from starlette.responses import StreamingResponse

from . import db
from .audio import ffmpeg_available
from .config import settings
from .deps import AuthUser, WorkspaceContext, authorise_socket, require_user, require_workspace
from .pipeline import PipelineError, format_transcript, generate_intelligence, process_meeting
from .schemas import (
    ActionItemStatusRequest,
    CreateMeetingRequest,
    FinaliseMeetingRequest,
    GenerateSummaryRequest,
    HealthResponse,
    UpdateSegmentRequest,
    VocabularyTermRequest,
)
from .templates import DEFAULT_TEMPLATE, template_catalogue

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        backend=settings.backend,
        asr_provider=settings.asr_provider,
        llm_provider=settings.llm_provider,
        ffmpeg=ffmpeg_available(),
        storage_ready=True if settings.is_local else settings.supabase_configured,
    )


@router.get("/api/templates", tags=["templates"])
async def get_templates() -> dict:
    return {"templates": template_catalogue(), "default": DEFAULT_TEMPLATE}


@router.get("/api/workspaces", tags=["workspaces"])
async def get_workspaces(user: AuthUser = Depends(require_user)) -> dict:
    return {"workspaces": db.get_user_workspaces(user.id)}


# ─────────────────────────────────────────────────────────
# MEETINGS
# ─────────────────────────────────────────────────────────

@router.post("/api/meetings", status_code=status.HTTP_201_CREATED, tags=["meetings"])
async def create_meeting(
    body: CreateMeetingRequest,
    ctx: WorkspaceContext = Depends(require_workspace),
) -> dict:
    meeting = db.create_meeting(
        workspace_id=ctx.workspace_id,
        user_id=ctx.user.id,
        title=body.title,
        meet_url=body.meet_url,
        platform=body.platform,
    )
    return {"meeting": meeting}


@router.get("/api/meetings", tags=["meetings"])
async def list_meetings(
    ctx: WorkspaceContext = Depends(require_workspace),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    return {"meetings": db.list_meetings(ctx.workspace_id, limit=limit, offset=offset)}


@router.get("/api/meetings/{meeting_id}", tags=["meetings"])
async def get_meeting(
    meeting_id: str, ctx: WorkspaceContext = Depends(require_workspace)
) -> dict:
    meeting = _require_meeting(meeting_id, ctx)
    return {
        "meeting": meeting,
        "chunk_count": len(db.list_chunks(meeting_id, ctx.workspace_id)),
    }


@router.get("/api/meetings/{meeting_id}/audio", tags=["meetings"])
async def get_meeting_audio(
    meeting_id: str, ctx: WorkspaceContext = Depends(require_workspace)
) -> Response:
    """Stream concatenated WebM audio chunks for a meeting."""
    _require_meeting(meeting_id, ctx)
    chunks = db.list_chunks(meeting_id, ctx.workspace_id)
    if not chunks:
        raise HTTPException(status_code=404, detail="No audio recorded for this meeting")

    async def iter_chunks():
        for chunk in chunks:
            yield db.download_chunk(chunk["storage_path"])

    return StreamingResponse(
        iter_chunks(),
        media_type="audio/webm",
        headers={
            "Content-Disposition": f'inline; filename="{meeting_id}.webm"',
        },
    )


@router.delete("/api/meetings/{meeting_id}", tags=["meetings"])
async def delete_meeting(
    meeting_id: str, ctx: WorkspaceContext = Depends(require_workspace)
) -> dict:
    _require_meeting(meeting_id, ctx)

    # Cascade removes chunk rows, but audio objects are not FK-linked, so they
    # must be deleted explicitly or they become orphaned storage cost. The local
    # backend handles this inside delete_meeting().
    if not settings.is_local:
        chunks = db.list_chunks(meeting_id, ctx.workspace_id)
        if chunks:
            try:
                db.get_client().storage.from_(settings.supabase_audio_bucket).remove(
                    [chunk["storage_path"] for chunk in chunks]
                )
            except Exception:
                logger.warning("Could not delete audio for meeting %s", meeting_id, exc_info=True)

    db.delete_meeting(meeting_id, ctx.workspace_id)
    return {"deleted": meeting_id}


@router.post("/api/meetings/{meeting_id}/chunks", tags=["meetings"])
async def upload_chunk(
    meeting_id: str,
    seq: int = Form(...),
    file: UploadFile = File(...),
    ctx: WorkspaceContext = Depends(require_workspace),
) -> dict:
    """Fallback upload path for when the WebSocket is unavailable."""
    _require_meeting(meeting_id, ctx)

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Empty chunk")
    if len(payload) > settings.max_chunk_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Chunk exceeds {settings.max_chunk_bytes} bytes",
        )

    db.upload_chunk(ctx.workspace_id, meeting_id, seq, payload)
    return {"seq": seq, "bytes": len(payload)}


@router.post("/api/meetings/{meeting_id}/finalise", tags=["meetings"])
async def finalise_meeting(
    meeting_id: str,
    body: FinaliseMeetingRequest,
    background: BackgroundTasks,
    ctx: WorkspaceContext = Depends(require_workspace),
) -> dict:
    """Recording stopped: queue the pipeline and return immediately.

    The extension must not wait for transcription — a long meeting takes minutes.
    The dashboard polls meeting.status instead.
    """
    meeting = _require_meeting(meeting_id, ctx)

    if meeting["status"] == "processing":
        raise HTTPException(status_code=409, detail="Already processing")

    fields: dict = {"status": "queued", "ended_at": "now()"}
    if body.title:
        fields["title"] = body.title
    if body.duration_secs:
        fields["duration_secs"] = body.duration_secs
    db.update_meeting(meeting_id, ctx.workspace_id, **fields)

    background.add_task(
        _run_pipeline,
        meeting_id,
        ctx.workspace_id,
        ctx.industry,
        ctx.workspace_name,
        body.template or DEFAULT_TEMPLATE if body.auto_summarise else None,
    )
    return {"meeting_id": meeting_id, "status": "queued"}


@router.post("/api/meetings/{meeting_id}/process", tags=["meetings"])
async def reprocess_meeting(
    meeting_id: str,
    background: BackgroundTasks,
    ctx: WorkspaceContext = Depends(require_workspace),
) -> dict:
    """Re-run the pipeline. Used to retry a failure, or to re-clean a transcript
    after the workspace vocabulary has grown."""
    meeting = _require_meeting(meeting_id, ctx)
    if meeting["status"] == "processing":
        raise HTTPException(status_code=409, detail="Already processing")

    db.set_meeting_status(meeting_id, ctx.workspace_id, "queued")
    background.add_task(
        _run_pipeline, meeting_id, ctx.workspace_id, ctx.industry, ctx.workspace_name, None
    )
    return {"meeting_id": meeting_id, "status": "queued"}


async def _run_pipeline(
    meeting_id: str,
    workspace_id: str,
    industry: str,
    workspace_name: str,
    auto_template: str | None,
) -> None:
    """Background pipeline runner.

    Swallows exceptions: process_meeting has already recorded the failure on the
    meeting row, and an unhandled error in a BackgroundTask would otherwise only
    surface in server logs.
    """
    try:
        await process_meeting(meeting_id, workspace_id, industry=industry)
    except Exception:
        return

    if auto_template:
        try:
            await generate_intelligence(
                meeting_id, workspace_id, auto_template, workspace_name=workspace_name
            )
        except Exception:
            # Transcript succeeded; only the summary failed. Leave status 'ready'
            # so the user still gets their transcript and can retry the summary.
            logger.exception("Auto-summary failed for meeting %s", meeting_id)


# ─────────────────────────────────────────────────────────
# TRANSCRIPT
# ─────────────────────────────────────────────────────────

@router.get("/api/meetings/{meeting_id}/transcript", tags=["transcript"])
async def get_transcript(
    meeting_id: str,
    fmt: str = Query(default="json", pattern="^(json|text)$"),
    ctx: WorkspaceContext = Depends(require_workspace),
) -> dict:
    meeting = _require_meeting(meeting_id, ctx)
    segments = db.get_transcript(meeting_id, ctx.workspace_id)

    if fmt == "text":
        return {"meeting": meeting, "text": format_transcript(segments)}
    return {"meeting": meeting, "segments": segments}


@router.patch("/api/segments/{segment_id}", tags=["transcript"])
async def update_segment(
    segment_id: str,
    body: UpdateSegmentRequest,
    ctx: WorkspaceContext = Depends(require_workspace),
) -> dict:
    """Apply an inline transcript correction.

    Delegates to the apply_transcript_correction SQL function so the segment
    update, the audit row, and the vocabulary promotion happen in one transaction.
    """
    # Verify the segment belongs to the caller's workspace before touching it —
    # the id alone is not proof of access.
    segment = db.get_segment(segment_id)
    if not segment or segment.get("workspace_id") != ctx.workspace_id:
        raise HTTPException(status_code=404, detail="Segment not found")

    try:
        updated = db.apply_correction(
            segment_id, body.text, ctx.user.id, learn_vocabulary=body.learn_vocabulary
        )
    except Exception as exc:
        logger.exception("Correction failed for segment %s", segment_id)
        raise HTTPException(
            status_code=500, detail=f"Correction failed: {str(exc)[:200]}"
        ) from None

    return {"segment": updated}


# ─────────────────────────────────────────────────────────
# INTELLIGENCE
# ─────────────────────────────────────────────────────────

@router.post("/api/meetings/{meeting_id}/summary", tags=["intelligence"])
async def create_summary(
    meeting_id: str,
    body: GenerateSummaryRequest,
    ctx: WorkspaceContext = Depends(require_workspace),
) -> dict:
    _require_meeting(meeting_id, ctx)
    try:
        return await generate_intelligence(
            meeting_id, ctx.workspace_id, body.template, workspace_name=ctx.workspace_name
        )
    except ValueError as exc:  # unknown template
        raise HTTPException(status_code=400, detail=str(exc)) from None
    except PipelineError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None


@router.get("/api/meetings/{meeting_id}/detail", tags=["meetings"])
async def get_meeting_detail(
    meeting_id: str, ctx: WorkspaceContext = Depends(require_workspace)
) -> dict:
    """Everything the meeting page renders, in one round trip.

    The dashboard reads this instead of querying the database directly, so the
    same page works against either backend.
    """
    meeting = _require_meeting(meeting_id, ctx)
    return {
        "meeting": meeting,
        "segments": db.get_transcript(meeting_id, ctx.workspace_id),
        "summaries": db.get_summaries(meeting_id, ctx.workspace_id),
        "tasks": db.list_action_items(ctx.workspace_id, meeting_id=meeting_id),
        "insights": db.list_insights(meeting_id, ctx.workspace_id),
    }


@router.get("/api/overview", tags=["meetings"])
async def get_overview(ctx: WorkspaceContext = Depends(require_workspace)) -> dict:
    """Meetings list plus the counters shown on the dashboard home."""
    meetings = db.list_meetings(ctx.workspace_id, limit=100)
    tasks = db.list_action_items(ctx.workspace_id)
    vocabulary = db.list_vocabulary(ctx.workspace_id)

    total_seconds = sum(m.get("duration_secs") or 0 for m in meetings)

    return {
        "workspace": {
            "id": ctx.workspace_id,
            "name": ctx.workspace_name,
            "industry": ctx.industry,
        },
        "meetings": meetings,
        "stats": {
            "meetings": len(meetings),
            # Round up, so a recorded-but-short meeting never displays as "0
            # minutes recorded" — which reads as "nothing was captured".
            "minutes": -(-total_seconds // 60) if total_seconds else 0,
            "open_tasks": sum(1 for t in tasks if t.get("status") == "open"),
            "vocabulary_terms": len(vocabulary),
        },
    }


@router.get("/api/meetings/{meeting_id}/summary", tags=["intelligence"])
async def get_summary(
    meeting_id: str, ctx: WorkspaceContext = Depends(require_workspace)
) -> dict:
    _require_meeting(meeting_id, ctx)
    return {
        "summaries": db.get_summaries(meeting_id, ctx.workspace_id),
        "action_items": db.list_action_items(ctx.workspace_id, meeting_id=meeting_id),
        "insights": db.list_insights(meeting_id, ctx.workspace_id),
    }


@router.get("/api/tasks", tags=["intelligence"])
async def list_tasks(
    ctx: WorkspaceContext = Depends(require_workspace),
    task_status: str | None = Query(default=None, alias="status", pattern="^(open|done)$"),
) -> dict:
    return {"tasks": db.list_action_items(ctx.workspace_id, status=task_status)}


@router.patch("/api/tasks/{task_id}", tags=["intelligence"])
async def update_task(
    task_id: str,
    body: ActionItemStatusRequest,
    ctx: WorkspaceContext = Depends(require_workspace),
) -> dict:
    updated = db.set_action_item_status(task_id, ctx.workspace_id, body.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task": updated}


# ─────────────────────────────────────────────────────────
# VOCABULARY — the moat
# ─────────────────────────────────────────────────────────

@router.get("/api/vocabulary", tags=["vocabulary"])
async def get_vocabulary(ctx: WorkspaceContext = Depends(require_workspace)) -> dict:
    return {
        "terms": db.list_vocabulary(ctx.workspace_id),
        "industry": ctx.industry,
    }


@router.post("/api/vocabulary", status_code=status.HTTP_201_CREATED, tags=["vocabulary"])
async def add_vocabulary_term(
    body: VocabularyTermRequest, ctx: WorkspaceContext = Depends(require_workspace)
) -> dict:
    if body.wrong.lower() == body.right.lower():
        raise HTTPException(status_code=400, detail="'wrong' and 'right' are identical")
    term = db.upsert_vocabulary_term(
        ctx.workspace_id, body.wrong, body.right, user_id=ctx.user.id
    )
    return {"term": term}


@router.delete("/api/vocabulary/{term_id}", tags=["vocabulary"])
async def delete_vocabulary_term(
    term_id: str, ctx: WorkspaceContext = Depends(require_workspace)
) -> dict:
    db.delete_vocabulary_term(term_id, ctx.workspace_id)
    return {"deleted": term_id}


# ─────────────────────────────────────────────────────────
# WEBSOCKET — chunk streaming (spec layer 03)
# ─────────────────────────────────────────────────────────

@router.websocket("/ws/record/{meeting_id}")
async def record_socket(websocket: WebSocket, meeting_id: str) -> None:
    """Persistent connection carrying 30-second WebM chunks from the extension.

    Protocol:
      client → {"type":"auth","token":"<jwt>","workspace_id":"<uuid?>"}
      server → {"type":"ready"}
      client → {"type":"chunk","seq":N}  followed immediately by one binary frame
      server → {"type":"ack","seq":N}
      client → {"type":"done"}
      server → {"type":"queued"}

    The header-then-binary split exists because browsers cannot attach metadata to
    a binary WebSocket frame. Sequence numbers come from the client so that a
    dropped-and-reconnected socket resumes without gaps or duplicates.
    """
    await websocket.accept()
    ctx: WorkspaceContext | None = None
    pending_seq: int | None = None
    received = 0

    try:
        # ── handshake ──
        try:
            auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=15.0)
        except (asyncio.TimeoutError, ValueError):
            await _close(websocket, 4401, "Expected an auth message")
            return

        if auth_message.get("type") != "auth" or not auth_message.get("token"):
            await _close(websocket, 4401, "First message must be auth")
            return

        try:
            ctx = authorise_socket(auth_message["token"], auth_message.get("workspace_id"))
        except HTTPException as exc:
            await _close(websocket, 4403, str(exc.detail))
            return

        meeting = db.get_meeting(meeting_id, ctx.workspace_id)
        if not meeting:
            await _close(websocket, 4404, "Meeting not found")
            return

        await websocket.send_json({"type": "ready", "meeting_id": meeting_id})

        # ── streaming ──
        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            if (text := message.get("text")) is not None:
                try:
                    payload = json.loads(text)
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "detail": "Malformed JSON"})
                    continue

                kind = payload.get("type")
                if kind == "chunk":
                    pending_seq = int(payload.get("seq", received))
                elif kind == "done":
                    db.update_meeting(
                        meeting_id, ctx.workspace_id, status="queued", ended_at="now()"
                    )
                    asyncio.create_task(
                        _run_pipeline(
                            meeting_id, ctx.workspace_id, ctx.industry, ctx.workspace_name, None
                        )
                    )
                    await websocket.send_json({"type": "queued", "chunks": received})
                    break
                elif kind == "ping":
                    await websocket.send_json({"type": "pong"})
                continue

            if (payload_bytes := message.get("bytes")) is not None:
                if pending_seq is None:
                    await websocket.send_json(
                        {"type": "error", "detail": "Binary frame without a chunk header"}
                    )
                    continue
                if len(payload_bytes) > settings.max_chunk_bytes:
                    await websocket.send_json(
                        {"type": "error", "seq": pending_seq, "detail": "Chunk too large"}
                    )
                    pending_seq = None
                    continue

                try:
                    db.upload_chunk(ctx.workspace_id, meeting_id, pending_seq, payload_bytes)
                except Exception as exc:
                    logger.exception("Chunk upload failed: meeting=%s", meeting_id)
                    await websocket.send_json(
                        {"type": "error", "seq": pending_seq, "detail": str(exc)[:200]}
                    )
                    pending_seq = None
                    continue

                received += 1
                await websocket.send_json(
                    {"type": "ack", "seq": pending_seq, "bytes": len(payload_bytes)}
                )
                pending_seq = None

    except WebSocketDisconnect:
        logger.info("Recorder disconnected: meeting=%s chunks=%d", meeting_id, received)
    except Exception:
        logger.exception("WebSocket error: meeting=%s", meeting_id)
        await _close(websocket, 1011, "Server error")


async def _close(websocket: WebSocket, code: int, reason: str) -> None:
    try:
        await websocket.close(code=code, reason=reason)
    except RuntimeError:
        pass  # already closed


def _require_meeting(meeting_id: str, ctx: WorkspaceContext) -> dict:
    meeting = db.get_meeting(meeting_id, ctx.workspace_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting
