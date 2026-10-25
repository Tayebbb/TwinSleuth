import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultModelClient } from "./model-client.js";

const environment = ["TWINSLEUTH_TESTING_MODE", "OPENAI_API_KEY", "OPENAI_MODEL", "FREELLMPOOL_BASE_URL", "FREELLMPOOL_API_KEY", "FREELLMPOOL_MODEL"] as const;
const original = Object.fromEntries(environment.map((name) => [name, process.env[name]]));
const originalFetch = globalThis.fetch;

afterEach(() => {
  for (const name of environment) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
  globalThis.fetch = originalFetch;
});

describe("AI provider selection", () => {
  it("rejects oversized provider bodies even with an absent or misleading Content-Length", async () => {
    process.env.TWINSLEUTH_TESTING_MODE = "1";
    process.env.FREELLMPOOL_BASE_URL = "http://127.0.0.1:8080/v1";
    for (const headers of [{}, { "content-length": "1" }]) {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: '{"lesson":"x","reflection":"y"}', padding: "é".repeat(40_000) }), { headers }));
      await expect(defaultModelClient()!.invoke("General skill only.", "tutor")).rejects.toThrow(/response.*large/i);
    }
  });
  it("uses no provider without an OpenAI key in demo mode", () => {
    process.env.TWINSLEUTH_TESTING_MODE = "0";
    delete process.env.OPENAI_API_KEY;
    expect(defaultModelClient()).toBeUndefined();
  });

  it("uses OpenAI Responses in demo mode", async () => {
    process.env.TWINSLEUTH_TESTING_MODE = "0";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_MODEL = "test-model";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: '{"feedback":"Evidence is cited."}' }), { status: 200 }));
    globalThis.fetch = fetchMock;

    await expect(defaultModelClient()!.invoke("Use only checked claims.", "examiner")).resolves.toEqual({ feedback: "Evidence is cited." });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(request.headers).toMatchObject({ Authorization: "Bearer test-openai-key" });
    expect(JSON.parse(request.body as string)).toMatchObject({ model: "test-model", max_output_tokens: 1024, text: { format: { type: "json_schema", strict: true } } });
  });

  it("uses only the local FreeLLMPool proxy in testing mode", async () => {
    process.env.TWINSLEUTH_TESTING_MODE = "1";
    delete process.env.OPENAI_API_KEY;
    process.env.FREELLMPOOL_BASE_URL = "http://localhost:8080/v1/";
    process.env.FREELLMPOOL_API_KEY = "pool-test-key";
    process.env.FREELLMPOOL_MODEL = "auto";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: '{"lesson":"Compare predictions first.","reflection":"What would separate them?"}' }), { status: 200 }));
    globalThis.fetch = fetchMock;

    await expect(defaultModelClient()!.invoke("Teach a generic skill.", "tutor")).resolves.toEqual({ lesson: "Compare predictions first.", reflection: "What would separate them?" });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/responses");
    expect(request.headers).toMatchObject({ Authorization: "Bearer pool-test-key" });
    expect(JSON.parse(request.body as string)).toMatchObject({ model: "auto", max_output_tokens: 1024, text: { format: { type: "json_schema", strict: true } } });
  });

  it("rejects advertised excess before reading, and cancels chunked excess while streaming", async () => {
    process.env.TWINSLEUTH_TESTING_MODE = "1";
    const advertised = new Response("{}", { headers: { "content-length": String(65_537) } });
    const cancel = vi.spyOn(advertised.body!, "cancel");
    globalThis.fetch = vi.fn().mockResolvedValue(advertised);
    await expect(defaultModelClient()!.invoke("General skill only.", "tutor")).rejects.toThrow(/response.*large/i);
    expect(cancel).toHaveBeenCalledOnce();

    let pulls = 0;
    const stopped = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { pulls += 1; controller.enqueue(new Uint8Array(8_192)); },
      cancel: stopped,
    });
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(stream));
    await expect(defaultModelClient()!.invoke("General skill only.", "tutor")).rejects.toThrow(/response.*large/i);
    expect(stopped).toHaveBeenCalledOnce();
    expect(pulls).toBeLessThanOrEqual(10);
  });
});
