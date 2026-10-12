# Research decision log

| Date | Decision | Evidence | Reversal condition |
| --- | --- | --- | --- |
| 2026-10-12 | Preserve deterministic engine as sole authority. | Engine/service inspection and regression suite. | None for ML; authority is an invariant. |
| 2026-10-12 | Do not select Laya. | Size/runtime and source-card zero-shot limits; no task data. | Approved benchmark shows material advantage within local constraints. |
| 2026-10-12 | Do not download weights or add ML dependencies. | No labeled corpus or acceptance result. | Dataset-card gates satisfied. |
| 2026-10-12 | Treat MiniLM embedding plus linear head as future first baseline. | Compact Apache-2.0 encoder route; lower complexity than fine-tuning. | A deterministic rule or another baseline wins preregistered evaluation. |
| 2026-10-12 | No integration. | No demonstrated incremental learner value. | All benchmark/security/human-review gates pass. |
| 2026-10-12 | Synthetic feasibility is not ready. | Repository audit found no claimed learner-reasoning dataset, schema, guidelines, manifests, validator, leakage report, benchmark, or results. | Add and validate the research-only corpus/tooling described in `RESEARCH_FINDINGS.md`. |

Open questions: learner-consent and retention policy; target feedback taxonomy;
minimum sample size and scenario diversity; what outcome defines educational
value. Stopping criterion met: current evidence is sufficient for a no-go, and
additional model experimentation without data would not change that decision.

Synthetic-only work has a narrower gate: it does not require real learner data
to create a feasibility corpus, but it does require inspectable synthetic
provenance, label rules, split integrity, input redaction, and a frozen
held-out set. Passing that gate would justify only a synthetic benchmark—not a
claim about learners or production readiness.
