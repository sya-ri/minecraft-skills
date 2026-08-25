import { isIP } from "node:net";

export const serverAccessListKinds = ["whitelist", "ops", "banned-players", "banned-ips"] as const;

export type ServerAccessListKind = (typeof serverAccessListKinds)[number];

export type ServerAccessListDiagnosticSeverity = "error" | "warning";

export type ServerAccessListDiagnostic = {
  severity: ServerAccessListDiagnosticSeverity;
  code: string;
  path: string;
  message: string;
};

export type ServerAccessListValidationLimits = {
  maxInputBytes: number;
  maxInputCharacters: number;
  maxEntries: number;
  maxFieldsPerEntry: number;
  maxStringCharacters: number;
  maxDepth: number;
  maxNodes: number;
  maxDiagnostics: number;
};

export type ServerAccessListValidationLimitName = keyof ServerAccessListValidationLimits;

export const defaultServerAccessListValidationLimits: Readonly<ServerAccessListValidationLimits> =
  Object.freeze({
    maxInputBytes: 2 * 1_024 * 1_024,
    maxInputCharacters: 2 * 1_024 * 1_024,
    maxEntries: 10_000,
    maxFieldsPerEntry: 16,
    maxStringCharacters: 2_048,
    maxDepth: 16,
    maxNodes: 200_000,
    maxDiagnostics: 500,
  });

export type ServerAccessListValidationOptions = {
  kind: ServerAccessListKind;
  content: string;
  evaluatedAt?: string;
  limits?: Partial<ServerAccessListValidationLimits>;
};

export type ServerAccessListExpirationSummary = {
  permanent: number;
  active: number;
  expired: number;
  invalid: number;
};

export type ServerAccessListValidationResult = {
  schemaVersion: 1;
  kind: ServerAccessListKind;
  canonicalFilename: string;
  valid: boolean;
  parsed: boolean;
  validationComplete: boolean;
  evaluatedAt: string;
  inputBytes: number | null;
  inputCharacters: number;
  totalEntries: number | null;
  processedEntries: number;
  validEntries: number;
  duplicateIdentityCount: number;
  conflictingNameCount: number;
  duplicateJsonKeyCount: number;
  expirations: ServerAccessListExpirationSummary | null;
  appliedLimits: ServerAccessListValidationLimits;
  exceededLimits: ServerAccessListValidationLimitName[];
  errorCount: number;
  warningCount: number;
  diagnosticTotal: number;
  retainedDiagnosticCount: number;
  omittedDiagnosticCount: number;
  truncated: boolean;
  diagnostics: ServerAccessListDiagnostic[];
  notes: string[];
};

type JsonObject = Record<string, unknown>;

type DiagnosticCollector = {
  add: (diagnostic: ServerAccessListDiagnostic) => void;
  getErrorCount: () => number;
  finish: () => {
    diagnostics: ServerAccessListDiagnostic[];
    errorCount: number;
    warningCount: number;
    diagnosticTotal: number;
    omittedDiagnosticCount: number;
  };
};

const filenames: Record<ServerAccessListKind, string> = {
  whitelist: "whitelist.json",
  ops: "ops.json",
  "banned-players": "banned-players.json",
  "banned-ips": "banned-ips.json",
};
const validationLimitNames = Object.keys(
  defaultServerAccessListValidationLimits,
) as ServerAccessListValidationLimitName[];
const validationLimitNameSet = new Set<ServerAccessListValidationLimitName>(validationLimitNames);

const profileFields = ["uuid", "name"] as const;
const banFields = ["created", "source", "expires", "reason"] as const;
const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const caseInsensitiveUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const canonicalPlayerNamePattern = /^[A-Za-z0-9_]{1,16}$/;
const serializedDatePattern =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/;

function isServerAccessListKind(value: unknown): value is ServerAccessListKind {
  return typeof value === "string" && serverAccessListKinds.includes(value as ServerAccessListKind);
}

