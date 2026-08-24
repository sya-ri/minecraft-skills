import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";

class AccessListFileError extends Error {}

function inputError(message: string): AccessListFileError {
  return new AccessListFileError(message);
}

export function readServerAccessListFile(filePath: string, maxBytes: number): string {
  let file: number;
  try {
    file = openSync(filePath, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch {
    throw inputError("minecraft validate-access-list could not open the input file");
  }

  try {
    const before = fstatSync(file, { bigint: true });
    if (!before.isFile()) {
      throw inputError("minecraft validate-access-list requires a regular local file");
    }
    if (before.size > BigInt(maxBytes)) {
      throw inputError("minecraft validate-access-list input exceeds the fixed byte limit");
    }

    const contents = Buffer.allocUnsafe(Number(before.size));
    let offset = 0;
    while (offset < contents.byteLength) {
      const bytesRead = readSync(file, contents, offset, contents.byteLength - offset, null);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }

    const after = fstatSync(file, { bigint: true });
    if (
      offset !== contents.byteLength ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs
    ) {
      throw inputError("minecraft validate-access-list input changed while it was being read");
    }

    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(contents);
    } catch {
      throw inputError("minecraft validate-access-list input must be valid UTF-8");
    }
  } catch (error) {
    if (error instanceof AccessListFileError) {
      throw error;
    }
    throw inputError("minecraft validate-access-list could not safely read the input file");
  } finally {
    try {
      closeSync(file);
    } catch {
      // Reading has already completed or failed with a path-free diagnostic.
    }
  }
}
