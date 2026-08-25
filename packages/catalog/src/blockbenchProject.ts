import { types as nodeTypes } from "node:util";

/** Fixed ceilings for untrusted Blockbench project data and bounded result evidence. */
export const blockbenchProjectInspectionLimits = Object.freeze({
  maxProjectCharacters: 8 * 1024 * 1024,
  maxProjectBytes: 8 * 1024 * 1024,
  maxJsonDepth: 64,
  maxJsonNodes: 200_000,
  maxCollectionEntries: 100_000,
  maxPropertyNameCharacters: 1_024,
  maxScalarCharacters: 8 * 1024 * 1024,
  maxNamedEntriesInspected: 4_096,
  maxOutlinerEntriesInspected: 25_000,
  maxRetainedNames: 4_096,
  maxNameCharacters: 512,
  maxRequiredNames: 128,
  maxRequiredNameBytes: 64 * 1024,
  maxDiagnostics: 200,
} as const);

export type BlockbenchProjectDiagnosticSeverity = "error" | "warning" | "unknown";

export type BlockbenchProjectDiagnostic = {
  severity: BlockbenchProjectDiagnosticSeverity;
  code: string;
  path: string;
  message: string;
};

export type BlockbenchRequestedNameStatus = "present" | "missing" | "unknown";

export type BlockbenchRequestedNameEvidence = {
  name: string;
  status: BlockbenchRequestedNameStatus;
};

export type BlockbenchProjectInspectionOptions = {
  project: unknown;
  requireAnimations?: readonly string[];
  requireGroups?: readonly string[];
  limit?: number;
};

export type BlockbenchProjectNameCollection = {
  sourceField: "animations" | "groups" | "outliner";
  declaredEntries: number;
  inspectedEntries: number;
  observedNameCount: number;
  uniqueNameCount: number;
  duplicateNameCount: number;
  complete: boolean;
  names: string[];
};

export type BlockbenchProjectInspectionResult = {
  schemaVersion: 1;
  outcome: "inspected" | "invalid-input" | "indeterminate";
  inspectionComplete: boolean;
  source: {
    inputKind: "text" | "object" | null;
    jsonParsed: boolean;
    duplicateKeys: "checked-unique" | "observed" | "unknown" | "not-checked";
  };
  metadata: {
    format_version: string | null;
    formatVersionField: "format_version" | "format" | null;
    formatVersionRelation: "current" | "legacy" | "newer" | "unknown";
    model_format: string | null;
    effectiveModelFormat: string | null;
    modelFormatSupport: "audited-core" | "unknown-or-plugin" | "unknown";
  };
  collections: {
    animations: BlockbenchProjectNameCollection;
    groups: BlockbenchProjectNameCollection;
  };
  requested: {
    animations: BlockbenchRequestedNameEvidence[];
    groups: BlockbenchRequestedNameEvidence[];
  };
  sourceEvidence: {
    kind: "official-source-snapshot";
    blockbenchVersion: "5.1.6";
    auditedCommit: "47e633e4a1338f957ee7baa0acbcf54da11e77df";
    auditedDate: "2026-08-25";
    currentFormatVersion: "5.0";
    wikiUrl: string;
    formatSourceUrl: string;
    animationSourceUrl: string;
    groupSourceUrl: string;
    versionSourceUrl: string;
  };
  coverage: {
    checked: string[];
    notChecked: string[];
  };
  nonGuarantees: string[];
  limits: typeof blockbenchProjectInspectionLimits & { appliedDiagnosticLimit: number };
  errorCount: number;
  warningCount: number;
  unknownCount: number;
  diagnosticTotal: number;
  diagnosticsTruncated: boolean;
  omittedDiagnosticCount: number;
  diagnostics: BlockbenchProjectDiagnostic[];
};

type SafeRecord = Record<string, unknown>;

type ParsedOptions = {
  project: unknown;
  requiredAnimations: string[];
  requiredGroups: string[];
  diagnosticLimit: number;
};

type ParsedProject = {
  record: SafeRecord | null;
  inputKind: "text" | "object";
  jsonParsed: boolean;
  duplicateKeys: BlockbenchProjectInspectionResult["source"]["duplicateKeys"];
  fatal: boolean;
};

type ParsedVersion = {
  version: number[];
  beta: number[] | null;
};

type CollectionState = {
  sourceField: BlockbenchProjectNameCollection["sourceField"];
  declaredEntries: number;
  inspectedEntries: number;
  observedNameCount: number;
  complete: boolean;
  names: Set<string>;
  duplicateNameCount: number;
};

