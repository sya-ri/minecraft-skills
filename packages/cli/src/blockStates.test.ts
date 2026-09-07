import { describe, expect, it } from "vitest";
import { runCli } from "./cli.js";

describe("block-state CLI", () => {
  it("reads the selected version and preserves default state outside a page", async () => {
    const lines: string[] = [];
    const status = await runCli(
      ["minecraft", "block-state", "1.21.11", "minecraft:oak_stairs", "--limit", "1"],
      { write: (line) => lines.push(line), error: (line) => lines.push(line) },
    );
    expect(status).toBe(0);
    expect(JSON.parse(lines.join("\n"))).toMatchObject({
      status: "available",
      version: "1.21.11",
      stateCount: 80,
      returned: 1,
      defaultState: { properties: { facing: "north", half: "bottom" } },
    });
  });
});
