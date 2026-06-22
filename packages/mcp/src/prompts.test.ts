import { listDomains, listSkills } from "@minecraft-skills/catalog";
import { describe, expect, it } from "vitest";
import { getMinecraftSkillsPrompt, prompts } from "./prompts.js";

function textFromPrompt(name: string): string {
  const result = getMinecraftSkillsPrompt(name, {
    target_version: "26.2",
    task: "check migration",
  });
  return result.messages[0]?.content.type === "text" ? result.messages[0].content.text : "";
}

describe("MCP prompts", () => {
  it("exposes domain prompts", () => {
    expect(prompts.map((prompt) => prompt.name)).toEqual([
      "use_minecraft_datapacks",
      "use_minecraft_resourcepacks",
      "use_minecraft_paper_plugins",
    ]);
    expect(
      prompts.every((prompt) => prompt.arguments?.some((arg) => arg.name === "target_version")),
    ).toBe(true);
  });

  it("keeps prompts aligned with catalog skills", () => {
    const skills = listSkills();
    expect(prompts).toHaveLength(listDomains().length);

    for (const skill of skills) {
      const promptName = `use_${skill.name.replace("minecraft-", "minecraft_").replaceAll("-", "_")}`;
      expect(prompts.map((prompt) => prompt.name)).toContain(promptName);
      expect(textFromPrompt(promptName)).toContain(
        `minecraft-skills://skills/${skill.name}/SKILL.md`,
      );
    }
  });

  it("builds Paper plugin prompt text", () => {
    const result = getMinecraftSkillsPrompt("use_minecraft_paper_plugins", {
      target_version: "1.21.11",
      task: "handle player join",
    });
    const text = result.messages[0]?.content.type === "text" ? result.messages[0].content.text : "";
    expect(text).toContain("minecraft-skills://skills/minecraft-paper-plugins/SKILL.md");
    expect(text).toContain("get_support_matrix");
    expect(text).toContain("list_version_support");
    expect(text).toContain("list_intent_lookups");
    expect(text).toContain("get_intent_lookup");
    expect(text).toContain("get_authoring_context");
    expect(text).toContain("get_authoring_preflight");
    expect(text).toContain("get_evidence_bundle");
    expect(text).toContain("get_authoring_checklist");
    expect(text).toContain("list_authoring_guardrails");
    expect(text).toContain("list_claim_policies");
    expect(text).toContain("get_claim_policy");
    expect(text).toContain("list_fact_surfaces");
    expect(text).toContain("get_data_manifest");
    expect(text).toContain("get_source_policy");
    expect(text).toContain("get_paper_api_reference");
    expect(text).toContain("get_paper_api_surface");
    expect(text).toContain("search_paper_types");
    expect(text).toContain("search_paper_members");
    expect(text).toContain("search_paper_events");
    expect(text).toContain("fetch_data");
    expect(text).toContain("1.21.11");
    expect(text).toContain("handle player join");
  });

  it("builds datapack prompt text with schema lookup tools", () => {
    const text = textFromPrompt("use_minecraft_datapacks");
    expect(text).toContain("get_support_matrix");
    expect(text).toContain("list_version_support");
    expect(text).toContain("list_intent_lookups");
    expect(text).toContain("get_authoring_context");
    expect(text).toContain("get_authoring_preflight");
    expect(text).toContain("get_evidence_bundle");
    expect(text).toContain("get_authoring_checklist");
    expect(text).toContain("list_authoring_guardrails");
    expect(text).toContain("list_claim_policies");
    expect(text).toContain("list_fact_surfaces");
    expect(text).toContain("get_datapack_schema_surface");
    expect(text).toContain("search_datapack_schema");
    expect(text).toContain("compare_datapack_schema");
    expect(text).toContain("fetch_data");
  });

  it("rejects unknown prompts", () => {
    expect(() => getMinecraftSkillsPrompt("missing", {})).toThrow("Unknown prompt: missing");
  });
});
