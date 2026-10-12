import { expect, test } from "@playwright/test";

test("starts and completes the Conveyor Index Drift case without exposing its private model early", async ({ page }) => {
  await page.goto("/");
  const selector = page.getByLabel("Practice case");
  await expect(selector).toHaveCount(1);
  await selector.selectOption("conveyor-index-drift");
  await page.getByRole("button", { name: "Start selected case" }).click();
  await expect(page.getByRole("heading", { name: "Conveyor Index Drift" })).toBeVisible();
  await expect(page.getByTestId("beliefs-probes-panel").getByText("Encoder scale is misconfigured")).toBeVisible();
  await expect(page.locator("main")).not.toContainText('"C1":"count-low"');

  await page.getByRole("button", { name: /C-P3/ }).first().click();
  for (const [cause, outcome] of Object.entries({ C1: "count-low", C2: "count-matches", C3: "count-matches", C4: "count-matches" })) {
    await page.getByLabel(`Prediction for ${cause}`).selectOption(outcome);
  }
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  const challenge = page.getByText(/Skeptic check · C-P3/);
  await expect(challenge).toBeVisible();
  await page.getByRole("button", { name: "Run C-P3 anyway" }).click();
  await page.getByRole("button", { name: /^Run C-P3/ }).click();
  await expect(page.getByRole("heading", { name: "Evidence ledger" })).toBeVisible();

  await page.getByLabel("Justification").fill("The recorded station-count evidence should be compared with the remaining causes.");
  for (const cause of ["C1", "C2", "C3", "C4"]) await page.getByLabel(`Evidence for ${cause}`).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Lock diagnosis and score" }).click();
  await expect(page.getByRole("heading", { name: "Case evaluated" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What the evidence changed" })).toBeVisible();
  await expect(page.getByText("Truth revealed")).toBeVisible();
});
