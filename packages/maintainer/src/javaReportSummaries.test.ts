import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  isJavaRegistryEntryIndexValid,
  listPendingJavaReportVersions,
  parseExistingJavaReportsSummary,
  readExistingJavaReportsSummary,
  shouldIngestJavaReports,
} from "./javaReportSummaries.js";

const emptyIndex = "registry_id\tentry_id\tentry_protocol_id\n";

describe("shouldIngestJavaReports", () => {
  it("selects versions without a checked-in summary", () => {
    expect(shouldIngestJavaReports(undefined, undefined)).toBe(true);
  });

  it("selects legacy summaries that dropped an available registry report", () => {
    expect(
      shouldIngestJavaReports(
        {
          datapack: { registries: [] },
          reports: [{ path: "reports/commands.json" }, { path: "reports/registries.json" }],
        },
        undefined,
      ),
    ).toBe(true);
  });

  it("does not select versions whose generator did not emit a registry report", () => {
    expect(
      shouldIngestJavaReports(
        {
          version: "1.13",
          datapack: {
            registries: [],
            registryEntries: {
              path: "java/registry-entries/1.13.tsv",
              coverage: "official-report-unavailable",
              indexedRegistryCount: 0,
              unindexedRegistryCount: 0,
              entryCount: 0,
            },
          },
          reports: [{ path: "reports/commands.json" }],
        },
        emptyIndex,
      ),
    ).toBe(false);
  });

  it("does not select summaries that already contain registries", () => {
    expect(
      shouldIngestJavaReports(
        {
          version: "26.2",
          datapack: {
            registries: [
              {
                id: "minecraft:item",
                entryCount: 1,
                entryIndexStatus: "indexed",
              },
            ],
            registryEntries: {
              path: "java/registry-entries/26.2.tsv",
              coverage: "official-report",
              indexedRegistryCount: 1,
              unindexedRegistryCount: 0,
              entryCount: 1,
            },
          },
          reports: [{ path: "reports/registries.json" }],
        },
        `${emptyIndex}minecraft:item\tminecraft:stone\t1\n`,
      ),
    ).toBe(false);
  });

  it("selects summaries with a missing or inconsistent registry entry index", () => {
    const summary = {
      version: "26.2",
      datapack: {
        registries: [{ id: "minecraft:item", entryCount: 1, entryIndexStatus: "indexed" as const }],
        registryEntries: {
          path: "java/registry-entries/26.2.tsv",
          coverage: "official-report" as const,
          indexedRegistryCount: 1,
          unindexedRegistryCount: 0,
          entryCount: 1,
        },
      },
      reports: [{ path: "reports/registries.json" }],
    };

    expect(shouldIngestJavaReports(summary, undefined)).toBe(true);
    expect(shouldIngestJavaReports(summary, emptyIndex)).toBe(true);
    expect(
      isJavaRegistryEntryIndexValid(
        summary,
        `${emptyIndex}minecraft:item\tminecraft:zombie\t2\nminecraft:item\tminecraft:stone\t1\n`,
      ),
    ).toBe(false);
  });

  it("requires null entry counts for registries without official entry coverage", () => {
    const summary = {
      version: "26.2",
      datapack: {
        registries: [
          {
            id: "minecraft:advancement",
            entryCount: null,
            entryIndexStatus: "unindexed",
          },
        ],
        registryEntries: {
          path: "java/registry-entries/26.2.tsv",
          coverage: "official-report",
          indexedRegistryCount: 0,
          unindexedRegistryCount: 1,
          entryCount: 0,
        },
      },
      reports: [{ path: "reports/registries.json" }],
    };

    expect(isJavaRegistryEntryIndexValid(summary, emptyIndex)).toBe(true);
    expect(
      isJavaRegistryEntryIndexValid(
        {
          ...summary,
          datapack: {
            ...summary.datapack,
            registries: [{ ...summary.datapack.registries[0], id: "advancement" }],
          },
        },
        emptyIndex,
      ),
    ).toBe(false);
    expect(
      isJavaRegistryEntryIndexValid(
        {
          ...summary,
          datapack: {
            ...summary.datapack,
            registries: [{ ...summary.datapack.registries[0], entryCount: 0 }],
          },
        },
        emptyIndex,
      ),
    ).toBe(false);
  });
});

describe("existing Java report summary validation", () => {
  it.each([
    { name: "array root", value: [] },
    { name: "object version", value: { version: {} } },
    { name: "array datapack", value: { datapack: [] } },
    { name: "object registries", value: { datapack: { registries: {} } } },
    { name: "null registry", value: { datapack: { registries: [null] } } },
    { name: "numeric registry ID", value: { datapack: { registries: [{ id: 1 }] } } },
    { name: "array registry entry metadata", value: { datapack: { registryEntries: [] } } },
    {
      name: "string registry entry count",
      value: { datapack: { registryEntries: { entryCount: "1" } } },
    },
    { name: "object reports", value: { reports: {} } },
    { name: "null report", value: { reports: [null] } },
    { name: "numeric report path", value: { reports: [{ path: 1 }] } },
    { name: "array source", value: { sources: [[]] } },
    { name: "numeric source timestamp", value: { sources: [{ retrievedAt: 1 }] } },
  ])("treats a malformed $name as needing repair", ({ value }) => {
    expect(parseExistingJavaReportsSummary(value)).toBeUndefined();
    expect(() => shouldIngestJavaReports(value, emptyIndex)).not.toThrow();
    expect(shouldIngestJavaReports(value, emptyIndex)).toBe(true);
  });

  it("treats malformed JSON as needing repair instead of throwing a parse error", () => {
    const directory = mkdtempSync(join(tmpdir(), "minecraft-skills-summary-validation-"));
    const path = join(directory, "broken.json");
    try {
      writeFileSync(path, "{not-json");
      expect(readExistingJavaReportsSummary(path)).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("listPendingJavaReportVersions", () => {
  it("accepts every checked-in Java report summary", () => {
    const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
    expect(listPendingJavaReportVersions(repositoryRoot)).toEqual([]);
  });
});
