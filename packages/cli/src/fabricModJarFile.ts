import {
  type BigIntStats,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from "node:fs";

type FabricModJarFileIo = {
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

type FabricModJarOpenFlags = {
  readonly: number;
  noFollow: number | undefined;
  nonBlock: number | undefined;
};

/** Test-only filesystem seams; production callers should leave this argument omitted. */
export type FabricModJarFileIoOverrides = Partial<FabricModJarFileIo> & {
  expectedPathSnapshot?: BigIntStats;
  openFlags?: FabricModJarOpenFlags;
};

const defaultFabricModJarFileIo: FabricModJarFileIo = {
  close: closeSync,
  fstat: (handle) => fstatSync(handle, { bigint: true }),
  lstat: (path) => lstatSync(path, { bigint: true, throwIfNoEntry: false }),
  open: openSync,
  read: readSync,
};

const defaultFabricModJarOpenFlags: FabricModJarOpenFlags = {
  readonly: constants.O_RDONLY,
  noFollow: typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : undefined,
  nonBlock: typeof constants.O_NONBLOCK === "number" ? constants.O_NONBLOCK : undefined,
};

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
  io: FabricModJarFileIo,
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

function safeOpenFlags(flags: FabricModJarOpenFlags): number {
  return flags.readonly | (flags.noFollow ?? 0) | (flags.nonBlock ?? 0);
}

/**
 * Reads one stable regular JAR file after enforcing the caller's byte ceiling.
 * An expected snapshot closes the gap between a caller's accounting check and this read.
 */
export function readFabricModJarFile(
  filePath: string,
  maxBytes: number,
  overrides: FabricModJarFileIoOverrides = {},
): Buffer {
  const {
    expectedPathSnapshot,
    openFlags = defaultFabricModJarOpenFlags,
    ...ioOverrides
  } = overrides;
  const io = { ...defaultFabricModJarFileIo, ...ioOverrides };
  let pathBefore: BigIntStats | undefined;
  try {
    pathBefore = io.lstat(filePath);
  } catch {
    pathBefore = undefined;
  }
  if (!pathBefore?.isFile() || pathBefore.isSymbolicLink()) {
    throw new Error("fabric validate-mod requires a regular local .jar file");
  }
  if (expectedPathSnapshot && !sameFileSnapshot(expectedPathSnapshot, pathBefore)) {
    throw new Error("fabric validate-mod archive changed before it could be read");
  }
  if (BigInt(maxBytes) < pathBefore.size) {
    throw new Error(`fabric validate-mod refuses archives larger than ${maxBytes} bytes`);
  }

  let file: number;
  try {
    file = io.open(filePath, safeOpenFlags(openFlags));
  } catch {
    throw new Error("fabric validate-mod could not open the requested JAR file");
  }
  try {
    const descriptorBefore = io.fstat(file);
    if (
      !descriptorBefore.isFile() ||
      !sameFileSnapshot(pathBefore, descriptorBefore) ||
      !pathMatchesSnapshot(filePath, pathBefore, io)
    ) {
      throw new Error("fabric validate-mod archive changed before it could be read");
    }
    if (BigInt(maxBytes) < descriptorBefore.size) {
      throw new Error(`fabric validate-mod refuses archives larger than ${maxBytes} bytes`);
    }

    const contents = Buffer.allocUnsafe(Number(descriptorBefore.size));
    let offset = 0;
    while (offset < contents.byteLength) {
      const remaining = contents.byteLength - offset;
      const bytesRead = io.read(file, contents, offset, remaining, offset);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || remaining < bytesRead) {
        throw new Error("fabric validate-mod received an invalid local file read length");
      }
      if (bytesRead === 0) break;
      offset += bytesRead;
    }

    const descriptorAfter = io.fstat(file);
    if (
      offset !== contents.byteLength ||
      !descriptorAfter.isFile() ||
      !sameFileSnapshot(descriptorBefore, descriptorAfter) ||
      !pathMatchesSnapshot(filePath, pathBefore, io)
    ) {
      throw new Error("fabric validate-mod archive changed while it was being read");
    }
    return contents;
  } finally {
    io.close(file);
  }
}
