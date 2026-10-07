import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import type { SkepticAgentInput, AgentTrace } from "./types.js";

const answerSchema = z.object({ question: z.string().min(1).max(280) });
const State = Annotation.Root({
  input: Annotation<SkepticAgentInput>(),
  attempt: Annotation<number>({ reducer: (_, next) => next, default: () => 0 }),
  candidate: Annotation<string | undefined>(),
  trace: Annotation<AgentTrace | undefined>(),
});

function templateQuestion(input: SkepticAgentInput): string {
  const ids = input.triggers[0]?.hypothesisIds.join(" and ") ?? "these causes";
  return `Your predictions give ${ids} the same result. What would this probe actually eliminate, and what would remain ambiguous?`;
}

async function requestModel(input: SkepticAgentInput): Promise<string | undefined> {
  if (!process.env.ANTHROPIC_API_KEY) return undefined;
  const model = new ChatAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.TWINSLEUTH_MODEL ?? "claude-sonnet-5-5",
    maxTokens: 180,
  }).withStructuredOutput(answerSchema, { method: "jsonSchema" });
  const result = await model.invoke(`Ask one Socratic question about these learner predictions. Do not reveal an answer, truth, or model forecast. Causes: ${input.possibleHypotheses.join(",")}. Triggers: ${input.triggers.map((trigger) => trigger.kind).join(",")}.`);
  return result.question;
}

export async function runSkeptic(input: SkepticAgentInput): Promise<AgentTrace> {
  const graph = new StateGraph(State)
    .addNode("generate", async (state) => {
      try { return { candidate: await requestModel(state.input), attempt: state.attempt + 1 }; }
      catch { return { candidate: undefined, attempt: state.attempt + 1 }; }
    })
    .addNode("validate", async (state) => {
      const valid = typeof state.candidate === "string" && state.candidate.length <= 280;
      if (valid) return { trace: { graph: "skeptic" as const, status: "model" as const, inputSummary: `${state.input.possibleHypotheses.join(",")}|${state.input.observations.map((o) => o.evidenceId).join(",")}`, output: state.candidate!.trim() } };
      if (!process.env.ANTHROPIC_API_KEY) return { trace: { graph: "skeptic" as const, status: "template" as const, inputSummary: `${state.input.possibleHypotheses.join(",")}|${state.input.observations.map((o) => o.evidenceId).join(",")}`, output: templateQuestion(state.input).slice(0, 280) } };
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
