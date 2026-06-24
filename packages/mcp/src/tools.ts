import {
  type CatalogSearchKind,
  type CommandComparisonOptions,
  type CommandSearchOptions,
  classifyPackFiles,
  cleanCachedData,
  compareCommands,
  compareDatapackSchema,
  comparePaperApi,
  comparePaperApiSurface,
  compareVanillaPaths,
  compareVersions,
  type DatapackSchemaComparisonOptions,
  type DatapackSchemaSearchOptions,
  explainPackPath,
  fetchData,
  fetchMinecraftAssetFile,
  fetchMinecraftAssetsArchive,
  fetchMinecraftAssetsIndex,
  findDatapackEntries,
  findResourcepackAssets,
  findVersionsByPackFormat,
  getAuthoringChecklist,
  getAuthoringContext,
  getAuthoringDiagnostic,
  getAuthoringGuardrail,
  getAuthoringPlan,
  getAuthoringPreflight,
  getAuthoringRecipe,
  getAuthoringScenario,
  getCacheDataRoot,
  getCacheRoot,
  getClaimPolicy,
  getCommunityDataset,
  getCoverageSummary,
  getDataManifest,
  getDatapackSchemaSurface,
  getEvidenceBundle,
  getFactSurface,
  getIntentLookup,
  getJavaReportsSummary,
  getMinecraftAssetsStatus,
  getMojangVersionMetadata,
  getOutputRequirement,
  getPackFileSchema,
  getPackFormat,
  getPackMigrationPlan,
  getPaperApiIndex,
  getPaperApiReference,
  getPaperApiSurface,
  getPaperPluginData,
  getResourcepackModelSummary,
  getResponsePattern,
  getSkillPayload,
  getSourcePolicy,
  getSourceReport,
  getSourceTier,
  getSupportMatrix,
  getVanillaInventory,
  getVersionDetail,
  listAuthoringChecklists,
  listAuthoringDiagnostics,
  listAuthoringGuardrails,
  listAuthoringRecipes,
  listAuthoringScenarios,
  listCachedDataFiles,
  listClaimPolicies,
  listCommunityDatasets,
  listDomains,
  listFactSurfaces,
  listIntentLookups,
  listOutputRequirements,
  listPackFormats,
  listReferences,
  listResponsePatterns,
  listSkills,
  listSourceTiers,
  listVersionSupport,
  listVersions,
  type PaperMemberSearchOptions,
  type PaperTypeSearchOptions,
  type ResourcepackModelPathSearchOptions,
  readCachedMinecraftAssetText,
  resolveVersion,
  searchAll,
  searchAuthoringScenarios,
  searchCatalog,
  searchCommands,
  searchDatapackSchema,
  searchMinecraftAssets,
  searchPaperEvents,
  searchPaperMembers,
  searchPaperTypes,
  searchResourcepackModelPaths,
  searchVanillaPaths,
  suggestMinecraftLookups,
  type VanillaPathComparisonOptions,
  type VanillaPathSearchOptions,
  validatePackFilesContent,
} from "@minecraft-skills/catalog";
import {
  createRconConfig,
  getRconConfigStatus,
  isRconConfigured,
  runRconCommand,
} from "@minecraft-skills/rcon";

export type ToolContent = {
  type: "text";
  text: string;
};

export type ToolResult = {
  content: ToolContent[];
  isError?: boolean;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
};

