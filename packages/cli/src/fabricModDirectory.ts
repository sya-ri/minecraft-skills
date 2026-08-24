import { createHash } from "node:crypto";
import { type BigIntStats, type Dir, lstatSync, opendirSync } from "node:fs";
import { join } from "node:path";
import {
  defaultFabricModValidationLimits,
  type FabricModValidationResult,
  type FabricModValidationStrength,
  validateFabricModJar,
} from "@minecraft-skills/catalog";
import { readFabricModJarFile } from "./fabricModJarFile.js";

export type FabricModDirectoryInventoryLimits = {
  maxDirectoryEntries: number;
  maxJarFiles: number;
  maxJarBytes: number;
  maxTotalJarBytes: number;
  maxDiagnostics: number;
  maxDuplicateGroups: number;
};

/** Hard ceilings for one direct, non-recursive Fabric mods directory inventory. */
export const defaultFabricModDirectoryInventoryLimits: Readonly<FabricModDirectoryInventoryLimits> =
  Object.freeze({
    maxDirectoryEntries: 10_000,
    maxJarFiles: 512,
    maxJarBytes: defaultFabricModValidationLimits.maxArchiveBytes,
    maxTotalJarBytes: 1024 * 1024 * 1024,
    maxDiagnostics: 200,
    maxDuplicateGroups: 100,
  });

export type FabricModInventoryValidation = {
  strength: FabricModValidationStrength;
  valid: boolean;
  errorCount: number;
  warningCount: number;
};

export type FabricModInventoryEntry = {
  fileName: string;
  byteLength: number | null;
  sha256: string | null;
  status: "validated" | "rejected";
  rejectionCode:
    | "entry-not-regular-file"
    | "jar-too-large"
    | "total-byte-limit-exceeded"
    | "jar-read-failed"
    | "jar-processing-failed"
    | null;
  mod: {
    id: string | null;
    version: string | null;
    environment: string | null;
  } | null;
  validation: FabricModInventoryValidation | null;
};

export type FabricModDirectoryDiagnostic = {
  severity: "error" | "warning";
  code: string;
  fileName: string | null;
  message: string;
};

export type FabricModDuplicateGroup = {
  modId: string;
  count: number;
  fileNames: string[];
};

export type FabricModDirectoryInventoryResult = {
  schemaVersion: 1;
  kind: "fabric-mod-directory-inventory";
  validationComplete: boolean;
  valid: boolean;
  observedDirectoryEntries: number;
  observedJarCandidates: number;
  /** Sum reserved against the total ceiling before each bounded regular-file read attempt. */
  accountedJarBytes: number;
  validJarCount: number;
  invalidJarCount: number;
  rejectedJarCount: number;
  duplicateModIdGroupCount: number;
  duplicateGroupsTruncated: boolean;
  diagnosticsTruncated: boolean;
  omittedDiagnosticCount: number;
  limits: FabricModDirectoryInventoryLimits;
  entries: FabricModInventoryEntry[];
  duplicateModIds: FabricModDuplicateGroup[];
  diagnostics: FabricModDirectoryDiagnostic[];
  nonClaims: string[];
};

export type FabricModDirectoryInventoryOptions = {
  /** Tests and constrained callers may lower, but never raise, the public hard ceilings. */
  limits?: Partial<FabricModDirectoryInventoryLimits>;
};

export type FabricModDiffEntry = FabricModInventoryEntry & {
  modId: string | null;
};

export type FabricModDirectoryDiffResult = {
  schemaVersion: 1;
  kind: "fabric-mod-directory-diff";
  comparisonComplete: boolean;
  hasDifferences: boolean;
  inventories: {
    left: FabricModDirectoryInventoryResult;
    right: FabricModDirectoryInventoryResult;
  };
  counts: {
    added: number;
    removed: number;
    changed: number;
    ambiguousModIds: number;
    unidentifiedEntries: number;
  };
  added: FabricModDiffEntry[];
  removed: FabricModDiffEntry[];
  changed: Array<{
    modId: string;
    left: FabricModDiffEntry;
    right: FabricModDiffEntry;
    changes: {
      version: boolean;
      environment: boolean;
      sha256: boolean;
      validation: boolean;
      fileName: boolean;
    };
  }>;
  ambiguous: Array<{
    modId: string;
    reasons: Array<"left-duplicate" | "right-duplicate" | "left-invalid" | "right-invalid">;
    left: FabricModDiffEntry[];
    right: FabricModDiffEntry[];
  }>;
  unidentified: Array<{
    side: "left" | "right";
    reason: "rejected" | "missing-mod-id";
    entry: FabricModDiffEntry;
  }>;
  nonClaims: string[];
};

