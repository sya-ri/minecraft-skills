import { describe, expect, it } from "vitest";
import {
  getDomain,
  getSourcePolicy,
  getVersionDetail,
  listDomains,
  resolveVersion,
} from "./index.js";

describe("catalog", () => {
  it("loads supported domains", () => {
    expect(listDomains().map((domain) => domain.id)).toEqual([
      "datapack",
      "resourcepack",
      "paper-plugin",
    ]);
  });

  it("resolves the latest Java version", () => {
    expect(resolveVersion("java", "latest")).toBe("26.2");
  });

  it("does not pretend a release is a bundled snapshot", () => {
    expect(() => resolveVersion("java", "latest-snapshot")).toThrow(
      "No bundled latest snapshot for java",
    );
  });

  it("loads version details without inventing unextracted pack formats", () => {
    const version = getVersionDetail("java", "26.2");
    expect(version.packFormats.data).toBeNull();
    expect(version.packFormats.status).toBe("not-extracted");
  });

  it("falls back to manifest-only details when a detail file is not generated", () => {
    const version = getVersionDetail("java", "26.2");
    expect(version.domains.datapack.unknowns).toContain("data_pack_format");
  });

  it("keeps Minecraft Wiki prose out of redistributable data", () => {
    expect(getSourcePolicy().minecraftWikiTextRedistribution).toBe("forbidden");
  });

  it("loads Paper plugin source metadata", () => {
    expect(getDomain("paper-plugin").primarySources.map((source) => source.id)).toContain(
      "spigot-event-list",
    );
  });
});
