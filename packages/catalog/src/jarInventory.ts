import { createHash } from "node:crypto";
import { types as nodeTypes } from "node:util";
import { openZipArchive } from "@minecraft-skills/data";
import { validateFabricModJar } from "./fabricMod.js";
import { validatePaperPluginJar } from "./paperPluginJar.js";
import { validateVelocityPluginJar } from "./velocityPluginJar.js";

export const jarInventoryLimits = Object.freeze({
  maxArchiveBytes: 64 * 1024 * 1024,
  maxArchiveEntries: 16_384,
  maxRecords: 512,
  maxArchiveNameCharacters: 255,
  maxIdCharacters: 128,
  maxVersionCharacters: 2_048,
  maxOutputEntries: 200,
});
export type JarInventoryPlatform = "fabric" | "paper" | "velocity";
export type JarInventoryIssue =
  | "archive-limit"
  | "archive-unreadable"
  | "descriptor-missing"
  | "multiple-platform-descriptors"
  | "identity-unavailable"
  | "jar-read-failed";
export type JarInventoryRecord = {
  archiveName: string;
  platform: JarInventoryPlatform | null;
  id: string | null;
  version: string | null;
  sha256: string | null;
  byteLength: number | null;
  metadataIssue: JarInventoryIssue | null;
};
export type JarInventory = {
  schemaVersion: 1;
  scanComplete: boolean;
  records: readonly JarInventoryRecord[];
};
export type JarInventoryDuplicateGroup = {
  platform: JarInventoryPlatform;
  id: string;
  archiveNames: string[];
};
export type JarInventorySummary = {
  recordCount: number;
  scanComplete: boolean;
  identityComplete: boolean;
  unknownHashCount: number;
  unknownVersionCount: number;
  duplicateIdentityCount: number;
  duplicates: JarInventoryDuplicateGroup[];
  duplicatesTruncated: boolean;
};
export type JarInventoryPair = {
  platform: JarInventoryPlatform;
  id: string;
  left: JarInventoryRecord;
  right: JarInventoryRecord;
  contentChanged: boolean | null;
  versionChanged: boolean | null;
  archiveNameChanged: boolean;
};
export type JarInventoryComparison = {
  schemaVersion: 1;
  kind: "jar-inventory-comparison";
  evidenceStrength: "supplied-metadata";
  comparisonComplete: boolean;
  hasDifferences: boolean | null;
  inventories: { left: JarInventorySummary; right: JarInventorySummary };
  counts: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
    unresolved: number;
    ambiguous: number;
    unidentified: number;
    unmatched: number;
  };
  added: JarInventoryRecord[];
  removed: JarInventoryRecord[];
  changed: JarInventoryPair[];
  unresolved: JarInventoryPair[];
  ambiguous: Array<{ platform: JarInventoryPlatform; id: string; left: string[]; right: string[] }>;
  unidentified: Array<{ side: "left" | "right"; record: JarInventoryRecord }>;
  unmatched: Array<{
    side: "left" | "right";
    record: JarInventoryRecord;
    reason: "opposite-inventory-incomplete-or-unidentified";
  }>;
  outputTruncated: boolean;
  nonClaims: string[];
};

const issues = new Set<JarInventoryIssue>([
  "archive-limit",
  "archive-unreadable",
  "descriptor-missing",
  "multiple-platform-descriptors",
  "identity-unavailable",
  "jar-read-failed",
]);
const platforms = new Set<JarInventoryPlatform>(["fabric", "paper", "velocity"]);
const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
function safeText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum &&
    !/\p{C}/u.test(value)
  );
}
function archiveName(value: unknown): value is string {
  return (
    safeText(value, jarInventoryLimits.maxArchiveNameCharacters) &&
    !/[\\/:]/u.test(value) &&
    value !== "." &&
    value !== ".." &&
    value.toLowerCase().endsWith(".jar")
  );
}
function record(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    nodeTypes.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  )
    throw new Error(`${label} must be a plain data object`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const output: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string" || !fields.includes(key))
      throw new Error(`${label} contains an unsupported field`);
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor))
      throw new Error(`${label} must not contain accessors`);
    output[key] = descriptor.value;
  }
  return output;
}

