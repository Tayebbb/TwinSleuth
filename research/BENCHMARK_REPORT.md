# Benchmark report

Date: 2026-10-12. Status: **not run; correct no-go outcome.** There is no
approved labeled dataset, so no model was downloaded, trained, inferred, or
benchmarked. A fabricated/synthetic score would not answer the product
question.

## Reproducible repository baseline

Executed locally after `npm ci`:

| Check | Result |
| --- | --- |
| `npm run validate:case` | Pass: 4 causes, 6 probes; all pairs distinguishable. |
| `npm run typecheck` | Pass. |
| `npm test` | Pass: 6 files, 64 tests. |
| `npm run build` | Pass. |
| `npm run test:e2e` | Pass: 14 tests. |
| `npm run capture:demo` | Pass: deterministic capture generated. |

The initial browser invocation encountered a stale process from the interrupted
local test runner; no user process was stopped. A fresh isolated Playwright
run passed. The counts above are the current cleanup baseline as of 2026-10-12.

## Future acceptance protocol (set before test evaluation)

Compare deterministic routing, template/Examiner reference output where
available, frozen `all-MiniLM-L6-v2` embeddings plus a linear classifier, and
any fine-tuned alternative on identical scenario-disjoint held-out rows.

Promotion requires all of:

1. Per-class precision/recall and macro-F1 reported with confusion matrix;
   calibration, abstention, cold/warm p50/p95 latency, peak memory, model size,
   and failure rate measured.
2. A prespecified minimum of macro-F1 >= deterministic baseline + 0.05 and
   precision >= 0.90 for every learner-visible non-abstained error label. If a
   class cannot meet this, abstain/template fallback is required.
3. No degradation of hidden-state leak, deterministic fallback, malformed
   input, or timeout tests; model receives only approved public/post-lock
   fields.
4. A human review establishes that suggested feedback is useful and not merely
   label-accurate.

These are prospective criteria, not achieved results.

## 2026-10-12 synthetic-readiness audit

No synthetic benchmark was run. The claimed prerequisite corpus and evaluation
tooling were not present in the repository: no records, category guidelines,
schema/validator, provenance, split manifests, leakage report, or benchmark
script/result. Running a classifier without them would fabricate a feasibility
result. See `RESEARCH_FINDINGS.md` for the required research-only repair.
