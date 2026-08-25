import { openZipArchive, type ZipArchive, type ZipEntry } from "@minecraft-skills/data";
import { parseDocument } from "yaml";
import { javaBinaryNameToClassEntryPath, maxJavaBinaryNameCharacters } from "./javaClassArchive.js";

const pluginDescriptorPath = "plugin.yml";
const paperPluginDescriptorPath = "paper-plugin.yml";
const descriptorPaths = [pluginDescriptorPath, paperPluginDescriptorPath] as const;
const descriptorPathSet = new Set<string>(descriptorPaths);
const reservedPaperPluginNames = new Set(["bukkit", "minecraft", "mojang", "paper", "spigot"]);
const paperRestrictedClassPrefixes = [
  "net.minecraft.",
  "org.bukkit.",
  "io.papermc.paper.",
  "com.destroystokyo.paper.",
] as const;
const pluginName = /^[A-Za-z0-9 _.-]+$/u;
const apiVersion = /^(\d{1,3})\.(\d{1,3})(?:\.(\d{1,3}))?$/u;
// Conservative release identifiers from the bundled Java catalog within Paper's documented
// 1.13-26.2 window. Paper documents patch-level api-version support only from 1.20.5 onward.
const currentKnownPaperApiVersions = new Set([
  "1.13",
  "1.14",
  "1.15",
  "1.16",
  "1.17",
  "1.18",
  "1.19",
  "1.20",
  "1.20.5",
  "1.20.6",
  "1.21",
  "1.21.1",
  "1.21.2",
  "1.21.3",
  "1.21.4",
  "1.21.5",
  "1.21.6",
  "1.21.7",
  "1.21.8",
  "1.21.9",
  "1.21.10",
  "1.21.11",
  "26.1",
  "26.1.1",
  "26.1.2",
  "26.2",
]);

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
}

/** Hard ceilings for untrusted local JAR, archive metadata, and YAML inputs. */
export const paperPluginJarValidationLimits = {
  maxArchiveBytes: 64 * 1024 * 1024,
  maxArchiveEntries: 16_384,
  maxEntryPathCharacters: 1_024,
  maxEntryUncompressedBytes: 128 * 1024 * 1024,
  maxTotalUncompressedBytes: 512 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxDescriptorBytes: 256 * 1024,
  maxDescriptorCharacters: 256 * 1024,
  maxDescriptorLines: 8_192,
  maxLineCharacters: 16_384,
  maxYamlDepth: 24,
  maxYamlNodes: 20_000,
  maxMappingEntries: 10_000,
  maxSequenceItems: 10_000,
  maxCollectionEntries: 2_048,
  maxScalarCharacters: 65_536,
  maxKeyCharacters: 256,
  maxMetadataTextCharacters: 2_048,
  maxClassNameCharacters: maxJavaBinaryNameCharacters,
  maxDiagnostics: 200,
} as const;

export type PaperPluginDescriptorKind =
  | typeof pluginDescriptorPath
  | typeof paperPluginDescriptorPath;
export type PaperPluginJarDiagnosticSeverity = "error" | "warning" | "unknown";
export type PaperPluginJarValidationStrength = "binary" | "metadata";

export type PaperPluginArchiveEntry = {
  path: string;
  size: number;
  compressedSize?: number;
  directory?: boolean;
};

export type PaperPluginJarDiagnostic = {
  severity: PaperPluginJarDiagnosticSeverity;
  code: string;
  path: string;
  message: string;
};

export type PaperPluginDeclaredClassCheck = {
  field: "main" | "paper-plugin-loader" | "bootstrapper" | "loader";
  entryObserved: boolean | null;
  entryPresenceProven: boolean;
};

export type PaperPluginDescriptorSummary = {
  kind: PaperPluginDescriptorKind;
  role: "active" | "shadowed" | "selection-unknown" | "not-present";
  experimental: boolean;
  entryObserved: boolean;
  contentProvided: boolean;
  contentIntegrityValidated: boolean;
  yamlValidated: boolean;
  unknownFieldCount: number;
  declaredClasses: PaperPluginDeclaredClassCheck[];
};

export type PaperPluginJarValidationResult = {
  schemaVersion: 1;
  specification: {
    pluginYml: string;
    paperPluginYml: string;
    paperPluginStatus: "experimental";
  };
  valid: boolean;
  validationComplete: boolean;
  validationStrength: PaperPluginJarValidationStrength;
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
    descriptorCount: number;
    bothDescriptorsObserved: boolean;
  };
  descriptors: PaperPluginDescriptorSummary[];
  diagnostics: PaperPluginJarDiagnostic[];
};

export type ValidatePaperPluginArchiveMetadataOptions = {
  archiveEntries: readonly PaperPluginArchiveEntry[];
  /** Whether `archiveEntries` is the complete central-directory listing. */
  archiveEntriesComplete?: boolean;
  pluginYml?: string;
  paperPluginYml?: string;
};

export type ValidatePaperPluginJarOptions = {
  archive: Uint8Array;
};

type DescriptorContents = Partial<Record<PaperPluginDescriptorKind, string>>;

type NormalizedArchiveEntry = {
  path: string;
  size: number;
  compressedSize: number | null;
  directory: boolean;
};

type NormalizedArchiveEntries = {
  entries: NormalizedArchiveEntry[];
  evidenceComplete: boolean;
};

type NormalizedYaml = string | number | boolean | null | NormalizedYaml[] | NormalizedYamlRecord;
interface NormalizedYamlRecord {
  [key: string]: NormalizedYaml;
}

type ComplexityState = {
  nodes: number;
  mappingEntries: number;
  sequenceItems: number;
};

class ComplexityLimitError extends Error {}

class DiagnosticCollector {
  readonly diagnostics: PaperPluginJarDiagnostic[] = [];
  errorCount = 0;
  warningCount = 0;
  unknownCount = 0;

  add(
    severity: PaperPluginJarDiagnosticSeverity,
    code: string,
    path: string,
    message: string,
  ): void {
    if (severity === "error") this.errorCount += 1;
    else if (severity === "warning") this.warningCount += 1;
    else this.unknownCount += 1;
    if (this.diagnostics.length < paperPluginJarValidationLimits.maxDiagnostics) {
      this.diagnostics.push({ severity, code, path, message });
    }
  }