class BoundedInputError extends Error {}

const auditedCommit = "47e633e4a1338f957ee7baa0acbcf54da11e77df";
const currentFormatVersion = "5.0";
const sourceRoot = `https://github.com/JannisX11/blockbench/blob/${auditedCommit}`;
const auditedCoreModelFormats = new Set([
  "bedrock",
  "bedrock_block",
  "bedrock_old",
  "free",
  "image",
  "java_block",
  "modded_entity",
  "optifine_entity",
  "optifine_part",
  "skin",
]);

const checkedCoverage = Object.freeze([
  "JSON decoding and bounded plain-data structure",
  "meta.format_version with the official meta.format legacy fallback",
  "meta.model_format with the official core-format fallback",
  "animations[].name exact case-sensitive presence",
  "format 5 groups[].name exact case-sensitive presence",
  "pre-5 legacy outliner group names using children/content nesting",
]);

const notCheckedCoverage = Object.freeze([
  "complete .bbmodel validity or forward compatibility",
  "animation runtime behavior, animator targets, keyframes, expressions, or playback",
  "texture decoding, texture paths, embedded data, rendering, or export output",
  "outliner UUID consistency, element geometry, editor state, history, or references",
  "plugin-defined or custom project-format semantics",
  "ModelEngine or other blueprint compatibility",
  "whether any group, including one named seat, enables mounting or seating behavior",
]);

const nonGuarantees = Object.freeze([
  "The official Blockbench wiki describes .bbmodel as an internal project format that may receive breaking changes and has no complete JSON specification.",
  "A present name proves only an exact name in the inspected data; it does not prove runtime use, export compatibility, or behavior.",
  "A group named seat is treated exactly like every other group name and does not prove that a model can be mounted or seated on.",
  "Parsed object input cannot establish whether an earlier raw JSON source contained duplicate object keys.",
  "Compressed <lz> projects, newer formats, and unknown or plugin model formats require Blockbench or format-specific inspection.",
]);

class DiagnosticCollector {
  readonly diagnostics: BlockbenchProjectDiagnostic[] = [];
  errorCount = 0;
  warningCount = 0;
  unknownCount = 0;
  private limit: number = blockbenchProjectInspectionLimits.maxDiagnostics;

  get appliedLimit(): number {
    return this.limit;
  }

  setLimit(limit: number): void {
    this.limit = limit;
    if (this.diagnostics.length > limit) {
      this.diagnostics.length = limit;
    }
  }

  add(
    severity: BlockbenchProjectDiagnosticSeverity,
    code: string,
    path: string,
    message: string,
  ): void {
    if (severity === "error") {
      this.errorCount += 1;
    } else if (severity === "warning") {
      this.warningCount += 1;
    } else {
      this.unknownCount += 1;
    }
    if (this.diagnostics.length < this.limit) {
      this.diagnostics.push({ severity, code, path, message });
    }
  }

  finish(): {
    diagnostics: BlockbenchProjectDiagnostic[];
    diagnosticTotal: number;
    diagnosticsTruncated: boolean;
    omittedDiagnosticCount: number;
  } {
    const rank: Record<BlockbenchProjectDiagnosticSeverity, number> = {
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
    const diagnosticTotal = this.errorCount + this.warningCount + this.unknownCount;
    return {
      diagnostics,
      diagnosticTotal,
      diagnosticsTruncated: diagnostics.length < diagnosticTotal,
      omittedDiagnosticCount: Math.max(0, diagnosticTotal - diagnostics.length),
    };
  }
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x1f || (0x7f <= point && point <= 0x9f)) {
      return true;
    }
  }
  return false;
}

function inspectDataObject(
  value: unknown,
  maxProperties: number,
): { ok: true; descriptors: Record<string, PropertyDescriptor> } | { ok: false } {
  if (
    typeof value !== "object" ||
    value === null ||
    nodeTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    return { ok: false };
  }
  try {
    const prototype = Object.getPrototypeOf(value) as object | null;
    const keys = Reflect.ownKeys(value);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length > maxProperties ||
      keys.some((key) => typeof key !== "string")
    ) {
      return { ok: false };
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of keys as string[]) {
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        return { ok: false };
      }
    }
    return { ok: true, descriptors };
  } catch {
    return { ok: false };
  }
}

