import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultGeminiClient } from "./gemini.js";

const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalModel;
  globalThis.fetch = originalFetch;
});

describe("Gemini production provider", () => {
  it("stays disabled without a Gemini key", () => {
    delete process.env.GEMINI_API_KEY;
    expect(defaultGeminiClient()).toBeUndefined();
  });

  it("sends structured requests to the configured Gemini model", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-test";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"question":"What would distinguish these causes?"}' }] } }] }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await defaultGeminiClient()!.invoke("Use only visible evidence.", "skeptic");

    expect(result).toEqual({ question: "What would distinguish these causes?" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("models/gemini-test:generateContent?key=test-key");
    expect(JSON.parse(request.body as string)).toMatchObject({ generationConfig: { responseFormat: { text: { mimeType: "application/json" } }, maxOutputTokens: 180 } });
  });

  it("uses the bounded tutor response contract", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"lesson":"Compare predictions first.","reflection":"What would separate them?"}' }] } }] }), { status: 200 }));
    globalThis.fetch = fetchMock;

    await expect(defaultGeminiClient()!.invoke("Teach a generic skill.", "tutor")).resolves.toEqual({ lesson: "Compare predictions first.", reflection: "What would separate them?" });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(request.body as string)).toMatchObject({ generationConfig: { responseFormat: { text: { mimeType: "application/json", schema: { type: "object", required: ["lesson", "reflection"], additionalProperties: false } } }, maxOutputTokens: 220 } });
  });
});
