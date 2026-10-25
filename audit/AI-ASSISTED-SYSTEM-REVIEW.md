# AI-Era Review Guidance: TwinSleuth

**Historical baseline:** the findings below describe the pre-fix system. See [remediation](E:/TwinSleuth/audit/SYSTEM-FIXES.md) and [current probe evidence](E:/TwinSleuth/audit/system-fix-evidence.json). The probe script now asserts corrected behavior; the original evidence JSON is retained.

Reviewed 2026-10-24. Scope: current working tree, including existing uncommitted changes; both cases, engine, API, storage, agents, browser, deployment entry point, and tests. Review only; product code and rubric unchanged.

**Verdict:** the deterministic practice loop works. The current system is not a dependable standalone measure of a learner's independent diagnostic competence. Its strongest signals are committed predictions, chosen tests, and checked evidence citations. Shared-server episode ownership is the most urgent defect.

## Context recovered from code

| Requested input | Implementation evidence |
|---|---|
| Role | Learner practicing diagnosis of fictional maintenance faults; inferred from the case catalog and learner workflow. No employee-review system exists. |
| Current rubric | Diagnosis 35, evidence sufficiency 15, prediction accuracy 15, probe quality 20, reasoning 15. [Scorer](E:/TwinSleuth/src/engine/score.ts:161). |
| AI involvement | Skeptic is deterministic. Optional Tutor generates general lessons from a fixed skill prompt, without case state. Examiner optionally generates feedback after deterministic grading; neither decides points. [Skeptic](E:/TwinSleuth/src/server/agents/skeptic.ts:19), [Tutor](E:/TwinSleuth/src/server/agents/tutor.ts:39), [Examiner](E:/TwinSleuth/src/server/agents/examiner.ts:31). |
| Tooling reality | OpenAI when a key is configured; FreeLLMPool when testing mode is 1; deterministic fallback without a provider. [Selection](E:/TwinSleuth/src/server/agents/model-client.ts:78). |
| Review situation | Whole-system review of assessment, assistance, correctness, privacy, and verification; no individual performance rating. |
| AI stance | Optional coaching is explicitly offered and unscored. No employer AI policy, external-assistance policy, author attribution, or adoption requirement can be established from this code. |

## Findings, ordered by impact

### 1. [P1] Episodes have no ownership boundary

[Routes](E:/TwinSleuth/src/server/app.ts:67) expose global listing, reads, replay, export, mutation, and deletion. [Storage](E:/TwinSleuth/src/server/episode-service.ts:129) has no owner filter. UUIDs are disclosed by listing. Origin checks do not identify an episode owner.

**Reproduced:** a second simulated client listed another client's episode, changed its safety history, exported its written justification, and deleted it. Statuses: 200/200/200/204. This directly affects confidentiality and integrity on a shared server. The browser also incorrectly describes hosted history as local SQLite storage: [copy](E:/TwinSleuth/src/web/main.tsx:373), versus [Postgres selection](E:/TwinSleuth/src/server/runtime-store.ts:5).

**Smallest robust direction:** establish a server-issued ownership/session capability and enforce it on every episode route and list query; correct storage copy. Add two-client isolation regressions. Hiding the history control alone does not close the API defect.

### 2. [P2] Rejected belief updates leave the UI competing with the ledger

The [checkbox handler](E:/TwinSleuth/src/web/main.tsx:317) changes local `possible` before the request succeeds. [Schema](E:/TwinSleuth/src/server/schemas.ts:19) rejects an empty cause set. The action error path does not restore the local selection from `view.beliefs`.

**Reproduced:** remove H2, H3, H4, then H1. UI: zero checked causes. Ledger: H1 still retained. Error: `Request is invalid.` A stale-revision refresh also updates `view` without reconciling these inputs.

**Direction:** render accepted beliefs from the server projection; if using an optimistic draft, roll it back/reconcile on rejection and refresh. Test the rejected final removal and a concurrent update.

### 3. [P2] Examiner feedback can contradict deterministic evidence

The [fallback](E:/TwinSleuth/src/server/agents/examiner.ts:33) always says to explain why the submitted diagnosis remains supported. The service has the same fallback wording. The model-output [schema](E:/TwinSleuth/src/server/agents/examiner.ts:6) checks shape and length, without checking agreement with claim validity.

**Reproduced:** truth H1, submitted H2, diagnosis points 0, zero valid claims; fallback still says H2 “remains supported.” A stub response saying every claim is valid and the score is 100 was accepted despite an invalid checked claim. Actual score/state were unchanged; this is misleading instructional feedback, not a demonstrated truth leak or script execution.

**Direction:** derive factual feedback from checked claims. Keep optional generative prose subordinate to those facts. Add unsupported-diagnosis and contradictory-output regressions.

### 4. [P2] “Reasoning” overstates what the score measures

