import {
  inspectJarInventoryRecord,
  type JarInventoryRecord,
  jarInventoryLimits,
  normalizeJarInventory,
  summarizeJarInventory,
} from "@minecraft-skills/catalog";
import type { FabricModJarFileIoOverrides } from "./fabricModJarFile.js";
import { type JarDirectoryScanLimits, scanJarDirectory } from "./jarDirectoryScan.js";

export const jarDirectoryInventoryLimits: Readonly<JarDirectoryScanLimits> = Object.freeze({
  maxDirectoryEntries: 10_000,
  maxJarFiles: jarInventoryLimits.maxRecords,
  maxJarBytes: jarInventoryLimits.maxArchiveBytes,
  maxTotalJarBytes: 1024 * 1024 * 1024,
  maxDiagnostics: 200,
  maxDuplicateGroups: 200,
});
export type JarDirectoryInventoryOptions = {
  limits?: Partial<JarDirectoryScanLimits>;
  jarFileIoOverrides?: Omit<FabricModJarFileIoOverrides, "expectedPathSnapshot">;
};

/** Direct local archive inventory, sharing the existing Fabric discovery and stable-read guards. */
export function inventoryJarDirectory(
  directory: string,
  options: JarDirectoryInventoryOptions = {},
) {
  const limits = { ...jarDirectoryInventoryLimits };
  for (const key of Object.keys(limits) as Array<keyof JarDirectoryScanLimits>) {
    const requested = options.limits?.[key];
    if (typeof requested === "number" && Number.isSafeInteger(requested) && requested > 0)
      limits[key] = Math.min(requested, limits[key]);
  }
  const scanned = scanJarDirectory<JarInventoryRecord>(directory, {
    limits,
    caseSensitiveExtension: false,
    acceptArchiveName: (name) =>
      name.length <= jarInventoryLimits.maxArchiveNameCharacters && !/[\p{C}\\/:]/u.test(name),
    ...(options.jarFileIoOverrides ? { jarFileIoOverrides: options.jarFileIoOverrides } : {}),
    inspect: inspectJarInventoryRecord,
    reject: (archiveName, byteLength, reason) => ({
      archiveName,
      byteLength:
        byteLength !== null && byteLength <= jarInventoryLimits.maxArchiveBytes ? byteLength : null,
      platform: null,
      id: null,
      version: null,
      sha256: null,
      metadataIssue:
        reason === "jar-too-large" || reason === "total-byte-limit-exceeded"
          ? "archive-limit"
          : "jar-read-failed",
    }),
  });
  const inventory = normalizeJarInventory({
    schemaVersion: 1,
    scanComplete:
      scanned.validationComplete && scanned.entries.every((entry) => entry.sha256 !== null),
    records: scanned.entries,
  });
  const summary = summarizeJarInventory(inventory);
  summary.duplicates = summary.duplicates.slice(0, limits.maxDuplicateGroups);
  summary.duplicatesTruncated = summary.duplicateIdentityCount > summary.duplicates.length;
  return {
    schemaVersion: 1 as const,
    kind: "jar-directory-inventory" as const,
    evidenceStrength: "binary" as const,
    inventory,
    summary,
    complete:
      inventory.scanComplete && summary.identityComplete && summary.duplicateIdentityCount === 0,
    observedDirectoryEntries: scanned.observedDirectoryEntries,
    observedJarCandidates: scanned.observedJarCandidates,
    accountedJarBytes: scanned.accountedJarBytes,
    limits,
    diagnostics: scanned.diagnostics,
    diagnosticsTruncated: scanned.diagnosticsTruncated,
    omittedDiagnosticCount: scanned.omittedDiagnosticCount,
    nonClaims: [
      "SHA-256 values describe stable local archive bytes; they do not authenticate publisher identity or validate all ZIP resources.",
      "The scan is non-recursive and considers direct .jar basenames case-insensitively. Nested JARs and the runtime classpath are not inventoried.",
      "Platform and identity come from root Fabric, Paper/Bukkit or Velocity descriptors. Multiple platform descriptors stay unidentified.",
      "Descriptor identity does not establish plugin validation, dependencies, load order or Minecraft/runtime compatibility.",
    ],
  };
}
