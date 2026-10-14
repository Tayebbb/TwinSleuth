import { expect, test } from "@playwright/test";

const screenshots = "submission/screenshots";
const wait = (page: import("@playwright/test").Page) => page.waitForTimeout(450);

async function caption(page: import("@playwright/test").Page, text: string) {
  await page.evaluate((value) => {
    let overlay = document.querySelector<HTMLElement>("#submission-demo-caption");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "submission-demo-caption";
      Object.assign(overlay.style, {
        position: "fixed",
        zIndex: "2147483647",
        left: "50%",
        bottom: "22px",
        transform: "translateX(-50%)",
        width: "min(900px, calc(100vw - 48px))",
        boxSizing: "border-box",
        padding: "18px 24px",
        borderLeft: "5px solid #e9a14b",
        borderRadius: "4px",
        background: "rgba(19, 27, 31, 0.96)",
        color: "#fffaf1",
        boxShadow: "0 12px 40px rgba(0,0,0,.32)",
        font: "600 22px/1.4 system-ui, sans-serif",
        textAlign: "center",
      });
      document.body.append(overlay);
    }
    overlay.textContent = value;
  }, text);
  await page.waitForTimeout(10_000);
  await page.evaluate(() => document.querySelector("#submission-demo-caption")?.remove());
}

test("capture deterministic submission states", async ({ page }) => {
  // Hold captions long enough to read in the local preview; the submitted narration video is separate.
  test.setTimeout(120_000);
  await page.goto("/");
  await caption(page, "TwinSleuth is a simulated practice lab for evidence-based fault diagnosis.");
  await page.screenshot({ path: `${screenshots}/01-laptop-bench.png`, fullPage: true });

  for (const id of ["H1", "H2", "H3", "H4"]) await page.getByLabel(`Prediction for ${id}`).selectOption("refused");
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await wait(page);
  await caption(page, "Predict the result for every possible cause before running a probe.");
  await page.screenshot({ path: `${screenshots}/02-skeptic-challenge.png`, fullPage: true });
  await page.getByRole("button", { name: "Try P3 instead" }).click();

  const p3 = { H1: "completed", H2: "refused", H3: "refused", H4: "completed" };
  for (const [id, outcome] of Object.entries(p3)) await page.getByLabel(`Prediction for ${id}`).selectOption(outcome);
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await page.getByRole("button", { name: /Run P3/ }).click();
  await wait(page);
  await caption(page, "Tests consume a 30-minute simulated budget; the server reveals only observations after a run.");
  await page.screenshot({ path: `${screenshots}/03-p3-observation.png`, fullPage: true });

  await page.getByRole("button", { name: /P4/ }).click();
  const p4 = { H1: "stopped-at-95", H2: "full-range", H3: "full-range", H4: "full-range" };
  for (const [id, outcome] of Object.entries(p4)) await page.getByLabel(`Prediction for ${id}`).selectOption(outcome);
  await page.getByRole("button", { name: "Commit prediction table" }).click();
  await page.getByRole("button", { name: /Run P4/ }).click();
  await wait(page);
  await caption(page, "P4 narrows the remaining causes with a second, targeted observation.");
  await page.screenshot({ path: `${screenshots}/04-j2-stopped-95.png`, fullPage: true });

  await page.getByLabel("Justification").fill("P4 stopped at 95 degrees, supporting the tightened J2 limit.");
  await page.getByLabel("Evidence for H1").selectOption({ index: 2 });
  await page.getByLabel("Evidence for H2").selectOption({ index: 1 });
  await page.getByLabel("Evidence for H3").selectOption({ index: 1 });
  await page.getByLabel("Evidence for H4").selectOption({ index: 2 });
  await page.getByRole("button", { name: "Lock diagnosis and score" }).click();
  await expect(page.getByRole("heading", { name: "Examiner notes" }).locator("xpath=following-sibling::p").first()).toContainText(/evidence claims checked/, { timeout: 15_000 });
  await caption(page, "The deterministic debrief checks evidence claims, scores the diagnosis, and compares the route with the model policy.");
  await page.screenshot({ path: `${screenshots}/05-debrief.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForFunction(() => window.scrollY === 0);
  await caption(page, "The same practice flow adapts to a phone-sized screen.");
  await page.screenshot({ path: `${screenshots}/06-phone-debrief.png`, fullPage: true });
});
