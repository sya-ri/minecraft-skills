import { type BigIntStats, closeSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { extname } from "node:path";
import { blockbenchProjectInspectionLimits } from "@minecraft-skills/catalog";

export type BlockbenchProjectFileStats = {
  dev: bigint;
  ino: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
  isFile: boolean;
  isSymbolicLink: boolean;
};

export type BlockbenchProjectFileOperations = {
  lstat: (path: string) => BlockbenchProjectFileStats;
  open: (path: string) => number;
  fstat: (file: number) => BlockbenchProjectFileStats;
  read: (file: number, buffer: Buffer, offset: number, length: number, position: number) => number;
  close: (file: number) => void;
};

class BlockbenchProjectFileError extends Error {}

function projectFileStats(stats: BigIntStats): BlockbenchProjectFileStats {
  return {
    dev: stats.dev,
    ino: stats.ino,
    size: stats.size,
    mtimeNs: stats.mtimeNs,
    ctimeNs: stats.ctimeNs,
    isFile: stats.isFile(),
    isSymbolicLink: stats.isSymbolicLink(),
  };
}

const defaultOperations: BlockbenchProjectFileOperations = {
  lstat: (path) => projectFileStats(lstatSync(path, { bigint: true })),
  open: (path) => openSync(path, "r"),
  fstat: (file) => projectFileStats(fstatSync(file, { bigint: true })),
  read: (file, buffer, offset, length, position) =>
    readSync(file, buffer, offset, length, position),
  close: closeSync,
};

function sameIdentity(
  left: BlockbenchProjectFileStats,
  right: BlockbenchProjectFileStats,
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameSnapshot(
  left: BlockbenchProjectFileStats,
  right: BlockbenchProjectFileStats,
): boolean {
  return (
    sameIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function requireRegularStableIdentity(
  pathStats: BlockbenchProjectFileStats,
  fileStats: BlockbenchProjectFileStats,
): void {
  if (
    pathStats.isSymbolicLink ||
    !pathStats.isFile ||
    fileStats.isSymbolicLink ||
    !fileStats.isFile ||
    !sameIdentity(pathStats, fileStats)
  ) {
    throw new BlockbenchProjectFileError(
      "blockbench inspect-project requires a stable regular local .bbmodel file, not a link or special file",
    );
  }
}

/** Reads one stable, bounded, regular UTF-8 `.bbmodel` file without returning its local path. */
export function readBlockbenchProjectFile(
  filePath: string,
  operations: BlockbenchProjectFileOperations = defaultOperations,
): string {
  if (
    filePath.length === 0 ||
    filePath.length > 32_768 ||
    filePath.includes("\0") ||
    extname(filePath).toLowerCase() !== ".bbmodel"
  ) {
    throw new Error("blockbench inspect-project requires one local .bbmodel file path");
  }

  try {
    const pathBefore = operations.lstat(filePath);
    if (pathBefore.isSymbolicLink || !pathBefore.isFile) {
      throw new BlockbenchProjectFileError(
        "blockbench inspect-project requires a regular local .bbmodel file and refuses links",
      );
    }
    const maxBytes = BigInt(blockbenchProjectInspectionLimits.maxProjectBytes);
    if (pathBefore.size < 0n || maxBytes < pathBefore.size) {
      throw new BlockbenchProjectFileError(
        `blockbench inspect-project refuses project files larger than ${blockbenchProjectInspectionLimits.maxProjectBytes} bytes`,
      );
    }

    const file = operations.open(filePath);
    try {
      const fileBefore = operations.fstat(file);
      requireRegularStableIdentity(pathBefore, fileBefore);
      if (fileBefore.size < 0n || maxBytes < fileBefore.size) {
        throw new BlockbenchProjectFileError(
          `blockbench inspect-project refuses project files larger than ${blockbenchProjectInspectionLimits.maxProjectBytes} bytes`,
        );
      }

      const contents = Buffer.alloc(Number(fileBefore.size));
      let offset = 0;
      while (offset < contents.byteLength) {
        const remaining = contents.byteLength - offset;
        const bytesRead = operations.read(file, contents, offset, remaining, offset);
        if (bytesRead === 0) {
          break;
        }
        if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || remaining < bytesRead) {
          throw new BlockbenchProjectFileError(
            "blockbench inspect-project received an invalid local file read length",
          );
        }
        offset += bytesRead;
      }

      const fileAfter = operations.fstat(file);
      const pathAfter = operations.lstat(filePath);
      requireRegularStableIdentity(pathAfter, fileAfter);
      if (
        offset !== contents.byteLength ||
        !sameSnapshot(fileBefore, fileAfter) ||
        !sameSnapshot(pathBefore, pathAfter)
      ) {
        throw new BlockbenchProjectFileError(
          "blockbench inspect-project project file changed while it was being read",
        );
      }

      let content: string;
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(contents);
      } catch {
        throw new BlockbenchProjectFileError(
          "blockbench inspect-project requires valid UTF-8 project text",
        );
      }
      if (blockbenchProjectInspectionLimits.maxProjectCharacters < content.length) {
        throw new BlockbenchProjectFileError(
          `blockbench inspect-project refuses project text longer than ${blockbenchProjectInspectionLimits.maxProjectCharacters} characters`,
        );
      }
      return content;
    } finally {
      operations.close(file);
    }
  } catch (error) {
    if (error instanceof BlockbenchProjectFileError) {
      throw error;
    }
    throw new Error("blockbench inspect-project could not safely read the local .bbmodel file");
  }
}
