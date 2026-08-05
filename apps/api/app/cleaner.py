"""Transcript cleaner — pipeline layer 07, the product's moat.

Three sub-systems, applied in order of increasing specificity so that a
workspace term always wins over a shared industry term:

  1. industry dictionary  (shared, loaded by workspace category)
  2. workspace vocabulary (per-company, learned from user corrections)
  3. filler/artifact cleanup (ASR noise, not a dictionary)

Design notes
------------
Matching is case-insensitive, whitespace-flexible, and boundary-aware, because
ASR output for a multi-word term is unpredictable: "super base", "Super  Base",
and "super base." should all become "Supabase".

Boundaries are NOT Python's ``\\b``. ``\\b`` is defined against ASCII/Unicode
word characters and behaves incorrectly at the seam between Latin and Malayalam
script — in code-mixed text like "ee feature cheytho" a term ending adjacent to
Malayalam characters would either fail to match or match mid-word. We use
explicit lookarounds against a character class of "word-ish" codepoints that
includes the Malayalam block, so a replacement never fires inside a longer word.

Casing of the replacement is preserved from the dictionary (proper nouns like
"Supabase" carry meaningful capitalisation), except when the matched source text
was fully uppercase, which usually means the speaker spelled it out.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

DICTIONARY_DIR = Path(__file__).parent / "dictionaries"

# Codepoints that count as "inside a word" for boundary purposes.
# 0D00–0D7F is the Malayalam block; the others cover Devanagari (Hindi),
# Tamil, and Telugu, which the spec lists as supported languages.
_WORDISH = (
    r"0-9A-Za-z"
    r"ऀ-ॿ"  # Devanagari
    r"஀-௿"  # Tamil
    r"ఀ-౿"  # Telugu
    r"ഀ-ൿ"  # Malayalam
)

# Filler words removed only when they stand alone as a whole word. Deliberately
# conservative: "ok" and "sari" carry real meaning in Malayalam-English meetings
# ("sari" = fine/agreed) and are never stripped.
_FILLERS = ("um", "uh", "umm", "uhh", "hmm", "mmm", "er", "erm")

# Matched case-SENSITIVELY against lowercase and Capitalised forms only, never
# against all-caps. Fillers are speech artifacts that ASR writes in lower case,
# whereas an all-caps token of the same letters is almost always a technical
# acronym: "ER diagram" (entity-relationship) must survive, "er, I think" must not.
# The trailing boundary is required too — without it the "UM" inside "UML" matches.
_FILLER_RE = re.compile(
    rf"(?<![{_WORDISH}])(?:{'|'.join(f'{f}|{f.capitalize()}' for f in _FILLERS)})"
    rf"(?![{_WORDISH}])[,.]?\s*"
)

# ASR repeats a word when a chunk boundary lands mid-utterance: "the the plan".
_STUTTER_RE = re.compile(
    rf"(?<![{_WORDISH}])([{_WORDISH}]+)(\s+\1)+(?![{_WORDISH}])",
    re.IGNORECASE,
)

_MULTISPACE_RE = re.compile(r"[ \t]{2,}")
_SPACE_BEFORE_PUNCT_RE = re.compile(r"\s+([,.;:!?])")


@dataclass
class Term:
    """One correction rule: `wrong` → `right`."""

    wrong: str
    right: str
    source: str = "manual"  # manual | correction | industry


@dataclass
class CleanResult:
    text: str
    # wrong-term → number of times it fired, for vocabulary_terms.hit_count
    hits: dict[str, int] = field(default_factory=dict)


class TranscriptCleaner:
    """Compiled correction ruleset for one workspace.

    Build once per meeting (not per segment) — compiling the regex for a large
    vocabulary is the expensive part.
    """

    def __init__(self, workspace_terms: list[Term], industry_terms: list[Term] | None = None):
        # Industry first so a workspace term with the same `wrong` overrides it.
        merged: dict[str, Term] = {}
        for term in list(industry_terms or []) + list(workspace_terms):
            key = _normalise_key(term.wrong)
            if key:
                merged[key] = term

        self._terms = list(merged.values())
        self._pattern, self._lookup = _compile(self._terms)

    @property
    def term_count(self) -> int:
        return len(self._terms)

    def clean(self, text: str) -> CleanResult:
        """Apply the full cleaning pass to one segment of transcript text."""
        if not text or not text.strip():
            return CleanResult(text=text)

        hits: dict[str, int] = {}
        out = text

        if self._pattern is not None:
            def _sub(match: re.Match[str]) -> str:
                matched = match.group(0)
                term = self._lookup[_normalise_key(matched)]
                hits[term.wrong] = hits.get(term.wrong, 0) + 1
                # A fully-uppercase match means the speaker spelled it out;
                # respect that rather than forcing the dictionary's casing.
                if matched.isupper() and len(matched) > 1:
                    return term.right.upper()
                return term.right

            out = self._pattern.sub(_sub, out)

        out = _strip_artifacts(out)
        return CleanResult(text=out, hits=hits)

    def clean_segments(self, segments: list[dict]) -> tuple[list[dict], dict[str, int]]:
        """Clean a list of `{text: ...}` segments, returning them plus total hits.

        Each segment gains `raw_text` (pre-clean) so corrections stay auditable.
        """
        total: dict[str, int] = {}
        cleaned: list[dict] = []

        for seg in segments:
            result = self.clean(seg.get("text", ""))
            for wrong, count in result.hits.items():
                total[wrong] = total.get(wrong, 0) + count
            new_seg = dict(seg)
            new_seg["raw_text"] = seg.get("text", "")
            new_seg["text"] = result.text
            cleaned.append(new_seg)

        return cleaned, total


def _normalise_key(value: str) -> str:
    """Canonical form for dictionary lookup: lowercase, single-spaced, unpunctuated."""
    return re.sub(r"\s+", " ", value.strip().strip(".,;:!?\"'")).lower()


def _compile(terms: list[Term]) -> tuple[re.Pattern[str] | None, dict[str, Term]]:
    """Build one alternation regex over all terms.

    Longest-first ordering matters: with terms "post" and "post grass", the
    shorter one would otherwise consume the prefix and "post grass" could never
    match.
    """
    if not terms:
        return None, {}

    lookup = {_normalise_key(t.wrong): t for t in terms}
    ordered = sorted(lookup.keys(), key=len, reverse=True)

    alternatives = []
    for key in ordered:
        # Allow any whitespace run between the words of a multi-word term.
        parts = [re.escape(word) for word in key.split(" ")]
        alternatives.append(r"\s+".join(parts))

    pattern = (
        rf"(?<![{_WORDISH}])(?:" + "|".join(alternatives) + rf")(?![{_WORDISH}])"
    )
    return re.compile(pattern, re.IGNORECASE), lookup


def _strip_artifacts(text: str) -> str:
    """Remove ASR noise: fillers, stutters, spacing damage."""
    out = _STUTTER_RE.sub(r"\1", text)
    out = _FILLER_RE.sub("", out)
    out = _MULTISPACE_RE.sub(" ", out)
    out = _SPACE_BEFORE_PUNCT_RE.sub(r"\1", out)
    out = out.strip()

    # Re-capitalise if filler removal ate the leading word.
    if out and out[0].islower() and text[:1].isupper():
        out = out[0].upper() + out[1:]

    return out


@lru_cache
def load_industry_dictionary(industry: str) -> tuple[Term, ...]:
    """Load a shared industry dictionary from disk.

    Cached because these files never change at runtime. Returns a tuple so the
    cached value cannot be mutated by a caller.
    """
    path = DICTIONARY_DIR / f"{industry}.json"
    if not path.exists():
        return ()

    raw = json.loads(path.read_text(encoding="utf-8"))
    return tuple(
        Term(wrong=wrong, right=right, source="industry")
        for wrong, right in raw.items()
    )


def build_cleaner(workspace_terms: list[Term], industry: str = "tech") -> TranscriptCleaner:
    return TranscriptCleaner(
        workspace_terms=workspace_terms,
        industry_terms=list(load_industry_dictionary(industry)),
    )
