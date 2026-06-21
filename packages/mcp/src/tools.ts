import {
  compareVersions,
  getPaperPluginData,
  getSourcePolicy,
  getVanillaInventory,
  getVersionDetail,
  listDomains,
  listPackFormats,
  listReferences,
  listVersions,
  resolveVersion,
  searchPaperEvents,
  searchVanillaPaths,
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
    if (name === "list_references") {
      const domain = typeof args.domain === "string" ? args.domain : undefined;
      return text(listReferences(domain));
    }
    if (name === "get_paper_plugin_data") {
      return text(getPaperPluginData());
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