/** Normalizes only supplied metadata. It never grants archive or hash verification claims. */
export function normalizeJarInventory(input: unknown): JarInventory {
  const value = record(input, ["schemaVersion", "scanComplete", "records"], "JAR inventory");
  if (value.schemaVersion !== 1 || typeof value.scanComplete !== "boolean")
    throw new Error("JAR inventory requires schemaVersion 1 and boolean scanComplete");
  if (
    !Array.isArray(value.records) ||
    nodeTypes.isProxy(value.records) ||
    value.records.length > jarInventoryLimits.maxRecords
  )
    throw new Error("JAR inventory records must be a bounded array");
  const records: JarInventoryRecord[] = [],
    names = new Set<string>();
  for (let index = 0; index < value.records.length; index += 1) {
    const element = Object.getOwnPropertyDescriptor(value.records, index);
    if (!element || !("value" in element))
      throw new Error("JAR inventory records must not contain holes or accessors");
    const entry = record(
      element.value,
      ["archiveName", "platform", "id", "version", "sha256", "byteLength", "metadataIssue"],
      "JAR inventory record",
    );
    if (!archiveName(entry.archiveName) || names.has(entry.archiveName))
      throw new Error("JAR inventory archive names must be safe unique .jar basenames");
    if (entry.platform !== null && !platforms.has(entry.platform as JarInventoryPlatform))
      throw new Error("JAR inventory platform must be fabric, paper, velocity or null");
    if (
      entry.id !== null &&
      (!safeText(entry.id, jarInventoryLimits.maxIdCharacters) || entry.platform === null)
    )
      throw new Error("JAR inventory id requires bounded text and a platform");
    if (entry.version !== null && !safeText(entry.version, jarInventoryLimits.maxVersionCharacters))
      throw new Error("JAR inventory version must be bounded text or null");
    if (
      entry.sha256 !== null &&
      (typeof entry.sha256 !== "string" || !/^[a-fA-F0-9]{64}$/u.test(entry.sha256))
    )
      throw new Error("JAR inventory sha256 must be a 64-digit hexadecimal digest or null");
    if (
      entry.byteLength !== null &&
      (typeof entry.byteLength !== "number" ||
        !Number.isSafeInteger(entry.byteLength) ||
        entry.byteLength < 0 ||
        entry.byteLength > jarInventoryLimits.maxArchiveBytes)
    )
      throw new Error("JAR inventory byteLength must be bounded non-negative bytes or null");
    if (entry.metadataIssue !== null && !issues.has(entry.metadataIssue as JarInventoryIssue))
      throw new Error("JAR inventory metadataIssue is unsupported");
    names.add(entry.archiveName);
    records.push({
      archiveName: entry.archiveName,
      platform: entry.platform as JarInventoryPlatform | null,
      id: entry.id as string | null,
      version: entry.version as string | null,
      sha256: typeof entry.sha256 === "string" ? entry.sha256.toLowerCase() : null,
      byteLength: entry.byteLength as number | null,
      metadataIssue: entry.metadataIssue as JarInventoryIssue | null,
    });
  }
  return {
    schemaVersion: 1,
    scanComplete: value.scanComplete,
    records: records.sort((a, b) => compareText(a.archiveName, b.archiveName)),
  };
}