export function inferServerAccessListKind(filename: string): ServerAccessListKind | null {
  const normalized = filename.toLowerCase();
  return serverAccessListKinds.find((kind) => filenames[kind] === normalized) ?? null;
}

export function resolveServerAccessListValidationLimits(
  limits: Partial<ServerAccessListValidationLimits> | undefined,
): ServerAccessListValidationLimits {
  const resolved = { ...defaultServerAccessListValidationLimits };
  if (limits === undefined) {
    return resolved;
  }
  if (typeof limits !== "object" || limits === null || Array.isArray(limits)) {
    throw new Error("Server access-list limits must be a plain data object");
  }

  let keys: (string | symbol)[];
  let prototype: object | null;
  try {
    keys = Reflect.ownKeys(limits);
    prototype = Object.getPrototypeOf(limits) as object | null;
  } catch {
    throw new Error("Server access-list limits could not be inspected safely");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Server access-list limits must be a plain data object");
  }

  for (const key of keys) {
    if (
      typeof key !== "string" ||
      !validationLimitNameSet.has(key as ServerAccessListValidationLimitName)
    ) {
      throw new Error("Server access-list limits contain an unknown field");
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(limits, key);
    } catch {
      throw new Error("Server access-list limits could not be inspected safely");
    }
    if (!descriptor || !("value" in descriptor)) {
      throw new Error("Server access-list limits must not use accessors");
    }
    const name = key as ServerAccessListValidationLimitName;
    const requested = descriptor.value as unknown;
    if (
      typeof requested !== "number" ||
      !Number.isSafeInteger(requested) ||
      requested < 1 ||
      requested > defaultServerAccessListValidationLimits[name]
    ) {
      throw new Error(
        "Server access-list limit values must be safe positive integers within their published ceilings",
      );
    }
    resolved[name] = requested;
  }
  return resolved;
}

function resolveEvaluationInstant(value: string | undefined): { text: string; epoch: number } {
  const text = value ?? new Date().toISOString();
  if (
    typeof text !== "string" ||
    text.length !== 24 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text)
  ) {
    throw new Error("evaluatedAt must be a canonical UTC timestamp");
  }
  const epoch = Date.parse(text);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== text) {
    throw new Error("evaluatedAt must be a canonical UTC timestamp");
  }
  return { text, epoch };
}

function createDiagnosticCollector(limit: number): DiagnosticCollector {
  const diagnostics: ServerAccessListDiagnostic[] = [];
  let errorCount = 0;
  let warningCount = 0;
  let diagnosticTotal = 0;
  return {
    add(diagnostic) {
      diagnosticTotal += 1;
      if (diagnostic.severity === "error") {
        errorCount += 1;
      } else {
        warningCount += 1;
      }
      if (diagnostics.length < limit) {
        diagnostics.push(diagnostic);
      }
    },
    getErrorCount() {
      return errorCount;
    },
    finish() {
      return {
        diagnostics,
        errorCount,
        warningCount,
        diagnosticTotal,
        omittedDiagnosticCount: diagnosticTotal - diagnostics.length,
      };
    },
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function entryPath(index: number, field?: string): string {
  return field ? `$[${index}].${field}` : `$[${index}]`;
}

function hasOwn(value: JsonObject, field: string): boolean {
  return Object.hasOwn(value, field);
}

function rawNestingExceeds(content: string, maximum: number): boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const character of content) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === "{" || character === "[") {
      depth += 1;
      if (depth > maximum) {
        return true;
      }
    } else if (character === "}" || character === "]") {
      depth = Math.max(0, depth - 1);
    }
  }
  return false;
}

function isJsonWhitespace(character: string): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

function isPrimitiveBoundary(character: string): boolean {
  return isJsonWhitespace(character) || ",:]}".includes(character);
}

