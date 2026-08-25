import {
  type BigIntStats,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from "node:fs";
import { mixinConfigValidationLimits } from "@minecraft-skills/catalog";

class MixinConfigFileError extends Error {}

type MixinConfigFileIo = {
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

type MixinConfigFileOpenFlags = {
  readonly: number;
  noFollow: number | undefined;
  nonBlock: number | undefined;
};

/** Test-only filesystem seams; production callers should leave this argument omitted. */
export type MixinConfigFileIoOverrides = Partial<MixinConfigFileIo> & {
  openFlags?: MixinConfigFileOpenFlags;
};

const defaultMixinConfigFileIo: MixinConfigFileIo = {
  close: closeSync,
  fstat: (handle) => fstatSync(handle, { bigint: true }),
  lstat: (path) => lstatSync(path, { bigint: true, throwIfNoEntry: false }),
  open: openSync,
  read: readSync,
};

const defaultMixinConfigFileOpenFlags: MixinConfigFileOpenFlags = {
  readonly: constants.O_RDONLY,
  noFollow: typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : undefined,
  nonBlock: typeof constants.O_NONBLOCK === "number" ? constants.O_NONBLOCK : undefined,
};

function fail(message: string): never {
  throw new MixinConfigFileError(message);
}

function hasStableIdentity(left: BigIntStats, right: BigIntStats): boolean {
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
  io: MixinConfigFileIo,
): boolean {
  try {
    const current = io.lstat(filePath);
    return Boolean(
      current?.isFile() && !current.isSymbolicLink() && hasStableIdentity(snapshot, current),
    );
  } catch {
    return false;
  }
}

function safeOpenFlags(flags: MixinConfigFileOpenFlags): number {
  return flags.readonly | (flags.noFollow ?? 0) | (flags.nonBlock ?? 0);
}

function closeSafely(descriptor: number, io: MixinConfigFileIo): void {
  try {
    io.close(descriptor);
  } catch {
    // A path-free read result or diagnostic has already been selected.
  }
}

function readStableRegularUtf8File(
  filePath: string,
  label: string,
  maxBytes: number,
  overrides: MixinConfigFileIoOverrides,
): string {
  const { openFlags = defaultMixinConfigFileOpenFlags, ...ioOverrides } = overrides;
  const io = { ...defaultMixinConfigFileIo, ...ioOverrides };

  let pathBefore: BigIntStats | undefined;
  try {
    pathBefore = io.lstat(filePath);
  } catch {
    fail(`${label} could not be inspected as a stable regular file.`);
  }
  if (!pathBefore?.isFile() || pathBefore.isSymbolicLink()) {
    fail(`${label} must be a regular non-symbolic-link file.`);
  }
  if (pathBefore.size > BigInt(maxBytes)) {
    fail(`${label} exceeds its fixed byte limit.`);
  }

  let descriptor: number;
  try {
    descriptor = io.open(filePath, safeOpenFlags(openFlags));
  } catch {
    fail(`${label} could not be opened as a stable regular file.`);
  }

  try {
    const opened = io.fstat(descriptor);
    if (
      !opened.isFile() ||
      !hasStableIdentity(pathBefore, opened) ||
      !pathMatchesSnapshot(filePath, pathBefore, io)
    ) {
      fail(`${label} changed identity while it was being opened.`);
    }

    const contents = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < contents.byteLength) {
      const remaining = contents.byteLength - offset;
      const bytesRead = io.read(descriptor, contents, offset, remaining, offset);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > remaining) {
        fail(`${label} returned an invalid bounded read length.`);
      }
      if (bytesRead === 0) break;
      offset += bytesRead;
    }

    const after = io.fstat(descriptor);
    if (
      offset !== contents.byteLength ||
      !after.isFile() ||
      !hasStableIdentity(opened, after) ||
      !pathMatchesSnapshot(filePath, pathBefore, io)
    ) {
      fail(`${label} changed while it was being read.`);
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(contents);
    } catch {
      fail(`${label} must contain valid UTF-8 text.`);
    }
  } catch (error) {
    if (error instanceof MixinConfigFileError) throw error;
    fail(`${label} could not be read as a stable regular file.`);
  } finally {
    closeSafely(descriptor, io);
  }
}

export function readMixinConfigCliFiles(
  options: {
    configPath: string;
    archiveEntriesPath?: string;
  },
  overrides: MixinConfigFileIoOverrides = {},
): { config: string; archiveEntries?: unknown } {
  const config = readStableRegularUtf8File(
    options.configPath,
    "Mixin configuration",
    mixinConfigValidationLimits.maxConfigBytes,
    overrides,
  );
  if (!options.archiveEntriesPath) return { config };

  const archiveEntryText = readStableRegularUtf8File(
    options.archiveEntriesPath,
    "Archive-entry metadata",
    mixinConfigValidationLimits.maxArchiveEntryMetadataBytes,
    overrides,
  );
  try {
    return { config, archiveEntries: JSON.parse(archiveEntryText) as unknown };
  } catch {
    fail("Archive-entry metadata must contain valid JSON.");
  }
}
