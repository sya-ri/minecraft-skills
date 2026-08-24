import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { listZipEntries, readZipEntries, readZipEntry } from "./zip.js";

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

function testZip(
  entries: Array<{
    name: string;
    content: string;
    compressionMethod?: 0 | 8;
    flags?: number;
    dataDescriptor?: "signed" | "unsigned";
  }>,
): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const content = Buffer.from(entry.content);
    const method = entry.compressionMethod ?? 0;
    const flags = entry.flags ?? (entry.dataDescriptor ? 8 : 0);
    const compressed = method === 8 ? deflateRawSync(content) : content;
    const checksum = crc32(content) >>> 0;
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    if (!entry.dataDescriptor) {
      local.writeUInt32LE(checksum, 14);
      local.writeUInt32LE(compressed.length, 18);
      local.writeUInt32LE(content.length, 22);
    }
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    const descriptor = entry.dataDescriptor
      ? Buffer.alloc(entry.dataDescriptor === "signed" ? 16 : 12)
      : undefined;
    if (descriptor) {
      let descriptorOffset = 0;
      if (entry.dataDescriptor === "signed") {
        descriptor.writeUInt32LE(0x08074b50, descriptorOffset);
        descriptorOffset += 4;
      }
      descriptor.writeUInt32LE(checksum, descriptorOffset);
      descriptor.writeUInt32LE(compressed.length, descriptorOffset + 4);
      descriptor.writeUInt32LE(content.length, descriptorOffset + 8);
    }
    localParts.push(local, compressed, ...(descriptor ? [descriptor] : []));

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length + compressed.length + (descriptor?.length ?? 0);
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function centralDirectoryOffset(zip: Buffer): number {
  return zip.readUInt32LE(zip.length - 22 + 16);
}

