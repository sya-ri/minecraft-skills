import { describe, expect, it } from "vitest";
import { runCli } from "./cli.js";

describe("command detail CLI", () => {
  it("accepts node paths and bounded subtree options", async () => {
    const lines: string[] = [];
    expect(
      await runCli(
        ["minecraft", "command-details", "1.21.11", "execute", "as", "targets", "--depth", "0"],
        { write: (l) => lines.push(l), error: (l) => lines.push(l) },
      ),
    ).toBe(0);
    expect(JSON.parse(lines.join("\n"))).toMatchObject({
      status: "available",
      version: "1.21.11",
      returned: 1,
      path: ["execute", "as", "targets"],
      nodes: [{ parser: "minecraft:entity", redirect: ["execute"] }],
    });
  });
});
