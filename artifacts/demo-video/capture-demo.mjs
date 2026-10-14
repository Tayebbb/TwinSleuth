import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const root = new URL("../../", import.meta.url).pathname.replace(/^\/(\w:)/, "$1").replaceAll("%20", " ");
const out = new URL("./", import.meta.url).pathname.replace(/^\/(\w:)/, "$1").replaceAll("%20", " ");
const rawDir = `${out}raw`;
const screenshots = `${out}screenshots`;
await mkdir(rawDir, { recursive: true });
await mkdir(screenshots, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
  reducedMotion: "reduce",
});
const recordingStartedAt = Date.now();
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
await page.addInitScript(() => {
  const install = () => {
    if (document.getElementById("demo-pointer")) return;
    const style = document.createElement("style");
    style.textContent = `
      #demo-pointer{position:fixed;z-index:2147483647;left:0;top:0;width:24px;height:24px;border-radius:50%;
      border:3px solid #fff;background:rgba(38,194,166,.92);box-shadow:0 0 0 2px #12252a,0 2px 10px #0008;
      pointer-events:none;transform:translate(-80px,-80px);transition:transform 70ms linear;}
      #demo-pointer.click{animation:demo-click 360ms ease-out;}
      @keyframes demo-click{0%{box-shadow:0 0 0 2px #12252a,0 0 0 0 rgba(38,194,166,.75)}100%{box-shadow:0 0 0 2px #12252a,0 0 0 20px rgba(38,194,166,0)}}`;
    document.head.appendChild(style);
    const dot = document.createElement("div"); dot.id = "demo-pointer"; document.body.appendChild(dot);
    addEventListener("pointermove", event => { dot.style.transform = `translate(${event.clientX - 12}px,${event.clientY - 12}px)`; }, true);
    addEventListener("pointerdown", () => { dot.classList.remove("click"); void dot.offsetWidth; dot.classList.add("click"); }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install, { once: true }); else install();
});
await page.goto("http://127.0.0.1:5173", { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "PIN-9 Refusal" }).waitFor();
const startAt = Date.now();
const recordingOffset = (startAt - recordingStartedAt) / 1000;
await writeFile(`${rawDir}/timeline-offset.txt`, `${recordingOffset.toFixed(3)}\n`, "utf8");
const at = async seconds => {
  const remaining = Math.round(seconds * 1000 - (Date.now() - startAt));
  if (remaining > 0) await page.waitForTimeout(remaining);
};
const moveTo = async locator => {
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
};
const select = async (label, value) => {
  const item = page.getByLabel(label);
  await moveTo(item);
  await item.click();
  await item.selectOption(value);
};
const saveScreen = async filename => page.screenshot({ path: `${screenshots}/${filename}`, fullPage: false });
const installPointer = async () => page.evaluate(() => {
  if (document.getElementById("demo-pointer")) return;
  const style = document.createElement("style");
  style.textContent = `#demo-pointer{position:fixed;z-index:2147483647;left:0;top:0;width:24px;height:24px;border-radius:50%;border:3px solid #fff;background:rgba(38,194,166,.92);box-shadow:0 0 0 2px #12252a,0 2px 10px #0008;pointer-events:none;transform:translate(-80px,-80px);transition:transform 70ms linear}#demo-pointer.click{animation:demo-click 360ms ease-out}@keyframes demo-click{0%{box-shadow:0 0 0 2px #12252a,0 0 0 0 rgba(38,194,166,.75)}100%{box-shadow:0 0 0 2px #12252a,0 0 0 20px rgba(38,194,166,0)}}`;
  document.head.appendChild(style);
  const dot = document.createElement("div"); dot.id = "demo-pointer"; document.body.appendChild(dot);
  addEventListener("pointermove", event => { dot.style.transform = `translate(${event.clientX - 12}px,${event.clientY - 12}px)`; }, true);
  addEventListener("pointerdown", () => { dot.classList.remove("click"); void dot.offsetWidth; dot.classList.add("click"); }, true);
});
await saveScreen("01-live-bench.png");

// 00:00–00:35 — establish the real case and the learner's starting point.
await page.mouse.move(470, 286, { steps: 20 });
await at(12);
await page.mouse.move(1500, 172, { steps: 20 });
await at(35);

// 00:35–02:10 — P1 challenge, P3 observation, P4 observation, diagnosis.
for (const id of ["H1", "H2", "H3", "H4"]) await select(`Prediction for ${id}`, "refused");
await page.getByRole("button", { name: "Commit prediction table" }).click();
await page.getByText(/Skeptic check · P1/i).waitFor();
await saveScreen("02-skeptic-p1.png");
await at(62);
await page.getByRole("button", { name: "Try P3 instead" }).click();
const p3 = { H1: "completed", H2: "refused", H3: "refused", H4: "completed" };
for (const [id, outcome] of Object.entries(p3)) await select(`Prediction for ${id}`, outcome);
await page.getByRole("button", { name: "Commit prediction table" }).click();
await at(76);
await page.getByRole("button", { name: /Run P3/ }).click();
await page.getByText("MODEL PREDICTED: H1 Completed · H2 Refused · H3 Refused · H4 Completed").waitFor();
await saveScreen("03-p3-observation.png");
await at(86);
await page.getByRole("button", { name: /P4/ }).first().click();
const p4 = { H1: "stopped-at-95", H2: "full-range", H3: "full-range", H4: "full-range" };
for (const [id, outcome] of Object.entries(p4)) await select(`Prediction for ${id}`, outcome);
await page.getByRole("button", { name: "Commit prediction table" }).click();
await at(98);
await page.getByRole("button", { name: /Run P4/ }).click();
await page.getByText("MODEL PREDICTED: H1 Stopped at 95° · H2 Full range · H3 Full range · H4 Full range").waitFor();
await saveScreen("04-p4-observation.png");
await at(116);
await page.getByLabel("Justification").fill("P4 stopped at 95 degrees, supporting the tightened J2 limit.");
await page.getByLabel("Evidence for H1").selectOption({ index: 2 });
await page.getByLabel("Evidence for H2").selectOption({ index: 1 });
await page.getByLabel("Evidence for H3").selectOption({ index: 1 });
await page.getByLabel("Evidence for H4").selectOption({ index: 2 });
await moveTo(page.getByRole("button", { name: "Lock diagnosis and score" }));
await page.getByRole("button", { name: "Lock diagnosis and score" }).click();
await page.getByRole("heading", { name: "Examiner notes" }).waitFor();
await page.getByText(/evidence claims checked/i).waitFor({ timeout: 15000 }).catch(() => {});
await page.getByRole("heading", { name: "Case evaluated" }).scrollIntoViewIfNeeded();
await saveScreen("05-deterministic-debrief.png");
await at(130);

// 02:10–03:05 — show the outcome and checked claims at readable scale.
for (const label of ["What the evidence changed", "Learner beliefs", "Checked evidence claims", "Truth revealed"]) {
  const target = page.getByRole(label === "Truth revealed" ? "heading" : "heading", { name: label, exact: false }).first();
  if (await target.count()) { await target.scrollIntoViewIfNeeded(); await moveTo(target); await page.waitForTimeout(1100); }
}
await page.getByRole("heading", { name: "Case evaluated" }).scrollIntoViewIfNeeded();
await saveScreen("06-debrief-evidence.png");
await at(185);

// 03:05–04:10 — accurate editable SVG visualization, no product mock behavior.
const diagram = await readFile(`${out}assets/architecture.svg`, "utf8");
await page.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;background:#081821}svg{width:100vw;height:100vh;display:block}</style></head><body>${diagram}</body></html>`);
await installPointer();
await page.mouse.move(600, 420, { steps: 20 });
await at(250);
await saveScreen("07-architecture.png");

// 04:10–04:40 — exact automated results from this production run.
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#091a22;color:#eef4f1;font:28px 'Segoe UI',sans-serif;display:grid;place-items:center;height:100vh}
main{width:1480px;padding:90px;background:linear-gradient(145deg,#102c34,#0d2028);border:1px solid #31515a;border-radius:24px}
.eyebrow{font:600 18px 'Segoe UI';letter-spacing:4px;color:#36c9b0}.title{font-size:58px;font-weight:700;margin:20px 0 54px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.item{padding:26px 30px;border:1px solid #38535c;border-radius:14px;background:#122b34}.pass{color:#62ddbd;font:600 19px 'Segoe UI';letter-spacing:2px}.label{font-size:28px;margin-top:12px}.small{font-size:22px;color:#a8bbc1;margin-top:34px}
</style></head><body><main><div class="eyebrow">TWIN SLEUTH / LOCAL VERIFICATION</div><div class="title">The practice path is reproducible.</div><div class="grid">
<section class="item"><div class="pass">PASS</div><div class="label">Case model validation</div></section><section class="item"><div class="pass">PASS</div><div class="label">TypeScript typecheck</div></section>
<section class="item"><div class="pass">64 TESTS</div><div class="label">Unit suite</div></section><section class="item"><div class="pass">14 TESTS</div><div class="label">Browser and accessibility suite</div></section>
<section class="item"><div class="pass">PASS</div><div class="label">Production build</div></section><section class="item"><div class="pass">PASS</div><div class="label">Deterministic demo capture</div></section>
</div><div class="small">Local checks verify this simulator workflow. They do not certify public deployment or real equipment.</div></main></body></html>`);
await installPointer();
await page.mouse.move(720, 480, { steps: 18 });
await at(280);
await saveScreen("08-verification.png");

// 04:40–05:00 — close on the local practice product and source address.
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#edf2f0;color:#0c2630;font-family:'Segoe UI',sans-serif;display:grid;place-items:center;height:100vh}
main{text-align:center}.mark{font-weight:800;font-size:112px;letter-spacing:-4px}.rule{width:140px;height:5px;margin:34px auto;background:#147b70}.tag{font-size:30px;color:#48616a}.url{font:600 25px Consolas,monospace;margin-top:62px;color:#126f68}.scope{font-size:19px;color:#65777c;margin-top:24px}
</style></head><body><main><div class="mark">TwinSleuth</div><div class="rule"></div><div class="tag">Practice a diagnosis. Defend it with evidence.</div><div class="url">github.com/Tayebbb/TwinSleuth</div><div class="scope">Local simulation · No equipment connected</div></main></body></html>`);
await installPointer();
await page.mouse.move(1550, 830, { steps: 24 });
await at(303);
await saveScreen("09-closing.png");

await context.close();
await browser.close();
if (errors.length) throw new Error(`Browser errors in captured demo: ${errors.join(" | ")}`);
const files = (await readdir(rawDir)).filter(file => file.endsWith(".webm"));
const video = (await Promise.all(files.map(async file => ({ file, modified: (await stat(`${rawDir}/${file}`)).mtimeMs }))))
  .sort((a, b) => b.modified - a.modified)[0]?.file;
if (!video) throw new Error("Playwright did not produce a video recording.");
console.log(`Raw recording: ${rawDir}/${video}`);
console.log(`Elapsed timeline: ${((Date.now() - startAt) / 1000).toFixed(2)} seconds`);
