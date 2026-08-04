"""Tests for transcript formatting and template prompt construction."""
from __future__ import annotations

import pytest

from app.pipeline import _assign_speakers, _timestamp, format_transcript
from app.templates import TEMPLATES, build_summary_prompt, get_template, template_catalogue


class TestTimestamps:
    def test_under_an_hour(self):
        assert _timestamp(0) == "00:00"
        assert _timestamp(65) == "01:05"
        assert _timestamp(599) == "09:59"

    def test_over_an_hour(self):
        assert _timestamp(3661) == "01:01:01"

    def test_fractional_seconds_truncate(self):
        assert _timestamp(65.9) == "01:05"


class TestFormatTranscript:
    def test_merges_consecutive_turns_by_the_same_speaker(self):
        segments = [
            {"speaker": "Speaker 1", "start_secs": 0.0, "text": "Hello everyone."},
            {"speaker": "Speaker 1", "start_secs": 5.0, "text": "Let us begin."},
            {"speaker": "Speaker 2", "start_secs": 10.0, "text": "Sure."},
        ]
        output = format_transcript(segments)
        lines = output.split("\n")

        # Two speakers → two lines, not three fragments.
        assert len(lines) == 2
        assert lines[0] == "[00:00] Speaker 1: Hello everyone. Let us begin."
        assert lines[1] == "[00:10] Speaker 2: Sure."

    def test_timestamp_is_the_start_of_the_merged_run(self):
        segments = [
            {"speaker": "A", "start_secs": 120.0, "text": "one"},
            {"speaker": "A", "start_secs": 125.0, "text": "two"},
        ]
        assert format_transcript(segments).startswith("[02:00]")

    def test_skips_empty_segments(self):
        segments = [
            {"speaker": "A", "start_secs": 0.0, "text": "real"},
            {"speaker": "A", "start_secs": 1.0, "text": "   "},
        ]
        assert format_transcript(segments) == "[00:00] A: real"

    def test_without_timestamps(self):
        segments = [{"speaker": "A", "start_secs": 0.0, "text": "hi"}]
        assert format_transcript(segments, include_timestamps=False) == "A: hi"

    def test_empty_input(self):
        assert format_transcript([]) == ""

    def test_accepts_raw_asr_key_names(self):
        # Pipeline passes 'start' pre-persistence and 'start_secs' after.
        segments = [{"speaker": "A", "start": 30.0, "text": "hi"}]
        assert format_transcript(segments) == "[00:30] A: hi"


class TestSpeakerAssignment:
    def test_defaults_to_a_single_speaker_before_diarization(self):
        segments = [{"text": "a"}, {"text": "b"}]
        result = _assign_speakers(segments)
        assert all(seg["speaker"] == "Speaker 1" for seg in result)

    def test_does_not_overwrite_an_existing_label(self):
        segments = [{"text": "a", "speaker": "Rahul"}]
        assert _assign_speakers(segments)[0]["speaker"] == "Rahul"


class TestTemplates:
    def test_all_six_templates_exist(self):
        assert set(TEMPLATES) == {
            "general_meeting",
            "client_meeting",
            "sales_call",
            "internal_standup",
            "discovery_call",
            "project_review",
        }

    def test_every_template_declares_sections(self):
        for template in TEMPLATES.values():
            assert len(template.sections) >= 3
            keys = [s.key for s in template.sections]
            assert len(keys) == len(set(keys)), f"{template.id} has duplicate section keys"

    def test_unknown_template_raises(self):
        with pytest.raises(ValueError, match="Unknown template"):
            get_template("does_not_exist")

    def test_catalogue_marks_availability(self):
        catalogue = {t["id"]: t for t in template_catalogue()}
        assert catalogue["general_meeting"]["available"] is True
        assert catalogue["client_meeting"]["available"] is True
        assert catalogue["sales_call"]["available"] is True


class TestPromptConstruction:
    def test_prompt_contains_the_transcript_and_the_shape(self):
        template = get_template("client_meeting")
        system, user = build_summary_prompt(template, "Rahul: we need a dashboard.")

        assert "Rahul: we need a dashboard." in user
        for section in template.sections:
            assert section.key in user

    def test_system_prompt_defends_against_transcript_injection(self):
        system, _ = build_summary_prompt(get_template("client_meeting"), "x")
        assert "NOT INSTRUCTIONS" in system.upper()

    def test_indian_number_formats_are_protected(self):
        system, _ = build_summary_prompt(get_template("client_meeting"), "x")
        assert "lakh" in system

    def test_vocabulary_hint_is_included(self):
        _, user = build_summary_prompt(
            get_template("client_meeting"),
            "transcript",
            vocabulary_hint=["Sonda Note", "Supabase"],
        )
        assert "Sonda Note" in user
        assert "Supabase" in user

    def test_workspace_and_title_context(self):
        _, user = build_summary_prompt(
            get_template("client_meeting"),
            "t",
            meeting_title="Q3 review",
            workspace_name="Sonda Note",
        )
        assert "Q3 review" in user
        assert "Sonda Note" in user
