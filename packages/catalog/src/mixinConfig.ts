import { types as nodeTypes } from "node:util";

/** Hard ceilings for untrusted Mixin configuration and archive-entry metadata. */
export const mixinConfigValidationLimits = {
  maxConfigBytes: 256 * 1024,
  maxConfigCharacters: 256 * 1024,
  maxJsonDepth: 32,
  maxJsonNodes: 20_000,
  maxCollectionEntries: 4_096,
  maxScalarCharacters: 4_096,
  maxArchiveEntries: 25_000,
  maxArchiveEntryMetadataBytes: 32 * 1024 * 1024,
  maxEntryPathCharacters: 1_024,
  maxClassNameCharacters: 512,
  maxReferences: 512,
  maxDiagnostics: 200,
} as const;

const auditedMixinCommit = "4053421aa10aaac6127d969028a29c94fe3054f6";
const auditedMixinDate = "2026-08-25";
const auditedCompatibilityLevel = "JAVA_21";
const mixinSourceRoot = `https://github.com/SpongePowered/Mixin/blob/${auditedMixinCommit}`;
const auditedGsonVersion = "2.2.4";
const auditedGsonCommit = "ca40a338de56871027f6c31b62f47f810f092bef";
const gsonSourceRoot = `https://github.com/google/gson/blob/${auditedGsonCommit}`;
const gsonCoreSource = `${gsonSourceRoot}/src/main/java/com/google/gson/Gson.java`;

export type MixinConfigDiagnosticSeverity = "error" | "warning" | "unknown";

export type MixinConfigDiagnostic = {
  severity: MixinConfigDiagnosticSeverity;
  code: string;
  path: string;
  message: string;
};

export type MixinConfigReferenceKind =
  | "mixin-class"
  | "parent-config-resource"
  | "refmap-resource"
  | "plugin-class"
  | "refmap-wrapper-class"
  | "injection-point-class"
  | "dynamic-selector-class";

export type MixinConfigReferenceEvidence = {
  kind: MixinConfigReferenceKind;
  logicalName: string;
  archivePath: string;
  suppliedArchive: "observed" | "not-observed" | "not-checked";
};

export type MixinConfigValidationResult = {
  schemaVersion: 1;
  specification: {
    configLoader: string;
    versionParser: string;
    environmentGuide: string;
    mixinBuild: string;
    gsonAdapters: string;
    gsonReader: string;
    gsonCore: string;
    auditedCommit: string;
    auditedDate: string;
    compatibilityLevelsCurrentThrough: string;
    auditedGsonVersion: string;
  };
  valid: boolean;
  outcome: "valid" | "invalid" | "indeterminate";
  validationComplete: boolean;
  errorCount: number;
  warningCount: number;
  unknownCount: number;
  diagnosticsTruncated: boolean;
  omittedDiagnosticCount: number;
  source: {
    inputKind: "text" | "object" | null;
    jsonParsed: boolean;
    duplicateKeys: "checked-unique" | "observed" | "unknown" | "not-checked";
  };
  archiveEvidence: {
    provided: boolean;
    entriesInspected: number;
    entryListDeclaredComplete: boolean;
    entryListUsableComplete: boolean;
    referencesCompared: number;
    observedReferences: number;
    notObservedReferences: number;
  };
  summary: {
    commonMixins: number;
    clientMixins: number;
    serverMixins: number;
    uniqueDeclaredMixins: number;
    duplicateDeclarations: number;
    unknownTopLevelFields: number;
    references: number;
    unmappedReferences: number;
  };
  coverage: {
    checked: string[];
    notChecked: string[];
  };
  limits: typeof mixinConfigValidationLimits;
  references: MixinConfigReferenceEvidence[];
  diagnostics: MixinConfigDiagnostic[];
};

type SafeRecord = Record<string, unknown>;

type ParsedOptions = {
  config: unknown;
  archiveEntries: unknown;
  archiveEntriesComplete: boolean;
};

type ParsedConfig = {
  record: SafeRecord | null;
  inputKind: "text" | "object";
  jsonParsed: boolean;
  duplicateKeys: "checked-unique" | "observed" | "unknown" | "not-checked";
};

type ArchiveEvidence = {
  provided: boolean;
  entriesInspected: number;
  declaredComplete: boolean;
  usableComplete: boolean;
  files: Set<string>;
};

type DeclaredMixin = {
  collection: "mixins" | "client" | "server";
  value: string;
};

type ParsedStringField =
  | { kind: "absent"; value: null }
  | { kind: "mapped"; value: string }
  | { kind: "unmapped"; value: null }
  | { kind: "invalid"; value: null };

type ParsedStringArray = {
  values: string[];
  entryCount: number;
  unmappedEntries: number;
};

class BoundedInputError extends Error {}

class DiagnosticCollector {
  readonly diagnostics: MixinConfigDiagnostic[] = [];
  errorCount = 0;
  warningCount = 0;
  unknownCount = 0;

  private static severityRank(severity: MixinConfigDiagnosticSeverity): number {
    if (severity === "error") return 0;
    if (severity === "warning") return 1;
    return 2;
  }

  add(severity: MixinConfigDiagnosticSeverity, code: string, path: string, message: string): void {
    if (severity === "error") this.errorCount += 1;
    else if (severity === "warning") this.warningCount += 1;
    else this.unknownCount += 1;
    const diagnostic = { severity, code, path, message };
    if (this.diagnostics.length < mixinConfigValidationLimits.maxDiagnostics) {
      this.diagnostics.push(diagnostic);
      return;
    }

    const incomingRank = DiagnosticCollector.severityRank(severity);
    for (let index = this.diagnostics.length - 1; index >= 0; index -= 1) {
      const retained = this.diagnostics[index];
      if (retained && DiagnosticCollector.severityRank(retained.severity) > incomingRank) {
        this.diagnostics[index] = diagnostic;
        return;
      }
    }
  }

