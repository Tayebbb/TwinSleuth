import { HYPOTHESES, PROBE_OUTCOMES } from "../case/catalog.js";
import type { HypothesisId, OutcomeId, ProbeId } from "../case/catalog.js";
import type { DiagnosticModel, Observation, PredictionSet } from "./model.js";

export function consistentHypotheses(
  model: DiagnosticModel,
  observations: readonly Observation[],
): HypothesisId[] {
  return model.hypotheses
    .filter(({ id }) =>
      observations.every(({ probeId, outcomeId }) => model.forecasts[probeId][id] === outcomeId),
    )
    .map(({ id }) => id);
}

export function partitionByOutcome(
  model: DiagnosticModel,
  probeId: ProbeId,
  hypothesisIds: readonly HypothesisId[],
): Map<OutcomeId, HypothesisId[]> {
  const groups = new Map<OutcomeId, HypothesisId[]>();
  for (const hypothesisId of hypothesisIds) {
    const outcomeId = model.forecasts[probeId][hypothesisId];
    const group = groups.get(outcomeId) ?? [];
    group.push(hypothesisId);
    groups.set(outcomeId, group);
  }
  return groups;
}

export function separates(
  model: DiagnosticModel,
  probeId: ProbeId,
  hypothesisIds: readonly HypothesisId[],
): boolean {
  return hypothesisIds.length > 1 && partitionByOutcome(model, probeId, hypothesisIds).size > 1;
}

export type SkepticTrigger =
  | {
      readonly kind: "same-prediction";
      readonly hypothesisIds: readonly HypothesisId[];
      readonly predictedOutcome: OutcomeId;
    }
  | {
      readonly kind: "premature-elimination";
      readonly hypothesisIds: readonly HypothesisId[];
    };

export interface SkepticInput {
  readonly possibleHypotheses: readonly HypothesisId[];
  /** Derived by the server from rows the learner has already seen. */
  readonly evidenceSupportedHypotheses: readonly HypothesisId[];
  readonly predictions: PredictionSet;
}

/**
 * Pre-run triggers deliberately inspect learner predictions, not the forecast row
 * for the proposed probe. That keeps unrun outcomes private until the probe runs.
 */
export function detectSkepticTriggers(input: SkepticInput): SkepticTrigger[] {
  const triggers: SkepticTrigger[] = [];
  const { possibleHypotheses, evidenceSupportedHypotheses, predictions } = input;

  if (possibleHypotheses.length > 1) {
    const groups = new Map<OutcomeId, HypothesisId[]>();
    for (const hypothesisId of possibleHypotheses) {
      const predictedOutcome = predictions[hypothesisId];
      const group = groups.get(predictedOutcome) ?? [];
      group.push(hypothesisId);
      groups.set(predictedOutcome, group);
    }
    const shared = [...groups.entries()].find(([, hypothesisIds]) => hypothesisIds.length >= 2);
    if (shared) {
      triggers.push({
        kind: "same-prediction",
        hypothesisIds: shared[1],
        predictedOutcome: shared[0],
      });
    }
  }

  const supportedByEvidence = new Set(evidenceSupportedHypotheses);
  const prematurelyEliminated = HYPOTHESES
    .map(({ id }) => id)
    .filter((id) => supportedByEvidence.has(id) && !possibleHypotheses.includes(id));

  if (prematurelyEliminated.length > 0) {
    triggers.push({
      kind: "premature-elimination",
      hypothesisIds: prematurelyEliminated,
    });
  }

  return triggers;
}

export function validatePredictions(
  probeId: ProbeId,
  predictions: Readonly<Record<string, string>>,
): string[] {
  const expectedIds = HYPOTHESES.map(({ id }) => id);
  const receivedIds = Object.keys(predictions);
  const issues: string[] = [];

  const missing = expectedIds.filter((id) => !(id in predictions));
  const unknown = receivedIds.filter((id) => !expectedIds.includes(id as HypothesisId));
  if (missing.length > 0) issues.push(`Predictions must include every cause; missing ${missing.join(", ")}.`);
  if (unknown.length > 0) issues.push(`Unknown cause IDs: ${unknown.join(", ")}.`);

  const validOutcomes = PROBE_OUTCOMES[probeId] as readonly string[];
  for (const id of expectedIds) {
    const value = predictions[id];
    if (value !== undefined && !validOutcomes.includes(value)) {
      issues.push(`${id} has an outcome that is not available for ${probeId}.`);
    }
  }
  return issues;
}
