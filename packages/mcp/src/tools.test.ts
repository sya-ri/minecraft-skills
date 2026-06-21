import { describe, expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

describe("MCP tools", () => {
  it("exposes catalog tools", () => {
    expect(tools.map((tool) => tool.name)).toContain("get_version");
    expect(tools.map((tool) => tool.name)).toContain("get_paper_plugin_data");
    expect(tools.map((tool) => tool.name)).toContain("list_pack_formats");
  });

  it("calls latest_version", () => {
    expect(callMinecraftSkillsTool("latest_version", {}).content[0]?.text).toBe("26.2");
  });

  it("returns errors as tool results", () => {
    const result = callMinecraftSkillsTool("missing", {});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe("Unknown tool: missing");
  });

  it("calls get_paper_plugin_data", () => {
    const result = callMinecraftSkillsTool("get_paper_plugin_data", {});
    expect(result.content[0]?.text).toContain('"minecraftVersion": "1.21.11"');
    expect(result.content[0]?.text).toContain("spigot-event-list");
  });

  it("calls list_pack_formats", () => {
    const result = callMinecraftSkillsTool("list_pack_formats", {});
    expect(result.content[0]?.text).toContain('"version": "26.2"');
    expect(result.content[0]?.text).toContain('"data": 107');
  });
});
