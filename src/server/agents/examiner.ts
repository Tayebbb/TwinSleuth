import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import type { AgentTrace, ExaminerAgentInput } from "./types.js";

const answerSchema = z.object({ feedback: z.string().min(1).max(500) });
const State = Annotation.Root({
  input: Annotation<ExaminerAgentInput>(),
  attempt: Annotation<number>({ reducer: (_, next) => next, default: () => 0 }),
  candidate: Annotation<string | undefined>(),
  trace: Annotation<AgentTrace | undefined>(),
});

export async function runExaminer(input: ExaminerAgentInput): Promise<AgentTrace> {
  const valid = input.claimChecks.filter((claim) => claim.valid).length;
  const output = `${valid} of ${input.claimChecks.length} evidence claims checked. Use the cited observations to explain why ${input.diagnosis} remains supported and alternatives are ruled out.`;
  const requestModel = async () => {
    if (!process.env.ANTHROPIC_API_KEY) return undefined;
    const model = new ChatAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.TWINSLEUTH_MODEL ?? "claude-sonnet-5-5", maxTokens: 300 }).withStructuredOutput(answerSchema, { method: "jsonSchema" });
    const result = await model.invoke(`Give concise evidence-linked feedback for diagnosis ${input.diagnosis}. Valid checked claims: ${valid}/${input.claimChecks.length}. Do not score, infer hidden truth, or cite IDs not supplied.`);
    return result.feedback;
  };
  const graph = new StateGraph(State)
    .addNode("generate", async (state) => { try { return { candidate: await requestModel(), attempt: state.attempt + 1 }; } catch { return { candidate: undefined, attempt: state.attempt + 1 }; } })
    .addNode("feedback", async (state) => {
      if (state.candidate) return { trace: { graph: "examiner" as const, status: "model" as const, inputSummary: `${input.diagnosis}|${valid}/${input.claimChecks.length}`, output: state.candidate.slice(0, 500) } };
      if (!process.env.ANTHROPIC_API_KEY) return { trace: { graph: "examiner" as const, status: "template" as const, inputSummary: `${input.diagnosis}|${valid}/${input.claimChecks.length}`, output: output.slice(0, 500) } };
      return {};
    })
    .addConditionalEdges("feedback", (state) => state.trace ? END : state.attempt < 2 ? "generate" : "fallback")
    .addNode("fallback", async () => ({ trace: { graph: "examiner" as const, status: "fallback" as const, inputSummary: `${input.diagnosis}|${valid}/${input.claimChecks.length}`, output: output.slice(0, 500) } }))
    .addEdge(START, "generate")
    .addEdge("generate", "feedback")
    .compile();
  const result = await graph.invoke({ input });
  if (!result.trace) throw new Error("Examiner graph returned no trace.");
  return result.trace;
}