[Structured claim checks](E:/TwinSleuth/src/engine/score.ts:48) validate citations and stances. The [grading call](E:/TwinSleuth/src/server/episode-service.ts:367) does not receive justification, confidence, belief changes, or coaching history.

**Reproduced:** correct P3/P4 predictions, H1 diagnosis, valid citations, justification `x`, confidence 1, and all four causes still selected earned **100/100**, including 15 reasoning points. This demonstrates the measure's boundary; it does not mean valid structured claims deserve no credit.

**Direction:** describe the existing category as structured evidence-claim validity. Evaluate written defense and independent transfer separately before using the total as a competence rating. Do not silently change weights/categories. A correct guess can receive 35 diagnosis points without observations; report evidence sufficiency alongside diagnosis correctness.

### 5. [P2] Literal unrun-forecast secrecy does not hold

[P1 public outcomes](E:/TwinSleuth/src/case/catalog.ts:27) contain only `refused`. Since every forecast must use a public outcome, its complete row is derivable before running P1. After any evaluation, [publicView](E:/TwinSleuth/src/server/episode-service.ts:424) exposes the entire fixed forecast table, including unrun probes. These same authored tables are reused in later episodes.

This conflicts with AGENTS.md's unconditional “any unrun forecast row” requirement. Existing tests deliberately permit full post-evaluation disclosure. Selected hidden fault secrecy before observations is a separate property and passed the existing differential tests.

**Direction:** explicitly resolve the confidentiality contract against the intended teaching/debrief behavior. Add tests for the agreed boundary. Do not certify the literal invariant from the present bundle/API tests. Repeated-case scores also need a familiarity qualifier.

### 6. [P2] Conveyor observations lose outcome labels

The [outcome label map](E:/TwinSleuth/src/web/main.tsx:35) covers PIN-9 values. The evidence rail and observation heading use direct lookups without the fallback used elsewhere: [rendering](E:/TwinSleuth/src/web/main.tsx:343).

**Reproduced:** C-P3 `count-low` appears in the citation select while its evidence-rail outcome label is empty. No page exception occurs. The test-count caption also says six for the five-probe Conveyor case.

**Direction:** use a consistent label fallback or case-owned public labels and derive counts from the case. Assert the observation text, not only that the evidence heading exists.

## Criteria audit

“Hybrid” means learner action plus assistance and case conditions; deterministic arithmetic does not prove independent authorship.

| Current criterion | Measures | Verdict |
|---|---|---|
| Diagnosis, 35 | Hybrid: correct selection, possibly guessed or assisted | Keep as correctness; do not equate it with demonstrated diagnosis skill. |
| Evidence sufficiency, 15 | Hybrid: executed tests isolate one model-consistent cause | Keep; display independently of correctness. |
| Prediction accuracy, 15 | Hybrid: first commits versus authored rows | Keep; record assistance/familiarity context. Abandoned proposals count too. |
| Probe quality, 20 | Hybrid: information, branch-relative cost, unsafe attempts | Keep as a simulated policy measure. The UI directly offers P3 after P1, so some strategy is coached. |
| Reasoning, 15 | Hybrid: valid structured citations and stances | Rewrite interpretation; no prose reasoning evaluation exists. |
| Written justification, unscored | Hybrid: learner or external draft; no provenance | Keep for review, not proof of authorship or explanation quality. |
| Confidence, unscored | Human self-report; calibration unmeasured | Keep as reflection; compare with evidence across episodes before interpreting. |
| Belief timeline, unscored | Human-entered belief changes; consistency unscored | Keep as process evidence, after fixing UI divergence. |
| Tutor/Examiner prose, unscored | Tool signal | Exclude from human rating. Fluency and provider availability are not learner achievement. |

No current scored category measures team leverage. No output-volume or speed-to-draft metric exists; do not introduce either.

## Rewritten review criteria

These are review guidance, not implemented scoring changes.

| Durable signal | Observable definition | Evidence |
|---|---|---|
| Judgment | Before observing, names competing explanations, predicts a separating result, and explains why a test is worth its simulated cost. | First commit, chosen test, coached versus independent choice, short verbal explanation. |
| Verification | Compares prediction with observation; corrects contradictions; cites evidence that actually excludes alternatives; checks assistant suggestions. | First/revised commits, observation IDs, claim checks, explained correction. Credit caught errors explicitly. |
| Outcomes | Reaches an evidence-supported diagnosis within budget and transfers the method to an unfamiliar case. | Correctness plus sufficiency, cost, safety record, independent transfer attempt. Current fixed-case score alone is insufficient. |
| Leverage | If reviewing a team workflow, shares a verified method that another learner can apply correctly. | Peer reuse and verification of the shared method. Not currently measured; do not infer from tutor requests or add to individual scores by default. |

## Evidence to collect

