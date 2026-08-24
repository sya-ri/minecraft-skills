import { openZipArchive, type ZipArchive, type ZipEntry } from "@minecraft-skills/data";
import { javaBinaryNameToClassEntryPath } from "./javaClassArchive.js";
import {
  inspectJavaClassFile,
  type JavaClassFileEvidence,
  type ParsedClassAnnotation,
  velocityPluginClassFileLimits,
} from "./velocityPluginClassFile.js";

const descriptorPath = "velocity-plugin.json";
const foreignDescriptorPaths = new Set(["paper-plugin.yml", "plugin.yml", "bungee.yml"]);
const pluginAnnotationDescriptor = "Lcom/velocitypowered/api/plugin/Plugin;";
const dependencyAnnotationDescriptor = "Lcom/velocitypowered/api/plugin/Dependency;";
const velocityPluginId = /^[a-z][a-z0-9-_]{0,63}$/u;
const currentVelocityMinimumJavaRelease = 25;

/** Hard ceilings for untrusted Velocity descriptors, archive metadata, and entrypoint classes. */
export const velocityPluginJarValidationLimits = {
  maxArchiveBytes: 64 * 1024 * 1024,
  maxArchiveEntries: 16_384,
  maxEntryPathCharacters: 1_024,
  maxEntryUncompressedBytes: 128 * 1024 * 1024,
  maxTotalUncompressedBytes: 512 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxDescriptorBytes: 256 * 1024,
  maxDescriptorCharacters: 256 * 1024,
  maxJsonDepth: 32,
  maxJsonNodes: 20_000,
  maxCollectionEntries: 2_048,
  maxScalarCharacters: 65_536,
  maxDiagnostics: 200,
  defaultTargetJavaRelease: currentVelocityMinimumJavaRelease,
  minTargetJavaRelease: currentVelocityMinimumJavaRelease,
  maxTargetJavaRelease: 100,
  maxEntrypointClassBytes: velocityPluginClassFileLimits.maxBytes,
} as const;

export type VelocityPluginJarDiagnosticSeverity = "error" | "warning" | "unknown";
export type VelocityPluginJarValidationStrength = "binary" | "metadata";

export type VelocityPluginArchiveEntry = {
  path: string;
  size: number;
  compressedSize?: number;
  directory?: boolean;
};

export type ValidateVelocityPluginArchiveMetadataOptions = {
  descriptor: unknown;
  archiveEntries: readonly VelocityPluginArchiveEntry[];
  archiveEntriesComplete: boolean;
};

export type ValidateVelocityPluginJarOptions = {
  archive: Uint8Array;
  /** Java runtime release used for the classfile ceiling. Defaults to Velocity 4's Java 25 floor. */
  targetJavaRelease?: number;
};

export type VelocityPluginJarDiagnostic = {
  severity: VelocityPluginJarDiagnosticSeverity;
  code: string;
  path: string;
  message: string;
};

export type VelocityPluginJarValidationResult = {
  schemaVersion: 1;
  specification: {
    descriptor: string;
    loader: string;
    javaRuntime: string;
    classFile: string;
    currentVelocityMinimumJavaRelease: number;
  };
  valid: boolean;
  validationComplete: boolean;
  validationStrength: VelocityPluginJarValidationStrength;
  errorCount: number;
  warningCount: number;
  unknownCount: number;
  diagnosticsTruncated: boolean;
  omittedDiagnosticCount: number;
  incompleteReasons: string[];
  archive: {
    bytes: number | null;
    entriesInspected: number;
    entryListComplete: boolean;
    zipStructureValidated: boolean;
    allEntryContentIntegrityValidated: false;
    descriptorObserved: boolean;
  };
  descriptor: {
    entryObserved: boolean;
    contentProvided: boolean;
    contentIntegrityValidated: boolean;
    inputKind: "text" | "object" | null;
    duplicateKeysChecked: boolean;
    jsonValidated: boolean;
    unknownFieldCount: number;
    id: string | null;
    main: string | null;
    dependencyCount: number;
    providedIdCount: number;
  };
  entrypoint: {
    path: string | null;
    entryObserved: boolean;
    entryPresenceProven: boolean;
    contentIntegrityValidated: boolean;
    classFileHeaderValidated: boolean;
    declaredInternalNameMatched: boolean | null;
    majorVersion: number | null;
    minorVersion: number | null;
    javaRelease: number | null;
    preview: boolean | null;
    targetJavaRelease: number;
    targetCompatible: boolean | null;
    pluginAnnotationObserved: boolean | null;
    pluginAnnotationParsed: boolean;
    annotationMatchesDescriptor: boolean | null;
  };
  diagnostics: VelocityPluginJarDiagnostic[];
};

type NormalizedArchiveEntry = {
  path: string;
  size: number;
  compressedSize: number | null;
  directory: boolean;
};

type ParsedVelocityDependency = {
  id: string;
  optional: boolean;
};

type ParsedVelocityDescriptor = {
  id: string;
  main: string;
  name: string;
  version: string;
  description: string;
  url: string;
  authors: string[];
  dependencies: ParsedVelocityDependency[];
  provides: string[];
  unknownFieldCount: number;
};

type ParsedVelocityDescriptorResult = {
  descriptor: ParsedVelocityDescriptor | null;
  inputKind: "text" | "object";
  duplicateKeysChecked: boolean;
};

type EntryPointSummary = VelocityPluginJarValidationResult["entrypoint"];
type DescriptorSummary = VelocityPluginJarValidationResult["descriptor"];

class BoundedInputError extends Error {}

class DiagnosticCollector {
  readonly diagnostics: VelocityPluginJarDiagnostic[] = [];
  errorCount = 0;
  warningCount = 0;
  unknownCount = 0;

  add(
    severity: VelocityPluginJarDiagnosticSeverity,
    code: string,
    path: string,
    message: string,
  ): void {
    if (severity === "error") this.errorCount += 1;
    else if (severity === "warning") this.warningCount += 1;
    else this.unknownCount += 1;
    if (this.diagnostics.length < velocityPluginJarValidationLimits.maxDiagnostics) {
      this.diagnostics.push({ severity, code, path, message });
    }
  }

  finish(): {
    diagnostics: VelocityPluginJarDiagnostic[];
    diagnosticsTruncated: boolean;
    omittedDiagnosticCount: number;
  } {
    const rank: Record<VelocityPluginJarDiagnosticSeverity, number> = {
      error: 0,
      warning: 1,
      unknown: 2,
    };
    const diagnostics = [...this.diagnostics].sort(
      (left, right) =>
        rank[left.severity] - rank[right.severity] ||
        left.path.localeCompare(right.path) ||
        left.code.localeCompare(right.code),
    );
    const total = this.errorCount + this.warningCount + this.unknownCount;
    return {
      diagnostics,
      diagnosticsTruncated: diagnostics.length < total,
      omittedDiagnosticCount: Math.max(0, total - diagnostics.length),
    };
  }
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || (0x7f <= codePoint && codePoint <= 0x9f)) return true;
  }
  return false;
}

