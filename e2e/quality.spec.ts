import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

async function expectInsideViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, "element must have a layout box").not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(box!.y + box!.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
}

async function chooseWithKeyboard(locator: Locator, downPresses: number) {
  await locator.focus();
  await locator.press("Home");
  for (let index = 0; index < downPresses; index += 1) await locator.press("ArrowDown");
}

test("initial bench fits the 1280x800 work viewport", async ({ page }) => {
  await page.goto("/");
  for (const testId of ["scene-panel", "beliefs-probes-panel", "prediction-panel"]) {
    await expectInsideViewport(page, page.getByTestId(testId));
  }
  await expectInsideViewport(page, page.getByTestId("arm-visualization"));
  await expectInsideViewport(page, page.getByRole("button", { name: /P6/ }));
  await expectInsideViewport(page, page.getByRole("button", { name: "Commit prediction table" }));
});

test("locks committed forecasts until the Skeptic decision or probe run", async ({ page }) => {
  await page.goto("/");
  for (const hypothesis of ["H1", "H2", "H3", "H4"]) {
    await page.getByLabel(`Prediction for ${hypothesis}`).selectOption("refused");
  }
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await expect(page.getByText(/Skeptic check · P1/i)).toBeVisible();
  for (const hypothesis of ["H1", "H2", "H3", "H4"]) {
    await expect(page.getByLabel(`Prediction for ${hypothesis}`)).toHaveValue("refused");
    await expect(page.getByLabel(`Prediction for ${hypothesis}`)).toBeDisabled();
  }
  await expect(page.getByRole("button", { name: /P3/ }).first()).toBeDisabled();

  await page.getByRole("button", { name: "Try P3 instead" }).click();
  await expect(page.getByRole("heading", { name: "Predict P3's result" })).toBeVisible();
  await expect(page.getByLabel("Prediction for H1")).toBeEnabled();
  await expect(page.getByLabel("Prediction for H1")).toHaveValue("");
  for (const [hypothesis, outcome] of Object.entries({ H1: "completed", H2: "refused", H3: "refused", H4: "completed" })) {
    await page.getByLabel(`Prediction for ${hypothesis}`).selectOption(outcome);
  }
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await expect(page.getByRole("button", { name: /Run P3/ })).toBeVisible();
  for (const [hypothesis, outcome] of Object.entries({ H1: "completed", H2: "refused", H3: "refused", H4: "completed" })) {
    await expect(page.getByLabel(`Prediction for ${hypothesis}`)).toHaveValue(outcome);
    await expect(page.getByLabel(`Prediction for ${hypothesis}`)).toBeDisabled();
  }
});

test("does not serve local SQLite files through the Vite development server", async ({ request }) => {
  const directory = `.vite-security-${randomUUID()}`;
  const fixtureDirectory = join(process.cwd(), directory);
  const filenames = ["private.sqlite", "private.sqlite-wal", "private.sqlite-shm"];
  mkdirSync(fixtureDirectory);
  try {
    for (const filename of filenames) writeFileSync(join(fixtureDirectory, filename), "non-sensitive test fixture");
    for (const filename of filenames) {
      const response = await request.get(`/${directory}/${filename}`);
      expect(response.status(), `${filename} must be denied`).toBe(403);
    }
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("passes automated accessibility and target-size checks at laptop and phone sizes", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const targets = page.locator("button:visible, select:visible, summary:visible, label.hypothesis:visible");
    for (let index = 0; index < await targets.count(); index += 1) {
      const box = await targets.nth(index).boundingBox();
      expect(box?.height, `target ${index} height at ${viewport.width}px`).toBeGreaterThanOrEqual(44);
      expect(box?.width, `target ${index} width at ${viewport.width}px`).toBeGreaterThanOrEqual(44);
    }
  }
});

test("fresh episode replay resets the case and returns to the top", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /P3/ }).click();
  for (const [hypothesis, outcome] of Object.entries({ H1: "completed", H2: "refused", H3: "refused", H4: "completed" })) {
    await page.getByLabel(`Prediction for ${hypothesis}`).selectOption(outcome);
  }
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await page.getByRole("button", { name: /Run P3/ }).click();
  await page.getByLabel("Justification").fill("The nearby key completed, so I would test the remaining causes next.");
  await page.getByRole("button", { name: "Lock diagnosis and score" }).click();
  await expect(page.getByRole("heading", { name: "Case evaluated" })).toBeVisible();

  await page.getByRole("button", { name: "Start a fresh episode" }).click();
  await expect(page.getByRole("heading", { name: "Predict P1's result" })).toBeVisible();
  await expect(page.getByText("Waiting for the first test")).toBeVisible();
  for (const hypothesis of ["H1", "H2", "H3", "H4"]) {
    await expect(page.getByLabel(`Prediction for ${hypothesis}`)).toHaveValue("");
  }
  await page.waitForFunction(() => window.location.hash === "#top" && window.scrollY === 0);
});

for (const viewport of [{ name: "laptop", width: 1280, height: 800 }, { name: "phone", width: 390, height: 844 }]) {
  test(`critical diagnosis path works by keyboard with visible focus on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByLabel("Prediction for H1").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Prediction for H2")).toBeFocused();
    const focusedStyle = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    expect(Number.parseFloat(focusedStyle.width)).toBeGreaterThanOrEqual(2);
    expect(focusedStyle.style).not.toBe("none");

    for (const id of ["H1", "H2", "H3", "H4"]) await chooseWithKeyboard(page.getByLabel(`Prediction for ${id}`), 1);
    await page.getByRole("button", { name: "Commit prediction table" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Try P3 instead" }).focus();
    await page.keyboard.press("Enter");

    await chooseWithKeyboard(page.getByLabel("Prediction for H1"), 1);
    await chooseWithKeyboard(page.getByLabel("Prediction for H2"), 2);
    await chooseWithKeyboard(page.getByLabel("Prediction for H3"), 2);
    await chooseWithKeyboard(page.getByLabel("Prediction for H4"), 1);
    await page.getByRole("button", { name: "Commit prediction table" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Skeptic check · P3/i)).toHaveCount(0);
    await page.getByRole("button", { name: /Run P3/ }).focus();
    await page.keyboard.press("Enter");

    await page.getByRole("button", { name: /P4/ }).focus();
    await page.keyboard.press("Enter");
    await chooseWithKeyboard(page.getByLabel("Prediction for H1"), 1);
    for (const id of ["H2", "H3", "H4"]) await chooseWithKeyboard(page.getByLabel(`Prediction for ${id}`), 2);
    await page.getByRole("button", { name: "Commit prediction table" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /Run P4/ }).focus();
    await page.keyboard.press("Enter");

    await page.getByLabel("Justification").focus();
    await page.keyboard.type("P4 stopped at 95 degrees, supporting the tightened J2 limit.");
    await chooseWithKeyboard(page.getByLabel("Evidence for H1"), 2);
    await chooseWithKeyboard(page.getByLabel("Evidence for H2"), 1);
    await chooseWithKeyboard(page.getByLabel("Evidence for H3"), 1);
    await chooseWithKeyboard(page.getByLabel("Evidence for H4"), 2);
    await page.getByRole("button", { name: "Lock diagnosis and score" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: /Case evaluated/ })).toBeVisible();
  });
}
