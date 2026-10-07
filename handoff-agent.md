# TwinSleuth — Copilot continuation brief

## Assignment

Continue the existing project in **`E:\TwinSleuth`**. Read [`handoff.md`](./handoff.md) before editing; it is the single source of truth for product behavior, case data, scoring, architecture boundaries, UI, research claims, and demo. Do not restart ideation or rebuild completed engine work.

Finish the playable MVP described there: a server-authoritative episode service and API, the complete no-key browser flow, the warm lab-notebook bench/debrief, and the bounded Skeptic and Examiner LangGraph workflows. Work in small vertical slices, test each slice, and continue until the acceptance checklist below passes. Do not deploy, publish, push, or submit unless the user explicitly asks.

## Start here

1. Confirm the working folder is `E:\TwinSleuth`; keep the unrelated `E:\isd-sd` workspace untouched.
2. Read `handoff.md`, `src/engine/`, `src/case/catalog.ts`, and `src/server/case-model/pin9.ts`. Treat `handoff.pre-reshape.md` as rejected history only.
3. Run `npm run validate:case`, `npm run typecheck`, and `npm test` to establish current status.
4. Review the current working tree and preserve existing changes.
5. Treat the deterministic engine as the validated baseline. Add server-boundary and privacy/leak tests alongside the service/API they exercise; revisit engine code only if a new boundary requires it or a check regresses. Then build the complete template-mode vertical slice. The source layout and acceptance details are in `handoff.md`.

## Verified starting point (October 8, 2026)

- Public PIN-9 case, server-only forecast matrix, candidate/partition logic, Skeptic trigger logic, bounded score, exact policy solver, and case validator exist under `src/`.
- The case validator confirms 6/6 hypothesis pairs separate; best policy is P3 first, 12.5 expected minutes / 15 worst-case minutes within the 30-minute budget.
- `npm run validate:case`, `npm run typecheck`, and `npm test` pass; current test count is 13.
- Dependencies for Fastify, React/Vite, Zod, `better-sqlite3`, `@langchain/langgraph`, and `@langchain/anthropic` are installed. `better-sqlite3` passed an in-memory smoke test on this Windows/Node host.
- API, persistent episode ledger, browser UI, LangGraph workflows, and Playwright end-to-end test are not implemented yet. Do not report them as done.
- The repository is initialized with Git but has no implementation commit. `handoff.md` has the full brief and the audit decisions already applied to the engine/design.

## Guardrails

Use `handoff.md` for the complete specification. The key trust boundary is that the client supplies learner choices only; truth, observations, costs, score, and evidence-consistent cause sets come from server-owned episode state. Keep the forecast matrix out of browser code and unrun forecast rows out of every pre-run response and agent input. The Skeptic challenges the learner’s own predictions; the Examiner comments on the locked argument; neither selects the answer or awards points. The full flow works in labeled template mode without an API key.

Keep the student’s reasoning central: no Investigator, staged failure, runtime-generated fault, 3D/URDF scope, LangGraph checkpointer, or interrupt flow. Use one SQLite-backed event ledger and one single-writer `EpisodeService`. LangGraph is limited to the two validated/fallback workflows in `handoff.md`; scoring remains deterministic. Describe the product as simulated practice, not a digital twin, safety system, or proven learning intervention. Keep all implementation under `E:\TwinSleuth`; do not copy Vantage code/assets/data.

## Finish checklist

- A refreshed clone can run `npm ci`, `npm run validate:case`, `npm run typecheck`, and `npm test` successfully.
- Template mode supports a complete episode: start → belief selection → four-cause prediction → Skeptic revise/run-anyway choice → run probe and reveal its forecast → diagnosis and four structured claims → score and two-timeline debrief → truth reveal. Reload/replay and action retries are safe.
- A browser end-to-end test exercises that complete flow and checks the important predictions, revealed rows, score, and debrief.
- Score and evidence are built from server-owned state; untrusted client values cannot set truth, result, cost, or points. Duplicate actions are idempotent; stale revisions conflict safely.
- Tests compare equivalent pre-observation behavior under all four hidden truths and inspect real agent inputs/prompts for hidden truth and unrun forecasts. The browser bundle contains no forecast matrix.
- Both LangGraph agents demonstrate structured validation, one retry, labeled fallback, and useful trace output with credentials configured. Without credentials, all core interactions still work.
- The accepted notebook visual direction, keyboard operation, visible focus, reduced motion, responsive layout, and non-color labels are verified in the browser.
- README/setup instructions and the corrected 2–3 minute demo assets agree with the app. No unsupported safety/efficacy claim or contradictory demo step remains.

The demo is specified in `handoff.md`; preserve the stationary arm at the initial refusal and do not claim P1 ran when it was only proposed and challenged. Recheck changing hackathon rules and provider/model lifecycle details before final submission.

## Report at completion

List implemented work, the checks actually run and their results, remaining limitations, and the exact project path. Mark the MVP complete only when every item above passes.
