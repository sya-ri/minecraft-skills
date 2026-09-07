import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ingestCommandTree } from "./commandTrees.js";

describe("command report ingestion", () => {
  it("preserves artifact provenance and leaves prior data intact on malformed input", () => {
    const root = mkdtempSync(join(tmpdir(), "command-report-"));
    try {
      const input = join(root, "commands.json");
      writeFileSync(
        input,
        JSON.stringify({ type: "root", children: { stop: { type: "literal", executable: true } } }),
      );
      const options = {
        root,
        reportsDir: root,
        version: "26.2",
        retrievedAt: "2026-09-07T18:01:33Z",
      };
      const path = ingestCommandTree(options),
        text = readFileSync(path, "utf8");
      expect(JSON.parse(text)).toMatchObject({
        version: "26.2",
        nodeCount: 2,
        source: { serverSha1: "823e2250d24b3ddac457a60c92a6a941943fcd6a" },
      });
      expect(readFileSync(ingestCommandTree(options), "utf8")).toBe(text);
      writeFileSync(input, '{"type":"wrong"}');
      expect(() => ingestCommandTree(options)).toThrow();
      expect(readFileSync(path, "utf8")).toBe(text);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
