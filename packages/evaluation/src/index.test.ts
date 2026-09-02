import { spawn } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  aggregateMissingFeatures,
  type CreateEvaluationRecordInput,
  createEvaluationRecord,
  createEvaluationStore,
  deleteEvaluationRecords,
  type EvaluationStore,
  EvaluationStoreError,
  getEvaluationGateStatus,
  getEvaluationStatus,
  normalizeEvaluationError,
  rateEvaluationRecord,
  readEvaluationRecord,
  readEvaluationRecords,
  searchEvaluationRecords,
  setEvaluationEnabled,
} from "./index.js";

const temporaryRoots: string[] = [];
const evaluationModuleUrl = new URL("./index.ts", import.meta.url).href;

function temporaryDirectory(prefix = "minecraft-skills-evaluation-"): string {
  const path = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(path);
  return path;
}

function fixture(): { store: EvaluationStore; project: string } {
  const root = temporaryDirectory();
  const project = join(root, "project", "nested");
  mkdirSync(project, { recursive: true });
  return {
    store: createEvaluationStore({ rootDirectory: join(root, "history"), cwd: project }),
    project,
  };
}

function recordInput(
  overrides: Partial<CreateEvaluationRecordInput> = {},
): CreateEvaluationRecordInput {
  return {
    startedAt: "2026-08-31T00:00:00.000Z",
    completedAt: "2026-08-31T00:00:01.000Z",
    durationMs: 1000,
    runtime: {
      mcpVersion: "0.1.6",
      dataVersion: "2026.08.31",
    },
    request: {
      tool: "get_minecraft_data",
      arguments: { version: "1.21.8" },
    },
    response: {
      outcome: "success",
      result: { content: [{ type: "text", text: "ok" }] },
    },
    ...overrides,
  };
}

function enabledFixture(): { store: EvaluationStore; project: string } {
  const result = fixture();
  setEvaluationEnabled(result.store, true);
  return result;
}

function createRequiredRecord(
  store: EvaluationStore,
  input: CreateEvaluationRecordInput = recordInput(),
): NonNullable<ReturnType<typeof createEvaluationRecord>> {
  const record = createEvaluationRecord(store, input);
  expect(record).toBeDefined();
  if (!record) {
    throw new Error("Expected evaluation recording to be enabled");
  }
  return record;
}

