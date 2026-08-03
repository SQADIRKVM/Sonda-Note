"""Batch collation for Whisper seq2seq training."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class DataCollatorSpeechSeq2Seq:
    """Pad audio features and label sequences into a batch.

    Two details that silently corrupt training if missed:

    1. Padded label positions must be -100, not the tokenizer's pad id, or the
       loss is computed against padding and the model learns to emit it.

    2. Whisper's tokenizer prepends a BOS token, and the model adds it again
       internally. Left un-trimmed, every target starts with a doubled BOS and
       generation drifts.
    """

    processor: Any

    def __call__(self, features: list[dict[str, Any]]) -> dict:
        import torch

        audio = [{"input_features": f["input_features"]} for f in features]
        batch = self.processor.feature_extractor.pad(audio, return_tensors="pt")

        labels_batch = self.processor.tokenizer.pad(
            [{"input_ids": f["labels"]} for f in features], return_tensors="pt"
        )
        labels = labels_batch["input_ids"].masked_fill(
            labels_batch.attention_mask.ne(1), -100
        )

        # Trim the duplicated BOS (see 2 above).
        if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
            labels = labels[:, 1:]

        batch["labels"] = labels
        return batch
