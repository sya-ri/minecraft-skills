import { readFileSync } from "node:fs";
import { getDataManifest } from "@minecraft-skills/catalog";
import {
  createEvaluationRecord,
  createEvaluationStore,
  getEvaluationGateStatus,
  getEvaluationStatus,
  normalizeEvaluationError,
  rateEvaluationRecord,
  readEvaluationRecords,
} from "@minecraft-skills/evaluation-core";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

const evaluationToolNames = new Set([
  "get_evaluation_status",
  "list_pending_evaluations",
  "record_tool_evaluation",
]);
const maximumTrackedPendingEvaluations = 1_000;

export const evaluationRecordIdMetaKey = "minecraft-skills/evaluationRecordId";

const evaluationWorkflowInstructions =
  "MCP evaluation history is enabled. Immediately after each non-evaluation minecraft-skills tool call, evaluate whether its saved request and response met the information need, then call record_tool_evaluation before making another ordinary call. Use the evaluation receipt attached to that same tool result, or minecraft-skills/evaluationRecordId metadata when visible. Only use list_pending_evaluations when the target is unambiguous; never infer an ID from list position when multiple pending records share a tool name. Use these score anchors: 1=unusable, 2=major gaps, 3=partly useful, 4=minor gaps, 5=fully sufficient. Provide an independent informationNeed description that does not quote the conversation and a concise comment. Reuse the same stable missing-feature key for the same in-scope minecraft-skills capability, and do not create version-, query-, or error-instance-specific variants. A wrong tool choice or a capability outside minecraft-skills scope belongs in the comment, not missingFeatures.";

type EvaluationStore = ReturnType<typeof createEvaluationStore>;
type EvaluationContext = NonNullable<Parameters<typeof getEvaluationStatus>[1]>;
type EvaluationRecordInput = Parameters<typeof createEvaluationRecord>[1];
type EvaluationAssessment = Parameters<typeof rateEvaluationRecord>[2];

type ToolRequestExtra = {
  signal: AbortSignal;
};

type EvaluationIntegration = {
  instructions: string | undefined;
  tools: Tool[];
  callTool: (
    server: Server,
    name: string,
    input: unknown,
    extra: ToolRequestExtra,
    callMinecraftTool: (name: string, input: unknown) => Promise<CallToolResult>,
  ) => Promise<CallToolResult>;
};

const evaluationTools: Tool[] = [
  {
    name: "get_evaluation_status",
    description:
      "Get the local opt-in MCP evaluation-history status and current minecraft-skills MCP and catalog data versions for this client context, including whether a project marker disables recording. This management call is never recorded.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "list_pending_evaluations",
    description:
      "List minimal summaries, including the recorded minecraft-skills MCP and catalog data versions, of recent tool calls recorded by this MCP process that still need an evaluation. Raw arguments and results are not returned. If multiple pending records share a tool name and no same-call receipt or metadata is available, do not infer their IDs from list position. This management call is never recorded.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 20,
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "record_tool_evaluation",
    description:
      "Immediately evaluate one saved MCP tool call using the record ID from that same call's evaluation receipt or metadata. Use 1=unusable, 2=major gaps, 3=partly useful, 4=minor gaps, and 5=fully sufficient. Describe the information need independently instead of quoting conversation text. Reuse stable missing-feature keys for the same in-scope minecraft-skills capability; put wrong-tool choices and out-of-scope needs in the comment instead of missingFeatures. Replaces an existing evaluation for the same record. This management call is never recorded.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          format: "uuid",
        },
        score: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description:
            "1=unusable, 2=major gaps, 3=partly useful, 4=minor gaps, 5=fully sufficient.",
        },
        informationNeed: {
          type: "string",
          minLength: 1,
          maxLength: 2_000,
        },
        comment: {
          type: "string",
          minLength: 1,
          maxLength: 4_000,
        },
        missingFeatures: {
          type: "array",
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              key: {
                type: "string",
                minLength: 1,
                maxLength: 100,
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
              },
              summary: {
                type: "string",
                minLength: 1,
                maxLength: 500,
              },
            },
            required: ["key", "summary"],
            additionalProperties: false,
          },
        },
      },
      required: ["id", "score", "informationNeed", "comment"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

function readMcpPackageVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version?: unknown };
  if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
    throw new Error("@minecraft-skills/mcp package version is missing");
  }
  return packageJson.version;
}

export const minecraftSkillsMcpVersion = readMcpPackageVersion();

function currentRuntimeVersions(): { mcpVersion: string; dataVersion: string } {
  return {
    mcpVersion: minecraftSkillsMcpVersion,
    dataVersion: getDataManifest().dataVersion,
  };
}

function jsonResult(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(error: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: safeEvaluationError(error).message,
      },
    ],
    isError: true,
  };
}

