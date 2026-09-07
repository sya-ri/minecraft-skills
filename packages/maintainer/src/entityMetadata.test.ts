import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { entityMetadataArtifacts } from "@minecraft-skills/catalog";
import { describe, expect, it } from "vitest";
import { ingestEntityMetadata } from "./entityMetadata.js";

describe("entity metadata ingestion", () => {
  it("preserves partial extraction gaps, binds artifact/helper hashes, and does not replace data after invalid input", () => {
    const root = mkdtempSync(join(tmpdir(), "entity-metadata-ingest-"));
    try {
      mkdirSync(join(root, "packages/maintainer/scripts"), { recursive: true });
      copyFileSync(
        resolve("scripts/ExtractEntityMetadata.java"),
        join(root, "packages/maintainer/scripts/ExtractEntityMetadata.java"),
      );
      const input = join(root, "report.json");
      const report = {
        schemaVersion: 1,
        version: "26.2",
        serverSha1: entityMetadataArtifacts["26.2"].serverSha1,
        discoveredEntityIds: ["minecraft:zombie"],
        entities: {},
        gaps: [
          {
            entityId: "minecraft:zombie",
            code: "declaration-extraction-failed",
            detail: "Test failure",
          },
        ],
      };
      writeFileSync(input, JSON.stringify(report));
      const options = { root, version: "26.2", input, retrievedAt: "2026-09-07T18:55:53Z" };
      const output = ingestEntityMetadata(options);
      const first = readFileSync(output, "utf8");
      expect(JSON.parse(first)).toMatchObject({
        entityCount: 0,
        coverage: { registryEntityCount: 158, complete: false },
        source: { kind: "official-reflection", serverSha1: report.serverSha1 },
      });
      expect(JSON.parse(first).source.extractorSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(readFileSync(ingestEntityMetadata(options), "utf8")).toBe(first);
      writeFileSync(input, JSON.stringify({ ...report, serverSha1: "a".repeat(40) }));
      expect(() => ingestEntityMetadata(options)).toThrow("artifact mismatch");
      expect(readFileSync(output, "utf8")).toBe(first);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
