import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanCachedData,
  fetchData,
  fetchMinecraftAssetFile,
  fetchMinecraftAssetsArchive,
  fetchMinecraftAssetsIndex,
  fetchMojangServerJar,
  getCacheDataRoot,
  getCachedDataPath,
  getCachedMinecraftAssetPath,
  getCacheRoot,
  getDataManifest,
  getDataRoot,
  getMinecraftAssetsStatus,
  getMojangServerJarStatus,
  hasBundledDataFile,
  hasCachedDataFile,
  hasCachedMinecraftAssetFile,
  hasDataFile,
  listCachedDataFiles,
  readCachedMinecraftAssetText,
  readDataJson,
  readDataText,
  searchMinecraftAssets,
} from "./index.js";

describe("@minecraft-skills/data", () => {
  const originalCacheDir = process.env.MINECRAFT_SKILLS_CACHE_DIR;

  async function withCacheDir<T>(run: (cacheDir: string) => T | Promise<T>): Promise<T> {
    const cacheDir = mkdtempSync(join(tmpdir(), "minecraft-skills-data-test-"));
    process.env.MINECRAFT_SKILLS_CACHE_DIR = cacheDir;
    try {
      return await run(cacheDir);
    } finally {
      if (originalCacheDir === undefined) {
        delete process.env.MINECRAFT_SKILLS_CACHE_DIR;
      } else {
        process.env.MINECRAFT_SKILLS_CACHE_DIR = originalCacheDir;
      }
      rmSync(cacheDir, { recursive: true, force: true });
    }
  }

  it("loads bundled catalog JSON", () => {
    const catalog = readDataJson<{ latest: { java: string } }>("catalog.json");
    expect(catalog.latest.java).toBe("26.2");
  });

  it("loads bundled authoring checklist JSON", () => {
    const checklists = readDataJson<{ checklists: Array<{ domain: string }> }>(
      "authoring-checklists.json",
    );
    expect(checklists.checklists.map((checklist) => checklist.domain)).toEqual([
      "datapack",
      "resourcepack",
      "paper-plugin",
    ]);
  });

  it("loads bundled authoring recipe JSON", () => {
    const recipes = readDataJson<{ recipes: Array<{ id: string }> }>("authoring-recipes.json");
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain("paper-event-listener");
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain("paper-safe-item-delivery");
  });

  it("loads bundled authoring scenario JSON", () => {
    const scenarios = readDataJson<{ scenarios: Array<{ id: string }> }>(
      "authoring-scenarios.json",
    );
    expect(scenarios.scenarios.map((scenario) => scenario.id)).toContain(
      "paper-event-listener-review",
    );
    expect(scenarios.scenarios.map((scenario) => scenario.id)).toContain(
      "paper-item-delivery-review",
    );
  });

  it("loads bundled intent lookup JSON", () => {
    const intents = readDataJson<{ intents: Array<{ id: string }> }>("intent-lookups.json");
    expect(intents.intents.map((intent) => intent.id)).toContain("verify-paper-type-or-member");
  });

  it("loads bundled authoring guardrail JSON", () => {
    const guardrails = readDataJson<{ guardrails: Array<{ id: string }> }>(
      "authoring-guardrails.json",
    );
    expect(guardrails.guardrails.map((guardrail) => guardrail.id)).toContain(
      "paper-api-surface-limits",
    );
    expect(guardrails.guardrails.map((guardrail) => guardrail.id)).toContain(
      "paper-inventory-delivery-outcomes",
    );
  });

  it("loads bundled authoring diagnostic JSON", () => {
    const diagnostics = readDataJson<{ diagnostics: Array<{ id: string }> }>(
      "authoring-diagnostics.json",
    );
    expect(diagnostics.diagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-api-member-unverified",
    );
    expect(diagnostics.diagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-inventory-leftovers-unhandled",
    );
  });

  it("loads bundled claim policy JSON", () => {
    const policies = readDataJson<{ policies: Array<{ id: string }> }>("claim-policies.json");
    expect(policies.policies.map((policy) => policy.id)).toContain("paper-type-or-member-exists");
  });

  it("loads bundled output requirement JSON", () => {
    const requirements = readDataJson<{ requirements: Array<{ id: string }> }>(
      "output-requirements.json",
    );
    expect(requirements.requirements.map((requirement) => requirement.id)).toContain(
      "paper-plugin-output-safety",
    );
  });

  it("loads bundled response pattern JSON", () => {
    const patterns = readDataJson<{ patterns: Array<{ id: string }> }>("response-patterns.json");
    expect(patterns.patterns.map((pattern) => pattern.id)).toContain("paper-api-answer");
  });

  it("exposes a package data root", () => {
    expect(getDataRoot()).toMatch(/packages\/data\/data$/);
  });

  it("checks bundled data files", () => {
    expect(hasDataFile("catalog.json")).toBe(true);
    expect(hasBundledDataFile("catalog.json")).toBe(true);
    expect(hasCachedDataFile("catalog.json")).toBe(false);
    expect(hasDataFile("skills/minecraft-paper-plugins/SKILL.md")).toBe(true);
    expect(hasDataFile("missing.json")).toBe(false);
  });

  it("rejects unsafe data paths", () => {
    expect(() => readDataText("../package.json")).toThrow("safe relative path");
    expect(() => hasDataFile("/tmp/package.json")).toThrow("safe relative path");
    expect(() => getCachedDataPath("nested/../package.json")).toThrow("safe relative path");
    expect(() => getCacheDataRoot("../outside")).toThrow("safe relative path");
    expect(() => cleanCachedData("../outside")).toThrow("safe relative path");
  });

  it("loads packaged skill payload text", () => {
    expect(readDataText("skills/minecraft-paper-plugins/SKILL.md")).toContain(
      "# Minecraft Paper Plugins",
    );
  });

  it("loads data manifest and resolves cache directories", async () => {
    await withCacheDir((cacheDir) => {
      const manifest = getDataManifest();
      expect(manifest.dataVersion).toBe("2026.06.23-2");
      expect(manifest.downloadable).toHaveLength(138);
      expect(manifest.downloadable).toContainEqual(
        expect.objectContaining({ kind: "datapack-schema-surface", version: "1.13" }),
      );
      expect(manifest.downloadable).toContainEqual(
        expect.objectContaining({ kind: "paper-api-surface", version: "1.20.5" }),
      );
      expect(manifest.downloadable).toContainEqual(
        expect.objectContaining({ kind: "resourcepack-model-summary", version: "1.13" }),
      );
      expect(getCacheRoot()).toBe(cacheDir);
      expect(getCacheDataRoot()).toBe(join(cacheDir, "data", manifest.dataVersion));
    });
  });

  it("reads cache files when a relative path is not bundled", async () => {
    await withCacheDir(() => {
      const path = "custom/example.json";
      const file = getCachedDataPath(path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `${JSON.stringify({ ok: true })}\n`);

      expect(hasDataFile(path)).toBe(true);
      expect(hasBundledDataFile(path)).toBe(false);
      expect(hasCachedDataFile(path)).toBe(true);
      expect(readDataJson<{ ok: boolean }>(path)).toEqual({ ok: true });
      expect(listCachedDataFiles()).toEqual([
        expect.objectContaining({
          path,
          bytes: 12,
        }),
      ]);
      cleanCachedData();
      expect(hasDataFile(path)).toBe(false);
    });
  });

  it("fetches manifest entries into the cache with sha256 verification", async () => {
    await withCacheDir(async () => {
      const body = readDataText("java/datapack-schema-surfaces/26.2.json");
      const fetchMock: typeof fetch = async (_input, _init) =>
        ({
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => Buffer.from(body),
        }) as unknown as Response;

      const result = await fetchData({
        kind: "datapack-schema-surface",
        version: "26.2",
        fetch: fetchMock,
      });

      expect(result.fetched).toEqual([
        expect.objectContaining({
          path: "java/datapack-schema-surfaces/26.2.json",
          bytes: Buffer.byteLength(body),
        }),
      ]);
      expect(hasDataFile("java/datapack-schema-surfaces/26.2.json")).toBe(true);

      const skipped = await fetchData({
        kind: "datapack-schema-surface",
        version: "26.2",
        fetch: fetchMock,
      });
      expect(skipped.skipped).toEqual([
        expect.objectContaining({
          path: "java/datapack-schema-surfaces/26.2.json",
          reason: "already-cached",
        }),
      ]);
    });
  });

  it("rejects fetched bytes when sha256 verification fails", async () => {
    await withCacheDir(async () => {
      const fetchMock: typeof fetch = async (_input, _init) =>
        ({
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => Buffer.from("not the manifest payload"),
        }) as unknown as Response;

      await expect(
        fetchData({
          kind: "datapack-schema-surface",
          version: "26.2",
          fetch: fetchMock,
        }),
      ).rejects.toThrow("Integrity mismatch");

      expect(hasCachedDataFile("java/datapack-schema-surfaces/26.2.json")).toBe(false);
    });
  });

  it("rejects a Mojang server jar response whose declared length exceeds the cache bound", async () => {
    await withCacheDir(async () => {
      const fetchMock: typeof fetch = async () =>
        new Response("x", {
          headers: { "content-length": String(256 * 1024 * 1024 + 1) },
        });

      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
          fetch: fetchMock,
        }),
      ).rejects.toThrow("response exceeds 268435456 bytes");
      expect(getMojangServerJarStatus("26.2").cached).toBe(false);
    });
  });

  it("uses official expected size as the streaming response bound", async () => {
    await withCacheDir(async () => {
      const fetchMock: typeof fetch = async () => new Response("12345");
      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
          size: 4,
          fetch: fetchMock,
        }),
      ).rejects.toThrow("response exceeds 4 bytes");
    });
  });

  it("aborts a Mojang server jar fetch at its bounded deadline", async () => {
    await withCacheDir(async () => {
      const fetchMock: typeof fetch = async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        });
      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
          timeoutMs: 5,
          fetch: fetchMock,
        }),
      ).rejects.toThrow("Fetch timed out after 5 ms");
    });
  });

  it("bounds cancellation of an oversized Mojang server jar response", async () => {
    await withCacheDir(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
        },
        cancel: () => new Promise<void>(() => undefined),
      });
      const fetchMock: typeof fetch = async () => new Response(body);
      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
          size: 1,
          timeoutMs: 20,
          fetch: fetchMock,
        }),
      ).rejects.toThrow("Fetch timed out after 20 ms");
    });
  });

  it("refuses to reuse a non-regular Mojang server jar cache path", async () => {
    await withCacheDir(async (cacheDir) => {
      const jarPath = join(cacheDir, "mojang-server-jars", "26.2.jar");
      mkdirSync(jarPath, { recursive: true });
      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
        }),
      ).rejects.toThrow("is not a regular file");
    });
  });

  it("rechecks an expected SHA-1 before reusing a cached Mojang server jar", async () => {
    await withCacheDir(async (cacheDir) => {
      const jarDirectory = join(cacheDir, "mojang-server-jars");
      mkdirSync(jarDirectory, { recursive: true });
      writeFileSync(join(jarDirectory, "26.2.jar"), "corrupt cache");
      let fetchCalls = 0;
      const fetchMock: typeof fetch = async () => {
        fetchCalls += 1;
        throw new Error("network should not be used");
      };

      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
          sha1: "0".repeat(40),
          fetch: fetchMock,
        }),
      ).rejects.toThrow("failed SHA-1 verification");
      expect(fetchCalls).toBe(0);
    });
  });

  it("caches Minecraft assets by single file and searchable version index", async () => {
    await withCacheDir(async () => {
      const tree = {
        tree: [
          { path: "assets/minecraft/models/item/diamond_sword.json", type: "blob" },
          { path: "assets/minecraft/textures/item/diamond_sword.png", type: "blob" },
          { path: "README.md", type: "blob" },
        ],
      };
      const fetchMock: typeof fetch = async (input, _init) => {
        const url = String(input);
        if (url.includes("/git/trees/1.21.8")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => tree,
          } as unknown as Response;
        }
        if (url.endsWith("/assets/minecraft/models/item/diamond_sword.json")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => Buffer.from('{"parent":"minecraft:item/generated"}'),
          } as unknown as Response;
        }
        if (url.endsWith("/1.21.8.zip")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => Buffer.from("zip bytes"),
          } as unknown as Response;
        }
        throw new Error(`unexpected url ${url}`);
      };

      const index = await fetchMinecraftAssetsIndex({
        version: "1.21.8",
        fetch: fetchMock,
      });
      expect(index.pathCount).toBe(2);

      const search = searchMinecraftAssets({
        version: "1.21.8",
        contains: "diamond_sword",
        extension: "json",
      });
      expect(search.matches).toEqual(["assets/minecraft/models/item/diamond_sword.json"]);

      const file = await fetchMinecraftAssetFile({
        version: "1.21.8",
        path: "assets/minecraft/models/item/diamond_sword.json",
        fetch: fetchMock,
      });
      expect(file.cached).toBe(false);
      expect(hasCachedMinecraftAssetFile("1.21.8", file.path)).toBe(true);
      expect(readCachedMinecraftAssetText("1.21.8", file.path)).toContain("generated");
      expect(getCachedMinecraftAssetPath("1.21.8", file.path)).toBe(file.file);

      const archive = await fetchMinecraftAssetsArchive({
        version: "1.21.8",
        fetch: fetchMock,
      });
      expect(archive.bytes).toBe(9);
      expect(getMinecraftAssetsStatus("1.21.8")).toMatchObject({
        indexCached: true,
        archiveCached: true,
        cachedFileCount: 1,
      });
    });
  });

  it("explains how to fetch a missing Minecraft assets index", async () => {
    await withCacheDir(() => {
      expect(() => searchMinecraftAssets({ version: "1.21.8", contains: "bundle" })).toThrow(
        /fetch_resourcepack_assets.*indexOnly/,
      );
    });
  });
});