function dataPropertyDescriptors(value: unknown): Record<string, PropertyDescriptor> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Object.values(descriptors).some(
      (descriptor) => !("value" in descriptor) || !descriptor.enumerable,
    )
  )
    return null;
  return descriptors;
}

function validateArrayOwnProperties(value: unknown[]): void {
  if (Object.getOwnPropertySymbols(value).length > 0) throw new BoundedInputError();
  for (const key of Object.getOwnPropertyNames(value)) {
    if (key === "length") continue;
    if (!/^(?:0|[1-9]\d*)$/u.test(key) || value.length <= Number(key)) {
      throw new BoundedInputError();
    }
  }
}

function cloneBoundedJson(value: unknown): unknown {
  const seen = new Set<object>();
  const state = { nodes: 0, characters: 0, utf8Bytes: 0 };

  const clone = (candidate: unknown, depth: number): unknown => {
    state.nodes += 1;
    if (
      state.nodes > velocityPluginJarValidationLimits.maxJsonNodes ||
      depth > velocityPluginJarValidationLimits.maxJsonDepth
    ) {
      throw new BoundedInputError();
    }
    if (typeof candidate === "string") {
      state.characters += candidate.length;
      state.utf8Bytes += Buffer.byteLength(candidate, "utf8");
      if (
        candidate.length > velocityPluginJarValidationLimits.maxScalarCharacters ||
        state.characters > velocityPluginJarValidationLimits.maxDescriptorCharacters ||
        state.utf8Bytes > velocityPluginJarValidationLimits.maxDescriptorBytes
      ) {
        throw new BoundedInputError();
      }
      return candidate;
    }
    if (
      candidate === null ||
      typeof candidate === "boolean" ||
      (typeof candidate === "number" && Number.isFinite(candidate))
    ) {
      return candidate;
    }
    if (typeof candidate !== "object") throw new BoundedInputError();
    if (seen.has(candidate)) throw new BoundedInputError();
    seen.add(candidate);

    if (Array.isArray(candidate)) {
      validateArrayOwnProperties(candidate);
      if (candidate.length > velocityPluginJarValidationLimits.maxCollectionEntries) {
        throw new BoundedInputError();
      }
      const result: unknown[] = [];
      for (let index = 0; index < candidate.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(candidate, index);
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          throw new BoundedInputError();
        }
        result.push(clone(descriptor.value, depth + 1));
      }
      return result;
    }

    const descriptors = dataPropertyDescriptors(candidate);
    if (descriptors === null) throw new BoundedInputError();
    const entries = Object.entries(descriptors);
    if (entries.length > velocityPluginJarValidationLimits.maxCollectionEntries) {
      throw new BoundedInputError();
    }
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, descriptor] of entries) {
      state.characters += key.length;
      state.utf8Bytes += Buffer.byteLength(key, "utf8");
      if (
        key.length > velocityPluginJarValidationLimits.maxScalarCharacters ||
        state.characters > velocityPluginJarValidationLimits.maxDescriptorCharacters ||
        state.utf8Bytes > velocityPluginJarValidationLimits.maxDescriptorBytes
      ) {
        throw new BoundedInputError();
      }
      result[key] = clone(descriptor.value, depth + 1);
    }
    return result;
  };

  return clone(value, 0);
}

type ParsedDescriptorInput =
  | {
      ok: true;
      value: unknown;
      inputKind: "text" | "object";
      duplicateKeysChecked: boolean;
    }
  | {
      ok: false;
      inputKind: "text" | "object";
      duplicateKeysChecked: boolean;
    };

function hasDuplicateJsonObjectKey(input: string): boolean {
  type Frame = { kind: "array" } | { kind: "object"; expectingKey: boolean; keys: Set<string> };
  const stack: Frame[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      const start = index;
      index += 1;
      for (; index < input.length; index += 1) {
        const stringCharacter = input[index];
        if (stringCharacter === "\\") {
          index += 1;
          continue;
        }
        if (stringCharacter === '"') break;
      }
      const frame = stack.at(-1);
      if (frame?.kind === "object" && frame.expectingKey && index < input.length) {
        let key: unknown;
        try {
          key = JSON.parse(input.slice(start, index + 1));
        } catch {
          continue;
        }
        if (typeof key === "string") {
          if (frame.keys.has(key)) return true;
          frame.keys.add(key);
          frame.expectingKey = false;
        }
      }
      continue;
    }
    if (character === "{") {
      stack.push({ kind: "object", expectingKey: true, keys: new Set() });
    } else if (character === "[") {
      stack.push({ kind: "array" });
    } else if (character === "}" || character === "]") {
      stack.pop();
    } else if (character === ",") {
      const frame = stack.at(-1);
      if (frame?.kind === "object") frame.expectingKey = true;
    }
    if (stack.length > velocityPluginJarValidationLimits.maxJsonDepth + 1) {
      throw new BoundedInputError();
    }
  }
  return false;
}

function parseDescriptorInput(
  input: unknown,
  collector: DiagnosticCollector,
): ParsedDescriptorInput {
  let parsed = input;
  const inputKind = typeof input === "string" ? "text" : "object";
  let duplicateKeysChecked = false;
  if (typeof input === "string") {
    if (
      input.length > velocityPluginJarValidationLimits.maxDescriptorCharacters ||
      Buffer.byteLength(input, "utf8") > velocityPluginJarValidationLimits.maxDescriptorBytes
    ) {
      collector.add(
        "error",
        "descriptor.input-limit",
        "/descriptor",
        "Descriptor input exceeds the bounded UTF-8 JSON limit.",
      );
      return { ok: false, inputKind, duplicateKeysChecked };
    }
    try {
      const duplicateKeyObserved = hasDuplicateJsonObjectKey(input);
      duplicateKeysChecked = true;
      if (duplicateKeyObserved) {
        collector.add(
          "error",
          "descriptor.duplicate-key",
          "/descriptor",
          "Descriptor JSON must not contain duplicate object keys.",
        );
        return { ok: false, inputKind, duplicateKeysChecked };
      }
    } catch {
      collector.add(
        "error",
        "descriptor.complexity-limit",
        "/descriptor",
        "Descriptor JSON nesting exceeds the bounded parsing limit.",
      );
      return { ok: false, inputKind, duplicateKeysChecked };
    }
    try {
      parsed = JSON.parse(input);
    } catch {
      collector.add(
        "error",
        "descriptor.invalid-json",
        "/descriptor",
        "Descriptor is not valid JSON.",
      );
      return { ok: false, inputKind, duplicateKeysChecked };
    }
  }
  try {
    return {
      ok: true,
      value: cloneBoundedJson(parsed),
      inputKind,
      duplicateKeysChecked,
    };
  } catch {
    collector.add(
      "error",
      "descriptor.complexity-limit",
      "/descriptor",
      "Descriptor is not bounded plain JSON data within the supported complexity limits.",
    );
    return { ok: false, inputKind, duplicateKeysChecked };
  }
}

