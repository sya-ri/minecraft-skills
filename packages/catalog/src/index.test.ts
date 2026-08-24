import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildModrinthProjectSearchUrl,
  buildModrinthProjectVersionsUrl,
  buildModrinthResourceUrl,
  buildPaperEventSearchUrl,
  classifyPackFiles,
  compareCommands,
  compareDatapackSchema,
  comparePaperApi,
  comparePaperApiSurface,
  compareVanillaPaths,
  compareVersions,
  defaultResourcepackPngValidationLimits,
  defaultResourcepackProjectValidationLimits,
  explainPackPath,
  findDatapackEntries,
  findResourcepackAssets,
  findVersionsByPackFormat,
  getAuthoringChecklist,
  getAuthoringContext,
  getAuthoringDiagnostic,
  getAuthoringGuardrail,
  getAuthoringPlan,
  getAuthoringPreflight,
  getAuthoringRecipe,
  getAuthoringScenario,
  getClaimPolicy,
  getCoverageSummary,
  getDatapackSchemaSurface,
  getDomain,
  getEvidenceBundle,
  getFactSurface,
  getIntentLookup,
  getJavaReportsSummary,
  getModrinthResource,
  getMojangVersionMetadata,
  getOutputRequirement,
  getPackFileSchema,
  getPackFormat,
  getPackMigrationPlan,
  getPaperApiIndex,
  getPaperApiReference,
  getPaperApiSurface,
  getPaperPluginData,
  getResourcepackModelSummary,
  getResponsePattern,
  getSkillPayload,
  getSourcePolicy,
  getSourceReport,
  getSourceTier,
  getSupportMatrix,
  getVanillaDatapackJson,
  getVanillaInventory,
  getVersionDetail,
  listAuthoringChecklists,
  listAuthoringDiagnostics,
  listAuthoringGuardrails,
  listAuthoringRecipes,
  listAuthoringScenarios,
  listClaimPolicies,
  listCommunityDatasets,
  listDomains,
  listFactSurfaces,
  listIntentLookups,
  listModrinthProjectVersions,
  listOutputRequirements,
  listPackFormats,
  listResponsePatterns,
  listSkills,
  listSourceTiers,
  listVersionSupport,
  resolveVersion,
  searchAll,
  searchAuthoringScenarios,
  searchCatalog,
  searchCommands,
  searchDatapackSchema,
  searchModrinthProjects,
  searchPaperMembers,
  searchPaperTypes,
  searchResourcepackModelPaths,
  searchVanillaDatapackJsonContent,
  searchVanillaDatapackJsonFiles,
  searchVanillaPaths,
  suggestMinecraftLookups,
  validateModrinthPack,
  validateModrinthPackArchive,
  validatePackFileContent,
  validatePackFilesContent,
  validateResourcepackProject,
  vorbisIdentificationPageBytes,
} from "./index.js";

function crc32(value: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeOggCrc(page: Buffer): void {
  page.fill(0, 22, 26);
  let crc = 0;
  for (const byte of page) {
    let value = ((crc >>> 24) ^ byte) & 0xff;
    value <<= 24;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 0x8000_0000 ? (value << 1) ^ 0x04c1_1db7 : value << 1;
    }
    crc = ((crc << 8) ^ value) >>> 0;
  }
  page.writeUInt32LE(crc, 22);
}

function validVorbisIdentificationPage(channels = 1): Buffer {
  const page = Buffer.from(
    "4f67675300020000000000000000010000000000000000000000011e01766f72626973000000000180bb00000000000000000000000000008601",
    "hex",
  );
  page[39] = channels;
  writeOggCrc(page);
  return page;
}

function pngChunk(type: string, data: Uint8Array = new Uint8Array()): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.byteLength);
  result.writeUInt32BE(data.byteLength, 0);
  typeBytes.copy(result, 4);
  Buffer.from(data).copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])), 8 + data.byteLength);
  return result;
}

function testPng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT"),
    pngChunk("IEND"),
  ]);
}