export const tools: ToolDefinition[] = [
  {
    name: "list_domains",
    description: "List Minecraft authoring domains supported by minecraft-skills.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_skills",
    description: "List installable Minecraft Agent Skill folders bundled by minecraft-skills.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_skill",
    description:
      "Get a packaged Minecraft Agent Skill payload, including SKILL.md, agent metadata, and references.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "list_authoring_checklists",
    description: "List pre-generation Minecraft authoring checklists for supported domains.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_authoring_checklist",
    description: "Get the pre-generation authoring checklist for one Minecraft authoring domain.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      required: ["domain"],
      additionalProperties: false,
    },
  },
  {
    name: "list_authoring_recipes",
    description:
      "List task recipes that order exact Minecraft authoring lookups for common datapack, resourcepack, and Paper plugin work.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_authoring_recipe",
    description: "Get one Minecraft authoring task recipe by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "search_authoring_scenarios",
    description:
      "Search authoring scenarios by task wording using scenario, recipe, and intent text. Results include matched fields only; they are routing hints, not generated facts.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
        limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_authoring_scenarios",
    description:
      "List realistic Minecraft authoring scenarios and the required lookups for evaluating AI output.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_authoring_scenario",
    description: "Get one Minecraft authoring scenario by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_authoring_plan",
    description:
      "Get one authoring scenario with required recipes, intents, diagnostics, claim policies, fact surfaces, and response patterns resolved.",
    inputSchema: {
      type: "object",
      properties: {
        scenario: { type: "string" },
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string" },
      },
      required: ["scenario"],
      additionalProperties: false,
    },
  },
  {
    name: "search_catalog",
    description:
      "Search lightweight minecraft-skills catalog entries before listing everything. Use this to find relevant skills, references, fact surfaces, recipes, scenarios, guardrails, diagnostics, claim policies, output requirements, response patterns, intent lookups, source tiers, community datasets, and version-support entries.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
        kind: {
          type: "string",
          enum: [
            "skill",
            "reference",
            "fact-surface",
            "authoring-checklist",
            "authoring-recipe",
            "authoring-scenario",
            "authoring-guardrail",
            "authoring-diagnostic",
            "claim-policy",
            "output-requirement",
            "response-pattern",
            "intent-lookup",
            "source-tier",
            "community-dataset",
            "version-support",
          ],
        },
        limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_rcon_config_status",
    description:
      "Inspect Minecraft RCON configuration resolution without exposing secrets. This tool is available even when RCON execution is not configured.",
    inputSchema: {
      type: "object",
      properties: {
        configPath: { type: "string" },
        profile: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_rcon_config",
    description:
      "Create an example Minecraft RCON config file. Existing files are not overwritten unless force is true; the result includes a warning when a file already exists.",
    inputSchema: {
      type: "object",
      properties: {
        configPath: { type: "string" },
        profile: { type: "string" },
        host: { type: "string" },
        port: { type: ["number", "string"] },
        passwordEnv: { type: "string" },
        preset: { type: "string", enum: ["readonly", "guarded", "full"], default: "readonly" },
        force: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_authoring_guardrails",
    description:
      "List output guardrails that prevent unsupported Minecraft authoring claims and generation steps.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_authoring_guardrail",
    description: "Get one Minecraft authoring output guardrail by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_authoring_diagnostics",
    description:
      "List pre-finalization diagnostics for generated Minecraft datapack, resourcepack, and Paper plugin files, code, and answers.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_authoring_diagnostic",
    description: "Get one Minecraft authoring diagnostic by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_authoring_context",
    description:
      "Get preflight, task recipes, diagnostics, intent lookup routing, and evidence bundle in one source-backed context before generating Minecraft files or code.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
      },
      required: ["domain"],
      additionalProperties: false,
    },
  },
  {
    name: "list_claim_policies",
    description:
      "List required evidence, allowed wording, and disallowed wording for Minecraft authoring claim types.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_claim_policy",
    description: "Get one Minecraft authoring claim policy by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_output_requirements",
    description:
      "List final-output requirements that keep Minecraft authoring responses explicit about versions, evidence, gaps, and non-guarantees.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_output_requirement",
    description: "Get one Minecraft authoring final-output requirement by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_response_patterns",
    description:
      "List response patterns for source-backed Minecraft authoring answers, including verified facts, gaps, and non-guarantees.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_response_pattern",
    description: "Get one Minecraft authoring response pattern by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_authoring_preflight",
    description:
      "Get resolved version, checklist, fact surfaces, coverage, relevant downloadable data, and warnings before generating Minecraft files or code.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
      },
      required: ["domain"],
      additionalProperties: false,
    },
  },
  {
    name: "get_evidence_bundle",
    description:
      "Get source policy, primary sources, version sources, relevant data files, links, and warnings for a Minecraft authoring domain/version.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
      },
      required: ["domain"],
      additionalProperties: false,
    },
  },
  {
    name: "get_source_report",
    description:
      "Get source tiers, prohibited automation, community structured datasets, and optional domain/version provenance. Use this before deciding whether an external source is allowed.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_source_tiers",
    description:
      "List allowed source tiers and limits, including official, derived, community structured, human-reviewed, and human-only background tiers.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_source_tier",
    description: "Get one source tier by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_community_datasets",
    description:
      "List recommended structured community datasets such as PrismarineJS/minecraft-data, PrismarineJS/minecraft-assets, and misode/mcmeta.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_community_dataset",
    description: "Get one recommended structured community dataset by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_intent_lookups",
    description:
      "List intent-to-lookup routing entries that tell an AI which exact minecraft-skills surfaces to inspect for a user request.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_intent_lookup",
    description: "Get one intent-to-lookup routing entry by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_fact_surfaces",
    description:
      "List machine-verifiable minecraft-skills fact surfaces, including guarantees and non-guarantees.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_fact_surface",
    description: "Get one minecraft-skills fact surface by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_coverage_summary",
    description:
      "Get bundled data coverage counts for Java versions, datapacks, resourcepacks, Paper plugins, and packaged skills.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_data_manifest",
    description: "Get the downloadable minecraft-skills data manifest and current data version.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_support_matrix",
    description:
      "Get version aliases and bundled/downloadable data support matrix for choosing the right Minecraft data target.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_version_support",
    description:
      "List per-version Minecraft domain coverage, pack formats, Paper support, and generated surface availability.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_cache_status",
    description: "Get minecraft-skills cache directory and cached data files.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "fetch_data",
    description:
      "Download manifest data entries into the local minecraft-skills cache by kind, version, or path.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string" },
        version: { type: "string" },
        path: { type: "string" },
        baseUrl: { type: "string" },
        force: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "clean_cache",
    description: "Remove cached files for the current minecraft-skills data version.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "latest_version",
    description: "Resolve the latest bundled Minecraft version for an edition.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_versions",
    description: "List bundled Minecraft versions for an edition.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_mojang_version_metadata",
    description:
      "Get Mojang/Piston official Java version metadata URLs, jar downloads, SHA-1s, pack formats, protocol/world versions, and provenance for a bundled Minecraft version.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_version",
    description: "Get canonical metadata for a bundled Minecraft version.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_pack_formats",
    description:
      "List data pack and resource pack format numbers by bundled Minecraft version, with Paper plugin support status.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_pack_format",
    description:
      "Get the data pack or resource pack format for one bundled Minecraft version, including minor format when available.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        domain: { type: "string", enum: ["datapack", "resourcepack"], default: "datapack" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "find_versions_by_pack_format",
    description:
      "Find bundled Minecraft versions that use a data pack or resource pack format, optionally matching a minor format.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        domain: { type: "string", enum: ["datapack", "resourcepack"] },
        format: { type: "integer", minimum: 0 },
        minor: { type: "integer", minimum: 0 },
      },
      required: ["domain", "format"],
      additionalProperties: false,
    },
  },
  {
    name: "compare_versions",
    description:
      "Compare bundled Minecraft version metadata, pack formats, Paper status, and vanilla inventory summaries.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "get_server_reports",
    description:
      "Get compact official Minecraft server reports summary for a bundled Java version.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_datapack_schema_surface",
    description:
      "Get observed vanilla datapack JSON field shapes extracted from official server jar data for a bundled Java version.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_datapack_schema",
    description:
      "Search observed vanilla datapack JSON field paths by kind, exact path, or text. This is observed vanilla data, not a normative schema.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        kind: { type: "string" },
        path: { type: "string" },
        contains: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "compare_datapack_schema",
    description:
      "Compare observed vanilla datapack JSON field paths between bundled Java versions.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        from: { type: "string" },
        to: { type: "string" },
        kind: { type: "string" },
        contains: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "classify_pack_files",
    description:
      "Classify datapack or resourcepack file paths into known Minecraft file kinds and report whether observed schema data is available.",
    inputSchema: {
      type: "object",
      properties: {
        paths: { type: "array", items: { type: "string" } },
        domain: { type: "string", enum: ["datapack", "resourcepack"] },
      },
      required: ["paths"],
      additionalProperties: false,
    },
  },
  {
    name: "get_pack_file_schema",
    description:
      "Get an observed JSON Schema-style shape for one datapack or resourcepack file path when schema-backed data is available. Results are non-normative.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        path: { type: "string" },
        domain: { type: "string", enum: ["datapack", "resourcepack"] },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "validate_pack_files",
    description:
      "Validate datapack or resourcepack file contents against the version-aware non-normative pack file schemas exposed by minecraft-skills.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        domain: { type: "string", enum: ["datapack", "resourcepack"] },
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: {},
            },
            required: ["path", "content"],
            additionalProperties: false,
          },
        },
      },
      required: ["domain", "files"],
      additionalProperties: false,
    },
  },
  {
    name: "get_pack_migration_plan",
    description:
      "Build a datapack or resourcepack version migration plan from from/to versions and optional pack file paths. Includes pack format changes, file classification, observed schema lookups, path changes, and considerations.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        domain: { type: "string", enum: ["datapack", "resourcepack"] },
        from: { type: "string" },
        to: { type: "string" },
        paths: { type: "array", items: { type: "string" } },
        limit: { type: "number", default: 50 },
      },
      required: ["domain", "from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "search_all",
    description:
      "Search across Minecraft catalog guidance, datapack command/schema/path indexes, resourcepack path/model/asset indexes, and Paper API indexes.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        query: { type: "string" },
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
        limit: { type: "number", default: 20 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "find_datapack_entries",
    description: "Search datapack commands, observed schema paths, and vanilla datapack paths.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        query: { type: "string" },
        limit: { type: "number", default: 25 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "find_resourcepack_assets",
    description:
      "Search resourcepack vanilla paths, model/item summaries, and cached external asset indexes together.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        query: { type: "string" },
        kind: {
          type: "string",
          enum: [
            "model",
            "item-definition",
            "texture",
            "sound",
            "language",
            "blockstate",
            "atlas",
            "font",
            "any",
          ],
          default: "any",
        },
        limit: { type: "number", default: 25 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "explain_pack_path",
    description:
      "Classify one datapack/resourcepack path, return its best schema, notes, and next lookup commands.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        path: { type: "string" },
        domain: { type: "string", enum: ["datapack", "resourcepack"] },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "suggest_minecraft_lookups",
    description:
      "Suggest the next minecraft-skills tools to call for a natural-language Minecraft task.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        task: { type: "string" },
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
        limit: { type: "number", default: 8 },
      },
      required: ["task"],
      additionalProperties: false,
    },
  },
  {
    name: "search_commands",
    description:
      "Search executable Minecraft command syntax paths generated from official server reports.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        contains: { type: "string" },
        prefix: { type: "string" },
        parser: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "compare_commands",
    description:
      "Compare executable Minecraft command syntax paths generated from official server reports between bundled versions.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        from: { type: "string" },
        to: { type: "string" },
        contains: { type: "string" },
        prefix: { type: "string" },
        parser: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "get_resourcepack_model_summary",
    description:
      "Get compact vanilla resource pack model and item definition JSON shape summary for a bundled Java version.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_resourcepack_models",
    description:
      "Search vanilla resource pack model and item definition JSON paths for a bundled Java version.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        kind: { type: "string", enum: ["model", "item-definition"] },
        contains: { type: "string" },
        prefix: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_resourcepack_assets_status",
    description:
      "Inspect the local cache state for InventivetalentDev/minecraft-assets resource pack assets for a Minecraft version.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        ref: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "fetch_resourcepack_assets",
    description:
      "Cache a Minecraft version's InventivetalentDev/minecraft-assets path index and optionally its archive.zip.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        ref: { type: "string" },
        indexOnly: { type: "boolean", default: false },
        force: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_resourcepack_assets",
    description:
      "Search a cached InventivetalentDev/minecraft-assets path index for vanilla resource pack asset paths.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        ref: { type: "string" },
        prefix: { type: "string" },
        contains: { type: "string" },
        suffix: { type: "string" },
        extension: { type: "string" },
        limit: { type: "number", default: 50 },
        fetch: { type: "boolean", default: false },
        force: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_resourcepack_asset",
    description:
      "Fetch one InventivetalentDev/minecraft-assets resource pack file into cache and return metadata plus text content for text-like files.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string" },
        ref: { type: "string" },
        path: { type: "string" },
        force: { type: "boolean", default: false },
        includeContent: { type: "boolean", default: true },
      },
      required: ["version", "path"],
      additionalProperties: false,
    },
  },
  {
    name: "get_vanilla_inventory",
    description:
      "Get compact inventory of vanilla client assets and server data bundled for a Minecraft version.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_vanilla_paths",
    description:
      "Search bundled vanilla asset/data paths for a Minecraft version without returning the full inventory.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        domain: { type: "string", enum: ["datapack", "resourcepack"], default: "datapack" },
        prefix: { type: "string" },
        contains: { type: "string" },
        extension: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "compare_vanilla_paths",
    description:
      "Compare bundled vanilla asset/data paths between Minecraft versions without returning full inventories.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        from: { type: "string" },
        to: { type: "string" },
        domain: { type: "string", enum: ["datapack", "resourcepack"], default: "datapack" },
        prefix: { type: "string" },
        contains: { type: "string" },
        extension: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "list_references",
    description: "List generated skill references, optionally filtered by domain.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_paper_plugin_data",
    description:
      "Get Paper plugin support metadata, latest Paper build information, and the spigot-event-list event search API contract.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_paper_api_reference",
    description:
      "Get Paper API Maven dependency, versioned Javadocs URL, Paper docs links, and event search defaults for a Minecraft version.",
    inputSchema: {
      type: "object",
      properties: {
        version: { type: "string", default: "latest" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_paper_api_index",
    description:
      "Get Paper Javadocs package index for a supported Minecraft version without copying Javadocs prose.",
    inputSchema: {
      type: "object",
      properties: {
        version: { type: "string", default: "latest" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "compare_paper_api",
    description: "Compare Paper Javadocs package indexes between two supported Minecraft versions.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "get_paper_api_surface",
    description:
      "Get Paper Javadocs type and member search-index surface for a supported Minecraft version without copying Javadocs prose.",
    inputSchema: {
      type: "object",
      properties: {
        version: { type: "string", default: "latest" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_paper_types",
    description: "Search Paper Javadocs type names by package or text for a supported version.",
    inputSchema: {
      type: "object",
      properties: {
        version: { type: "string", default: "latest" },
        packageName: { type: "string" },
        contains: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_paper_members",
    description:
      "Search Paper Javadocs member labels by type, package, kind, or text for a supported version.",
    inputSchema: {
      type: "object",
      properties: {
        version: { type: "string", default: "latest" },
        type: { type: "string" },
        packageName: { type: "string" },
        kind: {
          type: "string",
          enum: ["constructor", "method", "field-or-enum-constant", "unknown"],
        },
        contains: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "compare_paper_api_surface",
    description: "Compare Paper Javadocs type and member search-index surfaces between versions.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "search_paper_events",
    description: "Search Paper/Bukkit events through the configured sya-ri/spigot-event-list API.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        version: { type: "string", default: "latest" },
        source: { type: "string" },
        limit: { type: "number", default: 20 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_source_policy",
    description:
      "Get source priority and license policy for redistributable Minecraft Skills data.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

const runRconCommandTool: ToolDefinition = {
  name: "run_rcon_command",
  description:
    "Run one Minecraft RCON command if the selected profile is configured and its regex permissions allow the command. Do not retry with broader profiles after a permission rejection.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string" },
      configPath: { type: "string" },
      profile: { type: "string" },
      timeoutMs: { type: "number", default: 2000 },
    },
    required: ["command"],
    additionalProperties: false,
  },
};

export function listMinecraftSkillsTools(): ToolDefinition[] {
  return isRconConfigured() ? [...tools, runRconCommandTool] : tools;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function text(value: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function packFormatDomainArg(value: unknown): "datapack" | "resourcepack" {
  if (value === "datapack" || value === "resourcepack") {
    return value;
  }
  throw new Error("pack format domain must be datapack or resourcepack");
}

function integerArg(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function authoringDomainArg(
  value: unknown,
): "datapack" | "resourcepack" | "paper-plugin" | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "datapack" || value === "resourcepack" || value === "paper-plugin") {
    return value;
  }
  throw new Error("domain must be datapack, resourcepack, or paper-plugin");
}

function optionalPackDomainArg(value: unknown): "datapack" | "resourcepack" | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "datapack" || value === "resourcepack") {
    return value;
  }
  throw new Error("domain must be datapack or resourcepack");
}

function resourcepackAssetKindArg(
  value: unknown,
):
  | "model"
  | "item-definition"
  | "texture"
  | "sound"
  | "language"
  | "blockstate"
  | "atlas"
  | "font"
  | "any"
  | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    value === "model" ||
    value === "item-definition" ||
    value === "texture" ||
    value === "sound" ||
    value === "language" ||
    value === "blockstate" ||
    value === "atlas" ||
    value === "font" ||
    value === "any"
  ) {
    return value;
  }
  throw new Error(
    "kind must be model, item-definition, texture, sound, language, blockstate, atlas, font, or any",
  );
}

function isTextLikeAsset(path: string): boolean {
  return /\.(json|mcmeta|txt|lang|properties|fsh|vsh|glsl)$/i.test(path);
}

export async function callMinecraftSkillsTool(name: string, input: unknown): Promise<ToolResult> {
  const args = asRecord(input);
  const edition = typeof args.edition === "string" ? args.edition : "java";

  try {
    if (name === "list_domains") {
      return text(listDomains());
    }
    if (name === "list_skills") {
      const domain = typeof args.domain === "string" ? args.domain : undefined;
      return text(listSkills(domain));
    }
    if (name === "get_skill") {
      if (typeof args.name !== "string") {
        throw new Error("get_skill requires string name");
      }
      return text(getSkillPayload(args.name));
    }
    if (name === "list_authoring_checklists") {
      return text(
        listAuthoringChecklists({
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
        }),
      );
    }
    if (name === "get_authoring_checklist") {
      if (typeof args.domain !== "string") {
        throw new Error("get_authoring_checklist requires string domain");
      }
      return text(getAuthoringChecklist(args.domain));
    }
    if (name === "list_authoring_recipes") {
      return text(
        listAuthoringRecipes({
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
        }),
      );
    }
    if (name === "get_authoring_recipe") {
      if (typeof args.id !== "string") {
        throw new Error("get_authoring_recipe requires string id");
      }
      return text(getAuthoringRecipe(args.id));
    }
    if (name === "search_authoring_scenarios") {
      if (typeof args.query !== "string") {
        throw new Error("search_authoring_scenarios requires string query");
      }
      return text(
        searchAuthoringScenarios({
          query: args.query,
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
        }),
      );
    }
    if (name === "list_authoring_scenarios") {
      return text(
        listAuthoringScenarios({
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
        }),
      );
    }
    if (name === "get_authoring_scenario") {
      if (typeof args.id !== "string") {
        throw new Error("get_authoring_scenario requires string id");
      }
      return text(getAuthoringScenario(args.id));
    }
    if (name === "get_authoring_plan") {
      if (typeof args.scenario !== "string") {
        throw new Error("get_authoring_plan requires string scenario");
      }
      return text(
        getAuthoringPlan({
          scenario: args.scenario,
          edition,
          ...(typeof args.version === "string" ? { version: args.version } : {}),
        }),
      );
    }
    if (name === "search_catalog") {
      if (typeof args.query !== "string") {
        throw new Error("search_catalog requires string query");
      }
      return text(
        searchCatalog({
          query: args.query,
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
          ...(typeof args.kind === "string" ? { kind: args.kind as CatalogSearchKind } : {}),
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
        }),
      );
    }
    if (name === "get_rcon_config_status") {
      return text(
        getRconConfigStatus({
          ...(typeof args.configPath === "string" ? { configPath: args.configPath } : {}),
          ...(typeof args.profile === "string" ? { profile: args.profile } : {}),
        }),
      );
    }
    if (name === "create_rcon_config") {
      const preset =
        args.preset === "readonly" || args.preset === "guarded" || args.preset === "full"
          ? args.preset
          : undefined;
      return text(
        createRconConfig({
          ...(typeof args.configPath === "string" ? { configPath: args.configPath } : {}),
          ...(typeof args.profile === "string" ? { profile: args.profile } : {}),
          ...(typeof args.host === "string" ? { host: args.host } : {}),
          ...(typeof args.port === "number" || typeof args.port === "string"
            ? { port: args.port }
            : {}),
          ...(typeof args.passwordEnv === "string" ? { passwordEnv: args.passwordEnv } : {}),
          ...(preset ? { preset } : {}),
          force: args.force === true,
        }),
      );
    }
    if (name === "run_rcon_command") {
      if (typeof args.command !== "string") {
        throw new Error("run_rcon_command requires string command");
      }
      return text(
        await runRconCommand({
          command: args.command,
          ...(typeof args.configPath === "string" ? { configPath: args.configPath } : {}),
          ...(typeof args.profile === "string" ? { profile: args.profile } : {}),
          ...(typeof args.timeoutMs === "number" ? { timeoutMs: args.timeoutMs } : {}),
        }),
      );
    }
    if (name === "list_authoring_guardrails") {
      return text(
        listAuthoringGuardrails({
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
        }),
      );
    }
    if (name === "get_authoring_guardrail") {
      if (typeof args.id !== "string") {
        throw new Error("get_authoring_guardrail requires string id");
      }
      return text(getAuthoringGuardrail(args.id));
    }
    if (name === "list_authoring_diagnostics") {
      return text(
        listAuthoringDiagnostics({
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
        }),
      );
    }
    if (name === "get_authoring_diagnostic") {
      if (typeof args.id !== "string") {
        throw new Error("get_authoring_diagnostic requires string id");
      }
      return text(getAuthoringDiagnostic(args.id));
    }
    if (name === "get_authoring_context") {
      if (typeof args.domain !== "string") {
        throw new Error("get_authoring_context requires string domain");
      }
      return text(
        getAuthoringContext({
          domain: args.domain,
          edition,
          ...(typeof args.version === "string" ? { version: args.version } : {}),
        }),
      );
    }
    if (name === "list_claim_policies") {
      return text(
        listClaimPolicies({
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
        }),
      );
    }
    if (name === "get_claim_policy") {
      if (typeof args.id !== "string") {
        throw new Error("get_claim_policy requires string id");
      }
      return text(getClaimPolicy(args.id));
    }
    if (name === "list_output_requirements") {
      return text(
        listOutputRequirements({
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
        }),
      );
    }
    if (name === "get_output_requirement") {
      if (typeof args.id !== "string") {
        throw new Error("get_output_requirement requires string id");
      }
      return text(getOutputRequirement(args.id));
    }
    if (name === "list_response_patterns") {
      return text(
        listResponsePatterns({
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
        }),
      );
    }
    if (name === "get_response_pattern") {
      if (typeof args.id !== "string") {
        throw new Error("get_response_pattern requires string id");
      }
      return text(getResponsePattern(args.id));
    }
    if (name === "get_authoring_preflight") {
      if (typeof args.domain !== "string") {
        throw new Error("get_authoring_preflight requires string domain");
      }
      return text(
        getAuthoringPreflight({
          domain: args.domain,
          edition,
          ...(typeof args.version === "string" ? { version: args.version } : {}),
        }),
      );
    }
    if (name === "get_evidence_bundle") {
      if (typeof args.domain !== "string") {
        throw new Error("get_evidence_bundle requires string domain");
      }
      return text(
        getEvidenceBundle({
          domain: args.domain,
          edition,
          ...(typeof args.version === "string" ? { version: args.version } : {}),
        }),
      );
    }
    if (name === "get_source_report") {
      return text(
        getSourceReport({
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
          edition,
          ...(typeof args.version === "string" ? { version: args.version } : {}),
        }),
      );
    }
    if (name === "list_source_tiers") {
      return text(listSourceTiers());
    }
    if (name === "get_source_tier") {
      if (typeof args.id !== "string") {
        throw new Error("get_source_tier requires string id");
      }
      return text(getSourceTier(args.id));
    }
    if (name === "list_community_datasets") {
      return text(listCommunityDatasets());
    }
    if (name === "get_community_dataset") {
      if (typeof args.id !== "string") {
        throw new Error("get_community_dataset requires string id");
      }
      return text(getCommunityDataset(args.id));
    }
    if (name === "list_intent_lookups") {
      return text(
        listIntentLookups({
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
        }),
      );
    }
    if (name === "get_intent_lookup") {
      if (typeof args.id !== "string") {
        throw new Error("get_intent_lookup requires string id");
      }
      return text(getIntentLookup(args.id));
    }
    if (name === "list_fact_surfaces") {
      return text(
        listFactSurfaces({
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
        }),
      );
    }
    if (name === "get_fact_surface") {
      if (typeof args.id !== "string") {
        throw new Error("get_fact_surface requires string id");
      }
      return text(getFactSurface(args.id));
    }
    if (name === "get_coverage_summary") {
      return text(getCoverageSummary());
    }
    if (name === "get_data_manifest") {
      return text(getDataManifest());
    }
    if (name === "get_support_matrix") {
      return text(getSupportMatrix());
    }
    if (name === "list_version_support") {
      return text(
        listVersionSupport({
          edition,
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
        }),
      );
    }
    if (name === "get_cache_status") {
      return text({
        cacheRoot: getCacheRoot(),
        dataRoot: getCacheDataRoot(),
        files: listCachedDataFiles(),
      });
    }
    if (name === "fetch_data") {
      return text(
        await fetchData({
          ...(typeof args.kind === "string" ? { kind: args.kind } : {}),
          ...(typeof args.version === "string" ? { version: args.version } : {}),
          ...(typeof args.path === "string" ? { path: args.path } : {}),
          ...(typeof args.baseUrl === "string" ? { baseUrl: args.baseUrl } : {}),
          force: args.force === true,
        }),
      );
    }
    if (name === "clean_cache") {
      return text(cleanCachedData());
    }
    if (name === "latest_version") {
      return text(resolveVersion(edition, "latest"));
    }
    if (name === "list_versions") {
      return text(listVersions(edition));
    }
    if (name === "get_mojang_version_metadata") {
      const version = typeof args.version === "string" ? args.version : "latest";
      return text(getMojangVersionMetadata(edition, version));
    }
    if (name === "get_version") {
      const version = typeof args.version === "string" ? args.version : "latest";
      return text(getVersionDetail(edition, version));
    }
    if (name === "list_pack_formats") {
      return text(listPackFormats(edition));
    }
    if (name === "get_pack_format") {
      const version = typeof args.version === "string" ? args.version : "latest";
      const domain = packFormatDomainArg(args.domain ?? "datapack");
      return text(getPackFormat(edition, version, domain));
    }
    if (name === "find_versions_by_pack_format") {
      return text(
        findVersionsByPackFormat({
          edition,
          domain: packFormatDomainArg(args.domain),
          format: integerArg(args.format, "format"),
          ...(args.minor === undefined ? {} : { minor: integerArg(args.minor, "minor") }),
        }),
      );
    }
    if (name === "compare_versions") {
      if (typeof args.from !== "string" || typeof args.to !== "string") {
        throw new Error("compare_versions requires string from and to");
      }
      return text(compareVersions(edition, args.from, args.to));
    }
    if (name === "get_server_reports") {
      const version = typeof args.version === "string" ? args.version : "latest";
      return text(getJavaReportsSummary(edition, version));
    }
    if (name === "get_datapack_schema_surface") {
      const version = typeof args.version === "string" ? args.version : "latest";
      return text(getDatapackSchemaSurface(edition, version));
    }
    if (name === "search_datapack_schema") {
      const schemaOptions: DatapackSchemaSearchOptions = {
        edition,
        version: typeof args.version === "string" ? args.version : "latest",
      };
      if (typeof args.kind === "string") {
        schemaOptions.kind = args.kind;
      }
      if (typeof args.path === "string") {
        schemaOptions.path = args.path;
      }
      if (typeof args.contains === "string") {
        schemaOptions.contains = args.contains;
      }
      if (typeof args.limit === "number") {
        schemaOptions.limit = args.limit;
      }
      return text(searchDatapackSchema(schemaOptions));
    }
    if (name === "compare_datapack_schema") {
      if (typeof args.from !== "string" || typeof args.to !== "string") {
        throw new Error("compare_datapack_schema requires string from and to");
      }
      const schemaOptions: DatapackSchemaComparisonOptions = {
        edition,
        from: args.from,
        to: args.to,
      };
      if (typeof args.kind === "string") {
        schemaOptions.kind = args.kind;
      }
      if (typeof args.contains === "string") {
        schemaOptions.contains = args.contains;
      }
      if (typeof args.limit === "number") {
        schemaOptions.limit = args.limit;
      }
      return text(compareDatapackSchema(schemaOptions));
    }
    if (name === "classify_pack_files") {
      if (!Array.isArray(args.paths) || !args.paths.every((path) => typeof path === "string")) {
        throw new Error("classify_pack_files requires string[] paths");
      }
      const domain =
        args.domain === "datapack" || args.domain === "resourcepack" ? args.domain : undefined;
      return text(
        classifyPackFiles({
          paths: args.paths,
          ...(domain ? { domain } : {}),
        }),
      );
    }
    if (name === "get_pack_file_schema") {
      if (typeof args.path !== "string") {
        throw new Error("get_pack_file_schema requires string path");
      }
      const domain =
        args.domain === "datapack" || args.domain === "resourcepack" ? args.domain : undefined;
      return text(
        getPackFileSchema({
          edition,
          version: typeof args.version === "string" ? args.version : "latest",
          path: args.path,
          ...(domain ? { domain } : {}),
        }),
      );
    }
    if (name === "validate_pack_files") {
      if (args.domain !== "datapack" && args.domain !== "resourcepack") {
        throw new Error("validate_pack_files requires domain datapack or resourcepack");
      }
      if (!Array.isArray(args.files)) {
        throw new Error("validate_pack_files requires files array");
      }
      const files = args.files.map((file) => {
        if (
          typeof file !== "object" ||
          file === null ||
          !("path" in file) ||
          typeof file.path !== "string" ||
          !("content" in file)
        ) {
          throw new Error("validate_pack_files files must include string path and content");
        }
        return {
          path: file.path,
          content: file.content as string | unknown,
        };
      });
      return text(
        validatePackFilesContent({
          edition,
          version: typeof args.version === "string" ? args.version : "latest",
          domain: args.domain,
          files,
        }),
      );
    }
    if (name === "get_pack_migration_plan") {
      if (args.domain !== "datapack" && args.domain !== "resourcepack") {
        throw new Error("get_pack_migration_plan requires domain datapack or resourcepack");
      }
      if (typeof args.from !== "string" || typeof args.to !== "string") {
        throw new Error("get_pack_migration_plan requires string from and to");
      }
      if (args.paths !== undefined) {
        if (!Array.isArray(args.paths) || !args.paths.every((path) => typeof path === "string")) {
          throw new Error("get_pack_migration_plan paths must be string[]");
        }
      }
      return text(
        getPackMigrationPlan({
          edition,
          domain: args.domain,
          from: args.from,
          to: args.to,
          ...(Array.isArray(args.paths) ? { paths: args.paths } : {}),
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
        }),
      );
    }
    if (name === "search_all") {
      if (typeof args.query !== "string") {
        throw new Error("search_all requires string query");
      }
      const domain = authoringDomainArg(args.domain);
      return text(
        searchAll({
          edition,
          version: typeof args.version === "string" ? args.version : "latest",
          query: args.query,
          ...(domain ? { domain } : {}),
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
        }),
      );
    }
    if (name === "find_datapack_entries") {
      if (typeof args.query !== "string") {
        throw new Error("find_datapack_entries requires string query");
      }
      return text(
        findDatapackEntries({
          edition,
          version: typeof args.version === "string" ? args.version : "latest",
          query: args.query,
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
        }),
      );
    }
    if (name === "find_resourcepack_assets") {
      if (typeof args.query !== "string") {
        throw new Error("find_resourcepack_assets requires string query");
      }
      const kind = resourcepackAssetKindArg(args.kind);
      return text(
        findResourcepackAssets({
          edition,
          version: typeof args.version === "string" ? args.version : "latest",
          query: args.query,
          ...(kind ? { kind } : {}),
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
        }),
      );
    }
    if (name === "explain_pack_path") {
      if (typeof args.path !== "string") {
        throw new Error("explain_pack_path requires string path");
      }
      const domain = optionalPackDomainArg(args.domain);
      return text(
        explainPackPath({
          edition,
          version: typeof args.version === "string" ? args.version : "latest",
          path: args.path,
          ...(domain ? { domain } : {}),
        }),
      );
    }
    if (name === "suggest_minecraft_lookups") {
      if (typeof args.task !== "string") {
        throw new Error("suggest_minecraft_lookups requires string task");
      }
      const domain = authoringDomainArg(args.domain);
      return text(
        suggestMinecraftLookups({
          edition,
          version: typeof args.version === "string" ? args.version : "latest",
          task: args.task,
          ...(domain ? { domain } : {}),
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
        }),
      );
    }
    if (name === "search_commands") {
      const commandOptions: CommandSearchOptions = {
        edition,
        version: typeof args.version === "string" ? args.version : "latest",
      };
      if (typeof args.contains === "string") {
        commandOptions.contains = args.contains;
      }
      if (typeof args.prefix === "string") {
        commandOptions.prefix = args.prefix;
      }
      if (typeof args.parser === "string") {
        commandOptions.parser = args.parser;
      }
      if (typeof args.limit === "number") {
        commandOptions.limit = args.limit;
      }
      return text(searchCommands(commandOptions));
    }
    if (name === "compare_commands") {
      if (typeof args.from !== "string" || typeof args.to !== "string") {
        throw new Error("compare_commands requires string from and to");
      }
      const commandOptions: CommandComparisonOptions = {
        edition,
        from: args.from,
        to: args.to,
      };
      if (typeof args.contains === "string") {
        commandOptions.contains = args.contains;
      }
      if (typeof args.prefix === "string") {
        commandOptions.prefix = args.prefix;
      }
      if (typeof args.parser === "string") {
        commandOptions.parser = args.parser;
      }
      if (typeof args.limit === "number") {
        commandOptions.limit = args.limit;
      }
      return text(compareCommands(commandOptions));
    }
    if (name === "get_resourcepack_model_summary") {
      const version = typeof args.version === "string" ? args.version : "latest";
      return text(getResourcepackModelSummary(edition, version));
    }
    if (name === "search_resourcepack_models") {
      const searchOptions: ResourcepackModelPathSearchOptions = {
        edition,
        version: typeof args.version === "string" ? args.version : "latest",
      };
      if (args.kind === "model" || args.kind === "item-definition") {
        searchOptions.kind = args.kind;
      }
      if (typeof args.contains === "string") {
        searchOptions.contains = args.contains;
      }
      if (typeof args.prefix === "string") {
        searchOptions.prefix = args.prefix;
      }
      if (typeof args.limit === "number") {
        searchOptions.limit = args.limit;
      }
      return text(searchResourcepackModelPaths(searchOptions));
    }
    if (name === "get_resourcepack_assets_status") {
      const requested = typeof args.version === "string" ? args.version : "latest";
      const version = resolveVersion(edition, requested);
      return text(
        getMinecraftAssetsStatus(version, typeof args.ref === "string" ? args.ref : version),
      );
    }
    if (name === "fetch_resourcepack_assets") {
      const requested = typeof args.version === "string" ? args.version : "latest";
      const version = resolveVersion(edition, requested);
      const ref = typeof args.ref === "string" ? args.ref : version;
      return text(
        args.indexOnly === true
          ? await fetchMinecraftAssetsIndex({
              version,
              ref,
              force: args.force === true,
            })
          : await fetchMinecraftAssetsArchive({
              version,
              ref,
              force: args.force === true,
            }),
      );
    }
    if (name === "search_resourcepack_assets") {
      const requested = typeof args.version === "string" ? args.version : "latest";
      const version = resolveVersion(edition, requested);
      const ref = typeof args.ref === "string" ? args.ref : version;
      if (args.fetch === true) {
        await fetchMinecraftAssetsIndex({
          version,
          ref,
          force: args.force === true,
        });
      }
      return text(
        searchMinecraftAssets({
          version,
          ref,
          ...(typeof args.prefix === "string" ? { prefix: args.prefix } : {}),
          ...(typeof args.contains === "string" ? { contains: args.contains } : {}),
          ...(typeof args.suffix === "string" ? { suffix: args.suffix } : {}),
          ...(typeof args.extension === "string" ? { extension: args.extension } : {}),
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
        }),
      );
    }
    if (name === "get_resourcepack_asset") {
      if (typeof args.version !== "string" || typeof args.path !== "string") {
        throw new Error("get_resourcepack_asset requires string version and path");
      }
      const version = resolveVersion(edition, args.version);
      const result = await fetchMinecraftAssetFile({
        version,
        path: args.path,
        ref: typeof args.ref === "string" ? args.ref : version,
        force: args.force === true,
      });
      const includeContent = args.includeContent !== false && isTextLikeAsset(args.path);
      return text({
        ...result,
        ...(includeContent
          ? { content: readCachedMinecraftAssetText(version, args.path).slice(0, 200_000) }
          : {}),
      });
    }
    if (name === "get_vanilla_inventory") {
      const version = typeof args.version === "string" ? args.version : "latest";
      return text(getVanillaInventory(edition, version));
    }
    if (name === "search_vanilla_paths") {
      const pathOptions: VanillaPathSearchOptions = {
        edition,
        version: typeof args.version === "string" ? args.version : "latest",
        domain:
          args.domain === "resourcepack" || args.domain === "datapack" ? args.domain : "datapack",
      };
      if (typeof args.prefix === "string") {
        pathOptions.prefix = args.prefix;
      }
      if (typeof args.contains === "string") {
        pathOptions.contains = args.contains;
      }
      if (typeof args.extension === "string") {
        pathOptions.extension = args.extension;
      }
      if (typeof args.limit === "number") {
        pathOptions.limit = args.limit;
      }
      return text(searchVanillaPaths(pathOptions));
    }
    if (name === "compare_vanilla_paths") {
      if (typeof args.from !== "string" || typeof args.to !== "string") {
        throw new Error("compare_vanilla_paths requires string from and to");
      }
      const pathOptions: VanillaPathComparisonOptions = {
        edition,
        from: args.from,
        to: args.to,
        domain:
          args.domain === "resourcepack" || args.domain === "datapack" ? args.domain : "datapack",
      };
      if (typeof args.prefix === "string") {
        pathOptions.prefix = args.prefix;
      }
      if (typeof args.contains === "string") {
        pathOptions.contains = args.contains;
      }
      if (typeof args.extension === "string") {
        pathOptions.extension = args.extension;
      }
      if (typeof args.limit === "number") {
        pathOptions.limit = args.limit;
      }
      return text(compareVanillaPaths(pathOptions));
    }
    if (name === "list_references") {
      const domain = typeof args.domain === "string" ? args.domain : undefined;
      return text(listReferences(domain));
    }
    if (name === "get_paper_plugin_data") {
      return text(getPaperPluginData());
    }
    if (name === "get_paper_api_reference") {
      const version = typeof args.version === "string" ? args.version : "latest";
      return text(getPaperApiReference(version));
    }
    if (name === "get_paper_api_index") {
      const version = typeof args.version === "string" ? args.version : "latest";
      return text(getPaperApiIndex(version));
    }
    if (name === "compare_paper_api") {
      if (typeof args.from !== "string" || typeof args.to !== "string") {
        throw new Error("compare_paper_api requires string from and to");
      }
      return text(comparePaperApi(args.from, args.to));
    }
    if (name === "get_paper_api_surface") {
      const version = typeof args.version === "string" ? args.version : "latest";
      return text(getPaperApiSurface(version));
    }
    if (name === "search_paper_types") {
      const searchOptions: PaperTypeSearchOptions = {
        version: typeof args.version === "string" ? args.version : "latest",
      };
      if (typeof args.packageName === "string") {
        searchOptions.packageName = args.packageName;
      }
      if (typeof args.contains === "string") {
        searchOptions.contains = args.contains;
      }
      if (typeof args.limit === "number") {
        searchOptions.limit = args.limit;
      }
      return text(searchPaperTypes(searchOptions));
    }
    if (name === "search_paper_members") {
      const searchOptions: PaperMemberSearchOptions = {
        version: typeof args.version === "string" ? args.version : "latest",
      };
      if (typeof args.type === "string") {
        searchOptions.type = args.type;
      }
      if (typeof args.packageName === "string") {
        searchOptions.packageName = args.packageName;
      }
      if (
        args.kind === "constructor" ||
        args.kind === "method" ||
        args.kind === "field-or-enum-constant" ||
        args.kind === "unknown"
      ) {
        searchOptions.kind = args.kind;
      }
      if (typeof args.contains === "string") {
        searchOptions.contains = args.contains;
      }
      if (typeof args.limit === "number") {
        searchOptions.limit = args.limit;
      }
      return text(searchPaperMembers(searchOptions));
    }
    if (name === "compare_paper_api_surface") {
      if (typeof args.from !== "string" || typeof args.to !== "string") {
        throw new Error("compare_paper_api_surface requires string from and to");
      }
      return text(comparePaperApiSurface(args.from, args.to));
    }
    if (name === "search_paper_events") {
      if (typeof args.query !== "string") {
        throw new Error("search_paper_events requires string query");
      }
      const searchOptions = {
        query: args.query,
        version: typeof args.version === "string" ? args.version : "latest",
      };
      const withLimit =
        typeof args.limit === "number" ? { ...searchOptions, limit: args.limit } : searchOptions;
      const source = typeof args.source === "string" ? args.source : undefined;
      return text(await searchPaperEvents(source ? { ...withLimit, source } : withLimit));
    }
    if (name === "get_source_policy") {
      return text(getSourcePolicy());
    }
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      isError: true,
    };
  }
}
