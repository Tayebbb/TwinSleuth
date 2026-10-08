import type { StructuredModelClient } from "./types.js";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

function parseObject(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("FreeLLMPool returned no JSON object.");
  return JSON.parse(content.slice(start, end + 1)) as unknown;
}

async function invoke(prompt: string, graph: "skeptic" | "examiner"): Promise<unknown> {
  const baseUrl = (process.env.FREELLMPOOL_BASE_URL ?? "http://127.0.0.1:8080/v1").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FREELLMPOOL_API_KEY ?? "unused"}`,
    },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: process.env.TWINSLEUTH_MODEL ?? "auto",
      max_tokens: graph === "skeptic" ? 180 : 300,
      messages: [{
        role: "user",
        content: `${prompt}\n\nReturn only a JSON object with exactly one string field named ${graph === "skeptic" ? "question" : "feedback"}. Do not use Markdown fences.`,
      }],
    }),
  });
  if (!response.ok) throw new Error(`FreeLLMPool request failed with HTTP ${response.status}.`);
  const result = await response.json() as ChatCompletionResponse;
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("FreeLLMPool returned no text content.");
  return parseObject(content);
}

export function defaultFreeLLMpoolClient(): StructuredModelClient | undefined {
  if (process.env.FREELLMPOOL_ENABLED === "0") return undefined;
  return { invoke };
}
