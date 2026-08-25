import { describe, expect, it } from "vitest";
import { auditCurrentSources } from "./currentSources.js";

const bundled = {
  javaLatestRelease: "26.2",
  paperLatestVersion: "26.2",
  paperLatestBuild: 30,
};

describe("auditCurrentSources", () => {
  it("passes when bundled latest data matches current sources", async () => {
    const result = await auditCurrentSources({
      checkedAt: "2026-06-22T00:00:00.000Z",
      bundled,
      fetchJson: async (url) => {
        if (url.includes("version_manifest_v2")) {
          return {
            latest: {
              release: "26.2",
              snapshot: "26.2",
            },
          };
        }
        if (url.endsWith("/projects/paper")) {
          return {
            versions: {
              "1.12": ["1.12.2"],
              "1.13": ["1.13"],
              "1.21": ["1.21.11-pre3", "1.21.11"],
              "26.1": ["26.1.2", "26.1.1"],
              "26.2": ["26.2", "26.2-rc-2"],
            },
          };
        }
        if (url.endsWith("/projects/paper/versions/26.2/builds")) {
          return [
            { id: 1, channel: "ALPHA" },
            { id: 30, channel: "ALPHA" },
          ];
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    expect(result).toEqual({
      ok: true,
      checkedAt: "2026-06-22T00:00:00.000Z",
      bundled: {
        javaLatestRelease: "26.2",
        paperLatestVersion: "26.2",
        paperLatestBuild: 30,
      },
      current: {
        javaLatestRelease: "26.2",
        javaLatestSnapshot: "26.2",
        paperLatestVersion: "26.2",
        paperLatestBuild: 30,
      },
      mismatches: [],
    });
  });

  it("reports stale bundled latest data", async () => {
    const result = await auditCurrentSources({
      checkedAt: "2026-06-22T00:00:00.000Z",
      bundled,
      fetchJson: async (url) => {
        if (url.includes("version_manifest_v2")) {
          return {
            latest: {
              release: "26.3",
              snapshot: "26.3",
            },
          };
        }
        if (url.endsWith("/projects/paper")) {
          return {
            versions: {
              "26.2": ["26.2"],
              "26.3": ["26.3"],
            },
          };
        }
        if (url.endsWith("/projects/paper/versions/26.3/builds")) {
          return [
            { id: 1, channel: "ALPHA" },
            { id: 2, channel: "ALPHA" },
          ];
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    expect(result.ok).toBe(false);
    expect(result.mismatches).toEqual([
      "bundled Java latest 26.2 differs from Mojang latest release 26.3",
      "bundled Paper latest 26.2 differs from PaperMC latest 26.3",
      "bundled Paper latest build 30 differs from PaperMC latest build 2",
    ]);
  });
});
