import Database from "better-sqlite3";
import { Pool, type PoolClient } from "pg";

export type Row = Record<string, unknown>;

export interface SqlExecutor {
  all<T extends Row>(sql: string, ...params: unknown[]): Promise<T[]>;
  get<T extends Row>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  run(sql: string, ...params: unknown[]): Promise<void>;
}

export interface EpisodeStore extends SqlExecutor {
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): void;
}

const schema = `
  CREATE TABLE IF NOT EXISTS episodes (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, status TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS episode_secrets (episode_id TEXT PRIMARY KEY, truth_hypothesis_id TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS events (episode_id TEXT NOT NULL, seq INTEGER NOT NULL, type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (episode_id, seq));
  CREATE TABLE IF NOT EXISTS actions (episode_id TEXT NOT NULL, action_id TEXT NOT NULL, request_hash TEXT NOT NULL, status TEXT NOT NULL, response_json TEXT NOT NULL, PRIMARY KEY (episode_id, action_id));
  CREATE TABLE IF NOT EXISTS episode_owners (episode_id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL);
`;

function postgresSql(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function postgresExecutor(client: Pick<Pool, "query"> | PoolClient): SqlExecutor {
  return {
    async all<T extends Row>(sql: string, ...params: unknown[]) {
      const result = await client.query<T>(postgresSql(sql), params);
      return result.rows;
    },
    async get<T extends Row>(sql: string, ...params: unknown[]) {
      const result = await client.query<T>(postgresSql(sql), params);
      return result.rows[0];
    },
    async run(sql: string, ...params: unknown[]) {
      await client.query(postgresSql(sql), params);
    },
  };
}

function isTransientConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EHOSTUNREACH" || code === "ENETUNREACH"
    || /connection terminated due to connection timeout/i.test(error.message);
}

async function withConnectionRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientConnectionError(error)) throw error;
    return operation();
  }
}

export class PostgresStore implements EpisodeStore {
  private readonly pool: Pool;
  private ready: Promise<void> | undefined;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 });
  }

  private ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = withConnectionRetry(async () => {
        for (const statement of schema.split(";").map((part) => part.trim()).filter(Boolean)) {
          await this.pool.query(statement);
        }
      }).catch((error: unknown) => {
        this.ready = undefined;
        throw error;
      });
    }
    return this.ready;
  }

  async all<T extends Row>(sql: string, ...params: unknown[]) {
    await this.ensureReady();
    return postgresExecutor(this.pool).all<T>(sql, ...params);
  }

  async get<T extends Row>(sql: string, ...params: unknown[]) {
    await this.ensureReady();
    return postgresExecutor(this.pool).get<T>(sql, ...params);
  }

  async run(sql: string, ...params: unknown[]) {
    await this.ensureReady();
    await postgresExecutor(this.pool).run(sql, ...params);
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    await this.ensureReady();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(postgresExecutor(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  close(): void {
    void this.pool.end();
  }
}

export class SqliteStore implements EpisodeStore {
  private readonly db: Database.Database;
  private readonly lockKey: string;

  private static readonly queues = new Map<string, Promise<void>>();

  constructor(filename = ":memory:") {
    this.lockKey = filename === ":memory:" ? `:memory:${Math.random()}` : filename;
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(schema);
  }

  private async exclusive<T>(work: () => T | Promise<T>): Promise<T> {
    const previous = SqliteStore.queues.get(this.lockKey) ?? Promise.resolve();
    let release!: () => void;
    const queued = new Promise<void>((resolve) => { release = resolve; });
    SqliteStore.queues.set(this.lockKey, queued);
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  private executor(): SqlExecutor {
    return {
      all: async <T extends Row>(sql: string, ...params: unknown[]) =>
        this.db.prepare(sql.replace(/\s+FOR UPDATE\s*$/i, "")).all(...params as never[]) as T[],
      get: async <T extends Row>(sql: string, ...params: unknown[]) =>
        this.db.prepare(sql.replace(/\s+FOR UPDATE\s*$/i, "")).get(...params as never[]) as T | undefined,
      run: async (sql: string, ...params: unknown[]) => { this.db.prepare(sql).run(...params as never[]); },
    };
  }

  all<T extends Row>(sql: string, ...params: unknown[]) {
    return this.exclusive(() => this.executor().all<T>(sql, ...params));
  }

  get<T extends Row>(sql: string, ...params: unknown[]) {
    return this.exclusive(() => this.executor().get<T>(sql, ...params));
  }

  run(sql: string, ...params: unknown[]) {
    return this.exclusive(() => this.executor().run(sql, ...params));
  }

  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const result = await work(this.executor());
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    });
  }

  close(): void {
    this.db.close();
  }
}
