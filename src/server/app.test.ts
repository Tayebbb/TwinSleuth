import { afterEach, describe, expect, it } from "vitest";
import { EpisodeService } from "./episode-service.js";
import { buildApp } from "./app.js";
import type { InjectOptions } from "fastify";

const sessionCookies = new WeakMap<ReturnType<typeof buildApp>, string>();
async function sessionInject(app: ReturnType<typeof buildApp>, options: InjectOptions) {
  const cookie = sessionCookies.get(app);
  const response = await app.inject({ ...options, headers: { ...(cookie ? { cookie } : {}), ...options.headers } });
  const setCookie = response.headers["set-cookie"];
  if (typeof setCookie === "string") sessionCookies.set(app, setCookie.split(";")[0]!);
  return response;
}

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

  it("isolates every episode surface between anonymous browser sessions", async () => {
    const app = appForTest();
    const first = await app.inject({ method: "POST", url: "/api/episodes", payload: {} });
    const episode = first.json<{ id: string; revision: number }>();
    const ownerCookie = String(first.headers["set-cookie"] ?? "").split(";")[0]!;
    expect(ownerCookie).toMatch(/twinsleuth_session=[a-f0-9]{64}/);
    expect(first.headers["set-cookie"]).toContain("HttpOnly");
    expect(first.headers["set-cookie"]).toContain("SameSite=Strict");
    const second = await app.inject({ method: "POST", url: "/api/episodes", payload: {} });
    const otherCookie = String(second.headers["set-cookie"] ?? "").split(";")[0]!;
    expect(otherCookie).not.toBe(ownerCookie);
    for (const cookie of ["", "twinsleuth_session=invalid", otherCookie]) {
      const headers = { cookie };
      const listed = await app.inject({ method: "GET", url: "/api/episodes", headers });
      expect(listed.json<{ id: string }[]>().some(({ id }) => id === episode.id)).toBe(false);
      for (const suffix of ["", "/replay", "/export"]) {
        const response = await app.inject({ method: "GET", url: `/api/episodes/${episode.id}${suffix}`, headers });
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({ error: "Episode not found." });
      }
      for (const suffix of ["/actions", "/tutor"]) {
        const response = await app.inject({ method: "POST", url: `/api/episodes/${episode.id}${suffix}`, headers,
          payload: suffix === "/tutor" ? {} : { actionId: "foreign", expectedRevision: episode.revision, action: { type: "unsafe" } } });
        expect(response.statusCode).toBe(404);
      }
      expect((await app.inject({ method: "DELETE", url: `/api/episodes/${episode.id}`, headers })).statusCode).toBe(404);
    }
    const headers = { cookie: ownerCookie };
    expect((await app.inject({ method: "GET", url: `/api/episodes/${episode.id}`, headers })).json()).toMatchObject({ revision: episode.revision });
    const listed = await app.inject({ method: "GET", url: "/api/episodes", headers });
    expect(listed.json<{ id: string }[]>()).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: `/api/episodes/${episode.id}/export`, headers })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: `/api/episodes/${episode.id}`, headers })).statusCode).toBe(204);
    await app.close();
  });

  it("uses a Secure host-only session cookie in production", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const app = appForTest();
      const created = await app.inject({ method: "POST", url: "/api/episodes", payload: {} });
      expect(created.headers["set-cookie"]).toMatch(/^__Host-twinsleuth_session=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=31536000; Secure$/);
      expect(created.headers["set-cookie"]).not.toContain("Domain=");
      const devCookie = `twinsleuth_session=${String(created.headers["set-cookie"]).split("=")[1]!.split(";")[0]}`;
      const id = created.json<{ id: string }>().id;
      expect((await app.inject({ method: "GET", url: `/api/episodes/${id}`, headers: { cookie: devCookie } })).statusCode).toBe(404);
      await app.close();
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });

  it("rotates unissued session tokens and rejects ambiguous cookies", async () => {
    const app = appForTest();
    const forged = `twinsleuth_session=${"0".repeat(64)}`;
    const created = await app.inject({ method: "POST", url: "/api/episodes", headers: { cookie: forged }, payload: {} });
    const minted = String(created.headers["set-cookie"]).split(";")[0]!;
    expect(minted).not.toBe(forged);
    const id = created.json<{ id: string }>().id;
    for (const cookie of [forged, `${minted}; ${minted}`]) {
      expect((await app.inject({ method: "GET", url: `/api/episodes/${id}`, headers: { cookie } })).statusCode).toBe(404);
    }
    const next = await app.inject({ method: "POST", url: "/api/episodes", headers: { cookie: minted }, payload: {} });
    expect(next.headers["set-cookie"]).toBeUndefined();
    expect((await app.inject({ method: "GET", url: "/api/episodes", headers: { cookie: minted } })).json()).toHaveLength(2);
    await app.close();
  });

  it("serves health and allows only the configured browser origin", async () => {
    const app = appForTest();
    const health = await sessionInject(app, { method: "GET", url: "/api/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ ok: true });

    const allowed = await sessionInject(app, { method: "GET", url: "/api/health", headers: { origin: "http://127.0.0.1:5173" } });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
    const denied = await sessionInject(app, { method: "GET", url: "/api/health", headers: { origin: "https://attacker.example" } });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("does not expose unexpected server error details", async () => {
    const app = buildApp({ assertOwner: async () => undefined, get: () => { throw new Error("SQLITE_CORRUPT: private database path"); } } as unknown as EpisodeService);
    const response = await sessionInject(app, { method: "GET", url: "/api/episodes/any-id" });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "TwinSleuth could not complete that request." });
    expect(response.body).not.toContain("SQLITE");
    await app.close();
  });

  it("rejects cross-origin and non-JSON mutation requests", async () => {
    const app = appForTest();
    const forgedForm = await sessionInject(app, { method: "POST", url: "/api/episodes", headers: { origin: "https://attacker.example", "content-type": "text/plain" }, payload: "create episode" });
    expect(forgedForm.statusCode).toBe(403);
    const wrongType = await sessionInject(app, { method: "POST", url: "/api/episodes", headers: { origin: "http://127.0.0.1:5173", "content-type": "text/plain" }, payload: "create episode" });
    expect(wrongType.statusCode).toBe(415);
    const forgedJson = await sessionInject(app, { method: "POST", url: "/api/episodes", headers: { origin: "https://attacker.example" }, payload: {} });
    expect(forgedJson.statusCode).toBe(403);
    const allowedJson = await sessionInject(app, { method: "POST", url: "/api/episodes", headers: { origin: "http://127.0.0.1:5173" }, payload: {} });
    expect(allowedJson.statusCode).toBe(200);
    const unexpectedStartField = await sessionInject(app, { method: "POST", url: "/api/episodes", payload: { truth: "H1" } });
    expect(unexpectedStartField.statusCode).toBe(400);
    expect(unexpectedStartField.json()).toEqual({ error: "Request is invalid." });
    const created = allowedJson.json<{ id: string }>();
    const forgedDelete = await sessionInject(app, { method: "DELETE", url: `/api/episodes/${created.id}`, headers: { origin: "https://attacker.example" } });
    expect(forgedDelete.statusCode).toBe(403);
    expect((await sessionInject(app, { method: "GET", url: `/api/episodes/${created.id}` })).statusCode).toBe(200);
    await app.close();
  });

  it("does not apply a PIN-9 demo truth to the Conveyor case", async () => {
    const previousTruth = process.env.DEMO_TRUTH;
    process.env.DEMO_TRUTH = "H1";
    const app = appForTest();
    try {
      const response = await sessionInject(app, { method: "POST", url: "/api/episodes", payload: { caseId: "conveyor-index-drift" } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ caseId: "conveyor-index-drift", status: "active" });
    } finally {
      if (previousTruth === undefined) delete process.env.DEMO_TRUTH;
      else process.env.DEMO_TRUTH = previousTruth;
      await app.close();
    }
  });

  it("limits episode creation bursts from one client", async () => {
    const app = appForTest();
    const statuses: number[] = [];
    for (let index = 0; index < 61; index += 1) {
      const response = await sessionInject(app, { method: "POST", url: "/api/episodes", payload: {} });
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true);
    expect(statuses[60]).toBe(429);
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
        const created = await sessionInject(app, { method: "POST", url: "/api/episodes", payload: {} });
        const started = created.json<{ id: string; revision: number }>();
        const beliefs = await sessionInject(app, {
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
    const oversized = await sessionInject(app, { method: "POST", url: "/api/episodes", headers: { "content-type": "application/json" }, payload: JSON.stringify({ padding: "x".repeat(32 * 1024) }) });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toEqual({ error: "Request body is too large." });
    const malformed = await sessionInject(app, { method: "POST", url: "/api/episodes", headers: { "content-type": "application/json" }, payload: "{" });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({ error: "Request is invalid." });
    await app.close();
  });

  it("limits action bursts even when requests are otherwise rejected as stale", async () => {
    const app = appForTest();
    const created = await sessionInject(app, { method: "POST", url: "/api/episodes", payload: {} });
    const { id, revision } = created.json<{ id: string; revision: number }>();
    const statuses: number[] = [];
    for (let index = 0; index < 121; index += 1) {
      const response = await sessionInject(app, {
        method: "POST", url: `/api/episodes/${id}/actions`, remoteAddress: "198.51.100.42",
        payload: { actionId: `burst-${index}`, expectedRevision: revision, action: { type: "unsafe" } },
      });
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 120)).not.toContain(429);
    expect(statuses[120]).toBe(429);
    await app.close();
  });

  it("serves a cached AI tutor lesson only after a deterministic trigger and rate limits requests", async () => {
    const app = appForTest();
    const created = await sessionInject(app, { method: "POST", url: "/api/episodes", payload: {} });
    const started = created.json<{ id: string; revision: number }>();
    const unavailable = await sessionInject(app, { method: "POST", url: `/api/episodes/${started.id}/tutor`, payload: {} });
    expect(unavailable.statusCode).toBe(409);
    const challenged = await sessionInject(app, { method: "POST", url: `/api/episodes/${started.id}/actions`, payload: {
      actionId: "tutor-trigger", expectedRevision: started.revision,
      action: { type: "propose", probeId: "P1", predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" } },
    } });
    const lesson = await sessionInject(app, { method: "POST", url: `/api/episodes/${started.id}/tutor`, remoteAddress: "203.0.113.40", payload: {} });
    expect(lesson.statusCode).toBe(200);
    expect(lesson.json()).toMatchObject({ revision: challenged.json<{ revision: number }>().revision, tutor: { skill: "design_discriminating_tests", trace: { graph: "tutor", status: "fallback" } } });
    expect(lesson.body).not.toContain("truthHypothesis");
    for (let index = 0; index < 9; index += 1) await sessionInject(app, { method: "POST", url: `/api/episodes/${started.id}/tutor`, remoteAddress: "203.0.113.40", payload: {} });
    const limited = await sessionInject(app, { method: "POST", url: `/api/episodes/${started.id}/tutor`, remoteAddress: "203.0.113.40", payload: {} });
    expect(limited.statusCode).toBe(429);
    await app.close();
  });

  it("covers create, fetch, replay, validation, stale revision, and unknown episode routes", async () => {
    const app = appForTest();
    const created = await sessionInject(app, { method: "POST", url: "/api/episodes", payload: {} });
    expect(created.statusCode).toBe(200);
    const view = created.json<{ id: string; revision: number; status: string }>();
    expect(view.status).toBe("active");

    const fetched = await sessionInject(app, { method: "GET", url: `/api/episodes/${view.id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({ id: view.id, revision: view.revision });
    expect(fetched.body).not.toContain("truthHypothesis");
    expect(fetched.body).not.toContain("forecastTable");

    const replay = await sessionInject(app, { method: "GET", url: `/api/episodes/${view.id}/replay` });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toHaveLength(1);
    expect(replay.body).not.toContain("truth_hypothesis_id");

    const invalid = await sessionInject(app, { method: "POST", url: `/api/episodes/${view.id}/actions`, payload: { actionId: "invalid", expectedRevision: 0, action: { type: "run", probeId: "P99" } } });
    expect(invalid.statusCode).toBe(400);
    const unexpectedField = await sessionInject(app, { method: "POST", url: `/api/episodes/${view.id}/actions`, payload: {
      actionId: "unexpected-field", expectedRevision: view.revision, action: { type: "unsafe", outcomeId: "refused" },
    } });
    expect(unexpectedField.statusCode).toBe(400);
    expect(unexpectedField.json()).toEqual({ error: "Request is invalid." });
    const stale = await sessionInject(app, { method: "POST", url: `/api/episodes/${view.id}/actions`, payload: { actionId: "stale", expectedRevision: 9, action: { type: "unsafe" } } });
    expect(stale.statusCode).toBe(409);
    const missingAction = await sessionInject(app, { method: "POST", url: "/api/episodes/not-an-episode/actions", payload: { actionId: "missing", expectedRevision: 0, action: { type: "unsafe" } } });
    expect(missingAction.statusCode).toBe(404);

    const missing = await sessionInject(app, { method: "GET", url: "/api/episodes/not-an-episode" });
    expect(missing.statusCode).toBe(404);
    const missingReplay = await sessionInject(app, { method: "GET", url: "/api/episodes/not-an-episode/replay" });
    expect(missingReplay.statusCode).toBe(404);
    await app.close();
  });

  it("keeps deterministic Skeptic feedback and hidden truth private through HTTP", async () => {
    const app = appForTest();
    const created = await sessionInject(app, { method: "POST", url: "/api/episodes", payload: {} });
    const view = created.json<{ id: string; revision: number }>();
    const challenged = await sessionInject(app, {
      method: "POST", url: `/api/episodes/${view.id}/actions`,
      payload: { actionId: "challenge", expectedRevision: view.revision, action: { type: "propose", probeId: "P1", predictions: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" } } },
    });
    expect(challenged.statusCode).toBe(200);
    expect(challenged.json().pendingAgents).not.toContain("skeptic");
    expect(challenged.json().skeptic.question).toBeTruthy();
    expect(challenged.body).not.toContain("truthHypothesis");
    expect(challenged.body).not.toContain("forecastTable");

    const replay = await sessionInject(app, { method: "GET", url: `/api/episodes/${view.id}/replay` });
    expect(replay.statusCode).toBe(200);
    expect(replay.body).not.toContain('"truth":');
    await app.close();
  });

  it("reveals only the run probe forecast before evaluation, then reveals truth after lock", async () => {
    const app = appForTest();
    const created = await sessionInject(app, { method: "POST", url: "/api/episodes", payload: {} });
    const started = created.json<{ id: string; revision: number }>();
    const proposal = await sessionInject(app, {
      method: "POST", url: `/api/episodes/${started.id}/actions`,
      payload: { actionId: "p3-proposal", expectedRevision: started.revision, action: { type: "propose", probeId: "P3", predictions: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" } } },
    });
    expect(proposal.statusCode).toBe(200);
    const proposed = proposal.json<{ revision: number; skeptic?: unknown }>();
    expect(proposed.skeptic).toBeUndefined();

    const ran = await sessionInject(app, {
      method: "POST", url: `/api/episodes/${started.id}/actions`,
      payload: { actionId: "p3-run", expectedRevision: proposed.revision, action: { type: "run", probeId: "P3" } },
    });
    const observed = ran.json<{ revision: number; revealedForecasts: Record<string, unknown>; truthHypothesis?: string; forecastTable?: unknown }>();
    expect(ran.statusCode).toBe(200);
    expect(observed.revealedForecasts).toHaveProperty("P3");
    expect(observed.revealedForecasts).not.toHaveProperty("P4");
    expect(observed.truthHypothesis).toBeUndefined();
    expect(observed.forecastTable).toBeUndefined();

    const locked = await sessionInject(app, {
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
    expect(Object.keys(evaluated.forecastTable ?? {})).toEqual(["P3"]);
    expect(evaluated.forecastTable).not.toHaveProperty("P4");
    expect(locked.headers["cache-control"]).toBe("private, no-store");
    await app.close();
  });
});
