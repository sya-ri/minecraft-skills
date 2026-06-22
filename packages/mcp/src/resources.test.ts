import { listReferences, listSkills } from "@minecraft-skills/catalog";
import { describe, expect, it } from "vitest";
import { listMinecraftSkillsResources, readMinecraftSkillsResource } from "./resources.js";

describe("MCP resources", () => {
  it("lists packaged skill resources", () => {
    const resources = listMinecraftSkillsResources();
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://skills/minecraft-paper-plugins/SKILL.md",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://skills/minecraft-paper-plugins/agents/openai.yaml",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://skills/minecraft-paper-plugins/references/sources.md",
    );
    expect(resources.every((resource) => resource.size > 0)).toBe(true);
  });

  it("lists data manifest and downloadable data resources", () => {
    const resources = listMinecraftSkillsResources();
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/data-manifest.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/java/datapack-schema-surfaces/26.2.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/java/paper-api-surfaces/1.21.11.json",
    );
  });

  it("exposes every catalog skill payload as resources", () => {
    const resources = listMinecraftSkillsResources();
    const uris = new Set(resources.map((resource) => resource.uri));

    for (const skill of listSkills()) {
      expect(uris).toContain(`minecraft-skills://skills/${skill.name}/SKILL.md`);
      expect(uris).toContain(`minecraft-skills://skills/${skill.name}/agents/openai.yaml`);
      for (const reference of listReferences(skill.domain)) {
        expect(uris).toContain(
          `minecraft-skills://skills/${skill.name}/${reference.path.slice(
            `${skill.path}/`.length,
          )}`,
        );
      }
    }
  });

  it("reads skill resources", () => {
    const result = readMinecraftSkillsResource(
      "minecraft-skills://skills/minecraft-paper-plugins/SKILL.md",
    );
    expect(result.contents).toEqual([
      expect.objectContaining({
        uri: "minecraft-skills://skills/minecraft-paper-plugins/SKILL.md",
        mimeType: "text/markdown",
        text: expect.stringContaining("# Minecraft Paper Plugins"),
      }),
    ]);
  });

  it("reads data resources", () => {
    const manifest = readMinecraftSkillsResource("minecraft-skills://data/data-manifest.json");
    expect(manifest.contents[0]?.text).toContain('"dataVersion": "2026.06.22-1"');

    const paperSurface = readMinecraftSkillsResource(
      "minecraft-skills://data/java/paper-api-surfaces/1.21.11.json",
    );
    expect(paperSurface.contents[0]?.text).toContain('"coverage": "javadocs-search-index"');
  });

  it("rejects unknown resources", () => {
    expect(() => readMinecraftSkillsResource("minecraft-skills://skills/missing/SKILL.md")).toThrow(
      "Unknown resource",
    );
  });
});
