import { describe, expect, it } from "vitest";
import { auditCurrentSources } from "./currentSources.js";

describe("auditCurrentSources", () => {
  it("passes when bundled latest data matches current sources", async () => {
    const result = await auditCurrentSources({
      checkedAt: "2026-06-22T00:00:00.000Z",
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
            versions: ["1.12.2", "1.13", "1.21.11-pre3", "1.21.11"],
          };
        }
        if (url.endsWith("/projects/paper/versions/1.21.11")) {
          return {
            version: "1.21.11",
            builds: [1, 69],
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    expect(result).toEqual({
      ok: true,
      checkedAt: "2026-06-22T00:00:00.000Z",
      bundled: {
        javaLatestRelease: "26.2",
        paperLatestVersion: "1.21.11",
        paperLatestBuild: 69,
      },
      current: {
        javaLatestRelease: "26.2",
        javaLatestSnapshot: "26.2",
        paperLatestVersion: "1.21.11",
        paperLatestBuild: 69,
      },
      mismatches: [],
    });
  });

  it("reports stale bundled latest data", async () => {
    const result = await auditCurrentSources({
      checkedAt: "2026-06-22T00:00:00.000Z",
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
            versions: ["1.21.11", "1.21.12"],
          };
        }
        if (url.endsWith("/projects/paper/versions/1.21.12")) {
          return {
            version: "1.21.12",
            builds: [1, 2],
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    expect(result.ok).toBe(false);
    expect(result.mismatches).toEqual([
      "bundled Java latest 26.2 differs from Mojang latest release 26.3",
      "bundled Paper latest 1.21.11 differs from PaperMC latest 1.21.12",
      "bundled Paper latest build 69 differs from PaperMC latest build 2",
    ]);
  });
});
