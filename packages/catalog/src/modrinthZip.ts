import { inflateRawSync } from "node:zlib";

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const MAX_ZIP_COMMENT_LENGTH = 0xffff;
const UTF8_FLAG = 0x0800;
const DATA_DESCRIPTOR_FLAG = 0x0008;
const ENCRYPTED_FLAG = 0x0001;
const STRONG_ENCRYPTION_FLAG = 0x0040;
const MASKED_HEADER_FLAG = 0x2000;
const DEFLATE_OPTION_FLAGS = 0x0006;
const SUPPORTED_FLAGS = UTF8_FLAG | DATA_DESCRIPTOR_FLAG | DEFLATE_OPTION_FLAGS;
const STORE_METHOD = 0;
const DEFLATE_METHOD = 8;
const UNIX_CREATOR_SYSTEM = 3;
const UNIX_FILE_TYPE_MASK = 0o170000;
const UNIX_REGULAR_FILE = 0o100000;
const UNIX_DIRECTORY = 0o040000;
const ZIP64_UINT16_SENTINEL = 0xffff;
const ZIP64_UINT32_SENTINEL = 0xffffffff;
const UNICODE_PATH_EXTRA_FIELD_ID = 0x7075;
const INDEX_PATH = "modrinth.index.json";
const MAX_DIAGNOSTIC_PATH_LENGTH = 512;

/** Resource limits applied before or during ZIP entry expansion. */
export type InspectModrinthArchiveLimits = {
  maxArchiveBytes: number;
  maxArchiveEntries: number;
  maxIndexBytes: number;
  maxEntryUncompressedBytes: number;
  maxTotalUncompressedBytes: number;
  maxCompressionRatio: number;
};

/** A stable binary-archive diagnostic suitable for conversion to catalog diagnostics. */
export type ModrinthArchiveDiagnostic = {
  code: string;
  message: string;
  path?: string;
};

/** Central-directory metadata verified by the binary archive inspector. */
export type InspectedModrinthArchiveEntry = {
  path: string;
  size: number;
  compressedSize: number;
  directory: boolean;
  flags: number;
  method: number;
  crc32: number;
  unixMode: number | null;
};

export type InspectModrinthArchiveOptions = {
  limits: InspectModrinthArchiveLimits;
  addDiagnostic: (diagnostic: ModrinthArchiveDiagnostic) => void;
};

export type InspectModrinthArchiveResult = {
  entries: InspectedModrinthArchiveEntry[];
  indexBytes: Uint8Array | null;
  /** Whether `entries` represents the complete parsed central directory. */
  entriesAuthoritative: boolean;
};

type CentralEntry = InspectedModrinthArchiveEntry & {
  localHeaderOffset: number;
  rawName: Uint8Array;
  binaryCheckAllowed: boolean;
};

type ByteRange = {
  start: number;
  end: number;
  path: string;
};

type DataDescriptor = {
  length: number;
};

