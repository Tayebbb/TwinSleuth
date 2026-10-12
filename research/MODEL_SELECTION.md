# Model selection decision

Date: 2026-10-12. Decision: **no production ML model; no download; no
fine-tuning; no integration.**

## Compared options

| Option | Fit today | Decision |
| --- | --- | --- |
| Existing deterministic logic | Authoritative, tested, explains structured claims and known trigger cases. | Keep. |
| Existing optional Gemini Examiner | Bounded post-lock prose only, with template fallback. Quality is not benchmarked. | Keep optional; do not expand authority. |
| Rules for new categories | Viable only where a category can be written from public learner inputs. | Prefer first. |
| Frozen MiniLM embedding + linear head | Smallest credible future supervised baseline. | First experiment, conditional on data. |
| SetFit | Possible few-shot comparison, but adds tuning/dependency complexity. | Compare only after baseline/data gate. |
| Fine-tuned encoder | Potentially suitable only with sufficient diverse labels. | Deferred. |
| Laya | Public card reports 322--421M variants and separate Python/router runtime; base zero-shot typed-decision results are near chance. | Rejected for default runtime. |

The sourced identifiers, licences, revisions, and operational cautions are in
[model-selection-research.md](model-selection-research.md). No upstream claim
has been treated as TwinSleuth performance.

## Reversal criteria

Reopen only when an approved corpus has scenario-disjoint held-out examples,
an annotation agreement report, deterministic/advisory baselines, and the
acceptance criteria in [BENCHMARK_REPORT.md](BENCHMARK_REPORT.md) are fixed
before final test evaluation. Any model remains local, optional,
schema-validated, and advisory after diagnosis lock.
