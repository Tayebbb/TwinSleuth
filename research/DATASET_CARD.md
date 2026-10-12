# Dataset card: proposed reasoning-feedback pilot

Date: 2026-10-12. Status: **no dataset exists in this repository.** No real
learner records were inferred, copied, uploaded, or generated for training.

## Unit and intended labels

One row is one post-lock learner justification plus already public episode
context available to the Examiner. Candidate labels, subject to pilot review:
`sound`, `insufficient-evidence`, `unsupported-inference`, `contradiction`,
`misread-probe`, and `unclear`. Labels must describe feedback routing, never
diagnosis correctness or score.

## Required provenance and governance

- Use only explicitly authorized, de-identified records; record consent scope,
  retention, source episode/case version, and annotator identity/pseudonym.
- Do not upload records to hosted inference/model services.
- Retain no private truth or unrun forecast fields in model input or labels.
- Provide written annotation guidance, ambiguous examples, double annotation,
  adjudication process, and agreement statistics.

## Split and leakage policy

Split by underlying case/scenario template, not by paragraph. Deduplicate
near-identical text before splitting. Freeze a held-out scenario set once;
never tune thresholds or prompts against it. Report class counts and abstain
for sparse/ambiguous categories.

## Limitations

Synthetic rows can help test parsers and schemas, but cannot demonstrate
learner behavior or learning benefit. Until genuine approved data exists, no
training, fine-tuning, performance metric, or user-outcome claim is valid.
