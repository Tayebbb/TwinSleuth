import Fastify from "fastify";
import cors from "@fastify/cors";
import { EpisodeService, ConflictError } from "./episode-service.js";

export function buildApp(service = new EpisodeService()) {
  const app = Fastify({ logger: false });
  void app.register(cors, { origin: process.env.UI_ORIGIN ?? "http://localhost:5173" });
  app.get("/api/health", async () => ({ ok: true }));
  app.post("/api/episodes", async () => service.start());
  app.get("/api/episodes/:id", async (request, reply) => {
    try { return service.get((request.params as { id: string }).id); }
    catch (error) { return reply.code(error instanceof ConflictError ? error.statusCode : 404).send({ error: (error as Error).message }); }
  });
  app.get("/api/episodes/:id/replay", async (request, reply) => {
    try { return service.replay((request.params as { id: string }).id); }
    catch (error) { return reply.code(404).send({ error: (error as Error).message }); }
  });
  app.post("/api/episodes/:id/actions", async (request, reply) => {
    try { return service.act((request.params as { id: string }).id, request.body); }
    catch (error) {
      const code = error instanceof ConflictError ? error.statusCode : 400;
      return reply.code(code).send({ error: (error as Error).message });
    }
  });
  return app;
}