function archiveEntryPathProblem(path: string): string | null {
  if (!path) return "Archive entry paths must not be empty.";
  if (path.length > velocityPluginJarValidationLimits.maxEntryPathCharacters) {
    return `Archive entry paths must not exceed ${velocityPluginJarValidationLimits.maxEntryPathCharacters} characters.`;
  }
  if (hasControlCharacter(path)) return "Archive entry paths must not contain control characters.";
  if (path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:/u.test(path)) {
    return "Archive entry paths must be relative.";
  }
  if (path.includes("\\")) return "Archive entry paths must use forward slashes.";
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  if (!normalized) return "Archive entries must identify a path below the root.";
  if (normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return "Archive entry paths must be normalized without empty, dot, or parent segments.";
  }
  return null;
}

function validSize(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && 0 <= value && value <= maximum;
}

function normalizeArchiveEntries(
  input: unknown,
  collector: DiagnosticCollector,
): { entries: NormalizedArchiveEntry[]; evidenceComplete: boolean } {
  if (!Array.isArray(input)) {
    collector.add(
      "error",
      "archive.entries-type",
      "/archiveEntries",
      "archiveEntries must be an array.",
    );
    return { entries: [], evidenceComplete: false };
  }
  try {
    validateArrayOwnProperties(input);
  } catch {
    collector.add(
      "error",
      "archive.entries-data",
      "/archiveEntries",
      "archiveEntries must be a dense JSON-data array without extra properties.",
    );
    return { entries: [], evidenceComplete: false };
  }
  let evidenceComplete = input.length <= velocityPluginJarValidationLimits.maxArchiveEntries;
  if (!evidenceComplete) {
    collector.add(
      "error",
      "archive.entry-limit",
      "/archiveEntries",
      `Archive entry count exceeds the ${velocityPluginJarValidationLimits.maxArchiveEntries}-entry limit.`,
    );
  }

  const entries: NormalizedArchiveEntry[] = [];
  const exactPaths = new Set<string>();
  const portablePaths = new Map<string, string>();
  let totalUncompressedBytes = 0;
  for (
    let index = 0;
    index < Math.min(input.length, velocityPluginJarValidationLimits.maxArchiveEntries);
    index += 1
  ) {
    const itemDescriptor = Object.getOwnPropertyDescriptor(input, index);
    const pointer = `/archiveEntries/${index}`;
    if (
      itemDescriptor === undefined ||
      !("value" in itemDescriptor) ||
      !itemDescriptor.enumerable
    ) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.entry-data",
        pointer,
        "Archive entries must be JSON data properties.",
      );
      continue;
    }
    const descriptors = dataPropertyDescriptors(itemDescriptor.value);
    if (descriptors === null) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.entry-type",
        pointer,
        "Archive entries must be plain data objects.",
      );
      continue;
    }
    if (
      Object.keys(descriptors).some(
        (key) => !["path", "size", "compressedSize", "directory"].includes(key),
      )
    ) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.entry-field",
        pointer,
        "Archive entries contain an unsupported field.",
      );
    }
    const path = descriptors.path?.value;
    const size = descriptors.size?.value;
    const compressedSize = descriptors.compressedSize?.value;
    const suppliedDirectory = descriptors.directory?.value;
    if (typeof path !== "string") {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.path-type",
        `${pointer}/path`,
        "Archive entry path must be a string.",
      );
      continue;
    }
    const pathProblem = archiveEntryPathProblem(path);
    if (pathProblem !== null) {
      evidenceComplete = false;
      collector.add("error", "archive.unsafe-path", `${pointer}/path`, pathProblem);
      continue;
    }
    if (!validSize(size, velocityPluginJarValidationLimits.maxEntryUncompressedBytes)) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.entry-size",
        `${pointer}/size`,
        `Archive entry size must be a non-negative safe integer no greater than ${velocityPluginJarValidationLimits.maxEntryUncompressedBytes}.`,
      );
      continue;
    }
    if (
      compressedSize !== undefined &&
      !validSize(compressedSize, velocityPluginJarValidationLimits.maxArchiveBytes)
    ) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.compressed-size",
        `${pointer}/compressedSize`,
        "Compressed size is outside the supported archive range.",
      );
      continue;
    }
    if (suppliedDirectory !== undefined && typeof suppliedDirectory !== "boolean") {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.directory-type",
        `${pointer}/directory`,
        "Archive entry directory must be a boolean.",
      );
      continue;
    }
    const directory = suppliedDirectory ?? path.endsWith("/");
    if (path.endsWith("/") !== directory) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.directory-mismatch",
        pointer,
        "Archive directory metadata must agree with a trailing slash.",
      );
      continue;
    }
    const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
    const exactKey = normalized.normalize("NFC");
    const portableKey = exactKey.toLowerCase().normalize("NFC");
    if (exactPaths.has(exactKey)) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.duplicate-path",
        `${pointer}/path`,
        "Archive contains a duplicate normalized entry path.",
      );
      continue;
    }
    const priorPortable = portablePaths.get(portableKey);
    if (priorPortable !== undefined && priorPortable !== exactKey) {
      collector.add(
        "warning",
        "archive.portable-path-conflict",
        `${pointer}/path`,
        "Archive paths differ only by case or Unicode normalization.",
      );
    }
    exactPaths.add(exactKey);
    portablePaths.set(portableKey, exactKey);
    totalUncompressedBytes += size;
    if (totalUncompressedBytes > velocityPluginJarValidationLimits.maxTotalUncompressedBytes) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.total-size",
        pointer,
        "Archive total declared uncompressed size exceeds the bounded limit.",
      );
      break;
    }
    const normalizedCompressedSize = typeof compressedSize === "number" ? compressedSize : null;
    if (normalizedCompressedSize !== null && size > 0) {
      const ratio =
        normalizedCompressedSize === 0 ? Number.POSITIVE_INFINITY : size / normalizedCompressedSize;
      if (ratio > velocityPluginJarValidationLimits.maxCompressionRatio) {
        evidenceComplete = false;
        collector.add(
          "error",
          "archive.compression-ratio",
          pointer,
          "Archive entry compression ratio exceeds the bounded limit.",
        );
        continue;
      }
    }
    entries.push({ path, size, compressedSize: normalizedCompressedSize, directory });
  }
  return { entries, evidenceComplete };
}

