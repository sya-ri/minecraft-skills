import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listDomains } from "@minecraft-skills/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callMinecraftSkillsTool, listMinecraftSkillsTools, tools } from "./tools.js";

function testJar(entries: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const contentBytes = Buffer.from(content);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(contentBytes.length, 18);
    local.writeUInt32LE(contentBytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);
    localParts.push(local, contentBytes);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(contentBytes.length, 20);
    central.writeUInt32LE(contentBytes.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centralParts.push(central);
    offset += local.length + contentBytes.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function cacheServerJar(version: string, entries: Record<string, string>): void {
  const root = process.env.MINECRAFT_SKILLS_CACHE_DIR;
  if (!root) {
    throw new Error("MINECRAFT_SKILLS_CACHE_DIR must be set for cacheServerJar");
  }
  const jarDir = join(root, "mojang-server-jars");
  mkdirSync(jarDir, { recursive: true });
  writeFileSync(join(jarDir, `${version}.jar`), testJar(entries));
}

describe("MCP tools", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("exposes catalog tools", () => {
    expect(tools.map((tool) => tool.name)).toContain("get_version");
    expect(tools.map((tool) => tool.name)).toContain("list_skills");
    expect(tools.map((tool) => tool.name)).toContain("get_skill");
    expect(tools.map((tool) => tool.name)).toContain("list_authoring_checklists");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_checklist");
    expect(tools.map((tool) => tool.name)).toContain("list_authoring_recipes");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_recipe");
    expect(tools.map((tool) => tool.name)).toContain("search_authoring_scenarios");
    expect(tools.map((tool) => tool.name)).toContain("list_authoring_scenarios");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_scenario");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_plan");
    expect(tools.map((tool) => tool.name)).toContain("list_authoring_guardrails");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_guardrail");
    expect(tools.map((tool) => tool.name)).toContain("list_authoring_diagnostics");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_diagnostic");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_context");
    expect(tools.map((tool) => tool.name)).toContain("list_claim_policies");
    expect(tools.map((tool) => tool.name)).toContain("get_claim_policy");
    expect(tools.map((tool) => tool.name)).toContain("list_output_requirements");
    expect(tools.map((tool) => tool.name)).toContain("get_output_requirement");
    expect(tools.map((tool) => tool.name)).toContain("list_response_patterns");
    expect(tools.map((tool) => tool.name)).toContain("get_response_pattern");
    expect(tools.map((tool) => tool.name)).toContain("get_authoring_preflight");
    expect(tools.map((tool) => tool.name)).toContain("get_evidence_bundle");
    expect(tools.map((tool) => tool.name)).toContain("get_source_report");
    expect(tools.map((tool) => tool.name)).toContain("list_source_tiers");
    expect(tools.map((tool) => tool.name)).toContain("get_source_tier");
    expect(tools.map((tool) => tool.name)).toContain("list_community_datasets");
    expect(tools.map((tool) => tool.name)).toContain("get_community_dataset");
    expect(tools.map((tool) => tool.name)).toContain("get_rcon_config_status");
    expect(tools.map((tool) => tool.name)).toContain("create_rcon_config");
    expect(tools.map((tool) => tool.name)).not.toContain("run_rcon_command");
    expect(tools.map((tool) => tool.name)).toContain("list_intent_lookups");
    expect(tools.map((tool) => tool.name)).toContain("get_intent_lookup");
    expect(tools.map((tool) => tool.name)).toContain("list_fact_surfaces");
    expect(tools.map((tool) => tool.name)).toContain("get_fact_surface");
    expect(tools.map((tool) => tool.name)).toContain("get_coverage_summary");
    expect(tools.map((tool) => tool.name)).toContain("get_data_manifest");
    expect(tools.map((tool) => tool.name)).toContain("get_support_matrix");
    expect(tools.map((tool) => tool.name)).toContain("list_version_support");
    expect(tools.map((tool) => tool.name)).toContain("get_cache_status");
    expect(tools.map((tool) => tool.name)).toContain("fetch_mojang_server_jar");
    expect(tools.map((tool) => tool.name)).toContain("fetch_data");
    expect(tools.map((tool) => tool.name)).toContain("clean_cache");
    expect(tools.map((tool) => tool.name)).toContain("get_paper_plugin_data");
    expect(tools.map((tool) => tool.name)).toContain("get_mojang_version_metadata");
    expect(tools.map((tool) => tool.name)).toContain("list_pack_formats");
    expect(tools.map((tool) => tool.name)).toContain("get_pack_format");
    expect(tools.map((tool) => tool.name)).toContain("find_versions_by_pack_format");
    expect(tools.map((tool) => tool.name)).toContain("compare_versions");
    expect(tools.map((tool) => tool.name)).toContain("get_server_reports");
    expect(tools.map((tool) => tool.name)).toContain("search_commands");
    expect(tools.map((tool) => tool.name)).toContain("compare_commands");
    expect(tools.map((tool) => tool.name)).toContain("get_datapack_schema_surface");
    expect(tools.map((tool) => tool.name)).toContain("search_datapack_schema");
    expect(tools.map((tool) => tool.name)).toContain("compare_datapack_schema");
    expect(tools.map((tool) => tool.name)).toContain("classify_pack_files");
    expect(tools.map((tool) => tool.name)).toContain("get_pack_file_schema");
    expect(tools.map((tool) => tool.name)).toContain("validate_pack_files");
    expect(tools.map((tool) => tool.name)).toContain("get_pack_migration_plan");
    expect(tools.map((tool) => tool.name)).toContain("search_all");
    expect(tools.map((tool) => tool.name)).toContain("find_datapack_entries");
    expect(tools.map((tool) => tool.name)).toContain("find_resourcepack_assets");
    expect(tools.map((tool) => tool.name)).toContain("explain_pack_path");
    expect(tools.map((tool) => tool.name)).toContain("suggest_minecraft_lookups");
    expect(tools.map((tool) => tool.name)).toContain("get_resourcepack_model_summary");
    expect(tools.map((tool) => tool.name)).toContain("search_resourcepack_models");
    expect(tools.map((tool) => tool.name)).toContain("get_resourcepack_assets_status");
    expect(tools.map((tool) => tool.name)).toContain("fetch_resourcepack_assets");
    expect(tools.map((tool) => tool.name)).toContain("search_resourcepack_assets");
    expect(tools.map((tool) => tool.name)).toContain("get_resourcepack_asset");
    expect(tools.map((tool) => tool.name)).toContain("get_vanilla_inventory");
    expect(tools.map((tool) => tool.name)).toContain("search_vanilla_datapack_json_files");
    expect(tools.map((tool) => tool.name)).toContain("get_vanilla_datapack_json");
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
        "list_authoring_recipes",
        "get_authoring_recipe",
        "search_authoring_scenarios",
        "list_authoring_scenarios",
        "get_authoring_scenario",
        "get_authoring_plan",
        "search_catalog",
        "list_authoring_guardrails",
        "get_authoring_guardrail",
        "list_authoring_diagnostics",
        "get_authoring_diagnostic",
        "get_authoring_context",
        "list_claim_policies",
        "get_claim_policy",
        "list_output_requirements",
        "get_output_requirement",
        "list_response_patterns",
        "get_response_pattern",
        "get_authoring_preflight",
        "get_evidence_bundle",
        "get_source_report",
        "list_source_tiers",
        "list_community_datasets",
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

  it("adds RCON command tool only when RCON is configured", () => {
    expect(listMinecraftSkillsTools().map((tool) => tool.name)).not.toContain("run_rcon_command");
    vi.stubEnv("MINECRAFT_SKILLS_RCON_HOST", "127.0.0.1");
    vi.stubEnv("MINECRAFT_SKILLS_RCON_PASSWORD", "secret");
    expect(listMinecraftSkillsTools().map((tool) => tool.name)).toContain("run_rcon_command");
  });

  it("calls latest_version", async () => {
    expect((await callMinecraftSkillsTool("latest_version", {})).content[0]?.text).toBe("26.2");
  });

  it("calls get_mojang_version_metadata", async () => {
    const result = await callMinecraftSkillsTool("get_mojang_version_metadata", {
      version: "26.2",
    });
    expect(result.content[0]?.text).toContain('"version": "26.2"');
    expect(result.content[0]?.text).toContain("piston-data.mojang.com");
    expect(result.content[0]?.text).toContain('"serverJarSha1"');
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

  it("calls authoring recipe tools", async () => {
    const list = await callMinecraftSkillsTool("list_authoring_recipes", {
      domain: "paper-plugin",
    });
    expect(list.content[0]?.text).toContain('"id": "paper-event-listener"');
    expect(list.content[0]?.text).toContain('"id": "paper-api-or-scheduler-code"');

    const single = await callMinecraftSkillsTool("get_authoring_recipe", {
      id: "datapack-function-command",
    });
    expect(single.content[0]?.text).toContain("verify-command-path");
    expect(single.content[0]?.text).toContain("search_commands");
  });

  it("calls authoring scenario tools", async () => {
    const list = await callMinecraftSkillsTool("list_authoring_scenarios", {
      domain: "paper-plugin",
    });
    expect(list.content[0]?.text).toContain('"id": "paper-event-listener-review"');
    expect(list.content[0]?.text).toContain('"id": "paper-api-scheduler-review"');

    const single = await callMinecraftSkillsTool("get_authoring_scenario", {
      id: "paper-event-listener-review",
    });
    expect(single.content[0]?.text).toContain('"paper-event-listener"');
    expect(single.content[0]?.text).toContain("paper-event-candidate-unverified");
  });

  it("calls authoring scenario search tool", async () => {
    const result = await callMinecraftSkillsTool("search_authoring_scenarios", {
      query: "Paper event listener",
      domain: "paper-plugin",
    });
    expect(result.content[0]?.text).toContain('"query": "Paper event listener"');
    expect(result.content[0]?.text).toContain('"id": "paper-event-listener-review"');
    expect(result.content[0]?.text).toContain('"matchedTokens"');
  });

  it("calls authoring plan tool", async () => {
    const result = await callMinecraftSkillsTool("get_authoring_plan", {
      scenario: "paper-event-listener-review",
      version: "1.21.11",
    });
    expect(result.content[0]?.text).toContain('"scenario"');
    expect(result.content[0]?.text).toContain('"id": "paper-event-listener-review"');
    expect(result.content[0]?.text).toContain('"recipes"');
    expect(result.content[0]?.text).toContain('"id": "paper-event-listener"');
    expect(result.content[0]?.text).toContain('"diagnostics"');
    expect(result.content[0]?.text).toContain('"id": "paper-event-candidate-unverified"');
    expect(result.content[0]?.text).toContain('"preflight"');
    expect(result.content[0]?.text).toContain('"resolvedVersion": "1.21.11"');
  });

  it("calls catalog search tool", async () => {
    const result = await callMinecraftSkillsTool("search_catalog", {
      query: "Paper event listener",
      domain: "paper-plugin",
      kind: "authoring-recipe",
    });

    expect(result.content[0]?.text).toContain('"kind": "authoring-recipe"');
    expect(result.content[0]?.text).toContain('"id": "paper-event-listener"');
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

  it("calls authoring diagnostic tools", async () => {
    const list = await callMinecraftSkillsTool("list_authoring_diagnostics", {
      domain: "paper-plugin",
    });
    expect(list.content[0]?.text).toContain('"id": "paper-api-member-unverified"');
    expect(list.content[0]?.text).toContain('"id": "paper-threading-assumption"');

    const single = await callMinecraftSkillsTool("get_authoring_diagnostic", {
      id: "paper-api-member-unverified",
    });
    expect(single.content[0]?.text).toContain('"severity": "error"');
    expect(single.content[0]?.text).toContain("searchPaperMembers");
  });

  it("calls claim policy tools", async () => {
    const list = await callMinecraftSkillsTool("list_claim_policies", {
      domain: "paper-plugin",
    });
    expect(list.content[0]?.text).toContain('"id": "paper-type-or-member-exists"');
    expect(list.content[0]?.text).toContain('"id": "folia-or-thread-safety"');

    const single = await callMinecraftSkillsTool("get_claim_policy", {
      id: "command-syntax-exists",
    });
    expect(single.content[0]?.text).toContain("parser shape, not gameplay behavior");
    expect(single.content[0]?.text).toContain("will succeed at runtime");
  });

  it("calls output requirement tools", async () => {
    const list = await callMinecraftSkillsTool("list_output_requirements", {
      domain: "paper-plugin",
    });
    expect(list.content[0]?.text).toContain('"id": "global-version-and-evidence"');
    expect(list.content[0]?.text).toContain('"id": "paper-plugin-output-safety"');

    const single = await callMinecraftSkillsTool("get_output_requirement", {
      id: "paper-plugin-output-safety",
    });
    expect(single.content[0]?.text).toContain("Javadocs type/member evidence");
    expect(single.content[0]?.text).toContain("unverified event class names");
  });

  it("calls response pattern tools", async () => {
    const list = await callMinecraftSkillsTool("list_response_patterns", {
      domain: "paper-plugin",
    });
    expect(list.content[0]?.text).toContain('"id": "verified-authoring-answer"');
    expect(list.content[0]?.text).toContain('"id": "paper-api-answer"');

    const single = await callMinecraftSkillsTool("get_response_pattern", {
      id: "paper-api-answer",
    });
    expect(single.content[0]?.text).toContain("Javadocs type/member evidence");
    expect(single.content[0]?.text).toContain("name presence, not behavior");
  });

  it("calls authoring preflight tool", async () => {
    const result = await callMinecraftSkillsTool("get_authoring_preflight", {
      domain: "paper-plugin",
      version: "26.1",
    });
    expect(result.content[0]?.text).toContain('"resolvedVersion": "26.1"');
    expect(result.content[0]?.text).toContain("Paper is not marked supported for 26.1");
  });

  it("calls authoring context tool", async () => {
    const result = await callMinecraftSkillsTool("get_authoring_context", {
      domain: "paper-plugin",
      version: "1.21.11",
    });
    expect(result.content[0]?.text).toContain('"resolvedVersion": "1.21.11"');
    expect(result.content[0]?.text).toContain('"recipes"');
    expect(result.content[0]?.text).toContain('"id": "paper-event-listener"');
    expect(result.content[0]?.text).toContain('"scenarios"');
    expect(result.content[0]?.text).toContain('"id": "paper-event-listener-review"');
    expect(result.content[0]?.text).toContain('"guardrails"');
    expect(result.content[0]?.text).toContain('"diagnostics"');
    expect(result.content[0]?.text).toContain('"id": "paper-api-member-unverified"');
    expect(result.content[0]?.text).toContain('"claimPolicies"');
    expect(result.content[0]?.text).toContain('"outputRequirements"');
    expect(result.content[0]?.text).toContain('"responsePatterns"');
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

  it("calls source report tool", async () => {
    const result = await callMinecraftSkillsTool("get_source_report", {
      domain: "resourcepack",
      version: "26.2",
    });
    expect(result.content[0]?.text).toContain('"minecraftWikiAutomation": "forbidden"');
    expect(result.content[0]?.text).toContain('"id": "prismarinejs-minecraft-assets"');
    expect(result.content[0]?.text).toContain('"id": "misode-mcmeta-assets-json"');

    const datasets = await callMinecraftSkillsTool("list_community_datasets", {});
    expect(datasets.content[0]?.text).toContain('"id": "prismarinejs-minecraft-data"');

    const tier = await callMinecraftSkillsTool("get_source_tier", {
      id: "human-only-background",
    });
    expect(tier.content[0]?.text).toContain("Minecraft Wiki pages");
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
    expect(result.content[0]?.text).toContain('"latestSupportedVersion": "26.2"');
    expect(result.content[0]?.text).toContain('"packagedPayloads": 3');
  });

  it("calls data manifest and cache tools", async () => {
    const manifest = await callMinecraftSkillsTool("get_data_manifest", {});
    expect(manifest.content[0]?.text).toContain('"dataVersion": "2026.06.23-2"');

    const matrix = await callMinecraftSkillsTool("get_support_matrix", {});
    expect(matrix.content[0]?.text).toContain('"latestWithPaperApiSurface": "26.2"');

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

  it("calls pack format lookup tools", async () => {
    const format = await callMinecraftSkillsTool("get_pack_format", {
      version: "26.2",
      domain: "datapack",
    });
    expect(format.content[0]?.text).toContain('"format": 107');
    expect(format.content[0]?.text).toContain('"minor": 1');

    const versions = await callMinecraftSkillsTool("find_versions_by_pack_format", {
      domain: "resourcepack",
      format: 88,
    });
    expect(versions.content[0]?.text).toContain('"version": "26.2"');
    expect(versions.content[0]?.text).toContain('"domain": "resourcepack"');
  });

  it("calls get_vanilla_inventory", async () => {
    const result = await callMinecraftSkillsTool("get_vanilla_inventory", {});
    expect(result.content[0]?.text).toContain('"version": "26.2"');
    expect(result.content[0]?.text).toContain('"assets/minecraft/models"');
  });

  it("searches and reads cached vanilla datapack JSON files", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-mcp-"));
    vi.stubEnv("MINECRAFT_SKILLS_CACHE_DIR", root);
    try {
      cacheServerJar("26.2", {
        "data/minecraft/recipe/test.json": '{"type":"minecraft:crafting_shapeless"}',
        "data/minecraft/loot_table/blocks/test.json": '{"type":"minecraft:block"}',
      });
      const search = await callMinecraftSkillsTool("search_vanilla_datapack_json_files", {
        version: "26.2",
        kind: "recipe",
        contains: "test",
      });
      expect(search.content[0]?.text).toContain('"matchedFiles": 1');
      expect(search.content[0]?.text).toContain("data/minecraft/recipe/test.json");

      const file = await callMinecraftSkillsTool("get_vanilla_datapack_json", {
        version: "26.2",
        path: "data/minecraft/recipe/test.json",
      });
      expect(file.content[0]?.text).toContain('"type": "minecraft:crafting_shapeless"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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

  it("calls classify_pack_files", async () => {
    const result = await callMinecraftSkillsTool("classify_pack_files", {
      paths: [
        "data/example/advancement/root.json",
        "assets/example/items/widget.json",
        "README.md",
      ],
    });
    expect(result.content[0]?.text).toContain('"kind": "advancement"');
    expect(result.content[0]?.text).toContain('"kind": "item-definition"');
    expect(result.content[0]?.text).toContain('"domain": "unknown"');
  });

  it("calls get_pack_file_schema", async () => {
    const result = await callMinecraftSkillsTool("get_pack_file_schema", {
      version: "26.2",
      domain: "datapack",
      path: "data/example/advancement/root.json",
    });
    expect(result.content[0]?.text).toContain('"normative": false');
    expect(result.content[0]?.text).toContain('"path": "$.criteria"');
  });

  it("calls validate_pack_files", async () => {
    const result = await callMinecraftSkillsTool("validate_pack_files", {
      version: "26.2",
      domain: "datapack",
      files: [
        {
          path: "pack.mcmeta",
          content: {
            pack: {
              pack_format: 107,
              description: "test",
            },
          },
        },
      ],
    });
    expect(result.content[0]?.text).toContain('"validatedFiles": 1');
    expect(result.content[0]?.text).toContain('"validFiles": 1');
  });

  it("calls get_pack_migration_plan", async () => {
    const result = await callMinecraftSkillsTool("get_pack_migration_plan", {
      domain: "resourcepack",
      from: "1.20.6",
      to: "1.21",
      paths: ["assets/example/items/widget.json"],
      limit: 5,
    });
    expect(result.content[0]?.text).toContain('"domain": "resourcepack"');
    expect(result.content[0]?.text).toContain('"schemaBackedFiles": 0');
    expect(result.content[0]?.text).toContain('"resourcepack file-schema"');
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

  it("calls discovery-oriented search tools", async () => {
    const search = await callMinecraftSkillsTool("search_all", {
      version: "26.2",
      query: "bundle",
      domain: "resourcepack",
      limit: 80,
    });
    expect(search.content[0]?.text).toContain("resourcepack-models");

    const datapack = await callMinecraftSkillsTool("find_datapack_entries", {
      version: "26.2",
      query: "execute",
    });
    expect(datapack.content[0]?.text).toContain('"source": "commands"');

    const resourcepack = await callMinecraftSkillsTool("find_resourcepack_assets", {
      version: "26.2",
      query: "bundle",
      kind: "item-definition",
    });
    expect(resourcepack.content[0]?.text).toContain("assets/minecraft/items/bundle.json");

    const explanation = await callMinecraftSkillsTool("explain_pack_path", {
      version: "26.2",
      domain: "resourcepack",
      path: "assets/example/items/widget.json",
    });
    expect(explanation.content[0]?.text).toContain('"kind": "item-definition"');

    const suggestions = await callMinecraftSkillsTool("suggest_minecraft_lookups", {
      version: "26.2",
      domain: "resourcepack",
      task: "migrate resource pack item model",
    });
    expect(suggestions.content[0]?.text).toContain("resourcepack assets find");
  });

  it("calls external resourcepack asset cache tools", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "minecraft-skills-mcp-assets-"));
    vi.stubEnv("MINECRAFT_SKILLS_CACHE_DIR", cacheDir);
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/git/trees/26.2")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            tree: [
              { path: "assets/minecraft/models/item/apple.json", type: "blob" },
              { path: "assets/minecraft/textures/item/apple.png", type: "blob" },
            ],
          }),
        } as unknown as Response;
      }
      if (url.endsWith("/assets/minecraft/models/item/apple.json")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => Buffer.from('{"parent":"minecraft:item/generated"}'),
        } as unknown as Response;
      }
      if (url.endsWith("/26.2.zip")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => Buffer.from("zip bytes"),
        } as unknown as Response;
      }
      throw new Error(`unexpected url ${url}`);
    });
    try {
      const missingIndex = await callMinecraftSkillsTool("search_resourcepack_assets", {
        version: "26.2",
        extension: "json",
      });
      expect(missingIndex.isError).toBe(true);
      expect(missingIndex.content[0]?.text).toContain("fetch_resourcepack_assets");
      expect(missingIndex.content[0]?.text).toContain('"indexOnly":true');

      const fetchResult = await callMinecraftSkillsTool("fetch_resourcepack_assets", {
        version: "26.2",
        indexOnly: true,
      });
      expect(fetchResult.content[0]?.text).toContain('"pathCount": 2');

      const search = await callMinecraftSkillsTool("search_resourcepack_assets", {
        version: "26.2",
        extension: "json",
      });
      expect(search.content[0]?.text).toContain("assets/minecraft/models/item/apple.json");

      const asset = await callMinecraftSkillsTool("get_resourcepack_asset", {
        version: "26.2",
        path: "assets/minecraft/models/item/apple.json",
      });
      expect(asset.content[0]?.text).toContain('"cached": false');
      expect(asset.content[0]?.text).toContain('"content"');

      const status = await callMinecraftSkillsTool("get_resourcepack_assets_status", {
        version: "26.2",
      });
      expect(status.content[0]?.text).toContain('"indexCached": true');
      expect(status.content[0]?.text).toContain('"cachedFileCount": 1');
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
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
