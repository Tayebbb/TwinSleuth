import { afterEach, describe, expect, it, vi } from "vitest";
import { runTutor } from "./tutor.js";
import { runExaminer } from "./examiner.js";
import type { StructuredModelClient } from "./types.js";

afterEach(() => vi.useRealTimers());

describe("overall agent deadlines", () => {
  for (const role of ["tutor", "examiner"] as const) it(`cancels stalled ${role} work at its total deadline`, async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] });
    let calls = 0;
    let aborted = false;
    const model: StructuredModelClient = { invoke(_prompt, _role, signal) {
      calls += 1;
      return new Promise((_resolve, reject) => signal!.addEventListener("abort", () => { aborted = true; reject(new DOMException("aborted", "AbortError")); }, { once: true }));
    } };
    const run = role === "tutor" ? runTutor("design_discriminating_tests", 1, model) : runExaminer({ diagnosis: "H1", justification: "x", claims: [], claimChecks: [] }, model);
    await vi.advanceTimersByTimeAsync(role === "tutor" ? 6_000 : 20_000);
    const trace = await run;
    expect(trace.status).toBe("fallback");
    expect(trace.diagnostics?.reason).toBe("timeout");
    expect(aborted).toBe(true);
    expect(calls).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