function inspectDenseDataArray(value: unknown, maxLength: number): unknown[] | null {
  if (nodeTypes.isProxy(value) || !Array.isArray(value)) {
    return null;
  }
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    const keys = Reflect.ownKeys(value);
    if (
      !lengthDescriptor ||
      !("value" in lengthDescriptor) ||
      typeof lengthDescriptor.value !== "number" ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      maxLength < lengthDescriptor.value ||
      keys.length !== lengthDescriptor.value + 1 ||
      keys.some((key) => typeof key !== "string")
    ) {
      return null;
    }
    const result: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        return null;
      }
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function parseRequiredNames(
  value: unknown,
  path: string,
  collector: DiagnosticCollector,
): string[] | null {
  if (value === undefined) {
    return [];
  }
  const entries = inspectDenseDataArray(value, blockbenchProjectInspectionLimits.maxRequiredNames);
  if (!entries) {
    collector.add(
      "error",
      "input.invalid-required-names",
      path,
      `Required names must be a dense data array with at most ${blockbenchProjectInspectionLimits.maxRequiredNames} entries.`,
    );
    return null;
  }
  let bytes = 0;
  const unique = new Set<string>();
  for (let index = 0; index < entries.length; index += 1) {
    const name = entries[index];
    if (
      typeof name !== "string" ||
      blockbenchProjectInspectionLimits.maxNameCharacters < name.length ||
      hasControlCharacter(name)
    ) {
      collector.add(
        "error",
        "input.invalid-required-name",
        `${path}/${index}`,
        "Required names must be bounded strings without control characters.",
      );
      return null;
    }
    bytes += Buffer.byteLength(name, "utf8");
    if (blockbenchProjectInspectionLimits.maxRequiredNameBytes < bytes) {
      collector.add(
        "error",
        "input.required-name-byte-limit",
        path,
        "Required names exceed the fixed aggregate UTF-8 byte limit.",
      );
      return null;
    }
    unique.add(name);
  }
  return [...unique].sort(compareText);
}

function inspectOptions(value: unknown, collector: DiagnosticCollector): ParsedOptions | null {
  const inspected = inspectDataObject(value, 4);
  if (!inspected.ok) {
    collector.add(
      "error",
      "input.invalid-options",
      "/",
      "Blockbench inspection options must be a bounded plain data object without proxies, accessors, symbols, or hidden properties.",
    );
    return null;
  }
  const allowed = new Set(["project", "requireAnimations", "requireGroups", "limit"]);
  const keys = Object.keys(inspected.descriptors);
  if (keys.some((key) => !allowed.has(key))) {
    collector.add(
      "error",
      "input.unknown-option",
      "/",
      "Blockbench inspection options contain an unsupported field.",
    );
    return null;
  }
  if (!("project" in inspected.descriptors)) {
    collector.add(
      "error",
      "input.missing-project",
      "/project",
      "Blockbench inspection requires project data.",
    );
    return null;
  }
  const limit = inspected.descriptors.limit?.value;
  if (
    limit !== undefined &&
    (typeof limit !== "number" ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      blockbenchProjectInspectionLimits.maxDiagnostics < limit)
  ) {
    collector.add(
      "error",
      "input.invalid-diagnostic-limit",
      "/limit",
      `Diagnostic limit must be an integer from 1 through ${blockbenchProjectInspectionLimits.maxDiagnostics}.`,
    );
    return null;
  }
  const diagnosticLimit =
    (limit as number | undefined) ?? blockbenchProjectInspectionLimits.maxDiagnostics;
  collector.setLimit(diagnosticLimit);
  const requiredAnimations = parseRequiredNames(
    inspected.descriptors.requireAnimations?.value,
    "/requireAnimations",
    collector,
  );
  const requiredGroups = parseRequiredNames(
    inspected.descriptors.requireGroups?.value,
    "/requireGroups",
    collector,
  );
  if (!requiredAnimations || !requiredGroups) {
    return null;
  }
  return {
    project: inspected.descriptors.project?.value,
    requiredAnimations,
    requiredGroups,
    diagnosticLimit,
  };
}