Walk three episodes backwards: one successful, one revised, one failed. For each, inspect the first forecast, assistance available before the decision, revisions, observed result, claims, and the learner's explanation of what changed and why. Ask for an unfamiliar counterexample to distinguish understanding from remembered answers.

Exports already retain structured events and agent traces. First forecasts survive in `PROBE_PROPOSED`; `PROBE_REVISED` preserves a subsequent change. The comparison UI displays the latest proposal, while scoring uses first commits; review both. Confidence and justification are recorded at lock.

Missing: independent identity/ownership, declared external assistance, model/curriculum version provenance, a captured learner answer to Tutor reflections, validated learning gain, and a first-attempt versus repeat-case distinction. Do not invent these from timestamps or prose style. Error/rework history here is within-episode; the system has no workplace delivery or stakeholder-trust record.

## Calibration rules

1. Compare the same role outcomes under comparable cases, familiarity, and assistance conditions. Do not rank learners by raw totals across mixed conditions.
2. Optional Tutor use is permitted by the product. Neither using it nor declining it warrants a penalty. Provider access is not merit.
3. Separate independent first decisions from coached revisions; value a correction without relabeling it as unaided prior knowledge.
4. Surface verification labor: finding a bad prediction or false assistant claim is positive evidence, even if another learner finishes faster.
5. Use transfer evidence before claiming durable competence. Repeating two fixed tables can measure recall.
6. Apply only announced accountability rules. No employer AI policy is present; do not improvise misconduct findings from the code or accuse a person based on polished output.

## The conversations

**High score, thin judgment:** “Your structured result scored 100. Walk P3 and P4 backwards: what did you predict, what help was available, and why did you choose them? Now explain a different test that could disprove your preferred cause.”

**Careful learner, lower output:** “You caught a contradiction before locking your diagnosis. That verification counts. We will compare evidence-supported outcomes and test choices. Coaching is optional; trying it can be a learning experiment.”

**Unverified assisted work:** “This submitted claim conflicts with its cited observation. Show how you checked it and what you changed from any assistant draft. We will address verification and correction using the policy that actually applies.” No disciplinary inference is justified without that policy.

## Hardening invariants

| Rule | Result |
|---|---|
| Hidden truth and unrun rows private | Selected truth stayed private in existing pre-observation tests. Literal unrun-row rule fails finding 5. Timing noninterference is not established. |
| Deterministic engine owns state and score | Verified central grading, outcomes, budget, claim validity, and safety penalties; LLM text does not mutate these. Feedback grounding remains defective. |
| Skeptic/Examiner restricted | Skeptic receives redacted public-state input and ignores model clients. Examiner receives submitted diagnosis/justification and checked claims, without selected truth or forecast tables. Its prose may contradict checks. |
| No-provider demo | Passed complete P1 → P3 → P4 → diagnosis → debrief flow; browser test asserts no console errors or failed requests. |
| Ledger is authoritative | Server folds stored events; restart/revision/idempotency tests pass. Browser belief controls violate projection consistency in finding 2. |

## Verification and limits

| Command | Result |
|---|---|
| `npm ci` | Passed. |
| `npm run validate:case` | Passed both cases; solver expected cost 12.5, worst case 15, budget 30 simulated minutes. |
| `npm run typecheck` | Passed. |
| `npm test` | 70 passed, 7 files. |
| `npm run build` | Passed. |
| `npm run test:e2e` | 14 passed, including accessibility, keyboard paths, privacy surfaces, and both cases. |
| `npm run capture:demo` | 1 passed; pre-existing screenshots restored afterwards. |
| `node --import tsx audit/system-review-probes.ts` | Passed; seven targeted observations saved in [evidence JSON](E:/TwinSleuth/audit/system-review-evidence.json). |
| `npm audit --json` | Exit 1: three flagged packages, one high, one moderate, one low. Separate from passing required checks. |

Dependency scan: installed Zod 4.6.5, Fastify 5.12.5, and fast-uri 3.1.8/4.2.1 were flagged. Advisory context: [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [Fastify maintainer advisory](https://github.com/fastify/fastify/security/advisories/GHSA-389g-gv7q-r4x8), [fast-uri maintainer advisory](https://github.com/fastify/fast-uri/security/advisories/GHSA-w74x-v6f9-j3xg). These are dependency findings, not reproduced TwinSleuth exploits. The 32 KiB API body cap and existing schemas matter to reachability; assess before assigning application severity. No dependency update was made.

All probes used local memory storage and stub/no providers. No real key, real database, or hosted application was exercised. Postgres startup is mocked in tests; deployed database concurrency, serverless completion of background Examiner work, live-provider quality, load behavior, and timing channels remain unverified. Source review and passing tests do not establish those properties.

Recommended order: isolate episodes; reconcile belief state; ground Examiner feedback; restore Conveyor outcome text; resolve the forecast confidentiality contract; then standardize assistance/familiarity evidence and assessment language. Preserve the predict–test–compare–defend loop and deterministic authority.
