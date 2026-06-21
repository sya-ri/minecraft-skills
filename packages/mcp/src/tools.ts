import {
  getSourcePolicy,
  getVersionDetail,
  listDomains,
  listReferences,
  listVersions,
  resolveVersion,
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

export function callMinecraftSkillsTool(name: string, input: unknown): ToolResult {
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
    if (name === "list_references") {
      const domain = typeof args.domain === "string" ? args.domain : undefined;
      return text(listReferences(domain));
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
