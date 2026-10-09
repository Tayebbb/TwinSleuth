import { afterEach, describe, expect, it } from "vitest";
import { EpisodeService } from "./episode-service.js";
import { buildApp } from "./app.js";

describe("HTTP API contract", () => {
  const services: EpisodeService[] = [];
  afterEach(() => {
    for (const service of services.splice(0)) service.close();
  });

  function appForTest() {
    const service = new EpisodeService();
    services.push(service);
    return buildApp(service);
  }

  it("serves health and allows only the configured browser origin", async () => {
    const app = appForTest();
    const health = await app.inject({ method: "GET", url: "/api/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ ok: true });

    const allowed = await app.inject({ method: "GET", url: "/api/health", headers: { origin: "http://127.0.0.1:5173" } });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
    const denied = await app.inject({ method: "GET", url: "/api/health", headers: { origin: "https://attacker.example" } });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("does not expose unexpected server error details", async () => {
    const app = buildApp({ get: () => { throw new Error("SQLITE_CORRUPT: private database path"); } } as unknown as EpisodeService);
    const response = await app.inject({ method: "GET", url: "/api/episodes/any-id" });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "TwinSleuth could not complete that request." });
    expect(response.body).not.toContain("SQLITE");
    await app.close();
  });

  it("rejects cross-origin and non-JSON mutation requests", async () => {
    const app = appForTest();
    const forgedForm = await app.inject({ method: "POST", url: "/api/episodes", headers: { origin: "https://attacker.example", "content-type": "text/plain" }, payload: "create episode" });
    expect(forgedForm.statusCode).toBe(403);
    const wrongType = await app.inject({ method: "POST", url: "/api/episodes", headers: { origin: "http://127.0.0.1:5173", "content-type": "text/plain" }, payload: "create episode" });
    expect(wrongType.statusCode).toBe(415);
    const forgedJson = await app.inject({ method: "POST", url: "/api/episodes", headers: { origin: "https://attacker.example" }, payload: {} });
    expect(forgedJson.statusCode).toBe(403);
    const allowedJson = await app.inject({ method: "POST", url: "/api/episodes", headers: { origin: "http://127.0.0.1:5173" }, payload: {} });
    expect(allowedJson.statusCode).toBe(200);
    const unexpectedStartField = await app.inject({ method: "POST", url: "/api/episodes", payload: { truth: "H1" } });
    expect(unexpectedStartField.statusCode).toBe(400);
    expect(unexpectedStartField.json()).toEqual({ error: "Request is invalid." });
    await app.close();
  });

  it("limits episode creation bursts from one client", async () => {
    const app = appForTest();
    const statuses: number[] = [];
    for (let index = 0; index < 21; index += 1) {
      const response = await app.inject({ method: "POST", url: "/api/episodes", payload: {} });
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 20).every((status) => status === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
    await app.close();
  });

  it("returns identical pre-observation HTTP behavior for every hidden truth", async () => {
    const previousTruth = process.env.DEMO_TRUTH;
    try {
      const runs: string[] = [];
      for (const truth of ["H1", "H2", "H3", "H4"] as const) {
        process.env.DEMO_TRUTH = truth;
        const service = new EpisodeService();
        services.push(service);
        const app = buildApp(service);
        const created = await app.inject({ method: "POST", url: "/api/episodes", payload: {} });
        const started = created.json<{ id: string; revision: number }>();
        const beliefs = await app.inject({
          method: "POST", url: `/api/episodes/${started.id}/actions`,
          payload: { actionId: "same-script", expectedRevision: started.revision, action: { type: "beliefs", possibleHypotheses: ["H1", "H2", "H3", "H4"] } },
        });
        runs.push(JSON.stringify({
          created: { status: created.statusCode, headers: { contentType: created.headers["content-type"] }, body: { ...created.json(), id: "episode" } },
          beliefs: { status: beliefs.statusCode, headers: { contentType: beliefs.headers["content-type"] }, body: { ...beliefs.json(), id: "episode" } },
        }));
        await app.close();
      }
      expect(new Set(runs).size).toBe(1);
    } finally {
      if (previousTruth === undefined) delete process.env.DEMO_TRUTH;
      else process.env.DEMO_TRUTH = previousTruth;
    }
  });

  it("rejects oversized and malformed JSON bodies without framework details", async () => {
    const app = appForTest();
    const oversized = await app.inject({ method: "POST", url: "/api/episodes", headers: { "content-type": "application/json" }, payload: JSON.stringify({ padding: "x".repeat(32 * 1024) }) });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toEqual({ error: "Request body is too large." });
    const malformed = await app.inject({ method: "POST", url: "/api/episodes", headers: { "content-type": "application/json" }, payload: "{" });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({ error: "Request is invalid." });
    await app.close();
  });

  it("limits action bursts even when requests are otherwise rejected as stale", async () => {
    const app = appForTest();
    const created = await app.inject({ method: "POST", url: "/api/episodes", payload: {} });
    const { id, revision } = created.json<{ id: string; revision: number }>();
    const statuses: number[] = [];
    for (let index = 0; index < 121; index += 1) {
      const response = await app.inject({
        method: "POST", url: `/api/episodes/${id}/actions`, remoteAddress: "198.51.100.42",
        payload: { actionId: `burst-${index}`, expectedRevision: revision, action: { type: "unsafe" } },
      });
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 120)).not.toContain(429);
    expect(statuses[120]).toBe(429);
    await app.close();
  });

  it("covers create, fetch, replay, validation, stale revision, and unknown episode routes", async () => {
    const app = appForTest();
    const created = await app.inject({ method: "POST", url: "/api/episodes", payload: {} });
    expect(created.statusCode).toBe(200);
    const view = created.json<{ id: string; revision: number; status: string }>();
    expect(view.status).toBe("active");

    const fetched = await app.inject({ method: "GET", url: `/api/episodes/${view.id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({ id: view.id, revision: view.revision });
    expect(fetched.body).not.toContain("truthHypothesis");
    expect(fetched.body).not.toContain("forecastTable");

    const replay = await app.inject({ method: "GET", url: `/api/episodes/${view.id}/replay` });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toHaveLength(1);
    expect(replay.body).not.toContain("truth_hypothesis_id");

    const invalid = await app.inject({ method: "POST", url: `/api/episodes/${view.id}/actions`, payload: { actionId: "invalid", expectedRevision: 0, action: { type: "run", probeId: "P99" } } });
    expect(invalid.statusCode).toBe(400);
    const unexpectedField = await app.inject({ method: "POST", url: `/api/episodes/${view.id}/actions`, payload: {
      actionId: "unexpected-field", expectedRevision: view.revision, action: { type: "unsafe", outcomeId: "refused" },
    } });
    expect(unexpectedField.statusCode).toBe(400);
    expect(unexpectedField.json()).toEqual({ error: "Request is invalid." });
    const stale = await app.inject({ method: "POST", url: `/api/episodes/${view.id}/actions`, payload: { actionId: "stale", expectedRevision: 9, action: { type: "unsafe" } } });
    expect(stale.statusCode).toBe(409);
    const missingAction = await app.inject({ method: "POST", url: "/api/episodes/not-an-episode/actions", payload: { actionId: "missing", expectedRevision: 0, action: { type: "unsafe" } } });
    expect(missingAction.statusCode).toBe(404);

    const missing = await app.inject({ method: "GET", url: "/api/episodes/not-an-episode" });
    expect(missing.statusCode).toBe(404);
    const missingReplay = await app.inject({ method: "GET", url: "/api/episodes/not-an-episode/replay" });
    expect(missingReplay.statusCode).toBe(404);
    await app.close();
  });

  it("keeps deterministic Skeptic feedback and hidden truth private through HTTP", async () => {
    const app = appForTest();
    const created = await app.inject({ method: "POST", url: "/api/episodes", payload: {} });
    const view = created.json<{ id: string; revision: number }>();
    const challenged = await app.inject({
      method: "POST", url: `/api/episodes/${view.id}/actions`,
      payload: { actionId: "challenge", expectedRevision: view.revision, action: { type: "propose", probeId: "P1", predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" } } },
    });
    expect(challenged.statusCode).toBe(200);
    expect(challenged.json().pendingAgents).not.toContain("skeptic");
    expect(challenged.json().skeptic.question).toBeTruthy();
    expect(challenged.body).not.toContain("truthHypothesis");
    expect(challenged.body).not.toContain("forecastTable");

    const replay = await app.inject({ method: "GET", url: `/api/episodes/${view.id}/replay` });
    expect(replay.statusCode).toBe(200);
    expect(replay.body).not.toContain('"truth":');
    await app.close();
  });

  it("reveals only the run probe forecast before evaluation, then reveals truth after lock", async () => {
    const app = appForTest();
    const created = await app.inject({ method: "POST", url: "/api/episodes", payload: {} });
    const started = created.json<{ id: string; revision: number }>();
    const proposal = await app.inject({
      method: "POST", url: `/api/episodes/${started.id}/actions`,
      payload: { actionId: "p3-proposal", expectedRevision: started.revision, action: { type: "propose", probeId: "P3", predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" } } },
    });
    expect(proposal.statusCode).toBe(200);
    const proposed = proposal.json<{ revision: number; skeptic?: unknown }>();
    expect(proposed.skeptic).toBeUndefined();

    const ran = await app.inject({
      method: "POST", url: `/api/episodes/${started.id}/actions`,
      payload: { actionId: "p3-run", expectedRevision: proposed.revision, action: { type: "run", probeId: "P3" } },
    });
    const observed = ran.json<{ revision: number; revealedForecasts: Record<string, unknown>; truthHypothesis?: string; forecastTable?: unknown }>();
    expect(ran.statusCode).toBe(200);
    expect(observed.revealedForecasts).toHaveProperty("P3");
    expect(observed.revealedForecasts).not.toHaveProperty("P4");
    expect(observed.truthHypothesis).toBeUndefined();
    expect(observed.forecastTable).toBeUndefined();

    const locked = await app.inject({
      method: "POST", url: `/api/episodes/${started.id}/actions`,
      payload: {
        actionId: "lock", expectedRevision: observed.revision,
        action: {
          type: "lock", diagnosis: "H1", confidence: 3, justification: "P3 completed as predicted for H1.",
          claims: ["H1", "H2", "H3", "H4"].map((hypothesisId, index) => ({ hypothesisId, stance: index === 0 ? "supports" : "rules_out", evidenceIds: ["simulated-evidence"] })),
        },
      },
    });
    expect(locked.statusCode).toBe(200);
    const evaluated = locked.json<{ status: string; truthHypothesis?: string; forecastTable?: Record<string, unknown> }>();
    expect(evaluated.status).toBe("evaluated");
    expect(evaluated.truthHypothesis).toBeTruthy();
    expect(Object.keys(evaluated.forecastTable ?? {})).toHaveLength(6);
    await app.close();
  });
});