function runParallelWriter(
  store: EvaluationStore,
  worker: number,
  recordsPerWorker: number,
): Promise<void> {
  const script = `
    import { createEvaluationRecord, createEvaluationStore } from ${JSON.stringify(evaluationModuleUrl)};
    const store = createEvaluationStore({
      rootDirectory: process.env.MINECRAFT_SKILLS_EVALUATION_TEST_ROOT,
      cwd: process.env.MINECRAFT_SKILLS_EVALUATION_TEST_CWD,
    });
    const worker = Number(process.env.MINECRAFT_SKILLS_EVALUATION_TEST_WORKER);
    const count = Number(process.env.MINECRAFT_SKILLS_EVALUATION_TEST_COUNT);
    for (let index = 0; index < count; index += 1) {
      const record = createEvaluationRecord(store, {
        startedAt: "2026-08-31T00:00:00.000Z",
        completedAt: "2026-08-31T00:00:01.000Z",
        runtime: { mcpVersion: "0.1.6", dataVersion: "2026.08.31" },
        request: { tool: "parallel_writer", arguments: { worker, index } },
        response: { outcome: "success", result: { worker, index } },
      });
      if (record === undefined) throw new Error("evaluation recording unexpectedly disabled");
    }
  `;
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      ["--no-warnings", "--experimental-strip-types", "--input-type=module", "--eval", script],
      {
        env: {
          ...process.env,
          MINECRAFT_SKILLS_EVALUATION_TEST_ROOT: store.rootDirectory,
          MINECRAFT_SKILLS_EVALUATION_TEST_CWD: store.cwd,
          MINECRAFT_SKILLS_EVALUATION_TEST_WORKER: String(worker),
          MINECRAFT_SKILLS_EVALUATION_TEST_COUNT: String(recordsPerWorker),
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`Parallel evaluation writer exited with ${code}: ${stderr}`));
      }
    });
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("evaluation configuration and marker resolution", () => {
  it("is disabled by default without creating the storage directory", () => {
    const { store } = fixture();

    expect(getEvaluationGateStatus(store)).toEqual(
      expect.objectContaining({
        configState: "missing",
        globallyEnabled: false,
        effectiveEnabled: false,
      }),
    );
    expect(getEvaluationGateStatus(store)).not.toHaveProperty("recordCount");
    expect(getEvaluationStatus(store)).toEqual(
      expect.objectContaining({
        configState: "missing",
        globallyEnabled: false,
        effectiveEnabled: false,
        recordCount: 0,
      }),
    );
    expect(createEvaluationRecord(store, recordInput())).toBeUndefined();
    expect(existsSync(store.rootDirectory)).toBe(false);
  });

  it("enables and disables recording while preserving existing records", () => {
    const { store } = fixture();

    expect(setEvaluationEnabled(store, true)).toEqual({ schemaVersion: 1, enabled: true });
    const record = createRequiredRecord(store);
    expect(getEvaluationStatus(store)).toEqual(
      expect.objectContaining({
        configState: "enabled",
        globallyEnabled: true,
        effectiveEnabled: true,
        recordCount: 1,
      }),
    );

    setEvaluationEnabled(store, false);
    expect(createEvaluationRecord(store, recordInput())).toBeUndefined();
    expect(readEvaluationRecord(store, record.id).id).toBe(record.id);
    expect(getEvaluationStatus(store).recordCount).toBe(1);
  });

  it("fails closed for malformed and unsupported config", () => {
    const { store } = fixture();
    mkdirSync(store.rootDirectory, { recursive: true });
    writeFileSync(store.configPath, "not-json");

    let status = getEvaluationStatus(store);
    expect(status.configState).toBe("invalid");
    expect(status.effectiveEnabled).toBe(false);
    expect(status.warnings).toHaveLength(1);
    expect(createEvaluationRecord(store, recordInput())).toBeUndefined();

    writeFileSync(store.configPath, JSON.stringify({ schemaVersion: 2, enabled: true }));
    status = getEvaluationStatus(store);
    expect(status.configState).toBe("invalid");
    expect(status.globallyEnabled).toBe(false);
  });

  it("lets an ancestor marker override global enablement without reading its contents", () => {
    const { store, project } = enabledFixture();
    const marker = join(dirname(project), ".minecraft-skills", "evaluation.disabled");
    mkdirSync(marker, { recursive: true });

    const status = getEvaluationStatus(store);
    expect(status.disabledByMarker).toBe(true);
    expect(status.markerPath).toBe(marker);
    expect(status.effectiveEnabled).toBe(false);
    expect(createEvaluationRecord(store, recordInput())).toBeUndefined();
  });

  it("reports a marker even while global recording is disabled", () => {
    const { store, project } = fixture();
    const marker = join(project, ".minecraft-skills", "evaluation.disabled");
    mkdirSync(dirname(marker), { recursive: true });
    writeFileSync(marker, "");

    const status = getEvaluationStatus(store);
    expect(status.globallyEnabled).toBe(false);
    expect(status.disabledByMarker).toBe(true);
    expect(status.markerPath).toBe(marker);
    expect(status.effectiveEnabled).toBe(false);
    expect(existsSync(store.rootDirectory)).toBe(false);
  });

  it("treats a symlink marker as an existing filesystem entry", () => {
    const { store, project } = enabledFixture();
    const marker = join(project, ".minecraft-skills", "evaluation.disabled");
    const target = join(temporaryDirectory("minecraft-skills-marker-target-"), "target");
    mkdirSync(dirname(marker), { recursive: true });
    writeFileSync(target, "marker target contents are not read");
    try {
      symlinkSync(target, marker, "file");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EPERM") {
        return;
      }
      throw error;
    }

    const status = getEvaluationStatus(store);
    expect(status.disabledByMarker).toBe(true);
    expect(status.markerCheckFailed).toBe(false);
    expect(status.markerPath).toBe(marker);
    expect(status.effectiveEnabled).toBe(false);
  });

  it("checks every file root and accepts file URLs and URI objects", () => {
    const { store } = enabledFixture();
    const first = temporaryDirectory("minecraft-skills-root-a-");
    const second = temporaryDirectory("minecraft-skills-root-b-");
    const marker = join(second, ".minecraft-skills", "evaluation.disabled");
    mkdirSync(dirname(marker), { recursive: true });
    writeFileSync(marker, "disabled locally");

    const status = getEvaluationStatus(store, {
      roots: [pathToFileURL(first), { uri: pathToFileURL(second).href }],
    });
    expect(status.checkedRoots).toEqual([first, second]);
    expect(status.markerPath).toBe(marker);
    expect(status.effectiveEnabled).toBe(false);
  });

  it("falls back to cwd when roots contain no file URI", () => {
    const { store, project } = enabledFixture();
    const marker = join(project, ".minecraft-skills", "evaluation.disabled");
    mkdirSync(dirname(marker), { recursive: true });
    writeFileSync(marker, "");

    const status = getEvaluationStatus(store, { roots: ["https://example.test/root"] });
    expect(status.checkedRoots).toEqual([project]);
    expect(status.markerPath).toBe(marker);
  });
});

