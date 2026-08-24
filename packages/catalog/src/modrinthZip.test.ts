import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  type InspectModrinthArchiveLimits,
  inspectModrinthArchive,
  type ModrinthArchiveDiagnostic,
} from "./modrinthZip.js";

type ZipEntryInput = {
  name: string;
  data: string | Uint8Array;
  method?: 0 | 8;
  flags?: number;
  descriptor?: boolean;
  versionMadeBy?: number;
  externalAttributes?: number;
  localExtra?: Uint8Array;
  centralExtra?: Uint8Array;
  declaredSize?: number;
  declaredCrc32?: number;
};

type BuiltZip = {
  bytes: Buffer;
  localOffsets: number[];
  centralOffsets: number[];
  eocdOffset: number;
};

const limits: InspectModrinthArchiveLimits = {
  maxArchiveBytes: 1024 * 1024,
  maxArchiveEntries: 100,
  maxIndexBytes: 64 * 1024,
  maxEntryUncompressedBytes: 128 * 1024,
  maxTotalUncompressedBytes: 256 * 1024,
  maxCompressionRatio: 200,
};

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = (crcTable[(value ^ byte) & 0xff] ?? 0) ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function buildZip(inputs: ZipEntryInput[]): BuiltZip {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  const localOffsets: number[] = [];
  const centralOffsets: number[] = [];
  let localOffset = 0;
  for (const input of inputs) {
    const name = Buffer.from(input.name, "utf8");
    const data = typeof input.data === "string" ? Buffer.from(input.data) : Buffer.from(input.data);
    const method = input.method ?? 0;
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const descriptor = input.descriptor ?? false;
    const flags = (input.flags ?? 0) | (descriptor ? 0x0008 : 0);
    const declaredSize = input.declaredSize ?? data.byteLength;
    const declaredCrc32 = input.declaredCrc32 ?? crc32(data);
    const localExtra = Buffer.from(input.localExtra ?? new Uint8Array());
    const centralExtra = Buffer.from(input.centralExtra ?? new Uint8Array());
    const local = Buffer.alloc(30 + name.byteLength + localExtra.byteLength);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(descriptor ? 0 : declaredCrc32, 14);
    local.writeUInt32LE(descriptor ? 0 : compressed.byteLength, 18);
    local.writeUInt32LE(descriptor ? 0 : declaredSize, 22);
    local.writeUInt16LE(name.byteLength, 26);
    local.writeUInt16LE(localExtra.byteLength, 28);
    name.copy(local, 30);
    localExtra.copy(local, 30 + name.byteLength);

    const descriptorBytes = descriptor ? Buffer.alloc(16) : Buffer.alloc(0);
    if (descriptor) {
      descriptorBytes.writeUInt32LE(0x08074b50, 0);
      descriptorBytes.writeUInt32LE(declaredCrc32, 4);
      descriptorBytes.writeUInt32LE(compressed.byteLength, 8);
      descriptorBytes.writeUInt32LE(declaredSize, 12);
    }
    localOffsets.push(localOffset);
    localParts.push(local, compressed, descriptorBytes);

    const central = Buffer.alloc(46 + name.byteLength + centralExtra.byteLength);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(input.versionMadeBy ?? 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(declaredCrc32, 16);
    central.writeUInt32LE(compressed.byteLength, 20);
    central.writeUInt32LE(declaredSize, 24);
    central.writeUInt16LE(name.byteLength, 28);
    central.writeUInt16LE(centralExtra.byteLength, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(input.externalAttributes ?? 0, 38);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralExtra.copy(central, 46 + name.byteLength);
    centralParts.push(central);
    localOffset += local.byteLength + compressed.byteLength + descriptorBytes.byteLength;
  }

  let centralOffset = localOffset;
  for (const central of centralParts) {
    centralOffsets.push(centralOffset);
    centralOffset += central.byteLength;
  }
  const centralDirectorySize = centralOffset - localOffset;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(inputs.length, 8);
  eocd.writeUInt16LE(inputs.length, 10);
  eocd.writeUInt32LE(centralDirectorySize, 12);
  eocd.writeUInt32LE(localOffset, 16);
  return {
    bytes: Buffer.concat([...localParts, ...centralParts, eocd]),
    localOffsets,
    centralOffsets,
    eocdOffset: centralOffset,
  };
}

function extraField(headerId: number, data: Uint8Array): Buffer {
  const field = Buffer.alloc(4 + data.byteLength);
  field.writeUInt16LE(headerId, 0);
  field.writeUInt16LE(data.byteLength, 2);
  Buffer.from(data).copy(field, 4);
  return field;
}

function unicodePathExtra(originalName: string, alternateName: string): Buffer {
  const alternate = Buffer.from(alternateName, "utf8");
  const data = Buffer.alloc(5 + alternate.byteLength);
  data[0] = 1;
  data.writeUInt32LE(crc32(Buffer.from(originalName, "utf8")), 1);
  alternate.copy(data, 5);
  return extraField(0x7075, data);
}

function inspect(
  zip: Uint8Array,
  overrides: Partial<InspectModrinthArchiveLimits> = {},
): { diagnostics: ModrinthArchiveDiagnostic[]; indexBytes: Uint8Array | null } {
  const diagnostics: ModrinthArchiveDiagnostic[] = [];
  const result = inspectModrinthArchive(zip, {
    limits: { ...limits, ...overrides },
    addDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  return { diagnostics, indexBytes: result.indexBytes };
}

function codes(diagnostics: ModrinthArchiveDiagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

function requiredOffset(offsets: number[], index: number): number {
  const offset = offsets[index];
  if (offset === undefined) throw new Error(`Missing test ZIP offset ${index}`);
  return offset;
}

describe("inspectModrinthArchive", () => {
  it("does not expose malformed ZIP or diagnostic callback exceptions", () => {
    expect(() =>
      inspectModrinthArchive(new Uint8Array(), {
        limits,
        addDiagnostic: () => {
          throw new Error("callback failed");
        },
      }),
    ).not.toThrow();
  });

  it("retains only a verified root index and exposes verified metadata", () => {
    const index = '{"formatVersion":1}';
    const zip = buildZip([
      { name: "modrinth.index.json", data: index, method: 8, descriptor: true },
      { name: "overrides/config/example.txt", data: "example" },
    ]);
    const diagnostics: ModrinthArchiveDiagnostic[] = [];

    const result = inspectModrinthArchive(zip.bytes, {
      limits,
      addDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    expect(diagnostics).toEqual([]);
    expect(new TextDecoder().decode(result.indexBytes ?? new Uint8Array())).toBe(index);
    expect(result.entries).toMatchObject([
      { path: "modrinth.index.json", size: Buffer.byteLength(index), method: 8, flags: 8 },
      { path: "overrides/config/example.txt", size: 7, method: 0, flags: 0 },
    ]);
  });

  it("rejects inexact EOCD records, multi-disk archives, and ZIP64 sentinels", () => {
    const trailing = buildZip([{ name: "modrinth.index.json", data: "{}" }]).bytes;
    const multiDisk = buildZip([{ name: "modrinth.index.json", data: "{}" }]);
    multiDisk.bytes.writeUInt16LE(1, multiDisk.eocdOffset + 4);
    const zip64 = buildZip([{ name: "modrinth.index.json", data: "{}" }]);
    zip64.bytes.writeUInt16LE(0xffff, zip64.eocdOffset + 8);
    zip64.bytes.writeUInt16LE(0xffff, zip64.eocdOffset + 10);

    expect(codes(inspect(Buffer.concat([trailing, Buffer.from([0])])).diagnostics)).toContain(
      "archive.eocd-invalid",
    );
    expect(codes(inspect(multiDisk.bytes).diagnostics)).toContain("archive.multidisk-unsupported");
    expect(codes(inspect(zip64.bytes).diagnostics)).toContain("archive.zip64-unsupported");
  });

  it("applies archive byte and entry-count limits before central entry processing", () => {
    const zip = buildZip([
      { name: "modrinth.index.json", data: "{}" },
      { name: "overrides/a", data: "a" },
    ]).bytes;

    expect(codes(inspect(zip, { maxArchiveBytes: zip.byteLength - 1 }).diagnostics)).toEqual([
      "archive.byte-limit-exceeded",
    ]);
    expect(codes(inspect(zip, { maxArchiveEntries: 1 }).diagnostics)).toEqual([
      "archive.entry-limit-exceeded",
    ]);
  });

  it("applies index, per-entry, total, and compression-ratio limits before expansion", () => {
    const indexZip = buildZip([{ name: "modrinth.index.json", data: "12345" }]).bytes;
    const entryZip = buildZip([{ name: "overrides/large", data: "12345" }]).bytes;
    const totalZip = buildZip([
      { name: "overrides/a", data: "123" },
      { name: "overrides/b", data: "456" },
    ]).bytes;
    const ratioZip = buildZip([
      { name: "overrides/compressible", data: "a".repeat(4096), method: 8 },
    ]).bytes;

    expect(codes(inspect(indexZip, { maxIndexBytes: 4 }).diagnostics)).toContain(
      "archive.index-size-limit-exceeded",
    );
    expect(codes(inspect(entryZip, { maxEntryUncompressedBytes: 4 }).diagnostics)).toContain(
      "archive.entry-size-limit-exceeded",
    );
    expect(codes(inspect(totalZip, { maxTotalUncompressedBytes: 5 }).diagnostics)).toContain(
      "archive.total-size-limit-exceeded",
    );
    expect(codes(inspect(ratioZip, { maxCompressionRatio: 2 }).diagnostics)).toContain(
      "archive.compression-ratio-limit-exceeded",
    );
  });

  it("uses bounded DEFLATE expansion when actual output exceeds the declared size", () => {
    const zip = buildZip([
      {
        name: "modrinth.index.json",
        data: "a".repeat(8192),
        method: 8,
        declaredSize: 1,
      },
    ]).bytes;

    expect(codes(inspect(zip, { maxCompressionRatio: 1000 }).diagnostics)).toContain(
      "archive.entry-inflate-failed",
    );
  });

  it("verifies expanded size and CRC-32 for stored and deflated files", () => {
    const wrongSize = buildZip([
      { name: "modrinth.index.json", data: "ab", method: 8, declaredSize: 1 },
    ]).bytes;
    const wrongCrc = buildZip([
      { name: "modrinth.index.json", data: "{}", declaredCrc32: 0x12345678 },
    ]).bytes;

    expect(codes(inspect(wrongSize).diagnostics)).toContain("archive.entry-expanded-size-mismatch");
    expect(codes(inspect(wrongCrc).diagnostics)).toContain("archive.entry-crc32-mismatch");
  });

  it("rejects encrypted, masked, and otherwise unsupported flags", () => {
    const encrypted = buildZip([{ name: "modrinth.index.json", data: "{}", flags: 1 }]).bytes;
    const masked = buildZip([{ name: "modrinth.index.json", data: "{}", flags: 0x2000 }]).bytes;
    const unsupported = buildZip([
      { name: "modrinth.index.json", data: "{}", flags: 0x0010 },
    ]).bytes;

    expect(codes(inspect(encrypted).diagnostics)).toContain("archive.entry-encrypted");
    expect(codes(inspect(masked).diagnostics)).toContain("archive.entry-encrypted");
    expect(codes(inspect(unsupported).diagnostics)).toContain("archive.entry-flags-unsupported");
  });

  it("bounds diagnostic messages for extremely long archive entry names", () => {
    const zip = buildZip([{ name: `overrides/${"a".repeat(4_096)}`, data: "x", flags: 1 }]).bytes;
    const diagnostics = inspect(zip).diagnostics;

    expect(diagnostics).not.toEqual([]);
    expect(diagnostics.every((diagnostic) => diagnostic.message.length < 1_024)).toBe(true);
  });

  it("rejects local-versus-central name, flags, method, CRC, and size mismatches", () => {
    const name = buildZip([{ name: "modrinth.index.json", data: "{}" }]);
    name.bytes[requiredOffset(name.localOffsets, 0) + 30] = "x".charCodeAt(0);
    const flags = buildZip([{ name: "modrinth.index.json", data: "{}" }]);
    flags.bytes.writeUInt16LE(0x0008, requiredOffset(flags.localOffsets, 0) + 6);
    const method = buildZip([{ name: "modrinth.index.json", data: "{}" }]);
    method.bytes.writeUInt16LE(8, requiredOffset(method.localOffsets, 0) + 8);
    const metadata = buildZip([{ name: "modrinth.index.json", data: "{}" }]);
    metadata.bytes.writeUInt32LE(3, requiredOffset(metadata.localOffsets, 0) + 22);

    expect(codes(inspect(name.bytes).diagnostics)).toContain("archive.local-name-mismatch");
    expect(codes(inspect(flags.bytes).diagnostics)).toContain("archive.local-flags-mismatch");
    expect(codes(inspect(method.bytes).diagnostics)).toContain("archive.local-method-mismatch");
    expect(codes(inspect(metadata.bytes).diagnostics)).toContain("archive.local-metadata-mismatch");
  });

  it("validates descriptor values when bit 3 is set", () => {
    const zip = buildZip([
      { name: "modrinth.index.json", data: "{}", method: 8, descriptor: true },
    ]);
    const centralOffset = requiredOffset(zip.centralOffsets, 0);
    const compressedSize = zip.bytes.readUInt32LE(centralOffset + 20);
    const localOffset = requiredOffset(zip.localOffsets, 0);
    const nameLength = zip.bytes.readUInt16LE(localOffset + 26);
    const descriptorOffset = localOffset + 30 + nameLength + compressedSize;
    zip.bytes.writeUInt32LE(999, descriptorOffset + 12);

    expect(codes(inspect(zip.bytes).diagnostics)).toContain("archive.data-descriptor-mismatch");
  });

  it.each([
    ["symbolic link", 0o120777],
    ["block device", 0o060777],
    ["character device", 0o020777],
    ["FIFO", 0o010777],
    ["socket", 0o140777],
  ])("rejects Unix %s entries from external attributes", (_label, mode) => {
    const zip = buildZip([
      {
        name: "overrides/special",
        data: "target",
        versionMadeBy: (3 << 8) | 20,
        externalAttributes: (mode << 16) >>> 0,
      },
    ]).bytes;

    expect(codes(inspect(zip).diagnostics)).toContain("archive.entry-special-file");
  });

  it.each([
    ["regular file with a trailing slash", "overrides/file/", 0o100644, 0],
    ["regular file with the DOS directory bit", "overrides/file", 0o100644, 0x10],
    ["directory without a ZIP directory marker", "overrides/directory", 0o040755, 0],
  ])("rejects a Unix %s marker mismatch", (_label, name, mode, dosAttributes) => {
    const zip = buildZip([
      {
        name,
        data: "",
        versionMadeBy: (3 << 8) | 20,
        externalAttributes: ((mode << 16) | dosAttributes) >>> 0,
      },
    ]).bytes;

    expect(codes(inspect(zip).diagnostics)).toContain("archive.entry-type-mismatch");
  });

  it.each([
    "local",
    "central",
  ] as const)("rejects a traversal Unicode Path extra field in the %s header", (header) => {
    const name = "overrides/safe.txt";
    const unicodeExtra = unicodePathExtra(name, "../../outside.txt");
    const zip = buildZip([
      {
        name,
        data: "safe",
        ...(header === "local" ? { localExtra: unicodeExtra } : { centralExtra: unicodeExtra }),
      },
    ]).bytes;

    expect(codes(inspect(zip).diagnostics)).toContain("archive.unicode-path-extra-unsupported");
  });

  it.each([
    "local",
    "central",
  ] as const)("rejects malformed extra-field TLVs in the %s header", (header) => {
    const malformedExtra = Buffer.from([0x34, 0x12, 0x05, 0x00, 0x01]);
    const zip = buildZip([
      {
        name: "overrides/safe.txt",
        data: "safe",
        ...(header === "local" ? { localExtra: malformedExtra } : { centralExtra: malformedExtra }),
      },
    ]).bytes;

    expect(codes(inspect(zip).diagnostics)).toContain(
      header === "local" ? "archive.local-extra-invalid" : "archive.central-extra-invalid",
    );
  });

  it("rejects duplicate local-header ranges", () => {
    const zip = buildZip([
      { name: "overrides/a", data: "a" },
      { name: "overrides/b", data: "b" },
    ]);
    zip.bytes.writeUInt32LE(
      requiredOffset(zip.localOffsets, 0),
      requiredOffset(zip.centralOffsets, 1) + 42,
    );

    expect(codes(inspect(zip.bytes).diagnostics)).toContain("archive.entry-data-overlap");
  });
});
