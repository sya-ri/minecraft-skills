import {
  type BigIntStats,
  closeSync,
  constants,
  type Dir,
  type Dirent,
  fstatSync,
  lstatSync,
  opendirSync,
  openSync,
  readSync,
  type Stats,
} from "node:fs";
import { join, parse, relative, resolve } from "node:path";
import {
  type DatapackProjectValidationLimits,
  defaultDatapackProjectValidationLimits,
} from "@minecraft-skills/catalog";

type ProjectScanLimits = Pick<
  DatapackProjectValidationLimits,
  "maxContentDepth" | "maxFiles" | "maxPathLength" | "maxTextContentCharacters"
>;

type DirectoryEntryKind = "directory" | "file" | "unsupported";
type DirectoryEntry = Pick<
  Dirent,
  | "isBlockDevice"
  | "isCharacterDevice"
  | "isDirectory"
  | "isFIFO"
  | "isFile"
  | "isSocket"
  | "isSymbolicLink"
>;
type FileStatus = Pick<Stats, "isDirectory" | "isFile" | "isSymbolicLink">;

type FileIdentity = {
  readonly dev: bigint;
  readonly ino: bigint;
};

type FileSnapshot = FileIdentity & {
  readonly size: bigint;
  readonly ctimeNs: bigint;
  readonly mtimeNs: bigint;
};

type DirectoryIdentity = FileIdentity & {
  readonly path: string;
};

type DatapackProjectFileIo = {
  close: (handle: number) => void;
  fstat: (handle: number) => BigIntStats;
  lstat: (path: string) => BigIntStats | undefined;
  open: (path: string) => number;
  opendir: (path: string) => Pick<Dir, "closeSync" | "readSync">;
  read: (
    handle: number,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
  ) => number;
};

/** Test-only I/O seams; production callers should leave this argument omitted. */
export type DatapackProjectFileIoOverrides = Partial<DatapackProjectFileIo>;

const defaultDatapackProjectFileIo: DatapackProjectFileIo = {
  close: closeSync,
  fstat: (handle) => fstatSync(handle, { bigint: true }),
  lstat: (path) => lstatSync(path, { bigint: true, throwIfNoEntry: false }),
  open: (path) => openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW),
  opendir: opendirSync,
  read: readSync,
};

export function classifyDatapackProjectEntry(
  entry: DirectoryEntry,
  fullPath: string,
  readStatus: (path: string) => FileStatus = lstatSync,
): DirectoryEntryKind {
  if (entry.isSymbolicLink()) {
    return "unsupported";
  }
  if (entry.isDirectory()) {
    return "directory";
  }
  if (entry.isFile()) {
    return "file";
  }
  if (entry.isBlockDevice() || entry.isCharacterDevice() || entry.isFIFO() || entry.isSocket()) {
    return "unsupported";
  }

  // UV_DIRENT_UNKNOWN reports every Dirent predicate as false. lstat classifies it without
  // following links, so special files never enter the project scan.
  const status = readStatus(fullPath);
  if (status.isSymbolicLink()) {
    return "unsupported";
  }
  if (status.isDirectory()) {
    return "directory";
  }
  return status.isFile() ? "file" : "unsupported";
}

function identityOf(status: BigIntStats): FileIdentity {
  return { dev: status.dev, ino: status.ino };
}

function snapshotOf(status: BigIntStats): FileSnapshot {
  return {
    ...identityOf(status),
    size: status.size,
    ctimeNs: status.ctimeNs,
    mtimeNs: status.mtimeNs,
  };
}

function sameIdentity(status: BigIntStats, identity: FileIdentity): boolean {
  return status.dev === identity.dev && status.ino === identity.ino;
}

function sameSnapshot(status: BigIntStats, snapshot: FileSnapshot): boolean {
  return (
    sameIdentity(status, snapshot) &&
    status.size === snapshot.size &&
    status.ctimeNs === snapshot.ctimeNs &&
    status.mtimeNs === snapshot.mtimeNs
  );
}

