import { optimalPolicy } from "./optimal-policy.js";
import type { DiagnosticModel } from "./model.js";
import { separates } from "./diagnostics.js";

export interface CaseValidation {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly pairSeparators: Readonly<Record<string, readonly string[]>>;
  readonly expectedCostMinutes?: number;
  readonly worstCaseCostMinutes?: number;
}

export function validateCase(model: DiagnosticModel): CaseValidation {
  const issues: string[] = [];
  const hypothesisIds = model.hypotheses.map(({ id }) => id);
  const probeIds = model.probes.map(({ id }) => id);
  if (hypothesisIds.length < 2 || new Set(hypothesisIds).size !== hypothesisIds.length) issues.push("A case needs at least two uniquely identified hypotheses.");
  if (probeIds.length < 1 || new Set(probeIds).size !== probeIds.length) issues.push("A case needs uniquely identified probes.");

  if (!Number.isFinite(model.budgetMinutes) || model.budgetMinutes <= 0) {
    issues.push("The diagnostic budget must be a finite positive number.");
  }

  for (const probe of model.probes) {
    if (!Number.isFinite(probe.costMinutes) || probe.costMinutes <= 0) issues.push(`${probe.id} cost must be finite and positive.`);
    if (probe.outcomes.length < 2 || new Set(probe.outcomes).size !== probe.outcomes.length) issues.push(`${probe.id} needs at least two unique prediction outcomes to keep its unrun forecast private.`);

    const row = model.forecasts[probe.id];
    if (!row) {
      issues.push(`${probe.id} has no forecast row.`);
      continue;
    }
    const rowIds = Object.keys(row).sort();
    if (rowIds.join(",") !== [...hypothesisIds].sort().join(",")) {
      issues.push(`${probe.id} must have exactly one forecast for every hypothesis.`);
    }
    for (const hypothesisId of hypothesisIds) {
      const outcome = row[hypothesisId];
      if (outcome === undefined || !probe.outcomes.includes(outcome)) {
        issues.push(`${probe.id}/${hypothesisId} has an invalid forecast outcome.`);
      }
    }
  }

  const forecastProbeIds = Object.keys(model.forecasts).sort();
  if (forecastProbeIds.join(",") !== [...probeIds].sort().join(",")) {
    issues.push("The forecast table must contain exactly the public probes.");
  }

  const priorTotal = hypothesisIds.reduce((sum, id) => sum + model.prior[id]!, 0);
  for (const id of hypothesisIds) {
    if (!Number.isFinite(model.prior[id]) || !(model.prior[id]! > 0)) {
      issues.push(`${id} must have a finite positive prior probability.`);
    } else if (Math.abs(model.prior[id]! - 1 / hypothesisIds.length) > 1e-9) {
      issues.push("This case requires a uniform prior across its hypotheses.");
    }
  }
  const priorIds = Object.keys(model.prior).sort();
  if (priorIds.join(",") !== [...hypothesisIds].sort().join(",")) {
    issues.push("The prior must contain exactly the public hypotheses.");
  }
  if (!Number.isFinite(priorTotal) || Math.abs(priorTotal - 1) > 1e-9) {
    issues.push(`Fault prior probabilities must sum to 1; received ${priorTotal}.`);
  }

  // Pairwise calculations assume the public rows, outcomes, and prior are structurally valid.
  if (issues.length > 0) return { ok: false, issues, pairSeparators: {} };

  const pairSeparators: Record<string, string[]> = {};
  for (let i = 0; i < hypothesisIds.length; i += 1) {
    for (let j = i + 1; j < hypothesisIds.length; j += 1) {
      const left = hypothesisIds[i]!;
      const right = hypothesisIds[j]!;
      const key = `${left}/${right}`;
      const separators = probeIds.filter((probeId) => separates(model, probeId, [left, right]));
      pairSeparators[key] = separators;
      if (separators.length === 0) issues.push(`${key} cannot be distinguished by any probe.`);
    }
  }

  if (issues.length > 0) return { ok: false, issues, pairSeparators };

  try {
    const policy = optimalPolicy(model, model.budgetMinutes);
    if (policy.worstCaseCostMinutes > model.budgetMinutes) {
      issues.push(`Worst-case policy costs ${policy.worstCaseCostMinutes} minutes, over the budget.`);
    }
    return {
      ok: issues.length === 0,
      issues,
      pairSeparators,
      expectedCostMinutes: policy.expectedCostMinutes,
      worstCaseCostMinutes: policy.worstCaseCostMinutes,
    };
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Unable to compute a diagnosis policy.");
    return { ok: false, issues, pairSeparators };
  }
}

export function allHypothesisIds(model: DiagnosticModel): readonly string[] {
  return model.hypotheses.map(({ id }) => id);
}