const fabricModInventoryNonClaims = Object.freeze([
  "Dependency graphs and load order are not resolved.",
  "Minecraft-version compatibility, authenticity, Modrinth origin, and runtime startup are not established.",
  "No files are downloaded, updated, or deleted.",
]);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizedLimit(value: unknown, ceiling: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && 0 < value
    ? Math.min(value, ceiling)
    : ceiling;
}

function resolveInventoryLimits(
  requested: Partial<FabricModDirectoryInventoryLimits> | undefined,
): FabricModDirectoryInventoryLimits {
  return {
    maxDirectoryEntries: normalizedLimit(
      requested?.maxDirectoryEntries,
      defaultFabricModDirectoryInventoryLimits.maxDirectoryEntries,
    ),
    maxJarFiles: normalizedLimit(
      requested?.maxJarFiles,
      defaultFabricModDirectoryInventoryLimits.maxJarFiles,
    ),
    maxJarBytes: normalizedLimit(
      requested?.maxJarBytes,
      defaultFabricModDirectoryInventoryLimits.maxJarBytes,
    ),
    maxTotalJarBytes: normalizedLimit(
      requested?.maxTotalJarBytes,
      defaultFabricModDirectoryInventoryLimits.maxTotalJarBytes,
    ),
    maxDiagnostics: normalizedLimit(
      requested?.maxDiagnostics,
      defaultFabricModDirectoryInventoryLimits.maxDiagnostics,
    ),
    maxDuplicateGroups: normalizedLimit(
      requested?.maxDuplicateGroups,
      defaultFabricModDirectoryInventoryLimits.maxDuplicateGroups,
    ),
  };
}

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
  private readonly retained: FabricModDirectoryDiagnostic[] = [];
  private total = 0;

  constructor(private readonly maxDiagnostics: number) {}

  add(
    code: string,
    message: string,
    fileName: string | null = null,
    severity: FabricModDirectoryDiagnostic["severity"] = "error",
  ): void {
    this.total += 1;
    if (this.retained.length < this.maxDiagnostics) {
      this.retained.push({ severity, code, fileName, message });
    }
  }

  finish(): Pick<
    FabricModDirectoryInventoryResult,
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

function rejectedEntry(
  fileName: string,
  byteLength: number | null,
  rejectionCode: NonNullable<FabricModInventoryEntry["rejectionCode"]>,
): FabricModInventoryEntry {
  return {
    fileName,
    byteLength,
    sha256: null,
    status: "rejected",
    rejectionCode,
    mod: null,
    validation: null,
  };
}

function normalizedValidatedEntry(
  fileName: string,
  contents: Buffer,
  validation: FabricModValidationResult,
): FabricModInventoryEntry {
  return {
    fileName,
    byteLength: contents.byteLength,
    sha256: createHash("sha256").update(contents).digest("hex"),
    status: "validated",
    rejectionCode: null,
    mod:
      validation.mod === null
        ? null
        : {
            id: validation.mod.id,
            version: validation.mod.version,
            environment: validation.mod.environment,
          },
    validation: {
      strength: validation.validationStrength,
      valid: validation.valid,
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
    },
  };
}

function collectDuplicateGroups(
  entries: FabricModInventoryEntry[],
  maxDuplicateGroups: number,
): {
  duplicateModIdGroupCount: number;
  duplicateGroupsTruncated: boolean;
  duplicateModIds: FabricModDuplicateGroup[];
} {
  const grouped = new Map<string, string[]>();
  for (const entry of entries) {
    const modId = entry.mod?.id;
    if (modId === null || modId === undefined) continue;
    const fileNames = grouped.get(modId) ?? [];
    fileNames.push(entry.fileName);
    grouped.set(modId, fileNames);
  }
  const allDuplicates = [...grouped]
    .filter(([, fileNames]) => 1 < fileNames.length)
    .map(([modId, fileNames]) => ({
      modId,
      count: fileNames.length,
      fileNames: fileNames.sort(compareText),
    }))
    .sort((left, right) => compareText(left.modId, right.modId));
  return {
    duplicateModIdGroupCount: allDuplicates.length,
    duplicateGroupsTruncated: maxDuplicateGroups < allDuplicates.length,
    duplicateModIds: allDuplicates.slice(0, maxDuplicateGroups),
  };
}

