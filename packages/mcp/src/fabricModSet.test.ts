import { describe, expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

const input = {
  mods: [
    { metadata: { schemaVersion: 1, id: "example", version: "1", depends: { java: ">=21" } } },
  ],
  environment: "server",
  runtimeVersions: { minecraft: "1.21.1", java: "21", fabricloader: "0.16.10" },
  selectionComplete: true,
};

describe("validate_fabric_mod_set MCP", () => {
  it("exposes one bounded fixed-set tool and returns structured offline results", async () => {
    const tool = tools.find((item) => item.name === "validate_fabric_mod_set");
    expect(tool?.inputSchema.required).toEqual([
      "mods",
      "environment",
      "runtimeVersions",
      "selectionComplete",
    ]);
    const result = await callMinecraftSkillsTool("validate_fabric_mod_set", input);
    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining('"status": "satisfied"'),
        }),
      ]),
    );
    const incomplete = await callMinecraftSkillsTool("validate_fabric_mod_set", {
      ...input,
      selectionComplete: false,
    });
    expect(JSON.stringify(incomplete.content)).toContain("incomplete");
  });

  it("rejects missing completeness, invalid versions, unknown fields, and raised limits", async () => {
    for (const args of [
      { ...input, selectionComplete: undefined },
      { ...input, runtimeVersions: { java: "21" } },
      { ...input, extra: true },
      { ...input, limits: { maxMods: 513 } },
    ]) {
      expect((await callMinecraftSkillsTool("validate_fabric_mod_set", args)).isError).toBe(true);
    }
  });
});
