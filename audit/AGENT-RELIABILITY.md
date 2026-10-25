# Agent reliability: TwinSleuth diagnostic coaching · low operational, moderate learning/privacy stakes

**Historical pre-fix assessment:** all seven failing checks below are now fixed. See [remediation](E:/TwinSleuth/audit/RELIABILITY-FIXES.md) and [current 35/35 results](E:/TwinSleuth/audit/agent-reliability-results.json).

**Baseline verdict:** deterministic practice and constrained Examiner feedback have useful safeguards. Expanding free-text Tutor use needs content assurance, bounded provider responses, and reliable feedback completion. Existing regression tests pass; the new offline eval exposes seven unmet checks in three areas. No product behavior changed in this assessment.

## Agent and stakes

| Component | Actual authority | Failure cost |
|---|---|---|
| Skeptic | Fixed question from public learner state; ignores any model client. | Misleading challenge; no model-controlled action. |
| Tutor | Optional lesson/reflection from one of three server-selected general skill prompts. No episode evidence, selected fault, or forecast rows enter its prompt. | Incorrect teaching, distraction, provider cost/latency. |
| Examiner | Selects an exact feedback string derived from checked claims. Receives submitted diagnosis, untrusted justification, and checked claims; no selected fault or forecast table. | Wrong emphasis or missing feedback; cannot change the deterministic score. |
| Episode engine/API | Owns observations, budget, safety refusals, claim validity, diagnosis grading, ledger, and anonymous browser ownership. | Corrupted learner history, privacy loss, wrong score if these boundaries fail. |

The model request declares no tools. Agents cannot run probes, delete episodes, send messages, operate equipment, or change points. The learner initiates probe runs and diagnosis lock. This is fictional practice; independent competence and learning gain are not established by a high score.

Sources: [Skeptic](E:/TwinSleuth/src/server/agents/skeptic.ts:19), [Tutor](E:/TwinSleuth/src/server/agents/tutor.ts:39), [Examiner](E:/TwinSleuth/src/server/agents/examiner.ts:45), [provider requests](E:/TwinSleuth/src/server/agents/model-client.ts:38), [episode service](E:/TwinSleuth/src/server/episode-service.ts:371).

## Failure map and catching checks

| Failure | Current catch / evidence | Gap and specific next check |
|---|---|---|
| Bad input or forged tool/action parameters | Strict Zod action schemas, 32 KiB API body limit, case membership, ownership and revision checks; existing API regressions. | Keep API differential/ownership tests as hard release gates. No need to invent an LLM tool-call approval flow: none exists. |
| Hidden truth or unrun forecasts enter an agent | Narrow input construction; case-independent Tutor prompts; deterministic Skeptic; observed-only archive and no unrun accuracy feedback. Existing privacy tests pass. | Re-run privacy/bundle/replay tests on every prompt or interface change. Keyword filters alone do not prove semantic privacy. |
| Tutor hallucinates an incorrect principle | Schema rejects malformed/oversized strings, extra fields, markup and common case identifiers. | **Failed:** false principles for all three skills are admitted. Select from reviewed lessons, or validate generated content before learner display. Add the adversarial semantic cases to the release gate. |
| Tutor evades filters or says nothing useful | Regex/length checks in [tutor.ts](E:/TwinSleuth/src/server/agents/tutor.ts:5). React renders text, not supplied HTML. | **Failed:** `Choose H１.` bypasses the ASCII ID filter; lesson `x`/reflection `y` are admitted. Normalize text before boundary checks; semantic usefulness still needs a reviewed content contract. No selected fault was leaked by these synthetic outputs. |
| Examiner invents facts/points | Exact allow-list of deterministic checked-claim sentences, two attempts, fallback. Eight authored case/cause contexts and injected-fact eval pass. | Preserve exact fact grounding. Evaluate focus usefulness separately; do not treat model wording as scoring authority. |
| Wrong/malformed provider response | JSON parsing, strict agent schemas, exception fallback. Loopback HTTP 503 and malformed-JSON cases pass. | Add response-shape fixtures whenever provider adapters change. A schema assertion is not a teaching-quality eval. |
| Unbounded model response or spend | Tutor output lengths checked after transport; per-call abort; process-local request limits. | **Failed proposed resource gate:** a 1 MiB response with a short valid lesson is accepted. Enforce a streaming byte cap before JSON parsing and a generation budget. The eval's 64 KiB ceiling is a proposal, not an existing product requirement or reproduced out-of-memory exploit. |
| Timeout/runaway retries | Tutor: one attempt, 6-second transport abort; real loopback stall falls back. Examiner: at most two attempts, each transport timeout 20 seconds. | Keep an overall elapsed-time budget as well as attempt counts. Current Examiner transport allowance can total roughly 40 seconds; its grading path is asynchronous. |
| Late or duplicate Tutor response changes the wrong state | Revision/skill checked transactionally before storing; same-process requests coalesce. Both evals pass. | Multi-worker duplicate generation is not prevented by an in-memory Map. Use a shared reservation only if pilot traffic/cost justifies it. |
| Worker exits before Examiner finishes | Deterministic evaluation is committed; pending work lives in an in-memory Map. | **Failed:** score survives fixture worker exit, but both pending status and feedback disappear. Persist deterministic baseline feedback with evaluation; treat optional model focus as an enhancement. Test interruption/restart before calling feedback durable. |
| Background error disappears silently | Traces record template/model/fallback when an agent run is stored. | [trackAgent](E:/TwinSleuth/src/server/episode-service.ts:485) discards rejected work; traces lack duration/reason/version. Add private outcome telemetry and a missing-feedback check. Never log credentials, selected truth, unrun rows, or learner text. |
| Dependency/provider change regresses behavior | Lockfile and existing regression suite; previous dependency remediation. | Version the eval corpus, prompts/curriculum and provider/model configuration in private test results. A previous green run does not certify a future model. |

