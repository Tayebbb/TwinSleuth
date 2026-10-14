# Demo video verification report

Checked 14 October 2026. This report applies to the current `demo.mp4` and matching `captions.srt`.

## Output

- MP4: 300.000 seconds; H.264; 1920×1080; 30/1 fps; 9,000 frames; AAC-LC stereo at 48 kHz. FFprobe reports both streams and the container at 300.000 seconds.
- English captions are burned into the video; the matching sidecar SRT contains 64 cues aligned to Kokoro's word-level timestamps. All 733 narration words match the cue text in order. Automated checks found no zero-length, reversed, out-of-range, or missing cues.
- Nine viewport and supporting stills are in `screenshots/`. Final-render frames at 2, 5.2, 75, 150, 205, and 288 seconds are in `qa/first-viewer-*.png` and record the first-viewer clarity and subtitle-placement review.
- The opening slate names TwinSleuth, the audience, and the predict/test/defend loop, then fades to the loaded application. The ending holds the project name, repository address, and simulator scope. A visible cursor ring is synthesized because Playwright does not record the operating-system pointer.

## Demo path and claims

The capture uses the local no-provider workflow. It starts with P1, revises to P3 after the deterministic Skeptic challenge, runs P3 and P4, and finishes with an H1 diagnosis, four evidence claims, and the deterministic debrief. The selected simulation gives a 100/100 score and a 15-minute path matching its best feasible policy branch. This is a claim about this authored case only.

The server-side action and budget rules, private case model, deterministic candidate/scoring logic, event ledger, and optional post-lock Examiner wording were reviewed against source. Technical narration was corrected to attribute run-rule enforcement and private observations to the server service, and candidate/scoring logic to the deterministic engine. The Skeptic line now describes its actual inputs as the submitted forecast and current public state.

## Local checks

The required repository verification commands all passed:

- `npm ci`
- `npm run validate:case`
- `npm run typecheck`
- `npm test` — 64 tests passed
- `npm run build`
- `npm run test:e2e` — 14 tests passed
- `npm run capture:demo`

The capture command was run in a disposable repository copy to preserve existing tracked submission screenshots and video. The production capture itself used an in-memory database, fixed demo truth H1, no Gemini key, and localhost. The capture script found no browser console or page errors.

## Media QA and limits

The final encoded frames at 2, 5.2, 75, 150, 205, and 288 seconds were reviewed. Captions use 36 px bold type with a translucent dark backing for stronger contrast. The opening slate fades over the live recording during its first five seconds. Two gradual 10% punch-ins focus on the prediction panel and P4 observation panel. Captions sit in open screen areas during the workflow and debrief, keeping the test controls and score row visible. The initial blank frame was removed by trimming the recording startup. A complete FFmpeg decode pass of the final MP4 completed without errors.

Narration uses the locally synthesized Kokoro-82M `af_heart` voice at speed 1.15. Kokoro timestamps align the spoken words; the separate SRT preserves the original written labels and punctuation. All seven clips fit their storyboard slots. The 24 kHz mono PCM clips are mixed to 48 kHz stereo AAC; the final mix measures −16.4 LUFS integrated and −3.8 dBFS true peak, with no clipping. The model weights are Apache 2.0 and the ONNX wrapper is MIT licensed ([model card](https://huggingface.co/hexgrad/Kokoro-82M), [ONNX runtime](https://github.com/thewh1teagle/kokoro-onnx)). This neural voice is a substantial upgrade from the previous SAPI voice, but the final track still needs a human listening and pronunciation review. There is no music bed.

The UI and measurements are simulated. The video does not certify real equipment, a public deployment, safety, or learning outcomes.

## Submission status and remaining checks

- Submitted to [Next Byte Hacks V5](https://next-byte-hacks-v5.devpost.com/) on October 15, 2026. The five-minute demo is hosted as an unlisted [YouTube video](https://youtu.be/elNEaO97DTY) and linked from the [Devpost project](https://devpost.com/software/twinsleuth). The MP4 and YouTube editor report 05:00; YouTube's content list rounds the length to 5:01.
- The [event overview](https://next-byte-hacks-v5.devpost.com/) says 1–3 minutes, while the [rules](https://next-byte-hacks-v5.devpost.com/rules) say 2–5 minutes. The submitted video follows the rules-page limit; ask the organizer which limit governs if clarification is available.
- The public [GitHub repository](https://github.com/Tayebbb/TwinSleuth) was accessible when checked, but it has no `LICENSE`, `COPYING`, or `NOTICE` file. Confirm provenance and licensing/dependency terms before further distribution. The first visible commit is dated October 8; the submitter separately confirmed project eligibility and event-period creation.
- The event overview and rules differ on age wording and judging categories. Eligibility was confirmed by the submitter; keep this discrepancy in mind if organizer clarification becomes available.

Sources and date-specific details are listed in `research-notes.md`.
