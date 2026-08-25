const textEncoder = new TextEncoder();

/** Hard ceilings used by the server.properties validator. Callers may only lower them. */
export type ServerPropertiesValidationLimits = {
  maxInputBytes: number;
  maxPhysicalLines: number;
  maxLogicalLines: number;
  maxPhysicalLineCharacters: number;
  maxLogicalLineCharacters: number;
  maxContinuationLines: number;
  maxEntries: number;
  maxKeyCharacters: number;
  maxValueCharacters: number;
  maxDiagnostics: number;
  maxUnknownKeys: number;
};

export type ServerPropertiesValidationLimitName = keyof ServerPropertiesValidationLimits;

export const defaultServerPropertiesValidationLimits: Readonly<ServerPropertiesValidationLimits> =
  Object.freeze({
    maxInputBytes: 256 * 1024,
    maxPhysicalLines: 4_096,
    maxLogicalLines: 4_096,
    maxPhysicalLineCharacters: 8_192,
    maxLogicalLineCharacters: 32_768,
    maxContinuationLines: 32,
    maxEntries: 1_024,
    maxKeyCharacters: 256,
    maxValueCharacters: 16_384,
    maxDiagnostics: 200,
    maxUnknownKeys: 200,
  });

export type ServerPropertiesDiagnosticSeverity = "error" | "warning";

/** A value-free diagnostic. Property values are deliberately never retained in public results. */
export type ServerPropertiesDiagnostic = {
  code: string;
  severity: ServerPropertiesDiagnosticSeverity;
  message: string;
  line: number | null;
  key: string | null;
};

export type ServerPropertiesUnknownKey = {
  key: string;
  line: number;
};

export type ServerPropertiesValidationOptions = {
  content: string;
  /** An evidence label only; no version-specific defaults are inferred from it. */
  targetVersion?: string;
  /** Tests and embedding callers may lower, but never raise, the public hard ceilings. */
  limits?: Partial<ServerPropertiesValidationLimits>;
};

export type ServerPropertiesValidationResult = {
  schemaVersion: 1;
  targetVersion: string | null;
  valid: boolean;
  validationComplete: false;
  syntaxValidationComplete: boolean;
  stableSubsetValidationComplete: boolean;
  preflight: {
    accepted: boolean;
    /** Exact UTF-8 bytes when measured within the hard character ceiling. */
    inputBytes: number | null;
    /** Proven lower bound, equal to inputBytes when inputBytesComplete is true. */
    inputBytesLowerBound: number;
    inputBytesComplete: boolean;
    limits: ServerPropertiesValidationLimits;
    exceededLimits: ServerPropertiesValidationLimitName[];
  };
  coverage: {
    mode: "conservative-stable-subset";
    officialGeneratedDefaultsAvailable: false;
    exactVersionMembershipValidated: false;
    runtimeEncodingValidated: false;
    recognizedKeyCount: number;
    unknownKeyCount: number;
    unknownKeysComplete: boolean;
    unknownKeys: ServerPropertiesUnknownKey[];
  };
  counts: {
    physicalLines: number;
    logicalLines: number;
    entries: number;
    effectiveEntries: number;
    duplicateEntries: number;
    redactedValues: number;
    errors: number;
    warnings: number;
    suppressedDiagnostics: number;
  };
  diagnostics: ServerPropertiesDiagnostic[];
  notes: string[];
};

type ValueRule =
  | { kind: "boolean" }
  | {
      kind: "integer";
      representation: "int32" | "int64";
      minimum?: bigint;
      maximum?: bigint;
    }
  | { kind: "port" }
  | { kind: "sha1" }
  | { kind: "uuid" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "text" };

type ParsedProperty = {
  key: string;
  line: number;
  recognized: boolean;
  sensitive: boolean;
  empty: boolean;
  parsedBoolean: boolean | null;
  parsedInteger: number | null;
  validationIssue: string | null;
};

type LogicalLine = {
  text: string;
  line: number;
};

type MutableCounts = ServerPropertiesValidationResult["counts"];