function cloneBoundedJson(value: unknown): unknown {
  const seen = new Set<object>();
  const state = { nodes: 0, characters: 0, bytes: 0 };

  const addText = (text: string, propertyName = false): void => {
    if (
      (propertyName && blockbenchProjectInspectionLimits.maxPropertyNameCharacters < text.length) ||
      (!propertyName && blockbenchProjectInspectionLimits.maxScalarCharacters < text.length)
    ) {
      throw new BoundedInputError();
    }
    state.characters += text.length;
    state.bytes += Buffer.byteLength(text, "utf8");
    if (
      blockbenchProjectInspectionLimits.maxProjectCharacters < state.characters ||
      blockbenchProjectInspectionLimits.maxProjectBytes < state.bytes
    ) {
      throw new BoundedInputError();
    }
  };

  const clone = (candidate: unknown, depth: number): unknown => {
    state.nodes += 1;
    if (
      blockbenchProjectInspectionLimits.maxJsonNodes < state.nodes ||
      blockbenchProjectInspectionLimits.maxJsonDepth < depth
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
    if (seen.has(candidate)) {
      throw new BoundedInputError();
    }
    seen.add(candidate);

    if (Array.isArray(candidate)) {
      const entries = inspectDenseDataArray(
        candidate,
        blockbenchProjectInspectionLimits.maxCollectionEntries,
      );
      if (!entries) {
        throw new BoundedInputError();
      }
      return entries.map((entry) => clone(entry, depth + 1));
    }

    const inspected = inspectDataObject(
      candidate,
      blockbenchProjectInspectionLimits.maxCollectionEntries,
    );
    if (!inspected.ok) {
      throw new BoundedInputError();
    }
    const result = Object.create(null) as SafeRecord;
    for (const [key, descriptor] of Object.entries(inspected.descriptors)) {
      addText(key, true);
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
        if (stringCharacter === '"') {
          break;
        }
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
          if (frame.keys.has(key)) {
            duplicate = true;
          }
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
      if (frame?.kind === "object") {
        frame.expectingKey = true;
      }
    }
    if (blockbenchProjectInspectionLimits.maxJsonDepth + 1 < stack.length) {
      throw new BoundedInputError();
    }
  }
  return duplicate;
}

function parseProject(value: unknown, collector: DiagnosticCollector): ParsedProject {
  const inputKind = typeof value === "string" ? "text" : "object";
  let parsed = value;
  let jsonParsed = false;
  let duplicateKeys: ParsedProject["duplicateKeys"] = "unknown";
  if (typeof value === "string") {
    if (value.startsWith("<lz>")) {
      collector.add(
        "unknown",
        "project.compressed-unsupported",
        "/project",
        "Blockbench <lz> compressed project data is not decoded by this bounded inspector.",
      );
      return { record: null, inputKind, jsonParsed, duplicateKeys: "not-checked", fatal: false };
    }
    if (
      blockbenchProjectInspectionLimits.maxProjectCharacters < value.length ||
      blockbenchProjectInspectionLimits.maxProjectBytes < Buffer.byteLength(value, "utf8")
    ) {
      collector.add(
        "error",
        "project.input-limit",
        "/project",
        "Blockbench project text exceeds the fixed character or UTF-8 byte limit.",
      );
      return { record: null, inputKind, jsonParsed, duplicateKeys: "not-checked", fatal: true };
    }
    try {
      duplicateKeys = hasDuplicateJsonObjectKey(value) ? "observed" : "checked-unique";
    } catch {
      collector.add(
        "error",
        "project.depth-limit",
        "/project",
        "Blockbench project JSON exceeds the fixed nesting-depth limit.",
      );
      return { record: null, inputKind, jsonParsed, duplicateKeys: "unknown", fatal: true };
    }
    if (duplicateKeys === "observed") {
      collector.add(
        "warning",
        "project.duplicate-key",
        "/project",
        "Raw project JSON contains duplicate object keys; the effective last values are inspected.",
      );
    }
    try {
      parsed = JSON.parse(value) as unknown;
      jsonParsed = true;
    } catch {
      collector.add(
        "error",
        "project.invalid-json",
        "/project",
        "Blockbench project text is not valid JSON.",
      );
      return { record: null, inputKind, jsonParsed, duplicateKeys, fatal: true };
    }
  } else {
    collector.add(
      "unknown",
      "project.source-key-uniqueness-unknown",
      "/project",
      "Parsed object input cannot prove whether an earlier raw JSON source contained duplicate keys.",
    );
  }

  let cloned: unknown;
  try {
    cloned = cloneBoundedJson(parsed);
  } catch {
    collector.add(
      "error",
      "project.unsafe-or-unbounded-data",
      "/project",
      "Project data must be bounded plain JSON data without proxies, accessors, symbols, hidden properties, sparse arrays, cycles, shared references, or unsupported values.",
    );
    return { record: null, inputKind, jsonParsed, duplicateKeys, fatal: true };
  }
  if (typeof cloned !== "object" || cloned === null || Array.isArray(cloned)) {
    collector.add(
      "error",
      "project.invalid-root",
      "/project",
      "Blockbench project data must contain an object at the document root.",
    );
    return { record: null, inputKind, jsonParsed, duplicateKeys, fatal: true };
  }
  return {
    record: cloned as SafeRecord,
    inputKind,
    jsonParsed,
    duplicateKeys,
    fatal: false,
  };
}

function parseVersion(value: string): ParsedVersion | null {
  if (value.length > 128) {
    return null;
  }
  const matched = /^(\d+(?:\.\d+)*)(?:-beta\.(\d+(?:\.\d+)*))?$/u.exec(value);
  if (!matched?.[1]) {
    return null;
  }
  const parseParts = (text: string): number[] | null => {
    const pieces = text.split(".");
    if (pieces.length > 16 || pieces.some((piece) => piece.length > 9)) {
      return null;
    }
    const values = pieces.map(Number);
    return values.every((part) => Number.isSafeInteger(part)) ? values : null;
  };
  const version = parseParts(matched[1]);
  const beta = matched[2] ? parseParts(matched[2]) : null;
  return version && (!matched[2] || beta) ? { version, beta } : null;
}

function compareNumberParts(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;
    if (leftPart < rightPart) {
      return -1;
    }
    if (rightPart < leftPart) {
      return 1;
    }
  }
  return 0;
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  const main = compareNumberParts(left.version, right.version);
  if (main !== 0) {
    return main;
  }
  if (left.beta && !right.beta) {
    return -1;
  }
  if (!left.beta && right.beta) {
    return 1;
  }
  return left.beta && right.beta ? compareNumberParts(left.beta, right.beta) : 0;
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return right < left ? 1 : 0;
}

