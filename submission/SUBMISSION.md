# TwinSleuth submission brief

TwinSleuth is a browser simulator for practicing fault diagnosis through two fictional cases: PIN-9 Refusal and Conveyor Index Drift. Learners predict test results before running probes, work within a simulated 30-minute budget, compare predictions with observations, and support a final diagnosis with evidence.

## Reviewer screenshots

The submission gallery highlights the learning loop, checked debrief, and second case. Full-resolution files are kept in [`screenshots/`](screenshots/).

![TwinSleuth practice bench](https://raw.githubusercontent.com/Tayebbb/TwinSleuth/main/submission/screenshots/01-laptop-bench.png)

![Skeptic challenges an uninformative prediction](https://raw.githubusercontent.com/Tayebbb/TwinSleuth/main/submission/screenshots/02-skeptic-challenge.png)

![Optional Gemini tutor gives a general lesson after a deterministic reasoning signal](https://raw.githubusercontent.com/Tayebbb/TwinSleuth/main/submission/screenshots/08-ai-tutor.png)

![Evidence-based debrief and score breakdown](https://raw.githubusercontent.com/Tayebbb/TwinSleuth/main/submission/screenshots/05-debrief.png)

![Second playable case: Conveyor Index Drift](https://raw.githubusercontent.com/Tayebbb/TwinSleuth/main/submission/screenshots/07-conveyor-case.png)

The five-minute demo follows a PIN-9 refusal case from the initial `SAFETY_REJECT` through prediction, a deterministic Skeptic challenge, a live Gemini Tutor interaction, P3 and P4 observations, an evidence-backed diagnosis, and a deterministic debrief. It demonstrates the server-owned truth boundary and the full no-provider path. The optional, learner-opened AI Tutor teaches one general diagnostic skill and asks an unscored reflection question after a deterministic reasoning signal.

TwinSleuth is simulated practice, not a digital twin, industrial safety system, or validated learning intervention. It runs completely in deterministic template mode without a provider key. `GEMINI_API_KEY` enables optional structured Gemini Tutor and Examiner feedback; the Tutor has a six-second, one-attempt budget and immediately shows a clearly labeled curated lesson when inference is unavailable. It receives only a server-selected general skill tag, never case data, forecasts, scores, learner text, or hidden truth. The Skeptic remains deterministic.

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

The submitted demo is [TwinSleuth-Demo.mp4](TwinSleuth-Demo.mp4) (1920×1080, 5:00, with narration and burned-in captions); its caption file is [TwinSleuth-Demo.srt](TwinSleuth-Demo.srt). The same MP4 is uploaded to YouTube at [youtu.be/woYQCqpaO-Y](https://youtu.be/woYQCqpaO-Y) and embedded in the submitted [Devpost project](https://devpost.com/software/twinsleuth). Screenshots are in `screenshots/`; `npm run capture:demo` regenerates them.
