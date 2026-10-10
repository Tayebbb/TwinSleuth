# Judge report — clean clone of origin/main (ec00ba0), Node 24, Windows 11

## Gate (clean clone, before fixes)
npm ci, validate:case, typecheck, test (57), build, test:e2e (12), capture:demo: all pass. Green gate hid two leaks below.

## Defects found and fixed (branch hardening/judge-pass)
1. **CRITICAL — private files served by dev server** (`vite.config.ts`). `server.fs.deny` replaced Vite's defaults; `/src/server/case-model/pin9.ts` (full forecast table, incl. unrun rows), `.env`, `.git/config`, docs returned 200 on `npm run dev` (the only documented run mode). Violates invariant 1. Fix: `fs.allow` allow-list (web, case, node_modules) + restored default denies. Test: e2e "does not serve private server code…".
2. **HIGH — Skeptic text leaked redacted IDs** (`episode-service.ts` propose → `runSkeptic`). View/replay redact premature-elimination IDs, but the template got raw IDs and stored them in the trace: "still supports H1 and H4…" (differs by truth). Violates invariants 1/3. Fix: single `redactTrigger` used for agent input, view, replay. Test: unit, red before / green after.

## Invariant status
1 Server owns truth: PASS after fixes (bundle test + dev-server test). Residual: challenge-kind side channel (DECISIONS.md).
2 Engine sole authority: PASS (score/diagnosis/budget server-side; Examiner output only text).
3 Skeptic isolation: PASS after fix; Skeptic is template-only, ignores model client.
4 No-LLM demo path: PASS (e2e demo, no console errors).
5 Ledger = truth: PASS (state is a fold of events each read). `episodes.revision` column now fixed (regression test).

## Not production ready
Own README says single-process local MVP. Blockers: no prod server (API doesn't serve `dist`; no start script); no authn/tenant scoping (episode UUID is sole capability); in-memory per-IP limiter; SQLite single writer, no migrations/backup; `request.ip` not proxy-aware; CORS/origin fixed to Vite; no CI config or health/metrics/logging (logger disabled).
Verdict: **Hackathon/local demo: GO. Production: NO-GO.**

## Suggested generalizations (not implemented, ranked)
1. Static-serve `dist` from Fastify + `start` script + CI running the AGENTS gate on a clean clone.
2. Make Vite-served surface a tested contract (done for private paths); add a built-output grep for all forecast rows, not two.
3. Case-pack loader: `CaseDefinition` (hypotheses, probes, forecasts, copy) so PIN-9 is one of N; validate with `validate:case`.
4. Auth + per-user episode ownership; persistent rate limiter; structured logs without payloads.
5. Pluggable provider interface (Gemini is hardcoded) with stub for tests.
6. Add replay-equals-live property test over random action sequences.
