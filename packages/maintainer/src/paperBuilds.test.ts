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
        latest: {
          minecraftVersion: "26.2",
          build: 0,
        },
        support: {
          minecraftLatestGap: {
            javaLatest: "26.2",
            paperLatest: "26.2",
            status: "paper-current-with-java-latest",
          },
        },
        versions: ["26.1", "26.1.1", "26.1.2", "26.2"],
        sources: [],
      })}\n`,
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const version = url.split("/").at(-2);
        const buildsByVersion: Record<string, Array<{ id: number; channel: string }>> = {
          "26.1": [],
          "26.1.1": [
            { id: 28, channel: "ALPHA" },
            { id: 29, channel: "ALPHA" },
          ],
          "26.1.2": [{ id: 72, channel: "STABLE" }],
          "26.2": [
            { id: 1, channel: "ALPHA" },
            { id: 30, channel: "ALPHA" },
          ],
        };
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => buildsByVersion[version ?? ""] ?? [],
        };
      }),
    );

    await expect(
      ingestPaperBuilds({
        root,
        retrievedAt: "2026-06-22T00:00:00.000Z",
      }),
    ).resolves.toBe(3);

    const paper = JSON.parse(readFileSync(paperPath, "utf8")) as {
      latest: unknown;
      support: { minecraftLatestGap: unknown };
      versions: unknown;
      versionBuilds: unknown;
      sources: Array<{ id: string }>;
    };
    expect(paper.latest).toEqual({
      minecraftVersion: "26.2",
      build: 30,
    });
    expect(paper.support.minecraftLatestGap).toEqual({
      javaLatest: "26.2",
      paperLatest: "26.2",
      status: "paper-current-with-java-latest",
    });
    expect(paper.versions).toEqual(["26.1.1", "26.1.2", "26.2"]);
    expect(paper.versionBuilds).toEqual([
      {
        minecraftVersion: "26.1.1",
        latestBuild: 29,
        buildCount: 2,
      },
      {
        minecraftVersion: "26.1.2",
        latestBuild: 72,
        buildCount: 1,
      },
      {
        minecraftVersion: "26.2",
        latestBuild: 30,
        buildCount: 2,
      },
    ]);
    expect(paper.sources.map((source) => source.id)).toContain(
      "papermc-downloads-paper-version-builds",
    );
  });
});
