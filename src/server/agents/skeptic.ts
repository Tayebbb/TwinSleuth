import type { SkepticAgentInput, AgentTrace, StructuredModelClient } from "./types.js";

function templateQuestion(input: SkepticAgentInput): string {
  const trigger = input.triggers[0];
  if (trigger?.kind === "premature-elimination") {
    const ids = trigger.hypothesisIds.join(" and ") || "a cause";
    return `Your revealed evidence still supports ${ids}, but your current set removes ${ids}. What observed result justifies ruling it out?`;
  }
  const ids = trigger?.hypothesisIds.join(" and ") ?? "these causes";
  return `Your predictions give ${ids} the same result. What would this probe actually eliminate, and what would remain ambiguous?`;
}

/**
 * The Skeptic has a narrow safety contract: it may only ask a question based
 * on public learner state. A generative answer cannot be reliably proven not
 * to disclose a diagnosis, so this intentionally stays deterministic.
 */
export function runSkeptic(input: SkepticAgentInput, _client?: StructuredModelClient): AgentTrace {
  return {
    graph: "skeptic",
    status: "template",
    inputSummary: `${input.possibleHypotheses.join(",")}|${input.observations.map((observation) => observation.evidenceId).join(",")}`,
    output: templateQuestion(input).slice(0, 280),
  };
}