  finish(): {
    diagnostics: PaperPluginJarDiagnostic[];
    diagnosticsTruncated: boolean;
    omittedDiagnosticCount: number;
  } {
    const rank: Record<PaperPluginJarDiagnosticSeverity, number> = {
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
      diagnosticsTruncated: total > diagnostics.length,
      omittedDiagnosticCount: Math.max(0, total - diagnostics.length),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function archiveEntryPathProblem(path: string): string | null {
  if (!path) return "Archive entry paths must not be empty.";
  if (path.length > paperPluginJarValidationLimits.maxEntryPathCharacters) {
    return `Archive entry paths must not exceed ${paperPluginJarValidationLimits.maxEntryPathCharacters} characters.`;
  }
  if (hasControlCharacter(path)) return "Archive entry paths must not contain control characters.";
  if (path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:/u.test(path)) {
    return "Archive entry paths must be relative.";
  }
  if (path.includes("\\")) return "Archive entry paths must use forward slashes.";
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  if (!normalized) return "Archive entries must identify a path below the root.";
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return "Archive entry paths must be normalized without empty, dot, or parent segments.";
  }
  return null;
}

function validSize(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && 0 <= value && value <= maximum;
}

function normalizeArchiveEntries(
  input: unknown,
  collector: DiagnosticCollector,
): NormalizedArchiveEntries {
  if (!Array.isArray(input)) {
    collector.add(
      "error",
      "archive.entries-type",
      "/archiveEntries",
      "archiveEntries must be an array.",
    );
    return { entries: [], evidenceComplete: false };
  }
  let evidenceComplete = true;
  if (input.length > paperPluginJarValidationLimits.maxArchiveEntries) {
    evidenceComplete = false;
    collector.add(
      "error",
      "archive.entry-limit",
      "/archiveEntries",
      `Archive entry count exceeds the ${paperPluginJarValidationLimits.maxArchiveEntries}-entry limit.`,
    );
  }

  const entries: NormalizedArchiveEntry[] = [];
  const seen = new Set<string>();
  let totalUncompressedBytes = 0;
  for (const [index, rawEntry] of input
    .slice(0, paperPluginJarValidationLimits.maxArchiveEntries)
    .entries()) {
    const pointer = `/archiveEntries/${index}`;
    if (!isRecord(rawEntry)) {
      evidenceComplete = false;
      collector.add("error", "archive.entry-type", pointer, "Archive entries must be objects.");
      continue;
    }
    if (typeof rawEntry.path !== "string") {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.path-type",
        `${pointer}/path`,
        "Archive entry path must be a string.",
      );
      continue;
    }
    const pathProblem = archiveEntryPathProblem(rawEntry.path);
    if (pathProblem) {
      evidenceComplete = false;
      collector.add("error", "archive.unsafe-path", `${pointer}/path`, pathProblem);
      continue;
    }
    if (seen.has(rawEntry.path)) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.duplicate-entry",
        `${pointer}/path`,
        "Archive entry paths must be unique.",
      );
      continue;
    }
    seen.add(rawEntry.path);

    if (!validSize(rawEntry.size, paperPluginJarValidationLimits.maxEntryUncompressedBytes)) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.entry-size",
        `${pointer}/size`,
        `Entry size must be an integer between 0 and ${paperPluginJarValidationLimits.maxEntryUncompressedBytes}.`,
      );
      continue;
    }
    totalUncompressedBytes += rawEntry.size;
    if (totalUncompressedBytes > paperPluginJarValidationLimits.maxTotalUncompressedBytes) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.total-size-limit",
        "/archiveEntries",
        `Declared uncompressed entry bytes exceed ${paperPluginJarValidationLimits.maxTotalUncompressedBytes}.`,
      );
      break;
    }

    let compressedSize: number | null = null;
    if (rawEntry.compressedSize !== undefined) {
      if (!validSize(rawEntry.compressedSize, paperPluginJarValidationLimits.maxArchiveBytes)) {
        evidenceComplete = false;
        collector.add(
          "error",
          "archive.compressed-size",
          `${pointer}/compressedSize`,
          `Compressed size must be an integer between 0 and ${paperPluginJarValidationLimits.maxArchiveBytes}.`,
        );
        continue;
      }
      compressedSize = rawEntry.compressedSize;
      const ratio =
        rawEntry.size === 0
          ? 0
          : compressedSize === 0
            ? Number.POSITIVE_INFINITY
            : rawEntry.size / compressedSize;
      if (ratio > paperPluginJarValidationLimits.maxCompressionRatio) {
        evidenceComplete = false;
        collector.add(
          "error",
          "archive.compression-ratio",
          pointer,
          `Entry compression ratio exceeds the ${paperPluginJarValidationLimits.maxCompressionRatio}:1 limit.`,
        );
        continue;
      }
    }

    if (rawEntry.directory !== undefined && typeof rawEntry.directory !== "boolean") {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.directory-type",
        `${pointer}/directory`,
        "Archive entry directory must be boolean when present.",
      );
      continue;
    }
    const pathLooksLikeDirectory = rawEntry.path.endsWith("/");
    const directory = rawEntry.directory ?? pathLooksLikeDirectory;
    if (directory !== pathLooksLikeDirectory) {
      evidenceComplete = false;
      collector.add(
        "error",
        "archive.directory-mismatch",
        pointer,
        "Directory metadata must agree with the trailing slash in the entry path.",
      );
      continue;
    }
    entries.push({ path: rawEntry.path, size: rawEntry.size, compressedSize, directory });
  }
  return { entries, evidenceComplete };
}

function descriptorPointer(kind: PaperPluginDescriptorKind, field?: string): string {
  return field ? `/${kind}/${field}` : `/${kind}`;
}

function checkDescriptorTextBounds(
  kind: PaperPluginDescriptorKind,
  text: string,
  collector: DiagnosticCollector,
): boolean {
  if (text.length > paperPluginJarValidationLimits.maxDescriptorCharacters) {
    collector.add(
      "error",
      "descriptor.character-limit",
      descriptorPointer(kind),
      `Descriptor exceeds the ${paperPluginJarValidationLimits.maxDescriptorCharacters}-character limit.`,
    );
    return false;
  }
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > paperPluginJarValidationLimits.maxDescriptorBytes) {
    collector.add(
      "error",
      "descriptor.byte-limit",
      descriptorPointer(kind),
      `Descriptor exceeds the ${paperPluginJarValidationLimits.maxDescriptorBytes}-byte limit.`,
    );
    return false;
  }
  if (text.includes("\0")) {
    collector.add(
      "error",
      "descriptor.nul",
      descriptorPointer(kind),
      "Descriptor must not contain NUL characters.",
    );
    return false;
  }
  const lines = text.split(/\r\n|\n|\r/u);
  if (lines.length > paperPluginJarValidationLimits.maxDescriptorLines) {
    collector.add(
      "error",
      "descriptor.line-limit",
      descriptorPointer(kind),
      `Descriptor exceeds the ${paperPluginJarValidationLimits.maxDescriptorLines}-line limit.`,
    );
    return false;
  }
  if (lines.some((line) => line.length > paperPluginJarValidationLimits.maxLineCharacters)) {
    collector.add(
      "error",
      "descriptor.line-length",
      descriptorPointer(kind),
      `Descriptor lines must not exceed ${paperPluginJarValidationLimits.maxLineCharacters} characters.`,
    );
    return false;
  }
  return true;
}

function normalizeYamlValue(value: unknown, depth: number, state: ComplexityState): NormalizedYaml {
  state.nodes += 1;
  if (state.nodes > paperPluginJarValidationLimits.maxYamlNodes) {
    throw new ComplexityLimitError("node limit");
  }
  if (depth > paperPluginJarValidationLimits.maxYamlDepth) {
    throw new ComplexityLimitError("depth limit");
  }
  if (typeof value === "string") {
    if (value.length > paperPluginJarValidationLimits.maxScalarCharacters) {
      throw new ComplexityLimitError("scalar limit");
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new ComplexityLimitError("numeric value");
    return value;
  }
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    state.sequenceItems += value.length;
    if (
      value.length > paperPluginJarValidationLimits.maxCollectionEntries ||
      state.sequenceItems > paperPluginJarValidationLimits.maxSequenceItems
    ) {
      throw new ComplexityLimitError("sequence limit");
    }
    return value.map((entry) => normalizeYamlValue(entry, depth + 1, state));
  }
  if (value instanceof Map) {
    state.mappingEntries += value.size;
    if (
      value.size > paperPluginJarValidationLimits.maxCollectionEntries ||
      state.mappingEntries > paperPluginJarValidationLimits.maxMappingEntries
    ) {
      throw new ComplexityLimitError("mapping limit");
    }
    const result: NormalizedYamlRecord = Object.create(null) as NormalizedYamlRecord;
    for (const [key, child] of value.entries()) {
      if (
        typeof key !== "string" ||
        !key ||
        key.length > paperPluginJarValidationLimits.maxKeyCharacters
      ) {
        throw new ComplexityLimitError("mapping key");
      }
      result[key] = normalizeYamlValue(child, depth + 1, state);
    }
    return result;
  }
  throw new ComplexityLimitError("unsupported value");
}