function rawNodeCountExceeds(content: string, maximum: number): boolean {
  let nodes = 0;
  const addNode = (): boolean => {
    nodes += 1;
    return nodes > maximum;
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (!character || isPrimitiveBoundary(character)) {
      continue;
    }
    if (character === '"') {
      if (addNode()) {
        return true;
      }
      index += 1;
      while (index < content.length) {
        if (content[index] === "\\") {
          index += 2;
          continue;
        }
        if (content[index] === '"') {
          break;
        }
        index += 1;
      }
      continue;
    }
    if (character === "{" || character === "[") {
      if (addNode()) {
        return true;
      }
      continue;
    }
    if (addNode()) {
      return true;
    }
    while (index + 1 < content.length && !isPrimitiveBoundary(content[index + 1] ?? "")) {
      index += 1;
    }
  }
  return false;
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }
  return false;
}

function inspectParsedJson(
  root: unknown,
  limits: ServerAccessListValidationLimits,
): {
  nodeLimitExceeded: boolean;
  stringLimitExceeded: boolean;
  invalidUnicode: boolean;
  controlCharacters: boolean;
} {
  const stack: unknown[] = [root];
  let nodes = 0;
  let stringLimitExceeded = false;
  let invalidUnicode = false;
  let controlCharacters = false;
  const inspectString = (value: string): void => {
    stringLimitExceeded ||= value.length > limits.maxStringCharacters;
    invalidUnicode ||= hasUnpairedSurrogate(value);
    controlCharacters ||= hasControlCharacter(value);
  };

  while (stack.length > 0) {
    const value = stack.pop();
    nodes += 1;
    if (nodes > limits.maxNodes) {
      return {
        nodeLimitExceeded: true,
        stringLimitExceeded,
        invalidUnicode,
        controlCharacters,
      };
    }
    if (typeof value === "string") {
      inspectString(value);
    } else if (Array.isArray(value)) {
      if (value.length > limits.maxNodes - nodes - stack.length) {
        return {
          nodeLimitExceeded: true,
          stringLimitExceeded,
          invalidUnicode,
          controlCharacters,
        };
      }
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push(value[index]);
      }
    } else if (isJsonObject(value)) {
      const keys = Object.keys(value);
      if (keys.length * 2 > limits.maxNodes - nodes - stack.length) {
        return {
          nodeLimitExceeded: true,
          stringLimitExceeded,
          invalidUnicode,
          controlCharacters,
        };
      }
      for (const key of keys) {
        nodes += 1;
        inspectString(key);
        stack.push(value[key]);
      }
    }
  }
  return {
    nodeLimitExceeded: false,
    stringLimitExceeded,
    invalidUnicode,
    controlCharacters,
  };
}

function countDuplicateJsonKeys(content: string): number {
  type Frame = { type: "array" } | { type: "object"; expectingKey: boolean; keys: Set<string> };
  const stack: Frame[] = [];
  let duplicates = 0;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      const start = index;
      index += 1;
      while (index < content.length) {
        if (content[index] === "\\") {
          index += 2;
          continue;
        }
        if (content[index] === '"') {
          break;
        }
        index += 1;
      }
      const frame = stack.at(-1);
      if (frame?.type === "object" && frame.expectingKey) {
        const key = JSON.parse(content.slice(start, index + 1)) as string;
        if (frame.keys.has(key)) {
          duplicates += 1;
        } else {
          frame.keys.add(key);
        }
        frame.expectingKey = false;
      }
      continue;
    }
    if (character === "{") {
      stack.push({ type: "object", expectingKey: true, keys: new Set() });
    } else if (character === "[") {
      stack.push({ type: "array" });
    } else if (character === "}" || character === "]") {
      stack.pop();
    } else if (character === ",") {
      const frame = stack.at(-1);
      if (frame?.type === "object") {
        frame.expectingKey = true;
      }
    }
  }
  return duplicates;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

function parseSerializedDate(value: string): number | null {
  const match = serializedDatePattern.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[8]);
  const offsetMinute = Number(match[9]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }
  const offsetSign = match[7] === "+" ? 1 : -1;
  const localDate = new Date(0);
  localDate.setUTCFullYear(year, month - 1, day);
  localDate.setUTCHours(hour, minute, second, 0);
  return localDate.getTime() - offsetSign * (offsetHour * 60 + offsetMinute) * 60_000;
}

