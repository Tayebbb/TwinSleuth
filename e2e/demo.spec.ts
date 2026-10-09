import { expect, test } from "@playwright/test";

test("plays the no-key P1 challenge through the debrief", async ({ page }) => {
  let episodeStarts = 0;
  const idlePolls: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/episodes")) episodeStarts += 1;
    if (request.method() === "GET" && /\/api\/episodes\//.test(request.url())) idlePolls.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PIN-9 Refusal" })).toBeVisible();
  await expect(page.getByText("Keep the plausible causes open. Choose a test that could separate them.")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(episodeStarts).toBe(1);
  expect(idlePolls).toEqual([]);

  for (const hypothesis of ["H1", "H2", "H3", "H4"]) {
    await page.getByLabel(`Prediction for ${hypothesis}`).selectOption("refused");
  }
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await expect(page.getByText(/Skeptic check · P1/i)).toBeVisible();
  for (const hypothesis of ["H1", "H2", "H3", "H4"]) {
    await expect(page.getByLabel(`Prediction for ${hypothesis}`)).toBeDisabled();
  }
  await expect(page.getByRole("button", { name: /P3/ }).first()).toBeDisabled();
  await expect(page.getByText("Your prediction is saved. Choose whether to switch tests or run this one.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try P3 instead" }).click();
  await expect(page.getByLabel("Prediction for H1")).toBeEnabled();
  await expect(page.getByLabel("Prediction for H1")).toHaveValue("");

  await expect(page.getByRole("heading", { name: "Predict P3's result" })).toBeVisible();
  const p3 = { H1: "completed", H2: "refused", H3: "refused", H4: "completed" };
  for (const [hypothesis, outcome] of Object.entries(p3)) {
    await page.getByLabel(`Prediction for ${hypothesis}`).selectOption(outcome);
  }
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  const p3Run = page.getByRole("button", { name: /Run P3/ });
  for (const hypothesis of ["H1", "H2", "H3", "H4"]) {
    await expect(page.getByLabel(`Prediction for ${hypothesis}`)).toBeDisabled();
  }
  await expect(page.getByText(/Skeptic check · P3/i)).toHaveCount(0);
  await expect(p3Run).toBeVisible();
  await p3Run.click();
  await expect(page.getByText("MODEL PREDICTED: H1 Completed · H2 Refused · H3 Refused · H4 Completed")).toBeVisible();
  await expect(page.getByText("Compare each result with your prediction. Choose another test or defend the cause best supported by the evidence.")).toBeVisible();
  await expect(page.getByTestId("arm-visualization")).toHaveAttribute("data-arm-state", "p3-key-3-completed");

  await page.getByRole("button", { name: /P4/ }).first().click();
  const p4 = { H1: "stopped-at-95", H2: "full-range", H3: "full-range", H4: "full-range" };
  for (const [hypothesis, outcome] of Object.entries(p4)) {
    await page.getByLabel(`Prediction for ${hypothesis}`).selectOption(outcome);
  }
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  const p4Skeptic = page.getByText(/Skeptic check · P4/i);
  const p4Run = page.getByRole("button", { name: /Run P4/ });
  await expect(p4Skeptic.or(p4Run)).toBeVisible();
  if (await p4Skeptic.isVisible()) {
    await page.getByRole("button", { name: "Run P4 anyway" }).click();
  }
  await p4Run.click();
  await expect(page.getByText("MODEL PREDICTED: H1 Stopped at 95° · H2 Full range · H3 Full range · H4 Full range")).toBeVisible();
  await expect(page.getByTestId("arm-visualization")).toHaveAttribute("data-arm-state", "j2-stopped-95");
  await expect(page.getByTestId("arm-visualization")).toHaveAttribute("aria-label", /J2 stopped at 95 degrees/);

  await page.getByRole("button", { name: /P3/ }).first().click();
  await expect(page.getByLabel("Prediction for H1")).toHaveValue("completed");
  await expect(page.getByLabel("Prediction for H1")).toBeDisabled();
  await expect(page.getByRole("link", { name: "Review its observation in the evidence ledger" })).toBeVisible();
  await page.getByRole("button", { name: /P4/ }).first().click();
  await expect(page.getByLabel("Prediction for H1")).toHaveValue("stopped-at-95");
  await expect(page.getByLabel("Prediction for H1")).toBeDisabled();

  await page.getByLabel("Justification").fill("P4 stopped at 95 degrees, supporting the tightened J2 limit.");
  for (const hypothesis of ["H1", "H2", "H3", "H4"]) {
    await page.getByLabel(`Evidence for ${hypothesis}`).selectOption({ index: 1 });
  }
  await page.getByRole("button", { name: "Lock diagnosis and score" }).click();
  await expect(page.getByRole("heading", { name: /Case evaluated/ })).toBeVisible();
  await expect(page.getByText("Your diagnosis has been scored. Review the evidence and debrief.")).toBeVisible();
  await expect(page.getByText("/ 100 points")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Checked evidence claims" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Truth revealed" })).toBeVisible();
  await page.getByText("Agent trace").click();
  await expect(page.locator("pre").filter({ hasText: /examiner · (model|fallback|template)/ })).toBeVisible();
  const settledPollCount = idlePolls.length;
  await page.waitForTimeout(1500);
  expect(idlePolls).toHaveLength(settledPollCount);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