function parseDescriptorYaml(
  kind: PaperPluginDescriptorKind,
  text: string,
  collector: DiagnosticCollector,
): NormalizedYamlRecord | null {
  if (!checkDescriptorTextBounds(kind, text, collector)) return null;
  let document: ReturnType<typeof parseDocument>;
  try {
    document = parseDocument(text.replace(/^\uFEFF/u, ""), {
      schema: "core",
      version: "1.2",
      merge: false,
      prettyErrors: false,
      uniqueKeys: true,
    });
  } catch {
    collector.add(
      "error",
      "yaml.parser-failure",
      descriptorPointer(kind),
      "Descriptor could not be parsed within the bounded YAML parser.",
    );
    return null;
  }
  if (document.errors.length > 0) {
    for (const error of document.errors) {
      collector.add(
        "error",
        error.code === "DUPLICATE_KEY" ? "yaml.duplicate-key" : "yaml.invalid",
        descriptorPointer(kind),
        error.code === "DUPLICATE_KEY"
          ? "YAML mapping keys must be unique."
          : "Descriptor must contain syntactically valid YAML.",
      );
    }
    return null;
  }
  if (document.warnings.length > 0) {
    collector.add(
      "unknown",
      "yaml.warning",
      descriptorPointer(kind),
      "The YAML parser reported a feature outside the validator's documented subset.",
    );
  }

  let raw: unknown;
  try {
    raw = document.toJS({ mapAsMap: true, maxAliasCount: 0 });
  } catch {
    collector.add(
      "error",
      "yaml.alias-or-conversion",
      descriptorPointer(kind),
      "YAML aliases and values that cannot be converted without expansion are not accepted.",
    );
    return null;
  }
  let normalized: NormalizedYaml;
  try {
    normalized = normalizeYamlValue(raw, 0, { nodes: 0, mappingEntries: 0, sequenceItems: 0 });
  } catch {
    collector.add(
      "error",
      "yaml.complexity-limit",
      descriptorPointer(kind),
      "Descriptor exceeds a YAML depth, node, collection, key, scalar, or value safety limit.",
    );
    return null;
  }
  if (!isRecord(normalized)) {
    collector.add(
      "error",
      "descriptor.root-type",
      descriptorPointer(kind),
      "Descriptor root must be a YAML mapping.",
    );
    return null;
  }
  return normalized as NormalizedYamlRecord;
}

function textValue(
  record: NormalizedYamlRecord,
  field: string,
  kind: PaperPluginDescriptorKind,
  collector: DiagnosticCollector,
  options: { required?: boolean; maximum?: number; allowNumber?: boolean } = {},
): string | null {
  const value = record[field];
  if (value === undefined || value === null) {
    if (options.required) {
      collector.add(
        "error",
        "descriptor.required-field",
        descriptorPointer(kind, field),
        "A required descriptor field is missing.",
      );
    }
    return null;
  }
  const text =
    typeof value === "string"
      ? value
      : options.allowNumber && typeof value === "number"
        ? String(value)
        : null;
  const maximum = options.maximum ?? paperPluginJarValidationLimits.maxMetadataTextCharacters;
  if (text === null || !text.trim() || text.length > maximum || hasControlCharacter(text)) {
    collector.add(
      "error",
      "descriptor.field-type",
      descriptorPointer(kind, field),
      `Field must be non-empty text no longer than ${maximum} characters.`,
    );
    return null;
  }
  return text;
}

function validateOptionalTextFields(
  record: NormalizedYamlRecord,
  kind: PaperPluginDescriptorKind,
  fields: readonly string[],
  collector: DiagnosticCollector,
): void {
  for (const field of fields) {
    if (record[field] !== undefined)
      textValue(record, field, kind, collector, { allowNumber: true });
  }
}

function validateStringList(
  value: NormalizedYaml | undefined,
  path: string,
  collector: DiagnosticCollector,
): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > paperPluginJarValidationLimits.maxCollectionEntries) {
    collector.add(
      "error",
      "descriptor.string-list",
      path,
      `Field must be a list with at most ${paperPluginJarValidationLimits.maxCollectionEntries} text entries.`,
    );
    return;
  }
  const seen = new Set<string>();
  let duplicates = 0;
  for (const item of value) {
    if (
      typeof item !== "string" ||
      !item.trim() ||
      item.length > paperPluginJarValidationLimits.maxMetadataTextCharacters ||
      hasControlCharacter(item)
    ) {
      collector.add(
        "error",
        "descriptor.string-list-item",
        path,
        "Every list item must be bounded, non-empty text.",
      );
      continue;
    }
    if (seen.has(item)) duplicates += 1;
    seen.add(item);
  }
  if (duplicates > 0) {
    collector.add(
      "warning",
      "descriptor.duplicate-list-item",
      path,
      "The list contains duplicate entries.",
    );
  }
}

function validatePluginCoercedList(
  value: NormalizedYaml | undefined,
  path: string,
  collector: DiagnosticCollector,
): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > paperPluginJarValidationLimits.maxCollectionEntries) {
    collector.add(
      "error",
      "descriptor.string-list",
      path,
      `Field must be a list with at most ${paperPluginJarValidationLimits.maxCollectionEntries} entries.`,
    );
    return;
  }
  const seen = new Set<string>();
  let duplicates = 0;
  for (const [index, item] of value.entries()) {
    const itemPath = `${path}/<item-${index + 1}>`;
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      const itemText = String(item);
      if (typeof item !== "string") {
        collector.add(
          "warning",
          "plugin.list-item-coerced-to-string",
          itemPath,
          "The Bukkit descriptor loader converts this list item to text.",
        );
      }
      if (seen.has(itemText)) duplicates += 1;
      seen.add(itemText);
      continue;
    }
    collector.add(
      "unknown",
      "plugin.list-item-unverified",
      itemPath,
      "This plugin.yml list item was not validated against the loader's object-to-text conversion.",
    );
  }
  if (duplicates > 0) {
    collector.add(
      "warning",
      "descriptor.duplicate-list-item",
      path,
      "The list contains duplicate entries after Bukkit's text conversion.",
    );
  }
}

function validatePluginLoadOrder(
  value: NormalizedYaml | undefined,
  collector: DiagnosticCollector,
): void {
  if (value === undefined) return;
  const path = descriptorPointer(pluginDescriptorPath, "load");
  if (typeof value !== "string") {
    collector.add("error", "plugin.load-order", path, "load must be STARTUP or POSTWORLD text.");
    return;
  }
  const normalized = value.toUpperCase().replace(/\W/gu, "");
  if (normalized !== "STARTUP" && normalized !== "POSTWORLD") {
    collector.add(
      "error",
      "plugin.load-order",
      path,
      "load must normalize to STARTUP or POSTWORLD.",
    );
    return;
  }
  if (value !== normalized) {
    collector.add(
      "warning",
      "plugin.load-order-normalized",
      path,
      "The Bukkit descriptor loader normalizes this non-canonical load value.",
    );
  }
}

