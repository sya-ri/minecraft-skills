import { closeSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";

type PrefixReader = (
  file: number,
  contents: Buffer,
  offset: number,
  length: number,
  position: number,
) => number;

export function readFilePrefix(
  filePath: string,
  maxBytes: number,
  reader: PrefixReader = readSync,
  isRegularFile: (file: number) => boolean = (file) => fstatSync(file).isFile(),
): Buffer {
  const file = openSync(filePath, "r");
  try {
    if (!isRegularFile(file)) {
      throw new Error("resourcepack validate-project requires regular local OGG files");
    }
    const contents = Buffer.alloc(maxBytes);
    let offset = 0;
    while (offset < maxBytes) {
      const remaining = maxBytes - offset;
      const bytesRead = reader(file, contents, offset, remaining, offset);
      if (bytesRead === 0) {
        break;
      }
      if (!Number.isInteger(bytesRead) || bytesRead < 0 || bytesRead > remaining) {
        throw new Error("resourcepack validate-project received an invalid OGG prefix read length");
      }
      offset += bytesRead;
    }
    return contents.subarray(0, offset);
  } finally {
    closeSync(file);
  }
}

export function readBoundedPngFile(
  filePath: string,
  maxBytes: number,
  command = "resourcepack validate-png",
): Buffer {
  const pathStatus = lstatSync(filePath);
  if (pathStatus.isSymbolicLink()) {
    throw new Error(`${command} refuses symbolic links`);
  }
  if (!pathStatus.isFile()) {
    throw new Error(`${command} requires regular local PNG files`);
  }

  const file = openSync(filePath, "r");
  try {
    const before = fstatSync(file);
    const openedPathStatus = lstatSync(filePath);
    if (!before.isFile()) {
      throw new Error(`${command} requires regular local PNG files`);
    }
    if (
      openedPathStatus.isSymbolicLink() ||
      pathStatus.dev !== before.dev ||
      pathStatus.ino !== before.ino ||
      openedPathStatus.dev !== before.dev ||
      openedPathStatus.ino !== before.ino
    ) {
      throw new Error(`${command} PNG file identity changed before it was read`);
    }
    if (!Number.isSafeInteger(before.size) || before.size < 0) {
      throw new Error(`${command} could not determine a safe PNG file size`);
    }

    const readLength = Math.min(before.size, maxBytes + 1);
    const contents = Buffer.allocUnsafe(readLength);
    let offset = 0;
    while (offset < contents.byteLength) {
      const bytesRead = readSync(file, contents, offset, contents.byteLength - offset, null);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }

    const after = fstatSync(file);
    const finalPathStatus = lstatSync(filePath);
    if (
      offset !== readLength ||
      after.size !== before.size ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      finalPathStatus.isSymbolicLink() ||
      finalPathStatus.dev !== before.dev ||
      finalPathStatus.ino !== before.ino
    ) {
      throw new Error(`${command} PNG file changed while it was being read`);
    }
    return contents;
  } finally {
    closeSync(file);
  }
}

export function readBoundedUtf8File(
  filePath: string,
  maxBytes: number,
): { content: string; bytes: number } {
  const file = openSync(filePath, "r");
  try {
    const before = fstatSync(file);
    if (!before.isFile()) {
      throw new Error("resourcepack validate-project requires regular local JSON files");
    }
    if (before.size > maxBytes) {
      throw new Error(
        `resourcepack validate-project refuses JSON content larger than the remaining ${maxBytes}-byte project budget`,
      );
    }
    const contents = Buffer.allocUnsafe(before.size);
    let offset = 0;
    while (offset < contents.byteLength) {
      const bytesRead = readSync(file, contents, offset, contents.byteLength - offset, offset);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }
    const after = fstatSync(file);
    if (offset !== before.size || after.size !== before.size) {
      throw new Error("resourcepack validate-project JSON file changed while it was being read");
    }
    return { content: contents.toString("utf8"), bytes: contents.byteLength };
  } finally {
    closeSync(file);
  }
}
