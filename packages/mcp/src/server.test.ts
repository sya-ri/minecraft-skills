import { readFileSync } from "node:fs";
import { getDataManifest } from "@minecraft-skills/catalog";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const core = vi.hoisted(() => ({
  createEvaluationStore: vi.fn((_options?: unknown) => ({ kind: "store" })),
  getEvaluationStatus: vi.fn((_store: unknown, _context?: unknown) => ({
    globallyEnabled: false,
    effectiveEnabled: false,
  })),
  getEvaluationGateStatus: vi.fn((_store: unknown, _context?: unknown) => ({
    globallyEnabled: false,
    effectiveEnabled: false,
  })),
  createEvaluationRecord: vi.fn(
    (_store: unknown, _input: unknown, _context?: unknown) =>
      undefined as { id: string } | undefined,
  ),
  readEvaluationRecords: vi.fn((_store: unknown, _ids: string[]) => ({
    records: [],
    notFound: [],
    warnings: [],
  })),
  rateEvaluationRecord: vi.fn((_store: unknown, _id: string, _assessment: unknown) => undefined),
  normalizeEvaluationError: vi.fn((error: unknown) => ({
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
  })),
}));

const tool = vi.hoisted(() => ({
  callMinecraftSkillsTool: vi.fn(async () => ({
    content: [{ type: "text" as const, text: "ok" }],
  })),
  listMinecraftSkillsTools: vi.fn(() => [
    {
      name: "normal_tool",
      description: "A normal test tool",
      inputSchema: { type: "object" as const, properties: {}, additionalProperties: false },
    },
  ]),
}));

vi.mock("@minecraft-skills/evaluation-core", () => core);
vi.mock("./tools.js", () => tool);

import { createServer } from "./server.js";

const connected: Array<{ client: Client; server: ReturnType<typeof createServer> }> = [];

describe("MCP server evaluation surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: false,
      effectiveEnabled: false,
    });
    core.getEvaluationGateStatus.mockImplementation((store, context) =>
      core.getEvaluationStatus(store, context),
    );
  });

  afterEach(async () => {
    for (const pair of connected.splice(0)) {
      await pair.client.close();
      await pair.server.close();
    }
  });

  it("advertises management tools alongside normal tools and the actual package version", async () => {
    const server = createServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    connected.push({ client, server });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const listed = await client.listTools();
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    expect(listed.tools.map((entry) => entry.name)).toEqual([
      "normal_tool",
      "get_evaluation_status",
      "list_pending_evaluations",
      "record_tool_evaluation",
    ]);
    expect(client.getServerVersion()).toEqual({
      name: "minecraft-skills",
      version: packageJson.version,
    });
  });

  it("routes normal calls through recording and keeps management calls outside recording", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    core.createEvaluationRecord.mockReturnValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    const server = createServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    connected.push({ client, server });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const normal = await client.callTool({ name: "normal_tool", arguments: { raw: "value" } });
    const status = await client.callTool({ name: "get_evaluation_status", arguments: {} });
    const statusResult = status as CallToolResult;
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    const statusOutput = JSON.parse(
      statusResult.content[0]?.type === "text" ? statusResult.content[0].text : "{}",
    );

    expect(normal._meta).toEqual({
      "minecraft-skills/evaluationRecordId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(statusResult.isError).not.toBe(true);
    expect(statusOutput.runtime).toEqual({
      mcpVersion: packageJson.version,
      dataVersion: getDataManifest().dataVersion,
    });
    expect(tool.callMinecraftSkillsTool).toHaveBeenCalledOnce();
    expect(core.createEvaluationRecord).toHaveBeenCalledOnce();
  });
});
