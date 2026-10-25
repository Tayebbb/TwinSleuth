import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("pg", () => ({
  Pool: class {
    query = query;
    end = vi.fn();
    connect = vi.fn();
  },
}));

import { PostgresStore } from "./store.js";

describe("PostgresStore startup", () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({ rows: [] });
  });

  it("retries schema initialization after a transient cold connection timeout", async () => {
    query.mockRejectedValueOnce(new Error("Connection terminated due to connection timeout"));
    const store = new PostgresStore("postgres://unused");

    await expect(store.all("SELECT 1")).resolves.toEqual([]);

    // One failed schema statement, all five idempotent schema statements on retry, then the query.
    expect(query).toHaveBeenCalledTimes(7);
    store.close();
  });

  it("does not retry permanent database errors", async () => {
    const error = Object.assign(new Error("permission denied"), { code: "42501" });
    query.mockRejectedValueOnce(error);
    const store = new PostgresStore("postgres://unused");

    await expect(store.all("SELECT 1")).rejects.toBe(error);
    expect(query).toHaveBeenCalledTimes(1);
    store.close();
  });
});
