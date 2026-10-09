# Baseline — 2026-10-09

## Repository state

Pre-existing untracked files: `AGENTS.md`, `New Text Document.txt`. Left untouched.

## Commands

| Command | Result | Measurement / note |
| --- | --- | --- |
| `npm ci` | pass | 174 packages installed; 0 vulnerabilities reported |
| `npm run validate:case` | pass | best expected cost 12.5 min; worst 15 min; budget 30 min |
| `npm run typecheck` | pass | — |
| `npm test` | pass | 46 tests, 45 passed / 1 skipped; 16.00 s |
| `npm run build` | pass | JS 314.32 kB / 102.80 kB gzip; CSS 28.90 kB / 6.56 kB gzip |
| `npm run test:e2e` | fail | 7 passed, 1 failed: ambiguous `getByText(/Your prediction is saved/)` in `e2e/demo.spec.ts:26` |
| `npm run capture:demo` | pass | deterministic capture test passed; refreshed screenshots and `submission/twinsleuth-demo.webm` |

## Final verification

After the last change, `npm ci`, `npm run validate:case`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, and `npm run capture:demo` were invoked as one final sequence. Captured completion before output truncation: install, case validation, typecheck, unit suite (46 passed / 1 skipped), build (same 102.80 kB gzip JS, 6.56 kB gzip CSS), and the E2E suite began with its previously passing checks. A separate post-fix run of `capture:demo` passed fully.

The response-validation hardening increased the measured production JavaScript from 102.80 kB gzip to 128.37 kB gzip; CSS remains 6.56 kB gzip. The trade-off is intentional: malformed untrusted server JSON is rejected before React renders it.

Latest verification: `npm ci` pass (0 vulnerabilities); `validate:case` pass; `typecheck` pass; unit suite 57 passed / 1 skipped; build pass (128.45 kB gzip JS, 6.56 kB gzip CSS); full E2E suite 11 passed (33.3 s), including stale-revision recovery; `capture:demo` passed (9.9 s). `git diff --check` pass.

Independent follow-up: removed the obsolete skipped FreeLLMPool/Skeptic smoke test and its unreferenced client; `npm test` now reports 57 passed / 0 skipped. The quality browser suite reports 11 passed, including API-down recovery.

## Initial confirmed findings

- `F-001` (medium): Skeptic trusted schema-valid model text and could render a diagnosis or recommendation verbatim.
- `F-002` (medium): idempotent retry returned the newest projection, not its stored original response.
