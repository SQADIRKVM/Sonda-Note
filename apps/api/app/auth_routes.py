"""Local authentication — signup, signin, session.

Only mounted when BACKEND=local. With BACKEND=supabase these are handled by
Supabase Auth and the dashboard talks to it directly.

Tokens are the same shape Supabase issues (HS256, aud=authenticated, sub = user
id), so deps.py, the extension, and the dashboard need no branching.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from . import local_store as ls
from . import postgres_store as pg
from .config import settings
from .deps import AuthUser, issue_token, require_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _store():
    return pg if settings.is_neon else ls


class CredentialsRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class SessionResponse(BaseModel):
    access_token: str
    expires_at: int
    user: dict
    workspace: dict


def _session_for(user: dict) -> SessionResponse:
    workspace = _store().ensure_workspace(user["id"], user["email"])
    token, expires_at = issue_token(user["id"], user["email"])
    return SessionResponse(
        access_token=token,
        expires_at=expires_at,
        user={"id": user["id"], "email": user["email"]},
        workspace=workspace,
    )


@router.post("/signup", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: CredentialsRequest) -> SessionResponse:
    try:
        user = _store().create_user(body.email, body.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None

    logger.info("New account created: %s", user["email"])
    return _session_for(user)


@router.post("/signin", response_model=SessionResponse)
async def signin(body: CredentialsRequest) -> SessionResponse:
    user = _store().authenticate(body.email, body.password)
    if not user:
        # One message for both cases, so the response cannot be used to probe
        # which emails have accounts.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    return _session_for(user)


@router.get("/session", response_model=SessionResponse)
async def current_session(user: AuthUser = Depends(require_user)) -> SessionResponse:
    """Validate the caller's token and return a refreshed one.

    The dashboard calls this on load to confirm a stored token is still good.
    """
    record = ls.get_user(user.id)
    if not record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found")
    return _session_for(record)
