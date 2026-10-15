import type { StructuredModelClient } from "./types.js";

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
};

const tutorResponseSchema = {
  type: "object",
  properties: {
    lesson: { type: "string" },
    reflection: { type: "string" },
  },
  required: ["lesson", "reflection"],
  additionalProperties: false,
} as const;

function parseObject(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Gemini returned no JSON object.");
  return JSON.parse(content.slice(start, end + 1)) as unknown;
}

async function invoke(prompt: string, graph: "skeptic" | "examiner" | "tutor"): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required to call Gemini.");
  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(graph === "tutor" ? 6_000 : 20_000),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${prompt}\n\n${graph === "tutor" ? "Return only a JSON object with exactly two string fields named lesson and reflection. Do not use Markdown fences." : `Return only a JSON object with exactly one string field named ${graph === "skeptic" ? "question" : "feedback"}. Do not use Markdown fences.`}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        ...(graph === "tutor" ? { responseJsonSchema: tutorResponseSchema } : {}),
        maxOutputTokens: graph === "skeptic" ? 180 : graph === "tutor" ? 220 : 300,
      },
    }),
  });
  if (!response.ok) throw new Error(`Gemini request failed with HTTP ${response.status}.`);
  const result = await response.json() as GeminiResponse;
  const content = result.candidates?.[0]?.content?.parts?.map((part) => part.text).filter((text): text is string => typeof text === "string").join("");
  if (!content) throw new Error("Gemini returned no text content.");
  return parseObject(content);
}

export function defaultGeminiClient(): StructuredModelClient | undefined {
  return process.env.GEMINI_API_KEY ? { invoke } : undefined;
}
