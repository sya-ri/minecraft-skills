import {
  type BigIntStats,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, extname, join, parse, relative, resolve } from "node:path";

type OutputFileIo = {
  close: (handle: number) => void;
  fstat: (handle: number) => BigIntStats;
  fsync: (handle: number) => void;
  lstat: (path: string) => BigIntStats | undefined;
  openExclusive: (path: string) => number;
  unlink: (path: string) => void;
  write: (handle: number, bytes: Uint8Array, offset: number, length: number) => number;
};

/** Test-only I/O seams; production callers should leave this argument omitted. */
export type PlayerTextureOutputIoOverrides = Partial<OutputFileIo>;

type FileIdentity = {
  readonly dev: bigint;
  readonly ino: bigint;
};

const playerTextureOutputTargetBrand: unique symbol = Symbol("playerTextureOutputTarget");

/** Opaque output target whose parent identities were captured before the texture download. */
export type PlayerTextureOutputTarget = {
  readonly [playerTextureOutputTargetBrand]: true;
  readonly path: string;
  readonly directory: string;
  readonly directoryIdentities: readonly FileIdentity[];
};

const defaultOutputFileIo: OutputFileIo = {
  close: closeSync,
  fstat: (handle) => fstatSync(handle, { bigint: true }),
  fsync: fsyncSync,
  lstat: (path) => lstatSync(path, { bigint: true, throwIfNoEntry: false }),
  openExclusive: (path) =>
    openSync(
      path,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    ),
  unlink: unlinkSync,
  write: (handle, bytes, offset, length) => writeSync(handle, bytes, offset, length, null),
};

function identityOf(status: BigIntStats): FileIdentity {
  return Object.freeze({ dev: status.dev, ino: status.ino });
}

function sameIdentity(status: BigIntStats, identity: FileIdentity): boolean {
  return status.dev === identity.dev && status.ino === identity.ino;
}

function existingDirectoryChain(directory: string, io: OutputFileIo): FileIdentity[] {
  const root = parse(directory).root;
  const segments = relative(root, directory)
    .split(/[\\/]+/u)
    .filter(Boolean);
  const identities: FileIdentity[] = [];
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    const status = io.lstat(current);
    if (!status) {
      throw new Error("player-texture download requires an existing output parent directory");
    }
    if (status.isSymbolicLink()) {
      throw new Error(
        "player-texture download refuses symbolic links or reparse points in the output path",
      );
    }
    if (!status.isDirectory()) {
      throw new Error("player-texture download requires an ordinary output parent directory");
    }
    identities.push(identityOf(status));
  }
  return identities;
}

function ensureDirectoryChainUnchanged(
  directory: string,
  before: readonly FileIdentity[],
  io: OutputFileIo,
): void {
  const after = existingDirectoryChain(directory, io);
  if (
    after.length !== before.length ||
    after.some((identity, index) => {
      const previous = before[index];
      return !previous || identity.dev !== previous.dev || identity.ino !== previous.ino;
    })
  ) {
    throw new Error("player-texture download output parent changed during file creation");
  }
}

function resolvedNewPngPath(outputPath: string, io: OutputFileIo): PlayerTextureOutputTarget {
  if (!outputPath || outputPath.includes("\0") || extname(outputPath) !== ".png") {
    throw new Error("player-texture download --output must be a new file ending exactly in .png");
  }
  const path = resolve(outputPath);
  const directory = dirname(path);
  const directoryIdentities = existingDirectoryChain(directory, io);
  if (io.lstat(path)) {
    throw new Error(
      "player-texture download refuses an existing output path, including links and special files",
    );
  }
  return Object.freeze({
    [playerTextureOutputTargetBrand]: true as const,
    path,
    directory,
    directoryIdentities: Object.freeze(directoryIdentities),
  });
}

/** Captures a validated new PNG target and its parent identities before any network request. */
export function validateNewPlayerTexturePngPath(
  outputPath: string,
  overrides: PlayerTextureOutputIoOverrides = {},
): PlayerTextureOutputTarget {
  return resolvedNewPngPath(outputPath, { ...defaultOutputFileIo, ...overrides });
}

/** Writes bounded PNG bytes only when the preflight target and its parent identities remain valid. */
export function writeNewPlayerTexturePng(
  target: PlayerTextureOutputTarget,
  bytes: Uint8Array,
  overrides: PlayerTextureOutputIoOverrides = {},
): void {
  const io = { ...defaultOutputFileIo, ...overrides };
  let handle: number | null = null;
  let createdIdentity: FileIdentity | null = null;
  try {
    ensureDirectoryChainUnchanged(target.directory, target.directoryIdentities, io);
    if (io.lstat(target.path)) {
      throw new Error(
        "player-texture download refuses an existing output path, including links and special files",
      );
    }
    handle = io.openExclusive(target.path);
    const opened = io.fstat(handle);
    if (!opened.isFile()) {
      throw new Error("player-texture download output handle is not a regular file");
    }
    createdIdentity = identityOf(opened);
    const linked = io.lstat(target.path);
    if (!linked?.isFile() || !sameIdentity(linked, createdIdentity)) {
      throw new Error("player-texture download output path changed during exclusive creation");
    }
    ensureDirectoryChainUnchanged(target.directory, target.directoryIdentities, io);

    let offset = 0;
    while (offset < bytes.byteLength) {
      const written = io.write(handle, bytes, offset, bytes.byteLength - offset);
      if (!Number.isSafeInteger(written) || written <= 0 || bytes.byteLength - offset < written) {
        throw new Error("player-texture download could not complete the bounded output write");
      }
      offset += written;
    }
    io.fsync(handle);

    const completed = io.fstat(handle);
    const finalPath = io.lstat(target.path);
    if (
      !completed.isFile() ||
      completed.size !== BigInt(bytes.byteLength) ||
      !sameIdentity(completed, createdIdentity) ||
      !finalPath ||
      !finalPath.isFile() ||
      !sameIdentity(finalPath, createdIdentity)
    ) {
      throw new Error("player-texture download could not verify the completed output file");
    }
    ensureDirectoryChainUnchanged(target.directory, target.directoryIdentities, io);
    io.close(handle);
    handle = null;
  } catch (error) {
    if (handle !== null) {
      try {
        io.close(handle);
      } catch {
        // Cleanup below remains identity-gated if closing the created handle fails.
      }
      handle = null;
    }
    if (createdIdentity) {
      try {
        const current = io.lstat(target.path);
        if (current?.isFile() && sameIdentity(current, createdIdentity)) {
          io.unlink(target.path);
        }
      } catch {
        // Never unlink an unverified path merely because cleanup encountered another failure.
      }
    }
    if (error instanceof Error && error.message.startsWith("player-texture download")) {
      throw error;
    }
    throw new Error("player-texture download could not safely create the new output file");
  }
}