function evaluationReceipt(id: string): CallToolResult["content"][number] {
  return {
    type: "text",
    text: `minecraft-skills evaluation receipt for this tool call: ${id}`,
    annotations: {
      audience: ["assistant"],
    },
  };
}

function inputRecord(input: unknown, toolName: string): Record<string, unknown> {
  if (input === undefined) {
    return {};
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error(`${toolName} input must be an object`);
  }
  return input as Record<string, unknown>;
}

function assertOnlyKeys(
  input: Record<string, unknown>,
  toolName: string,
  allowed: ReadonlySet<string>,
): void {
  const unexpected = Object.keys(input).find((key) => !allowed.has(key));
  if (unexpected !== undefined) {
    throw new Error(`${toolName} does not accept ${unexpected}`);
  }
}

function pendingLimit(input: unknown): number {
  const args = inputRecord(input, "list_pending_evaluations");
  assertOnlyKeys(args, "list_pending_evaluations", new Set(["limit"]));
  if (args.limit === undefined) {
    return 20;
  }
  if (
    typeof args.limit !== "number" ||
    !Number.isSafeInteger(args.limit) ||
    args.limit < 1 ||
    args.limit > 100
  ) {
    throw new Error("list_pending_evaluations limit must be an integer from 1 through 100");
  }
  return args.limit;
}

function evaluationAssessment(input: unknown): { id: string; assessment: EvaluationAssessment } {
  const args = inputRecord(input, "record_tool_evaluation");
  assertOnlyKeys(
    args,
    "record_tool_evaluation",
    new Set(["id", "score", "informationNeed", "comment", "missingFeatures"]),
  );
  if (typeof args.id !== "string") {
    throw new Error("record_tool_evaluation id must be a UUID string");
  }
  return {
    id: args.id,
    assessment: {
      informationNeed: args.informationNeed,
      score: args.score,
      comment: args.comment,
      missingFeatures: args.missingFeatures,
      source: "mcp",
    } as EvaluationAssessment,
  };
}

function baseContext(cwd: string): EvaluationContext {
  return { cwd } as EvaluationContext;
}

function isFileRoot(root: { uri: string }): boolean {
  try {
    return new URL(root.uri).protocol === "file:";
  } catch {
    return false;
  }
}

async function evaluationContext(server: Server, cwd: string): Promise<EvaluationContext> {
  const fallback = baseContext(cwd);
  if (server.getClientCapabilities()?.roots === undefined) {
    return fallback;
  }
  try {
    const listed = await server.listRoots();
    const roots = listed.roots.filter(isFileRoot);
    return roots.length === 0 ? fallback : ({ cwd, roots } as EvaluationContext);
  } catch {
    return fallback;
  }
}

async function evaluationStart(
  server: Server,
  store: EvaluationStore,
  cwd: string,
): Promise<{ context: EvaluationContext; eligibleAtStart: boolean }> {
  const fallback = baseContext(cwd);
  const cwdGate = getEvaluationGateStatus(store, fallback);
  if (!cwdGate.globallyEnabled) {
    return { context: fallback, eligibleAtStart: false };
  }
  const context = await evaluationContext(server, cwd);
  return {
    context,
    eligibleAtStart: getEvaluationGateStatus(store, context).effectiveEnabled,
  };
}

function completedInput(
  startedAt: Date,
  tool: string,
  args: unknown,
  response: EvaluationRecordInput["response"],
): EvaluationRecordInput {
  const completedAt = new Date();
  return {
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    runtime: currentRuntimeVersions(),
    request: {
      tool,
      arguments: args,
    },
    response,
  };
}

function safeEvaluationError(error: unknown): ReturnType<typeof normalizeEvaluationError> {
  try {
    return normalizeEvaluationError(error);
  } catch {
    return { name: "Error", message: "Evaluation operation failed" };
  }
}

function cancellationError(): ReturnType<typeof normalizeEvaluationError> {
  return { name: "AbortError", message: "Tool call was cancelled" };
}

function isCancellation(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof Error && error.name === "AbortError");
}

function reportEvaluationFailure(): void {
  try {
    console.error("minecraft-skills evaluation history failed; the tool result was preserved");
  } catch {
    // Diagnostics must never replace the primary tool result.
  }
}

