import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const captureDir = join(process.cwd(), "submission", "capture");
rmSync(captureDir, { recursive: true, force: true });
mkdirSync(captureDir, { recursive: true });

const playwrightCli = join(process.cwd(), "node_modules", "@playwright", "test", "cli.js");
const result = spawnSync(process.execPath, [playwrightCli, "test", "e2e/capture/submission.spec.ts"], {
  cwd: process.cwd(),
  env: { ...process.env, CAPTURE_DEMO: "1" },
  stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

function findVideo(directory: string): string | undefined {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findVideo(path);
      if (nested) return nested;
    } else if (entry.name.endsWith(".webm")) {
      return path;
    }
  }
  return undefined;
}

const video = findVideo(captureDir);
if (!video) throw new Error("Playwright completed without producing a demo video.");
copyFileSync(video, join(process.cwd(), "submission", "twinsleuth-demo.webm"));
rmSync(captureDir, { recursive: true, force: true });
console.log("Saved submission/twinsleuth-demo.webm and current screenshots.");
