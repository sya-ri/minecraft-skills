import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createEvaluationStore, setEvaluationEnabled } from "@minecraft-skills/evaluation-core";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEvaluationIntegration, evaluationRecordIdMetaKey } from "./evaluation.js";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "minecraft-skills-mcp-evaluation-"));
  temporaryDirectories.push(directory);
  return directory;
}

function serverStub(root?: string): Server {
  return {
    getClientCapabilities: () => (root === undefined ? {} : { roots: {} }),
    listRoots: vi.fn(async () => ({
      roots: root === undefined ? [] : [{ uri: pathToFileURL(root).href }],
    })),
  } as unknown as Server;
}

async function call(
  integration: ReturnType<typeof createEvaluationIntegration>,
  options: {
    server?: Server;
    implementation?: () => Promise<CallToolResult>;
  } = {},
): Promise<CallToolResult> {
  return integration.callTool(
    options.server ?? serverStub(),
    "get_version",
    { version: "26.2", privateValue: "raw value" },
    { signal: new AbortController().signal },
    options.implementation ?? (async () => ({ content: [{ type: "text", text: "raw result" }] })),
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe("MCP evaluation integration with the real evaluation core", () => {
  it("is fail-closed by default, creates no storage, and writes nothing to stdout", async () => {
    const sandbox = temporaryDirectory();
    const project = join(sandbox, "project");
    const storage = join(sandbox, "evaluation");
    mkdirSync(project);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const integration = createEvaluationIntegration({ rootDirectory: storage, cwd: project });

    const result = await call(integration);

    expect(result._meta).toBeUndefined();
    expect(existsSync(storage)).toBe(false);
    expect(stdout).not.toHaveBeenCalled();
  });

  it("records raw data only while both start and completion checks remain eligible", async () => {
    const sandbox = temporaryDirectory();
    const project = join(sandbox, "project");
    const storage = join(sandbox, "evaluation");
    mkdirSync(project);
    const store = createEvaluationStore({ rootDirectory: storage, cwd: project });
    setEvaluationEnabled(store, true);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const integration = createEvaluationIntegration({ rootDirectory: storage, cwd: project });

    const recorded = await call(integration);

    expect(recorded._meta?.[evaluationRecordIdMetaKey]).toEqual(expect.any(String));
    expect(recorded.content).toEqual([
      { type: "text", text: "raw result" },
      {
        type: "text",
        text: `minecraft-skills evaluation receipt for this tool call: ${String(
          recorded._meta?.[evaluationRecordIdMetaKey],
        )}`,
        annotations: { audience: ["assistant"] },
      },
    ]);
    const firstFiles = readdirSync(store.recordsDirectory);
    expect(firstFiles).toHaveLength(1);
    const saved = JSON.parse(
      readFileSync(join(store.recordsDirectory, firstFiles[0] ?? ""), "utf8"),
    ) as {
      request: { arguments: unknown };
      response: { result: unknown };
    };
    expect(saved.request.arguments).toEqual({ version: "26.2", privateValue: "raw value" });
    expect(saved.response.result).toMatchObject({
      content: [{ type: "text", text: "raw result" }],
    });
    expect(JSON.stringify(saved.response.result)).not.toContain("evaluation receipt");

    let finish: ((result: CallToolResult) => void) | undefined;
    const delayedResult = new Promise<CallToolResult>((resolve) => {
      finish = resolve;
    });
    const completionOptOut = call(integration, {
      implementation: async () => delayedResult,
    });
    await vi.waitFor(() => expect(finish).toBeDefined());
    const markerDirectory = join(project, ".minecraft-skills");
    mkdirSync(markerDirectory, { recursive: true });
    writeFileSync(join(markerDirectory, "evaluation.disabled"), "", "utf8");
    finish?.({ content: [{ type: "text", text: "must not be stored" }] });

    const blockedAtCompletion = await completionOptOut;
    expect(blockedAtCompletion._meta).toBeUndefined();
    expect(blockedAtCompletion.content).toEqual([{ type: "text", text: "must not be stored" }]);
    expect(readdirSync(store.recordsDirectory)).toHaveLength(1);
    expect(stdout).not.toHaveBeenCalled();
  });

  it("honors a marker under any advertised file root at call start", async () => {
    const sandbox = temporaryDirectory();
    const cwd = join(sandbox, "cwd");
    const sensitiveProject = join(sandbox, "sensitive");
    const storage = join(sandbox, "evaluation");
    mkdirSync(cwd);
    mkdirSync(join(sensitiveProject, ".minecraft-skills"), { recursive: true });
    writeFileSync(join(sensitiveProject, ".minecraft-skills", "evaluation.disabled"), "", "utf8");
    const store = createEvaluationStore({ rootDirectory: storage, cwd });
    setEvaluationEnabled(store, true);
    const integration = createEvaluationIntegration({ rootDirectory: storage, cwd });

    const result = await call(integration, { server: serverStub(sensitiveProject) });

    expect(result._meta).toBeUndefined();
    expect(existsSync(store.recordsDirectory)).toBe(false);
  });
});
