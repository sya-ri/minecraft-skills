import { type BigIntStats, closeSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { extname } from "node:path";
import { waveAudioInspectionLimits } from "@minecraft-skills/catalog";

type StableFileStatus = Pick<
  BigIntStats,
  | "birthtimeNs"
  | "ctimeNs"
  | "dev"
  | "ino"
  | "isFile"
  | "isSymbolicLink"
  | "mode"
  | "mtimeNs"
  | "nlink"
  | "size"
>;

type WaveAudioFileOperations = {
  lstat: (path: string) => StableFileStatus;
  open: (path: string) => number;
  fstat: (file: number) => StableFileStatus;
  read: (file: number, target: Buffer, offset: number, length: number, position: number) => number;
  close: (file: number) => void;
};

const defaultOperations: WaveAudioFileOperations = {
  lstat: (path) => lstatSync(path, { bigint: true }),
  open: (path) => openSync(path, "r"),
  fstat: (file) => fstatSync(file, { bigint: true }),
  read: readSync,
  close: closeSync,
};

class WaveAudioFileError extends Error {}

function sameIdentity(left: StableFileStatus, right: StableFileStatus): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameSnapshotMetadata(left: StableFileStatus, right: StableFileStatus): boolean {
  return (
    sameIdentity(left, right) &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs &&
    left.birthtimeNs === right.birthtimeNs
  );
}

function requireRegularFinalEntry(status: StableFileStatus): void {
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new WaveAudioFileError(
      "resourcepack sound inspect requires a regular, non-symbolic-link local .wav file",
    );
  }
}

function changedWhileReading(): WaveAudioFileError {
  return new WaveAudioFileError(
    "resourcepack sound inspect refused a .wav file that changed while it was being read",
  );
}

/** Reads one final regular `.wav` directory entry into a size- and identity-stable snapshot. */
export function readStableWaveAudioFile(
  filePath: string,
  operations: WaveAudioFileOperations = defaultOperations,
): Buffer {
  if (extname(filePath) !== ".wav") {
    throw new WaveAudioFileError(
      "resourcepack sound inspect requires a filename with the exact .wav extension",
    );
  }

  let file: number | null = null;
  let contents: Buffer | null = null;
  let closeFailed = false;
  try {
    const pathBefore = operations.lstat(filePath);
    requireRegularFinalEntry(pathBefore);

    file = operations.open(filePath);
    const handleBefore = operations.fstat(file);
    requireRegularFinalEntry(handleBefore);
    if (!sameSnapshotMetadata(pathBefore, handleBefore)) {
      throw changedWhileReading();
    }
    if (
      handleBefore.size < 0n ||
      handleBefore.size > BigInt(waveAudioInspectionLimits.maxInputBytes)
    ) {
      throw new WaveAudioFileError(
        `resourcepack sound inspect refuses files larger than ${waveAudioInspectionLimits.maxInputBytes} bytes`,
      );
    }

    const expectedSize = Number(handleBefore.size);
    contents = Buffer.allocUnsafe(expectedSize);
    let offset = 0;
    while (offset < expectedSize) {
      const remaining = expectedSize - offset;
      const bytesRead = operations.read(file, contents, offset, remaining, offset);
      if (!Number.isInteger(bytesRead) || bytesRead < 0 || bytesRead > remaining) {
        throw changedWhileReading();
      }
      if (bytesRead === 0) {
        throw changedWhileReading();
      }
      offset += bytesRead;
    }

    const growthProbe = Buffer.allocUnsafe(1);
    if (operations.read(file, growthProbe, 0, 1, expectedSize) !== 0) {
      throw changedWhileReading();
    }

    const handleAfter = operations.fstat(file);
    const pathAfter = operations.lstat(filePath);
    requireRegularFinalEntry(handleAfter);
    requireRegularFinalEntry(pathAfter);
    if (
      !sameSnapshotMetadata(handleBefore, handleAfter) ||
      !sameSnapshotMetadata(pathBefore, pathAfter) ||
      !sameIdentity(handleAfter, pathAfter)
    ) {
      throw changedWhileReading();
    }
  } catch (error) {
    if (error instanceof WaveAudioFileError) {
      throw error;
    }
    throw new WaveAudioFileError(
      "resourcepack sound inspect could not safely access the local .wav file",
    );
  } finally {
    if (file !== null) {
      try {
        operations.close(file);
      } catch {
        closeFailed = true;
      }
    }
  }

  if (closeFailed) {
    throw new WaveAudioFileError(
      "resourcepack sound inspect could not safely close the local .wav file",
    );
  }
  if (contents === null) {
    throw new WaveAudioFileError(
      "resourcepack sound inspect could not safely access the local .wav file",
    );
  }
  return contents;
}
