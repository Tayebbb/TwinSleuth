import { HYPOTHESES } from "../case/catalog.js";
import type { HypothesisId } from "../case/catalog.js";
import { consistentHypotheses, separates, validatePredictions } from "./diagnostics.js";
import type { ArgumentClaim, DiagnosticModel, Observation, PredictionSet } from "./model.js";
import { optimalPolicy, policyCostForTruth } from "./optimal-policy.js";

export interface PredictionAttempt {
  /** Use the first committed prediction set for each unique proposed probe. */
  readonly probeId: Observation["probeId"];
  readonly predictions: PredictionSet;
}

export interface GradeInput {
  readonly truth: HypothesisId;
  readonly diagnosis: HypothesisId;
  readonly probes: readonly Observation[];
  readonly predictionAttempts: readonly PredictionAttempt[];
  readonly claims: readonly ArgumentClaim[];
  readonly unsafeAttempts: number;
}

export interface GradeBreakdown {
  readonly total: number;
  readonly diagnosis: number;
  readonly evidenceSufficiency: number;
  readonly predictionAccuracy: number;
  readonly probeQuality: number;
  readonly reasoning: number;
  readonly correctPredictions: number;
  readonly predictionCount: number;
  readonly informativeProbeCount: number;
  readonly probeCount: number;
  readonly actualCostMinutes: number;
  readonly bestPolicyBranchCostMinutes: number;
  readonly validReasoningClaims: number;
  readonly reasoningClaimCount: number;
  readonly evidenceSupportedHypotheses: readonly HypothesisId[];
  readonly claimChecks: readonly {
    readonly hypothesisId: HypothesisId;
    readonly stance: "supports" | "rules_out";
    readonly valid: boolean;
    readonly reason: string;
  }[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function checkClaims(
  model: DiagnosticModel,
  diagnosis: HypothesisId,
  probes: readonly Observation[],
  claims: readonly ArgumentClaim[],
): GradeBreakdown["claimChecks"] {
  const evidenceById = new Map(probes.map((probe) => [probe.evidenceId, probe]));
  const allEvidenceSupportsDiagnosis = consistentHypotheses(model, probes).includes(diagnosis);
  return HYPOTHESES.map(({ id }) => {
    const expectedStance = id === diagnosis ? "supports" : "rules_out";
    const matching = claims.filter((claim) => claim.hypothesisId === id);
    const claim = matching.length === 1 ? matching[0] : undefined;
    if (!claim) {
      return {
        hypothesisId: id,
        stance: expectedStance,
        valid: false,
        reason: matching.length > 1 ? "Use one evidence claim for this cause." : "No evidence claim was submitted.",
      };
    }
    if (claim.stance !== expectedStance) {
      return { hypothesisId: id, stance: expectedStance, valid: false, reason: `This cause should be marked ${expectedStance === "supports" ? "supported" : "ruled out"} in your argument.` };
    }
    const cited = claim.evidenceIds.map((evidenceId) => evidenceById.get(evidenceId)).filter((probe) => probe !== undefined);
    if (cited.length === 0 || cited.length !== claim.evidenceIds.length) {
      return { hypothesisId: id, stance: expectedStance, valid: false, reason: "Cite at least one observation from this episode." };
    }
    if (expectedStance === "rules_out") {
      const contradiction = cited.every((probe) => model.forecasts[probe.probeId][id] !== probe.outcomeId);
      return contradiction
        ? { hypothesisId: id, stance: expectedStance, valid: true, reason: "A cited observation contradicts this cause." }
        : { hypothesisId: id, stance: expectedStance, valid: false, reason: "The cited observations do not contradict this cause." };
    }

    const supportedByDiscriminatingEvidence = allEvidenceSupportsDiagnosis && cited.some((probe) => {
      if (model.forecasts[probe.probeId][id] !== probe.outcomeId) return false;
      return HYPOTHESES.some(({ id: otherId }) =>
        otherId !== id && model.forecasts[probe.probeId][otherId] !== probe.outcomeId,
      );
    });
    return supportedByDiscriminatingEvidence
      ? { hypothesisId: id, stance: expectedStance, valid: true, reason: "A cited observation supports this cause and distinguishes it from an alternative." }
      : { hypothesisId: id, stance: expectedStance, valid: false, reason: "The cited observations do not distinguish this cause from an alternative." };
  });
}

export function gradeEpisode(model: DiagnosticModel, input: GradeInput): GradeBreakdown {
  const hypothesisIds = model.hypotheses.map(({ id }) => id);
  if (!hypothesisIds.includes(input.truth) || !hypothesisIds.includes(input.diagnosis)) {
    throw new Error("The hidden cause and submitted diagnosis must be valid case hypotheses.");
  }
  if (!Number.isSafeInteger(input.unsafeAttempts) || input.unsafeAttempts < 0) {
    throw new Error("Unsafe attempt count must be a non-negative integer.");
  }

  let correctPredictions = 0;
  let predictionCount = 0;
  let informativeProbeCount = 0;
  let actualCostMinutes = 0;
  let priorObservations: Observation[] = [];
  const observedProbeIds = new Set<string>();
  const evidenceIds = new Set<string>();

  for (const run of input.probes) {
    const probeSpec = model.probes.find(({ id }) => id === run.probeId);
    if (!probeSpec) throw new Error(`Unknown probe ${run.probeId}.`);
    if (observedProbeIds.has(run.probeId)) throw new Error(`Probe ${run.probeId} may only run once per episode.`);
    if (evidenceIds.has(run.evidenceId)) throw new Error(`Duplicate evidence ID ${run.evidenceId}.`);
    if (!probeSpec.outcomes.includes(run.outcomeId)) {
      throw new Error(`Invalid observed outcome ${run.outcomeId} for ${run.probeId}.`);
    }
    if (model.forecasts[run.probeId][input.truth] !== run.outcomeId) {
      throw new Error(`Stored observation ${run.evidenceId} does not match the server-owned case truth.`);
    }
    observedProbeIds.add(run.probeId);
    evidenceIds.add(run.evidenceId);
    actualCostMinutes += probeSpec.costMinutes;
    const candidatesBefore = consistentHypotheses(model, priorObservations);
    if (separates(model, run.probeId, candidatesBefore)) informativeProbeCount += 1;
    priorObservations = [...priorObservations, run];
  }
  if (actualCostMinutes > model.budgetMinutes) {
    throw new Error(`Probe runs cost ${actualCostMinutes} minutes, over the ${model.budgetMinutes}-minute budget.`);
  }

  const predictedProbeIds = new Set<string>();
  for (const attempt of input.predictionAttempts) {
    if (!model.probes.some(({ id }) => id === attempt.probeId)) {
      throw new Error(`Unknown probe ${attempt.probeId} in prediction attempt.`);
    }
    if (predictedProbeIds.has(attempt.probeId)) {
      throw new Error(`Prediction accuracy accepts one first-commit table per probe; duplicate ${attempt.probeId}.`);
    }
    predictedProbeIds.add(attempt.probeId);
    const predictionIssues = validatePredictions(attempt.probeId, attempt.predictions);
    if (predictionIssues.length > 0) {
      throw new Error(`Invalid prediction table for ${attempt.probeId}: ${predictionIssues.join(" ")}`);
    }
    for (const { id } of model.hypotheses) {
      predictionCount += 1;
      if (attempt.predictions[id] === model.forecasts[attempt.probeId][id]) correctPredictions += 1;
    }
  }
  for (const probeId of observedProbeIds) {
    if (!predictedProbeIds.has(probeId)) {
      throw new Error(`Probe ${probeId} has no committed prediction table.`);
    }
  }

  const evidenceSupportedHypotheses = consistentHypotheses(model, input.probes);
  const policy = optimalPolicy(model, model.budgetMinutes);
  const bestPolicyBranchCostMinutes = policyCostForTruth(model, policy, input.truth);
  const probeCount = input.probes.length;
  const predictionAccuracy = predictionCount === 0 ? 0 : (15 * correctPredictions) / predictionCount;
  const informativePoints = probeCount === 0 ? 0 : 12 * (informativeProbeCount / probeCount);
  const costEfficiencyPoints = actualCostMinutes === 0
    ? 0
    : 8 * clamp(bestPolicyBranchCostMinutes / actualCostMinutes, 0, 1);
  const probeQuality = clamp(
    informativePoints + costEfficiencyPoints - 10 * Math.max(0, input.unsafeAttempts),
    0,
    20,
  );

  const claimChecks = checkClaims(model, input.diagnosis, input.probes, input.claims);
  const validReasoningClaims = claimChecks.filter(({ valid }) => valid).length;
  const reasoningClaimCount = HYPOTHESES.length;
  const reasoning = (15 * validReasoningClaims) / reasoningClaimCount;
  const diagnosis = input.truth === input.diagnosis ? 35 : 0;
  const evidenceSufficiency = evidenceSupportedHypotheses.length === 1 ? 15 : 0;
  const total = clamp(
    diagnosis + evidenceSufficiency + predictionAccuracy + probeQuality + reasoning,
    0,
    100,
  );

  return {
    total: Number(total.toFixed(2)),
    diagnosis,
    evidenceSufficiency,
    predictionAccuracy: Number(predictionAccuracy.toFixed(2)),
    probeQuality: Number(probeQuality.toFixed(2)),
    reasoning: Number(reasoning.toFixed(2)),
    correctPredictions,
    predictionCount,
    informativeProbeCount,
    probeCount,
    actualCostMinutes,
    bestPolicyBranchCostMinutes,
    validReasoningClaims,
    reasoningClaimCount,
    evidenceSupportedHypotheses,
    claimChecks,
  };
}
