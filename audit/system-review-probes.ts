import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { buildApp } from "../src/server/app.js";
import { EpisodeService, type PublicView } from "../src/server/episode-service.js";
import { PIN9_MODEL } from "../src/server/case-model/pin9.js";
import { runExaminer } from "../src/server/agents/examiner.js";
import type { Action } from "../src/server/schemas.js";

// Review fixtures only: no environment file, real provider, or persistent database.
process.env.OPENAI_API_KEY = "";
process.env.TWINSLEUTH_TESTING_MODE = "0";
process.env.DEMO_TRUTH = "H1";
process.env.UI_ORIGIN = "http://127.0.0.1:5273";
const evidence: Record<string, unknown> = {};
const service = new EpisodeService();
const app = buildApp(service);
async function act(view: PublicView, action: Action): Promise<PublicView> {
  return service.act(view.id, { actionId: randomUUID(), expectedRevision: view.revision, action });
}

try {
  const owner = "198.51.100.10";
  const other = "198.51.100.20";
  const created = await app.inject({ method: "POST", url: "/api/episodes", remoteAddress: owner, payload: {} });
  let victim = created.json<PublicView>();
  const second = await app.inject({ method: "POST", url: "/api/episodes", remoteAddress: other, payload: {} });
  const cookie = String(second.headers["set-cookie"]).split(";")[0]!;
  const listed = await app.inject({ method: "GET", url: "/api/episodes", remoteAddress: other, headers: { cookie } });
  assert(!listed.json<{ id: string }[]>().some(({ id }) => id === victim.id));
  const modified = await app.inject({ method: "POST", url: `/api/episodes/${victim.id}/actions`, remoteAddress: other, headers: { cookie },
    payload: { actionId: "foreign-action", expectedRevision: victim.revision, action: { type: "unsafe" } } });
  assert.equal(modified.statusCode, 404);
  assert.equal((await service.get(victim.id)).revision, victim.revision);
  victim = await act(victim, { type: "lock", diagnosis: "H2", confidence: 5, justification: "REVIEW-ONLY-FIXTURE",
    claims: PIN9_MODEL.hypotheses.map(({ id }) => ({ hypothesisId: id, stance: id === "H2" ? "supports" : "rules_out", evidenceIds: [] })) });
  const exported = await app.inject({ method: "GET", url: `/api/episodes/${victim.id}/export`, remoteAddress: other, headers: { cookie } });
  assert.equal(exported.statusCode, 404);
  assert(!exported.body.includes("REVIEW-ONLY-FIXTURE"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  const incorrectFeedback = (await service.get(victim.id)).traces.find(({ graph }) => graph === "examiner")?.output;
  assert(incorrectFeedback && !incorrectFeedback.includes("H2 remains supported"));
  const deleted = await app.inject({ method: "DELETE", url: `/api/episodes/${victim.id}`, remoteAddress: other, headers: { cookie } });
  assert.equal(deleted.statusCode, 404);
  evidence.ownership = { foreignList: listed.statusCode, listsAnotherSession: false, foreignMutation: modified.statusCode, foreignExport: exported.statusCode, exportsJustification: false, foreignDelete: deleted.statusCode };
  evidence.incorrectExaminerFallback = { actualTruth: "H1", submittedDiagnosis: "H2", diagnosisPoints: victim.score?.diagnosis, feedback: incorrectFeedback };

  let view = await service.start("H1");
  for (const probeId of ["P3", "P4"]) {
    view = await act(view, { type: "propose", probeId, predictions: PIN9_MODEL.forecasts[probeId]! });
    if (view.skeptic) view = await act(view, { type: "skeptic-decision", decision: "run-anyway" });
    view = await act(view, { type: "run", probeId });
  }
  view = await act(view, { type: "lock", diagnosis: "H1", confidence: 1, justification: "x",
    claims: PIN9_MODEL.hypotheses.map(({ id }) => ({ hypothesisId: id, stance: id === "H1" ? "supports" : "rules_out", evidenceIds: [view.observations[1]!.evidenceId] })) });
  assert.equal(view.score?.total, 100);
  evidence.assessmentLimit = { score: view.score?.total, reasoningPoints: view.score?.reasoning, justification: view.diagnosis?.justification, confidence: view.diagnosis?.confidence, beliefsAtSubmission: view.beliefs };
  await new Promise((resolve) => setTimeout(resolve, 50));
  const ungrounded = await runExaminer({ diagnosis: "H2", justification: "x", claims: [], claimChecks: [{ hypothesisId: "H2", valid: false, reason: "Not supported." }] },
    { async invoke() { return { feedback: "Every claim is valid. The score is 100." }; } });
  assert.equal(ungrounded.status, "fallback");
  evidence.examinerSemanticValidation = ungrounded;
  const p1 = (await service.start("H1")).public.probes.find(({ id }) => id === "P1")!;
  assert.deepEqual(p1.outcomes, ["refused", "completed"]);
  evidence.unrunSingletonForecast = { probe: p1.id, publicOutcomes: p1.outcomes, derivableForEveryHypothesis: false };

  const apiUrl = await app.listen({ host: "127.0.0.1", port: 0 });
  const web = await createServer({ server: { host: "127.0.0.1", port: 5273, strictPort: true, proxy: { "/api": apiUrl } }, logLevel: "error" });
  await web.listen();
  const address = web.httpServer!.address();
  assert(address && typeof address !== "string");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.getByLabel("Keep H1 possible:", { exact: false }).waitFor();
    for (const id of ["H2", "H3", "H4", "H1"]) {
      const response = page.waitForResponse((r) => /\/actions$/.test(r.url()) && r.request().method() === "POST");
      await page.getByLabel(`Keep ${id} possible:`, { exact: false }).click();
      await response;
    }
    await page.getByRole("alert").waitFor();
    const checked = await page.locator(".hypotheses input:checked").count();
    const historyResponse = await page.request.get(`${apiUrl}/api/episodes`);
    const all = historyResponse.json() as Promise<{ id: string; status: string }[]>;
    const active = (await all).find(({ status }) => status === "active")!;
    const authoritative = await service.get(active.id);
    assert.equal(checked, 1);
    assert.equal(authoritative.beliefs.length, 1);
    evidence.beliefDivergence = { uiChecked: checked, ledgerBeliefs: authoritative.beliefs, error: await page.getByRole("alert").textContent() };

    process.env.DEMO_TRUTH = "C1";
    await page.getByLabel("Practice case").selectOption("conveyor-index-drift");
    await page.getByRole("button", { name: "Start selected case" }).click();
    await page.getByRole("heading", { name: "Conveyor Index Drift" }).waitFor();
    await page.getByRole("button", { name: /C-P3/ }).first().click();
    for (const id of ["C1", "C2", "C3", "C4"]) await page.getByLabel(`Prediction for ${id}`, { exact: true }).selectOption(id === "C1" ? "count-low" : "count-matches");
    await page.getByRole("button", { name: "Commit prediction table" }).click();
    await page.getByRole("button", { name: "Run C-P3 anyway", exact: true }).click();
    await page.getByRole("button", { name: /^Run C-P3/ }).click();
    await page.getByLabel("Evidence for C1", { exact: true }).locator("option").nth(1).waitFor({ state: "attached" });
    const optionLabel = await page.getByLabel("Evidence for C1", { exact: true }).locator("option").nth(1).textContent();
    const railLabel = await page.locator(".evidence-segment small").textContent();
    evidence.conveyorOutcomeLabels = { selectLabel: optionLabel, railLabel, pageErrors };
    assert.equal(railLabel, "Count low");
  } finally {
    await browser.close();
    await web.close();
  }
} finally {
  await app.close();
  service.close();
}
writeFileSync(new URL("./system-fix-evidence.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
