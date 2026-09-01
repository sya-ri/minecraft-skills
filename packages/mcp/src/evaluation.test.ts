import { readFileSync } from "node:fs";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  readEvaluationRecords: vi.fn((_: unknown, ids: string[]) => ({
    records: ids.map((id) => ({ id })),
    notFound: [],
    warnings: [],
  })),
  rateEvaluationRecord: vi.fn((_: unknown, id: string, assessment: unknown) => ({
    id,
    evaluation: assessment,
  })),
  normalizeEvaluationError: vi.fn((error: unknown) => ({
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
  })),
}));

const catalog = vi.hoisted(() => ({
  getDataManifest: vi.fn(() => ({ dataVersion: "2026.08.31-1" })),
}));

vi.mock("@minecraft-skills/evaluation-core", () => core);
vi.mock("@minecraft-skills/catalog", () => catalog);

import {
  createEvaluationIntegration,
  evaluationRecordIdMetaKey,
  minecraftSkillsMcpVersion,
} from "./evaluation.js";

function serverStub(
  options: { roots?: Array<{ uri: string; name?: string }>; rootsError?: Error } = {},
): Server {
  return {
    getClientCapabilities: () =>
      options.roots === undefined && options.rootsError === undefined ? {} : { roots: {} },
    listRoots: vi.fn(async () => {
      if (options.rootsError !== undefined) {
        throw options.rootsError;
      }
      return { roots: options.roots ?? [] };
    }),
  } as unknown as Server;
}

function call(
  integration: ReturnType<typeof createEvaluationIntegration>,
  options: {
    server?: Server;
    name?: string;
    input?: unknown;
    signal?: AbortSignal;
    implementation?: (name: string, input: unknown) => Promise<CallToolResult>;
  } = {},
): Promise<CallToolResult> {
  return integration.callTool(
    options.server ?? serverStub(),
    options.name ?? "latest_version",
    options.input ?? { edition: "java" },
    { signal: options.signal ?? new AbortController().signal },
    options.implementation ?? (async () => ({ content: [{ type: "text", text: "ok" }] })),
  );
}

