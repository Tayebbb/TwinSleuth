# TwinSleuth User Guide

TwinSleuth is a browser-based practice simulator for the **PIN-9 Refusal** case. You investigate why a simulated robot arm rejected a keypad move by tracking possible causes, predicting test results, running probes, and defending a diagnosis with evidence.

This is a learning simulation. It does not connect to or operate physical equipment, and its synthetic results are not industrial safety advice.

## Open the website

### Run it on your computer

1. Install Node.js 22 or newer.
2. Open a terminal in the project folder.
3. Install the project dependencies once with `npm ci`.
4. Start the local application with `npm run dev`.
5. Open `http://127.0.0.1:5173` in your browser. The API runs locally on port 5174.

Keep the terminal running while you use the site. Press Ctrl+C there when you want to stop the local application.

The site starts a practice episode automatically. If the browser cannot reach the local API, confirm the development process is still running and reload the page.

## The case

The arm was asked to press keypad sequence PIN 9-1-3. The controller returned `SAFETY_REJECT` before motion; the arm stayed still and the emergency stop is clear. The case provides maintenance notes and a colleague's suggestion to retry the sequence.

You have a **30-minute simulated service budget**. Four explanations are available:

- **H1 — J2 soft limit was tightened:** the joint may stop at 95° instead of its rated 120°.
- **H2 — Keypad frame offset is wrong:** the keypad may be outside the arm's geometric reach.
- **H3 — Stylus velocity cap is too low:** the heavier stylus may make a full-speed move invalid.
- **H4 — Safety zone overlaps keypad row 3:** a keep-out zone may block the bottom keypad row.

These are hypotheses to test, not facts about the hidden answer.

## Investigation workflow

### 1. Read the scene

Review the arm diagram, controller response, task, emergency-stop state, maintenance notes, and operator handoff. The diagram shows the current simulated arm state. It does not reveal the selected fault before evaluation.

### 2. Track possible causes

Use the checkboxes beside H1–H4 to mark which causes you still consider possible. The count shows how many remain in your working set. A checkbox records your reasoning; it does not prove or disprove a cause.

### 3. Choose a diagnostic probe

Select one of the six tests. Each test has a simulated cost:

| Probe | Test | Cost | Possible outcomes |
|---|---|---:|---|
| P1 | Repeat the same PIN motion at 100% speed | 5 min | Refused |
| P2 | Retry key 9 at 25% speed | 5 min | Refused, Completed |
| P3 | Press key 3 at 100% speed | 5 min | Refused, Completed |
| P4 | Slow-jog J2 through its rated range | 10 min | Stopped at 95°, Full range |
| P5 | Run an offline reach check for key 9 | 10 min | Reachable, Out of reach |
| P6 | Audit the safety zone | 15 min | Overlap, Clear |

Choose a test whose possible results could distinguish the causes you still consider plausible. The interface updates the forecast card when you select a probe.

### 4. Predict before running the test

For each of H1–H4, use the outcome menu to predict what that cause would imply for the selected test. Fill all four rows; **Commit prediction table** remains disabled until each row has an answer.

Committing records your predictions and locks those rows, keeping the on-screen table aligned with what was submitted. It does not run the test or disclose the result. If several causes receive the same prediction, the probe may not help distinguish them. If the Skeptic challenges the forecast, use **Revise to P3** or **Run anyway**; while the challenge is open, choose one of those actions before switching probes. After a probe runs, its original prediction stays visible if you select it again, and you can return to its result through the evidence ledger.

### 5. Respond to the Skeptic, if shown

The Skeptic appears when your prediction or belief choices leave an important ambiguity—for example, when every cause predicts the same result or when you rule out a cause that revealed evidence still supports.

- **Why this forecast was flagged** explains the trigger.
- **Revise to P3** revises the challenged P1 path to the key-3 test and clears the prediction rows so you can make a new forecast.
- **Run anyway** accepts the ambiguity and runs the already committed test.

The Skeptic asks about your reasoning. It does not reveal the hidden cause or score your diagnosis.

### 6. Run the probe and review evidence

After committing, choose **Run P…** to spend the displayed simulated time and receive the observation. The result appears in the **Evidence ledger**. Select an evidence row to review it.

The ledger compares:

- **Your forecast** — the predictions you committed before the test.
- **Model forecast** — the authored outcomes for the probe after it has run.
- **Observed result** — what the simulated test returned.

Unrun forecast rows remain hidden. The evidence ledger lets you compare predictions and observations without exposing future tests.

### 7. Defend your diagnosis

Open **Defend your diagnosis** when you are ready. After a probe, this section opens automatically. Complete:

1. **Most likely cause** — choose H1–H4.
2. **Confidence** — enter a value from 1 (tentative) to 5 (certain).
3. **Justification** — explain which observations support your choice and what rules out alternatives. This is required to submit.
4. **Evidence claims** — for each cause, choose whether the observation supports or rules it out, then cite an observation.

Choose **Lock diagnosis and score** to submit. This ends the episode and opens the debrief.

### 8. Read the debrief

The debrief includes the total score and its five deterministic components: diagnosis, evidence sufficiency, prediction accuracy, probe quality, and reasoning. It also shows checked evidence claims, your belief and evidence timelines, the cost of your path compared with the best policy branch, Examiner feedback, and the revealed server-selected cause.

The Examiner may provide model-generated or template feedback. It does not set the diagnosis or calculate the score. Expand **Agent trace** if you want to see whether feedback came from the model or a fallback.

Choose **Start a fresh episode** to begin again. The episode's hidden cause is selected and evaluated on the server; a new episode may produce a different case path.

## A guided example

The included demo uses a fixed H1 case so its recording is repeatable. It starts by forecasting **Refused** for all four causes on P1. Since that result would not separate causes, the Skeptic challenges the forecast. The demo then revises to P3 with:

| Cause | P3 forecast in the demo |
|---|---|
| H1 | Completed |
| H2 | Refused |
| H3 | Refused |
| H4 | Completed |

After P3, the demo tests the remaining H1/H4 ambiguity with P4. It predicts **Stopped at 95°** for H1 and **Full range** for H2–H4, then submits H1 with evidence citations. This is an example path for the fixed demo configuration, not a promise that every new episode has the same hidden cause or observations.

## Navigation and accessibility

- On a laptop, use the top links or the **Scope → Predict → Observe → Defend** progress rail to jump to a section.
- On a phone, the top section links are hidden to save space; use the progress rail and scroll through the work areas in order.
- Use Tab and Shift+Tab to move focus, Enter or Space to activate buttons and links, and the arrow keys to change select-menu choices. Focus is visibly outlined.
- The main workflow supports laptop and phone layouts, keyboard use, and reduced-motion preferences.

## Troubleshooting and limits

- **The page does not load:** keep `npm run dev` running and open `http://127.0.0.1:5173`. The API must also be available locally on port 5174.
- **Agent feedback is a template:** this is expected without an enabled local model proxy or when a model response is unavailable or invalid. The practice flow and deterministic score still work without a model credential.
- **You need a new attempt:** use **Start a fresh episode** after the debrief. Episode records are stored in the local SQLite database file and are not automatically deleted.
- **Scope:** the current product contains one synthetic PIN-9 case. It is a local hackathon MVP, not a hosted classroom or multi-user service. It has not been evaluated for learning outcomes and must not be used to control or diagnose real industrial equipment.

## Optional project checks and demo capture

From the project folder:

```sh
npm run validate:case
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run capture:demo
```

`npm run capture:demo` regenerates the screenshots in `submission/screenshots/` and the local video at `submission/twinsleuth-demo.webm`.