function captureDirectoryChain(directory: string, io: DatapackProjectFileIo): DirectoryIdentity[] {
  const root = parse(directory).root;
  const segments = relative(root, directory)
    .split(/[\\/]+/u)
    .filter(Boolean);
  const chain: DirectoryIdentity[] = [];
  let current = root;
  const rootStatus = io.lstat(current);
  if (!rootStatus || rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) {
    throw new Error(
      "datapack validate-project refuses symbolic links or non-directory components in its root path",
    );
  }
  chain.push({ path: current, ...identityOf(rootStatus) });
  for (const segment of segments) {
    current = join(current, segment);
    const status = io.lstat(current);
    if (!status || status.isSymbolicLink() || !status.isDirectory()) {
      throw new Error(
        "datapack validate-project refuses symbolic links or non-directory components in its root path",
      );
    }
    chain.push({ path: current, ...identityOf(status) });
  }
  return chain;
}

function ensureDirectoryChainUnchanged(
  chain: readonly DirectoryIdentity[],
  io: DatapackProjectFileIo,
): void {
  for (const identity of chain) {
    const status = io.lstat(identity.path);
    if (
      !status ||
      status.isSymbolicLink() ||
      !status.isDirectory() ||
      !sameIdentity(status, identity)
    ) {
      throw new Error("datapack validate-project directory identity changed during traversal");
    }
  }
}

function readBoundedUtf8File(
  filePath: string,
  maxBytes: number,
  expected: FileSnapshot,
  io: DatapackProjectFileIo,
): {
  content: string;
  bytes: number;
} {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error("datapack validate-project received an invalid remaining text budget");
  }
  const pathBeforeOpen = io.lstat(filePath);
  if (
    !pathBeforeOpen ||
    pathBeforeOpen.isSymbolicLink() ||
    !pathBeforeOpen.isFile() ||
    !sameSnapshot(pathBeforeOpen, expected)
  ) {
    throw new Error("datapack validate-project input identity changed before it was read");
  }
  let file: number;
  try {
    file = io.open(filePath);
  } catch {
    throw new Error("datapack validate-project could not safely open a regular local text file");
  }
  try {
    const before = io.fstat(file);
    const linkedAfterOpen = io.lstat(filePath);
    if (
      !before.isFile() ||
      !sameSnapshot(before, expected) ||
      !linkedAfterOpen ||
      linkedAfterOpen.isSymbolicLink() ||
      !linkedAfterOpen.isFile() ||
      !sameSnapshot(linkedAfterOpen, expected)
    ) {
      throw new Error("datapack validate-project input identity changed before it was read");
    }
    if (before.size > BigInt(maxBytes)) {
      throw new Error(
        `datapack validate-project refuses text content larger than the remaining ${maxBytes}-byte project budget`,
      );
    }
    const contents = Buffer.allocUnsafe(Number(before.size));
    let offset = 0;
    while (offset < contents.byteLength) {
      const remaining = contents.byteLength - offset;
      const bytesRead = io.read(file, contents, offset, remaining, offset);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > remaining) {
        throw new Error("datapack validate-project received an invalid local file read length");
      }
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }
    const after = io.fstat(file);
    const linkedAfterRead = io.lstat(filePath);
    if (
      offset !== contents.byteLength ||
      !sameSnapshot(after, expected) ||
      !linkedAfterRead ||
      linkedAfterRead.isSymbolicLink() ||
      !linkedAfterRead.isFile() ||
      !sameSnapshot(linkedAfterRead, expected)
    ) {
      throw new Error("datapack validate-project input changed while it was being read");
    }
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(contents);
    } catch {
      throw new Error("datapack validate-project requires valid UTF-8 JSON and mcfunction text");
    }
    return { content, bytes: contents.byteLength };
  } finally {
    io.close(file);
  }
}

