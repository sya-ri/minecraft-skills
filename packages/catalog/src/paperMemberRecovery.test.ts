import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDataManifest: vi.fn(),
}));

// Simulate the published package: the surface exists in the checkout, but only the cache is visible.
vi.mock("@minecraft-skills/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@minecraft-skills/data")>();
  mocks.getDataManifest.mockImplementation(actual.getDataManifest);
  return {
    ...actual,
    getDataManifest: mocks.getDataManifest,
    hasDataFile: (path: string) =>
      path.startsWith("java/paper-api-surfaces/")
        ? actual.hasCachedDataFile(path)
        : actual.hasDataFile(path),
    readDataJson: (path: string) =>
      path.startsWith("java/paper-api-surfaces/")
        ? JSON.parse(readFileSync(actual.getCachedDataPath(path), "utf8"))
        : actual.readDataJson(path),
  };
});

import {
  getCachedDataPath,
  getDataManifest,
  hasCachedDataFile,
  listCachedDataFiles,
  readDataText,
} from "@minecraft-skills/data";

const path = "java/paper-api-surfaces/26.2.json";
const body = readDataText(path).replaceAll("\r\n", "\n");
const manifest = getDataManifest();
const entry = manifest.downloadable.find((candidate) => candidate.path === path);
const queries = [
  { version: "26.2", type: "org.bukkit.plugin.java.JavaPlugin", contains: "onDisable", limit: 10 },
  { version: "26.2", type: "org.bukkit.inventory.meta.ItemMeta", contains: "lore", limit: 20 },
  { version: "26.2", type: "DialogAction", contains: "customClick", limit: 10 },
];

describe("explicit Paper member data recovery", () => {
  let cacheDir: string;

  beforeEach(() => {
    vi.resetModules();
    cacheDir = mkdtempSync(join(tmpdir(), "minecraft-skills-paper-recovery-"));
    vi.stubEnv("MINECRAFT_SKILLS_CACHE_DIR", cacheDir);
    mocks.getDataManifest.mockReturnValue(manifest);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it.each(
    queries,
  )("requires opt-in and recovers $type $contains from exactly one surface", async (query) => {
    const { searchPaperMembers, searchPaperMembersWithData } = await import("./index.js");
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(body));
    vi.stubGlobal("fetch", fetchMock);

    expect(() => searchPaperMembers(query)).toThrow("No available Paper API surface");
    await expect(searchPaperMembersWithData(query)).rejects.toThrow(
      "minecraft-skills data fetch paper-api-surface --version 26.2",
    );
    await expect(searchPaperMembersWithData({ ...query, fetchMissing: false })).rejects.toThrow(
      "fetchMissing:true",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(listCachedDataFiles()).toEqual([]);

    const result = await searchPaperMembersWithData({ ...query, fetchMissing: true });
    expect(result.version).toBe("26.2");
    expect(result.matchedMembers).toBeGreaterThan(0);
    expect(
      result.members.every((member) =>
        member.name.toLowerCase().includes(query.contains.toLowerCase()),
      ),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(entry?.url, {
      signal: expect.any(AbortSignal),
    });
    expect(listCachedDataFiles().map((file) => file.path)).toEqual([path]);
    expect(searchPaperMembers(query)).toEqual(result);
    expect(await searchPaperMembersWithData({ ...query, fetchMissing: true })).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    "latest",
    "latest-release",
  ])("resolves %s before choosing the exact manifest entry", async (version) => {
    const { searchPaperMembersWithData } = await import("./index.js");
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(body));
    const result = await searchPaperMembersWithData({
      version,
      type: "JavaPlugin",
      contains: "onDisable",
      fetchMissing: true,
      fetch: fetchMock,
    });
    expect(result.version).toBe("26.2");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(entry?.url, {
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    "../26.2",
    "future-version",
    "26.2/../../other",
  ])("does not fetch or fall back for unsupported input %s", async (version) => {
    const { searchPaperMembersWithData } = await import("./index.js");
    const fetchMock = vi.fn<typeof fetch>();
    await expect(
      searchPaperMembersWithData({ version, fetchMissing: true, fetch: fetchMock }),
    ).rejects.toThrow("No bundled Paper API surface");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(listCachedDataFiles()).toEqual([]);
  });

  it("requires a unique matching manifest entry and never widens the download", async () => {
    const { searchPaperMembersWithData } = await import("./index.js");
    const fetchMock = vi.fn<typeof fetch>();
    for (const downloadable of [[], [...manifest.downloadable, entry]]) {
      mocks.getDataManifest.mockReturnValue({ ...manifest, downloadable });
      await expect(
        searchPaperMembersWithData({ version: "26.2", fetchMissing: true, fetch: fetchMock }),
      ).rejects.toThrow("No unique downloadable Paper API surface");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns no facts and leaves no cache after a failed download", async () => {
    const { searchPaperMembersWithData } = await import("./index.js");
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("unavailable", { status: 503 }));
    await expect(
      searchPaperMembersWithData({ ...queries[0], fetchMissing: true, fetch: fetchMock }),
    ).rejects.toThrow("503");
    expect(hasCachedDataFile(path)).toBe(false);
  });

  it("does not overwrite corrupt existing local data or use fetched fallback facts", async () => {
    const { searchPaperMembersWithData } = await import("./index.js");
    const file = getCachedDataPath(path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, '{"unexpected":true}');
    const fetchMock = vi.fn<typeof fetch>();
    await expect(
      searchPaperMembersWithData({ ...queries[0], fetchMissing: true, fetch: fetchMock }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(readFileSync(file, "utf8")).toBe('{"unexpected":true}');
  });

  it("uses an already cached surface without any fetch in a fresh process cache", async () => {
    const file = getCachedDataPath(path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
    const { searchPaperMembersWithData } = await import("./index.js");
    const fetchMock = vi.fn<typeof fetch>();
    const result = await searchPaperMembersWithData({
      ...queries[0],
      fetchMissing: true,
      fetch: fetchMock,
    });
    expect(result.matchedMembers).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    0,
    -1,
    501,
    1.5,
    Number.NaN,
  ])("rejects limit %s before any opt-in cache write", async (limit) => {
    const { searchPaperMembersWithData } = await import("./index.js");
    const fetchMock = vi.fn<typeof fetch>();
    await expect(
      searchPaperMembersWithData({ version: "26.2", limit, fetchMissing: true, fetch: fetchMock }),
    ).rejects.toThrow("Limit must be between 1 and 500");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(listCachedDataFiles()).toEqual([]);
  });
});
