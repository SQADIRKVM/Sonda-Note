#!/usr/bin/env python
"""Seed a demo account with realistic Kerala-agency meeting data.

Creates one workspace with four meetings that exercise every part of the product:
transcripts in code-mixed Malayalam/English, workspace vocabulary with real hit
counts, summaries from three different templates, action items across several
owners, and one failed meeting so the error path is visible too.

Local backend only — it writes directly to SQLite rather than going through the
API, so it needs no running server.

    .venv/bin/python seed_demo.py           # create (skips if the account exists)
    .venv/bin/python seed_demo.py --reset   # wipe the demo workspace and rebuild
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timedelta, timezone

from app import db, local_store as ls
from app.cleaner import Term, build_cleaner
from app.config import settings

DEMO_EMAIL = "demo@sondanote.com"
DEMO_PASSWORD = "sonda-demo-2026"
DEMO_WORKSPACE = "Sonda Note"

# ─────────────────────────────────────────────────────────
# WORKSPACE VOCABULARY — the moat
# ─────────────────────────────────────────────────────────

VOCABULARY: list[tuple[str, str, str]] = [
    # (wrong, right, source)
    ("sounder", "Sonda", "manual"),
    ("super base", "Supabase", "manual"),
    ("figure ma", "Figma", "manual"),
    ("post grass", "Postgres", "manual"),
    ("raise pay", "Razorpay", "manual"),
    ("loveable", "Lovable", "manual"),
    # Learned from users editing transcripts — the compounding half of the moat.
    ("nex jay es", "Next.js", "correction"),
    ("tail wind", "Tailwind", "correction"),
    ("kozhikkod", "Kozhikode", "correction"),
    ("thrisur", "Thrissur", "correction"),
]

# ─────────────────────────────────────────────────────────
# MEETINGS
# ─────────────────────────────────────────────────────────
# Transcripts are written as ASR would mis-hear them. The cleaner runs over them
# during seeding, so raw_text and text differ exactly as they would in production
# and the "cleaned" badge appears in the dashboard.

MEETINGS: list[dict] = [
    {
        "title": "Client review · Kochi Realty dashboard",
        "days_ago": 1,
        "template": "client_meeting",
        "status": "ready",
        "language": "ml",
        "speakers": 3,
        "segments": [
            ("Speaker 1", 0.0, 7.2, "Okay so um let's start the the client review for this week."),
            ("Speaker 1", 7.2, 15.8, "At miss team, we finished the super base migration yesterday."),
            ("Speaker 2", 15.8, 24.5, "Ee dashboard design figure ma il ready aanu, njan share cheyyam."),
            ("Speaker 2", 24.5, 33.0, "Client budget is around 3 lakh rupees for phase one, timeline is 6 weeks."),
            ("Speaker 3", 33.0, 41.6, "Risk is the raise pay integration, their sandbox was down last week."),
            ("Speaker 1", 41.6, 50.2, "Rahul will finish the post grass schema by Friday and share the ER diagram."),
            ("Speaker 2", 50.2, 58.4, "Decision: we go with loveable for the landing page instead of custom build."),
            ("Speaker 1", 58.4, 66.0, "Priya, can you send the revised proposal to the client by Wednesday?"),
            ("Speaker 3", 66.0, 72.5, "Sari, I will do that. Next steps are clear from my side."),
        ],
        "summary": {
            "overview": "Weekly client review for the Kochi Realty dashboard. The Supabase migration is complete and designs are ready in Figma. Budget is confirmed at 3 lakh for phase one over 6 weeks, with the Razorpay integration flagged as the main risk.",
            "sections": {
                "requirements": [
                    "Dashboard redesign delivered in Figma",
                    "Supabase migration for the existing property database",
                    "Razorpay payment integration for booking deposits",
                ],
                "budget": "3 lakh rupees for phase one",
                "timeline": ["6 weeks for phase one", "Postgres schema due Friday", "Revised proposal to client by Wednesday"],
                "risks": [
                    "Razorpay sandbox was down last week — integration testing may slip",
                    "Client has not yet confirmed content for the landing page",
                ],
                "next_steps": [
                    "Rahul to finish the Postgres schema and share the ER diagram",
                    "Priya to send the revised proposal to the client",
                    "Share Figma designs with the client for sign-off",
                ],
            },
            "tasks": [
                ("Finish the Postgres schema and share the ER diagram", "Rahul", "Friday"),
                ("Send the revised proposal to the client", "Priya", "Wednesday"),
                ("Share the Figma dashboard designs with the client", "Anjali", None),
            ],
            "insights": [
                ("decision", "Use Lovable for the landing page instead of a custom build"),
                ("risk", "Razorpay sandbox instability could delay payment integration testing"),
                ("blocker", "Client content for the landing page is still pending"),
            ],
        },
    },
    {
        "title": "Daily standup · Product team",
        "days_ago": 2,
        "template": "internal_standup",
        "status": "ready",
        "language": "ml",
        "speakers": 4,
        "segments": [
            ("Speaker 1", 0.0, 5.5, "Standup start cheyyam. Rahul, ninte update parayu."),
            ("Speaker 2", 5.5, 14.0, "Njan yesterday the post grass migration complete cheythu, today API endpoints."),
            ("Speaker 2", 14.0, 21.3, "Blocker onnum illa, but I need the figure ma designs for the settings page."),
            ("Speaker 3", 21.3, 30.1, "Design side, njan the settings page finish cheythu, sharing in figure ma today."),
            ("Speaker 3", 30.1, 38.4, "Um I am blocked on the copy for the empty states, waiting for content."),
            ("Speaker 4", 38.4, 47.0, "I finished the tail wind setup and the nex jay es routing refactor."),
            ("Speaker 4", 47.0, 55.2, "Today njan the auth flow work cheyyum, ee week thanne complete aakum."),
            ("Speaker 1", 55.2, 62.0, "Good. Anjali, please send the empty state copy to Divya by end of day."),
        ],
        "summary": {
            "overview": "Daily standup. Postgres migration and Tailwind/Next.js refactor are complete. Two people are blocked: Rahul needs Figma designs for settings, Divya needs empty-state copy.",
            "sections": {
                "done": [
                    "Rahul — completed the Postgres migration",
                    "Divya — finished the settings page design",
                    "Arun — completed Tailwind setup and Next.js routing refactor",
                ],
                "in_progress": [
                    "Rahul — building API endpoints",
                    "Arun — auth flow, targeted for this week",
                ],
                "blockers": [
                    "Divya is blocked on empty-state copy, waiting on content",
                    "Rahul needs Figma designs for the settings page",
                ],
                "help_needed": ["Anjali to supply empty-state copy to Divya"],
            },
            "tasks": [
                ("Send the empty state copy to Divya", "Anjali", "end of day"),
                ("Share the settings page Figma designs with Rahul", "Divya", None),
                ("Complete the auth flow", "Arun", "this week"),
            ],
            "insights": [
                ("blocker", "Empty-state copy is blocking the settings page design handoff"),
                ("question", "Is the auth flow using Supabase Auth or a custom implementation?"),
            ],
        },
    },
    {
        "title": "Discovery call · Thrissur textile client",
        "days_ago": 5,
        "template": "discovery_call",
        "status": "ready",
        "language": "ml",
        "speakers": 2,
        "segments": [
            ("Speaker 1", 0.0, 8.4, "Thank you for the time. Njangalude current process onnu parayamo?"),
            ("Speaker 2", 8.4, 18.2, "We have three showrooms in thrisur and one in kozhikkod, all inventory is manual."),
            ("Speaker 2", 18.2, 27.6, "Excel sheets il aanu everything, and stock mismatch is a big problem for us."),
            ("Speaker 1", 27.6, 35.0, "Understood. Ee problem kondu monthly ethra loss undakunnu?"),
            ("Speaker 2", 35.0, 44.8, "Maybe 2 lakh per month, mostly from dead stock we did not know we had."),
            ("Speaker 2", 44.8, 54.2, "Budget njangal 5 lakh vare consider cheyyam, but I need to discuss with my brother."),
            ("Speaker 2", 54.2, 62.0, "He handles the finance side, decision njangal randu perum koodi edukkum."),
            ("Speaker 1", 62.0, 70.5, "Sari. Njan a proposal ayakkam next week, with a phased approach."),
        ],
        "summary": {
            "overview": "Discovery call with a Thrissur textile retailer running four showrooms on manual Excel inventory. Stock mismatch costs roughly 2 lakh per month. Budget signal up to 5 lakh; decision is shared with the owner's brother who handles finance.",
            "sections": {
                "goals": [
                    "Replace manual Excel inventory across four showrooms",
                    "Eliminate stock mismatch between locations",
                    "Get visibility into dead stock",
                ],
                "current_setup": [
                    "Three showrooms in Thrissur, one in Kozhikode",
                    "Inventory tracked manually in Excel sheets",
                    "No central system across locations",
                ],
                "constraints": [
                    "Decision requires sign-off from the owner's brother",
                    "Staff are not technical — needs a simple interface",
                ],
                "budget_signals": "Up to 5 lakh rupees, pending discussion with the finance partner",
                "decision_makers": [
                    "Owner — primary contact, operations",
                    "Owner's brother — finance, joint decision maker",
                ],
                "next_steps": ["Send a phased proposal next week"],
            },
            "tasks": [
                ("Send a phased proposal to the Thrissur textile client", "Sarhan", "next week"),
                ("Prepare a simple inventory demo for non-technical staff", "Divya", None),
            ],
            "insights": [
                ("risk", "Decision requires a second stakeholder who was not on the call"),
                ("question", "How many SKUs are held across the four showrooms?"),
                ("decision", "Proposal will use a phased approach rather than a single delivery"),
            ],
        },
    },
    {
        "title": "Sales call · Kozhikode logistics (recording failed)",
        "days_ago": 7,
        "template": None,
        "status": "failed",
        "language": None,
        "speakers": None,
        "segments": [],
        "error": "No speech detected in this recording — check that the Meet tab had sound and the correct tab was captured.",
    },
]


def reset_demo() -> None:
    """Remove the demo account and everything it owns."""
    user = ls.query_one("SELECT id FROM users WHERE email = ?", (DEMO_EMAIL,))
    if not user:
        print("  no existing demo account")
        return

    for workspace in ls.query(
        "SELECT id FROM workspaces WHERE created_by = ?", (user["id"],)
    ):
        for meeting in ls.query(
            "SELECT id FROM meetings WHERE workspace_id = ?", (workspace["id"],)
        ):
            ls.delete_meeting_audio(workspace["id"], meeting["id"])
        # Meetings, members, and vocabulary cascade from the workspace.
        ls.execute("DELETE FROM workspaces WHERE id = ?", (workspace["id"],))

    ls.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    print("  removed the previous demo account")


async def seed() -> None:
    if not settings.is_local:
        sys.exit("seed_demo.py only supports BACKEND=local")

    ls.get_conn()

    existing = ls.query_one("SELECT id FROM users WHERE email = ?", (DEMO_EMAIL,))
    if existing:
        print(f"  {DEMO_EMAIL} already exists — pass --reset to rebuild it")
        return

    user = ls.create_user(DEMO_EMAIL, DEMO_PASSWORD)
    workspace = ls.create_workspace(DEMO_WORKSPACE, user["id"], industry="tech")
    workspace_id = workspace["id"]
    print(f"  account   : {DEMO_EMAIL}")
    print(f"  workspace : {workspace['name']} ({workspace['slug']})")

    # ── vocabulary ──
    for wrong, right, source in VOCABULARY:
        db.upsert_vocabulary_term(
            workspace_id, wrong, right, user_id=user["id"], source=source
        )
    print(f"  vocabulary: {len(VOCABULARY)} terms")

    cleaner = build_cleaner(
        [Term(wrong=w, right=r, source=s) for w, r, s in VOCABULARY], industry="tech"
    )

    # ── meetings ──
    for spec in MEETINGS:
        created = datetime.now(timezone.utc) - timedelta(days=spec["days_ago"])
        meeting_id = ls.new_id()
        duration = int(spec["segments"][-1][2]) if spec["segments"] else None

        ls.execute(
            """INSERT INTO meetings
               (id, workspace_id, created_by, title, platform, meet_url, status,
                error_message, duration_secs, language, speaker_count, started_at, ended_at, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                meeting_id, workspace_id, user["id"], spec["title"], "google_meet",
                "https://meet.google.com/demo-sondanote-001", spec["status"],
                spec.get("error"), duration, spec["language"], spec["speakers"],
                created.isoformat(),
                (created + timedelta(seconds=duration or 0)).isoformat() if duration else None,
                created.isoformat(),
            ),
        )

        if not spec["segments"]:
            print(f"  meeting   : {spec['title'][:44]:46} {spec['status']}")
            continue

        # Run the real cleaner so raw_text and text differ exactly as in production.
        raw_segments = [
            {"speaker": sp, "start": start, "end": end, "text": text}
            for sp, start, end, text in spec["segments"]
        ]
        cleaned, hits = cleaner.clean_segments(raw_segments)
        for segment in cleaned:
            segment["language"] = spec["language"]

        db.replace_transcript(meeting_id, workspace_id, cleaned)
        db.increment_vocabulary_hits(workspace_id, hits)

        summary = spec["summary"]
        db.save_summary(
            meeting_id, workspace_id, spec["template"],
            summary["overview"], summary["sections"], "gemini-1.5-flash",
        )
        db.replace_action_items(
            meeting_id, workspace_id,
            [{"text": t, "owner": o, "due_hint": d} for t, o, d in summary["tasks"]],
        )
        db.replace_insights(
            meeting_id, workspace_id,
            [{"kind": k, "text": t} for k, t in summary["insights"]],
        )

        print(
            f"  meeting   : {spec['title'][:44]:46} {len(cleaned)} segs · "
            f"{sum(hits.values())} corrections"
        )

    # Mark a couple of older tasks done so the Tasks board is not uniformly open.
    for row in ls.query(
        """SELECT a.id FROM action_items a JOIN meetings m ON m.id = a.meeting_id
           WHERE a.workspace_id = ? AND m.title LIKE 'Discovery%' LIMIT 1""",
        (workspace_id,),
    ):
        ls.execute("UPDATE action_items SET status = 'done' WHERE id = ?", (row["id"],))

    print()
    print("  ┌──────────────────────────────────────────────┐")
    print("  │  DEMO LOGIN                                  │")
    print("  ├──────────────────────────────────────────────┤")
    print(f"  │  email     {DEMO_EMAIL:33} │")
    print(f"  │  password  {DEMO_PASSWORD:33} │")
    print("  └──────────────────────────────────────────────┘")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the Sonda Note demo account")
    parser.add_argument("--reset", action="store_true", help="wipe the demo account first")
    args = parser.parse_args()

    print("Sonda Note · demo seed")
    ls.get_conn()
    if args.reset:
        reset_demo()
    asyncio.run(seed())
