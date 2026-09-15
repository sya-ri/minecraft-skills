import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { runCli } from "./cli.js";

it("routes bounded metadata input without passing invalid or unsupported frames", async () => {
  const dir = mkdtempSync(join(tmpdir(), "texture-metadata-"));
  const file = join(dir, "input.json");
  try {
    for (const [metadata, expected] of [
      [{ animation: { frames: [0, 3] } }, 0],
      [{ animation: { frames: [4] } }, 1],
      [{ future: {} }, 1],
    ] as const) {
      writeFileSync(file, JSON.stringify({ metadata, width: 16, height: 64 }));
      const stdout: string[] = [];
      const errors: string[] = [];
      const code = await runCli(["validate-texture-metadata", file], {
        write: (v) => stdout.push(v),
        error: (v) => errors.push(v),
      });
      expect(errors).toEqual([]);
      expect(code).toBe(expected);
      expect(JSON.parse(stdout.join("\n")).valid).toBe(expected === 0);
    }
  } finally {
    unlinkSync(file);
    rmdirSync(dir);
  }
});
