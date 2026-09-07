import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "./cli.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
async function capture(args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    write: (value) => stdout.push(value),
    error: (value) => stderr.push(value),
  });
  return { code, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
}
function file(contents: string | Uint8Array) {
  const root = mkdtempSync(join(tmpdir(), "fabric-set-cli-"));
  roots.push(root);
  const path = join(root, "selection.json");
  writeFileSync(path, contents);
  return path;
}
const selection = {
  mods: [
    {
      label: "example.jar",
      metadata: { schemaVersion: 1, id: "example", version: "1", depends: { java: ">=21" } },
    },
  ],
  environment: "server",
  runtimeVersions: { minecraft: "1.21.1", java: "21", fabricloader: "0.16.10" },
  selectionComplete: true,
};

describe("fabric validate-set CLI", () => {
  it("reads bounded local JSON and reflects complete, incomplete, and invalid statuses in exit codes", async () => {
    const valid = await capture(["fabric", "validate-set", file(JSON.stringify(selection))]);
    expect(valid.code).toBe(0);
    expect(JSON.parse(valid.stdout)).toMatchObject({
      status: "satisfied",
      mods: [{ label: "example.jar" }],
    });
    const incomplete = await capture([
      "fabric",
      "validate-set",
      file(JSON.stringify({ ...selection, selectionComplete: false })),
    ]);
    expect(incomplete.code).toBe(1);
    expect(JSON.parse(incomplete.stdout).status).toBe("incomplete");
    const invalid = await capture([
      "fabric",
      "validate-set",
      file(
        JSON.stringify({
          ...selection,
          runtimeVersions: { ...selection.runtimeVersions, java: "17" },
        }),
      ),
    ]);
    expect(invalid.code).toBe(1);
    expect(JSON.parse(invalid.stdout).status).toBe("invalid");
  });
  it("rejects malformed/oversized/non-file input and unknown options", async () => {
    for (const args of [
      [],
      [file("{")],
      [file(Uint8Array.of(0xff))],
      [file(" ".repeat(8 * 1024 * 1024 + 1))],
      [file("{}"), "extra"],
      [file("{}"), "--unknown"],
      [file("{}"), "--max-mods", "513"],
    ]) {
      expect((await capture(["fabric", "validate-set", ...args])).code).toBe(1);
    }
    const path = file("{}");
    expect((await capture(["fabric", "validate-set", join(path, "missing.json")])).code).toBe(1);
  });
});
