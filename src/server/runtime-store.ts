import { EpisodeService } from "./episode-service.js";
import { PostgresStore, SqliteStore } from "./store.js";

export function createEpisodeService(): EpisodeService {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) return new EpisodeService(new PostgresStore(connectionString));
  if (process.env.VERCEL) throw new Error("DATABASE_URL is required for hosted episode storage.");
  return new EpisodeService(new SqliteStore(process.env.TWINSLEUTH_DB ?? "twinsleuth.sqlite"));
}