describe("MCP evaluation integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    core.createEvaluationStore.mockReturnValue({ kind: "store" });
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: false,
      effectiveEnabled: false,
    });
    core.getEvaluationGateStatus.mockImplementation((store, context) =>
      core.getEvaluationStatus(store, context),
    );
    core.createEvaluationRecord.mockReturnValue(undefined);
    core.readEvaluationRecords.mockImplementation((_, ids) => ({
      records: ids.map((id) => ({ id })),
      notFound: [],
      warnings: [],
    }));
    core.rateEvaluationRecord.mockImplementation((_, id, assessment) => ({
      id,
      evaluation: assessment,
    }));
    catalog.getDataManifest.mockReturnValue({ dataVersion: "2026.08.31-1" });
  });

  it("uses the published package version and exposes all three management tools", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    const integration = createEvaluationIntegration();

    expect(minecraftSkillsMcpVersion).toBe(packageJson.version);
    expect(integration.tools.map((tool) => tool.name)).toEqual([
      "get_evaluation_status",
      "list_pending_evaluations",
      "record_tool_evaluation",
    ]);
    const rateTool = integration.tools.find((tool) => tool.name === "record_tool_evaluation");
    expect(rateTool?.description).toContain("1=unusable");
    expect(rateTool?.description).toContain("5=fully sufficient");
    expect(integration.instructions).toBeUndefined();
  });

  it("adds evaluation instructions only when startup recording is effectively enabled", () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });

    const instructions = createEvaluationIntegration().instructions;
    expect(instructions).toContain("record_tool_evaluation");
    expect(instructions).toContain("1=unusable");
    expect(instructions).toContain("5=fully sufficient");
  });

  it("reports the current MCP and catalog data versions in evaluation status", async () => {
    catalog.getDataManifest.mockReturnValue({ dataVersion: "2026.09.01-2" });

    const result = await call(createEvaluationIntegration(), {
      name: "get_evaluation_status",
      input: {},
    });
    const output = JSON.parse(result.content[0]?.type === "text" ? result.content[0].text : "{}");

    expect(output).toMatchObject({
      runtime: {
        mcpVersion: minecraftSkillsMcpVersion,
        dataVersion: "2026.09.01-2",
      },
    });
    expect(core.createEvaluationRecord).not.toHaveBeenCalled();
  });

  it("does not request client roots while the global opt-in is disabled", async () => {
    const server = serverStub({ roots: [{ uri: "file:///private/project" }] });
    const result = await call(createEvaluationIntegration(), { server });

    expect(server.listRoots).not.toHaveBeenCalled();
    expect(core.createEvaluationRecord).not.toHaveBeenCalled();
    expect(result._meta).toBeUndefined();
  });

  it("does not save a call that becomes globally enabled only after it starts", async () => {
    let finish: ((result: CallToolResult) => void) | undefined;
    const toolResult = new Promise<CallToolResult>((resolve) => {
      finish = resolve;
    });
    const integration = createEvaluationIntegration();
    const resultPromise = call(integration, {
      server: serverStub({ roots: [{ uri: "file:///private/project" }] }),
      implementation: async () => toolResult,
    });
    await vi.waitFor(() => expect(finish).toBeDefined());

    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    core.createEvaluationRecord.mockReturnValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    finish?.({ content: [{ type: "text", text: "completed" }] });
    const result = await resultPromise;

    expect(core.createEvaluationRecord).not.toHaveBeenCalled();
    expect(result._meta).toBeUndefined();
  });

  it("records a successful raw call with file roots, runtime versions, and namespaced metadata", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    core.createEvaluationRecord.mockReturnValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    const server = serverStub({
      roots: [
        { uri: "file:///project-one", name: "one" },
        { uri: "https://example.invalid/not-a-file-root" },
        { uri: "file:///project-two", name: "two" },
      ],
    });
    const rawResult: CallToolResult = {
      content: [{ type: "text", text: "sensitive raw result" }],
    };

    const result = await call(createEvaluationIntegration(), {
      server,
      input: { privateValue: "raw argument" },
      implementation: async () => rawResult,
    });

    expect(core.createEvaluationRecord).toHaveBeenCalledOnce();
    const [store, record, context] = core.createEvaluationRecord.mock.calls[0] ?? [];
    expect(store).toEqual({ kind: "store" });
    expect(record).toMatchObject({
      runtime: {
        mcpVersion: minecraftSkillsMcpVersion,
        dataVersion: expect.stringMatching(/^\d{4}\.\d{2}\.\d{2}-\d+$/),
      },
      request: {
        tool: "latest_version",
        arguments: { privateValue: "raw argument" },
      },
      response: {
        outcome: "success",
        result: rawResult,
      },
    });
    expect(context).toMatchObject({
      roots: [{ uri: "file:///project-one" }, { uri: "file:///project-two" }],
    });
    expect(result._meta).toEqual({
      [evaluationRecordIdMetaKey]: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("records isError results as tool errors", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    const result: CallToolResult = {
      content: [{ type: "text", text: "bad input" }],
      isError: true,
    };

    await call(createEvaluationIntegration(), { implementation: async () => result });

    expect(core.createEvaluationRecord.mock.calls[0]?.[1]).toMatchObject({
      response: { outcome: "tool-error", result },
    });
  });

  it("records thrown failures as sanitized protocol errors and preserves the exception", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    const failure = new Error("upstream failed");

    await expect(
      call(createEvaluationIntegration(), {
        implementation: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);

    expect(core.createEvaluationRecord.mock.calls[0]?.[1]).toMatchObject({
      response: {
        outcome: "protocol-error",
        error: { name: "Error", message: "upstream failed" },
      },
    });
    expect(core.createEvaluationRecord.mock.calls[0]?.[1]).not.toHaveProperty(
      "response.error.stack",
    );
  });

  it("records cancellation once and does not replace it when the tool later completes", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    const controller = new AbortController();
    let finish: ((result: CallToolResult) => void) | undefined;
    const toolResult = new Promise<CallToolResult>((resolve) => {
      finish = resolve;
    });
    const resultPromise = call(createEvaluationIntegration(), {
      signal: controller.signal,
      implementation: async () => toolResult,
    });
    await vi.waitFor(() => expect(finish).toBeDefined());

    controller.abort();
    finish?.({ content: [{ type: "text", text: "late result" }] });
    await resultPromise;

    expect(core.createEvaluationRecord).toHaveBeenCalledOnce();
    expect(core.createEvaluationRecord.mock.calls[0]?.[1]).toMatchObject({
      response: {
        outcome: "cancelled",
        error: { name: "AbortError", message: "Tool call was cancelled" },
      },
    });
  });

  it("preserves the primary result when evaluation storage fails", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    core.createEvaluationRecord.mockImplementation(() => {
      throw new Error("disk failure with raw payload");
    });
    const stderr = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const expected: CallToolResult = { content: [{ type: "text", text: "primary" }] };

    const result = await call(createEvaluationIntegration(), {
      implementation: async () => expected,
    });

    expect(result).toEqual(expected);
    expect(stderr).toHaveBeenCalledWith(
      "minecraft-skills evaluation history failed; the tool result was preserved",
    );
    expect(stderr.mock.calls.flat().join(" ")).not.toContain("raw payload");
    stderr.mockRestore();
  });

  it("preserves the primary result when runtime metadata lookup fails", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    catalog.getDataManifest.mockImplementation(() => {
      throw new Error("manifest failure containing private data");
    });
    const stderr = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const expected: CallToolResult = { content: [{ type: "text", text: "primary" }] };

    const result = await call(createEvaluationIntegration(), {
      implementation: async () => expected,
    });

    expect(result).toEqual(expected);
    expect(core.createEvaluationRecord).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      "minecraft-skills evaluation history failed; the tool result was preserved",
    );
    expect(stderr.mock.calls.flat().join(" ")).not.toContain("private data");
    stderr.mockRestore();
  });

  it("preserves the primary result when the eligibility gate fails", async () => {
    const integration = createEvaluationIntegration();
    core.getEvaluationGateStatus.mockImplementationOnce(() => {
      throw new Error("gate failure containing private data");
    });
    const stderr = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const expected: CallToolResult = { content: [{ type: "text", text: "primary" }] };

    const result = await call(integration, { implementation: async () => expected });

    expect(result).toEqual(expected);
    expect(core.createEvaluationRecord).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      "minecraft-skills evaluation history failed; the tool result was preserved",
    );
    expect(stderr.mock.calls.flat().join(" ")).not.toContain("private data");
    stderr.mockRestore();
  });

  it("falls back to cwd when client roots fail", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });

    await call(createEvaluationIntegration(), {
      server: serverStub({ rootsError: new Error("roots unavailable") }),
    });

    expect(core.createEvaluationRecord.mock.calls[0]?.[2]).toEqual({ cwd: process.cwd() });
  });

  it("lists minimal process-local pending summaries newest first and excludes management calls", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    core.createEvaluationRecord
      .mockReturnValueOnce({ id: "11111111-1111-4111-8111-111111111111" })
      .mockReturnValueOnce({ id: "22222222-2222-4222-8222-222222222222" });
    core.readEvaluationRecords.mockImplementation((_, ids) => ({
      records: ids.map((id) => ({
        id,
        startedAt: "2026-09-01T00:00:00.000Z",
        completedAt: "2026-09-01T00:00:01.000Z",
        runtime: { mcpVersion: "0.1.5", dataVersion: "2026.08.25-13" },
        request: { tool: "get_version", arguments: { secret: "not returned" } },
        response: { outcome: "success", result: { secret: "not returned" } },
      })),
      notFound: [],
      warnings: [],
    }));
    const integration = createEvaluationIntegration();
    await call(integration, { name: "latest_version" });
    await call(integration, { name: "get_version" });

    const result = await call(integration, {
      name: "list_pending_evaluations",
      input: { limit: 1 },
    });
    const output = JSON.parse(
      result.content[0]?.type === "text" ? result.content[0].text : "{}",
    ) as {
      records: Array<{ id: string }>;
    };

    expect(core.readEvaluationRecords).toHaveBeenCalledOnce();
    expect(core.readEvaluationRecords).toHaveBeenCalledWith({ kind: "store" }, [
      "22222222-2222-4222-8222-222222222222",
    ]);
    expect(output.records).toEqual([
      {
        id: "22222222-2222-4222-8222-222222222222",
        startedAt: "2026-09-01T00:00:00.000Z",
        completedAt: "2026-09-01T00:00:01.000Z",
        tool: "get_version",
        outcome: "success",
        runtime: {
          mcpVersion: "0.1.5",
          dataVersion: "2026.08.25-13",
        },
      },
    ]);
    expect(result.content[0]).not.toMatchObject({ text: expect.stringContaining("secret") });
    expect(core.createEvaluationRecord).toHaveBeenCalledTimes(2);
  });

  it("backfills the pending limit after pruning a newer evaluated record", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    const olderId = "11111111-1111-4111-8111-111111111111";
    const newerId = "22222222-2222-4222-8222-222222222222";
    core.createEvaluationRecord
      .mockReturnValueOnce({ id: olderId })
      .mockReturnValueOnce({ id: newerId });
    core.readEvaluationRecords.mockImplementation((_, ids) => ({
      records: ids.map((id) => ({
        id,
        startedAt: "2026-09-01T00:00:00.000Z",
        completedAt: "2026-09-01T00:00:01.000Z",
        runtime: { mcpVersion: "0.1.5", dataVersion: "2026.08.25-13" },
        request: { tool: id === newerId ? "newer_tool" : "older_tool" },
        response: { outcome: "success" },
        ...(id === newerId ? { evaluation: { score: 5 } } : {}),
      })),
      notFound: [],
      warnings: [],
    }));
    const integration = createEvaluationIntegration();
    await call(integration, { name: "older_tool" });
    await call(integration, { name: "newer_tool" });

    const result = await call(integration, {
      name: "list_pending_evaluations",
      input: { limit: 1 },
    });
    const output = JSON.parse(
      result.content[0]?.type === "text" ? result.content[0].text : "{}",
    ) as { records: Array<{ id: string }> };

    expect(core.readEvaluationRecords).toHaveBeenNthCalledWith(1, { kind: "store" }, [newerId]);
    expect(core.readEvaluationRecords).toHaveBeenNthCalledWith(2, { kind: "store" }, [olderId]);
    expect(output.records.map((record) => record.id)).toEqual([olderId]);
  });

  it("bounds process-local pending tracking to the most recent 1,000 records", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    const idFor = (index: number) =>
      `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
    let nextId = 0;
    core.createEvaluationRecord.mockImplementation(() => ({ id: idFor(++nextId) }));
    core.readEvaluationRecords.mockImplementation((_, ids) => ({
      records: ids.map((id) => ({
        id,
        startedAt: "2026-09-01T00:00:00.000Z",
        completedAt: "2026-09-01T00:00:01.000Z",
        runtime: { mcpVersion: "0.1.5", dataVersion: "2026.08.25-13" },
        request: { tool: "get_version" },
        response: { outcome: "success" },
        evaluation: { score: 5 },
      })),
      notFound: [],
      warnings: [],
    }));
    const integration = createEvaluationIntegration();
    for (let index = 0; index < 1_001; index += 1) {
      await call(integration, { name: "get_version" });
    }

    const result = await call(integration, {
      name: "list_pending_evaluations",
      input: { limit: 1 },
    });
    const readIds = core.readEvaluationRecords.mock.calls.map((entry) => entry[1][0]);

    expect(readIds).toHaveLength(1_000);
    expect(readIds[0]).toBe(idFor(1_001));
    expect(readIds.at(-1)).toBe(idFor(2));
    expect(readIds).not.toContain(idFor(1));
    expect(
      JSON.parse(result.content[0]?.type === "text" ? result.content[0].text : "{}"),
    ).toMatchObject({ records: [] });
  });

  it("rates a record with MCP as the source and removes it from pending", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    core.createEvaluationRecord.mockReturnValue({ id });
    const integration = createEvaluationIntegration();
    await call(integration);

    const rated = await call(integration, {
      name: "record_tool_evaluation",
      input: {
        id,
        score: 3,
        informationNeed: "Determine the target-version behavior",
        comment: "The result omitted one required field",
        missingFeatures: [{ key: "target-field", summary: "Return the target field" }],
      },
    });
    const pending = await call(integration, {
      name: "list_pending_evaluations",
      input: {},
    });

    expect(rated.isError).not.toBe(true);
    expect(core.rateEvaluationRecord).toHaveBeenCalledWith(
      { kind: "store" },
      id,
      expect.objectContaining({ source: "mcp", score: 3 }),
    );
    expect(
      JSON.parse(pending.content[0]?.type === "text" ? pending.content[0].text : "{}"),
    ).toMatchObject({ records: [] });
    expect(core.createEvaluationRecord).toHaveBeenCalledOnce();
  });

  it("returns invalid management input as a tool error without recording it", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: true,
    });
    const result = await call(createEvaluationIntegration(), {
      name: "list_pending_evaluations",
      input: { limit: 101 },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: "list_pending_evaluations limit must be an integer from 1 through 100",
    });
    expect(core.createEvaluationRecord).not.toHaveBeenCalled();
  });

  it("blocks pending reads and MCP rating when a marker disables the current context", async () => {
    core.getEvaluationStatus.mockReturnValue({
      globallyEnabled: true,
      effectiveEnabled: false,
    });
    const integration = createEvaluationIntegration();

    const pending = await call(integration, {
      name: "list_pending_evaluations",
      input: {},
    });
    const rated = await call(integration, {
      name: "record_tool_evaluation",
      input: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        score: 5,
        informationNeed: "Need",
        comment: "Comment",
      },
    });

    expect(pending).toMatchObject({ isError: true });
    expect(rated).toMatchObject({ isError: true });
    expect(core.readEvaluationRecords).not.toHaveBeenCalled();
    expect(core.rateEvaluationRecord).not.toHaveBeenCalled();
  });
});