function normalizeIpAddress(value: string): string | null {
  const version = isIP(value);
  if (version === 0) {
    return null;
  }
  if (version === 4) {
    return value;
  }
  try {
    const scopeIndex = value.lastIndexOf("%");
    const address = scopeIndex === -1 ? value : value.slice(0, scopeIndex);
    const scope = scopeIndex === -1 ? "" : value.slice(scopeIndex);
    const normalizedAddress = new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase();
    return `${normalizedAddress}${scope}`;
  } catch {
    return null;
  }
}

function expectedFields(kind: ServerAccessListKind): ReadonlySet<string> {
  if (kind === "whitelist") {
    return new Set(profileFields);
  }
  if (kind === "ops") {
    return new Set([...profileFields, "level", "bypassesPlayerLimit"]);
  }
  if (kind === "banned-players") {
    return new Set([...profileFields, ...banFields]);
  }
  return new Set(["ip", ...banFields]);
}

function requireString(
  entry: JsonObject,
  index: number,
  field: string,
  diagnostics: DiagnosticCollector,
): string | null {
  if (!hasOwn(entry, field) || typeof entry[field] !== "string") {
    diagnostics.add({
      severity: "error",
      code: "invalid-field",
      path: entryPath(index, field),
      message: "The vanilla access-list field must be present and contain a string.",
    });
    return null;
  }
  return entry[field];
}

function validateProfile(
  entry: JsonObject,
  index: number,
  diagnostics: DiagnosticCollector,
): { uuid: string | null; name: string | null } {
  const uuid = requireString(entry, index, "uuid", diagnostics);
  const name = requireString(entry, index, "name", diagnostics);
  let normalizedUuid: string | null = null;
  if (uuid !== null) {
    if (canonicalUuidPattern.test(uuid)) {
      normalizedUuid = uuid;
    } else if (caseInsensitiveUuidPattern.test(uuid)) {
      normalizedUuid = uuid.toLowerCase();
      diagnostics.add({
        severity: "warning",
        code: "noncanonical-uuid",
        path: entryPath(index, "uuid"),
        message: "The UUID is parseable but is not in the lowercase form written by vanilla.",
      });
    } else {
      diagnostics.add({
        severity: "error",
        code: "invalid-uuid",
        path: entryPath(index, "uuid"),
        message: "The UUID is not in canonical hyphenated form.",
      });
    }
  }
  if (name !== null && !canonicalPlayerNamePattern.test(name)) {
    diagnostics.add({
      severity: "warning",
      code: "noncanonical-player-name",
      path: entryPath(index, "name"),
      message: "The name is outside the common vanilla player-name syntax.",
    });
  }
  return { uuid: normalizedUuid, name };
}

function validateBanFields(
  entry: JsonObject,
  index: number,
  diagnostics: DiagnosticCollector,
  expirations: ServerAccessListExpirationSummary,
  now: number,
): void {
  const created = requireString(entry, index, "created", diagnostics);
  requireString(entry, index, "source", diagnostics);
  const expires = requireString(entry, index, "expires", diagnostics);
  if (!hasOwn(entry, "reason") || (typeof entry.reason !== "string" && entry.reason !== null)) {
    diagnostics.add({
      severity: "error",
      code: "invalid-field",
      path: entryPath(index, "reason"),
      message: "The vanilla ban reason must be present and contain a string or null.",
    });
  }

  const createdTime = created === null ? null : parseSerializedDate(created);
  if (created !== null && createdTime === null) {
    diagnostics.add({
      severity: "error",
      code: "invalid-created-date",
      path: entryPath(index, "created"),
      message: "The creation date does not match the vanilla serializer format.",
    });
  }
  if (expires === null) {
    expirations.invalid += 1;
    return;
  }
  if (expires === "forever") {
    expirations.permanent += 1;
    return;
  }
  const expirationTime = parseSerializedDate(expires);
  if (expirationTime === null) {
    expirations.invalid += 1;
    diagnostics.add({
      severity: "error",
      code: "invalid-expiration-date",
      path: entryPath(index, "expires"),
      message: "The expiration must be 'forever' or match the vanilla serializer date format.",
    });
    return;
  }
  if (expirationTime < now) {
    expirations.expired += 1;
    diagnostics.add({
      severity: "warning",
      code: "expired-ban-entry",
      path: entryPath(index, "expires"),
      message: "The dated ban entry was already expired at the returned evaluatedAt instant.",
    });
  } else {
    expirations.active += 1;
  }
  if (createdTime !== null && expirationTime < createdTime) {
    diagnostics.add({
      severity: "warning",
      code: "expiration-precedes-creation",
      path: entryPath(index, "expires"),
      message: "The expiration date precedes the creation date.",
    });
  }
}

