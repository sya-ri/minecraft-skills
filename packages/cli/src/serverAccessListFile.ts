import {
  type BigIntStats,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from "node:fs";

class AccessListFileError extends Error {}

type ServerAccessListFileIo = {
  close: (handle: number) => void;
  fstat: (handle: number) => BigIntStats;
  lstat: (path: string) => BigIntStats | undefined;
  open: (path: string, flags: number) => number;
  read: (
    handle: number,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
  ) => number;
};

type ServerAccessListFileOpenFlags = {
  readonly: number;
  noFollow: number | undefined;
  nonBlock: number | undefined;
};

/** Test-only filesystem seams; production callers should leave this argument omitted. */
export type ServerAccessListFileIoOverrides = Partial<ServerAccessListFileIo> & {
  openFlags?: ServerAccessListFileOpenFlags;
};

const defaultServerAccessListFileIo: ServerAccessListFileIo = {
  close: closeSync,
  fstat: (handle) => fstatSync(handle, { bigint: true }),
  lstat: (path) => lstatSync(path, { bigint: true, throwIfNoEntry: false }),
  open: openSync,
  read: readSync,
};

const defaultServerAccessListFileOpenFlags: ServerAccessListFileOpenFlags = {
  readonly: constants.O_RDONLY,
  noFollow: typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : undefined,
  nonBlock: typeof constants.O_NONBLOCK === "number" ? constants.O_NONBLOCK : undefined,
};

function inputError(message: string): AccessListFileError {
  return new AccessListFileError(message);
}

function sameFileSnapshot(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function pathMatchesSnapshot(
  filePath: string,
  snapshot: BigIntStats,
  io: ServerAccessListFileIo,
): boolean {
  try {
    const status = io.lstat(filePath);
    return Boolean(
      status?.isFile() && !status.isSymbolicLink() && sameFileSnapshot(status, snapshot),
    );
  } catch {
    return false;
  }
}

function safeOpenFlags(flags: ServerAccessListFileOpenFlags): number {
  return flags.readonly | (flags.noFollow ?? 0) | (flags.nonBlock ?? 0);
}

function closeSafely(file: number, io: ServerAccessListFileIo): void {
  try {
    io.close(file);
  } catch {
    // Reading has already completed or failed with a path-free diagnostic.
  }
}

/** Reads one stable, bounded, non-symlink regular access-list file as strict UTF-8. */
export function readServerAccessListFile(
  filePath: string,
  maxBytes: number,
  overrides: ServerAccessListFileIoOverrides = {},
): string {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw inputError("minecraft validate-access-list requires a safe positive byte limit");
  }

  const { openFlags = defaultServerAccessListFileOpenFlags, ...ioOverrides } = overrides;
  const io = { ...defaultServerAccessListFileIo, ...ioOverrides };
  let pathBefore: BigIntStats | undefined;
  try {
    pathBefore = io.lstat(filePath);
  } catch {
    throw inputError("minecraft validate-access-list could not inspect the input file safely");
  }
  if (!pathBefore?.isFile() || pathBefore.isSymbolicLink()) {
    throw inputError(
      "minecraft validate-access-list requires a regular local file that is not a symlink",
    );
  }
  if (pathBefore.size > BigInt(maxBytes)) {
    throw inputError("minecraft validate-access-list input exceeds the fixed byte limit");
  }

  let file: number;
  try {
    file = io.open(filePath, safeOpenFlags(openFlags));
  } catch {
    throw inputError("minecraft validate-access-list could not open the input file safely");
  }

  try {
    const descriptorBefore = io.fstat(file);
    if (
      !descriptorBefore.isFile() ||
      !sameFileSnapshot(pathBefore, descriptorBefore) ||
      !pathMatchesSnapshot(filePath, pathBefore, io)
    ) {
      throw inputError("minecraft validate-access-list input changed before it could be read");
    }
    if (descriptorBefore.size > BigInt(maxBytes)) {
      throw inputError("minecraft validate-access-list input exceeds the fixed byte limit");
    }

    const contents = Buffer.allocUnsafe(Number(descriptorBefore.size));
    let offset = 0;
    while (offset < contents.byteLength) {
      const remaining = contents.byteLength - offset;
      const bytesRead = io.read(file, contents, offset, remaining, offset);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || remaining < bytesRead) {
        throw inputError(
          "minecraft validate-access-list received an invalid local file read length",
        );
      }
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }

    const descriptorAfter = io.fstat(file);
    if (
      offset !== contents.byteLength ||
      !descriptorAfter.isFile() ||
      !sameFileSnapshot(descriptorBefore, descriptorAfter) ||
      !pathMatchesSnapshot(filePath, pathBefore, io)
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
    closeSafely(file, io);
  }
}
