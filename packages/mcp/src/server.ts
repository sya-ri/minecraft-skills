#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createEvaluationIntegration, minecraftSkillsMcpVersion } from "./evaluation.js";
import { getMinecraftSkillsPrompt, prompts } from "./prompts.js";
import { listMinecraftSkillsResources, readMinecraftSkillsResource } from "./resources.js";
import { callMinecraftSkillsTool, listMinecraftSkillsTools } from "./tools.js";

function isDirectRun(metaUrl: string): boolean {
  return process.argv[1]
    ? realpathSync(fileURLToPath(metaUrl)) === realpathSync(process.argv[1])
    : false;
}

export function createServer(): Server {
  const evaluation = createEvaluationIntegration();
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
    tools: [...listMinecraftSkillsTools(), ...evaluation.tools],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) =>
    evaluation.callTool(
      server,
      request.params.name,
      request.params.arguments,
      extra,
      callMinecraftSkillsTool,
    ),
  );

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
