import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { mixinConfigValidationLimits } from "@minecraft-skills/catalog";

class MixinConfigFileError extends Error {}

type BigIntFileStats = ReturnType<typeof lstatSync> & {
  atimeNs: bigint;
  ctimeNs: bigint;
  dev: bigint;
  ino: bigint;
  mtimeNs: bigint;
  size: bigint;
};

function fail(message: string): never {
  throw new MixinConfigFileError(message);
}

function hasStableIdentity(left: BigIntFileStats, right: BigIntFileStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function readStableRegularUtf8File(filePath: string, label: string, maxBytes: number): string {
  try {
    const pathStats = lstatSync(filePath, { bigint: true }) as BigIntFileStats;
    if (pathStats.isSymbolicLink() || !pathStats.isFile()) {
      fail(`${label} must be a regular non-symbolic-link file.`);
    }
    if (pathStats.size > BigInt(maxBytes)) {
      fail(`${label} exceeds its fixed byte limit.`);
    }

    const noFollow = "O_NOFOLLOW" in constants ? constants.O_NOFOLLOW : 0;
    const descriptor = openSync(filePath, constants.O_RDONLY | constants.O_NONBLOCK | noFollow);
    try {
      const opened = fstatSync(descriptor, { bigint: true }) as BigIntFileStats;
      if (!opened.isFile() || !hasStableIdentity(pathStats, opened)) {
        fail(`${label} changed identity while it was being opened.`);
      }

      const contents = Buffer.alloc(Number(opened.size));
      let offset = 0;
      while (offset < contents.byteLength) {
        const read = readSync(descriptor, contents, offset, contents.byteLength - offset, null);
        if (read === 0) break;
        offset += read;
      }

      const after = fstatSync(descriptor, { bigint: true }) as BigIntFileStats;
      if (offset !== contents.byteLength || !hasStableIdentity(opened, after)) {
        fail(`${label} changed while it was being read.`);
      }
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(contents);
      } catch {
        fail(`${label} must contain valid UTF-8 text.`);
      }
    } finally {
      closeSync(descriptor);
    }
  } catch (error) {
    if (error instanceof MixinConfigFileError) throw error;
    fail(`${label} could not be read as a stable regular file.`);
  }
}

export function readMixinConfigCliFiles(options: {
  configPath: string;
  archiveEntriesPath?: string;
}): { config: string; archiveEntries?: unknown } {
  const config = readStableRegularUtf8File(
    options.configPath,
    "Mixin configuration",
    mixinConfigValidationLimits.maxConfigBytes,
  );
  if (!options.archiveEntriesPath) return { config };

  const archiveEntryText = readStableRegularUtf8File(
    options.archiveEntriesPath,
    "Archive-entry metadata",
    mixinConfigValidationLimits.maxArchiveEntryMetadataBytes,
  );
  try {
    return { config, archiveEntries: JSON.parse(archiveEntryText) as unknown };
  } catch {
    fail("Archive-entry metadata must contain valid JSON.");
  }
}
