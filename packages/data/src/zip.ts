import { inflateRawSync } from "node:zlib";

const endOfCentralDirectorySignature = 0x06054b50;
const centralDirectoryFileHeaderSignature = 0x02014b50;
const localFileHeaderSignature = 0x04034b50;
const dataDescriptorSignature = 0x08074b50;
const maxEntryNameBytes = 4 * 1024;
const maxTotalEntryNameBytes = 16 * 1024 * 1024;
const maxReadableEntryBytes = 256 * 1024 * 1024;

function assertSupportedFlags(flags: number, compressionMethod: number, entryName: string): void {
  if ((flags & 1) !== 0) {
    throw new Error(`Unsupported zip: encrypted entry ${entryName}`);
  }
  // Data descriptors and UTF-8 names are format-level features. Bits 1 and 2 are
  // defined compression tuning hints only for deflate. All remaining bits enable
  // encryption, patching, masking, or reserved features this bounded reader does
  // not implement.
  const allowedFlags = 0x0008 | 0x0800 | (compressionMethod === 8 ? 0x0006 : 0);
  const unsupportedFlags = flags & ~allowedFlags;
  if (unsupportedFlags !== 0) {
    throw new Error(
      `Unsupported zip: general-purpose flags 0x${unsupportedFlags.toString(16)} for ${entryName}`,
    );
  }
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function calculateCrc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = (crcTable[(value ^ byte) & 0xff] ?? 0) ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const maxCommentLength = 0xffff;
  const minOffset = Math.max(0, buffer.length - maxCommentLength - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (
      buffer.readUInt32LE(offset) === endOfCentralDirectorySignature &&
      offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length
    ) {
      return offset;
    }
  }
  throw new Error("Invalid zip: end of central directory not found");
}

export type ZipEntry = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  directory: boolean;
};

export type ZipArchive = {
  entries: readonly ZipEntry[];
  readEntry(entryName: string): Buffer;
  readEntries(entryNames: readonly string[]): Map<string, Buffer>;
};

type IndexedZipEntry = ZipEntry & {
  crc32: number;
  flags: number;
  nameBytes: Buffer;
  localHeaderOffset: number;
  dataOffset: number;
  dataEnd: number;
  recordEnd: number;
};

function parseZipEntries(buffer: Buffer): IndexedZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocdOffset + 8);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new Error("Unsupported zip: multi-disk archives are not supported");
  }
  if (
    totalEntries === 0xffff ||
    centralDirectoryOffset === 0xffffffff ||
    centralDirectorySize === 0xffffffff
  ) {
    throw new Error("Unsupported zip: ZIP64 archives are not supported");
  }
  let offset = centralDirectoryOffset;
  const endOffset = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryOffset > eocdOffset || endOffset > eocdOffset) {
    throw new Error("Invalid zip: central directory is outside the archive");
  }
  const entries: IndexedZipEntry[] = [];
  const entryNames = new Set<string>();
  let totalEntryNameBytes = 0;
  const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

  while (offset < endOffset) {
    if (offset + 46 > endOffset) {
      throw new Error("Invalid zip: truncated central directory header");
    }
    if (buffer.readUInt32LE(offset) !== centralDirectoryFileHeaderSignature) {
      throw new Error("Invalid zip: central directory header not found");
    }
    if (entries.length >= totalEntries) {
      throw new Error("Invalid zip: central directory entry count exceeds end record");
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const crc32 = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const diskNumberStart = buffer.readUInt16LE(offset + 34);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + fileNameLength + extraFieldLength + fileCommentLength;
    if (nextOffset > endOffset) {
      throw new Error("Invalid zip: central directory entry exceeds its declared size");
    }
    if (fileNameLength < 1 || fileNameLength > maxEntryNameBytes) {
      throw new Error(`Invalid zip: entry filename must contain 1 to ${maxEntryNameBytes} bytes`);
    }
    totalEntryNameBytes += fileNameLength;
    if (totalEntryNameBytes > maxTotalEntryNameBytes) {
      throw new Error(`Invalid zip: entry filenames exceed ${maxTotalEntryNameBytes} bytes total`);
    }
    const nameBytes = buffer.subarray(offset + 46, offset + 46 + fileNameLength);
    let fileName: string;
    try {
      fileName = utf8Decoder.decode(nameBytes);
    } catch {
      throw new Error("Invalid zip: entry filename is not valid UTF-8");
    }
    if (fileName.includes("\0")) {
      throw new Error("Invalid zip: entry filename contains a NUL byte");
    }
    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      throw new Error(`Unsupported zip: ZIP64 entry ${fileName}`);
    }
    if (diskNumberStart !== 0) {
      throw new Error(`Unsupported zip: multi-disk entry ${fileName}`);
    }
    assertSupportedFlags(flags, compressionMethod, fileName);
    if (localHeaderOffset >= centralDirectoryOffset) {
      throw new Error(`Invalid zip: local header is outside file data for ${fileName}`);
    }
    if (entryNames.has(fileName)) {
      throw new Error(`Invalid zip: duplicate entry ${fileName}`);
    }
    entryNames.add(fileName);
    entries.push({
      name: fileName,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      directory: fileName.endsWith("/"),
      crc32,
      flags,
      nameBytes,
      localHeaderOffset,
      dataOffset: 0,
      dataEnd: 0,
      recordEnd: 0,
    });

    offset = nextOffset;
  }

  if (entries.length !== totalEntries) {
    throw new Error(
      `Invalid zip: expected ${totalEntries} central directory entries, found ${entries.length}`,
    );
  }

  indexLocalEntryRanges(buffer, entries, centralDirectoryOffset);

  return entries;
}