/** Hashes a bounded archive and reuses platform descriptor parsers; no classes are loaded. */
export function inspectJarInventoryRecord(name: string, bytes: Uint8Array): JarInventoryRecord {
  if (!archiveName(name)) throw new Error("JAR inventory requires a safe logical .jar basename");
  if (nodeTypes.isProxy(bytes) || !(bytes instanceof Uint8Array))
    throw new Error("JAR inventory requires Uint8Array bytes");
  const result: JarInventoryRecord = {
    archiveName: name,
    platform: null,
    id: null,
    version: null,
    sha256: null,
    byteLength: null,
    metadataIssue: null,
  };
  if (bytes.byteLength > jarInventoryLimits.maxArchiveBytes)
    return { ...result, metadataIssue: "archive-limit" };
  result.byteLength = bytes.byteLength;
  result.sha256 = createHash("sha256").update(bytes).digest("hex");
  try {
    const zip = openZipArchive(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    if (zip.entries.length > jarInventoryLimits.maxArchiveEntries)
      return { ...result, metadataIssue: "archive-limit" };
    const paths = new Set(
      zip.entries.filter((entry) => !entry.directory).map((entry) => entry.name),
    );
    const detected: JarInventoryPlatform[] = [
      ...(paths.has("fabric.mod.json") ? ["fabric" as const] : []),
      ...(paths.has("plugin.yml") || paths.has("paper-plugin.yml") ? ["paper" as const] : []),
      ...(paths.has("velocity-plugin.json") ? ["velocity" as const] : []),
    ];
    if (detected.length !== 1)
      return {
        ...result,
        metadataIssue:
          detected.length === 0 ? "descriptor-missing" : "multiple-platform-descriptors",
      };
    result.platform = detected[0] ?? null;
    if (result.platform === "fabric") {
      const inspected = validateFabricModJar(bytes, {
        limits: { maxArchiveBytes: jarInventoryLimits.maxArchiveBytes },
      });
      result.id =
        inspected.mod?.id && /^[a-z][a-z0-9_-]{1,63}$/u.test(inspected.mod.id)
          ? inspected.mod.id
          : null;
      result.version = inspected.mod?.version ?? null;
    } else if (result.platform === "paper") {
      const inspected = validatePaperPluginJar({ archive: bytes });
      const active = inspected.descriptors.find(
        (descriptor) =>
          descriptor.role === "active" &&
          descriptor.contentIntegrityValidated &&
          descriptor.yamlValidated,
      );
      result.id = active?.identity?.id ?? null;
      result.version = active?.identity?.version ?? null;
    } else if (result.platform === "velocity") {
      const inspected = validateVelocityPluginJar({ archive: bytes });
      if (inspected.descriptor.contentIntegrityValidated && inspected.descriptor.jsonValidated) {
        result.id = inspected.descriptor.id;
        result.version = inspected.descriptor.version;
      }
    }
    if (!safeText(result.id, jarInventoryLimits.maxIdCharacters)) result.id = null;
    if (!safeText(result.version, jarInventoryLimits.maxVersionCharacters)) result.version = null;
    if (result.id === null) result.metadataIssue = "identity-unavailable";
    return result;
  } catch {
    return { ...result, id: null, version: null, metadataIssue: "archive-unreadable" };
  }
}

function identityKey(entry: JarInventoryRecord): string | null {
  return entry.platform !== null && entry.id !== null
    ? JSON.stringify([entry.platform, entry.id])
    : null;
}
function groups(inventory: JarInventory): Map<string, JarInventoryRecord[]> {
  const result = new Map<string, JarInventoryRecord[]>();
  for (const entry of inventory.records) {
    const key = identityKey(entry);
    if (key === null) continue;
    const group = result.get(key) ?? [];
    group.push(entry);
    result.set(key, group);
  }
  return result;
}
function summary(
  inventory: JarInventory,
  identified: Map<string, JarInventoryRecord[]>,
): JarInventorySummary {
  const duplicates = [...identified.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      platform: group[0]?.platform as JarInventoryPlatform,
      id: group[0]?.id as string,
      archiveNames: group.map((entry) => entry.archiveName),
    }))
    .sort((a, b) => compareText(a.platform, b.platform) || compareText(a.id, b.id));
  return {
    recordCount: inventory.records.length,
    scanComplete: inventory.scanComplete,
    identityComplete: inventory.records.every((entry) => identityKey(entry) !== null),
    unknownHashCount: inventory.records.filter((entry) => entry.sha256 === null).length,
    unknownVersionCount: inventory.records.filter((entry) => entry.version === null).length,
    duplicateIdentityCount: duplicates.length,
    duplicates: duplicates.slice(0, jarInventoryLimits.maxOutputEntries),
    duplicatesTruncated: duplicates.length > jarInventoryLimits.maxOutputEntries,
  };
}
export function summarizeJarInventory(input: unknown): JarInventorySummary {
  const inventory = normalizeJarInventory(input);
  return summary(inventory, groups(inventory));
}

