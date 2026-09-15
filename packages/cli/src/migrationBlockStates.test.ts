import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { runCli } from "./cli.js";

it("normalizes a bounded report envelope through the CLI", async () => {
  const directory = mkdtempSync(join(tmpdir(), "block-normalization-"));
  const file = join(directory, "input.json");
  const stdout: string[] = [];
  const output = { write: (s: string) => stdout.push(s), error: (_s: string) => {} };
  try {
    writeFileSync(
      file,
      JSON.stringify({
        version: "fixture",
        source: "fixture report",
        blocks: { "test:block": { states: [{ default: true }] } },
        states: [{ Name: "test:block" }],
      }),
    );
    expect(await runCli(["normalize-migration-block-states", file], output)).toBe(0);
    expect(JSON.parse(stdout.join("\n")).states).toEqual([{ Name: "test:block", Properties: {} }]);
    expect(await runCli(["normalize-migration-block-states", file, "unexpected"], output)).toBe(1);
    expect(await runCli(["normalize-migration-block-states"], output)).toBe(1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
