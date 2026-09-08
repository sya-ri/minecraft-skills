import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  compareJarInventories,
  inspectJarInventoryRecord,
  type JarInventory,
  type JarInventoryRecord,
  jarInventoryLimits,
  normalizeJarInventory,
  summarizeJarInventory,
} from "./jarInventory.js";

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

function createStoredZip(entries: Record<string, string | Uint8Array>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const contentBytes = typeof content === "string" ? Buffer.from(content) : Buffer.from(content);
    const checksum = crc32(contentBytes);
    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(contentBytes.length, 18);
    localHeader.writeUInt32LE(contentBytes.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(localHeader, 30);
    localParts.push(localHeader, contentBytes);

    const centralHeader = Buffer.alloc(46 + nameBytes.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(contentBytes.length, 20);
    centralHeader.writeUInt32LE(contentBytes.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    nameBytes.copy(centralHeader, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

const hashA = "a".repeat(64),
  hashB = "b".repeat(64);
function entry(id = "example", changes: Partial<JarInventoryRecord> = {}): JarInventoryRecord {
  return {
    archiveName: `${id}.jar`,
    platform: "fabric",
    id,
    version: "1.0.0",
    sha256: hashA,
    byteLength: 100,
    metadataIssue: null,
    ...changes,
  };
}
const inventory = (records: JarInventoryRecord[], scanComplete = true): JarInventory => ({
  schemaVersion: 1,
  scanComplete,
  records,
});
const diff = (left: JarInventoryRecord[], right: JarInventoryRecord[]) =>
  compareJarInventories({ left: inventory(left), right: inventory(right) });

describe("cross-platform JAR inventories", () => {
  it.each([
    [
      "fabric",
      { "fabric.mod.json": JSON.stringify({ schemaVersion: 1, id: "example", version: "1.0.0" }) },
    ],
    ["paper", { "plugin.yml": "name: example\nversion: 1.0.0\nmain: example.Main\n" }],
    [
      "velocity",
      {
        "velocity-plugin.json": JSON.stringify({
          id: "example",
          version: "1.0.0",
          main: "example.Main",
        }),
      },
    ],
  ])("reuses the %s descriptor parser and hashes all archive bytes", (platform, files) => {
    const bytes = createStoredZip(files as Record<string, string>);
    expect(inspectJarInventoryRecord("example.JAR", bytes)).toEqual({
      archiveName: "example.JAR",
      platform,
      id: "example",
      version: "1.0.0",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      byteLength: bytes.length,
      metadataIssue: null,
    });
  });

  it("uses Paper's active descriptor identity instead of a shadowed Bukkit descriptor", () => {
    const bytes = createStoredZip({
      "plugin.yml": "name: Old\nversion: 1\nmain: old.Main\n",
      "paper-plugin.yml":
        "name: Current\nversion: '2.0'\nmain: current.Main\napi-version: '26.2'\n",
    });
    expect(inspectJarInventoryRecord("paper.jar", bytes)).toMatchObject({
      platform: "paper",
      id: "Current",
      version: "2.0",
    });
    const brokenActive = createStoredZip({
      "plugin.yml": "name: Old\nversion: 1\nmain: old.Main\n",
      "paper-plugin.yml": "name: [broken",
    });
    expect(inspectJarInventoryRecord("paper.jar", brokenActive)).toMatchObject({
      platform: "paper",
      id: null,
      metadataIssue: "identity-unavailable",
    });
  });

  it("keeps a missing optional Velocity version unknown while retaining parsed identity", () => {
    const bytes = createStoredZip({
      "velocity-plugin.json": JSON.stringify({ id: "example", main: "example.Main" }),
    });
    expect(inspectJarInventoryRecord("proxy.jar", bytes)).toMatchObject({
      platform: "velocity",
      id: "example",
      version: null,
      metadataIssue: null,
    });
  });

  it("retains hashes but no invented identity for missing, malformed or multiple platform descriptors", () => {
    for (const [files, issue] of [
      [{ "notes.txt": "library" }, "descriptor-missing"],
      [{ "fabric.mod.json": "invalid" }, "identity-unavailable"],
      [{ "plugin.yml": "name: x", "fabric.mod.json": "{}" }, "multiple-platform-descriptors"],
    ] as const) {
      const result = inspectJarInventoryRecord("unknown.jar", createStoredZip(files));
      expect(result).toMatchObject({ id: null, metadataIssue: issue });
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(inspectJarInventoryRecord("bad.jar", Buffer.from("invalid zip"))).toMatchObject({
      id: null,
      metadataIssue: "archive-unreadable",
    });
    expect(() => inspectJarInventoryRecord("../bad.jar", Buffer.alloc(0))).toThrow(/basename/);
    const over = inspectJarInventoryRecord(
      "large.jar",
      new Uint8Array(jarInventoryLimits.maxArchiveBytes + 1),
    );
    expect(over).toMatchObject({ sha256: null, byteLength: null, metadataIssue: "archive-limit" });
  });

  it("treats equal IDs on different platforms as separate inventories", () => {
    const value = inventory([
      entry(),
      entry("example", { archiveName: "paper.jar", platform: "paper" }),
      entry("example", { archiveName: "velocity.jar", platform: "velocity" }),
    ]);
    expect(summarizeJarInventory(value).duplicateIdentityCount).toBe(0);
    expect(compareJarInventories({ left: value, right: value })).toMatchObject({
      comparisonComplete: true,
      hasDifferences: false,
      counts: { unchanged: 3 },
    });
  });

  it("distinguishes byte changes, version changes and archive renames", () => {
    const result = diff(
      [entry()],
      [entry("example", { archiveName: "renamed.jar", sha256: hashB, version: "2.0.0" })],
    );
    expect(result).toMatchObject({
      comparisonComplete: true,
      hasDifferences: true,
      counts: { changed: 1, added: 0, removed: 0 },
    });
    expect(result.changed[0]).toMatchObject({
      contentChanged: true,
      versionChanged: true,
      archiveNameChanged: true,
    });
    const renamed = diff([entry()], [entry("example", { archiveName: "renamed.jar" })]);
    expect(renamed.changed[0]).toMatchObject({
      contentChanged: false,
      versionChanged: false,
      archiveNameChanged: true,
    });
  });

  it("does not convert missing hashes or versions into content-change evidence", () => {
    const result = diff([entry("example", { sha256: null, version: null })], [entry()]);
    expect(result).toMatchObject({
      comparisonComplete: false,
      hasDifferences: null,
      counts: { changed: 0, unresolved: 1 },
    });
    expect(result.unresolved[0]).toMatchObject({ contentChanged: null, versionChanged: null });
    const knownDifference = diff(
      [entry("example", { sha256: null })],
      [entry("example", { version: "2.0" })],
    );
    expect(knownDifference).toMatchObject({ comparisonComplete: false, hasDifferences: true });
    expect(knownDifference.changed[0]?.contentChanged).toBeNull();
    const hashKnown = diff(
      [entry("example", { version: null })],
      [entry("example", { sha256: hashB })],
    );
    expect(hashKnown.changed[0]).toMatchObject({ contentChanged: true, versionChanged: null });
  });

  it("does not pair duplicate identities or invent changes for unidentified records", () => {
    const result = diff(
      [
        entry(),
        entry("example", { archiveName: "duplicate.jar" }),
        entry("unknown", { platform: null, id: null, metadataIssue: "descriptor-missing" }),
      ],
      [entry()],
    );
    expect(result).toMatchObject({
      comparisonComplete: false,
      hasDifferences: null,
      counts: { ambiguous: 1, unidentified: 1, changed: 0, removed: 0 },
    });
    expect(result.ambiguous[0]?.left).toEqual(["duplicate.jar", "example.jar"]);
    expect(result.inventories.left.duplicateIdentityCount).toBe(1);
  });

  it("reports absence only against a complete inventory with identified records", () => {
    expect(diff([], [entry()])).toMatchObject({ hasDifferences: true, counts: { added: 1 } });
    expect(diff([entry()], [])).toMatchObject({ hasDifferences: true, counts: { removed: 1 } });
    const partial = compareJarInventories({
      left: inventory([entry()]),
      right: inventory([], false),
    });
    expect(partial).toMatchObject({ hasDifferences: null, counts: { removed: 0, unmatched: 1 } });
    const unidentified = diff([entry()], [entry("unknown", { id: null })]);
    expect(unidentified).toMatchObject({
      hasDifferences: null,
      counts: { removed: 0, unmatched: 1 },
    });
  });

  it("bounds output without omitting comparison of later input records", () => {
    const records = Array.from({ length: 240 }, (_, index) => entry(`example${index}`));
    const result = diff([], records);
    expect(result).toMatchObject({
      comparisonComplete: true,
      hasDifferences: true,
      counts: { added: 240 },
      outputTruncated: true,
    });
    expect(result.added).toHaveLength(200);
  });

  it("rejects unsafe, malformed, oversized or forged byte-verification metadata", () => {
    for (const record of [
      entry("example", { archiveName: "C:/example.jar" }),
      entry("example", { sha256: "invalid" }),
      entry("example", { byteLength: -1 }),
      entry("example", { id: "a\ncontrol" }),
    ])
      expect(() => normalizeJarInventory(inventory([record]))).toThrow();
    expect(() => normalizeJarInventory(inventory([entry(), entry()]))).toThrow(/unique/);
    expect(() => normalizeJarInventory(inventory(Array(513).fill(entry())))).toThrow(/bounded/);
    expect(() => normalizeJarInventory({ ...inventory([entry()]), zipVerified: true })).toThrow(
      /unsupported/,
    );
    let calls = 0;
    expect(() =>
      normalizeJarInventory({
        schemaVersion: 1,
        scanComplete: true,
        get records() {
          calls += 1;
          return [];
        },
      }),
    ).toThrow(/accessors/);
    expect(calls).toBe(0);
    expect(diff([entry()], [entry()]).evidenceStrength).toBe("supplied-metadata");
  });
});
