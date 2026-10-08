import Fastify from "fastify";
import cors from "@fastify/cors";
import { EpisodeService, ConflictError, NotFoundError } from "./episode-service.js";

export function buildApp(service = new EpisodeService()) {
  const app = Fastify({ logger: false });
  const allowedOrigin = process.env.UI_ORIGIN ?? "http://127.0.0.1:5173";
  const episodeStartWindows = new Map<string, { startedAt: number; count: number }>();
  void app.register(cors, { origin: (origin, callback) => callback(null, !origin || origin === allowedOrigin ? allowedOrigin : false) });
  app.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST") return;
    const origin = request.headers.origin;
    if (origin && origin !== allowedOrigin) return reply.code(403).send({ error: "Origin is not allowed." });
    const contentType = request.headers["content-type"] ?? "";
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return reply.code(415).send({ error: "Content-Type must be application/json." });
    if (request.url.split("?")[0] === "/api/episodes") {
      const now = Date.now();
      const window = episodeStartWindows.get(request.ip);
      if (!window || now - window.startedAt >= 60_000) {
        if (!window && episodeStartWindows.size >= 1_024) {
          for (const [ip, entry] of episodeStartWindows) if (now - entry.startedAt >= 60_000) episodeStartWindows.delete(ip);
          if (episodeStartWindows.size >= 1_024) return reply.code(429).send({ error: "Episode start capacity is temporarily full." });
        }
        episodeStartWindows.set(request.ip, { startedAt: now, count: 1 });
      }
      else if (window.count >= 20) return reply.code(429).send({ error: "Episode start limit reached. Try again in a minute." });
      else window.count += 1;
    }
  });
  app.get("/api/health", async () => ({ ok: true }));
  app.post("/api/episodes", async () => {
    const demoTruth = process.env.DEMO_TRUTH;
    const truth = demoTruth === "H1" || demoTruth === "H2" || demoTruth === "H3" || demoTruth === "H4" ? demoTruth : undefined;
    return service.start(truth);
  });
  app.get("/api/episodes/:id", async (request, reply) => {
    try { return service.get((request.params as { id: string }).id); }
    catch (error) { return reply.code(error instanceof ConflictError || error instanceof NotFoundError ? error.statusCode : 404).send({ error: (error as Error).message }); }
  });
  app.get("/api/episodes/:id/replay", async (request, reply) => {
    try { return service.replay((request.params as { id: string }).id); }
    catch (error) { return reply.code(404).send({ error: (error as Error).message }); }
  });
  app.post("/api/episodes/:id/actions", async (request, reply) => {
    try { return service.act((request.params as { id: string }).id, request.body); }
    catch (error) {
      const code = error instanceof ConflictError || error instanceof NotFoundError ? error.statusCode : 400;
      return reply.code(code).send({ error: (error as Error).message });
    }
  });
  return app;
}