function emptyCollection(
  sourceField: BlockbenchProjectNameCollection["sourceField"],
  complete = false,
): CollectionState {
  return {
    sourceField,
    declaredEntries: 0,
    inspectedEntries: 0,
    observedNameCount: 0,
    complete,
    names: new Set(),
    duplicateNameCount: 0,
  };
}

function retainName(
  state: CollectionState,
  value: unknown,
  path: string,
  collector: DiagnosticCollector,
): void {
  if (
    typeof value !== "string" ||
    blockbenchProjectInspectionLimits.maxNameCharacters < value.length ||
    hasControlCharacter(value)
  ) {
    state.complete = false;
    collector.add(
      "unknown",
      "collection.unsupported-name",
      path,
      "A project name is not a bounded control-free string, so absence cannot be established.",
    );
    return;
  }
  state.observedNameCount += 1;
  if (state.names.has(value)) {
    state.duplicateNameCount += 1;
    return;
  }
  if (blockbenchProjectInspectionLimits.maxRetainedNames <= state.names.size) {
    state.complete = false;
    collector.add(
      "unknown",
      "collection.retained-name-limit",
      path,
      "The fixed retained-name limit was reached, so absence cannot be established.",
    );
    return;
  }
  state.names.add(value);
}

function inspectNamedArray(
  value: unknown,
  sourceField: "animations" | "groups",
  collector: DiagnosticCollector,
): CollectionState {
  const state = emptyCollection(sourceField, true);
  if (value === undefined) {
    return state;
  }
  if (!Array.isArray(value)) {
    state.complete = false;
    collector.add(
      "unknown",
      "collection.unsupported-shape",
      `/${sourceField}`,
      `${sourceField} is not an array in the inspected data, so absence cannot be established.`,
    );
    return state;
  }
  state.declaredEntries = value.length;
  const limit = Math.min(value.length, blockbenchProjectInspectionLimits.maxNamedEntriesInspected);
  if (blockbenchProjectInspectionLimits.maxNamedEntriesInspected < value.length) {
    state.complete = false;
    collector.add(
      "unknown",
      "collection.entry-limit",
      `/${sourceField}`,
      `The ${sourceField} array exceeds the fixed inspected-entry limit.`,
    );
  }
  for (let index = 0; index < limit; index += 1) {
    state.inspectedEntries += 1;
    const entry = value[index];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      state.complete = false;
      collector.add(
        "unknown",
        "collection.unsupported-entry",
        `/${sourceField}/${index}`,
        `A ${sourceField} entry is not an object with a name field.`,
      );
      continue;
    }
    retainName(state, (entry as SafeRecord).name, `/${sourceField}/${index}/name`, collector);
  }
  return state;
}

