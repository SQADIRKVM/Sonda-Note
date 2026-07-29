"""Tests for LLM output parsing — pipeline layer 09.

An LLM returns malformed or over-eager output regularly. The parser must degrade
gracefully rather than 500 on a meeting the user already recorded.
"""
from __future__ import annotations

import json

import pytest

from app.llm import LLMError, _extract_json, _parse_summary
from app.templates import get_template

CLIENT = get_template("client_meeting")


class TestJsonExtraction:
    def test_plain_json(self):
        assert _extract_json('{"a": 1}') == {"a": 1}

    def test_markdown_fenced(self):
        assert _extract_json('```json\n{"a": 1}\n```') == {"a": 1}

    def test_bare_fence(self):
        assert _extract_json('```\n{"a": 1}\n```') == {"a": 1}

    def test_prose_around_json(self):
        raw = 'Here is the summary:\n{"a": 1}\nHope that helps!'
        assert _extract_json(raw) == {"a": 1}

    def test_braces_inside_strings_do_not_confuse_the_scanner(self):
        raw = 'text {"a": "a } brace", "b": 2} trailing'
        assert _extract_json(raw) == {"a": "a } brace", "b": 2}

    def test_escaped_quote_inside_string(self):
        raw = r'{"a": "say \"hi\"", "b": 1}'
        assert _extract_json(raw) == {"a": 'say "hi"', "b": 1}

    def test_returns_none_for_garbage(self):
        assert _extract_json("not json at all") is None
        assert _extract_json("") is None

    def test_returns_none_for_top_level_array(self):
        assert _extract_json("[1, 2, 3]") is None


class TestSummaryParsing:
    def _payload(self, **overrides):
        base = {
            "overview": "Client review for the Q3 build.",
            "sections": {
                "requirements": ["Dashboard redesign", "Payment integration"],
                "budget": "3 lakh rupees",
                "timeline": ["6 weeks"],
                "risks": [],
                "next_steps": ["Send revised proposal"],
            },
            "action_items": [
                {"text": "Send the proposal", "owner": "Priya", "due_hint": "Wednesday"}
            ],
            "insights": [{"kind": "decision", "text": "Go with Lovable for the landing page"}],
        }
        base.update(overrides)
        return json.dumps(base)

    def test_happy_path(self):
        result = _parse_summary(self._payload(), CLIENT, "gemini-1.5-flash")

        assert result.overview.startswith("Client review")
        assert result.sections["requirements"] == ["Dashboard redesign", "Payment integration"]
        assert result.sections["budget"] == "3 lakh rupees"
        assert len(result.action_items) == 1
        assert result.action_items[0].owner == "Priya"
        assert result.insights[0].kind == "decision"
        assert result.model == "gemini-1.5-flash"

    def test_missing_sections_are_backfilled(self):
        raw = json.dumps({"overview": "x", "sections": {"budget": "2 lakh"}})
        result = _parse_summary(raw, CLIENT, "m")

        # Every declared section must exist so the dashboard never hits a hole.
        for section in CLIENT.sections:
            assert section.key in result.sections
        assert result.sections["requirements"] == []
        assert result.sections["budget"] == "2 lakh"

    def test_invented_sections_are_dropped(self):
        raw = json.dumps(
            {"overview": "x", "sections": {"requirements": ["a"], "made_up_key": ["b"]}}
        )
        result = _parse_summary(raw, CLIENT, "m")
        assert "made_up_key" not in result.sections

    def test_string_where_list_expected_is_coerced(self):
        raw = json.dumps({"overview": "x", "sections": {"requirements": "just one thing"}})
        result = _parse_summary(raw, CLIENT, "m")
        assert result.sections["requirements"] == ["just one thing"]

    def test_null_like_owner_strings_become_none(self):
        raw = json.dumps(
            {
                "overview": "x",
                "sections": {},
                "action_items": [
                    {"text": "Do a thing", "owner": "null", "due_hint": "N/A"},
                    {"text": "Another", "owner": "Unassigned", "due_hint": None},
                ],
            }
        )
        result = _parse_summary(raw, CLIENT, "m")
        assert result.action_items[0].owner is None
        assert result.action_items[0].due_hint is None
        assert result.action_items[1].owner is None

    def test_action_items_without_text_are_dropped(self):
        raw = json.dumps(
            {
                "overview": "x",
                "sections": {},
                "action_items": [{"text": "", "owner": "A"}, {"owner": "B"}, {"text": "Real one"}],
            }
        )
        result = _parse_summary(raw, CLIENT, "m")
        assert len(result.action_items) == 1
        assert result.action_items[0].text == "Real one"

    def test_invalid_insight_kinds_are_dropped(self):
        raw = json.dumps(
            {
                "overview": "x",
                "sections": {},
                "insights": [
                    {"kind": "decision", "text": "keep"},
                    {"kind": "vibe", "text": "drop"},
                    {"kind": "risk", "text": ""},
                ],
            }
        )
        result = _parse_summary(raw, CLIENT, "m")
        assert len(result.insights) == 1
        assert result.insights[0].text == "keep"

    def test_non_dict_entries_are_skipped(self):
        raw = json.dumps(
            {"overview": "x", "sections": {}, "action_items": ["a string", {"text": "ok"}]}
        )
        result = _parse_summary(raw, CLIENT, "m")
        assert len(result.action_items) == 1

    def test_unparseable_output_raises(self):
        with pytest.raises(LLMError):
            _parse_summary("total garbage", CLIENT, "m")
