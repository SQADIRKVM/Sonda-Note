"""Tests for the transcript cleaner — pipeline layer 07, the product's moat.

These cover the cases that actually break in production: word boundaries against
Malayalam script, multi-word terms overlapping shorter ones, and casing.
"""
from __future__ import annotations

import pytest

from app.cleaner import Term, TranscriptCleaner, build_cleaner, load_industry_dictionary

WORKSPACE_TERMS = [
    Term("at miss", "Sonda Note"),
    Term("super base", "Supabase"),
    Term("figure ma", "Figma"),
    Term("post grass", "Postgres"),
    Term("raise pay", "Razorpay"),
    Term("loveable", "Lovable"),
]


@pytest.fixture
def cleaner() -> TranscriptCleaner:
    return TranscriptCleaner(WORKSPACE_TERMS)


class TestBasicReplacement:
    def test_single_term(self, cleaner):
        assert cleaner.clean("at miss is the company").text == "Sonda Note is the company"

    def test_multiple_terms_in_one_segment(self, cleaner):
        result = cleaner.clean("at miss uses super base and post grass")
        assert result.text == "Sonda Note uses Supabase and Postgres"
        assert result.hits == {"at miss": 1, "super base": 1, "post grass": 1}

    def test_case_insensitive_match(self, cleaner):
        assert cleaner.clean("Super Base is great").text == "Supabase is great"

    def test_all_caps_input_yields_all_caps_output(self, cleaner):
        # A speaker spelling something out shouldn't be silently re-cased.
        assert cleaner.clean("we use SUPER BASE").text == "we use SUPABASE"

    def test_flexible_whitespace_between_words(self, cleaner):
        assert cleaner.clean("figure  ma design").text == "Figma design"

    def test_hit_counts_accumulate(self, cleaner):
        result = cleaner.clean("at miss and at miss again")
        assert result.hits["at miss"] == 2


class TestWordBoundaries:
    """The regex must never fire inside a longer word."""

    def test_no_match_inside_a_word(self, cleaner):
        assert cleaner.clean("postgrass").text == "postgrass"

    def test_no_partial_prefix_match(self):
        c = TranscriptCleaner([Term("base", "Base")])
        assert c.clean("baseline database").text == "baseline database"

    def test_longest_term_wins(self):
        # "post" must not consume the prefix of "post grass".
        c = TranscriptCleaner([Term("post", "POST"), Term("post grass", "Postgres")])
        assert c.clean("post grass vs post").text == "Postgres vs POST"

    def test_matches_adjacent_to_punctuation(self, cleaner):
        assert cleaner.clean("using super base, then figure ma.").text == "using Supabase, then Figma."


class TestCodeMixedText:
    """Malayalam + English in one sentence — the product's core case."""

    def test_manglish_context(self, cleaner):
        result = cleaner.clean("ee feature figure ma il cheytho")
        assert result.text == "ee feature Figma il cheytho"

    def test_native_malayalam_script_adjacent(self, cleaner):
        result = cleaner.clean("അത് super base ആണ്")
        assert result.text == "അത് Supabase ആണ്"

    def test_malayalam_text_untouched_when_no_term_matches(self, cleaner):
        original = "നമുക്ക് നാളെ സംസാരിക്കാം"
        assert cleaner.clean(original).text == original

    def test_no_match_when_term_is_glued_to_malayalam(self, cleaner):
        # Should not replace inside a token; the term is not standalone here.
        assert cleaner.clean("സൂപ്പര്‍base").text == "സൂപ്പര്‍base"


class TestArtifactCleanup:
    def test_removes_fillers(self, cleaner):
        assert cleaner.clean("um so we should ship").text == "so we should ship"

    def test_collapses_stutters(self, cleaner):
        assert cleaner.clean("the the plan is ready").text == "the plan is ready"

    def test_preserves_malayalam_sari(self, cleaner):
        # "sari" means fine/agreed — never treat it as a filler.
        assert "sari" in cleaner.clean("sari we will do that").text

    def test_preserves_ok(self, cleaner):
        assert "ok" in cleaner.clean("ok that works").text

    def test_fixes_space_before_punctuation(self, cleaner):
        assert cleaner.clean("yes , that is right").text == "yes, that is right"

    @pytest.mark.parametrize(
        "text",
        [
            "share the ER diagram",
            "ER diagram and UML",
            "the UML and ER models",
        ],
    )
    def test_uppercase_acronyms_survive_filler_removal(self, cleaner, text):
        # "ER" (entity-relationship) collides with the filler "er", and "UM"
        # sits inside "UML". Both must survive: fillers are lowercase speech
        # artifacts, acronyms are content.
        assert cleaner.clean(text).text == text

    def test_lowercase_fillers_are_still_removed(self, cleaner):
        assert cleaner.clean("er, I think so").text == "I think so"
        assert cleaner.clean("uh the API is down").text == "the API is down"

    def test_capitalised_filler_at_sentence_start_is_removed(self, cleaner):
        assert cleaner.clean("Um, ER diagram").text == "ER diagram"

    def test_empty_input(self, cleaner):
        assert cleaner.clean("").text == ""
        assert cleaner.clean("   ").text.strip() == ""


class TestPrecedence:
    def test_workspace_term_overrides_industry_term(self):
        industry = [Term("super base", "SupabaseDB", source="industry")]
        workspace = [Term("super base", "Supabase")]
        c = TranscriptCleaner(workspace_terms=workspace, industry_terms=industry)
        assert c.clean("super base").text == "Supabase"

    def test_industry_term_applies_when_workspace_has_none(self):
        c = TranscriptCleaner(
            workspace_terms=[],
            industry_terms=[Term("fast api", "FastAPI", source="industry")],
        )
        assert c.clean("we use fast api").text == "we use FastAPI"


class TestSegments:
    def test_clean_segments_preserves_raw_text(self, cleaner):
        segments = [{"text": "at miss rocks", "start": 0.0, "end": 2.0}]
        cleaned, hits = cleaner.clean_segments(segments)

        assert cleaned[0]["text"] == "Sonda Note rocks"
        assert cleaned[0]["raw_text"] == "at miss rocks"
        assert cleaned[0]["start"] == 0.0  # other keys survive
        assert hits == {"at miss": 1}

    def test_totals_across_segments(self, cleaner):
        segments = [{"text": "at miss"}, {"text": "at miss again"}]
        _, hits = cleaner.clean_segments(segments)
        assert hits["at miss"] == 2

    def test_empty_vocabulary_is_a_no_op_apart_from_artifacts(self):
        c = TranscriptCleaner([])
        assert c.clean("nothing to replace here").text == "nothing to replace here"


class TestIndustryDictionaries:
    @pytest.mark.parametrize("industry", ["tech", "business", "real_estate", "legal"])
    def test_dictionaries_load_and_are_non_empty(self, industry):
        terms = load_industry_dictionary(industry)
        assert len(terms) > 0
        assert all(t.wrong and t.right for t in terms)

    def test_unknown_industry_returns_empty(self):
        assert load_industry_dictionary("nonexistent") == ()

    def test_build_cleaner_loads_the_industry_layer(self):
        c = build_cleaner([Term("at miss", "Sonda Note")], industry="business")
        result = c.clean("at miss uses raise pay for payments")
        assert "Sonda Note" in result.text
        assert "Razorpay" in result.text  # from the business dictionary
