# Model-selection research

Research date: 2026-10-12. Scope: external, primary-source review only; no
weights, packages, or product changes were made.

## Decision summary

For TwinSleuth's deterministic learning loop, keep ML advisory and isolated
from truth, scoring, probe outcomes, evidence validity, and reveal logic.
Start with a compact, local embedding encoder plus an independently evaluated
linear classifier only if measured value exceeds the existing deterministic
baseline. Do not make Laya a required runtime or authority.

The recommended experiment order is:

1. Offline benchmark: `sentence-transformers/all-MiniLM-L6-v2` embeddings
   (22.7M parameters, 384 dimensions; Apache-2.0) plus a linear head trained
   only on approved labelled examples. Its card says inputs above 256 word
   pieces truncate, so test that boundary. [Model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
2. If memory/latency requires it, compare
   `sentence-transformers/paraphrase-MiniLM-L3-v2` (17.4M parameters,
   384 dimensions; Apache-2.0; card architecture max sequence length 128).
   [Model card](https://huggingface.co/sentence-transformers/paraphrase-MiniLM-L3-v2)
3. Consider SetFit only as a separately evaluated few-shot training route. It
   tunes sentence-transformer embeddings then trains a classification head;
   it is not a zero-shot truth source. [SetFit quickstart](https://huggingface.co/docs/setfit/quickstart)
4. Reject Laya for the default demo/runtime. It is a materially larger,
   third-party decision stack (publisher card: English 421M, about 808 MB;
   multilingual 322M, about 647 MB) and its own card says base checkpoints
   are near chance on its typed-decisions zero-shot benchmark. It can only be
   reconsidered as an optional, pinned, offline experiment after its exact
   task fit and security posture are demonstrated. [Laya model card](https://huggingface.co/convaiinnovations/laya)

## Laya identity, licence, and status

- Identity: the canonical publisher checkpoint reviewed is
  `convaiinnovations/laya` (not similarly named third-party repositories). It
  is labelled Text Classification, Transformers, and Safetensors. The publisher
  describes it as a multilingual, non-autoregressive typed-decision model—not
  a text generator. [Model card](https://huggingface.co/convaiinnovations/laya)
- Licence: the Hub metadata declares Apache-2.0. Confirm the actual repository
  licence text and every selected revision before distribution; metadata alone
  is not a legal review. [Model card metadata](https://huggingface.co/convaiinnovations/laya)
- Status at research date: the official Hub API identifies the checkpoint as
  public/ungated, text-classification, Apache-2.0, last modified 2026-10-03,
  with revision `7b928d828b7b0e022f929d9bd2e44165aa270148`; the upstream public
  repository is active (main commit
  `c4a805b5160621bbfc53417126990a67d3163bc5` at review). Recheck both before
  any use—these are mutable upstream resources. [Hub API](https://huggingface.co/api/models/convaiinnovations/laya) · [Upstream repository](https://github.com/NandhaKishorM/laya)
- Capability boundary: the card documents an English root checkpoint,
  multilingual, and `typed-decisions` variants. It explicitly states that the
  base checkpoints are near chance for the card's typed-decisions zero-shot
  task and presents Laya as a base to specialize. Treat all accuracy, latency,
  calibration, and routing figures on that card as publisher-reported until
  reproduced on TwinSleuth's held-out cases. [Honest limits](https://huggingface.co/convaiinnovations/laya#honest-limits)
- Operational fit: the card requires Python 3.10+ and says its router downloads
  a checkpoint on first use. That violates a no-download deterministic demo
  unless weights are provisioned and pinned beforehand; even then, it remains
  non-authoritative. [Installation and quickstart](https://huggingface.co/convaiinnovations/laya#installation)
- Exposure warning: its documented self-hosted server binds to `0.0.0.0` and
  has no authentication unless `LAYA_API_KEY` is set. Do not expose such a
  service in this product; never send hidden hypotheses, unrun forecasts, or
  learner-private episode data to it. [Self-hosting section](https://huggingface.co/convaiinnovations/laya#self-hosting-jev-compatible-http-server)

## Compact-encoder route

Sentence Transformers describes bi-encoders as fixed-size vector encoders;
embedding is commonly efficient and similarity is fast. That supports an
advisory similarity/classification feature, not an evidence or diagnosis
authority. [Sentence Transformers quickstart](https://www.sbert.net/docs/quickstart.html)

`all-MiniLM-L6-v2` is the stronger first baseline because its official card
states 384-dimensional embeddings, 22.7M parameters, Apache-2.0, sentence/
short-paragraph intent, and a 256-word-piece truncation default. The
`paraphrase-MiniLM-L3-v2` card states 17.4M parameters, 384 dimensions,
Apache-2.0, and max sequence length 128. Neither card demonstrates suitability
for TwinSleuth's diagnosis domain; select only through an episode-level,
held-out evaluation against deterministic rules. [L6 card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) · [L3 card](https://huggingface.co/sentence-transformers/paraphrase-MiniLM-L3-v2)

Use the documented Sentence Transformers loader/encoder rather than manually
recreating pooling; the official MiniLM card shows that raw Transformers use
requires correct attention-mask-aware pooling and normalization. [MiniLM
usage](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2#usage-huggingface-transformers)

For the linear-classifier variant, freeze the chosen encoder, train a simple
linear head on preapproved labelled data, and version the corpus, split,
encoder revision, classifier parameters, thresholds, and metrics together.
Only surface a bounded advisory label/confidence after deterministic validation;
do not turn confidence into a score or reveal. Sentence Transformers notes
that fine-tuning changes the notion of similarity by task, which is why
in-domain evaluation is mandatory. [Training overview](https://www.sbert.net/docs/sentence_transformer/training_overview.html)

## SetFit and Transformers

SetFit is Hugging Face's prompt-free few-shot framework for fine-tuning
Sentence Transformers. Its documented training has two phases—embedding
fine-tuning and classification-head training—and its quickstart uses a
Sentence Transformer plus labelled data. It is suitable only for a controlled
offline experiment with a fixed evaluation protocol; it must not supply
authoritative game state. [SetFit overview](https://huggingface.co/docs/setfit/main/index) · [Quickstart](https://huggingface.co/docs/setfit/quickstart)

The Transformers docs distinguish a bare `AutoModel` (hidden states) from a
task-head model such as `AutoModelForSequenceClassification`. Use the former
only when the embedding/pooling contract is explicit; use a task head only
when its labels, weights, and evaluation are owned and pinned. [Loading
models](https://huggingface.co/docs/transformers/models)

## Safe-inference requirements

1. No network or dynamic weight downloads during the demo. Pre-provision a
   reviewed artifact, record its exact Hub commit hash, and fail closed to the
   deterministic path if it is unavailable or mismatched.
2. Do not enable `trust_remote_code` for product inference. Hugging Face says
   it executes custom model code and recommends reviewing code/author; if it
   is unavoidable, pin an immutable commit revision. Prefer models supported
   natively by installed Transformers. [Custom-model guidance](https://huggingface.co/docs/transformers/models#custom-models)
3. Prefer SafeTensors where available, but do not treat Hub scanning as a
   security guarantee. Transformers documents SafeTensors as safer than pickle;
   Hub documentation says it scans repo files on each commit. Review the model
   card, files, commit history, licence, and publisher before approval.
   [Transformers loading](https://huggingface.co/docs/transformers/models) · [Hub malware scanning](https://huggingface.co/docs/hub/main/security-malware)
4. Run locally; send no episode contents to hosted inference. Bound input
   length, time, memory, and output size; redact/deny hidden state at the
   adapter boundary; return a typed, schema-validated advisory result only.
5. Keep deterministic engine state separate: ML cannot read hidden hypothesis
   or unrun forecasts, choose probes, alter budget/score/timing/safety,
   validate evidence, or generate learner-visible claims without deterministic
   allowlisting. Ledger events remain the source of truth.
6. Require reproducible acceptance: fixed offline test set, leakage tests for
   hidden fields, deterministic fallback test, adversarial/malformed input
   tests, and per-class error analysis. Promote only if it improves the stated
   learner outcome without weakening invariants.

## Sources

All links above are first-party Hugging Face, Sentence Transformers, or the
publisher's Hub model card. Findings describe source claims as of the research
date; no claim here is an independent performance validation.
