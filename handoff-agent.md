# TwinSleuth — verified local implementation handoff

## Project status

TwinSleuth is implemented and playable locally at **`E:\TwinSleuth`**. It is a clean-room browser practice lab for the PIN-9 simulated robot-arm refusal. The project has not been pushed, published, hosted, or submitted.

The shipped local implementation includes:

- deterministic PIN-9 case validation, candidate projection, exact policy solving, scoring, and structured claim checks;
- a Fastify API and single-writer, file-backed SQLite event ledger with optimistic concurrency and idempotent actions;
- server-owned truth, observations, costs, revealed forecast rows, evidence-consistent sets, and score;
- a responsive React warm-notebook bench and full debrief;
- bounded LangGraph Skeptic and Examiner flows with structured validation, one retry, injected/mock model coverage, and labeled template/fallback output;
- a no-key P1 challenge → direct P3 → P4 → diagnosis → debrief browser path;
- Playwright coverage for the demo, 1280×800 fit, phone overflow, axe accessibility, keyboard operation, focus visibility, 44px targets, and observation-specific arm states;
- repository-local screenshots, a deterministic WebM capture, submission copy, and a narration/capture script under `submission/`.

## Trust and behavior boundaries

- The browser submits learner choices only. It cannot select truth, outcomes, cost, evidence-consistent causes, or points.
- The private forecast matrix remains in `src/server/case-model/` and is absent from the production browser artifact.
- Before lock, the API exposes authored forecast rows only for completed probes and does not expose the server-derived candidate set.
- The Skeptic receives learner predictions, learner beliefs, deterministic trigger metadata, and already revealed observations. It does not receive truth or an unrun authored row.
- The Examiner receives the locked learner argument and deterministic claim checks. It cannot score or change state.
- P1’s all-same prediction table triggers the Skeptic. Choosing **Revise to P3** selects P3; its balanced forecast runs directly with no second Skeptic/run-anyway detour. After P3, P4 discriminates the evidence-supported H1/H4 branch and also runs directly.
- The arm is stationary for the initial refusal. P3 completed/refused and P4 stopped/full-range observations have distinct accessible SVG states. P4 `stopped-at-95` renders and labels the J2 95-degree stop.

## Reproduce and verify

Requires Node.js 22+ and Playwright Chromium.

```sh
npm ci
npx playwright install chromium
npm run validate:case
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run capture:demo
```

`npm run dev` starts the API on `127.0.0.1:5174` and Vite on `127.0.0.1:5173`.

Verified on October 8, 2026:

- case validator: all six cause pairs distinguishable; 12.5-minute expected and 15-minute worst exact policy;
- TypeScript: passed;
- Vitest: passed, including file-backed restart/idempotency, four-truth pre-test equivalence, browser artifact privacy, scoring, and injected LangGraph paths;
- Vite production build: passed;
- Playwright Chromium: passed demo, viewport-fit, axe, phone overflow, minimum target, visible focus, keyboard path, and arm-state assertions;
- deterministic media capture: produced six PNGs and `submission/twinsleuth-demo.webm`.

## Genuine external limitations

- `ANTHROPIC_API_KEY` was absent during final verification. The real-provider smoke test is executable and automatically skips without credentials; model invocation, structured parsing, retry, thrown-provider failure, and fallback are covered with injected clients through the real LangGraph routing.
- No hosted URL exists because the standing instruction forbids pushing or creating/opening a remote repository. Local submission media and copy do not require publishing.
- Playwright emulation verifies laptop and phone browser sizes; no physical iOS or Android device was available in this environment.

## Guardrails

Do not reintroduce an Investigator, LLM-controlled observations/diagnosis/scoring, staged runtime faults, 3D/URDF, accounts, RAG, or safety/efficacy claims. This is simulated practice, not a digital twin, industrial safety system, or validated learning intervention.
