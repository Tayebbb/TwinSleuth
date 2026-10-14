# TwinSleuth ML research findings

Date: 2026-10-12. Baseline: `v0.1.0-rc.1` (`da7a9b8`), inspected from
`main` at `e6f8ce1`. Scope is research only: no product code, dependency,
model weight, or release-tag change.

## What exists

- `EpisodeService` owns the SQLite event ledger, replay/fold, private truth,
  public projection, state transitions, and post-lock agent dispatch.
- The deterministic engine validates predictions, derives evidence consistency,
  detects Skeptic triggers, computes optimal policy, validates evidence claims,
  and grades every rubric component.
- The deterministic Skeptic consumes only learner beliefs, committed
  predictions, and observed evidence. It has no truth or unrun forecast input.
- The optional post-lock Examiner receives a diagnosis, free-text justification,
  structured claims, and deterministic claim checks. Its bounded text output is
  schema-checked and falls back to a template; it cannot change state or score.
- Browser-visible data deliberately excludes hidden truth, the current
  evidence-consistent set, and unrun forecast rows. Existing server/browser
  tests exercise those boundaries.

## Learner signals and data

The ledger retains episode actions, structured claims, observed evidence, and
the free-text justification. Repository inspection found no exported learner
corpus, annotations, consent/retention policy for research use, or label set.
The project explicitly says it is not yet evaluated for learning outcomes.
Thus there is no defensible training or held-out evaluation dataset.

## Independent review

| Lens | Finding | Decision |
| --- | --- | --- |
| Product/education | A post-lock prose-feedback opportunity exists, but learner need and outcome benefit are unmeasured. | Do not add a model. |
| Methodology | Proposed labels are classification-like, but absent labels make any score synthetic and non-generalizable. | No training/benchmark claim. |
| Operations | The Node local demo has no Python/ML runtime. Laya adds a large separate runtime; no model is justified. | Preserve no-provider demo. |
| Security/correctness | A model must never receive hidden truth/unrun forecasts or decide scoring, evidence, probes, budget, or state. | Preserve current deterministic authority. |
| Portfolio/research | The meaningful result is a preregistered offline evaluation after consented data, including a negative-result path. | Record bounded pilot design. |

## Go/no-go by use case

| Use case | Result | Reason |
| --- | --- | --- |
| Grade diagnostic prose | No-go | Structured claims already provide deterministic evidence validation; no labels support prose grading. |
| Detect reasoning-error categories | No-go now | Some errors are deterministically detected; broader categories lack data and validated taxonomy. |
| Choose pedagogical feedback | No-go now | No outcome data establishes which strategy helps. |
| Replace Examiner/provider | No-go now | No equivalent labeled quality benchmark or resource measurement exists. |
| Offline advisory classifier pilot | Conditional | Only after approved, scenario-split labels and predefined acceptance criteria. |

See [model-selection-research.md](model-selection-research.md) for
primary-source model research and [DATASET_CARD.md](DATASET_CARD.md) for the
data gate.

## Synthetic-feasibility artifact audit — 2026-10-12

**Outcome: B — needs research-artifact fixes before synthetic feasibility
benchmarking.** This is not a block on creating a synthetic-only study; it is
a finding that the claimed preparation is absent from the checked repository.

### Inspected

- Git state: `main` at `e6f8ce1`; immutable release tag
  `v0.1.0-rc.1` resolves to `da7a9b8d1b4d7e04b18e6cd513a164aa7141d126`.
- Every tracked/untracked file below `research/`, plus repository-wide searches
  for annotation, dataset, manifest, split, leakage, simulation, benchmark,
  and next-action artifacts.
- Actual deterministic claim validation and post-lock Examiner inputs.

### Result

At the initial audit checkpoint, only the six ML-research Markdown records
then present existed. The follow-up added validation protocols, but no
`research/learner-reasoning/` directory or equivalent was found. Specifically
absent: annotation guidelines; seven-category definitions/examples/borderline
rules; synthetic records; provenance/schema/validator; scenario or template
manifests; train/development/test manifests; deduplication or leakage report;
benchmark implementation/results; and a next-action document.

Consequently there are no labels to assess for overlap, no examples to inspect
for correct diagnosis with flawed reasoning, no split-to-row correspondence to
verify, and no eligible benchmark to run. No AI-generated label may be called
human-reviewed; none was present to review.

### Required research-only repair

Before benchmarking, add a versioned synthetic corpus and validator that (1)
defines all seven labels with precedence/ambiguity rules and counterexamples,
(2) records synthetic provenance and generation-template ID, (3) admits only
the post-lock public fields available to the Examiner, (4) excludes hidden
truth, unrun forecasts, future events, rationales, and simulator metadata from
model features, (5) splits by template/scenario before text generation and
proves no normalized or near-duplicate text crosses splits, and (6) freezes a
held-out manifest unread by training/model-selection commands. Label the result
synthetic-only even if every check passes.
