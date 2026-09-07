import { type BigIntStats, type Dir, lstatSync, opendirSync } from "node:fs";
import { join } from "node:path";
import { type FabricModJarFileIoOverrides, readFabricModJarFile } from "./fabricModJarFile.js";

export type JarDirectoryScanLimits = {
  maxDirectoryEntries: number;
  maxJarFiles: number;
  maxJarBytes: number;
  maxTotalJarBytes: number;
  maxDiagnostics: number;
  maxDuplicateGroups: number;
};

export type JarDirectoryDiagnostic = {
  severity: "error" | "warning";
  code: string;
  fileName: string | null;
  message: string;
};

export type JarDirectoryRejection =
  | "entry-not-regular-file"
  | "jar-too-large"
  | "total-byte-limit-exceeded"
  | "jar-read-failed"
  | "jar-processing-failed";
export type JarDirectoryScanOptions<T> = {
  limits: JarDirectoryScanLimits;
  inspect: (fileName: string, bytes: Buffer) => T;
  reject: (fileName: string, byteLength: number | null, reason: JarDirectoryRejection) => T;
  jarFileIoOverrides?: Omit<FabricModJarFileIoOverrides, "expectedPathSnapshot">;
  caseSensitiveExtension?: boolean;
  acceptArchiveName?: (name: string) => boolean;
};
export type JarDirectoryScanResult<T> = {
  validationComplete: boolean;
  observedDirectoryEntries: number;
  observedJarCandidates: number;
  accountedJarBytes: number;
  entries: T[];
  limits: JarDirectoryScanLimits;
  diagnostics: JarDirectoryDiagnostic[];
  diagnosticsTruncated: boolean;
  omittedDiagnosticCount: number;
};
const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

