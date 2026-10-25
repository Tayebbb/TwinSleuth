import type { AgentOutcomeReason, AgentTrace, StructuredModelClient } from "./types.js";

export class AgentCallError extends Error {
  constructor(readonly reason: AgentOutcomeReason, message: string) { super(message); }
}

export function failureReason(error: unknown): AgentOutcomeReason {
  if (error instanceof AgentCallError) return error.reason;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  return "provider_error";
}

/** One total deadline, including retries; cancellation reaches the transport. */
export async function invokeBefore(client: StructuredModelClient, prompt: string, graph: "examiner" | "tutor", deadline: number): Promise<unknown> {
  const remaining = deadline - performance.now();
  if (remaining <= 0) throw new AgentCallError("timeout", "Agent deadline exceeded.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      client.invoke(prompt, graph, controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new AgentCallError("timeout", "Agent deadline exceeded.")); }, remaining);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}

export function diagnosedTrace(trace: AgentTrace, started: number, reason: AgentOutcomeReason, contractVersion: string): AgentTrace {
  return { ...trace, diagnostics: { reason, elapsedMs: Math.max(0, Math.round(performance.now() - started)), contractVersion } };
}

export function publicAgentTrace(trace: AgentTrace): AgentTrace {
  const visible: AgentTrace = { graph: trace.graph, status: trace.status, inputSummary: trace.inputSummary, output: trace.output,
    ...(trace.skill === undefined ? {} : { skill: trace.skill }), ...(trace.revision === undefined ? {} : { revision: trace.revision }),
    ...(trace.lesson === undefined ? {} : { lesson: trace.lesson }), ...(trace.reflection === undefined ? {} : { reflection: trace.reflection }) };
  return visible;
}
