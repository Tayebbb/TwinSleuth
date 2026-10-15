import type { ArgumentClaim, Observation, PredictionSet } from "../../engine/model.js";

export interface SkepticAgentInput {
  readonly possibleHypotheses: readonly string[];
  readonly predictions: PredictionSet;
  readonly observations: readonly Observation[];
  readonly triggers: readonly { kind: string; hypothesisIds: readonly string[] }[];
}

export type TutorSkill = "design_discriminating_tests" | "separate_evidence_from_belief" | "plan_under_a_budget";

export interface AgentTrace {
  readonly graph: "skeptic" | "examiner" | "tutor";
  readonly status: "template" | "model" | "fallback";
  readonly inputSummary: string;
  readonly output: string;
  readonly skill?: TutorSkill;
  readonly revision?: number;
  readonly lesson?: string;
  readonly reflection?: string;
}

export interface ExaminerAgentInput {
  readonly diagnosis: string;
  readonly justification: string;
  readonly claims: readonly ArgumentClaim[];
  readonly claimChecks: readonly { hypothesisId: string; valid: boolean; reason: string }[];
}

export interface StructuredModelClient {
  invoke(prompt: string, graph: "skeptic" | "examiner" | "tutor"): Promise<unknown>;
}
