import { describe, expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

const request = {
  version: "26.2",
  registry: "item",
  tag: "test:root",
  includeVanilla: false,
  packs: [
    {
      id: "base",
      files: [
        {
          path: "pack.mcmeta",
          content: { pack: { description: "Fixture", min_format: 101, max_format: 101 } },
        },
        { path: "data/test/tags/item/root.json", content: { values: ["stone"] } },
      ],
    },
  ],
};
describe("resolve_datapack_tag MCP", () => {
  it("exposes a closed bounded exact-version schema and ordered source evidence", async () => {
    const tool = tools.find((candidate) => candidate.name === "resolve_datapack_tag");
    expect(tool?.inputSchema.additionalProperties).toBe(false);
    expect(tool?.inputSchema.required).toEqual(["version", "registry", "tag", "packs"]);
    const result = await callMinecraftSkillsTool("resolve_datapack_tag", request);
    expect(result.isError).toBeUndefined();
    const json = JSON.parse(result.content[0]?.text ?? "null");
    expect(json.resolutionComplete).toBe(true);
    expect(json.members[0].source).toEqual({
      pack: "base",
      path: "data/test/tags/item/root.json",
      tag: "test:root",
      index: 0,
    });
  });
  it("validates runtime types, aggregate limits and content depth before resolution", async () => {
    for (const input of [
      { ...request, version: "latest" },
      { ...request, edition: "bedrock" },
      { ...request, includeVanilla: "false" },
      { ...request, packs: null },
      {
        ...request,
        packs: Array.from({ length: 33 }, (_, index) => ({ id: `pack${index}`, files: [] })),
      },
      {
        ...request,
        packs: [
          {
            id: "deep",
            files: [{ path: "pack.mcmeta", content: `${'{"a":'.repeat(130)}0${"}".repeat(130)}` }],
          },
        ],
      },
    ]) {
      expect((await callMinecraftSkillsTool("resolve_datapack_tag", input)).isError).toBe(true);
    }
  });
  it("separates candidate members when metadata is absent", async () => {
    const result = await callMinecraftSkillsTool("resolve_datapack_tag", {
      ...request,
      packs: [{ id: "partial", files: [request.packs[0]?.files[1]] }],
    });
    expect(result.isError).toBeUndefined();
    const json = JSON.parse(result.content[0]?.text ?? "null");
    expect(json.status).toBe("incomplete");
    expect(json.members).toEqual([]);
    expect(json.candidateMemberCount).toBe(1);
  });
});
