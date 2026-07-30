"""Malayalam / Manglish speech dataset registry.

Every entry here was checked for existence, size, and licence. Anything not
verified is marked so — an unusable licence discovered after training is a
wasted run, and several widely-cited "Malayalam datasets" turn out to be
unavailable, tiny, or not Malayalam at all.

Traps this registry exists to prevent:

  · "Synth-Manglish" on HuggingFace is MALAY-English, not Malayalam. Most
    "Manglish" search hits are Malaysian. Do not train on it.
  · swaram.live is a commercial closed API, not a corpus. Nothing to download.
  · OpenSLR 63 is ~3 hours, and Common Voice Malayalam has ~2.9 validated hours.
    Both are evaluation-scale, not training-scale.
  · IndicVoices advertises 23.7K hours, but that is raw audio across 22
    languages; transcribed Malayalam is roughly 60 hours.
  · CC-BY-SA is copyleft. Mixing it into a training set can oblige you to share
    alike. Kept separate from the permissive tier on purpose.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Modality(str, Enum):
    SPEECH = "speech"          # audio + transcripts: trainable
    TEXT = "text"              # no audio: vocabulary/LM/normaliser only
    TRANSLITERATION = "translit"


class Licence(str, Enum):
    PERMISSIVE = "permissive"      # CC-BY / CC0 / MIT / Apache — commercial OK
    SHARE_ALIKE = "share_alike"    # CC-BY-SA — copyleft, quarantine it
    UNCLEAR = "unclear"            # treat as unusable until resolved
    PROPRIETARY = "proprietary"


@dataclass(frozen=True)
class Dataset:
    key: str
    name: str
    url: str
    modality: Modality
    licence: Licence
    hours: float | None          # None = not applicable or unverified
    language: str
    notes: str
    code_mixed: bool = False
    verified: bool = True


# ─────────────────────────────────────────────────────────
# TIER 1 — permissively licensed Malayalam speech. Trainable.
# ─────────────────────────────────────────────────────────

TIER1_SPEECH = [
    Dataset(
        key="shrutilipi_ml",
        name="Shrutilipi (Malayalam)",
        url="https://ai4bharat.iitm.ac.in/shrutilipi",
        modality=Modality.SPEECH,
        licence=Licence.PERMISSIVE,  # CC-BY-4.0
        hours=359.0,
        language="ml",
        notes=(
            "Largest permissively-licensed Malayalam speech set. Mined from All "
            "India Radio news broadcasts — read/broadcast register, so it will "
            "not teach conversational or code-mixed speech. Best single source "
            "for teaching the model Malayalam phonetics and script."
        ),
    ),
    Dataset(
        key="indicvoices_ml",
        name="IndicVoices (Malayalam split)",
        url="https://huggingface.co/datasets/ai4bharat/IndicVoices",
        modality=Modality.SPEECH,
        licence=Licence.PERMISSIVE,  # CC-BY-4.0
        hours=60.0,
        language="ml",
        notes=(
            "The 23.7K-hour headline is raw audio across 22 languages; only "
            "~11.2K hours are transcribed and the Malayalam share is ~60h. "
            "IMPORTANT: prompts encouraged code-mixing but it is NOT labelled — "
            "this is the most realistic source to MINE for Manglish utterances."
        ),
    ),
    Dataset(
        key="kathbath_ml",
        name="Kathbath / IndicSUPERB (Malayalam split)",
        url="https://huggingface.co/datasets/ai4bharat/Kathbath",
        modality=Modality.SPEECH,
        licence=Licence.PERMISSIVE,  # CC-BY-4.0 data, MIT code
        hours=None,
        language="ml",
        notes=(
            "1,684h across 12 languages, 1,218 speakers, 203 districts. "
            "Per-language hours are not published. Read speech. Good speaker and "
            "regional-accent diversity, which Shrutilipi lacks."
        ),
    ),
    Dataset(
        key="iiit_indic_tts_ml",
        name="IIIT-H Indic TTS (Malayalam)",
        url="https://festvox.org/databases/iiit_voices/",
        modality=Modality.SPEECH,
        licence=Licence.PERMISSIVE,  # explicitly commercial-OK
        hours=3.0,
        language="ml",
        notes="Studio TTS recordings, 1-2 speakers. Too clean and too few speakers to train on alone.",
    ),
]

# ─────────────────────────────────────────────────────────
# TIER 2 — CODE-MIXED speech. The scarce, decisive resource.
# ─────────────────────────────────────────────────────────

TIER2_CODEMIX = [
    Dataset(
        key="mlenspeech",
        name="MLENSPEECH (Malayalam-English)",
        url="https://github.com/erose311/Malayalam-English-Speech-Dataset",
        modality=Modality.SPEECH,
        licence=Licence.PERMISSIVE,  # CC-BY-4.0, verified in LICENCE.md
        hours=3.33,
        language="ml-en",
        code_mixed=True,
        notes=(
            "The ONLY public Malayalam-English code-switched speech corpus. "
            "3h20m, 2,883 utterances, 5 speakers, 16kHz mono. Contains genuine "
            "INTRA-WORD switching (companyക്ക്, segmentുണ്ട്) — the hardest and "
            "most valuable case. Domain-narrow (finance/accounting lectures). "
            "CAVEAT: YouTube-sourced, so the uploader's CC-BY grant may not "
            "validly cover the underlying material. Use as EVAL, not training."
        ),
    ),
]

# ─────────────────────────────────────────────────────────
# TIER 3 — share-alike. Usable, but copyleft: keep isolated.
# ─────────────────────────────────────────────────────────

TIER3_SHARE_ALIKE = [
    Dataset(
        key="imasc",
        name="IMaSC (ICFOSS)",
        url="https://huggingface.co/datasets/thennal/IMaSC",
        modality=Modality.SPEECH,
        licence=Licence.SHARE_ALIKE,  # CC-BY-SA-4.0
        hours=50.0,
        language="ml",
        notes="50h, 8 speakers, 34,473 pairs. Good size, but CC-BY-SA may oblige share-alike on derivatives.",
    ),
    Dataset(
        key="smc_msc",
        name="SMC Malayalam Speech Corpus",
        url="https://blog.smc.org.in/malayalam-speech-corpus/",
        modality=Modality.SPEECH,
        licence=Licence.SHARE_ALIKE,
        hours=1.64,
        language="ml",
        notes="1h38m, 75 contributors. Community project, corpus repo static since Jan 2023.",
    ),
    Dataset(
        key="openslr63",
        name="OpenSLR 63 (Malayalam)",
        url="https://www.openslr.org/63/",
        modality=Modality.SPEECH,
        licence=Licence.SHARE_ALIKE,
        hours=3.02,
        language="ml",
        notes="~3 hours, 24 speakers. Commonly cited as a starting corpus; far too small for that. Eval only.",
    ),
    Dataset(
        key="common_voice_ml",
        name="Mozilla Common Voice (Malayalam)",
        url="https://commonvoice.mozilla.org/ml",
        modality=Modality.SPEECH,
        licence=Licence.PERMISSIVE,  # CC0
        hours=2.9,
        language="ml",
        notes=(
            "Only ~2.9 VALIDATED hours (12h recorded). Effectively dormant for "
            "Malayalam — compare Tamil at 235h validated. Eval only."
        ),
    ),
]

# ─────────────────────────────────────────────────────────
# TIER 4 — meeting-domain speech. English, but teaches conversation.
# ─────────────────────────────────────────────────────────

TIER4_MEETING = [
    Dataset(
        key="ami",
        name="AMI Meeting Corpus",
        url="https://groups.inf.ed.ac.uk/ami/corpus/",
        modality=Modality.SPEECH,
        licence=Licence.PERMISSIVE,  # CC-BY-4.0
        hours=100.0,
        language="en",
        notes=(
            "~100h of real meetings with speaker turns and overlap. English only "
            "(largely non-native speakers). Teaches meeting dynamics — "
            "interruptions, turn-taking — not Malayalam. Also the standard "
            "corpus for training/evaluating DIARIZATION."
        ),
    ),
    Dataset(
        key="icsi",
        name="ICSI Meeting Corpus",
        url="https://groups.inf.ed.ac.uk/ami/icsi/",
        modality=Modality.SPEECH,
        licence=Licence.PERMISSIVE,  # CC-BY-4.0 via Edinburgh
        hours=72.0,
        language="en",
        notes=(
            "~72h, heavy overlapping speech. FREE from Edinburgh's mirror — do "
            "not pay LDC's catalogue fee (LDC2004S02) for the same data."
        ),
    ),
]

# ─────────────────────────────────────────────────────────
# TIER 5 — text only. Vocabulary, LM, and the Manglish normaliser.
# ─────────────────────────────────────────────────────────

TIER5_TEXT = [
    Dataset(
        key="dravidian_codemix",
        name="DravidianCodeMix (Malayalam-English)",
        url="https://zenodo.org/records/4750858",
        modality=Modality.TEXT,
        licence=Licence.PERMISSIVE,
        hours=None,
        language="ml-en",
        code_mixed=True,
        notes=(
            "~20K Malayalam-English YouTube comments. TEXT ONLY — cannot train "
            "ASR. Valuable for mining code-mix vocabulary and for training a "
            "post-ASR corrector. Native script + Latin English."
        ),
    ),
    Dataset(
        key="aksharantar_ml",
        name="Aksharantar (Malayalam)",
        url="https://huggingface.co/datasets/ai4bharat/Aksharantar",
        modality=Modality.TRANSLITERATION,
        licence=Licence.PERMISSIVE,
        hours=None,
        language="ml",
        notes=(
            "~4.1M romanization pairs. Powers Manglish -> native script. "
            "CAVEAT: trained on standard typing; real Manglish omits vowels "
            "ad-hoc. Published CER 7.4% on standard input vs 22.7% on ad-hoc — "
            "so it will NOT transfer cleanly to how people actually type."
        ),
    ),
    Dataset(
        key="dakshina_ml",
        name="Dakshina (Malayalam)",
        url="https://github.com/google-research-datasets/dakshina",
        modality=Modality.TRANSLITERATION,
        licence=Licence.SHARE_ALIKE,
        hours=None,
        language="ml",
        notes=(
            "Contains ATTESTED romanizations from real users, which is "
            "qualitatively closer to true Manglish than Aksharantar's generated "
            "pairs. Smaller, but more honest. CC-BY-SA."
        ),
    ),
]

# ─────────────────────────────────────────────────────────
# DO NOT USE — verified traps.
# ─────────────────────────────────────────────────────────

REJECTED = [
    Dataset(
        key="synth_manglish",
        name="Synth-Manglish (emhaihsan)",
        url="https://huggingface.co/datasets/emhaihsan/Synth-Manglish",
        modality=Modality.TEXT,
        licence=Licence.UNCLEAR,
        hours=None,
        language="ms-en",
        notes="WRONG LANGUAGE. This is MALAY-English (Malaysia), not Malayalam. Do not use.",
    ),
    Dataset(
        key="swaram_live",
        name="swaram.live",
        url="https://swaram.live/",
        modality=Modality.SPEECH,
        licence=Licence.PROPRIETARY,
        hours=None,
        language="ml",
        notes=(
            "NOT A DATASET. Commercial closed-source realtime Malayalam voice "
            "API (Pattern AI Labs / Nexbillion Labs, Kochi). No downloads, no "
            "weights, ~Rs 0.99/min. Nothing to train on."
        ),
    ),
    Dataset(
        key="manghat_corpus",
        name="Manghat et al. code-switched corpus",
        url="https://www.isca-archive.org/interspeech_2020/manghat20_interspeech.pdf",
        modality=Modality.SPEECH,
        licence=Licence.UNCLEAR,
        hours=20.0,
        language="ml-en",
        code_mixed=True,
        verified=False,
        notes=(
            "20h Malayalam-English, 42 speakers — would be the best code-mix "
            "resource available, but NEVER PUBLICLY RELEASED. No repo, no "
            "catalogue entry. Its quoted 3.2%/2.1% figures are G2P phoneme "
            "error rates, NOT ASR WER — do not cite them as benchmarks."
        ),
    ),
    Dataset(
        key="spring_inx_ml",
        name="SPRING-INX (Malayalam)",
        url="https://asr.iitm.ac.in/dataset",
        modality=Modality.SPEECH,
        licence=Licence.UNCLEAR,
        hours=245.0,
        language="ml",
        verified=False,
        notes=(
            "245h — would be second-largest — but the paper says 'public domain' "
            "while the HF datasets declare NO licence. Resolve with IIT Madras "
            "before using commercially. Blocked until then."
        ),
    ),
]

ALL = TIER1_SPEECH + TIER2_CODEMIX + TIER3_SHARE_ALIKE + TIER4_MEETING + TIER5_TEXT


def trainable(include_share_alike: bool = False) -> list[Dataset]:
    """Speech datasets usable for fine-tuning.

    Share-alike is excluded by default: for a commercial product, mixing
    copyleft data into training is a licensing decision that should be explicit
    rather than a default.
    """
    allowed = {Licence.PERMISSIVE}
    if include_share_alike:
        allowed.add(Licence.SHARE_ALIKE)
    return [
        d for d in ALL
        if d.modality is Modality.SPEECH and d.licence in allowed and d.verified
    ]


def total_hours(datasets: list[Dataset]) -> float:
    return sum(d.hours or 0.0 for d in datasets)


def report() -> str:
    lines = ["Malayalam / Manglish speech data — verified registry", "=" * 68]

    for title, group in [
        ("TIER 1 · permissive Malayalam speech (trainable)", TIER1_SPEECH),
        ("TIER 2 · CODE-MIXED speech (scarce)", TIER2_CODEMIX),
        ("TIER 3 · share-alike / tiny (eval)", TIER3_SHARE_ALIKE),
        ("TIER 4 · meeting domain (English)", TIER4_MEETING),
        ("TIER 5 · text only (vocab / normaliser)", TIER5_TEXT),
    ]:
        lines.append(f"\n{title}")
        for d in group:
            hours = f"{d.hours:>7.1f}h" if d.hours else "      ?"
            flag = "" if d.verified else "  [UNVERIFIED]"
            lines.append(f"  {hours}  {d.licence.value:12} {d.name}{flag}")

    lines.append("\nDO NOT USE")
    for d in REJECTED:
        lines.append(f"  {'':8}  {d.name}")

    ml_speech = [d for d in TIER1_SPEECH if d.hours]
    lines.append("\n" + "=" * 68)
    lines.append(f"Permissive Malayalam speech : {total_hours(ml_speech):.0f} h")
    lines.append(f"Public code-mixed speech    : {total_hours(TIER2_CODEMIX):.1f} h  <- the bottleneck")
    return "\n".join(lines)


if __name__ == "__main__":
    print(report())
