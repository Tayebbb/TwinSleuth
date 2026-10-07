import { expect, test } from "@playwright/test";

test("plays the no-key P1 challenge through the debrief", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PIN-9 Refusal" })).toBeVisible();

  for (const hypothesis of ["H1", "H2", "H3", "H4"]) {
    await page.getByLabel(`Prediction for ${hypothesis}`).selectOption("refused");
  }
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await expect(page.getByText(/SKEPTIC · P1/)).toBeVisible();
  await page.getByRole("button", { name: "Revise" }).click();

  await page.getByRole("button", { name: /P3 Repeat|P3/ }).first().click();
  const p3 = { H1: "completed", H2: "refused", H3: "refused", H4: "completed" };
  for (const [hypothesis, outcome] of Object.entries(p3)) {
    await page.getByLabel(`Prediction for ${hypothesis}`).selectOption(outcome);
  }
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await expect(page.getByText(/SKEPTIC · P3/)).toBeVisible();
  await page.getByRole("button", { name: "Run anyway" }).click();
  await page.getByRole("button", { name: /Run P3/ }).click();
  await expect(page.getByText("MODEL PREDICTED: H1 Completed · H2 Refused · H3 Refused · H4 Completed")).toBeVisible();

  await page.getByRole("button", { name: /P4/ }).first().click();
  const p4 = { H1: "stopped-at-95", H2: "full-range", H3: "full-range", H4: "full-range" };
  for (const [hypothesis, outcome] of Object.entries(p4)) {
    await page.getByLabel(`Prediction for ${hypothesis}`).selectOption(outcome);
  }
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  const p4Skeptic = page.getByText(/SKEPTIC · P4/);
  const p4Run = page.getByRole("button", { name: /Run P4/ });
  await expect(p4Skeptic.or(p4Run)).toBeVisible();
  if (await p4Skeptic.isVisible()) {
    await page.getByRole("button", { name: "Run anyway" }).click();
  }
  await p4Run.click();
  await expect(page.getByText("MODEL PREDICTED: H1 Stopped at 95° · H2 Full range · H3 Full range · H4 Full range")).toBeVisible();

  await page.getByLabel("Justification").fill("P4 stopped at 95 degrees, supporting the tightened J2 limit.");
  for (const hypothesis of ["H1", "H2", "H3", "H4"]) {
    await page.getByLabel(`Evidence for ${hypothesis}`).selectOption({ index: 1 });
  }
  await page.getByRole("button", { name: "Lock diagnosis and score" }).click();
  await expect(page.getByRole("heading", { name: /Case evaluated/ })).toBeVisible();
  await expect(page.getByText("/ 100 points")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Checked evidence claims" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Truth revealed" })).toBeVisible();
  await page.getByText("Agent trace").click();
  await expect(page.locator("pre").filter({ hasText: "examiner · template" })).toBeVisible();
});
