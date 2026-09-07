import { describe, expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

describe("block-state lookup MCP", () => {
  it("returns paginated official block facts", async () => {
    const response = await callMinecraftSkillsTool("get_block_state_definition", {
      version: "26.2",
      blockId: "minecraft:oak_stairs",
      limit: 1,
    });
    expect(response.isError).not.toBe(true);
    expect(JSON.parse(response.content[0]?.text ?? "{}")).toMatchObject({
      version: "26.2",
      status: "available",
      stateCount: 80,
      returned: 1,
      truncated: true,
      properties: { facing: ["north", "south", "west", "east"] },
    });
  });
  it("exposes bounded inputs and rejects absent identifiers", async () => {
    expect(
      tools.find((t) => t.name === "get_block_state_definition")?.inputSchema.required,
    ).toEqual(["version", "blockId"]);
    expect(
      (await callMinecraftSkillsTool("get_block_state_definition", { version: "26.2" })).isError,
    ).toBe(true);
  });
});
