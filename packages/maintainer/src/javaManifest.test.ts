import { describe, expect, it } from "vitest";
import { buildJavaVersionIndex } from "./javaManifest.js";

describe("buildJavaVersionIndex", () => {
  it("keeps Java 1.13+ releases and excludes legacy releases", () => {
    const index = buildJavaVersionIndex(
      {
        latest: {
          release: "26.2",
          snapshot: "26.2",
        },
        versions: [
          {
            id: "26.2",
            type: "release",
            url: "https://example.test/26.2.json",
            time: "2026-06-16T12:13:02+00:00",
            releaseTime: "2026-06-16T12:03:33+00:00",
            sha1: "latest",
          },
          {
            id: "26.2-rc-1",
            type: "snapshot",
            url: "https://example.test/26.2-rc-1.json",
            time: "2026-06-11T12:00:00+00:00",
            releaseTime: "2026-06-11T12:00:00+00:00",
            sha1: "snapshot",
          },
          {
            id: "1.13",
            type: "release",
            url: "https://example.test/1.13.json",
            time: "2018-07-18T14:00:00+00:00",
            releaseTime: "2018-07-18T14:00:00+00:00",
            sha1: "cutoff",
          },
          {
            id: "1.12.2",
            type: "release",
            url: "https://example.test/1.12.2.json",
            time: "2017-09-18T08:00:00+00:00",
            releaseTime: "2017-09-18T08:00:00+00:00",
            sha1: "legacy",
          },
        ],
      },
      "2026-06-22T00:00:00+09:00",
    );

    expect(index.latest).toEqual({
      release: "26.2",
      snapshot: null,
    });
    expect(index.versions.map((version) => version.id)).toEqual(["26.2", "1.13"]);
    expect(index.versions[0]?.url).toBe("https://example.test/26.2.json");
    expect(index.sources[0]?.retrievedAt).toBe("2026-06-22T00:00:00+09:00");
  });
});
