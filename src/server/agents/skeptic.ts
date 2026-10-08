import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { z } from "zod";
import { defaultFreeLLMpoolClient } from "./freellmpool.js";
import type { SkepticAgentInput, AgentTrace, StructuredModelClient } from "./types.js";

const answerSchema = z.object({ question: z.string().min(1).max(280) });
const State = Annotation.Root({
  input: Annotation<SkepticAgentInput>(),
  attempt: Annotation<number>({ reducer: (_, next) => next, default: () => 0 }),
  candidate: Annotation<string | undefined>(),
  trace: Annotation<AgentTrace | undefined>(),
});

function templateQuestion(input: SkepticAgentInput): string {
  const trigger = input.triggers[0];
  if (trigger?.kind === "premature-elimination") {
    const ids = trigger.hypothesisIds.join(" and ") || "a cause";
    return `Your revealed evidence still supports ${ids}, but your current set removes ${ids}. What observed result justifies ruling it out?`;
  }
  const ids = trigger?.hypothesisIds.join(" and ") ?? "these causes";
  return `Your predictions give ${ids} the same result. What would this probe actually eliminate, and what would remain ambiguous?`;
}

function promptFor(input: SkepticAgentInput): string {
  return [
    "You are the TwinSleuth Skeptic. Ask exactly one Socratic question of at most 280 characters.",
    "Do not state a diagnosis, hidden truth, model forecast, score, or recommendation.",
    `Learner-possible causes: ${input.possibleHypotheses.join(", ")}`,
    `Learner predictions: ${Object.entries(input.predictions).map(([id, outcome]) => `${id}:${outcome}`).join(", ")}`,
    `Already revealed evidence: ${input.observations.length ? input.observations.map(({ evidenceId, probeId, outcomeId }) => `${evidenceId}:${probeId}:${outcomeId}`).join(", ") : "none"}`,
    `Deterministic triggers: ${input.triggers.map((trigger) => `${trigger.kind}:${trigger.hypothesisIds.join("+")}${"predictedOutcome" in trigger ? `=${trigger.predictedOutcome}` : ""}`).join(", ")}`,
    "Focus on what the test can eliminate and what ambiguity remains.",
  ].join("\n");
}

function defaultClient(): StructuredModelClient | undefined {
  return defaultFreeLLMpoolClient();
}

export async function runSkeptic(input: SkepticAgentInput, client = defaultClient()): Promise<AgentTrace> {
  const graph = new StateGraph(State)
    .addNode("generate", async (state) => {
      try { return { candidate: client ? await client.invoke(promptFor(state.input), "skeptic") : undefined, attempt: state.attempt + 1 }; }
      catch { return { candidate: undefined, attempt: state.attempt + 1 }; }
    })
    .addNode("validate", async (state) => {
      const parsed = answerSchema.safeParse(state.candidate);
      if (parsed.success) return { trace: { graph: "skeptic" as const, status: "model" as const, inputSummary: `${state.input.possibleHypotheses.join(",")}|${state.input.observations.map((o) => o.evidenceId).join(",")}`, output: parsed.data.question.trim() } };
      if (!client) return { trace: { graph: "skeptic" as const, status: "template" as const, inputSummary: `${state.input.possibleHypotheses.join(",")}|${state.input.observations.map((o) => o.evidenceId).join(",")}`, output: templateQuestion(state.input).slice(0, 280) } };
      return {};
    })
    .addConditionalEdges("validate", (state) => state.trace ? END : state.attempt < 2 ? "generate" : "fallback")
    .addNode("fallback", async (state) => ({ trace: { graph: "skeptic" as const, status: "fallback" as const, inputSummary: `${state.input.possibleHypotheses.join(",")}|${state.input.observations.map((o) => o.evidenceId).join(",")}`, output: templateQuestion(state.input).slice(0, 280) } }))
    .addEdge(START, "generate")
    .addEdge("generate", "validate")
    .compile();
  const result = await graph.invoke({ input });
  if (!result.trace) throw new Error("Skeptic graph returned no trace.");
  return result.trace;
}
