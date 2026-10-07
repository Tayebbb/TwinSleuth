import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { EpisodeService } from "./episode-service.js";

function action(type: object, revision: number, actionId = randomUUID()) {
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
    service.close();
  });

  it("rejects stale revisions without appending an event", () => {
    const service = new EpisodeService();
    const view = service.start("H2");
    expect(() => service.act(view.id, action({ type: "unsafe" }, 99))).toThrow("stale");
    expect(service.replay(view.id)).toHaveLength(1);
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
});