const stableValueRules: Readonly<Record<string, ValueRule>> = Object.freeze({
  "accepts-transfers": { kind: "boolean" },
  "allow-flight": { kind: "boolean" },
  "allow-nether": { kind: "boolean" },
  "broadcast-console-to-ops": { kind: "boolean" },
  "broadcast-rcon-to-ops": { kind: "boolean" },
  "bug-report-link": { kind: "text" },
  debug: { kind: "boolean" },
  difficulty: {
    kind: "enum",
    values: ["peaceful", "easy", "normal", "hard", "0", "1", "2", "3"],
  },
  "enable-command-block": { kind: "boolean" },
  "enable-jmx-monitoring": { kind: "boolean" },
  "enable-query": { kind: "boolean" },
  "enable-rcon": { kind: "boolean" },
  "enable-status": { kind: "boolean" },
  "enforce-secure-profile": { kind: "boolean" },
  "enforce-whitelist": { kind: "boolean" },
  "entity-broadcast-range-percentage": {
    kind: "integer",
    representation: "int32",
    minimum: 10n,
    maximum: 1_000n,
  },
  "force-gamemode": { kind: "boolean" },
  "function-permission-level": {
    kind: "integer",
    representation: "int32",
    minimum: 1n,
    maximum: 4n,
  },
  gamemode: {
    kind: "enum",
    values: ["survival", "creative", "adventure", "spectator", "0", "1", "2", "3"],
  },
  "generate-structures": { kind: "boolean" },
  "generator-settings": { kind: "text" },
  hardcore: { kind: "boolean" },
  "hide-online-players": { kind: "boolean" },
  "initial-disabled-packs": { kind: "text" },
  "initial-enabled-packs": { kind: "text" },
  "level-name": { kind: "text" },
  "level-seed": { kind: "text" },
  "level-type": { kind: "text" },
  "log-ips": { kind: "boolean" },
  "max-chained-neighbor-updates": { kind: "integer", representation: "int32" },
  "max-players": { kind: "integer", representation: "int32", minimum: 0n },
  "max-tick-time": { kind: "integer", representation: "int64" },
  "max-world-size": {
    kind: "integer",
    representation: "int32",
    minimum: 1n,
    maximum: 29_999_984n,
  },
  motd: { kind: "text" },
  "network-compression-threshold": { kind: "integer", representation: "int32" },
  "online-mode": { kind: "boolean" },
  "op-permission-level": {
    kind: "integer",
    representation: "int32",
    minimum: 0n,
    maximum: 4n,
  },
  "pause-when-empty-seconds": {
    kind: "integer",
    representation: "int32",
    minimum: -1n,
  },
  "player-idle-timeout": { kind: "integer", representation: "int32", minimum: 0n },
  "prevent-proxy-connections": { kind: "boolean" },
  pvp: { kind: "boolean" },
  "query.port": { kind: "port" },
  "rate-limit": { kind: "integer", representation: "int32", minimum: 0n },
  "rcon.password": { kind: "text" },
  "rcon.port": { kind: "port" },
  "region-file-compression": { kind: "text" },
  "require-resource-pack": { kind: "boolean" },
  "resource-pack": { kind: "text" },
  "resource-pack-id": { kind: "uuid" },
  "resource-pack-prompt": { kind: "text" },
  "resource-pack-sha1": { kind: "sha1" },
  "server-ip": { kind: "text" },
  "server-port": { kind: "port" },
  "simulation-distance": {
    kind: "integer",
    representation: "int32",
    minimum: 3n,
    maximum: 32n,
  },
  "spawn-animals": { kind: "boolean" },
  "spawn-monsters": { kind: "boolean" },
  "spawn-npcs": { kind: "boolean" },
  "spawn-protection": { kind: "integer", representation: "int32", minimum: 0n },
  "sync-chunk-writes": { kind: "boolean" },
  "text-filtering-config": { kind: "text" },
  "use-native-transport": { kind: "boolean" },
  "view-distance": {
    kind: "integer",
    representation: "int32",
    minimum: 3n,
    maximum: 32n,
  },
  "white-list": { kind: "boolean" },
});

