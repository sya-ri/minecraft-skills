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
  compareRegistryEntries,
  compareVanillaPaths,
  compareVersions,
  type DatapackSchemaComparisonOptions,
  type DatapackSchemaSearchOptions,
  defaultModrinthPackValidationLimits,
  defaultResourcepackProjectValidationLimits,
  explainPackPath,
  fetchData,
  fetchMinecraftAssetFile,
  fetchMinecraftAssetsArchive,
  fetchMinecraftAssetsIndex,
  fetchMojangServerJarForVersion,
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
  getFabricToolchainCompatibility,
  getFactSurface,
  getIntentLookup,
  getJavaReportsSummary,
  getMinecraftAssetsStatus,
  getModrinthResource,
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
  getVanillaDatapackJson,
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
  listModrinthProjectVersions,
  listOutputRequirements,
  listPackFormats,
  listReferences,
  listResponsePatterns,
  listSkills,
  listSourceTiers,
  listVersionSupport,
  listVersions,
  type ModrinthPackValidationLimits,
  type ModrinthResourceKind,
  modrinthCompatibilityLimits,
  type PaperMemberSearchOptions,
  type PaperTypeSearchOptions,
  type RegistryEntryComparisonOptions,
  type RegistryEntrySearchOptions,
  type ResourcepackModelPathSearchOptions,
  readCachedMinecraftAssetText,
  resolveModrinthCompatibility,
  resolveVersion,
  searchAll,
  searchAuthoringScenarios,
  searchCatalog,
  searchCommands,
  searchDatapackSchema,
  searchMinecraftAssets,
  searchModrinthProjects,
  searchPaperEvents,
  searchPaperMembers,
  searchPaperTypes,
  searchRegistryEntries,
  searchResourcepackModelPaths,
  searchVanillaDatapackJsonContent,
  searchVanillaDatapackJsonFiles,
  searchVanillaPaths,
  suggestMinecraftLookups,
  type VanillaPathComparisonOptions,
  type VanillaPathSearchOptions,
  validateModrinthPack,
  validatePackFilesContent,
  validateResourcepackProject,
  vorbisIdentificationPageBytes,
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

