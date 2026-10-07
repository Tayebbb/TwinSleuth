# TwinSleuth

TwinSleuth is a local browser practice lab for diagnosing the simulated **PIN-9 Refusal** robot-arm case. The learner predicts what each probe will show, chooses tests under a 30-minute budget, responds to a Skeptic question, and defends a diagnosis with checked evidence claims.

This is simulated practice, not a digital twin, industrial safety system, or validated learning intervention. Hidden truth, observations, costs, and scores are server-owned. The browser receives only public case data and rows for probes that have run.

## Run locally

Requires Node.js 22+.

```sh
npm ci
npm run validate:case
npm run typecheck
npm test
npm run test:e2e
npm run dev
```

`npm run dev` starts the Fastify API at `http://127.0.0.1:5174` and the Vite browser at `http://127.0.0.1:5173`. The SQLite ledger is written to `twinsleuth.sqlite`; set `TWINSLEUTH_DB` to choose another path. Open the Vite URL in a browser.

`npm run test:e2e` starts the local API and Vite server with Playwright, then exercises the no-key P1 challenge through the P3/P4 observation loop and debrief in Chromium.

The default episode is template-mode and needs no Anthropic API key. The local API accepts only the Vite origin by default; set `UI_ORIGIN` explicitly if the UI is served from another origin.

## Case and demo path

Start with the stationary arm and `SAFETY_REJECT`, propose P1 and predict `Refused` for all four causes, answer the Skeptic, revise to P3, and run P3. Continue with P4 when it leaves H1/H4, then submit H1 and four structured evidence claims. The debrief shows the deterministic rubric, evidence rows, path cost versus the exact policy branch, and the agent trace. P1 is challenged but not run in this demo path.

The private forecast matrix lives only under `src/server/case-model/`. The React bundle imports the public catalog, not the private model.
