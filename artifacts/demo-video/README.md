# TwinSleuth demo-video production

Final source render: `demo.mp4`, 1920×1080, H.264, 30 fps, AAC, 05:00. The submitted copy is `../../submission/TwinSleuth-Demo.mp4`, with sidecar captions at `../../submission/TwinSleuth-Demo.srt`. The video follows the deterministic no-key PIN-9 flow and uses a synchronized cursor overlay on the genuine browser capture. The SVG in `assets/architecture.svg` is editable source for the verified data-flow visual.

## Files

- `demo.mp4` — local generated render (ignored by Git); the versioned submission copy is in `../../submission/`.
- `captions.srt` — separate English captions timed from Kokoro model word timings; all narration words are retained in order.
- `captions.ass` — styled caption track used for the burned-in display.
- `assets/title-card.png` — opening slate introducing the audience and learning loop; the renderer fades it over the live footage.
- `narration.md`, `storyboard.md`, `research-notes.md` — final script, timed scenes, and linked research.
- `screenshots/` — viewport stills captured from the running application and supporting diagrams.
- `assets/audio/` — seven source narration clips synthesized locally from `narration.md` using Kokoro-82M (`af_heart`) at speed 1.15. `speech-timings.json` records model word timings for subtitle alignment.
- `raw/` — unedited Playwright WebM capture.
- `capture-demo.mjs`, `setup-kokoro.ps1`, `generate-audio-kokoro.py`, `generate-audio.ps1`, `generate-captions.py`, `render-video.ps1`, `produce-video.ps1` — capture, narration, caption, and render workflow.
- `verification-report.md` — measured output details and QA limitations.

## Reproduce on Windows

Requires Node.js 22+, the repo's installed dependencies and Playwright Chromium, Python 3, PowerShell 7, FFmpeg/FFprobe with H.264 and libass support. Kokoro is installed in its own local Python environment and makes no API calls.

From the repository root, install dependencies, then run the producer:

```powershell
npm ci
pwsh -NoProfile -ExecutionPolicy Bypass -File .\artifacts\demo-video\setup-kokoro.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File .\artifacts\demo-video\produce-video.ps1
```

The script starts a local dev server, records the workflow, synthesizes narration, generates captions, and renders/inspects the MP4. It sets demo truth to H1, uses an in-memory database, clears the Gemini key for this process, binds only to the local app, and makes no hosted requests. Individual steps can also be run separately with the scripts named above if the app is already running.

The first setup downloads the 82M open-weights English model and voice pack (about 340 MiB total) from the Kokoro ONNX project. Synthesis runs locally; CPU rendering takes several minutes. The app capture runs for about five minutes to preserve natural timing. The export uses 9,000 CFR video frames and AAC with a 300-second edit endpoint. After capture and narration generation, `render-video.ps1` can re-render from the latest raw capture without replaying the app flow. If regenerating, review the new MP4 and SRT; do not assume an older QA report applies to a changed render.

## Scope

This is a screen-recorded walkthrough of a local practice simulator. The arm and readings are authored simulation data. No physical equipment is connected, and the video does not present the product as a digital twin, industrial safety system, or validated learning intervention. The duration conflict on the event pages and provenance checks are documented in `verification-report.md`.

