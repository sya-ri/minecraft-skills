import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  missing: new Set<string>(),
  corrupt: new Set<string>(),
  assetsUnavailable: false,
  fetch: vi.fn(),
}));

vi.mock("@minecraft-skills/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@minecraft-skills/data")>();
  return {
    ...actual,
    hasDataFile: (path: string) => !state.missing.has(path) && actual.hasDataFile(path),
    readDataJson: (path: string) => {
      if (state.corrupt.has(path)) throw new Error("Corrupt indexed data");
      return actual.readDataJson(path);
    },
    readMinecraftAssetsIndex: () => {
      if (state.assetsUnavailable) throw new Error("Private cache path must not leak");
      return { paths: [] };
    },
    fetchData: state.fetch,
  };
});

const schemaPath = "java/datapack-schema-surfaces/26.2.json";
const paperPath = "java/paper-api-surfaces/26.2.json";

beforeEach(() => {
  state.missing.clear();
  state.corrupt.clear();
  state.assetsUnavailable = false;
  state.fetch.mockClear();
  vi.resetModules();
});

describe("cross-search availability", () => {
  it("preserves bundled command matches when the downloadable schema is absent", async () => {
    state.missing.add(schemaPath);
    const { searchAll } = await import("./index.js");
    const result = searchAll({ query: "give", version: "26.2", domain: "datapack" });
    expect(result.results.some((entry) => entry.surface === "commands")).toBe(true);
    expect(result.searchComplete).toBe(false);
    expect(result.unavailableSurfaces).toEqual([
      {
        surface: "datapack-schema",
        reason: "not-available",
        fetch: { kind: "datapack-schema-surface", version: "26.2" },
      },
    ]);
    expect(result.gaps.join(" ")).toContain("data fetch datapack-schema-surface --version 26.2");
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("preserves Paper guidance without an API cache and resolves aliases exactly", async () => {
    state.missing.add(paperPath);
    const { searchAll } = await import("./index.js");
    const result = searchAll({ query: "paper event", version: "latest", domain: "paper-plugin" });
    expect(result.version).toBe("26.2");
    expect(result.results.some((entry) => entry.surface === "catalog")).toBe(true);
    expect(result.unavailableSurfaces).toEqual([
      {
        surface: "paper-api",
        reason: "not-available",
        fetch: { kind: "paper-api-surface", version: "26.2" },
      },
    ]);
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("returns explicit partial results for the original broad client query", async () => {
    state.missing.add(schemaPath);
    state.missing.add(paperPath);
    const { searchAll } = await import("./index.js");
    const result = searchAll({
      query: "Minecraft client ServerList swap replace save hidden servers",
      version: "26.2",
      limit: 3,
    });
    expect(result.searchComplete).toBe(false);
    expect(result.unavailableSurfaces.map((entry) => entry.surface)).toEqual([
      "datapack-schema",
      "paper-api",
    ]);
    expect(result.results.length).toBeLessThanOrEqual(3);
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("does not report unavailable sources outside the selected domain", async () => {
    state.missing.add(schemaPath);
    state.missing.add(paperPath);
    const { searchAll } = await import("./index.js");
    const result = searchAll({ query: "apple", version: "26.2", domain: "resourcepack", limit: 1 });
    expect(result.searchComplete).toBe(true);
    expect(result.unavailableSurfaces).toEqual([]);
    expect(result.truncated).toBe(true);
  });

  it("reports unsupported exact Paper versions without substituting latest API facts", async () => {
    const { searchAll } = await import("./index.js");
    const result = searchAll({ query: "PlayerJoinEvent", version: "26.1", domain: "paper-plugin" });
    expect(result.version).toBe("26.1");
    expect(result.unavailableSurfaces).toEqual([
      { surface: "paper-api", reason: "unsupported-version" },
    ]);
    expect(result.results.some((entry) => entry.surface.startsWith("paper-api-"))).toBe(false);
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("keeps optional community-cache failures explicit without leaking local paths", async () => {
    state.assetsUnavailable = true;
    const { searchAll } = await import("./index.js");
    const result = searchAll({ query: "apple", version: "26.2", domain: "resourcepack" });
    expect(result.searchComplete).toBe(false);
    expect(result.unavailableSurfaces).toEqual([
      { surface: "minecraft-assets-cache", reason: "not-searchable" },
    ]);
    expect(JSON.stringify(result)).not.toContain("Private cache path");
    expect(result.gaps.join(" ")).toContain("fetch_resourcepack_assets");
    expect(result.gaps.join(" ")).toContain("resourcepack assets fetch 26.2 --index-only");
    expect(result.results.length).toBeGreaterThan(0);
  });

  it.each([
    [schemaPath, "datapack"],
    [paperPath, "paper-plugin"],
  ] as const)("does not disguise corrupt indexed data as missing: %s", async (path, domain) => {
    state.corrupt.add(path);
    const { searchAll } = await import("./index.js");
    expect(() => searchAll({ query: "Minecraft", version: "26.2", domain })).toThrow(
      "Corrupt indexed data",
    );
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("keeps invalid inputs as errors", async () => {
    const { searchAll } = await import("./index.js");
    expect(() => searchAll({ query: " " })).toThrow();
    expect(() => searchAll({ query: "Minecraft", version: "../26.2" })).toThrow();
    expect(() => searchAll({ query: "Minecraft", limit: -1 })).toThrow();
  });
});
