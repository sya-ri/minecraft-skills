import { listDomains } from "@minecraft-skills/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

describe("MCP tools", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes catalog tools", () => {
    expect(tools.map((tool) => tool.name)).toContain("get_version");
    expect(tools.map((tool) => tool.name)).toContain("list_skills");
    expect(tools.map((tool) => tool.name)).toContain("get_skill");
    expect(tools.map((tool) => tool.name)).toContain("list_authoring_checklists");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_checklist");
    expect(tools.map((tool) => tool.name)).toContain("list_authoring_guardrails");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_guardrail");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_context");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_preflight");
    expect(tools.map((tool) => tool.name)).toContain("get_evidence_bundle");
    expect(tools.map((tool) => tool.name)).toContain("list_intent_lookups");
    expect(tools.map((tool) => tool.name)).toContain("get_intent_lookup");
    expect(tools.map((tool) => tool.name)).toContain("list_fact_surfaces");
    expect(tools.map((tool) => tool.name)).toContain("get_fact_surface");
    expect(tools.map((tool) => tool.name)).toContain("get_coverage_summary");
    expect(tools.map((tool) => tool.name)).toContain("get_data_manifest");
    expect(tools.map((tool) => tool.name)).toContain("get_support_matrix");
    expect(tools.map((tool) => tool.name)).toContain("list_version_support");
    expect(tools.map((tool) => tool.name)).toContain("get_cache_status");
    expect(tools.map((tool) => tool.name)).toContain("fetch_data");
    expect(tools.map((tool) => tool.name)).toContain("clean_cache");
    expect(tools.map((tool) => tool.name)).toContain("get_paper_plugin_data");
    expect(tools.map((tool) => tool.name)).toContain("list_pack_formats");
    expect(tools.map((tool) => tool.name)).toContain("compare_versions");
    expect(tools.map((tool) => tool.name)).toContain("get_server_reports");
    expect(tools.map((tool) => tool.name)).toContain("search_commands");
    expect(tools.map((tool) => tool.name)).toContain("compare_commands");
    expect(tools.map((tool) => tool.name)).toContain("get_datapack_schema_surface");
    expect(tools.map((tool) => tool.name)).toContain("search_datapack_schema");
    expect(tools.map((tool) => tool.name)).toContain("compare_datapack_schema");
    expect(tools.map((tool) => tool.name)).toContain("get_resourcepack_model_summary");
    expect(tools.map((tool) => tool.name)).toContain("search_resourcepack_models");
    expect(tools.map((tool) => tool.name)).toContain("get_vanilla_inventory");
    expect(tools.map((tool) => tool.name)).toContain("search_vanilla_paths");
    expect(tools.map((tool) => tool.name)).toContain("compare_vanilla_paths");
    expect(tools.map((tool) => tool.name)).toContain("get_paper_api_reference");
    expect(tools.map((tool) => tool.name)).toContain("get_paper_api_index");
    expect(tools.map((tool) => tool.name)).toContain("compare_paper_api");
    expect(tools.map((tool) => tool.name)).toContain("get_paper_api_surface");
    expect(tools.map((tool) => tool.name)).toContain("search_paper_types");
    expect(tools.map((tool) => tool.name)).toContain("search_paper_members");
    expect(tools.map((tool) => tool.name)).toContain("compare_paper_api_surface");
    expect(tools.map((tool) => tool.name)).toContain("search_paper_events");
  });

  it("keeps tool names unique and input schemas closed", () => {
    const names = tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    expect(tools.every((tool) => tool.inputSchema.type === "object")).toBe(true);
    expect(tools.every((tool) => tool.inputSchema.additionalProperties === false)).toBe(true);
  });

  it("exposes domain discovery and domain-specific entrypoints", () => {
    expect(listDomains().map((domain) => domain.id)).toEqual([
      "datapack",
      "resourcepack",
      "paper-plugin",
    ]);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "list_domains",
        "list_skills",
        "get_skill",
        "list_authoring_checklists",
        "get_authoring_checklist",
        "list_authoring_guardrails",
        "get_authoring_guardrail",
        "get_authoring_context",
        "get_authoring_preflight",
        "get_evidence_bundle",
        "list_intent_lookups",
        "get_intent_lookup",
        "list_fact_surfaces",
        "get_fact_surface",
        "get_source_policy",
        "get_server_reports",
        "get_datapack_schema_surface",
        "search_datapack_schema",
        "search_commands",
        "get_resourcepack_model_summary",
        "search_resourcepack_models",
        "get_paper_plugin_data",
        "get_paper_api_reference",
        "search_paper_types",
        "search_paper_members",
        "search_paper_events",
      ]),
    );
  });

  it("calls latest_version", async () => {
    expect((await callMinecraftSkillsTool("latest_version", {})).content[0]?.text).toBe("26.2");
  });

  it("calls list_skills", async () => {
    const result = await callMinecraftSkillsTool("list_skills", {
      domain: "paper-plugin",
    });
    expect(result.content[0]?.text).toContain('"name": "minecraft-paper-plugins"');
    expect(result.content[0]?.text).toContain('"path": "skills/minecraft-paper-plugins"');
  });

  it("calls get_skill", async () => {
    const result = await callMinecraftSkillsTool("get_skill", {
      name: "minecraft-paper-plugins",
    });
    expect(result.content[0]?.text).toContain("# Minecraft Paper Plugins");
    expect(result.content[0]?.text).toContain("display_name");
    expect(result.content[0]?.text).toContain("Minecraft Paper Plugins");
    expect(result.content[0]?.text).toContain("# Paper Plugin Sources");
  });

  it("calls fact surface tools", async () => {
    const list = await callMinecraftSkillsTool("list_fact_surfaces", {
      domain: "paper-plugin",
    });
    expect(list.content[0]?.text).toContain('"id": "paper-api-surface"');
    expect(list.content[0]?.text).toContain("nonGuarantees");

    const single = await callMinecraftSkillsTool("get_fact_surface", {
      id: "datapack-schema-surface",
    });
    expect(single.content[0]?.text).toContain("not a normative schema");
  });

  it("calls authoring checklist tools", async () => {
    const list = await callMinecraftSkillsTool("list_authoring_checklists", {
      domain: "resourcepack",
    });
    expect(list.content[0]?.text).toContain('"domain": "resourcepack"');
    expect(list.content[0]?.text).toContain("verify-assets-and-model-shapes");

    const single = await callMinecraftSkillsTool("get_authoring_checklist", {
      domain: "paper-plugin",
    });
    expect(single.content[0]?.text).toContain("verify-types-members-and-events");
    expect(single.content[0]?.text).toContain("Folia");
  });

  it("calls authoring guardrail tools", async () => {
    const list = await callMinecraftSkillsTool("list_authoring_guardrails", {
      domain: "paper-plugin",
    });
    expect(list.content[0]?.text).toContain('"id": "paper-api-surface-limits"');
    expect(list.content[0]?.text).toContain("unsupported Paper versions");

    const single = await callMinecraftSkillsTool("get_authoring_guardrail", {
      id: "paper-api-surface-limits",
    });
    expect(single.content[0]?.text).toContain("Javadocs package, type, and member indexes");
  });

  it("calls authoring preflight tool", async () => {
    const result = await callMinecraftSkillsTool("get_authoring_preflight", {
      domain: "paper-plugin",
      version: "26.2",
    });
    expect(result.content[0]?.text).toContain('"resolvedVersion": "26.2"');
    expect(result.content[0]?.text).toContain("Paper is not marked supported for 26.2");
  });

  it("calls authoring context tool", async () => {
    const result = await callMinecraftSkillsTool("get_authoring_context", {
      domain: "paper-plugin",
      version: "1.21.11",
    });
    expect(result.content[0]?.text).toContain('"resolvedVersion": "1.21.11"');
    expect(result.content[0]?.text).toContain('"guardrails"');
    expect(result.content[0]?.text).toContain('"intentLookups"');
    expect(result.content[0]?.text).toContain('"id": "verify-paper-type-or-member"');
    expect(result.content[0]?.text).toContain('"id": "paper-javadocs"');
  });

  it("calls evidence bundle tool", async () => {
    const result = await callMinecraftSkillsTool("get_evidence_bundle", {
      domain: "paper-plugin",
      version: "1.21.11",
    });
    expect(result.content[0]?.text).toContain('"minecraftWikiTextRedistribution": "forbidden"');
    expect(result.content[0]?.text).toContain('"id": "paper-javadocs"');
    expect(result.content[0]?.text).toContain('"kind": "paper-api-surface"');
  });

  it("calls intent lookup tools", async () => {
    const list = await callMinecraftSkillsTool("list_intent_lookups", {
      domain: "paper-plugin",
    });
    expect(list.content[0]?.text).toContain('"id": "verify-paper-type-or-member"');
    expect(list.content[0]?.text).toContain('"id": "discover-paper-event-candidates"');

    const single = await callMinecraftSkillsTool("get_intent_lookup", {
      id: "verify-command-syntax",
    });
    expect(single.content[0]?.text).toContain('"search_commands"');
    expect(single.content[0]?.text).toContain("does not prove gameplay behavior");
  });

  it("calls get_coverage_summary", async () => {
    const result = await callMinecraftSkillsTool("get_coverage_summary", {});
    expect(result.content[0]?.text).toContain('"complete": true');
    expect(result.content[0]?.text).toContain('"latestSupportedVersion": "1.21.11"');
    expect(result.content[0]?.text).toContain('"packagedPayloads": 3');
  });

  it("calls data manifest and cache tools", async () => {
    const manifest = await callMinecraftSkillsTool("get_data_manifest", {});
    expect(manifest.content[0]?.text).toContain('"dataVersion": "2026.06.22-1"');

    const matrix = await callMinecraftSkillsTool("get_support_matrix", {});
    expect(matrix.content[0]?.text).toContain('"latestWithPaperApiSurface": "1.21.11"');

    const versionSupport = await callMinecraftSkillsTool("list_version_support", {
      domain: "paper-plugin",
    });
    expect(versionSupport.content[0]?.text).toContain('"version": "26.2"');
    expect(versionSupport.content[0]?.text).toContain('"supported": false');

    const cache = await callMinecraftSkillsTool("get_cache_status", {});
    expect(cache.content[0]?.text).toContain('"cacheRoot"');
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

  it("calls get_paper_api_reference", async () => {
    const result = await callMinecraftSkillsTool("get_paper_api_reference", {
      version: "1.21.11",
    });
    expect(result.content[0]?.text).toContain("io.papermc.paper:paper-api:1.21.11-R0.1-SNAPSHOT");
    expect(result.content[0]?.text).toContain("https://jd.papermc.io/paper/1.21.11/");
  });

  it("calls get_paper_api_index", async () => {
    const result = await callMinecraftSkillsTool("get_paper_api_index", {
      version: "1.21.11",
    });
    expect(result.content[0]?.text).toContain("io.papermc.paper.threadedregions.scheduler");
  });

  it("calls compare_paper_api", async () => {
    const result = await callMinecraftSkillsTool("compare_paper_api", {
      from: "1.20.4",
      to: "1.21.11",
    });
    expect(result.content[0]?.text).toContain("io.papermc.paper.datacomponent");
  });

  it("calls Paper API surface tools", async () => {
    const surface = await callMinecraftSkillsTool("get_paper_api_surface", {
      version: "1.21.11",
    });
    expect(surface.content[0]?.text).toContain('"coverage": "javadocs-search-index"');

    const types = await callMinecraftSkillsTool("search_paper_types", {
      version: "1.21.11",
      contains: "org.bukkit.entity.Player",
      limit: 5,
    });
    expect(types.content[0]?.text).toContain("org.bukkit.entity.Player");

    const members = await callMinecraftSkillsTool("search_paper_members", {
      version: "1.21.11",
      type: "org.bukkit.entity.Player",
      contains: "sendMessage",
      kind: "method",
      limit: 5,
    });
    expect(members.content[0]?.text).toContain("sendMessage");

    const comparison = await callMinecraftSkillsTool("compare_paper_api_surface", {
      from: "1.21.11",
      to: "1.21.11",
    });
    expect(comparison.content[0]?.text).toContain('"addedTypes": []');
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

  it("calls observed datapack schema tools", async () => {
    const surface = await callMinecraftSkillsTool("get_datapack_schema_surface", {
      version: "26.2",
    });
    expect(surface.content[0]?.text).toContain("vanilla-observed-datapack-json-shape");

    const search = await callMinecraftSkillsTool("search_datapack_schema", {
      version: "26.2",
      kind: "advancement",
      contains: "criteria",
      limit: 5,
    });
    expect(search.content[0]?.text).toContain('"path": "$.criteria"');

    const comparison = await callMinecraftSkillsTool("compare_datapack_schema", {
      from: "26.2",
      to: "26.2",
    });
    expect(comparison.content[0]?.text).toContain('"addedTotal": 0');
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

  it("calls compare_vanilla_paths", async () => {
    const result = await callMinecraftSkillsTool("compare_vanilla_paths", {
      from: "1.20.6",
      to: "1.21",
      domain: "resourcepack",
      prefix: "assets/minecraft/models/item/",
      limit: 10,
    });
    expect(result.content[0]?.text).toContain(
      "assets/minecraft/models/item/music_disc_creator.json",
    );
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

  it("calls compare_commands", async () => {
    const result = await callMinecraftSkillsTool("compare_commands", {
      from: "1.20.6",
      to: "1.21",
      prefix: "attribute",
    });
    expect(result.content[0]?.text).toContain("modifier add");
  });

  it("calls get_resourcepack_model_summary", async () => {
    const result = await callMinecraftSkillsTool("get_resourcepack_model_summary", {
      version: "26.2",
    });
    expect(result.content[0]?.text).toContain('"coverage": "client-resourcepack-models"');
    expect(result.content[0]?.text).toContain('"minecraft:model"');
  });

  it("calls search_resourcepack_models", async () => {
    const result = await callMinecraftSkillsTool("search_resourcepack_models", {
      version: "26.2",
      kind: "item-definition",
      contains: "bundle",
    });
    expect(result.content[0]?.text).toContain("assets/minecraft/items/bundle.json");
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
