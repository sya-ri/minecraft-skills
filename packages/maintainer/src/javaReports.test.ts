import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildJavaReportsSummary } from "./javaReports.js";

function reportsFixture(name: string): string {
  return fileURLToPath(new URL(`./fixtures/java-reports/${name}/`, import.meta.url));
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
      },
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
      },
      {
        id: "minecraft:damage_type",
        elements: true,
        stable: false,
        tags: true,
        entryCount: 2,
        protocolId: 23,
      },
      {
        id: "minecraft:worldgen/density_function",
        elements: true,
        stable: true,
        tags: false,
        entryCount: null,
        protocolId: null,
      },
    ]);
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
      },
    ]);
  });
});