type PendingExpansion = {
  entry: CentralEntry;
  dataOffset: number;
  isIndex: boolean;
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
  for (const byte of bytes) {
    value = (crcTable[(value ^ byte) & 0xff] ?? 0) ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function hasRange(bytes: Uint8Array, offset: number, length: number): boolean {
  return (
    Number.isSafeInteger(offset) &&
    Number.isSafeInteger(length) &&
    0 <= offset &&
    0 <= length &&
    offset <= bytes.byteLength - length
  );
}

function readUInt16LE(bytes: Uint8Array, offset: number): number | null {
  if (!hasRange(bytes, offset, 2)) return null;
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUInt32LE(bytes: Uint8Array, offset: number): number | null {
  if (!hasRange(bytes, offset, 4)) return null;
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function decodeEntryName(rawName: Uint8Array, utf8: boolean): string | null {
  if (!utf8 && rawName.some((byte) => 0x7f < byte)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(rawName);
  } catch {
    return null;
  }
}

type ExtraFieldInspection = {
  valid: boolean;
  hasUnicodePath: boolean;
};

function inspectExtraFields(extra: Uint8Array): ExtraFieldInspection {
  let offset = 0;
  let hasUnicodePath = false;
  while (offset < extra.byteLength) {
    if (!hasRange(extra, offset, 4)) {
      return { valid: false, hasUnicodePath };
    }
    const headerId = readUInt16LE(extra, offset);
    const dataLength = readUInt16LE(extra, offset + 2);
    if (headerId === null || dataLength === null || !hasRange(extra, offset + 4, dataLength)) {
      return { valid: false, hasUnicodePath };
    }
    if (headerId === UNICODE_PATH_EXTRA_FIELD_ID) {
      hasUnicodePath = true;
    }
    offset += 4 + dataLength;
  }
  return { valid: true, hasUnicodePath };
}

function isValidLimit(value: number, integer: boolean): boolean {
  return Number.isFinite(value) && 0 < value && (!integer || Number.isSafeInteger(value));
}

function limitsAreValid(limits: InspectModrinthArchiveLimits): boolean {
  return (
    isValidLimit(limits.maxArchiveBytes, true) &&
    isValidLimit(limits.maxArchiveEntries, true) &&
    isValidLimit(limits.maxIndexBytes, true) &&
    isValidLimit(limits.maxEntryUncompressedBytes, true) &&
    isValidLimit(limits.maxTotalUncompressedBytes, true) &&
    isValidLimit(limits.maxCompressionRatio, false)
  );
}

function findEndOfCentralDirectory(bytes: Uint8Array): number | null {
  const minimumOffset = Math.max(0, bytes.byteLength - MAX_ZIP_COMMENT_LENGTH - 22);
  for (let offset = bytes.byteLength - 22; minimumOffset <= offset; offset -= 1) {
    if (readUInt32LE(bytes, offset) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue;
    const commentLength = readUInt16LE(bytes, offset + 20);
    if (commentLength !== null && offset + 22 + commentLength === bytes.byteLength) return offset;
  }
  return null;
}

function compressionRatio(compressedSize: number, uncompressedSize: number): number {
  if (uncompressedSize === 0) return 0;
  if (compressedSize === 0) return Number.POSITIVE_INFINITY;
  return uncompressedSize / compressedSize;
}

function displayArchivePath(path: string): string {
  return path.length <= MAX_DIAGNOSTIC_PATH_LENGTH
    ? path
    : `${path.slice(0, MAX_DIAGNOSTIC_PATH_LENGTH - 1)}\u2026`;
}

function unixFileType(mode: number): number {
  return mode & UNIX_FILE_TYPE_MASK;
}

function describeUnixFileType(fileType: number): string {
  switch (fileType) {
    case 0o120000:
      return "symbolic link";
    case 0o060000:
      return "block device";
    case 0o020000:
      return "character device";
    case 0o010000:
      return "FIFO";
    case 0o140000:
      return "socket";
    default:
      return `special file type 0${fileType.toString(8)}`;
  }
}

function parseDataDescriptor(
  bytes: Uint8Array,
  offset: number,
  entry: CentralEntry,
  centralDirectoryOffset: number,
): DataDescriptor | null {
  const unsignedFits = hasRange(bytes, offset, 12) && offset + 12 <= centralDirectoryOffset;
  const unsignedMatches =
    unsignedFits &&
    readUInt32LE(bytes, offset) === entry.crc32 &&
    readUInt32LE(bytes, offset + 4) === entry.compressedSize &&
    readUInt32LE(bytes, offset + 8) === entry.size;
  const signedFits = hasRange(bytes, offset, 16) && offset + 16 <= centralDirectoryOffset;
  const signedMatches =
    signedFits &&
    readUInt32LE(bytes, offset) === DATA_DESCRIPTOR_SIGNATURE &&
    readUInt32LE(bytes, offset + 4) === entry.crc32 &&
    readUInt32LE(bytes, offset + 8) === entry.compressedSize &&
    readUInt32LE(bytes, offset + 12) === entry.size;
  if (signedMatches) return { length: 16 };
  if (unsignedMatches) return { length: 12 };
  return null;
}

function inflateEntry(
  bytes: Uint8Array,
  dataOffset: number,
  entry: CentralEntry,
  maxOutputLength: number,
  addDiagnostic: (diagnostic: ModrinthArchiveDiagnostic) => void,
): Uint8Array | null {
  const compressed = bytes.subarray(dataOffset, dataOffset + entry.compressedSize);
  if (entry.method === STORE_METHOD) return compressed;
  try {
    return inflateRawSync(compressed, { maxOutputLength });
  } catch {
    addDiagnostic({
      code: "archive.entry-inflate-failed",
      path: entry.path,
      message: `Could not safely expand ${displayArchivePath(entry.path)} within the configured output limit.`,
    });
    return null;
  }
}

/**
 * Inspects a Modrinth archive without trusting ZIP sizes or expanding unbounded output.
 *
 * Only the root `modrinth.index.json` payload is retained. Other files are expanded only long
 * enough to verify their declared size and CRC-32, then released.
 */
export function inspectModrinthArchive(
  archive: Uint8Array,
  options: InspectModrinthArchiveOptions,
): InspectModrinthArchiveResult {
  const emptyResult: InspectModrinthArchiveResult = {
    entries: [],
    indexBytes: null,
    entriesAuthoritative: false,
  };
  let diagnosticCallbackAvailable = true;
  const addDiagnostic = (diagnostic: ModrinthArchiveDiagnostic): void => {
    if (!diagnosticCallbackAvailable) return;
    try {
      options.addDiagnostic(diagnostic);
    } catch {
      diagnosticCallbackAvailable = false;
    }
  };
  try {
    if (!limitsAreValid(options.limits)) {
      addDiagnostic({
        code: "archive.invalid-limits",
        message: "All archive inspection limits must be finite positive values.",
      });
      return emptyResult;
    }
    if (options.limits.maxArchiveBytes < archive.byteLength) {
      addDiagnostic({
        code: "archive.byte-limit-exceeded",
        message: `Archive size ${archive.byteLength} exceeds the ${options.limits.maxArchiveBytes}-byte limit.`,
      });
      return emptyResult;
    }

    const eocdOffset = findEndOfCentralDirectory(archive);
    if (eocdOffset === null) {
      addDiagnostic({
        code: "archive.eocd-invalid",
        message: "A complete ZIP end-of-central-directory record was not found.",
      });
      return emptyResult;
    }

    const diskNumber = readUInt16LE(archive, eocdOffset + 4) ?? ZIP64_UINT16_SENTINEL;
    const centralDirectoryDisk = readUInt16LE(archive, eocdOffset + 6) ?? ZIP64_UINT16_SENTINEL;
    const entriesOnDisk = readUInt16LE(archive, eocdOffset + 8) ?? ZIP64_UINT16_SENTINEL;
    const entryCount = readUInt16LE(archive, eocdOffset + 10) ?? ZIP64_UINT16_SENTINEL;
    const centralDirectorySize = readUInt32LE(archive, eocdOffset + 12) ?? ZIP64_UINT32_SENTINEL;
    const centralDirectoryOffset = readUInt32LE(archive, eocdOffset + 16) ?? ZIP64_UINT32_SENTINEL;

    if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
      addDiagnostic({
        code: "archive.multidisk-unsupported",
        message: "Split or multi-disk ZIP archives are not supported.",
      });
      return emptyResult;
    }
    if (
      entryCount === ZIP64_UINT16_SENTINEL ||
      entriesOnDisk === ZIP64_UINT16_SENTINEL ||
      centralDirectorySize === ZIP64_UINT32_SENTINEL ||
      centralDirectoryOffset === ZIP64_UINT32_SENTINEL
    ) {
      addDiagnostic({
        code: "archive.zip64-unsupported",
        message: "ZIP64 archives are not supported by the Modrinth archive validator.",
      });
      return emptyResult;
    }
    if (options.limits.maxArchiveEntries < entryCount) {
      addDiagnostic({
        code: "archive.entry-limit-exceeded",
        message: `Archive entry count ${entryCount} exceeds the ${options.limits.maxArchiveEntries}-entry limit.`,
      });
      return emptyResult;
    }
    if (
      !hasRange(archive, centralDirectoryOffset, centralDirectorySize) ||
      eocdOffset < centralDirectoryOffset + centralDirectorySize
    ) {
      addDiagnostic({
        code: "archive.central-directory-out-of-bounds",
        message: "The ZIP central directory points outside the archive.",
      });
      return emptyResult;
    }

    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
    const entries: CentralEntry[] = [];
    let centralOffset = centralDirectoryOffset;
    let totalUncompressedBytes = 0;
    for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
      if (
        !hasRange(archive, centralOffset, 46) ||
        centralDirectoryEnd < centralOffset + 46 ||
        readUInt32LE(archive, centralOffset) !== CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE
      ) {
        addDiagnostic({
          code: "archive.central-header-invalid",
          message: `Central-directory entry ${entryIndex} is missing or truncated.`,
        });
        return { entries, indexBytes: null, entriesAuthoritative: false };
      }

      const versionMadeBy = readUInt16LE(archive, centralOffset + 4) ?? 0;
      const flags = readUInt16LE(archive, centralOffset + 8) ?? 0;
      const method = readUInt16LE(archive, centralOffset + 10) ?? ZIP64_UINT16_SENTINEL;
      const expectedCrc32 = readUInt32LE(archive, centralOffset + 16) ?? 0;
      const compressedSize = readUInt32LE(archive, centralOffset + 20) ?? ZIP64_UINT32_SENTINEL;
      const size = readUInt32LE(archive, centralOffset + 24) ?? ZIP64_UINT32_SENTINEL;
      const nameLength = readUInt16LE(archive, centralOffset + 28) ?? 0;
      const extraLength = readUInt16LE(archive, centralOffset + 30) ?? 0;
      const commentLength = readUInt16LE(archive, centralOffset + 32) ?? 0;
      const diskStart = readUInt16LE(archive, centralOffset + 34) ?? ZIP64_UINT16_SENTINEL;
      const externalAttributes = readUInt32LE(archive, centralOffset + 38) ?? 0;
      const localHeaderOffset = readUInt32LE(archive, centralOffset + 42) ?? ZIP64_UINT32_SENTINEL;
      const recordLength = 46 + nameLength + extraLength + commentLength;
      if (
        !hasRange(archive, centralOffset, recordLength) ||
        centralDirectoryEnd < centralOffset + recordLength
      ) {
        addDiagnostic({
          code: "archive.central-header-truncated",
          message: `Central-directory entry ${entryIndex} extends past the central directory.`,
        });
        return { entries, indexBytes: null, entriesAuthoritative: false };
      }

      const rawName = archive.subarray(centralOffset + 46, centralOffset + 46 + nameLength);
      const centralExtra = archive.subarray(
        centralOffset + 46 + nameLength,
        centralOffset + 46 + nameLength + extraLength,
      );
      const decodedName = decodeEntryName(rawName, (flags & UTF8_FLAG) !== 0);
      const path = decodedName ?? `<entry-${entryIndex}>`;
      let binaryCheckAllowed = true;
      if (decodedName === null || decodedName.length === 0) {
        addDiagnostic({
          code: "archive.entry-name-invalid",
          path,
          message: `Archive entry ${entryIndex} has an empty, invalid UTF-8, or unmarked non-ASCII name.`,
        });
        binaryCheckAllowed = false;
      }
      const centralExtraInspection = inspectExtraFields(centralExtra);
      if (!centralExtraInspection.valid) {
        addDiagnostic({
          code: "archive.central-extra-invalid",
          path,
          message: `The central extra fields for ${displayArchivePath(path)} contain a truncated or malformed record.`,
        });
        binaryCheckAllowed = false;
      }
      if (centralExtraInspection.hasUnicodePath) {
        addDiagnostic({
          code: "archive.unicode-path-extra-unsupported",
          path,
          message: `The central header for ${displayArchivePath(path)} uses a Unicode Path extra field that could replace the validated entry name.`,
        });
        binaryCheckAllowed = false;
      }
      if (
        compressedSize === ZIP64_UINT32_SENTINEL ||
        size === ZIP64_UINT32_SENTINEL ||
        localHeaderOffset === ZIP64_UINT32_SENTINEL ||
        diskStart === ZIP64_UINT16_SENTINEL
      ) {
        addDiagnostic({
          code: "archive.zip64-unsupported",
          path,
          message: `ZIP64 metadata is not supported for ${displayArchivePath(path)}.`,
        });
        binaryCheckAllowed = false;
      }
      if (diskStart !== 0) {
        addDiagnostic({
          code: "archive.multidisk-unsupported",
          path,
          message: `Entry ${displayArchivePath(path)} starts on another ZIP disk.`,
        });
        binaryCheckAllowed = false;
      }
      if ((flags & (ENCRYPTED_FLAG | STRONG_ENCRYPTION_FLAG | MASKED_HEADER_FLAG)) !== 0) {
        addDiagnostic({
          code: "archive.entry-encrypted",
          path,
          message: `Encrypted or masked entry ${displayArchivePath(path)} is not supported.`,
        });
        binaryCheckAllowed = false;
      }
      if ((flags & ~SUPPORTED_FLAGS) !== 0) {
        addDiagnostic({
          code: "archive.entry-flags-unsupported",
          path,
          message: `Entry ${displayArchivePath(path)} uses unsupported general-purpose flags 0x${flags.toString(16)}.`,
        });
        binaryCheckAllowed = false;
      }
      if (method !== DEFLATE_METHOD && (flags & DEFLATE_OPTION_FLAGS) !== 0) {
        addDiagnostic({
          code: "archive.entry-flags-unsupported",
          path,
          message: `Entry ${displayArchivePath(path)} uses DEFLATE option flags with compression method ${method}.`,
        });
        binaryCheckAllowed = false;
      }
      if (method !== STORE_METHOD && method !== DEFLATE_METHOD) {
        addDiagnostic({
          code: "archive.entry-method-unsupported",
          path,
          message: `Entry ${displayArchivePath(path)} uses unsupported compression method ${method}.`,
        });
        binaryCheckAllowed = false;
      }

      const creatorSystem = versionMadeBy >>> 8;
      const unixMode = creatorSystem === UNIX_CREATOR_SYSTEM ? externalAttributes >>> 16 : null;
      const fileType = unixMode === null ? 0 : unixFileType(unixMode);
      if (fileType !== 0 && fileType !== UNIX_REGULAR_FILE && fileType !== UNIX_DIRECTORY) {
        addDiagnostic({
          code: "archive.entry-special-file",
          path,
          message: `Entry ${displayArchivePath(path)} is a Unix ${describeUnixFileType(fileType)}, which is not allowed.`,
        });
        binaryCheckAllowed = false;
      }
      const hasDirectoryMarker = path.endsWith("/") || (externalAttributes & 0x10) !== 0;
      if (
        (fileType === UNIX_REGULAR_FILE && hasDirectoryMarker) ||
        (fileType === UNIX_DIRECTORY && !hasDirectoryMarker)
      ) {
        addDiagnostic({
          code: "archive.entry-type-mismatch",
          path,
          message: `The Unix file type and ZIP directory markers disagree for ${displayArchivePath(path)}.`,
        });
        binaryCheckAllowed = false;
      }
      const directory = hasDirectoryMarker || fileType === UNIX_DIRECTORY;
      if (options.limits.maxEntryUncompressedBytes < size) {
        addDiagnostic({
          code: "archive.entry-size-limit-exceeded",
          path,
          message: `Entry ${displayArchivePath(path)} declares ${size} uncompressed bytes, above the ${options.limits.maxEntryUncompressedBytes}-byte limit.`,
        });
        binaryCheckAllowed = false;
      }
      const ratio = compressionRatio(compressedSize, size);
      if (options.limits.maxCompressionRatio < ratio) {
        addDiagnostic({
          code: "archive.compression-ratio-limit-exceeded",
          path,
          message: `Entry ${displayArchivePath(path)} has compression ratio ${ratio.toFixed(2)}, above the ${options.limits.maxCompressionRatio} limit.`,
        });
        binaryCheckAllowed = false;
      }
      totalUncompressedBytes += size;
      entries.push({
        path,
        size,
        compressedSize,
        directory,
        flags,
        method,
        crc32: expectedCrc32,
        unixMode,
        localHeaderOffset,
        rawName: Uint8Array.from(rawName),
        binaryCheckAllowed,
      });
      centralOffset += recordLength;
    }

    if (centralOffset !== centralDirectoryEnd) {
      addDiagnostic({
        code: "archive.central-directory-size-mismatch",
        message: "The central-directory size does not match its entry records.",
      });
      return {
        entries: entries.map(
          ({
            localHeaderOffset: _offset,
            rawName: _name,
            binaryCheckAllowed: _allowed,
            ...entry
          }) => entry,
        ),
        indexBytes: null,
        entriesAuthoritative: false,
      };
    }

    const totalLimitExceeded = options.limits.maxTotalUncompressedBytes < totalUncompressedBytes;
    if (totalLimitExceeded) {
      addDiagnostic({
        code: "archive.total-size-limit-exceeded",
        message: `Archive declares ${totalUncompressedBytes} total uncompressed bytes, above the ${options.limits.maxTotalUncompressedBytes}-byte limit.`,
      });
    }

    const ranges: ByteRange[] = [];
    const pendingExpansions: PendingExpansion[] = [];
    let indexBytes: Uint8Array | null = null;
    let indexSeen = false;
    for (const entry of entries) {
      const localOffset = entry.localHeaderOffset;
      if (
        !hasRange(archive, localOffset, 30) ||
        centralDirectoryOffset < localOffset + 30 ||
        readUInt32LE(archive, localOffset) !== LOCAL_FILE_HEADER_SIGNATURE
      ) {
        addDiagnostic({
          code: "archive.local-header-invalid",
          path: entry.path,
          message: `The local header for ${displayArchivePath(entry.path)} is missing, truncated, or inside the central directory.`,
        });
        continue;
      }

      const localFlags = readUInt16LE(archive, localOffset + 6) ?? ZIP64_UINT16_SENTINEL;
      const localMethod = readUInt16LE(archive, localOffset + 8) ?? ZIP64_UINT16_SENTINEL;
      const localCrc32 = readUInt32LE(archive, localOffset + 14) ?? ZIP64_UINT32_SENTINEL;
      const localCompressedSize = readUInt32LE(archive, localOffset + 18) ?? ZIP64_UINT32_SENTINEL;
      const localSize = readUInt32LE(archive, localOffset + 22) ?? ZIP64_UINT32_SENTINEL;
      const localNameLength = readUInt16LE(archive, localOffset + 26) ?? 0;
      const localExtraLength = readUInt16LE(archive, localOffset + 28) ?? 0;
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      if (!hasRange(archive, localOffset, 30 + localNameLength + localExtraLength)) {
        addDiagnostic({
          code: "archive.local-header-truncated",
          path: entry.path,
          message: `The local header for ${displayArchivePath(entry.path)} extends outside the archive.`,
        });
        continue;
      }

      const localRawName = archive.subarray(localOffset + 30, localOffset + 30 + localNameLength);
      const localExtra = archive.subarray(
        localOffset + 30 + localNameLength,
        localOffset + 30 + localNameLength + localExtraLength,
      );
      let localHeaderMatches = true;
      if (!bytesEqual(entry.rawName, localRawName)) {
        addDiagnostic({
          code: "archive.local-name-mismatch",
          path: entry.path,
          message: `The local and central entry names differ for ${displayArchivePath(entry.path)}.`,
        });
        localHeaderMatches = false;
      }
      const localExtraInspection = inspectExtraFields(localExtra);
      if (!localExtraInspection.valid) {
        addDiagnostic({
          code: "archive.local-extra-invalid",
          path: entry.path,
          message: `The local extra fields for ${displayArchivePath(entry.path)} contain a truncated or malformed record.`,
        });
        localHeaderMatches = false;
      }
      if (localExtraInspection.hasUnicodePath) {
        addDiagnostic({
          code: "archive.unicode-path-extra-unsupported",
          path: entry.path,
          message: `The local header for ${displayArchivePath(entry.path)} uses a Unicode Path extra field that could replace the validated entry name.`,
        });
        localHeaderMatches = false;
      }
      if (localFlags !== entry.flags) {
        addDiagnostic({
          code: "archive.local-flags-mismatch",
          path: entry.path,
          message: `The local and central general-purpose flags differ for ${displayArchivePath(entry.path)}.`,
        });
        localHeaderMatches = false;
      }
      if (localMethod !== entry.method) {
        addDiagnostic({
          code: "archive.local-method-mismatch",
          path: entry.path,
          message: `The local and central compression methods differ for ${displayArchivePath(entry.path)}.`,
        });
        localHeaderMatches = false;
      }

      const usesDataDescriptor = (entry.flags & DATA_DESCRIPTOR_FLAG) !== 0;
      if (!usesDataDescriptor) {
        if (
          localCrc32 !== entry.crc32 ||
          localCompressedSize !== entry.compressedSize ||
          localSize !== entry.size
        ) {
          addDiagnostic({
            code: "archive.local-metadata-mismatch",
            path: entry.path,
            message: `The local CRC-32 or sizes differ from the central directory for ${displayArchivePath(entry.path)}.`,
          });
          localHeaderMatches = false;
        }
      } else if (
        (localCrc32 !== 0 && localCrc32 !== entry.crc32) ||
        (localCompressedSize !== 0 && localCompressedSize !== entry.compressedSize) ||
        (localSize !== 0 && localSize !== entry.size)
      ) {
        addDiagnostic({
          code: "archive.local-metadata-mismatch",
          path: entry.path,
          message: `The descriptor-based local CRC-32 or sizes are neither zero nor central values for ${displayArchivePath(entry.path)}.`,
        });
        localHeaderMatches = false;
      }

      const compressedDataEnd = dataOffset + entry.compressedSize;
      if (
        !hasRange(archive, dataOffset, entry.compressedSize) ||
        centralDirectoryOffset < compressedDataEnd
      ) {
        addDiagnostic({
          code: "archive.entry-data-out-of-bounds",
          path: entry.path,
          message: `Compressed data for ${displayArchivePath(entry.path)} extends outside the local-file area.`,
        });
        continue;
      }

      let rangeEnd = compressedDataEnd;
      if (usesDataDescriptor) {
        const descriptor = parseDataDescriptor(
          archive,
          compressedDataEnd,
          entry,
          centralDirectoryOffset,
        );
        if (descriptor === null) {
          addDiagnostic({
            code: "archive.data-descriptor-mismatch",
            path: entry.path,
            message: `The data descriptor is missing or inconsistent for ${displayArchivePath(entry.path)}.`,
          });
          localHeaderMatches = false;
        } else {
          rangeEnd += descriptor.length;
        }
      }
      ranges.push({ start: localOffset, end: rangeEnd, path: entry.path });

      const isIndex = entry.path === INDEX_PATH && !entry.directory;
      if (isIndex && indexSeen) {
        addDiagnostic({
          code: "archive.index-duplicate",
          path: entry.path,
          message: "The archive contains more than one root modrinth.index.json entry.",
        });
      }
      if (isIndex) indexSeen = true;

      const indexLimitExceeded = isIndex && options.limits.maxIndexBytes < entry.size;
      if (indexLimitExceeded) {
        addDiagnostic({
          code: "archive.index-size-limit-exceeded",
          path: entry.path,
          message: `modrinth.index.json declares ${entry.size} bytes, above the ${options.limits.maxIndexBytes}-byte limit.`,
        });
      }
      if (
        totalLimitExceeded ||
        indexLimitExceeded ||
        !entry.binaryCheckAllowed ||
        !localHeaderMatches
      ) {
        continue;
      }
      pendingExpansions.push({ entry, dataOffset, isIndex });
    }

    ranges.sort(
      (left, right) =>
        left.start - right.start || left.end - right.end || left.path.localeCompare(right.path),
    );
    const overlappingPaths = new Set<string>();
    let containingRange = ranges[0];
    for (let index = 1; index < ranges.length; index += 1) {
      const current = ranges[index];
      if (
        containingRange !== undefined &&
        current !== undefined &&
        current.start < containingRange.end
      ) {
        addDiagnostic({
          code: "archive.entry-data-overlap",
          path: current.path,
          message: `Local-file ranges for ${displayArchivePath(containingRange.path)} and ${displayArchivePath(current.path)} overlap.`,
        });
        overlappingPaths.add(containingRange.path);
        overlappingPaths.add(current.path);
      }
      if (
        current !== undefined &&
        (containingRange === undefined || containingRange.end < current.end)
      ) {
        containingRange = current;
      }
    }

    for (const { entry, dataOffset, isIndex } of pendingExpansions) {
      if (overlappingPaths.has(entry.path)) continue;
      const boundedLength = Math.max(
        1,
        Math.min(
          options.limits.maxEntryUncompressedBytes,
          entry.size < options.limits.maxEntryUncompressedBytes ? entry.size + 1 : entry.size,
        ),
      );
      const expanded = inflateEntry(archive, dataOffset, entry, boundedLength, addDiagnostic);
      if (expanded === null) continue;
      if (expanded.byteLength !== entry.size) {
        addDiagnostic({
          code: "archive.entry-expanded-size-mismatch",
          path: entry.path,
          message: `Entry ${displayArchivePath(entry.path)} expanded to ${expanded.byteLength} bytes instead of ${entry.size}.`,
        });
        continue;
      }
      const actualCrc32 = crc32(expanded);
      if (actualCrc32 !== entry.crc32) {
        addDiagnostic({
          code: "archive.entry-crc32-mismatch",
          path: entry.path,
          message: `Entry ${displayArchivePath(entry.path)} has CRC-32 0x${actualCrc32.toString(16).padStart(8, "0")} instead of 0x${entry.crc32.toString(16).padStart(8, "0")}.`,
        });
        continue;
      }
      if (isIndex && indexBytes === null) indexBytes = Uint8Array.from(expanded);
    }

    return {
      entries: entries.map(
        ({ localHeaderOffset: _offset, rawName: _name, binaryCheckAllowed: _allowed, ...entry }) =>
          entry,
      ),
      indexBytes,
      entriesAuthoritative: true,
    };
  } catch {
    addDiagnostic({
      code: "archive.inspection-failed",
      message: "Archive inspection failed safely because the ZIP structure is invalid.",
    });
    return emptyResult;
  }
}
