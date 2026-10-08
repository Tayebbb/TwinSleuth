import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { z } from "zod";
import { defaultFreeLLMpoolClient } from "./freellmpool.js";
import type { AgentTrace, ExaminerAgentInput, StructuredModelClient } from "./types.js";

const answerSchema = z.object({ feedback: z.string().min(1).max(500) });
const State = Annotation.Root({
  input: Annotation<ExaminerAgentInput>(),
  attempt: Annotation<number>({ reducer: (_, next) => next, default: () => 0 }),
  candidate: Annotation<string | undefined>(),
  trace: Annotation<AgentTrace | undefined>(),
});

function promptFor(input: ExaminerAgentInput): string {
  return [
    "You are the TwinSleuth Examiner. Give concise evidence-linked feedback of at most 500 characters.",
    "Do not award points, alter the diagnosis, infer an unrevealed cause, or cite IDs not supplied.",
    `Diagnosis: ${input.diagnosis}`,
    `Learner justification: ${input.justification}`,
    `Checked claims: ${input.claimChecks.map((claim) => `${claim.hypothesisId}:${claim.valid ? "valid" : "invalid"}:${claim.reason}`).join(" | ")}`,
    "Name one strength and one concrete reasoning improvement.",
  ].join("\n");
}

function defaultClient(): StructuredModelClient | undefined {
  return defaultFreeLLMpoolClient();
}

export async function runExaminer(input: ExaminerAgentInput, client = defaultClient()): Promise<AgentTrace> {
  const valid = input.claimChecks.filter((claim) => claim.valid).length;
  const output = `${valid} of ${input.claimChecks.length} evidence claims checked. Use the cited observations to explain why ${input.diagnosis} remains supported and alternatives are ruled out.`;
  const graph = new StateGraph(State)
    .addNode("generate", async (state) => { try { return { candidate: client ? await client.invoke(promptFor(input), "examiner") : undefined, attempt: state.attempt + 1 }; } catch { return { candidate: undefined, attempt: state.attempt + 1 }; } })
    .addNode("feedback", async (state) => {
      const parsed = answerSchema.safeParse(state.candidate);
      if (parsed.success) return { trace: { graph: "examiner" as const, status: "model" as const, inputSummary: `${input.diagnosis}|${valid}/${input.claimChecks.length}`, output: parsed.data.feedback.trim() } };
      if (!client) return { trace: { graph: "examiner" as const, status: "template" as const, inputSummary: `${input.diagnosis}|${valid}/${input.claimChecks.length}`, output: output.slice(0, 500) } };
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
