import { describe, expect, it } from "vitest";
import { getMinecraftSkillsPrompt, prompts } from "./prompts.js";

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

  it("builds Paper plugin prompt text", () => {
    const result = getMinecraftSkillsPrompt("use_minecraft_paper_plugins", {
      target_version: "1.21.11",
      task: "handle player join",
    });
    const text = result.messages[0]?.content.type === "text" ? result.messages[0].content.text : "";
    expect(text).toContain("minecraft-skills://skills/minecraft-paper-plugins/SKILL.md");
    expect(text).toContain("get_paper_api_reference");
    expect(text).toContain("search_paper_events");
    expect(text).toContain("1.21.11");
    expect(text).toContain("handle player join");
  });

  it("rejects unknown prompts", () => {
    expect(() => getMinecraftSkillsPrompt("missing", {})).toThrow("Unknown prompt: missing");
  });
});