function finishInventory(options: {
  limits: FabricModDirectoryInventoryLimits;
  validationComplete: boolean;
  observedDirectoryEntries: number;
  observedJarCandidates: number;
  accountedJarBytes: number;
  entries: FabricModInventoryEntry[];
  collector: DirectoryDiagnosticCollector;
}): FabricModDirectoryInventoryResult {
  const entries = options.entries.sort((left, right) => compareText(left.fileName, right.fileName));
  const validJarCount = entries.filter(
    (entry) => entry.status === "validated" && entry.validation?.valid === true,
  ).length;
  const invalidJarCount = entries.filter(
    (entry) => entry.status === "validated" && entry.validation?.valid === false,
  ).length;
  const rejectedJarCount = entries.filter((entry) => entry.status === "rejected").length;
  const duplicateGroups = collectDuplicateGroups(entries, options.limits.maxDuplicateGroups);
  const diagnostics = options.collector.finish();
  return {
    schemaVersion: 1,
    kind: "fabric-mod-directory-inventory",
    validationComplete: options.validationComplete,
    valid:
      options.validationComplete &&
      invalidJarCount === 0 &&
      rejectedJarCount === 0 &&
      duplicateGroups.duplicateModIdGroupCount === 0,
    observedDirectoryEntries: options.observedDirectoryEntries,
    observedJarCandidates: options.observedJarCandidates,
    accountedJarBytes: options.accountedJarBytes,
    validJarCount,
    invalidJarCount,
    rejectedJarCount,
    duplicateModIdGroupCount: duplicateGroups.duplicateModIdGroupCount,
    duplicateGroupsTruncated: duplicateGroups.duplicateGroupsTruncated,
    diagnosticsTruncated: diagnostics.diagnosticsTruncated,
    omittedDiagnosticCount: diagnostics.omittedDiagnosticCount,
    limits: options.limits,
    entries,
    duplicateModIds: duplicateGroups.duplicateModIds,
    diagnostics: diagnostics.diagnostics,
    nonClaims: [...fabricModInventoryNonClaims],
  };
}

/**
 * Inventories exact `.jar` regular files directly inside one local directory.
 * The directory is not traversed recursively and all filesystem failures are returned without
 * exposing the input path or operating-system error details.
 */
