import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ingestBlockStates } from "./blockStates.js";

describe("block report ingestion", () => {
  it("writes reproducible normalized facts with verified artifact identity and input digest", () => {
    const root = mkdtempSync(join(tmpdir(), "block-report-"));
    try {
      writeFileSync(
        join(root, "blocks.json"),
        JSON.stringify({ "minecraft:stone": { states: [{ id: 1, default: true }] } }),
      );
      const options = {
        root,
        version: "26.2",
        reportsDir: root,
        retrievedAt: "2026-09-07T18:01:33Z",
      };
      const path = ingestBlockStates(options);
      const text = readFileSync(path, "utf8");
      expect(JSON.parse(text)).toMatchObject({
        version: "26.2",
        blockCount: 1,
        stateCount: 1,
        source: {
          kind: "official-generated",
          serverSha1: "823e2250d24b3ddac457a60c92a6a941943fcd6a",
        },
      });
      expect(readFileSync(ingestBlockStates(options), "utf8")).toBe(text);
      writeFileSync(join(root, "blocks.json"), '{"minecraft:stone":{"states":[{"id":1}]}}');
      expect(() => ingestBlockStates(options)).toThrow("default");
      expect(readFileSync(path, "utf8")).toBe(text);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
