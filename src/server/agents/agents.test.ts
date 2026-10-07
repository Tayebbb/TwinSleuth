import { describe, expect, it } from "vitest";
import { runExaminer } from "./examiner.js";
import { runSkeptic } from "./skeptic.js";

describe("template agent privacy boundaries", () => {
  it("keeps Skeptic template inputs independent of hidden truth and unrun forecasts", async () => {
    const input = {
      possibleHypotheses: ["H1", "H2", "H3", "H4"] as const,
      predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" } as const,
      observations: [],
      triggers: [{ kind: "same-prediction", hypothesisIds: ["H1", "H2"] as const }],
    };
    const traces = await Promise.all(["H1", "H2", "H3", "H4"].map(() => runSkeptic(input)));
    expect(new Set(traces.map((trace) => JSON.stringify(trace))).size).toBe(1);
    expect(traces[0]?.status).toBe("template");
    expect(traces[0]?.inputSummary).toBe("H1,H2,H3,H4|");
    expect(traces[0]?.output).not.toContain("completed");
  });

  it("keeps Examiner template feedback tied to checked claims only", async () => {
    const trace = await runExaminer({
      diagnosis: "H1",
      justification: "The joint stopped at 95 degrees.",
      claims: [],
      claimChecks: [{ hypothesisId: "H1", valid: true, reason: "checked" }],
    });
    expect(trace.status).toBe("template");
    expect(trace.output).toContain("1 of 1 evidence claims checked");
    expect(trace.output).not.toContain("truth");
  });
});
