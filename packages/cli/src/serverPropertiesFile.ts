import {
  type BigIntStats,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from "node:fs";
import { defaultServerPropertiesValidationLimits } from "@minecraft-skills/catalog";

type ServerPropertiesFileIo = {
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

/** Test-only I/O seams; production callers should leave this argument omitted. */
export type ServerPropertiesFileIoOverrides = Partial<ServerPropertiesFileIo>;

const defaultServerPropertiesFileIo: ServerPropertiesFileIo = {
  close: closeSync,
  fstat: (handle) => fstatSync(handle, { bigint: true }),
  lstat: (path) => lstatSync(path, { bigint: true, throwIfNoEntry: false }),
  open: openSync,
  read: readSync,
};

type FileSnapshot = {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly size: bigint;
  readonly ctimeNs: bigint;
  readonly mtimeNs: bigint;
};

function snapshotOf(status: BigIntStats): FileSnapshot {
  return {
    dev: status.dev,
    ino: status.ino,
    size: status.size,
    ctimeNs: status.ctimeNs,
    mtimeNs: status.mtimeNs,
  };
}

function sameSnapshot(status: BigIntStats, snapshot: FileSnapshot): boolean {
  return (
    status.dev === snapshot.dev &&
    status.ino === snapshot.ino &&
    status.size === snapshot.size &&
    status.ctimeNs === snapshot.ctimeNs &&
    status.mtimeNs === snapshot.mtimeNs
  );
}

function safeOpenFlags(): number {
  return (
    constants.O_RDONLY |
    (typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0) |
    (typeof constants.O_NONBLOCK === "number" ? constants.O_NONBLOCK : 0)
  );
}

/** Read one bounded regular server.properties file without following observed links. */
export function readBoundedServerProperties(
  filePath: string,
  overrides: ServerPropertiesFileIoOverrides = {},
): string {
  const io = { ...defaultServerPropertiesFileIo, ...overrides };
  const pathBeforeOpen = io.lstat(filePath);
  if (!pathBeforeOpen || pathBeforeOpen.isSymbolicLink() || !pathBeforeOpen.isFile()) {
    throw new Error("server validate-properties requires a regular, non-symlink local file");
  }
  const expected = snapshotOf(pathBeforeOpen);
  if (BigInt(defaultServerPropertiesValidationLimits.maxInputBytes) < expected.size) {
    throw new Error(
      `server validate-properties refuses files larger than ${defaultServerPropertiesValidationLimits.maxInputBytes} bytes`,
    );
  }

  let file: number;
  try {
    file = io.open(filePath, safeOpenFlags());
  } catch {
    throw new Error("server validate-properties could not safely open a regular local file");
  }
  try {
    const before = io.fstat(file);
    const pathAfterOpen = io.lstat(filePath);
    if (
      !before.isFile() ||
      !sameSnapshot(before, expected) ||
      !pathAfterOpen ||
      pathAfterOpen.isSymbolicLink() ||
      !pathAfterOpen.isFile() ||
      !sameSnapshot(pathAfterOpen, expected)
    ) {
      throw new Error("server validate-properties file identity changed before it could be read");
    }

    const contents = Buffer.allocUnsafe(Number(before.size));
    let offset = 0;
    while (offset < contents.byteLength) {
      const remaining = contents.byteLength - offset;
      const bytesRead = io.read(file, contents, offset, remaining, offset);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || remaining < bytesRead) {
        throw new Error("server validate-properties received an invalid local file read length");
      }
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = io.fstat(file);
    const pathAfterRead = io.lstat(filePath);
    if (
      offset !== contents.byteLength ||
      !sameSnapshot(after, expected) ||
      !pathAfterRead ||
      pathAfterRead.isSymbolicLink() ||
      !pathAfterRead.isFile() ||
      !sameSnapshot(pathAfterRead, expected)
    ) {
      throw new Error("server validate-properties file identity changed while it was being read");
    }
    try {
      // Java's UTF-8 InputStreamReader preserves U+FEFF; TextDecoder strips it unless ignoreBOM is true.
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(contents);
    } catch {
      throw new Error("server validate-properties requires strict UTF-8 input");
    }
  } finally {
    io.close(file);
  }
}