function indexLocalEntryRanges(
  buffer: Buffer,
  entries: IndexedZipEntry[],
  centralDirectoryOffset: number,
): void {
  const ranges: Array<{ start: number; end: number; name: string }> = [];
  for (const entry of entries) {
    const { localHeaderOffset } = entry;
    if (localHeaderOffset + 30 > centralDirectoryOffset) {
      throw new Error(`Invalid zip: local header is outside file data for ${entry.name}`);
    }
    if (buffer.readUInt32LE(localHeaderOffset) !== localFileHeaderSignature) {
      throw new Error(`Invalid zip: local header not found for ${entry.name}`);
    }
    const localFlags = buffer.readUInt16LE(localHeaderOffset + 6);
    const localCompressionMethod = buffer.readUInt16LE(localHeaderOffset + 8);
    const localCrc32 = buffer.readUInt32LE(localHeaderOffset + 14);
    const localCompressedSize = buffer.readUInt32LE(localHeaderOffset + 18);
    const localUncompressedSize = buffer.readUInt32LE(localHeaderOffset + 22);
    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
    assertSupportedFlags(localFlags, localCompressionMethod, entry.name);
    if (localFlags !== entry.flags) {
      throw new Error(`Invalid zip: local flags differ from central directory for ${entry.name}`);
    }
    if (localCompressionMethod !== entry.compressionMethod) {
      throw new Error(`Invalid zip: local compression method differs for ${entry.name}`);
    }
    const usesDataDescriptor = (entry.flags & 8) !== 0;
    if (
      (!usesDataDescriptor &&
        (localCrc32 !== entry.crc32 ||
          localCompressedSize !== entry.compressedSize ||
          localUncompressedSize !== entry.uncompressedSize)) ||
      (usesDataDescriptor &&
        ((localCrc32 !== 0 && localCrc32 !== entry.crc32) ||
          (localCompressedSize !== 0 && localCompressedSize !== entry.compressedSize) ||
          (localUncompressedSize !== 0 && localUncompressedSize !== entry.uncompressedSize)))
    ) {
      throw new Error(
        `Invalid zip: local metadata differs from central directory for ${entry.name}`,
      );
    }
    const localNameOffset = localHeaderOffset + 30;
    const localNameEnd = localNameOffset + localFileNameLength;
    const dataOffset = localNameEnd + localExtraFieldLength;
    if (localNameEnd > centralDirectoryOffset || dataOffset > centralDirectoryOffset) {
      throw new Error(`Invalid zip: local metadata exceeds file data for ${entry.name}`);
    }
    const localFileNameBytes = buffer.subarray(localNameOffset, localNameEnd);
    if (
      localFileNameLength !== entry.nameBytes.length ||
      !localFileNameBytes.equals(entry.nameBytes)
    ) {
      throw new Error(`Invalid zip: local filename differs for ${entry.name}`);
    }
    const dataEnd = dataOffset + entry.compressedSize;
    if (dataEnd > centralDirectoryOffset) {
      throw new Error(
        `Invalid zip: compressed data overlaps the central directory for ${entry.name}`,
      );
    }
    let recordEnd = dataEnd;
    if (usesDataDescriptor) {
      const descriptorMatches = (offset: number): boolean =>
        offset + 12 <= centralDirectoryOffset &&
        buffer.readUInt32LE(offset) === entry.crc32 &&
        buffer.readUInt32LE(offset + 4) === entry.compressedSize &&
        buffer.readUInt32LE(offset + 8) === entry.uncompressedSize;
      if (
        dataEnd + 16 <= centralDirectoryOffset &&
        buffer.readUInt32LE(dataEnd) === dataDescriptorSignature &&
        descriptorMatches(dataEnd + 4)
      ) {
        recordEnd = dataEnd + 16;
      } else if (descriptorMatches(dataEnd)) {
        recordEnd = dataEnd + 12;
      } else {
        throw new Error(`Invalid zip: data descriptor differs for ${entry.name}`);
      }
    }
    entry.dataOffset = dataOffset;
    entry.dataEnd = dataEnd;
    entry.recordEnd = recordEnd;
    ranges.push({ start: localHeaderOffset, end: recordEnd, name: entry.name });
  }

  ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < ranges.length; index += 1) {
    const previous = ranges[index - 1];
    const current = ranges[index];
    if (previous && current && current.start < previous.end) {
      throw new Error(
        `Invalid zip: local entry ranges overlap for ${previous.name} and ${current.name}`,
      );
    }
  }
}