const propertyWhitespace = new Set([" ", "\t", "\f"]);
const sensitiveKeyPattern =
  /(?:^|[._-])(?:password|passwd|secret|token|credential|authorization|auth|private[-_]?key|api[-_]?key|seed)(?:$|[._-])/i;
const sensitiveUrlParameterPattern =
  /(?:^|[?&#;])(?:access[-_]?token|api[-_]?key|auth|authorization|credential|key|password|secret|signature|sig|token)=/i;
const urlUserInfoPattern = /(?:[a-z][a-z0-9+.-]*:)?\/\/[^/\s:@]+:[^/\s@]+@/i;
const targetVersionPattern = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/;
const integerPattern = /^[+-]?\d+$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const sha1Pattern = /^[0-9a-f]{40}$/i;

function stableValueRule(key: string): ValueRule | undefined {
  return Object.hasOwn(stableValueRules, key) ? stableValueRules[key] : undefined;
}

function resolveLimits(
  overrides: Partial<ServerPropertiesValidationLimits> | undefined,
): ServerPropertiesValidationLimits {
  const resolved = { ...defaultServerPropertiesValidationLimits };
  if (!overrides) return resolved;
  for (const rawName of Object.keys(overrides)) {
    if (!Object.hasOwn(defaultServerPropertiesValidationLimits, rawName)) {
      throw new Error("server.properties validation limits contain an unknown field");
    }
    const name = rawName as ServerPropertiesValidationLimitName;
    const value = overrides[name];
    if (
      value === undefined ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      defaultServerPropertiesValidationLimits[name] < value
    ) {
      throw new Error(
        `server.properties validation limit ${name} must be a positive integer no greater than the default ceiling`,
      );
    }
    resolved[name] = value;
  }
  return resolved;
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (0xd800 <= code && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(0xdc00 <= next && next <= 0xdfff)) return true;
      index += 1;
    } else if (0xdc00 <= code && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function physicalLines(content: string): string[] {
  if (content.length === 0) return [];
  const lines = content.split(/\r\n|\r|\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function trimLeadingPropertyWhitespace(value: string): string {
  let index = 0;
  while (index < value.length && propertyWhitespace.has(value[index] ?? "")) index += 1;
  return value.slice(index);
}

function hasContinuation(value: string): boolean {
  let count = 0;
  for (let index = value.length - 1; 0 <= index && value[index] === "\\"; index -= 1) {
    count += 1;
  }
  return count % 2 === 1;
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function decodePropertySegment(raw: string): string | null {
  const output: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index] ?? "";
    if (character !== "\\") {
      output.push(character);
      continue;
    }
    index += 1;
    const escaped = raw[index];
    if (escaped === undefined) {
      return null;
    }
    if (escaped === "u") {
      const hexadecimal = raw.slice(index + 1, index + 5);
      if (hexadecimal.length !== 4 || !/^[0-9a-f]{4}$/i.test(hexadecimal)) return null;
      output.push(String.fromCharCode(Number.parseInt(hexadecimal, 16)));
      index += 4;
      continue;
    }
    const replacements: Readonly<Record<string, string>> = {
      t: "\t",
      n: "\n",
      r: "\r",
      f: "\f",
    };
    output.push(replacements[escaped] ?? escaped);
  }
  return output.join("");
}

function splitKeyAndValue(line: string): { rawKey: string; rawValue: string } {
  let keyEnd = line.length;
  let valueStart = line.length;
  let hasSeparator = false;
  let precedingBackslash = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? "";
    if ((character === "=" || character === ":") && !precedingBackslash) {
      keyEnd = index;
      valueStart = index + 1;
      hasSeparator = true;
      break;
    }
    if (propertyWhitespace.has(character) && !precedingBackslash) {
      keyEnd = index;
      valueStart = index + 1;
      break;
    }
    precedingBackslash = character === "\\" ? !precedingBackslash : false;
  }
  while (valueStart < line.length) {
    const character = line[valueStart] ?? "";
    if (propertyWhitespace.has(character)) {
      valueStart += 1;
      continue;
    }
    if (!hasSeparator && (character === "=" || character === ":")) {
      hasSeparator = true;
      valueStart += 1;
      continue;
    }
    break;
  }
  return { rawKey: line.slice(0, keyEnd), rawValue: line.slice(valueStart) };
}

function looksSensitive(key: string, value: string): boolean {
  if (
    key === "rcon.password" ||
    key === "level-seed" ||
    key === "generator-settings" ||
    sensitiveKeyPattern.test(key)
  ) {
    return true;
  }
  if (
    sensitiveUrlParameterPattern.test(value) ||
    urlUserInfoPattern.test(value) ||
    /\bBearer\s+\S+/i.test(value)
  ) {
    return true;
  }
  try {
    const url = new URL(value);
    return Boolean(url.username || url.password || url.search || url.hash);
  } catch {
    return false;
  }
}

function parseInteger(value: string): number | null {
  if (!integerPattern.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseBigInteger(value: string): bigint | null {
  if (!integerPattern.test(value)) return null;
  return BigInt(value);
}

function validateRule(rule: ValueRule, value: string): string | null {
  if (rule.kind === "text") return null;
  if (rule.kind === "boolean") {
    return /^(?:true|false)$/i.test(value) ? null : "must be true or false";
  }
  if (rule.kind === "port") {
    const parsed = parseInteger(value);
    return parsed !== null && 1 <= parsed && parsed <= 65_535
      ? null
      : "must be an integer from 1 through 65535";
  }
  if (rule.kind === "sha1") {
    return value === "" || sha1Pattern.test(value)
      ? null
      : "must be empty or exactly 40 hexadecimal characters";
  }
  if (rule.kind === "uuid") {
    return value === "" || uuidPattern.test(value) ? null : "must be empty or a canonical UUID";
  }
  if (rule.kind === "enum") {
    return rule.values.includes(value.toLowerCase())
      ? null
      : `must be one of the conservative values: ${rule.values.join(", ")}`;
  }
  const parsed = parseBigInteger(value);
  const representationMinimum =
    rule.representation === "int32" ? -2_147_483_648n : -9_223_372_036_854_775_808n;
  const representationMaximum =
    rule.representation === "int32" ? 2_147_483_647n : 9_223_372_036_854_775_807n;
  if (parsed === null || parsed < representationMinimum || representationMaximum < parsed) {
    return `must be a signed ${rule.representation === "int32" ? "32" : "64"}-bit decimal integer`;
  }
  if (rule.minimum !== undefined && parsed < rule.minimum) {
    return `must be at least ${rule.minimum.toString()}`;
  }
  if (rule.maximum !== undefined && rule.maximum < parsed) {
    return `must be at most ${rule.maximum.toString()}`;
  }
  return null;
}

function parseBoolean(value: string): boolean | null {
  if (!/^(?:true|false)$/i.test(value)) return null;
  return value.toLowerCase() === "true";
}

function emptyResult(options: {
  targetVersion: string | null;
  limits: ServerPropertiesValidationLimits;
  inputBytes: number | null;
  inputBytesLowerBound?: number;
  inputBytesComplete?: boolean;
  physicalLineCount: number;
  exceededLimits?: ServerPropertiesValidationLimitName[];
  diagnostic: ServerPropertiesDiagnostic;
}): ServerPropertiesValidationResult {
  return {
    schemaVersion: 1,
    targetVersion: options.targetVersion,
    valid: false,
    validationComplete: false,
    syntaxValidationComplete: false,
    stableSubsetValidationComplete: false,
    preflight: {
      accepted: false,
      inputBytes: options.inputBytes,
      inputBytesLowerBound: options.inputBytesLowerBound ?? options.inputBytes ?? 0,
      inputBytesComplete: options.inputBytesComplete ?? options.inputBytes !== null,
      limits: options.limits,
      exceededLimits: options.exceededLimits ?? [],
    },
    coverage: {
      mode: "conservative-stable-subset",
      officialGeneratedDefaultsAvailable: false,
      exactVersionMembershipValidated: false,
      runtimeEncodingValidated: false,
      recognizedKeyCount: 0,
      unknownKeyCount: 0,
      unknownKeysComplete: false,
      unknownKeys: [],
    },
    counts: {
      physicalLines: options.physicalLineCount,
      logicalLines: 0,
      entries: 0,
      effectiveEntries: 0,
      duplicateEntries: 0,
      redactedValues: 0,
      errors: 1,
      warnings: 0,
      suppressedDiagnostics: 0,
    },
    diagnostics: [options.diagnostic],
    notes: [...validationNotes],
  };
}

const validationNotes = [
  "Parsing follows java.util.Properties.load(Reader) line, separator, continuation, and escape semantics.",
  "Catalog input is text and CLI transport is strict UTF-8, but the target Minecraft server version's runtime reader and encoding are not proven by this input.",
  "Recognized keys are a conservative cross-version subset, not a target-version default set or proof that a key exists in the requested version.",
  "No property value is returned. RCON passwords, seeds, URL credentials/query strings, and token-like values are classified before diagnostics are produced.",
] as const;

/**
 * Conservatively validates one Java Edition server.properties payload without network or filesystem access.
 *
 * The result separates Java Properties syntax evidence from an intentionally incomplete Minecraft key
 * subset. Values are used transiently for validation and are never included in the returned object.
 */
export function validateServerProperties(
  options: ServerPropertiesValidationOptions,
): ServerPropertiesValidationResult {
  if (typeof options.content !== "string") {
    throw new Error("validateServerProperties requires string content");
  }
  if (options.targetVersion !== undefined && !targetVersionPattern.test(options.targetVersion)) {
    throw new Error("validateServerProperties targetVersion must be a bounded version identifier");
  }
  const targetVersion = options.targetVersion ?? null;
  const limits = resolveLimits(options.limits);
  if (defaultServerPropertiesValidationLimits.maxInputBytes < options.content.length) {
    return emptyResult({
      targetVersion,
      limits,
      inputBytes: null,
      inputBytesLowerBound: options.content.length,
      inputBytesComplete: false,
      physicalLineCount: 0,
      exceededLimits: ["maxInputBytes"],
      diagnostic: {
        code: "input.byte-limit-exceeded",
        severity: "error",
        message:
          "Input character length alone proves that it exceeds the UTF-8 byte validation limit; exact bytes were not measured.",
        line: null,
        key: null,
      },
    });
  }
  const inputBytes = textEncoder.encode(options.content).byteLength;
  if (limits.maxInputBytes < inputBytes) {
    return emptyResult({
      targetVersion,
      limits,
      inputBytes,
      physicalLineCount: 0,
      exceededLimits: ["maxInputBytes"],
      diagnostic: {
        code: "input.byte-limit-exceeded",
        severity: "error",
        message: `Input exceeds the ${limits.maxInputBytes}-byte validation limit.`,
        line: null,
        key: null,
      },
    });
  }
  if (hasUnpairedSurrogate(options.content)) {
    return emptyResult({
      targetVersion,
      limits,
      inputBytes,
      physicalLineCount: 0,
      diagnostic: {
        code: "input.unpaired-surrogate",
        severity: "error",
        message:
          "Input contains an unpaired UTF-16 surrogate and cannot be transported as exact UTF-8.",
        line: null,
        key: null,
      },
    });
  }

  const physical = physicalLines(options.content);
  if (limits.maxPhysicalLines < physical.length) {
    return emptyResult({
      targetVersion,
      limits,
      inputBytes,
      physicalLineCount: physical.length,
      exceededLimits: ["maxPhysicalLines"],
      diagnostic: {
        code: "input.physical-line-limit-exceeded",
        severity: "error",
        message: `Input exceeds the ${limits.maxPhysicalLines}-physical-line validation limit.`,
        line: null,
        key: null,
      },
    });
  }
  const overlongPhysicalLine = physical.findIndex(
    (line) => limits.maxPhysicalLineCharacters < line.length,
  );
  if (0 <= overlongPhysicalLine) {
    return emptyResult({
      targetVersion,
      limits,
      inputBytes,
      physicalLineCount: physical.length,
      exceededLimits: ["maxPhysicalLineCharacters"],
      diagnostic: {
        code: "input.physical-line-length-limit-exceeded",
        severity: "error",
        message: `A physical line exceeds the ${limits.maxPhysicalLineCharacters}-character validation limit.`,
        line: overlongPhysicalLine + 1,
        key: null,
      },
    });
  }

  const logical: LogicalLine[] = [];
  for (let physicalIndex = 0; physicalIndex < physical.length; physicalIndex += 1) {
    let current = trimLeadingPropertyWhitespace(physical[physicalIndex] ?? "");
    if (current === "" || current.startsWith("#") || current.startsWith("!")) continue;
    const startLine = physicalIndex + 1;
    const segments: string[] = [];
    let continuationLines = 0;
    while (hasContinuation(current)) {
      segments.push(current.slice(0, -1));
      if (physicalIndex + 1 >= physical.length) {
        current = "";
        break;
      }
      continuationLines += 1;
      if (limits.maxContinuationLines < continuationLines) {
        return emptyResult({
          targetVersion,
          limits,
          inputBytes,
          physicalLineCount: physical.length,
          exceededLimits: ["maxContinuationLines"],
          diagnostic: {
            code: "input.continuation-limit-exceeded",
            severity: "error",
            message: `A logical line exceeds the ${limits.maxContinuationLines}-continuation-line limit.`,
            line: startLine,
            key: null,
          },
        });
      }
      physicalIndex += 1;
      current = trimLeadingPropertyWhitespace(physical[physicalIndex] ?? "");
    }
    segments.push(current);
    const text = segments.join("");
    if (limits.maxLogicalLineCharacters < text.length) {
      return emptyResult({
        targetVersion,
        limits,
        inputBytes,
        physicalLineCount: physical.length,
        exceededLimits: ["maxLogicalLineCharacters"],
        diagnostic: {
          code: "input.logical-line-length-limit-exceeded",
          severity: "error",
          message: `A logical line exceeds the ${limits.maxLogicalLineCharacters}-character validation limit.`,
          line: startLine,
          key: null,
        },
      });
    }
    logical.push({ text, line: startLine });
    if (limits.maxLogicalLines < logical.length) {
      return emptyResult({
        targetVersion,
        limits,
        inputBytes,
        physicalLineCount: physical.length,
        exceededLimits: ["maxLogicalLines"],
        diagnostic: {
          code: "input.logical-line-limit-exceeded",
          severity: "error",
          message: `Input exceeds the ${limits.maxLogicalLines}-logical-line validation limit.`,
          line: startLine,
          key: null,
        },
      });
    }
  }
  if (limits.maxEntries < logical.length) {
    return emptyResult({
      targetVersion,
      limits,
      inputBytes,
      physicalLineCount: physical.length,
      exceededLimits: ["maxEntries"],
      diagnostic: {
        code: "input.entry-limit-exceeded",
        severity: "error",
        message: `Input exceeds the ${limits.maxEntries}-entry validation limit.`,
        line: null,
        key: null,
      },
    });
  }

  const diagnostics: ServerPropertiesDiagnostic[] = [];
  let suppressedDiagnostics = 0;
  let diagnosticErrors = 0;
  let diagnosticWarnings = 0;
  const addDiagnostic = (diagnostic: ServerPropertiesDiagnostic): void => {
    if (diagnostic.severity === "error") diagnosticErrors += 1;
    else diagnosticWarnings += 1;
    if (diagnostics.length < limits.maxDiagnostics) diagnostics.push(diagnostic);
    else suppressedDiagnostics += 1;
  };
  const entries: ParsedProperty[] = [];
  let syntaxErrors = 0;
  let stableSubsetErrors = 0;
  const exceededLimits = new Set<ServerPropertiesValidationLimitName>();
  for (const line of logical) {
    const { rawKey, rawValue } = splitKeyAndValue(line.text);
    const key = decodePropertySegment(rawKey);
    const value = decodePropertySegment(rawValue);
    if (key === null || value === null) {
      syntaxErrors += 1;
      addDiagnostic({
        code: "properties.escape-invalid",
        severity: "error",
        message: "A key or value contains a malformed Unicode or terminal escape sequence.",
        line: line.line,
        key: null,
      });
      continue;
    }
    if (key === "" || containsControlCharacter(key) || hasUnpairedSurrogate(key)) {
      stableSubsetErrors += 1;
      addDiagnostic({
        code:
          key === ""
            ? "properties.key-empty"
            : hasUnpairedSurrogate(key)
              ? "properties.key-unpaired-surrogate"
              : "properties.key-control-character",
        severity: "error",
        message:
          key === ""
            ? "A server property key must not be empty."
            : "A server property key must not contain control characters or unpaired surrogates.",
        line: line.line,
        key: null,
      });
      continue;
    }
    if (limits.maxKeyCharacters < key.length) {
      stableSubsetErrors += 1;
      exceededLimits.add("maxKeyCharacters");
      addDiagnostic({
        code: "properties.key-length-limit-exceeded",
        severity: "error",
        message: `A decoded key exceeds the ${limits.maxKeyCharacters}-character validation limit.`,
        line: line.line,
        key: null,
      });
      continue;
    }
    if (limits.maxValueCharacters < value.length) {
      stableSubsetErrors += 1;
      exceededLimits.add("maxValueCharacters");
      addDiagnostic({
        code: "properties.value-length-limit-exceeded",
        severity: "error",
        message: `A decoded value exceeds the ${limits.maxValueCharacters}-character validation limit.`,
        line: line.line,
        key,
      });
      continue;
    }
    const rule = stableValueRule(key);
    const recognized = rule !== undefined;
    const sensitive = looksSensitive(key, value);
    entries.push({
      key,
      line: line.line,
      recognized,
      sensitive,
      empty: value === "",
      parsedBoolean: sensitive ? null : parseBoolean(value),
      parsedInteger: sensitive ? null : parseInteger(value),
      validationIssue: rule ? validateRule(rule, value) : null,
    });
  }

  const effective = new Map<string, ParsedProperty>();
  let duplicateEntries = 0;
  for (const entry of entries) {
    const previous = effective.get(entry.key);
    if (previous) {
      duplicateEntries += 1;
      addDiagnostic({
        code: "property.duplicate-last-wins",
        severity: "warning",
        message: `Property ${entry.key} replaces the value from line ${previous.line}; Java Properties uses the last value.`,
        line: entry.line,
        key: entry.key,
      });
    }
    effective.set(entry.key, entry);
  }

  for (const entry of effective.values()) {
    const rule = stableValueRule(entry.key);
    if (!rule || !entry.validationIssue) continue;
    stableSubsetErrors += 1;
    addDiagnostic({
      code: `property.${rule.kind}-invalid`,
      severity: "error",
      message: `Property ${entry.key} ${entry.validationIssue}.`,
      line: entry.line,
      key: entry.key,
    });
  }

  const addCrossPropertyError = (code: string, message: string, property: ParsedProperty): void => {
    stableSubsetErrors += 1;
    addDiagnostic({ code, severity: "error", message, line: property.line, key: property.key });
  };
  const enableRcon = effective.get("enable-rcon");
  if (enableRcon?.parsedBoolean === true) {
    const password = effective.get("rcon.password");
    if (!password || password.empty) {
      addCrossPropertyError(
        "rcon.password-missing",
        "enable-rcon is true but the effective rcon.password is missing or empty.",
        enableRcon,
      );
    }
    const rconPortProperty = effective.get("rcon.port");
    const serverPortProperty = effective.get("server-port");
    if (!effective.has("rcon.port")) {
      addDiagnostic({
        code: "rcon.port-default-unverified",
        severity: "warning",
        message:
          "enable-rcon is true but rcon.port is absent; this validator does not infer a runtime default.",
        line: enableRcon.line,
        key: enableRcon.key,
      });
    }
    if (
      rconPortProperty?.validationIssue === null &&
      serverPortProperty?.validationIssue === null &&
      rconPortProperty.parsedInteger === serverPortProperty.parsedInteger
    ) {
      addCrossPropertyError(
        "rcon.port-conflicts-with-server-port",
        "The enabled RCON listener and game server are configured for the same TCP port.",
        rconPortProperty,
      );
    }
  }
  const enableQuery = effective.get("enable-query");
  if (enableQuery?.parsedBoolean === true && !effective.has("query.port")) {
    addDiagnostic({
      code: "query.port-default-unverified",
      severity: "warning",
      message:
        "enable-query is true but query.port is absent; this validator does not infer a runtime default.",
      line: enableQuery.line,
      key: enableQuery.key,
    });
  }

  const requireResourcePack = effective.get("require-resource-pack");
  const resourcePack = effective.get("resource-pack");
  const resourcePackSha1 = effective.get("resource-pack-sha1");
  if (requireResourcePack?.parsedBoolean === true && (!resourcePack || resourcePack.empty)) {
    addCrossPropertyError(
      "resource-pack.required-url-missing",
      "require-resource-pack is true but the effective resource-pack value is missing or empty.",
      requireResourcePack,
    );
  }
  if (resourcePackSha1 && !resourcePackSha1.empty && (!resourcePack || resourcePack.empty)) {
    addDiagnostic({
      code: "resource-pack.sha1-without-pack",
      severity: "warning",
      message:
        "resource-pack-sha1 is set but the effective resource-pack value is missing or empty.",
      line: resourcePackSha1.line,
      key: resourcePackSha1.key,
    });
  }
  const onlineMode = effective.get("online-mode");
  if (onlineMode?.parsedBoolean === false) {
    addDiagnostic({
      code: "online-mode.disabled",
      severity: "warning",
      message:
        "online-mode is false; this file alone does not prove that a trusted proxy or another authentication boundary is configured.",
      line: onlineMode.line,
      key: onlineMode.key,
    });
  }

  const unknownEntries = [...effective.values()].filter((entry) => !entry.recognized);
  const unknownKeys = unknownEntries
    .slice(0, limits.maxUnknownKeys)
    .map((entry) => ({ key: entry.key, line: entry.line }));
  const counts: MutableCounts = {
    physicalLines: physical.length,
    logicalLines: logical.length,
    entries: entries.length,
    effectiveEntries: effective.size,
    duplicateEntries,
    redactedValues: entries.filter((entry) => entry.sensitive).length,
    errors: diagnosticErrors,
    warnings: diagnosticWarnings,
    suppressedDiagnostics,
  };
  return {
    schemaVersion: 1,
    targetVersion,
    valid: syntaxErrors === 0 && stableSubsetErrors === 0,
    validationComplete: false,
    syntaxValidationComplete: syntaxErrors === 0,
    stableSubsetValidationComplete:
      syntaxErrors === 0 &&
      stableSubsetErrors === 0 &&
      exceededLimits.size === 0 &&
      suppressedDiagnostics === 0,
    preflight: {
      accepted: exceededLimits.size === 0,
      inputBytes,
      inputBytesLowerBound: inputBytes,
      inputBytesComplete: true,
      limits,
      exceededLimits: [...exceededLimits],
    },
    coverage: {
      mode: "conservative-stable-subset",
      officialGeneratedDefaultsAvailable: false,
      exactVersionMembershipValidated: false,
      runtimeEncodingValidated: false,
      recognizedKeyCount: [...effective.values()].filter((entry) => entry.recognized).length,
      unknownKeyCount: unknownEntries.length,
      unknownKeysComplete:
        syntaxErrors === 0 &&
        exceededLimits.size === 0 &&
        unknownEntries.length <= limits.maxUnknownKeys,
      unknownKeys,
    },
    counts,
    diagnostics,
    notes: [...validationNotes],
  };
}