describe("evaluation record persistence", () => {
  it("round-trips raw JSON request and result without adding conversation context", () => {
    const { store } = enabledFixture();
    const argumentsValue = {
      log: "private log line",
      path: "C:/private/server.properties",
      nested: { secretSetting: true },
    };
    const resultValue = {
      content: [{ type: "text", text: "127.0.0.1" }],
      structuredContent: { configured: true },
    };

    const created = createRequiredRecord(
      store,
      recordInput({
        request: { tool: "inspect_minecraft_log", arguments: argumentsValue },
        response: { outcome: "success", result: resultValue },
      }),
    );
    const read = readEvaluationRecord(store, created.id);

    expect(read.request).toEqual({
      method: "tools/call",
      tool: "inspect_minecraft_log",
      arguments: argumentsValue,
    });
    expect(read.response).toEqual({ outcome: "success", result: resultValue });
    expect(read).not.toHaveProperty("conversation");
    expect(read).not.toHaveProperty("cwd");
    expect(read).not.toHaveProperty("session");
  });

  it("round-trips JSON own keys such as __proto__ without prototype mutation", () => {
    const { store } = enabledFixture();
    const specialArguments = JSON.parse(
      '{"__proto__":{"polluted":"argument"},"constructor":"own-constructor","prototype":"own-prototype"}',
    ) as Record<string, unknown>;
    const specialResult = JSON.parse(
      '{"__proto__":{"polluted":"result"},"constructor":{"nested":true}}',
    ) as Record<string, unknown>;

    const record = createRequiredRecord(
      store,
      recordInput({
        request: { tool: "special_json_keys", arguments: specialArguments },
        response: { outcome: "success", result: specialResult },
      }),
    );
    const read = readEvaluationRecord(store, record.id);
    const argumentsValue = read.request.arguments as Record<string, unknown>;
    const responseValue =
      read.response.outcome === "success"
        ? (read.response.result as Record<string, unknown>)
        : undefined;

    expect(Object.getPrototypeOf(argumentsValue)).toBeNull();
    expect(Object.hasOwn(argumentsValue, "__proto__")).toBe(true);
    expect(Object.hasOwn(argumentsValue, "constructor")).toBe(true);
    expect(JSON.stringify(argumentsValue)).toBe(JSON.stringify(specialArguments));
    expect(responseValue).toBeDefined();
    expect(Object.getPrototypeOf(responseValue)).toBeNull();
    expect(Object.hasOwn(responseValue ?? {}, "__proto__")).toBe(true);
    expect(JSON.stringify(responseValue)).toBe(JSON.stringify(specialResult));
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
  });

  it("normalizes protocol errors without persisting their stack or extra fields", () => {
    const { store } = enabledFixture();
    const error = new Error("tool exploded");
    error.stack = "PRIVATE STACK";
    Object.assign(error, { token: "secret" });

    const record = createRequiredRecord(
      store,
      recordInput({ response: { outcome: "protocol-error", error } }),
    );
    const raw = readFileSync(join(store.recordsDirectory, `${record.id}.json`), "utf8");

    expect(readEvaluationRecord(store, record.id).response).toEqual({
      outcome: "protocol-error",
      error: { name: "Error", message: "tool exploded" },
    });
    expect(raw).not.toContain("PRIVATE STACK");
    expect(raw).not.toContain("token");
    expect(normalizeEvaluationError("cancelled")).toEqual({
      name: "Error",
      message: "cancelled",
    });
  });

  it("writes one UUID JSON file per call across concurrent child processes", async () => {
    const { store } = enabledFixture();
    const workerCount = 6;
    const recordsPerWorker = 8;
    await Promise.all(
      Array.from({ length: workerCount }, (_, worker) =>
        runParallelWriter(store, worker, recordsPerWorker),
      ),
    );
    const files = readdirSync(store.recordsDirectory);
    const records = searchEvaluationRecords(store, { tool: "parallel_writer", limit: 100 });

    expect(records.records).toHaveLength(workerCount * recordsPerWorker);
    expect(new Set(records.records.map((record) => record.id)).size).toBe(
      workerCount * recordsPerWorker,
    );
    expect(files).toHaveLength(workerCount * recordsPerWorker);
    expect(files.every((file) => /^[0-9a-f-]{36}\.json$/.test(file))).toBe(true);
    expect(files.some((file) => file.endsWith(".tmp"))).toBe(false);
  });

  it("rejects non-JSON values without leaving a partial record", () => {
    const { store } = enabledFixture();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() =>
      createEvaluationRecord(store, recordInput({ request: { tool: "bad", arguments: circular } })),
    ).toThrow(/circular reference/);
    expect(() =>
      createEvaluationRecord(
        store,
        recordInput({ response: { outcome: "success", result: { value: undefined } } }),
      ),
    ).toThrow(/non-JSON value/);
    expect(getEvaluationStatus(store).recordCount).toBe(0);
  });

  it("creates restrictive POSIX modes on directories and files", () => {
    if (process.platform === "win32") {
      return;
    }
    const { store } = enabledFixture();
    const record = createRequiredRecord(store);

    expect(statSync(store.rootDirectory).mode & 0o777).toBe(0o700);
    expect(statSync(store.recordsDirectory).mode & 0o777).toBe(0o700);
    expect(statSync(store.configPath).mode & 0o777).toBe(0o600);
    expect(statSync(join(store.recordsDirectory, `${record.id}.json`)).mode & 0o777).toBe(0o600);
  });
});