  finish(): {
    diagnostics: MixinConfigDiagnostic[];
    diagnosticsTruncated: boolean;
    omittedDiagnosticCount: number;
  } {
    const diagnostics = [...this.diagnostics].sort(
      (left, right) =>
        DiagnosticCollector.severityRank(left.severity) -
          DiagnosticCollector.severityRank(right.severity) ||
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
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x1f || (0x7f <= point && point <= 0x9f)) return true;
  }
  return false;
}

function inspectOptions(value: unknown, collector: DiagnosticCollector): ParsedOptions | null {
  if (typeof value !== "object" || value === null || nodeTypes.isProxy(value)) {
    collector.add(
      "error",
      "input.invalid-object",
      "/",
      "Mixin validation input must be a non-proxy plain data object.",
    );
    return null;
  }
  if (Array.isArray(value)) {
    collector.add(
      "error",
      "input.invalid-object",
      "/",
      "Mixin validation input must be a plain data object, not an array.",
    );
    return null;
  }

  let prototype: object | null;
  let keys: (string | symbol)[];
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    keys = Reflect.ownKeys(value);
  } catch {
    collector.add(
      "error",
      "input.unsafe-object",
      "/",
      "Mixin validation input could not be inspected without invoking user code.",
    );
    return null;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    collector.add(
      "error",
      "input.invalid-prototype",
      "/",
      "Mixin validation input must use a plain JSON object prototype.",
    );
    return null;
  }

  const allowed = new Set(["config", "archiveEntries", "archiveEntriesComplete"]);
  if (keys.length > allowed.size) {
    collector.add(
      "error",
      "input.field-limit",
      "/",
      "Mixin validation input contains too many top-level fields.",
    );
    return null;
  }
  if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) {
    collector.add(
      "error",
      "input.unknown-field",
      "/",
      "Mixin validation input contains an unsupported field.",
    );
    return null;
  }
  const fields = Object.create(null) as SafeRecord;
  let usable = true;
  for (const key of keys as string[]) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      descriptor = undefined;
    }
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      collector.add(
        "error",
        "input.unsafe-field",
        "/",
        "Mixin validation input fields must be own enumerable data properties.",
      );
      usable = false;
      continue;
    }
    fields[key] = descriptor.value as unknown;
  }
  if (!Object.hasOwn(fields, "config")) {
    collector.add("error", "input.missing-config", "/", "Mixin validation requires config data.");
    usable = false;
  }
  const complete = fields.archiveEntriesComplete;
  if (complete !== undefined && typeof complete !== "boolean") {
    collector.add(
      "error",
      "input.invalid-completeness",
      "/archiveEntriesComplete",
      "Archive-entry completeness must be a boolean.",
    );
    usable = false;
  }
  if (complete === true && !Object.hasOwn(fields, "archiveEntries")) {
    collector.add(
      "error",
      "input.missing-archive-entries",
      "/archiveEntries",
      "A complete archive-entry claim requires an archiveEntries array.",
    );
    usable = false;
  }
  if (!usable) return null;
  return {
    config: fields.config,
    archiveEntries: fields.archiveEntries,
    archiveEntriesComplete: complete === true,
  };
}

function cloneBoundedJson(value: unknown): unknown {
  const seen = new Set<object>();
  const state = { nodes: 0, characters: 0, bytes: 0 };

  const addText = (text: string): void => {
    state.characters += text.length;
    state.bytes += Buffer.byteLength(text, "utf8");
    if (
      text.length > mixinConfigValidationLimits.maxScalarCharacters ||
      state.characters > mixinConfigValidationLimits.maxConfigCharacters ||
      state.bytes > mixinConfigValidationLimits.maxConfigBytes
    ) {
      throw new BoundedInputError();
    }
  };

  const clone = (candidate: unknown, depth: number): unknown => {
    state.nodes += 1;
    if (
      state.nodes > mixinConfigValidationLimits.maxJsonNodes ||
      depth > mixinConfigValidationLimits.maxJsonDepth
    ) {
      throw new BoundedInputError();
    }
    if (typeof candidate === "string") {
      addText(candidate);
      return candidate;
    }
    if (
      candidate === null ||
      typeof candidate === "boolean" ||
      (typeof candidate === "number" && Number.isFinite(candidate))
    ) {
      return candidate;
    }
    if (typeof candidate !== "object" || nodeTypes.isProxy(candidate)) {
      throw new BoundedInputError();
    }
    if (seen.has(candidate)) throw new BoundedInputError();
    seen.add(candidate);

    if (Array.isArray(candidate)) {
      let prototype: object | null;
      let keys: (string | symbol)[];
      let lengthDescriptor: PropertyDescriptor | undefined;
      try {
        prototype = Object.getPrototypeOf(candidate) as object | null;
        keys = Reflect.ownKeys(candidate);
        lengthDescriptor = Object.getOwnPropertyDescriptor(candidate, "length");
      } catch {
        throw new BoundedInputError();
      }
      if (
        prototype !== Array.prototype ||
        !lengthDescriptor ||
        !("value" in lengthDescriptor) ||
        typeof lengthDescriptor.value !== "number" ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0 ||
        lengthDescriptor.value > mixinConfigValidationLimits.maxCollectionEntries ||
        keys.length !== lengthDescriptor.value + 1 ||
        keys.some((key) => typeof key !== "string")
      ) {
        throw new BoundedInputError();
      }
      const result: unknown[] = [];
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(candidate, String(index));
        if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
          throw new BoundedInputError();
        }
        result.push(clone(descriptor.value, depth + 1));
      }
      return result;
    }

    let prototype: object | null;
    let keys: (string | symbol)[];
    try {
      prototype = Object.getPrototypeOf(candidate) as object | null;
      keys = Reflect.ownKeys(candidate);
    } catch {
      throw new BoundedInputError();
    }
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length > mixinConfigValidationLimits.maxCollectionEntries ||
      keys.some((key) => typeof key !== "string")
    ) {
      throw new BoundedInputError();
    }
    const result = Object.create(null) as SafeRecord;
    for (const key of keys as string[]) {
      addText(key);
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        throw new BoundedInputError();
      }
      result[key] = clone(descriptor.value, depth + 1);
    }
    return result;
  };

  return clone(value, 0);
}

