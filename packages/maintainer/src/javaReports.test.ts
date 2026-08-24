import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildJavaReportsSummary } from "./javaReports.js";

function reportsFixture(name: string): string {
  return fileURLToPath(new URL(`./fixtures/java-reports/${name}/`, import.meta.url));
}

function withReportFixture(
  reportName: "datapack.json" | "registries.json",
  report: unknown,
  callback: (reportsDir: string) => void,
): void {
  const reportsDir = mkdtempSync(join(tmpdir(), "minecraft-skills-invalid-java-reports-"));
  try {
    writeFileSync(
      join(reportsDir, "commands.json"),
      JSON.stringify({ type: "root", children: {} }),
    );
    writeFileSync(join(reportsDir, reportName), JSON.stringify(report));
    callback(reportsDir);
  } finally {
    rmSync(reportsDir, { recursive: true, force: true });
  }
}

describe("buildJavaReportsSummary", () => {
  it("summarizes registries.json without datapack.json for Java 1.20", () => {
    const result = buildJavaReportsSummary({
      version: "1.20",
      reportsDir: reportsFixture("1.20-registries-only"),
      serverJarUrl: "https://example.test/server.jar",
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(result.commandPaths).toEqual(["say <message:minecraft:message>"]);
    expect(result.summary.commands.rootLiterals).toEqual(["say"]);
    expect(result.summary.commands.argumentParsers).toEqual(["minecraft:message"]);
    expect(result.summary.datapack.otherTypes).toEqual([]);
    expect(result.summary.datapack.registries).toEqual([
      {
        id: "minecraft:biome",
        elements: null,
        stable: null,
        tags: null,
        entryCount: 2,
        protocolId: 1,
        entryIndexStatus: "indexed",
      },
    ]);
    expect(result.summary.datapack.registryEntries).toEqual({
      path: "java/registry-entries/1.20.tsv",
      coverage: "official-report",
      indexedRegistryCount: 1,
      unindexedRegistryCount: 0,
      entryCount: 2,
    });
    expect(result.registryEntries).toEqual([
      { registryId: "minecraft:biome", entryId: "minecraft:plains", protocolId: 0 },
      { registryId: "minecraft:biome", entryId: "minecraft:the_void", protocolId: 1 },
    ]);
  });

  it("unions datapack.json and registries.json registry IDs for Java 1.21.4", () => {
    const result = buildJavaReportsSummary({
      version: "1.21.4",
      reportsDir: reportsFixture("1.21.4-registry-union"),
      serverJarUrl: "https://example.test/server.jar",
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(result.summary.datapack.otherTypes).toEqual([
      {
        id: "function",
        elements: true,
        format: "mcfunction",
        stable: true,
        tags: true,
      },
    ]);
    expect(result.summary.datapack.registries).toEqual([
      {
        id: "minecraft:biome",
        elements: null,
        stable: null,
        tags: null,
        entryCount: 1,
        protocolId: 1,
        entryIndexStatus: "indexed",
      },
      {
        id: "minecraft:damage_type",
        elements: true,
        stable: false,
        tags: true,
        entryCount: 3,
        protocolId: 23,
        entryIndexStatus: "indexed",
      },
      {
        id: "minecraft:worldgen/density_function",
        elements: true,
        stable: true,
        tags: false,
        entryCount: null,
        protocolId: null,
        entryIndexStatus: "unindexed",
      },
    ]);
    expect(result.registryEntries).toEqual([
      { registryId: "minecraft:biome", entryId: "minecraft:plains", protocolId: null },
      {
        registryId: "minecraft:damage_type",
        entryId: "minecraft:datapack_only",
        protocolId: 9,
      },
      {
        registryId: "minecraft:damage_type",
        entryId: "minecraft:generic",
        protocolId: null,
      },
      {
        registryId: "minecraft:damage_type",
        entryId: "minecraft:magic",
        protocolId: 5,
      },
    ]);
    expect(result.summary.datapack.registryEntries).toEqual({
      path: "java/registry-entries/1.21.4.tsv",
      coverage: "official-report",
      indexedRegistryCount: 2,
      unindexedRegistryCount: 1,
      entryCount: 4,
    });
  });

  it("preserves datapack registry metadata without registries.json", () => {
    const result = buildJavaReportsSummary({
      version: "1.21.4",
      reportsDir: reportsFixture("1.21.4-datapack-only"),
      serverJarUrl: "https://example.test/server.jar",
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(result.summary.datapack.registries).toEqual([
      {
        id: "minecraft:damage_type",
        elements: true,
        stable: false,
        tags: true,
        entryCount: null,
        protocolId: null,
        entryIndexStatus: "unindexed",
      },
    ]);
    expect(result.summary.datapack.registryEntries).toEqual({
      path: "java/registry-entries/1.21.4.tsv",
      coverage: "official-report-unavailable",
      indexedRegistryCount: 0,
      unindexedRegistryCount: 1,
      entryCount: 0,
    });
    expect(result.registryEntries).toEqual([]);
  });

  it.each([
    {
      name: "array registries root",
      reportName: "registries.json",
      report: [],
      expected: /plain object/,
    },
    {
      name: "array datapack root",
      reportName: "datapack.json",
      report: [],
      expected: /plain object/,
    },
    {
      name: "array datapack registry collection",
      reportName: "datapack.json",
      report: { registries: [] },
      expected: /plain object/,
    },
    {
      name: "non-namespaced registry ID",
      reportName: "registries.json",
      report: { item: { entries: {} } },
      expected: /namespaced Minecraft identifier/,
    },
    {
      name: "non-namespaced entry ID",
      reportName: "registries.json",
      report: { "minecraft:item": { entries: { stone: {} } } },
      expected: /namespaced Minecraft identifier/,
    },
    {
      name: "array entry collection",
      reportName: "registries.json",
      report: { "minecraft:item": { entries: [] } },
      expected: /plain object/,
    },
    {
      name: "non-record entry",
      reportName: "registries.json",
      report: { "minecraft:item": { entries: { "minecraft:stone": [] } } },
      expected: /plain object/,
    },
    {
      name: "string entry protocol ID",
      reportName: "registries.json",
      report: {
        "minecraft:item": {
          entries: { "minecraft:stone": { protocol_id: "1" } },
        },
      },
      expected: /non-negative safe integer/,
    },
    {
      name: "unsafe entry protocol ID",
      reportName: "registries.json",
      report: {
        "minecraft:item": {
          entries: { "minecraft:stone": { protocol_id: Number.MAX_SAFE_INTEGER + 1 } },
        },
      },
      expected: /non-negative safe integer/,
    },
    {
      name: "negative registry protocol ID",
      reportName: "datapack.json",
      report: { registries: { "minecraft:item": { protocol_id: -1 } } },
      expected: /non-negative safe integer/,
    },
  ] as const)("rejects $name instead of emitting an empty official index", (fixture) => {
    withReportFixture(fixture.reportName, fixture.report, (reportsDir) => {
      expect(() =>
        buildJavaReportsSummary({
          version: "test",
          reportsDir,
          serverJarUrl: "https://example.test/server.jar",
          retrievedAt: "2026-06-22T00:00:00+09:00",
        }),
      ).toThrow(fixture.expected);
    });
  });
});
