# TwinSleuth Hackathon Submission Checklist

Last reviewed: October 15, 2026.

Use this checklist to track TwinSleuth's submission evidence. A checked item has repository evidence or submitter confirmation. An unchecked item still needs an external action or confirmation.

## Eligibility and project

- [x] Working local project: the React practice bench, Fastify API, SQLite event ledger, deterministic diagnosis engine, and browser journey are implemented.
- [x] Core learning loop works locally: choose causes, forecast a probe, respond to the Skeptic when needed, run probes, cite evidence, submit a diagnosis, and receive a debrief.
- [x] Reproducible validation commands are documented in [README.md](../README.md).
- [ ] Confirm eligibility with the submitter and organizers: the event overview and rules differ on age/student requirements, and the submitter has not confirmed when project work began.

## Devpost page

- [x] Project title available: **TwinSleuth**.
- [x] Short project description is ready in [SUBMISSION.md](SUBMISSION.md).
- [x] Longer product description and honest scope statements are ready in [README.md](../README.md) and [USER-GUIDE.md](../USER-GUIDE.md).
- [x] Technology list is derivable from [package.json](../package.json): React, TypeScript, Vite, Fastify, SQLite via better-sqlite3, LangGraph (post-lock Examiner only), Zod, GSAP, Playwright, and axe-core. Optional Examiner requests Gemini through the Google Generative Language API.
- [x] Seven current screenshots are available under [screenshots](screenshots/), including a clean Conveyor Index Drift case view.
- [x] The final narrated five-minute demo is available at [TwinSleuth-Demo.mp4](TwinSleuth-Demo.mp4), with captions at [TwinSleuth-Demo.srt](TwinSleuth-Demo.srt).
- [x] Demo narration and storyboard are documented in [DEMO-SCRIPT.md](DEMO-SCRIPT.md) and [`../artifacts/demo-video/`](../artifacts/demo-video/).
- [x] Submitted Devpost page includes the project story, technology tags, screenshots, source link, and video.
- [x] Uploaded the final demo to YouTube as an unlisted video and linked it in Devpost: [youtu.be/elNEaO97DTY](https://youtu.be/elNEaO97DTY).
- [x] Verified the unlisted YouTube demo has narration and captions and shows the complete P1 → P3 → P4 diagnosis and debrief. The YouTube editor displays 5:00 after trimming the ending to 4:59:06 at 30 fps.

## Source repository

- [x] Source code is present locally in this project directory.
- [x] Source repository published: [github.com/Tayebbb/TwinSleuth](https://github.com/Tayebbb/TwinSleuth).
- [x] Added the source repository URL to Devpost.
- [x] Confirmed the repository is public at [github.com/Tayebbb/TwinSleuth](https://github.com/Tayebbb/TwinSleuth).

## Compliance and attribution

- [x] Product documentation labels TwinSleuth as simulated practice, not a real industrial control or safety system.
- [x] The local demo and documentation do not claim a hosted deployment.
- [x] The application works in deterministic template mode without a model API key.
- [x] Private forecast data and hidden truth remain server-side until the flow permits disclosure.
- [ ] Review the licenses for every dependency and confirm the intended submission and hosting model complies with them.
- [ ] Confirm optional Gemini provider and Devpost/video platform usage complies with their current terms, privacy requirements, and API rules.
- [ ] Confirm the submission contains no third-party code, assets, data, or claims that lack permission or attribution.
- [ ] Confirm the submitted source and generated assets comply with the hackathon's rules on AI-assisted development and tool usage.

## Functional evidence

- [x] `npm run validate:case` validates the diagnostic model and policy budget.
- [x] `npm run typecheck` verifies TypeScript compilation.
- [x] `npm test` exercises engine, service, agent, persistence, and artifact-privacy behavior. Gemini adapter tests stub network calls; no real provider key is required.
- [x] `npm run build` produces a Vite production build.
- [x] `npm run test:e2e` checks the P1 → P3 → P4 diagnosis journey, laptop and phone layout, keyboard use, visible focus, target sizes, axe accessibility, and local SQLite-file denial.
- [x] `npm run capture:demo` regenerates the screenshots and deterministic WebM; the capture disables sticky positioning so full-page images do not repeat the header.
- [x] Full local verification run on Windows on October 15, 2026: `npm ci` (zero vulnerabilities reported), case validation, typecheck, unit tests, build, E2E tests, and deterministic demo capture all passed.
- [ ] Repeat the full verification sequence before any future release.

## Judging criteria

The [official rules](https://next-byte-hacks-v5.devpost.com/rules) list four equally weighted criteria. The [event overview](https://next-byte-hacks-v5.devpost.com/) instead lists Impact; ask organizers which page controls if they clarify.

| Criterion (rules page) | Evidence ready | Final submission work |
|---|---|---|
| Innovation & Creativity | Learners must commit per-cause predictions before evidence is revealed; the Skeptic questions non-discriminating reasoning without access to hidden truth. | Explain this learning interaction plainly; do not claim novelty or proven learning impact without evidence. |
| Technical Complexity | Server-authoritative hidden state, deterministic Skeptic, scoring and policy solver, file-backed event ledger, and optional post-lock LangGraph Examiner with schema validation/retry/fallback; privacy checks and browser tests. | Mention only the components you can show in the repository and demo. |
| Functionality & Execution | Two playable local cases, responsive laptop/phone interface, keyboard flow, accessibility checks, test coverage, deterministic demo capture. | Keep the verification record current and use clean screenshots. |
| Presentation & Clarity | Five-minute narrated demo with captions, submission screenshots, a worked example, and local run directions. | Keep the video, story, and repository claims aligned. |

## Final checks

- [x] Repository URL is public and opens without special access.
- [x] Devpost title, description, technologies, screenshots, repository URL, and video URL are present.
- [x] Video follows the working PIN-9 flow and is 5:00 in the local media metadata and YouTube editor.
- [x] Devpost claims match the repository and demo.
- [ ] Required licensing, API, platform, and AI-tool compliance confirmations are complete.
- [x] Submitted to the event before its deadline; the page remains editable until the deadline.

## Event-page discrepancies

The [rules page](https://next-byte-hacks-v5.devpost.com/rules) states a 2–5 minute demo, worldwide eligibility from age 13 (or the local minimum), and four equally weighted judging criteria. The [event overview](https://next-byte-hacks-v5.devpost.com/) states a 1–3 minute demo, student-only eligibility above the local age of majority, and Impact as its judging criterion. The submitted video is 5:00 per the rules page. Eligibility and the controlling criteria remain unconfirmed; do not represent them as verified.
