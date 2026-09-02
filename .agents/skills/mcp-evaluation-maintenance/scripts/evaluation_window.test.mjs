import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildComparison,
  buildReport,
  createWindowReport,
  nextIsoTimestamp,
  parseArguments,
} from "./evaluation_window.mjs";

function record(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    startedAt: "2026-09-02T00:00:00.000Z",
    completedAt: "2026-09-02T00:00:01.000Z",
    tool: "tool_b",
    mcpVersion: "0.1.7",
    dataVersion: "data-1",
    score: 2,
    informationNeed: "Need B",
    missingFeatureKeys: ["gap-b"],
    secretFutureField: "must-not-leak",
    ...overrides,
  };
}

test("parses and normalizes a bounded scan", () => {
  const options = parseArguments([
    "--",
    "scan",
    "--since",
    "2026-09-02T22:00:00+09:00",
    "--until",
    "2026-09-03T01:00:00+09:00",
    "--tool",
    "search_commands",
    "--limit",
    "25",
  ]);

  assert.equal(options.since, "2026-09-02T13:00:00.000Z");
  assert.equal(options.until, "2026-09-02T16:00:00.000Z");
  assert.equal(options.tool, "search_commands");
  assert.equal(options.limit, 25);
});

test("rejects ambiguous or reversed scan windows", () => {
  assert.throws(() => parseArguments(["scan"]), /requires --since/);
  assert.throws(
    () => parseArguments(["scan", "--since", "2026-09-02", "--until", "2026-09-03T00:00:00Z"]),
    /explicit timezone/,
  );
  assert.throws(
    () =>
      parseArguments([
        "scan",
        "--since",
        "2026-02-30T00:00:00Z",
        "--until",
        "2026-03-03T00:00:00Z",
      ]),
    /valid ISO timestamp/,
  );
  assert.throws(
    () =>
      parseArguments([
        "scan",
        "--since",
        "2026-09-03T00:00:00Z",
        "--until",
        "2026-09-02T00:00:00Z",
      ]),
    /must not be later/,
  );
});

test("parses exact comparison IDs", () => {
  const options = parseArguments([
    "compare",
    "--before",
    "11111111-1111-4111-8111-111111111111",
    "--after",
    "22222222-2222-4222-8222-222222222222",
  ]);
  assert.equal(options.command, "compare");
  assert.throws(
    () =>
      parseArguments([
        "compare",
        "--before",
        "11111111-1111-4111-8111-111111111111",
        "--after",
        "11111111-1111-4111-8111-111111111111",
      ]),
    /must be different/,
  );
});

test("builds deterministic rankings from allowlisted fields", () => {
  const records = [
    record(),
    record({
      id: "22222222-2222-4222-8222-222222222222",
      completedAt: "2026-09-02T00:01:01.000Z",
      tool: "tool_a",
      score: 3,
      informationNeed: "Need an unkeyed capability",
      missingFeatureKeys: [],
    }),
    record({
      id: "33333333-3333-4333-8333-333333333333",
      completedAt: "2026-09-02T00:02:01.000Z",
      tool: "tool_a",
      mcpVersion: "0.1.8",
      dataVersion: "data-2",
      score: 4,
      informationNeed: "Need A",
      missingFeatureKeys: ["gap-a"],
    }),
  ];
  records[0].missingFeatureKeys = ["gap-a", "gap-b"];
  records[2].missingFeatureKeys = ["gap-a", "minor-gap"];
  const options = {
    since: "2026-09-02T00:00:00.000Z",
    until: "2026-09-03T00:00:00.000Z",
    tool: null,
    missingFeature: null,
    query: "private query",
    limit: 100,
  };

  const report = buildReport(
    { records, warnings: [{ path: "private", detail: "must-not-leak" }] },
    options,
  );

  assert.equal(report.complete, false);
  assert.equal(report.summary.records, 3);
  assert.equal(report.summary.averageScore, 3);
  assert.deepEqual(report.summary.scoreDistribution, { 1: 0, 2: 1, 3: 1, 4: 1, 5: 0 });
  assert.deepEqual(
    report.rankedGaps.map((gap) => gap.key),
    ["gap-b", "gap-a", "minor-gap"],
  );
  assert.deepEqual(
    report.tools.map((entry) => entry.tool),
    ["tool_b", "tool_a"],
  );
  assert.deepEqual(
    report.lowScoreRecordsWithoutGaps.map((entry) => entry.id),
    ["22222222-2222-4222-8222-222222222222"],
  );
  assert.equal(report.window.nextSince, "2026-09-02T00:02:01.001Z");
  assert.equal(JSON.stringify(report).includes("must-not-leak"), false);
  assert.equal(JSON.stringify(report).includes("Need B"), false);
  assert.equal(JSON.stringify(report).includes("Need an unkeyed capability"), false);
  assert.equal(JSON.stringify(report).includes("private query"), false);
  assert.equal(report.filters.queryApplied, true);
  assert.deepEqual(report.warnings, ["SEARCH_SKIPPED_RECORDS"]);
});

test("compares score and gap changes without echoing information needs", () => {
  const comparison = buildComparison(
    record({ informationNeed: "same need", missingFeatureKeys: ["fixed", "remaining"] }),
    record({
      id: "22222222-2222-4222-8222-222222222222",
      completedAt: "2026-09-03T00:00:01.000Z",
      score: 4,
      informationNeed: "same need",
      missingFeatureKeys: ["remaining", "new-gap"],
    }),
  );

  assert.equal(comparison.checks.chronological, true);
  assert.equal(comparison.checks.sameInformationNeed, true);
  assert.equal(comparison.scoreDelta, 2);
  assert.deepEqual(comparison.gaps, {
    removed: ["fixed"],
    remaining: ["remaining"],
    added: ["new-gap"],
  });
  assert.equal(JSON.stringify(comparison).includes("same need"), false);
});

test("marks a limit-sized result as incomplete", () => {
  const options = {
    since: "2026-09-02T00:00:00.000Z",
    until: "2026-09-03T00:00:00.000Z",
    tool: null,
    missingFeature: null,
    query: null,
    limit: 1,
  };
  const report = buildReport(
    { records: [record({ score: 5, missingFeatureKeys: [] })], warnings: [] },
    options,
  );

  assert.equal(report.complete, false);
  assert.deepEqual(report.warnings, ["SEARCH_LIMIT_REACHED"]);
});

test("increments continuation timestamps by one millisecond", () => {
  assert.equal(nextIsoTimestamp("2026-09-02T13:27:14.024Z"), "2026-09-02T13:27:14.025Z");
});

test("does not echo query text when the evaluation CLI fails", () => {
  const directory = mkdtempSync(join(tmpdir(), "evaluation-window-test-"));
  const cliPath = join(directory, "failing-cli.mjs");
  writeFileSync(cliPath, 'process.stderr.write(process.argv.slice(2).join(" ")); process.exit(7);');
  try {
    assert.throws(
      () =>
        createWindowReport({
          since: "2026-09-02T00:00:00.000Z",
          until: "2026-09-03T00:00:00.000Z",
          tool: null,
          missingFeature: null,
          query: "private-query-text",
          limit: 100,
          cliPath,
        }),
      (error) =>
        error instanceof Error &&
        error.message === "evaluation CLI failed with exit code 7" &&
        !error.message.includes("private-query-text"),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