function optionalText(
  record: Record<string, unknown>,
  field: string,
  collector: DiagnosticCollector,
): string {
  const value = record[field];
  if (value === undefined || value === null) return "";
  const coerced = gsonStringPrimitive(value, `/descriptor/${field}`, collector);
  if (coerced === null) {
    collector.add(
      "error",
      "descriptor.field-type",
      `/descriptor/${field}`,
      "Descriptor text fields must be strings, loader-coercible primitives, or null.",
    );
    return "";
  }
  return coerced;
}

function gsonStringPrimitive(
  value: unknown,
  path: string,
  collector: DiagnosticCollector,
): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
    collector.add(
      "unknown",
      "descriptor.gson-string-coercion",
      path,
      "The current Gson loader may coerce this primitive to text; exact runtime deserialization was not executed.",
    );
    return String(value);
  }
  return null;
}

function stringArray(value: unknown, path: string, collector: DiagnosticCollector): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    collector.add(
      "error",
      "descriptor.array-type",
      path,
      "Descriptor collection fields must be arrays or null.",
    );
    return [];
  }
  if (value.length > velocityPluginJarValidationLimits.maxCollectionEntries) {
    collector.add(
      "error",
      "descriptor.collection-limit",
      path,
      "Descriptor collection exceeds the bounded item limit.",
    );
  }
  const result: string[] = [];
  for (
    let index = 0;
    index < Math.min(value.length, velocityPluginJarValidationLimits.maxCollectionEntries);
    index += 1
  ) {
    const item = gsonStringPrimitive(value[index], `${path}/${index}`, collector);
    if (item === null) {
      collector.add(
        "error",
        "descriptor.array-item-type",
        `${path}/${index}`,
        "Descriptor collection items must be strings or loader-coercible primitives.",
      );
      continue;
    }
    result.push(item);
  }
  return result;
}

function parseVelocityDescriptor(
  input: unknown,
  collector: DiagnosticCollector,
): ParsedVelocityDescriptorResult {
  const parsed = parseDescriptorInput(input, collector);
  if (!parsed.ok) {
    return {
      descriptor: null,
      inputKind: parsed.inputKind,
      duplicateKeysChecked: parsed.duplicateKeysChecked,
    };
  }
  const descriptors = dataPropertyDescriptors(parsed.value);
  if (descriptors === null) {
    collector.add(
      "error",
      "descriptor.root-type",
      "/descriptor",
      "Velocity descriptor JSON must be an object.",
    );
    return {
      descriptor: null,
      inputKind: parsed.inputKind,
      duplicateKeysChecked: parsed.duplicateKeysChecked,
    };
  }
  const record = Object.fromEntries(
    Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]),
  );
  const allowedFields = new Set([
    "id",
    "name",
    "version",
    "description",
    "url",
    "authors",
    "dependencies",
    "provides",
    "main",
  ]);
  const unknownFields = Object.keys(record).filter((field) => !allowedFields.has(field));
  for (const [index] of unknownFields.entries()) {
    collector.add(
      "warning",
      "descriptor.unknown-field",
      `/descriptor/<unknown-field-${index + 1}>`,
      "Velocity ignores an unrecognized descriptor field in the inspected source implementation.",
    );
  }

  const id = gsonStringPrimitive(record.id, "/descriptor/id", collector);
  if (id === null || !velocityPluginId.test(id)) {
    collector.add(
      "error",
      "descriptor.invalid-id",
      "/descriptor/id",
      "Plugin id must match [a-z][a-z0-9-_]{0,63}.",
    );
  }
  const main = gsonStringPrimitive(record.main, "/descriptor/main", collector);
  const mainPath = main === null ? null : javaBinaryNameToClassEntryPath(main);
  if (mainPath === null) {
    collector.add(
      "error",
      "descriptor.invalid-main",
      "/descriptor/main",
      "main must be a Java binary class name.",
    );
  }

  const authors = stringArray(record.authors, "/descriptor/authors", collector);
  const provides = stringArray(record.provides, "/descriptor/provides", collector);
  const providedIds = new Set<string>();
  for (const [index, provided] of provides.entries()) {
    if (!velocityPluginId.test(provided)) {
      collector.add(
        "error",
        "descriptor.invalid-provided-id",
        `/descriptor/provides/${index}`,
        "Provided plugin ids must match the Velocity id pattern.",
      );
    }
    if (providedIds.has(provided)) {
      collector.add(
        "warning",
        "descriptor.duplicate-provided-id",
        `/descriptor/provides/${index}`,
        "Provided plugin ids should not be duplicated.",
      );
    }
    providedIds.add(provided);
  }

  const dependencies: ParsedVelocityDependency[] = [];
  if (record.dependencies !== undefined && record.dependencies !== null) {
    if (!Array.isArray(record.dependencies)) {
      collector.add(
        "error",
        "descriptor.dependencies-type",
        "/descriptor/dependencies",
        "dependencies must be an array or null.",
      );
    } else {
      const dependencyIds = new Set<string>();
      for (
        let index = 0;
        index <
        Math.min(
          record.dependencies.length,
          velocityPluginJarValidationLimits.maxCollectionEntries,
        );
        index += 1
      ) {
        const dependency = record.dependencies[index];
        const fields = dataPropertyDescriptors(dependency);
        const path = `/descriptor/dependencies/${index}`;
        if (fields === null) {
          collector.add(
            "error",
            "descriptor.dependency-type",
            path,
            "Dependencies must be JSON objects.",
          );
          continue;
        }
        if (Object.keys(fields).some((field) => field !== "id" && field !== "optional")) {
          collector.add(
            "warning",
            "descriptor.dependency-field",
            path,
            "Velocity ignores an unrecognized dependency field in the inspected source implementation.",
          );
        }
        const dependencyId = gsonStringPrimitive(fields.id?.value, `${path}/id`, collector);
        if (dependencyId === null || !velocityPluginId.test(dependencyId)) {
          collector.add(
            "error",
            "descriptor.invalid-dependency-id",
            `${path}/id`,
            "Dependency id must match the Velocity id pattern.",
          );
          continue;
        }
        const suppliedOptional = fields.optional?.value;
        let optional = suppliedOptional ?? false;
        if (typeof suppliedOptional === "string") {
          collector.add(
            "unknown",
            "descriptor.gson-boolean-coercion",
            `${path}/optional`,
            "The current Gson loader may coerce this string to boolean; exact runtime deserialization was not executed.",
          );
          optional = suppliedOptional.toLowerCase() === "true";
        }
        if (typeof optional !== "boolean") {
          collector.add(
            "error",
            "descriptor.dependency-optional-type",
            `${path}/optional`,
            "Dependency optional must be a boolean when present.",
          );
          continue;
        }
        if (dependencyIds.has(dependencyId)) {
          collector.add(
            "warning",
            "descriptor.duplicate-dependency",
            `${path}/id`,
            "Dependency ids should not be duplicated.",
          );
        }
        dependencyIds.add(dependencyId);
        dependencies.push({ id: dependencyId, optional });
      }
    }
  }

  return {
    descriptor: {
      id: id !== null && velocityPluginId.test(id) ? id : "",
      main: main !== null && mainPath !== null ? main : "",
      name: optionalText(record, "name", collector),
      version: optionalText(record, "version", collector),
      description: optionalText(record, "description", collector),
      url: optionalText(record, "url", collector),
      authors,
      dependencies,
      provides,
      unknownFieldCount: unknownFields.length,
    },
    inputKind: parsed.inputKind,
    duplicateKeysChecked: parsed.duplicateKeysChecked,
  };
}