const semanticSearchGuidance =
  "For intent-based discovery, use concise English canonical Minecraft terms; translate non-English user intent before calling. Use the English terms only for the lookup, and keep the user's requested response language. Keep exact identifiers, namespace IDs, file paths, project titles, and content literals unchanged.";

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
    description: `Search authoring scenarios by task wording using scenario, recipe, and intent text. Results include matched fields only; they are routing hints, not generated facts. ${semanticSearchGuidance}`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: semanticSearchGuidance },
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
    description: `Search lightweight minecraft-skills catalog entries before listing everything. Use this to find relevant skills, references, fact surfaces, recipes, scenarios, guardrails, diagnostics, claim policies, output requirements, response patterns, intent lookups, source tiers, community datasets, and version-support entries. ${semanticSearchGuidance}`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: semanticSearchGuidance },
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
    name: "search_community_datasets",
    description: `Search recommended structured community datasets for corroborating Minecraft facts, including misode/mcmeta and PrismarineJS/minecraft-data. ${semanticSearchGuidance}`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: semanticSearchGuidance },
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
        limit: { type: "number", default: 10 },
      },
      required: ["query"],
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
    name: "fetch_mojang_server_jar",
    description:
      "Cache the official Mojang/Piston server jar for a bundled Java version so vanilla datapack JSON files can be read exactly.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        force: { type: "boolean", default: false },
      },
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
    name: "search_registry_entries",
    description:
      "Search version-specific registry entry IDs and optional protocol IDs generated from official Minecraft server reports.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        registry: { type: "string" },
        exact: { type: "string" },
        contains: { type: "string" },
        prefix: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "compare_registry_entries",
    description:
      "Compare added and removed registry entry IDs plus reported protocol ID changes only where both official version indexes cover the registry; excluded registries include per-version coverage status.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        from: { type: "string" },
        to: { type: "string" },
        registry: { type: "string" },
        exact: { type: "string" },
        contains: { type: "string" },
        prefix: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      required: ["from", "to"],
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
    name: "validate_datapack_json",
    description:
      "Validate one or more datapack JSON files for a target Java version. This is a discoverable datapack JSON validator alias for validate_pack_files using domain=datapack.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
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
      required: ["files"],
      additionalProperties: false,
    },
  },
  {
    name: "validate_resourcepack_project",
    description:
      "Validate model, texture, and sounds.json reference graphs plus bounded Ogg/Vorbis identification headers across a resource-pack project for a target Java version. For OGG files, pass contentBase64 containing at most the first 58 bytes; PNG content may be omitted.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        files: {
          type: "array",
          maxItems: defaultResourcepackProjectValidationLimits.maxFiles,
          items: {
            type: "object",
            properties: {
              path: {
                type: "string",
                maxLength: defaultResourcepackProjectValidationLimits.maxPathLength,
              },
              content: {
                oneOf: [
                  {
                    type: "string",
                    maxLength: defaultResourcepackProjectValidationLimits.maxTextContentCharacters,
                  },
                  { type: "object" },
                ],
                description:
                  "JSON text or object content. OGG files must use contentBase64 instead.",
              },
              contentBase64: {
                type: "string",
                minLength: 1,
                maxLength: Math.ceil(vorbisIdentificationPageBytes / 3) * 4,
                description: `Canonical base64 for at most the first ${vorbisIdentificationPageBytes} bytes of an OGG file. Do not send the full audio file.`,
              },
            },
            required: ["path"],
            additionalProperties: false,
            not: {
              allOf: [
                {
                  properties: { path: { pattern: "\\.[oO][gG][gG]$" } },
                  required: ["path"],
                },
                { required: ["content"] },
              ],
            },
          },
        },
        limit: { type: "integer", minimum: 1, maximum: 1_000, default: 100 },
      },
      required: ["files"],
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
    description: `Search across Minecraft catalog guidance, datapack command/schema/path indexes, resourcepack path/model/asset indexes, and Paper API indexes. ${semanticSearchGuidance}`,
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        query: { type: "string", description: semanticSearchGuidance },
        domain: { type: "string", enum: ["datapack", "resourcepack", "paper-plugin"] },
        limit: { type: "number", default: 20 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "validate_modrinth_pack",
    description:
      "Validate Modrinth modrinth.index.json data and optional .mrpack archive-entry metadata offline, including paths, hashes, URLs, environments, overrides, and index/archive consistency. Pass metadata only; binary archives are not accepted.",
    inputSchema: {
      type: "object",
      properties: {
        index: {},
        archiveEntries: {
          type: "array",
          maxItems: 25000,
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              size: { type: "integer", minimum: 0 },
              compressedSize: { type: "integer", minimum: 0 },
              directory: { type: "boolean" },
              compressionMethod: { type: "integer", enum: [0, 8] },
              flags: { type: "integer", minimum: 0, maximum: 65535 },
              crc32: { type: "integer", minimum: 0, maximum: 4294967295 },
              unixMode: { type: "integer", minimum: 0, maximum: 65535 },
            },
            required: ["path"],
            additionalProperties: false,
          },
        },
        additionalDownloadHosts: {
          type: "array",
          maxItems: 64,
          items: { type: "string" },
          description:
            "Exact additional HTTPS host names to allow. Each use produces a non-official-host warning.",
        },
        limits: {
          type: "object",
          properties: {
            maxArchiveBytes: { type: "integer", minimum: 1, maximum: 536870912 },
            maxArchiveEntries: { type: "integer", minimum: 1, maximum: 25000 },
            maxIndexBytes: { type: "integer", minimum: 1, maximum: 16777216 },
            maxEntryUncompressedBytes: { type: "integer", minimum: 1, maximum: 536870912 },
            maxTotalUncompressedBytes: { type: "integer", minimum: 1, maximum: 4294967296 },
            maxCompressionRatio: { type: "number", minimum: 1, maximum: 200 },
            maxDiagnostics: { type: "integer", minimum: 1, maximum: 200 },
          },
          additionalProperties: false,
        },
      },
      required: ["index"],
      additionalProperties: false,
    },
  },
  {
    name: "get_fabric_toolchain",
    description:
      "Look up bounded Fabric Loader, Intermediary, and Yarn candidate tuples for a Minecraft game version from the official live Fabric Meta v2 API. Stable flags are selection metadata, not a full compatibility guarantee.",
    inputSchema: {
      type: "object",
      properties: {
        gameVersion: { type: "string", minLength: 1, maxLength: 128 },
        limit: { type: "number", minimum: 1, maximum: 50, default: 10 },
        timeoutMs: { type: "number", minimum: 100, maximum: 30000, default: 5000 },
      },
      required: ["gameVersion"],
      additionalProperties: false,
    },
  },
  {
    name: "search_modrinth_projects",
    description: `Search public Modrinth projects by text with optional Minecraft version, project type, loader, category, sorting, and pagination filters. ${semanticSearchGuidance}`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: semanticSearchGuidance },
        version: { type: "string" },
        projectType: { type: "string" },
        loader: { type: "string" },
        category: { type: "string" },
        index: {
          type: "string",
          enum: ["relevance", "downloads", "follows", "newest", "updated"],
          default: "relevance",
        },
        offset: { type: "number", default: 0 },
        limit: { type: "number", default: 10 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_modrinth_project_versions",
    description:
      "List versions published for a Modrinth project ID or slug, optionally filtered by Minecraft versions, loaders, or featured status.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string" },
        gameVersions: { type: "array", items: { type: "string" } },
        loaders: { type: "array", items: { type: "string" } },
        featured: { type: "boolean" },
        includeChangelog: { type: "boolean", default: false },
      },
      required: ["project"],
      additionalProperties: false,
    },
  },
  {
    name: "resolve_modrinth_compatibility",
    description:
      "Resolve bounded common Minecraft-version/loader metadata pairs and pair-specific latest published concrete versions for 2-10 public Modrinth projects. This reports Modrinth version metadata, not runtime interoperability.",
    inputSchema: {
      type: "object",
      properties: {
        projects: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 96 },
          minItems: 2,
          maxItems: 10,
        },
        gameVersion: { type: "string", minLength: 1, maxLength: 64 },
        loader: { type: "string", minLength: 1, maxLength: 64 },
        featured: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 3 },
        timeoutMs: { type: "integer", minimum: 1, maximum: 30000, default: 10000 },
      },
      required: ["projects"],
      additionalProperties: false,
    },
  },
  {
    name: "get_modrinth_resource",
    description:
      "Get a public Modrinth project, dependency graph, version, version by file hash, user, tag list, or instance statistics.",
    inputSchema: {
      type: "object",
      properties: {
        resource: {
          type: "string",
          enum: [
            "project",
            "project-dependencies",
            "version",
            "version-file",
            "user",
            "categories",
            "loaders",
            "game-versions",
            "project-types",
            "side-types",
            "donation-platforms",
            "report-types",
            "statistics",
          ],
        },
        identifier: { type: "string" },
        algorithm: { type: "string", enum: ["sha1", "sha512"] },
      },
      required: ["resource"],
      additionalProperties: false,
    },
  },
  {
    name: "find_datapack_entries",
    description: `Search datapack commands, observed schema paths, and vanilla datapack paths. ${semanticSearchGuidance}`,
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        query: { type: "string", description: semanticSearchGuidance },
        limit: { type: "number", default: 25 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "find_resourcepack_assets",
    description: `Search resourcepack vanilla paths, model/item summaries, and cached external asset indexes together. ${semanticSearchGuidance}`,
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        query: { type: "string", description: semanticSearchGuidance },
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
    description: `Suggest the next minecraft-skills tools to call for a natural-language Minecraft task. ${semanticSearchGuidance}`,
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", default: "latest" },
        task: { type: "string", description: semanticSearchGuidance },
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
    name: "search_vanilla_datapack_json_files",
    description:
      "Search exact vanilla data/**/*.json files inside a cached official Mojang server jar by kind, prefix, or substring. Fetch the jar first with fetch_mojang_server_jar.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", minLength: 1, maxLength: 128, default: "latest" },
        kind: { type: "string", maxLength: 128 },
        prefix: { type: "string", maxLength: 4096 },
        contains: { type: "string", maxLength: 256 },
        limit: { type: "number", minimum: 1, maximum: 200, default: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_vanilla_datapack_json_content",
    description:
      "Search parsed keys and primitive values across exact vanilla data/**/*.json files in one cached official Mojang server jar read. Fetch the jar first with fetch_mojang_server_jar.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", minLength: 1, maxLength: 128, default: "latest" },
        query: { type: "string", minLength: 1, maxLength: 256 },
        kind: { type: "string", maxLength: 128 },
        prefix: { type: "string", maxLength: 4096 },
        scope: { type: "string", enum: ["keys", "values", "all"], default: "all" },
        caseSensitive: { type: "boolean", default: false },
        limit: { type: "number", minimum: 1, maximum: 100, default: 25 },
        matchesPerFile: { type: "number", minimum: 1, maximum: 10, default: 3 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_vanilla_datapack_json",
    description:
      "Read one exact vanilla datapack JSON file from a cached official Mojang server jar. Returns either parsed JSON or raw text, never both, with a bounded serialized response.",
    inputSchema: {
      type: "object",
      properties: {
        edition: { type: "string", enum: ["java"], default: "java" },
        version: { type: "string", minLength: 1, maxLength: 128, default: "latest" },
        path: { type: "string", minLength: 1, maxLength: 4096 },
        output: {
          type: "string",
          enum: ["parsed", "text"],
          default: "parsed",
          description: "Select parsed JSON or exact raw text output.",
        },
      },
      required: ["path"],
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
    description: `Search Paper/Bukkit events through the configured sya-ri/spigot-event-list API. ${semanticSearchGuidance}`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: semanticSearchGuidance },
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

const vanillaDatapackJsonOutputMaxBytes = 200_000;

function serializedText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function serializedToolResult(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: serializedText(value) }],
  };
}

