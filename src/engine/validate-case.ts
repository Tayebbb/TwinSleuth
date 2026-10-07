import { HYPOTHESES, PROBE_OUTCOMES, PROBES } from "../case/catalog.js";
import type { HypothesisId, ProbeId } from "../case/catalog.js";
import { optimalPolicy } from "./optimal-policy.js";
import type { DiagnosticModel } from "./model.js";
import { separates } from "./diagnostics.js";

export interface CaseValidation {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly pairSeparators: Readonly<Record<string, readonly ProbeId[]>>;
  readonly expectedCostMinutes?: number;
  readonly worstCaseCostMinutes?: number;
}

export function validateCase(model: DiagnosticModel): CaseValidation {
  const issues: string[] = [];
  const hypothesisIds = HYPOTHESES.map(({ id }) => id);
  const probeIds = PROBES.map(({ id }) => id);

  if (model.hypotheses.length !== hypothesisIds.length ||
      model.hypotheses.some(({ id }, i) => id !== hypothesisIds[i])) {
    issues.push("The model's hypotheses do not match the public case catalog.");
  }
  if (model.probes.length !== probeIds.length || model.probes.some(({ id }, i) => id !== probeIds[i])) {
    issues.push("The model's probes do not match the public case catalog.");
  }

  if (!Number.isFinite(model.budgetMinutes) || model.budgetMinutes <= 0) {
    issues.push("The diagnostic budget must be a finite positive number.");
  }

  for (const publicProbe of PROBES) {
    const probe = model.probes.find(({ id }) => id === publicProbe.id);
    if (!probe) continue;
    if (!Number.isFinite(probe.costMinutes) || probe.costMinutes !== publicProbe.costMinutes) {
      issues.push(`${publicProbe.id} cost must match the public case catalog (${publicProbe.costMinutes} minutes).`);
    }
    const publicOutcomes = PROBE_OUTCOMES[publicProbe.id] as readonly string[];
    if (probe.outcomes.length !== publicOutcomes.length ||
        probe.outcomes.some((outcome, index) => outcome !== publicOutcomes[index])) {
      issues.push(`${publicProbe.id} outcomes must match the public case catalog.`);
    }

    const row = model.forecasts[publicProbe.id];
    if (!row) {
      issues.push(`${publicProbe.id} has no forecast row.`);
      continue;
    }
    const rowIds = Object.keys(row).sort();
    if (rowIds.join(",") !== [...hypothesisIds].sort().join(",")) {
      issues.push(`${publicProbe.id} must have exactly one forecast for every hypothesis.`);
    }
    for (const hypothesisId of hypothesisIds) {
      const outcome = row[hypothesisId];
      if (outcome === undefined || !probe.outcomes.includes(outcome)) {
        issues.push(`${publicProbe.id}/${hypothesisId} has an invalid forecast outcome.`);
      }
    }
  }

  const forecastProbeIds = Object.keys(model.forecasts).sort();
  if (forecastProbeIds.join(",") !== [...probeIds].sort().join(",")) {
    issues.push("The forecast table must contain exactly the public probes.");
  }

  const priorTotal = hypothesisIds.reduce((sum, id) => sum + model.prior[id], 0);
  for (const id of hypothesisIds) {
    if (!Number.isFinite(model.prior[id]) || !(model.prior[id] > 0)) {
      issues.push(`${id} must have a finite positive prior probability.`);
    } else if (Math.abs(model.prior[id] - 1 / hypothesisIds.length) > 1e-9) {
      issues.push("This case requires a uniform prior across its four hypotheses.");
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

  const pairSeparators: Record<string, ProbeId[]> = {};
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

export function allHypothesisIds(): readonly HypothesisId[] {
  return HYPOTHESES.map(({ id }) => id);
}
