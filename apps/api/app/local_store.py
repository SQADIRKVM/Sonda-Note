"""Local SQLite + filesystem backend — a drop-in replacement for Supabase.

Why this exists: Supabase requires a hosted project (or Docker) before anything
runs. This module provides the same data model on SQLite and local disk so the
whole product works with zero external services — useful for development, demos,
and offline work.

It mirrors supabase/migrations/0001_init.sql, with the differences SQLite forces:

  · enums          → TEXT + CHECK constraints
  · uuid_generate_v4() → uuid4() in Python
  · RLS policies   → workspace_id filtering in db.py (already there, because the
                     service-role path always filtered explicitly)
  · auth.users     → a local users table with PBKDF2-hashed passwords
  · storage bucket → files under STORAGE_DIR/{workspace}/{meeting}/{seq}.webm

RLS is the one real loss. It was defence-in-depth behind application filtering
that this module keeps, so single-tenant local use is unaffected — but this is a
development backend, not a multi-tenant production one.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import settings

_LOCK = threading.Lock()
_CONN: sqlite3.Connection | None = None

PBKDF2_ROUNDS = 240_000


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────
# CONNECTION
# ─────────────────────────────────────────────────────────

def get_conn() -> sqlite3.Connection:
    global _CONN
    if _CONN is None:
        path = Path(settings.local_db_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        # check_same_thread=False because FastAPI serves requests from a thread
        # pool; every write is serialised through _LOCK below.
        _CONN = sqlite3.connect(str(path), check_same_thread=False)
        _CONN.row_factory = sqlite3.Row
        _CONN.execute("PRAGMA journal_mode=WAL")
        _CONN.execute("PRAGMA foreign_keys=ON")
        _init_schema(_CONN)
    return _CONN


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
          id            TEXT PRIMARY KEY,
          email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          created_at    TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workspaces (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          slug       TEXT NOT NULL UNIQUE,
          industry   TEXT NOT NULL DEFAULT 'tech'
                     CHECK (industry IN ('tech','business','real_estate','legal','other')),
          created_by TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workspace_members (
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role         TEXT NOT NULL DEFAULT 'member'
                       CHECK (role IN ('owner','admin','member')),
          created_at   TEXT NOT NULL,
          PRIMARY KEY (workspace_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS meetings (
          id            TEXT PRIMARY KEY,
          workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          created_by    TEXT NOT NULL REFERENCES users(id),
          title         TEXT NOT NULL DEFAULT 'Untitled meeting',
          platform      TEXT NOT NULL DEFAULT 'google_meet',
          meet_url      TEXT,
          status        TEXT NOT NULL DEFAULT 'uploading'
                        CHECK (status IN ('uploading','queued','processing','ready','failed')),
          error_message TEXT,
          duration_secs INTEGER,
          language      TEXT,
          speaker_count INTEGER,
          started_at    TEXT NOT NULL,
          ended_at      TEXT,
          created_at    TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS meetings_workspace_idx
          ON meetings(workspace_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS meeting_chunks (
          id           TEXT PRIMARY KEY,
          meeting_id   TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL,
          seq          INTEGER NOT NULL,
          storage_path TEXT NOT NULL,
          bytes        INTEGER NOT NULL,
          created_at   TEXT NOT NULL,
          UNIQUE (meeting_id, seq)
        );

        CREATE TABLE IF NOT EXISTS transcript_segments (
          id           TEXT PRIMARY KEY,
          meeting_id   TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL,
          seq          INTEGER NOT NULL,
          speaker      TEXT NOT NULL DEFAULT 'Speaker 1',
          start_secs   REAL NOT NULL,
          end_secs     REAL NOT NULL,
          text         TEXT NOT NULL,
          raw_text     TEXT NOT NULL,
          language     TEXT,
          edited_at    TEXT,
          edited_by    TEXT,
          UNIQUE (meeting_id, seq)
        );
        CREATE INDEX IF NOT EXISTS segments_meeting_idx
          ON transcript_segments(meeting_id, seq);

        CREATE TABLE IF NOT EXISTS meeting_summaries (
          id           TEXT PRIMARY KEY,
          meeting_id   TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL,
          template     TEXT NOT NULL,
          sections     TEXT NOT NULL DEFAULT '{}',
          overview     TEXT,
          model        TEXT NOT NULL,
          created_at   TEXT NOT NULL,
          UNIQUE (meeting_id, template)
        );

        CREATE TABLE IF NOT EXISTS action_items (
          id           TEXT PRIMARY KEY,
          meeting_id   TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL,
          text         TEXT NOT NULL,
          owner        TEXT,
          due_hint     TEXT,
          status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
          source_seq   INTEGER,
          created_at   TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS action_items_ws_idx
          ON action_items(workspace_id, status);

        CREATE TABLE IF NOT EXISTS meeting_insights (
          id           TEXT PRIMARY KEY,
          meeting_id   TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL,
          kind         TEXT NOT NULL CHECK (kind IN ('decision','risk','question','blocker')),
          text         TEXT NOT NULL,
          source_seq   INTEGER,
          created_at   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS vocabulary_terms (
          id           TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          wrong        TEXT NOT NULL,
          right_term   TEXT NOT NULL,
          source       TEXT NOT NULL DEFAULT 'manual',
          hit_count    INTEGER NOT NULL DEFAULT 0,
          created_by   TEXT,
          created_at   TEXT NOT NULL,
          updated_at   TEXT NOT NULL
        );
        -- Mirrors the Postgres unique index on (workspace_id, lower(wrong)).
        CREATE UNIQUE INDEX IF NOT EXISTS vocabulary_unique
          ON vocabulary_terms(workspace_id, wrong COLLATE NOCASE);

        CREATE TABLE IF NOT EXISTS transcript_corrections (
          id           TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          meeting_id   TEXT NOT NULL,
          segment_id   TEXT NOT NULL,
          before_text  TEXT NOT NULL,
          after_text   TEXT NOT NULL,
          created_by   TEXT,
          created_at   TEXT NOT NULL
        );
        """
    )
    conn.commit()