function hasOwnArg(args: Record<string, unknown>, name: string): boolean {
  return Object.hasOwn(args, name);
}

function assertToolArgs(
  input: unknown,
  args: Record<string, unknown>,
  tool: string,
  allowed: readonly string[],
): void {
  if (input !== undefined && (!input || typeof input !== "object" || Array.isArray(input))) {
    throw new Error(`${tool} input must be an object`);
  }
  const allowedArgs = new Set(allowed);
  if (Object.keys(args).some((name) => !allowedArgs.has(name))) {
    throw new Error(`${tool} received an unknown argument`);
  }
}

function optionalStringArg(
  args: Record<string, unknown>,
  tool: string,
  name: string,
  options: { maxLength?: number; minLength?: number } = {},
): string | undefined {
  if (!hasOwnArg(args, name)) {
    return undefined;
  }
  const value = args[name];
  if (typeof value !== "string") {
    throw new Error(`${tool} ${name} must be a string`);
  }
  if (options.minLength !== undefined && value.length < options.minLength) {
    throw new Error(`${tool} ${name} must not be empty`);
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new Error(`${tool} ${name} must be at most ${options.maxLength} characters`);
  }
  return value;
}

function requiredStringArg(
  args: Record<string, unknown>,
  tool: string,
  name: string,
  options: { maxLength?: number; minLength?: number } = {},
): string {
  const value = optionalStringArg(args, tool, name, options);
  if (value === undefined) {
    throw new Error(`${tool} requires string ${name}`);
  }
  return value;
}

