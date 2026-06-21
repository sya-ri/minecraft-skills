import { describe, expect, it } from "vitest";
import { buildPaperPluginData } from "./paperProject.js";

describe("buildPaperPluginData", () => {
  it("keeps Paper 1.13+ releases and records event search contract", () => {
    const data = buildPaperPluginData({
      projectJson: {
        project_id: "paper",
        project_name: "Paper",
        version_groups: ["1.12", "1.13", "1.21"],
        versions: ["1.12.2", "1.13", "1.21.11-pre3", "1.21.11"],
      },
      latestBuildsJson: {
        version: "1.21.11",
        builds: [1, 2, 69],
      },
      javaLatest: "26.2",
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(data.latest).toEqual({
      minecraftVersion: "1.21.11",
      build: 69,
    });
    expect(data.versionGroups).toEqual(["1.13", "1.21"]);
    expect(data.versions).toEqual(["1.13", "1.21.11"]);
    expect(data.versionBuilds).toEqual([
      {
        minecraftVersion: "1.21.11",
        latestBuild: 69,
        buildCount: 3,
      },
    ]);
    expect(data.support.minecraftLatestGap.status).toBe("paper-not-yet-published-for-java-latest");
    expect(data.eventSearch.paperSources).toEqual(["spigot", "paper"]);
  });
});