function annotationString(
  annotation: ParsedClassAnnotation,
  name: string,
  fallback: string,
): string | null {
  const value = annotation.values.get(name);
  if (value === undefined) return fallback;
  return value.kind === "string" ? value.value : null;
}

function annotationStringArray(annotation: ParsedClassAnnotation, name: string): string[] | null {
  const value = annotation.values.get(name);
  if (value === undefined) return [];
  if (value.kind !== "array") return null;
  const result: string[] = [];
  for (const entry of value.value) {
    if (entry.kind !== "string") return null;
    result.push(entry.value);
  }
  return result;
}

function annotationDependencies(
  annotation: ParsedClassAnnotation,
): ParsedVelocityDependency[] | null {
  const value = annotation.values.get("dependencies");
  if (value === undefined) return [];
  if (value.kind !== "array") return null;
  const result: ParsedVelocityDependency[] = [];
  for (const entry of value.value) {
    if (entry.kind !== "annotation" || entry.value.descriptor !== dependencyAnnotationDescriptor)
      return null;
    const id = annotationString(entry.value, "id", "");
    const optionalValue = entry.value.values.get("optional");
    const optional =
      optionalValue === undefined
        ? false
        : optionalValue.kind === "integer"
          ? optionalValue.value !== 0
          : null;
    if (id === null || optional === null) return null;
    result.push({ id, optional });
  }
  return result;
}

function equalStringArrays(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function equalDependencies(
  left: readonly ParsedVelocityDependency[],
  right: readonly ParsedVelocityDependency[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => {
      const other = right[index];
      return other !== undefined && value.id === other.id && value.optional === other.optional;
    })
  );
}

function comparePluginAnnotation(
  evidence: JavaClassFileEvidence,
  descriptor: ParsedVelocityDescriptor,
  collector: DiagnosticCollector,
): Pick<
  EntryPointSummary,
  "pluginAnnotationObserved" | "pluginAnnotationParsed" | "annotationMatchesDescriptor"
> {
  const annotations = evidence.runtimeVisibleAnnotations.filter(
    (annotation) => annotation.descriptor === pluginAnnotationDescriptor,
  );
  if (annotations.length === 0) {
    collector.add(
      "warning",
      "annotation.missing",
      "/entrypoint",
      "The entrypoint class has no runtime-visible Velocity @Plugin annotation; runtime loading was not attempted.",
    );
    return {
      pluginAnnotationObserved: false,
      pluginAnnotationParsed: true,
      annotationMatchesDescriptor: null,
    };
  }
  if (annotations.length !== 1) {
    collector.add(
      "error",
      "annotation.duplicate",
      "/entrypoint",
      "The entrypoint class contains multiple runtime-visible Velocity @Plugin annotations.",
    );
    return {
      pluginAnnotationObserved: true,
      pluginAnnotationParsed: false,
      annotationMatchesDescriptor: null,
    };
  }
  const annotation = annotations[0];
  if (annotation === undefined) {
    return {
      pluginAnnotationObserved: true,
      pluginAnnotationParsed: false,
      annotationMatchesDescriptor: null,
    };
  }
  const allowed = new Set([
    "id",
    "name",
    "version",
    "description",
    "url",
    "authors",
    "dependencies",
    "provides",
  ]);
  if ([...annotation.values.keys()].some((field) => !allowed.has(field))) {
    collector.add(
      "warning",
      "annotation.unknown-field",
      "/entrypoint",
      "The @Plugin annotation contains a field outside the inspected current API surface.",
    );
  }
  const id = annotationString(annotation, "id", "");
  const name = annotationString(annotation, "name", "");
  const version = annotationString(annotation, "version", "");
  const description = annotationString(annotation, "description", "");
  const url = annotationString(annotation, "url", "");
  const authors =
    annotationStringArray(annotation, "authors")?.filter((author) => author !== "") ?? null;
  const provides =
    annotationStringArray(annotation, "provides")?.filter((provided) => provided !== "") ?? null;
  const dependencies = annotationDependencies(annotation);
  if (
    [id, name, version, description, url, authors, provides, dependencies].some(
      (value) => value === null,
    )
  ) {
    collector.add(
      "warning",
      "annotation.unsupported-shape",
      "/entrypoint",
      "The @Plugin annotation could not be compared within the supported bounded value shapes.",
    );
    return {
      pluginAnnotationObserved: true,
      pluginAnnotationParsed: false,
      annotationMatchesDescriptor: null,
    };
  }
  const matches =
    id === descriptor.id &&
    name === descriptor.name &&
    version === descriptor.version &&
    description === descriptor.description &&
    url === descriptor.url &&
    equalStringArrays(authors as string[], descriptor.authors) &&
    equalStringArrays(provides as string[], descriptor.provides) &&
    equalDependencies(dependencies as ParsedVelocityDependency[], descriptor.dependencies);
  if (!matches) {
    collector.add(
      "warning",
      "annotation.metadata-mismatch",
      "/entrypoint",
      "Runtime-visible @Plugin metadata differs from velocity-plugin.json; Velocity loader behavior was not executed.",
    );
  }
  return {
    pluginAnnotationObserved: true,
    pluginAnnotationParsed: true,
    annotationMatchesDescriptor: matches,
  };
}

function defaultEntrypointSummary(targetJavaRelease: number): EntryPointSummary {
  return {
    path: null,
    entryObserved: false,
    entryPresenceProven: false,
    contentIntegrityValidated: false,
    classFileHeaderValidated: false,
    declaredInternalNameMatched: null,
    majorVersion: null,
    minorVersion: null,
    javaRelease: null,
    preview: null,
    targetJavaRelease,
    targetCompatible: null,
    pluginAnnotationObserved: null,
    pluginAnnotationParsed: false,
    annotationMatchesDescriptor: null,
  };
}