/** Compares extracted inventories, never interpreting missing evidence as a content change. */
export function compareJarInventories(input: {
  left: JarInventory;
  right: JarInventory;
}): JarInventoryComparison {
  const args = record(input, ["left", "right"], "JAR inventory comparison");
  const left = normalizeJarInventory(args.left),
    right = normalizeJarInventory(args.right);
  const leftGroups = groups(left),
    rightGroups = groups(right);
  const leftSummary = summary(left, leftGroups),
    rightSummary = summary(right, rightGroups);
  const added: JarInventoryRecord[] = [],
    removed: JarInventoryRecord[] = [];
  const changed: JarInventoryPair[] = [],
    unresolved: JarInventoryPair[] = [];
  const ambiguous: JarInventoryComparison["ambiguous"] = [],
    unidentified: JarInventoryComparison["unidentified"] = [],
    unmatched: JarInventoryComparison["unmatched"] = [];
  let unchanged = 0;
  for (const key of [...new Set([...leftGroups.keys(), ...rightGroups.keys()])].sort(compareText)) {
    const a = leftGroups.get(key) ?? [],
      b = rightGroups.get(key) ?? [];
    const sample = a[0] ?? b[0];
    if (!sample?.platform || sample.id === null) continue;
    if (a.length > 1 || b.length > 1) {
      ambiguous.push({
        platform: sample.platform,
        id: sample.id,
        left: a.map((entry) => entry.archiveName),
        right: b.map((entry) => entry.archiveName),
      });
      continue;
    }
    const before = a[0],
      after = b[0];
    if (!before && after) {
      if (leftSummary.scanComplete && leftSummary.identityComplete) added.push(after);
      else
        unmatched.push({
          side: "right",
          record: after,
          reason: "opposite-inventory-incomplete-or-unidentified",
        });
      continue;
    }
    if (before && !after) {
      if (rightSummary.scanComplete && rightSummary.identityComplete) removed.push(before);
      else
        unmatched.push({
          side: "left",
          record: before,
          reason: "opposite-inventory-incomplete-or-unidentified",
        });
      continue;
    }
    if (!before || !after) continue;
    const pair: JarInventoryPair = {
      platform: sample.platform,
      id: sample.id,
      left: before,
      right: after,
      contentChanged:
        before.sha256 !== null && after.sha256 !== null ? before.sha256 !== after.sha256 : null,
      versionChanged:
        before.version !== null && after.version !== null ? before.version !== after.version : null,
      archiveNameChanged: before.archiveName !== after.archiveName,
    };
    if (pair.contentChanged === true || pair.versionChanged === true || pair.archiveNameChanged)
      changed.push(pair);
    if (pair.contentChanged === null) unresolved.push(pair);
    else if (
      pair.contentChanged === false &&
      pair.versionChanged !== true &&
      !pair.archiveNameChanged
    )
      unchanged += 1;
  }
  for (const [side, inventory] of [
    ["left", left],
    ["right", right],
  ] as const)
    for (const entry of inventory.records) {
      if (identityKey(entry) === null) unidentified.push({ side, record: entry });
    }
  const comparisonComplete =
    left.scanComplete &&
    right.scanComplete &&
    ambiguous.length === 0 &&
    unidentified.length === 0 &&
    unmatched.length === 0 &&
    unresolved.length === 0 &&
    leftSummary.unknownHashCount === 0 &&
    rightSummary.unknownHashCount === 0;
  const differences = added.length > 0 || removed.length > 0 || changed.length > 0;
  const bounded = <T>(values: T[]) => values.slice(0, jarInventoryLimits.maxOutputEntries);
  return {
    schemaVersion: 1,
    kind: "jar-inventory-comparison",
    evidenceStrength: "supplied-metadata",
    comparisonComplete,
    hasDifferences: differences ? true : comparisonComplete ? false : null,
    inventories: { left: leftSummary, right: rightSummary },
    counts: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged,
      unresolved: unresolved.length,
      ambiguous: ambiguous.length,
      unidentified: unidentified.length,
      unmatched: unmatched.length,
    },
    added: bounded(added),
    removed: bounded(removed),
    changed: bounded(changed),
    unresolved: bounded(unresolved),
    ambiguous: bounded(ambiguous),
    unidentified: bounded(unidentified),
    unmatched: bounded(unmatched),
    outputTruncated: [added, removed, changed, unresolved, ambiguous, unidentified, unmatched].some(
      (values) => values.length > jarInventoryLimits.maxOutputEntries,
    ),
    nonClaims: [
      "Inventories and digest values are supplied metadata; this comparison reads no files and verifies no bytes.",
      "Only known digest inequality proves a content change relative to the supplied hashes. Missing hashes or versions do not prove changes.",
      "Matching uses exact platform and declared ID, not loader alias resolution, filesystem case rules or dependency identities.",
      "Nested JAR contents, dependency graphs, load order, authenticity and runtime/Minecraft compatibility are not established.",
    ],
  };
}