export function createEvaluationIntegration(
  options: Parameters<typeof createEvaluationStore>[0] = {},
): EvaluationIntegration {
  const cwd = options.cwd ?? process.cwd();
  const store = createEvaluationStore({ ...options, cwd });
  const pendingIds = new Set<string>();
  let startupEnabled = false;
  try {
    startupEnabled = getEvaluationGateStatus(store, baseContext(cwd)).effectiveEnabled;
  } catch {
    startupEnabled = false;
  }

  const saveCompleted = (
    startedAt: Date,
    tool: string,
    args: unknown,
    response: EvaluationRecordInput["response"],
    context: EvaluationContext,
  ): ReturnType<typeof createEvaluationRecord> => {
    try {
      const input = completedInput(startedAt, tool, args, response);
      const record = createEvaluationRecord(store, input, context);
      if (record !== undefined) {
        pendingIds.add(record.id);
        if (pendingIds.size > maximumTrackedPendingEvaluations) {
          const oldestId = pendingIds.values().next().value;
          if (oldestId !== undefined) {
            pendingIds.delete(oldestId);
          }
        }
      }
      return record;
    } catch {
      reportEvaluationFailure();
      return undefined;
    }
  };

  const callManagementTool = async (
    server: Server,
    name: string,
    input: unknown,
  ): Promise<CallToolResult> => {
    try {
      if (name === "get_evaluation_status") {
        const args = inputRecord(input, name);
        assertOnlyKeys(args, name, new Set());
        const context = await evaluationContext(server, cwd);
        return jsonResult({
          ...getEvaluationStatus(store, context),
          runtime: currentRuntimeVersions(),
        });
      }
      const context = await evaluationContext(server, cwd);
      if (!getEvaluationGateStatus(store, context).effectiveEnabled) {
        throw new Error(
          `${name} is unavailable because MCP evaluation history is disabled in this context`,
        );
      }
      if (name === "list_pending_evaluations") {
        const limit = pendingLimit(input);
        const ids = [...pendingIds].reverse();
        const records: Array<{
          id: string;
          startedAt: string;
          completedAt: string;
          tool: string;
          outcome: string;
          runtime: {
            mcpVersion: string;
            dataVersion: string;
          };
        }> = [];
        const notFound: string[] = [];
        const warnings: Array<{ path: string; message: string }> = [];
        for (const id of ids) {
          const result = readEvaluationRecords(store, [id]);
          warnings.push(...result.warnings);
          for (const missingId of result.notFound) {
            pendingIds.delete(missingId);
            notFound.push(missingId);
          }
          const record = result.records[0];
          if (record === undefined) {
            if (result.notFound.length === 0) {
              pendingIds.delete(id);
            }
            continue;
          }
          if (record.evaluation !== undefined) {
            pendingIds.delete(record.id);
            continue;
          }
          records.push({
            id: record.id,
            startedAt: record.startedAt,
            completedAt: record.completedAt,
            tool: record.request.tool,
            outcome: record.response.outcome,
            runtime: {
              mcpVersion: record.runtime.mcpVersion,
              dataVersion: record.runtime.dataVersion,
            },
          });
          if (records.length >= limit) {
            break;
          }
        }
        return jsonResult({
          records,
          notFound,
          warnings,
        });
      }
      const { id, assessment } = evaluationAssessment(input);
      const record = rateEvaluationRecord(store, id, assessment);
      pendingIds.delete(id);
      return jsonResult({ id: record.id, evaluation: record.evaluation });
    } catch (error) {
      return errorResult(error);
    }
  };

  return {
    instructions: startupEnabled ? evaluationWorkflowInstructions : undefined,
    tools: evaluationTools,
    callTool: async (server, name, input, extra, callMinecraftTool) => {
      if (evaluationToolNames.has(name)) {
        return callManagementTool(server, name, input);
      }

      const startedAt = new Date();
      let context = baseContext(cwd);
      let eligibleAtStart = false;
      try {
        ({ context, eligibleAtStart } = await evaluationStart(server, store, cwd));
      } catch {
        reportEvaluationFailure();
      }
      let cancelled = false;
      let finished = false;
      const onAbort = () => {
        if (finished || cancelled) {
          return;
        }
        cancelled = true;
        if (eligibleAtStart) {
          saveCompleted(
            startedAt,
            name,
            input,
            {
              outcome: "cancelled",
              error: cancellationError(),
            },
            context,
          );
        }
      };

      extra.signal.addEventListener("abort", onAbort, { once: true });
      if (extra.signal.aborted) {
        onAbort();
      }

      try {
        if (cancelled) {
          return { content: [] };
        }
        const result = await callMinecraftTool(name, input);
        finished = true;
        if (cancelled) {
          return result;
        }
        const record = eligibleAtStart
          ? saveCompleted(
              startedAt,
              name,
              input,
              {
                outcome: result.isError === true ? "tool-error" : "success",
                result,
              },
              context,
            )
          : undefined;
        if (record === undefined) {
          return result;
        }
        return {
          ...result,
          content: [...result.content, evaluationReceipt(record.id)],
          _meta: {
            ...result._meta,
            [evaluationRecordIdMetaKey]: record.id,
          },
        };
      } catch (error) {
        finished = true;
        if (!cancelled && eligibleAtStart) {
          saveCompleted(
            startedAt,
            name,
            input,
            {
              outcome: isCancellation(error, extra.signal) ? "cancelled" : "protocol-error",
              error: safeEvaluationError(error),
            },
            context,
          );
        }
        throw error;
      } finally {
        extra.signal.removeEventListener("abort", onAbort);
      }
    },
  };
}
