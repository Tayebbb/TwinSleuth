# Hardening and cleanup decisions

- Skipped (ask-first): none required a dependency, rubric change, or deletion.
- Not changed (design call): `same-prediction` / `premature-elimination` trigger *presence* still varies with the evidence-consistent set, so challenge kind is a weak side channel. Candidate set is already derivable from revealed P-rows; closing it needs a product decision (always-emit generic challenge?).
- `npm run capture:demo` regenerates the short tracked browser-preview video and current screenshots. The separate five-minute submission MP4 is not produced by that command.

## Documentation and dependency cleanup — 2026-10-12

- Retired `handoff.md`, `handoff-agent.md`, and `handoff.pre-reshape.md`: these were superseded, contained stale architecture, and had no remaining consumers after replacing the E2E path probe with `USER-GUIDE.md`.
- Retired `design-system/twinsleuth/MASTER.md`: its token source and screen descriptions contradicted the shipped CSS; `DESIGN.md` is now the single design guide and points to the authoritative styles.
- Retired `research/UPGRADE-IMPLEMENTATION-REPORT.md`: the current implementation and verification are recorded in source, the technology audit follow-up, and research decision records.
- Removed `@langchain/anthropic` after graph-backed/source search found no import or use; LangGraph remains used for the optional Examiner.
- Removed the zero-byte `New Text Document.txt`; retained the project instructions and distinct audit/research/submission evidence.

## Submission refresh — 2026-10-15

- Used the existing narrated five-minute demo render from `artifacts/demo-video/`; copied it byte-for-byte to `submission/TwinSleuth-Demo.mp4` and uploaded that file to YouTube. The Devpost story, elevator pitch, thumbnail, and video link now match the submitted project.
- Added ignore rules for reproducible raw captures, QA frames, synthesized audio clips, and duplicate encoded outputs; kept the production scripts, storyboard, narration, captions, source graphics, and final submission video.
- Ran the required validation, typecheck, unit, build, E2E, and capture commands successfully on October 15, 2026.
