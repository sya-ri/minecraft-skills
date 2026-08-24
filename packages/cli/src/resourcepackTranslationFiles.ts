import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  type Stats,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  defaultResourcepackTranslationValidationLimits,
  type ResourcepackTranslationFile,
  type ResourcepackTranslationValidationLimits,
} from "@minecraft-skills/catalog";

type FileIdentity = Pick<Stats, "ctimeMs" | "dev" | "ino" | "mtimeMs" | "size">;

export function sameResourcepackTranslationFileIdentity(
  left: FileIdentity,
  right: FileIdentity,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

function relativeInside(root: string, target: string): string | null {
  const value = relative(root, target);
  if (!value || value === ".." || value.startsWith(`..${sep}`) || isAbsolute(value)) {
    return null;
  }
  return value.replaceAll("\\", "/");
}

function inspectRoot(packRoot: string): { lexical: string; real: string } {
  try {
    const lexical = resolve(packRoot);
    const status = lstatSync(lexical);
    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new Error("invalid root");
    }
    return { lexical, real: realpathSync(lexical) };
  } catch {
    throw new Error("resourcepack validate-translations requires a regular pack root directory");
  }
}

function readTranslationFile(
  inputPath: string,
  inputIndex: number,
  roots: { lexical: string; real: string },
  remainingBytes: number,
  limits: ResourcepackTranslationValidationLimits,
): ResourcepackTranslationFile & { bytes: number } {
  const label = `resourcepack validate-translations input ${inputIndex + 1}`;
  let lexicalPath: string;
  let realPath: string;
  let snapshot: Stats;
  try {
    lexicalPath = resolve(inputPath);
    if (!relativeInside(roots.lexical, lexicalPath)) {
      throw new Error("outside root");
    }
    snapshot = lstatSync(lexicalPath);
    if (snapshot.isSymbolicLink() || !snapshot.isFile()) {
      throw new Error("unsupported file");
    }
    realPath = realpathSync(lexicalPath);
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
  if (!Number.isSafeInteger(snapshot.size) || snapshot.size < 0 || snapshot.size > remainingBytes) {
    throw new Error(`${label} exceeds the remaining translation text byte bound`);
  }

  let handle: number;
  try {
    handle = openSync(realPath, "r");
  } catch {
    throw new Error(`${label} could not be opened safely`);
  }
  try {
    const opened = fstatSync(handle);
    if (!opened.isFile() || !sameResourcepackTranslationFileIdentity(snapshot, opened)) {
      throw new Error(`${label} changed before it was opened`);
    }
    const buffer = Buffer.allocUnsafe(snapshot.size);
    let offset = 0;
    while (offset < buffer.byteLength) {
      const bytesRead = readSync(handle, buffer, offset, buffer.byteLength - offset, null);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }
    const after = fstatSync(handle);
    if (offset !== buffer.byteLength || !sameResourcepackTranslationFileIdentity(opened, after)) {
      throw new Error(`${label} changed while it was being read`);
    }
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