function inspectLegacyOutliner(value: unknown, collector: DiagnosticCollector): CollectionState {
  const state = emptyCollection("outliner", true);
  if (value === undefined) {
    return state;
  }
  if (!Array.isArray(value)) {
    state.complete = false;
    collector.add(
      "unknown",
      "collection.unsupported-shape",
      "/outliner",
      "Legacy outliner data is not an array, so group-name absence cannot be established.",
    );
    return state;
  }
  state.declaredEntries = value.length;
  const stack: Array<{ entries: unknown[]; path: string; index: number }> = [
    { entries: value, path: "/outliner", index: 0 },
  ];
  while (stack.length > 0) {
    const frame = stack.at(-1) as { entries: unknown[]; path: string; index: number };
    if (frame.index >= frame.entries.length) {
      stack.pop();
      continue;
    }
    if (blockbenchProjectInspectionLimits.maxOutlinerEntriesInspected <= state.inspectedEntries) {
      state.complete = false;
      collector.add(
        "unknown",
        "collection.outliner-entry-limit",
        "/outliner",
        "The legacy outliner exceeds the fixed inspected-entry limit.",
      );
      break;
    }
    const index = frame.index;
    frame.index += 1;
    state.inspectedEntries += 1;
    const entry = frame.entries[index];
    if (typeof entry === "string") {
      continue;
    }
    const path = `${frame.path}/${index}`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      state.complete = false;
      collector.add(
        "unknown",
        "collection.unsupported-entry",
        path,
        "A legacy outliner entry is neither an element UUID string nor a group object.",
      );
      continue;
    }
    const record = entry as SafeRecord;
    retainName(state, record.name, `${path}/name`, collector);
    const children = record.children;
    const content = record.content;
    if (children !== undefined && content !== undefined) {
      state.complete = false;
      collector.add(
        "unknown",
        "collection.ambiguous-legacy-children",
        path,
        "A legacy group has both children and content arrays, so absence cannot be established.",
      );
    }
    const nested = children ?? content;
    if (!Array.isArray(nested)) {
      state.complete = false;
      collector.add(
        "unknown",
        "collection.unsupported-legacy-children",
        path,
        "A legacy group does not have a supported children or content array.",
      );
      continue;
    }
    stack.push({
      entries: nested,
      path: `${path}/${children !== undefined ? "children" : "content"}`,
      index: 0,
    });
  }
  return state;
}

function finalizeCollection(state: CollectionState): BlockbenchProjectNameCollection {
  const names = [...state.names].sort(compareText);
  return {
    sourceField: state.sourceField,
    declaredEntries: state.declaredEntries,
    inspectedEntries: state.inspectedEntries,
    observedNameCount: state.observedNameCount,
    uniqueNameCount: names.length,
    duplicateNameCount: state.duplicateNameCount,
    complete: state.complete,
    names,
  };
}

function requestedEvidence(
  required: readonly string[],
  collection: CollectionState,
  missingCanBeProven: boolean,
): BlockbenchRequestedNameEvidence[] {
  return required.map((name) => ({
    name,
    status: collection.names.has(name) ? "present" : missingCanBeProven ? "missing" : "unknown",
  }));
}

