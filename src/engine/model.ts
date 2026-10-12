export interface DiagnosticModel {
  readonly hypotheses: readonly { readonly id: string }[];
  readonly probes: readonly {
    readonly id: string;
    readonly costMinutes: number;
    readonly outcomes: readonly string[];
  }[];
  readonly forecasts: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly prior: Readonly<Record<string, number>>;
  readonly budgetMinutes: number;
}

export interface Observation {
  readonly evidenceId: string;
  readonly probeId: string;
  readonly outcomeId: string;
}

export type PredictionSet = Readonly<Record<string, string>>;

export interface ArgumentClaim {
  readonly hypothesisId: string;
  readonly stance: "supports" | "rules_out";
  readonly evidenceIds: readonly string[];
}
