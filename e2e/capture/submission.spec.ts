import { expect, test } from "@playwright/test";

const screenshots = "submission/screenshots";
const wait = (page: import("@playwright/test").Page) => page.waitForTimeout(450);

test("capture deterministic submission states", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: `${screenshots}/01-laptop-bench.png`, fullPage: true });

  for (const id of ["H1", "H2", "H3", "H4"]) await page.getByLabel(`Prediction for ${id}`).selectOption("refused");
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await wait(page);
  await page.screenshot({ path: `${screenshots}/02-skeptic-challenge.png`, fullPage: true });
  await page.getByRole("button", { name: "Try P3 instead" }).click();

  const p3 = { H1: "completed", H2: "refused", H3: "refused", H4: "completed" };
  for (const [id, outcome] of Object.entries(p3)) await page.getByLabel(`Prediction for ${id}`).selectOption(outcome);
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await page.getByRole("button", { name: /Run P3/ }).click();
  await wait(page);
  await page.screenshot({ path: `${screenshots}/03-p3-observation.png`, fullPage: true });

  await page.getByRole("button", { name: /P4/ }).click();
  const p4 = { H1: "stopped-at-95", H2: "full-range", H3: "full-range", H4: "full-range" };
  for (const [id, outcome] of Object.entries(p4)) await page.getByLabel(`Prediction for ${id}`).selectOption(outcome);
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await page.getByRole("button", { name: /Run P4/ }).click();
  await wait(page);
  await page.screenshot({ path: `${screenshots}/04-j2-stopped-95.png`, fullPage: true });

  await page.getByLabel("Justification").fill("P4 stopped at 95 degrees, supporting the tightened J2 limit.");
  await page.getByLabel("Evidence for H1").selectOption({ index: 2 });
  await page.getByLabel("Evidence for H2").selectOption({ index: 1 });
  await page.getByLabel("Evidence for H3").selectOption({ index: 1 });
  await page.getByLabel("Evidence for H4").selectOption({ index: 2 });
  await page.getByRole("button", { name: "Lock diagnosis and score" }).click();
  await expect(page.getByRole("heading", { name: "Examiner notes" }).locator("xpath=following-sibling::p").first()).toContainText(/evidence claims checked/, { timeout: 15_000 });
  await page.screenshot({ path: `${screenshots}/05-debrief.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForFunction(() => window.scrollY === 0);
  await page.screenshot({ path: `${screenshots}/06-phone-debrief.png`, fullPage: true });
});
