# TwinSleuth submission brief

TwinSleuth is a browser practice lab for the simulated PIN-9 robot-arm refusal. Learners commit per-cause predictions before choosing a maintenance test, spend a limited 30-minute diagnostic budget, and defend a diagnosis with evidence. A bounded LangGraph Skeptic challenges non-discriminating reasoning without seeing hidden truth or unrun model forecasts. After lock, deterministic code scores the episode and a bounded Examiner explains the checked claims.

The demo begins with a stationary arm and a pre-start `SAFETY_REJECT`. The learner proposes the uninformative P1 retry, receives a Skeptic challenge, revises to the balanced P3 test, then runs P4 to observe J2 stopping at 95 degrees. The debrief compares learner beliefs with the evidence-consistent timeline, shows path cost against the exact policy, checks four structured claims, and only then reveals the server-selected fault.

TwinSleuth is simulated practice, not a digital twin, industrial safety system, or validated learning intervention. It runs completely in labeled template mode without an Anthropic key; configured credentials enable structured-output Skeptic and Examiner responses with one retry and deterministic fallback.

## Local verification

```sh
npm ci
npm run validate:case
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run capture:demo
```

Screenshots are in `submission/screenshots/`; the deterministic local capture is `submission/twinsleuth-demo.webm`.
