import {
  type CommandComparisonOptions,
  type CommandSearchOptions,
  cleanCachedData,
  compareCommands,
  compareDatapackSchema,
  comparePaperApi,
  comparePaperApiSurface,
  compareVanillaPaths,
  compareVersions,
  type DatapackSchemaComparisonOptions,
  type DatapackSchemaSearchOptions,
  fetchData,
  getAuthoringChecklist,
  getAuthoringContext,
  getAuthoringDiagnostic,
  getAuthoringGuardrail,
  getAuthoringPreflight,
  getAuthoringRecipe,
  getCacheDataRoot,
  getCacheRoot,
  getClaimPolicy,
  getCoverageSummary,
  getDataManifest,
  getDatapackSchemaSurface,
  getEvidenceBundle,
  getFactSurface,
  getIntentLookup,
  getJavaReportsSummary,
  getOutputRequirement,
  getPaperApiIndex,
  getPaperApiReference,
  getPaperApiSurface,
  getPaperPluginData,
  getResourcepackModelSummary,
  getResponsePattern,
  getSkillPayload,
  getSourcePolicy,
  getSupportMatrix,
  getVanillaInventory,
  getVersionDetail,
  listAuthoringChecklists,
  listAuthoringDiagnostics,
  listAuthoringGuardrails,
  listAuthoringRecipes,
  listCachedDataFiles,
  listClaimPolicies,
  listDomains,
  listFactSurfaces,
  listIntentLookups,
  listOutputRequirements,
  listPackFormats,
  listReferences,
  listResponsePatterns,
  listSkills,
  listVersionSupport,
  listVersions,
  type PaperMemberSearchOptions,
  type PaperTypeSearchOptions,
  type ResourcepackModelPathSearchOptions,
  resolveVersion,
  searchCommands,
  searchDatapackSchema,
  searchPaperEvents,
  searchPaperMembers,
  searchPaperTypes,
  searchResourcepackModelPaths,
  searchVanillaPaths,
  type VanillaPathComparisonOptions,
  type VanillaPathSearchOptions,
} from "@minecraft-skills/catalog";

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
    if (name === "get_version") {
      const version = typeof args.version === "string" ? args.version : "latest";
      return text(getVersionDetail(edition, version));
    }
    if (name === "list_pack_formats") {
      return text(listPackFormats(edition));
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
