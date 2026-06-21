import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestPaperBuilds } from "./paperBuilds.js";

describe("ingestPaperBuilds", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds latest build summaries for Paper versions", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-paper-builds-"));
    const dataRoot = join(root, "packages/data/data/java");
    mkdirSync(dataRoot, { recursive: true });
    const paperPath = join(dataRoot, "paper.json");
    writeFileSync(
      paperPath,
      `${JSON.stringify({
        schemaVersion: 1,
        versions: ["1.21", "1.21.11"],
        sources: [],
      })}\n`,
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const version = url.split("/").at(-1);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ version, builds: version === "1.21" ? [1, 130] : [1, 69] }),
        };
      }),
    );

    await expect(
      ingestPaperBuilds({
        root,
        retrievedAt: "2026-06-22T00:00:00.000Z",
      }),
    ).resolves.toBe(2);

    const paper = JSON.parse(readFileSync(paperPath, "utf8")) as {
      versionBuilds: unknown;
      sources: Array<{ id: string }>;
    };
    expect(paper.versionBuilds).toEqual([
      {
        minecraftVersion: "1.21",
        latestBuild: 130,
        buildCount: 2,
      },
      {
        minecraftVersion: "1.21.11",
        latestBuild: 69,
        buildCount: 2,
      },
    ]);
    expect(paper.sources.map((source) => source.id)).toContain("papermc-api-paper-version-builds");
  });
});
