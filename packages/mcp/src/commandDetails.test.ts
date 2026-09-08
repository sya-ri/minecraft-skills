import { describe, expect, it } from "vitest";
import { callMinecraftSkillsTool } from "./tools.js";

describe("command detail MCP", () => {
  it("returns official argument nodes", async () => {
    const response = await callMinecraftSkillsTool("get_command_details", {
      version: "26.2",
      path: ["execute", "as", "targets"],
      depth: 0,
    });
    expect(response.isError).not.toBe(true);
    expect(JSON.parse(response.content[0]?.text ?? "{}")).toMatchObject({
      status: "available",
      version: "26.2",
      nodes: [
        {
          type: "argument",
          parser: "minecraft:entity",
          properties: { amount: "multiple", type: "entities" },
          redirect: ["execute"],
        },
      ],
    });
  });
  it("rejects invalid path payloads", async () => {
    expect(
      (await callMinecraftSkillsTool("get_command_details", { version: "26.2", path: "execute" }))
        .isError,
    ).toBe(true);
  });
});