function validatePaperSkipLibraries(
  value: NormalizedYaml | undefined,
  collector: DiagnosticCollector,
): void {
  if (value === undefined || typeof value === "boolean") return;
  const path = descriptorPointer(pluginDescriptorPath, "paper-skip-libraries");
  if (typeof value === "string" && ["true", "false"].includes(value.toLowerCase())) {
    collector.add(
      "warning",
      "plugin.paper-skip-libraries-string",
      path,
      "The Bukkit descriptor loader accepts this text boolean through object-to-text conversion.",
    );
    return;
  }
  collector.add(
    "unknown",
    "plugin.paper-skip-libraries-unverified",
    path,
    "This value was not interpreted beyond the loader's object-to-text conversion behavior.",
  );
}

function validatePermissionDefault(
  value: NormalizedYaml | undefined,
  path: string,
  collector: DiagnosticCollector,
): void {
  if (value === undefined) return;
  if (typeof value === "boolean") return;
  if (
    typeof value !== "string" ||
    !["true", "false", "op", "notop"].includes(value.toLowerCase())
  ) {
    collector.add(
      "error",
      "permissions.default",
      path,
      "Permission defaults must be true, false, op, or notop.",
    );
  }
}

function validatePermissionDefinition(
  rawPermission: NormalizedYaml,
  path: string,
  kind: PaperPluginDescriptorKind,
  collector: DiagnosticCollector,
): void {
  if (!isRecord(rawPermission)) {
    collector.add("error", "permissions.entry-type", path, "Permission entries must be mappings.");
    return;
  }
  if (rawPermission.description !== undefined) {
    const holder = { description: rawPermission.description } as NormalizedYamlRecord;
    textValue(holder, "description", kind, collector, { allowNumber: true });
  }
  validatePermissionDefault(rawPermission.default, `${path}/default`, collector);
  if (rawPermission.children !== undefined) {
    validatePermissionChildren(rawPermission.children, `${path}/children`, kind, collector);
  }
  for (const key of Object.keys(rawPermission)) {
    if (!["children", "default", "description"].includes(key)) {
      collector.add(
        "unknown",
        "permissions.unknown-field",
        `${path}/<unknown-field>`,
        "An undocumented permission field was not validated.",
      );
    }
  }
}

function validatePermissionChildren(
  value: NormalizedYaml,
  path: string,
  kind: PaperPluginDescriptorKind,
  collector: DiagnosticCollector,
): void {
  if (Array.isArray(value)) {
    const seen = new Set<string>();
    let duplicates = 0;
    for (const [index, child] of value.entries()) {
      const childPath = `${path}/<child-${index + 1}>`;
      if (child === null) {
        collector.add(
          "warning",
          "permissions.null-child-ignored",
          childPath,
          "Paper ignores null entries in permission child lists.",
        );
        continue;
      }
      if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
        const childName = String(child);
        if (typeof child !== "string") {
          collector.add(
            "warning",
            "permissions.child-coerced-to-string",
            childPath,
            "Paper converts this scalar permission child to text.",
          );
        }
        if (seen.has(childName)) duplicates += 1;
        seen.add(childName);
        continue;
      }
      collector.add(
        "unknown",
        "permissions.child-list-shape-unverified",
        childPath,
        "A non-scalar permission child list entry was not validated.",
      );
    }
    if (duplicates > 0) {
      collector.add(
        "warning",
        "descriptor.duplicate-list-item",
        path,
        "The list contains duplicate entries after Paper's text conversion.",
      );
    }
    return;
  }
  if (!isRecord(value)) {
    collector.add(
      "unknown",
      "permissions.children-shape-unverified",
      path,
      "Permission children in this shape were not validated as a string list or mapping.",
    );
    return;
  }
  for (const [index, child] of Object.values(value).entries()) {
    if (typeof child === "boolean") continue;
    if (isRecord(child)) {
      validatePermissionDefinition(child, `${path}/<child-${index + 1}>`, kind, collector);
      continue;
    }
    collector.add(
      "unknown",
      "permissions.child-shape-unverified",
      `${path}/<child-${index + 1}>`,
      "A permission child value was not validated as a boolean or nested permission definition.",
    );
  }
}

function validatePermissions(
  value: NormalizedYaml | undefined,
  kind: PaperPluginDescriptorKind,
  collector: DiagnosticCollector,
): void {
  if (value === undefined) return;
  const base = descriptorPointer(kind, "permissions");
  if (!isRecord(value)) {
    collector.add("error", "permissions.type", base, "permissions must be a mapping.");
    return;
  }
  const entries = Object.entries(value);
  if (entries.length > paperPluginJarValidationLimits.maxCollectionEntries) {
    collector.add(
      "error",
      "permissions.entry-limit",
      base,
      `permissions must not exceed ${paperPluginJarValidationLimits.maxCollectionEntries} entries.`,
    );
  }
  for (const [index, [, rawPermission]] of entries
    .slice(0, paperPluginJarValidationLimits.maxCollectionEntries)
    .entries()) {
    const path = `${base}/<permission-${index + 1}>`;
    validatePermissionDefinition(rawPermission, path, kind, collector);
  }
}

function validateCommands(value: NormalizedYaml | undefined, collector: DiagnosticCollector): void {
  if (value === undefined) return;
  const base = descriptorPointer(pluginDescriptorPath, "commands");
  if (!isRecord(value)) {
    collector.add("error", "commands.type", base, "commands must be a mapping.");
    return;
  }
  const entries = Object.entries(value);
  if (entries.length > paperPluginJarValidationLimits.maxCollectionEntries) {
    collector.add(
      "error",
      "commands.entry-limit",
      base,
      `commands must not exceed ${paperPluginJarValidationLimits.maxCollectionEntries} entries.`,
    );
  }
  for (const [index, [commandName, rawCommand]] of entries
    .slice(0, paperPluginJarValidationLimits.maxCollectionEntries)
    .entries()) {
    const path = `${base}/<command-${index + 1}>`;
    if (
      !commandName ||
      commandName.length > paperPluginJarValidationLimits.maxKeyCharacters ||
      hasControlCharacter(commandName)
    ) {
      collector.add("error", "commands.name", path, "Command names must be bounded text.");
    }
    if (commandName.includes(":")) {
      collector.add(
        "error",
        "commands.name-colon",
        path,
        "Command names must not contain a colon.",
      );
    }
    if (rawCommand === null) continue;
    if (!isRecord(rawCommand)) {
      collector.add("error", "commands.entry-type", path, "Command entries must be mappings.");
      continue;
    }
    for (const field of ["description", "permission", "permission-message", "usage"] as const) {
      if (rawCommand[field] !== undefined) {
        const holder = { [field]: rawCommand[field] } as NormalizedYamlRecord;
        textValue(holder, field, pluginDescriptorPath, collector, { allowNumber: true });
      }
    }
    const aliases = rawCommand.aliases;
    if (aliases !== undefined) {
      if (typeof aliases === "string") {
        if (!aliases.trim() || hasControlCharacter(aliases)) {
          collector.add("error", "commands.alias", `${path}/aliases`, "Aliases must be text.");
        }
      } else {
        validateStringList(aliases, `${path}/aliases`, collector);
      }
    }
    for (const key of Object.keys(rawCommand)) {
      if (!["aliases", "description", "permission", "permission-message", "usage"].includes(key)) {
        collector.add(
          "unknown",
          "commands.unknown-field",
          `${path}/<unknown-field>`,
          "An undocumented command field was not validated.",
        );
      }
    }
  }
}

