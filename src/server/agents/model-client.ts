import type { StructuredModelClient } from "./types.js";
import { AgentCallError } from "./agent-runtime.js";

export const MAX_MODEL_RESPONSE_BYTES = 64 * 1024;

async function boundedResponseJson(response: Response): Promise<unknown> {
  const advertised = Number(response.headers.get("content-length"));
  if (Number.isFinite(advertised) && advertised > MAX_MODEL_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new AgentCallError("response_too_large", "Model response is too large.");
  }
  if (!response.body) throw new AgentCallError("invalid_response", "Model returned no response body.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_MODEL_RESPONSE_BYTES) {
        await reader.cancel();
        throw new AgentCallError("response_too_large", "Model response is too large.");
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(body)) as unknown; }
  catch { throw new AgentCallError("invalid_response", "Model returned invalid JSON."); }
}

type AgentGraph = "skeptic" | "examiner" | "tutor";

type OpenAIResponse = {
  output_text?: unknown;
  output?: Array<{ content?: Array<{ text?: unknown }> }>;
};

function responseSchema(graph: AgentGraph): Record<string, unknown> {
  const field = graph === "skeptic" ? "question" : graph === "examiner" ? "feedback" : undefined;
  return field
    ? { type: "object", additionalProperties: false, required: [field], properties: { [field]: { type: "string" } } }
    : {
        type: "object",
        additionalProperties: false,
        required: ["lesson", "reflection"],
        properties: { lesson: { type: "string" }, reflection: { type: "string" } },
      };
}

function instruction(graph: AgentGraph): string {
  return graph === "tutor"
    ? "Return only a JSON object with exactly two string fields named lesson and reflection. Do not use Markdown fences."
    : `Return only a JSON object with exactly one string field named ${graph === "skeptic" ? "question" : "feedback"}. Do not use Markdown fences.`;
}

function parseObject(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < start) throw new AgentCallError("invalid_response", "Model returned no JSON object.");
  try { return JSON.parse(content.slice(start, end + 1)) as unknown; }
  catch { throw new AgentCallError("invalid_response", "Model returned invalid JSON."); }
}

function outputText(response: OpenAIResponse): string | undefined {
  if (!response || typeof response !== "object") throw new AgentCallError("invalid_response", "Model returned an invalid response.");
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return undefined;
  return response.output.flatMap((item) => Array.isArray(item?.content) ? item.content : []).map((item) => item?.text).find((text): text is string => typeof text === "string");
}

async function invokeOpenAI(prompt: string, graph: AgentGraph, signal?: AbortSignal): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required when TWINSLEUTH_TESTING_MODE is 0.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.any([AbortSignal.timeout(graph === "tutor" ? 6_000 : 20_000), ...(signal ? [signal] : [])]),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      max_output_tokens: 1_024,
      input: `${prompt}\n\n${instruction(graph)}`,
      text: { format: { type: "json_schema", name: `twinsleuth_${graph}`, strict: true, schema: responseSchema(graph) } },
    }),
  });
  if (!response.ok) { await response.body?.cancel(); throw new AgentCallError("http_error", "Model request failed."); }
  const content = outputText(await boundedResponseJson(response) as OpenAIResponse);
  if (!content) throw new AgentCallError("invalid_response", "Model returned no text content.");
  return parseObject(content);
}

async function invokeFreeLlmPool(prompt: string, graph: AgentGraph, signal?: AbortSignal): Promise<unknown> {
  const baseUrl = (process.env.FREELLMPOOL_BASE_URL ?? "http://127.0.0.1:8080/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.FREELLMPOOL_API_KEY ?? "unused"}` },
    signal: AbortSignal.any([AbortSignal.timeout(graph === "tutor" ? 6_000 : 20_000), ...(signal ? [signal] : [])]),
    body: JSON.stringify({
      model: process.env.FREELLMPOOL_MODEL ?? "auto",
      max_output_tokens: 1_024,
      input: `${prompt}\n\n${instruction(graph)}`,
      text: { format: { type: "json_schema", name: `twinsleuth_${graph}`, strict: true, schema: responseSchema(graph) } },
    }),
  });
  if (!response.ok) { await response.body?.cancel(); throw new AgentCallError("http_error", "Model request failed."); }
  const content = outputText(await boundedResponseJson(response) as OpenAIResponse);
  if (!content) throw new AgentCallError("invalid_response", "Model returned no text content.");
  return parseObject(content);
}

/** 0 selects OpenAI for the demo; 1 selects the local FreeLLMPool proxy for tests. */
export function defaultModelClient(): StructuredModelClient | undefined {
  if (process.env.TWINSLEUTH_TESTING_MODE === "1") return { invoke: invokeFreeLlmPool };
  return process.env.OPENAI_API_KEY ? { invoke: invokeOpenAI } : undefined;
}
