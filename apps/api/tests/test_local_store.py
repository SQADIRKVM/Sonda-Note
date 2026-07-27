"""Tests for the local SQLite backend.

Focused on the behaviour that replaces something Supabase used to guarantee:
password hashing, workspace bootstrap, and the vocabulary-learning rules that
were previously enforced by a PL/pgSQL function.
"""
from __future__ import annotations

import importlib

import pytest


@pytest.fixture
def store(tmp_path, monkeypatch):
    """A fresh SQLite database per test."""
    from app import config

    monkeypatch.setattr(config.settings, "local_db_path", str(tmp_path / "test.db"))
    monkeypatch.setattr(config.settings, "local_storage_dir", str(tmp_path / "audio"))
    monkeypatch.setattr(config.settings, "backend", "local")

    from app import local_store

    importlib.reload(local_store)
    local_store._CONN = None  # force a new connection at the temp path
    local_store.get_conn()
    return local_store


class TestPasswords:
    def test_roundtrip(self, store):
        stored = store.hash_password("sondanote-local-2026")
        assert store.verify_password("sondanote-local-2026", stored)

    def test_wrong_password_rejected(self, store):
        stored = store.hash_password("correct-horse")
        assert not store.verify_password("wrong-horse", stored)

    def test_hash_is_salted(self, store):
        # Same password, different salt → different hash. Prevents rainbow tables
        # and stops two users with the same password from being obvious.
        assert store.hash_password("same") != store.hash_password("same")

    def test_plaintext_is_never_stored(self, store):
        assert "hunter2000" not in store.hash_password("hunter2000")

    def test_malformed_hash_rejected(self, store):
        assert not store.verify_password("anything", "not-a-valid-hash")


class TestUsers:
    def test_create_and_authenticate(self, store):
        store.create_user("dev@sondanote.com", "password123")
        user = store.authenticate("dev@sondanote.com", "password123")
        assert user and user["email"] == "dev@sondanote.com"

    def test_authenticate_wrong_password(self, store):
        store.create_user("dev@sondanote.com", "password123")
        assert store.authenticate("dev@sondanote.com", "nope") is None

    def test_unknown_email(self, store):
        assert store.authenticate("ghost@sondanote.com", "password123") is None

    def test_duplicate_email_rejected(self, store):
        store.create_user("dev@sondanote.com", "password123")
        with pytest.raises(ValueError, match="already exists"):
            store.create_user("dev@sondanote.com", "different")

    def test_email_is_case_insensitive(self, store):
        store.create_user("Dev@sondanote.com", "password123")
        assert store.authenticate("dev@sondanote.com", "password123") is not None


class TestWorkspaceBootstrap:
    def test_named_from_company_domain(self, store):
        user = store.create_user("sarhan@sondanote.com", "password123")
        workspace = store.ensure_workspace(user["id"], user["email"])
        assert workspace["name"] == "Sondanote"
        assert workspace["slug"] == "sondanote"
        assert workspace["role"] == "owner"

    def test_generic_domain_uses_the_local_part(self, store):
        user = store.create_user("sarhan@gmail.com", "password123")
        workspace = store.ensure_workspace(user["id"], user["email"])
        # A gmail address says nothing about the company.
        assert workspace["name"] == "sarhan's workspace"

    def test_is_idempotent(self, store):
        user = store.create_user("dev@sondanote.com", "password123")
        first = store.ensure_workspace(user["id"], user["email"])
        second = store.ensure_workspace(user["id"], user["email"])
        assert first["id"] == second["id"]

    def test_slugs_are_unique_across_workspaces(self, store):
        a = store.create_user("a@sondanote.com", "password123")
        b = store.create_user("b@sondanote.com", "password123")
        first = store.create_workspace("Sonda Note", a["id"])
        second = store.create_workspace("Sonda Note", b["id"])
        assert first["slug"] == "sonda-note"
        assert second["slug"] == "sonda-note-1"

    def test_membership_isolation(self, store):
        a = store.create_user("a@sondanote.com", "password123")
        b = store.create_user("b@other.com", "password123")
        workspace = store.ensure_workspace(a["id"], a["email"])

        assert store.is_member(workspace["id"], a["id"])
        # Without RLS, this check is the security boundary.
        assert not store.is_member(workspace["id"], b["id"])