function inspectEntrypointClass(
  bytes: Uint8Array,
  expectedPath: string,
  descriptor: ParsedVelocityDescriptor,
  targetJavaRelease: number,
  collector: DiagnosticCollector,
): EntryPointSummary {
  const summary = {
    ...defaultEntrypointSummary(targetJavaRelease),
    path: expectedPath,
    entryObserved: true,
    entryPresenceProven: true,
    contentIntegrityValidated: true,
  };
  let evidence: JavaClassFileEvidence;
  try {
    evidence = inspectJavaClassFile(bytes);
  } catch {
    collector.add(
      "error",
      "class.invalid-format",
      "/entrypoint",
      "Entrypoint bytes are not a bounded structurally readable Java classfile.",
    );
    return summary;
  }
  const expectedInternalName = expectedPath.slice(0, -".class".length);
  const nameMatched = evidence.declaredInternalName === expectedInternalName;
  if (!nameMatched) {
    collector.add(
      "error",
      "class.declared-name-mismatch",
      "/entrypoint",
      "Entrypoint classfile identity does not match its declared JAR path.",
    );
  }
  const javaRelease = evidence.majorVersion >= 45 ? evidence.majorVersion - 44 : null;
  const preview = evidence.minorVersion === 0xffff;
  const targetMajor = targetJavaRelease + 44;
  let targetCompatible: boolean | null =
    javaRelease !== null && evidence.majorVersion <= targetMajor;
  if (evidence.majorVersion < 45) {
    collector.add(
      "error",
      "class.major-version",
      "/entrypoint",
      "Entrypoint classfile has an unsupported major version.",
    );
    targetCompatible = false;
  }
  if (evidence.majorVersion >= 56 && evidence.minorVersion !== 0 && !preview) {
    collector.add(
      "error",
      "class.minor-version",
      "/entrypoint",
      "Modern classfiles must use minor version zero or the preview marker.",
    );
    targetCompatible = false;
  }
  if (preview) {
    if (evidence.majorVersion !== targetMajor) {
      collector.add(
        "error",
        "class.preview-target",
        "/entrypoint",
        "Preview classfiles require the exact matching Java runtime release.",
      );
      targetCompatible = false;
    } else {
      collector.add(
        "warning",
        "class.preview-runtime",
        "/entrypoint",
        "Preview classfile loading also requires a matching runtime preview flag, which was not observed.",
      );
      targetCompatible = null;
    }
  } else if (evidence.majorVersion > targetMajor) {
    collector.add(
      "error",
      "class.target-too-new",
      "/entrypoint",
      "Entrypoint classfile is newer than the selected Java runtime target.",
    );
  }
  return {
    ...summary,
    classFileHeaderValidated: true,
    declaredInternalNameMatched: nameMatched,
    majorVersion: evidence.majorVersion,
    minorVersion: evidence.minorVersion,
    javaRelease,
    preview,
    targetCompatible,
    ...comparePluginAnnotation(evidence, descriptor, collector),
  };
}

function normalizeTargetJavaRelease(value: unknown, collector: DiagnosticCollector): number {
  if (value === undefined) return currentVelocityMinimumJavaRelease;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < velocityPluginJarValidationLimits.minTargetJavaRelease ||
    velocityPluginJarValidationLimits.maxTargetJavaRelease < value
  ) {
    collector.add(
      "error",
      "target.invalid-java-release",
      "/targetJavaRelease",
      `targetJavaRelease must be an integer from ${velocityPluginJarValidationLimits.minTargetJavaRelease} through ${velocityPluginJarValidationLimits.maxTargetJavaRelease}.`,
    );
    return currentVelocityMinimumJavaRelease;
  }
  return value;
}

function zipEntryMetadata(entry: ZipEntry): VelocityPluginArchiveEntry {
  return {
    path: entry.name,
    size: entry.uncompressedSize,
    compressedSize: entry.compressedSize,
    directory: entry.directory,
  };
}

function buildResult(options: {
  collector: DiagnosticCollector;
  strength: VelocityPluginJarValidationStrength;
  archiveBytes: number | null;
  entries: NormalizedArchiveEntry[];
  entryListComplete: boolean;
  zipStructureValidated: boolean;
  descriptor: DescriptorSummary;
  entrypoint: EntryPointSummary;
}): VelocityPluginJarValidationResult {
  const finished = options.collector.finish();
  const incompleteReasons = new Set([
    "all-entry-content-integrity-not-validated",
    "full-entrypoint-bytecode-verification-not-performed",
    "non-entrypoint-classfiles-not-inspected",
    "dependency-satisfaction-not-validated",
    "exact-gson-runtime-coercion-parity-not-validated",
    "guice-construction-and-runtime-load-not-executed",
    "velocity-api-compatibility-not-validated",
  ]);
  if (options.strength === "metadata") {
    incompleteReasons.add("archive-binary-not-provided");
    incompleteReasons.add("descriptor-content-integrity-not-validated");
    incompleteReasons.add("entrypoint-class-bytes-not-provided");
  }
  if (options.descriptor.inputKind === "object") {
    incompleteReasons.add("parsed-descriptor-cannot-prove-original-json-key-uniqueness");
  }
  if (!options.entryListComplete) incompleteReasons.add("archive-entry-list-incomplete");
  if (options.entrypoint.pluginAnnotationObserved !== true)
    incompleteReasons.add("runtime-plugin-annotation-not-proven");
  if (options.entrypoint.annotationMatchesDescriptor === false)
    incompleteReasons.add("descriptor-and-annotation-differ");
  if (options.entrypoint.preview === true) incompleteReasons.add("preview-runtime-flag-not-proven");
  return {
    schemaVersion: 1,
    specification: {
      descriptor:
        "https://github.com/PaperMC/Velocity/blob/dev/4.0.0/api/src/ap/java/com/velocitypowered/api/plugin/ap/SerializedPluginDescription.java",
      loader:
        "https://github.com/PaperMC/Velocity/blob/dev/4.0.0/proxy/src/main/java/com/velocitypowered/proxy/plugin/loader/java/JavaPluginLoader.java",
      javaRuntime:
        "https://docs.papermc.io/velocity/faq/#what-version-of-java-does-velocity-require",
      classFile: "https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-4.html",
      currentVelocityMinimumJavaRelease,
    },
    valid: options.collector.errorCount === 0,
    validationComplete: incompleteReasons.size === 0,
    validationStrength: options.strength,
    errorCount: options.collector.errorCount,
    warningCount: options.collector.warningCount,
    unknownCount: options.collector.unknownCount,
    diagnosticsTruncated: finished.diagnosticsTruncated,
    omittedDiagnosticCount: finished.omittedDiagnosticCount,
    incompleteReasons: [...incompleteReasons].sort(),
    archive: {
      bytes: options.archiveBytes,
      entriesInspected: options.entries.length,
      entryListComplete: options.entryListComplete,
      zipStructureValidated: options.zipStructureValidated,
      allEntryContentIntegrityValidated: false,
      descriptorObserved: options.descriptor.entryObserved,
    },
    descriptor: options.descriptor,
    entrypoint: options.entrypoint,
    diagnostics: finished.diagnostics,
  };
}

