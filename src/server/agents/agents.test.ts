import { describe, expect, it } from "vitest";
import { runExaminer } from "./examiner.js";
import { runSkeptic } from "./skeptic.js";
import type { StructuredModelClient } from "./types.js";

function sequenceClient(results: readonly unknown[]) {
  const prompts: string[] = [];
  let calls = 0;
  const client: StructuredModelClient = {
    async invoke(prompt) {
      prompts.push(prompt);
      const result = results[calls++];
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return { client, prompts, calls: () => calls };
}

const skepticInput = {
  possibleHypotheses: ["H1", "H2", "H3", "H4"] as const,
  predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" } as const,
  observations: [],
  triggers: [{ kind: "same-prediction", hypothesisIds: ["H1", "H2"] as const }],
};

const examinerInput = {
  diagnosis: "H1" as const,
  justification: "The joint stopped at 95 degrees.",
  claims: [],
  claimChecks: [{ hypothesisId: "H1" as const, valid: true, reason: "checked" }],
};

describe("template agent privacy boundaries", () => {
  it("keeps Skeptic template inputs independent of hidden truth and unrun forecasts", async () => {
    const traces = await Promise.all(["H1", "H2", "H3", "H4"].map(() => runSkeptic(skepticInput)));
    expect(new Set(traces.map((trace) => JSON.stringify(trace))).size).toBe(1);
    expect(traces[0]?.status).toBe("template");
    expect(traces[0]?.inputSummary).toBe("H1,H2,H3,H4|");
    expect(traces[0]?.output).not.toMatch(/P[1-6]|completed|refused|stopped at|full range|reachable|overlap/i);
    expect(traces[0]?.output).not.toContain("completed");
  });

  it("explains premature-elimination challenges without inventing a shared prediction", async () => {
    const trace = await runSkeptic({
      ...skepticInput,
      possibleHypotheses: ["H1", "H3", "H4"],
      triggers: [{ kind: "premature-elimination", hypothesisIds: ["H2"] }],
    });
    expect(trace.status).toBe("template");
    expect(trace.output).toContain("revealed evidence still supports H2");
    expect(trace.output).toContain("What observed result justifies ruling it out?");
    expect(trace.output).not.toContain("same result");
  });

  it("keeps Examiner template feedback tied to checked claims only", async () => {
    const trace = await runExaminer(examinerInput);
    expect(trace.status).toBe("template");
    expect(trace.output).toContain("1 of 1 evidence claims checked");
    expect(trace.output).not.toContain("truth");
  });

  it("never accepts model text for the Skeptic, even when it contains a diagnosis", async () => {
    const model = sequenceClient([{ question: "Diagnosis: H1; run P4." }]);
    const trace = await runSkeptic(skepticInput, model.client);
    expect(trace.status).toBe("template");
    expect(trace.output).not.toContain("Diagnosis");
    expect(trace.output).not.toContain("H1;");
    expect(model.calls()).toBe(0);
  });

  it("runs, retries, and falls back through the Examiner LangGraph", async () => {
    const retryModel = sequenceClient([{ feedback: "" }, { feedback: "Strength: evidence is cited. Improve by naming the excluded alternatives." }]);
    const modelTrace = await runExaminer(examinerInput, retryModel.client);
    expect(modelTrace.status).toBe("model");
    expect(retryModel.calls()).toBe(2);
    expect(retryModel.prompts[0]).toContain("Checked claims:");
    expect(retryModel.prompts[0]).not.toContain("hidden truth");

    const failingModel = sequenceClient([{ nope: true }, { feedback: "x".repeat(501) }]);
    const fallbackTrace = await runExaminer(examinerInput, failingModel.client);
    expect(fallbackTrace.status).toBe("fallback");
    expect(failingModel.calls()).toBe(2);
  });
});
