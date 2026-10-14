import { mkdirSync, rmSync } from "node:fs";
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
rmSync(captureDir, { recursive: true, force: true });
console.log("Saved current submission screenshots.");
