"""Data access — dispatches to SQLite (local) or Supabase (hosted).

Every function takes workspace_id and filters on it explicitly. That was already
required for the Supabase path (the service-role key bypasses RLS), and it is what
makes the local path safe too, since SQLite has no row-level security.

Switch backends with BACKEND=local | supabase in apps/api/.env.
"""
from __future__ import annotations

import logging
from typing import Any

from . import local_store as ls
from . import postgres_store as pg
from .config import settings

logger = logging.getLogger(__name__)

_client = None


class DatabaseError(RuntimeError):
    pass


def _store():
    return pg if settings.is_neon else ls


def _is_relational() -> bool:
    return settings.is_local or settings.is_neon


def get_client():
    """Supabase client. Only valid when BACKEND=supabase."""
    global _client
    if _is_relational():
        raise DatabaseError("get_client() is unavailable in local or neon mode")
    if _client is None:
        if not settings.supabase_configured:
            raise DatabaseError(
                "Supabase is not configured. Set SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY, or use BACKEND=local"
            )
        from supabase import create_client

        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client


# ─────────────────────────────────────────────────────────
# WORKSPACES
# ─────────────────────────────────────────────────────────

def get_user_workspaces(user_id: str) -> list[dict]:
    if _is_relational():
        return _store().get_user_workspaces(user_id)

    result = (
        get_client()
        .table("workspace_members")
        .select("role, workspaces(id, name, slug, industry, created_at)")
        .eq("user_id", user_id)
        .execute()
    )
    workspaces = []
    for row in result.data or []:
        workspace = row.get("workspaces")
        if workspace:
            workspaces.append({**workspace, "role": row["role"]})
    return workspaces


def get_workspace(workspace_id: str) -> dict | None:
    if _is_relational():
        return _store().query_one(
            "SELECT id, name, slug, industry FROM workspaces WHERE id = ?", (workspace_id,)
        )

    result = (
        get_client()
        .table("workspaces")
        .select("id, name, slug, industry")
        .eq("id", workspace_id)
        .limit(1)
        .execute()
    )
    return (result.data or [None])[0]


