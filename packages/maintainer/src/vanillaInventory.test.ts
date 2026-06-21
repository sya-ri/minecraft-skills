import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVanillaInventory } from "./vanillaInventory.js";

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

describe("buildVanillaInventory", () => {
  it("summarizes client assets and bundled server data", () => {
    const dir = mkdtempSync(join(tmpdir(), "minecraft-skills-vanilla-inventory-"));
    const clientJarPath = join(dir, "client.jar");
    const serverJarPath = join(dir, "server.jar");
    const innerServerJar = createStoredZip({
      "data/minecraft/tags/block/mineable/pickaxe.json": "{}",
      "data/minecraft/recipe/acacia_button.json": "{}",
      "data/custom/loot_table/example.json": "{}",
    });
    writeFileSync(
      clientJarPath,
      createStoredZip({
        "assets/minecraft/blockstates/acacia_button.json": "{}",
        "assets/minecraft/textures/block/acacia_planks.png": "",
        "assets/custom/lang/en_us.json": "{}",
      }),
    );
    writeFileSync(
      serverJarPath,
      createStoredZip({
        "META-INF/versions.list": "hash\t26.2\t26.2/server-26.2.jar",
        "META-INF/versions/26.2/server-26.2.jar": innerServerJar,
      }),
    );

    const inventory = buildVanillaInventory({
      version: "26.2",
      clientJarPath,
      serverJarPath,
      clientJarUrl: "https://example.test/client.jar",
      serverJarUrl: "https://example.test/server.jar",
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(inventory.resources.namespaces).toEqual(["custom", "minecraft"]);
    expect(inventory.datapack.namespaces).toEqual(["custom", "minecraft"]);
    expect(inventory.resources.topLevel).toContainEqual({
      path: "assets/minecraft/blockstates",
      count: 1,
      jsonCount: 1,
      samples: ["assets/minecraft/blockstates/acacia_button.json"],
    });
    expect(inventory.datapack.topLevel).toContainEqual({
      path: "data/minecraft/tags",
      count: 1,
      jsonCount: 1,
      samples: ["data/minecraft/tags/block/mineable/pickaxe.json"],
    });
  });
});
