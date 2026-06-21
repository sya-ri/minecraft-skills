import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildResourcepackModelSummary } from "./resourcepackModels.js";

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

describe("buildResourcepackModelSummary", () => {
  it("summarizes model and item definition JSON shapes", () => {
    const dir = mkdtempSync(join(tmpdir(), "minecraft-skills-resourcepack-models-"));
    const clientJarPath = join(dir, "client.jar");
    writeFileSync(
      clientJarPath,
      createStoredZip({
        "assets/minecraft/models/block/acacia_button.json": JSON.stringify({
          parent: "minecraft:block/button",
          textures: { texture: "minecraft:block/acacia_planks" },
        }),
        "assets/minecraft/models/item/bow.json": JSON.stringify({
          parent: "minecraft:item/generated",
          overrides: [{ predicate: { pulling: 1 }, model: "minecraft:item/bow_pulling_0" }],
        }),
        "assets/minecraft/items/bow.json": JSON.stringify({
          model: {
            type: "minecraft:condition",
            property: "minecraft:using_item",
            on_true: { type: "minecraft:model", model: "minecraft:item/bow_pulling_0" },
          },
        }),
      }),
    );

    const summary = buildResourcepackModelSummary({
      version: "26.2",
      clientJarPath,
      clientJarUrl: "https://example.test/client.jar",
      retrievedAt: "2026-06-22T00:00:00.000Z",
    });

    expect(summary.files.models.count).toBe(2);
    expect(summary.files.itemDefinitions.count).toBe(1);
    expect(summary.modelJson.topLevelKeys.map((entry) => entry.value)).toContain("parent");
    expect(summary.modelJson.textureVariables.map((entry) => entry.value)).toContain("texture");
    expect(summary.modelJson.overridePredicateKeys.map((entry) => entry.value)).toContain(
      "pulling",
    );
    expect(summary.itemDefinitionJson.modelTypes.map((entry) => entry.value)).toContain(
      "minecraft:condition",
    );
    expect(summary.itemDefinitionJson.propertyKeys.map((entry) => entry.value)).toContain(
      "minecraft:using_item",
    );
  });
});
