import { describe, expect, it } from "vitest";
import { runCli } from "./cli.js";

async function capture(args: string[]) {
  const stdout: string[] = [],
    stderr: string[] = [];
  const code = await runCli(args, {
    write: (value) => stdout.push(value),
    error: (value) => stderr.push(value),
  });
  return { code, stdout, stderr };
}
describe("minecraft entity-metadata CLI", () => {
  it("returns exact-version fields and explicit unsupported/not-found status", async () => {
    const result = await capture(["minecraft", "entity-metadata", "26.2", "minecraft:zombie"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(JSON.parse(result.stdout.join("\n"))).toMatchObject({
      status: "available",
      fieldCount: 19,
      version: "26.2",
      coverage: { complete: true },
    });
    const unavailable = await capture([
      "minecraft",
      "entity-metadata",
      "latest",
      "minecraft:zombie",
    ]);
    expect(JSON.parse(unavailable.stdout.join("\n"))).toMatchObject({
      status: "unavailable",
      reason: "unsupported-version",
    });
    const unknown = await capture([
      "minecraft",
      "entity-metadata",
      "26.2",
      "minecraft:missing_entity",
    ]);
    expect(JSON.parse(unknown.stdout.join("\n")).status).toBe("not-found");
  });
  it("rejects extra positional arguments and unsafe IDs", async () => {
    expect(
      (await capture(["minecraft", "entity-metadata", "26.2", "minecraft:zombie", "extra"])).code,
    ).toBe(1);
    expect(
      (await capture(["minecraft", "entity-metadata", "26.2", "minecraft:../zombie"])).code,
    ).toBe(1);
  });
});
