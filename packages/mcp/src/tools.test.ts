import { afterEach, describe, expect, it, vi } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

describe("MCP tools", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes catalog tools", () => {
    expect(tools.map((tool) => tool.name)).toContain("get_version");
    expect(tools.map((tool) => tool.name)).toContain("get_paper_plugin_data");
    expect(tools.map((tool) => tool.name)).toContain("list_pack_formats");
    expect(tools.map((tool) => tool.name)).toContain("compare_versions");
    expect(tools.map((tool) => tool.name)).toContain("get_server_reports");
    expect(tools.map((tool) => tool.name)).toContain("search_commands");
    expect(tools.map((tool) => tool.name)).toContain("get_vanilla_inventory");
    expect(tools.map((tool) => tool.name)).toContain("search_vanilla_paths");
    expect(tools.map((tool) => tool.name)).toContain("search_paper_events");
  });

  it("calls latest_version", async () => {
    expect((await callMinecraftSkillsTool("latest_version", {})).content[0]?.text).toBe("26.2");
  });

  it("returns errors as tool results", async () => {
    const result = await callMinecraftSkillsTool("missing", {});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe("Unknown tool: missing");
  });

  it("calls get_paper_plugin_data", async () => {
    const result = await callMinecraftSkillsTool("get_paper_plugin_data", {});
    expect(result.content[0]?.text).toContain('"minecraftVersion": "1.21.11"');
    expect(result.content[0]?.text).toContain("spigot-event-list");
  });

  it("calls list_pack_formats", async () => {
    const result = await callMinecraftSkillsTool("list_pack_formats", {});
    expect(result.content[0]?.text).toContain('"version": "26.2"');
    expect(result.content[0]?.text).toContain('"data": 107');
  });

  it("calls get_vanilla_inventory", async () => {
    const result = await callMinecraftSkillsTool("get_vanilla_inventory", {});
    expect(result.content[0]?.text).toContain('"version": "26.2"');
    expect(result.content[0]?.text).toContain('"assets/minecraft/models"');
  });

  it("calls search_vanilla_paths", async () => {
    const result = await callMinecraftSkillsTool("search_vanilla_paths", {
      version: "26.2",
      domain: "resourcepack",
      prefix: "assets/minecraft/models/block/",
      contains: "acacia_button",
      extension: "json",
    });
    expect(result.content[0]?.text).toContain("assets/minecraft/models/block/acacia_button.json");
  });

  it("calls compare_versions", async () => {
    const result = await callMinecraftSkillsTool("compare_versions", {
      from: "1.20.6",
      to: "1.21",
    });
    expect(result.content[0]?.text).toContain('"from": "1.20.6"');
    expect(result.content[0]?.text).toContain('"vanillaInventory"');
  });

  it("calls get_server_reports", async () => {
    const result = await callMinecraftSkillsTool("get_server_reports", {});
    expect(result.content[0]?.text).toContain('"coverage": "server-reports"');
    expect(result.content[0]?.text).toContain('"execute"');
  });

  it("calls search_commands", async () => {
    const result = await callMinecraftSkillsTool("search_commands", {
      version: "26.2",
      prefix: "execute",
    });
    expect(result.content[0]?.text).toContain('"matchedPaths"');
    expect(result.content[0]?.text).toContain("execute");
  });

  it("calls search_paper_events", async () => {
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ events: [{ name: "PlayerJoinEvent" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMinecraftSkillsTool("search_paper_events", {
      query: "player join",
      version: "1.21.11",
    });
    expect(result.content[0]?.text).toContain("PlayerJoinEvent");
    expect(fetchMock.mock.calls[0]?.[0] ?? "").toContain("version=1.21.11");
  });
});
