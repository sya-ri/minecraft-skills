import { describe, expect, it } from "vitest";
import { buildPaperPluginData } from "./paperProject.js";

describe("buildPaperPluginData", () => {
  it("keeps Paper 1.13+ releases and records event search contract", () => {
    const data = buildPaperPluginData({
      projectJson: {
        project: {
          id: "paper",
          name: "Paper",
        },
        versions: {
          "1.12": ["1.12.2"],
          "1.13": ["1.13"],
          "1.21": ["1.21.11-pre3", "1.21.11"],
          "26.1": ["26.1.2", "26.1.1"],
          "26.2": ["26.2", "26.2-rc-2"],
        },
      },
      javaLatest: "26.2",
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(data.latest).toEqual({
      minecraftVersion: "26.2",
      build: 0,
    });
    expect(data.versionGroups).toEqual(["1.13", "1.21", "26.1", "26.2"]);
    expect(data.versions).toEqual(["1.13", "1.21.11", "26.1.1", "26.1.2", "26.2"]);
    expect(data.versionBuilds).toEqual([]);
    expect(data.support.minecraftLatestGap.status).toBe("paper-current-with-java-latest");
    expect(data.eventSearch.paperSources).toEqual(["spigot", "paper"]);
    expect(data.sources.map((source) => source.id)).toContain("papermc-docs-paper-folia-support");
  });
});
