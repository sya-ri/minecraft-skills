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
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  defaultResourcepackTranslationValidationLimits,
  type ResourcepackTranslationFile,
  type ResourcepackTranslationValidationLimits,
} from "@minecraft-skills/catalog";

type FileIdentity = Pick<
  BigIntStats,
  "ctimeNs" | "dev" | "ino" | "mode" | "mtimeNs" | "nlink" | "size"
>;

export function sameResourcepackTranslationFileIdentity(
  left: FileIdentity,
  right: FileIdentity,
): boolean {
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

function relativeInside(root: string, target: string): string | null {
  const value = relative(root, target);
  if (!value || value === ".." || value.startsWith(`..${sep}`) || isAbsolute(value)) {
    return null;
  }
  return value.replaceAll("\\", "/");
}

type InspectedRoot = {
  lexical: string;
  real: string;
  snapshot: BigIntStats;
};

function stableDirectory(path: string, snapshot: BigIntStats): boolean {
  try {
    const current = lstatSync(path, { bigint: true });
    return (
      current.isDirectory() &&
      !current.isSymbolicLink() &&
      sameResourcepackTranslationFileIdentity(snapshot, current)
    );
  } catch {
    return false;
  }
}

function inspectRoot(packRoot: string): InspectedRoot {
  try {
    const lexical = resolve(packRoot);
    const status = lstatSync(lexical, { bigint: true });
    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new Error("invalid root");
    }
    const real = realpathSync(lexical);
    if (!stableDirectory(lexical, status) || !stableDirectory(real, status)) {
      throw new Error("unstable root");
    }
    return { lexical, real, snapshot: status };
  } catch {
    throw new Error("resourcepack validate-translations requires a regular pack root directory");
  }
}

function requireStableRoot(root: InspectedRoot, label: string): void {
  if (!stableDirectory(root.lexical, root.snapshot) || !stableDirectory(root.real, root.snapshot)) {
    throw new Error(`${label} pack root changed while inputs were being read`);
  }
}

function stableRegularFile(path: string, snapshot: BigIntStats): boolean {
  try {
    const current = lstatSync(path, { bigint: true });
    return (
      current.isFile() &&
      !current.isSymbolicLink() &&
      sameResourcepackTranslationFileIdentity(snapshot, current)
    );
  } catch {
    return false;
  }
}

function readTranslationFile(
  inputPath: string,
  inputIndex: number,
  roots: InspectedRoot,
  remainingBytes: number,
  limits: ResourcepackTranslationValidationLimits,
): ResourcepackTranslationFile & { bytes: number } {
  const label = `resourcepack validate-translations input ${inputIndex + 1}`;
  let lexicalPath: string;
  let realPath: string;
  let snapshot: BigIntStats;
  try {
    requireStableRoot(roots, label);
    lexicalPath = resolve(inputPath);
    if (!relativeInside(roots.lexical, lexicalPath)) {
      throw new Error("outside root");
    }
    snapshot = lstatSync(lexicalPath, { bigint: true });
    if (snapshot.isSymbolicLink() || !snapshot.isFile()) {
      throw new Error("unsupported file");
    }
    realPath = realpathSync(lexicalPath);
    if (!stableRegularFile(lexicalPath, snapshot) || !stableRegularFile(realPath, snapshot)) {
      throw new Error("unstable file");
    }
  } catch {
    throw new Error(`${label} must be a regular file inside the pack root`);
  }
  const packPath = relativeInside(roots.real, realPath);
  if (!packPath) {
    throw new Error(`${label} resolves outside the pack root`);
  }
  if (packPath.length > limits.maxPathLength) {
    throw new Error(`${label} pack-relative path exceeds the configured bound`);
  }
  if (snapshot.size < 0n || snapshot.size > BigInt(remainingBytes)) {
    throw new Error(`${label} exceeds the remaining translation text byte bound`);
  }

  let handle: number;
  try {
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    const nonBlock = typeof constants.O_NONBLOCK === "number" ? constants.O_NONBLOCK : 0;
    handle = openSync(realPath, constants.O_RDONLY | noFollow | nonBlock);
  } catch {
    throw new Error(`${label} could not be opened safely`);
  }
  try {
    const opened = fstatSync(handle, { bigint: true });
    if (
      !opened.isFile() ||
      !sameResourcepackTranslationFileIdentity(snapshot, opened) ||
      !stableRegularFile(lexicalPath, snapshot) ||
      !stableRegularFile(realPath, snapshot)
    ) {
      throw new Error(`${label} changed before it was opened`);
    }
    const buffer = Buffer.allocUnsafe(Number(snapshot.size));
    let offset = 0;
    while (offset < buffer.byteLength) {
      const remaining = buffer.byteLength - offset;
      const bytesRead = readSync(handle, buffer, offset, remaining, offset);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || remaining < bytesRead) {
        throw new Error(`${label} returned an invalid local file read length`);
      }
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }
    const after = fstatSync(handle, { bigint: true });
    if (
      offset !== buffer.byteLength ||
      !after.isFile() ||
      !sameResourcepackTranslationFileIdentity(opened, after) ||
      !stableRegularFile(lexicalPath, snapshot) ||
      !stableRegularFile(realPath, snapshot)
    ) {
      throw new Error(`${label} changed while it was being read`);
    }
    requireStableRoot(roots, label);
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new Error(`${label} is not valid UTF-8`);
    }
    if (content.length > limits.maxTextCharactersPerFile) {
      throw new Error(`${label} exceeds the translation text character bound`);
    }
    return { path: packPath, content, bytes: buffer.byteLength };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(label)) {
      throw error;
    }
    throw new Error(`${label} could not be read safely`);
  } finally {
    closeSync(handle);
  }
}

export function readResourcepackTranslationFiles(
  packRoot: string,
  inputPaths: readonly string[],
  limits: ResourcepackTranslationValidationLimits = defaultResourcepackTranslationValidationLimits,
): ResourcepackTranslationFile[] {
  if (inputPaths.length === 0 || inputPaths.length > limits.maxFiles) {
    throw new Error(
      `resourcepack validate-translations requires 1..${limits.maxFiles} explicit files`,
    );
  }
  const roots = inspectRoot(packRoot);
  const files: ResourcepackTranslationFile[] = [];
  let totalBytes = 0;
  for (let index = 0; index < inputPaths.length; index += 1) {
    const inputPath = inputPaths[index];
    if (!inputPath) {
      throw new Error(`resourcepack validate-translations input ${index + 1} is empty`);
    }
    const file = readTranslationFile(
      inputPath,
      index,
      roots,
      limits.maxTextBytesTotal - totalBytes,
      limits,
    );
    totalBytes += file.bytes;
    files.push({ path: file.path, content: file.content });
  }
  return files;
}