function optionalBooleanArg(
  args: Record<string, unknown>,
  tool: string,
  name: string,
): boolean | undefined {
  if (!hasOwnArg(args, name)) {
    return undefined;
  }
  const value = args[name];
  if (typeof value !== "boolean") {
    throw new Error(`${tool} ${name} must be a boolean`);
  }
  return value;
}

function optionalIntegerArg(
  args: Record<string, unknown>,
  tool: string,
  name: string,
  minimum: number,
  maximum: number,
): number | undefined {
  if (!hasOwnArg(args, name)) {
    return undefined;
  }
  const value = args[name];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${tool} ${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function vanillaDatapackJsonEditionArg(args: Record<string, unknown>, tool: string): "java" {
  const edition = optionalStringArg(args, tool, "edition") ?? "java";
  if (edition !== "java") {
    throw new Error(`${tool} edition must be java`);
  }
  return edition;
}

function vanillaDatapackJsonOutputMode(args: Record<string, unknown>): "parsed" | "text" {
  const tool = "get_vanilla_datapack_json";
  const output = optionalStringArg(args, tool, "output");
  if (output !== undefined && output !== "parsed" && output !== "text") {
    throw new Error(`${tool} output must be parsed or text`);
  }
  return output ?? "parsed";
}

function boundedVanillaDatapackJsonResult(
  result: ReturnType<typeof getVanillaDatapackJson>,
  mode: "parsed" | "text",
): ToolResult {
  const { content, json, ...metadata } = result;
  const source = mode === "parsed" ? JSON.stringify(json) : content;
  const originalBytes = Buffer.byteLength(source);
  const complete = {
    ...metadata,
    output: {
      mode,
      truncated: false,
      originalBytes,
      maxSerializedBytes: vanillaDatapackJsonOutputMaxBytes,
      ...(mode === "parsed" ? { json } : { content }),
    },
  };
  const completeText = serializedText(complete);
  if (Buffer.byteLength(completeText) <= vanillaDatapackJsonOutputMaxBytes) {
    return serializedToolResult(completeText);
  }

  const truncated = (length: number) => {
    const preview = source.slice(0, length);
    return {
      ...metadata,
      output: {
        mode,
        truncated: true,
        originalBytes,
        returnedBytes: Buffer.byteLength(preview),
        maxSerializedBytes: vanillaDatapackJsonOutputMaxBytes,
        ...(mode === "parsed"
          ? {
              jsonPreview: preview,
              previewFormat: "serialized-json-prefix",
            }
          : { content: preview }),
      },
    };
  };

  let minimum = 0;
  let maximum = source.length;
  while (minimum < maximum) {
    const candidate = Math.ceil((minimum + maximum) / 2);
    if (
      Buffer.byteLength(serializedText(truncated(candidate))) <= vanillaDatapackJsonOutputMaxBytes
    ) {
      minimum = candidate;
    } else {
      maximum = candidate - 1;
    }
  }
  if (minimum > 0) {
    const finalCodeUnit = source.charCodeAt(minimum - 1);
    if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) {
      minimum -= 1;
    }
  }
  const boundedText = serializedText(truncated(minimum));
  if (Buffer.byteLength(boundedText) > vanillaDatapackJsonOutputMaxBytes) {
    throw new Error("get_vanilla_datapack_json response metadata exceeds its output limit");
  }
  return serializedToolResult(boundedText);
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

const maxEncodedSoundHeaderLength = Math.ceil(vorbisIdentificationPageBytes / 3) * 4;

function decodeSoundHeaderBase64(value: unknown, path: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxEncodedSoundHeaderLength ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error(
      `validate_resourcepack_project contentBase64 for '${path}' must be canonical base64 containing at most ${vorbisIdentificationPageBytes} bytes`,
    );
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.byteLength > vorbisIdentificationPageBytes || decoded.toString("base64") !== value) {
    throw new Error(
      `validate_resourcepack_project contentBase64 for '${path}' must be canonical base64 containing at most ${vorbisIdentificationPageBytes} bytes`,
    );
  }
  return decoded;
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
    if (name === "search_community_datasets") {
      if (typeof args.query !== "string") {
        throw new Error("search_community_datasets requires string query");
      }
      return text(
        searchCatalog({
          query: args.query,
          kind: "community-dataset",
          ...(typeof args.domain === "string" ? { domain: args.domain } : {}),
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
        }),
      );
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
    if (name === "fetch_mojang_server_jar") {
      return text(
        await fetchMojangServerJarForVersion({
          edition,
          version: typeof args.version === "string" ? args.version : "latest",
          force: args.force === true,
        }),
      );
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
    if (name === "search_registry_entries") {
      const registryOptions: RegistryEntrySearchOptions = {
        edition,
        version: typeof args.version === "string" ? args.version : "latest",
      };
      if (typeof args.registry === "string") registryOptions.registry = args.registry;
      if (typeof args.exact === "string") registryOptions.exact = args.exact;
      if (typeof args.contains === "string") registryOptions.contains = args.contains;
      if (typeof args.prefix === "string") registryOptions.prefix = args.prefix;
      if (typeof args.limit === "number") registryOptions.limit = args.limit;
      return text(searchRegistryEntries(registryOptions));
    }
    if (name === "compare_registry_entries") {
      if (typeof args.from !== "string" || typeof args.to !== "string") {
        throw new Error("compare_registry_entries requires string from and to");
      }
      const registryOptions: RegistryEntryComparisonOptions = {
        edition,
        from: args.from,
        to: args.to,
      };
      if (typeof args.registry === "string") registryOptions.registry = args.registry;
      if (typeof args.exact === "string") registryOptions.exact = args.exact;
      if (typeof args.contains === "string") registryOptions.contains = args.contains;
      if (typeof args.prefix === "string") registryOptions.prefix = args.prefix;
      if (typeof args.limit === "number") registryOptions.limit = args.limit;
      return text(compareRegistryEntries(registryOptions));
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
    if (name === "validate_datapack_json") {
      if (!Array.isArray(args.files)) {
        throw new Error("validate_datapack_json requires files array");
      }
      const files = args.files.map((file) => {
        if (
          typeof file !== "object" ||
          file === null ||
          !("path" in file) ||
          typeof file.path !== "string" ||
          !("content" in file)
        ) {
          throw new Error("validate_datapack_json files must include string path and content");
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
          domain: "datapack",
          files,
        }),
      );
    }
    if (name === "validate_resourcepack_project") {
      if (!Array.isArray(args.files)) {
        throw new Error("validate_resourcepack_project requires files array");
      }
      if (args.files.length > defaultResourcepackProjectValidationLimits.maxFiles) {
        throw new Error(
          `validate_resourcepack_project accepts at most ${defaultResourcepackProjectValidationLimits.maxFiles} files`,
        );
      }
      const files = args.files.map((file) => {
        if (
          typeof file !== "object" ||
          file === null ||
          !("path" in file) ||
          typeof file.path !== "string"
        ) {
          throw new Error("validate_resourcepack_project files must include string path");
        }
        if (file.path.length > defaultResourcepackProjectValidationLimits.maxPathLength) {
          throw new Error(
            `validate_resourcepack_project file paths must contain at most ${defaultResourcepackProjectValidationLimits.maxPathLength} characters`,
          );
        }
        if ("content" in file && "contentBase64" in file) {
          throw new Error(
            "validate_resourcepack_project files must not include both content and contentBase64",
          );
        }
        if ("contentBase64" in file && !file.path.toLowerCase().endsWith(".ogg")) {
          throw new Error(
            "validate_resourcepack_project contentBase64 is only accepted for OGG files",
          );
        }
        if ("content" in file && file.path.toLowerCase().endsWith(".ogg")) {
          throw new Error(
            "validate_resourcepack_project OGG files must use bounded contentBase64 instead of content",
          );
        }
        return {
          path: file.path,
          ...("content" in file
            ? { content: file.content }
            : "contentBase64" in file
              ? { content: decodeSoundHeaderBase64(file.contentBase64, file.path) }
              : {}),
        };
      });
      return text(
        validateResourcepackProject({
          edition,
          version: typeof args.version === "string" ? args.version : "latest",
          files,
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
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
    if (name === "get_fabric_toolchain") {
      if (typeof args.gameVersion !== "string") {
        throw new Error("get_fabric_toolchain requires string gameVersion");
      }
      return text(
        await getFabricToolchainCompatibility({
          gameVersion: args.gameVersion,
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
          ...(typeof args.timeoutMs === "number" ? { timeoutMs: args.timeoutMs } : {}),
        }),
      );
    }
    if (name === "search_modrinth_projects") {
      if (typeof args.query !== "string") {
        throw new Error("search_modrinth_projects requires string query");
      }
      if (
        args.index !== undefined &&
        args.index !== "relevance" &&
        args.index !== "downloads" &&
        args.index !== "follows" &&
        args.index !== "newest" &&
        args.index !== "updated"
      ) {
        throw new Error(
          "search_modrinth_projects index must be relevance, downloads, follows, newest, or updated",
        );
      }
      const index =
        args.index === "downloads" ||
        args.index === "follows" ||
        args.index === "newest" ||
        args.index === "updated"
          ? args.index
          : "relevance";
      return text(
        await searchModrinthProjects({
          query: args.query,
          index,
          ...(typeof args.version === "string" ? { version: args.version } : {}),
          ...(typeof args.projectType === "string" ? { projectType: args.projectType } : {}),
          ...(typeof args.loader === "string" ? { loader: args.loader } : {}),
          ...(typeof args.category === "string" ? { category: args.category } : {}),
          ...(typeof args.offset === "number" ? { offset: args.offset } : {}),
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
        }),
      );
    }
    if (name === "validate_modrinth_pack") {
      if (!("index" in args)) {
        throw new Error("validate_modrinth_pack requires index JSON data");
      }
      if (args.archiveEntries !== undefined && !Array.isArray(args.archiveEntries)) {
        throw new Error("validate_modrinth_pack archiveEntries must be an array");
      }
      if (
        Array.isArray(args.archiveEntries) &&
        args.archiveEntries.length > defaultModrinthPackValidationLimits.maxArchiveEntries
      ) {
        throw new Error(
          `validate_modrinth_pack archiveEntries must not exceed ${defaultModrinthPackValidationLimits.maxArchiveEntries} entries`,
        );
      }
      const archiveEntries = Array.isArray(args.archiveEntries)
        ? args.archiveEntries.map((entry) => {
            const archiveEntry = asRecord(entry);
            if (typeof archiveEntry.path !== "string") {
              throw new Error("validate_modrinth_pack archive entries require string path");
            }
            if (archiveEntry.size !== undefined && typeof archiveEntry.size !== "number") {
              throw new Error("validate_modrinth_pack archive entry size must be a number");
            }
            if (
              archiveEntry.compressedSize !== undefined &&
              typeof archiveEntry.compressedSize !== "number"
            ) {
              throw new Error(
                "validate_modrinth_pack archive entry compressedSize must be a number",
              );
            }
            if (
              archiveEntry.directory !== undefined &&
              typeof archiveEntry.directory !== "boolean"
            ) {
              throw new Error("validate_modrinth_pack archive entry directory must be a boolean");
            }
            return {
              path: archiveEntry.path,
              ...(typeof archiveEntry.size === "number" ? { size: archiveEntry.size } : {}),
              ...(typeof archiveEntry.compressedSize === "number"
                ? { compressedSize: archiveEntry.compressedSize }
                : {}),
              ...(typeof archiveEntry.directory === "boolean"
                ? { directory: archiveEntry.directory }
                : {}),
              ...(typeof archiveEntry.compressionMethod === "number"
                ? { compressionMethod: archiveEntry.compressionMethod }
                : {}),
              ...(typeof archiveEntry.flags === "number" ? { flags: archiveEntry.flags } : {}),
              ...(typeof archiveEntry.crc32 === "number" ? { crc32: archiveEntry.crc32 } : {}),
              ...(typeof archiveEntry.unixMode === "number"
                ? { unixMode: archiveEntry.unixMode }
                : {}),
            };
          })
        : undefined;
      const numericArchiveEntryFields = [
        "compressionMethod",
        "flags",
        "crc32",
        "unixMode",
      ] as const;
      if (Array.isArray(args.archiveEntries)) {
        for (const entry of args.archiveEntries) {
          const archiveEntry = asRecord(entry);
          for (const field of numericArchiveEntryFields) {
            if (archiveEntry[field] !== undefined && typeof archiveEntry[field] !== "number") {
              throw new Error(`validate_modrinth_pack archive entry ${field} must be a number`);
            }
          }
        }
      }
      if (
        args.additionalDownloadHosts !== undefined &&
        !Array.isArray(args.additionalDownloadHosts)
      ) {
        throw new Error("validate_modrinth_pack additionalDownloadHosts must be a string array");
      }
      if (Array.isArray(args.additionalDownloadHosts) && args.additionalDownloadHosts.length > 64) {
        throw new Error(
          "validate_modrinth_pack additionalDownloadHosts must not exceed 64 entries",
        );
      }
      if (
        Array.isArray(args.additionalDownloadHosts) &&
        !args.additionalDownloadHosts.every((host) => typeof host === "string")
      ) {
        throw new Error("validate_modrinth_pack additionalDownloadHosts must be a string array");
      }
      let limits: Partial<ModrinthPackValidationLimits> | undefined;
      if (args.limits !== undefined) {
        if (!args.limits || typeof args.limits !== "object" || Array.isArray(args.limits)) {
          throw new Error("validate_modrinth_pack limits must be an object");
        }
        const rawLimits = asRecord(args.limits);
        const limitNames = [
          "maxArchiveBytes",
          "maxArchiveEntries",
          "maxIndexBytes",
          "maxEntryUncompressedBytes",
          "maxTotalUncompressedBytes",
          "maxCompressionRatio",
          "maxDiagnostics",
        ] as const;
        limits = {};
        for (const limitName of limitNames) {
          const value = rawLimits[limitName];
          if (value !== undefined) {
            if (typeof value !== "number") {
              throw new Error(`validate_modrinth_pack ${limitName} must be a number`);
            }
            limits[limitName] = value;
          }
        }
      }
      return text(
        validateModrinthPack({
          index: args.index,
          ...(archiveEntries ? { archiveEntries } : {}),
          ...(Array.isArray(args.additionalDownloadHosts)
            ? { additionalDownloadHosts: args.additionalDownloadHosts as string[] }
            : {}),
          ...(limits ? { limits } : {}),
        }),
      );
    }
    if (name === "list_modrinth_project_versions") {
      if (typeof args.project !== "string") {
        throw new Error("list_modrinth_project_versions requires string project");
      }
      if (
        args.gameVersions !== undefined &&
        (!Array.isArray(args.gameVersions) ||
          !args.gameVersions.every((version) => typeof version === "string"))
      ) {
        throw new Error("list_modrinth_project_versions gameVersions must be string[]");
      }
      if (
        args.loaders !== undefined &&
        (!Array.isArray(args.loaders) ||
          !args.loaders.every((loader) => typeof loader === "string"))
      ) {
        throw new Error("list_modrinth_project_versions loaders must be string[]");
      }
      return text(
        await listModrinthProjectVersions({
          project: args.project,
          ...(Array.isArray(args.gameVersions) ? { gameVersions: args.gameVersions } : {}),
          ...(Array.isArray(args.loaders) ? { loaders: args.loaders } : {}),
          ...(typeof args.featured === "boolean" ? { featured: args.featured } : {}),
          ...(typeof args.includeChangelog === "boolean"
            ? { includeChangelog: args.includeChangelog }
            : {}),
        }),
      );
    }
    if (name === "resolve_modrinth_compatibility") {
      if (!Array.isArray(args.projects)) {
        throw new Error("resolve_modrinth_compatibility requires string[] projects");
      }
      if (
        args.projects.length < modrinthCompatibilityLimits.minProjects ||
        args.projects.length > modrinthCompatibilityLimits.maxProjects
      ) {
        throw new Error(
          `resolve_modrinth_compatibility requires between ${modrinthCompatibilityLimits.minProjects} and ${modrinthCompatibilityLimits.maxProjects} projects`,
        );
      }
      if (!args.projects.every((project) => typeof project === "string")) {
        throw new Error("resolve_modrinth_compatibility requires string[] projects");
      }
      if (args.gameVersion !== undefined && typeof args.gameVersion !== "string") {
        throw new Error("resolve_modrinth_compatibility gameVersion must be a string");
      }
      if (args.loader !== undefined && typeof args.loader !== "string") {
        throw new Error("resolve_modrinth_compatibility loader must be a string");
      }
      if (args.featured !== undefined && typeof args.featured !== "boolean") {
        throw new Error("resolve_modrinth_compatibility featured must be boolean");
      }
      if (args.limit !== undefined && typeof args.limit !== "number") {
        throw new Error("resolve_modrinth_compatibility limit must be a number");
      }
      if (args.timeoutMs !== undefined && typeof args.timeoutMs !== "number") {
        throw new Error("resolve_modrinth_compatibility timeoutMs must be a number");
      }
      return text(
        await resolveModrinthCompatibility({
          projects: args.projects,
          ...(typeof args.gameVersion === "string" ? { gameVersion: args.gameVersion } : {}),
          ...(typeof args.loader === "string" ? { loader: args.loader } : {}),
          ...(typeof args.featured === "boolean" ? { featured: args.featured } : {}),
          ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
          ...(typeof args.timeoutMs === "number" ? { timeoutMs: args.timeoutMs } : {}),
        }),
      );
    }
    if (name === "get_modrinth_resource") {
      const resources = new Set<ModrinthResourceKind>([
        "project",
        "project-dependencies",
        "version",
        "version-file",
        "user",
        "categories",
        "loaders",
        "game-versions",
        "project-types",
        "side-types",
        "donation-platforms",
        "report-types",
        "statistics",
      ]);
      if (
        typeof args.resource !== "string" ||
        !resources.has(args.resource as ModrinthResourceKind)
      ) {
        throw new Error("get_modrinth_resource requires a supported resource");
      }
      if (
        args.algorithm !== undefined &&
        args.algorithm !== "sha1" &&
        args.algorithm !== "sha512"
      ) {
        throw new Error("get_modrinth_resource algorithm must be sha1 or sha512");
      }
      return text(
        await getModrinthResource({
          resource: args.resource as ModrinthResourceKind,
          ...(typeof args.identifier === "string" ? { identifier: args.identifier } : {}),
          ...(args.algorithm === "sha1" || args.algorithm === "sha512"
            ? { algorithm: args.algorithm }
            : {}),
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
    if (name === "search_vanilla_datapack_json_files") {
      assertToolArgs(input, args, name, [
        "edition",
        "version",
        "kind",
        "prefix",
        "contains",
        "limit",
      ]);
      const toolEdition = vanillaDatapackJsonEditionArg(args, name);
      const version =
        optionalStringArg(args, name, "version", { minLength: 1, maxLength: 128 }) ?? "latest";
      const kind = optionalStringArg(args, name, "kind", { maxLength: 128 });
      const prefix = optionalStringArg(args, name, "prefix", { maxLength: 4096 });
      const contains = optionalStringArg(args, name, "contains", { maxLength: 256 });
      const limit = optionalIntegerArg(args, name, "limit", 1, 200);
      return text(
        searchVanillaDatapackJsonFiles({
          edition: toolEdition,
          version,
          ...(kind !== undefined ? { kind } : {}),
          ...(prefix !== undefined ? { prefix } : {}),
          ...(contains !== undefined ? { contains } : {}),
          ...(limit !== undefined ? { limit } : {}),
        }),
      );
    }
    if (name === "search_vanilla_datapack_json_content") {
      assertToolArgs(input, args, name, [
        "edition",
        "version",
        "query",
        "kind",
        "prefix",
        "scope",
        "caseSensitive",
        "limit",
        "matchesPerFile",
      ]);
      const toolEdition = vanillaDatapackJsonEditionArg(args, name);
      const version =
        optionalStringArg(args, name, "version", { minLength: 1, maxLength: 128 }) ?? "latest";
      const query = requiredStringArg(args, name, "query", { minLength: 1, maxLength: 256 });
      const kind = optionalStringArg(args, name, "kind", { maxLength: 128 });
      const prefix = optionalStringArg(args, name, "prefix", { maxLength: 4096 });
      const requestedScope = optionalStringArg(args, name, "scope");
      if (
        requestedScope !== undefined &&
        requestedScope !== "keys" &&
        requestedScope !== "values" &&
        requestedScope !== "all"
      ) {
        throw new Error(`${name} scope must be keys, values, or all`);
      }
      const scope = requestedScope ?? "all";
      const caseSensitive = optionalBooleanArg(args, name, "caseSensitive") ?? false;
      const limit = optionalIntegerArg(args, name, "limit", 1, 100);
      const matchesPerFile = optionalIntegerArg(args, name, "matchesPerFile", 1, 10);
      return text(
        searchVanillaDatapackJsonContent({
          edition: toolEdition,
          version,
          query,
          scope,
          caseSensitive,
          ...(kind !== undefined ? { kind } : {}),
          ...(prefix !== undefined ? { prefix } : {}),
          ...(limit !== undefined ? { limit } : {}),
          ...(matchesPerFile !== undefined ? { matchesPerFile } : {}),
        }),
      );
    }
    if (name === "get_vanilla_datapack_json") {
      assertToolArgs(input, args, name, ["edition", "version", "path", "output"]);
      const toolEdition = vanillaDatapackJsonEditionArg(args, name);
      const version =
        optionalStringArg(args, name, "version", { minLength: 1, maxLength: 128 }) ?? "latest";
      const path = requiredStringArg(args, name, "path", { minLength: 1, maxLength: 4096 });
      const outputMode = vanillaDatapackJsonOutputMode(args);
      return boundedVanillaDatapackJsonResult(
        getVanillaDatapackJson({
          edition: toolEdition,
          version,
          path,
          parse: outputMode === "parsed",
        }),
        outputMode,
      );
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