function hasDuplicateJsonObjectKey(input: string): boolean {
  type Frame = { kind: "array" } | { kind: "object"; expectingKey: boolean; keys: Set<string> };
  const stack: Frame[] = [];
  let duplicate = false;
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
          if (frame.keys.has(key)) duplicate = true;
          frame.keys.add(key);
          frame.expectingKey = false;
        }
      }
      continue;
    }
    if (character === "{") stack.push({ kind: "object", expectingKey: true, keys: new Set() });
    else if (character === "[") stack.push({ kind: "array" });
    else if (character === "}" || character === "]") stack.pop();
    else if (character === ",") {
      const frame = stack.at(-1);
      if (frame?.kind === "object") frame.expectingKey = true;
    }
    if (stack.length > mixinConfigValidationLimits.maxJsonDepth + 1) {
      throw new BoundedInputError();
    }
  }
  return duplicate;
}

function parseConfig(value: unknown, collector: DiagnosticCollector): ParsedConfig {
  const inputKind = typeof value === "string" ? "text" : "object";
  let parsed = value;
  let jsonParsed = false;
  let duplicateKeys: ParsedConfig["duplicateKeys"] = "unknown";
  if (typeof value === "string") {
    if (
      value.length > mixinConfigValidationLimits.maxConfigCharacters ||
      Buffer.byteLength(value, "utf8") > mixinConfigValidationLimits.maxConfigBytes
    ) {
      collector.add(
        "error",
        "config.input-limit",
        "/config",
        "Mixin configuration text exceeds the fixed UTF-8 input limit.",
      );
      return { record: null, inputKind, jsonParsed, duplicateKeys: "not-checked" };
    }
    try {
      duplicateKeys = hasDuplicateJsonObjectKey(value) ? "observed" : "checked-unique";
    } catch {
      collector.add(
        "error",
        "config.depth-limit",
        "/config",
        "Mixin configuration JSON exceeds the fixed nesting limit.",
      );
      return { record: null, inputKind, jsonParsed, duplicateKeys: "unknown" };
    }
    if (duplicateKeys === "observed") {
      collector.add(
        "warning",
        "config.duplicate-key",
        "/config",
        "Mixin configuration source contains duplicate object keys; source intent is ambiguous and the parsed last value is inspected.",
      );
    }
    try {
      parsed = JSON.parse(value) as unknown;
      jsonParsed = true;
    } catch {
      collector.add(
        "error",
        "config.invalid-json",
        "/config",
        "Mixin configuration is not valid strict JSON as required by the bounded offline profile.",
      );
      return { record: null, inputKind, jsonParsed, duplicateKeys };
    }
  } else {
    collector.add(
      "unknown",
      "config.source-keys-unchecked",
      "/config",
      "Parsed object input cannot prove whether the original JSON source contained duplicate keys.",
    );
  }

  let cloned: unknown;
  try {
    cloned = cloneBoundedJson(parsed);
  } catch {
    collector.add(
      "error",
      "config.unbounded-data",
      "/config",
      "Mixin configuration must be bounded plain JSON data without proxies, accessors, symbols, sparse arrays, cycles, or unsupported values.",
    );
    return { record: null, inputKind, jsonParsed, duplicateKeys };
  }
  if (typeof cloned !== "object" || cloned === null || Array.isArray(cloned)) {
    collector.add(
      "error",
      "config.invalid-root",
      "/config",
      "Mixin configuration must contain an object at the JSON document root.",
    );
    return { record: null, inputKind, jsonParsed, duplicateKeys };
  }
  return { record: cloned as SafeRecord, inputKind, jsonParsed, duplicateKeys };
}

function archivePathProblem(path: string): string | null {
  if (!path) return "Archive entry paths must not be empty.";
  if (path.length > mixinConfigValidationLimits.maxEntryPathCharacters) {
    return "Archive entry paths exceed the fixed path-length limit.";
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

function inspectArchiveEntries(
  value: unknown,
  declaredComplete: boolean,
  collector: DiagnosticCollector,
): ArchiveEvidence {
  if (value === undefined) {
    return {
      provided: false,
      entriesInspected: 0,
      declaredComplete,
      usableComplete: false,
      files: new Set(),
    };
  }
  if (nodeTypes.isProxy(value) || !Array.isArray(value)) {
    collector.add(
      "error",
      "archive.invalid-entries",
      "/archiveEntries",
      "Archive entries must be a non-proxy dense string array.",
    );
    return {
      provided: true,
      entriesInspected: 0,
      declaredComplete,
      usableComplete: false,
      files: new Set(),
    };
  }

  let prototype: object | null;
  let keys: (string | symbol)[];
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    keys = Reflect.ownKeys(value);
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    prototype = null;
    keys = [];
    lengthDescriptor = undefined;
  }
  if (
    prototype !== Array.prototype ||
    !lengthDescriptor ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    mixinConfigValidationLimits.maxArchiveEntries < lengthDescriptor.value ||
    keys.length !== lengthDescriptor.value + 1 ||
    keys.some((key) => typeof key !== "string")
  ) {
    collector.add(
      "error",
      "archive.invalid-entries",
      "/archiveEntries",
      "Archive entries must be a bounded dense array without holes, symbols, or extra properties.",
    );
    return {
      provided: true,
      entriesInspected: 0,
      declaredComplete,
      usableComplete: false,
      files: new Set(),
    };
  }

  const files = new Set<string>();
  const observed = new Set<string>();
  let usable = true;
  let duplicates = 0;
  let metadataBytes = 0;
  let metadataLimitReported = false;
  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      usable = false;
      continue;
    }
    const path = descriptor.value as unknown;
    if (typeof path !== "string" || archivePathProblem(path)) {
      collector.add(
        "error",
        "archive.invalid-entry-path",
        `/archiveEntries/${index}`,
        "Archive entry metadata contains an invalid logical path.",
      );
      usable = false;
      continue;
    }
    const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
    metadataBytes += Buffer.byteLength(normalized, "utf8");
    if (
      metadataBytes > mixinConfigValidationLimits.maxArchiveEntryMetadataBytes &&
      !metadataLimitReported
    ) {
      collector.add(
        "error",
        "archive.metadata-limit",
        "/archiveEntries",
        "Archive-entry path metadata exceeds the fixed aggregate UTF-8 byte limit.",
      );
      metadataLimitReported = true;
      usable = false;
    }
    if (observed.has(normalized)) duplicates += 1;
    observed.add(normalized);
    if (!path.endsWith("/")) files.add(path);
  }
  if (duplicates > 0) {
    collector.add(
      "warning",
      "archive.duplicate-entry",
      "/archiveEntries",
      "Archive metadata contains duplicate logical entry paths, so content selection remains ambiguous.",
    );
  }
  return {
    provided: true,
    entriesInspected: lengthDescriptor.value,
    declaredComplete,
    usableComplete: declaredComplete && usable,
    files,
  };
}

