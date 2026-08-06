"""Sonda Note — FastAPI application entrypoint."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .audio import ffmpeg_available
from .config import settings
from .routes import router

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("sondanote")

app = FastAPI(
    title="Sonda Note API",
    description="Conversational Knowledge Engine API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # The extension's origin is chrome-extension://<id>, and the id differs
    # between an unpacked dev build and the published one, so it is matched by
    # pattern rather than listed.
    allow_origin_regex=r"^chrome-extension://[a-p]{32}$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

# Auth router for local SQLite and Neon PostgreSQL backends.
if settings.is_local or settings.is_neon:
    from .auth_routes import router as auth_router

    app.include_router(auth_router)


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    """Never leak a stack trace to a client; log it instead."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.on_event("startup")
async def startup() -> None:
    logger.info("Sonda Note API starting (%s)", settings.environment)
    logger.info("  Backend      : %s", settings.backend)
    logger.info("  ASR provider : %s", settings.asr_provider)
    logger.info("  LLM provider : %s", settings.llm_provider)

    if settings.is_local:
        from . import local_store

        local_store.get_conn()  # create the schema up front
        settings.resolve_jwt_secret()  # generate/load the signing key
        logger.info("  Database     : %s", settings.local_db_path)
        logger.info("  Audio        : %s", settings.local_storage_dir)
    else:
        logger.info(
            "  Supabase     : %s", "configured" if settings.supabase_configured else "NOT SET"
        )

    if not ffmpeg_available():
        logger.warning(
            "  ffmpeg       : NOT FOUND at '%s' — transcription will fail. "
            "Install with: brew install ffmpeg",
            settings.ffmpeg_path,
        )
    else:
        logger.info("  ffmpeg       : ok")

    # Startup Job Recovery: scan database for queued / interrupted meetings and resume processing
    try:
        import asyncio
        from . import db
        from .pipeline import process_meeting

        pending = db.list_pending_meetings()
        if pending:
            logger.info("  Recovery     : found %d pending meeting(s), enqueuing for processing...", len(pending))
            for item in pending:
                asyncio.create_task(process_meeting(item["id"], item["workspace_id"]))
        else:
            logger.info("  Recovery     : clean startup (0 pending meetings)")
    except Exception as err:
        logger.warning("  Recovery     : scan failed: %s", err)


@app.get("/", tags=["system"])
async def root() -> dict:
    return {
        "product": "Sonda Note",
        "tagline": "Indian meeting intelligence. Malayalam-first. No fine-tuning.",
        "version": "1.0.0",
        "docs": "/docs",
    }
