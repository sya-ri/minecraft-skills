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

const normalTools = vi.hoisted(
  (): ReturnType<typeof import("./tools.js").listMinecraftSkillsTools> => [
    {
      name: "normal_tool",
      description: "A normal test tool",
      inputSchema: {
        type: "object" as const,
        properties: { raw: { type: "string" } },
        additionalProperties: false as const,
      },
    },
  ],
);

const tool = vi.hoisted(() => ({
  callMinecraftSkillsTool: vi.fn(async () => ({
    content: [{ type: "text" as const, text: "ok" }],
  })),
  listMinecraftSkillsTools: vi.fn(() => normalTools),
}));

vi.mock("@minecraft-skills/evaluation-core", () => core);
vi.mock("./tools.js", () => tool);

import { createServer } from "./server.js";

const connected: Array<{ client: Client; server: ReturnType<typeof createServer> }> = [];

async function connectClient(): Promise<Client> {
  const server = createServer();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  connected.push({ client, server });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

describe("MCP server input and evaluation surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tool.listMinecraftSkillsTools.mockReturnValue(normalTools);
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
    const client = await connectClient();

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
    const client = await connectClient();

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

  it("rejects undeclared arguments on every advertised tool before dispatch", async () => {
    const actual = await vi.importActual<typeof import("./tools.js")>("./tools.js");
    tool.listMinecraftSkillsTools.mockReturnValue(actual.listMinecraftSkillsTools());
    const client = await connectClient();

    const listed = await client.listTools();
    for (const entry of listed.tools) {
      const result = await client.callTool({
        name: entry.name,
        arguments: { undeclaredArgument: "ignored-before" },
      });
      expect(result.isError, entry.name).toBe(true);
    }
    expect(tool.callMinecraftSkillsTool).not.toHaveBeenCalled();
    expect(core.createEvaluationRecord).not.toHaveBeenCalled();
    expect(core.rateEvaluationRecord).not.toHaveBeenCalled();
  });

  it("rejects malformed search filters, required fields, and nested values before dispatch", async () => {
    const actual = await vi.importActual<typeof import("./tools.js")>("./tools.js");
    tool.listMinecraftSkillsTools.mockReturnValue(actual.listMinecraftSkillsTools());
    const client = await connectClient();

    for (const name of [
      "search_paper_members",
      "search_resourcepack_assets",
      "search_paper_types",
      "search_registry_entries",
      "search_commands",
      "search_resourcepack_models",
    ]) {
      for (const arguments_ of [{ query: "experience" }, { contains: 123 }]) {
        const result = await client.callTool({ name, arguments: arguments_ });
        expect(result.isError, `${name}: ${JSON.stringify(arguments_)}`).toBe(true);
        expect(JSON.stringify(result.content)).toContain("contains");
      }
    }
    for (const [name, arguments_] of [
      ["search_paper_types", { limit: 0 }],
      ["search_paper_members", { limit: 501 }],
      ["search_registry_entries", { limit: 1.5 }],
      ["search_commands", { limit: 501 }],
      ["search_resourcepack_models", { limit: 0 }],
      ["search_fabric_api_types", { gameVersion: "26.3", limit: 0 }],
      ["search_fabric_api_types", { gameVersion: "26.3", limit: 1.5 }],
      ["search_fabric_api_types", { gameVersion: "26.3", query: "" }],
      ["search_fabric_api_types", { gameVersion: "invalid/path" }],
      ["search_paper_members", { kind: "invalid" }],
      ["latest_version", { edition: "invalid" }],
      ["validate_pack_files", { domain: "datapack" }],
      ["validate_pack_files", { domain: "datapack", files: "wrong-type" }],
      ["validate_pack_files", { domain: "datapack", files: [{ path: "pack.mcmeta" }] }],
      [
        "validate_pack_files",
        { domain: "datapack", files: [{ path: "pack.mcmeta", content: {}, extra: true }] },
      ],
      [
        "record_tool_evaluation",
        { id: "invalid", score: 5, informationNeed: "need", comment: "comment" },
      ],
      [
        "record_tool_evaluation",
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          score: 6,
          informationNeed: "need",
          comment: "comment",
        },
      ],
    ] as const) {
      const result = await client.callTool({ name, arguments: arguments_ });
      expect(result.isError, `${name}: ${JSON.stringify(arguments_)}`).toBe(true);
    }
    expect(tool.callMinecraftSkillsTool).not.toHaveBeenCalled();
    expect(core.rateEvaluationRecord).not.toHaveBeenCalled();
  });

  it("preserves optional defaults and arbitrary content allowed by the advertised schemas", async () => {
    const actual = await vi.importActual<typeof import("./tools.js")>("./tools.js");
    tool.listMinecraftSkillsTools.mockReturnValue(actual.listMinecraftSkillsTools());
    const client = await connectClient();

    expect((await client.callTool({ name: "latest_version" })).isError).not.toBe(true);
    expect(tool.callMinecraftSkillsTool).toHaveBeenLastCalledWith("latest_version", undefined);
    const arguments_ = {
      domain: "datapack",
      files: [{ path: "pack.mcmeta", content: { arbitrary: [1, true, null] } }],
    };
    expect(
      (await client.callTool({ name: "validate_pack_files", arguments: arguments_ })).isError,
    ).not.toBe(true);
    expect(tool.callMinecraftSkillsTool).toHaveBeenLastCalledWith(
      "validate_pack_files",
      arguments_,
    );
    expect(arguments_).not.toHaveProperty("edition");
    const filters = { version: "26.3", contains: "experience", limit: 2 };
    expect(
      (await client.callTool({ name: "search_paper_members", arguments: filters })).isError,
    ).not.toBe(true);
    expect(tool.callMinecraftSkillsTool).toHaveBeenLastCalledWith("search_paper_members", filters);
  });

  it("records rejected normal calls as tool errors with their own receipt", async () => {
    core.getEvaluationStatus.mockReturnValue({ globallyEnabled: true, effectiveEnabled: true });
    core.createEvaluationRecord.mockReturnValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    const client = await connectClient();

    const result = await client.callTool({ name: "normal_tool", arguments: { raw: 123 } });
    expect(result.isError).toBe(true);
    expect(result._meta).toEqual({
      "minecraft-skills/evaluationRecordId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(tool.callMinecraftSkillsTool).not.toHaveBeenCalled();
    expect(core.createEvaluationRecord).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({ response: expect.objectContaining({ outcome: "tool-error" }) }),
      expect.anything(),
    );
    expect(
      (await client.callTool({ name: "list_pending_evaluations", arguments: { limit: 101 } }))
        .isError,
    ).toBe(true);
    expect(core.createEvaluationRecord).toHaveBeenCalledOnce();
  });
});