function publicZipEntries(entries: readonly IndexedZipEntry[]): ZipEntry[] {
  return entries.map(
    ({
      crc32: _crc32,
      flags: _flags,
      nameBytes: _nameBytes,
      localHeaderOffset: _localHeaderOffset,
      dataOffset: _dataOffset,
      dataEnd: _dataEnd,
      recordEnd: _recordEnd,
      ...entry
    }) => entry,
  );
}

function readIndexedZipEntry(buffer: Buffer, entry: IndexedZipEntry): Buffer {
  if (entry.uncompressedSize > maxReadableEntryBytes) {
    throw new Error(
      `Unsupported zip: uncompressed entry ${entry.name} exceeds ${maxReadableEntryBytes} bytes`,
    );
  }
  const compressed = buffer.subarray(entry.dataOffset, entry.dataEnd);
  let content: Buffer;
  if (entry.compressionMethod === 0) {
    content = compressed;
  } else if (entry.compressionMethod === 8) {
    try {
      content = inflateRawSync(compressed, {
        maxOutputLength: Math.max(entry.uncompressedSize, 1),
      });
    } catch {
      throw new Error(`Invalid zip: failed to inflate ${entry.name} within its declared size`);
    }
  } else {
    throw new Error(
      `Unsupported zip compression method ${entry.compressionMethod} for ${entry.name}`,
    );
  }
  if (content.length !== entry.uncompressedSize) {
    throw new Error(
      `Invalid zip: uncompressed size mismatch for ${entry.name}: expected ${entry.uncompressedSize}, got ${content.length}`,
    );
  }
  const actualCrc32 = calculateCrc32(content) >>> 0;
  if (actualCrc32 !== entry.crc32) {
    throw new Error(
      `Invalid zip: CRC-32 mismatch for ${entry.name}: expected ${entry.crc32}, got ${actualCrc32}`,
    );
  }
  return content;
}

export function openZipArchive(buffer: Buffer): ZipArchive {
  const indexedEntries = parseZipEntries(buffer);
  const byName = new Map(indexedEntries.map((entry) => [entry.name, entry]));
  const entries = publicZipEntries(indexedEntries);
  return {
    entries,
    readEntry(entryName: string): Buffer {
      const entry = byName.get(entryName);
      if (!entry) {
        throw new Error(`Zip entry not found: ${entryName}`);
      }
      return readIndexedZipEntry(buffer, entry);
    },
    readEntries(entryNames: readonly string[]): Map<string, Buffer> {
      const requested = new Set(entryNames);
      const result = new Map<string, Buffer>();
      for (const entry of indexedEntries) {
        if (requested.has(entry.name)) {
          result.set(entry.name, readIndexedZipEntry(buffer, entry));
        }
      }
      for (const entryName of requested) {
        if (!result.has(entryName)) {
          throw new Error(`Zip entry not found: ${entryName}`);
        }
      }
      return result;
    },
  };
}

export function listZipEntries(buffer: Buffer): ZipEntry[] {
  return [...openZipArchive(buffer).entries];
}

export function readZipEntry(buffer: Buffer, entryName: string): Buffer {
  return openZipArchive(buffer).readEntry(entryName);
}

export function readZipEntries(buffer: Buffer, entryNames: readonly string[]): Map<string, Buffer> {
  return openZipArchive(buffer).readEntries(entryNames);
}
