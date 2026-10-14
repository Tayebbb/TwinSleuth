import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/server/app.js";
import { createEpisodeService } from "../src/server/runtime-store.js";

const app = buildApp(createEpisodeService());
const ready = app.ready();

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  await ready;
  app.server.emit("request", request, response);
}
