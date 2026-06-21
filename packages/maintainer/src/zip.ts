import { inflateRawSync } from "node:zlib";

const endOfCentralDirectorySignature = 0x06054b50;
const centralDirectoryFileHeaderSignature = 0x02014b50;
const localFileHeaderSignature = 0x04034b50;

function findEndOfCentralDirectory(buffer: Buffer): number {
  const maxCommentLength = 0xffff;
  const minOffset = Math.max(0, buffer.length - maxCommentLength - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endOfCentralDirectorySignature) {
      return offset;
    }
  }
  throw new Error("Invalid zip: end of central directory not found");
}

export function readZipEntry(buffer: Buffer, entryName: string): Buffer {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  let offset = centralDirectoryOffset;
  const endOffset = centralDirectoryOffset + centralDirectorySize;

  while (offset < endOffset) {
    if (buffer.readUInt32LE(offset) !== centralDirectoryFileHeaderSignature) {
      throw new Error("Invalid zip: central directory header not found");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    if (fileName === entryName) {
      if (buffer.readUInt32LE(localHeaderOffset) !== localFileHeaderSignature) {
        throw new Error(`Invalid zip: local header not found for ${entryName}`);
      }
      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
      const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
      if (compressionMethod === 0) {
        return compressed;
      }
      if (compressionMethod === 8) {
        return inflateRawSync(compressed);
      }
      throw new Error(`Unsupported zip compression method ${compressionMethod} for ${entryName}`);
    }

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  throw new Error(`Zip entry not found: ${entryName}`);
}