function validateVelocityPluginInternal(options: {
  collector: DiagnosticCollector;
  strength: VelocityPluginJarValidationStrength;
  archiveBytes: number | null;
  rawEntries: unknown;
  requestedEntryListComplete: boolean;
  zipStructureValidated: boolean;
  descriptorInput: unknown;
  descriptorContentProvided: boolean;
  descriptorContentIntegrityValidated: boolean;
  targetJavaRelease: number;
  archive?: ZipArchive;
}): VelocityPluginJarValidationResult {
  const normalized = normalizeArchiveEntries(options.rawEntries, options.collector);
  const entryListComplete = options.requestedEntryListComplete && normalized.evidenceComplete;
  const entries = normalized.entries;
  const descriptorEntry = entries.find(
    (entry) => !entry.directory && entry.path === descriptorPath,
  );
  const descriptorObserved = descriptorEntry !== undefined;
  for (const [index, entry] of entries.entries()) {
    if (entry.directory) continue;
    if (entry.path.toLowerCase() === descriptorPath && entry.path !== descriptorPath) {
      options.collector.add(
        "warning",
        "descriptor.case-mismatch",
        `/archiveEntries/${index}/path`,
        "A descriptor-like entry has different casing and is not the root Velocity descriptor.",
      );
    }
    if (foreignDescriptorPaths.has(entry.path)) {
      options.collector.add(
        descriptorObserved ? "warning" : entryListComplete ? "error" : "unknown",
        descriptorObserved ? "descriptor.foreign-platform" : "descriptor.wrong-platform",
        `/archiveEntries/${index}/path`,
        descriptorObserved
          ? "The JAR also contains a descriptor for another server platform."
          : "The observed descriptor belongs to another server platform, not Velocity.",
      );
    }
  }
  if (!descriptorObserved) {
    options.collector.add(
      entryListComplete ? "error" : "unknown",
      entryListComplete ? "descriptor.missing" : "descriptor.not-observed",
      "/archiveEntries",
      entryListComplete
        ? "A Velocity plugin JAR must contain velocity-plugin.json at the archive root."
        : "The incomplete archive listing does not prove a root velocity-plugin.json entry.",
    );
  }
  if (options.descriptorContentProvided && !descriptorObserved) {
    options.collector.add(
      entryListComplete ? "error" : "unknown",
      entryListComplete ? "descriptor.content-entry-mismatch" : "descriptor.entry-not-observed",
      "/descriptor",
      entryListComplete
        ? "Descriptor content was supplied, but the complete archive listing has no matching root entry."
        : "Descriptor content was supplied, but the incomplete listing does not prove its archive entry.",
    );
  }
  if (descriptorObserved && !options.descriptorContentProvided) {
    options.collector.add(
      options.strength === "binary" ? "error" : "unknown",
      "descriptor.content-unavailable",
      "/descriptor",
      "The descriptor entry was observed, but bounded JSON content was unavailable.",
    );
  }

  const descriptorParse = options.descriptorContentProvided
    ? parseVelocityDescriptor(options.descriptorInput, options.collector)
    : null;
  const parsedDescriptor = descriptorParse?.descriptor ?? null;
  const descriptorSummary: DescriptorSummary = {
    entryObserved: descriptorObserved,
    contentProvided: options.descriptorContentProvided,
    contentIntegrityValidated: options.descriptorContentIntegrityValidated,
    inputKind: descriptorParse?.inputKind ?? null,
    duplicateKeysChecked: descriptorParse?.duplicateKeysChecked ?? false,
    jsonValidated: parsedDescriptor !== null,
    unknownFieldCount: parsedDescriptor?.unknownFieldCount ?? 0,
    id: parsedDescriptor?.id || null,
    main: parsedDescriptor?.main || null,
    dependencyCount: parsedDescriptor?.dependencies.length ?? 0,
    providedIdCount: parsedDescriptor?.provides.length ?? 0,
  };
  let entrypoint = defaultEntrypointSummary(options.targetJavaRelease);
  if (parsedDescriptor !== null) {
    const classPath = javaBinaryNameToClassEntryPath(parsedDescriptor.main);
    if (classPath !== null) {
      const classEntry = entries.find((entry) => !entry.directory && entry.path === classPath);
      const classObserved = classEntry !== undefined;
      entrypoint = {
        ...entrypoint,
        path: classPath,
        entryObserved: classObserved,
        entryPresenceProven: classObserved || entryListComplete,
      };
      if (!classObserved) {
        options.collector.add(
          entryListComplete ? "error" : "unknown",
          entryListComplete ? "class.entry-missing" : "class.entry-not-observed",
          "/entrypoint",
          entryListComplete
            ? "The complete archive listing has no class entry for descriptor main."
            : "The incomplete archive listing does not prove descriptor main class presence.",
        );
      } else if (options.archive === undefined) {
        options.collector.add(
          "unknown",
          "class.bytes-unavailable",
          "/entrypoint",
          "Entrypoint presence is metadata evidence only; classfile bytes and target Java were not inspected.",
        );
      } else if (classEntry.size > velocityPluginJarValidationLimits.maxEntrypointClassBytes) {
        options.collector.add(
          "error",
          "class.entry-size-limit",
          "/entrypoint",
          `Entrypoint class exceeds the ${velocityPluginJarValidationLimits.maxEntrypointClassBytes}-byte inspection limit.`,
        );
      } else if (
        classEntry.compressedSize !== null &&
        classEntry.size > 0 &&
        (classEntry.compressedSize === 0 ||
          classEntry.size / classEntry.compressedSize >
            velocityPluginJarValidationLimits.maxCompressionRatio)
      ) {
        options.collector.add(
          "error",
          "class.compression-ratio",
          "/entrypoint",
          "Entrypoint class compression ratio exceeds the bounded inspection limit.",
        );
      } else {
        try {
          const bytes = options.archive.readEntry(classPath);
          entrypoint = inspectEntrypointClass(
            bytes,
            classPath,
            parsedDescriptor,
            options.targetJavaRelease,
            options.collector,
          );
        } catch {
          options.collector.add(
            "error",
            "class.unreadable",
            "/entrypoint",
            "Entrypoint class could not be read with ZIP integrity checks.",
          );
        }
      }
    }
  }
  return buildResult({
    collector: options.collector,
    strength: options.strength,
    archiveBytes: options.archiveBytes,
    entries,
    entryListComplete,
    zipStructureValidated: options.zipStructureValidated,
    descriptor: descriptorSummary,
    entrypoint,
  });
}

