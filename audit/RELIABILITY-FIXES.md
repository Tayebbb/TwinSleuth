# Reliability fixes · 2026-10-25

All seven previously failing checks in [the reliability assessment](E:/TwinSleuth/audit/AGENT-RELIABILITY.md) now pass. The [35-case result](E:/TwinSleuth/audit/agent-reliability-results.json) is an offline fixture result, not a production success rate. No runtime dependency or scoring weight changed.

| Gap | Implemented fix | Regression evidence |
|---|---|---|
| Incorrect or meaningless Tutor teaching | The model selects one complete server-authored lesson/reflection pair for the selected skill. Both fields must match the same allowed pair. NFKC normalization precedes matching; the server renders canonical bank text. No arbitrary model prose is admitted. | False principles for all three skills, disguised IDs, meaningless text, mixed pairs, wrong-skill lessons and appended assertions rejected; approved canonical/normalized selections accepted. |
| Unbounded provider response | Both transports read at most 64 KiB of decoded response bytes before parsing. Advertised excess is rejected before reading; actual bytes are counted independently of headers. Excess streams are cancelled. Requests include a 1,024-output-token limit. | Real loopback 1 MiB response rejected; absent/false Content-Length and multibyte bodies rejected; advertised and chunked streams cancelled. |
| Unbounded agent latency | Tutor has one six-second deadline. Examiner has one twenty-second deadline across its maximum two attempts. Cancellation reaches the transport; late output cannot become an accepted response after timeout. | Fake-clock tests prove abort, bounded attempts, fallback reason and timer cleanup; the loopback six-second stall falls back. |
| Examiner feedback lost on worker exit | A deterministic Examiner baseline is an AGENT_RUN event committed atomically with evaluation and the idempotent action response. Optional model focus starts after commit. The learner always has baseline feedback even if optional inference is interrupted. | Separate worker exits immediately after evaluation; file-backed restart retains baseline feedback and score. Rollback leaves the original ledger unchanged and starts no provider call. Late model completion after episode deletion creates no orphan events. |
| Legacy missing feedback | Reading/replaying an evaluated ledger without Examiner feedback appends one baseline event from saved checked claims under the episode lock. | Concurrent repairs append once; score and revision stay unchanged and the replay sequence remains contiguous. |
| Failure visibility | Private agent events include sanitized reason, elapsed milliseconds and a versioned content contract. Optional feedback storage failures produce a fixed server error without raw exception or learner data. | Private-event assertions verify diagnostics; view, replay, export and cached action responses exclude them. |

The Tutor retains its optional teaching flow and curated fallback. Model selection is labeled **AI-selected lesson**. The debrief shows the most recent Examiner note while retaining the complete agent event history. Baseline generation, probe results, evidence validity, budget, diagnosis and points remain deterministic.

## Verification

- `npm ci`: passed; zero dependency vulnerabilities reported.
- `npm run validate:case`: passed both cases; expected/worst policy costs remain 12.5/15 simulated minutes.
- `npm run typecheck`: passed.
- `npm test`: **90 unit tests passed**, then **35/35 reliability evals passed**. The offline gate is now part of the standard test command; `npm run test:reliability` runs it alone.
- `npm run build`: passed; browser privacy regression remains green.
- `npm run test:e2e`: **16 passed**, including accessibility, keyboard, privacy, belief consistency and both case flows.
- `npm run capture:demo`: **1 passed**; refreshed seven reviewer screenshots.
- Impeccable detector: no findings for the changed UI source.

All tests use local fixture stores and stub/no model providers. No real key, hosted database, or deployed service was touched. The original failing eval expectations were preserved; worker-exit coverage was strengthened to require actual surviving baseline text. Existing unrelated working-tree changes were preserved.

## Boundaries

Optional model enhancement is not a durable job and is not automatically restarted after a worker dies. The committed baseline supplies the required feedback. Private diagnostics can be inspected in the server ledger; no public monitoring endpoint, scheduled alert or external notification was added.

The lesson bank is versioned as `2026-10-25.1`. New lessons still require content review before release. This change does not measure real-provider quality, learning gains, hardware safety or independent learner competence. Local regression and fault-injection results do not establish hosted Postgres or serverless service availability.

The request's `max_output_tokens` field bounds requested generation, including reasoning tokens; the client-side byte limit remains independent of provider compliance. [OpenAI Responses reference](https://platform.openai.com/docs/api-reference/responses-streaming/response/file_search_call?lang=javascript).
