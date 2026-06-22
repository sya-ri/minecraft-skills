import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildObservedDatapackSchemaSurface } from "./datapackSchemaSurfaces.js";

function createStoredZip(entries: Record<string, string | Buffer>): Buffer {
  const chunks: Buffer[] = [];
  const centralDirectoryChunks: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    chunks.push(localHeader, nameBuffer, contentBuffer);

    const centralDirectoryHeader = Buffer.alloc(46);
    centralDirectoryHeader.writeUInt32LE(0x02014b50, 0);
    centralDirectoryHeader.writeUInt16LE(20, 4);
    centralDirectoryHeader.writeUInt16LE(20, 6);
    centralDirectoryHeader.writeUInt32LE(0, 16);
    centralDirectoryHeader.writeUInt32LE(contentBuffer.length, 20);
    centralDirectoryHeader.writeUInt32LE(contentBuffer.length, 24);
    centralDirectoryHeader.writeUInt16LE(nameBuffer.length, 28);
    centralDirectoryHeader.writeUInt32LE(offset, 42);
    centralDirectoryChunks.push(centralDirectoryHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + contentBuffer.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralDirectoryChunks);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(Object.keys(entries).length, 8);
  endOfCentralDirectory.writeUInt16LE(Object.keys(entries).length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);

  return Buffer.concat([...chunks, centralDirectory, endOfCentralDirectory]);
}

describe("buildObservedDatapackSchemaSurface", () => {
  it("summarizes observed vanilla datapack JSON field shapes", () => {
    const dir = mkdtempSync(join(tmpdir(), "minecraft-skills-datapack-schema-"));
    const serverJarPath = join(dir, "server.jar");
    writeFileSync(
      serverJarPath,
      createStoredZip({
        "data/minecraft/advancement/story/root.json": JSON.stringify({
          criteria: {
            tick: {
              trigger: "minecraft:tick",
            },
          },
          rewards: {
            recipes: ["minecraft:stone"],
          },
        }),
        "data/minecraft/tags/block/mineable/pickaxe.json": JSON.stringify({
          values: ["minecraft:stone"],
        }),
      }),
    );

    const surface = buildObservedDatapackSchemaSurface({
      version: "26.2",
      serverJarPath,
      serverJarUrl: "https://example.test/server.jar",
      retrievedAt: "2026-06-22T00:00:00.000Z",
    });

    expect(surface.coverage).toBe("vanilla-observed-datapack-json-shape");
    expect(surface.kindCount).toBe(2);
    expect(surface.fileCount).toBe(2);
    expect(surface.kinds.find((kind) => kind.kind === "advancement")).toMatchObject({
      fileCount: 1,
      topLevelKeys: expect.arrayContaining([
        expect.objectContaining({ path: "criteria", count: 1 }),
        expect.objectContaining({ path: "rewards", count: 1 }),
      ]),
      fieldPaths: expect.arrayContaining([
        expect.objectContaining({ path: "$.criteria.tick.trigger" }),
        expect.objectContaining({ path: "$.rewards.recipes[]" }),
      ]),
    });
    expect(surface.kinds.find((kind) => kind.kind === "tag/block")).toMatchObject({
      fileCount: 1,
      fieldPaths: expect.arrayContaining([expect.objectContaining({ path: "$.values[]" })]),
    });
  });
});