function baseResult(options: {
  collector: DiagnosticCollector;
  diagnosticLimit: number;
  parsed: ParsedProject | null;
  requiredAnimations: readonly string[];
  requiredGroups: readonly string[];
  metadata?: BlockbenchProjectInspectionResult["metadata"];
  animationState?: CollectionState;
  groupState?: CollectionState;
  inspectionComplete?: boolean;
  animationMissingCanBeProven?: boolean;
  groupMissingCanBeProven?: boolean;
}): BlockbenchProjectInspectionResult {
  const animationState = options.animationState ?? emptyCollection("animations");
  const groupState = options.groupState ?? emptyCollection("groups");
  const metadata = options.metadata ?? {
    format_version: null,
    formatVersionField: null,
    formatVersionRelation: "unknown",
    model_format: null,
    effectiveModelFormat: null,
    modelFormatSupport: "unknown",
  };
  const finished = options.collector.finish();
  const inspectionComplete = options.inspectionComplete === true && !finished.diagnosticsTruncated;
  const fatal = options.parsed?.fatal ?? options.collector.errorCount > 0;
  return {
    schemaVersion: 1,
    outcome: fatal ? "invalid-input" : inspectionComplete ? "inspected" : "indeterminate",
    inspectionComplete,
    source: {
      inputKind: options.parsed?.inputKind ?? null,
      jsonParsed: options.parsed?.jsonParsed ?? false,
      duplicateKeys: options.parsed?.duplicateKeys ?? "not-checked",
    },
    metadata,
    collections: {
      animations: finalizeCollection(animationState),
      groups: finalizeCollection(groupState),
    },
    requested: {
      animations: requestedEvidence(
        options.requiredAnimations,
        animationState,
        options.animationMissingCanBeProven === true && animationState.complete,
      ),
      groups: requestedEvidence(
        options.requiredGroups,
        groupState,
        options.groupMissingCanBeProven === true && groupState.complete,
      ),
    },
    sourceEvidence: {
      kind: "official-source-snapshot",
      blockbenchVersion: "5.1.6",
      auditedCommit,
      auditedDate: "2026-08-25",
      currentFormatVersion,
      wikiUrl: "https://www.blockbench.net/wiki/docs/bbmodel/",
      formatSourceUrl: `${sourceRoot}/js/formats/bbmodel.js`,
      animationSourceUrl: `${sourceRoot}/js/animations/animation.js`,
      groupSourceUrl: `${sourceRoot}/js/outliner/types/group.js`,
      versionSourceUrl: `${sourceRoot}/js/util/version_util.ts`,
    },
    coverage: {
      checked: [...checkedCoverage],
      notChecked: [...notCheckedCoverage],
    },
    nonGuarantees: [...nonGuarantees],
    limits: {
      ...blockbenchProjectInspectionLimits,
      appliedDiagnosticLimit: options.diagnosticLimit,
    },
    errorCount: options.collector.errorCount,
    warningCount: options.collector.warningCount,
    unknownCount: options.collector.unknownCount,
    diagnosticTotal: finished.diagnosticTotal,
    diagnosticsTruncated: finished.diagnosticsTruncated,
    omittedDiagnosticCount: finished.omittedDiagnosticCount,
    diagnostics: finished.diagnostics,
  };
}

/**
 * Inspects bounded `.bbmodel` metadata and exact animation/group names.
 *
 * This intentionally does not validate the complete internal Blockbench project format.
 */