def is_member(workspace_id: str, user_id: str) -> bool:
    if _is_relational():
        return _store().is_member(workspace_id, user_id)

    result = (
        get_client()
        .table("workspace_members")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


# ─────────────────────────────────────────────────────────
# MEETINGS
# ─────────────────────────────────────────────────────────

def create_meeting(
    workspace_id: str,
    user_id: str,
    title: str,
    meet_url: str | None = None,
    platform: str = "google_meet",
) -> dict:
    if _is_relational():
        meeting_id, now = _store().new_id(), _store()._now()
        _store().execute(
            """INSERT INTO meetings
               (id, workspace_id, created_by, title, meet_url, platform, status, started_at, created_at)
               VALUES (?,?,?,?,?,?,'uploading',?,?)""",
            (meeting_id, workspace_id, user_id, title, meet_url, platform, now, now),
        )
        return get_meeting(meeting_id, workspace_id) or {}

    result = (
        get_client()
        .table("meetings")
        .insert(
            {
                "workspace_id": workspace_id,
                "created_by": user_id,
                "title": title,
                "meet_url": meet_url,
                "platform": platform,
                "status": "uploading",
            }
        )
        .execute()
    )
    if not result.data:
        raise DatabaseError("Failed to create meeting")
    return result.data[0]


def list_meetings(workspace_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
    if _is_relational():
        return _store().query(
            """SELECT * FROM meetings WHERE workspace_id = ?
               ORDER BY created_at DESC LIMIT ? OFFSET ?""",
            (workspace_id, limit, offset),
        )

    result = (
        get_client()
        .table("meetings")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data or []


def list_pending_meetings() -> list[dict]:
    """Fetch queued or interrupted processing meetings across all workspaces for startup job recovery."""
    if _is_relational():
        return _store().query(
            "SELECT id, workspace_id FROM meetings WHERE status IN ('queued', 'processing')"
        )
    try:
        result = (
            get_client()
            .table("meetings")
            .select("id, workspace_id")
            .in_("status", ["queued", "processing"])
            .execute()
        )
        return result.data or []
    except Exception:
        return []


def get_meeting(meeting_id: str, workspace_id: str) -> dict | None:
    if _is_relational():
        return _store().query_one(
            "SELECT * FROM meetings WHERE id = ? AND workspace_id = ?",
            (meeting_id, workspace_id),
        )

    result = (
        get_client()
        .table("meetings")
        .select("*")
        .eq("id", meeting_id)
        .eq("workspace_id", workspace_id)  # workspace scope: do not remove
        .limit(1)
        .execute()
    )
    return (result.data or [None])[0]


# Columns a caller may update. Anything else is rejected rather than
# interpolated, so a field name can never reach the SQL string unchecked.
_MEETING_FIELDS = {
    "title", "status", "error_message", "duration_secs", "language",
    "speaker_count", "ended_at", "meet_url", "platform",
}


def update_meeting(meeting_id: str, workspace_id: str, **fields: Any) -> dict | None:
    if not fields:
        return get_meeting(meeting_id, workspace_id)

    if _is_relational():
        clean: dict[str, Any] = {}
        for key, value in fields.items():
            if key not in _MEETING_FIELDS:
                raise DatabaseError(f"Unknown meeting field: {key}")
            # Postgres accepts the literal "now()"; SQLite needs a real value.
            clean[key] = _store()._now() if value == "now()" else value

        assignments = ", ".join(f"{key} = ?" for key in clean)
        _store().execute(
            f"UPDATE meetings SET {assignments} WHERE id = ? AND workspace_id = ?",
            (*clean.values(), meeting_id, workspace_id),
        )
        return get_meeting(meeting_id, workspace_id)

    result = (
        get_client()
        .table("meetings")
        .update(fields)
        .eq("id", meeting_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    return (result.data or [None])[0]


def set_meeting_status(
    meeting_id: str, workspace_id: str, status: str, error_message: str | None = None
) -> None:
    update_meeting(meeting_id, workspace_id, status=status, error_message=error_message)


def delete_meeting(meeting_id: str, workspace_id: str) -> None:
    if _is_relational():
        _store().delete_meeting_audio(workspace_id, meeting_id)
        _store().execute(
            "DELETE FROM meetings WHERE id = ? AND workspace_id = ?",
            (meeting_id, workspace_id),
        )
        return

    get_client().table("meetings").delete().eq("id", meeting_id).eq(
        "workspace_id", workspace_id
    ).execute()


# ─────────────────────────────────────────────────────────
# CHUNKS + STORAGE
# ─────────────────────────────────────────────────────────

def storage_path(workspace_id: str, meeting_id: str, seq: int) -> str:
    # First path segment is workspace_id — the Supabase storage RLS policy keys
    # off it, and the local backend uses the same layout.
    return f"{workspace_id}/{meeting_id}/{seq:05d}.webm"


def upload_chunk(workspace_id: str, meeting_id: str, seq: int, payload: bytes) -> dict:
    if _is_relational():
        path = _store().write_chunk(workspace_id, meeting_id, seq, payload)
        # Upsert: a reconnecting extension may resend a sequence number.
        _store().execute(
            """INSERT INTO meeting_chunks (id, meeting_id, workspace_id, seq, storage_path, bytes, created_at)
               VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(meeting_id, seq) DO UPDATE SET
                 storage_path = excluded.storage_path, bytes = excluded.bytes""",
            (_store().new_id(), meeting_id, workspace_id, seq, path, len(payload), _store()._now()),
        )
        return {"seq": seq, "bytes": len(payload), "storage_path": path}

    path = storage_path(workspace_id, meeting_id, seq)
    client = get_client()
    client.storage.from_(settings.supabase_audio_bucket).upload(
        path, payload, {"content-type": "audio/webm", "upsert": "true"}
    )
    result = (
        client.table("meeting_chunks")
        .upsert(
            {
                "meeting_id": meeting_id,
                "workspace_id": workspace_id,
                "seq": seq,
                "storage_path": path,
                "bytes": len(payload),
            },
            on_conflict="meeting_id,seq",
        )
        .execute()
    )
    return (result.data or [{}])[0]


def list_chunks(meeting_id: str, workspace_id: str) -> list[dict]:
    if _is_relational():
        return _store().query(
            """SELECT seq, storage_path, bytes FROM meeting_chunks
               WHERE meeting_id = ? AND workspace_id = ? ORDER BY seq""",
            (meeting_id, workspace_id),
        )

    result = (
        get_client()
        .table("meeting_chunks")
        .select("seq, storage_path, bytes")
        .eq("meeting_id", meeting_id)
        .eq("workspace_id", workspace_id)
        .order("seq")
        .execute()
    )
    return result.data or []


def download_chunk(storage_path_value: str) -> bytes:
    if _is_relational():
        return _store().read_chunk(storage_path_value)

    return get_client().storage.from_(settings.supabase_audio_bucket).download(
        storage_path_value
    )


# ─────────────────────────────────────────────────────────
# TRANSCRIPT
# ─────────────────────────────────────────────────────────

def replace_transcript(meeting_id: str, workspace_id: str, segments: list[dict]) -> int:
    """Overwrite a meeting's transcript.

    Delete-then-insert (not upsert) so a re-run with fewer segments leaves no
    orphans from the previous run.
    """
    if _is_relational():
        _store().execute(
            "DELETE FROM transcript_segments WHERE meeting_id = ? AND workspace_id = ?",
            (meeting_id, workspace_id),
        )
        rows = [
            (
                _store().new_id(), meeting_id, workspace_id, index,
                seg.get("speaker") or "Speaker 1",
                float(seg.get("start", 0.0)), float(seg.get("end", 0.0)),
                seg.get("text") or "",
                seg.get("raw_text") or seg.get("text") or "",
                seg.get("language"),
            )
            for index, seg in enumerate(segments)
        ]
        _store().executemany(
            """INSERT INTO transcript_segments
               (id, meeting_id, workspace_id, seq, speaker, start_secs, end_secs, text, raw_text, language)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            rows,
        )
        return len(rows)

    client = get_client()
    client.table("transcript_segments").delete().eq("meeting_id", meeting_id).eq(
        "workspace_id", workspace_id
    ).execute()

    if not segments:
        return 0

    rows = [
        {
            "meeting_id": meeting_id,
            "workspace_id": workspace_id,
            "seq": index,
            "speaker": seg.get("speaker") or "Speaker 1",
            "start_secs": float(seg.get("start", 0.0)),
            "end_secs": float(seg.get("end", 0.0)),
            "text": seg.get("text") or "",
            "raw_text": seg.get("raw_text") or seg.get("text") or "",
            "language": seg.get("language"),
        }
        for index, seg in enumerate(segments)
    ]

    inserted = 0
    for start in range(0, len(rows), 200):
        batch = rows[start : start + 200]
        client.table("transcript_segments").insert(batch).execute()
        inserted += len(batch)
    return inserted


def get_transcript(meeting_id: str, workspace_id: str) -> list[dict]:
    if _is_relational():
        return _store().query(
            """SELECT * FROM transcript_segments
               WHERE meeting_id = ? AND workspace_id = ? ORDER BY seq""",
            (meeting_id, workspace_id),
        )

    result = (
        get_client()
        .table("transcript_segments")
        .select("*")
        .eq("meeting_id", meeting_id)
        .eq("workspace_id", workspace_id)
        .order("seq")
        .execute()
    )
    return result.data or []


def get_segment(segment_id: str) -> dict | None:
    if _is_relational():
        return _store().query_one("SELECT * FROM transcript_segments WHERE id = ?", (segment_id,))

    result = (
        get_client().table("transcript_segments").select("*").eq("id", segment_id).limit(1).execute()
    )
    return (result.data or [None])[0]


def apply_correction(
    segment_id: str, new_text: str, user_id: str, learn_vocabulary: bool = True
) -> dict | None:
    """Record a transcript edit and, when it is a clean single-word substitution,
    promote it into the workspace vocabulary.

    Local mirror of apply_transcript_correction() in 0002_onboarding.sql. Kept in
    Python rather than SQL because SQLite has no PL/pgSQL.
    """
    if not _is_relational():
        result = get_client().rpc(
            "apply_transcript_correction",
            {
                "p_segment_id": segment_id,
                "p_new_text": new_text,
                "p_learn_vocabulary": learn_vocabulary,
            },
        ).execute()
        return result.data

    segment = get_segment(segment_id)
    if not segment:
        return None
    if segment["text"] == new_text:
        return segment

    _store().execute(
        """INSERT INTO transcript_corrections
           (id, workspace_id, meeting_id, segment_id, before_text, after_text, created_by, created_at)
           VALUES (?,?,?,?,?,?,?,?)""",
        (
            _store().new_id(), segment["workspace_id"], segment["meeting_id"], segment_id,
            segment["text"], new_text, user_id, _store()._now(),
        ),
    )

    if learn_vocabulary:
        _learn_from_correction(segment["workspace_id"], segment["text"], new_text, user_id)

    _store().execute(
        "UPDATE transcript_segments SET text = ?, edited_at = ?, edited_by = ? WHERE id = ?",
        (new_text, _store()._now(), user_id, segment_id),
    )
    return get_segment(segment_id)


def _learn_from_correction(workspace_id: str, before: str, after: str, user_id: str) -> None:
    """Promote a one-word substitution into workspace vocabulary.

    Only a clean single-word swap qualifies. Rewording, punctuation-only edits,
    and multi-word changes are recorded in transcript_corrections for Month 5
    auto-suggest but never auto-applied — one bad global rule would corrupt every
    future transcript.
    """
    old_words, new_words = before.split(), after.split()
    if len(old_words) != len(new_words):
        return

    diffs = [i for i, (a, b) in enumerate(zip(old_words, new_words)) if a != b]
    if len(diffs) != 1:
        return

    index = diffs[0]
    wrong = old_words[index].strip(".,!?;:\"'")
    right = new_words[index].strip(".,!?;:\"'")

    if len(wrong) < 3 or len(right) < 2:
        return
    if wrong == right:
        # Only the surrounding punctuation changed.
        return

    # A case-only change IS worth learning: capitalising a proper noun
    # ("figma" → "Figma", "razorpay" → "Razorpay") is one of the most common
    # corrections a user makes, and the cleaner preserves dictionary casing.
    # It is skipped only when the source was ALL-CAPS, since the cleaner already
    # treats all-caps as a deliberate spelling-out and would fight the rule.
    if wrong.lower() == right.lower() and wrong.isupper():
        return

    upsert_vocabulary_term(workspace_id, wrong, right, user_id=user_id, source="correction")


# ─────────────────────────────────────────────────────────
# INTELLIGENCE
# ─────────────────────────────────────────────────────────

def save_summary(
    meeting_id: str, workspace_id: str, template: str, overview: str, sections: dict, model: str
) -> dict:
    if _is_relational():
        _store().execute(
            """INSERT INTO meeting_summaries
               (id, meeting_id, workspace_id, template, overview, sections, model, created_at)
               VALUES (?,?,?,?,?,?,?,?)
               ON CONFLICT(meeting_id, template) DO UPDATE SET
                 overview = excluded.overview, sections = excluded.sections,
                 model = excluded.model, created_at = excluded.created_at""",
            (
                _store().new_id(), meeting_id, workspace_id, template, overview,
                _store().json_dump(sections), model, _store()._now(),
            ),
        )
        return {"template": template, "overview": overview, "sections": sections, "model": model}

    result = (
        get_client()
        .table("meeting_summaries")
        .upsert(
            {
                "meeting_id": meeting_id,
                "workspace_id": workspace_id,
                "template": template,
                "overview": overview,
                "sections": sections,
                "model": model,
            },
            on_conflict="meeting_id,template",
        )
        .execute()
    )
    return (result.data or [{}])[0]


def get_summaries(meeting_id: str, workspace_id: str) -> list[dict]:
    if _is_relational():
        rows = _store().query(
            """SELECT * FROM meeting_summaries
               WHERE meeting_id = ? AND workspace_id = ? ORDER BY created_at DESC""",
            (meeting_id, workspace_id),
        )
        for row in rows:
            row["sections"] = _store().json_load(row.get("sections"))
        return rows

    result = (
        get_client()
        .table("meeting_summaries")
        .select("*")
        .eq("meeting_id", meeting_id)
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def replace_action_items(meeting_id: str, workspace_id: str, items: list[dict]) -> list[dict]:
    if _is_relational():
        # Only clear open items: a user may already have ticked one off, and
        # re-running the summary must not resurrect it.
        _store().execute(
            "DELETE FROM action_items WHERE meeting_id = ? AND workspace_id = ? AND status = 'open'",
            (meeting_id, workspace_id),
        )
        _store().executemany(
            """INSERT INTO action_items
               (id, meeting_id, workspace_id, text, owner, due_hint, status, created_at)
               VALUES (?,?,?,?,?,?,'open',?)""",
            [
                (
                    _store().new_id(), meeting_id, workspace_id, item["text"],
                    item.get("owner"), item.get("due_hint"), _store()._now(),
                )
                for item in items
            ],
        )
        return list_action_items(workspace_id, meeting_id=meeting_id)

    client = get_client()
    client.table("action_items").delete().eq("meeting_id", meeting_id).eq(
        "workspace_id", workspace_id
    ).eq("status", "open").execute()

    if not items:
        return []

    rows = [
        {
            "meeting_id": meeting_id,
            "workspace_id": workspace_id,
            "text": item["text"],
            "owner": item.get("owner"),
            "due_hint": item.get("due_hint"),
        }
        for item in items
    ]
    return client.table("action_items").insert(rows).execute().data or []


def list_action_items(
    workspace_id: str, meeting_id: str | None = None, status: str | None = None
) -> list[dict]:
    if _is_relational():
        sql = """SELECT a.*, m.title AS meeting_title, m.created_at AS meeting_created_at
                 FROM action_items a JOIN meetings m ON m.id = a.meeting_id
                 WHERE a.workspace_id = ?"""
        params: list[Any] = [workspace_id]
        if meeting_id:
            sql += " AND a.meeting_id = ?"
            params.append(meeting_id)
        if status:
            sql += " AND a.status = ?"
            params.append(status)
        sql += " ORDER BY a.created_at DESC"

        rows = _store().query(sql, tuple(params))
        # Shape the join to match Supabase's embedded-resource format so the
        # dashboard renders identically on both backends.
        for row in rows:
            row["meetings"] = {
                "id": row["meeting_id"],
                "title": row.pop("meeting_title", None),
                "created_at": row.pop("meeting_created_at", None),
            }
        return rows

    query = (
        get_client()
        .table("action_items")
        .select("*, meetings(id, title, created_at)")
        .eq("workspace_id", workspace_id)
    )
    if meeting_id:
        query = query.eq("meeting_id", meeting_id)
    if status:
        query = query.eq("status", status)
    return query.order("created_at", desc=True).execute().data or []


def set_action_item_status(item_id: str, workspace_id: str, status: str) -> dict | None:
    if _is_relational():
        _store().execute(
            "UPDATE action_items SET status = ? WHERE id = ? AND workspace_id = ?",
            (status, item_id, workspace_id),
        )
        return _store().query_one(
            "SELECT * FROM action_items WHERE id = ? AND workspace_id = ?",
            (item_id, workspace_id),
        )

    result = (
        get_client()
        .table("action_items")
        .update({"status": status})
        .eq("id", item_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    return (result.data or [None])[0]


def replace_insights(meeting_id: str, workspace_id: str, insights: list[dict]) -> list[dict]:
    if _is_relational():
        _store().execute(
            "DELETE FROM meeting_insights WHERE meeting_id = ? AND workspace_id = ?",
            (meeting_id, workspace_id),
        )
        _store().executemany(
            """INSERT INTO meeting_insights
               (id, meeting_id, workspace_id, kind, text, created_at)
               VALUES (?,?,?,?,?,?)""",
            [
                (_store().new_id(), meeting_id, workspace_id, item["kind"], item["text"], _store()._now())
                for item in insights
            ],
        )
        return list_insights(meeting_id, workspace_id)

    client = get_client()
    client.table("meeting_insights").delete().eq("meeting_id", meeting_id).eq(
        "workspace_id", workspace_id
    ).execute()

    if not insights:
        return []

    rows = [
        {
            "meeting_id": meeting_id,
            "workspace_id": workspace_id,
            "kind": item["kind"],
            "text": item["text"],
        }
        for item in insights
    ]
    return client.table("meeting_insights").insert(rows).execute().data or []


def list_insights(meeting_id: str, workspace_id: str) -> list[dict]:
    if _is_relational():
        return _store().query(
            "SELECT * FROM meeting_insights WHERE meeting_id = ? AND workspace_id = ?",
            (meeting_id, workspace_id),
        )

    result = (
        get_client()
        .table("meeting_insights")
        .select("*")
        .eq("meeting_id", meeting_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    return result.data or []


# ─────────────────────────────────────────────────────────
# VOCABULARY (the moat)
# ─────────────────────────────────────────────────────────

def list_vocabulary(workspace_id: str) -> list[dict]:
    if _is_relational():
        return _store().query(
            "SELECT * FROM vocabulary_terms WHERE workspace_id = ? ORDER BY updated_at DESC",
            (workspace_id,),
        )

    result = (
        get_client()
        .table("vocabulary_terms")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data or []


def upsert_vocabulary_term(
    workspace_id: str,
    wrong: str,
    right_term: str,
    user_id: str | None = None,
    source: str = "manual",
) -> dict:
    wrong, right_term = wrong.strip(), right_term.strip()

    if _is_relational():
        now = _store()._now()
        _store().execute(
            """INSERT INTO vocabulary_terms
               (id, workspace_id, wrong, right_term, source, created_by, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?)
               ON CONFLICT(workspace_id, wrong) DO UPDATE SET
                 right_term = excluded.right_term, updated_at = excluded.updated_at""",
            (_store().new_id(), workspace_id, wrong, right_term, source, user_id, now, now),
        )
        return _store().query_one(
            "SELECT * FROM vocabulary_terms WHERE workspace_id = ? AND wrong = ? COLLATE NOCASE",
            (workspace_id, wrong),
        ) or {}

    result = (
        get_client()
        .table("vocabulary_terms")
        .upsert(
            {
                "workspace_id": workspace_id,
                "wrong": wrong,
                "right_term": right_term,
                "source": source,
                "created_by": user_id,
                "updated_at": "now()",
            },
            on_conflict="workspace_id,wrong",
        )
        .execute()
    )
    return (result.data or [{}])[0]


def delete_vocabulary_term(term_id: str, workspace_id: str) -> None:
    if _is_relational():
        _store().execute(
            "DELETE FROM vocabulary_terms WHERE id = ? AND workspace_id = ?",
            (term_id, workspace_id),
        )
        return

    get_client().table("vocabulary_terms").delete().eq("id", term_id).eq(
        "workspace_id", workspace_id
    ).execute()


def increment_vocabulary_hits(workspace_id: str, hits: dict[str, int]) -> None:
    """Record how often each term fired, so the UI can show which corrections matter."""
    if not hits:
        return

    if _is_relational():
        _store().executemany(
            """UPDATE vocabulary_terms SET hit_count = hit_count + ?
               WHERE workspace_id = ? AND wrong = ? COLLATE NOCASE""",
            [(count, workspace_id, wrong) for wrong, count in hits.items()],
        )
        return

    client = get_client()
    existing = (
        client.table("vocabulary_terms")
        .select("id, wrong, hit_count")
        .eq("workspace_id", workspace_id)
        .execute()
        .data
        or []
    )
    by_wrong = {row["wrong"].lower(): row for row in existing}

    for wrong, count in hits.items():
        row = by_wrong.get(wrong.lower())
        if not row:
            continue  # an industry-dictionary term, which has no workspace row
        client.table("vocabulary_terms").update(
            {"hit_count": (row.get("hit_count") or 0) + count}
        ).eq("id", row["id"]).execute()