export function readDatapackProjectFiles(
  root: string,
  limits: ProjectScanLimits = defaultDatapackProjectValidationLimits,
  overrides: DatapackProjectFileIoOverrides = {},
): Array<{ path: string; content?: string }> {
  const io = { ...defaultDatapackProjectFileIo, ...overrides };
  const resolvedRoot = resolve(root);
  const rootChain = captureDirectoryChain(resolvedRoot, io);

  const files: Array<{ path: string; content?: string }> = [];
  const pendingDirectories: Array<{
    chain: readonly DirectoryIdentity[];
    depth: number;
    path: string;
  }> = [{ chain: rootChain, depth: 0, path: resolvedRoot }];
  let directoryCount = 1;
  let entryCount = 0;
  let textBytes = 0;

  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop();
    if (!directory) {
      continue;
    }
    if (directory.depth > limits.maxContentDepth) {
      throw new Error(
        `datapack validate-project refuses directory depth above ${limits.maxContentDepth}`,
      );
    }

    ensureDirectoryChainUnchanged(directory.chain, io);
    const entries: Dirent[] = [];
    const handle = io.opendir(directory.path);
    try {
      ensureDirectoryChainUnchanged(directory.chain, io);
      let entry = handle.readSync();
      while (entry) {
        entryCount += 1;
        if (entryCount > limits.maxFiles * 2) {
          throw new Error(
            `datapack validate-project refuses projects with more than ${limits.maxFiles * 2} directory entries`,
          );
        }
        entries.push(entry);
        entry = handle.readSync();
      }
      ensureDirectoryChainUnchanged(directory.chain, io);
    } finally {
      handle.closeSync();
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));

    const childDirectories: Array<{
      chain: readonly DirectoryIdentity[];
      depth: number;
      path: string;
    }> = [];
    for (const entry of entries) {
      const fullPath = join(directory.path, entry.name);
      const path = relative(resolvedRoot, fullPath).replaceAll("\\", "/");
      if (path.length > limits.maxPathLength) {
        throw new Error(
          `datapack validate-project refuses paths longer than ${limits.maxPathLength} characters`,
        );
      }
      const entryKind = classifyDatapackProjectEntry(entry, fullPath);
      if (entryKind === "unsupported") {
        throw new Error(
          `datapack validate-project refuses symbolic links, devices, sockets, and other special entries: ${path}`,
        );
      }
      const status = io.lstat(fullPath);
      if (
        !status ||
        status.isSymbolicLink() ||
        (entryKind === "directory" ? !status.isDirectory() : !status.isFile())
      ) {
        throw new Error(
          `datapack validate-project input identity changed during traversal: ${path}`,
        );
      }
      if (entryKind === "directory") {
        directoryCount += 1;
        if (directoryCount > limits.maxFiles) {
          throw new Error(
            `datapack validate-project refuses projects with more than ${limits.maxFiles} directories`,
          );
        }
        childDirectories.push({
          chain: [...directory.chain, { path: fullPath, ...identityOf(status) }],
          depth: directory.depth + 1,
          path: fullPath,
        });
        continue;
      }
      if (files.length >= limits.maxFiles) {
        throw new Error(
          `datapack validate-project refuses projects with more than ${limits.maxFiles} files`,
        );
      }

      let content: string | undefined;
      if (/\.(?:json|mcmeta|mcfunction)$/i.test(path)) {
        const read = readBoundedUtf8File(
          fullPath,
          limits.maxTextContentCharacters - textBytes,
          snapshotOf(status),
          io,
        );
        textBytes += read.bytes;
        content = read.content;
      }
      files.push({ path, ...(content === undefined ? {} : { content }) });
    }
    ensureDirectoryChainUnchanged(directory.chain, io);
    for (let index = childDirectories.length - 1; index >= 0; index -= 1) {
      const child = childDirectories[index];
      if (child) {
        pendingDirectories.push(child);
      }
    }
  }
  return files;
}
