import { buildApp } from "./app.js";
import { EpisodeService } from "./episode-service.js";
import { spawn } from "node:child_process";

const service = new EpisodeService(process.env.TWINSLEUTH_DB ?? "twinsleuth.sqlite");
const app = buildApp(service);
const port = Number(process.env.PORT ?? 5174);
await app.listen({ port, host: "127.0.0.1" });
console.log(`TwinSleuth API listening on http://127.0.0.1:${port}`);
const web = spawn("npm", ["run", "dev:web", "--", "--host", "127.0.0.1"], { stdio: "inherit", shell: true });
const shutdown = () => { web.kill(); service.close(); void app.close(); };
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
