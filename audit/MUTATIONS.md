# Mutation checks

| Mutation | Command | Result | Reverted |
| --- | --- | --- | --- |
| Always expose `forecastTable` before evaluation | `npm test -- --run src/server/episode-service.test.ts` | Failed: API privacy and service forecast-leak tests (4 failures). | Yes |
| Change correct-diagnosis score from 35 to 34 | `npm test -- --run src/engine/diagnostics.test.ts` | Failed: exact 100-point rubric test. | Yes |
| Remove duplicate-run guard | First run survived; added dedicated regression. Re-run failed in `episode-service.test.ts`. | Failed after test addition: fresh action ID ran P3 twice. | Yes |
| Remove over-budget execution guard | `npm test -- --run src/server/episode-service.test.ts` | Failed: service accepted P6 after a 30-minute path. | Yes |
| Remove expected-revision check | `npm test -- --run src/server/episode-service.test.ts` | Failed: stale HTTP/service requests and two-writer serialization checks. | Yes |
| Flip the H1/P3 authored outcome | `npm test -- --run src/engine/diagnostics.test.ts` | Failed: policy, candidate-set, scoring, observation, and forecast-reveal checks (10 failures). | Yes |
| Give Skeptic an unrun forecast phrase | Original check survived an injected `P4 will stop at 95°` phrase. Added a direct unrun-probe/outcome assertion, then reran `npx vitest run src/server/agents/agents.test.ts`. | Must fail: the Skeptic privacy-boundary test now rejects the injected phrase. | Yes |
| Accept malformed/empty Examiner feedback | `npm test -- --run src/server/agents/agents.test.ts` | Failed: Examiner retry/fallback test accepted the first empty response. | Yes |
| Return first feasible rather than best policy branch | `npm test -- --run src/engine/diagnostics.test.ts` | Failed: root, expected cost, independent solver, and score policy-cost checks. | Yes |
| Remove visible focus outline | `npx playwright test e2e/quality.spec.ts --grep "keyboard"` | Failed at both laptop and phone focus checks. | Yes |
| Remove mobile single-column bench grid | `npx playwright test e2e/quality.spec.ts --grep "accessibility, overflow"` | Failed: 320px interactive targets collapsed below 44px. | Yes |

## Independent recheck — 2026-10-09

All eleven mutations above were reintroduced on the final candidate and immediately reverted. Each targeted regression command exited nonzero because its behavioral assertion failed, not because of compilation or setup failure. The only survivor was the initial Skeptic-forecast mutation; F-023 was corrected by adding the direct output assertion, then the same mutation failed as intended.
