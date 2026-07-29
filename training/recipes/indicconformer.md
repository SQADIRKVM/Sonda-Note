# IndicConformer 600M — the best open Malayalam model

`ai4bharat/indic-conformer-600m-multilingual` — MIT licence, 22 Indian
languages, **26.0% WER on real conversational Malayalam** ([Voice of India](https://arxiv.org/html/2604.19151v2)).
That is the strongest open-weights option and beats Whisper substantially on
Malayalam.

The catch: it is a **NeMo** model, not a `transformers` one, so `finetune.py`
(built on HF Trainer) does not drive it directly.

## Inference

```bash
pip install nemo_toolkit[asr]
```

```python
import nemo.collections.asr as nemo_asr

model = nemo_asr.models.ASRModel.from_pretrained("ai4bharat/indic-conformer-600m-multilingual")
model.cur_decoder = "rnnt"                     # hybrid CTC+RNNT; RNNT is more accurate
print(model.transcribe(["meeting.wav"], language_id="ml"))
```

Audio must be **16kHz mono** — which the Sonda Note pipeline already produces
(`apps/api/app/audio.py`).

## Fine-tuning

Use NeMo's own recipe rather than this repo's Whisper path:

```bash
python <NeMo>/examples/asr/speech_to_text_finetune.py \
  --config-path=../conf/conformer --config-name=conformer_hybrid_transducer_ctc_bpe \
  model.train_ds.manifest_filepath=data/manifests/train.jsonl \
  model.validation_ds.manifest_filepath=data/manifests/sondanote_eval.jsonl \
  init_from_pretrained_model=ai4bharat/indic-conformer-600m-multilingual \
  trainer.max_epochs=3
```

The manifests this repo writes are already in **NeMo format**
(`audio_filepath` / `text` / `duration`), so no conversion is needed.

## Serving it in Sonda Note

Add a provider to `apps/api/app/asr.py` next to `GroqWhisperProvider`. The
`ASRProvider` protocol is deliberately narrow — implement `transcribe()`
returning `ASRResult` and set `ASR_PROVIDER=indicconformer`. Nothing else in the
pipeline changes.

Note NeMo pulls in a heavy dependency tree; run it as a separate service the API
calls over HTTP rather than importing it into the FastAPI process.