function testJar(entries: Record<string, string | Buffer>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const contentBytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const checksum = crc32(contentBytes) >>> 0;
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(contentBytes.length, 18);
    local.writeUInt32LE(contentBytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);
    localParts.push(local, contentBytes);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(contentBytes.length, 20);
    central.writeUInt32LE(contentBytes.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centralParts.push(central);
    offset += local.length + contentBytes.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function validModrinthFile(
  path: string,
  downloads = ["https://cdn.modrinth.com/data/example/versions/1/example.jar"],
): Record<string, unknown> {
  return {
    path,
    hashes: {
      sha1: "a".repeat(40),
      sha512: "b".repeat(128),
    },
    env: {
      client: "required",
      server: "optional",
    },
    downloads,
    fileSize: 123,
  };
}

function validModrinthIndex(): Record<string, unknown> {
  return {
    formatVersion: 1,
    game: "minecraft",
    versionId: "example-pack-1.0.0",
    name: "Example Pack",
    summary: "A test pack",
    files: [validModrinthFile("mods/example.jar")],
    dependencies: {
      minecraft: "1.21.11",
      "fabric-loader": "0.18.4",
    },
  };
}

function withCachedServerJar(
  version: string,
  entries: Record<string, string | Buffer>,
  run: (jarFile: string) => void,
): void {
  const root = mkdtempSync(join(tmpdir(), "minecraft-skills-test-"));
  const previous = process.env.MINECRAFT_SKILLS_CACHE_DIR;
  process.env.MINECRAFT_SKILLS_CACHE_DIR = root;
  try {
    const jarDir = join(root, "mojang-server-jars");
    mkdirSync(jarDir, { recursive: true });
    const jar = testJar(entries);
    const jarFile = join(jarDir, `${version}.jar`);
    writeFileSync(jarFile, jar);
    const detail = getVersionDetail("java", version);
    const server = detail.downloads.server as { sha1?: string; size?: number } | undefined;
    if (!server) {
      throw new Error(`Test version ${version} has no server download metadata`);
    }
    const previousSha1 = server.sha1;
    const previousSize = server.size;
    server.sha1 = createHash("sha1").update(jar).digest("hex");
    server.size = jar.length;
    try {
      run(jarFile);
    } finally {
      if (previousSha1 === undefined) delete server.sha1;
      else server.sha1 = previousSha1;
      if (previousSize === undefined) delete server.size;
      else server.size = previousSize;
    }
  } finally {
    if (previous === undefined) {
      delete process.env.MINECRAFT_SKILLS_CACHE_DIR;
    } else {
      process.env.MINECRAFT_SKILLS_CACHE_DIR = previous;
    }
    rmSync(root, { recursive: true, force: true });
  }
}

describe("catalog", () => {
  it("loads supported domains", () => {
    expect(listDomains().map((domain) => domain.id)).toEqual([
      "datapack",
      "resourcepack",
      "paper-plugin",
    ]);
  });

  it("returns Mojang/Piston official version metadata", () => {
    const metadata = getMojangVersionMetadata("java", "26.2");
    expect(metadata.version).toBe("26.2");
    expect(metadata.official.serverJarUrl).toContain("piston-data.mojang.com");
    expect(metadata.official.versionMetadataUrl).toContain("piston-meta.mojang.com");
    expect(metadata.packFormats.data).toBe(107);
    expect(metadata.provenance.tier).toBe("official");
  });

  it("searches and reads cached vanilla datapack JSON from a Mojang server jar", () => {
    withCachedServerJar(
      "26.2",
      {
        "data/minecraft/recipe/test.json": '{"type":"minecraft:crafting_shapeless"}',
        "data/minecraft/loot_table/blocks/test.json": '{"type":"minecraft:block"}',
      },
      () => {
        const search = searchVanillaDatapackJsonFiles({
          version: "26.2",
          kind: "recipe",
          contains: "test",
        });
        expect(search.matchedFiles).toBe(1);
        expect(search.files[0]?.path).toBe("data/minecraft/recipe/test.json");

        const file = getVanillaDatapackJson({
          version: "26.2",
          path: "data/minecraft/recipe/test.json",
        });
        expect(file.json).toEqual({ type: "minecraft:crafting_shapeless" });
      },
    );
  });

  it("supports parent kind filters for tag and worldgen JSON", () => {
    withCachedServerJar(
      "26.2",
      {
        "data/minecraft/tags/block/mineable.json": "{}",
        "data/minecraft/worldgen/biome/plains.json": "{}",
      },
      () => {
        expect(searchVanillaDatapackJsonFiles({ version: "26.2", kind: "tag" }).matchedFiles).toBe(
          1,
        );
        expect(
          searchVanillaDatapackJsonFiles({ version: "26.2", kind: "worldgen" }).matchedFiles,
        ).toBe(1);
      },
    );
  });

  it("searches parsed values and keys across cached vanilla datapack JSON", () => {
    withCachedServerJar(
      "26.2",
      {
        "data/minecraft/recipe/diamond_widget.json": JSON.stringify({
          type: "minecraft:crafting_shapeless",
          ingredients: [{ item: "minecraft:diamond" }],
          result: { id: "minecraft:diamond_widget" },
        }),
        "data/minecraft/recipe/stone_widget.json": JSON.stringify({
          type: "minecraft:crafting_shaped",
          result: { id: "minecraft:stone_widget" },
        }),
        "data/minecraft/loot_table/blocks/diamond_widget.json": JSON.stringify({
          type: "minecraft:block",
          pools: [{ entries: [{ name: "minecraft:diamond" }] }],
        }),
        "data/minecraft/recipe/invalid.json": "{",
        "assets/minecraft/lang/en_us.json": JSON.stringify({ diamond: "Diamond" }),
      },
      () => {
        const values = searchVanillaDatapackJsonContent({
          version: "26.2",
          query: "MINECRAFT:DIAMOND",
          scope: "values",
          kind: "recipe",
        });
        expect(values.totalJsonFiles).toBe(4);
        expect(values.candidateFiles).toBe(3);
        expect(values.scannedFiles).toBe(3);
        expect(values.matchedFiles).toBe(1);
        expect(values.invalidJsonFiles).toBe(1);
        expect(values.scanComplete).toBe(false);
        expect(values.files[0]).toEqual(
          expect.objectContaining({
            path: "data/minecraft/recipe/diamond_widget.json",
            kind: "recipe",
            matches: expect.arrayContaining([
              {
                pointer: "/ingredients/0/item",
                matchedIn: "value",
                preview: "minecraft:diamond",
              },
            ]),
          }),
        );

        const keys = searchVanillaDatapackJsonContent({
          version: "26.2",
          query: "ingredients",
          scope: "keys",
          prefix: "data/minecraft/recipe/",
        });
        expect(keys.matchedFiles).toBe(1);
        expect(keys.files[0]?.matches[0]).toEqual({
          pointer: "/ingredients",
          matchedIn: "key",
          preview: "ingredients",
        });
      },
    );
  });

  it("searches the nested server payload in modern Mojang bundler jars", () => {
    const nested = testJar({
      "data/minecraft/recipe/bundled.json": JSON.stringify({
        type: "minecraft:crafting_shapeless",
        ingredient: "minecraft:diamond",
      }),
    });
    const nestedSha256 = createHash("sha256").update(nested).digest("hex");
    withCachedServerJar(
      "26.2",
      {
        "META-INF/versions.list": `${nestedSha256}\t26.2\t26.2/server-26.2.jar`,
        "META-INF/versions/26.2/server-26.2.jar": nested,
        "META-INF/libraries/example.jar": "not a server payload",
        "data/minecraft/recipe/decoy.json": "{}",
      },
      () => {
        const files = searchVanillaDatapackJsonFiles({ version: "26.2", kind: "recipe" });
        expect(files.matchedFiles).toBe(1);
        expect(files.files[0]?.path).toBe("data/minecraft/recipe/bundled.json");

        const search = searchVanillaDatapackJsonContent({
          version: "26.2",
          query: "minecraft:diamond",
          kind: "recipe",
        });
        expect(search.matchedFiles).toBe(1);
        expect(search.files[0]?.path).toBe("data/minecraft/recipe/bundled.json");

        const file = getVanillaDatapackJson({
          version: "26.2",
          path: "data/minecraft/recipe/bundled.json",
        });
        expect(file.json).toEqual({
          type: "minecraft:crafting_shapeless",
          ingredient: "minecraft:diamond",
        });
      },
    );
  });

  it("rejects cached jars whose datapack payload cannot be identified", () => {
    withCachedServerJar("26.2", { "META-INF/main-class": "net.minecraft.bundler.Main" }, () => {
      expect(() => searchVanillaDatapackJsonFiles({ version: "26.2" })).toThrow(
        "contains neither datapack data nor bundler metadata",
      );
    });
  });

  it("verifies the nested Mojang bundler payload checksum", () => {
    const nested = testJar({
      "data/minecraft/recipe/bundled.json": JSON.stringify({ type: "minecraft:crafting_shaped" }),
    });
    withCachedServerJar(
      "26.2",
      {
        "META-INF/versions.list": `${"0".repeat(64)}\t26.2\t26.2/server-26.2.jar`,
        "META-INF/versions/26.2/server-26.2.jar": nested,
      },
      () => {
        expect(() => searchVanillaDatapackJsonFiles({ version: "26.2" })).toThrow(
          "failed SHA-256 verification",
        );
      },
    );
  });

  it("rechecks official SHA-1 metadata on every cached JSON operation", () => {
    withCachedServerJar(
      "26.2",
      { "data/minecraft/recipe/entry.json": JSON.stringify({ value: "original" }) },
      (jarFile) => {
        writeFileSync(
          jarFile,
          testJar({ "data/minecraft/recipe/entry.json": JSON.stringify({ value: "tampered" }) }),
        );
        expect(() => searchVanillaDatapackJsonFiles({ version: "26.2" })).toThrow(
          "failed SHA-1 verification",
        );
        expect(() =>
          searchVanillaDatapackJsonContent({ version: "26.2", query: "tampered" }),
        ).toThrow("failed SHA-1 verification");
        expect(() =>
          getVanillaDatapackJson({
            version: "26.2",
            path: "data/minecraft/recipe/entry.json",
          }),
        ).toThrow("failed SHA-1 verification");
      },
    );
  });

  it("bounds Mojang bundler metadata fields before parsing them", () => {
    withCachedServerJar(
      "26.2",
      { "META-INF/versions.list": `${"a".repeat(8_193)}\t26.2\tserver.jar` },
      () => {
        expect(() => searchVanillaDatapackJsonFiles({ version: "26.2" })).toThrow(
          "line exceeds 8192 characters",
        );
      },
    );
  });

  it("bounds exact vanilla datapack JSON reads", () => {
    withCachedServerJar(
      "26.2",
      { "data/minecraft/recipe/large.json": "x".repeat(2 * 1024 * 1024 + 1) },
      () => {
        expect(() =>
          getVanillaDatapackJson({
            version: "26.2",
            path: "data/minecraft/recipe/large.json",
          }),
        ).toThrow("exceeds 2097152 bytes");
      },
    );
  });

  it("rejects non-UTF-8 vanilla datapack JSON text", () => {
    withCachedServerJar(
      "26.2",
      { "data/minecraft/recipe/invalid-utf8.json": Buffer.from([0xc3, 0x28]) },
      () => {
        expect(() =>
          getVanillaDatapackJson({
            version: "26.2",
            path: "data/minecraft/recipe/invalid-utf8.json",
          }),
        ).toThrow("is invalid");
      },
    );
  });

  it("reports oversized JSON files skipped by content search", () => {
    withCachedServerJar(
      "26.2",
      {
        "data/minecraft/recipe/oversized.json": JSON.stringify({
          value: "x".repeat(2 * 1024 * 1024),
        }),
      },
      () => {
        const result = searchVanillaDatapackJsonContent({ version: "26.2", query: "needle" });
        expect(result.skippedOversizedFiles).toBe(1);
        expect(result.scannedFiles).toBe(0);
        expect(result.scanComplete).toBe(false);
      },
    );
  });

  it("bounds vanilla datapack JSON content search output", () => {
    withCachedServerJar(
      "26.2",
      {
        "data/minecraft/recipe/a.json": JSON.stringify({ first: "needle", second: "needle" }),
        "data/minecraft/recipe/b.json": JSON.stringify({ value: "needle" }),
      },
      () => {
        const result = searchVanillaDatapackJsonContent({
          version: "26.2",
          query: "needle",
          limit: 1,
          matchesPerFile: 1,
        });
        expect(result.matchedFiles).toBe(2);
        expect(result.returnedFiles).toBe(1);
        expect(result.files[0]?.matches).toHaveLength(1);
        expect(result.files[0]?.matchesTruncated).toBe(true);
        expect(result.truncated).toBe(true);
      },
    );
  });

  it("searches complete scalar values while bounding their previews", () => {
    const longValue = `${"x".repeat(300)}needle`;
    withCachedServerJar(
      "26.2",
      {
        "data/minecraft/recipe/long.json": JSON.stringify({ value: longValue }),
      },
      () => {
        const result = searchVanillaDatapackJsonContent({
          version: "26.2",
          query: "needle",
          scope: "values",
        });
        expect(result.matchedFiles).toBe(1);
        expect(result.files[0]?.matches[0]).toEqual({
          pointer: "/value",
          matchedIn: "value",
          preview: `${"x".repeat(197)}...`,
        });
      },
    );
  });

  it("bounds JSON pointers and key previews", () => {
    const key = `${"x".repeat(2_000)}needle`;
    withCachedServerJar(
      "26.2",
      {
        "data/minecraft/recipe/large-key.json": JSON.stringify({ [key]: true }),
      },
      () => {
        const result = searchVanillaDatapackJsonContent({
          version: "26.2",
          query: "needle",
          scope: "keys",
        });
        expect(result.files[0]?.matches[0]).toEqual({
          pointer: null,
          pointerTruncated: true,
          matchedIn: "key",
          preview: `${"x".repeat(197)}...`,
        });
      },
    );
  });

  it("limits pending JSON traversal nodes before expanding broad arrays", () => {
    const values = Array.from({ length: 100_001 }, (_, index) =>
      index === 100_000 ? "needle" : null,
    );
    withCachedServerJar(
      "26.2",
      {
        "data/minecraft/recipe/broad.json": JSON.stringify({ values }),
      },
      () => {
        const result = searchVanillaDatapackJsonContent({
          version: "26.2",
          query: "needle",
        });
        expect(result.matchedFiles).toBe(0);
        expect(result.traversalLimitedFiles).toBe(1);
        expect(result.scanComplete).toBe(false);
        expect(result.truncated).toBe(true);
      },
    );
  });

  it("limits JSON traversal depth", () => {
    let nested: unknown = "needle";
    for (let depth = 0; depth < 129; depth += 1) {
      nested = { child: nested };
    }
    withCachedServerJar(
      "26.2",
      { "data/minecraft/recipe/deep.json": JSON.stringify(nested) },
      () => {
        const result = searchVanillaDatapackJsonContent({ version: "26.2", query: "needle" });
        expect(result.matchedFiles).toBe(0);
        expect(result.traversalLimitedFiles).toBe(1);
        expect(result.scanComplete).toBe(false);
      },
    );
  });

  it("enforces one JSON traversal budget across all files", () => {
    const entries = Object.fromEntries(
      Array.from({ length: 11 }, (_, index) => [
        `data/minecraft/recipe/broad-${index}.json`,
        JSON.stringify(Array.from({ length: 100_001 }, () => null)),
      ]),
    );
    withCachedServerJar("26.2", entries, () => {
      const result = searchVanillaDatapackJsonContent({ version: "26.2", query: "needle" });
      expect(result.traversedNodes).toBe(1_000_000);
      expect(result.traversalNodeLimit).toBe(1_000_000);
      expect(result.traversalLimitedFiles).toBe(10);
      expect(result.skippedTraversalFiles).toBe(1);
      expect(result.traversalLimitedPaths).toHaveLength(10);
      expect(result.traversalSkippedPaths).toEqual(["data/minecraft/recipe/broad-9.json"]);
      expect(result.scanComplete).toBe(false);
      expect(result.truncated).toBe(true);
    });
  });

  it("rejects oversized vanilla JSON search inputs before reading the cache", () => {
    expect(() =>
      searchVanillaDatapackJsonContent({ version: "26.2", query: ` ${"x".repeat(256)}` }),
    ).toThrow("1 to 256 characters");
    expect(() =>
      searchVanillaDatapackJsonFiles({ version: "26.2", prefix: "x".repeat(4_097) }),
    ).toThrow("prefix must be a string of at most 4096 characters");
    expect(() =>
      searchVanillaDatapackJsonFiles({ version: "26.2", contains: "x".repeat(257) }),
    ).toThrow("contains must be a string of at most 256 characters");
    expect(() => getVanillaDatapackJson({ version: "26.2", path: "x".repeat(4_097) })).toThrow(
      "path must contain 1 to 4096 characters",
    );
  });

  it("lists installable skill folders", () => {
    expect(listSkills().map((skill) => skill.name)).toEqual([
      "minecraft-datapacks",
      "minecraft-resourcepacks",
      "minecraft-paper-plugins",
    ]);
    expect(listSkills("paper-plugin")).toEqual([
      expect.objectContaining({
        name: "minecraft-paper-plugins",
        path: "skills/minecraft-paper-plugins",
        agentMetadata: "skills/minecraft-paper-plugins/agents/openai.yaml",
      }),
    ]);
  });

  it("loads packaged skill payloads", () => {
    const payload = getSkillPayload("minecraft-paper-plugins");
    expect(payload.skill.domain).toBe("paper-plugin");
    expect(payload.skillMarkdown).toContain("# Minecraft Paper Plugins");
    expect(payload.agentMetadata).toContain('display_name: "Minecraft Paper Plugins"');
    expect(payload.references).toEqual([
      expect.objectContaining({
        reference: expect.objectContaining({
          id: "paper-plugin-sources",
          path: "skills/minecraft-paper-plugins/references/sources.md",
        }),
        markdown: expect.stringContaining("# Paper Plugin Sources"),
      }),
    ]);
  });

  it("lists fact surfaces with guarantees and non-guarantees", () => {
    const datapackSurfaces = listFactSurfaces({ domain: "datapack" });
    expect(datapackSurfaces.map((surface) => surface.id)).toContain("datapack-schema-surface");
    expect(datapackSurfaces.map((surface) => surface.id)).toContain("command-paths");

    const schemaSurface = getFactSurface("datapack-schema-surface");
    expect(schemaSurface.nonGuarantees).toContain("not a normative schema");
    expect(schemaSurface.cli).toContain("datapack search-schema");

    expect(() => getFactSurface("missing")).toThrow("Unknown fact surface: missing");
  });

  it("lists authoring checklists for generation preflight", () => {
    const checklists = listAuthoringChecklists();
    expect(checklists.map((checklist) => checklist.domain)).toEqual([
      "datapack",
      "resourcepack",
      "paper-plugin",
    ]);

    const datapack = getAuthoringChecklist("datapack");
    expect(datapack.steps.map((step) => step.id)).toContain("verify-commands-and-paths");
    expect(datapack.steps.flatMap((step) => step.tools.cli)).toContain("datapack commands");
    expect(datapack.steps.flatMap((step) => step.tools.mcp)).toContain("search_commands");

    const paper = getAuthoringChecklist("paper-plugin");
    expect(paper.steps.map((step) => step.id)).toContain("verify-types-members-and-events");
    expect(paper.steps.flatMap((step) => step.tools.packageApis)).toContain("searchPaperMembers");

    expect(() => getAuthoringChecklist("missing")).toThrow("missing");
  });

  it("lists authoring recipes for ordered task workflows", () => {
    const datapack = listAuthoringRecipes({ domain: "datapack" });
    expect(datapack.map((recipe) => recipe.id)).toContain("datapack-function-command");
    expect(datapack.map((recipe) => recipe.id)).toContain("datapack-observed-json");

    const paper = getAuthoringRecipe("paper-event-listener");
    expect(paper.domains).toEqual(["paper-plugin"]);
    expect(paper.steps.map((step) => step.id)).toContain("discover-event-candidates");
    expect(paper.finalChecks).toContain("paper-event-candidate");

    const itemDelivery = getAuthoringRecipe("paper-safe-item-delivery");
    expect(itemDelivery.steps.map((step) => step.id)).toContain(
      "define-delivery-and-overflow-outcomes",
    );
    expect(itemDelivery.finalChecks).toContain("paper-inventory-delivery-outcomes");
    expect(itemDelivery.steps.flatMap((step) => step.stopIfMissing).join("\n")).toContain(
      "Player.give",
    );

    expect(() => getAuthoringRecipe("missing")).toThrow("Unknown authoring recipe: missing");
  });

  it("lists authoring scenarios for realistic task evaluation", () => {
    const paperScenarios = listAuthoringScenarios({ domain: "paper-plugin" });
    expect(paperScenarios.map((scenario) => scenario.id)).toContain("paper-event-listener-review");
    expect(paperScenarios.map((scenario) => scenario.id)).toContain("paper-api-scheduler-review");
    expect(paperScenarios.map((scenario) => scenario.id)).toContain("paper-item-delivery-review");

    const scenario = getAuthoringScenario("paper-event-listener-review");
    expect(scenario.requiredLookups.recipes).toContain("paper-event-listener");
    expect(scenario.requiredLookups.diagnostics).toContain("paper-event-candidate-unverified");
    expect(scenario.mustAvoid).toContain(
      "generating listener code for an event candidate that was not API-verified",
    );

    const itemDelivery = getAuthoringScenario("paper-item-delivery-review");
    expect(itemDelivery.requiredLookups.recipes).toContain("paper-safe-item-delivery");
    expect(itemDelivery.requiredLookups.diagnostics).toContain(
      "paper-inventory-leftovers-unhandled",
    );
    expect(itemDelivery.mustAvoid.join("\n")).toContain("Player.give");

    expect(() => getAuthoringScenario("missing")).toThrow("Unknown authoring scenario: missing");
  });

  it("searches authoring scenarios from task wording", () => {
    const result = searchAuthoringScenarios({
      query: "Paper event listener",
      domain: "paper-plugin",
    });

    expect(result.domain).toBe("paper-plugin");
    expect(result.results[0]?.scenario.id).toBe("paper-event-listener-review");
    expect(result.results[0]?.matches.some((match) => match.source === "recipe")).toBe(true);
    expect(result.results[0]?.matches.flatMap((match) => match.matchedTokens)).toContain("event");
    expect(result.results.every((entry) => entry.score > 0)).toBe(true);
  });

  it("finds the loss-safe item delivery scenario from overflow wording", () => {
    const result = searchAuthoringScenarios({
      query: "full inventory reward leftovers",
      domain: "paper-plugin",
    });

    expect(result.results[0]?.scenario.id).toBe("paper-item-delivery-review");
    expect(result.results[0]?.matches.flatMap((match) => match.matchedTokens)).toEqual(
      expect.arrayContaining(["inventory", "reward", "leftovers"]),
    );
  });

  it("searches lightweight catalog entries by text, kind, and domain", () => {
    const result = searchCatalog({
      query: "Paper event listener",
      domain: "paper-plugin",
      kind: "authoring-recipe",
    });

    expect(result.domain).toBe("paper-plugin");
    expect(result.kind).toBe("authoring-recipe");
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        kind: "authoring-recipe",
        id: "paper-event-listener",
      }),
    );
    expect(result.results[0]?.matches.map((match) => match.field)).toContain("title");

    const sourceResult = searchCatalog({
      query: "prismarine assets",
      kind: "community-dataset",
    });
    expect(sourceResult.results.map((entry) => entry.id)).toContain(
      "prismarinejs-minecraft-assets",
    );

    const itemDelivery = searchCatalog({
      query: "inventory delivery leftovers",
      domain: "paper-plugin",
      kind: "authoring-recipe",
    });
    expect(itemDelivery.results[0]).toEqual(
      expect.objectContaining({
        kind: "authoring-recipe",
        id: "paper-safe-item-delivery",
      }),
    );
  });

  it("builds authoring plans with scenario lookups resolved", () => {
    const plan = getAuthoringPlan({
      scenario: "paper-event-listener-review",
      version: "1.21.11",
    });

    expect(plan.domain).toBe("paper-plugin");
    expect(plan.scenario.id).toBe("paper-event-listener-review");
    expect(plan.recipes.map((recipe) => recipe.id)).toContain("paper-event-listener");
    expect(plan.intentLookups.map((intent) => intent.id)).toContain(
      "discover-paper-event-candidates",
    );
    expect(plan.diagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-event-candidate-unverified",
    );
    expect(plan.claimPolicies.map((policy) => policy.id)).toContain("paper-event-candidate");
    expect(plan.factSurfaces.map((surface) => surface.id)).toContain("paper-event-search");
    expect(plan.responsePatterns.map((pattern) => pattern.id)).toContain("paper-api-answer");
    expect(plan.preflight?.resolvedVersion).toBe("1.21.11");
    expect(plan.evidence?.links.map((link) => link.id)).toContain("paper-javadocs");
  });

  it("builds a version-aware item delivery safety plan", () => {
    const plan = getAuthoringPlan({
      scenario: "paper-item-delivery-review",
      version: "1.21.11",
    });

    expect(plan.recipes.map((recipe) => recipe.id)).toContain("paper-safe-item-delivery");
    expect(plan.diagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-inventory-leftovers-unhandled",
    );
    expect(plan.claimPolicies.map((policy) => policy.id)).toContain("paper-type-or-member-exists");
    expect(plan.preflight?.resolvedVersion).toBe("1.21.11");
  });

  it("lists authoring guardrails for output safety", () => {
    const guardrails = listAuthoringGuardrails({ domain: "paper-plugin" });
    expect(guardrails.map((guardrail) => guardrail.id)).toContain("global-source-provenance");
    expect(guardrails.map((guardrail) => guardrail.id)).toContain("paper-api-surface-limits");
    expect(guardrails.map((guardrail) => guardrail.id)).toContain(
      "paper-inventory-delivery-outcomes",
    );

    const paper = getAuthoringGuardrail("paper-api-surface-limits");
    expect(paper.rules).toContain(
      "Javadocs package, type, and member indexes prove names and labels only.",
    );
    expect(paper.failureMode).toContain("nonexistent APIs");

    const itemDelivery = getAuthoringGuardrail("paper-inventory-delivery-outcomes");
    expect(itemDelivery.rules.join("\n")).toContain("uninserted stacks");
    expect(itemDelivery.rules.join("\n")).toContain("Player.give");

    expect(() => getAuthoringGuardrail("missing")).toThrow("Unknown authoring guardrail: missing");
  });

  it("lists authoring diagnostics for pre-finalization checks", () => {
    const paperDiagnostics = listAuthoringDiagnostics({ domain: "paper-plugin" });
    expect(paperDiagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-api-member-unverified",
    );
    expect(paperDiagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-threading-assumption",
    );
    expect(paperDiagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-inventory-leftovers-unhandled",
    );

    const diagnostic = getAuthoringDiagnostic("paper-api-member-unverified");
    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.failIf).toContain(
      "plugin code references an API type or member that was not found or explicitly marked unverified",
    );
    expect(diagnostic.tools.packageApis).toContain("searchPaperMembers");

    const itemDelivery = getAuthoringDiagnostic("paper-inventory-leftovers-unhandled");
    expect(itemDelivery.severity).toBe("error");
    expect(itemDelivery.failIf.join("\n")).toContain("original requested stack");
    expect(itemDelivery.tools.packageApis).toContain("getPaperApiReference");

    expect(() => getAuthoringDiagnostic("missing")).toThrow(
      "Unknown authoring diagnostic: missing",
    );
  });

  it("routes default-deny custom inventory GUI interaction safety", () => {
    const recipe = getAuthoringRecipe("paper-inventory-gui-interactions");
    expect(recipe.steps.map((step) => step.id)).toEqual([
      "scope-and-default-deny-the-view",
      "classify-click-source-and-action",
      "validate-the-complete-drag-footprint",
      "settle-editable-session-exactly-once",
      "defer-view-transitions-and-revalidate",
    ]);
    expect(recipe.finalChecks).toContain("paper-inventory-gui-interaction-safety");

    const guardrail = getAuthoringGuardrail("paper-inventory-gui-interaction-safety");
    const rules = guardrail.rules.join("\n");
    for (const interaction of [
      "InventoryClickEvent",
      "InventoryDragEvent",
      "MOVE_TO_OTHER_INVENTORY",
      "NUMBER_KEY",
      "SWAP_OFFHAND",
      "DOUBLE_CLICK",
      "COLLECT_TO_CURSOR",
      "top inventory",
      "bottom player inventory",
      "every raw slot",
      "InventoryCloseEvent",
      "InventoryClickEvent.setCursor",
      "exactly once",
      "overflow outcome",
      "per-session",
      "close, open, or reopen",
    ]) {
      expect(rules).toContain(interaction);
    }

    const diagnostic = getAuthoringDiagnostic("paper-inventory-gui-interaction-unbounded");
    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.failIf.join("\n")).toContain("hotbar swap");
    expect(diagnostic.requiredChecks.join("\n")).toContain("every drag raw slot");
    expect(diagnostic.failIf.join("\n")).toContain("reopen");
    expect(diagnostic.failIf.join("\n")).toContain("deprecated InventoryClickEvent.setCursor");
    expect(diagnostic.failIf.join("\n")).toContain("repeated callbacks");
    expect(diagnostic.requiredChecks.join("\n")).toContain("inserted and uninserted stacks");
    expect(diagnostic.requiredChecks.join("\n")).toContain("click, drag, and close handlers");

    const scenario = getAuthoringScenario("paper-inventory-gui-interaction-review");
    expect(scenario.requiredLookups.recipes).toEqual(["paper-inventory-gui-interactions"]);
    expect(scenario.requiredLookups.diagnostics).toContain(
      "paper-inventory-gui-interaction-unbounded",
    );

    const scenarioSearch = searchAuthoringScenarios({
      query: "custom inventory GUI shift-click drag hotbar offhand double-click",
      domain: "paper-plugin",
    });
    expect(scenarioSearch.results[0]?.scenario.id).toBe("paper-inventory-gui-interaction-review");

    const guardrailSearch = searchCatalog({
      query: "InventoryDragEvent raw slots collect-to-cursor",
      domain: "paper-plugin",
      kind: "authoring-guardrail",
    });
    expect(guardrailSearch.results[0]?.id).toBe("paper-inventory-gui-interaction-safety");

    const plan = getAuthoringPlan({
      scenario: "paper-inventory-gui-interaction-review",
      version: "1.21.11",
    });
    expect(plan.recipes.map((entry) => entry.id)).toEqual(["paper-inventory-gui-interactions"]);
    expect(plan.diagnostics.map((entry) => entry.id)).toContain(
      "paper-inventory-gui-interaction-unbounded",
    );

    const scenarioCriteria = scenario.successCriteria.join("\n");
    expect(scenarioCriteria).toContain("atomic settlement transition");
    expect(scenarioCriteria).toContain("exactly once");
    expect(scenarioCriteria).toContain("InventoryCloseEvent handlers");
    expect(scenario.mustAvoid.join("\n")).toContain("deprecated InventoryClickEvent.setCursor");
  });

  it("routes natural inventory GUI interaction tasks without pack false positives", () => {
    for (const task of [
      "inventory GUI shift-click drag",
      "custom chest menu hotbar swap",
      "protect a virtual inventory from double-click collect to cursor",
      "custom inventory GUI command click",
      "custom inventory GUI click sound",
    ]) {
      const suggestions = suggestMinecraftLookups({
        version: "1.21.11",
        task,
      });
      const tools = suggestions.suggestedTools.map((entry) => entry.tool);
      expect(tools.some((tool) => tool.startsWith("plugin paper search"))).toBe(true);
      expect(tools.some((tool) => tool.startsWith("resourcepack assets"))).toBe(false);
      expect(tools.some((tool) => tool.startsWith("datapack find"))).toBe(false);
      expect(tools.some((tool) => tool.startsWith("minecraft pack-format"))).toBe(false);
      expect(suggestions.scenarios.results[0]?.scenario.id).toBe(
        "paper-inventory-gui-interaction-review",
      );
    }

    const scoped = suggestMinecraftLookups({
      version: "1.21.11",
      task: "inventory GUI shift-click drag",
      domain: "paper-plugin",
    });
    expect(
      scoped.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper search")),
    ).toBe(true);

    for (const task of [
      "search vanilla inventory paths",
      "design a resource pack inventory GUI texture",
      "list items in the vanilla inventory",
    ]) {
      const suggestions = suggestMinecraftLookups({
        version: "1.21.11",
        task,
      });
      expect(
        suggestions.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper search")),
      ).toBe(false);
    }
  });

  it("routes operable Paper administrative command guidance", () => {
    const recipe = getAuthoringRecipe("paper-administrative-command-operability");
    expect(recipe.steps.map((step) => step.id)).toEqual([
      "map-the-operational-surface",
      "model-sender-target-and-scope",
      "enforce-permissions-and-bounded-input",
      "make-mutation-and-reload-atomic",
      "expose-results-and-effective-state",
    ]);
    expect(recipe.finalChecks).toContain("paper-administrative-command-operability");
    const operationalStep = recipe.steps.find((step) => step.id === "map-the-operational-surface");
    expect(operationalStep?.stopIfMissing).toContain("undocumented out-of-band procedure");
    expect(operationalStep?.stopIfMissing).toContain("restart procedure");
    expect(operationalStep?.evidence.join("\n")).toContain("non-command alternative");

    const guardrail = getAuthoringGuardrail("paper-administrative-command-operability");
    const rules = guardrail.rules.join("\n");
    for (const requirement of [
      "console execution",
      "remote console",
      "command block",
      "command minecart",
      "unknown or future subtype",
      "feedback for rejection",
      "explicit target",
      "stable stored identity",
      "least-privilege permission",
      "preview, confirmation",
      "raw secrets",
      "atomically replacing effective state",
      "last valid state",
      "main server thread",
      "typed outcomes",
      "result to the invoker",
      "list, show, or status",
    ]) {
      expect(rules).toContain(requirement);
    }

    const diagnostic = getAuthoringDiagnostic("paper-administrative-command-incomplete");
    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.failIf.join("\n")).toContain("unnecessarily requires an online Player");
    expect(diagnostic.failIf.join("\n")).toContain("last valid state");
    expect(diagnostic.failIf.join("\n")).toContain("invoker");
    expect(diagnostic.failIf.join("\n")).toContain("custom sender");
    expect(diagnostic.failIf.join("\n")).toContain("command minecart");
    expect(diagnostic.failIf.join("\n")).toContain("raw secret");
    expect(diagnostic.requiredChecks.join("\n")).toContain("bulk-confirmation");

    const scenario = getAuthoringScenario("paper-administrative-command-operability-review");
    expect(scenario.requiredLookups.recipes).toEqual(["paper-administrative-command-operability"]);
    expect(scenario.requiredLookups.diagnostics).toContain(
      "paper-administrative-command-incomplete",
    );

    const search = searchAuthoringScenarios({
      query: "admin command console permission reload status offline target",
      domain: "paper-plugin",
    });
    expect(search.results[0]?.scenario.id).toBe("paper-administrative-command-operability-review");

    const plan = getAuthoringPlan({
      scenario: "paper-administrative-command-operability-review",
      version: "1.21.11",
    });
    expect(plan.recipes.map((entry) => entry.id)).toEqual([
      "paper-administrative-command-operability",
    ]);
    expect(plan.diagnostics.map((entry) => entry.id)).toContain(
      "paper-administrative-command-incomplete",
    );
  });

  it("exposes and routes Paper player identity and display guidance", () => {
    const recipe = getAuthoringRecipe("paper-player-identity-and-display");
    expect(recipe.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "persist-and-resolve-stable-identity",
        "make-each-display-source-explicit",
        "bound-refresh-and-cross-server-consistency",
      ]),
    );
    expect(recipe.finalChecks).toContain("paper-player-identity-and-display");

    const guardrail = getAuthoringGuardrail("paper-player-identity-and-display");
    expect(guardrail.rules.join("\n")).toContain("stable player identifier");
    expect(guardrail.rules.join("\n")).toContain("OfflinePlayer object alone");
    expect(guardrail.rules.join("\n")).toContain("trusted proxy forwarding");
    expect(guardrail.rules.join("\n")).toContain("Direct offline mode");
    expect(guardrail.rules.join("\n")).toContain("untrusted names and labels as text");
    expect(guardrail.rules.join("\n")).toContain("mention handling");

    const diagnostic = getAuthoringDiagnostic("paper-player-identity-display-confusion");
    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.failIf.join("\n")).toContain("only persistent player key");
    expect(diagnostic.failIf.join("\n")).toContain("main server thread");
    expect(diagnostic.failIf.join("\n")).toContain("online-mode, offline-mode");
    expect(diagnostic.failIf.join("\n")).toContain("unintended external mention");

    const scenario = getAuthoringScenario("paper-player-identity-and-display-review");
    expect(scenario.requiredLookups.recipes).toEqual(["paper-player-identity-and-display"]);
    expect(scenario.requiredLookups.diagnostics).toContain(
      "paper-player-identity-display-confusion",
    );

    const search = searchAuthoringScenarios({
      query: "Paper UUID player identity display name OfflinePlayer rename cache",
      domain: "paper-plugin",
    });
    expect(search.results[0]?.scenario.id).toBe("paper-player-identity-and-display-review");

    const plan = getAuthoringPlan({
      scenario: "paper-player-identity-and-display-review",
      version: "1.21.11",
    });
    expect(plan.recipes.map((entry) => entry.id)).toContain("paper-player-identity-and-display");
    expect(plan.diagnostics.map((entry) => entry.id)).toContain(
      "paper-player-identity-display-confusion",
    );
  });

  it("lists claim policies for evidence-bounded wording", () => {
    const paperPolicies = listClaimPolicies({ domain: "paper-plugin" });
    expect(paperPolicies.map((policy) => policy.id)).toContain("paper-type-or-member-exists");
    expect(paperPolicies.map((policy) => policy.id)).toContain("folia-or-thread-safety");

    const commandPolicy = getClaimPolicy("command-syntax-exists");
    expect(commandPolicy.domains).toEqual(["datapack"]);
    expect(commandPolicy.allowedWording).toContain(
      "The checked command path proves parser shape, not gameplay behavior.",
    );
    expect(commandPolicy.disallowedWording).toContain(
      "The command will succeed at runtime because the parser path exists.",
    );

    expect(() => getClaimPolicy("missing")).toThrow("Unknown claim policy: missing");
  });

  it("lists output requirements for final answer checks", () => {
    const paperRequirements = listOutputRequirements({ domain: "paper-plugin" });
    expect(paperRequirements.map((requirement) => requirement.id)).toContain(
      "global-version-and-evidence",
    );
    expect(paperRequirements.map((requirement) => requirement.id)).toContain(
      "paper-plugin-output-safety",
    );

    const paper = getOutputRequirement("paper-plugin-output-safety");
    expect(paper.mustInclude).toContain("Javadocs type/member evidence for referenced API names");
    expect(paper.mustNotInclude).toContain("listener code for unverified event class names");

    expect(() => getOutputRequirement("missing")).toThrow("Unknown output requirement: missing");
  });

  it("lists response patterns for source-backed answers", () => {
    const paperPatterns = listResponsePatterns({ domain: "paper-plugin" });
    expect(paperPatterns.map((pattern) => pattern.id)).toContain("verified-authoring-answer");
    expect(paperPatterns.map((pattern) => pattern.id)).toContain("paper-api-answer");

    const pattern = getResponsePattern("paper-api-answer");
    expect(pattern.requiredSections).toContain(
      "Javadocs type/member evidence for referenced API names",
    );
    expect(pattern.gapStatements).toContain(
      "The Javadocs search index proves name presence, not behavior, nullability, or thread safety.",
    );

    expect(() => getResponsePattern("missing")).toThrow("Unknown response pattern: missing");
  });

  it("builds authoring preflight payloads with coverage warnings", () => {
    const datapack = getAuthoringPreflight({ domain: "datapack", version: "26.2" });
    expect(datapack).toMatchObject({
      schemaVersion: 1,
      domain: "datapack",
      resolvedVersion: "26.2",
    });
    expect(datapack.checklist.domain).toBe("datapack");
    expect(datapack.factSurfaces.map((surface) => surface.id)).toContain("command-paths");
    expect(datapack.domainCoverage.unknowns).toEqual([]);
    expect(datapack.downloadable).toContainEqual(
      expect.objectContaining({
        kind: "datapack-schema-surface",
        version: "26.2",
        available: true,
      }),
    );

    const paper = getAuthoringPreflight({ domain: "paper-plugin", version: "26.1" });
    expect(paper.paper?.supported).toBe(false);
    expect(paper.warnings.join("\n")).toContain("Paper is not marked supported for 26.1");
    expect(paper.domainCoverage.status).toBe("not-yet-published");
  });

  it("builds authoring contexts with preflight, intent lookups, and evidence", () => {
    const context = getAuthoringContext({ domain: "paper-plugin", version: "1.21.11" });
    expect(context).toMatchObject({
      schemaVersion: 1,
      domain: "paper-plugin",
      resolvedVersion: "1.21.11",
    });
    expect(context.preflight.checklist.domain).toBe("paper-plugin");
    expect(context.recipes.map((recipe) => recipe.id)).toContain("paper-event-listener");
    expect(context.recipes.map((recipe) => recipe.id)).toContain("paper-safe-item-delivery");
    expect(context.scenarios.map((scenario) => scenario.id)).toContain(
      "paper-event-listener-review",
    );
    expect(context.scenarios.map((scenario) => scenario.id)).toContain(
      "paper-item-delivery-review",
    );
    expect(context.guardrails.map((guardrail) => guardrail.id)).toContain(
      "paper-api-surface-limits",
    );
    expect(context.guardrails.map((guardrail) => guardrail.id)).toContain(
      "paper-inventory-delivery-outcomes",
    );
    expect(context.diagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-api-member-unverified",
    );
    expect(context.diagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-inventory-leftovers-unhandled",
    );
    expect(context.claimPolicies.map((policy) => policy.id)).toContain(
      "paper-type-or-member-exists",
    );
    expect(context.outputRequirements.map((requirement) => requirement.id)).toContain(
      "paper-plugin-output-safety",
    );
    expect(context.responsePatterns.map((pattern) => pattern.id)).toContain("paper-api-answer");
    expect(context.intentLookups.map((intent) => intent.id)).toContain(
      "verify-paper-type-or-member",
    );
    expect(context.evidence.links.map((link) => link.id)).toContain("paper-javadocs");
  });

  it("builds evidence bundles for answer provenance", () => {
    const datapack = getEvidenceBundle({ domain: "datapack", version: "26.2" });
    expect(datapack).toMatchObject({
      schemaVersion: 1,
      domain: "datapack",
      resolvedVersion: "26.2",
      sourcePolicy: {
        minecraftWikiTextRedistribution: "forbidden",
      },
    });
    expect(datapack.primarySources.map((source) => source.id)).toContain(
      "mojang-version-manifest-v2",
    );
    expect(datapack.factSurfaces.map((surface) => surface.id)).toContain("command-paths");
    expect(datapack.dataFiles).toContainEqual(
      expect.objectContaining({
        kind: "server-reports",
        path: "java/reports/26.2.json",
        available: true,
      }),
    );
    expect(datapack.links.map((link) => link.id)).toContain("mojang-version-json");

    const paper = getEvidenceBundle({ domain: "paper-plugin", version: "1.21.11" });
    expect(paper.links.map((link) => link.id)).toContain("paper-javadocs");
    expect(paper.dataFiles).toContainEqual(
      expect.objectContaining({
        kind: "paper-api-surface",
        path: "java/paper-api-surfaces/1.21.11.json",
        available: true,
      }),
    );
  });

  it("builds source reports with allowed source tiers", () => {
    const policy = getSourcePolicy();
    expect(policy.minecraftWikiAutomation).toBe("forbidden");
    expect(policy.sourceTiers.map((tier) => tier.id)).toContain("community-structured");
    expect(policy.recommendedCommunityDatasets.map((source) => source.id)).toContain(
      "prismarinejs-minecraft-data",
    );
    expect(policy.recommendedCommunityDatasets.map((source) => source.id)).toContain(
      "misode-mcmeta",
    );
    expect(listSourceTiers().map((tier) => tier.id)).toContain("canonical-official");
    expect(getSourceTier("community-structured").examples).toContain("PrismarineJS/minecraft-data");
    expect(listCommunityDatasets().map((dataset) => dataset.id)).toContain(
      "prismarinejs-minecraft-assets",
    );

    const report = getSourceReport({ domain: "datapack", version: "26.2" });
    expect(report.domain).toBe("datapack");
    expect(report.resolvedVersion).toBe("26.2");
    expect(report.primarySources?.map((source) => source.id)).toEqual(
      expect.arrayContaining([
        "mojang-version-manifest-v2",
        "misode-mcmeta-data-json",
        "prismarinejs-minecraft-data",
      ]),
    );
    expect(report.prohibitedAutomation).toContain(
      "Do not fetch, crawl, summarize, or cite Minecraft Wiki pages in AI workflows.",
    );
  });

  it("lists intent lookups for choosing exact fact surfaces", () => {
    const datapack = listIntentLookups({ domain: "datapack" });
    expect(datapack.map((intent) => intent.id)).toContain("verify-command-syntax");
    expect(datapack.map((intent) => intent.id)).toContain("verify-datapack-json-shape");

    const paper = getIntentLookup("verify-paper-type-or-member");
    expect(paper.domains).toEqual(["paper-plugin"]);
    expect(paper.lookups[0]?.tools.cli).toContain("plugin paper members");
    expect(paper.lookups[0]?.tools.mcp).toContain("search_paper_members");
    expect(paper.lookups[0]?.failureMode).toContain("does not prove runtime behavior");

    expect(() => getIntentLookup("missing")).toThrow("Unknown intent lookup: missing");
  });

  it("lists per-version support for target selection", () => {
    const support = listVersionSupport({ domain: "paper-plugin" });
    expect(support).toHaveLength(50);
    expect(support[0]).toMatchObject({
      edition: "java",
      version: "26.2",
      paper: {
        supported: true,
        latestBuild: 30,
      },
      surfaces: {
        datapackSchemaSurface: {
          available: true,
        },
      },
    });
    const latestPaper = support.find((entry) => entry.version === "26.2");
    expect(latestPaper).toMatchObject({
      paper: {
        supported: true,
        latestBuild: 30,
      },
      surfaces: {
        paperApiSurface: {
          available: true,
          downloadable: true,
        },
      },
    });
  });

  it("summarizes bundled coverage", () => {
    const summary = getCoverageSummary();
    expect(summary.latest.java).toBe("26.2");
    expect(summary.java.releases).toEqual({
      total: 50,
      latest: "26.2",
      oldest: "1.13",
    });
    expect(summary.java.requiredData).toEqual({
      complete: true,
      missing: [],
    });
    expect(summary.java.packFormats).toEqual({
      extracted: 50,
      missing: 0,
    });
    expect(summary.java.datapack.serverReports).toBe(50);
    expect(summary.java.datapack.observedSchemaSurfaces).toBe(50);
    expect(summary.java.resourcepack.modelSummaries).toBe(50);
    expect(summary.java.paperPlugin).toMatchObject({
      supportedVersions: 46,
      latestSupportedVersion: "26.2",
      latestBuild: 30,
      apiPackageIndexes: 46,
      apiSurfaces: 38,
      versionsWithoutUnknowns: 46,
      missingApiPackageIndexes: [],
    });
    expect(summary.java.paperPlugin.missingApiSurfaces).toEqual([
      "1.13",
      "1.14",
      "1.15",
      "1.17",
      "1.18",
      "1.19",
      "1.20",
      "1.21",
    ]);
    expect(summary.skills).toEqual({
      total: 3,
      packagedPayloads: 3,
    });
  });

  it("exposes support matrix aliases for data selection", () => {
    const matrix = getSupportMatrix();
    expect(matrix.aliases).toMatchObject({
      latestJava: "26.2",
      latestPaper: "26.2",
      latestWithDatapackSchemaSurface: "26.2",
      latestWithPaperApiSurface: "26.2",
    });
    expect(matrix.downloadable).toContainEqual(
      expect.objectContaining({
        kind: "datapack-schema-surface",
        version: "26.2",
      }),
    );
  });

  it("resolves the latest Java version", () => {
    expect(resolveVersion("java", "latest")).toBe("26.2");
  });

  it("does not pretend a release is a bundled snapshot", () => {
    expect(() => resolveVersion("java", "latest-snapshot")).toThrow(
      "No bundled latest snapshot for java",
    );
  });

  it("loads extracted version details for the latest release", () => {
    const version = getVersionDetail("java", "26.2");
    expect(version.coverage).toBe("version-json-and-jar");
    expect(version.packFormats.data).toBe(107);
    expect(version.packFormats.resource).toBe(88);
    expect(version.packFormats.status).toBe("extracted");
  });

  it("loads extracted legacy details for the oldest supported release", () => {
    const version = getVersionDetail("java", "1.13");
    expect(version.coverage).toBe("version-json-and-jar");
    expect(version.packFormats.data).toBe(4);
    expect(version.packFormats.resource).toBe(4);
    expect(version.packFormats.status).toBe("extracted");
  });

  it("classifies datapack and resourcepack file paths", () => {
    const result = classifyPackFiles({
      paths: [
        "data/example/advancement/root.json",
        "data/example/functions/tick.mcfunction",
        "assets/example/models/item/widget.json",
        "assets/example/textures/item/widget.png",
        "README.md",
      ],
    });

    expect(result.totalFiles).toBe(5);
    expect(result.classifiedFiles).toBe(4);
    expect(result.files).toContainEqual(
      expect.objectContaining({
        path: "data/example/advancement/root.json",
        domain: "datapack",
        kind: "advancement",
        schemaAvailable: true,
        schemaKind: "advancement",
      }),
    );
    expect(result.files).toContainEqual(
      expect.objectContaining({
        path: "assets/example/models/item/widget.json",
        domain: "resourcepack",
        kind: "model",
        schemaAvailable: true,
        schemaKind: "model",
      }),
    );
    expect(result.files).toContainEqual(
      expect.objectContaining({
        path: "README.md",
        domain: "unknown",
        schemaAvailable: false,
      }),
    );
  });

  it("returns non-normative observed schemas for pack files", () => {
    const datapack = getPackFileSchema({
      version: "26.2",
      path: "data/example/advancement/root.json",
      domain: "datapack",
    });
    expect(datapack).toMatchObject({
      available: true,
      normative: false,
      file: {
        kind: "advancement",
        schemaKind: "advancement",
      },
      coverage: "vanilla-observed-datapack-json-shape",
    });
    expect(datapack.observedFields.map((field) => field.path)).toContain("$.criteria");
    expect(datapack.jsonSchema?.["x-minecraft-skills"]).toMatchObject({
      normative: false,
    });

    const resourcepack = getPackFileSchema({
      version: "26.2",
      path: "assets/example/items/widget.json",
      domain: "resourcepack",
    });
    expect(resourcepack).toMatchObject({
      available: true,
      normative: false,
      file: {
        kind: "item-definition",
        schemaKind: "item-definition",
      },
      coverage: "client-resourcepack-models",
    });
    expect(resourcepack.observedFields.map((field) => field.path)).toContain("model.type");

    const oldItemDefinition = getPackFileSchema({
      version: "1.20.6",
      path: "assets/example/items/widget.json",
      domain: "resourcepack",
    });
    expect(oldItemDefinition.available).toBe(false);
    expect(oldItemDefinition.notes.join("\n")).toContain("does not expose assets/minecraft/items");

    const oldSingularAdvancement = getPackFileSchema({
      version: "1.20.6",
      path: "data/example/advancement/root.json",
      domain: "datapack",
    });
    expect(oldSingularAdvancement.available).toBe(false);
    expect(oldSingularAdvancement.notes.join("\n")).toContain(
      "does not expose datapack schema kind 'advancement'",
    );

    const unknown = getPackFileSchema({
      version: "26.2",
      path: "assets/example/textures/item/widget.png",
      domain: "resourcepack",
    });
    expect(unknown.available).toBe(true);
    expect(unknown.jsonSchema).toMatchObject({
      contentMediaType: "image/png",
    });
  });

  it("returns schemas for known datapack and resourcepack file formats", () => {
    const paths = [
      ["datapack", "pack.mcmeta"],
      ["datapack", "data/example/tags/block/widgets.json"],
      ["datapack", "data/example/function/tick.mcfunction"],
      ["datapack", "data/example/structure/widgets/root.nbt"],
      ["resourcepack", "pack.mcmeta"],
      ["resourcepack", "assets/example/blockstates/widget.json"],
      ["resourcepack", "assets/example/sounds.json"],
      ["resourcepack", "assets/example/atlases/blocks.json"],
      ["resourcepack", "assets/example/font/default.json"],
      ["resourcepack", "assets/example/lang/en_us.json"],
      ["resourcepack", "assets/example/textures/item/widget.png"],
      ["resourcepack", "assets/example/sounds/widget.ogg"],
      ["resourcepack", "assets/example/particles/widget.json"],
      ["resourcepack", "assets/example/shaders/core/widget.json"],
      ["resourcepack", "assets/example/post_effect/widget.json"],
      ["resourcepack", "assets/example/equipment/widget.json"],
    ] as const;

    for (const [domain, path] of paths) {
      const schema = getPackFileSchema({ version: "26.2", domain, path });
      expect(schema.available, path).toBe(true);
      expect(schema.normative).toBe(false);
      expect(schema.jsonSchema, path).not.toBeNull();
    }
  });

  it("validates pack file content against version-aware schemas", () => {
    const packMetadata = validatePackFileContent({
      version: "26.2",
      domain: "datapack",
      path: "pack.mcmeta",
      content: JSON.stringify({
        pack: {
          pack_format: 107,
          description: "test",
        },
      }),
    });
    expect(packMetadata).toMatchObject({
      validated: true,
      valid: true,
      contentKind: "json",
      schemaAvailable: true,
    });

    const wrongPackFormat = validatePackFileContent({
      version: "26.2",
      domain: "datapack",
      path: "pack.mcmeta",
      content: {
        pack: {
          pack_format: 90,
          description: "test",
        },
      },
    });
    expect(wrongPackFormat.valid).toBe(false);
    expect(wrongPackFormat.issues.map((issue) => issue.keyword)).toContain("const");

    const legacySupportedFormats = validatePackFileContent({
      version: "1.20.1",
      domain: "datapack",
      path: "pack.mcmeta",
      content: {
        pack: {
          pack_format: 15,
          supported_formats: {
            min_inclusive: 15,
            max_inclusive: 18,
          },
          description: "test",
        },
      },
    });
    expect(legacySupportedFormats.valid).toBe(false);
    expect(legacySupportedFormats.issues.map((issue) => issue.keyword)).toContain("not");

    const rangedSupportedFormats = validatePackFileContent({
      version: "1.20.2",
      domain: "datapack",
      path: "pack.mcmeta",
      content: {
        pack: {
          pack_format: 18,
          supported_formats: {
            min_inclusive: 15,
            max_inclusive: 18,
          },
          description: "test",
        },
      },
    });
    expect(rangedSupportedFormats.valid).toBe(true);

    const legacyOverlays = validatePackFileContent({
      version: "1.20.1",
      domain: "resourcepack",
      path: "pack.mcmeta",
      content: {
        pack: {
          pack_format: 15,
          description: "test",
        },
        overlays: {
          entries: [
            {
              directory: "old",
              formats: {
                min_inclusive: 15,
                max_inclusive: 18,
              },
            },
          ],
        },
      },
    });
    expect(legacyOverlays.valid).toBe(false);
    expect(legacyOverlays.issues.map((issue) => issue.keyword)).toContain("not");

    const rangedOverlays = validatePackFileContent({
      version: "1.20.2",
      domain: "resourcepack",
      path: "pack.mcmeta",
      content: {
        pack: {
          pack_format: 18,
          description: "test",
        },
        overlays: {
          entries: [
            {
              directory: "old",
              formats: {
                min_inclusive: 15,
                max_inclusive: 18,
              },
            },
          ],
        },
      },
    });
    expect(rangedOverlays.valid).toBe(true);

    const minorPackFormat = validatePackFileContent({
      version: "1.21.9",
      domain: "datapack",
      path: "pack.mcmeta",
      content: {
        pack: {
          description: "test",
          min_format: [88, 0],
          max_format: [88, 0],
        },
      },
    });
    expect(minorPackFormat.valid).toBe(true);

    const minorSupportedFormats = validatePackFileContent({
      version: "1.21.9",
      domain: "resourcepack",
      path: "pack.mcmeta",
      content: {
        pack: {
          description: "test",
          supported_formats: {
            min_format: [69, 0],
            max_format: [69, 0],
          },
        },
        overlays: {
          entries: [
            {
              directory: "minor",
              formats: {
                min_format: 69,
                max_format: [69, 0],
              },
            },
          ],
        },
      },
    });
    expect(minorSupportedFormats.valid).toBe(true);

    const missingMinorFormat = validatePackFileContent({
      version: "1.21.9",
      domain: "datapack",
      path: "pack.mcmeta",
      content: {
        pack: {
          description: "test",
        },
      },
    });
    expect(missingMinorFormat.valid).toBe(false);
    expect(missingMinorFormat.issues.map((issue) => issue.keyword)).toContain("anyOf");

    const invalidJson = validatePackFileContent({
      version: "26.2",
      domain: "datapack",
      path: "data/example/advancement/root.json",
      content: "{",
    });
    expect(invalidJson).toMatchObject({
      validated: false,
      valid: false,
      contentKind: "json",
    });
    expect(invalidJson.issues[0]?.keyword).toBe("parse");

    const unsupportedVersionLayout = validatePackFileContent({
      version: "1.20.6",
      domain: "resourcepack",
      path: "assets/example/items/widget.json",
      content: { model: { type: "minecraft:model", model: "minecraft:item/widget" } },
    });
    expect(unsupportedVersionLayout).toMatchObject({
      validated: false,
      valid: false,
      schemaAvailable: false,
    });
    expect(unsupportedVersionLayout.issues[0]?.keyword).toBe("version-layout-unsupported");

    const latestItemDefinitionWithCustomFields = validatePackFileContent({
      version: "26.2",
      domain: "resourcepack",
      path: "assets/example/items/widget.json",
      content: {
        model: {
          type: "minecraft:condition",
          property: "minecraft:using_item",
          on_true: { type: "minecraft:model", model: "minecraft:item/widget_active" },
          on_false: { type: "minecraft:model", model: "minecraft:item/widget" },
        },
        oversize_in_gui: true,
      },
    });
    expect(latestItemDefinitionWithCustomFields).toMatchObject({
      validated: true,
      valid: true,
      schemaAvailable: true,
    });

    const customJsonLayout = validatePackFileContent({
      version: "26.2",
      domain: "resourcepack",
      path: "assets/example/custom/widget.json",
      content: { custom: true },
    });
    expect(customJsonLayout).toMatchObject({
      validated: true,
      valid: true,
      schemaAvailable: true,
    });

    const unknownBinaryLayout = validatePackFileContent({
      version: "26.2",
      domain: "resourcepack",
      path: "assets/example/custom/widget.bin",
      content: "bytes",
    });
    expect(unknownBinaryLayout).toMatchObject({
      validated: false,
      valid: true,
      schemaAvailable: false,
    });
    expect(unknownBinaryLayout.issues).toEqual([]);

    const batch = validatePackFilesContent({
      version: "26.2",
      domain: "resourcepack",
      files: [
        {
          path: "assets/example/models/item/widget.json",
          content: { parent: "minecraft:item/generated" },
        },
        {
          path: "assets/example/lang/en_us.json",
          content: { "item.example.widget": "Widget" },
        },
      ],
    });
    expect(batch).toMatchObject({
      totalFiles: 2,
      validatedFiles: 2,
      validFiles: 2,
      invalidFiles: 0,
    });
  });

  it("keeps one 16 MiB PNG inside the shared 64 MiB project binary budget", () => {
    expect(defaultResourcepackPngValidationLimits.maxInputBytes).toBe(16 * 1_024 * 1_024);
    expect(defaultResourcepackProjectValidationLimits.maxBinaryContentBytes).toBe(
      4 * defaultResourcepackPngValidationLimits.maxInputBytes,
    );
  });

  it("validates resource-pack model, PNG, and sound references with bounded binary checks", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/items/widget.json",
          content: {
            model: { type: "minecraft:model", model: "example:item/widget" },
          },
        },
        {
          path: "assets/example/models/item/widget.json",
          content: {
            parent: "example:item/base",
            textures: {
              layer0: "example:item/widget",
              particle: "#layer0",
            },
            elements: [
              {
                faces: { north: { texture: "#inherited" } },
              },
            ],
          },
        },
        {
          path: "assets/example/models/item/base.json",
          content: {
            parent: "minecraft:item/generated",
            textures: { inherited: "example:item/widget" },
          },
        },
        {
          path: "assets/example/textures/item/widget.png",
          content: testPng(),
        },
        {
          path: "assets/example/sounds.json",
          content: {
            "widget.base": { sounds: ["example:widget"] },
            "widget.alias": {
              sounds: [
                {
                  name: "example:widget.base",
                  type: "event",
                  volume: 1,
                  pitch: 1,
                  weight: 2,
                  stream: false,
                  attenuation_distance: 16,
                  preload: true,
                },
              ],
            },
          },
        },
        {
          path: "assets/example/sounds/widget.ogg",
          content: validVorbisIdentificationPage(),
        },
      ],
    });

    expect(result).toMatchObject({
      valid: true,
      modelFiles: 2,
      itemDefinitionFiles: 1,
      soundDefinitionFiles: 1,
      soundEvents: 2,
      soundFileReferences: 1,
      soundEventReferences: 1,
      soundFiles: 1,
      inspectedSoundFiles: 1,
      soundValidationComplete: true,
      soundValidationIncompleteReasons: [],
      validationComplete: true,
      processedFiles: 6,
      pngFiles: 1,
      inspectedPngFiles: 1,
      pngValidationComplete: true,
      binaryFiles: 2,
      parsedJsonFiles: 4,
      errorCount: 0,
      diagnostics: [],
    });
    expect(result.checkedReferences).toBe(9);
    expect(result.notes.join("\n")).toContain("bounded 58-byte");
    expect(result.notes.join("\n")).toContain("IDAT payloads were not decompressed");
  });

  it("reports missing, unqualified, and cyclic local sound references deterministically", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/sounds.json",
          content: {
            a: { sounds: [{ name: "example:b", type: "event" }] },
            b: { sounds: [{ name: "example:a", type: "event" }] },
            missing_file: { sounds: ["example:missing"] },
            missing_event: { sounds: [{ name: "example:nope", type: "event" }] },
            unqualified: { sounds: ["local"] },
            external: { sounds: ["minecraft:block/note_block/harp"] },
          },
        },
        {
          path: "assets/example/sounds/local.ogg",
          content: validVorbisIdentificationPage(),
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.soundValidationComplete).toBe(false);
    expect(result.soundValidationIncompleteReasons).toContain("reference-unverified");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-sound-file",
          reference: "example:missing",
        }),
        expect.objectContaining({
          code: "missing-sound-event",
          reference: "example:nope",
        }),
        expect.objectContaining({
          code: "unqualified-local-sound-reference",
          reference: "local",
        }),
        expect.objectContaining({
          code: "sound-event-cycle",
          reference: "example:a -> example:b -> example:a",
        }),
        expect.objectContaining({
          severity: "warning",
          code: "unverified-external-sound-reference",
          reference: "minecraft:block/note_block/harp",
        }),
      ]),
    );
  });

  it("validates sounds.json entry shapes and numeric bounds", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/sounds.json",
          content: {
            "Bad:event": { sounds: [] },
            invalid_definition: [],
            invalid_entries: {
              replace: "yes",
              subtitle: 1,
              sounds: [
                {},
                { name: "example:test", type: "stream" },
                {
                  name: "example:test",
                  volume: 0,
                  pitch: -1,
                  weight: 0,
                  stream: "yes",
                  attenuation_distance: 1.5,
                  preload: "yes",
                },
                7,
                "example:test.ogg",
              ],
            },
          },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-sound-event-id", reference: "Bad:event" }),
        expect.objectContaining({
          code: "invalid-sound-definition",
          reference: "example:invalid_definition",
        }),
        expect.objectContaining({ code: "invalid-sound-type" }),
        expect.objectContaining({ code: "invalid-sound-entry" }),
        expect.objectContaining({
          code: "invalid-sound-reference",
          reference: "example:test.ogg",
        }),
      ]),
    );

    const schemaResult = validatePackFileContent({
      version: "26.2",
      domain: "resourcepack",
      path: "assets/example/sounds.json",
      content: {
        invalid: {
          sounds: [{ type: "event", volume: 0, pitch: 0, weight: 0 }],
        },
      },
    });
    expect(schemaResult.valid).toBe(false);
  });

  it("strictly checks the complete 58-byte Ogg/Vorbis identification page", () => {
    const cases: Array<{
      name: string;
      code: string;
      rewriteCrc: boolean;
      mutate: (page: Buffer) => void;
    }> = [
      {
        name: "capture",
        code: "invalid-ogg-container",
        rewriteCrc: false,
        mutate: (page) => (page[0] = 0),
      },
      {
        name: "version",
        code: "invalid-ogg-container",
        rewriteCrc: true,
        mutate: (page) => (page[4] = 1),
      },
      {
        name: "flags",
        code: "invalid-ogg-container",
        rewriteCrc: true,
        mutate: (page) => (page[5] = 0),
      },
      {
        name: "granule",
        code: "invalid-ogg-container",
        rewriteCrc: true,
        mutate: (page) => (page[6] = 1),
      },
      {
        name: "sequence",
        code: "invalid-ogg-container",
        rewriteCrc: true,
        mutate: (page) => (page[18] = 1),
      },
      {
        name: "segments",
        code: "invalid-ogg-container",
        rewriteCrc: true,
        mutate: (page) => (page[26] = 2),
      },
      {
        name: "lacing",
        code: "invalid-ogg-container",
        rewriteCrc: true,
        mutate: (page) => (page[27] = 29),
      },
      {
        name: "codec",
        code: "unsupported-sound-codec",
        rewriteCrc: true,
        mutate: (page) => (page[29] = 0),
      },
      {
        name: "Vorbis version",
        code: "invalid-vorbis-identification",
        rewriteCrc: true,
        mutate: (page) => (page[35] = 1),
      },
      {
        name: "channels",
        code: "invalid-vorbis-identification",
        rewriteCrc: true,
        mutate: (page) => (page[39] = 0),
      },
      {
        name: "sample rate",
        code: "invalid-vorbis-identification",
        rewriteCrc: true,
        mutate: (page) => page.fill(0, 40, 44),
      },
      {
        name: "block size",
        code: "invalid-vorbis-identification",
        rewriteCrc: true,
        mutate: (page) => (page[56] = 0x56),
      },
      {
        name: "framing",
        code: "invalid-vorbis-identification",
        rewriteCrc: true,
        mutate: (page) => (page[57] = 0),
      },
      {
        name: "checksum",
        code: "invalid-ogg-container",
        rewriteCrc: false,
        mutate: (page) => (page[22] = (page[22] ?? 0) ^ 1),
      },
    ];

    for (const testCase of cases) {
      const page = validVorbisIdentificationPage();
      testCase.mutate(page);
      if (testCase.rewriteCrc) {
        writeOggCrc(page);
      }
      const result = validateResourcepackProject({
        version: "26.2",
        files: [
          {
            path: `assets/example/sounds/${testCase.name.toLowerCase().replaceAll(" ", "_")}.ogg`,
            content: page,
          },
        ],
      });
      expect(result.diagnostics, testCase.name).toContainEqual(
        expect.objectContaining({ code: testCase.code }),
      );
    }
  });

  it("rejects WAV, Opus, truncated OGG, and channel counts above two", () => {
    const opus = Buffer.alloc(58);
    opus.write("OggS", 0, "ascii");
    opus.write("OpusHead", 28, "ascii");
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        { path: "assets/example/sounds/wave.ogg", content: Buffer.from("RIFF/WAVE") },
        { path: "assets/example/sounds/opus.ogg", content: opus },
        { path: "assets/example/sounds/truncated.ogg", content: Buffer.from("OggS") },
        { path: "assets/example/sounds/unavailable.ogg" },
        { path: "assets/example/sounds/stereo.ogg", content: validVorbisIdentificationPage(2) },
        { path: "assets/example/sounds/surround.ogg", content: validVorbisIdentificationPage(3) },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.soundFiles).toBe(6);
    expect(result.inspectedSoundFiles).toBe(5);
    expect(result.soundValidationComplete).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported-sound-codec",
          path: expect.stringContaining("wave.ogg"),
        }),
        expect.objectContaining({
          code: "unsupported-sound-codec",
          path: expect.stringContaining("opus.ogg"),
        }),
        expect.objectContaining({
          code: "invalid-ogg-container",
          path: expect.stringContaining("truncated.ogg"),
        }),
        expect.objectContaining({ severity: "warning", code: "sound-header-unavailable" }),
        expect.objectContaining({
          severity: "error",
          code: "unsupported-sound-channel-count",
          reference: "3",
        }),
        expect.objectContaining({
          severity: "warning",
          code: "multichannel-sound-no-attenuation",
          reference: "2",
        }),
      ]),
    );
  });

  it("applies the shared diagnostic limit after sound validation", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      limit: 1,
      files: [
        {
          path: "assets/example/sounds.json",
          content: {
            invalid: { sounds: ["example:missing", "example:other_missing"] },
          },
        },
      ],
    });

    expect(result.truncated).toBe(true);
    expect(result.diagnosticTotal).toBe(2);
    expect(result.retainedDiagnosticCount).toBe(1);
    expect(result.omittedDiagnosticCount).toBe(1);
    expect(result.diagnostics).toHaveLength(1);

    const mixedSeverity = validateResourcepackProject({
      version: "26.2",
      limit: 1,
      files: [
        {
          path: "assets/example/sounds.json",
          content: {
            a_warning: { sounds: ["minecraft:unverified"] },
            z_error: { sounds: ["example:missing"] },
          },
        },
      ],
    });
    expect(mixedSeverity).toMatchObject({
      valid: false,
      errorCount: 1,
      warningCount: 1,
      diagnosticTotal: 2,
      retainedDiagnosticCount: 1,
      omittedDiagnosticCount: 1,
    });
    expect(mixedSeverity.diagnostics[0]?.severity).toBe("error");

    const sortedPage = validateResourcepackProject({
      version: "26.2",
      limit: 1,
      files: [
        {
          path: "assets/z/models/item/test.json",
          content: { parent: "z:item/missing" },
        },
        {
          path: "assets/a/sounds.json",
          content: { invalid: { sounds: [7] } },
        },
      ],
    });
    expect(sortedPage.diagnostics[0]?.path).toBe("assets/a/sounds.json");
  });

  it("preserves distinct sound-reference diagnostics and reports incomplete external checks", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/sounds.json",
          content: {
            file_one: { sounds: ["minecraft:missing"] },
            file_two: { sounds: ["minecraft:missing"] },
            event_one: { sounds: [{ name: "minecraft:missing", type: "event" }] },
          },
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.soundValidationComplete).toBe(false);
    expect(result.validationComplete).toBe(false);
    expect(result.soundValidationIncompleteReasons).toEqual(["reference-unverified"]);
    expect(
      result.diagnostics
        .filter((diagnostic) => diagnostic.code === "unverified-external-sound-reference")
        .map((diagnostic) => diagnostic.source),
    ).toEqual([
      "example:event_one.sounds[0]",
      "example:file_one.sounds[0]",
      "example:file_two.sounds[0]",
    ]);
    expect(result.diagnosticTotal).toBe(3);
  });

  it("bounds repeated diagnostics before interpolating a long sound-event identifier", () => {
    const entryCount = 64;
    const longEventPath = `event/${"a".repeat(64 * 1_024)}`;
    const result = validateResourcepackProject({
      version: "26.2",
      limit: entryCount,
      limits: { maxDiagnosticTextLength: 96 },
      files: [
        {
          path: "assets/example/sounds.json",
          content: {
            [longEventPath]: {
              sounds: Array.from({ length: entryCount }, () => ({
                name: "example:test",
                type: "invalid",
              })),
            },
          },
        },
      ],
    });

    expect(result.diagnosticTotal).toBe(entryCount);
    expect(result.retainedDiagnosticCount).toBe(entryCount);
    expect(new Set(result.diagnostics.map((diagnostic) => diagnostic.reference)).size).toBe(
      entryCount,
    );
    for (const diagnostic of result.diagnostics) {
      expect(diagnostic.reference?.length).toBeLessThanOrEqual(96);
      expect(diagnostic.message.length).toBeLessThanOrEqual(96);
    }
  });

  it("keeps exact diagnostic counts independent of display-text truncation", () => {
    const fileCount = 17;
    const result = validateResourcepackProject({
      version: "26.2",
      limit: 100,
      limits: { maxDiagnosticTextLength: 1 },
      files: Array.from({ length: fileCount }, (_, index) => ({
        path: `assets/example/sounds/invalid_${index}.ogg`,
        content: Uint8Array.of(index),
      })),
    });

    expect(result.errorCount).toBe(fileCount);
    expect(result.diagnosticTotal).toBe(fileCount);
    expect(result.retainedDiagnosticCount).toBe(fileCount);
    expect(result.omittedDiagnosticCount).toBe(0);
    expect(new Set(result.diagnostics.map((diagnostic) => diagnostic.path)).size).toBeLessThan(
      fileCount,
    );
  });

  it("walks a deep sound-event graph without recursive stack growth", () => {
    const eventCount = 12_000;
    const definitions: Record<string, unknown> = {};
    for (let index = 0; index < eventCount; index += 1) {
      const event = `chain/${String(index).padStart(5, "0")}`;
      const next = `chain/${String(index + 1).padStart(5, "0")}`;
      definitions[event] = {
        sounds: index + 1 < eventCount ? [{ name: `example:${next}`, type: "event" }] : [],
      };
    }

    const result = validateResourcepackProject({
      version: "26.2",
      files: [{ path: "assets/example/sounds.json", content: definitions }],
    });

    expect(result.valid).toBe(true);
    expect(result.soundEvents).toBe(eventCount);
    expect(result.soundEventReferences).toBe(eventCount - 1);
    expect(result.soundValidationComplete).toBe(true);

    for (let index = 1; index < eventCount; index += 1) {
      const event = `chain/${String(index).padStart(5, "0")}`;
      const next = `chain/${String(index + 1).padStart(5, "0")}`;
      definitions[event] = {
        sounds: [
          { name: "example:chain/00000", type: "event" },
          ...(index + 1 < eventCount ? [{ name: `example:${next}`, type: "event" }] : []),
        ],
      };
    }
    const cyclic = validateResourcepackProject({
      version: "26.2",
      files: [{ path: "assets/example/sounds.json", content: definitions }],
    });
    const cycleDiagnostics = cyclic.diagnostics.filter(
      (diagnostic) => diagnostic.code === "sound-event-cycle",
    );
    expect(cycleDiagnostics).toHaveLength(1);
    expect(cycleDiagnostics[0]?.reference?.length).toBeLessThanOrEqual(
      cyclic.appliedLimits.maxDiagnosticTextLength,
    );
  });

  it("bounds a reused long resolved texture value before repeated diagnostics", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      limits: { maxDiagnosticTextLength: 96 },
      files: [
        {
          path: "assets/example/models/item/long-texture.json",
          content: {
            textures: { layer0: `INVALID-${"x".repeat(64 * 1_024)}` },
            elements: Array.from({ length: 64 }, () => ({
              faces: { north: { texture: "#layer0" } },
            })),
          },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-texture-reference" }),
    );
    for (const diagnostic of result.diagnostics) {
      expect(diagnostic.reference?.length ?? 0).toBeLessThanOrEqual(96);
      expect(diagnostic.message.length).toBeLessThanOrEqual(96);
    }
  });

  it("bounds sound-event and entry processing with explicit completeness metadata", () => {
    const eventLimited = validateResourcepackProject({
      version: "26.2",
      limits: { maxSoundEvents: 2 },
      files: [
        {
          path: "assets/example/sounds.json",
          content: { a: {}, b: {}, c: {} },
        },
      ],
    });
    expect(eventLimited).toMatchObject({
      valid: false,
      soundEvents: 2,
      soundValidationComplete: false,
      validationComplete: false,
      exceededLimits: ["maxSoundEvents"],
      soundValidationIncompleteReasons: ["limit-exceeded"],
    });
    expect(eventLimited.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "resourcepack-validation-limit-exceeded",
        reference: "maxSoundEvents",
      }),
    );

    const entryLimited = validateResourcepackProject({
      version: "26.2",
      limits: { maxSoundEntries: 2 },
      files: [
        {
          path: "assets/example/sounds.json",
          content: { a: { sounds: [7, 8, 9] } },
        },
      ],
    });
    expect(entryLimited.exceededLimits).toEqual(["maxSoundEntries"]);
    expect(entryLimited.diagnosticTotal).toBe(3);
    expect(entryLimited.soundValidationComplete).toBe(false);
  });

  it("bounds repeated model-context work and walks deep parent cycles iteratively", () => {
    const workLimited = validateResourcepackProject({
      version: "26.2",
      limits: { maxModelGraphOperations: 1 },
      files: [
        {
          path: "assets/example/models/item/base.json",
          content: { parent: "minecraft:item/generated" },
        },
        {
          path: "assets/example/models/item/child.json",
          content: { parent: "example:item/base" },
        },
      ],
    });
    expect(workLimited).toMatchObject({
      valid: false,
      validationComplete: false,
      exceededLimits: ["maxModelGraphOperations"],
    });

    const texturePrecomputationLimited = validateResourcepackProject({
      version: "26.2",
      limits: { maxModelGraphOperations: 1 },
      files: [
        {
          path: "assets/example/models/item/self.json",
          content: {
            parent: "example:item/self",
            textures: { first: "example:first", second: "example:second" },
          },
        },
      ],
    });
    expect(texturePrecomputationLimited).toMatchObject({
      valid: false,
      validationComplete: false,
      exceededLimits: ["maxModelGraphOperations"],
    });

    const modelCount = 12_000;
    const files = Array.from({ length: modelCount }, (_, index) => {
      const id = String(index).padStart(5, "0");
      const parent = String((index + 1) % modelCount).padStart(5, "0");
      return {
        path: `assets/example/models/cycle/${id}.json`,
        content: { parent: `example:cycle/${parent}` },
      };
    });
    const cyclic = validateResourcepackProject({ version: "26.2", files });
    const cycles = cyclic.diagnostics.filter(
      (diagnostic) => diagnostic.code === "model-parent-cycle",
    );
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.reference?.length).toBeLessThanOrEqual(
      cyclic.appliedLimits.maxDiagnosticTextLength,
    );
  });

  it("stops before allocations when project request limits are exceeded", () => {
    const tooManyFiles = validateResourcepackProject({
      version: "26.2",
      limits: { maxFiles: 1 },
      files: [{ path: "pack.mcmeta" }, { path: "pack.png" }],
    });
    expect(tooManyFiles).toMatchObject({
      valid: false,
      totalFiles: 2,
      processedFiles: 0,
      validationComplete: false,
      exceededLimits: ["maxFiles"],
      appliedLimits: expect.objectContaining({ maxFiles: 1, maxDiagnostics: 100 }),
      omittedDiagnosticCount: 0,
    });

    const oversizedHeader = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/sounds/too_large.ogg",
          content: Buffer.alloc(59),
        },
      ],
    });
    expect(oversizedHeader.exceededLimits).toEqual(["maxSoundHeaderBytes"]);
    expect(oversizedHeader.processedFiles).toBe(0);

    const png = testPng();
    const aggregateExceeded = validateResourcepackProject({
      version: "26.2",
      limits: { maxBinaryContentBytes: png.byteLength + vorbisIdentificationPageBytes - 1 },
      files: [
        { path: "pack.png", content: png },
        {
          path: "assets/example/sounds/test.ogg",
          content: validVorbisIdentificationPage(),
        },
      ],
    });
    expect(aggregateExceeded).toMatchObject({
      valid: false,
      processedFiles: 0,
      validationComplete: false,
      exceededLimits: ["maxBinaryContentBytes"],
      soundValidationComplete: false,
      soundValidationIncompleteReasons: ["limit-exceeded"],
      pngFiles: 1,
      inspectedPngFiles: 0,
      pngValidationComplete: false,
      pngValidationIncompleteReasons: ["project-limit-exceeded"],
    });

    const oversizedParsedJson = validateResourcepackProject({
      version: "26.2",
      limits: { maxContentNodes: 5 },
      files: [
        {
          path: "assets/example/sounds.json",
          content: JSON.stringify({ a: { sounds: [1, 2, 3] } }),
        },
      ],
    });
    expect(oversizedParsedJson.exceededLimits).toEqual(["maxContentNodes"]);
    expect(oversizedParsedJson.processedFiles).toBe(0);

    const sparseSounds = new Array(1_000);
    const oversizedSparseArray = validateResourcepackProject({
      version: "26.2",
      limits: { maxContentNodes: 10 },
      files: [
        {
          path: "assets/example/sounds.json",
          content: { a: { sounds: sparseSounds } },
        },
      ],
    });
    expect(oversizedSparseArray.exceededLimits).toEqual(["maxContentNodes"]);
    expect(oversizedSparseArray.processedFiles).toBe(0);
  });

  it("integrates complete and unavailable PNG content, including pack.png", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        { path: "pack.png", content: Buffer.from("not a png") },
        { path: "assets/example/textures/item/unavailable.png" },
      ],
    });

    expect(result).toMatchObject({
      valid: false,
      pngFiles: 2,
      inspectedPngFiles: 1,
      pngValidationComplete: false,
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "png.invalid-signature", path: "pack.png" }),
        expect.objectContaining({
          severity: "warning",
          code: "png-content-unavailable",
          path: "assets/example/textures/item/unavailable.png",
        }),
      ]),
    );
  });

  it("retains PNG diagnostics for each duplicate file occurrence", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        { path: "pack.png", content: Buffer.from("not a png") },
        { path: "pack.png", content: Buffer.from("not a png") },
      ],
    });

    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === "png.invalid-signature"),
    ).toHaveLength(2);
  });

  it("reports missing resource-pack model, parent, texture, and texture-variable references", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/items/widget.json",
          content: {
            model: { type: "minecraft:model", model: "example:item/missing" },
          },
        },
        {
          path: "assets/example/models/item/widget.json",
          content: {
            parent: "example:item/missing_parent",
            textures: {
              layer0: "example:item/missing_texture",
            },
          },
        },
        {
          path: "assets/example/models/item/missing_variable.json",
          content: {
            textures: { particle: "#missing" },
            elements: [{ faces: { north: { texture: "#face_missing" } } }],
          },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "missing-item-model",
          path: "assets/example/items/widget.json",
          reference: "example:item/missing",
        }),
        expect.objectContaining({
          severity: "error",
          code: "missing-model-parent",
          path: "assets/example/models/item/widget.json",
          reference: "example:item/missing_parent",
        }),
        expect.objectContaining({
          severity: "error",
          code: "missing-texture",
          path: "assets/example/models/item/widget.json",
          reference: "example:item/missing_texture",
        }),
        expect.objectContaining({
          severity: "error",
          code: "missing-texture-variable",
          path: "assets/example/models/item/missing_variable.json",
          reference: "#missing",
        }),
        expect.objectContaining({
          severity: "error",
          code: "missing-texture-variable",
          path: "assets/example/models/item/missing_variable.json",
          reference: "#face_missing",
        }),
      ]),
    );
  });

  it("validates base-model references used by special item definitions", () => {
    const valid = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/items/banner.json",
          content: {
            model: {
              type: "minecraft:special",
              base: "minecraft:item/template_banner",
              model: { type: "minecraft:banner" },
            },
          },
        },
      ],
    });
    const missing = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/items/banner.json",
          content: {
            model: {
              type: "minecraft:special",
              base: "example:item/missing_banner_base",
              model: { type: "minecraft:banner" },
            },
          },
        },
      ],
    });

    expect(valid.valid).toBe(true);
    expect(missing.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "missing-item-model",
        path: "assets/example/items/banner.json",
        reference: "example:item/missing_banner_base",
      }),
    );
  });

  it("validates legacy model override targets", () => {
    const result = validateResourcepackProject({
      version: "1.20",
      files: [
        {
          path: "assets/example/models/item/clock.json",
          content: {
            parent: "minecraft:item/generated",
            overrides: [{ predicate: { time: 0.5 }, model: "example:item/missing_clock_state" }],
          },
        },
      ],
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "missing-model-override",
        path: "assets/example/models/item/clock.json",
        reference: "example:item/missing_clock_state",
      }),
    );
  });

  it("resolves inherited texture variables in each concrete child context", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/items/good.json",
          content: { model: { type: "minecraft:model", model: "example:item/good" } },
        },
        {
          path: "assets/example/items/bad.json",
          content: { model: { type: "minecraft:model", model: "example:item/bad" } },
        },
        {
          path: "assets/example/models/item/template.json",
          content: {
            textures: { particle: "#layer0" },
            elements: [{ faces: { north: { texture: "#layer0" } } }],
          },
        },
        {
          path: "assets/example/models/item/good.json",
          content: {
            parent: "example:item/template",
            textures: { layer0: "example:item/widget" },
          },
        },
        {
          path: "assets/example/models/item/bad.json",
          content: { parent: "example:item/template" },
        },
        {
          path: "assets/example/textures/item/widget.png",
          content: testPng(),
        },
      ],
    });

    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({
        code: "missing-texture-variable",
        path: "assets/example/models/item/good.json",
      }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-texture-variable",
        path: "assets/example/models/item/bad.json",
        reference: "#layer0",
      }),
    );
  });

  it("lets child texture definitions override missing parent assets", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/models/item/template.json",
          content: {
            textures: { layer0: "example:item/missing_parent_texture" },
            elements: [{ faces: { north: { texture: "#layer0" } } }],
          },
        },
        {
          path: "assets/example/models/item/widget.json",
          content: {
            parent: "example:item/template",
            textures: { layer0: "example:item/widget" },
          },
        },
        {
          path: "assets/example/textures/item/widget.png",
          content: testPng(),
        },
      ],
    });

    expect(result.valid).toBe(true);
  });

  it("reports texture alias cycles in a concrete model context", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/models/item/widget.json",
          content: {
            textures: { layer0: "#layer1", layer1: "#layer0" },
            elements: [{ faces: { north: { texture: "#layer0" } } }],
          },
        },
      ],
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "texture-variable-cycle",
        path: "assets/example/models/item/widget.json",
        reference: "#layer0",
      }),
    );
  });

  it("rejects model face textures that do not reference a texture variable", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/models/item/widget.json",
          content: {
            elements: [
              { faces: { north: { texture: "example:item/missing_direct_face_texture" } } },
            ],
          },
        },
      ],
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalid-texture-reference",
        path: "assets/example/models/item/widget.json",
        reference: "example:item/missing_direct_face_texture",
      }),
    );
  });

  it("rejects unsafe project paths and traversing resource locations", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "./assets/example/models/item/widget.json",
          content: { parent: "minecraft:item/generated" },
        },
        {
          path: "assets/example/items/widget.json",
          content: {
            model: { type: "minecraft:model", model: "example:item/../item/widget" },
          },
        },
        {
          path: "assets/example/items/dot_namespace.json",
          content: { model: { type: "minecraft:model", model: "..:item/widget" } },
        },
        {
          path: "assets/Example/models/item/Widget.json",
          content: { parent: "minecraft:item/generated" },
        },
        {
          path: "assets/Example/sounds.json",
          content: {},
        },
        {
          path: "assets/example/Sounds/Bad.ogg",
          content: validVorbisIdentificationPage(),
        },
      ],
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-project-path" }),
        expect.objectContaining({
          code: "invalid-resource-path",
          path: "assets/Example/sounds.json",
        }),
        expect.objectContaining({
          code: "invalid-resource-path",
          path: "assets/example/Sounds/Bad.ogg",
        }),
        expect.objectContaining({
          code: "invalid-model-reference",
          reference: "example:item/../item/widget",
        }),
        expect.objectContaining({
          code: "invalid-model-reference",
          reference: "..:item/widget",
        }),
      ]),
    );
  });

  it("warns when a texture variable can only be checked inside a vanilla parent", () => {
    const result = validateResourcepackProject({
      version: "1.21",
      files: [
        {
          path: "assets/example/models/item/widget.json",
          content: {
            parent: "minecraft:item/music_disc_creator",
            elements: [{ faces: { north: { texture: "#not_locally_known" } } }],
          },
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "unverified-vanilla-texture-variable",
        reference: "#not_locally_known",
      }),
    );
  });

  it("detects deterministic local model-parent cycles", () => {
    const result = validateResourcepackProject({
      version: "26.2",
      files: [
        {
          path: "assets/example/models/item/b.json",
          content: { parent: "example:item/a" },
        },
        {
          path: "assets/example/models/item/a.json",
          content: { parent: "example:item/b" },
        },
      ],
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "model-parent-cycle",
        path: "assets/example/models/item/a.json",
        reference: "example:item/a -> example:item/b -> example:item/a",
      }),
    );
  });

  it("resolves vanilla resource-pack references against the requested version", () => {
    const files = [
      {
        path: "assets/example/models/item/widget.json",
        content: { parent: "minecraft:item/music_disc_creator" },
      },
    ];

    expect(validateResourcepackProject({ version: "1.21", files }).valid).toBe(true);
    expect(validateResourcepackProject({ version: "1.20.6", files }).diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-model-parent",
        reference: "minecraft:item/music_disc_creator",
      }),
    );
  });

  it("builds pack migration plans with considerations", () => {
    const datapack = getPackMigrationPlan({
      domain: "datapack",
      from: "1.20.6",
      to: "1.21",
      paths: [
        "pack.mcmeta",
        "data/example/advancement/root.json",
        "data/example/functions/tick.mcfunction",
      ],
      limit: 5,
    });
    expect(datapack).toMatchObject({
      schemaVersion: 1,
      domain: "datapack",
      from: "1.20.6",
      to: "1.21",
      summary: {
        packFormatChanged: true,
        schemaBackedFiles: 2,
      },
    });
    expect(datapack.schemaLookups.map((lookup) => lookup.file.kind)).toEqual([
      "pack-metadata",
      "advancement",
      "function",
    ]);
    expect(datapack.schemaLookups.map((lookup) => lookup.available)).toEqual([true, true, false]);
    expect(datapack.considerations.join("\n")).toContain("pack.mcmeta");
    expect(datapack.recommendedChecks).toContain("datapack compare-schema");

    const resourcepack = getPackMigrationPlan({
      domain: "resourcepack",
      from: "1.20.6",
      to: "1.21",
      paths: ["assets/example/items/widget.json"],
      limit: 5,
    });
    expect(resourcepack.summary.packFormatChanged).toBe(true);
    expect(resourcepack.summary.schemaBackedFiles).toBe(0);
    expect(resourcepack.schemaLookups[0]?.file.kind).toBe("item-definition");
    expect(resourcepack.schemaLookups[0]?.available).toBe(false);
    expect(resourcepack.recommendedChecks).toContain("resourcepack file-schema");
  });

  it("keeps Minecraft Wiki prose out of redistributable data", () => {
    expect(getSourcePolicy().minecraftWikiTextRedistribution).toBe("forbidden");
    expect(getSourcePolicy().minecraftWikiAutomation).toBe("forbidden");
  });

  it("loads Paper plugin source metadata", () => {
    expect(getDomain("paper-plugin").primarySources.map((source) => source.id)).toContain(
      "spigot-event-list",
    );
  });

  it("loads Paper plugin data and event search contract", () => {
    const paper = getPaperPluginData();
    expect(paper.latest).toEqual({
      minecraftVersion: "26.2",
      build: 30,
    });
    expect(paper.support.minecraftLatestGap).toEqual({
      javaLatest: "26.2",
      paperLatest: "26.2",
      status: "paper-current-with-java-latest",
    });
    expect(paper.versionBuilds).toContainEqual({
      minecraftVersion: "1.21.11",
      latestBuild: 132,
      buildCount: 92,
    });
    expect(paper.eventSearch.paperSources).toEqual(["spigot", "paper"]);
    expect(paper.sources.map((source) => source.id)).toContain("papermc-docs-paper-folia-support");
  });

  it("builds Paper event search URLs", () => {
    const url = buildPaperEventSearchUrl({
      query: "player join",
      version: "1.21.11",
      source: "paper",
      limit: 5,
    });
    expect(url).toContain("https://spigot-event-list.s7a.dev/api/search/events");
    expect(url).toContain("q=player+join");
    expect(url).toContain("version=1.21.11");
    expect(url).toContain("source=paper");
    expect(url).toContain("limit=5");
  });

  it("builds Modrinth project search URLs with facets", () => {
    const url = new URL(
      buildModrinthProjectSearchUrl({
        query: "voice chat",
        version: "1.21.11",
        projectType: "mod",
        loader: "fabric",
        category: "technology",
        index: "downloads",
        offset: 20,
        limit: 25,
      }),
    );
    expect(url.origin + url.pathname).toBe("https://api.modrinth.com/v2/search");
    expect(url.searchParams.get("query")).toBe("voice chat");
    expect(url.searchParams.get("index")).toBe("downloads");
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(JSON.parse(url.searchParams.get("facets") ?? "[]")).toEqual([
      ["versions:1.21.11"],
      ["all_project_types:mod"],
      ["categories:fabric"],
      ["categories:technology"],
    ]);
  });

  it("searches Modrinth with an identifying user agent", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const result = await searchModrinthProjects({ query: "sodium" }, async (url, init) => {
      requestUrl = url;
      requestInit = init;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ hits: [{ slug: "sodium" }] }),
      };
    });
    expect(requestUrl).toContain("query=sodium");
    expect(new Headers(requestInit?.headers).get("User-Agent")).toContain("minecraft-skills");
    expect(result).toEqual({ hits: [{ slug: "sodium" }] });
  });

  it("builds filtered Modrinth project version URLs", () => {
    const url = new URL(
      buildModrinthProjectVersionsUrl({
        project: "simple-voice-chat",
        gameVersions: ["1.21.11"],
        loaders: ["fabric", "neoforge"],
        featured: true,
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://api.modrinth.com/v2/project/simple-voice-chat/version",
    );
    expect(JSON.parse(url.searchParams.get("game_versions") ?? "[]")).toEqual(["1.21.11"]);
    expect(JSON.parse(url.searchParams.get("loaders") ?? "[]")).toEqual(["fabric", "neoforge"]);
    expect(url.searchParams.get("featured")).toBe("true");
    expect(url.searchParams.get("include_changelog")).toBe("false");
  });

  it("lists Modrinth project versions with an identifying user agent", async () => {
    let requestInit: RequestInit | undefined;
    const result = await listModrinthProjectVersions({ project: "sodium" }, async (_url, init) => {
      requestInit = init;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => [{ id: "version-id", version_number: "1.0.0" }],
      };
    });
    expect(new Headers(requestInit?.headers).get("User-Agent")).toContain("minecraft-skills");
    expect(result).toEqual([{ id: "version-id", version_number: "1.0.0" }]);
  });

  it("builds Modrinth public resource URLs", () => {
    expect(buildModrinthResourceUrl({ resource: "project", identifier: "sodium" })).toBe(
      "https://api.modrinth.com/v2/project/sodium",
    );
    expect(
      buildModrinthResourceUrl({
        resource: "version-file",
        identifier: "abc123",
        algorithm: "sha512",
      }),
    ).toContain("version_file/abc123?algorithm=sha512");
    expect(buildModrinthResourceUrl({ resource: "game-versions" })).toBe(
      "https://api.modrinth.com/v2/tag/game_version",
    );
  });

  it("gets a Modrinth public resource", async () => {
    const result = await getModrinthResource({ resource: "statistics" }, async (url, init) => ({
      ok: url.endsWith("/statistics") && new Headers(init?.headers).has("User-Agent"),
      status: 200,
      statusText: "OK",
      json: async () => ({ projects: 123 }),
    }));
    expect(result).toEqual({ projects: 123 });
  });

  it("validates a Modrinth pack index and archive offline", () => {
    const index = JSON.stringify(validModrinthIndex());
    const result = validateModrinthPackArchive(
      testJar({
        "modrinth.index.json": index,
        "overrides/config/example.json": "base",
        "server-overrides/config/example.json": "server",
      }),
    );
    const inconsistent = validateModrinthPack({
      index,
      archiveEntries: [{ path: "modrinth.index.json", size: 1 }],
    });

    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(1);
    expect(result.validationStrength).toBe("binary");
    expect(result.archive).toEqual({ provided: true, entries: 3, overrideFiles: 2 });
    expect(result.index).toMatchObject({
      formatVersion: 1,
      game: "minecraft",
      versionId: "example-pack-1.0.0",
      name: "Example Pack",
      files: 1,
    });
    expect(result.diagnostics[0]?.code).toBe("archive.override-layer-conflict");
    expect(inconsistent.valid).toBe(false);
    expect(inconsistent.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "archive.index-size-mismatch" })]),
    );
  });

  it("applies binary archive limits through the public validator", () => {
    const archive = testJar({
      "modrinth.index.json": JSON.stringify(validModrinthIndex()),
    });
    const result = validateModrinthPackArchive(archive, {
      limits: { maxArchiveBytes: archive.byteLength - 1 },
    });

    expect(result.valid).toBe(false);
    expect(result.validationStrength).toBe("binary");
    expect(result.archive).toEqual({ provided: true, entries: 0, overrideFiles: 0 });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "archive.byte-limit-exceeded" }),
    ]);
  });

  it("does not derive index consistency errors after incomplete ZIP inspection", () => {
    const result = validateModrinthPackArchive(Buffer.from("not a zip"));

    expect(result.valid).toBe(false);
    expect(result.archive).toEqual({ provided: true, entries: 0, overrideFiles: 0 });
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "archive.invalid-zip" })]);
  });

  it("reports invalid Modrinth index fields with deterministic diagnostics", () => {
    const invalidIndex = {
      formatVersion: 2,
      game: "other",
      versionId: " ",
      name: "",
      files: [
        {
          path: "mods/example.jar",
          hashes: { sha1: "bad", sha512: "bad" },
          env: { client: "sometimes", server: "unsupported" },
          downloads: [
            "http://example.com/example.jar",
            "http://example.com/example.jar",
            "https://example.com/%zz",
          ],
          fileSize: -1,
        },
        {
          path: "MODS/example.jar",
          hashes: { sha1: "a".repeat(40), sha512: "b".repeat(128) },
          downloads: ["https://example.com/example.jar"],
          fileSize: 1,
        },
      ],
      dependencies: { minecraft: "" },
    };

    const result = validateModrinthPack({ index: invalidIndex });
    const secondResult = validateModrinthPack({ index: invalidIndex });
    const malformedJson = validateModrinthPack({ index: "{" });
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(secondResult.diagnostics);
    expect(malformedJson.diagnostics).toEqual([
      expect.objectContaining({ code: "index.invalid-json", path: "modrinth.index.json" }),
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "file.download",
        "file.duplicate-download",
        "file.normalized-path-conflict",
        "file.env-side",
        "file.sha1",
        "file.sha512",
        "file.size",
        "index.format-version",
        "index.game",
        "index.minecraft-dependency",
        "index.name",
        "index.version-id",
      ]),
    );
  });

  it("rejects traversal in downloaded and archived Modrinth pack paths", () => {
    const index = validModrinthIndex();
    const files = index.files as Array<Record<string, unknown>>;
    files[0] = { ...files[0], path: "../outside.jar" };
    const archiveEntries = [
      { path: "overrides/../../escape.txt", size: 1 },
      { path: "overrides/config/duplicate.txt", size: 1 },
      { path: "overrides/config/duplicate.txt", size: 1 },
      { path: "modrinth.index.json", size: JSON.stringify(index).length },
    ];

    const result = validateModrinthPack({ index, archiveEntries });
    const reversed = validateModrinthPack({ index, archiveEntries: [...archiveEntries].reverse() });
    const missingIndex = validateModrinthPack({
      index: validModrinthIndex(),
      archiveEntries: [{ path: "overrides/options.txt", size: 1 }],
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(reversed.diagnostics);
    expect(missingIndex.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "archive.index-missing" })]),
    );
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "file.unsafe-path", path: "/files/0/path" }),
        expect.objectContaining({
          code: "archive.unsafe-path",
          path: "archive:overrides/../../escape.txt",
        }),
        expect.objectContaining({
          code: "archive.duplicate-path",
          path: "archive:overrides/config/duplicate.txt",
        }),
      ]),
    );
  });

  it("enforces the official Modrinth download hosts with explicit warning-only extensions", () => {
    const officialIndex = validModrinthIndex();
    officialIndex.files = [
      validModrinthFile("mods/example.jar", [
        "https://cdn.modrinth.com/data/example/example.jar",
        "https://github.com/example/project/releases/download/1/example.jar",
        "https://raw.githubusercontent.com/example/project/main/example.jar",
        "https://gitlab.com/example/project/-/raw/main/example.jar",
      ]),
    ];
    const official = validateModrinthPack({ index: officialIndex });

    const customIndex = validModrinthIndex();
    customIndex.files = [
      validModrinthFile("mods/example.jar", ["https://downloads.example.org/example.jar"]),
    ];
    const blocked = validateModrinthPack({ index: customIndex });
    const explicitlyAllowed = validateModrinthPack({
      index: customIndex,
      additionalDownloadHosts: ["downloads.example.org"],
    });
    const nonStandardPortIndex = validModrinthIndex();
    nonStandardPortIndex.files = [
      validModrinthFile("mods/example.jar", [
        "https://github.com:8443/example/project/example.jar",
      ]),
    ];
    const nonStandardPort = validateModrinthPack({ index: nonStandardPortIndex });

    expect(official.valid).toBe(true);
    expect(official.validationStrength).toBe("none");
    expect(blocked.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "file.download-host" })]),
    );
    expect(explicitlyAllowed.valid).toBe(true);
    expect(explicitlyAllowed.errorCount).toBe(0);
    expect(explicitlyAllowed.warningCount).toBe(1);
    expect(explicitlyAllowed.diagnostics[0]?.code).toBe("file.unofficial-download-host");
    expect(nonStandardPort.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "file.download" })]),
    );
  });

  it("rejects Windows-unsafe paths and portable normalization collisions", () => {
    const index = validModrinthIndex();
    index.files = [
      validModrinthFile("mods/example.jar:payload"),
      validModrinthFile("mods/CON.txt"),
      validModrinthFile("mods/COM\u00b9.txt"),
      validModrinthFile("mods/trailing."),
      validModrinthFile("mods/Caf\u00e9.jar"),
      validModrinthFile("mods/Cafe\u0301.jar"),
    ];

    const result = validateModrinthPack({
      index,
      archiveEntries: [
        { path: "modrinth.index.json", size: 1 },
        { path: "overrides/NUL", size: 1 },
        { path: "overrides/config/Foo.json", size: 1 },
        { path: "overrides/config/foo.json", size: 1 },
      ],
    });
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(result.valid).toBe(false);
    expect(result.validationStrength).toBe("metadata");
    expect(codes.filter((code) => code === "file.unsafe-path")).toHaveLength(4);
    expect(codes).toContain("file.normalized-path-conflict");
    expect(codes).toContain("archive.unsafe-path");
    expect(codes).toContain("archive.normalized-path-conflict");
  });

  it("detects archive, override, and download ancestor-descendant conflicts", () => {
    const index = validModrinthIndex();
    index.files = [validModrinthFile("config")];
    const result = validateModrinthPack({
      index,
      archiveEntries: [
        { path: "modrinth.index.json", size: 1 },
        { path: "overrides/config/a.json", size: 1 },
        { path: "overrides/tree", size: 1 },
        { path: "overrides/tree/file.json", size: 1 },
        { path: "overrides/empty/child/", size: 0, directory: true },
        { path: "overrides/empty", size: 1 },
        { path: "server-overrides/config/", size: 0, directory: true },
      ],
    });
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(result.valid).toBe(false);
    expect(codes).toContain("archive.path-conflict");
    expect(codes).toContain("archive.override-path-conflict");
    expect(codes).toContain("archive.download-override-path-conflict");
  });

  it("keeps mutually exclusive client and server override projections independent", () => {
    const mutuallyExclusive = validateModrinthPack({
      index: validModrinthIndex(),
      archiveEntries: [
        { path: "modrinth.index.json", size: 1 },
        { path: "client-overrides/config", size: 1 },
        { path: "server-overrides/config/example.json", size: 1 },
      ],
    });
    const sharedBaseConflict = validateModrinthPack({
      index: validModrinthIndex(),
      archiveEntries: [
        { path: "modrinth.index.json", size: 1 },
        { path: "overrides/config", size: 1 },
        { path: "client-overrides/config/example.json", size: 1 },
      ],
    });

    expect(mutuallyExclusive.valid).toBe(true);
    expect(mutuallyExclusive.diagnostics).toEqual([]);
    expect(sharedBaseConflict.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "archive.override-path-conflict" })]),
    );
  });

  it("bounds metadata sizes, compression ratios, entry counts, and index bytes", () => {
    const metadata = validateModrinthPack({
      index: validModrinthIndex(),
      archiveEntries: [
        { path: "modrinth.index.json", size: 1, compressedSize: 1 },
        {
          path: "overrides/a.txt",
          size: 25,
          compressedSize: 1,
          compressionMethod: 0,
          flags: 1,
          unixMode: 0xa000,
        },
        { path: "overrides/b.txt", size: 25, compressedSize: 25 },
      ],
      limits: {
        maxEntryUncompressedBytes: 20,
        maxTotalUncompressedBytes: 30,
        maxCompressionRatio: 10,
      },
    });
    const entryCount = validateModrinthPack({
      index: validModrinthIndex(),
      archiveEntries: [
        { path: "modrinth.index.json", size: 1 },
        { path: "overrides/a.txt", size: 1 },
      ],
      limits: { maxArchiveEntries: 1 },
    });
    const oversizedIndex = validateModrinthPack({
      index: JSON.stringify(validModrinthIndex()),
      limits: { maxIndexBytes: 1 },
    });
    const codes = metadata.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "archive.entry-size-limit",
        "archive.total-size-limit",
        "archive.compression-ratio-limit",
        "archive.encrypted-entry",
        "archive.special-file",
        "archive.stored-size-mismatch",
      ]),
    );
    expect(entryCount.diagnostics[0]?.code).toBe("archive.entry-limit");
    expect(oversizedIndex.diagnostics[0]?.code).toBe("index.size-limit");
  });

  it("rejects impossible archive metadata and honors fractional compression limits", () => {
    const result = validateModrinthPack({
      index: validModrinthIndex(),
      archiveEntries: [
        { path: "modrinth.index.json", size: 0, compressedSize: 0, compressionMethod: 0 },
        {
          path: "overrides/zero-compressed.txt",
          size: 1,
          compressedSize: 0,
          compressionMethod: 8,
        },
        {
          path: "overrides/stored-mismatch.txt",
          size: 2,
          compressedSize: 1,
          compressionMethod: 0,
        },
      ],
      limits: { maxCompressionRatio: 1.5 },
    });
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes.filter((code) => code === "archive.compression-ratio-limit")).toHaveLength(2);
    expect(codes).toContain("archive.stored-size-mismatch");
  });

  it("caps retained diagnostics while preserving total counts", () => {
    const index = validModrinthIndex();
    index.files = Array.from({ length: 10 }, () => ({}));
    const result = validateModrinthPack({ index, limits: { maxDiagnostics: 1 } });

    expect(result.valid).toBe(false);
    expect(result.errorCount).toBeGreaterThan(result.diagnostics.length);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.severity).toBe("error");
    expect(result.diagnostics[0]?.code).not.toBe("validation.diagnostics-truncated");
    expect(result.diagnosticsTruncated).toBe(true);
    expect(result.omittedDiagnosticCount).toBe(
      result.errorCount + result.warningCount - result.diagnostics.length,
    );
  });

  it("bounds object-form file arrays and extreme path, URL, and host strings", () => {
    const tooManyFiles = validModrinthIndex();
    tooManyFiles.files = [
      validModrinthFile("mods/a.jar"),
      validModrinthFile("mods/b.jar"),
      validModrinthFile("mods/c.jar"),
    ];
    const fileLimit = validateModrinthPack({
      index: tooManyFiles,
      limits: { maxArchiveEntries: 2 },
    });

    const extreme = validModrinthIndex();
    const extremeDependencyPrefix = "dependency".repeat(2_000);
    extreme.dependencies = {
      minecraft: "1.21.11",
      [`${extremeDependencyPrefix}a`]: "1.0.0",
      [`${extremeDependencyPrefix}b`]: "1.0.0",
    };
    extreme.files = [
      validModrinthFile(`mods/${"a".repeat(4_097)}`, [
        `https://cdn.modrinth.com/${"b".repeat(8_192)}`,
      ]),
    ];
    const boundedStrings = validateModrinthPack({
      index: extreme,
      additionalDownloadHosts: ["c".repeat(254)],
      archiveEntries: [
        { path: "modrinth.index.json", size: 1 },
        { path: `overrides/${"d".repeat(4_097)}`, size: 1 },
        { path: "overrides/runtime-directory", directory: "yes" as never },
      ],
    });
    const codes = boundedStrings.diagnostics.map((diagnostic) => diagnostic.code);

    expect(fileLimit.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "index.file-limit" })]),
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        "file.unsafe-path",
        "file.download",
        "index.dependency-name-length",
        "validation.invalid-download-host",
        "archive.unsafe-path",
        "archive.invalid-directory",
      ]),
    );
    expect(
      boundedStrings.diagnostics.every(
        (diagnostic) => diagnostic.path.length <= 2_048 && diagnostic.message.length <= 2_048,
      ),
    ).toBe(true);
    expect(
      boundedStrings.index?.dependencies.every((dependency) => dependency.length <= 4_096),
    ).toBe(true);
  });

  it("builds Paper API references for supported versions", () => {
    const reference = getPaperApiReference("1.21.11");
    expect(reference.supported).toBe(true);
    expect(reference.apiDependency).toBe("io.papermc.paper:paper-api:1.21.11-R0.1-SNAPSHOT");
    expect(reference.javadocsUrl).toBe("https://jd.papermc.io/paper/1.21.11/");
    expect(reference.docs.foliaSupport).toBe("https://docs.papermc.io/paper/dev/folia-support/");
  });

  it("loads Paper API package indexes", () => {
    const index = getPaperApiIndex("1.21.11");
    expect(index.minecraftVersion).toBe("1.21.11");
    expect(index.packageCount).toBeGreaterThan(100);
    expect(index.packages.map((entry) => entry.name)).toContain(
      "io.papermc.paper.threadedregions.scheduler",
    );
  });

  it("loads legacy Paper API package indexes when Javadocs expose package tables", () => {
    const index = getPaperApiIndex("1.13.2");
    expect(index.minecraftVersion).toBe("1.13.2");
    expect(index.packageCount).toBeGreaterThan(50);
    expect(index.packages.map((entry) => entry.name)).toContain("org.bukkit.plugin");
  });

  it("compares Paper API package indexes", () => {
    const comparison = comparePaperApi("1.20.4", "1.21.11");
    expect(comparison.from).toBe("1.20.4");
    expect(comparison.to).toBe("1.21.11");
    expect(comparison.packageCount.changed).toBe(true);
    expect(comparison.added.map((entry) => entry.name)).toContain("io.papermc.paper.datacomponent");
  });

  it("loads and searches Paper API type/member surfaces", () => {
    const surface = getPaperApiSurface("1.21.11");
    const freshSurface = getPaperApiSurface("1.21.11");
    expect(freshSurface).not.toBe(surface);
    surface.types.pop();
    expect(freshSurface.types).toHaveLength(freshSurface.typeCount);
    expect(surface.coverage).toBe("javadocs-search-index");
    expect(surface.typeCount).toBeGreaterThan(1_000);
    expect(surface.memberCount).toBeGreaterThan(20_000);
    expect(
      searchPaperTypes({
        version: "1.21.11",
        contains: "org.bukkit.entity.Player",
        limit: 10,
      }).types,
    ).toContainEqual(expect.objectContaining({ qualifiedName: "org.bukkit.entity.Player" }));
    expect(
      searchPaperMembers({
        version: "1.21.11",
        type: "org.bukkit.entity.Player",
        contains: "sendMessage",
        kind: "method",
        limit: 10,
      }).members,
    ).toContainEqual(
      expect.objectContaining({
        qualifiedTypeName: "org.bukkit.entity.Player",
        name: "sendMessage",
        kind: "method",
      }),
    );
  });

  it("compares Paper API surfaces", () => {
    const comparison = comparePaperApiSurface("1.21.11", "1.21.11");
    expect(comparison.typeCount.changed).toBe(false);
    expect(comparison.memberCount.changed).toBe(false);
    expect(comparison.addedTypes).toEqual([]);
    expect(comparison.removedMembers).toEqual([]);
    expect(comparison.changes).toEqual([]);
  });

  it("builds Paper API references for unsupported versions", () => {
    const reference = getPaperApiReference("26.1");
    expect(reference.supported).toBe(false);
    expect(reference.minecraftVersion).toBe("26.2");
    expect(reference.latestSupportedVersion).toBe("26.2");
    expect(reference.apiDependency).toBeNull();
    expect(reference.javadocsUrl).toBeNull();
  });

  it("marks Paper-supported version details", () => {
    const version = getVersionDetail("java", "1.21.11");
    expect(version.domains["paper-plugin"].status).toBe("api-reference-linked");
    expect(version.domains["paper-plugin"].facts).toContain("paper_supported=true");
    expect(version.domains["paper-plugin"].facts).toContain("paper_latest_build=132");
    expect(version.domains["paper-plugin"].facts).toContain("paper_build_count=92");
    expect(version.domains["paper-plugin"].facts).toContain(
      "paper_api_dependency=io.papermc.paper:paper-api:1.21.11-R0.1-SNAPSHOT",
    );
    expect(version.domains["paper-plugin"].facts).toContain(
      "paper_javadocs=https://jd.papermc.io/paper/1.21.11/",
    );
    expect(version.domains["paper-plugin"].facts).toContain("paper_api_package_index=1.21.11");
    expect(version.domains["paper-plugin"].facts).toContain("paper_api_surface=1.21.11");
    expect(version.domains["paper-plugin"].facts).toContain(
      "paper_folia_support_docs=https://docs.papermc.io/paper/dev/folia-support/",
    );
    expect(version.domains["paper-plugin"].unknowns).toEqual([]);
  });

  it("links Paper API package indexes for legacy supported versions", () => {
    const version = getVersionDetail("java", "1.13");
    expect(version.domains["paper-plugin"].status).toBe("api-reference-linked");
    expect(version.domains["paper-plugin"].facts).toContain("paper_api_package_index=1.13");
    expect(version.domains["paper-plugin"].unknowns).toEqual([]);
  });

  it("marks Java versions that Paper has not published yet", () => {
    const version = getVersionDetail("java", "26.1");
    expect(version.domains["paper-plugin"].status).toBe("not-yet-published");
    expect(version.domains["paper-plugin"].facts).toContain("paper_supported=false");
    expect(version.domains["paper-plugin"].facts).toContain("paper_latest_supported=26.2");
  });

  it("lists pack formats for all bundled releases", () => {
    const formats = listPackFormats();
    expect(formats).toHaveLength(50);
    expect(formats[0]).toMatchObject({
      version: "26.2",
      data: 107,
      resource: 88,
      paperPluginStatus: "api-reference-linked",
    });
    expect(formats.at(-1)).toMatchObject({
      version: "1.13",
      data: 4,
      resource: 4,
    });
  });

  it("looks up pack formats by version and versions by pack format", () => {
    expect(getPackFormat("java", "26.2", "datapack")).toMatchObject({
      version: "26.2",
      domain: "datapack",
      format: 107,
      minor: 1,
    });
    expect(getPackFormat("java", "1.20.2", "resourcepack")).toMatchObject({
      version: "1.20.2",
      domain: "resourcepack",
      format: 18,
      minor: null,
    });

    const legacyMatches = findVersionsByPackFormat({
      domain: "datapack",
      format: 4,
    });
    expect(legacyMatches.matches.map((match) => match.version)).toContain("1.13");
    expect(legacyMatches.matches.map((match) => match.version)).toContain("1.14.4");

    const minorMatches = findVersionsByPackFormat({
      domain: "datapack",
      format: 101,
      minor: 1,
    });
    expect(minorMatches.matches.map((match) => match.version)).toEqual([
      "26.1.2",
      "26.1.1",
      "26.1",
    ]);
    expect(minorMatches.matches.every((match) => match.exactMinor)).toBe(true);
  });

  it("loads vanilla inventory for latest release", () => {
    const inventory = getVanillaInventory("java", "latest");
    expect(inventory.version).toBe("26.2");
    expect(inventory.resources.entryCount).toBeGreaterThan(10_000);
    expect(inventory.datapack.entryCount).toBeGreaterThan(8_000);
    expect(inventory.resources.topLevel.map((entry) => entry.path)).toContain(
      "assets/minecraft/models",
    );
    expect(inventory.datapack.topLevel.map((entry) => entry.path)).toContain("data/minecraft/tags");
  });

  it("loads and searches observed datapack schema surfaces", () => {
    const surface = getDatapackSchemaSurface("java", "26.2");
    expect(surface.coverage).toBe("vanilla-observed-datapack-json-shape");
    expect(surface.kindCount).toBeGreaterThan(20);
    expect(surface.kinds.map((kind) => kind.kind)).toContain("advancement");
    const search = searchDatapackSchema({
      version: "26.2",
      kind: "advancement",
      contains: "criteria",
      limit: 10,
    });
    expect(search.fields).toContainEqual(expect.objectContaining({ path: "$.criteria" }));
  });

  it("compares observed datapack schema surfaces", () => {
    const comparison = compareDatapackSchema({ from: "26.2", to: "26.2" });
    expect(comparison.addedTotal).toBe(0);
    expect(comparison.removedTotal).toBe(0);
    expect(comparison.added).toEqual([]);
    expect(comparison.changes).toEqual([]);
  });

  it("annotates version details when vanilla inventory is bundled", () => {
    const version = getVersionDetail("java", "26.2");
    expect(version.domains.datapack.status).toBe("reports-extracted");
    expect(version.domains.resourcepack.status).toBe("models-extracted");
    expect(version.domains.datapack.facts).toContain("vanilla_data_inventory=26.2");
    expect(version.domains.datapack.facts).toContain("server_reports=26.2");
    expect(version.domains.datapack.facts).toContain("datapack_schema_surface=26.2");
    expect(version.domains.resourcepack.facts).toContain("vanilla_asset_inventory=26.2");
    expect(version.domains.resourcepack.facts).toContain("resourcepack_models=26.2");
    expect(version.domains.datapack.unknowns).toEqual([]);
    expect(version.domains.resourcepack.unknowns).toEqual([]);
  });

  it("loads server reports summary for latest release", () => {
    const reports = getJavaReportsSummary("java", "latest");
    expect(reports.version).toBe("26.2");
    expect(reports.commands.rootLiterals).toContain("execute");
    expect(reports.commands.executablePathCount).toBeGreaterThan(1_000);
    expect(reports.datapack.registries.map((registry) => registry.id)).toContain(
      "minecraft:enchantment",
    );
  });

  it("loads registries from a historical registries-only server report", () => {
    const reports = getJavaReportsSummary("java", "1.20");
    expect(reports.datapack.registries.map((registry) => registry.id)).toContain("minecraft:item");
  });

  it("compares version metadata and vanilla inventory summaries", () => {
    const comparison = compareVersions("java", "1.20.6", "1.21");
    expect(comparison.from).toBe("1.20.6");
    expect(comparison.to).toBe("1.21");
    expect(comparison.packFormats.data.changed).toBe(true);
    expect(comparison.packFormats.resource.changed).toBe(true);
    expect(comparison.vanillaInventory.resources.entryCount.changed).toBe(true);
    expect(comparison.vanillaInventory.datapack.entryCount.changed).toBe(true);
  });

  it("compares vanilla datapack paths between versions", () => {
    const comparison = compareVanillaPaths({
      from: "1.20.6",
      to: "1.21",
      domain: "datapack",
      prefix: "data/minecraft/advancement/adventure/",
      limit: 5,
    });
    expect(comparison.addedTotal).toBeGreaterThan(0);
    expect(comparison.added).toContain("data/minecraft/advancement/adventure/blowback.json");
  });

  it("compares command syntax paths between versions", () => {
    const comparison = compareCommands({
      from: "1.20.6",
      to: "1.21",
      prefix: "attribute",
      limit: 10,
    });
    expect(comparison.addedTotal).toBeGreaterThan(0);
    expect(comparison.added).toContain(
      "attribute <target:minecraft:entity> <attribute:minecraft:resource> modifier add <id:minecraft:resource_location> <value:brigadier:double> add_value",
    );
  });

  it("searches vanilla paths", () => {
    const result = searchVanillaPaths({
      version: "26.2",
      domain: "resourcepack",
      prefix: "assets/minecraft/models/block/",
      contains: "acacia_button",
      extension: "json",
      limit: 10,
    });
    expect(result.version).toBe("26.2");
    expect(result.domain).toBe("resourcepack");
    expect(result.paths).toContain("assets/minecraft/models/block/acacia_button.json");
  });

  it("searches command paths", () => {
    const result = searchCommands({
      version: "26.2",
      prefix: "execute",
      limit: 5,
    });
    expect(result.version).toBe("26.2");
    expect(result.paths.every((path) => path.startsWith("execute"))).toBe(true);
  });

  it("loads resourcepack model summaries", () => {
    const summary = getResourcepackModelSummary("java", "26.2");
    expect(summary.version).toBe("26.2");
    expect(summary.files.models.count).toBeGreaterThan(3_000);
    expect(summary.files.itemDefinitions.count).toBeGreaterThan(1_000);
    expect(summary.modelJson.topLevelKeys.map((entry) => entry.value)).toContain("parent");
    expect(summary.itemDefinitionJson.modelTypes.map((entry) => entry.value)).toContain(
      "minecraft:model",
    );
  });

  it("searches resourcepack model paths", () => {
    const result = searchResourcepackModelPaths({
      version: "26.2",
      kind: "item-definition",
      contains: "bundle",
      limit: 10,
    });
    expect(result.version).toBe("26.2");
    expect(result.totalPaths).toBe(
      getResourcepackModelSummary("java", "26.2").files.itemDefinitions.count,
    );
    expect(result.paths).toContain("assets/minecraft/items/bundle.json");
    expect(result.paths.every((path) => path.includes("/items/"))).toBe(true);
    expect(
      searchResourcepackModelPaths({
        version: "26.2",
        kind: "item-definition",
        contains: "bundle item model",
      }).paths,
    ).toEqual([]);
  });

  it("searches across Minecraft surfaces", () => {
    const result = searchAll({
      version: "26.2",
      query: "find item model for bundle",
      domain: "resourcepack",
      limit: 80,
    });
    expect(result.results.map((entry) => entry.surface)).toContain("resourcepack-models");
    expect(result.results.map((entry) => entry.title)).toContain(
      "assets/minecraft/items/bundle.json",
    );
    expect(
      result.results.find((entry) => entry.title === "assets/minecraft/items/bundle.json")?.lookup,
    ).toContain('--prefix "assets/minecraft/items/bundle.json"');

    const lime = searchAll({
      version: "26.2",
      query: "lime model",
      domain: "resourcepack",
      limit: 200,
    });
    expect(lime.results.map((entry) => entry.surface)).toContain("resourcepack-models");

    const itemModels = searchAll({
      version: "26.2",
      query: "item model",
      domain: "resourcepack",
      limit: 200,
    });
    expect(itemModels.results.map((entry) => entry.kind)).toContain("item-definition");

    const paper = searchAll({
      version: "26.2",
      query: "listener for Paper Plugin Player Join Event",
      domain: "paper-plugin",
      limit: 80,
    });
    expect(paper.results.map((entry) => entry.title)).toContain(
      "org.bukkit.event.player.PlayerJoinEvent",
    );

    const paperEvent = searchAll({
      version: "26.2",
      query: "paper event",
      domain: "paper-plugin",
      limit: 10,
    });
    expect(paperEvent.results[0]?.surface).toBe("catalog");

    const large = searchAll({
      version: "26.2",
      query: "minecraft version",
      limit: 200,
    });
    expect(large.results.filter((entry) => entry.surface === "catalog").length).toBeGreaterThan(
      100,
    );
    expect(large.truncated).toBe(false);
  });

  it("routes natural-language Fabric toolchain queries to the live lookup", () => {
    const search = searchAll({
      version: "1.21.11",
      query: "Which Fabric Loader and Yarn versions should I use?",
    });
    expect(search.results[0]).toMatchObject({
      surface: "fabric-meta",
      lookup: 'fabric toolchain "1.21.11"',
    });

    const suggestions = suggestMinecraftLookups({
      version: "1.21.11",
      task: "set up Fabric Intermediary mappings",
    });
    expect(suggestions.suggestedTools.map((entry) => entry.tool)).toContain(
      'fabric toolchain "1.21.11"',
    );

    const contextualYarn = searchAll({
      version: "1.21.11",
      query: "Which Yarn toolchain should this Minecraft project use?",
    });
    expect(contextualYarn.results.some((entry) => entry.surface === "fabric-meta")).toBe(true);
  });

  it("does not route Fabric API-only or general Yarn package-manager queries", () => {
    for (const query of [
      "Which Fabric API version should I use?",
      "How do I install dependencies with Yarn?",
    ]) {
      const search = searchAll({ version: "1.21.11", query });
      expect(search.results.some((entry) => entry.surface === "fabric-meta")).toBe(false);

      const suggestions = suggestMinecraftLookups({ version: "1.21.11", task: query });
      expect(
        suggestions.suggestedTools.some((entry) => entry.tool.startsWith("fabric toolchain")),
      ).toBe(false);
    }
  });

  it("routes Velocity dependency and Java queries to the official live resolver", () => {
    const search = searchAll({
      version: "1.21.11",
      query: "Which Velocity API Maven coordinate and Java version should I use?",
    });
    expect(search.results[0]).toMatchObject({
      surface: "velocity-toolchain",
      lookup: "velocity toolchain",
    });

    const suggestions = suggestMinecraftLookups({
      version: "1.21.11",
      task: "set up a Velocity plugin dependency",
    });
    expect(suggestions.suggestedTools.map((entry) => entry.tool)).toContain("velocity toolchain");

    for (const task of [
      "Which Velocity API version should I use?",
      "What Java does Velocity require?",
    ]) {
      const result = suggestMinecraftLookups({ version: "1.21.11", task });
      expect(result.suggestedTools.map((entry) => entry.tool)).toContain("velocity toolchain");
    }
  });

  it("does not route unrelated uses of velocity to the toolchain resolver", () => {
    for (const query of [
      "measure player velocity in a Fabric mod",
      "use the player velocity API in a Paper plugin",
      "call setVelocity from Java after knockback",
    ]) {
      const search = searchAll({ version: "1.21.11", query });
      expect(search.results.some((entry) => entry.surface === "velocity-toolchain")).toBe(false);

      const suggestions = suggestMinecraftLookups({ version: "1.21.11", task: query });
      expect(suggestions.suggestedTools.some((entry) => entry.tool === "velocity toolchain")).toBe(
        false,
      );
    }
  });

  it("finds resourcepack assets from all available indexes", () => {
    const result = findResourcepackAssets({
      version: "26.2",
      query: "resourcepack Diamond Sword",
      kind: "item-definition",
    });
    expect(
      result.sections.some((section) =>
        section.paths.includes("assets/minecraft/items/diamond_sword.json"),
      ),
    ).toBe(true);
  });

  it("finds datapack entries", () => {
    const result = findDatapackEntries({
      version: "26.2",
      query: "search for datapack execute command",
      limit: 10,
    });
    expect(result.sections.find((section) => section.source === "commands")?.total).toBeGreaterThan(
      0,
    );
  });

  it("explains pack paths with next lookups", () => {
    const result = explainPackPath({
      version: "26.2",
      domain: "resourcepack",
      path: "assets/example/items/widget.json",
    });
    expect(result.classification.kind).toBe("item-definition");
    expect(result.nextLookups.join("\n")).toContain("resourcepack file-schema");
  });

  it("suggests lookup tools from task text", () => {
    const result = suggestMinecraftLookups({
      version: "26.2",
      task: "migrate resource pack item model",
      domain: "resourcepack",
    });
    expect(result.suggestedTools.map((entry) => entry.tool).join("\n")).toContain(
      "resourcepack assets find",
    );
    expect(result.catalog.results.length).toBeGreaterThan(0);
  });

  it("discovers the Modrinth compatibility resolver from natural language", () => {
    const suggestions = suggestMinecraftLookups({
      version: "26.2",
      task: "Find compatible Modrinth mod versions that work together",
    });
    expect(suggestions.suggestedTools.map((entry) => entry.tool)).toContain(
      "modrinth compatibility <project-id-or-slug> <project-id-or-slug> [more projects]",
    );

    const search = searchAll({
      version: "26.2",
      query: "Find compatible Modrinth mods",
      limit: 20,
    });
    expect(search.results).toContainEqual(
      expect.objectContaining({
        surface: "modrinth-tools",
        kind: "compatibility-resolver",
      }),
    );

    const generalLoaderQuestion = searchAll({
      version: "26.2",
      query: "Which loaders work with Minecraft?",
    });
    expect(generalLoaderQuestion.results.some((entry) => entry.surface === "modrinth-tools")).toBe(
      false,
    );

    const pluralModpackQuestion = suggestMinecraftLookups({
      version: "26.2",
      task: "Find compatible Modpacks",
    });
    expect(
      pluralModpackQuestion.suggestedTools.some((entry) =>
        entry.tool.startsWith("modrinth compatibility"),
      ),
    ).toBe(true);

    for (const domain of ["datapack", "resourcepack", "paper-plugin"] as const) {
      const scopedSuggestions = suggestMinecraftLookups({
        version: "26.2",
        task: "Find compatible Modrinth mods",
        domain,
      });
      expect(
        scopedSuggestions.suggestedTools.some((entry) =>
          entry.tool.startsWith("modrinth compatibility"),
        ),
      ).toBe(false);

      const scopedSearch = searchAll({
        version: "26.2",
        query: "Find compatible Modrinth mods",
        domain,
        limit: 20,
      });
      expect(scopedSearch.results.some((entry) => entry.surface === "modrinth-tools")).toBe(false);
    }
  });

  it("routes exact vanilla datapack content questions to cached JSON search", () => {
    const result = suggestMinecraftLookups({
      version: "26.2",
      task: "Which vanilla recipes reference minecraft:diamond?",
      domain: "datapack",
    });
    expect(result.suggestedTools.map((entry) => entry.tool)).toContain(
      'datapack vanilla-json search "minecraft:diamond" --version 26.2 --kind recipe',
    );
  });

  it("uses kind-specific vanilla JSON file discovery when no concrete term remains", () => {
    const recipes = suggestMinecraftLookups({
      version: "26.2",
      task: "Show vanilla recipes",
      domain: "datapack",
    });
    expect(recipes.suggestedTools.map((entry) => entry.tool)).toContain(
      "datapack vanilla-json files 26.2 --kind recipe",
    );

    const loot = suggestMinecraftLookups({
      version: "26.2",
      task: "Inspect official loot table JSON",
      domain: "datapack",
    });
    expect(loot.suggestedTools.map((entry) => entry.tool)).toContain(
      "datapack vanilla-json files 26.2 --kind loot_table",
    );
  });
  it("routes full-inventory item delivery tasks to Paper authoring guidance", () => {
    const result = suggestMinecraftLookups({
      version: "1.21.11",
      task: "handle full inventory reward leftovers",
    });

    expect(
      result.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper search")),
    ).toBe(true);
    expect(
      result.suggestedTools.some((entry) => entry.tool.startsWith("resourcepack assets find")),
    ).toBe(false);
    expect(result.scenarios.results[0]?.scenario.id).toBe("paper-item-delivery-review");
  });

  it("does not route item-model or datapack-command wording to Paper delivery guidance", () => {
    for (const task of [
      "give an item model a custom texture",
      "design a player reward item model",
      "write a datapack give command",
      "reward a player with experience points",
    ]) {
      const result = suggestMinecraftLookups({ version: "1.21.11", task });
      expect(
        result.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper search")),
      ).toBe(false);
    }
  });

  it("routes administrative command wording to Paper guidance without broad false positives", () => {
    for (const request of [
      {
        task: "reload configuration from console and report status",
        domain: "paper-plugin" as const,
      },
      { task: "add a configuration command", domain: "paper-plugin" as const },
      { task: "create a ban command", domain: "paper-plugin" as const },
      { task: "Paper admin command permission and offline target" },
      { task: "admin command with explicit target and status" },
    ]) {
      const result = suggestMinecraftLookups({ version: "1.21.11", ...request });
      expect(result.suggestedTools.map((entry) => entry.tool)).toContain(
        `plugin paper search ${JSON.stringify(request.task)}`,
      );
    }

    for (const request of [
      { task: "render a custom item texture", domain: "paper-plugin" as const },
      { task: "grant an advancement with a command" },
      { task: "reset a datapack scoreboard objective command" },
    ]) {
      const unrelated = suggestMinecraftLookups({ version: "1.21.11", ...request });
      expect(unrelated.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper "))).toBe(
        false,
      );
    }
  });

  it("routes Paper player identity wording without claiming unrelated player rendering tasks", () => {
    for (const request of [
      {
        task: "persist UUID identity but show a readable player display name after rename",
        domain: "paper-plugin" as const,
      },
      { task: "Paper OfflinePlayer profile lookup and name cache" },
    ]) {
      const result = suggestMinecraftLookups({ version: "1.21.11", ...request });
      expect(result.suggestedTools.map((entry) => entry.tool)).toContain(
        `plugin paper search ${JSON.stringify(request.task)}`,
      );
    }

    const inferredPaper = suggestMinecraftLookups({
      version: "1.21.11",
      task: "Paper OfflinePlayer profile lookup and name cache",
    });
    expect(inferredPaper.catalog.domain).toBe("paper-plugin");
    expect(inferredPaper.scenarios.domain).toBe("paper-plugin");
    expect(inferredPaper.domain).toBe("paper-plugin");

    const inferredDatapack = suggestMinecraftLookups({
      version: "1.21.11",
      task: "data-pack function command",
    });
    expect(inferredDatapack.catalog.domain).toBe("datapack");
    expect(inferredDatapack.scenarios.domain).toBe("datapack");
    expect(inferredDatapack.domain).toBe("datapack");

    const fabricResult = suggestMinecraftLookups({
      version: "1.21.11",
      task: "render a Fabric player nameplate",
    });
    expect(
      fabricResult.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper ")),
    ).toBe(false);
    expect(
      fabricResult.catalog.results.some(
        (entry) =>
          entry.domains.length > 0 && entry.domains.every((domain) => domain === "paper-plugin"),
      ),
    ).toBe(false);
    expect(
      fabricResult.scenarios.results.some((entry) =>
        entry.scenario.domains.every((domain) => domain === "paper-plugin"),
      ),
    ).toBe(false);

    const resourcepackResult = suggestMinecraftLookups({
      version: "1.21.11",
      task: "resource pack player head texture",
    });
    expect(
      resourcepackResult.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper ")),
    ).toBe(false);
    expect(resourcepackResult.catalog.domain).toBe("resourcepack");
    expect(resourcepackResult.scenarios.domain).toBe("resourcepack");
    expect(resourcepackResult.domain).toBe("resourcepack");
    expect(resourcepackResult.catalog.results.length).toBeGreaterThan(0);
    expect(resourcepackResult.scenarios.results.length).toBeGreaterThan(0);
    expect(
      resourcepackResult.catalog.results.every((entry) => entry.domains.includes("resourcepack")),
    ).toBe(true);
    expect(
      resourcepackResult.scenarios.results.every((entry) =>
        entry.scenario.domains.includes("resourcepack"),
      ),
    ).toBe(true);

    for (const [task, expectedDomain] of [
      ["resource pack model for the minecraft:paper item", "resourcepack"],
      ["data pack recipe using the minecraft:paper item", "datapack"],
    ] as const) {
      const result = suggestMinecraftLookups({ version: "1.21.11", task });
      expect(result.domain).toBe(expectedDomain);
      expect(result.catalog.results.length).toBeGreaterThan(0);
      expect(result.scenarios.results.length).toBeGreaterThan(0);
      expect(result.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper "))).toBe(
        false,
      );
      expect(
        result.catalog.results.every(
          (entry) => entry.domains.length === 0 || entry.domains.includes(expectedDomain),
        ),
      ).toBe(true);
      expect(
        result.scenarios.results.every((entry) => entry.scenario.domains.includes(expectedDomain)),
      ).toBe(true);
    }
  });

  it("routes Paper plugin protocol tasks to strict transport safety guidance", () => {
    const recipe = getAuthoringRecipe("paper-plugin-protocol-safety");
    expect(recipe.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "resolve-paper-transport-evidence",
        "make-decoding-strict-and-bounded",
        "bind-identity-and-request-state",
        "bound-lifecycle-and-chunk-state",
      ]),
    );
    expect(recipe.finalChecks).toContain("paper-plugin-protocol-safety");
    expect(recipe.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "Messenger.MAX_MESSAGE_SIZE",
    );

    const guardrail = getAuthoringGuardrail("paper-plugin-protocol-safety");
    expect(guardrail.rules.join("\n")).toContain("authenticated connection");
    expect(guardrail.rules.join("\n")).toContain("at most one terminal response");

    const diagnostic = getAuthoringDiagnostic("paper-plugin-protocol-unsafe");
    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.failIf.join("\n")).toContain("actual-output cap");
    expect(diagnostic.requiredChecks.join("\n")).toContain("StandardMessenger validation");
    expect(diagnostic.failIf.join("\n")).toContain("Messenger constants");

    const plan = getAuthoringPlan({
      scenario: "paper-plugin-protocol-safety-review",
      version: "1.21.11",
    });
    expect(plan.recipes.map((entry) => entry.id)).toContain("paper-plugin-protocol-safety");
    expect(plan.diagnostics.map((entry) => entry.id)).toContain("paper-plugin-protocol-unsafe");

    for (const query of [
      "plugin message",
      "custom payload",
      "RPC",
      "codec",
      "request correlation",
      "chunked upload",
    ]) {
      const scenarioSearch = searchAuthoringScenarios({ query, domain: "paper-plugin" });
      expect(scenarioSearch.results[0]?.scenario.id, query).toBe(
        "paper-plugin-protocol-safety-review",
      );

      const catalogSearch = searchCatalog({
        query,
        domain: "paper-plugin",
        kind: "authoring-recipe",
      });
      expect(catalogSearch.results[0]?.id, query).toBe("paper-plugin-protocol-safety");
    }

    const suggestions = suggestMinecraftLookups({ task: "custom payload request correlation" });
    expect(suggestions.suggestedTools.map((entry) => entry.tool)).toContainEqual(
      expect.stringContaining("plugin paper search"),
    );
    expect(suggestions.scenarios.results[0]?.scenario.id).toBe(
      "paper-plugin-protocol-safety-review",
    );
  });

  it("exposes and routes Paper player-session lifecycle safety guidance", () => {
    const recipe = getAuthoringRecipe("paper-player-session-lifecycle");
    expect(recipe.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "verify-target-lifecycle-surfaces",
        "make-acquisition-and-teardown-transactional",
        "reject-stale-asynchronous-publication",
        "bound-durable-flush-and-shutdown",
        "reconcile-observe-and-test-races",
      ]),
    );
    expect(
      recipe.steps.find((step) => step.id === "verify-target-lifecycle-surfaces")?.tools.mcp,
    ).toEqual(expect.arrayContaining(["search_paper_types", "search_paper_members"]));
    expect(
      recipe.steps
        .find((step) => step.id === "verify-target-lifecycle-surfaces")
        ?.evidence.join("\n"),
    ).toContain("not emitted for cancelled pre-login");
    expect(recipe.finalChecks).toContain("paper-player-session-lifecycle-safety");

    const guardrail = getAuthoringGuardrail("paper-player-session-lifecycle-safety");
    expect(guardrail.rules.join("\n")).toContain("session instance or generation");
    expect(guardrail.rules.join("\n")).toContain("explicit bounded persistence barrier");
    expect(guardrail.rules.join("\n")).toContain("fallback reconciliation sweep");

    const diagnostic = getAuthoringDiagnostic("paper-player-session-lifecycle-unsafe");
    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.failIf.join("\n")).toContain("old tasks or callbacks still run");
    expect(diagnostic.failIf.join("\n")).toContain("fire-and-forget persistence");
    expect(diagnostic.failIf.join("\n")).toContain("missing or late events");

    const scenario = getAuthoringScenario("paper-player-session-lifecycle-review");
    expect(scenario.requiredLookups.recipes).toEqual(["paper-player-session-lifecycle"]);
    expect(scenario.requiredLookups.diagnostics).toContain("paper-player-session-lifecycle-unsafe");
    expect(scenario.mustAvoid.join("\n")).toContain("inventory contents");

    const scenarioSearch = searchAuthoringScenarios({
      query: "Paper player session rapid reconnect stale async callback teardown shutdown",
      domain: "paper-plugin",
    });
    expect(scenarioSearch.results[0]?.scenario.id).toBe("paper-player-session-lifecycle-review");
    expect(scenarioSearch.results[0]?.matches.flatMap((match) => match.matchedTokens)).toEqual(
      expect.arrayContaining(["session", "reconnect", "callback"]),
    );

    const catalogSearch = searchCatalog({
      query: "session generation teardown reconnect",
      domain: "paper-plugin",
      kind: "authoring-recipe",
    });
    expect(catalogSearch.results[0]).toEqual(
      expect.objectContaining({
        id: "paper-player-session-lifecycle",
        kind: "authoring-recipe",
      }),
    );

    const plan = getAuthoringPlan({
      scenario: "paper-player-session-lifecycle-review",
      version: "1.21.11",
    });
    expect(plan.recipes.map((entry) => entry.id)).toContain("paper-player-session-lifecycle");
    expect(plan.diagnostics.map((entry) => entry.id)).toContain(
      "paper-player-session-lifecycle-unsafe",
    );
    expect(plan.factSurfaces.map((entry) => entry.id)).toContain("paper-api-surface");

    const task = "Paper player reconnect leaves an old async callback and leaked session task";
    const suggestions = suggestMinecraftLookups({
      version: "1.21.11",
      task,
      domain: "paper-plugin",
    });
    expect(suggestions.suggestedTools.map((entry) => entry.tool)).toContain(
      `plugin paper search ${JSON.stringify(task)}`,
    );
    expect(suggestions.catalog.results.map((entry) => entry.id)).toContain(
      "paper-player-session-lifecycle",
    );
    expect(suggestions.scenarios.results[0]?.scenario.id).toBe(
      "paper-player-session-lifecycle-review",
    );
  });
});
