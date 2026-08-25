import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import {
  defaultDatapackProjectValidationLimits,
  defaultMinecraftLogAnalysisLimits,
  defaultResourcepackProjectValidationLimits,
  defaultServerPropertiesValidationLimits,
  getVersionDetail,
  listDomains,
} from "@minecraft-skills/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callMinecraftSkillsTool, listMinecraftSkillsTools, tools } from "./tools.js";

function crc32(value: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validVorbisIdentificationPage(): Buffer {
  return Buffer.from(
    "4f676753000200000000000000000100000000000000a7b4565b011e01766f72626973000000000180bb00000000000000000000000000008601",
    "hex",
  );
}

function testPngChunk(type: string, data = Buffer.alloc(0)): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.byteLength);
  chunk.writeUInt32BE(data.byteLength, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.byteLength);
  return chunk;
}

function testPng(width = 3, height = 5): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    testPngChunk("IHDR", header),
    testPngChunk("IDAT"),
    testPngChunk("IEND"),
  ]);
}

function testAlphaPng(alphaRows: readonly (readonly number[])[]): Buffer {
  const height = alphaRows.length;
  const width = alphaRows[0]?.length ?? 0;
  if (width === 0 || height === 0 || alphaRows.some((row) => row.length !== width)) {
    throw new Error("testAlphaPng requires a non-empty rectangular alpha grid");
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const filtered = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (1 + width * 4);
    filtered[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      filtered[pixelOffset] = 0x12;
      filtered[pixelOffset + 1] = 0x34;
      filtered[pixelOffset + 2] = 0x56;
      filtered[pixelOffset + 3] = alphaRows[y]?.[x] ?? 0;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    testPngChunk("IHDR", header),
    testPngChunk("IDAT", deflateSync(filtered)),
    testPngChunk("IEND"),
  ]);
}

