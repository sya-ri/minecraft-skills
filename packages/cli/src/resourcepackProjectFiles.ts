import { type Dirent, lstatSync, opendirSync, type Stats } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  defaultResourcepackPngValidationLimits,
  defaultResourcepackProjectValidationLimits,
  type ResourcepackPngValidationLimits,
  type ResourcepackProjectValidationLimits,
  vorbisIdentificationPageBytes,
} from "@minecraft-skills/catalog";
import { readBoundedPngFile, readBoundedUtf8File, readFilePrefix } from "./filePrefix.js";

type ProjectScanLimits = Pick<
  ResourcepackProjectValidationLimits,
  | "maxBinaryContentBytes"
  | "maxContentDepth"
  | "maxFiles"
  | "maxPathLength"
  | "maxTextContentCharacters"
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

export function classifyResourcepackProjectEntry(
  entry: DirectoryEntry,
  fullPath: string,
  readStatus: (path: string) => FileStatus = lstatSync,
): DirectoryEntryKind {
  if (entry.isDirectory()) {
    return "directory";
  }
  if (entry.isFile()) {
    return "file";
  }
  if (
    entry.isSymbolicLink() ||
    entry.isBlockDevice() ||
    entry.isCharacterDevice() ||
    entry.isFIFO() ||
    entry.isSocket()
  ) {
    return "unsupported";
  }

  // Some filesystems report UV_DIRENT_UNKNOWN, for which every Dirent predicate is false.
  // Classify that case without following links; links and special files remain outside the scan.
  const status = readStatus(fullPath);
  if (status.isSymbolicLink()) {
    return "unsupported";
  }
  if (status.isDirectory()) {
    return "directory";
  }
  return status.isFile() ? "file" : "unsupported";
}

export function readResourcepackProjectFiles(
  root: string,
  limits: ProjectScanLimits = defaultResourcepackProjectValidationLimits,
  pngLimits: Pick<
    ResourcepackPngValidationLimits,
    "maxInputBytes"
  > = defaultResourcepackPngValidationLimits,
): Array<{ path: string; content?: string | Uint8Array }> {
  const resolvedRoot = resolve(root);
  const files: Array<{ path: string; content?: string | Uint8Array }> = [];
  const pendingDirectories: Array<{ depth: number; path: string }> = [
    { depth: 0, path: resolvedRoot },
  ];
  let directoryCount = 1;
  let entryCount = 0;
  let textBytes = 0;
  let binaryBytes = 0;

  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop();
    if (!directory) {
      continue;
    }
    if (directory.depth > limits.maxContentDepth) {
      throw new Error(
        `resourcepack validate-project refuses directory depth above ${limits.maxContentDepth}`,
      );
    }

    const entries = [];
    const handle = opendirSync(directory.path);
    try {
      let entry = handle.readSync();
      while (entry) {
        entryCount += 1;
        if (entryCount > limits.maxFiles * 2) {
          throw new Error(
            `resourcepack validate-project refuses projects with more than ${limits.maxFiles * 2} directory entries`,
          );
        }
        entries.push(entry);
        entry = handle.readSync();
      }
    } finally {
      handle.closeSync();
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));

    const childDirectories: Array<{ depth: number; path: string }> = [];
    for (const entry of entries) {
      const fullPath = join(directory.path, entry.name);
      const path = relative(resolvedRoot, fullPath).replaceAll("\\", "/");
      if (path.length > limits.maxPathLength) {
        throw new Error(
          `resourcepack validate-project refuses paths longer than ${limits.maxPathLength} characters`,
        );
      }
      const entryKind = classifyResourcepackProjectEntry(entry, fullPath);
      if (entryKind === "directory") {
        directoryCount += 1;
        if (directoryCount > limits.maxFiles) {
          throw new Error(
            `resourcepack validate-project refuses projects with more than ${limits.maxFiles} directories`,
          );
        }
        childDirectories.push({ depth: directory.depth + 1, path: fullPath });
        continue;
      }
      if (entryKind !== "file") {
        continue;
      }
      if (files.length >= limits.maxFiles) {
        throw new Error(
          `resourcepack validate-project refuses projects with more than ${limits.maxFiles} files`,
        );
      }

      let content: string | Uint8Array | undefined;
      if (path.endsWith(".json")) {
        const read = readBoundedUtf8File(fullPath, limits.maxTextContentCharacters - textBytes);
        textBytes += read.bytes;
        content = read.content;
      } else if (path.toLowerCase().endsWith(".ogg")) {
        const remainingBinaryBytes = limits.maxBinaryContentBytes - binaryBytes;
        if (remainingBinaryBytes < vorbisIdentificationPageBytes) {
          throw new Error(
            `resourcepack validate-project refuses binary content larger than the remaining ${remainingBinaryBytes}-byte project budget`,
          );
        }
        content = readFilePrefix(fullPath, vorbisIdentificationPageBytes);
        binaryBytes += content.byteLength;
      } else if (path.toLowerCase().endsWith(".png")) {
        const remainingBinaryBytes = limits.maxBinaryContentBytes - binaryBytes;
        if (remainingBinaryBytes < 1) {
          throw new Error(
            "resourcepack validate-project refuses PNG content because the project binary-content budget is exhausted",
          );
        }
        const readLimit = Math.min(pngLimits.maxInputBytes, remainingBinaryBytes);
        const pngContent = readBoundedPngFile(fullPath, readLimit, "resourcepack validate-project");
        if (pngContent.byteLength > remainingBinaryBytes) {
          throw new Error(
            `resourcepack validate-project refuses PNG content larger than the remaining ${remainingBinaryBytes}-byte project budget`,
          );
        }
        binaryBytes += pngContent.byteLength;
        content = pngContent;
      }
      files.push({ path, ...(content === undefined ? {} : { content }) });
    }
    for (let index = childDirectories.length - 1; index >= 0; index -= 1) {
      const child = childDirectories[index];
      if (child) {
        pendingDirectories.push(child);
      }
    }
  }
  return files;
}