const topLevelFields = new Set([
  "parent",
  "target",
  "minVersion",
  "requiredFeatures",
  "compatibilityLevel",
  "required",
  "priority",
  "mixinPriority",
  "package",
  "mixins",
  "client",
  "server",
  "setSourceFile",
  "refmap",
  "refmapWrapper",
  "verbose",
  "plugin",
  "injectors",
  "overwrites",
]);

const injectorFields = new Set([
  "defaultRequire",
  "defaultGroup",
  "namespace",
  "injectionPoints",
  "dynamicSelectors",
  "maxShiftBy",
]);

const overwriteFields = new Set(["conformVisibility", "requireAnnotations"]);

function unknownFieldCount(record: SafeRecord, allowed: ReadonlySet<string>): number {
  return Object.keys(record).filter((key) => !allowed.has(key)).length;
}

function reportUnknownFields(count: number, path: string, collector: DiagnosticCollector): void {
  if (count === 0) return;
  collector.add(
    "unknown",
    "config.unknown-field",
    path,
    "Configuration contains fields not modeled by the current core Mixin source; bundled versions or forks may define them.",
  );
}

function optionalString(
  record: SafeRecord,
  name: string,
  path: string,
  collector: DiagnosticCollector,
): ParsedStringField {
  const value = record[name];
  if (value === undefined || value === null) return { kind: "absent", value: null };
  if (typeof value === "string") return { kind: "mapped", value };
  if (typeof value === "boolean") {
    collector.add(
      "warning",
      "config.noncanonical-scalar",
      path,
      "The audited Gson string adapter coerces this JSON boolean to a lower-case string.",
    );
    return { kind: "mapped", value: String(value) };
  }
  if (typeof value === "number") {
    collector.add(
      "unknown",
      "config.numeric-string-coercion-unmapped",
      path,
      "The audited Gson string adapter preserves the source number token, which is unavailable after bounded JSON parsing, so the coerced string is not mapped.",
    );
    return { kind: "unmapped", value: null };
  }
  collector.add(
    "error",
    "config.invalid-string",
    path,
    "Current core Mixin cannot deserialize an object or array into this string field.",
  );
  return { kind: "invalid", value: null };
}

function mappedString(field: ParsedStringField): string | null {
  return field.kind === "mapped" ? field.value : null;
}

function hasCoercedString(field: ParsedStringField): boolean {
  return field.kind === "mapped" || field.kind === "unmapped";
}

function hasNonEmptyCoercedString(field: ParsedStringField): boolean {
  return field.kind === "unmapped" || (field.kind === "mapped" && field.value.length > 0);
}

function checkOptionalBoolean(
  record: SafeRecord,
  name: string,
  path: string,
  collector: DiagnosticCollector,
): void {
  const value = record[name];
  if (value !== undefined && value !== null && typeof value !== "boolean") {
    if (typeof value === "string") {
      collector.add(
        "warning",
        "config.noncanonical-scalar",
        path,
        "The audited Gson boolean adapter coerces string values; the bounded offline profile expects a JSON boolean.",
      );
    } else {
      collector.add(
        "error",
        "config.invalid-boolean",
        path,
        "The audited Gson boolean adapter rejects this JSON value shape.",
      );
    }
  }
}

function trimJavaDoubleWhitespace(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) <= 0x20) start += 1;
  while (start < end && value.charCodeAt(end - 1) <= 0x20) end -= 1;
  return value.slice(start, end);
}

function parseAuditedGsonDecimalInteger(value: string): number | "unmapped" | null {
  const trimmed = trimJavaDoubleWhitespace(value);
  if (/^[+-]?(?:NaN|Infinity)$/u.test(trimmed)) return null;
  if (
    /^[+-]?0[xX](?:[0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?|\.[0-9a-fA-F]+)[pP][+-]?\d+[fFdD]?$/u.test(
      trimmed,
    )
  ) {
    return "unmapped";
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[fFdD]?$/u.test(trimmed)) {
    return null;
  }
  const withoutSuffix = /[fFdD]$/u.test(trimmed) ? trimmed.slice(0, -1) : trimmed;
  const parsed = Number(withoutSuffix);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < -2_147_483_648 || parsed > 2_147_483_647) return null;
  return parsed;
}

function optionalInteger(
  record: SafeRecord,
  name: string,
  path: string,
  collector: DiagnosticCollector,
): number | null {
  const value = record[name];
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < -2_147_483_648 || value > 2_147_483_647) {
      collector.add(
        "error",
        "config.invalid-integer",
        path,
        "Current Gson integer decoding requires a signed 32-bit integer value.",
      );
      return null;
    }
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseAuditedGsonDecimalInteger(value);
    if (parsed === "unmapped") {
      collector.add(
        "unknown",
        "config.integer-string-unmapped",
        path,
        "The audited Gson nextInt fallback parses Java hexadecimal floating-point syntax before its exact integer check, which the bounded offline profile does not evaluate.",
      );
      return null;
    }
    if (parsed === null) {
      collector.add(
        "error",
        "config.invalid-integer",
        path,
        "The audited Gson integer adapter cannot decode this string as an exact signed 32-bit integer.",
      );
      return null;
    }
    collector.add(
      "warning",
      "config.noncanonical-scalar",
      path,
      "The audited Gson integer adapter accepts this exact signed 32-bit numeric string; the bounded offline profile prefers a JSON integer.",
    );
    return parsed;
  }
  if (typeof value === "object") {
    collector.add(
      "error",
      "config.invalid-integer",
      path,
      "Current core Mixin cannot deserialize an object or array into this integer field.",
    );
  } else if (typeof value === "boolean") {
    collector.add(
      "error",
      "config.invalid-integer",
      path,
      "The audited Gson integer adapter rejects boolean values.",
    );
  }
  return null;
}

