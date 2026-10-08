import { afterAll, describe, expect, it } from "vitest";
import { build } from "vite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outDir = mkdtempSync(join(tmpdir(), "twinsleuth-bundle-"));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe("browser artifact privacy", () => {
  it("does not bundle the private forecast model or complete authored rows", async () => {
    await build({ build: { outDir, emptyOutDir: true }, logLevel: "silent" });
    const assets = join(outDir, "assets");
    const javascript = readdirSync(assets)
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFileSync(join(assets, name), "utf8"))
      .join("\n");

    expect(javascript).not.toContain("PIN9_MODEL");
    expect(javascript).not.toContain("server/case-model/pin9");
    expect(javascript).not.toMatch(/H1:"completed",H2:"refused",H3:"refused",H4:"completed"/);
    expect(javascript).not.toMatch(/H1:"stopped-at-95",H2:"full-range",H3:"full-range",H4:"full-range"/);
  });
});
