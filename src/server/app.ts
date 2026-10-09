import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { EpisodeService, ConflictError, NotFoundError } from "./episode-service.js";
import { episodeStartRequestSchema } from "./schemas.js";

function publicError(error: unknown): { code: number; message: string } {
  if (error instanceof ConflictError || error instanceof NotFoundError) return { code: error.statusCode, message: error.message };
  if (error instanceof ZodError) return { code: 400, message: "Request is invalid." };
  return { code: 500, message: "TwinSleuth could not complete that request." };
}

export function buildApp(service = new EpisodeService()) {
  const app = Fastify({ logger: false, bodyLimit: 32 * 1024 });
  const allowedOrigin = process.env.UI_ORIGIN ?? "http://127.0.0.1:5173";
  const episodeStartWindows = new Map<string, { startedAt: number; count: number }>();
  const actionWindows = new Map<string, { startedAt: number; count: number }>();
  const withinRateLimit = (windows: Map<string, { startedAt: number; count: number }>, key: string, limit: number): boolean => {
    const now = Date.now();
    const current = windows.get(key);
    if (!current || now - current.startedAt >= 60_000) {
      if (!current && windows.size >= 1_024) {
        for (const [ip, entry] of windows) if (now - entry.startedAt >= 60_000) windows.delete(ip);
        if (windows.size >= 1_024) return false;
      }
      windows.set(key, { startedAt: now, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
  app.setErrorHandler((error, _request, reply) => {
    const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "";
    if (code === "FST_ERR_CTP_BODY_TOO_LARGE") return reply.code(413).send({ error: "Request body is too large." });
    if (code.startsWith("FST_ERR_CTP_")) return reply.code(400).send({ error: "Request is invalid." });
    return reply.code(500).send({ error: "TwinSleuth could not complete that request." });
  });
  void app.register(cors, { origin: (origin, callback) => callback(null, !origin || origin === allowedOrigin ? allowedOrigin : false) });
  app.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST") return;
    const origin = request.headers.origin;
    if (origin && origin !== allowedOrigin) return reply.code(403).send({ error: "Origin is not allowed." });
    const contentType = request.headers["content-type"] ?? "";
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return reply.code(415).send({ error: "Content-Type must be application/json." });
    if (request.url.split("?")[0] === "/api/episodes") {
      if (!withinRateLimit(episodeStartWindows, request.ip, 20)) return reply.code(429).send({ error: "Episode start limit reached. Try again in a minute." });
    }
    if (/^\/api\/episodes\/[^/]+\/actions$/.test(request.url.split("?")[0] ?? "")) {
      if (!withinRateLimit(actionWindows, request.ip, 120)) return reply.code(429).send({ error: "Action limit reached. Try again in a minute." });
    }
  });
  app.get("/api/health", async () => ({ ok: true }));
  app.post("/api/episodes", async (request, reply) => {
    try {
      episodeStartRequestSchema.parse(request.body);
      const demoTruth = process.env.DEMO_TRUTH;
      const truth = demoTruth === "H1" || demoTruth === "H2" || demoTruth === "H3" || demoTruth === "H4" ? demoTruth : undefined;
      return service.start(truth);
    } catch (error) {
      const result = publicError(error);
      return reply.code(result.code).send({ error: result.message });
    }
  });
  app.get("/api/episodes/:id", async (request, reply) => {
    try { return service.get((request.params as { id: string }).id); }
    catch (error) { const result = publicError(error); return reply.code(result.code).send({ error: result.message }); }
  });
  app.get("/api/episodes/:id/replay", async (request, reply) => {
    try { return service.replay((request.params as { id: string }).id); }
    catch (error) { const result = publicError(error); return reply.code(result.code).send({ error: result.message }); }
  });
  app.post("/api/episodes/:id/actions", async (request, reply) => {
    try { return service.act((request.params as { id: string }).id, request.body); }
    catch (error) {
      const result = publicError(error);
      return reply.code(result.code).send({ error: result.message });
    }
  });
  return app;
}