export function inspectBlockbenchProject(
  options: BlockbenchProjectInspectionOptions,
): BlockbenchProjectInspectionResult {
  const collector = new DiagnosticCollector();
  const parsedOptions = inspectOptions(options, collector);
  if (!parsedOptions) {
    return baseResult({
      collector,
      diagnosticLimit: collector.appliedLimit,
      parsed: null,
      requiredAnimations: [],
      requiredGroups: [],
    });
  }
  const parsed = parseProject(parsedOptions.project, collector);
  if (!parsed.record) {
    return baseResult({
      collector,
      diagnosticLimit: parsedOptions.diagnosticLimit,
      parsed,
      requiredAnimations: parsedOptions.requiredAnimations,
      requiredGroups: parsedOptions.requiredGroups,
    });
  }

  const metaValue = parsed.record.meta;
  if (typeof metaValue !== "object" || metaValue === null || Array.isArray(metaValue)) {
    collector.add(
      "error",
      "metadata.missing-or-invalid",
      "/meta",
      "The audited Blockbench project loader requires a meta object.",
    );
    parsed.fatal = true;
    return baseResult({
      collector,
      diagnosticLimit: parsedOptions.diagnosticLimit,
      parsed,
      requiredAnimations: parsedOptions.requiredAnimations,
      requiredGroups: parsedOptions.requiredGroups,
    });
  }
  const meta = metaValue as SafeRecord;
  const formatVersionCandidateField = meta.format_version
    ? "format_version"
    : meta.format !== undefined
      ? "format"
      : meta.format_version !== undefined
        ? "format_version"
        : null;
  const formatVersionCandidate =
    formatVersionCandidateField === "format_version"
      ? meta.format_version
      : formatVersionCandidateField === "format"
        ? meta.format
        : null;
  const rawFormatVersion =
    typeof formatVersionCandidate === "string" ? formatVersionCandidate : null;
  const formatVersion =
    rawFormatVersion !== null &&
    rawFormatVersion.length <= 128 &&
    !hasControlCharacter(rawFormatVersion)
      ? rawFormatVersion
      : null;
  const formatVersionField = formatVersion === null ? null : formatVersionCandidateField;
  const formatVersionPath =
    formatVersionCandidateField === "format" ? "/meta/format" : "/meta/format_version";
  let formatVersionRelation: BlockbenchProjectInspectionResult["metadata"]["formatVersionRelation"] =
    "unknown";
  if (formatVersion !== null) {
    const parsedVersion = parseVersion(formatVersion);
    const current = parseVersion(currentFormatVersion) as ParsedVersion;
    if (parsedVersion) {
      const compared = compareVersions(parsedVersion, current);
      formatVersionRelation = compared < 0 ? "legacy" : compared > 0 ? "newer" : "current";
    } else {
      collector.add(
        "unknown",
        "metadata.unsupported-format-version",
        formatVersionPath,
        "The format version does not use the audited Blockbench numeric version syntax.",
      );
    }
  } else {
    collector.add(
      "unknown",
      formatVersionCandidate === null || formatVersionCandidate === undefined
        ? "metadata.format-version-unavailable"
        : "metadata.unsupported-format-version",
      formatVersionPath,
      formatVersionCandidate === null || formatVersionCandidate === undefined
        ? "No string format_version or legacy format field is available for layout selection."
        : "The format version is outside the bounded control-free metadata profile.",
    );
  }
  if (formatVersionRelation === "newer") {
    collector.add(
      "unknown",
      "metadata.newer-format",
      formatVersionPath,
      "The project format is newer than the audited 5.0 layout, so absence cannot be established.",
    );
  }

  const rawModelFormatValue = meta.model_format;
  const observedModelFormat =
    typeof rawModelFormatValue === "string" &&
    rawModelFormatValue.length <= 128 &&
    !hasControlCharacter(rawModelFormatValue)
      ? rawModelFormatValue
      : null;
  const effectiveModelFormat = rawModelFormatValue
    ? observedModelFormat
    : meta.bone_rig
      ? "bedrock_old"
      : "java_block";
  let modelFormatSupport: BlockbenchProjectInspectionResult["metadata"]["modelFormatSupport"] =
    "unknown";
  if (effectiveModelFormat !== null) {
    modelFormatSupport = auditedCoreModelFormats.has(effectiveModelFormat)
      ? "audited-core"
      : "unknown-or-plugin";
  }
  if (modelFormatSupport !== "audited-core") {
    const observedUnknownFormat = observedModelFormat !== null;
    collector.add(
      "unknown",
      observedUnknownFormat
        ? "metadata.unknown-or-plugin-model-format"
        : "metadata.unsupported-model-format",
      "/meta/model_format",
      observedUnknownFormat
        ? "The model format is not an audited Blockbench core format, so plugin or custom semantics may apply."
        : "The model format is outside the bounded control-free metadata profile.",
    );
  }

  const animationState = inspectNamedArray(parsed.record.animations, "animations", collector);
  const groupState =
    formatVersionRelation === "legacy"
      ? inspectLegacyOutliner(parsed.record.outliner, collector)
      : inspectNamedArray(parsed.record.groups, "groups", collector);
  const layoutSupported = formatVersionRelation === "current" || formatVersionRelation === "legacy";
  if (!layoutSupported) {
    animationState.complete = false;
    groupState.complete = false;
  }
  if (modelFormatSupport !== "audited-core") {
    animationState.complete = false;
    groupState.complete = false;
  }

  const metadata: BlockbenchProjectInspectionResult["metadata"] = {
    format_version: formatVersion,
    formatVersionField,
    formatVersionRelation,
    model_format: observedModelFormat,
    effectiveModelFormat,
    modelFormatSupport,
  };
  const inspectionComplete =
    layoutSupported &&
    modelFormatSupport === "audited-core" &&
    animationState.complete &&
    groupState.complete;
  return baseResult({
    collector,
    diagnosticLimit: parsedOptions.diagnosticLimit,
    parsed,
    requiredAnimations: parsedOptions.requiredAnimations,
    requiredGroups: parsedOptions.requiredGroups,
    metadata,
    animationState,
    groupState,
    inspectionComplete,
    animationMissingCanBeProven:
      layoutSupported && modelFormatSupport === "audited-core" && animationState.complete,
    groupMissingCanBeProven:
      layoutSupported && modelFormatSupport === "audited-core" && groupState.complete,
  });
}