function stringArray(
  record: SafeRecord,
  name: string,
  path: string,
  collector: DiagnosticCollector,
  nullEntries: "error" | "ignore" | "warning" = "error",
): ParsedStringArray {
  const value = record[name];
  if (value === undefined || value === null) {
    return { values: [], entryCount: 0, unmappedEntries: 0 };
  }
  if (!Array.isArray(value)) {
    collector.add(
      "error",
      "config.invalid-list",
      path,
      "Current core Mixin models this field as a JSON array.",
    );
    return { values: [], entryCount: 0, unmappedEntries: 0 };
  }
  const strings: string[] = [];
  let entryCount = 0;
  let unmappedEntries = 0;
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (typeof entry === "string") {
      strings.push(entry);
      entryCount += 1;
    } else if (entry === null) {
      entryCount += 1;
      if (nullEntries === "error") {
        collector.add(
          "error",
          "config.invalid-null-list-entry",
          `${path}/${index}`,
          "Current core Mixin does not provide a safe null-entry contract for this list.",
        );
      } else if (nullEntries === "warning") {
        collector.add(
          "warning",
          "config.null-extension-entry",
          `${path}/${index}`,
          "Current core Mixin catches the failed null extension registration, so this entry has no effect.",
        );
      }
    } else if (typeof entry === "boolean") {
      strings.push(String(entry));
      entryCount += 1;
      collector.add(
        "warning",
        "config.noncanonical-list-entry",
        `${path}/${index}`,
        "The audited Gson string adapter coerces this JSON boolean list entry to a lower-case string.",
      );
    } else if (typeof entry === "number") {
      entryCount += 1;
      unmappedEntries += 1;
      collector.add(
        "unknown",
        "config.numeric-list-entry-unmapped",
        `${path}/${index}`,
        "The audited Gson string adapter preserves the source number token, which is unavailable after bounded JSON parsing, so this list entry is not mapped.",
      );
    } else {
      collector.add(
        "error",
        "config.invalid-list-entry",
        `${path}/${index}`,
        "Current core Mixin cannot model an object or array as a string list entry.",
      );
    }
  }
  return { values: strings, entryCount, unmappedEntries };
}

function nestedRecord(
  record: SafeRecord,
  name: string,
  path: string,
  collector: DiagnosticCollector,
): SafeRecord | null {
  const value = record[name];
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    collector.add(
      "error",
      "config.invalid-object",
      path,
      "Current core Mixin models this field as a JSON object.",
    );
    return null;
  }
  return value as SafeRecord;
}