## Scored evals: measured now

[Harness](E:/TwinSleuth/audit/agent-reliability-evals.ts) → [results](E:/TwinSleuth/audit/agent-reliability-results.json).

```powershell
node --import tsx audit/agent-reliability-evals.ts
```

**28/35 checks pass; seven fail.** Each named check earns 0 or 1. Exit code 1 flags the unmet checks. This is not a production reliability percentage, a model benchmark, or evidence of learning gains.

Coverage: both authored cases × all four selected causes; three skill-specific positive Tutor fixtures; malformed fields/extra data/markup/IDs; injected Examiner facts; retry limits; three false principles; Unicode ID evasion; meaningless text; real loopback HTTP failures, malformed JSON, stall and oversized response; concurrent/stale Tutor calls; and a separate process that exits after committing evaluation, followed by a file-backed restart.

The seven failures are three false-principle cases, Unicode ID evasion, meaningless text, the proposed response-size gate, and lost Examiner work. Existing `npm test` remains **79/79 passed**. The new audit harness is separate from `npm test` and exposes coverage that was missing there. Product source is unchanged by this assessment; earlier browser/build/capture verification was not rerun for these audit-only additions.

These are real application code paths exercised with authored fixtures and local stub outputs. No real model or learner dataset was sampled. No real key, hosted database, or deployed worker was touched. The worker-exit result establishes a local durability gap; it does not establish a particular hosting platform's failure rate.

## Evals to add before wider model use

Keep hard safety/authority checks binary: any truth leak, score mutation, unowned access, unsafe rendering, uncontrolled retries, stale write, or missing required feedback blocks expansion. Promote the failed checks into automated gates when implementing their fixes; do not weaken expectations to make the harness green.

Build a small, versioned teaching corpus from the three skills and de-identified, consented learner difficulties when available. Include confident misconceptions, ambiguous evidence, misleadingly fluent answers, multilingual/Unicode text, and empty/irrelevant reflections. Do not invent learner records from existing code.

For each candidate lesson, a content reviewer scores four dimensions 0–2: concept correctness, relevance to the selected skill, useful reflection, and clear/bounded language. **Proposed admission gate: 2 on every dimension**, plus all binary safety checks. Store rejected examples as regression fixtures. These thresholds are proposed policy, not observed results. Model judging can assist triage; it cannot substitute for deterministic invariants or human content approval.

## Human gates

- Keep ordinary prediction, probe, reflection and deterministic debrief flows automatic after the learner's existing action. Optional coaching does not need another confirmation dialog.
- Require a content owner to approve new lesson banks and case/rubric changes before release; the project already requires approval for rubric weight/category changes.
- An operator reviews model/provider changes, privacy/retention and deployment enablement before expansion. Do not give agents export, deletion, messaging or hardware tools to solve a coaching problem.
- Episode deletion remains an explicit learner action subject to ownership checks. No agent-originated destructive/external action exists to approve in the current interface.

## Right-sized implementation plan

1. **Tutor content assurance:** prefer model selection among reviewed, skill-specific lesson/reflection pairs. This mirrors the Examiner boundary and makes correctness reviewable. Normalization is defense in depth, not the semantic assurance mechanism.
2. **Feedback completion:** commit deterministic Examiner baseline text with the score/ledger transaction; keep optional model enhancement replaceable. This avoids building a job queue just to preserve an optional paragraph. If durable model execution later becomes required, add a persisted job/status plus idempotent recovery.
3. **Resource bounds:** enforce a small configurable response cap before parsing, generation limits and overall deadlines. Keep local stub tests for stalled/oversized HTTP responses.
4. **Private telemetry:** role, terminal status, elapsed time, reason code, revision, curriculum/model version and a private correlation ID. Alert on invariant violations, repeated provider failures, or evaluated episodes lacking baseline feedback. Fallback-rate and latency alert thresholds should follow pilot observations, not invented statistics.

Do not add a vector database, multi-agent consensus, live model grader for points, account system, hardware integration, or per-step human approvals for this practice MVP. Invest in content boundaries, ledger consistency and failure visibility.

## Rollout: shadow → limited use → expand

| Stage | Operation | Advance / stop rule |
|---|---|---|
| Deterministic baseline | Existing no-provider practice flow and curated fallback lessons. | Preserve the complete P1 → P3 → P4 → evidence → diagnosis → reveal loop and existing ownership/privacy gates. |
| Shadow evaluation | Run candidate lesson selections without showing them to learners. Use loopback/stub transport evals and reviewer-scored content; actual-provider sampling, if later approved, is separate and was not performed here. | All hard gates pass; reviewed teaching content meets the admission rubric; interrupted feedback is visible/recoverable. Current seven failed checks must be resolved or their proposed gate explicitly reviewed. |
| Limited, optional pilot | Enable reviewed coaching for a small, explicitly chosen pilot; deterministic scoring stays authoritative and the curated fallback remains available. | Review rejected outputs, latency, fallback reasons, missing feedback and consented learner feedback. Broaden only after observed issues are addressed; do not infer skill gains from completion counts. |
| Wider practice | Expand optional coaching with versioned evals and private monitoring. | Any authority/privacy/state invariant failure stops model expansion. Provider failure returns to curated coaching; preserve saved learner work and the deterministic loop. |

This is a rollout plan, not a deployment or scheduled monitor. The report and runnable evals are the deliverables of this skill invocation; runtime fixes for these newly measured gaps remain outstanding.
