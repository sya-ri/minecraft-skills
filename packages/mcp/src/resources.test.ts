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
      "minecraft-skills://data/authoring-checklists.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-checklists/paper-plugin.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-guardrails.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-guardrails/paper-api-surface-limits.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-diagnostics.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-diagnostics/paper-api-member-unverified.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-recipes.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-recipes/paper-event-listener.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/claim-policies.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/claim-policies/paper-type-or-member-exists.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/output-requirements.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/output-requirements/paper-plugin-output-safety.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/response-patterns.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/response-patterns/paper-api-answer.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/fact-surfaces.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/fact-surfaces/datapack-schema-surface.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/intent-lookups.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/intent-lookups/verify-paper-type-or-member.json",
    );
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
    const checklists = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-checklists.json",
    );
    expect(checklists.contents[0]?.text).toContain('"domain": "datapack"');

    const paperChecklist = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-checklists/paper-plugin.json",
    );
    expect(paperChecklist.contents[0]?.text).toContain("verify-types-members-and-events");

    const guardrails = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails.json",
    );
    expect(guardrails.contents[0]?.text).toContain('"id": "paper-api-surface-limits"');

    const guardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/paper-api-surface-limits.json",
    );
    expect(guardrail.contents[0]?.text).toContain("Javadocs package, type, and member indexes");

    const diagnostics = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics.json",
    );
    expect(diagnostics.contents[0]?.text).toContain('"id": "paper-api-member-unverified"');

    const diagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/paper-api-member-unverified.json",
    );
    expect(diagnostic.contents[0]?.text).toContain("searchPaperMembers");

    const recipes = readMinecraftSkillsResource("minecraft-skills://data/authoring-recipes.json");
    expect(recipes.contents[0]?.text).toContain('"id": "paper-event-listener"');

    const recipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/datapack-function-command.json",
    );
    expect(recipe.contents[0]?.text).toContain("verify-command-path");

    const claimPolicies = readMinecraftSkillsResource(
      "minecraft-skills://data/claim-policies.json",
    );
    expect(claimPolicies.contents[0]?.text).toContain('"id": "paper-type-or-member-exists"');

    const claimPolicy = readMinecraftSkillsResource(
      "minecraft-skills://data/claim-policies/command-syntax-exists.json",
    );
    expect(claimPolicy.contents[0]?.text).toContain("parser shape, not gameplay behavior");

    const outputRequirements = readMinecraftSkillsResource(
      "minecraft-skills://data/output-requirements.json",
    );
    expect(outputRequirements.contents[0]?.text).toContain('"id": "paper-plugin-output-safety"');

    const outputRequirement = readMinecraftSkillsResource(
      "minecraft-skills://data/output-requirements/paper-plugin-output-safety.json",
    );
    expect(outputRequirement.contents[0]?.text).toContain("Javadocs type/member evidence");

    const responsePatterns = readMinecraftSkillsResource(
      "minecraft-skills://data/response-patterns.json",
    );
    expect(responsePatterns.contents[0]?.text).toContain('"id": "paper-api-answer"');

    const responsePattern = readMinecraftSkillsResource(
      "minecraft-skills://data/response-patterns/paper-api-answer.json",
    );
    expect(responsePattern.contents[0]?.text).toContain("name presence, not behavior");

    const factSurfaces = readMinecraftSkillsResource("minecraft-skills://data/fact-surfaces.json");
    expect(factSurfaces.contents[0]?.text).toContain('"id": "paper-api-surface"');

    const factSurface = readMinecraftSkillsResource(
      "minecraft-skills://data/fact-surfaces/datapack-schema-surface.json",
    );
    expect(factSurface.contents[0]?.text).toContain("not a normative schema");

    const intentLookups = readMinecraftSkillsResource(
      "minecraft-skills://data/intent-lookups.json",
    );
    expect(intentLookups.contents[0]?.text).toContain('"id": "verify-command-syntax"');

    const intentLookup = readMinecraftSkillsResource(
      "minecraft-skills://data/intent-lookups/verify-paper-type-or-member.json",
    );
    expect(intentLookup.contents[0]?.text).toContain('"search_paper_members"');

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
