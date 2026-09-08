import { describe, expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

describe("get_entity_metadata MCP tool", () => {
  it("is a closed exact-version lookup and returns verified inherited facts", async () => {
    const tool = tools.find((candidate) => candidate.name === "get_entity_metadata");
    expect(tool?.inputSchema.additionalProperties).toBe(false);
    expect(tool?.inputSchema.required).toEqual(["version", "entityId"]);
    for (const version of ["26.2", "1.21.11"]) {
      const result = await callMinecraftSkillsTool("get_entity_metadata", {
        version,
        entityId: "minecraft:armor_stand",
      });
      expect(result.isError).toBeUndefined();
      const json = JSON.parse(result.content[0]?.text ?? "null");
      expect(json).toMatchObject({
        status: "available",
        version,
        fieldCount: 22,
        coverage: { complete: true },
      });
      expect(json.metadata[0]).toMatchObject({
        index: 0,
        accessor: "DATA_SHARED_FLAGS_ID",
        declaredIn: "net.minecraft.world.entity.Entity",
        valueType: "java.lang.Byte",
        serializerId: 0,
      });
      expect(json.metadata[21]).toMatchObject({
        accessor: "DATA_RIGHT_LEG_POSE",
        valueType: "net.minecraft.core.Rotations",
      });
      expect(json.source.serverSha1).toMatch(/^[a-f0-9]{40}$/);
    }
  });
  it("keeps unsupported versions explicit and rejects malformed IDs and runtime types", async () => {
    const unsupported = await callMinecraftSkillsTool("get_entity_metadata", {
      version: "latest",
      entityId: "minecraft:zombie",
    });
    expect(JSON.parse(unsupported.content[0]?.text ?? "null")).toMatchObject({
      status: "unavailable",
      reason: "unsupported-version",
      version: "latest",
    });
    for (const input of [
      { version: "26.2", entityId: "minecraft:../zombie" },
      { version: 26.2, entityId: "minecraft:zombie" },
      { version: "26.2", entityId: null },
    ])
      expect((await callMinecraftSkillsTool("get_entity_metadata", input)).isError).toBe(true);
  });
});