def query(sql: str, params: tuple = ()) -> list[dict]:
    with _LOCK:
        rows = get_conn().execute(sql, params).fetchall()
    return [dict(row) for row in rows]


def query_one(sql: str, params: tuple = ()) -> dict | None:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: tuple = ()) -> None:
    with _LOCK:
        conn = get_conn()
        conn.execute(sql, params)
        conn.commit()


def executemany(sql: str, seq_params: list[tuple]) -> None:
    if not seq_params:
        return
    with _LOCK:
        conn = get_conn()
        conn.executemany(sql, seq_params)
        conn.commit()


# ─────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────

def hash_password(password: str, salt: str | None = None) -> str:
    """PBKDF2-SHA256. Stored as pbkdf2$rounds$salt$hash."""
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), PBKDF2_ROUNDS
    ).hex()
    return f"pbkdf2${PBKDF2_ROUNDS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, rounds, salt, digest = stored.split("$")
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), int(rounds)
    ).hex()
    # Constant-time compare so a timing side-channel can't leak the hash.
    return hmac.compare_digest(candidate, digest)


def create_user(email: str, password: str) -> dict:
    email = email.strip().lower()
    if query_one("SELECT id FROM users WHERE email = ?", (email,)):
        raise ValueError("An account with this email already exists")

    user_id = new_id()
    execute(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?,?,?,?)",
        (user_id, email, hash_password(password), _now()),
    )
    return {"id": user_id, "email": email}


def authenticate(email: str, password: str) -> dict | None:
    row = query_one("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
    if not row or not verify_password(password, row["password_hash"]):
        return None
    return {"id": row["id"], "email": row["email"]}


def get_user(user_id: str) -> dict | None:
    return query_one("SELECT id, email FROM users WHERE id = ?", (user_id,))


# ─────────────────────────────────────────────────────────
# WORKSPACE BOOTSTRAP
# ─────────────────────────────────────────────────────────

GENERIC_DOMAINS = {
    "gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "proton.me", "icloud.com",
}


def create_workspace(name: str, user_id: str, industry: str = "tech") -> dict:
    """Create a workspace and make the caller its owner.

    Mirrors create_workspace_with_owner() from 0002_onboarding.sql.
    """
    import re

    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "workspace"
    slug, n = base, 0
    while query_one("SELECT id FROM workspaces WHERE slug = ?", (slug,)):
        n += 1
        slug = f"{base}-{n}"

    workspace_id = new_id()
    now = _now()
    execute(
        "INSERT INTO workspaces (id,name,slug,industry,created_by,created_at) VALUES (?,?,?,?,?,?)",
        (workspace_id, name, slug, industry, user_id, now),
    )
    execute(
        "INSERT INTO workspace_members (workspace_id,user_id,role,created_at) VALUES (?,?,?,?)",
        (workspace_id, user_id, "owner", now),
    )
    return {
        "id": workspace_id, "name": name, "slug": slug,
        "industry": industry, "created_at": now, "role": "owner",
    }


def ensure_workspace(user_id: str, email: str) -> dict:
    """Return the user's workspace, creating one on first use.

    Named from the email domain when it looks like a company, so a new user can
    record immediately instead of filling in an onboarding form.
    """
    existing = query_one(
        """SELECT w.*, m.role FROM workspaces w
           JOIN workspace_members m ON m.workspace_id = w.id
           WHERE m.user_id = ? ORDER BY w.created_at LIMIT 1""",
        (user_id,),
    )
    if existing:
        return existing

    domain = (email or "").split("@")[-1]
    if domain and domain not in GENERIC_DOMAINS:
        name = domain.split(".")[0].capitalize()
    else:
        name = f"{(email or 'my').split('@')[0]}'s workspace"
    return create_workspace(name, user_id)


def get_user_workspaces(user_id: str) -> list[dict]:
    return query(
        """SELECT w.id, w.name, w.slug, w.industry, w.created_at, m.role
           FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id
           WHERE m.user_id = ? ORDER BY w.created_at""",
        (user_id,),
    )


def is_member(workspace_id: str, user_id: str) -> bool:
    return bool(
        query_one(
            "SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
            (workspace_id, user_id),
        )
    )


# ─────────────────────────────────────────────────────────
# STORAGE (filesystem instead of Supabase Storage)
# ─────────────────────────────────────────────────────────

def storage_root() -> Path:
    root = Path(settings.local_storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def write_chunk(workspace_id: str, meeting_id: str, seq: int, payload: bytes) -> str:
    # Guard against path traversal: ids come from the DB, but this is the only
    # place user-influenced values touch the filesystem.
    for part in (workspace_id, meeting_id):
        if "/" in part or ".." in part:
            raise ValueError("Invalid storage path component")

    directory = storage_root() / workspace_id / meeting_id
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{seq:05d}.webm"
    path.write_bytes(payload)
    return str(path.relative_to(storage_root()))


def read_chunk(relative_path: str) -> bytes:
    return (storage_root() / relative_path).read_bytes()


def delete_meeting_audio(workspace_id: str, meeting_id: str) -> None:
    import shutil

    directory = storage_root() / workspace_id / meeting_id
    if directory.exists():
        shutil.rmtree(directory, ignore_errors=True)


def json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def json_load(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value) if value else {}
    except (json.JSONDecodeError, TypeError):
        return {}
