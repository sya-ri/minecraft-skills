import { describe, expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

describe("MCP tools", () => {
  it("exposes catalog tools", () => {
    expect(tools.map((tool) => tool.name)).toContain("get_version");
  });

  it("calls latest_version", () => {
    expect(callMinecraftSkillsTool("latest_version", {}).content[0]?.text).toBe("26.2");
  });

  it("returns errors as tool results", () => {
    const result = callMinecraftSkillsTool("missing", {});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe("Unknown tool: missing");
  });
});
