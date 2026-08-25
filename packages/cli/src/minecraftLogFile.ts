import {
  type BigIntStats,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from "node:fs";

type MinecraftLogFileIo = {
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
  realpath: (path: string) => string;
};

type MinecraftLogOpenFlags = {
  readonly: number;
  noFollow: number | undefined;
  nonBlock: number | undefined;
};

/** Test-only filesystem seams; production callers should leave this argument omitted. */
export type MinecraftLogFileIoOverrides = Partial<MinecraftLogFileIo> & {
  openFlags?: MinecraftLogOpenFlags;
};

const defaultMinecraftLogFileIo: MinecraftLogFileIo = {
  close: closeSync,
  fstat: (handle) => fstatSync(handle, { bigint: true }),
  lstat: (path) => lstatSync(path, { bigint: true, throwIfNoEntry: false }),
  open: openSync,
  read: readSync,
  realpath: realpathSync,
};

const defaultMinecraftLogOpenFlags: MinecraftLogOpenFlags = {
  readonly: constants.O_RDONLY,
  noFollow: typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : undefined,
  nonBlock: typeof constants.O_NONBLOCK === "number" ? constants.O_NONBLOCK : undefined,
};

type FileSnapshot = {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly size: bigint;
  readonly ctimeNs: bigint;
  readonly mtimeNs: bigint;
};

type DirectFilePlan = {
  readonly kind: "direct";
  readonly openPath: string;
  readonly target: FileSnapshot;
};

type SymlinkFilePlan = {
  readonly kind: "symlink";
  readonly openPath: string;
  readonly resolvedPath: string;
  readonly link: FileSnapshot;
  readonly target: FileSnapshot;
};

type FilePlan = DirectFilePlan | SymlinkFilePlan;

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

function classifyFile(filePath: string, io: MinecraftLogFileIo): FilePlan {
  let pathStatus: BigIntStats | undefined;
  try {
    pathStatus = io.lstat(filePath);
  } catch {
    pathStatus = undefined;
  }
  if (!pathStatus) {
    throw new Error("minecraft analyze-log could not open the requested file");
  }
  if (pathStatus.isFile()) {
    return { kind: "direct", openPath: filePath, target: snapshotOf(pathStatus) };
  }
  if (!pathStatus.isSymbolicLink()) {
    throw new Error(
      "minecraft analyze-log requires a regular file or a symlink whose target is a regular file",
    );
  }

  let resolvedPath: string;
  let targetStatus: BigIntStats | undefined;
  try {
    resolvedPath = io.realpath(filePath);
    targetStatus = io.lstat(resolvedPath);
  } catch {
    throw new Error("minecraft analyze-log could not open the requested file");
  }
  if (!targetStatus?.isFile()) {
    throw new Error(
      "minecraft analyze-log requires a regular file or a symlink whose target is a regular file",
    );
  }
  return {
    kind: "symlink",
    openPath: resolvedPath,
    resolvedPath,
    link: snapshotOf(pathStatus),
    target: snapshotOf(targetStatus),
  };
}

function pathMatchesPlan(filePath: string, plan: FilePlan, io: MinecraftLogFileIo): boolean {
  try {
    const pathStatus = io.lstat(filePath);
    if (plan.kind === "direct") {
      return Boolean(
        pathStatus?.isFile() &&
          !pathStatus.isSymbolicLink() &&
          sameSnapshot(pathStatus, plan.target),
      );
    }
    if (
      !pathStatus?.isSymbolicLink() ||
      !sameSnapshot(pathStatus, plan.link) ||
      io.realpath(filePath) !== plan.resolvedPath
    ) {
      return false;
    }
    const targetStatus = io.lstat(plan.resolvedPath);
    return Boolean(targetStatus?.isFile() && sameSnapshot(targetStatus, plan.target));
  } catch {
    return false;
  }
}

function safeOpenFlags(flags: MinecraftLogOpenFlags): number {
  return flags.readonly | (flags.noFollow ?? 0) | (flags.nonBlock ?? 0);
}

/** Read one bounded local log while binding the handle to its preclassified regular-file identity. */
export function readBoundedMinecraftLog(
  filePath: string,
  maxBytes: number,
  overrides: MinecraftLogFileIoOverrides = {},
): string {
  const { openFlags = defaultMinecraftLogOpenFlags, ...ioOverrides } = overrides;
  const io = { ...defaultMinecraftLogFileIo, ...ioOverrides };
  const plan = classifyFile(filePath, io);
  if (BigInt(maxBytes) < plan.target.size) {
    throw new Error(`minecraft analyze-log refuses files larger than ${maxBytes} bytes`);
  }

  let file: number;
  try {
    file = io.open(plan.openPath, safeOpenFlags(openFlags));
  } catch {
    throw new Error("minecraft analyze-log could not open the requested file");
  }
  try {
    const before = io.fstat(file);
    if (
      !before.isFile() ||
      !sameSnapshot(before, plan.target) ||
      !pathMatchesPlan(filePath, plan, io)
    ) {
      throw new Error("minecraft analyze-log file identity changed before it could be read");
    }

    const contents = Buffer.allocUnsafe(Number(before.size));
    let offset = 0;
    while (offset < contents.byteLength) {
      const remaining = contents.byteLength - offset;
      const bytesRead = io.read(file, contents, offset, remaining, offset);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || remaining < bytesRead) {
        throw new Error("minecraft analyze-log received an invalid local file read length");
      }
      if (bytesRead === 0) break;
      offset += bytesRead;
    }

    const after = io.fstat(file);
    if (
      offset !== contents.byteLength ||
      !after.isFile() ||
      !sameSnapshot(after, plan.target) ||
      !pathMatchesPlan(filePath, plan, io)
    ) {
      throw new Error("minecraft analyze-log file identity changed while it was being read");
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(contents);
    } catch {
      throw new Error("minecraft analyze-log requires valid UTF-8 input");
    }
  } finally {
    io.close(file);
  }
}
