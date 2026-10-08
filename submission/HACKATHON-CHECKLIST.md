# TwinSleuth Hackathon Submission Checklist

Last reviewed: October 8, 2026.

Use this checklist before submitting TwinSleuth to Devpost. A checked item has repository evidence. An unchecked item still needs an external action or the submitter's confirmation.

## Eligibility and project

- [x] Working local project: the React practice bench, Fastify API, SQLite event ledger, deterministic diagnosis engine, and browser journey are implemented.
- [x] Core learning loop works locally: choose causes, forecast a probe, respond to the Skeptic when needed, run probes, cite evidence, submit a diagnosis, and receive a debrief.
- [x] Reproducible validation commands are documented in [README.md](../README.md).
- [ ] Confirm the project was created specifically during the hackathon period. This requires the submitter's own date and provenance confirmation.

## Devpost page

- [x] Project title available: **TwinSleuth**.
- [x] Short project description is ready in [SUBMISSION.md](SUBMISSION.md).
- [x] Longer product description and honest scope statements are ready in [README.md](../README.md) and [USER-GUIDE.md](../USER-GUIDE.md).
- [x] Technology list is derivable from [package.json](../package.json): React, TypeScript, Vite, Fastify, SQLite via better-sqlite3, LangChain/LangGraph, Zod, GSAP, Playwright, and axe-core.
- [x] Six current screenshots are available under [screenshots](screenshots/).
- [x] A local demo video is available at [twinsleuth-demo.webm](twinsleuth-demo.webm).
- [x] A 2:30 demo narration is ready in [DEMO-SCRIPT.md](DEMO-SCRIPT.md).
- [ ] Create the Devpost submission page and paste the title, description, technologies, screenshots, and video.
- [ ] Upload the final 2–5 minute demo video to the submission page or another permitted video host, then add its public URL to Devpost.
- [ ] Verify the uploaded video plays with audio, is between 2 and 5 minutes, and clearly explains the problem, the product, and the working flow.

## Source repository

- [x] Source code is present locally in this project directory.
- [ ] Create or select an accessible source repository and publish the project source.
- [ ] Add the accessible repository URL to Devpost.
- [ ] Confirm a judge can clone or browse the repository without requesting access.

The repository steps are intentionally unchecked: the standing project constraint forbids pushing or creating a repository unless the submitter changes that instruction.

## Compliance and attribution

- [x] Product documentation labels TwinSleuth as simulated practice, not a real industrial control or safety system.
- [x] The local demo and documentation do not claim a hosted deployment.
- [x] The application works in deterministic template mode without a model API key.
- [x] Private forecast data and hidden truth remain server-side until the flow permits disclosure.
- [ ] Review the licenses for every dependency and confirm the intended submission and hosting model complies with them.
- [ ] Confirm any optional model provider, FreeLLMPool proxy, and Devpost/video platform usage complies with their current terms, privacy requirements, and API rules.
- [ ] Confirm the submission contains no third-party code, assets, data, or claims that lack permission or attribution.
- [ ] Confirm the submitted source and generated assets comply with the hackathon's rules on AI-assisted development and tool usage.

## Functional evidence

- [x] `npm run validate:case` validates the diagnostic model and policy budget.
- [x] `npm run typecheck` verifies TypeScript compilation.
- [x] `npm test` exercises engine, service, agent, persistence, and artifact-privacy behavior. The live-provider smoke test is intentionally skipped without provider credentials.
- [x] `npm run build` produces a Vite production build.
- [x] `npm run test:e2e` checks the P1 → P3 → P4 diagnosis journey, laptop and phone layout, keyboard use, visible focus, target sizes, axe accessibility, and local SQLite-file denial.
- [x] `npm run capture:demo` regenerates the screenshots and deterministic WebM.
- [ ] Run the full command sequence once more immediately before submission and record the date, machine, and pass results in the Devpost draft or release notes.

## Judging-criteria evidence

| Criterion | Evidence ready | Final submission work |
|---|---|---|
| Innovation & Creativity | Learners must commit per-cause predictions before evidence is revealed; the Skeptic questions non-discriminating reasoning without access to hidden truth. | Explain this learning interaction plainly; do not claim novelty or proven learning impact without evidence. |
| Technical Complexity | Server-authoritative hidden state, deterministic scoring and policy solver, file-backed event ledger, structured LangGraph Skeptic and Examiner with validation/retry/fallback, privacy checks, and browser tests. | Mention only the components you can show in the repository and demo. |
| Functionality & Execution | Playable local case, responsive laptop/phone interface, keyboard flow, accessibility checks, test coverage, deterministic demo capture. | Run the clean final verification sequence and use the refreshed screenshots. |
| Presentation & Clarity | 2:30 script, six screenshots, local WebM, submission brief, and user guide. | Record or upload the final narrated demo, then ensure its first minute states the problem and its last minute shows the debrief. |

## Final pre-submit pass

- [ ] Repository URL opens in an incognito browser or for a collaborator without special access.
- [ ] Devpost title, description, technologies, screenshots, repository URL, and video URL are all present.
- [ ] Video duration is 2–5 minutes and it demonstrates the live working flow.
- [ ] All claims in the Devpost description match the repository and demo.
- [ ] Required licensing, API, platform, and AI-tool compliance confirmations are complete.
- [ ] Submit before the event deadline and save a copy of the completed Devpost page.
