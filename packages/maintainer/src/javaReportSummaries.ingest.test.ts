import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildJavaReportsSummary: vi.fn(),
  generateJavaReports: vi.fn(),
  getVersionDetail: vi.fn(),
  listVersions: vi.fn(),
  writeJavaReportsSummary: vi.fn(),
}));

vi.mock("@minecraft-skills/catalog", () => ({
  getVersionDetail: mocks.getVersionDetail,
  listVersions: mocks.listVersions,
}));

vi.mock("./javaReports.js", () => ({
  buildJavaReportsSummary: mocks.buildJavaReportsSummary,
  generateJavaReports: mocks.generateJavaReports,
  javaRegistryEntryIndexHeader: "registry_id\tentry_id\tentry_protocol_id",
  writeJavaReportsSummary: mocks.writeJavaReportsSummary,
}));

import { ingestJavaReportSummaries } from "./javaReportSummaries.js";

const tempPrefix = "minecraft-skills-java-reports-";
let fixtureRoot: string;

function reportTempDirectories(): string[] {
  return readdirSync(tmpdir())
    .filter((name) => name.startsWith(tempPrefix))
    .sort();
}

function writeSummary(
  version: string,
  options: { registries: unknown[]; hasRegistryReport: boolean; retrievedAt: string },
): void {
  const reportsRoot = join(fixtureRoot, "packages/data/data/java/reports");
  const registryEntriesRoot = join(fixtureRoot, "packages/data/data/java/registry-entries");
  mkdirSync(reportsRoot, { recursive: true });
  mkdirSync(registryEntriesRoot, { recursive: true });
  const registries = options.registries.map((registry) => {
    const value = registry as Record<string, unknown>;
    return {
      id: typeof value.id === "string" ? value.id : "minecraft:test",
      entryCount: 1,
      entryIndexStatus: "indexed",
    };
  });
  writeFileSync(
    join(reportsRoot, `${version}.json`),
    JSON.stringify({
      version,
      datapack: {
        registries,
        registryEntries: {
          path: `java/registry-entries/${version}.tsv`,
          coverage: "official-report",
          indexedRegistryCount: registries.length,
          unindexedRegistryCount: 0,
          entryCount: registries.length,
        },
      },
      reports: options.hasRegistryReport ? [{ path: "reports/registries.json" }] : [],
      sources: [{ retrievedAt: options.retrievedAt }],
    }),
  );
  writeFileSync(
    join(registryEntriesRoot, `${version}.tsv`),
    `registry_id\tentry_id\tentry_protocol_id\n${registries
      .map((registry) => `${registry.id}\tminecraft:test\t0`)
      .join("\n")}${registries.length > 0 ? "\n" : ""}`,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fixtureRoot = mkdtempSync(join(tmpdir(), "minecraft-skills-report-summary-test-"));
  mocks.listVersions.mockReturnValue([{ id: "complete" }, { id: "repair" }, { id: "missing" }]);
  mocks.getVersionDetail.mockImplementation((_edition: string, version: string) => ({
    version,
    downloads: { server: { url: `https://example.test/${version}.jar` } },
  }));
  mocks.buildJavaReportsSummary.mockImplementation((options) => ({
    summary: { version: options.version, retrievedAt: options.retrievedAt },
    commandPaths: [],
    registryEntries: [],
  }));
  mocks.writeJavaReportsSummary.mockImplementation(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(Buffer.from("server jar"), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (existsSync(fixtureRoot)) {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

describe("ingestJavaReportSummaries", () => {
  it("repairs a structurally invalid summary without throwing a type error", async () => {
    mocks.listVersions.mockReturnValue([{ id: "broken" }]);
    const reportsRoot = join(fixtureRoot, "packages/data/data/java/reports");
    mkdirSync(reportsRoot, { recursive: true });
    writeFileSync(
      join(reportsRoot, "broken.json"),
      JSON.stringify({ datapack: { registries: {} } }),
    );

    const written = await ingestJavaReportSummaries({
      root: fixtureRoot,
      retrievedAt: "2026-08-24T00:00:00.000Z",
      javaBin: "java-test",
      force: false,
    });

    expect(written).toBe(1);
    expect(mocks.generateJavaReports).toHaveBeenCalledTimes(1);
    expect(mocks.buildJavaReportsSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        version: "broken",
        retrievedAt: "2026-08-24T00:00:00.000Z",
      }),
    );
  });

  it("skips complete summaries and preserves a repaired summary timestamp", async () => {
    writeSummary("complete", {
      registries: [{ id: "minecraft:item" }],
      hasRegistryReport: true,
      retrievedAt: "2025-01-01T00:00:00.000Z",
    });
    writeSummary("repair", {
      registries: [],
      hasRegistryReport: true,
      retrievedAt: "2025-02-03T04:05:06.000Z",
    });
    const tempDirectoriesBefore = reportTempDirectories();

    const written = await ingestJavaReportSummaries({
      root: fixtureRoot,
      retrievedAt: "2026-08-24T00:00:00.000Z",
      javaBin: "java-test",
      force: false,
    });

    expect(written).toBe(2);
    expect(mocks.getVersionDetail).toHaveBeenCalledTimes(2);
    expect(mocks.generateJavaReports).toHaveBeenCalledTimes(2);
    expect(
      mocks.buildJavaReportsSummary.mock.calls.map(([options]) => options.retrievedAt),
    ).toEqual(["2025-02-03T04:05:06.000Z", "2026-08-24T00:00:00.000Z"]);
    expect(reportTempDirectories()).toEqual(tempDirectoriesBefore);
  });

  it("forces complete summaries and uses the requested timestamp", async () => {
    writeSummary("complete", {
      registries: [{ id: "minecraft:item" }],
      hasRegistryReport: true,
      retrievedAt: "2025-01-01T00:00:00.000Z",
    });
    writeSummary("repair", {
      registries: [],
      hasRegistryReport: true,
      retrievedAt: "2025-02-03T04:05:06.000Z",
    });

    const written = await ingestJavaReportSummaries({
      root: fixtureRoot,
      retrievedAt: "2026-08-24T00:00:00.000Z",
      javaBin: "java-test",
      force: true,
    });

    expect(written).toBe(3);
    expect(
      mocks.buildJavaReportsSummary.mock.calls.map(([options]) => options.retrievedAt),
    ).toEqual(["2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z"]);
  });

  it("removes the jar and temporary root when report generation fails", async () => {
    mocks.listVersions.mockReturnValue([{ id: "missing" }]);
    mocks.generateJavaReports.mockImplementation(() => {
      throw new Error("generator failed");
    });
    const tempDirectoriesBefore = reportTempDirectories();

    await expect(
      ingestJavaReportSummaries({
        root: fixtureRoot,
        retrievedAt: "2026-08-24T00:00:00.000Z",
        javaBin: "java-test",
        force: false,
      }),
    ).rejects.toThrow("generator failed");

    expect(reportTempDirectories()).toEqual(tempDirectoriesBefore);
    expect(mocks.writeJavaReportsSummary).not.toHaveBeenCalled();
  });
});
