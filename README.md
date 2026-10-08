# TwinSleuth

TwinSleuth is a local browser practice lab for diagnosing the simulated **PIN-9 Refusal** robot-arm case. The learner predicts what each probe will show, chooses tests under a 30-minute budget, responds to a Skeptic question, and defends a diagnosis with checked evidence claims.

This is simulated practice, not a digital twin, industrial safety system, or validated learning intervention. Hidden truth, observations, costs, and scores are server-owned. The browser receives only public case data and rows for probes that have run.

For a learner-facing walkthrough of the case, controls, scoring, and local setup, see [USER-GUIDE.md](USER-GUIDE.md).

For the evidence-backed submission status and outstanding Devpost steps, see [submission/HACKATHON-CHECKLIST.md](submission/HACKATHON-CHECKLIST.md).

## Run locally

Requires Node.js 22+.

```sh
npm ci
npm run validate:case
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run capture:demo
npm run dev
```

To enable the learner-facing Gemini feedback, copy `.env.example` to `.env`, add your Gemini key as `GEMINI_API_KEY`, then run `npm run dev`. The `.env` file is ignored by Git and never sent to the browser.

`npm run dev` starts the Fastify API at `http://127.0.0.1:5174` and the Vite browser at `http://127.0.0.1:5173`. The SQLite ledger is written to `twinsleuth.sqlite`; set `TWINSLEUTH_DB` to choose another path. Open the Vite URL in a browser.

`npm run test:e2e` starts the local API and Vite server with Playwright, then exercises the no-key P1 challenge through the P3/P4 observation loop and debrief in Chromium.

The browser suite also verifies 1280×800 first-viewport fit, phone overflow, axe accessibility, keyboard operation, visible focus, 44px targets, and observation-specific arm states. `npm run capture:demo` regenerates the screenshots in `submission/screenshots/` and the local `submission/twinsleuth-demo.webm`.

The local API rejects cross-origin and non-JSON mutations, limits episode starts to 20 per client per minute, and caps each episode at 64 actions. SQLite episodes persist until the database file is removed; there is no automatic retention or multi-user session ownership. This is suitable for the local hackathon demo and should not be exposed as a public multi-user service without those controls.

The learner-facing Skeptic and Examiner use Gemini when `GEMINI_API_KEY` is set. Gemini defaults to `gemini-3.5-flash-lite`; set `GEMINI_MODEL` to choose another supported Gemini model. Keep the key server-side and start the API from a shell that has the variable set. Each request attempt times out after 20 seconds; invalid or unavailable model output falls back to deterministic feedback after at most two attempts.

FreeLLMPool is reserved for opt-in local provider tests. Start `freellmpool proxy`, set `FREELLMPOOL_ENABLED=1`, and optionally set `FREELLMPOOL_BASE_URL`, `FREELLMPOOL_API_KEY`, and `TWINSLEUTH_MODEL`. Run the live FreeLLMPool smoke test with `FREELLMPOOL_SMOKE=1`. It is never selected for learner-facing agent requests.

See `.env.example` for the required variables. The local API accepts only the Vite origin by default; set `UI_ORIGIN` explicitly if the UI is served from another origin.

## Case and demo path

Start with the stationary arm and `SAFETY_REJECT`, propose P1 and predict `Refused` for all four causes, answer the Skeptic, and choose **Try P3 instead**. The balanced P3 forecast runs directly without another Skeptic detour. Continue with P4 when P3 leaves H1/H4, then submit H1 and four structured evidence claims. The debrief shows the deterministic rubric, evidence rows, path cost versus the exact policy branch, and the agent trace. P1 is challenged but not run in this demo path.

The private forecast matrix lives only under `src/server/case-model/`. The React bundle imports the public catalog, not the private model.
