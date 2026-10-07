import type { HypothesisId, OutcomeId, ProbeId } from "../case/catalog.js";
import { partitionByOutcome, separates } from "./diagnostics.js";
import type { DiagnosticModel } from "./model.js";

export type PolicyNode =
  | { readonly kind: "diagnose"; readonly hypothesisId: HypothesisId }
  | {
      readonly kind: "test";
      readonly probeId: ProbeId;
      readonly costMinutes: number;
      readonly branches: Readonly<Partial<Record<OutcomeId, PolicyNode>>>;
    };

export interface OptimalPolicy {
  readonly root: PolicyNode;
  readonly expectedCostMinutes: number;
  readonly worstCaseCostMinutes: number;
  readonly prior: Readonly<Record<HypothesisId, number>>;
}

interface Plan {
  readonly node: PolicyNode;
  readonly expectedCost: number;
  readonly worstCost: number;
}

function probabilityMass(model: DiagnosticModel, ids: readonly HypothesisId[]): number {
  return ids.reduce((total, id) => total + model.prior[id], 0);
}

export function optimalPolicy(model: DiagnosticModel, budgetMinutes = model.budgetMinutes): OptimalPolicy {
  const memo = new Map<string, Plan | null>();

  function solve(
    ids: readonly HypothesisId[],
    remainingBudget: number,
    used: readonly ProbeId[],
  ): Plan | null {
    if (ids.length === 1) {
      return { node: { kind: "diagnose", hypothesisId: ids[0]! }, expectedCost: 0, worstCost: 0 };
    }
    if (ids.length === 0) return null;

    const key = `${[...ids].sort().join("")}|${remainingBudget}|${[...used].sort().join("")}`;
    if (memo.has(key)) return memo.get(key)!;

    let best: Plan | null = null;
    for (const probe of model.probes) {
      if (used.includes(probe.id) || probe.costMinutes > remainingBudget) continue;
      if (!separates(model, probe.id, ids)) continue;

      const groups = partitionByOutcome(model, probe.id, ids);
      const mass = probabilityMass(model, ids);
      let expectedCost = probe.costMinutes;
      let worstCost = probe.costMinutes;
      const branches: Partial<Record<OutcomeId, PolicyNode>> = {};
      let feasible = true;

      for (const [outcomeId, group] of groups) {
        const child = solve(group, remainingBudget - probe.costMinutes, [...used, probe.id]);
        if (!child) {
          feasible = false;
          break;
        }
        branches[outcomeId] = child.node;
        expectedCost += (probabilityMass(model, group) / mass) * child.expectedCost;
        worstCost = Math.max(worstCost, probe.costMinutes + child.worstCost);
      }

      if (!feasible) continue;
      const candidate: Plan = {
        node: { kind: "test", probeId: probe.id, costMinutes: probe.costMinutes, branches },
        expectedCost,
        worstCost,
      };
      if (
        best === null ||
        candidate.expectedCost < best.expectedCost ||
        (candidate.expectedCost === best.expectedCost && candidate.worstCost < best.worstCost)
      ) {
        best = candidate;
      }
    }

    memo.set(key, best);
    return best;
  }

  const allIds = model.hypotheses.map(({ id }) => id);
  const plan = solve(allIds, budgetMinutes, []);
  if (!plan) throw new Error(`No diagnosis policy fits within ${budgetMinutes} minutes.`);

  return {
    root: plan.node,
    expectedCostMinutes: plan.expectedCost,
    worstCaseCostMinutes: plan.worstCost,
    prior: model.prior,
  };
}

export function policyCostForTruth(
  model: DiagnosticModel,
  policy: OptimalPolicy,
  truth: HypothesisId,
): number {
  let node = policy.root;
  let total = 0;
  while (node.kind === "test") {
    total += node.costMinutes;
    const outcome = model.forecasts[node.probeId][truth];
    const next = node.branches[outcome];
    if (!next) throw new Error(`Policy has no ${outcome} branch for ${node.probeId}.`);
    node = next;
  }
  return total;
}
