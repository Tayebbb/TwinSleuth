# System review remediation

2026-10-24. Implements the six requested fixes and scoring clarification. Existing unrelated working-tree edits preserved. No runtime dependency added; no scoring weight changed.

| Finding | Fix | Regression coverage |
|---|---|---|
| Shared episode access | Server-issued 256-bit HttpOnly session cookie; hashed ownership persisted separately. Every episode endpoint checks ownership; history is scoped. Production uses Secure `__Host-` cookies. Episode responses are private/no-store. Unissued tokens rotate; duplicate cookies fail closed. | Two-client list/read/replay/export/action/tutor/delete isolation; production cookie flags; token rotation; ownership across storage restart. |
| Belief controls diverge | Controls derive from accepted `view.beliefs`; rejected requests retain accepted selections, and stale refreshes reconcile automatically. | Browser tests for rejecting the last removal and concurrent-tab changes. |
| Misleading Examiner | Fallback facts come from checked claims. The model can select a relevant checked-claim feedback string; arbitrary or contradictory prose is rejected, retried, then falls back. | Unsupported diagnosis, contradictory model response, strict extra-field validation, valid focus selection, retry/fallback. |
| Conveyor text | All current Conveyor outcomes have labels, with raw-value fallbacks. Probe/cause counts derive from case data. | Browser assertions on five-test count, observed evidence rail, and observation heading. |
| Unrun forecast disclosure | P1 offers two prediction choices; case validation rejects singleton public outcomes. Debrief archive includes observed rows only. First forecasts are scored only after their probe runs; unrun commits remain in the ledger without correctness feedback. | Singleton validation, changed unrun-row differential, post-lock projections, export/replay/idempotent retry, exact observed-row HTTP archive. |
| Vulnerable dependencies | Fastify 5.12.7, Zod 4.6.7, fast-uri 3.1.9/4.2.3 installed and locked. | Clean `npm ci`; `npm audit --json`: zero flagged vulnerabilities. |

The unchanged internal `reasoning` category is presented as **Evidence claims**. UI and guide explicitly state that written justification/confidence are recorded, not scored; the practice score does not establish independent competence. Existing tests still award valid structured claims correctly, including an efficient 100-point path.

## Verification

- `npm ci`: passed; zero audit findings.
- `npm run validate:case`: passed both cases; expected/worst simulated costs remain 12.5/15 minutes.
- `npm run typecheck`: passed.
- `npm test`: 79 tests passed, 7 files.
- `npm run build`: passed.
- `npm run test:e2e`: 16 passed, including accessibility, keyboard flows, privacy, rejected/stale beliefs, and Conveyor outcome text.
- `npm run capture:demo`: 1 passed; refreshed seven reviewer screenshots.
- `node --import tsx audit/system-review-probes.ts`: passed. [Current evidence](E:/TwinSleuth/audit/system-fix-evidence.json); [historical evidence](E:/TwinSleuth/audit/system-review-evidence.json).
- Impeccable detector: no findings in the changed UI source. `git diff --check`: passed.

## Storage and interpretation

The ownership table is an additive startup migration for SQLite and Postgres. Existing ownerless episodes remain stored but are not exposed or assigned to a first visitor. Clearing the session cookie removes access to its history without deleting records; deletion still removes the owned episode. This is anonymous browser-session ownership, not an account or verified learner identity.

No unrun authored row is returned by the episode archive, and unrun prediction correctness is not exposed by grading. Observed rows remain available for learning; someone who has practiced the fixed cases may remember them. This change does not claim secrecy against prior knowledge or measure independent competence from repeat scores.

All verification used local fixture storage and stub/no model providers. No real secret, hosted database, or deployed service was accessed. Existing serverless/background feedback and real Postgres deployment behavior remain outside local verification; deterministic grading completes independently of optional feedback.
