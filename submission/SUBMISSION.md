# TwinSleuth submission brief

TwinSleuth is a browser simulator for practicing fault diagnosis through two fictional cases: PIN-9 Refusal and Conveyor Index Drift. Learners predict test results before running probes, work within a simulated 30-minute budget, compare predictions with observations, and support a final diagnosis with evidence.

The five-minute demo follows a PIN-9 refusal case from the initial `SAFETY_REJECT` through prediction, a deterministic Skeptic challenge, P3 and P4 observations, an evidence-backed diagnosis, and a deterministic debrief. It demonstrates the server-owned truth boundary and the full no-provider path.

TwinSleuth is simulated practice, not a digital twin, industrial safety system, or validated learning intervention. It runs completely in deterministic template mode without a provider key; `GEMINI_API_KEY` enables optional structured Examiner feedback with one retry and deterministic fallback. The Skeptic remains deterministic.

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

The submitted demo is [TwinSleuth-Demo.mp4](TwinSleuth-Demo.mp4) (1920×1080, 5:00, with narration and burned-in captions); its caption file is [TwinSleuth-Demo.srt](TwinSleuth-Demo.srt). The same MP4 is uploaded to YouTube at [youtu.be/elNEaO97DTY](https://youtu.be/elNEaO97DTY) and embedded in the submitted [Devpost project](https://devpost.com/software/twinsleuth). Screenshots are in `submission/screenshots/`. `npm run capture:demo` generates a shorter local browser-capture preview for verification; it is not the submitted demo.
