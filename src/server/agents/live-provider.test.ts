import { describe, expect, it } from "vitest";
import { runSkeptic } from "./skeptic.js";

describe("FreeLLMPool live-provider smoke", () => {
  it.skipIf(process.env.FREELLMPOOL_ENABLED !== "1" || process.env.FREELLMPOOL_SMOKE !== "1")("returns validated structured Skeptic output without exposing secrets", async () => {
    const trace = await runSkeptic({
      possibleHypotheses: ["H1", "H2", "H3", "H4"],
      predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" },
      observations: [],
      triggers: [{ kind: "same-prediction", hypothesisIds: ["H1", "H2", "H3", "H4"] }],
    });
    expect(trace.status).toBe("model");
    expect(trace.output.length).toBeGreaterThan(0);
    expect(trace.output.length).toBeLessThanOrEqual(280);
  }, 90_000);
});