function parseApiVersion(
  record: NormalizedYamlRecord,
  kind: PaperPluginDescriptorKind,
  collector: DiagnosticCollector,
  required: boolean,
): void {
  const value = textValue(record, "api-version", kind, collector, { required, allowNumber: true });
  if (value === null) {
    if (!required && record["api-version"] === undefined) {
      collector.add(
        "warning",
        "plugin.legacy-api-version",
        descriptorPointer(kind, "api-version"),
        "Without api-version, Paper treats a Bukkit descriptor as legacy.",
      );
    }
    return;
  }
  const match = apiVersion.exec(value);
  if (!match) {
    collector.add(
      "error",
      "descriptor.api-version",
      descriptorPointer(kind, "api-version"),
      "api-version must use a dotted Minecraft release version syntax.",
    );
    return;
  }
  const major = Number.parseInt(match[1] ?? "0", 10);
  const minor = Number.parseInt(match[2] ?? "0", 10);
  const minimum = kind === paperPluginDescriptorPath ? 19 : 13;
  if (major === 0 || (major === 1 && minor < minimum)) {
    collector.add(
      "error",
      "descriptor.api-version-minimum",
      descriptorPointer(kind, "api-version"),
      `${kind} requires api-version 1.${minimum} or newer for the validated format.`,
    );
    return;
  }
  if (!currentKnownPaperApiVersions.has(value)) {
    collector.add(
      "unknown",
      "descriptor.api-version-support-unproven",
      descriptorPointer(kind, "api-version"),
      "The syntax is valid, but this value is not a currently documented Paper API release, so server acceptance was not established.",
    );
  }
}

function validateClassField(
  record: NormalizedYamlRecord,
  kind: PaperPluginDescriptorKind,
  field: PaperPluginDeclaredClassCheck["field"],
  collector: DiagnosticCollector,
  entryPaths: Set<string>,
  entryListComplete: boolean,
  required: boolean,
): PaperPluginDeclaredClassCheck | null {
  const value = textValue(record, field, kind, collector, {
    required,
    maximum: paperPluginJarValidationLimits.maxClassNameCharacters,
  });
  if (value === null) return null;
  const expectedEntry = javaBinaryNameToClassEntryPath(value);
  if (expectedEntry === null) {
    collector.add(
      "error",
      "class.invalid-name",
      descriptorPointer(kind, field),
      "Declared classes must use a valid Java binary name.",
    );
    return { field, entryObserved: null, entryPresenceProven: false };
  }
  if (
    (kind === pluginDescriptorPath && value.startsWith("org.bukkit.")) ||
    (kind === paperPluginDescriptorPath &&
      paperRestrictedClassPrefixes.some((prefix) => value.startsWith(prefix)))
  ) {
    collector.add(
      "error",
      "class.restricted-namespace",
      descriptorPointer(kind, field),
      "Declared class uses a namespace reserved by the current Paper loader.",
    );
  }
  const entryObserved = entryPaths.has(expectedEntry);
  if (!entryObserved) {
    collector.add(
      entryListComplete ? "warning" : "unknown",
      entryListComplete ? "class.entry-missing-from-archive" : "class.entry-not-observed",
      descriptorPointer(kind, field),
      entryListComplete
        ? "The plugin JAR does not contain the declared class entry; Paper may still resolve it from a configured library or dependency classloader."
        : "The provided archive-entry subset does not establish whether the declared class exists.",
    );
  }
  return {
    field,
    entryObserved,
    entryPresenceProven: entryObserved || entryListComplete,
  };
}

function configurateEnumKey(value: string): string {
  return value.toLowerCase().replaceAll("_", "");
}

function validateConfigurateEnum(
  value: NormalizedYaml | undefined,
  allowed: readonly string[],
  path: string,
  code: string,
  normalizedCode: string,
  label: string,
  collector: DiagnosticCollector,
): void {
  if (value === undefined) return;
  const matched =
    typeof value === "string"
      ? allowed.find(
          (candidate) =>
            candidate === value || configurateEnumKey(candidate) === configurateEnumKey(value),
        )
      : undefined;
  if (!matched) {
    collector.add("error", code, path, `${label} must be ${allowed.join(", ")}.`);
    return;
  }
  if (value !== matched) {
    collector.add(
      "warning",
      normalizedCode,
      path,
      "Paper's Configurate enum lookup accepts this token case-insensitively and without underscores.",
    );
  }
}

function validateTopLevelUnknownFields(
  record: NormalizedYamlRecord,
  knownFields: ReadonlySet<string>,
  kind: PaperPluginDescriptorKind,
  collector: DiagnosticCollector,
): number {
  let unknownFieldCount = 0;
  for (const key of Object.keys(record)) {
    if (knownFields.has(key)) continue;
    unknownFieldCount += 1;
    collector.add(
      "unknown",
      "descriptor.unknown-field",
      `${descriptorPointer(kind)}/<unknown-field-${unknownFieldCount}>`,
      "An undocumented top-level descriptor field was not validated.",
    );
  }
  return unknownFieldCount;
}

const pluginYmlKnownFields = new Set([
  "api-version",
  "author",
  "authors",
  "commands",
  "contributors",
  "default-permission",
  "depend",
  "description",
  "libraries",
  "load",
  "loadbefore",
  "main",
  "name",
  "paper-plugin-loader",
  "paper-skip-libraries",
  "permissions",
  "prefix",
  "provides",
  "softdepend",
  "version",
  "website",
]);

const paperPluginYmlKnownFields = new Set([
  "api-version",
  "author",
  "authors",
  "bootstrapper",
  "commands",
  "contributors",
  "default-permission",
  "dependencies",
  "description",
  "has-open-classloader",
  "load",
  "loader",
  "main",
  "name",
  "permissions",
  "prefix",
  "provides",
  "version",
  "website",
]);

function validatePluginYml(
  record: NormalizedYamlRecord,
  collector: DiagnosticCollector,
  entryPaths: Set<string>,
  entryListComplete: boolean,
): { unknownFieldCount: number; declaredClasses: PaperPluginDeclaredClassCheck[] } {
  const name = textValue(record, "name", pluginDescriptorPath, collector, {
    required: true,
    maximum: 128,
    allowNumber: true,
  });
  if (name !== null && !pluginName.test(name)) {
    collector.add(
      "error",
      "plugin.invalid-name",
      descriptorPointer(pluginDescriptorPath, "name"),
      "Bukkit plugin names may contain only letters, digits, spaces, underscores, dots, and hyphens.",
    );
  }
  textValue(record, "version", pluginDescriptorPath, collector, {
    required: true,
    maximum: 256,
    allowNumber: true,
  });
  validateOptionalTextFields(
    record,
    pluginDescriptorPath,
    ["author", "description", "prefix", "website"],
    collector,
  );
  for (const field of [
    "authors",
    "contributors",
    "depend",
    "loadbefore",
    "provides",
    "softdepend",
  ] as const) {
    validatePluginCoercedList(
      record[field],
      descriptorPointer(pluginDescriptorPath, field),
      collector,
    );
  }
  validatePluginCoercedList(
    record.libraries,
    descriptorPointer(pluginDescriptorPath, "libraries"),
    collector,
  );
  validatePluginLoadOrder(record.load, collector);
  validatePaperSkipLibraries(record["paper-skip-libraries"], collector);
  validatePermissionDefault(
    record["default-permission"],
    descriptorPointer(pluginDescriptorPath, "default-permission"),
    collector,
  );
  validatePermissions(record.permissions, pluginDescriptorPath, collector);
  validateCommands(record.commands, collector);
  parseApiVersion(record, pluginDescriptorPath, collector, false);

  const declaredClasses = [
    validateClassField(
      record,
      pluginDescriptorPath,
      "main",
      collector,
      entryPaths,
      entryListComplete,
      true,
    ),
    validateClassField(
      record,
      pluginDescriptorPath,
      "paper-plugin-loader",
      collector,
      entryPaths,
      entryListComplete,
      false,
    ),
  ].filter((value): value is PaperPluginDeclaredClassCheck => value !== null);
  return {
    unknownFieldCount: validateTopLevelUnknownFields(
      record,
      pluginYmlKnownFields,
      pluginDescriptorPath,
      collector,
    ),
    declaredClasses,
  };
}

