# TwinSleuth

### Practice fault diagnosis by predicting first, testing under a budget, and defending a diagnosis with evidence.

[**Try TwinSleuth online**](https://twin-sleuth.vercel.app) · [**Watch the 5-minute demo**](https://youtu.be/elNEaO97DTY) · [**Open the Devpost submission**](https://devpost.com/software/twinsleuth) · [Learner guide](USER-GUIDE.md)

TwinSleuth is a browser practice lab with two fictional maintenance cases. It gives technical learners a place to practice choosing tests and reasoning from evidence. It is not a digital twin, an industrial control system, or a validated training intervention; it does not connect to real equipment.

The hosted practice bench uses Neon Postgres for durable episodes and needs no account or API key for its deterministic learner flow.

![TwinSleuth practice bench showing causes, test predictions, and the evidence workflow](submission/screenshots/01-laptop-bench.png)

## What a learner does

The learner has a simulated 30-minute budget. Before a probe runs, they record what each possible cause predicts. An uninformative forecast can trigger the deterministic Skeptic. After the test, the learner compares predictions with the observation, cites evidence for each cause, and submits a diagnosis. A deterministic debrief checks the claims and shows the score breakdown.

```mermaid
flowchart LR
    A[Choose a fictional case] --> B[Predict each cause's test result]
    B --> C[Commit forecast]
    C --> D{Can this test separate causes?}
    D -- No --> E[Skeptic explains the ambiguity]
    E --> F[Revise the forecast or run anyway]
    D -- Yes --> G[Run probe and spend simulated time]
    F --> G
    G --> H[Compare prediction with observation]
    H --> T[Optional AI tutor teaches a general reasoning skill]
    T --> I[Cite evidence and defend diagnosis]
    I --> J[Deterministic score and debrief]
```

## Cases and evidence

| Case | Practice focus | What the demo shows |
|---|---|---|
| **PIN-9 Refusal** | Separate four possible causes with six probes. | A repeated test is uninformative; P3 and P4 narrow the evidence to H1. |
| **Conveyor Index Drift** | Separate four possible causes with five probes. | A second, independent case with its own predictions and diagnostic tests. |

The submitted walkthrough follows the fixed PIN-9 path. Screenshots below show the Skeptic challenge, the checked debrief, and the second case.

![Skeptic explains why the first forecast cannot narrow the causes](submission/screenshots/02-skeptic-challenge.png)

![Optional Gemini tutor gives a general lesson after the deterministic Skeptic signal](submission/screenshots/08-ai-tutor.png)

![Debrief score breakdown and evidence claims](submission/screenshots/05-debrief.png)

![Conveyor Index Drift practice case](submission/screenshots/07-conveyor-case.png)

## How it is built

The server keeps the selected fault and unrun forecasts private. Deterministic code owns probe outcomes, evidence validity, the remaining candidate set, budget, diagnosis, and score. The browser only receives public case data, committed forecasts, and observations after a probe has run. Local runs use SQLite; the hosted Vercel API uses Neon Postgres for durable episode and event storage.

```mermaid
flowchart LR
    Learner --> UI[React + TypeScript]
    UI -->|learner actions| API[Fastify API]
    API --> Episode[Episode service]
    Episode --> Engine[Deterministic engine]
    Episode --> Models[Private case models]
    Episode --> Local[(Local SQLite ledger)]
    Episode --> Hosted[(Neon Postgres ledger)]
    Episode -->|public projection| UI
    Episode -->|after diagnosis| Examiner[Optional Gemini Examiner]
    Examiner -->|validated advisory text only| UI
    Episode -->|skill tag only| Tutor[Optional Gemini AI Tutor]
    Tutor -->|validated lesson or curated fallback| UI
```

The complete practice flow works without an AI provider or API key. The Skeptic is deterministic. The optional Gemini AI Tutor appears after a deterministic reasoning signal and teaches a general skill without receiving case evidence, forecasts, diagnoses, scores, or learner text. The post-diagnosis Examiner and Tutor can only provide validated advisory text; neither can change truth, diagnosis, score, or episode state. If Gemini is unavailable, the Tutor shows a clearly labeled curated lesson. The five-minute demo includes a live Gemini tutor interaction.

## Run locally

Requires **Node.js 22 or newer**.

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The local API runs on port 5174. No provider key is needed for the practice loop.

## Deploy

Vercel builds the Vite client and serves the Fastify API from `api/`. Neon Postgres supplies durable hosted storage through the server-side `DATABASE_URL` environment variable. The Vercel Neon integration manages that secret; never commit it. Gemini-powered Tutor and Examiner features remain disabled unless `GEMINI_API_KEY` is configured.

Optional Tutor and Examiner feedback use `GEMINI_API_KEY`. Copy `.env.example` to `.env` and set the key there; it stays server-side and is ignored by Git.

## Verify the project

```sh
npm run validate:case
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run capture:demo
```

The checks cover case distinguishability, scoring and event replay, privacy boundaries, the no-key learner journey, responsive behavior, keyboard use, and accessibility. Demo capture regenerates the seven screenshots in `submission/screenshots/`.

## Navigate the repository

| Path | Purpose |
|---|---|
| `src/engine/` | Deterministic diagnosis, policy, and scoring. |
| `src/server/` | API, episode ledger, private case models, and optional Examiner. |
| `src/web/` | Learner interface and design tokens. |
| `e2e/` | Browser, privacy, accessibility, and screenshot-capture coverage. |
| `submission/` | Submitted MP4, captions, screenshots, and reviewer brief. |
| `USER-GUIDE.md` | Detailed case walkthrough and control reference. |

See [submission/SUBMISSION.md](submission/SUBMISSION.md) for the demo, Devpost link, and screenshot set. The five-minute demo is also included at [submission/TwinSleuth-Demo.mp4](submission/TwinSleuth-Demo.mp4).
