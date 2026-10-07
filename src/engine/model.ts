import type { HypothesisId, OutcomeId, ProbeId } from "../case/catalog.js";

export interface DiagnosticModel {
  readonly hypotheses: readonly { readonly id: HypothesisId }[];
  readonly probes: readonly {
    readonly id: ProbeId;
    readonly costMinutes: number;
    readonly outcomes: readonly OutcomeId[];
  }[];
  readonly forecasts: Readonly<Record<ProbeId, Readonly<Record<HypothesisId, OutcomeId>>>>;
  readonly prior: Readonly<Record<HypothesisId, number>>;
  readonly budgetMinutes: number;
}

export interface Observation {
  readonly evidenceId: string;
  readonly probeId: ProbeId;
  readonly outcomeId: OutcomeId;
}

export type PredictionSet = Readonly<Record<HypothesisId, OutcomeId>>;

export interface ArgumentClaim {
  readonly hypothesisId: HypothesisId;
  readonly stance: "supports" | "rules_out";
  readonly evidenceIds: readonly string[];
}