function validatePaperDependencies(
  value: NormalizedYaml | undefined,
  collector: DiagnosticCollector,
): void {
  if (value === undefined) return;
  const base = descriptorPointer(paperPluginDescriptorPath, "dependencies");
  if (!isRecord(value)) {
    collector.add("error", "paper.dependencies-type", base, "dependencies must be a mapping.");
    return;
  }
  for (const [lifecycle, lifecycleValue] of Object.entries(value)) {
    if (lifecycle !== "bootstrap" && lifecycle !== "server") {
      collector.add(
        "unknown",
        "paper.dependencies-lifecycle",
        `${base}/<unknown-lifecycle>`,
        "Only bootstrap and server dependency lifecycles are documented.",
      );
      continue;
    }
    if (!isRecord(lifecycleValue)) {
      collector.add(
        "error",
        "paper.dependencies-lifecycle-type",
        `${base}/${lifecycle}`,
        "Dependency lifecycle entries must be mappings.",
      );
      continue;
    }
    const dependencies = Object.entries(lifecycleValue);
    if (dependencies.length > paperPluginJarValidationLimits.maxCollectionEntries) {
      collector.add(
        "error",
        "paper.dependencies-limit",
        `${base}/${lifecycle}`,
        `A dependency lifecycle must not exceed ${paperPluginJarValidationLimits.maxCollectionEntries} entries.`,
      );
    }
    for (const [index, [, dependencyValue]] of dependencies
      .slice(0, paperPluginJarValidationLimits.maxCollectionEntries)
      .entries()) {
      const path = `${base}/${lifecycle}/<dependency-${index + 1}>`;
      if (!isRecord(dependencyValue)) {
        collector.add(
          "error",
          "paper.dependency-type",
          path,
          "Paper dependency entries must be mappings.",
        );
        continue;
      }
      validateConfigurateEnum(
        dependencyValue.load,
        ["BEFORE", "AFTER", "OMIT"],
        `${path}/load`,
        "paper.dependency-load",
        "paper.dependency-load-normalized",
        "Dependency load",
        collector,
      );
      for (const field of ["required", "join-classpath"] as const) {
        if (dependencyValue[field] !== undefined && typeof dependencyValue[field] !== "boolean") {
          collector.add(
            "error",
            "paper.dependency-boolean",
            `${path}/${field}`,
            `${field} must be boolean.`,
          );
        }
      }
      for (const key of Object.keys(dependencyValue)) {
        if (!["join-classpath", "load", "required"].includes(key)) {
          collector.add(
            "unknown",
            "paper.dependency-unknown-field",
            `${path}/<unknown-field>`,
            "An undocumented dependency field was not validated.",
          );
        }
      }
    }
  }
}

function validatePaperPluginYml(
  record: NormalizedYamlRecord,
  collector: DiagnosticCollector,
  entryPaths: Set<string>,
  entryListComplete: boolean,
): { unknownFieldCount: number; declaredClasses: PaperPluginDeclaredClassCheck[] } {
  const name = textValue(record, "name", paperPluginDescriptorPath, collector, {
    required: true,
    maximum: 128,
  });
  if (
    name !== null &&
    (!pluginName.test(name) ||
      name.includes(" ") ||
      reservedPaperPluginNames.has(name.toLowerCase()))
  ) {
    collector.add(
      "error",
      "paper.invalid-name",
      descriptorPointer(paperPluginDescriptorPath, "name"),
      "Paper plugin name violates the current loader's documented name constraints.",
    );
  }
  textValue(record, "version", paperPluginDescriptorPath, collector, {
    required: true,
    maximum: 256,
    allowNumber: true,
  });
  validateOptionalTextFields(
    record,
    paperPluginDescriptorPath,
    ["author", "description", "prefix", "website"],
    collector,
  );
  for (const field of ["authors", "contributors", "provides"] as const) {
    validateStringList(
      record[field],
      descriptorPointer(paperPluginDescriptorPath, field),
      collector,
    );
  }
  validateConfigurateEnum(
    record.load,
    ["STARTUP", "POSTWORLD"],
    descriptorPointer(paperPluginDescriptorPath, "load"),
    "paper.load-order",
    "paper.load-order-normalized",
    "load",
    collector,
  );
  if (
    record["has-open-classloader"] !== undefined &&
    typeof record["has-open-classloader"] !== "boolean"
  ) {
    collector.add(
      "error",
      "paper.open-classloader",
      descriptorPointer(paperPluginDescriptorPath, "has-open-classloader"),
      "has-open-classloader must be boolean.",
    );
  }
  validatePermissionDefault(
    record["default-permission"],
    descriptorPointer(paperPluginDescriptorPath, "default-permission"),
    collector,
  );
  validatePermissions(record.permissions, paperPluginDescriptorPath, collector);
  validatePaperDependencies(record.dependencies, collector);
  parseApiVersion(record, paperPluginDescriptorPath, collector, true);
  if (record.commands !== undefined) {
    collector.add(
      "warning",
      "paper.commands-unused",
      descriptorPointer(paperPluginDescriptorPath, "commands"),
      "Paper plugins do not use paper-plugin.yml commands for command registration.",
    );
  }

  const declaredClasses = [
    validateClassField(
      record,
      paperPluginDescriptorPath,
      "main",
      collector,
      entryPaths,
      entryListComplete,
      true,
    ),
    validateClassField(
      record,
      paperPluginDescriptorPath,
      "bootstrapper",
      collector,
      entryPaths,
      entryListComplete,
      false,
    ),
    validateClassField(
      record,
      paperPluginDescriptorPath,
      "loader",
      collector,
      entryPaths,
      entryListComplete,
      false,
    ),
  ].filter((value): value is PaperPluginDeclaredClassCheck => value !== null);
  return {
    unknownFieldCount: validateTopLevelUnknownFields(
      record,
      paperPluginYmlKnownFields,
      paperPluginDescriptorPath,
      collector,
    ),
    declaredClasses,
  };
}

