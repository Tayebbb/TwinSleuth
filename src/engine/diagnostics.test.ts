import { describe, expect, it } from "vitest";
import { HYPOTHESES } from "../case/catalog.js";
import { consistentHypotheses, detectSkepticTriggers, partitionByOutcome, validatePredictions } from "./diagnostics.js";
import { optimalPolicy, policyCostForTruth } from "./optimal-policy.js";
import { gradeEpisode } from "./score.js";
import { validateCase } from "./validate-case.js";
import { PIN9_MODEL } from "../server/case-model/pin9.js";

describe("PIN-9 diagnostic case", () => {
  it("validates every cause pair and fits the best policy inside the budget", () => {
    const result = validateCase(PIN9_MODEL);
    expect(result.ok).toBe(true);
    expect(Object.keys(result.pairSeparators)).toHaveLength(6);
    expect(result.expectedCostMinutes).toBe(12.5);
    expect(result.worstCaseCostMinutes).toBe(15);
  });

  it("chooses the 2-by-2 split first and distinguishes each hidden cause", () => {
    const policy = optimalPolicy(PIN9_MODEL);
    expect(policy.root).toMatchObject({ kind: "test", probeId: "P3" });
    expect(policyCostForTruth(PIN9_MODEL, policy, "H1")).toBe(15);
    expect(policyCostForTruth(PIN9_MODEL, policy, "H4")).toBe(15);
    expect(policyCostForTruth(PIN9_MODEL, policy, "H2")).toBe(10);
    expect(policyCostForTruth(PIN9_MODEL, policy, "H3")).toBe(10);
  });

  it("projects an observation to the correct evidence-supported cause set", () => {
    expect(consistentHypotheses(PIN9_MODEL, [
      { evidenceId: "e1", probeId: "P3", outcomeId: "completed" },
    ])).toEqual(["H1", "H4"]);
    expect(consistentHypotheses(PIN9_MODEL, [
      { evidenceId: "e1", probeId: "P3", outcomeId: "completed" },
      { evidenceId: "e2", probeId: "P4", outcomeId: "stopped-at-95" },
    ])).toEqual(["H1"]);
  });

  it("shows P1 as a non-informative retry and P3 as a balanced first probe", () => {
    expect(partitionByOutcome(PIN9_MODEL, "P1", HYPOTHESES.map(({ id }) => id)).size).toBe(1);
    expect(partitionByOutcome(PIN9_MODEL, "P3", HYPOTHESES.map(({ id }) => id))).toEqual(
      new Map([
        ["completed", ["H1", "H4"]],
        ["refused", ["H2", "H3"]],
      ]),
    );
  });

  it("requires one prediction for each public cause and valid probe outcomes", () => {
    expect(validatePredictions("P3", {
      H1: "completed", H2: "refused", H3: "refused", H4: "completed",
    })).toEqual([]);
    expect(validatePredictions("P3", { H1: "completed", H2: "refused", H3: "refused" })).toHaveLength(1);
    expect(validatePredictions("P3", {
      H1: "completed", H2: "refused", H3: "refused", H4: "out-of-reach",
    })).toHaveLength(1);
  });

  it("bases pre-run challenge signals only on learner predictions and already-revealed evidence", () => {
    const input = {
      possibleHypotheses: ["H1", "H2", "H3", "H4"] as const,
      evidenceSupportedHypotheses: ["H1", "H2", "H3", "H4"] as const,
      predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" } as const,
    };
    const first = detectSkepticTriggers(input);
    expect(first[0]?.kind).toBe("same-prediction");
    expect(Object.keys(input).sort()).toEqual([
      "evidenceSupportedHypotheses", "possibleHypotheses", "predictions",
    ]);
  });

  it("challenges a cause ruled out despite already-revealed evidence supporting it", () => {
    expect(detectSkepticTriggers({
      possibleHypotheses: ["H1"],
      evidenceSupportedHypotheses: ["H1", "H4"],
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    })).toContainEqual({ kind: "premature-elimination", hypothesisIds: ["H4"] });
  });

  it("does not challenge a balanced and informative split that matches the optimal P3 strategy", () => {
    expect(detectSkepticTriggers({
      possibleHypotheses: ["H1", "H2", "H3", "H4"],
      evidenceSupportedHypotheses: ["H1", "H2", "H3", "H4"],
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    })).toEqual([]);
  });

  it("challenges when any two possible causes share a prediction in a non-informative grouping", () => {
    expect(detectSkepticTriggers({
      possibleHypotheses: ["H1", "H2", "H3"],
      evidenceSupportedHypotheses: ["H1", "H2", "H3"],
      predictions: { H1: "refused", H2: "refused", H3: "completed", H4: "completed" },
    })[0]).toEqual({ kind: "same-prediction", hypothesisIds: ["H1", "H2"], predictedOutcome: "refused" });
  });

  it("rejects a case model whose probe cost or outcomes drift from the public catalog", () => {
    const wrongCost = {
      ...PIN9_MODEL,
      probes: PIN9_MODEL.probes.map((probe) => probe.id === "P3" ? { ...probe, costMinutes: 6 } : probe),
    };
    expect(validateCase(wrongCost).issues.join(" ")).toContain("P3 cost must match");

    const wrongOutcomes = {
      ...PIN9_MODEL,
      probes: PIN9_MODEL.probes.map((probe) => probe.id === "P3" ? { ...probe, outcomes: ["completed"] as const } : probe),
    };
    expect(validateCase(wrongOutcomes).issues.join(" ")).toContain("P3 outcomes must match");
  });

  it("rejects a non-finite diagnostic budget before policy calculations", () => {
    const result = validateCase({ ...PIN9_MODEL, budgetMinutes: Number.NaN });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("The diagnostic budget must be a finite positive number.");
    expect(result.expectedCostMinutes).toBeUndefined();
  });

  it("keeps every score component bounded and gives no free efficiency points without a probe", () => {
    const score = gradeEpisode(PIN9_MODEL, {
      truth: "H1",
      diagnosis: "H1",
      probes: [],
      predictionAttempts: [],
      claims: [],
      unsafeAttempts: 3,
    });
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.probeQuality).toBe(0);
    expect(score.predictionAccuracy).toBe(0);
    expect(score.reasoning).toBe(0);
    expect(score.bestPolicyBranchCostMinutes).toBe(15);
  });

  it("scores the first committed prediction for a challenged probe even when it is not run", () => {
    const score = gradeEpisode(PIN9_MODEL, {
      truth: "H1",
      diagnosis: "H1",
      probes: [],
      predictionAttempts: [{
        probeId: "P1",
        predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" },
      }],
      claims: [],
      unsafeAttempts: 0,
    });
    expect(score.correctPredictions).toBe(4);
    expect(score.predictionCount).toBe(4);
    expect(score.predictionAccuracy).toBe(15);
  });

  it("awards exactly 100 for a correct, efficient diagnosis with four evidence-backed claims", () => {
    const score = gradeEpisode(PIN9_MODEL, {
      truth: "H1",
      diagnosis: "H1",
      probes: [
        { evidenceId: "e1", probeId: "P3", outcomeId: "completed" },
        { evidenceId: "e2", probeId: "P4", outcomeId: "stopped-at-95" },
      ],
      predictionAttempts: [
        { probeId: "P3", predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" } },
        { probeId: "P4", predictions: { H1: "stopped-at-95", H2: "full-range", H3: "full-range", H4: "full-range" } },
      ],
      claims: [
        { hypothesisId: "H1", stance: "supports", evidenceIds: ["e2"] },
        { hypothesisId: "H2", stance: "rules_out", evidenceIds: ["e2"] },
        { hypothesisId: "H3", stance: "rules_out", evidenceIds: ["e2"] },
        { hypothesisId: "H4", stance: "rules_out", evidenceIds: ["e2"] },
      ],
      unsafeAttempts: 0,
    });
    expect(score).toMatchObject({
      total: 100,
      diagnosis: 35,
      evidenceSufficiency: 15,
      predictionAccuracy: 15,
      probeQuality: 20,
      reasoning: 15,
      actualCostMinutes: 15,
      bestPolicyBranchCostMinutes: 15,
    });
  });

  it("rejects duplicate prediction commits for one probe instead of allowing denominator gaming", () => {
    const attempt = {
      probeId: "P3" as const,
      predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" } as const,
    };
    expect(() => gradeEpisode(PIN9_MODEL, {
      truth: "H1",
      diagnosis: "H1",
      probes: [],
      predictionAttempts: [attempt, attempt],
      claims: [],
      unsafeAttempts: 0,
    })).toThrow("duplicate P3");
  });

  it("requires every cited observation in a rules-out claim to contradict that cause", () => {
    const score = gradeEpisode(PIN9_MODEL, {
      truth: "H1",
      diagnosis: "H1",
      probes: [
        { evidenceId: "e1", probeId: "P3", outcomeId: "completed" },
        { evidenceId: "e2", probeId: "P4", outcomeId: "stopped-at-95" },
      ],
      predictionAttempts: [
        { probeId: "P3", predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" } },
        { probeId: "P4", predictions: { H1: "stopped-at-95", H2: "full-range", H3: "full-range", H4: "full-range" } },
      ],
      claims: [
        { hypothesisId: "H1", stance: "supports", evidenceIds: ["e2"] },
        { hypothesisId: "H2", stance: "rules_out", evidenceIds: ["e1", "e2"] },
        { hypothesisId: "H3", stance: "rules_out", evidenceIds: ["e1", "e2"] },
        { hypothesisId: "H4", stance: "rules_out", evidenceIds: ["e1", "e2"] },
      ],
      unsafeAttempts: 0,
    });
    expect(score.claimChecks.find((claim) => claim.hypothesisId === "H4")?.valid).toBe(false);
  });
});
