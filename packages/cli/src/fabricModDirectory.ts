import { createHash } from "node:crypto";
import {
  defaultFabricModValidationLimits,
  type FabricModValidationResult,
  type FabricModValidationStrength,
  validateFabricModJar,
} from "@minecraft-skills/catalog";
import type { FabricModJarFileIoOverrides } from "./fabricModJarFile.js";
import {
  type JarDirectoryDiagnostic,
  type JarDirectoryScanLimits,
  scanJarDirectory,
} from "./jarDirectoryScan.js";

export type FabricModDirectoryInventoryLimits = JarDirectoryScanLimits;

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

export type FabricModDirectoryDiagnostic = JarDirectoryDiagnostic;

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
  /** Test-only stable-read seams; production callers should leave this argument omitted. */
  jarFileIoOverrides?: Omit<FabricModJarFileIoOverrides, "expectedPathSnapshot">;
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
  collector: {
    finish(): Pick<
      FabricModDirectoryInventoryResult,
      "diagnostics" | "diagnosticsTruncated" | "omittedDiagnosticCount"
    >;
  };
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
  const scanned = scanJarDirectory(directoryPath, {
    limits,
    ...(options.jarFileIoOverrides ? { jarFileIoOverrides: options.jarFileIoOverrides } : {}),
    inspect: (fileName, contents) =>
      normalizedValidatedEntry(
        fileName,
        contents,
        validateFabricModJar(contents, { limits: { maxArchiveBytes: limits.maxJarBytes } }),
      ),
    reject: rejectedEntry,
  });
  return finishInventory({
    ...scanned,
    collector: {
      finish: () => ({
        diagnostics: scanned.diagnostics,
        diagnosticsTruncated: scanned.diagnosticsTruncated,
        omittedDiagnosticCount: scanned.omittedDiagnosticCount,
      }),
    },
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