function buildResult(options: {
  collector: DiagnosticCollector;
  strength: PaperPluginJarValidationStrength;
  archiveBytes: number | null;
  entries: NormalizedArchiveEntry[];
  entryListComplete: boolean;
  zipStructureValidated: boolean;
  descriptors: PaperPluginDescriptorSummary[];
}): PaperPluginJarValidationResult {
  const { collector } = options;
  const diagnosticResult = collector.finish();
  const incompleteReasons = new Set<string>([
    "all-entry-content-integrity-not-validated",
    "declared-class-bytecode-contracts-not-validated",
    "paper-runtime-load-not-executed",
    "runtime-yaml-parser-parity-not-proven",
  ]);
  if (options.strength === "metadata") {
    incompleteReasons.add("archive-binary-not-provided");
    incompleteReasons.add("descriptor-content-integrity-not-validated");
  }
  if (!options.entryListComplete) incompleteReasons.add("archive-entry-list-incomplete");
  if (collector.unknownCount > 0) incompleteReasons.add("unvalidated-or-unknown-fields-present");
  if (
    options.descriptors.some(
      (descriptor) => descriptor.role === "active" && descriptor.experimental,
    )
  ) {
    incompleteReasons.add("paper-plugin-format-experimental");
  }
  if (
    options.descriptors.some(
      (descriptor) => descriptor.role === "active" && !descriptor.contentProvided,
    )
  ) {
    incompleteReasons.add("descriptor-content-not-provided");
  }
  if (options.descriptors.some((descriptor) => descriptor.role === "selection-unknown")) {
    incompleteReasons.add("active-descriptor-selection-not-proven");
  }
  if (
    options.descriptors.some(
      (descriptor) =>
        descriptor.role === "active" &&
        descriptor.declaredClasses.some((declaredClass) => declaredClass.entryObserved === false),
    )
  ) {
    incompleteReasons.add("declared-class-runtime-resolution-not-proven");
  }
  return {
    schemaVersion: 1,
    specification: {
      pluginYml: "https://docs.papermc.io/paper/dev/plugin-yml/",
      paperPluginYml: "https://docs.papermc.io/paper/dev/getting-started/paper-plugins/",
      paperPluginStatus: "experimental",
    },
    valid: collector.errorCount === 0,
    validationComplete: incompleteReasons.size === 0,
    validationStrength: options.strength,
    errorCount: collector.errorCount,
    warningCount: collector.warningCount,
    unknownCount: collector.unknownCount,
    diagnosticsTruncated: diagnosticResult.diagnosticsTruncated,
    omittedDiagnosticCount: diagnosticResult.omittedDiagnosticCount,
    incompleteReasons: [...incompleteReasons].sort(),
    archive: {
      bytes: options.archiveBytes,
      entriesInspected: options.entries.length,
      entryListComplete: options.entryListComplete,
      zipStructureValidated: options.zipStructureValidated,
      allEntryContentIntegrityValidated: false,
      descriptorCount: options.descriptors.filter((descriptor) => descriptor.entryObserved).length,
      bothDescriptorsObserved: descriptorPaths.every((path) =>
        options.entries.some((entry) => !entry.directory && entry.path === path),
      ),
    },
    descriptors: options.descriptors,
    diagnostics: diagnosticResult.diagnostics,
  };
}

function validatePaperPluginArchiveInternal(options: {
  strength: PaperPluginJarValidationStrength;
  archiveBytes: number | null;
  rawEntries: unknown;
  entryListComplete: boolean;
  zipStructureValidated: boolean;
  contents: DescriptorContents;
  contentIntegrity: ReadonlySet<PaperPluginDescriptorKind>;
  initialCollector?: DiagnosticCollector;
}): PaperPluginJarValidationResult {
  const collector = options.initialCollector ?? new DiagnosticCollector();
  const normalizedEntries = normalizeArchiveEntries(options.rawEntries, collector);
  const entries = normalizedEntries.entries;
  const entryListComplete = options.entryListComplete && normalizedEntries.evidenceComplete;
  const entryPaths = new Set(
    entries.filter((entry) => !entry.directory).map((entry) => entry.path),
  );
  const descriptorSummaries: PaperPluginDescriptorSummary[] = [];
  const paperEntryObserved = entryPaths.has(paperPluginDescriptorPath);
  const pluginEntryObserved = entryPaths.has(pluginDescriptorPath);
  const descriptorSelection: PaperPluginDescriptorKind | "unknown" | undefined =
    paperEntryObserved ||
    (!entryListComplete && options.contents[paperPluginDescriptorPath] !== undefined)
      ? paperPluginDescriptorPath
      : entryListComplete && pluginEntryObserved
        ? pluginDescriptorPath
        : !entryListComplete &&
            (pluginEntryObserved || options.contents[pluginDescriptorPath] !== undefined)
          ? "unknown"
          : undefined;
  if (descriptorSelection === "unknown") {
    collector.add(
      "unknown",
      "descriptor.selection-unproven",
      "/archiveEntries",
      "The incomplete archive listing cannot prove that paper-plugin.yml is absent, so plugin.yml was not semantically validated as the active descriptor.",
    );
  }

  for (const kind of descriptorPaths) {
    const entry = entries.find((candidate) => !candidate.directory && candidate.path === kind);
    const rawContent: unknown = options.contents[kind];
    const content = typeof rawContent === "string" ? rawContent : undefined;
    const role: PaperPluginDescriptorSummary["role"] =
      descriptorSelection === kind
        ? "active"
        : kind === pluginDescriptorPath && descriptorSelection === paperPluginDescriptorPath
          ? "shadowed"
          : kind === pluginDescriptorPath && descriptorSelection === "unknown"
            ? "selection-unknown"
            : "not-present";
    if (role !== "shadowed" && rawContent !== undefined && content === undefined) {
      collector.add(
        "error",
        "descriptor.content-type",
        descriptorPointer(kind),
        "Descriptor content must be text when supplied.",
      );
    }
    if (
      role === "active" &&
      entry &&
      entry.size > paperPluginJarValidationLimits.maxDescriptorBytes
    ) {
      collector.add(
        "error",
        "descriptor.entry-size-limit",
        descriptorPointer(kind),
        `Descriptor entry exceeds the ${paperPluginJarValidationLimits.maxDescriptorBytes}-byte limit.`,
      );
    }
    if (
      role === "active" &&
      entry?.compressedSize !== null &&
      entry?.compressedSize !== undefined &&
      entry.size > 0
    ) {
      const ratio =
        entry.compressedSize === 0 ? Number.POSITIVE_INFINITY : entry.size / entry.compressedSize;
      if (ratio > paperPluginJarValidationLimits.maxCompressionRatio) {
        collector.add(
          "error",
          "descriptor.compression-ratio",
          descriptorPointer(kind),
          `Descriptor compression ratio exceeds the ${paperPluginJarValidationLimits.maxCompressionRatio}:1 limit.`,
        );
      }
    }
    if (role !== "shadowed" && content !== undefined && !entry) {
      collector.add(
        entryListComplete ? "error" : "unknown",
        entryListComplete ? "descriptor.content-entry-mismatch" : "descriptor.entry-not-observed",
        descriptorPointer(kind),
        entryListComplete
          ? "Descriptor content was supplied, but the complete archive listing has no matching root entry."
          : "Descriptor content was supplied, but the incomplete archive listing does not prove a matching root entry.",
      );
    }
    if (role === "active" && entry && content === undefined) {
      collector.add(
        "unknown",
        "descriptor.content-unavailable",
        descriptorPointer(kind),
        "The descriptor entry was observed, but its content was not supplied for YAML validation.",
      );
    }
    if (!entry && content === undefined) continue;

    if (role === "shadowed") {
      collector.add(
        "warning",
        "descriptor.shadowed",
        descriptorPointer(kind),
        "Paper probes paper-plugin.yml first, so this plugin.yml descriptor is ignored at runtime.",
      );
    }
    if (role === "selection-unknown" && content !== undefined) {
      checkDescriptorTextBounds(kind, content, collector);
    }

    let yamlValidated = false;
    let unknownFieldCount = 0;
    let declaredClasses: PaperPluginDeclaredClassCheck[] = [];
    if (content !== undefined && role === "active") {
      const record = parseDescriptorYaml(kind, content, collector);
      if (record) {
        const validation =
          kind === pluginDescriptorPath
            ? validatePluginYml(record, collector, entryPaths, entryListComplete)
            : validatePaperPluginYml(record, collector, entryPaths, entryListComplete);
        unknownFieldCount = validation.unknownFieldCount;
        declaredClasses = validation.declaredClasses;
        yamlValidated = true;
      }
    }
    descriptorSummaries.push({
      kind,
      role,
      experimental: kind === paperPluginDescriptorPath,
      entryObserved: entry !== undefined,
      contentProvided: content !== undefined,
      contentIntegrityValidated: options.contentIntegrity.has(kind),
      yamlValidated,
      unknownFieldCount,
      declaredClasses,
    });
  }

  const anyDescriptorObservedOrProvided = descriptorSummaries.length > 0;
  if (!anyDescriptorObservedOrProvided) {
    collector.add(
      entryListComplete ? "error" : "unknown",
      entryListComplete ? "descriptor.missing" : "descriptor.not-observed",
      "/archiveEntries",
      entryListComplete
        ? "A plugin JAR must contain plugin.yml, paper-plugin.yml, or both at the archive root."
        : "The incomplete archive listing does not establish whether a root plugin descriptor exists.",
    );
  }
  for (const [index, entry] of entries.entries()) {
    const lower = entry.path.toLowerCase();
    if (
      !entry.directory &&
      !descriptorPathSet.has(entry.path) &&
      descriptorPaths.some((path) => path === lower)
    ) {
      collector.add(
        "warning",
        "descriptor.case-mismatch",
        `/archiveEntries/${index}/path`,
        "A descriptor-like entry has different casing and is not a root descriptor.",
      );
    }
  }
  return buildResult({
    collector,
    strength: options.strength,
    archiveBytes: options.archiveBytes,
    entries,
    entryListComplete,
    zipStructureValidated: options.zipStructureValidated,
    descriptors: descriptorSummaries,
  });
}

