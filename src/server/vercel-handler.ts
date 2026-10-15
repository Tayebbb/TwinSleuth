import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "./app.js";
import { createEpisodeService } from "./runtime-store.js";

const app = buildApp(createEpisodeService());
const ready = app.ready();

export async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  await ready;
  app.server.emit("request", request, response);
}
