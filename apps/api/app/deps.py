"""Authentication and workspace resolution.

Auth flow (spec):
  1. User signs in on the dashboard (Supabase Auth)
  2. Extension reads the JWT from chrome.storage.local
  3. Token is attached to every WebSocket message and chunk upload
  4. FastAPI validates the token → resolves the caller's workspace
  5. RLS isolates data per workspace_id

Because the backend uses the service-role key (which bypasses RLS), the workspace
check here IS the security boundary. A request may name a workspace_id, but it is
only honoured after `require_workspace` confirms the caller is a member.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException, Query, status

from . import db
from .config import settings

logger = logging.getLogger(__name__)


@dataclass
class AuthUser:
    id: str
    email: str | None = None


@dataclass
class WorkspaceContext:
    user: AuthUser
    workspace_id: str
    workspace_name: str
    industry: str


def issue_token(user_id: str, email: str | None = None) -> tuple[str, int]:
    """Mint a local session JWT. Local backend only.

    Deliberately the same shape Supabase issues (HS256, aud=authenticated, sub =
    user id) so decode_token, the extension, and the dashboard need no branching.
    Returns (token, expires_at_unix).
    """
    import time

    expires_at = int(time.time()) + settings.local_token_ttl_seconds
    token = jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "aud": "authenticated",
            "iat": int(time.time()),
            "exp": expires_at,
        },
        settings.resolve_jwt_secret(),
        algorithm="HS256",
    )
    return token, expires_at


def decode_token(token: str) -> AuthUser:
    """Verify a session JWT and return the caller.

    Both backends sign with HS256 and aud=authenticated, so verification is
    identical; only the secret differs. Never `verify_signature: False`, which
    would let anyone mint a token for any workspace.
    """
    secret = settings.resolve_jwt_secret()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No JWT secret configured on the server",
        )

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired — sign in again on the dashboard",
        ) from None
    except jwt.InvalidTokenError as exc:
        logger.warning("Rejected token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from None

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has no subject"
        )

    return AuthUser(id=subject, email=payload.get("email"))


def _extract_bearer(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization must be 'Bearer <token>'",
        )
    return token.strip()


async def require_user(authorization: str | None = Header(default=None)) -> AuthUser:
    return decode_token(_extract_bearer(authorization))


async def require_workspace(
    user: AuthUser = Depends(require_user),
    workspace_id: str | None = Header(default=None, alias="X-Workspace-Id"),
    workspace_query: str | None = Query(default=None, alias="workspace_id"),
) -> WorkspaceContext:
    """Resolve and authorise the caller's workspace.

    Accepts the workspace from a header (extension) or query param (dashboard
    links). With neither, falls back to the caller's only workspace — which keeps
    single-workspace users, i.e. everyone in Month 1–2, from having to pass it.
    """
    requested = workspace_id or workspace_query

    if requested:
        workspace = db.get_workspace(requested) if db.is_member(requested, user.id) else None
        if not workspace:
            # Stale or reset workspace ID — auto-recover to user's primary workspace
            workspaces = db.get_user_workspaces(user.id)
            if workspaces:
                workspace = workspaces[0]
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found"
                )
    else:
        workspaces = db.get_user_workspaces(user.id)
        if not workspaces:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No workspace yet — create one on the dashboard first",
            )
        workspace = workspaces[0]

    return WorkspaceContext(
        user=user,
        workspace_id=workspace["id"],
        workspace_name=workspace.get("name") or "",
        industry=workspace.get("industry") or "tech",
    )


def authorise_socket(token: str, workspace_id: str | None) -> WorkspaceContext:
    """Same checks as require_workspace, for the WebSocket handshake.

    WebSockets cannot carry custom headers from the browser, so the extension
    sends the token in the first frame. Raises HTTPException; the caller
    translates it to a close code.
    """
    user = decode_token(token)

    if workspace_id:
        if not db.is_member(workspace_id, user.id):
            raise HTTPException(status_code=404, detail="Workspace not found")
        workspace = db.get_workspace(workspace_id)
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
    else:
        workspaces = db.get_user_workspaces(user.id)
        if not workspaces:
            raise HTTPException(status_code=400, detail="No workspace")
        workspace = workspaces[0]

    return WorkspaceContext(
        user=user,
        workspace_id=workspace["id"],
        workspace_name=workspace.get("name") or "",
        industry=workspace.get("industry") or "tech",
    )