function sameFileSnapshot(left: BigIntStats, right: BigIntStats): boolean {
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

class DirectoryDiagnosticCollector {
  private readonly retained: JarDirectoryDiagnostic[] = [];
  private total = 0;

  constructor(private readonly maxDiagnostics: number) {}

  add(
    code: string,
    message: string,
    fileName: string | null = null,
    severity: JarDirectoryDiagnostic["severity"] = "error",
  ): void {
    this.total += 1;
    if (this.retained.length < this.maxDiagnostics) {
      this.retained.push({ severity, code, fileName, message });
    }
  }

  finish(): Pick<
    JarDirectoryScanResult<unknown>,
    "diagnostics" | "diagnosticsTruncated" | "omittedDiagnosticCount"
  > {
    const diagnostics = this.retained.sort(
      (left, right) =>
        (left.severity === right.severity ? 0 : left.severity === "error" ? -1 : 1) ||
        compareText(left.fileName ?? "", right.fileName ?? "") ||
        compareText(left.code, right.code) ||
        compareText(left.message, right.message),
    );
    return {
      diagnostics,
      diagnosticsTruncated: diagnostics.length < this.total,
      omittedDiagnosticCount: this.total - diagnostics.length,
    };
  }
}

function safeByteLength(size: bigint): number | null {
  return size <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(size) : null;
}

function finishScan<T>(options: {
  limits: JarDirectoryScanLimits;
  validationComplete: boolean;
  observedDirectoryEntries: number;
  observedJarCandidates: number;
  accountedJarBytes: number;
  entries: T[];
  collector: DirectoryDiagnosticCollector;
}): JarDirectoryScanResult<T> {
  const { collector, ...result } = options;
  return { ...result, ...collector.finish() };
}

/** Shared direct-directory discovery and stable reads. Callers supply bounded format analysis. */
export function scanJarDirectory<T>(
  directoryPath: string,
  options: JarDirectoryScanOptions<T>,
): JarDirectoryScanResult<T> {
  const limits = options.limits;
  const collector = new DirectoryDiagnosticCollector(limits.maxDiagnostics);
  const entries: T[] = [];
  let validationComplete = true;
  let observedDirectoryEntries = 0;
  let observedJarCandidates = 0;
  let accountedJarBytes = 0;
  let directoryBefore: BigIntStats;

  try {
    directoryBefore = lstatSync(directoryPath, { bigint: true });
  } catch {
    collector.add(
      "directory.unreadable",
      "The requested directory could not be inspected as a local directory.",
    );
    return finishScan({
      limits,
      validationComplete: false,
      observedDirectoryEntries,
      observedJarCandidates,
      accountedJarBytes,
      entries,
      collector,
    });
  }

  if (!directoryBefore.isDirectory()) {
    collector.add(
      "directory.not-regular",
      "The requested path must be a direct local directory, not a symbolic link, directory junction, or non-directory entry.",
    );
    return finishScan({
      limits,
      validationComplete: false,
      observedDirectoryEntries,
      observedJarCandidates,
      accountedJarBytes,
      entries,
      collector,
    });
  }

  let directory: Dir;
  try {
    directory = opendirSync(directoryPath);
  } catch {
    collector.add("directory.open-failed", "The requested directory could not be opened safely.");
    return finishScan({
      limits,
      validationComplete: false,
      observedDirectoryEntries,
      observedJarCandidates,
      accountedJarBytes,
      entries,
      collector,
    });
  }

  const jarCandidateNames: string[] = [];
  let directEntryScanComplete = true;
  try {
    while (true) {
      const directoryEntry = directory.readSync();
      if (directoryEntry === null) break;
      observedDirectoryEntries += 1;
      if (limits.maxDirectoryEntries < observedDirectoryEntries) {
        validationComplete = false;
        directEntryScanComplete = false;
        collector.add(
          "directory.entry-limit-exceeded",
          `The directory contains more than the ${limits.maxDirectoryEntries} inspected-entry limit.`,
        );
        break;
      }
      if (
        !(
          options.caseSensitiveExtension === false
            ? directoryEntry.name.toLowerCase()
            : directoryEntry.name
        ).endsWith(".jar")
      )
        continue;
      if (options.acceptArchiveName && !options.acceptArchiveName(directoryEntry.name)) {
        validationComplete = false;
        collector.add(
          "jar.unsafe-name",
          "A JAR basename cannot be represented safely in the inventory.",
        );
        continue;
      }

      observedJarCandidates += 1;
      if (limits.maxJarFiles < observedJarCandidates) {
        validationComplete = false;
        directEntryScanComplete = false;
        collector.add(
          "directory.jar-limit-exceeded",
          `The directory contains more than the ${limits.maxJarFiles} direct JAR limit.`,
        );
        break;
      }
      jarCandidateNames.push(directoryEntry.name);
    }
  } catch {
    validationComplete = false;
    directEntryScanComplete = false;
    collector.add("directory.scan-failed", "The directory scan could not be completed safely.");
  } finally {
    try {
      directory.closeSync();
    } catch {
      validationComplete = false;
      directEntryScanComplete = false;
      collector.add("directory.close-failed", "The directory scan could not be closed safely.");
    }
  }

  if (!directEntryScanComplete) {
    jarCandidateNames.length = 0;
  }
  for (const fileName of jarCandidateNames.sort(compareText)) {
    const filePath = join(directoryPath, fileName);
    let fileBefore: BigIntStats;
    try {
      fileBefore = lstatSync(filePath, { bigint: true });
    } catch {
      validationComplete = false;
      entries.push(options.reject(fileName, null, "jar-read-failed"));
      collector.add(
        "jar.stat-failed",
        "The JAR candidate changed or could not be inspected safely.",
        fileName,
      );
      continue;
    }

    if (!fileBefore.isFile()) {
      entries.push(
        options.reject(fileName, safeByteLength(fileBefore.size), "entry-not-regular-file"),
      );
      collector.add(
        "jar.not-regular",
        "The JAR candidate is not a direct regular file; symbolic links, junctions, directories, and special files are rejected.",
        fileName,
      );
      continue;
    }

    if (BigInt(limits.maxJarBytes) < fileBefore.size) {
      validationComplete = false;
      entries.push(options.reject(fileName, safeByteLength(fileBefore.size), "jar-too-large"));
      collector.add(
        "jar.byte-limit-exceeded",
        `The JAR candidate exceeds the ${limits.maxJarBytes}-byte per-file limit.`,
        fileName,
      );
      continue;
    }

    const byteLength = Number(fileBefore.size);
    if (limits.maxTotalJarBytes - accountedJarBytes < byteLength) {
      validationComplete = false;
      entries.push(options.reject(fileName, byteLength, "total-byte-limit-exceeded"));
      collector.add(
        "directory.total-byte-limit-exceeded",
        `Reading this JAR would exceed the ${limits.maxTotalJarBytes}-byte directory total limit.`,
        fileName,
      );
      break;
    }
    accountedJarBytes += byteLength;

    let contents: Buffer;
    try {
      contents = readFabricModJarFile(filePath, limits.maxJarBytes, {
        ...options.jarFileIoOverrides,
        expectedPathSnapshot: fileBefore,
      });
    } catch {
      validationComplete = false;
      entries.push(options.reject(fileName, byteLength, "jar-read-failed"));
      collector.add(
        "jar.read-failed",
        "The JAR candidate changed or could not be read as one stable regular file.",
        fileName,
      );
      continue;
    }

    try {
      entries.push(options.inspect(fileName, contents));
    } catch {
      validationComplete = false;
      entries.push(options.reject(fileName, byteLength, "jar-processing-failed"));
      collector.add(
        "jar.processing-failed",
        "The stable JAR bytes could not be normalized safely.",
        fileName,
      );
    }
  }

  try {
    const directoryAfter = lstatSync(directoryPath, { bigint: true });
    if (!directoryAfter.isDirectory() || !sameFileSnapshot(directoryBefore, directoryAfter)) {
      validationComplete = false;
      collector.add(
        "directory.changed",
        "The requested directory changed while its direct entries were being inspected.",
      );
    }
  } catch {
    validationComplete = false;
    collector.add(
      "directory.changed",
      "The requested directory changed or became unreadable during inspection.",
    );
  }

  return finishScan({
    limits,
    validationComplete,
    observedDirectoryEntries,
    observedJarCandidates,
    accountedJarBytes,
    entries,
    collector,
  });
}
