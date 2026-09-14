import { expect, it } from "vitest";
import { runCli } from "./cli.js";

it("documents the command and rejects missing input", async () => {
  const stdout: string[] = [],
    stderr: string[] = [];
  const output = { write: (s: string) => stdout.push(s), error: (s: string) => stderr.push(s) };
  expect(await runCli(["--help"], output)).toBe(0);
  expect(stdout.join("\n")).toContain("compare-migration-captures");
  expect(await runCli(["compare-migration-captures"], output)).toBe(1);
  expect(stderr.length).toBeGreaterThan(0);
});