export function inventoryFabricModsDirectory(
  directoryPath: string,
  options: FabricModDirectoryInventoryOptions = {},
): FabricModDirectoryInventoryResult {
  const limits = resolveInventoryLimits(options.limits);
  const collector = new DirectoryDiagnosticCollector(limits.maxDiagnostics);
  const entries: FabricModInventoryEntry[] = [];
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
    return finishInventory({
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
    return finishInventory({
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
    return finishInventory({
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
      if (!directoryEntry.name.endsWith(".jar")) continue;

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
      entries.push(rejectedEntry(fileName, null, "jar-read-failed"));
      collector.add(
        "jar.stat-failed",
        "The JAR candidate changed or could not be inspected safely.",
        fileName,
      );
      continue;
    }

    if (!fileBefore.isFile()) {
      entries.push(
        rejectedEntry(fileName, safeByteLength(fileBefore.size), "entry-not-regular-file"),
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
      entries.push(rejectedEntry(fileName, safeByteLength(fileBefore.size), "jar-too-large"));
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
      entries.push(rejectedEntry(fileName, byteLength, "total-byte-limit-exceeded"));
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
        expectedPathSnapshot: fileBefore,
      });
    } catch {
      validationComplete = false;
      entries.push(rejectedEntry(fileName, byteLength, "jar-read-failed"));
      collector.add(
        "jar.read-failed",
        "The JAR candidate changed or could not be read as one stable regular file.",
        fileName,
      );
      continue;
    }

    try {
      entries.push(
        normalizedValidatedEntry(
          fileName,
          contents,
          validateFabricModJar(contents, { limits: { maxArchiveBytes: limits.maxJarBytes } }),
        ),
      );
    } catch {
      validationComplete = false;
      entries.push(rejectedEntry(fileName, byteLength, "jar-processing-failed"));
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

  return finishInventory({
    limits,
    validationComplete,
    observedDirectoryEntries,
    observedJarCandidates,
    accountedJarBytes,
    entries,
    collector,
  });
}

function diffEntry(entry: FabricModInventoryEntry): FabricModDiffEntry {
  return { ...entry, modId: entry.mod?.id ?? null };
}

function groupIdentifiedEntries(
  inventory: FabricModDirectoryInventoryResult,
): Map<string, FabricModDiffEntry[]> {
  const groups = new Map<string, FabricModDiffEntry[]>();
  for (const rawEntry of inventory.entries) {
    const entry = diffEntry(rawEntry);
    if (entry.modId === null) continue;
    const grouped = groups.get(entry.modId) ?? [];
    grouped.push(entry);
    groups.set(entry.modId, grouped);
  }
  for (const grouped of groups.values()) {
    grouped.sort((left, right) => compareText(left.fileName, right.fileName));
  }
  return groups;
}

function isPairableEntry(entry: FabricModDiffEntry): boolean {
  return entry.status === "validated" && entry.validation?.valid === true;
}

function validationChanged(left: FabricModDiffEntry, right: FabricModDiffEntry): boolean {
  return (
    left.validation?.strength !== right.validation?.strength ||
    left.validation?.valid !== right.validation?.valid ||
    left.validation?.errorCount !== right.validation?.errorCount ||
    left.validation?.warningCount !== right.validation?.warningCount
  );
}

/** Compares two inventory values without pairing duplicate, invalid, or unidentified mods. */
export function diffFabricModDirectories(
  left: FabricModDirectoryInventoryResult,
  right: FabricModDirectoryInventoryResult,
): FabricModDirectoryDiffResult {
  const leftGroups = groupIdentifiedEntries(left);
  const rightGroups = groupIdentifiedEntries(right);
  const allModIds = [...new Set([...leftGroups.keys(), ...rightGroups.keys()])].sort(compareText);
  const added: FabricModDiffEntry[] = [];
  const removed: FabricModDiffEntry[] = [];
  const changed: FabricModDirectoryDiffResult["changed"] = [];
  const ambiguous: FabricModDirectoryDiffResult["ambiguous"] = [];

  for (const modId of allModIds) {
    const leftEntries = leftGroups.get(modId) ?? [];
    const rightEntries = rightGroups.get(modId) ?? [];
    const reasons: FabricModDirectoryDiffResult["ambiguous"][number]["reasons"] = [];
    if (1 < leftEntries.length) reasons.push("left-duplicate");
    if (1 < rightEntries.length) reasons.push("right-duplicate");
    if (leftEntries.some((entry) => !isPairableEntry(entry))) reasons.push("left-invalid");
    if (rightEntries.some((entry) => !isPairableEntry(entry))) reasons.push("right-invalid");
    if (reasons.length !== 0) {
      ambiguous.push({ modId, reasons, left: leftEntries, right: rightEntries });
      continue;
    }

    const leftEntry = leftEntries[0];
    const rightEntry = rightEntries[0];
    if (leftEntry === undefined && rightEntry !== undefined) {
      added.push(rightEntry);
      continue;
    }
    if (leftEntry !== undefined && rightEntry === undefined) {
      removed.push(leftEntry);
      continue;
    }
    if (leftEntry === undefined || rightEntry === undefined) continue;

    const changes = {
      version: leftEntry.mod?.version !== rightEntry.mod?.version,
      environment: leftEntry.mod?.environment !== rightEntry.mod?.environment,
      sha256: leftEntry.sha256 !== rightEntry.sha256,
      validation: validationChanged(leftEntry, rightEntry),
      fileName: leftEntry.fileName !== rightEntry.fileName,
    };
    if (Object.values(changes).some(Boolean)) {
      changed.push({ modId, left: leftEntry, right: rightEntry, changes });
    }
  }

  const unidentified: FabricModDirectoryDiffResult["unidentified"] = [];
  for (const [side, inventory] of [
    ["left", left],
    ["right", right],
  ] as const) {
    for (const rawEntry of inventory.entries) {
      const entry = diffEntry(rawEntry);
      if (entry.modId !== null) continue;
      unidentified.push({
        side,
        reason: entry.status === "rejected" ? "rejected" : "missing-mod-id",
        entry,
      });
    }
  }
  unidentified.sort(
    (leftEntry, rightEntry) =>
      compareText(leftEntry.side, rightEntry.side) ||
      compareText(leftEntry.entry.fileName, rightEntry.entry.fileName),
  );

  const comparisonComplete =
    left.validationComplete &&
    right.validationComplete &&
    ambiguous.length === 0 &&
    unidentified.length === 0;
  const hasDifferences = added.length !== 0 || removed.length !== 0 || changed.length !== 0;
  return {
    schemaVersion: 1,
    kind: "fabric-mod-directory-diff",
    comparisonComplete,
    hasDifferences,
    inventories: { left, right },
    counts: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      ambiguousModIds: ambiguous.length,
      unidentifiedEntries: unidentified.length,
    },
    added,
    removed,
    changed,
    ambiguous,
    unidentified,
    nonClaims: [...fabricModInventoryNonClaims],
  };
}
