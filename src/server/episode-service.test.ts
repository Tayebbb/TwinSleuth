import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EpisodeService } from "./episode-service.js";

function action(type: object, revision: number, actionId: string = randomUUID()) {
  return { actionId, expectedRevision: revision, action: type };
}

describe("event-backed episode service", () => {
  it("keeps truth and unrun forecasts out of the public view", () => {
    const service = new EpisodeService();
    const view = service.start("H1");
    expect(JSON.stringify(view)).not.toContain("truth");
    expect(JSON.stringify(view)).not.toContain('"forecasts"');
    service.close();
  });

  it("runs a complete deterministic episode and is idempotent", () => {
    const service = new EpisodeService();
    let view = service.start("H1");
    view = service.act(view.id, action({ type: "beliefs", possibleHypotheses: ["H1", "H2", "H3", "H4"] }, view.revision));
    const proposal = action({ type: "propose", probeId: "P3", predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" } }, view.revision, randomUUID());
    view = service.act(view.id, proposal);
    if (view.skeptic) view = service.act(view.id, action({ type: "skeptic-decision", decision: "run-anyway" }, view.revision));
    const runAction = action({ type: "run", probeId: "P3" }, view.revision, randomUUID());
    view = service.act(view.id, runAction);
    expect(view.observations[0]).toMatchObject({ probeId: "P3", outcomeId: "completed" });
    const duplicate = service.act(view.id, runAction);
    expect(duplicate.observations).toHaveLength(1);
    expect(() => service.act(view.id, { ...runAction, action: { type: "unsafe" } })).toThrow("different input");
    service.close();
  });

  it("rejects stale revisions without appending an event", () => {
    const service = new EpisodeService();
    const view = service.start("H2");
    expect(() => service.act(view.id, action({ type: "unsafe" }, 99))).toThrow("stale");
    expect(service.replay(view.id)).toHaveLength(1);
    service.close();
  });

  it("bounds per-episode action history", () => {
    const service = new EpisodeService();
    let view = service.start("H1");
    for (let index = 0; index < 64; index += 1) {
      view = service.act(view.id, action({ type: "beliefs", possibleHypotheses: ["H1", "H2", "H3", "H4"] }, view.revision, `bounded-${index}`));
    }
    expect(() => service.act(view.id, action({ type: "unsafe" }, view.revision, "over-limit"))).toThrow("action limit");
    expect(service.replay(view.id)).toHaveLength(65);
    service.close();
  });

  it("serializes concurrent writes that carry the same revision", async () => {
    const filename = join(tmpdir(), `twinsleuth-race-${randomUUID()}.sqlite`);
    const first = new EpisodeService(filename);
    const second = new EpisodeService(filename);
    const started = first.start("H1");
    const results = await Promise.allSettled([
      Promise.resolve().then(() => first.act(started.id, action({ type: "unsafe" }, started.revision, "race-one"))),
      Promise.resolve().then(() => second.act(started.id, action({ type: "unsafe" }, started.revision, "race-two"))),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(first.get(started.id).revision).toBe(started.revision + 1);
    first.close();
    second.close();
    rmSync(filename, { force: true });
    rmSync(`${filename}-shm`, { force: true });
    rmSync(`${filename}-wal`, { force: true });
  });

  it("reports pending agent work so clients can stop polling when it finishes", () => {
    const service = new EpisodeService();
    const started = service.start("H1");
    const challenged = service.act(started.id, action({
      type: "propose", probeId: "P1",
      predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" },
    }, started.revision));
    expect(challenged.pendingAgents).toContain("skeptic");
    service.close();
  });

  it("keeps the no-observation public view truth-independent and rejects forecast injection", () => {
    const views = (["H1", "H2", "H3", "H4"] as const).map((truth) => {
      const service = new EpisodeService();
      const view = service.start(truth);
      const next = service.act(view.id, action({ type: "beliefs", possibleHypotheses: ["H1", "H2", "H3", "H4"] }, view.revision));
      const serialized = JSON.stringify({ ...next, id: "fixed", revision: 1, public: { ...next.public, probes: next.public.probes.map(({ outcomes: _, ...probe }) => probe) } });
      service.close();
      return serialized;
    });

    expect(new Set(views).size).toBe(1);
  });

  it("returns identical pre-test responses for the same script under all four hidden causes", () => {
    const responses = (["H1", "H2", "H3", "H4"] as const).map((truth) => {
      const service = new EpisodeService();
      let view = service.start(truth);
      view = service.act(view.id, action({ type: "beliefs", possibleHypotheses: ["H1", "H2", "H3", "H4"] }, view.revision, "beliefs"));
      view = service.act(view.id, action({
        type: "propose",
        probeId: "P1",
        predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" },
      }, view.revision, "proposal"));
      const normalized = JSON.stringify({ ...view, id: "episode" });
      service.close();
      return normalized;
    });
    expect(new Set(responses).size).toBe(1);
  });

  it("does not let a client choose the observed outcome", () => {
    const service = new EpisodeService();
    const view = service.start("H1");
    const proposed = service.act(view.id, action({
      type: "propose",
      probeId: "P3",
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    }, view.revision));
    const resolved = proposed.skeptic
      ? service.act(view.id, action({ type: "skeptic-decision", decision: "run-anyway" }, proposed.revision))
      : proposed;
    const observed = service.act(view.id, action({ type: "run", probeId: "P3", outcomeId: "refused" }, resolved.revision));
    expect(observed.observations[0]?.outcomeId).toBe("completed");
    service.close();
  });

  it("does not expose evidence-consistent cause IDs when beliefs are prematurely narrowed", () => {
    const publicViews = (["H1", "H2", "H3", "H4"] as const).map((truth) => {
      const service = new EpisodeService();
      let view = service.start(truth);
      view = service.act(view.id, action({ type: "beliefs", possibleHypotheses: ["H1"] }, view.revision));
      view = service.act(view.id, action({
        type: "propose", probeId: "P3",
        predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
      }, view.revision));
      const safe = JSON.stringify({ ...view, id: "fixed", revision: 3 });
      expect(safe).not.toContain('"hypothesisIds":["H2"');
      service.close();
      return safe;
    });
    expect(new Set(publicViews).size).toBe(1);
  });

  it("hides derived candidate sets before lock but reveals authored rows after each run", () => {
    const service = new EpisodeService();
    let view = service.start("H1");
    view = service.act(view.id, action({
      type: "propose", probeId: "P3",
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    }, view.revision));
    if (view.skeptic) view = service.act(view.id, action({ type: "skeptic-decision", decision: "run-anyway" }, view.revision));
    view = service.act(view.id, action({ type: "run", probeId: "P3" }, view.revision));
    expect(view.evidenceTimeline[0]?.supported).toEqual([]);
    expect(view.revealedForecasts.P3).toEqual({ H1: "completed", H2: "refused", H3: "refused", H4: "completed" });
    expect(view.revealedForecasts.P4).toBeUndefined();
    expect(view.forecastTable).toBeUndefined();
    service.close();
  });

  it("does not create a revision table when a proposal was not revised", () => {
    const service = new EpisodeService();
    let view = service.start("H1");
    view = service.act(view.id, action({
      type: "propose", probeId: "P3",
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    }, view.revision));
    expect(view.revisedPredictions).toEqual({});
    service.close();
  });

  it("persists episodes and idempotent action responses across a file-backed restart", () => {
    const filename = join(tmpdir(), `twinsleuth-${randomUUID()}.sqlite`);
    const actionId = "persistent-beliefs";
    let service = new EpisodeService(filename);
    const started = service.start("H3");
    const request = action({ type: "beliefs", possibleHypotheses: ["H2", "H3"] }, started.revision, actionId);
    const first = service.act(started.id, request);
    service.close();

    service = new EpisodeService(filename);
    expect(service.get(started.id)).toEqual(first);
    expect(service.act(started.id, request)).toEqual(first);
    expect(service.replay(started.id).map((event) => (event as { type: string }).type)).toEqual(["EPISODE_STARTED", "BELIEFS_UPDATED"]);
    service.close();
    rmSync(filename, { force: true });
    rmSync(`${filename}-shm`, { force: true });
    rmSync(`${filename}-wal`, { force: true });
  });
});