function testJar(entries: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const contentBytes = Buffer.from(content);
    const checksum = crc32(contentBytes) >>> 0;
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(checksum, 14);
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
    central.writeUInt32LE(checksum, 16);
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

const serverMetadataRestorers: Array<() => void> = [];

function cacheServerJar(version: string, entries: Record<string, string>): void {
  const root = process.env.MINECRAFT_SKILLS_CACHE_DIR;
  if (!root) {
    throw new Error("MINECRAFT_SKILLS_CACHE_DIR must be set for cacheServerJar");
  }
  const jarDir = join(root, "mojang-server-jars");
  mkdirSync(jarDir, { recursive: true });
  const jar = testJar(entries);
  writeFileSync(join(jarDir, `${version}.jar`), jar);

  const detail = getVersionDetail("java", version);
  const server = detail.downloads.server as { sha1?: string; size?: number } | undefined;
  if (!server) {
    throw new Error(`Test version ${version} has no server download metadata`);
  }
  const previousSha1 = server.sha1;
  const previousSize = server.size;
  server.sha1 = createHash("sha1").update(jar).digest("hex");
  server.size = jar.length;
  serverMetadataRestorers.push(() => {
    if (previousSha1 === undefined) delete server.sha1;
    else server.sha1 = previousSha1;
    if (previousSize === undefined) delete server.size;
    else server.size = previousSize;
  });
}

describe("MCP tools", () => {
  afterEach(() => {
    for (const restore of serverMetadataRestorers.splice(0).reverse()) {
      restore();
    }
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
    expect(tools.map((tool) => tool.name)).toContain("search_community_datasets");
    expect(tools.map((tool) => tool.name)).toContain("get_community_dataset");
    expect(tools.map((tool) => tool.name)).toContain("get_rcon_config_status");
    expect(tools.map((tool) => tool.name)).toContain("validate_server_properties");
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
    expect(tools.map((tool) => tool.name)).toContain("search_registry_entries");
    expect(tools.map((tool) => tool.name)).toContain("compare_registry_entries");
    expect(tools.map((tool) => tool.name)).toContain("search_commands");
    expect(tools.map((tool) => tool.name)).toContain("compare_commands");
    expect(tools.map((tool) => tool.name)).toContain("get_datapack_schema_surface");
    expect(tools.map((tool) => tool.name)).toContain("search_datapack_schema");
    expect(tools.map((tool) => tool.name)).toContain("compare_datapack_schema");
    expect(tools.map((tool) => tool.name)).toContain("classify_pack_files");
    expect(tools.map((tool) => tool.name)).toContain("get_pack_file_schema");
    expect(tools.map((tool) => tool.name)).toContain("validate_pack_files");
    expect(tools.map((tool) => tool.name)).toContain("validate_datapack_json");
    expect(tools.map((tool) => tool.name)).toContain("inspect_resourcepack_png_alpha_bounds");
    expect(tools.map((tool) => tool.name)).toContain("validate_player_skin_layout");
    expect(tools.map((tool) => tool.name)).toContain("validate_resourcepack_png");
    expect(tools.map((tool) => tool.name)).toContain("validate_datapack_project");
    expect(tools.map((tool) => tool.name)).toContain("validate_resourcepack_project");
    expect(tools.map((tool) => tool.name)).toContain("analyze_minecraft_log");
    expect(tools.map((tool) => tool.name)).toContain("get_pack_migration_plan");
    expect(tools.map((tool) => tool.name)).toContain("search_all");
    expect(tools.map((tool) => tool.name)).toContain("get_fabric_toolchain");
    expect(tools.map((tool) => tool.name)).toContain("resolve_velocity_toolchain");
    expect(tools.map((tool) => tool.name)).toContain("search_modrinth_projects");
    expect(tools.map((tool) => tool.name)).toContain("list_modrinth_project_versions");
    expect(tools.map((tool) => tool.name)).toContain("resolve_modrinth_compatibility");
    expect(tools.map((tool) => tool.name)).toContain("get_modrinth_resource");
    expect(tools.map((tool) => tool.name)).toContain("validate_modrinth_pack");
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
    expect(tools.map((tool) => tool.name)).toContain("search_vanilla_datapack_json_content");
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

  it("documents caller-side English normalization for intent-based searches", () => {
    const semanticInputs = new Map([
      ["search_authoring_scenarios", "query"],
      ["search_catalog", "query"],
      ["search_community_datasets", "query"],
      ["search_all", "query"],
      ["search_modrinth_projects", "query"],
      ["find_datapack_entries", "query"],
      ["find_resourcepack_assets", "query"],
      ["suggest_minecraft_lookups", "task"],
      ["search_paper_events", "query"],
    ]);

    for (const [name, propertyName] of semanticInputs) {
      const tool = tools.find((candidate) => candidate.name === name);
      const property = tool?.inputSchema.properties[propertyName] as
        | Record<string, unknown>
        | undefined;

      expect(tool?.description).toContain("translate non-English user intent");
      expect(tool?.description).toContain("keep the user's requested response language");
      expect(property).toMatchObject({
        type: "string",
        description: expect.stringContaining("concise English canonical Minecraft terms"),
      });
      expect(property).not.toHaveProperty("pattern");
      expect(property).not.toHaveProperty("enum");
    }
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
        "search_registry_entries",
        "compare_registry_entries",
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

  it("calls validate_server_properties without returning values", async () => {
    const secret = "mcp-private-rcon-value";
    const result = await callMinecraftSkillsTool("validate_server_properties", {
      targetVersion: "1.21.11",
      content: `server-port=25565\nonline-mode=true\nrcon.password=${secret}\n`,
    });
    const output = result.content[0]?.text ?? "";

    expect(result.isError).toBeUndefined();
    expect(output).toContain('"targetVersion": "1.21.11"');
    expect(output).toContain('"validationComplete": false');
    expect(output).not.toContain(secret);
  });

  it("bounds validate_server_properties before catalog validation", async () => {
    const utf8Oversized = await callMinecraftSkillsTool("validate_server_properties", {
      content: "あ".repeat(Math.floor(defaultServerPropertiesValidationLimits.maxInputBytes / 2)),
    });
    const unknownArgument = await callMinecraftSkillsTool("validate_server_properties", {
      content: "pvp=true",
      unsafe: true,
    });
    const invalidVersion = await callMinecraftSkillsTool("validate_server_properties", {
      content: "pvp=true",
      targetVersion: "private version label",
    });

    expect(utf8Oversized.isError).toBe(true);
    expect(utf8Oversized.content[0]?.text).toContain("UTF-8 bytes");
    expect(unknownArgument).toMatchObject({
      isError: true,
      content: [{ text: "validate_server_properties received an unknown argument" }],
    });
    expect(invalidVersion.isError).toBe(true);
    expect(invalidVersion.content[0]?.text).toContain("bounded version identifier");
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
    expect(list.content[0]?.text).toContain('"id": "paper-safe-item-delivery"');
    expect(list.content[0]?.text).toContain('"id": "paper-inventory-gui-interactions"');

    const single = await callMinecraftSkillsTool("get_authoring_recipe", {
      id: "datapack-function-command",
    });
    expect(single.content[0]?.text).toContain("verify-command-path");
    expect(single.content[0]?.text).toContain("search_commands");

    const itemDelivery = await callMinecraftSkillsTool("get_authoring_recipe", {
      id: "paper-safe-item-delivery",
    });
    expect(itemDelivery.content[0]?.text).toContain("define-delivery-and-overflow-outcomes");
    expect(itemDelivery.content[0]?.text).toContain("Player.give");

    const inventory = await callMinecraftSkillsTool("get_authoring_recipe", {
      id: "paper-inventory-gui-interactions",
    });
    expect(inventory.content[0]?.text).toContain("settle-editable-session-exactly-once");
    expect(inventory.content[0]?.text).toContain("InventoryCloseEvent handling");
  });

  it("calls authoring scenario tools", async () => {
    const list = await callMinecraftSkillsTool("list_authoring_scenarios", {
      domain: "paper-plugin",
    });
    expect(list.content[0]?.text).toContain('"id": "paper-event-listener-review"');
    expect(list.content[0]?.text).toContain('"id": "paper-api-scheduler-review"');
    expect(list.content[0]?.text).toContain('"id": "paper-item-delivery-review"');
    expect(list.content[0]?.text).toContain('"id": "paper-inventory-gui-interaction-review"');

    const single = await callMinecraftSkillsTool("get_authoring_scenario", {
      id: "paper-event-listener-review",
    });
    expect(single.content[0]?.text).toContain('"paper-event-listener"');
    expect(single.content[0]?.text).toContain("paper-event-candidate-unverified");

    const itemDelivery = await callMinecraftSkillsTool("get_authoring_scenario", {
      id: "paper-item-delivery-review",
    });
    expect(itemDelivery.content[0]?.text).toContain('"paper-safe-item-delivery"');
    expect(itemDelivery.content[0]?.text).toContain("paper-inventory-leftovers-unhandled");

    const inventory = await callMinecraftSkillsTool("get_authoring_scenario", {
      id: "paper-inventory-gui-interaction-review",
    });
    expect(inventory.content[0]?.text).toContain('"paper-inventory-gui-interactions"');
    expect(inventory.content[0]?.text).toContain("atomic settlement transition");
  });

  it("calls authoring scenario search tool", async () => {
    const result = await callMinecraftSkillsTool("search_authoring_scenarios", {
      query: "Paper event listener",
      domain: "paper-plugin",
    });
    expect(result.content[0]?.text).toContain('"query": "Paper event listener"');
    expect(result.content[0]?.text).toContain('"id": "paper-event-listener-review"');
    expect(result.content[0]?.text).toContain('"matchedTokens"');

    const itemDelivery = await callMinecraftSkillsTool("search_authoring_scenarios", {
      query: "full inventory reward leftovers",
      domain: "paper-plugin",
    });
    expect(itemDelivery.content[0]?.text).toContain('"id": "paper-item-delivery-review"');

    const inventory = await callMinecraftSkillsTool("search_authoring_scenarios", {
      query: "inventory GUI shift-click drag",
      domain: "paper-plugin",
    });
    expect(inventory.content[0]?.text).toContain('"id": "paper-inventory-gui-interaction-review"');
  });

  it("routes Paper plugin protocol tasks through authoring tools", async () => {
    const scenarioSearch = await callMinecraftSkillsTool("search_authoring_scenarios", {
      query: "custom payload request correlation",
      domain: "paper-plugin",
    });
    expect(scenarioSearch.content[0]?.text).toContain(
      '"id": "paper-plugin-protocol-safety-review"',
    );

    const catalogSearch = await callMinecraftSkillsTool("search_catalog", {
      query: "chunked upload codec",
      domain: "paper-plugin",
      kind: "authoring-recipe",
    });
    expect(catalogSearch.content[0]?.text).toContain('"id": "paper-plugin-protocol-safety"');

    const recipe = await callMinecraftSkillsTool("get_authoring_recipe", {
      id: "paper-plugin-protocol-safety",
    });
    expect(recipe.content[0]?.text).toContain("exact input consumption");
    expect(recipe.content[0]?.text).toContain("at most one terminal response");

    const diagnostic = await callMinecraftSkillsTool("get_authoring_diagnostic", {
      id: "paper-plugin-protocol-unsafe",
    });
    expect(diagnostic.content[0]?.text).toContain("authenticated connection");
    expect(diagnostic.content[0]?.text).toContain("Messenger.MAX_MESSAGE_SIZE");

    const suggestions = await callMinecraftSkillsTool("suggest_minecraft_lookups", {
      task: "custom payload request correlation",
      version: "1.21.11",
    });
    expect(suggestions.content[0]?.text).toContain("plugin paper search");
    expect(suggestions.content[0]?.text).toContain('"id": "paper-plugin-protocol-safety-review"');
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

    const itemDelivery = await callMinecraftSkillsTool("get_authoring_plan", {
      scenario: "paper-item-delivery-review",
      version: "1.21.11",
    });
    expect(itemDelivery.content[0]?.text).toContain('"id": "paper-safe-item-delivery"');
    expect(itemDelivery.content[0]?.text).toContain('"id": "paper-inventory-leftovers-unhandled"');

    const inventory = await callMinecraftSkillsTool("get_authoring_plan", {
      scenario: "paper-inventory-gui-interaction-review",
      version: "1.21.11",
    });
    expect(inventory.content[0]?.text).toContain('"id": "paper-inventory-gui-interactions"');
    expect(inventory.content[0]?.text).toContain(
      '"id": "paper-inventory-gui-interaction-unbounded"',
    );
  });

  it("calls administrative command operability guidance tools", async () => {
    const recipe = await callMinecraftSkillsTool("get_authoring_recipe", {
      id: "paper-administrative-command-operability",
    });
    expect(recipe.content[0]?.text).toContain("model-sender-target-and-scope");

    const scenario = await callMinecraftSkillsTool("get_authoring_scenario", {
      id: "paper-administrative-command-operability-review",
    });
    expect(scenario.content[0]?.text).toContain("paper-administrative-command-incomplete");

    const plan = await callMinecraftSkillsTool("get_authoring_plan", {
      scenario: "paper-administrative-command-operability-review",
      version: "1.21.11",
    });
    expect(plan.content[0]?.text).toContain('"id": "paper-administrative-command-operability"');

    const guardrail = await callMinecraftSkillsTool("get_authoring_guardrail", {
      id: "paper-administrative-command-operability",
    });
    expect(guardrail.content[0]?.text).toContain("Allow console execution");

    const diagnostic = await callMinecraftSkillsTool("get_authoring_diagnostic", {
      id: "paper-administrative-command-incomplete",
    });
    expect(diagnostic.content[0]?.text).toContain('"severity": "error"');
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
    expect(list.content[0]?.text).toContain('"id": "paper-inventory-delivery-outcomes"');
    expect(list.content[0]?.text).toContain('"id": "paper-inventory-gui-interaction-safety"');

    const single = await callMinecraftSkillsTool("get_authoring_guardrail", {
      id: "paper-api-surface-limits",
    });
    expect(single.content[0]?.text).toContain("Javadocs package, type, and member indexes");

    const itemDelivery = await callMinecraftSkillsTool("get_authoring_guardrail", {
      id: "paper-inventory-delivery-outcomes",
    });
    expect(itemDelivery.content[0]?.text).toContain("uninserted stacks");
    expect(itemDelivery.content[0]?.text).toContain("Player.give");

    const inventory = await callMinecraftSkillsTool("get_authoring_guardrail", {
      id: "paper-inventory-gui-interaction-safety",
    });
    expect(inventory.content[0]?.text).toContain("InventoryCloseEvent handlers");
    expect(inventory.content[0]?.text).toContain("exactly once");
  });

  it("calls authoring diagnostic tools", async () => {
    const list = await callMinecraftSkillsTool("list_authoring_diagnostics", {
      domain: "paper-plugin",
    });
    expect(list.content[0]?.text).toContain('"id": "paper-api-member-unverified"');
    expect(list.content[0]?.text).toContain('"id": "paper-threading-assumption"');
    expect(list.content[0]?.text).toContain('"id": "paper-inventory-leftovers-unhandled"');
    expect(list.content[0]?.text).toContain('"id": "paper-inventory-gui-interaction-unbounded"');

    const single = await callMinecraftSkillsTool("get_authoring_diagnostic", {
      id: "paper-api-member-unverified",
    });
    expect(single.content[0]?.text).toContain('"severity": "error"');
    expect(single.content[0]?.text).toContain("searchPaperMembers");

    const itemDelivery = await callMinecraftSkillsTool("get_authoring_diagnostic", {
      id: "paper-inventory-leftovers-unhandled",
    });
    expect(itemDelivery.content[0]?.text).toContain('"severity": "error"');
    expect(itemDelivery.content[0]?.text).toContain("original requested stack");

    const inventory = await callMinecraftSkillsTool("get_authoring_diagnostic", {
      id: "paper-inventory-gui-interaction-unbounded",
    });
    expect(inventory.content[0]?.text).toContain('"severity": "error"');
    expect(inventory.content[0]?.text).toContain("deprecated InventoryClickEvent.setCursor");
    expect(inventory.content[0]?.text).toContain("repeated callbacks");
  });

  it("calls Paper player identity and display guidance tools", async () => {
    const recipe = await callMinecraftSkillsTool("get_authoring_recipe", {
      id: "paper-player-identity-and-display",
    });
    expect(recipe.content[0]?.text).toContain("persist-and-resolve-stable-identity");

    const scenario = await callMinecraftSkillsTool("get_authoring_scenario", {
      id: "paper-player-identity-and-display-review",
    });
    expect(scenario.content[0]?.text).toContain("paper-player-identity-display-confusion");

    const search = await callMinecraftSkillsTool("search_authoring_scenarios", {
      query: "Paper UUID player identity display name OfflinePlayer rename cache",
      domain: "paper-plugin",
    });
    expect(search.content[0]?.text).toContain('"id": "paper-player-identity-and-display-review"');

    const plan = await callMinecraftSkillsTool("get_authoring_plan", {
      scenario: "paper-player-identity-and-display-review",
      version: "1.21.11",
    });
    expect(plan.content[0]?.text).toContain('"id": "paper-player-identity-and-display"');
    expect(plan.content[0]?.text).toContain('"id": "paper-player-identity-display-confusion"');

    const guardrail = await callMinecraftSkillsTool("get_authoring_guardrail", {
      id: "paper-player-identity-and-display",
    });
    expect(guardrail.content[0]?.text).toContain("stable player identifier");

    const diagnostic = await callMinecraftSkillsTool("get_authoring_diagnostic", {
      id: "paper-player-identity-display-confusion",
    });
    expect(diagnostic.content[0]?.text).toContain("only persistent player key");
  });

  it("calls Paper player-session lifecycle safety guidance tools", async () => {
    const recipe = await callMinecraftSkillsTool("get_authoring_recipe", {
      id: "paper-player-session-lifecycle",
    });
    expect(recipe.content[0]?.text).toContain("reject-stale-asynchronous-publication");

    const scenario = await callMinecraftSkillsTool("get_authoring_scenario", {
      id: "paper-player-session-lifecycle-review",
    });
    expect(scenario.content[0]?.text).toContain("paper-player-session-lifecycle-unsafe");

    const search = await callMinecraftSkillsTool("search_authoring_scenarios", {
      query: "Paper player session rapid reconnect stale callback teardown shutdown",
      domain: "paper-plugin",
    });
    expect(search.content[0]?.text).toContain('"id": "paper-player-session-lifecycle-review"');

    const plan = await callMinecraftSkillsTool("get_authoring_plan", {
      scenario: "paper-player-session-lifecycle-review",
      version: "1.21.11",
    });
    expect(plan.content[0]?.text).toContain('"id": "paper-player-session-lifecycle"');
    expect(plan.content[0]?.text).toContain('"id": "paper-player-session-lifecycle-unsafe"');

    const guardrail = await callMinecraftSkillsTool("get_authoring_guardrail", {
      id: "paper-player-session-lifecycle-safety",
    });
    expect(guardrail.content[0]?.text).toContain("session instance or generation");

    const diagnostic = await callMinecraftSkillsTool("get_authoring_diagnostic", {
      id: "paper-player-session-lifecycle-unsafe",
    });
    expect(diagnostic.content[0]?.text).toContain("fire-and-forget persistence");

    const catalog = await callMinecraftSkillsTool("search_catalog", {
      query: "session generation teardown reconnect",
      domain: "paper-plugin",
      kind: "authoring-recipe",
    });
    expect(catalog.content[0]?.text).toContain('"id": "paper-player-session-lifecycle"');
  });

  it("calls Paper plugin testing evidence guidance tools", async () => {
    const recipe = await callMinecraftSkillsTool("get_authoring_recipe", {
      id: "paper-plugin-testing-evidence",
    });
    expect(recipe.content[0]?.text).toContain("choose-the-minimum-sufficient-evidence-layer");
    expect(recipe.content[0]?.text).toContain("loaded-server test");

    const scenario = await callMinecraftSkillsTool("get_authoring_scenario", {
      id: "paper-plugin-testing-evidence-review",
    });
    expect(scenario.content[0]?.text).toContain("paper-plugin-test-evidence-gap");

    const search = await callMinecraftSkillsTool("search_authoring_scenarios", {
      query: "Paper plugin MockBukkit loaded server test evidence",
      domain: "paper-plugin",
    });
    expect(search.content[0]?.text).toContain('"id": "paper-plugin-testing-evidence-review"');

    const plan = await callMinecraftSkillsTool("get_authoring_plan", {
      scenario: "paper-plugin-testing-evidence-review",
      version: "1.21.11",
    });
    expect(plan.content[0]?.text).toContain('"id": "paper-plugin-testing-evidence"');
    expect(plan.content[0]?.text).toContain('"id": "paper-plugin-test-evidence-gap"');

    const guardrail = await callMinecraftSkillsTool("get_authoring_guardrail", {
      id: "paper-plugin-testing-evidence",
    });
    expect(guardrail.content[0]?.text).toContain("type-compatibility evidence only");

    const diagnostic = await callMinecraftSkillsTool("get_authoring_diagnostic", {
      id: "paper-plugin-test-evidence-gap",
    });
    expect(diagnostic.content[0]?.text).toContain("loaded-plugin evidence");
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

    const search = await callMinecraftSkillsTool("search_community_datasets", {
      query: "misode mcmeta datapack recipes",
      domain: "datapack",
    });
    expect(search.content[0]?.text).toContain('"kind": "community-dataset"');
    expect(search.content[0]?.text).toContain("misode-mcmeta");

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

  it("publishes bounded vanilla datapack JSON input schemas", () => {
    const files = tools.find((tool) => tool.name === "search_vanilla_datapack_json_files");
    expect(files?.inputSchema.properties).toMatchObject({
      version: { maxLength: 128 },
      kind: { maxLength: 128 },
      prefix: { maxLength: 4096 },
      contains: { maxLength: 256 },
      limit: { minimum: 1, maximum: 200 },
    });

    const search = tools.find((tool) => tool.name === "search_vanilla_datapack_json_content");
    expect(search?.inputSchema.properties).toMatchObject({
      query: { maxLength: 256 },
      kind: { maxLength: 128 },
      prefix: { maxLength: 4096 },
    });

    const get = tools.find((tool) => tool.name === "get_vanilla_datapack_json");
    expect(get?.inputSchema.properties).toMatchObject({
      path: { maxLength: 4096 },
      output: { enum: ["parsed", "text"] },
    });
  });

  it("searches and reads cached vanilla datapack JSON files", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-mcp-"));
    vi.stubEnv("MINECRAFT_SKILLS_CACHE_DIR", root);
    try {
      cacheServerJar("26.2", {
        "data/minecraft/recipe/test.json":
          '{"type":"minecraft:crafting_shapeless","ingredients":[{"item":"minecraft:diamond"}]}',
        "data/minecraft/loot_table/blocks/test.json": '{"type":"minecraft:block"}',
      });
      const search = await callMinecraftSkillsTool("search_vanilla_datapack_json_files", {
        version: "26.2",
        kind: "recipe",
        contains: "test",
      });
      expect(search.content[0]?.text).toContain('"matchedFiles": 1');
      expect(search.content[0]?.text).toContain("data/minecraft/recipe/test.json");

      const contentSearch = await callMinecraftSkillsTool("search_vanilla_datapack_json_content", {
        version: "26.2",
        query: "minecraft:diamond",
        kind: "recipe",
        scope: "values",
      });
      expect(contentSearch.content[0]?.text).toContain('"matchedFiles": 1');
      expect(contentSearch.content[0]?.text).toContain('"pointer": "/ingredients/0/item"');

      const file = await callMinecraftSkillsTool("get_vanilla_datapack_json", {
        version: "26.2",
        path: "data/minecraft/recipe/test.json",
      });
      expect(file.content[0]?.text).toContain('"type": "minecraft:crafting_shapeless"');
      const parsedFile = JSON.parse(file.content[0]?.text ?? "") as {
        content?: unknown;
        json?: unknown;
        output: { mode: string; content?: unknown; json?: unknown };
      };
      expect(parsedFile.content).toBeUndefined();
      expect(parsedFile.json).toBeUndefined();
      expect(parsedFile.output.mode).toBe("parsed");
      expect(parsedFile.output.content).toBeUndefined();
      expect(parsedFile.output.json).toBeDefined();

      const textFile = await callMinecraftSkillsTool("get_vanilla_datapack_json", {
        version: "26.2",
        path: "data/minecraft/recipe/test.json",
        output: "text",
      });
      const rawFile = JSON.parse(textFile.content[0]?.text ?? "") as {
        output: { mode: string; content?: unknown; json?: unknown };
      };
      expect(rawFile.output.mode).toBe("text");
      expect(rawFile.output.content).toBeTypeOf("string");
      expect(rawFile.output.json).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("strictly validates vanilla datapack JSON tool arguments", async () => {
    const omittedOptionalInput = await callMinecraftSkillsTool(
      "search_vanilla_datapack_json_files",
      undefined,
    );
    expect(omittedOptionalInput.content[0]?.text).not.toContain("input must be an object");

    const cases: Array<{
      name: string;
      input: Record<string, unknown>;
      error: string;
    }> = [
      {
        name: "search_vanilla_datapack_json_files",
        input: { edition: 1 },
        error: "edition must be a string",
      },
      {
        name: "search_vanilla_datapack_json_files",
        input: { edition: "bedrock" },
        error: "edition must be java",
      },
      {
        name: "search_vanilla_datapack_json_files",
        input: { version: 26.2 },
        error: "version must be a string",
      },
      {
        name: "search_vanilla_datapack_json_files",
        input: { unexpected: true },
        error: "received an unknown argument",
      },
      {
        name: "search_vanilla_datapack_json_files",
        input: { kind: 1 },
        error: "kind must be a string",
      },
      {
        name: "search_vanilla_datapack_json_files",
        input: { prefix: 1 },
        error: "prefix must be a string",
      },
      {
        name: "search_vanilla_datapack_json_files",
        input: { contains: 1 },
        error: "contains must be a string",
      },
      {
        name: "search_vanilla_datapack_json_files",
        input: { limit: 1.5 },
        error: "limit must be an integer from 1 to 200",
      },
      {
        name: "search_vanilla_datapack_json_content",
        input: { query: 1 },
        error: "query must be a string",
      },
      {
        name: "search_vanilla_datapack_json_content",
        input: { query: "diamond", scope: "value" },
        error: "scope must be keys, values, or all",
      },
      {
        name: "search_vanilla_datapack_json_content",
        input: { query: "diamond", caseSensitive: "false" },
        error: "caseSensitive must be a boolean",
      },
      {
        name: "search_vanilla_datapack_json_content",
        input: { query: "diamond", matchesPerFile: 0 },
        error: "matchesPerFile must be an integer from 1 to 10",
      },
      {
        name: "get_vanilla_datapack_json",
        input: { path: 1 },
        error: "path must be a string",
      },
      {
        name: "get_vanilla_datapack_json",
        input: { path: "data/minecraft/recipe/test.json", parse: "true" },
        error: "received an unknown argument",
      },
      {
        name: "get_vanilla_datapack_json",
        input: { path: "data/minecraft/recipe/test.json", output: "both" },
        error: "output must be parsed or text",
      },
    ];

    for (const testCase of cases) {
      const result = await callMinecraftSkillsTool(testCase.name, testCase.input);
      expect(result.isError, testCase.name).toBe(true);
      expect(result.content[0]?.text, testCase.name).toContain(testCase.error);
    }
  });

  it("rejects overlong vanilla datapack JSON tool arguments", async () => {
    const cases: Array<{ name: string; input: Record<string, unknown>; error: string }> = [
      {
        name: "search_vanilla_datapack_json_files",
        input: { version: "v".repeat(129) },
        error: "version must be at most 128 characters",
      },
      {
        name: "search_vanilla_datapack_json_files",
        input: { kind: "k".repeat(129) },
        error: "kind must be at most 128 characters",
      },
      {
        name: "search_vanilla_datapack_json_files",
        input: { prefix: "p".repeat(4097) },
        error: "prefix must be at most 4096 characters",
      },
      {
        name: "search_vanilla_datapack_json_files",
        input: { contains: "c".repeat(257) },
        error: "contains must be at most 256 characters",
      },
      {
        name: "search_vanilla_datapack_json_content",
        input: { query: "q".repeat(257) },
        error: "query must be at most 256 characters",
      },
      {
        name: "get_vanilla_datapack_json",
        input: { path: "p".repeat(4097) },
        error: "path must be at most 4096 characters",
      },
    ];

    for (const testCase of cases) {
      const result = await callMinecraftSkillsTool(testCase.name, testCase.input);
      expect(result.isError, testCase.name).toBe(true);
      expect(result.content[0]?.text, testCase.name).toContain(testCase.error);
      expect((result.content[0]?.text ?? "").length, testCase.name).toBeLessThan(200);
    }
  });

  it("caps serialized vanilla datapack JSON output with truncation metadata", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-mcp-bounded-json-"));
    vi.stubEnv("MINECRAFT_SKILLS_CACHE_DIR", root);
    try {
      cacheServerJar("26.2", {
        "data/minecraft/recipe/large.json": JSON.stringify({ value: "x".repeat(350_000) }),
      });

      for (const output of ["parsed", "text"] as const) {
        const result = await callMinecraftSkillsTool("get_vanilla_datapack_json", {
          version: "26.2",
          path: "data/minecraft/recipe/large.json",
          output,
        });
        const serialized = result.content[0]?.text ?? "";
        const payload = JSON.parse(serialized) as {
          content?: unknown;
          json?: unknown;
          output: {
            mode: string;
            truncated: boolean;
            maxSerializedBytes: number;
            content?: unknown;
            json?: unknown;
            jsonPreview?: unknown;
          };
        };

        expect(result.isError).toBeUndefined();
        expect(Buffer.byteLength(serialized)).toBeLessThanOrEqual(200_000);
        expect(payload.content).toBeUndefined();
        expect(payload.json).toBeUndefined();
        expect(payload.output.mode).toBe(output);
        expect(payload.output.truncated).toBe(true);
        expect(payload.output.maxSerializedBytes).toBe(200_000);
        if (output === "parsed") {
          expect(payload.output.content).toBeUndefined();
          expect(payload.output.json).toBeUndefined();
          expect(payload.output.jsonPreview).toBeTypeOf("string");
        } else {
          expect(payload.output.content).toBeTypeOf("string");
          expect(payload.output.json).toBeUndefined();
          expect(payload.output.jsonPreview).toBeUndefined();
        }
      }
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

  it("calls validate_datapack_json", async () => {
    const result = await callMinecraftSkillsTool("validate_datapack_json", {
      version: "26.2",
      files: [
        {
          path: "data/example/recipe/widget.json",
          content: {
            type: "minecraft:crafting_shapeless",
            ingredients: ["minecraft:stone"],
            result: {
              id: "minecraft:stone",
            },
          },
        },
      ],
    });
    expect(result.content[0]?.text).toContain('"requestedDomain": "datapack"');
    expect(result.content[0]?.text).toContain('"validatedFiles": 1');
  });

  it("calls validate_datapack_project", async () => {
    const result = await callMinecraftSkillsTool("validate_datapack_project", {
      version: "1.21",
      files: [
        {
          path: "pack.mcmeta",
          content: { pack: { pack_format: 48, description: "MCP fixture" } },
        },
        {
          path: "data/example/function/root.mcfunction",
          content: "function #example:load",
        },
        {
          path: "data/example/function/child.mcfunction",
          content: "say child",
        },
        {
          path: "data/example/tags/function/load.json",
          content: { values: ["example:child"] },
        },
      ],
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('"valid": true');
    expect(result.content[0]?.text).toContain('"validationComplete": true');
    expect(result.content[0]?.text).toContain('"checkedReferences": 2');

    const mergedNamespace = await callMinecraftSkillsTool("validate_datapack_project", {
      version: "1.21",
      assumeLocalNamespacesComplete: false,
      files: [
        {
          path: "pack.mcmeta",
          content: { pack: { pack_format: 48, description: "MCP dependency fixture" } },
        },
        {
          path: "data/example/function/root.mcfunction",
          content: "function example:from_dependency",
        },
      ],
    });
    expect(mergedNamespace.isError).toBeUndefined();
    expect(mergedNamespace.content[0]?.text).toContain('"valid": true');
    expect(mergedNamespace.content[0]?.text).toContain('"validationComplete": false');
    expect(mergedNamespace.content[0]?.text).toContain('"external-reference"');
  });

  it("publishes and enforces bounded datapack project requests", async () => {
    const tool = tools.find((candidate) => candidate.name === "validate_datapack_project");
    const files = tool?.inputSchema.properties.files as
      | {
          maxItems?: number;
          items?: {
            properties?: Record<
              string,
              { maxLength?: number; oneOf?: Array<{ maxLength?: number }> }
            >;
          };
        }
      | undefined;
    expect(files?.maxItems).toBe(defaultDatapackProjectValidationLimits.maxFiles);
    expect(files?.items?.properties?.path?.maxLength).toBe(
      defaultDatapackProjectValidationLimits.maxPathLength,
    );
    expect(files?.items?.properties?.content?.oneOf?.[0]?.maxLength).toBe(
      defaultDatapackProjectValidationLimits.maxTextContentCharacters,
    );
    const namespaceMode = tool?.inputSchema.properties.assumeLocalNamespacesComplete as
      | { default?: boolean }
      | undefined;
    expect(namespaceMode?.default).toBe(true);

    const invalidNamespaceMode = await callMinecraftSkillsTool("validate_datapack_project", {
      assumeLocalNamespacesComplete: "yes",
      files: [],
    });
    expect(invalidNamespaceMode.isError).toBe(true);
    expect(invalidNamespaceMode.content[0]?.text).toContain("must be boolean");

    const tooManyFiles = await callMinecraftSkillsTool("validate_datapack_project", {
      files: Array.from(
        { length: defaultDatapackProjectValidationLimits.maxFiles + 1 },
        (_, index) => ({ path: `data/example/function/${index}.mcfunction` }),
      ),
    });
    expect(tooManyFiles.isError).toBe(true);
    expect(tooManyFiles.content[0]?.text).toContain("accepts at most");

    const overlongPath = await callMinecraftSkillsTool("validate_datapack_project", {
      files: [{ path: "x".repeat(defaultDatapackProjectValidationLimits.maxPathLength + 1) }],
    });
    expect(overlongPath.isError).toBe(true);
    expect(overlongPath.content[0]?.text).toContain("file paths must contain at most");

    const tooMuchText = await callMinecraftSkillsTool("validate_datapack_project", {
      files: [
        {
          path: "pack.mcmeta",
          content: "x".repeat(defaultDatapackProjectValidationLimits.maxTextContentCharacters),
        },
        { path: "data/example/function/test.mcfunction", content: "x" },
      ],
    });
    expect(tooMuchText.isError).toBe(true);
    expect(tooMuchText.content[0]?.text).toContain("text content must total at most");

    const sparseJson = await callMinecraftSkillsTool("validate_datapack_project", {
      files: [
        {
          path: "pack.mcmeta",
          content: {
            pack: {
              description: "bounded sparse input",
              pack_format: 48,
              supported_formats: new Array(defaultDatapackProjectValidationLimits.maxContentNodes),
            },
          },
        },
      ],
    });
    expect(sparseJson.isError).toBeUndefined();
    expect(sparseJson.content[0]?.text).toContain('"valid": false');
    expect(sparseJson.content[0]?.text).toContain('"maxContentNodes"');
  });

  it("calls validate_resourcepack_project", async () => {
    const result = await callMinecraftSkillsTool("validate_resourcepack_project", {
      version: "26.2",
      files: [
        {
          path: "assets/example/items/widget.json",
          content: {
            model: { type: "minecraft:model", model: "example:item/widget" },
          },
        },
        {
          path: "assets/example/models/item/widget.json",
          content: {
            parent: "minecraft:item/generated",
            textures: { layer0: "example:item/widget" },
          },
        },
        {
          path: "assets/example/textures/item/widget.png",
          contentBase64: testPng().toString("base64"),
        },
        {
          path: "assets/example/sounds.json",
          content: { widget: { sounds: ["example:widget"] } },
        },
        {
          path: "assets/example/sounds/widget.ogg",
          contentBase64: validVorbisIdentificationPage().toString("base64"),
        },
      ],
    });
    expect(result.content[0]?.text).toContain('"valid": true');
    expect(result.content[0]?.text).toContain('"checkedReferences": 4');
    expect(result.content[0]?.text).toContain('"binaryFiles": 2');
    expect(result.content[0]?.text).toContain('"inspectedSoundFiles": 1');
    expect(result.content[0]?.text).toContain('"inspectedPngFiles": 1');
    expect(result.content[0]?.text).toContain('"pngValidationComplete": true');
    expect(result.content[0]?.text).toContain('"validationComplete": true');
  });

  it("publishes bounded resource-pack request schema limits", () => {
    const tool = tools.find((candidate) => candidate.name === "validate_resourcepack_project");
    const files = tool?.inputSchema.properties.files as
      | {
          maxItems?: number;
          items?: {
            not?: { anyOf?: unknown[] };
            properties?: Record<string, { maxLength?: number }>;
          };
        }
      | undefined;
    expect(files?.maxItems).toBe(defaultResourcepackProjectValidationLimits.maxFiles);
    expect(files?.items?.properties?.path?.maxLength).toBe(
      defaultResourcepackProjectValidationLimits.maxPathLength,
    );
    expect(files?.items?.not?.anyOf).toHaveLength(2);
  });

  it("rejects malformed or oversized resource-pack sound header base64", async () => {
    const malformed = await callMinecraftSkillsTool("validate_resourcepack_project", {
      files: [{ path: "assets/example/sounds/test.ogg", contentBase64: "not base64" }],
    });
    expect(malformed.isError).toBe(true);
    expect(malformed.content[0]?.text).toContain("canonical padded Base64");

    const oversized = await callMinecraftSkillsTool("validate_resourcepack_project", {
      files: [
        {
          path: "assets/example/sounds/test.ogg",
          contentBase64: Buffer.alloc(59).toString("base64"),
        },
      ],
    });
    expect(oversized.isError).toBe(true);
    expect(oversized.content[0]?.text).toContain("58-byte limit");

    const conflicting = await callMinecraftSkillsTool("validate_resourcepack_project", {
      files: [
        {
          path: "assets/example/sounds/test.ogg",
          content: "ignored",
          contentBase64: validVorbisIdentificationPage().toString("base64"),
        },
      ],
    });
    expect(conflicting.isError).toBe(true);
    expect(conflicting.content[0]?.text).toContain("must not include both");

    const arbitraryOggContent = await callMinecraftSkillsTool("validate_resourcepack_project", {
      files: [
        {
          path: "assets/example/sounds/test.ogg",
          content: "x".repeat(1_024 * 1_024),
        },
      ],
    });
    expect(arbitraryOggContent.isError).toBe(true);
    expect(arbitraryOggContent.content[0]?.text).toContain("bounded contentBase64");
  });

  it("enforces resource-pack request bounds before unbounded processing", async () => {
    const tooManyFiles = await callMinecraftSkillsTool("validate_resourcepack_project", {
      files: Array.from(
        { length: defaultResourcepackProjectValidationLimits.maxFiles + 1 },
        (_, index) => ({ path: `pack/${index}` }),
      ),
    });
    expect(tooManyFiles.isError).toBe(true);
    expect(tooManyFiles.content[0]?.text).toContain("accepts at most");

    const overlongPath = await callMinecraftSkillsTool("validate_resourcepack_project", {
      files: [
        {
          path: "x".repeat(defaultResourcepackProjectValidationLimits.maxPathLength + 1),
        },
      ],
    });
    expect(overlongPath.isError).toBe(true);
    expect(overlongPath.content[0]?.text).toContain("file paths must contain at most");

    const sparseContent = await callMinecraftSkillsTool("validate_resourcepack_project", {
      files: [
        {
          path: "assets/example/sounds.json",
          content: {
            event: {
              sounds: new Array(defaultResourcepackProjectValidationLimits.maxContentNodes),
            },
          },
        },
      ],
    });
    expect(sparseContent.isError).toBeUndefined();
    expect(sparseContent.content[0]?.text).toContain('"processedFiles": 0');
    expect(sparseContent.content[0]?.text).toContain('"maxContentNodes"');
  });

  it("returns complete alpha bounds and optional caller policy as data", async () => {
    const contentBase64 = testAlphaPng([
      [0, 0, 0],
      [0, 128, 0],
      [0, 0, 0],
    ]).toString("base64");
    const result = await callMinecraftSkillsTool("inspect_resourcepack_png_alpha_bounds", {
      contentBase64,
      requirements: {
        nonEmpty: true,
        minimumTransparentMarginPixels: 1,
      },
    });
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]?.text ?? "null") as Record<string, unknown>;
    expect(body).toMatchObject({
      inspectionStrength: "static-alpha",
      pixelInspectionStatus: "complete",
      pixelInspectionComplete: true,
      pixelDataValid: true,
      content: "nonempty",
      nonzeroAlphaPixelCount: 1,
      partiallyTransparentPixelCount: 1,
      contentBounds: {
        x: 1,
        y: 1,
        width: 1,
        height: 1,
        xEndExclusive: 2,
        yEndExclusive: 2,
      },
      transparentMargins: { top: 1, right: 1, bottom: 1, left: 1, minimum: 1 },
      requirements: { status: "met", failures: [] },
    });
    expect(body).not.toHaveProperty("path");
    expect(body).not.toHaveProperty("pixels");
    expect(body).not.toHaveProperty("rgb");

    const definition = tools.find((tool) => tool.name === "inspect_resourcepack_png_alpha_bounds");
    expect(Object.keys(definition?.inputSchema.properties ?? {}).sort()).toEqual([
      "contentBase64",
      "limits",
      "requirements",
    ]);
  });

  it("reports malformed and bounded pixel data without MCP transport errors", async () => {
    const malformed = await callMinecraftSkillsTool("inspect_resourcepack_png_alpha_bounds", {
      contentBase64: testPng(1, 1).toString("base64"),
    });
    expect(malformed.isError).toBeUndefined();
    expect(malformed.content[0]?.text).toContain('"pixelInspectionStatus": "invalid"');
    expect(malformed.content[0]?.text).toContain(
      '"pixelInspectionReason": "zlib-decompression-failed"',
    );

    const bounded = await callMinecraftSkillsTool("inspect_resourcepack_png_alpha_bounds", {
      contentBase64: testAlphaPng([[255]]).toString("base64"),
      limits: { maxInflatedBytes: 4 },
      requirements: { nonEmpty: true },
    });
    expect(bounded.isError).toBeUndefined();
    expect(bounded.content[0]?.text).toContain('"pixelInspectionStatus": "indeterminate"');
    expect(bounded.content[0]?.text).toContain(
      '"pixelInspectionReason": "inflated-byte-limit-exceeded"',
    );
    expect(bounded.content[0]?.text).toContain('"status": "not-checked"');
    expect(bounded.content[0]?.text).toContain('"valid": true');
  });

  it("descriptor-preflights hostile alpha-inspection root objects without running user code", async () => {
    const contentBase64 = testAlphaPng([[255]]).toString("base64");
    let trapCalls = 0;
    const liveProxy = new Proxy(
      { contentBase64 },
      {
        ownKeys() {
          trapCalls += 1;
          throw new Error("must not run");
        },
      },
    );
    const revoked = Proxy.revocable({ contentBase64 }, {});
    revoked.revoke();
    let accessorCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "contentBase64", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        throw new Error("must not run");
      },
    });
    const hidden = {};
    Object.defineProperty(hidden, "contentBase64", {
      enumerable: false,
      value: contentBase64,
    });
    class RequestInput {
      contentBase64 = contentBase64;
    }
    const withSymbol = { contentBase64, [Symbol("hidden")]: true };
    const sparse = new Array(2);

    for (const input of [
      null,
      sparse,
      new RequestInput(),
      liveProxy,
      revoked.proxy,
      accessor,
      hidden,
      withSymbol,
      { contentBase64, unknown: true },
    ]) {
      const result = await callMinecraftSkillsTool("inspect_resourcepack_png_alpha_bounds", input);
      expect(result.isError).toBe(true);
    }
    expect(trapCalls).toBe(0);
    expect(accessorCalls).toBe(0);
  });

  it("descriptor-preflights alpha limits and requirements without running accessors", async () => {
    const contentBase64 = testAlphaPng([[255]]).toString("base64");
    let accessorCalls = 0;
    let proxyTrapCalls = 0;
    const accessorLimits = {};
    Object.defineProperty(accessorLimits, "maxPixels", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        throw new Error("must not run");
      },
    });
    const accessorRequirements = {};
    Object.defineProperty(accessorRequirements, "nonEmpty", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        throw new Error("must not run");
      },
    });
    const proxyHandler = {
      ownKeys() {
        proxyTrapCalls += 1;
        throw new Error("must not run");
      },
    };
    const liveLimits = new Proxy({}, proxyHandler);
    const liveRequirements = new Proxy({}, proxyHandler);
    const revokedRequirements = Proxy.revocable({}, {});
    revokedRequirements.revoke();
    const hiddenRequirements = {};
    Object.defineProperty(hiddenRequirements, "nonEmpty", {
      enumerable: false,
      value: true,
    });
    class Limits {
      maxPixels = 1;
    }

    const inputs = [
      { contentBase64, limits: null },
      { contentBase64, limits: [] },
      { contentBase64, limits: new Limits() },
      { contentBase64, limits: accessorLimits },
      { contentBase64, limits: liveLimits },
      { contentBase64, limits: { maxPixels: 1, [Symbol("hidden")]: 1 } },
      { contentBase64, limits: { unknown: 1 } },
      { contentBase64, requirements: revokedRequirements.proxy },
      { contentBase64, requirements: new Array(1) },
      { contentBase64, requirements: accessorRequirements },
      { contentBase64, requirements: liveRequirements },
      { contentBase64, requirements: hiddenRequirements },
      { contentBase64, requirements: { unknown: true } },
      { contentBase64, requirements: { nonEmpty: "true" } },
      { contentBase64, requirements: { minimumTransparentMarginPixels: 16_385 } },
      { contentBase64, path: "texture.png" },
      { contentBase64, url: "https://example.invalid/texture.png" },
    ];
    for (const input of inputs) {
      const result = await callMinecraftSkillsTool("inspect_resourcepack_png_alpha_bounds", input);
      expect(result.isError).toBe(true);
    }
    expect(accessorCalls).toBe(0);
    expect(proxyTrapCalls).toBe(0);
  });

  it.each([
    ["whitespace", "AAAA AAAA", "without whitespace"],
    ["URL-safe alphabet", "____", "without whitespace"],
    ["missing padding", "Zg", "without whitespace"],
    ["excess padding", "Zg===", "without whitespace"],
    ["non-canonical pad bits", "AB==", "pad bits"],
  ])("rejects %s in alpha-inspection Base64", async (_label, contentBase64, message) => {
    const result = await callMinecraftSkillsTool("inspect_resourcepack_png_alpha_bounds", {
      contentBase64,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(message);
  });

  it("checks the alpha-inspection decoded byte bound before Base64 allocation", async () => {
    const contentBase64 = Buffer.alloc(9).toString("base64");
    const decodeSpy = vi.spyOn(Buffer, "from");
    try {
      const encoded = await callMinecraftSkillsTool("inspect_resourcepack_png_alpha_bounds", {
        contentBase64: "A".repeat(13),
        limits: { maxInputBytes: 8 },
      });
      expect(encoded.isError).toBe(true);
      expect(encoded.content[0]?.text).toContain("encoded-length limit");

      const result = await callMinecraftSkillsTool("inspect_resourcepack_png_alpha_bounds", {
        contentBase64,
        limits: { maxInputBytes: 8 },
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("decodes to more than the 8-byte limit");
      expect(decodeSpy).not.toHaveBeenCalled();
    } finally {
      decodeSpy.mockRestore();
    }
  });

  it("calls validate_resourcepack_png with complete non-square PNG bytes", async () => {
    const result = await callMinecraftSkillsTool("validate_resourcepack_png", {
      contentBase64: testPng().toString("base64"),
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('"validationStrength": "structure"');
    expect(result.content[0]?.text).toContain('"valid": true');
    expect(result.content[0]?.text).toContain('"width": 3');
    expect(result.content[0]?.text).toContain('"height": 5');
  });

  it("exposes a closed structured player-skin layout schema", () => {
    const tool = tools.find((entry) => entry.name === "validate_player_skin_layout");
    expect(tool?.inputSchema).toMatchObject({
      required: ["width", "height"],
      additionalProperties: false,
      properties: {
        width: { type: "integer", minimum: 1, maximum: 16_384 },
        height: { type: "integer", minimum: 1, maximum: 16_384 },
        sourceRects: {
          type: "object",
          additionalProperties: false,
          properties: {
            base: { type: "object", additionalProperties: false },
            hat: { type: "object", additionalProperties: false },
          },
        },
      },
    });
  });

  it("validates structured current, legacy, and clipped player-skin layouts", async () => {
    const current = await callMinecraftSkillsTool("validate_player_skin_layout", {
      width: 64,
      height: 64,
      sourceRects: {
        base: { x: 8, y: 8, width: 8, height: 8 },
        hat: { x: 40, y: 8, width: 8, height: 8 },
      },
    });
    expect(current.isError).toBeUndefined();
    expect(current.content[0]?.text).toContain('"valid": true');
    expect(current.content[0]?.text).toContain('"layoutStatus": "current"');

    const legacy = await callMinecraftSkillsTool("validate_player_skin_layout", {
      width: 64,
      height: 32,
    });
    expect(legacy.isError).toBeUndefined();
    expect(legacy.content[0]?.text).toContain('"layoutStatus": "legacy"');

    const clipped = await callMinecraftSkillsTool("validate_player_skin_layout", {
      width: 64,
      height: 64,
      sourceRects: { base: { x: 8, y: 8, width: 7, height: 8 } },
    });
    expect(clipped.isError).toBeUndefined();
    expect(clipped.content[0]?.text).toContain('"valid": false');
    expect(clipped.content[0]?.text).toContain('"skin.face-base-rect-mismatch"');
  });

  it("passes proxy and accessor boundaries directly to the player-skin validator", async () => {
    let getterCalls = 0;
    const accessor = { height: 64 } as Record<string, unknown>;
    Object.defineProperty(accessor, "width", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 64;
      },
    });
    const accessorResult = await callMinecraftSkillsTool("validate_player_skin_layout", accessor);
    expect(accessorResult.isError).toBeUndefined();
    expect(accessorResult.content[0]?.text).toContain("input.accessor-property-not-accepted");
    expect(getterCalls).toBe(0);

    const proxy = new Proxy(
      { width: 64, height: 64 },
      {
        get: () => {
          throw new Error("proxy trap must not run");
        },
      },
    );
    const proxyResult = await callMinecraftSkillsTool("validate_player_skin_layout", proxy);
    expect(proxyResult.isError).toBeUndefined();
    expect(proxyResult.content[0]?.text).toContain("input.proxy-not-accepted");
  });

  it("reports PNG structural failures without treating them as MCP transport errors", async () => {
    const png = testPng();
    png[png.length - 1] = (png[png.length - 1] ?? 0) ^ 0xff;
    const result = await callMinecraftSkillsTool("validate_resourcepack_png", {
      contentBase64: png.toString("base64"),
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('"valid": false');
    expect(result.content[0]?.text).toContain('"png.crc-mismatch"');
    expect(result.content[0]?.text).toContain('"validationComplete": false');
  });

  it.each([
    ["whitespace", "AAAA AAAA", "without whitespace"],
    ["URL-safe alphabet", "____", "without whitespace"],
    ["missing padding", "Zg", "without whitespace"],
    ["excess padding", "Zg===", "without whitespace"],
    ["non-canonical pad bits", "AB==", "pad bits"],
  ])("rejects %s in PNG Base64", async (_label, contentBase64, message) => {
    const result = await callMinecraftSkillsTool("validate_resourcepack_png", { contentBase64 });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(message);
  });

  it("caps PNG Base64 before and after encoded-length calculation", async () => {
    const exactDecodedLength = await callMinecraftSkillsTool("validate_resourcepack_png", {
      contentBase64: Buffer.alloc(8).toString("base64"),
      limits: { maxInputBytes: 8 },
    });
    expect(exactDecodedLength.isError).toBeUndefined();
    expect(exactDecodedLength.content[0]?.text).toContain('"png.invalid-signature"');

    const encodedTooLong = await callMinecraftSkillsTool("validate_resourcepack_png", {
      contentBase64: "A".repeat(13),
      limits: { maxInputBytes: 8 },
    });
    expect(encodedTooLong.isError).toBe(true);
    expect(encodedTooLong.content[0]?.text).toContain("encoded-length limit");

    const decodedTooLong = await callMinecraftSkillsTool("validate_resourcepack_png", {
      contentBase64: Buffer.alloc(9).toString("base64"),
      limits: { maxInputBytes: 8 },
    });
    expect(decodedTooLong.isError).toBe(true);
    expect(decodedTooLong.content[0]?.text).toContain("decodes to more than");
  });

  it("enforces the shared project binary budget before decoding OGG and PNG Base64", async () => {
    const files = [
      { path: "pack.png", contentBase64: testPng(1, 1).toString("base64") },
      {
        path: "assets/example/sounds/test.ogg",
        contentBase64: validVorbisIdentificationPage().toString("base64"),
      },
    ];
    const exact = await callMinecraftSkillsTool("validate_resourcepack_project", {
      files,
      limits: { maxBinaryContentBytes: 115 },
    });
    expect(exact.isError).toBeUndefined();
    expect(exact.content[0]?.text).toContain('"inspectedPngFiles": 1');
    expect(exact.content[0]?.text).toContain('"inspectedSoundFiles": 1');

    const decodeSpy = vi.spyOn(Buffer, "from");
    try {
      const exceeded = await callMinecraftSkillsTool("validate_resourcepack_project", {
        files,
        limits: { maxBinaryContentBytes: 114 },
      });
      expect(exceeded.isError).toBe(true);
      expect(exceeded.content[0]?.text).toContain(
        "aggregate limit of 114 bytes before Base64 decoding",
      );
      expect(decodeSpy).not.toHaveBeenCalled();
    } finally {
      decodeSpy.mockRestore();
    }
  });

  it("rejects invalid PNG limits and project Base64 placement", async () => {
    const invalidLimit = await callMinecraftSkillsTool("validate_resourcepack_png", {
      contentBase64: testPng().toString("base64"),
      limits: { maxWidth: 0 },
    });
    expect(invalidLimit.isError).toBe(true);
    expect(invalidLimit.content[0]?.text).toContain("limits.maxWidth must be an integer");

    const nonPng = await callMinecraftSkillsTool("validate_resourcepack_project", {
      files: [{ path: "pack.mcmeta", contentBase64: testPng().toString("base64") }],
    });
    expect(nonPng.isError).toBe(true);
    expect(nonPng.content[0]?.text).toContain("accepted only for OGG and PNG files");

    const unboundedPngContent = await callMinecraftSkillsTool("validate_resourcepack_project", {
      files: [{ path: "pack.png", content: "not binary-safe" }],
    });
    expect(unboundedPngContent.isError).toBe(true);
    expect(unboundedPngContent.content[0]?.text).toContain("must use bounded contentBase64");
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

  it("calls registry entry search and comparison tools", async () => {
    const search = await callMinecraftSkillsTool("search_registry_entries", {
      version: "26.2",
      registry: "minecraft:item",
      exact: "minecraft:stone",
    });
    expect(search.content[0]?.text).toContain('"registryStatus": "indexed"');
    expect(search.content[0]?.text).toContain('"entryId": "minecraft:stone"');

    const comparison = await callMinecraftSkillsTool("compare_registry_entries", {
      from: "26.1.2",
      to: "26.2",
      registry: "minecraft:block",
      exact: "minecraft:cinnabar",
    });
    expect(comparison.content[0]?.text).toContain('"addedTotal": 1');
    expect(comparison.content[0]?.text).toContain('"entryId": "minecraft:cinnabar"');

    const protocolComparison = await callMinecraftSkillsTool("compare_registry_entries", {
      from: "26.1.2",
      to: "26.2",
      registry: "minecraft:attribute",
      exact: "minecraft:armor",
    });
    expect(protocolComparison.content[0]?.text).toContain('"outcome": "compared"');
    expect(protocolComparison.content[0]?.text).toContain('"changedProtocolIdsTotal": 1');
    expect(protocolComparison.content[0]?.text).toContain('"from": 0');
    expect(protocolComparison.content[0]?.text).toContain('"to": 1');
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
      query: "bundle item model",
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
      query: "Diamond Sword",
      kind: "item-definition",
    });
    expect(resourcepack.content[0]?.text).toContain("assets/minecraft/items/diamond_sword.json");

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

    const itemDelivery = await callMinecraftSkillsTool("suggest_minecraft_lookups", {
      version: "1.21.11",
      task: "handle full inventory reward leftovers",
    });
    expect(itemDelivery.content[0]?.text).toContain("plugin paper search");
    expect(itemDelivery.content[0]?.text).toContain('"id": "paper-item-delivery-review"');
    expect(itemDelivery.content[0]?.text).not.toContain("resourcepack assets find");

    const itemModel = await callMinecraftSkillsTool("suggest_minecraft_lookups", {
      version: "1.21.11",
      task: "give an item model a custom texture",
    });
    expect(itemModel.content[0]?.text).not.toContain("plugin paper search");

    const experienceReward = await callMinecraftSkillsTool("suggest_minecraft_lookups", {
      version: "1.21.11",
      task: "reward a player with experience points",
    });
    const experienceRewardOutput = JSON.parse(experienceReward.content[0]?.text ?? "{}") as {
      suggestedTools: Array<{ tool: string }>;
    };
    expect(
      experienceRewardOutput.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper ")),
    ).toBe(false);

    const inventorySuggestions = await callMinecraftSkillsTool("suggest_minecraft_lookups", {
      version: "1.21.11",
      domain: "paper-plugin",
      task: "inventory GUI shift-click drag",
    });
    const inventoryOutput = JSON.parse(inventorySuggestions.content[0]?.text ?? "{}") as {
      suggestedTools: Array<{ tool: string }>;
      scenarios: { results: Array<{ scenario: { id: string } }> };
    };
    expect(
      inventoryOutput.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper search")),
    ).toBe(true);
    expect(
      inventoryOutput.suggestedTools.some((entry) =>
        entry.tool.startsWith("minecraft pack-format"),
      ),
    ).toBe(false);
    expect(inventoryOutput.scenarios.results[0]?.scenario.id).toBe(
      "paper-inventory-gui-interaction-review",
    );

    const resourcepackSuggestions = await callMinecraftSkillsTool("suggest_minecraft_lookups", {
      version: "1.21.11",
      task: "design a resource pack inventory GUI texture",
    });
    const resourcepackOutput = JSON.parse(resourcepackSuggestions.content[0]?.text ?? "{}") as {
      suggestedTools: Array<{ tool: string }>;
    };
    expect(
      resourcepackOutput.suggestedTools.some((entry) =>
        entry.tool.startsWith("resourcepack assets"),
      ),
    ).toBe(true);
    expect(
      resourcepackOutput.suggestedTools.some((entry) =>
        entry.tool.startsWith("plugin paper search"),
      ),
    ).toBe(false);
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

  it("calls get_fabric_toolchain", async () => {
    const intermediary = {
      maven: "net.fabricmc:intermediary:1.21.11",
      version: "1.21.11",
      stable: true,
    };
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      const body = url.includes("/loader/")
        ? [
            {
              loader: {
                separator: "+build.",
                build: 1,
                maven: "net.fabricmc:fabric-loader:0.17.0",
                version: "0.17.0",
                stable: true,
              },
              intermediary,
            },
          ]
        : url.includes("/yarn/")
          ? [
              {
                gameVersion: "1.21.11",
                separator: "+build.",
                build: 6,
                maven: "net.fabricmc:yarn:1.21.11+build.6",
                version: "1.21.11+build.6",
                stable: true,
              },
            ]
          : [intermediary];
      return new Response(JSON.stringify(body));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMinecraftSkillsTool("get_fabric_toolchain", {
      gameVersion: "1.21.11",
      limit: 1,
      timeoutMs: 1000,
    });
    expect(result.content[0]?.text).toContain("net.fabricmc:fabric-loader:0.17.0");
    expect(result.content[0]?.text).toContain("net.fabricmc:yarn:1.21.11+build.6");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("calls resolve_velocity_toolchain", async () => {
    const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<metadata><groupId>com.velocitypowered</groupId><artifactId>velocity-api</artifactId>
<versioning><latest>4.1.0-SNAPSHOT</latest><release>4.0.0</release>
<versions><version>4.0.0</version><version>4.1.0-SNAPSHOT</version></versions>
<lastUpdated>20260814105730</lastUpdated></versioning></metadata>`;
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes("maven-metadata.xml")) {
        return new Response(metadata, { headers: { "Content-Type": "application/xml" } });
      }
      if (url.includes("creating-your-first-plugin")) {
        return new Response(
          `<html><body>Project JDK is Java 25 or later
          <table><tr><td>com.velocitypowered</td><td>velocity-api</td><td>4.1.0-SNAPSHOT</td></tr></table>
          https://repo.papermc.io/repository/maven-public/</body></html>`,
          { headers: { "Content-Type": "text/html" } },
        );
      }
      return new Response(
        "<html><body>Velocity 4.0.x and above requires at least Java 25.</body></html>",
        { headers: { "Content-Type": "text/html" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMinecraftSkillsTool("resolve_velocity_toolchain", {
      limit: 1,
      timeoutMs: 1000,
    });
    expect(result.content[0]?.text).toContain("com.velocitypowered:velocity-api:4.1.0-SNAPSHOT");
    expect(result.content[0]?.text).toContain('"minimumVersion": 25');
    expect(result.content[0]?.text).toContain('"minecraftGameVersions": "not-inferred"');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("calls search_modrinth_projects", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ hits: [{ slug: "sodium" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMinecraftSkillsTool("search_modrinth_projects", {
      query: "sodium",
      version: "1.21.11",
      projectType: "mod",
      loader: "fabric",
      limit: 5,
    });
    expect(result.content[0]?.text).toContain("sodium");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain("versions%3A1.21.11");
    expect(url).toContain("categories%3Afabric");
    expect(new Headers(init?.headers).get("User-Agent")).toContain("minecraft-skills");
  });

  it("validates Modrinth index JSON and archive metadata without binary input", async () => {
    const result = await callMinecraftSkillsTool("validate_modrinth_pack", {
      index: {
        formatVersion: 1,
        game: "minecraft",
        versionId: "example-1.0.0",
        name: "Example",
        files: [],
        dependencies: { minecraft: "1.21.11" },
      },
      archiveEntries: [
        { path: "modrinth.index.json", size: 100 },
        { path: "overrides/../../outside.txt", size: 1 },
      ],
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('"valid": false');
    expect(result.content[0]?.text).toContain('"validationStrength": "metadata"');
    expect(result.content[0]?.text).toContain('"code": "archive.unsafe-path"');
  });

  it("allows an explicit non-official Modrinth download host with a warning", async () => {
    const result = await callMinecraftSkillsTool("validate_modrinth_pack", {
      index: {
        formatVersion: 1,
        game: "minecraft",
        versionId: "example-1.0.0",
        name: "Example",
        files: [
          {
            path: "mods/example.jar",
            hashes: { sha1: "a".repeat(40), sha512: "b".repeat(128) },
            downloads: ["https://downloads.example.org/example.jar"],
            fileSize: 1,
          },
        ],
        dependencies: { minecraft: "1.21.11" },
      },
      additionalDownloadHosts: ["downloads.example.org"],
      limits: { maxDiagnostics: 10 },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('"valid": true');
    expect(result.content[0]?.text).toContain('"file.unofficial-download-host"');
  });

  it("does not echo an unbounded Modrinth dependency key", async () => {
    const dependencyPrefix = "dependency".repeat(2_000);
    const result = await callMinecraftSkillsTool("validate_modrinth_pack", {
      index: {
        formatVersion: 1,
        game: "minecraft",
        versionId: "example-1.0.0",
        name: "Example",
        files: [],
        dependencies: {
          minecraft: "1.21.11",
          [`${dependencyPrefix}a`]: "1.0.0",
          [`${dependencyPrefix}b`]: "1.0.0",
        },
      },
    });
    const output = result.content[0]?.text ?? "";

    expect(output).toContain("name-too-long");
    expect(output.length).toBeLessThan(20_000);
  });

  it("rejects impossible Modrinth archive metadata through MCP", async () => {
    const result = await callMinecraftSkillsTool("validate_modrinth_pack", {
      index: {
        formatVersion: 1,
        game: "minecraft",
        versionId: "example-1.0.0",
        name: "Example",
        files: [],
        dependencies: { minecraft: "1.21.11" },
      },
      archiveEntries: [
        { path: "modrinth.index.json", size: 0, compressedSize: 0, compressionMethod: 0 },
        {
          path: "overrides/zero-compressed.txt",
          size: 1,
          compressedSize: 0,
          compressionMethod: 8,
        },
        {
          path: "overrides/stored-mismatch.txt",
          size: 2,
          compressedSize: 1,
          compressionMethod: 0,
        },
      ],
      limits: { maxCompressionRatio: 1.5 },
    });
    const output = result.content[0]?.text ?? "";

    expect(output).toContain('"archive.compression-ratio-limit"');
    expect(output).toContain('"archive.stored-size-mismatch"');
  });

  it("enforces Modrinth MCP hard caps before mapping untrusted arrays", async () => {
    const index = {
      formatVersion: 1,
      game: "minecraft",
      versionId: "example-1.0.0",
      name: "Example",
      files: [],
      dependencies: { minecraft: "1.21.11" },
    };
    const tooManyEntries = await callMinecraftSkillsTool("validate_modrinth_pack", {
      index,
      archiveEntries: Array.from({ length: 25_001 }, (_, entry) => ({
        path: `overrides/entry-${entry}.txt`,
      })),
    });
    const tooManyHosts = await callMinecraftSkillsTool("validate_modrinth_pack", {
      index,
      additionalDownloadHosts: Array.from(
        { length: 65 },
        (_, host) => `downloads-${host}.example.org`,
      ),
    });

    expect(tooManyEntries.isError).toBe(true);
    expect(tooManyEntries.content[0]?.text).toContain("must not exceed 25000 entries");
    expect(tooManyHosts.isError).toBe(true);
    expect(tooManyHosts.content[0]?.text).toContain("must not exceed 64 entries");
  });

  it("calls list_modrinth_project_versions", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [{ id: "version-id", version_number: "1.0.0" }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMinecraftSkillsTool("list_modrinth_project_versions", {
      project: "sodium",
      gameVersions: ["1.21.11"],
      loaders: ["fabric"],
      featured: true,
    });
    expect(result.content[0]?.text).toContain("version-id");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain("/v2/project/sodium/version");
    expect(url).toContain("game_versions=%5B%221.21.11%22%5D");
    expect(url).toContain("loaders=%5B%22fabric%22%5D");
    expect(url).toContain("include_changelog=false");
    expect(new Headers(init?.headers).get("User-Agent")).toContain("minecraft-skills");
  });

  it("calls resolve_modrinth_compatibility", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      const projectId = url.includes("sodium") ? "sodium-id" : "iris-id";
      return new Response(
        JSON.stringify(
          url.includes("/check")
            ? { id: projectId }
            : [
                {
                  id: projectId === "sodium-id" ? "sodium-version" : "iris-version",
                  project_id: projectId,
                  version_number: "1.0.0",
                  version_type: "release",
                  featured: false,
                  date_published: "2026-01-01T00:00:00Z",
                  game_versions: ["1.21.11"],
                  loaders: ["fabric"],
                },
              ],
        ),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMinecraftSkillsTool("resolve_modrinth_compatibility", {
      projects: ["sodium", "iris"],
      gameVersion: "1.21.11",
      loader: "fabric",
      limit: 1,
    });

    expect(result.content[0]?.text).toContain('"outcome": "compatible"');
    expect(result.content[0]?.text).toContain('"sodium-version"');
    expect(result.content[0]?.text).toContain('"iris-version"');
    expect(result.content[0]?.text).toContain('"commonPairs"');
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const invalid = await callMinecraftSkillsTool("resolve_modrinth_compatibility", {
      projects: ["sodium", "iris"],
      limit: "1",
    });
    expect(invalid.isError).toBe(true);
    expect(invalid.content[0]?.text).toContain("limit must be a number");
  });

  it("rejects oversized compatibility project arrays before reading their elements", async () => {
    const projects = new Array<string>(11);
    Object.defineProperty(projects, 0, {
      get() {
        throw new Error("project element should not be read");
      },
    });

    const result = await callMinecraftSkillsTool("resolve_modrinth_compatibility", { projects });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("between 2 and 10 projects");
  });

  it("calls get_modrinth_resource", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ projects: 123 }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMinecraftSkillsTool("get_modrinth_resource", {
      resource: "statistics",
    });
    expect(result.content[0]?.text).toContain('"projects": 123');
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.modrinth.com/v2/statistics");
  });

  it("analyzes bounded Minecraft logs while redacting retained sensitive values", async () => {
    const result = await callMinecraftSkillsTool("analyze_minecraft_log", {
      text: [
        "[12:00:00] [Server thread/ERROR]: java.lang.RuntimeException: password=hunter2 peer=203.0.113.8",
        "\tSuppressed: java.io.IOException: close failed",
        "\tCaused by: java.lang.IllegalStateException: suppressed root",
        "Caused by: java.lang.IllegalArgumentException: primary root",
        "\tat example-plugin.jar//example.Plugin.run(Plugin.java:1)",
      ].join("\n"),
      limits: {
        maxEvents: 1,
        maxExceptionDepth: 8,
        maxStackFrames: 8,
      },
    });
    const output = result.content[0]?.text ?? "";

    expect(result.isError).not.toBe(true);
    expect(output).toContain('"format": "minecraft-log"');
    expect(output).toContain('"branch": "suppressed"');
    expect(output).toContain('"message": "primary root"');
    expect(output).toContain('"maxExceptionDepth": 8');
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("[IP_REDACTED]");
    expect(output).not.toContain("hunter2");
    expect(output).not.toContain("203.0.113.8");
  });

  it("enforces Minecraft log MCP input and nested limit boundaries", async () => {
    const byteLimited = await callMinecraftSkillsTool("analyze_minecraft_log", {
      text: "éé",
      limits: { maxInputBytes: 3 },
    });
    const tooLong = await callMinecraftSkillsTool("analyze_minecraft_log", {
      text: "x".repeat(defaultMinecraftLogAnalysisLimits.maxCharacters + 1),
    });
    const raised = await callMinecraftSkillsTool("analyze_minecraft_log", {
      text: "log",
      limits: { maxEvents: defaultMinecraftLogAnalysisLimits.maxEvents + 1 },
    });
    const raisedBytes = await callMinecraftSkillsTool("analyze_minecraft_log", {
      text: "log",
      limits: { maxInputBytes: defaultMinecraftLogAnalysisLimits.maxInputBytes + 1 },
    });
    const unknownLimit = await callMinecraftSkillsTool("analyze_minecraft_log", {
      text: "log",
      limits: { unbounded: true },
    });
    const unknownArgument = await callMinecraftSkillsTool("analyze_minecraft_log", {
      text: "log",
      raw: true,
    });
    const nonObjectLimits = await callMinecraftSkillsTool("analyze_minecraft_log", {
      text: "log",
      limits: [],
    });

    expect(byteLimited.isError).not.toBe(true);
    expect(byteLimited.content[0]?.text).toContain('"processedBytes": 2');
    expect(byteLimited.content[0]?.text).toContain('"maxInputBytes"');
    expect(tooLong.isError).toBe(true);
    expect(tooLong.content[0]?.text).toContain("must be at most");
    expect(raised.isError).toBe(true);
    expect(raised.content[0]?.text).toContain("must be an integer from 1");
    expect(raisedBytes.isError).toBe(true);
    expect(unknownLimit.isError).toBe(true);
    expect(unknownLimit.content[0]?.text).toContain("unknown argument");
    expect(unknownArgument.isError).toBe(true);
    expect(unknownArgument.content[0]?.text).toContain("unknown argument");
    expect(nonObjectLimits.isError).toBe(true);
    expect(nonObjectLimits.content[0]?.text).toContain("limits must be an object");
  });
});
