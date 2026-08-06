"""ASR metrics for Malayalam and code-mixed Manglish.

Why this file is not just `jiwer.wer(ref, hyp)`
-----------------------------------------------

1. WER is structurally unfair to Malayalam. The language is agglutinative: one
   orthographic word carries what English spreads over four or five. A single
   wrong morpheme fails an entire long word, so WER charges full price for a
   near-miss. Published human evaluation (NAACL 2025 Findings, arXiv 2410.07400,
   which included Malayalam) found CER correlates better with human judgement
   than WER — even for English. So CER is reported alongside WER everywhere here,
   and you should look at it first.

2. Whisper's own text normalizer is broken for Malayalam. It strips matras and
   the virama, which inflates reference word counts and *artificially lowers*
   WER (arXiv 2409.02449 measured 287.4% -> 135.2% purely as a normalisation
   artifact). We therefore never use Whisper's normalizer for Indic text, and we
   report unnormalised numbers as the headline.

3. For a code-mixed product, aggregate WER hides the thing you care about. A
   system can score well overall while failing every English technical term in a
   Malayalam sentence. So we also compute per-script error rates and an
   entity/vocabulary recall metric.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Iterable, Sequence

# Malayalam block. Used to decide whether a token is "native script" or Latin,
# which is what makes the code-mix breakdown possible.
_MALAYALAM = re.compile(r"[ഀ-ൿ]")
_LATIN = re.compile(r"[A-Za-z]")

# Punctuation and the zero-width joiners that Malayalam text is full of. ZWJ/ZWNJ
# are invisible but change codepoint sequences, so two visually identical strings
# can score as different unless they are normalised away.
_ZERO_WIDTH = dict.fromkeys(map(ord, "​‌‍﻿"))
_PUNCT = re.compile(r"[.,!?;:\"'()\[\]{}<>/\\|`~@#$%^&*_+=—–…“”‘’।॥]")


def normalize(text: str, *, drop_punctuation: bool = True) -> str:
    """Minimal, script-safe normalisation.

    Deliberately conservative. We do NOT strip matras, do NOT decompose
    conjuncts, and do NOT apply Whisper's normalizer — all of those corrupt
    Malayalam and make the resulting numbers meaningless.

    NFC composition matters: the same Malayalam grapheme can be encoded as a
    precomposed codepoint or a base + combining mark, and without NFC an exact
    match scores as an error.
    """
    text = unicodedata.normalize("NFC", text)
    text = text.translate(_ZERO_WIDTH)
    if drop_punctuation:
        text = _PUNCT.sub(" ", text)
    # Case folding only affects the Latin half; Malayalam has no case.
    text = text.lower()
    return re.sub(r"\s+", " ", text).strip()


def _edit_distance(ref: Sequence, hyp: Sequence) -> tuple[int, int, int, int]:
    """Levenshtein with operation counts. Returns (distance, sub, ins, del).

    Two-row DP: O(len(ref) * len(hyp)) time, O(len(hyp)) space. Long meeting
    transcripts make the full matrix wasteful, and we only need the counts.
    """
    if not ref:
        return len(hyp), 0, len(hyp), 0
    if not hyp:
        return len(ref), 0, 0, len(ref)

    # Each cell carries (cost, substitutions, insertions, deletions).
    previous: list[tuple[int, int, int, int]] = [(j, 0, j, 0) for j in range(len(hyp) + 1)]

    for i in range(1, len(ref) + 1):
        current = [(i, 0, 0, i)]
        for j in range(1, len(hyp) + 1):
            if ref[i - 1] == hyp[j - 1]:
                current.append(previous[j - 1])
                continue

            sub_c, sub_s, sub_i, sub_d = previous[j - 1]
            ins_c, ins_s, ins_i, ins_d = current[j - 1]
            del_c, del_s, del_i, del_d = previous[j]

            best = min(
                (sub_c + 1, sub_s + 1, sub_i, sub_d),
                (ins_c + 1, ins_s, ins_i + 1, ins_d),
                (del_c + 1, del_s, del_i, del_d + 1),
                key=lambda t: t[0],
            )
            current.append(best)
        previous = current

    return previous[-1]


@dataclass
class ErrorRate:
    errors: int = 0
    total: int = 0
    substitutions: int = 0
    insertions: int = 0
    deletions: int = 0

    @property
    def rate(self) -> float:
        # An empty reference with a non-empty hypothesis is all insertions;
        # returning 0.0 there would hide a real failure, so return 1.0.
        if self.total == 0:
            return 0.0 if self.errors == 0 else 1.0
        return self.errors / self.total

    @property
    def percent(self) -> float:
        return 100.0 * self.rate

    def __iadd__(self, other: "ErrorRate") -> "ErrorRate":
        self.errors += other.errors
        self.total += other.total
        self.substitutions += other.substitutions
        self.insertions += other.insertions
        self.deletions += other.deletions
        return self


def word_errors(reference: str, hypothesis: str) -> ErrorRate:
    ref, hyp = normalize(reference).split(), normalize(hypothesis).split()
    distance, sub, ins, dele = _edit_distance(ref, hyp)
    return ErrorRate(distance, len(ref), sub, ins, dele)


def char_errors(reference: str, hypothesis: str) -> ErrorRate:
    """CER over characters with spaces removed.

    Spaces are dropped because Malayalam word segmentation is inconsistent —
    sandhi means the same utterance is validly written joined or split, and
    counting spaces would penalise a correct transcription for a stylistic choice.
    """
    ref = normalize(reference).replace(" ", "")
    hyp = normalize(hypothesis).replace(" ", "")
    distance, sub, ins, dele = _edit_distance(ref, hyp)
    return ErrorRate(distance, len(ref), sub, ins, dele)


def script_of(token: str) -> str:
    """Classify a token as malayalam / latin / mixed / other.

    'mixed' is the interesting bucket: intra-word code-switching like
    "companyക്ക്" (English root + Malayalam case suffix) is the hardest thing in
    Manglish ASR and the case most systems fail on.
    """
    has_ml = bool(_MALAYALAM.search(token))
    has_la = bool(_LATIN.search(token))
    if has_ml and has_la:
        return "mixed"
    if has_ml:
        return "malayalam"
    if has_la:
        return "latin"
    return "other"


@dataclass
class CodeMixReport:
    """Per-script breakdown, so aggregate WER cannot hide a systematic failure."""

    malayalam: ErrorRate = field(default_factory=ErrorRate)
    latin: ErrorRate = field(default_factory=ErrorRate)
    mixed: ErrorRate = field(default_factory=ErrorRate)

    @property
    def code_mix_ratio(self) -> float:
        """Share of reference tokens that are Latin or intra-word mixed.

        Reported so you can tell whether an eval set is actually code-mixed or
        just Malayalam with a stray English word.
        """
        total = self.malayalam.total + self.latin.total + self.mixed.total
        return 0.0 if total == 0 else (self.latin.total + self.mixed.total) / total


def code_mix_errors(reference: str, hypothesis: str) -> CodeMixReport:
    """Error rate bucketed by the script of each reference word.

    Alignment-free approximation: we compare the multiset of tokens per script
    rather than aligning first. Exact per-token alignment attribution is more
    correct but far more code; this is a diagnostic, and the aggregate WER above
    remains the authoritative number.
    """
    report = CodeMixReport()
    ref_tokens = normalize(reference).split()
    hyp_tokens = normalize(hypothesis).split()

    for bucket in ("malayalam", "latin", "mixed"):
        ref_bucket = [t for t in ref_tokens if script_of(t) == bucket]
        hyp_bucket = [t for t in hyp_tokens if script_of(t) == bucket]
        distance, sub, ins, dele = _edit_distance(ref_bucket, hyp_bucket)
        getattr(report, bucket).__iadd__(
            ErrorRate(distance, len(ref_bucket), sub, ins, dele)
        )

    return report


def entity_recall(reference: str, hypothesis: str, terms: Iterable[str]) -> tuple[int, int]:
    """How many known vocabulary terms present in the reference survived.

    This is the metric that actually tracks product value. A user does not care
    about a 2-point WER move; they care whether "Razorpay" and their client's
    name came out right. Returns (found, expected).
    """
    ref = normalize(reference)
    hyp = normalize(hypothesis)
    found = expected = 0

    for term in terms:
        needle = normalize(term)
        if not needle or needle not in ref:
            continue
        expected += 1
        if needle in hyp:
            found += 1

    return found, expected


@dataclass
class EvalResult:
    wer: ErrorRate = field(default_factory=ErrorRate)
    cer: ErrorRate = field(default_factory=ErrorRate)
    code_mix: CodeMixReport = field(default_factory=CodeMixReport)
    entity_found: int = 0
    entity_expected: int = 0
    utterances: int = 0

    @property
    def entity_recall(self) -> float:
        return 0.0 if self.entity_expected == 0 else self.entity_found / self.entity_expected

    def summary(self) -> str:
        lines = [
            f"utterances      {self.utterances}",
            f"WER             {self.wer.percent:6.2f}%   "
            f"(S {self.wer.substitutions}  I {self.wer.insertions}  D {self.wer.deletions})",
            f"CER             {self.cer.percent:6.2f}%   <- trust this one for Malayalam",
        ]
        if self.code_mix.malayalam.total:
            lines.append(f"  Malayalam WER {self.code_mix.malayalam.percent:6.2f}%")
        if self.code_mix.latin.total:
            lines.append(f"  English WER   {self.code_mix.latin.percent:6.2f}%")
        if self.code_mix.mixed.total:
            lines.append(
                f"  Intra-word    {self.code_mix.mixed.percent:6.2f}%  "
                f"({self.code_mix.mixed.total} tokens)"
            )
        lines.append(f"  code-mix ratio {self.code_mix.code_mix_ratio:.1%}")
        if self.entity_expected:
            lines.append(
                f"entity recall   {self.entity_recall:6.1%}   "
                f"({self.entity_found}/{self.entity_expected} vocabulary terms kept)"
            )
        return "\n".join(lines)


def evaluate(
    pairs: Iterable[tuple[str, str]], vocabulary: Sequence[str] = ()
) -> EvalResult:
    """Score (reference, hypothesis) pairs.

    Errors are pooled across utterances rather than averaging per-utterance
    rates — a 3-word utterance should not weigh the same as a 60-word one.
    """
    result = EvalResult()

    for reference, hypothesis in pairs:
        result.utterances += 1
        result.wer += word_errors(reference, hypothesis)
        result.cer += char_errors(reference, hypothesis)

        mix = code_mix_errors(reference, hypothesis)
        result.code_mix.malayalam += mix.malayalam
        result.code_mix.latin += mix.latin
        result.code_mix.mixed += mix.mixed

        if vocabulary:
            found, expected = entity_recall(reference, hypothesis, vocabulary)
            result.entity_found += found
            result.entity_expected += expected

    return result
