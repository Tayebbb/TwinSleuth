import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: process.env.CAPTURE_DEMO ? [] : ["**/capture/**"],
  outputDir: process.env.CAPTURE_DEMO ? "submission/capture" : "test-results",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    video: process.env.CAPTURE_DEMO ? "on" : "off",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", DEMO_TRUTH: "H1", TWINSLEUTH_DB: ":memory:" },
  },
});