export function validateServerAccessList(
  options: ServerAccessListValidationOptions,
): ServerAccessListValidationResult {
  if (!isServerAccessListKind(options.kind)) {
    throw new Error("validateServerAccessList requires a supported access-list kind");
  }
  if (typeof options.content !== "string") {
    throw new Error("validateServerAccessList requires string content");
  }

  const limits = resolveServerAccessListValidationLimits(options.limits);
  const evaluation = resolveEvaluationInstant(options.evaluatedAt);
  const diagnostics = createDiagnosticCollector(limits.maxDiagnostics);
  const exceededLimits: ServerAccessListValidationLimitName[] = [];
  const exceed = (name: ServerAccessListValidationLimitName): void => {
    if (!exceededLimits.includes(name)) {
      exceededLimits.push(name);
    }
  };
  const inputCharacters = options.content.length;
  let inputBytes: number | null = null;
  let parsed = false;
  let totalEntries: number | null = null;
  let processedEntries = 0;
  let validEntries = 0;
  let duplicateIdentityCount = 0;
  let conflictingNameCount = 0;
  let duplicateJsonKeyCount = 0;
  const expirations: ServerAccessListExpirationSummary | null =
    options.kind === "banned-players" || options.kind === "banned-ips"
      ? { permanent: 0, active: 0, expired: 0, invalid: 0 }
      : null;

  const finish = (): ServerAccessListValidationResult => {
    const collected = diagnostics.finish();
    const validationComplete = exceededLimits.length === 0;
    return {
      schemaVersion: 1,
      kind: options.kind,
      canonicalFilename: filenames[options.kind],
      valid: collected.errorCount === 0,
      parsed,
      validationComplete,
      evaluatedAt: evaluation.text,
      inputBytes,
      inputCharacters,
      totalEntries,
      processedEntries,
      validEntries,
      duplicateIdentityCount,
      conflictingNameCount,
      duplicateJsonKeyCount,
      expirations,
      appliedLimits: limits,
      exceededLimits,
      errorCount: collected.errorCount,
      warningCount: collected.warningCount,
      diagnosticTotal: collected.diagnosticTotal,
      retainedDiagnosticCount: collected.diagnostics.length,
      omittedDiagnosticCount: collected.omittedDiagnosticCount,
      truncated: !validationComplete || collected.omittedDiagnosticCount > 0,
      diagnostics: collected.diagnostics,
      notes: [
        "Validation is offline and does not verify UUID/name associations, account ownership, or IP ownership.",
        "Diagnostics and summaries never include player names, UUIDs, IP addresses, ban reasons, or ban sources from the input.",
        "Field names, operator levels, and date syntax were verified against the official Minecraft Java 26.2 server serializers; forks or future versions may differ.",
        "Canonical-output errors do not prove that the server loader will reject the file; current loaders default some missing or malformed ban data and operator fields, and clamp operator levels.",
        "A dated ban is classified against the returned evaluatedAt instant; 'forever' is counted separately as permanent.",
      ],
    };
  };

  if (inputCharacters > limits.maxInputCharacters) {
    exceed("maxInputCharacters");
    diagnostics.add({
      severity: "error",
      code: "input-character-limit-exceeded",
      path: "$",
      message: "The access-list JSON exceeds the applied character limit.",
    });
  }
  if (exceededLimits.length > 0) {
    return finish();
  }
  inputBytes = Buffer.byteLength(options.content, "utf8");
  if (inputBytes > limits.maxInputBytes) {
    exceed("maxInputBytes");
    diagnostics.add({
      severity: "error",
      code: "input-byte-limit-exceeded",
      path: "$",
      message: "The access-list JSON exceeds the applied byte limit.",
    });
    return finish();
  }

  let content = options.content;
  if (content.startsWith("\uFEFF")) {
    content = content.slice(1);
    diagnostics.add({
      severity: "warning",
      code: "utf8-bom",
      path: "$",
      message: "The UTF-8 byte-order mark is accepted but is not written by vanilla.",
    });
  }
  if (rawNestingExceeds(content, limits.maxDepth)) {
    exceed("maxDepth");
    diagnostics.add({
      severity: "error",
      code: "json-depth-limit-exceeded",
      path: "$",
      message: "The access-list JSON exceeds the applied nesting-depth limit.",
    });
    return finish();
  }
  if (rawNodeCountExceeds(content, limits.maxNodes)) {
    exceed("maxNodes");
    diagnostics.add({
      severity: "error",
      code: "json-node-limit-exceeded",
      path: "$",
      message: "The access-list JSON exceeds the applied node limit.",
    });
    return finish();
  }

  let value: unknown;
  try {
    value = JSON.parse(content) as unknown;
    parsed = true;
  } catch {
    diagnostics.add({
      severity: "error",
      code: "invalid-json",
      path: "$",
      message: "The access-list file is not valid JSON.",
    });
    return finish();
  }

  const inspected = inspectParsedJson(value, limits);
  if (inspected.nodeLimitExceeded) {
    exceed("maxNodes");
    diagnostics.add({
      severity: "error",
      code: "json-node-limit-exceeded",
      path: "$",
      message: "The access-list JSON exceeds the applied node limit.",
    });
  }
  if (inspected.stringLimitExceeded) {
    exceed("maxStringCharacters");
    diagnostics.add({
      severity: "error",
      code: "string-character-limit-exceeded",
      path: "$",
      message: "A JSON key or string value exceeds the applied character limit.",
    });
  }
  if (inspected.invalidUnicode) {
    diagnostics.add({
      severity: "error",
      code: "invalid-unicode",
      path: "$",
      message: "A JSON key or string value contains an unpaired Unicode surrogate.",
    });
  }
  if (inspected.controlCharacters) {
    diagnostics.add({
      severity: "warning",
      code: "control-character",
      path: "$",
      message: "A JSON key or string value contains a control character.",
    });
  }
  if (inspected.nodeLimitExceeded || inspected.stringLimitExceeded) {
    return finish();
  }

  duplicateJsonKeyCount = countDuplicateJsonKeys(content);
  if (duplicateJsonKeyCount > 0) {
    diagnostics.add({
      severity: "error",
      code: "duplicate-json-key",
      path: "$",
      message: "The JSON contains duplicate object keys and is ambiguous.",
    });
  }

  if (!Array.isArray(value)) {
    diagnostics.add({
      severity: "error",
      code: "invalid-root",
      path: "$",
      message: "A vanilla server access-list file must contain a JSON array at the document root.",
    });
    return finish();
  }

  totalEntries = value.length;
  if (value.length > limits.maxEntries) {
    exceed("maxEntries");
    diagnostics.add({
      severity: "error",
      code: "entry-limit-exceeded",
      path: "$",
      message: "The access-list array exceeds the applied entry limit.",
    });
  }

  const fields = expectedFields(options.kind);
  const uuids = new Set<string>();
  const names = new Map<string, string>();
  const ips = new Set<string>();
  const now = evaluation.epoch;
  const entryLimit = Math.min(value.length, limits.maxEntries);
  for (let index = 0; index < entryLimit; index += 1) {
    processedEntries += 1;
    const errorsBefore = diagnostics.getErrorCount();
    const entry = value[index];
    if (!isJsonObject(entry)) {
      diagnostics.add({
        severity: "error",
        code: "invalid-entry",
        path: entryPath(index),
        message: "Each vanilla access-list entry must be a JSON object.",
      });
      continue;
    }

    const entryFields = Object.keys(entry);
    if (entryFields.length > limits.maxFieldsPerEntry) {
      exceed("maxFieldsPerEntry");
      diagnostics.add({
        severity: "error",
        code: "field-limit-exceeded",
        path: entryPath(index),
        message: "The access-list entry exceeds the applied field-count limit.",
      });
      continue;
    }
    if (entryFields.some((field) => !fields.has(field))) {
      diagnostics.add({
        severity: "warning",
        code: "unknown-field",
        path: entryPath(index),
        message: "The entry contains a field not written by the vanilla serializer.",
      });
    }

    if (options.kind === "banned-ips") {
      const rawIp = requireString(entry, index, "ip", diagnostics);
      if (rawIp !== null) {
        const ip = normalizeIpAddress(rawIp);
        if (ip === null) {
          diagnostics.add({
            severity: "error",
            code: "invalid-ip-address",
            path: entryPath(index, "ip"),
            message: "The banned IP is not a valid IPv4 or IPv6 address.",
          });
        } else if (ips.has(ip)) {
          duplicateIdentityCount += 1;
          diagnostics.add({
            severity: "error",
            code: "duplicate-ip-address",
            path: entryPath(index, "ip"),
            message: "The IP identity duplicates an earlier entry.",
          });
        } else {
          ips.add(ip);
        }
      }
    } else {
      const profile = validateProfile(entry, index, diagnostics);
      if (profile.uuid !== null) {
        if (uuids.has(profile.uuid)) {
          duplicateIdentityCount += 1;
          diagnostics.add({
            severity: "error",
            code: "duplicate-uuid",
            path: entryPath(index, "uuid"),
            message: "The UUID identity duplicates an earlier entry.",
          });
        } else {
          uuids.add(profile.uuid);
          if (profile.name !== null) {
            const normalizedName = profile.name.toLowerCase();
            const previousUuid = names.get(normalizedName);
            if (previousUuid !== undefined && previousUuid !== profile.uuid) {
              conflictingNameCount += 1;
              diagnostics.add({
                severity: "warning",
                code: "conflicting-player-name",
                path: entryPath(index, "name"),
                message: "The player name is also associated with a different UUID entry.",
              });
            } else if (previousUuid === undefined) {
              names.set(normalizedName, profile.uuid);
            }
          }
        }
      }
    }

    if (options.kind === "ops") {
      if (
        !hasOwn(entry, "level") ||
        typeof entry.level !== "number" ||
        !Number.isInteger(entry.level) ||
        entry.level < 0 ||
        entry.level > 4
      ) {
        diagnostics.add({
          severity: "error",
          code: "invalid-operator-level",
          path: entryPath(index, "level"),
          message: "The operator level must be an integer from 0 through 4.",
        });
      }
      if (!hasOwn(entry, "bypassesPlayerLimit") || typeof entry.bypassesPlayerLimit !== "boolean") {
        diagnostics.add({
          severity: "error",
          code: "invalid-bypass-flag",
          path: entryPath(index, "bypassesPlayerLimit"),
          message: "The player-limit bypass field must contain a boolean.",
        });
      }
    }

    if (expirations !== null) {
      validateBanFields(entry, index, diagnostics, expirations, now);
    }
    if (duplicateJsonKeyCount === 0 && diagnostics.getErrorCount() === errorsBefore) {
      validEntries += 1;
    }
  }

  return finish();
}
