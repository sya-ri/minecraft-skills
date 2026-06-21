import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildJavaVersionDetail } from "./javaVersionDetail.js";

describe("buildJavaVersionDetail", () => {
  it("builds version-json details without jar data", () => {
    const dir = mkdtempSync(join(tmpdir(), "minecraft-skills-version-detail-"));
    const versionJsonPath = join(dir, "version.json");
    writeFileSync(
      versionJsonPath,
      JSON.stringify({
        id: "1.21.4",
        type: "release",
        releaseTime: "2024-12-03T10:12:57+00:00",
        time: "2026-06-16T06:31:45+00:00",
        javaVersion: {
          component: "java-runtime-delta",
          majorVersion: 21,
        },
        downloads: {
          client: {
            sha1: "client",
            size: 1,
            url: "https://example.test/client.jar",
          },
        },
      }),
    );

    const detail = buildJavaVersionDetail({
      versionJsonPath,
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(detail.coverage).toBe("version-json");
    expect(detail.javaVersion.majorVersion).toBe(21);
    expect(detail.packFormats.status).toBe("not-extracted");
  });
});