/**
 * Validates descriptor content and bounded archive-entry metadata without reading a binary JAR.
 * Absence claims are errors only when the caller marks the entry list complete.
 */
export function validatePaperPluginArchiveMetadata(
  options: ValidatePaperPluginArchiveMetadataOptions,
): PaperPluginJarValidationResult {
  return validatePaperPluginArchiveInternal({
    strength: "metadata",
    archiveBytes: null,
    rawEntries: options.archiveEntries,
    entryListComplete: options.archiveEntriesComplete === true,
    zipStructureValidated: false,
    contents: {
      ...(options.pluginYml !== undefined ? { [pluginDescriptorPath]: options.pluginYml } : {}),
      ...(options.paperPluginYml !== undefined
        ? { [paperPluginDescriptorPath]: options.paperPluginYml }
        : {}),
    },
    contentIntegrity: new Set(),
  });
}

function zipEntryMetadata(entry: ZipEntry): PaperPluginArchiveEntry {
  return {
    path: entry.name,
    size: entry.uncompressedSize,
    compressedSize: entry.compressedSize,
    directory: entry.directory,
  };
}

/**
 * Performs a bounded, offline inspection of a local Paper/Bukkit plugin JAR.
 * ZIP structure and descriptor CRCs are checked; arbitrary class bytecode is never expanded.
 */
export function validatePaperPluginJar(
  options: ValidatePaperPluginJarOptions,
): PaperPluginJarValidationResult {
  const collector = new DiagnosticCollector();
  if (!(options.archive instanceof Uint8Array)) {
    collector.add("error", "archive.binary-type", "/archive", "archive must be binary data.");
    return validatePaperPluginArchiveInternal({
      strength: "binary",
      archiveBytes: null,
      rawEntries: [],
      entryListComplete: false,
      zipStructureValidated: false,
      contents: {},
      contentIntegrity: new Set(),
      initialCollector: collector,
    });
  }
  if (options.archive.byteLength > paperPluginJarValidationLimits.maxArchiveBytes) {
    collector.add(
      "error",
      "archive.byte-limit",
      "/archive",
      `Archive exceeds the ${paperPluginJarValidationLimits.maxArchiveBytes}-byte limit.`,
    );
    return validatePaperPluginArchiveInternal({
      strength: "binary",
      archiveBytes: options.archive.byteLength,
      rawEntries: [],
      entryListComplete: false,
      zipStructureValidated: false,
      contents: {},
      contentIntegrity: new Set(),
      initialCollector: collector,
    });
  }

  let archive: ZipArchive;
  try {
    archive = openZipArchive(
      Buffer.from(options.archive.buffer, options.archive.byteOffset, options.archive.byteLength),
    );
  } catch {
    collector.add(
      "error",
      "archive.invalid-zip",
      "/archive",
      "Archive is not a supported, internally consistent ZIP/JAR file.",
    );
    return validatePaperPluginArchiveInternal({
      strength: "binary",
      archiveBytes: options.archive.byteLength,
      rawEntries: [],
      entryListComplete: false,
      zipStructureValidated: false,
      contents: {},
      contentIntegrity: new Set(),
      initialCollector: collector,
    });
  }

  const contents: DescriptorContents = {};
  const integrity = new Set<PaperPluginDescriptorKind>();
  if (archive.entries.length <= paperPluginJarValidationLimits.maxArchiveEntries) {
    const activeKind: PaperPluginDescriptorKind = archive.entries.some(
      (candidate) => !candidate.directory && candidate.name === paperPluginDescriptorPath,
    )
      ? paperPluginDescriptorPath
      : pluginDescriptorPath;
    for (const kind of [activeKind]) {
      const entry = archive.entries.find(
        (candidate) => !candidate.directory && candidate.name === kind,
      );
      if (!entry || entry.uncompressedSize > paperPluginJarValidationLimits.maxDescriptorBytes)
        continue;
      const ratio =
        entry.uncompressedSize === 0
          ? 0
          : entry.compressedSize === 0
            ? Number.POSITIVE_INFINITY
            : entry.uncompressedSize / entry.compressedSize;
      if (ratio > paperPluginJarValidationLimits.maxCompressionRatio) continue;
      try {
        contents[kind] = new TextDecoder("utf-8", { fatal: true }).decode(archive.readEntry(kind));
        integrity.add(kind);
      } catch {
        collector.add(
          "error",
          "descriptor.unreadable",
          descriptorPointer(kind),
          "Descriptor could not be decoded as integrity-checked UTF-8 text.",
        );
      }
    }
  }
  return validatePaperPluginArchiveInternal({
    strength: "binary",
    archiveBytes: options.archive.byteLength,
    rawEntries: archive.entries.map(zipEntryMetadata),
    entryListComplete: true,
    zipStructureValidated: true,
    contents,
    contentIntegrity: integrity,
    initialCollector: collector,
  });
}
