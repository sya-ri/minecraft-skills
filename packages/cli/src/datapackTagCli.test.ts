import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "./cli.js";

const roots: string[] = [];
function pack(values: unknown[], replace = false) {
  const root = mkdtempSync(join(tmpdir(), "minecraft-skills-tag-cli-"));
  roots.push(root);
  mkdirSync(join(root, "data/test/tags/item"), { recursive: true });
  writeFileSync(
    join(root, "pack.mcmeta"),
    JSON.stringify({ pack: { description: "Tag test", min_format: 101, max_format: 101 } }),
  );
  writeFileSync(join(root, "data/test/tags/item/root.json"), JSON.stringify({ values, replace }));
  return root;
}
async function capture(argv: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(argv, {
    write: (value) => stdout.push(value),
    error: (value) => stderr.push(value),
  });
  return { code, stdout, stderr };
}
describe("datapack resolve-tag CLI", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });
  it("scans explicit roots in low-to-high priority order including pack.mcmeta", async () => {
    const lower = pack(["stone"]);
    const higher = pack(["apple"], true);
    const result = await capture([
      "datapack",
      "resolve-tag",
      "26.2",
      "item",
      "test:root",
      "--pack-root",
      lower,
      "--pack-root",
      higher,
      "--no-vanilla",
    ]);
    expect(result.code).toBe(0);
    expect(result.stderr).toEqual([]);
    const json = JSON.parse(result.stdout.join("\n"));
    expect(json.packOrder).toEqual(["pack-1", "pack-2"]);
    expect(json.members.map((member: { id: string }) => member.id)).toEqual(["minecraft:apple"]);
    expect(json.members[0].source.pack).toBe("pack-2");
    expect(result.stdout.join("\n")).not.toContain(lower);
    const reversed = await capture([
      "datapack",
      "resolve-tag",
      "26.2",
      "item",
      "test:root",
      "--pack-root",
      higher,
      "--pack-root",
      lower,
      "--no-vanilla",
    ]);
    expect(JSON.parse(reversed.stdout.join("\n")).memberCount).toBe(2);
  });
  it("returns nonzero for unresolved tags and rejects duplicate roots or unsupported versions", async () => {
    const root = pack(["test:missing"]);
    const result = await capture([
      "datapack",
      "resolve-tag",
      "1.21.11",
      "item",
      "test:root",
      "--pack-root",
      root,
      "--no-vanilla",
    ]);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout.join("\n")).status).toBe("unresolved");
    const duplicate = await capture([
      "datapack",
      "resolve-tag",
      "26.2",
      "item",
      "test:root",
      "--pack-root",
      root,
      "--pack-root",
      root,
    ]);
    expect(duplicate.code).toBe(1);
    expect(duplicate.stderr.join("\n")).toContain("must not repeat");
    const unsupported = await capture([
      "datapack",
      "resolve-tag",
      "latest",
      "item",
      "test:root",
      "--pack-root",
      "missing-directory",
    ]);
    expect(unsupported.stderr.join("\n")).toContain("exact version");
  });
});