describe("bounded ZIP reader", () => {
  it("reads stored and deflated entries in one indexed batch", () => {
    const zip = testZip([
      { name: "stored.txt", content: "stored" },
      { name: "deflated.txt", content: "deflated", compressionMethod: 8 },
    ]);
    expect(listZipEntries(zip).map((entry) => entry.name)).toEqual(["stored.txt", "deflated.txt"]);
    expect(readZipEntry(zip, "deflated.txt").toString()).toBe("deflated");
    expect([...readZipEntries(zip, ["stored.txt", "deflated.txt"]).keys()]).toEqual([
      "stored.txt",
      "deflated.txt",
    ]);
  });

  it("rejects CRC corruption", () => {
    const zip = testZip([{ name: "entry.txt", content: "content" }]);
    zip.writeUInt32LE(0, 14);
    zip.writeUInt32LE(0, centralDirectoryOffset(zip) + 16);
    expect(() => readZipEntry(zip, "entry.txt")).toThrow("CRC-32 mismatch");
  });

  it("rejects local and central metadata disagreement", () => {
    const zip = testZip([{ name: "entry.txt", content: "content" }]);
    zip.writeUInt16LE(8, 8);
    expect(() => readZipEntry(zip, "entry.txt")).toThrow("local compression method differs");

    const localSize = testZip([{ name: "entry.txt", content: "content" }]);
    localSize.writeUInt32LE(1, 18);
    expect(() => listZipEntries(localSize)).toThrow("local metadata differs");

    const localName = testZip([{ name: "entry.txt", content: "content" }]);
    localName[30] = "x".charCodeAt(0);
    expect(() => listZipEntries(localName)).toThrow("local filename differs");
  });

  it("rejects duplicate names and inconsistent entry counts", () => {
    expect(() =>
      listZipEntries(
        testZip([
          { name: "duplicate.txt", content: "first" },
          { name: "duplicate.txt", content: "second" },
        ]),
      ),
    ).toThrow("duplicate entry");

    const countMismatch = testZip([{ name: "entry.txt", content: "content" }]);
    countMismatch.writeUInt16LE(2, countMismatch.length - 22 + 8);
    countMismatch.writeUInt16LE(2, countMismatch.length - 22 + 10);
    expect(() => listZipEntries(countMismatch)).toThrow("expected 2 central directory entries");
  });

  it("rejects ZIP64 entry sentinels and oversized names", () => {
    const zip64 = testZip([{ name: "entry.txt", content: "content" }]);
    zip64.writeUInt32LE(0xffffffff, centralDirectoryOffset(zip64) + 20);
    expect(() => listZipEntries(zip64)).toThrow("ZIP64 entry");

    expect(() =>
      listZipEntries(testZip([{ name: "x".repeat(4_097), content: "content" }])),
    ).toThrow("entry filename must contain 1 to 4096 bytes");
  });

  it("accepts valid signed and unsigned data descriptors", () => {
    const zip = testZip([
      { name: "signed.txt", content: "signed", dataDescriptor: "signed" },
      { name: "unsigned.txt", content: "unsigned", dataDescriptor: "unsigned" },
    ]);
    expect(readZipEntry(zip, "signed.txt").toString()).toBe("signed");
    expect(readZipEntry(zip, "unsigned.txt").toString()).toBe("unsigned");
  });

  it("rejects unsupported flags and missing or corrupt data descriptors", () => {
    const unsupportedFlags = testZip([{ name: "entry.txt", content: "content", flags: 0x20 }]);
    expect(() => listZipEntries(unsupportedFlags)).toThrow("general-purpose flags 0x20");

    const missingDescriptor = testZip([{ name: "entry.txt", content: "content" }]);
    missingDescriptor.writeUInt16LE(8, 6);
    missingDescriptor.writeUInt16LE(8, centralDirectoryOffset(missingDescriptor) + 8);
    missingDescriptor.writeUInt32LE(0, 14);
    missingDescriptor.writeUInt32LE(0, 18);
    missingDescriptor.writeUInt32LE(0, 22);
    expect(() => listZipEntries(missingDescriptor)).toThrow("data descriptor differs");

    const corruptDescriptor = testZip([
      { name: "entry.txt", content: "content", dataDescriptor: "signed" },
    ]);
    const descriptorOffset = 30 + Buffer.byteLength("entry.txt") + Buffer.byteLength("content");
    corruptDescriptor.writeUInt32LE(0, descriptorOffset + 4);
    expect(() => listZipEntries(corruptDescriptor)).toThrow("data descriptor differs");
  });

  it("rejects compressed data that overlaps the central directory", () => {
    const zip = testZip([{ name: "entry.txt", content: "content" }]);
    const centralOffset = centralDirectoryOffset(zip);
    const dataOffset = 30 + Buffer.byteLength("entry.txt");
    const overlappingSize = centralOffset - dataOffset + 1;
    zip.writeUInt32LE(overlappingSize, 18);
    zip.writeUInt32LE(overlappingSize, 22);
    zip.writeUInt32LE(overlappingSize, centralOffset + 20);
    zip.writeUInt32LE(overlappingSize, centralOffset + 24);
    expect(() => listZipEntries(zip)).toThrow("compressed data overlaps the central directory");
  });

  it("rejects overlapping local entry ranges", () => {
    const zip = testZip([
      { name: "first.txt", content: "a" },
      { name: "second.txt", content: "b" },
    ]);
    const centralOffset = centralDirectoryOffset(zip);
    zip.writeUInt32LE(2, 18);
    zip.writeUInt32LE(2, 22);
    zip.writeUInt32LE(2, centralOffset + 20);
    zip.writeUInt32LE(2, centralOffset + 24);
    expect(() => listZipEntries(zip)).toThrow("local entry ranges overlap");
  });

  it("bounds deflate output by the declared uncompressed size", () => {
    const zip = testZip([{ name: "entry.txt", content: "content", compressionMethod: 8 }]);
    const centralOffset = centralDirectoryOffset(zip);
    zip.writeUInt32LE(1, 22);
    zip.writeUInt32LE(1, centralOffset + 24);
    expect(() => readZipEntry(zip, "entry.txt")).toThrow("failed to inflate");
  });
});
