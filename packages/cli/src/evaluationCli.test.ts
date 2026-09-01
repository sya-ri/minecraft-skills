import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createEvaluationRecord,
  createEvaluationStore,
  type EvaluationStore,
  setEvaluationEnabled,
} from "@minecraft-skills/evaluation-core";
import { afterEach, describe, expect, it } from "vitest";
import { runEvaluationCli } from "./evaluationCli.js";

type Captured = {
  code: number;
  stdout: string[];
  stderr: string[];
};

const temporaryDirectories: string[] = [];

function evaluationFixture(): { directory: string; store: EvaluationStore } {
  const directory = mkdtempSync(join(tmpdir(), "minecraft-skills-evaluation-cli-"));
  const cwd = join(directory, "project");
  mkdirSync(cwd);
  temporaryDirectories.push(directory);
  return {
    directory,
    store: createEvaluationStore({
      rootDirectory: join(directory, "evaluation"),
      cwd,
    }),
  };
}

function capture(args: string[], store: EvaluationStore): Captured {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = runEvaluationCli(
    args,
    {
      write: (value) => stdout.push(value),
      error: (value) => stderr.push(value),
    },
    store,
  );
  return { code, stdout, stderr };
}

function createRecord(
  store: EvaluationStore,
  options: {
    tool?: string;
    startedAt?: string;
    completedAt?: string;
    secret?: string;
  } = {},
) {
  const record = createEvaluationRecord(store, {
    startedAt: options.startedAt ?? "2026-01-01T00:00:00.000Z",
    completedAt: options.completedAt ?? "2026-01-01T00:00:00.010Z",
    runtime: {
      mcpVersion: "0.1.6",
      dataVersion: "2026.01.01-1",
    },
    request: {
      tool: options.tool ?? "find_version_detail",
      arguments: { privateToken: options.secret ?? "never-show-in-search" },
    },
    response: {
      outcome: "success",
      result: { privatePath: "C:/private/server.properties", found: true },
    },
  });
  if (!record) {
    throw new Error("Expected evaluation recording to be enabled in the test fixture");
  }
  return record;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("evaluation CLI", () => {
  it("is disabled by default without creating its storage directory", () => {
    const { store } = evaluationFixture();

    const help = capture(["--help"], store);
    const status = capture(["status"], store);
    const parsed = JSON.parse(status.stdout[0] ?? "{}") as Record<string, unknown>;

    expect(help).toMatchObject({ code: 0, stderr: [] });
    expect(help.stdout.join("\n")).toContain("evaluation enable");
    expect(status).toMatchObject({ code: 0, stderr: [] });
    expect(parsed).toMatchObject({
      configState: "missing",
      globallyEnabled: false,
      effectiveEnabled: false,
      recordCount: 0,
      storageDirectory: store.rootDirectory,
    });
    expect(existsSync(store.rootDirectory)).toBe(false);
  });

  it("enables recording with a privacy warning and retains history after disable", () => {
    const { store } = evaluationFixture();

    const enabled = capture(["enable"], store);
    const record = createRecord(store);
    const disabled = capture(["disable"], store);
    const search = capture(["search"], store);

    expect(enabled.code).toBe(0);
    expect(enabled.stderr.join("\n")).toContain("raw MCP tool arguments and results");
    expect(enabled.stderr.join("\n")).toContain("Restart the MCP server");
    expect(disabled).toMatchObject({ code: 0, stderr: [] });
    expect(JSON.parse(disabled.stdout[0] ?? "{}")).toMatchObject({
      globallyEnabled: false,
      effectiveEnabled: false,
      recordCount: 1,
    });
    expect(search.stdout.join("\n")).toContain(record.id);
  });

  it("shows raw data only through show and warns before doing so", () => {
    const { store } = evaluationFixture();
    setEvaluationEnabled(store, true);
    const record = createRecord(store, { secret: "highly-sensitive-input" });

    const search = capture(["search", "highly-sensitive-input"], store);
    const show = capture(["show", record.id], store);

    expect(search.code).toBe(0);
    expect(search.stdout.join("\n")).not.toContain("highly-sensitive-input");
    expect(JSON.parse(search.stdout[0] ?? "{}")).toMatchObject({ records: [] });
    expect(show.code).toBe(0);
    expect(show.stderr.join("\n")).toContain("contains raw MCP tool arguments and results");
    expect(show.stdout.join("\n")).toContain("highly-sensitive-input");
    expect(show.stdout.join("\n")).toContain("C:/private/server.properties");
  });

  it("rates records and applies every summary-search filter without exposing raw fields", () => {
    const { store } = evaluationFixture();
    setEvaluationEnabled(store, true);
    const evaluated = createRecord(store, {
      tool: "find_version_detail",
      completedAt: "2026-01-10T00:00:00.000Z",
    });
    const pending = createRecord(store, {
      tool: "get_version",
      startedAt: "2026-02-01T00:00:00.000Z",
      completedAt: "2026-02-01T00:00:00.010Z",
      secret: "pending-secret",
    });

    const rated = capture(
      [
        "rate",
        evaluated.id,
        "--score",
        "2",
        "--information-need",
        "Determine target-version registry support",
        "--comment",
        "The result was useful but omitted registry metadata",
        "--missing-feature",
        "registry-metadata=Return registry source and stability metadata",
        "--missing-feature",
        "cross-version-diff=Compare the selected versions",
      ],
      store,
    );
    const filtered = capture(
      [
        "search",
        "target-version",
        "--tool",
        "find_version_detail",
        "--evaluated",
        "true",
        "--min-score",
        "2",
        "--max-score",
        "2",
        "--missing-feature",
        "registry-metadata",
        "--since",
        "2026-01-01T00:00:00.000Z",
        "--until",
        "2026-01-31T23:59:59.999Z",
        "--limit",
        "1",
      ],
      store,
    );
    const unevaluated = capture(["search", "--evaluated", "false"], store);

    expect(rated.code).toBe(0);
    expect(JSON.parse(rated.stdout[0] ?? "{}")).toMatchObject({
      id: evaluated.id,
      evaluation: {
        score: 2,
        source: "cli",
        missingFeatures: [{ key: "registry-metadata" }, { key: "cross-version-diff" }],
      },
    });
    expect(filtered.code).toBe(0);
    expect(JSON.parse(filtered.stdout[0] ?? "{}")).toMatchObject({
      records: [
        {
          id: evaluated.id,
          tool: "find_version_detail",
          mcpVersion: "0.1.6",
          dataVersion: "2026.01.01-1",
          score: 2,
          informationNeed: "Determine target-version registry support",
          missingFeatureKeys: ["registry-metadata", "cross-version-diff"],
        },
      ],
    });
    expect(filtered.stdout.join("\n")).not.toContain("privateToken");
    expect(JSON.parse(unevaluated.stdout[0] ?? "{}")).toMatchObject({
      records: [{ id: pending.id, score: null }],
    });
  });

  it("aggregates missing-feature gaps", () => {
    const { store } = evaluationFixture();
    setEvaluationEnabled(store, true);
    const first = createRecord(store, {
      tool: "find_version_detail",
      completedAt: "2026-01-10T00:00:00.000Z",
    });
    const second = createRecord(store, {
      tool: "get_version",
      startedAt: "2026-01-11T00:00:00.000Z",
      completedAt: "2026-01-11T00:00:00.010Z",
    });
    for (const [id, score, need] of [
      [first.id, "2", "Compare registry metadata"],
      [second.id, "4", "Inspect registry metadata"],
    ] as const) {
      expect(
        capture(
          [
            "rate",
            id,
            "--score",
            score,
            "--information-need",
            need,
            "--comment",
            "Metadata was incomplete",
            "--missing-feature",
            "registry-metadata=Return registry metadata",
          ],
          store,
        ).code,
      ).toBe(0);
    }

    const gaps = capture(
      [
        "gaps",
        "registry",
        "--missing-feature",
        "registry-metadata",
        "--since",
        "2026-01-01T00:00:00.000Z",
        "--until",
        "2026-01-31T23:59:59.999Z",
      ],
      store,
    );

    expect(gaps.code).toBe(0);
    expect(JSON.parse(gaps.stdout[0] ?? "{}")).toMatchObject({
      gaps: [
        {
          key: "registry-metadata",
          count: 2,
          averageScore: 3,
          tools: ["find_version_detail", "get_version"],
          mcpVersions: ["0.1.6"],
          dataVersions: ["2026.01.01-1"],
          recordIds: expect.arrayContaining([first.id, second.id]),
        },
      ],
    });
    expect(gaps.stdout.join("\n")).not.toContain("privateToken");
  });

  it("validates rating and search options", () => {
    const { store } = evaluationFixture();
    setEvaluationEnabled(store, true);
    const record = createRecord(store);

    const cases: Array<[string[], string]> = [
      [["rate", record.id, "--score", "0"], "evaluation rate requires --information-need"],
      [
        ["rate", record.id, "--score", "6", "--information-need", "Need", "--comment", "Comment"],
        "--score must be an integer from 1 to 5",
      ],
      [
        [
          "rate",
          record.id,
          "--score",
          "3",
          "--information-need",
          "Need",
          "--comment",
          "Comment",
          "--missing-feature",
          "missing-separator",
        ],
        "--missing-feature must use key=summary",
      ],
      [["search", "--evaluated", "maybe"], "--evaluated must be true or false"],
      [["search", "--limit", "101"], "--limit must be an integer from 1 to 100"],
      [["search", "--since", "not-a-date"], "--since must be a valid ISO timestamp"],
      [
        ["search", "--min-score", "5", "--max-score", "2"],
        "--min-score must not exceed --max-score",
      ],
    ];

    for (const [args, message] of cases) {
      const result = capture(args, store);
      expect(result.code).toBe(1);
      expect(result.stdout).toEqual([]);
      expect(result.stderr).toEqual([message]);
    }
  });

  it("warns about corrupt records and protects bulk deletion with --yes", () => {
    const { store } = evaluationFixture();
    setEvaluationEnabled(store, true);
    const first = createRecord(store);
    const second = createRecord(store, {
      startedAt: "2026-01-02T00:00:00.000Z",
      completedAt: "2026-01-02T00:00:00.010Z",
    });
    const corruptId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    writeFileSync(join(store.recordsDirectory, `${corruptId}.json`), "not json", "utf8");

    const search = capture(["search"], store);
    const protectedDelete = capture(["delete", "--all"], store);
    const individual = capture(["delete", first.id], store);
    const missing = capture(["delete", first.id], store);
    const all = capture(["delete", "--all", "--yes"], store);

    expect(JSON.parse(search.stdout[0] ?? "{}")).toMatchObject({
      records: expect.any(Array),
      warnings: [expect.objectContaining({ path: expect.stringContaining(corruptId) })],
    });
    expect(protectedDelete).toMatchObject({
      code: 1,
      stdout: [],
      stderr: ["evaluation delete --all requires --yes"],
    });
    expect(individual.code).toBe(0);
    expect(JSON.parse(individual.stdout[0] ?? "{}")).toMatchObject({ deleted: [first.id] });
    expect(missing.code).toBe(1);
    expect(JSON.parse(missing.stdout[0] ?? "{}")).toMatchObject({ notFound: [first.id] });
    expect(all.code).toBe(0);
    expect(JSON.parse(all.stdout[0] ?? "{}")).toMatchObject({
      deleted: expect.arrayContaining([second.id, corruptId]),
    });
  });

  it("returns failure when individual or bulk deletion reports an unsafe record warning", () => {
    const { directory, store } = evaluationFixture();
    setEvaluationEnabled(store, true);
    const record = createRecord(store);
    const recordPath = join(store.recordsDirectory, `${record.id}.json`);
    const externalPath = join(directory, "external-record.json");
    writeFileSync(externalPath, "must remain untouched", "utf8");
    rmSync(recordPath);
    try {
      symlinkSync(externalPath, recordPath, "file");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EPERM") {
        return;
      }
      throw error;
    }

    const individual = capture(["delete", record.id], store);
    const all = capture(["delete", "--all", "--yes"], store);

    expect(individual.code).toBe(1);
    expect(JSON.parse(individual.stdout[0] ?? "{}")).toMatchObject({
      deleted: [],
      notFound: [],
      warnings: [expect.objectContaining({ path: recordPath })],
    });
    expect(all.code).toBe(1);
    expect(JSON.parse(all.stdout[0] ?? "{}")).toMatchObject({
      deleted: [],
      notFound: [],
      warnings: [expect.objectContaining({ path: recordPath })],
    });
    expect(existsSync(externalPath)).toBe(true);
  });
});