class TestStorage:
    def test_chunk_roundtrip(self, store):
        path = store.write_chunk("ws-1", "meet-1", 0, b"webm-bytes")
        assert store.read_chunk(path) == b"webm-bytes"

    def test_path_layout_is_workspace_scoped(self, store):
        path = store.write_chunk("ws-1", "meet-1", 7, b"x")
        assert path.startswith("ws-1/meet-1/")
        assert path.endswith("00007.webm")  # zero-padded so order is lexical

    def test_path_traversal_rejected(self, store):
        with pytest.raises(ValueError, match="Invalid storage path"):
            store.write_chunk("../../etc", "meet-1", 0, b"x")

    def test_delete_removes_audio(self, store):
        store.write_chunk("ws-1", "meet-1", 0, b"x")
        store.delete_meeting_audio("ws-1", "meet-1")
        assert not (store.storage_root() / "ws-1" / "meet-1").exists()


class TestVocabularyLearning:
    """The rules that decide whether a transcript edit becomes a global rule.

    Previously enforced by apply_transcript_correction() in PL/pgSQL; now in
    db._learn_from_correction. Being too eager here corrupts every future
    transcript, so the guards matter more than the feature.
    """

    @pytest.fixture
    def learn(self, store, monkeypatch):
        from app import db

        captured = {}

        def fake_upsert(workspace_id, wrong, right, user_id=None, source="manual"):
            captured["term"] = (wrong, right, source)
            return {}

        monkeypatch.setattr(db, "upsert_vocabulary_term", fake_upsert)

        def run(before: str, after: str):
            captured.clear()
            db._learn_from_correction("ws-1", before, after, "user-1")
            return captured.get("term")

        return run

    def test_single_word_substitution_is_learned(self, learn):
        assert learn("the postgress schema", "the Postgres schema") == (
            "postgress",
            "Postgres",
            "correction",
        )

    def test_punctuation_is_stripped_from_the_term(self, learn):
        # The rule must be "figma → Figma", not "figma, → Figma,".
        assert learn("I like figma, yes", "I like Figma, yes") == (
            "figma",
            "Figma",
            "correction",
        )

    def test_capitalising_a_proper_noun_is_learned(self, learn):
        # The single most common correction a user makes. Worth learning even
        # though only the case changed.
        assert learn("we use figma", "we use Figma") == ("figma", "Figma", "correction")

    def test_all_caps_case_change_is_not_learned(self, learn):
        # The cleaner treats ALL-CAPS as a deliberate spelling-out, so a rule
        # here would fight it on every future transcript.
        assert learn("the API is down", "the api is down") is None

    def test_multi_word_edit_is_not_learned(self, learn):
        # Two changes: too ambiguous to turn into a global rule.
        assert learn("the cat sat", "the dog ran") is None

    def test_merging_two_words_is_not_learned(self, learn):
        # "super base" → "Supabase" changes the word count, so the one-to-one
        # word mapping does not hold. Multi-word terms are added manually.
        assert learn("we use super base here", "we use Supabase here") is None

    def test_length_change_is_not_learned(self, learn):
        assert learn("share the ER diagram", "share the ER-diagram") is None

    def test_reword_is_not_learned(self, learn):
        assert learn("we should ship it", "ship it") is None

    def test_too_short_source_word_is_not_learned(self, learn):
        # A 2-letter word is too generic to remap everywhere.
        assert learn("go to it", "go at it") is None

    def test_punctuation_only_change_is_not_learned(self, learn):
        assert learn("we shipped it", "we shipped it.") is None

    def test_identical_text_is_not_learned(self, learn):
        assert learn("no change here", "no change here") is None
