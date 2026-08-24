import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listPendingJavaReportVersions, shouldIngestJavaReports } from "./javaReportSummaries.js";

describe("shouldIngestJavaReports", () => {
  it("selects versions without a checked-in summary", () => {
    expect(shouldIngestJavaReports(undefined)).toBe(true);
  });

  it("selects legacy summaries that dropped an available registry report", () => {
    expect(
      shouldIngestJavaReports({
        datapack: { registries: [] },
        reports: [{ path: "reports/commands.json" }, { path: "reports/registries.json" }],
      }),
    ).toBe(true);
  });

  it("does not select versions whose generator did not emit a registry report", () => {
    expect(
      shouldIngestJavaReports({
        datapack: { registries: [] },
        reports: [{ path: "reports/commands.json" }],
      }),
    ).toBe(false);
  });

  it("does not select summaries that already contain registries", () => {
    expect(
      shouldIngestJavaReports({
        datapack: { registries: [{ id: "minecraft:item" }] },
        reports: [{ path: "reports/registries.json" }],
      }),
    ).toBe(false);
  });
});

describe("listPendingJavaReportVersions", () => {
  it("accepts every checked-in Java report summary", () => {
    const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
    expect(listPendingJavaReportVersions(repositoryRoot)).toEqual([]);
  });
});
