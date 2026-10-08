import type { ArgumentClaim, Observation, PredictionSet } from "../../engine/model.js";
import type { HypothesisId } from "../../case/catalog.js";

export interface SkepticAgentInput {
  readonly possibleHypotheses: readonly HypothesisId[];
  readonly predictions: PredictionSet;
  readonly observations: readonly Observation[];
  readonly triggers: readonly { kind: string; hypothesisIds: readonly HypothesisId[] }[];
}

export interface AgentTrace {
  readonly graph: "skeptic" | "examiner";
  readonly status: "template" | "model" | "fallback";
  readonly inputSummary: string;
  readonly output: string;
}

export interface ExaminerAgentInput {
  readonly diagnosis: HypothesisId;
  readonly justification: string;
  readonly claims: readonly ArgumentClaim[];
  readonly claimChecks: readonly { hypothesisId: HypothesisId; valid: boolean; reason: string }[];
}

export interface StructuredModelClient {
  invoke(prompt: string, graph: "skeptic" | "examiner"): Promise<unknown>;
}
