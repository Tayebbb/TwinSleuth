import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { EpisodeService } from "./episode-service.js";
import { PIN9_MODEL } from "./case-model/pin9.js";

function action(type: object, revision: number, actionId: string = randomUUID()) {
  return { actionId, expectedRevision: revision, action: type };
}

describe("event-backed episode service", () => {
  it("starts, validates, exports, and permanently deletes a local conveyor episode", async () => {
    const service = new EpisodeService();
    const view = await service.start("conveyor-index-drift", "C1");
    expect(view.caseId).toBe("conveyor-index-drift");
    expect(view.public.hypotheses.map(({ id }) => id)).toEqual(["C1", "C2", "C3", "C4"]);
    expect(JSON.stringify(view)).not.toContain('"C1":"count-low"');
    expect(await service.list()).toContainEqual(expect.objectContaining({ id: view.id, title: "Conveyor Index Drift" }));
    const exported = await service.export(view.id);
    expect(exported.format).toBe("twinsleuth-local-episode-v1");
    expect(JSON.stringify(exported)).not.toContain("truth_hypothesis_id");
    await service.delete(view.id);
    expect((await service.list()).some((entry) => entry.id === view.id)).toBe(false);
    await expect(service.get(view.id)).rejects.toThrow("not found");
    service.close();
  });
  it("keeps truth and unrun forecasts out of the public view", async () => {
    const service = new EpisodeService();
    const view = await service.start("H1");
    expect(JSON.stringify(view)).not.toContain("truth");
    expect(JSON.stringify(view)).not.toContain('"forecasts"');
    service.close();
  });

  it("offers and caches a deterministic tutor skill without changing the episode revision", async () => {
    const service = new EpisodeService();
    const started = await service.start("H1");
    const challenged = await service.act(started.id, action({
      type: "propose", probeId: "P1", predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" },
    }, started.revision));
    expect(challenged.tutor?.skill).toBe("design_discriminating_tests");
    const first = await service.tutor(challenged.id);
    const second = await service.tutor(challenged.id);
    expect(first.revision).toBe(challenged.revision);
    expect(second.revision).toBe(challenged.revision);
    expect(first.tutor?.trace).toMatchObject({ graph: "tutor", status: "fallback", skill: "design_discriminating_tests" });
    const replay = JSON.stringify(await service.replay(challenged.id));
    expect(replay).not.toMatch(/truth_hypothesis_id|forecastTable/);
    service.close();
  });

  it("runs a complete deterministic episode and is idempotent", async () => {
    const service = new EpisodeService();
    let view = await service.start("H1");
    view = await service.act(view.id, action({ type: "beliefs", possibleHypotheses: ["H1", "H2", "H3", "H4"] }, view.revision));
    const proposal = action({ type: "propose", probeId: "P3", predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" } }, view.revision, randomUUID());
    view = await service.act(view.id, proposal);
    if (view.skeptic) view = await service.act(view.id, action({ type: "skeptic-decision", decision: "run-anyway" }, view.revision));
    const runAction = action({ type: "run", probeId: "P3" }, view.revision, randomUUID());
    view = await service.act(view.id, runAction);
    expect(view.observations[0]).toMatchObject({ probeId: "P3", outcomeId: "completed" });
    const duplicate = await service.act(view.id, runAction);
    expect(duplicate.observations).toHaveLength(1);
    await expect(service.act(view.id, { ...runAction, action: { type: "unsafe" } })).rejects.toThrow("different input");
    service.close();
  });

  it("rejects a second run of the same probe even with a fresh action ID", async () => {
    const service = new EpisodeService();
    const started = await service.start("H1");
    let view = await service.act(started.id, action({
      type: "propose", probeId: "P3",
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    }, started.revision));
    view = await service.act(view.id, action({ type: "run", probeId: "P3" }, view.revision));
    await expect(service.act(view.id, action({ type: "run", probeId: "P3" }, view.revision, "fresh-duplicate-run"))).rejects.toThrow("only once");
    service.close();
  });

  it("rejects a probe that would exceed the time budget", async () => {
    const service = new EpisodeService();
    let view = await service.start("H1");
    const commitAndRun = async (probeId: keyof typeof PIN9_MODEL.forecasts) => {
      view = await service.act(view.id, action({ type: "propose", probeId, predictions: PIN9_MODEL.forecasts[probeId] }, view.revision));
      if (view.skeptic) view = await service.act(view.id, action({ type: "skeptic-decision", decision: "run-anyway" }, view.revision));
      view = await service.act(view.id, action({ type: "run", probeId }, view.revision));
    };
    for (const probeId of ["P1", "P3", "P4", "P5"] as const) await commitAndRun(probeId);
    view = await service.act(view.id, action({ type: "propose", probeId: "P6", predictions: PIN9_MODEL.forecasts.P6 }, view.revision));
    if (view.skeptic) view = await service.act(view.id, action({ type: "skeptic-decision", decision: "run-anyway" }, view.revision));
    await expect(service.act(view.id, action({ type: "run", probeId: "P6" }, view.revision))).rejects.toThrow("exceeds the maintenance-time budget");
    service.close();
  });

  it("returns the original projection for an idempotent retry after later actions", async () => {
    const service = new EpisodeService();
    const started = await service.start("H1");
    const firstRequest = action({ type: "unsafe" }, started.revision, "original-response");
    const firstResponse = await service.act(started.id, firstRequest);
    await service.act(started.id, action({ type: "beliefs", possibleHypotheses: ["H1", "H2"] }, firstResponse.revision));
    expect(await service.act(started.id, firstRequest)).toEqual(firstResponse);
    service.close();
  });

  it("treats reordered object members as the same idempotent request", async () => {
    const service = new EpisodeService();
    const started = await service.start("H1");
    const request = action({
      type: "propose", probeId: "P3",
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    }, started.revision, "canonical-request");
    const first = await service.act(started.id, request);
    const reordered = { ...request, action: {
      type: "propose" as const, probeId: "P3" as const,
      predictions: { H4: "completed", H3: "refused", H2: "refused", H1: "completed" },
    } };
    expect(await service.act(started.id, reordered)).toEqual(first);
    service.close();
  });

  it("runs the Skeptic-revised predictions but scores the first committed forecast", async () => {
    const service = new EpisodeService();
    const started = await service.start("H1");
    const proposed = await service.act(started.id, action({
      type: "propose", probeId: "P3",
      predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" },
    }, started.revision));
    expect(proposed.skeptic).toBeDefined();
    const revised = await service.act(started.id, action({
      type: "skeptic-decision", decision: "run-anyway",
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    }, proposed.revision));
    expect(revised.proposals.P3).toEqual({ H1: "completed", H2: "refused", H3: "refused", H4: "completed" });
    expect(revised.revisedPredictions.P3).toEqual(revised.proposals.P3);

    let view = await service.act(revised.id, action({ type: "run", probeId: "P3" }, revised.revision));
    view = await service.act(view.id, action({
      type: "propose", probeId: "P4",
      predictions: { H1: "stopped-at-95", H2: "full-range", H3: "full-range", H4: "full-range" },
    }, view.revision));
    if (view.skeptic) view = await service.act(view.id, action({ type: "skeptic-decision", decision: "run-anyway" }, view.revision));
    view = await service.act(view.id, action({ type: "run", probeId: "P4" }, view.revision));
    view = await service.act(view.id, action({
      type: "lock", diagnosis: "H1", confidence: 5, justification: "P4 isolates H1.", claims: [
        { hypothesisId: "H1", stance: "supports", evidenceIds: [view.observations[1]!.evidenceId] },
        { hypothesisId: "H2", stance: "rules_out", evidenceIds: [view.observations[0]!.evidenceId] },
        { hypothesisId: "H3", stance: "rules_out", evidenceIds: [view.observations[0]!.evidenceId] },
        { hypothesisId: "H4", stance: "rules_out", evidenceIds: [view.observations[1]!.evidenceId] },
      ],
    }, view.revision));
    expect(view.score).toMatchObject({ correctPredictions: 6, predictionCount: 8, predictionAccuracy: 11.25 });
    service.close();
  });

  it("rejects stale revisions without appending an event", async () => {
    const service = new EpisodeService();
    const view = await service.start("H2");
    await expect(service.act(view.id, action({ type: "unsafe" }, 99))).rejects.toThrow("stale");
    expect(await service.replay(view.id)).toHaveLength(1);
    service.close();
  });

  it("bounds per-episode action history", async () => {
    const service = new EpisodeService();
    let view = await service.start("H1");
    for (let index = 0; index < 64; index += 1) {
      view = await service.act(view.id, action({ type: "beliefs", possibleHypotheses: ["H1", "H2", "H3", "H4"] }, view.revision, `bounded-${index}`));
    }
    await expect(service.act(view.id, action({ type: "unsafe" }, view.revision, "over-limit"))).rejects.toThrow("action limit");
    expect(await service.replay(view.id)).toHaveLength(65);
    service.close();
  });

  it("serializes concurrent writes that carry the same revision", async () => {
    const filename = join(tmpdir(), `twinsleuth-race-${randomUUID()}.sqlite`);
    const first = new EpisodeService(filename);
    const second = new EpisodeService(filename);
    const started = await first.start("H1");
    const results = await Promise.allSettled([
      Promise.resolve().then(() => first.act(started.id, action({ type: "unsafe" }, started.revision, "race-one"))),
      Promise.resolve().then(() => second.act(started.id, action({ type: "unsafe" }, started.revision, "race-two"))),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await first.get(started.id)).revision).toBe(started.revision + 1);
    first.close();
    second.close();
    rmSync(filename, { force: true });
    rmSync(`${filename}-shm`, { force: true });
    rmSync(`${filename}-wal`, { force: true });
  });

  it("records deterministic Skeptic feedback in the action response", async () => {
    const service = new EpisodeService();
    const started = await service.start("H1");
    const challenged = await service.act(started.id, action({
      type: "propose", probeId: "P1",
      predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" },
    }, started.revision));
    expect(challenged.pendingAgents).not.toContain("skeptic");
    expect(challenged.skeptic?.question).toBeTruthy();
    service.close();
  });

  it("keeps the no-observation public view truth-independent and rejects forecast injection", async () => {
    const views = await Promise.all((["H1", "H2", "H3", "H4"] as const).map(async (truth) => {
      const service = new EpisodeService();
      const view = await service.start(truth);
      const next = await service.act(view.id, action({ type: "beliefs", possibleHypotheses: ["H1", "H2", "H3", "H4"] }, view.revision));
      const serialized = JSON.stringify({ ...next, id: "fixed", revision: 1, public: { ...next.public, probes: next.public.probes.map(({ outcomes: _, ...probe }) => probe) } });
      service.close();
      return serialized;
    }));

    expect(new Set(views).size).toBe(1);
  });

  it("returns identical pre-test responses for the same script under all four hidden causes", async () => {
    const responses = await Promise.all((["H1", "H2", "H3", "H4"] as const).map(async (truth) => {
      const service = new EpisodeService();
      let view = await service.start(truth);
      view = await service.act(view.id, action({ type: "beliefs", possibleHypotheses: ["H1", "H2", "H3", "H4"] }, view.revision, "beliefs"));
      view = await service.act(view.id, action({
        type: "propose",
        probeId: "P1",
        predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" },
      }, view.revision, "proposal"));
      const normalized = JSON.stringify({ ...view, id: "episode" });
      service.close();
      return normalized;
    }));
    expect(new Set(responses).size).toBe(1);
  });

  it("rejects an attempt to supply an observed outcome", async () => {
    const service = new EpisodeService();
    const view = await service.start("H1");
    const proposed = await service.act(view.id, action({
      type: "propose",
      probeId: "P3",
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    }, view.revision));
    const resolved = proposed.skeptic
      ? await service.act(view.id, action({ type: "skeptic-decision", decision: "run-anyway" }, proposed.revision))
      : proposed;
    await expect(service.act(view.id, action({ type: "run", probeId: "P3", outcomeId: "refused" }, resolved.revision))).rejects.toThrow();
    const observed = await service.act(view.id, action({ type: "run", probeId: "P3" }, resolved.revision));
    expect(observed.observations[0]?.outcomeId).toBe("completed");
    service.close();
  });

  it("does not expose evidence-consistent cause IDs when beliefs are prematurely narrowed", async () => {
    const publicViews = await Promise.all((["H1", "H2", "H3", "H4"] as const).map(async (truth) => {
      const service = new EpisodeService();
      let view = await service.start(truth);
      view = await service.act(view.id, action({ type: "beliefs", possibleHypotheses: ["H1"] }, view.revision));
      view = await service.act(view.id, action({
        type: "propose", probeId: "P3",
        predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
      }, view.revision));
      const safe = JSON.stringify({ ...view, id: "fixed", revision: 3 });
      expect(safe).not.toContain('"hypothesisIds":["H2"');
      service.close();
      return safe;
    }));
    expect(new Set(publicViews).size).toBe(1);
  });

  it("keeps evidence-consistent cause IDs out of Skeptic text and replay after observations", async () => {
    for (const truth of ["H1", "H4"] as const) {
      const service = new EpisodeService();
      let view = await service.start(truth);
      view = await service.act(view.id, action({ type: "propose", probeId: "P3", predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" } }, view.revision));
      if (view.skeptic) view = await service.act(view.id, action({ type: "skeptic-decision", decision: "run-anyway" }, view.revision));
      view = await service.act(view.id, action({ type: "run", probeId: "P3" }, view.revision));
      view = await service.act(view.id, action({ type: "beliefs", possibleHypotheses: ["H2", "H3"] }, view.revision));
      view = await service.act(view.id, action({ type: "propose", probeId: "P4", predictions: { H1: "stopped-at-95", H2: "full-range", H3: "full-range", H4: "full-range" } }, view.revision));
      expect(view.skeptic?.triggers.some((trigger) => trigger.kind === "premature-elimination")).toBe(true);
      expect(view.skeptic?.question).not.toMatch(/H1|H4/);
      expect(JSON.stringify(view.traces)).not.toMatch(/H1|H4/);
      expect(JSON.stringify(await service.replay(view.id))).not.toMatch(/"AGENT_RUN"[^}]*H[14]/);
      service.close();
    }
  });

  it("keeps the stored episode revision equal to the folded ledger revision", async () => {
    const service = new EpisodeService();
    let view = await service.start("H1");
    view = await service.act(view.id, action({ type: "propose", probeId: "P3", predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" } }, view.revision));
    expect(view.traces.length).toBeGreaterThan(0);
    const row = await (service as unknown as { db: { get(sql: string, id: string): Promise<{ revision: number } | undefined> } }).db.get("SELECT revision FROM episodes WHERE id = ?", view.id);
    if (!row) throw new Error("Expected persisted episode revision.");
    expect(row.revision).toBe(view.revision);
    service.close();
  });

  it("hides derived candidate sets before lock but reveals authored rows after each run", async () => {
    const service = new EpisodeService();
    let view = await service.start("H1");
    view = await service.act(view.id, action({
      type: "propose", probeId: "P3",
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    }, view.revision));
    if (view.skeptic) view = await service.act(view.id, action({ type: "skeptic-decision", decision: "run-anyway" }, view.revision));
    view = await service.act(view.id, action({ type: "run", probeId: "P3" }, view.revision));
    expect(view.evidenceTimeline[0]?.supported).toEqual([]);
    expect(view.revealedForecasts.P3).toEqual({ H1: "completed", H2: "refused", H3: "refused", H4: "completed" });
    expect(view.revealedForecasts.P4).toBeUndefined();
    expect(view.forecastTable).toBeUndefined();
    service.close();
  });

  it("does not create a revision table when a proposal was not revised", async () => {
    const service = new EpisodeService();
    let view = await service.start("H1");
    view = await service.act(view.id, action({
      type: "propose", probeId: "P3",
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    }, view.revision));
    expect(view.revisedPredictions).toEqual({});
    service.close();
  });

  it("persists episodes and idempotent action responses across a file-backed restart", async () => {
    const filename = join(tmpdir(), `twinsleuth-${randomUUID()}.sqlite`);
    const actionId = "persistent-beliefs";
    let service = new EpisodeService(filename);
    const started = await service.start("H3");
    const request = action({ type: "beliefs", possibleHypotheses: ["H2", "H3"] }, started.revision, actionId);
    const first = await service.act(started.id, request);
    service.close();

    service = new EpisodeService(filename);
    expect(await service.get(started.id)).toEqual(first);
    expect(await service.act(started.id, request)).toEqual(first);
    expect((await service.replay(started.id)).map((event) => (event as { type: string }).type)).toEqual(["EPISODE_STARTED", "BELIEFS_UPDATED"]);
    service.close();
    rmSync(filename, { force: true });
    rmSync(`${filename}-shm`, { force: true });
    rmSync(`${filename}-wal`, { force: true });
  });

  it("replays accepted case action sequences to the same public state across restart", async () => {
    const scripts = [
      {
        caseId: "pin-9-refusal",
        truths: ["H1", "H2", "H3", "H4"],
        proposals: [
          { probeId: "P3", predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" } },
          { probeId: "P4", predictions: { H1: "stopped-at-95", H2: "full-range", H3: "full-range", H4: "full-range" } },
        ],
      },
      {
        caseId: "conveyor-index-drift",
        truths: ["C1", "C2", "C3", "C4"],
        proposals: [
          { probeId: "C-P3", predictions: { C1: "count-low", C2: "count-matches", C3: "count-matches", C4: "count-matches" } },
          { probeId: "C-P4", predictions: { C1: "mount-secure", C2: "mount-loose", C3: "mount-secure", C4: "mount-secure" } },
        ],
      },
    ] as const;

    for (const script of scripts) {
      for (const truth of script.truths) {
        const filename = join(tmpdir(), `twinsleuth-replay-${randomUUID()}.sqlite`);
        let service = new EpisodeService(filename);
        let view = await service.start(script.caseId, truth);
        expect(await service.get(view.id)).toEqual(view);

        const apply = async (nextAction: object) => {
          view = await service.act(view.id, action(nextAction, view.revision));
          expect(await service.get(view.id)).toEqual(view);
        };

        await apply({ type: "beliefs", possibleHypotheses: [...script.truths] });
        for (const proposal of script.proposals) {
          await apply({ type: "propose", ...proposal });
          if (view.skeptic) await apply({ type: "skeptic-decision", decision: "run-anyway" });
          await apply({ type: "run", probeId: proposal.probeId });
        }

        const beforeRejectedAction = await service.get(view.id);
        const eventsBeforeRejectedAction = await service.replay(view.id);
        await expect(service.act(view.id, action({ type: "run", probeId: script.proposals[0]!.probeId }, view.revision, "replay-duplicate-run"))).rejects.toThrow("only once");
        expect(await service.get(view.id)).toEqual(beforeRejectedAction);
        expect(await service.replay(view.id)).toEqual(eventsBeforeRejectedAction);

        const beforeRestart = view;
        const sequence = (await service.replay(view.id)).map((event) => (event as { seq: number }).seq);
        expect(sequence).toEqual(sequence.map((_, index) => index));
        service.close();

        service = new EpisodeService(filename);
        expect(await service.get(view.id)).toEqual(beforeRestart);
        expect((await service.replay(view.id)).map((event) => (event as { seq: number }).seq)).toEqual(sequence);
        service.close();
        rmSync(filename, { force: true });
        rmSync(`${filename}-shm`, { force: true });
        rmSync(`${filename}-wal`, { force: true });
      }
    }
  });

  it("fails safely when a persisted event payload is malformed JSON", async () => {
    const filename = join(tmpdir(), `twinsleuth-corrupt-${randomUUID()}.sqlite`);
    let service = new EpisodeService(filename);
    const started = await service.start("H1");
    service.close();
    const database = new Database(filename);
    database.prepare("UPDATE events SET payload_json = ? WHERE episode_id = ? AND seq = 0").run("{", started.id);
    database.close();
    service = new EpisodeService(filename);
    await expect(service.get(started.id)).rejects.toThrow("Episode data is corrupted.");
    service.close();
    rmSync(filename, { force: true });
    rmSync(`${filename}-shm`, { force: true });
    rmSync(`${filename}-wal`, { force: true });
  });

  it("fails safely when persisted event type is unknown", async () => {
    const filename = join(tmpdir(), `twinsleuth-unknown-event-${randomUUID()}.sqlite`);
    let service = new EpisodeService(filename);
    const started = await service.start("H1");
    service.close();
    const database = new Database(filename);
    database.prepare("UPDATE events SET type = ? WHERE episode_id = ? AND seq = 0").run("MYSTERY_EVENT", started.id);
    database.close();
    service = new EpisodeService(filename);
    await expect(service.get(started.id)).rejects.toThrow("Episode data is corrupted.");
    service.close();
    rmSync(filename, { force: true });
    rmSync(`${filename}-shm`, { force: true });
    rmSync(`${filename}-wal`, { force: true });
  });

  it("fails safely when a cached idempotency response is corrupted", async () => {
    const filename = join(tmpdir(), `twinsleuth-corrupt-action-${randomUUID()}.sqlite`);
    let service = new EpisodeService(filename);
    const started = await service.start("H1");
    const request = action({ type: "unsafe" }, started.revision, "corrupt-cached-response");
    await service.act(started.id, request);
    service.close();
    const database = new Database(filename);
    database.prepare("UPDATE actions SET response_json = ? WHERE episode_id = ? AND action_id = ?").run("{}", started.id, request.actionId);
    database.close();
    service = new EpisodeService(filename);
    await expect(service.act(started.id, request)).rejects.toThrow("Episode data is corrupted.");
    service.close();
    rmSync(filename, { force: true });
    rmSync(`${filename}-shm`, { force: true });
    rmSync(`${filename}-wal`, { force: true });
  });
});