function normalizedMixinPackage(value: string | null): string | null {
  if (
    value === null ||
    value.length === 0 ||
    value.trim() !== value ||
    hasControlCharacter(value)
  ) {
    return null;
  }
  const withoutTrailingDot = value.endsWith(".") ? value.slice(0, -1) : value;
  return /^(?:[A-Za-z_$][A-Za-z0-9_$]*)(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/u.test(withoutTrailingDot)
    ? withoutTrailingDot
    : null;
}

function canonicalClassName(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= mixinConfigValidationLimits.maxClassNameCharacters &&
    value.trim() === value &&
    !hasControlCharacter(value) &&
    /^(?:[A-Za-z_$][A-Za-z0-9_$]*)(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/u.test(value)
  );
}

function resourcePathProblem(value: string): boolean {
  return (
    value.length === 0 ||
    value.length > mixinConfigValidationLimits.maxEntryPathCharacters ||
    value.trim() !== value ||
    hasControlCharacter(value) ||
    value.startsWith("/") ||
    value.startsWith("\\") ||
    /^[A-Za-z]:/u.test(value) ||
    value.includes("\\") ||
    value.endsWith("/") ||
    value.split("/").some((segment) => !segment || segment === "." || segment === "..")
  );
}

function validateMinVersion(value: string | null, collector: DiagnosticCollector): void {
  if (value === null) return;
  const matched =
    /^(\d{1,5})(?:\.(\d{1,5})(?:\.(\d{1,5})(?:\.(\d{1,5}))?)?)?(-[a-zA-Z0-9_-]+)?$/u.exec(value);
  if (!matched) {
    collector.add(
      "warning",
      "config.min-version-unparsed",
      "/config/minVersion",
      "Current Mixin VersionNumber parsing treats this syntax as no parsed minimum, so the intended version guard is not proven.",
    );
    return;
  }
  const exceedsShort = matched.slice(1, 5).some((part) => part && Number(part) > 32_767);
  if (exceedsShort) {
    collector.add(
      "error",
      "config.min-version-out-of-range",
      "/config/minVersion",
      "Current Mixin VersionNumber parsing rejects version components above 32767.",
    );
  }
}

const currentCoreCompatibilityLevels = new Set(
  Array.from({ length: 16 }, (_, index) => `JAVA_${index + 6}`),
);

function validateCompatibility(value: string | null, collector: DiagnosticCollector): void {
  if (value === null) return;
  const normalized = value.trim().toUpperCase();
  if (!currentCoreCompatibilityLevels.has(normalized)) {
    collector.add(
      "unknown",
      "config.compatibility-runtime-dependent",
      "/config/compatibilityLevel",
      "This compatibility level is not in current core Mixin through JAVA_21; a bundled version or fork may define it.",
    );
  }
}

function validateResourceReference(
  value: string | null,
  path: string,
  kind: "parent-config-resource" | "refmap-resource",
  addReference: (kind: MixinConfigReferenceKind, logicalName: string, archivePath: string) => void,
  collector: DiagnosticCollector,
): number {
  if (value === null || (kind === "parent-config-resource" && value.length === 0)) return 0;
  if (resourcePathProblem(value)) {
    collector.add(
      "error",
      "config.invalid-resource-path",
      path,
      "The bounded offline profile requires a normalized relative classpath resource path.",
    );
    return 1;
  }
  addReference(kind, value, value);
  return 0;
}

function validateDirectClassReference(
  value: string | null,
  path: string,
  kind: "plugin-class" | "injection-point-class" | "dynamic-selector-class",
  addReference: (kind: MixinConfigReferenceKind, logicalName: string, archivePath: string) => void,
  collector: DiagnosticCollector,
): number {
  if (value === null) return 0;
  if (!canonicalClassName(value)) {
    collector.add(
      "unknown",
      "config.class-name-not-mapped",
      path,
      "The class name could not be mapped conservatively to a local archive entry; non-ASCII or launcher-specific names remain possible.",
    );
    return 1;
  }
  addReference(kind, value, `${value.replaceAll(".", "/")}.class`);
  return 0;
}

function finishInvalidResult(collector: DiagnosticCollector): MixinConfigValidationResult {
  const finished = collector.finish();
  return {
    schemaVersion: 1,
    specification: {
      configLoader: `${mixinSourceRoot}/src/main/java/org/spongepowered/asm/mixin/transformer/MixinConfig.java`,
      versionParser: `${mixinSourceRoot}/src/main/java/org/spongepowered/asm/util/VersionNumber.java`,
      environmentGuide:
        "https://github.com/SpongePowered/Mixin/wiki/Introduction-to-Mixins---The-Mixin-Environment",
      mixinBuild: `${mixinSourceRoot}/build.gradle`,
      gsonAdapters: `${gsonSourceRoot}/src/main/java/com/google/gson/internal/bind/TypeAdapters.java`,
      gsonReader: `${gsonSourceRoot}/src/main/java/com/google/gson/stream/JsonReader.java`,
      gsonCore: gsonCoreSource,
      auditedCommit: auditedMixinCommit,
      auditedDate: auditedMixinDate,
      compatibilityLevelsCurrentThrough: auditedCompatibilityLevel,
      auditedGsonVersion,
    },
    valid: false,
    outcome: "invalid",
    validationComplete: false,
    errorCount: collector.errorCount,
    warningCount: collector.warningCount,
    unknownCount: collector.unknownCount,
    diagnosticsTruncated: finished.diagnosticsTruncated,
    omittedDiagnosticCount: finished.omittedDiagnosticCount,
    source: {
      inputKind: null,
      jsonParsed: false,
      duplicateKeys: "not-checked",
    },
    archiveEvidence: {
      provided: false,
      entriesInspected: 0,
      entryListDeclaredComplete: false,
      entryListUsableComplete: false,
      referencesCompared: 0,
      observedReferences: 0,
      notObservedReferences: 0,
    },
    summary: {
      commonMixins: 0,
      clientMixins: 0,
      serverMixins: 0,
      uniqueDeclaredMixins: 0,
      duplicateDeclarations: 0,
      unknownTopLevelFields: 0,
      references: 0,
      unmappedReferences: 0,
    },
    coverage: {
      checked: [],
      notChecked: [
        "runtime classpath, Mixin version, required features, environment side, and launcher integration",
        "class bytecode, annotations, target classes, selectors, injections, remapping, or runtime application",
      ],
    },
    limits: mixinConfigValidationLimits,
    references: [],
    diagnostics: finished.diagnostics,
  };
}

/**
 * Validate bounded SpongePowered Mixin configuration data and optional local archive-entry evidence.
 * Local absence is never treated as proof of runtime classpath absence.
 */
export function validateMixinConfig(options: unknown): MixinConfigValidationResult {
  const collector = new DiagnosticCollector();
  const parsedOptions = inspectOptions(options, collector);
  if (!parsedOptions) return finishInvalidResult(collector);

  const parsed = parseConfig(parsedOptions.config, collector);
  const archive = inspectArchiveEntries(
    parsedOptions.archiveEntries,
    parsedOptions.archiveEntriesComplete,
    collector,
  );
  if (!parsed.record) {
    const invalid = finishInvalidResult(collector);
    invalid.source = {
      inputKind: parsed.inputKind,
      jsonParsed: parsed.jsonParsed,
      duplicateKeys: parsed.duplicateKeys,
    };
    invalid.archiveEvidence = {
      ...invalid.archiveEvidence,
      provided: archive.provided,
      entriesInspected: archive.entriesInspected,
      entryListDeclaredComplete: archive.declaredComplete,
      entryListUsableComplete: archive.usableComplete,
    };
    return invalid;
  }

  const config = parsed.record;
  const unknownTopLevelFields = unknownFieldCount(config, topLevelFields);
  reportUnknownFields(unknownTopLevelFields, "/config", collector);

  const references = new Map<string, Omit<MixinConfigReferenceEvidence, "suppliedArchive">>();
  let referenceLimitReported = false;
  let unmappedReferences = 0;
  const addReference = (
    kind: MixinConfigReferenceKind,
    logicalName: string,
    archivePath: string,
  ): void => {
    const identity = `${kind}\u0000${logicalName}\u0000${archivePath}`;
    if (references.has(identity)) return;
    if (references.size >= mixinConfigValidationLimits.maxReferences) {
      if (!referenceLimitReported) {
        collector.add(
          "error",
          "config.reference-limit",
          "/config",
          "Mixin configuration exceeds the fixed referenced-entry comparison limit.",
        );
        referenceLimitReported = true;
      }
      return;
    }
    references.set(identity, { kind, logicalName, archivePath });
  };

  const parentField = optionalString(config, "parent", "/config/parent", collector);
  const refmapField = optionalString(config, "refmap", "/config/refmap", collector);
  unmappedReferences +=
    parentField.kind === "unmapped"
      ? 1
      : validateResourceReference(
          mappedString(parentField),
          "/config/parent",
          "parent-config-resource",
          addReference,
          collector,
        );
  unmappedReferences +=
    refmapField.kind === "unmapped"
      ? 1
      : validateResourceReference(
          mappedString(refmapField),
          "/config/refmap",
          "refmap-resource",
          addReference,
          collector,
        );

  const minVersionField = optionalString(config, "minVersion", "/config/minVersion", collector);
  const compatibilityField = optionalString(
    config,
    "compatibilityLevel",
    "/config/compatibilityLevel",
    collector,
  );
  validateMinVersion(mappedString(minVersionField), collector);
  validateCompatibility(mappedString(compatibilityField), collector);

  checkOptionalBoolean(config, "required", "/config/required", collector);
  checkOptionalBoolean(config, "setSourceFile", "/config/setSourceFile", collector);
  checkOptionalBoolean(config, "verbose", "/config/verbose", collector);
  optionalInteger(config, "priority", "/config/priority", collector);
  optionalInteger(config, "mixinPriority", "/config/mixinPriority", collector);
  optionalString(config, "target", "/config/target", collector);

  const requiredFeatures = stringArray(
    config,
    "requiredFeatures",
    "/config/requiredFeatures",
    collector,
  );
  const hasParent = hasNonEmptyCoercedString(parentField);
  if (!hasParent && !hasCoercedString(minVersionField) && requiredFeatures.entryCount === 0) {
    collector.add(
      "warning",
      "config.version-guard-missing",
      "/config",
      "Current core Mixin logs an error when neither minVersion nor requiredFeatures is declared.",
    );
  }

  const packageField = optionalString(config, "package", "/config/package", collector);
  const packageValue = mappedString(packageField);
  const mixinPackage = normalizedMixinPackage(packageValue);
  if (packageValue !== null && mixinPackage === null) {
    collector.add(
      "unknown",
      "config.package-not-mapped",
      "/config/package",
      "The package could not be mapped conservatively to archive paths; non-ASCII or launcher-specific names remain possible.",
    );
  }

  const common = stringArray(config, "mixins", "/config/mixins", collector, "ignore");
  const client = stringArray(config, "client", "/config/client", collector, "ignore");
  const server = stringArray(config, "server", "/config/server", collector, "ignore");
  unmappedReferences += common.unmappedEntries + client.unmappedEntries + server.unmappedEntries;
  const declared: DeclaredMixin[] = [
    ...common.values.map((value) => ({ collection: "mixins" as const, value })),
    ...client.values.map((value) => ({ collection: "client" as const, value })),
    ...server.values.map((value) => ({ collection: "server" as const, value })),
  ];
  const declaredEntryCount = common.entryCount + client.entryCount + server.entryCount;
  if (declaredEntryCount > 0 && !hasNonEmptyCoercedString(packageField)) {
    collector.add(
      "error",
      "config.missing-package",
      "/config/package",
      "Current core Mixin does not load declared mixins when the configuration has no package.",
    );
  }

  const byCollection = {
    mixins: new Map<string, number>(),
    client: new Map<string, number>(),
    server: new Map<string, number>(),
  };
  for (const entry of declared) {
    const map = byCollection[entry.collection];
    map.set(entry.value, (map.get(entry.value) ?? 0) + 1);
    if (!canonicalClassName(entry.value)) {
      collector.add(
        "unknown",
        "config.mixin-class-not-mapped",
        `/config/${entry.collection}`,
        "A declared mixin name could not be mapped conservatively to a local class entry.",
      );
      unmappedReferences += 1;
      continue;
    }
    if (mixinPackage !== null) {
      const logicalName = `${mixinPackage}.${entry.value}`;
      if (logicalName.length > mixinConfigValidationLimits.maxClassNameCharacters) {
        collector.add(
          "error",
          "config.class-name-limit",
          `/config/${entry.collection}`,
          "A fully-qualified mixin class exceeds the fixed comparison length limit.",
        );
        continue;
      }
      addReference("mixin-class", logicalName, `${logicalName.replaceAll(".", "/")}.class`);
    } else {
      unmappedReferences += 1;
    }
  }

  const withinDuplicates = Object.values(byCollection).reduce(
    (total, map) =>
      total + [...map.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    0,
  );
  const commonClientDuplicates = [...byCollection.mixins.keys()].filter((name) =>
    byCollection.client.has(name),
  ).length;
  const commonServerDuplicates = [...byCollection.mixins.keys()].filter((name) =>
    byCollection.server.has(name),
  ).length;
  const duplicateDeclarations = withinDuplicates + commonClientDuplicates + commonServerDuplicates;
  if (duplicateDeclarations > 0) {
    collector.add(
      "warning",
      "config.duplicate-mixin-declaration",
      "/config",
      "A mixin is repeated within one list or across common and sided lists; client-only plus server-only declarations are intentionally not treated as duplicates.",
    );
  }

  const pluginField = optionalString(config, "plugin", "/config/plugin", collector);
  unmappedReferences +=
    pluginField.kind === "unmapped"
      ? 1
      : validateDirectClassReference(
          mappedString(pluginField),
          "/config/plugin",
          "plugin-class",
          addReference,
          collector,
        );

  const refmapWrapperField = optionalString(
    config,
    "refmapWrapper",
    "/config/refmapWrapper",
    collector,
  );
  const refmapWrapper = mappedString(refmapWrapperField);
  if (refmapWrapperField.kind === "unmapped") {
    unmappedReferences += 1;
  } else if (refmapWrapper !== null) {
    if (mixinPackage !== null && canonicalClassName(refmapWrapper)) {
      const logicalName = `${mixinPackage}.${refmapWrapper}`;
      addReference(
        "refmap-wrapper-class",
        logicalName,
        `${logicalName.replaceAll(".", "/")}.class`,
      );
    } else {
      collector.add(
        "unknown",
        "config.class-name-not-mapped",
        "/config/refmapWrapper",
        "The package-relative refmap wrapper could not be mapped conservatively to a local class entry.",
      );
      unmappedReferences += 1;
    }
  }

  const injectors = nestedRecord(config, "injectors", "/config/injectors", collector);
  if (injectors) {
    reportUnknownFields(
      unknownFieldCount(injectors, injectorFields),
      "/config/injectors",
      collector,
    );
    optionalInteger(injectors, "defaultRequire", "/config/injectors/defaultRequire", collector);
    optionalString(injectors, "defaultGroup", "/config/injectors/defaultGroup", collector);
    optionalString(injectors, "namespace", "/config/injectors/namespace", collector);
    const maxShiftBy = optionalInteger(
      injectors,
      "maxShiftBy",
      "/config/injectors/maxShiftBy",
      collector,
    );
    if (maxShiftBy !== null && (maxShiftBy < 0 || 5 < maxShiftBy)) {
      collector.add(
        "warning",
        "config.max-shift-clamped",
        "/config/injectors/maxShiftBy",
        "Current core Mixin clamps maxShiftBy to the inclusive range 0 through 5.",
      );
    }
    for (const [field, kind] of [
      ["injectionPoints", "injection-point-class"],
      ["dynamicSelectors", "dynamic-selector-class"],
    ] as const) {
      const classes = stringArray(
        injectors,
        field,
        `/config/injectors/${field}`,
        collector,
        "warning",
      );
      unmappedReferences += classes.unmappedEntries;
      for (const className of classes.values) {
        unmappedReferences += validateDirectClassReference(
          className,
          `/config/injectors/${field}`,
          kind,
          addReference,
          collector,
        );
      }
    }
  }

  const overwrites = nestedRecord(config, "overwrites", "/config/overwrites", collector);
  if (overwrites) {
    reportUnknownFields(
      unknownFieldCount(overwrites, overwriteFields),
      "/config/overwrites",
      collector,
    );
    checkOptionalBoolean(
      overwrites,
      "conformVisibility",
      "/config/overwrites/conformVisibility",
      collector,
    );
    checkOptionalBoolean(
      overwrites,
      "requireAnnotations",
      "/config/overwrites/requireAnnotations",
      collector,
    );
  }

  let observedReferences = 0;
  let notObservedReferences = 0;
  const referenceEvidence = [...references.values()]
    .map((reference): MixinConfigReferenceEvidence => {
      const observed = archive.provided && archive.files.has(reference.archivePath);
      if (observed) observedReferences += 1;
      else if (archive.usableComplete) notObservedReferences += 1;
      return {
        ...reference,
        suppliedArchive: observed
          ? "observed"
          : archive.usableComplete
            ? "not-observed"
            : "not-checked",
      };
    })
    .sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) || left.archivePath.localeCompare(right.archivePath),
    );
  if (notObservedReferences > 0) {
    collector.add(
      "unknown",
      "archive.reference-not-observed",
      "/archiveEntries",
      "One or more references were not observed in the supplied complete archive; dependencies, the wider runtime classpath, and plugin-generated mixins were not inspected.",
    );
  }

  const uniqueDeclaredMixins = new Set(declared.map((entry) => entry.value)).size;
  const finished = collector.finish();
  const valid = collector.errorCount === 0;
  const outcome = !valid ? "invalid" : collector.unknownCount > 0 ? "indeterminate" : "valid";
  return {
    schemaVersion: 1,
    specification: {
      configLoader: `${mixinSourceRoot}/src/main/java/org/spongepowered/asm/mixin/transformer/MixinConfig.java`,
      versionParser: `${mixinSourceRoot}/src/main/java/org/spongepowered/asm/util/VersionNumber.java`,
      environmentGuide:
        "https://github.com/SpongePowered/Mixin/wiki/Introduction-to-Mixins---The-Mixin-Environment",
      mixinBuild: `${mixinSourceRoot}/build.gradle`,
      gsonAdapters: `${gsonSourceRoot}/src/main/java/com/google/gson/internal/bind/TypeAdapters.java`,
      gsonReader: `${gsonSourceRoot}/src/main/java/com/google/gson/stream/JsonReader.java`,
      gsonCore: gsonCoreSource,
      auditedCommit: auditedMixinCommit,
      auditedDate: auditedMixinDate,
      compatibilityLevelsCurrentThrough: auditedCompatibilityLevel,
      auditedGsonVersion,
    },
    valid,
    outcome,
    validationComplete:
      valid &&
      collector.unknownCount === 0 &&
      !finished.diagnosticsTruncated &&
      parsed.duplicateKeys !== "unknown" &&
      (!archive.provided || archive.usableComplete),
    errorCount: collector.errorCount,
    warningCount: collector.warningCount,
    unknownCount: collector.unknownCount,
    diagnosticsTruncated: finished.diagnosticsTruncated,
    omittedDiagnosticCount: finished.omittedDiagnosticCount,
    source: {
      inputKind: parsed.inputKind,
      jsonParsed: parsed.jsonParsed,
      duplicateKeys: parsed.duplicateKeys,
    },
    archiveEvidence: {
      provided: archive.provided,
      entriesInspected: archive.entriesInspected,
      entryListDeclaredComplete: archive.declaredComplete,
      entryListUsableComplete: archive.usableComplete,
      referencesCompared: archive.provided ? referenceEvidence.length : 0,
      observedReferences,
      notObservedReferences,
    },
    summary: {
      commonMixins: common.entryCount,
      clientMixins: client.entryCount,
      serverMixins: server.entryCount,
      uniqueDeclaredMixins,
      duplicateDeclarations,
      unknownTopLevelFields,
      references: referenceEvidence.length,
      unmappedReferences,
    },
    coverage: {
      checked: [
        "bounded JSON root and current core Mixin field shapes",
        "current VersionNumber syntax and component range",
        "normalized classpath resource references and conservative class-entry mapping",
        "duplicate declarations within one list or between common and sided lists",
        ...(archive.provided
          ? ["supplied archive-entry path metadata and local reference presence"]
          : []),
      ],
      notChecked: [
        "runtime classpath, Mixin version, required features, environment side, and launcher integration",
        "parent configuration contents or inherited options",
        "companion-plugin-generated mixins or refmap selection",
        "class bytecode, annotations, target classes, selectors, injections, remapping, or runtime application",
        "archive entry content, ZIP structure, signatures, or runtime/security behavior",
      ],
    },
    limits: mixinConfigValidationLimits,
    references: referenceEvidence,
    diagnostics: finished.diagnostics,
  };
}
