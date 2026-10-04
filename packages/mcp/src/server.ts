#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import type { JsonSchemaType } from "@modelcontextprotocol/sdk/validation/types.js";
import { createEvaluationIntegration, minecraftSkillsMcpVersion } from "./evaluation.js";
import { getMinecraftSkillsPrompt, prompts } from "./prompts.js";
import { listMinecraftSkillsResources, readMinecraftSkillsResource } from "./resources.js";
import { callMinecraftSkillsTool, listMinecraftSkillsTools } from "./tools.js";

function isDirectRun(metaUrl: string): boolean {
  return process.argv[1]
    ? realpathSync(fileURLToPath(metaUrl)) === realpathSync(process.argv[1])
    : false;
}

function createToolInputValidator(
  tools: Array<{
    name: string;
    inputSchema: { type: "object"; properties?: Record<string, unknown> | undefined };
  }>,
) {
  const provider = new AjvJsonSchemaValidator();
  const validators = new Map(
    tools.map((tool) => [
      tool.name,
      {
        validate: provider.getValidator(tool.inputSchema as JsonSchemaType),
        allowed: Object.keys(tool.inputSchema.properties ?? {}).join(", ") || "(none)",
      },
    ]),
  );
  return (name: string, input: unknown): CallToolResult | undefined => {
    const validator = validators.get(name);
    if (validator === undefined) {
      return undefined;
    }
    const result = validator.validate(input === undefined ? {} : input);
    if (result.valid) {
      return undefined;
    }
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Invalid arguments for ${name}: ${result.errorMessage.slice(0, 1_000)}. Allowed arguments: ${validator.allowed}.`,
        },
      ],
    };
  };
}

export function createServer(): Server {
  const evaluation = createEvaluationIntegration();
  const tools = [...listMinecraftSkillsTools(), ...evaluation.tools];
  const validateInput = createToolInputValidator(tools);
  const managementToolNames = new Set(evaluation.tools.map((tool) => tool.name));
  const baseInstructions =
    "Use minecraft-skills tools and resources for version-aware Minecraft datapack, resourcepack, and Paper plugin facts. Treat unknown or not-extracted fields as gaps, not facts.";
  const server = new Server(
    {
      name: "minecraft-skills",
      version: minecraftSkillsMcpVersion,
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
      },
      instructions:
        evaluation.instructions === undefined
          ? baseInstructions
          : `${baseInstructions}\n\n${evaluation.instructions}`,
    },
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listMinecraftSkillsResources(),
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
    readMinecraftSkillsResource(request.params.uri),
  );
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts }));
  server.setRequestHandler(GetPromptRequestSchema, async (request) =>
    getMinecraftSkillsPrompt(request.params.name, request.params.arguments),
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const error = validateInput(request.params.name, request.params.arguments);
    if (error !== undefined && managementToolNames.has(request.params.name)) {
      return error;
    }
    return evaluation.callTool(
      server,
      request.params.name,
      request.params.arguments,
      extra,
      async (name, input) => error ?? callMinecraftSkillsTool(name, input),
    );
  });

  return server;
}

export async function runServer(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}

if (isDirectRun(import.meta.url)) {
  runServer().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
