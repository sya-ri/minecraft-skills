#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { listMinecraftSkillsResources, readMinecraftSkillsResource } from "./resources.js";
import { callMinecraftSkillsTool, tools } from "./tools.js";

export function createServer(): Server {
  const server = new Server(
    {
      name: "minecraft-skills",
      version: "0.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
      instructions:
        "Use minecraft-skills tools and resources for version-aware Minecraft datapack, resourcepack, and Paper plugin facts. Treat unknown or not-extracted fields as gaps, not facts.",
    },
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listMinecraftSkillsResources(),
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
    readMinecraftSkillsResource(request.params.uri),
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    callMinecraftSkillsTool(request.params.name, request.params.arguments),
  );

  return server;
}

export async function runServer(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runServer().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