describe("assessment, search, and aggregation", () => {
  it("adds and replaces a validated assessment even when recording is disabled", () => {
    const { store } = enabledFixture();
    const record = createRequiredRecord(store);
    setEvaluationEnabled(store, false);

    let updated = rateEvaluationRecord(store, record.id, {
      score: 2,
      informationNeed: "Paper API のイベント仕様を確認したかった",
      comment: "必要なフィールドが不足していた",
      missingFeatures: [{ key: "event-fields", summary: "イベントの全フィールド" }],
      source: "cli",
      evaluatedAt: "2026-08-31T01:00:00Z",
    });
    expect(updated.evaluation?.score).toBe(2);

    updated = rateEvaluationRecord(store, record.id, {
      score: 5,
      informationNeed: "Paper API のイベント仕様を確認したかった",
      comment: "別の情報で解決した",
      source: "mcp",
      evaluatedAt: "2026-08-31T02:00:00Z",
    });
    expect(updated.evaluation).toEqual(
      expect.objectContaining({ score: 5, source: "mcp", missingFeatures: [] }),
    );
  });

  it("enforces assessment lengths, score, kebab-case keys, count, and uniqueness", () => {
    const { store } = enabledFixture();
    const record = createRequiredRecord(store);
    const base = {
      score: 3 as const,
      informationNeed: "need",
      comment: "comment",
      source: "cli" as const,
    };

    expect(() => rateEvaluationRecord(store, record.id, { ...base, score: 0 as 1 })).toThrow(
      /integer 1-5/,
    );
    expect(() =>
      rateEvaluationRecord(store, record.id, {
        ...base,
        informationNeed: "x".repeat(2001),
      }),
    ).toThrow(/at most 2000/);
    expect(() =>
      rateEvaluationRecord(store, record.id, {
        ...base,
        comment: "x".repeat(4001),
      }),
    ).toThrow(/at most 4000/);
    expect(() =>
      rateEvaluationRecord(store, record.id, {
        ...base,
        missingFeatures: [{ key: "Not_Kebab", summary: "bad" }],
      }),
    ).toThrow(/kebab-case/);
    expect(() =>
      rateEvaluationRecord(store, record.id, {
        ...base,
        missingFeatures: [
          { key: "same-key", summary: "one" },
          { key: "same-key", summary: "two" },
        ],
      }),
    ).toThrow(/unique/);
    expect(() =>
      rateEvaluationRecord(store, record.id, {
        ...base,
        missingFeatures: Array.from({ length: 21 }, (_, index) => ({
          key: `gap-${index}`,
          summary: "gap",
        })),
      }),
    ).toThrow(/at most 20/);
  });

  it("searches safe summaries by every supported filter in newest-first order", () => {
    const { store } = enabledFixture();
    const old = createRequiredRecord(
      store,
      recordInput({
        completedAt: "2026-08-01T00:00:00Z",
        request: { tool: "lookup_registry", arguments: { rawSecret: "never display" } },
      }),
    );
    const recent = createRequiredRecord(
      store,
      recordInput({
        completedAt: "2026-08-20T00:00:00Z",
        runtime: { mcpVersion: "0.2.0", dataVersion: "2026.08.20" },
        request: { tool: "lookup_registry", arguments: { rawSecret: "never display" } },
      }),
    );
    createRequiredRecord(
      store,
      recordInput({
        completedAt: "2026-08-25T00:00:00Z",
        request: { tool: "inspect_log", arguments: {} },
      }),
    );
    rateEvaluationRecord(store, old.id, {
      score: 2,
      informationNeed: "biome registry entries",
      comment: "missing tag details",
      missingFeatures: [{ key: "registry-tags", summary: "tag membership" }],
      source: "cli",
    });
    rateEvaluationRecord(store, recent.id, {
      score: 4,
      informationNeed: "biome registry entries",
      comment: `mostly complete; related record ${old.id}`,
      missingFeatures: [{ key: "registry-tags", summary: "tag membership" }],
      source: "mcp",
    });

    const filtered = searchEvaluationRecords(store, {
      query: "biome",
      tool: "lookup_registry",
      evaluated: true,
      minScore: 3,
      maxScore: 5,
      missingFeature: "registry-tags",
      from: "2026-08-10T00:00:00Z",
      to: "2026-08-31T00:00:00Z",
      limit: 1,
    });
    expect(filtered.records).toEqual([
      expect.objectContaining({
        id: recent.id,
        score: 4,
        tool: "lookup_registry",
        mcpVersion: "0.2.0",
        dataVersion: "2026.08.20",
      }),
    ]);
    expect(JSON.stringify(filtered)).not.toContain("never display");
    expect(
      searchEvaluationRecords(store, { query: "0.2.0" }).records.map((entry) => entry.id),
    ).toEqual([recent.id]);
    expect(
      searchEvaluationRecords(store, { query: "2026.08.20" }).records.map((entry) => entry.id),
    ).toEqual([recent.id]);
    expect(
      searchEvaluationRecords(store, { id: old.id, evaluated: true, limit: 1 }).records.map(
        (entry) => entry.id,
      ),
    ).toEqual([old.id]);
    expect(searchEvaluationRecords(store, { query: old.id }).records[0]?.id).toBe(recent.id);
    expect(searchEvaluationRecords(store, { evaluated: false }).records).toHaveLength(1);
    expect(searchEvaluationRecords(store).records.map((entry) => entry.id)).toEqual([
      expect.any(String),
      recent.id,
      old.id,
    ]);
  });

  it("defaults search to 20 records and rejects invalid ranges and limits", () => {
    const { store } = enabledFixture();
    for (let index = 0; index < 25; index += 1) {
      createRequiredRecord(
        store,
        recordInput({ completedAt: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00Z` }),
      );
    }

    expect(searchEvaluationRecords(store).records).toHaveLength(20);
    expect(() => searchEvaluationRecords(store, { limit: 101 })).toThrow(/between 1 and 100/);
    expect(() => searchEvaluationRecords(store, { id: "not-a-record-id" })).toThrow(
      /Invalid evaluation record ID/,
    );
    expect(() => searchEvaluationRecords(store, { minScore: 5, maxScore: 2 })).toThrow(
      /must not exceed/,
    );
    expect(() => searchEvaluationRecords(store, { from: "2026-09-01", to: "2026-08-01" })).toThrow(
      /from must not be after to/,
    );
  });

  it("aggregates recurring missing-feature keys across all matching records", () => {
    const { store } = enabledFixture();
    const first = createRequiredRecord(
      store,
      recordInput({
        completedAt: "2026-08-01T00:00:00Z",
        runtime: { mcpVersion: "0.1.6", dataVersion: "2026.08.01" },
        request: { tool: "tool_a", arguments: {} },
      }),
    );
    const second = createRequiredRecord(
      store,
      recordInput({
        completedAt: "2026-08-20T00:00:00Z",
        runtime: { mcpVersion: "0.2.0", dataVersion: "2026.08.20" },
        request: { tool: "tool_b", arguments: {} },
      }),
    );
    rateEvaluationRecord(store, first.id, {
      score: 2,
      informationNeed: "Need exact fields",
      comment: "Missing fields",
      missingFeatures: [
        { key: "exact-fields", summary: "All fields" },
        { key: "examples", summary: "Examples" },
      ],
      source: "cli",
    });
    rateEvaluationRecord(store, second.id, {
      score: 4,
      informationNeed: "Need exact fields",
      comment: "Some fields absent",
      missingFeatures: [{ key: "exact-fields", summary: "Complete field list" }],
      source: "mcp",
    });

    const result = aggregateMissingFeatures(store);
    expect(result.gaps[0]).toEqual({
      key: "exact-fields",
      count: 2,
      averageScore: 3,
      tools: ["tool_a", "tool_b"],
      mcpVersions: ["0.1.6", "0.2.0"],
      dataVersions: ["2026.08.01", "2026.08.20"],
      firstSeenAt: "2026-08-01T00:00:00.000Z",
      lastSeenAt: "2026-08-20T00:00:00.000Z",
      recordIds: [second.id, first.id],
      summaries: ["Complete field list", "All fields"],
    });
    expect(aggregateMissingFeatures(store, { tool: "tool_a" }).gaps).toHaveLength(2);
    expect(aggregateMissingFeatures(store, { minScore: 3 }).gaps).toEqual([
      expect.objectContaining({ key: "exact-fields", count: 1, averageScore: 4 }),
    ]);
  });
});

describe("record validation, deletion, and path safety", () => {
  it("reports missing and corrupt records without hiding valid requested records", () => {
    const { store } = enabledFixture();
    const record = createRequiredRecord(store);
    const missingId = "11111111-1111-4111-8111-111111111111";
    const corruptId = "22222222-2222-4222-8222-222222222222";
    writeFileSync(join(store.recordsDirectory, `${corruptId}.json`), "not-json");

    const result = readEvaluationRecords(store, [record.id, missingId, corruptId]);
    expect(result.records.map((entry) => entry.id)).toEqual([record.id]);
    expect(result.notFound).toEqual([missingId]);
    expect(result.warnings).toHaveLength(1);
  });

  it("skips unknown schema versions in search and rejects them when read directly", () => {
    const { store } = enabledFixture();
    const id = "33333333-3333-4333-8333-333333333333";
    mkdirSync(store.recordsDirectory, { recursive: true });
    writeFileSync(
      join(store.recordsDirectory, `${id}.json`),
      JSON.stringify({ schemaVersion: 2, id }),
    );

    const result = searchEvaluationRecords(store);
    expect(result.records).toEqual([]);
    expect(result.warnings[0]?.message).toBe(
      "Skipped unreadable, unsafe, or invalid evaluation record",
    );
    expect(() => readEvaluationRecord(store, id)).toThrow(/Unsupported evaluation schemaVersion/);
  });

  it("never includes corrupt record excerpts in search or gap warnings", () => {
    const { store } = enabledFixture();
    const invalidJsonId = "77777777-7777-4777-8777-777777777777";
    const invalidSchemaId = "88888888-8888-4888-8888-888888888888";
    const privateExcerpt = "PRIVATE-RAW-RESPONSE-EXCERPT";
    mkdirSync(store.recordsDirectory, { recursive: true });
    writeFileSync(
      join(store.recordsDirectory, `${invalidJsonId}.json`),
      `{ "secret": "${privateExcerpt}", broken`,
    );
    writeFileSync(
      join(store.recordsDirectory, `${invalidSchemaId}.json`),
      JSON.stringify({ schemaVersion: privateExcerpt, id: invalidSchemaId }),
    );

    const search = searchEvaluationRecords(store);
    const gaps = aggregateMissingFeatures(store);
    expect(search.warnings).toHaveLength(2);
    expect(gaps.warnings).toHaveLength(2);
    expect(JSON.stringify(search)).not.toContain(privateExcerpt);
    expect(JSON.stringify(gaps)).not.toContain(privateExcerpt);
    expect(new Set(search.warnings.map((entry) => entry.message))).toEqual(
      new Set(["Skipped unreadable, unsafe, or invalid evaluation record"]),
    );
  });

  it("requires UUID identifiers and prevents path traversal", () => {
    const { store } = enabledFixture();
    expect(() => readEvaluationRecord(store, "../../config")).toThrow(EvaluationStoreError);
    expect(() => rateEvaluationRecord(store, "not-a-uuid", {} as never)).toThrow(/Invalid.*ID/);
    expect(() => deleteEvaluationRecords(store, { ids: ["../secret"] })).toThrow(/Invalid.*ID/);
  });

  it("deletes selected records and deletes all remaining regular record files", () => {
    const { store } = enabledFixture();
    const first = createRequiredRecord(store);
    const second = createRequiredRecord(store);
    const missingId = "44444444-4444-4444-8444-444444444444";

    expect(deleteEvaluationRecords(store, { ids: [first.id, missingId] })).toEqual({
      deleted: [first.id],
      notFound: [missingId],
      cleanup: { temporaryFilesDeleted: 0 },
      warnings: [],
    });
    expect(existsSync(join(store.recordsDirectory, `${second.id}.json`))).toBe(true);
    expect(deleteEvaluationRecords(store, { all: true }).deleted).toEqual([second.id]);
    expect(getEvaluationStatus(store).recordCount).toBe(0);
  });

  it("cleans only owned crash-residue temporary files during delete all", () => {
    const { store } = enabledFixture();
    const record = createRequiredRecord(store);
    const nonce = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const ownedName = `.${record.id}.json.12345.${nonce}.tmp`;
    const ownedPath = join(store.recordsDirectory, ownedName);
    const unrelatedNames = [
      ".unrelated-hidden-file",
      `.${record.id}.json.0.${nonce}.tmp`,
      `.${record.id}.json.12345.${nonce}.tmp.backup`,
      `.config.json.12345.${nonce}.tmp`,
      `.${record.id}.json.12345.aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa.tmp`,
      `.${record.id.toUpperCase()}.json.22222.${nonce}.tmp`,
    ];
    writeFileSync(ownedPath, "private incomplete payload");
    for (const name of unrelatedNames) {
      writeFileSync(join(store.recordsDirectory, name), "leave me");
    }
    const linkedNonce = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const linkedName = `.${record.id}.json.54321.${linkedNonce}.tmp`;
    const linkedPath = join(store.recordsDirectory, linkedName);
    const externalTemporaryFile = join(
      temporaryDirectory("minecraft-skills-external-temp-"),
      "external.tmp",
    );
    writeFileSync(externalTemporaryFile, "external payload");
    let linkedTemporaryFile = false;
    try {
      symlinkSync(externalTemporaryFile, linkedPath, "file");
      linkedTemporaryFile = true;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EPERM")) {
        throw error;
      }
    }

    const selected = deleteEvaluationRecords(store, { ids: [record.id] });
    expect(selected).toEqual({
      deleted: [record.id],
      notFound: [],
      cleanup: { temporaryFilesDeleted: 0 },
      warnings: [],
    });
    expect(existsSync(ownedPath)).toBe(true);

    const all = deleteEvaluationRecords(store, { all: true });
    expect(all).toEqual(
      expect.objectContaining({
        deleted: [],
        notFound: [],
        cleanup: { temporaryFilesDeleted: 1 },
      }),
    );
    expect(all.warnings).toHaveLength(linkedTemporaryFile ? 1 : 0);
    expect(existsSync(ownedPath)).toBe(false);
    for (const name of unrelatedNames) {
      expect(readFileSync(join(store.recordsDirectory, name), "utf8")).toBe("leave me");
    }
    if (linkedTemporaryFile) {
      expect(lstatSync(linkedPath).isSymbolicLink()).toBe(true);
    }
    expect(readFileSync(externalTemporaryFile, "utf8")).toBe("external payload");
    expect(JSON.stringify(all)).not.toContain(ownedName);
  });

  it("refuses to follow a symlinked records directory", () => {
    const { store } = enabledFixture();
    const external = temporaryDirectory("minecraft-skills-external-");
    const secret = join(external, "secret.txt");
    writeFileSync(secret, "must remain untouched");
    try {
      symlinkSync(external, store.recordsDirectory, "junction");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EPERM") {
        return;
      }
      throw error;
    }

    expect(lstatSync(store.recordsDirectory).isSymbolicLink()).toBe(true);
    expect(getEvaluationGateStatus(store)).toEqual(
      expect.objectContaining({ effectiveEnabled: true, warnings: [] }),
    );
    expect(() => createEvaluationRecord(store, recordInput())).toThrow(/symlink component/);
    const status = getEvaluationStatus(store);
    expect(status.recordCount).toBe(0);
    expect(status.warnings.some((entry) => entry.message.includes("unreadable or unsafe"))).toBe(
      true,
    );
    expect(readFileSync(secret, "utf8")).toBe("must remain untouched");
  });

  it("refuses to follow a symlinked storage root", () => {
    const parent = temporaryDirectory("minecraft-skills-symlink-root-");
    const external = temporaryDirectory("minecraft-skills-external-root-");
    const linkedRoot = join(parent, "history");
    mkdirSync(join(external, "records"), { recursive: true });
    try {
      symlinkSync(external, linkedRoot, "junction");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EPERM") {
        return;
      }
      throw error;
    }
    const store = createEvaluationStore({ rootDirectory: linkedRoot });
    const id = "66666666-6666-4666-8666-666666666666";

    expect(getEvaluationStatus(store).configState).toBe("invalid");
    expect(searchEvaluationRecords(store).warnings).toEqual([
      expect.objectContaining({ message: expect.stringContaining("unreadable or unsafe") }),
    ]);
    expect(() => readEvaluationRecord(store, id)).toThrow(/symlink component/);
    expect(deleteEvaluationRecords(store, { ids: [id] }).warnings).toEqual([
      expect.objectContaining({ message: expect.stringContaining("symlink component") }),
    ]);
  });

  it("fails closed when an ancestor of the storage root is a symlink", () => {
    const parent = temporaryDirectory("minecraft-skills-ancestor-link-");
    const external = temporaryDirectory("minecraft-skills-ancestor-target-");
    const linkedParent = join(parent, "linked-parent");
    try {
      symlinkSync(external, linkedParent, "junction");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EPERM") {
        return;
      }
      throw error;
    }
    const store = createEvaluationStore({ rootDirectory: join(linkedParent, "evaluation") });

    expect(() => setEvaluationEnabled(store, true)).toThrow(/symlink component/);
    expect(existsSync(join(external, "evaluation"))).toBe(false);
    expect(getEvaluationGateStatus(store)).toEqual(
      expect.objectContaining({
        configState: "invalid",
        globallyEnabled: false,
        effectiveEnabled: false,
      }),
    );
  });

  it("refuses to read or replace a symlinked config file", () => {
    const { store } = fixture();
    mkdirSync(store.rootDirectory, { recursive: true });
    const external = join(temporaryDirectory("minecraft-skills-external-config-"), "config.json");
    writeFileSync(external, JSON.stringify({ schemaVersion: 1, enabled: true }));
    try {
      symlinkSync(external, store.configPath, "file");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EPERM") {
        return;
      }
      throw error;
    }

    expect(getEvaluationGateStatus(store).configState).toBe("invalid");
    expect(() => setEvaluationEnabled(store, true)).toThrow(/symlink component/);
    expect(readFileSync(external, "utf8")).toContain('"enabled":true');
  });

  it("does not follow symlinked record files during read, search, or delete", () => {
    const { store } = enabledFixture();
    mkdirSync(store.recordsDirectory, { recursive: true });
    const external = join(temporaryDirectory("minecraft-skills-external-file-"), "external.json");
    const id = "55555555-5555-4555-8555-555555555555";
    writeFileSync(external, JSON.stringify({ secret: true }));
    const link = join(store.recordsDirectory, `${id}.json`);
    try {
      symlinkSync(external, link, "file");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EPERM") {
        return;
      }
      throw error;
    }

    expect(() => readEvaluationRecord(store, id)).toThrow(/regular file|symlink component/);
    expect(searchEvaluationRecords(store).records).toEqual([]);
    expect(deleteEvaluationRecords(store, { ids: [id] }).warnings).toHaveLength(1);
    expect(existsSync(external)).toBe(true);
    expect(readFileSync(external, "utf8")).toContain("secret");
  });
});