/** Validates bounded descriptor and archive-entry metadata without accepting binary JAR bytes. */
export function validateVelocityPluginArchiveMetadata(
  options: ValidateVelocityPluginArchiveMetadataOptions,
): VelocityPluginJarValidationResult {
  const collector = new DiagnosticCollector();
  const descriptors = dataPropertyDescriptors(options);
  if (descriptors === null) {
    collector.add(
      "error",
      "input.data-object",
      "/",
      "Validation input must be a plain JSON-data object.",
    );
  }
  const allowed = new Set(["descriptor", "archiveEntries", "archiveEntriesComplete"]);
  if (descriptors !== null && Object.keys(descriptors).some((field) => !allowed.has(field))) {
    collector.add(
      "error",
      "input.unknown-field",
      "/",
      "Validation input contains an unsupported field.",
    );
  }
  const descriptor = descriptors?.descriptor?.value;
  const descriptorProvided = descriptors?.descriptor !== undefined;
  if (!descriptorProvided) {
    collector.add(
      "error",
      "input.descriptor-required",
      "/descriptor",
      "Descriptor JSON data is required.",
    );
  }
  const archiveEntries = descriptors?.archiveEntries?.value;
  if (!Array.isArray(archiveEntries)) {
    collector.add(
      "error",
      "input.entries-required",
      "/archiveEntries",
      "archiveEntries metadata is required.",
    );
  }
  const archiveEntriesComplete = descriptors?.archiveEntriesComplete?.value;
  if (typeof archiveEntriesComplete !== "boolean") {
    collector.add(
      "error",
      "input.completeness-required",
      "/archiveEntriesComplete",
      "archiveEntriesComplete must explicitly be a boolean.",
    );
  }
  return validateVelocityPluginInternal({
    collector,
    strength: "metadata",
    archiveBytes: null,
    rawEntries: Array.isArray(archiveEntries) ? archiveEntries : [],
    requestedEntryListComplete: archiveEntriesComplete === true,
    zipStructureValidated: false,
    descriptorInput: descriptor,
    descriptorContentProvided: descriptorProvided,
    descriptorContentIntegrityValidated: false,
    targetJavaRelease: currentVelocityMinimumJavaRelease,
  });
}

/**
 * Performs bounded offline inspection of a Velocity plugin JAR and its generated descriptor.
 * It never loads classes, resolves dependencies, invokes Guice, or starts Velocity.
 */
export function validateVelocityPluginJar(
  options: ValidateVelocityPluginJarOptions,
): VelocityPluginJarValidationResult {
  const collector = new DiagnosticCollector();
  const descriptors = dataPropertyDescriptors(options);
  if (descriptors === null) {
    collector.add(
      "error",
      "input.data-object",
      "/",
      "Validation input must be a plain data object.",
    );
  }
  const allowed = new Set(["archive", "targetJavaRelease"]);
  if (descriptors !== null && Object.keys(descriptors).some((field) => !allowed.has(field))) {
    collector.add(
      "error",
      "input.unknown-field",
      "/",
      "Validation input contains an unsupported field.",
    );
  }
  const archiveBytes = descriptors?.archive?.value;
  const targetJavaRelease = normalizeTargetJavaRelease(
    descriptors?.targetJavaRelease?.value,
    collector,
  );
  if (!(archiveBytes instanceof Uint8Array)) {
    collector.add(
      "error",
      "archive.binary-type",
      "/archive",
      "archive must be binary Uint8Array data.",
    );
    return validateVelocityPluginInternal({
      collector,
      strength: "binary",
      archiveBytes: null,
      rawEntries: [],
      requestedEntryListComplete: false,
      zipStructureValidated: false,
      descriptorInput: undefined,
      descriptorContentProvided: false,
      descriptorContentIntegrityValidated: false,
      targetJavaRelease,
    });
  }
  if (archiveBytes.byteLength > velocityPluginJarValidationLimits.maxArchiveBytes) {
    collector.add(
      "error",
      "archive.byte-limit",
      "/archive",
      `Archive exceeds the ${velocityPluginJarValidationLimits.maxArchiveBytes}-byte limit.`,
    );
    return validateVelocityPluginInternal({
      collector,
      strength: "binary",
      archiveBytes: archiveBytes.byteLength,
      rawEntries: [],
      requestedEntryListComplete: false,
      zipStructureValidated: false,
      descriptorInput: undefined,
      descriptorContentProvided: false,
      descriptorContentIntegrityValidated: false,
      targetJavaRelease,
    });
  }

  let archive: ZipArchive;
  try {
    archive = openZipArchive(
      Buffer.from(archiveBytes.buffer, archiveBytes.byteOffset, archiveBytes.byteLength),
    );
  } catch {
    collector.add(
      "error",
      "archive.invalid-zip",
      "/archive",
      "Archive is not a supported internally consistent ZIP/JAR file.",
    );
    return validateVelocityPluginInternal({
      collector,
      strength: "binary",
      archiveBytes: archiveBytes.byteLength,
      rawEntries: [],
      requestedEntryListComplete: false,
      zipStructureValidated: false,
      descriptorInput: undefined,
      descriptorContentProvided: false,
      descriptorContentIntegrityValidated: false,
      targetJavaRelease,
    });
  }

  let descriptorInput: unknown;
  let descriptorContentProvided = false;
  let descriptorContentIntegrityValidated = false;
  if (archive.entries.length <= velocityPluginJarValidationLimits.maxArchiveEntries) {
    const entry = archive.entries.find(
      (candidate) => !candidate.directory && candidate.name === descriptorPath,
    );
    if (entry !== undefined) {
      const ratio =
        entry.uncompressedSize === 0
          ? 0
          : entry.compressedSize === 0
            ? Number.POSITIVE_INFINITY
            : entry.uncompressedSize / entry.compressedSize;
      if (entry.uncompressedSize > velocityPluginJarValidationLimits.maxDescriptorBytes) {
        collector.add(
          "error",
          "descriptor.entry-size-limit",
          "/descriptor",
          `Descriptor entry exceeds the ${velocityPluginJarValidationLimits.maxDescriptorBytes}-byte limit.`,
        );
      } else if (ratio > velocityPluginJarValidationLimits.maxCompressionRatio) {
        collector.add(
          "error",
          "descriptor.compression-ratio",
          "/descriptor",
          "Descriptor compression ratio exceeds the bounded limit.",
        );
      } else {
        try {
          const text = new TextDecoder("utf-8", { fatal: true }).decode(
            archive.readEntry(descriptorPath),
          );
          descriptorInput = text;
          descriptorContentProvided = true;
          descriptorContentIntegrityValidated = true;
        } catch {
          collector.add(
            "error",
            "descriptor.unreadable",
            "/descriptor",
            "Descriptor could not be integrity-checked and decoded as UTF-8 JSON.",
          );
        }
      }
    }
  }
  return validateVelocityPluginInternal({
    collector,
    strength: "binary",
    archiveBytes: archiveBytes.byteLength,
    rawEntries: archive.entries.map(zipEntryMetadata),
    requestedEntryListComplete: true,
    zipStructureValidated: true,
    descriptorInput,
    descriptorContentProvided,
    descriptorContentIntegrityValidated,
    targetJavaRelease,
    archive,
  });
}
