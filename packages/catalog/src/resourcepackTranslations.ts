import { types as utilTypes } from "node:util";

export type ResourcepackTranslationFile = {
  path: string;
  content: unknown;
};

export type ResourcepackTranslationDiagnostic = {
  severity: "error" | "warning";
  code: string;
  fileIndex: number | null;
  path: string | null;
  locale: string | null;
  key: string | null;
  message: string;
};

export type ResourcepackTranslationValidationLimits = {
  maxFiles: number;
  maxPathLength: number;
  maxLocaleLength: number;
  maxRequiredLocales: number;
  maxTextCharactersPerFile: number;
  maxTextBytesTotal: number;
  maxContentCharactersTotal: number;
  maxContentBytesTotal: number;
  maxJsonNodesPerFile: number;
  maxEntriesPerFile: number;
  maxEntriesTotal: number;
  maxKeyLength: number;
  maxValueCharacters: number;
  maxArgumentCountEntries: number;
  maxArgumentCount: number;
  maxComparisonOperations: number;
  maxDiagnosticTextLength: number;
};

export type ResourcepackTranslationValidationLimitName =
  keyof ResourcepackTranslationValidationLimits;

export const defaultResourcepackTranslationValidationLimits: Readonly<ResourcepackTranslationValidationLimits> =
  Object.freeze({
    maxFiles: 512,
    maxPathLength: 512,
    maxLocaleLength: 64,
    maxRequiredLocales: 64,
    maxTextCharactersPerFile: 2 * 1_024 * 1_024,
    maxTextBytesTotal: 8 * 1_024 * 1_024,
    maxContentCharactersTotal: 8 * 1_024 * 1_024,
    maxContentBytesTotal: 16 * 1_024 * 1_024,
    maxJsonNodesPerFile: 100_001,
    maxEntriesPerFile: 50_000,
    maxEntriesTotal: 200_000,
    maxKeyLength: 512,
    maxValueCharacters: 32_768,
    maxArgumentCountEntries: 50_000,
    maxArgumentCount: 1_024,
    maxComparisonOperations: 500_000,
    maxDiagnosticTextLength: 512,
  });

export type ResourcepackTranslationIncompleteReason =
  | "argument-count-evidence-unavailable"
  | "comparison-limit-exceeded"
  | "diagnostics-truncated"
  | "pack-order-unavailable"
  | "parsed-source-key-uniqueness-unavailable"
  | "reference-locale-unavailable"
  | "required-locale-unavailable"
  | "runtime-placeholder-version-unverified"
  | "translation-parity-mismatch"
  | "value-coercion-unverified";

export type ResourcepackTranslationLocaleSummary = {
  locale: string;
  fileCount: number;
  entryCount: number;
  uniqueKeyCount: number;
  ambiguousKeyCount: number;
};

export type ResourcepackTranslationComparison = {
  referenceLocale: string;
  locale: string;
  comparedKeyCount: number;
  missingKeyCount: number;
  extraKeyCount: number;
  placeholderMismatchCount: number;
  runtimeFallbackCount: number;
  comparisonComplete: boolean;
};

export type ResourcepackTranslationValidationOptions = {
  files: ResourcepackTranslationFile[];
  edition?: string;
  version?: string;
  referenceLocale?: string;
  requiredLocales?: string[];
  argumentCounts?: Record<string, number>;
  limit?: number;
  limits?: Partial<ResourcepackTranslationValidationLimits>;
};

export type ResourcepackTranslationValidationResult = {
  schemaVersion: 1;
  edition: "java";
  version: string;
  valid: boolean;
  validationComplete: boolean;
  source: {
    clientVersion: "26.2";
    clientSha1: "2dc72797acbc1b63fc16a11c4ac393605f453754";
    metadataUrl: "https://piston-meta.mojang.com/v1/packages/c75d82e7fa6eca5a043dab0c6cf77cb8317644f4/26.2.json";
    clientUrl: "https://piston-data.mojang.com/v1/objects/2dc72797acbc1b63fc16a11c4ac393605f453754/client.jar";
    verifiedRuntimeVersions: readonly ["26.2"];
    classes: readonly [
      "net.minecraft.locale.Language",
      "net.minecraft.client.resources.language.ClientLanguage",
      "net.minecraft.network.chat.contents.TranslatableContents",
    ];
  };
  referenceLocale: string;
  requiredLocales: string[];
  totalFiles: number;
  processedFiles: number;
  parsedTextFiles: number;
  parsedObjectFiles: number;
  textBytes: number;
  contentCharacters: number;
  contentBytes: number;
  totalEntries: number;
  comparisonOperations: number;
  locales: ResourcepackTranslationLocaleSummary[];
  comparisons: ResourcepackTranslationComparison[];
  incompleteReasons: ResourcepackTranslationIncompleteReason[];
  appliedLimits: ResourcepackTranslationValidationLimits & { maxDiagnostics: number };
  exceededLimits: ResourcepackTranslationValidationLimitName[];
  errorCount: number;
  warningCount: number;
  diagnosticTotal: number;
  retainedDiagnosticCount: number;
  omittedDiagnosticCount: number;
  truncated: boolean;
  diagnostics: ResourcepackTranslationDiagnostic[];
  notes: string[];
};

type ResolvedOptions = {
  files: ResourcepackTranslationFile[];
  version: string;
  referenceLocale: string;
  requiredLocales: string[] | undefined;
  argumentCounts: Record<string, number> | undefined;
  limit: number;
  limits: ResourcepackTranslationValidationLimits;
};

type TranslationDefinition = {
  placeholder: PlaceholderAnalysis | null;
};

type LocaleState = {
  fileIndexes: Set<number>;
  entryCount: number;
  definitions: Map<string, TranslationDefinition[]>;
};

type PlaceholderAnalysis = {
  references: number[];
  definiteFallback: boolean;
  argumentCountDependent: boolean;
};

type ParsedEntries = {
  entries: Array<[string, unknown]>;
  occurrenceCount: number;
  duplicateKeys: string[];
  sourceUniquenessProven: boolean;
  contentCharacters: number;
  contentBytes: number;
};

const translationPathPattern = /^assets\/([a-z0-9_.-]+)\/lang\/([a-z0-9_-]+)\.json$/;
const verifiedRuntimeVersions = new Set(["26.2"]);
const source = Object.freeze({
  clientVersion: "26.2" as const,
  clientSha1: "2dc72797acbc1b63fc16a11c4ac393605f453754" as const,
  metadataUrl:
    "https://piston-meta.mojang.com/v1/packages/c75d82e7fa6eca5a043dab0c6cf77cb8317644f4/26.2.json" as const,
  clientUrl:
    "https://piston-data.mojang.com/v1/objects/2dc72797acbc1b63fc16a11c4ac393605f453754/client.jar" as const,
  verifiedRuntimeVersions: Object.freeze(["26.2"] as const),
  classes: Object.freeze([
    "net.minecraft.locale.Language",
    "net.minecraft.client.resources.language.ClientLanguage",
    "net.minecraft.network.chat.contents.TranslatableContents",
  ] as const),
});

function boundedText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  let hash = 0x811c_9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x0100_0193);
  }
  const marker = `…#${(hash >>> 0).toString(16).padStart(8, "0")}`;
  return marker.length >= maxLength
    ? marker.slice(marker.length - maxLength)
    : `${value.slice(0, maxLength - marker.length)}${marker}`;
}

const validationLimitNames = [
  "maxFiles",
  "maxPathLength",
  "maxLocaleLength",
  "maxRequiredLocales",
  "maxTextCharactersPerFile",
  "maxTextBytesTotal",
  "maxContentCharactersTotal",
  "maxContentBytesTotal",
  "maxJsonNodesPerFile",
  "maxEntriesPerFile",
  "maxEntriesTotal",
  "maxKeyLength",
  "maxValueCharacters",
  "maxArgumentCountEntries",
  "maxArgumentCount",
  "maxComparisonOperations",
  "maxDiagnosticTextLength",
] as const satisfies readonly ResourcepackTranslationValidationLimitName[];

function resolveLimits(requested: unknown): ResourcepackTranslationValidationLimits {
  const requestedProperties =
    requested === undefined
      ? undefined
      : plainDataProperties(requested, validationLimitNames.length);
  if (requestedProperties && !requestedProperties.ok) {
    throw new Error(
      "Resource-pack translation limits must be a bounded plain data object without accessors, symbols, or proxies.",
    );
  }
  if (
    requestedProperties?.ok &&
    Object.keys(requestedProperties.descriptors).some(
      (name) => !validationLimitNames.includes(name as ResourcepackTranslationValidationLimitName),
    )
  ) {
    throw new Error("Resource-pack translation limits contain an unknown field.");
  }
  const resolve = (name: ResourcepackTranslationValidationLimitName): number => {
    const fallback = defaultResourcepackTranslationValidationLimits[name];
    const value = requestedProperties?.ok
      ? requestedProperties.descriptors[name]?.value
      : undefined;
    if (value === undefined) {
      return fallback;
    }
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > fallback
    ) {
      throw new Error(
        `Resource-pack translation limit ${name} must be a positive safe integer no greater than ${fallback}.`,
      );
    }
    return value;
  };
  return {
    maxFiles: resolve("maxFiles"),
    maxPathLength: resolve("maxPathLength"),
    maxLocaleLength: resolve("maxLocaleLength"),
    maxRequiredLocales: resolve("maxRequiredLocales"),
    maxTextCharactersPerFile: resolve("maxTextCharactersPerFile"),
    maxTextBytesTotal: resolve("maxTextBytesTotal"),
    maxContentCharactersTotal: resolve("maxContentCharactersTotal"),
    maxContentBytesTotal: resolve("maxContentBytesTotal"),
    maxJsonNodesPerFile: resolve("maxJsonNodesPerFile"),
    maxEntriesPerFile: resolve("maxEntriesPerFile"),
    maxEntriesTotal: resolve("maxEntriesTotal"),
    maxKeyLength: resolve("maxKeyLength"),
    maxValueCharacters: resolve("maxValueCharacters"),
    maxArgumentCountEntries: resolve("maxArgumentCountEntries"),
    maxArgumentCount: resolve("maxArgumentCount"),
    maxComparisonOperations: resolve("maxComparisonOperations"),
    maxDiagnosticTextLength: resolve("maxDiagnosticTextLength"),
  };
}

function plainDataProperties(
  value: unknown,
  maxProperties: number,
): { ok: true; descriptors: Record<string, PropertyDescriptor> } | { ok: false; tooMany: boolean } {
  if (!value || typeof value !== "object" || utilTypes.isProxy(value) || Array.isArray(value)) {
    return { ok: false, tooMany: false };
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return { ok: false, tooMany: false };
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) {
      return { ok: false, tooMany: false };
    }
    if (keys.length > maxProperties) {
      return { ok: false, tooMany: true };
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of keys) {
      const descriptor = descriptors[key as string];
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        return { ok: false, tooMany: false };
      }
    }
    return { ok: true, descriptors };
  } catch {
    return { ok: false, tooMany: false };
  }
}

function denseDataArray(value: unknown, maxLength: number, label: string): unknown[] {
  if (!value || typeof value !== "object" || utilTypes.isProxy(value) || !Array.isArray(value)) {
    throw new Error(`${label} must be a dense data array.`);
  }
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new Error(`${label} must be a dense data array.`);
    }
    const length = value.length;
    if (!Number.isSafeInteger(length) || length < 0 || length > maxLength) {
      throw new Error(`${label} exceeds its configured item bound.`);
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== length + 1 ||
      keys.some(
        (key) => typeof key !== "string" || (key !== "length" && !/^(0|[1-9]\d*)$/.test(key)),
      )
    ) {
      throw new Error(`${label} must be a dense data array without extra properties.`);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        throw new Error(`${label} must contain only enumerable data entries.`);
      }
      result.push(descriptor.value);
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(label)) {
      throw error;
    }
    throw new Error(`${label} could not be inspected safely.`);
  }
}

type ParseContentFailure =
  | "content-byte-limit-exceeded"
  | "content-character-limit-exceeded"
  | "entry-limit-exceeded"
  | "invalid"
  | "node-limit-exceeded";

const rawJsonNumberTexts = new WeakMap<object, string>();

function rawJsonNumberText(value: unknown): string | undefined {
  return value !== null && typeof value === "object" ? rawJsonNumberTexts.get(value) : undefined;
}

function primitiveContentText(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  return rawJsonNumberText(value) ?? null;
}

function contentSize(
  entries: Array<[string, unknown]>,
  limits: ResourcepackTranslationValidationLimits,
): {
  characters: number;
  bytes: number;
} {
  let characters = 0;
  let bytes = 0;
  for (const [key, value] of entries) {
    characters += key.length;
    if (characters > limits.maxContentCharactersTotal) {
      return { characters, bytes };
    }
    bytes += Buffer.byteLength(key, "utf8");
    if (bytes > limits.maxContentBytesTotal) {
      return { characters, bytes };
    }
    const primitive = primitiveContentText(value);
    if (primitive !== null) {
      characters += primitive.length;
      if (characters > limits.maxContentCharactersTotal) {
        return { characters, bytes };
      }
      bytes += Buffer.byteLength(primitive, "utf8");
      if (bytes > limits.maxContentBytesTotal) {
        return { characters, bytes };
      }
    }
  }
  return { characters, bytes };
}

function parseRawTranslationObject(
  text: string,
  limits: ResourcepackTranslationValidationLimits,
): ParsedEntries | ParseContentFailure {
  let index = 0;
  let nodeCount = 1;
  let entryCount = 0;
  let contentCharacters = 0;
  let contentBytes = 0;
  const values = new Map<string, unknown>();
  const duplicates = new Set<string>();
  const numberPattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const skipWhitespace = (): void => {
    while (index < text.length && /[ \t\r\n]/.test(text[index] as string)) {
      index += 1;
    }
  };
  const parseString = (): string | null => {
    if (text[index] !== '"') {
      return null;
    }
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === "\\") {
        index += 2;
        continue;
      }
      index += 1;
      if (character === '"') {
        try {
          const parsed = JSON.parse(text.slice(start, index));
          return typeof parsed === "string" ? parsed : null;
        } catch {
          return null;
        }
      }
    }
    return null;
  };
  const parsePrimitive = (): { ok: true; value: unknown } | { ok: false } => {
    if (text[index] === '"') {
      const value = parseString();
      return value === null ? { ok: false } : { ok: true, value };
    }
    for (const [literal, value] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ] as const) {
      if (text.startsWith(literal, index)) {
        index += literal.length;
        return { ok: true, value };
      }
    }
    numberPattern.lastIndex = index;
    const match = numberPattern.exec(text);
    if (!match) {
      return { ok: false };
    }
    index = numberPattern.lastIndex;
    const rawNumber = Object.create(null) as object;
    rawJsonNumberTexts.set(rawNumber, match[0]);
    return { ok: true, value: rawNumber };
  };

  skipWhitespace();
  if (text[index] !== "{") {
    return "invalid";
  }
  index += 1;
  skipWhitespace();
  if (text[index] === "}") {
    index += 1;
    skipWhitespace();
    return index === text.length
      ? {
          entries: [],
          occurrenceCount: 0,
          duplicateKeys: [],
          sourceUniquenessProven: true,
          contentCharacters: 0,
          contentBytes: 0,
        }
      : "invalid";
  }
  while (index < text.length) {
    entryCount += 1;
    nodeCount += 2;
    if (entryCount > limits.maxEntriesPerFile) {
      return "entry-limit-exceeded";
    }
    if (nodeCount > limits.maxJsonNodesPerFile) {
      return "node-limit-exceeded";
    }
    const key = parseString();
    if (key === null) {
      return "invalid";
    }
    skipWhitespace();
    if (text[index] !== ":") {
      return "invalid";
    }
    index += 1;
    skipWhitespace();
    if (text[index] === "{" || text[index] === "[") {
      return "invalid";
    }
    const parsedValue = parsePrimitive();
    if (!parsedValue.ok) {
      return "invalid";
    }
    const primitiveText = primitiveContentText(parsedValue.value);
    if (primitiveText === null) {
      return "invalid";
    }
    contentCharacters += key.length;
    if (contentCharacters > limits.maxContentCharactersTotal) {
      return "content-character-limit-exceeded";
    }
    contentBytes += Buffer.byteLength(key, "utf8");
    if (contentBytes > limits.maxContentBytesTotal) {
      return "content-byte-limit-exceeded";
    }
    contentCharacters += primitiveText.length;
    if (contentCharacters > limits.maxContentCharactersTotal) {
      return "content-character-limit-exceeded";
    }
    contentBytes += Buffer.byteLength(primitiveText, "utf8");
    if (contentBytes > limits.maxContentBytesTotal) {
      return "content-byte-limit-exceeded";
    }
    if (values.has(key)) {
      duplicates.add(key);
    }
    values.set(key, parsedValue.value);
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      skipWhitespace();
      if (index !== text.length) {
        return "invalid";
      }
      const entries = [...values.entries()];
      return {
        entries,
        occurrenceCount: entryCount,
        duplicateKeys: [...duplicates].sort(),
        sourceUniquenessProven: true,
        contentCharacters,
        contentBytes,
      };
    }
    if (text[index] !== ",") {
      return "invalid";
    }
    index += 1;
    skipWhitespace();
  }
  return "invalid";
}

function parseTranslationContent(
  content: unknown,
  limits: ResourcepackTranslationValidationLimits,
): ParsedEntries | ParseContentFailure {
  if (typeof content === "string") {
    return parseRawTranslationObject(content, limits);
  }
  const object = plainDataProperties(content, limits.maxEntriesPerFile);
  if (!object.ok) {
    return object.tooMany ? "entry-limit-exceeded" : "invalid";
  }
  const entries = Object.entries(object.descriptors).map(
    ([key, descriptor]) => [key, descriptor.value] as [string, unknown],
  );
  if (1 + entries.length * 2 > limits.maxJsonNodesPerFile) {
    return "node-limit-exceeded";
  }
  const size = contentSize(entries, limits);
  return {
    entries,
    occurrenceCount: entries.length,
    duplicateKeys: [],
    sourceUniquenessProven: false,
    contentCharacters: size.characters,
    contentBytes: size.bytes,
  };
}

function normalizeMojangFormatPlaceholders(value: string): string {
  return value.replace(/%(\d+\$)?[\d.]*[df]/g, "%$1s");
}

function analyzePlaceholders(
  value: string,
  argumentCount: number | undefined,
): PlaceholderAnalysis {
  const normalized = normalizeMojangFormatPlaceholders(value);
  const references: number[] = [];
  const pattern = /%(?:(\d+)\$)?([A-Za-z%]|$)/g;
  let implicitIndex = 0;
  let definiteFallback = false;
  let argumentCountDependent = false;
  for (const match of normalized.matchAll(pattern)) {
    const conversion = match[2] ?? "";
    if (conversion === "%") {
      continue;
    }
    if (conversion !== "s") {
      definiteFallback = true;
      continue;
    }
    const explicit = match[1];
    const significantExplicit =
      explicit === undefined ? undefined : explicit.replace(/^0+/, "") || "0";
    if (
      significantExplicit !== undefined &&
      (significantExplicit.length > 10 ||
        (significantExplicit.length === 10 && significantExplicit > "2147483647"))
    ) {
      definiteFallback = true;
      continue;
    }
    const parsedExplicit =
      significantExplicit === undefined ? undefined : Number(significantExplicit);
    const reference = parsedExplicit === undefined ? implicitIndex++ : parsedExplicit - 1;
    references.push(reference);
    if (reference < 0) {
      definiteFallback = true;
    } else if (argumentCount === undefined) {
      argumentCountDependent = true;
    } else if (reference >= argumentCount) {
      definiteFallback = true;
    }
  }
  references.sort((left, right) => left - right);
  return { references, definiteFallback, argumentCountDependent };
}

function sameReferences(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

type DiagnosticCollector = {
  add: (diagnostic: ResourcepackTranslationDiagnostic) => void;
  finish: () => {
    diagnostics: ResourcepackTranslationDiagnostic[];
    errorCount: number;
    warningCount: number;
    diagnosticTotal: number;
  };
};

function createDiagnosticCollector(limit: number, maxTextLength: number): DiagnosticCollector {
  const retained: ResourcepackTranslationDiagnostic[] = [];
  const identityKeys = new Map<string, Set<string | null>>();
  let errorCount = 0;
  let warningCount = 0;
  const add = (diagnostic: ResourcepackTranslationDiagnostic): void => {
    const identity = [
      diagnostic.severity,
      diagnostic.code,
      diagnostic.fileIndex ?? "",
      diagnostic.path ?? "",
      diagnostic.locale ?? "",
    ].join("\0");
    const keys = identityKeys.get(identity) ?? new Set<string | null>();
    if (keys.has(diagnostic.key)) {
      return;
    }
    keys.add(diagnostic.key);
    identityKeys.set(identity, keys);
    if (diagnostic.severity === "error") {
      errorCount += 1;
    } else {
      warningCount += 1;
    }
    if (retained.length < limit) {
      retained.push({
        ...diagnostic,
        key: diagnostic.key === null ? null : boundedText(diagnostic.key, maxTextLength),
      });
    }
  };
  return {
    add,
    finish: () => ({
      diagnostics: retained.sort(
        (left, right) =>
          left.severity.localeCompare(right.severity) ||
          (left.path ?? "").localeCompare(right.path ?? "") ||
          (left.locale ?? "").localeCompare(right.locale ?? "") ||
          left.code.localeCompare(right.code) ||
          (left.key ?? "").localeCompare(right.key ?? "") ||
          (left.fileIndex ?? -1) - (right.fileIndex ?? -1),
      ),
      errorCount,
      warningCount,
      diagnosticTotal: errorCount + warningCount,
    }),
  };
}

function validLocale(locale: string, limits: ResourcepackTranslationValidationLimits): boolean {
  return (
    locale.length > 0 && locale.length <= limits.maxLocaleLength && /^[a-z0-9_-]+$/.test(locale)
  );
}

const validationOptionNames = [
  "files",
  "edition",
  "version",
  "referenceLocale",
  "requiredLocales",
  "argumentCounts",
  "limit",
  "limits",
] as const;

export function validateResourcepackTranslationsInput(
  input: ResourcepackTranslationValidationOptions,
  resolveTargetVersion: (edition: string, version: string) => string,
): ResourcepackTranslationValidationResult {
  const inspected = plainDataProperties(input, validationOptionNames.length);
  if (!inspected.ok) {
    throw new Error(
      "Resource-pack translation options must be a bounded plain data object without accessors, symbols, or proxies.",
    );
  }
  if (
    Object.keys(inspected.descriptors).some(
      (name) => !(validationOptionNames as readonly string[]).includes(name),
    )
  ) {
    throw new Error("Resource-pack translation options contain an unknown field.");
  }
  const limits = resolveLimits(inspected.descriptors.limits?.value);
  const files = denseDataArray(
    inspected.descriptors.files?.value,
    limits.maxFiles,
    "Resource-pack translation files",
  ) as ResourcepackTranslationFile[];
  const requiredLocalesValue = inspected.descriptors.requiredLocales?.value;
  const requiredLocales =
    requiredLocalesValue === undefined
      ? []
      : denseDataArray(
          requiredLocalesValue,
          limits.maxRequiredLocales,
          "Resource-pack required locales",
        );
  if (!requiredLocales.every((locale) => typeof locale === "string")) {
    throw new Error("Resource-pack required locales must contain only strings.");
  }
  const editionValue = inspected.descriptors.edition?.value;
  const versionValue = inspected.descriptors.version?.value;
  const referenceLocaleValue = inspected.descriptors.referenceLocale?.value;
  const limitValue = inspected.descriptors.limit?.value;
  if (editionValue !== undefined && typeof editionValue !== "string") {
    throw new Error("Resource-pack translation edition must be a string.");
  }
  if (typeof editionValue === "string" && editionValue.length > 16) {
    throw new Error("Resource-pack translation edition must be at most 16 characters.");
  }
  if (versionValue !== undefined && typeof versionValue !== "string") {
    throw new Error("Resource-pack translation version must be a string.");
  }
  if (typeof versionValue === "string" && versionValue.length > 64) {
    throw new Error("Resource-pack translation version must be at most 64 characters.");
  }
  if (referenceLocaleValue !== undefined && typeof referenceLocaleValue !== "string") {
    throw new Error("Resource-pack translation referenceLocale must be a string.");
  }
  if (
    limitValue !== undefined &&
    (typeof limitValue !== "number" ||
      !Number.isSafeInteger(limitValue) ||
      limitValue < 1 ||
      limitValue > 1_000)
  ) {
    throw new Error(
      "Resource-pack translation diagnostic limit must be a positive safe integer no greater than 1000.",
    );
  }
  const version = resolveTargetVersion(editionValue ?? "java", versionValue ?? "latest");
  return validateResourcepackTranslationCatalog({
    files,
    version,
    referenceLocale: referenceLocaleValue ?? "en_us",
    requiredLocales: requiredLocales as string[],
    argumentCounts: inspected.descriptors.argumentCounts?.value as
      | Record<string, number>
      | undefined,
    limit: limitValue ?? 100,
    limits,
  });
}

function validateResourcepackTranslationCatalog(
  options: ResolvedOptions,
): ResourcepackTranslationValidationResult {
  const limits = options.limits;
  const collector = createDiagnosticCollector(options.limit, limits.maxDiagnosticTextLength);
  const incompleteReasons = new Set<ResourcepackTranslationIncompleteReason>();
  const exceededLimits = new Set<ResourcepackTranslationValidationLimitName>();
  const locales = new Map<string, LocaleState>();
  let processedFiles = 0;
  let parsedTextFiles = 0;
  let parsedObjectFiles = 0;
  let totalEntries = 0;
  let totalTextBytes = 0;
  let totalContentCharacters = 0;
  let totalContentBytes = 0;
  let comparisonOperations = 0;
  const referenceLocaleValid = validLocale(options.referenceLocale, limits);
  const referenceLocale = referenceLocaleValid ? options.referenceLocale : "invalid";

  const add = (
    diagnostic: Omit<ResourcepackTranslationDiagnostic, "message"> & { message: string },
  ): void => collector.add(diagnostic);
  const exceed = (name: ResourcepackTranslationValidationLimitName): void => {
    exceededLimits.add(name);
  };

  if (!verifiedRuntimeVersions.has(options.version)) {
    incompleteReasons.add("runtime-placeholder-version-unverified");
    add({
      severity: "warning",
      code: "runtime-placeholder-version-unverified",
      fileIndex: null,
      path: null,
      locale: null,
      key: null,
      message: "Placeholder runtime behavior was not verified against this target client version.",
    });
  }

  if (!referenceLocaleValid) {
    add({
      severity: "error",
      code: "invalid-reference-locale",
      fileIndex: null,
      path: null,
      locale: null,
      key: null,
      message: "The reference locale must be a bounded lowercase locale identifier.",
    });
  }

  if (options.requiredLocales && options.requiredLocales.length > limits.maxRequiredLocales) {
    exceed("maxRequiredLocales");
    add({
      severity: "error",
      code: "required-locale-limit-exceeded",
      fileIndex: null,
      path: null,
      locale: null,
      key: null,
      message: "The required locale count exceeds the configured bound.",
    });
  }
  for (const locale of options.requiredLocales?.slice(0, limits.maxRequiredLocales) ?? []) {
    if (!validLocale(locale, limits)) {
      add({
        severity: "error",
        code: "invalid-required-locale",
        fileIndex: null,
        path: null,
        locale: null,
        key: null,
        message: "A required locale is not a bounded lowercase locale identifier.",
      });
    }
  }

  const argumentCounts = new Map<string, number>();
  if (options.argumentCounts !== undefined) {
    const object = plainDataProperties(options.argumentCounts, limits.maxArgumentCountEntries);
    if (!object.ok) {
      if (object.tooMany) {
        exceed("maxArgumentCountEntries");
      }
      add({
        severity: "error",
        code: object.tooMany ? "argument-count-entry-limit-exceeded" : "invalid-argument-count-map",
        fileIndex: null,
        path: null,
        locale: null,
        key: null,
        message: object.tooMany
          ? "The argument-count entry count exceeds the configured bound."
          : "Argument counts must be a plain enumerable data object without accessors or symbols.",
      });
    } else {
      const entries = Object.entries(object.descriptors);
      for (const [key, descriptor] of entries) {
        const value = descriptor.value;
        if (
          key.length > limits.maxKeyLength ||
          typeof value !== "number" ||
          !Number.isSafeInteger(value) ||
          value < 0 ||
          value > limits.maxArgumentCount
        ) {
          add({
            severity: "error",
            code: "invalid-argument-count",
            fileIndex: null,
            path: null,
            locale: null,
            key: key.length <= limits.maxKeyLength ? key : null,
            message: "An argument count key or value is outside the configured bounds.",
          });
          continue;
        }
        argumentCounts.set(key, value);
      }
    }
  }

  if (options.files.length > limits.maxFiles) {
    exceed("maxFiles");
    add({
      severity: "error",
      code: "file-limit-exceeded",
      fileIndex: null,
      path: null,
      locale: null,
      key: null,
      message: "The translation file count exceeds the configured bound.",
    });
  }

  for (
    let fileIndex = 0;
    fileIndex < Math.min(options.files.length, limits.maxFiles);
    fileIndex += 1
  ) {
    const file = options.files[fileIndex];
    const fileObject = plainDataProperties(file, 2);
    if (!fileObject.ok) {
      add({
        severity: "error",
        code: "invalid-file-input",
        fileIndex,
        path: null,
        locale: null,
        key: null,
        message: "A file input must be a plain data object without accessors or symbols.",
      });
      continue;
    }
    const fileKeys = Object.keys(fileObject.descriptors);
    if (fileKeys.some((key) => key !== "path" && key !== "content")) {
      add({
        severity: "error",
        code: "unknown-file-property",
        fileIndex,
        path: null,
        locale: null,
        key: null,
        message: "A translation file input contains an unknown property.",
      });
      continue;
    }
    const path = fileObject.descriptors.path?.value;
    const content = fileObject.descriptors.content?.value;
    if (typeof path !== "string" || !("content" in fileObject.descriptors)) {
      add({
        severity: "error",
        code: "invalid-file-input",
        fileIndex,
        path: null,
        locale: null,
        key: null,
        message: "A translation file input requires string path and content data properties.",
      });
      continue;
    }
    if (path.length > limits.maxPathLength) {
      exceed("maxPathLength");
      add({
        severity: "error",
        code: "path-limit-exceeded",
        fileIndex,
        path: null,
        locale: null,
        key: null,
        message: "A translation path exceeds the configured bound.",
      });
      continue;
    }
    const pathMatch = translationPathPattern.exec(path);
    if (
      !pathMatch ||
      path.includes("\\") ||
      path.includes("//") ||
      pathMatch[1] === "." ||
      pathMatch[1] === ".."
    ) {
      add({
        severity: "error",
        code: "invalid-translation-path",
        fileIndex,
        path: null,
        locale: null,
        key: null,
        message: "A file path is not an assets/<namespace>/lang/<locale>.json pack path.",
      });
      continue;
    }
    const locale = pathMatch[2] as string;
    if (!validLocale(locale, limits)) {
      add({
        severity: "error",
        code: "invalid-path-locale",
        fileIndex,
        path,
        locale: null,
        key: null,
        message: "A translation path locale is outside the configured bounds.",
      });
      continue;
    }
    if (typeof content === "string") {
      if (content.length > limits.maxTextCharactersPerFile) {
        exceed("maxTextCharactersPerFile");
        add({
          severity: "error",
          code: "text-character-limit-exceeded",
          fileIndex,
          path,
          locale,
          key: null,
          message: "A translation JSON text exceeds the configured character bound.",
        });
        continue;
      }
      const bytes = Buffer.byteLength(content, "utf8");
      if (totalTextBytes + bytes > limits.maxTextBytesTotal) {
        exceed("maxTextBytesTotal");
        add({
          severity: "error",
          code: "text-byte-limit-exceeded",
          fileIndex,
          path,
          locale,
          key: null,
          message: "The translation JSON text total exceeds the configured byte bound.",
        });
        break;
      }
      totalTextBytes += bytes;
    }
    const remainingEntryBudget = Math.max(0, limits.maxEntriesTotal - totalEntries);
    const parsed = parseTranslationContent(content, {
      ...limits,
      maxEntriesPerFile: Math.min(limits.maxEntriesPerFile, remainingEntryBudget),
      maxContentCharactersTotal: Math.max(
        0,
        limits.maxContentCharactersTotal - totalContentCharacters,
      ),
      maxContentBytesTotal: Math.max(0, limits.maxContentBytesTotal - totalContentBytes),
    });
    if (parsed === "entry-limit-exceeded") {
      const limitName =
        remainingEntryBudget < limits.maxEntriesPerFile ? "maxEntriesTotal" : "maxEntriesPerFile";
      exceed(limitName);
      add({
        severity: "error",
        code:
          limitName === "maxEntriesTotal"
            ? "total-entry-limit-exceeded"
            : "file-entry-limit-exceeded",
        fileIndex,
        path,
        locale,
        key: null,
        message:
          limitName === "maxEntriesTotal"
            ? "The total translation entry occurrence count exceeds the configured bound."
            : "A translation file entry occurrence count exceeds the configured bound.",
      });
      break;
    }
    if (parsed === "content-character-limit-exceeded") {
      exceed("maxContentCharactersTotal");
      add({
        severity: "error",
        code: "content-character-limit-exceeded",
        fileIndex,
        path,
        locale,
        key: null,
        message:
          "The aggregate normalized translation key and value characters exceed the configured bound.",
      });
      break;
    }
    if (parsed === "content-byte-limit-exceeded") {
      exceed("maxContentBytesTotal");
      add({
        severity: "error",
        code: "content-byte-limit-exceeded",
        fileIndex,
        path,
        locale,
        key: null,
        message:
          "The aggregate normalized translation key and value UTF-8 bytes exceed the configured bound.",
      });
      break;
    }
    if (parsed === "node-limit-exceeded") {
      exceed("maxJsonNodesPerFile");
      add({
        severity: "error",
        code: "json-node-limit-exceeded",
        fileIndex,
        path,
        locale,
        key: null,
        message: "A translation JSON input exceeds the configured flat-object node bound.",
      });
      break;
    }
    if (parsed === "invalid") {
      add({
        severity: "error",
        code: "invalid-translation-content",
        fileIndex,
        path,
        locale,
        key: null,
        message: "Translation content must be valid JSON or a plain object with primitive values.",
      });
      continue;
    }
    if (totalEntries + parsed.occurrenceCount > limits.maxEntriesTotal) {
      exceed("maxEntriesTotal");
      add({
        severity: "error",
        code: "total-entry-limit-exceeded",
        fileIndex,
        path,
        locale,
        key: null,
        message: "The total translation entry count exceeds the configured bound.",
      });
      break;
    }
    if (totalContentCharacters + parsed.contentCharacters > limits.maxContentCharactersTotal) {
      exceed("maxContentCharactersTotal");
      add({
        severity: "error",
        code: "content-character-limit-exceeded",
        fileIndex,
        path,
        locale,
        key: null,
        message:
          "The aggregate normalized translation key and value characters exceed the configured bound.",
      });
      break;
    }
    if (totalContentBytes + parsed.contentBytes > limits.maxContentBytesTotal) {
      exceed("maxContentBytesTotal");
      add({
        severity: "error",
        code: "content-byte-limit-exceeded",
        fileIndex,
        path,
        locale,
        key: null,
        message:
          "The aggregate normalized translation key and value UTF-8 bytes exceed the configured bound.",
      });
      break;
    }
    processedFiles += 1;
    totalEntries += parsed.occurrenceCount;
    totalContentCharacters += parsed.contentCharacters;
    totalContentBytes += parsed.contentBytes;
    if (parsed.sourceUniquenessProven) {
      parsedTextFiles += 1;
    } else {
      parsedObjectFiles += 1;
      incompleteReasons.add("parsed-source-key-uniqueness-unavailable");
      add({
        severity: "warning",
        code: "source-key-uniqueness-unavailable",
        fileIndex,
        path,
        locale,
        key: null,
        message:
          "Parsed object input cannot prove whether the original JSON source had duplicate keys.",
      });
    }
    for (const duplicateKey of parsed.duplicateKeys) {
      add({
        severity: "warning",
        code: "duplicate-source-key",
        fileIndex,
        path,
        locale,
        key: duplicateKey,
        message:
          "A raw JSON source defines the same translation key more than once; the parser keeps the last value.",
      });
    }
    const state = locales.get(locale) ?? {
      fileIndexes: new Set<number>(),
      entryCount: 0,
      definitions: new Map<string, TranslationDefinition[]>(),
    };
    locales.set(locale, state);
    state.fileIndexes.add(fileIndex);
    state.entryCount += parsed.occurrenceCount;
    for (const [key, rawValue] of parsed.entries.sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      if (key.length > limits.maxKeyLength) {
        exceed("maxKeyLength");
        add({
          severity: "error",
          code: "key-limit-exceeded",
          fileIndex,
          path,
          locale,
          key: null,
          message: "A translation key exceeds the configured bound.",
        });
        continue;
      }
      let value: string | null = null;
      if (typeof rawValue === "string") {
        value = rawValue;
      } else if (typeof rawValue === "number" && !Number.isFinite(rawValue)) {
        add({
          severity: "error",
          code: "invalid-translation-value",
          fileIndex,
          path,
          locale,
          key,
          message: "Structured translation numbers must be finite JSON-compatible values.",
        });
      } else if (
        typeof rawValue === "number" ||
        typeof rawValue === "boolean" ||
        rawJsonNumberText(rawValue) !== undefined
      ) {
        incompleteReasons.add("value-coercion-unverified");
        add({
          severity: "warning",
          code: "primitive-value-coercion-unverified",
          fileIndex,
          path,
          locale,
          key,
          message:
            "Minecraft accepts primitive translation values, but exact parsed-value coercion was not compared.",
        });
      } else {
        add({
          severity: "error",
          code: "invalid-translation-value",
          fileIndex,
          path,
          locale,
          key,
          message:
            "Minecraft translation values must be JSON primitives; null, arrays, and objects are rejected.",
        });
      }
      if (value !== null && value.length > limits.maxValueCharacters) {
        exceed("maxValueCharacters");
        add({
          severity: "error",
          code: "value-character-limit-exceeded",
          fileIndex,
          path,
          locale,
          key,
          message: "A translation value exceeds the configured character bound.",
        });
        value = null;
      }
      const placeholder =
        value === null ? null : analyzePlaceholders(value, argumentCounts.get(key));
      if (placeholder?.argumentCountDependent && !argumentCounts.has(key)) {
        incompleteReasons.add("argument-count-evidence-unavailable");
      }
      if (placeholder?.definiteFallback) {
        incompleteReasons.add("translation-parity-mismatch");
        add({
          severity: "warning",
          code: "runtime-format-fallback",
          fileIndex,
          path,
          locale,
          key,
          message:
            "This translation can trigger TranslatableContents literal-template fallback for the supplied argument-count evidence.",
        });
      }
      const definitions = state.definitions.get(key) ?? [];
      definitions.push({ placeholder });
      state.definitions.set(key, definitions);
    }
  }

  for (const [locale, state] of locales) {
    for (const [key, definitions] of state.definitions) {
      if (definitions.length <= 1) {
        continue;
      }
      incompleteReasons.add("pack-order-unavailable");
      add({
        severity: "warning",
        code: "global-key-override-order-unknown",
        fileIndex: null,
        path: null,
        locale,
        key,
        message:
          "The same locale key occurs in multiple supplied files; pack-stack and namespace load order is not established.",
      });
    }
  }

  const reference = locales.get(referenceLocale);
  if (!reference) {
    incompleteReasons.add("reference-locale-unavailable");
    add({
      severity: "warning",
      code: "reference-locale-unavailable",
      fileIndex: null,
      path: null,
      locale: referenceLocaleValid ? referenceLocale : null,
      key: null,
      message: "The caller-selected reference locale is not present in the supplied files.",
    });
  }
  const requiredLocales = [
    ...new Set(
      (options.requiredLocales ?? [])
        .slice(0, limits.maxRequiredLocales)
        .filter((locale) => validLocale(locale, limits)),
    ),
  ].sort();
  const comparisons: ResourcepackTranslationComparison[] = [];
  if (reference) {
    const referenceKeys = [...reference.definitions.keys()].sort();
    for (const locale of requiredLocales) {
      const target = locales.get(locale);
      if (!target) {
        incompleteReasons.add("required-locale-unavailable");
        add({
          severity: "warning",
          code: "required-locale-unavailable",
          fileIndex: null,
          path: null,
          locale,
          key: null,
          message: "A caller-selected required locale is not present in the supplied files.",
        });
        comparisons.push({
          referenceLocale,
          locale,
          comparedKeyCount: 0,
          missingKeyCount: reference.definitions.size,
          extraKeyCount: 0,
          placeholderMismatchCount: 0,
          runtimeFallbackCount: 0,
          comparisonComplete: false,
        });
        continue;
      }
      let comparedKeyCount = 0;
      let missingKeyCount = 0;
      let extraKeyCount = 0;
      let placeholderMismatchCount = 0;
      let runtimeFallbackCount = 0;
      let comparisonComplete = true;
      const targetKeys =
        target === reference ? referenceKeys : [...target.definitions.keys()].sort();
      let referenceIndex = 0;
      let targetIndex = 0;
      while (referenceIndex < referenceKeys.length || targetIndex < targetKeys.length) {
        if (comparisonOperations >= limits.maxComparisonOperations) {
          exceed("maxComparisonOperations");
          incompleteReasons.add("comparison-limit-exceeded");
          comparisonComplete = false;
          add({
            severity: "warning",
            code: "comparison-limit-exceeded",
            fileIndex: null,
            path: null,
            locale,
            key: null,
            message: "Translation comparison stopped at the configured operation bound.",
          });
          break;
        }
        const referenceKey = referenceKeys[referenceIndex];
        const targetKey = targetKeys[targetIndex];
        let key: string;
        if (targetKey === undefined || (referenceKey !== undefined && referenceKey < targetKey)) {
          key = referenceKey as string;
          referenceIndex += 1;
        } else if (
          referenceKey === undefined ||
          (targetKey !== undefined && targetKey < referenceKey)
        ) {
          key = targetKey;
          targetIndex += 1;
        } else {
          key = referenceKey;
          referenceIndex += 1;
          targetIndex += 1;
        }
        comparisonOperations += 1;
        const referenceDefinitions = reference.definitions.get(key);
        const targetDefinitions = target.definitions.get(key);
        if (!targetDefinitions) {
          missingKeyCount += 1;
          incompleteReasons.add("translation-parity-mismatch");
          add({
            severity: "warning",
            code: "translation-key-missing",
            fileIndex: null,
            path: null,
            locale,
            key,
            message:
              "A caller-selected required locale is missing a key from the supplied reference locale.",
          });
          continue;
        }
        if (!referenceDefinitions) {
          extraKeyCount += 1;
          incompleteReasons.add("translation-parity-mismatch");
          add({
            severity: "warning",
            code: "translation-key-extra",
            fileIndex: null,
            path: null,
            locale,
            key,
            message:
              "A caller-selected required locale has a key absent from the supplied reference locale.",
          });
          continue;
        }
        if (referenceDefinitions.length !== 1 || targetDefinitions.length !== 1) {
          comparisonComplete = false;
          continue;
        }
        const referencePlaceholder = referenceDefinitions[0]?.placeholder;
        const targetPlaceholder = targetDefinitions[0]?.placeholder;
        if (!referencePlaceholder || !targetPlaceholder) {
          comparisonComplete = false;
          continue;
        }
        comparedKeyCount += 1;
        if (!sameReferences(referencePlaceholder.references, targetPlaceholder.references)) {
          placeholderMismatchCount += 1;
          incompleteReasons.add("translation-parity-mismatch");
          add({
            severity: "warning",
            code: "placeholder-reference-mismatch",
            fileIndex: null,
            path: null,
            locale,
            key,
            message:
              "Placeholder argument-reference multiplicity differs from the supplied reference locale.",
          });
        }
        if (targetPlaceholder.definiteFallback) {
          runtimeFallbackCount += 1;
        }
      }
      comparisons.push({
        referenceLocale,
        locale,
        comparedKeyCount,
        missingKeyCount,
        extraKeyCount,
        placeholderMismatchCount,
        runtimeFallbackCount,
        comparisonComplete,
      });
    }
  }

  const localeSummaries = [...locales.entries()]
    .map(([locale, state]) => ({
      locale,
      fileCount: state.fileIndexes.size,
      entryCount: state.entryCount,
      uniqueKeyCount: state.definitions.size,
      ambiguousKeyCount: [...state.definitions.values()].filter(
        (definitions) => definitions.length > 1,
      ).length,
    }))
    .sort((left, right) => left.locale.localeCompare(right.locale));
  const finished = collector.finish();
  const omittedDiagnosticCount = Math.max(
    0,
    finished.diagnosticTotal - finished.diagnostics.length,
  );
  if (omittedDiagnosticCount > 0) {
    incompleteReasons.add("diagnostics-truncated");
  }
  const reasons = [...incompleteReasons].sort();
  return {
    schemaVersion: 1,
    edition: "java",
    version: options.version,
    valid: finished.errorCount === 0,
    validationComplete: reasons.length === 0 && exceededLimits.size === 0,
    source,
    referenceLocale,
    requiredLocales,
    totalFiles: options.files.length,
    processedFiles,
    parsedTextFiles,
    parsedObjectFiles,
    textBytes: totalTextBytes,
    contentCharacters: totalContentCharacters,
    contentBytes: totalContentBytes,
    totalEntries,
    comparisonOperations,
    locales: localeSummaries,
    comparisons,
    incompleteReasons: reasons,
    appliedLimits: { ...limits, maxDiagnostics: options.limit },
    exceededLimits: [...exceededLimits].sort(),
    errorCount: finished.errorCount,
    warningCount: finished.warningCount,
    diagnosticTotal: finished.diagnosticTotal,
    retainedDiagnosticCount: finished.diagnostics.length,
    omittedDiagnosticCount,
    truncated: omittedDiagnosticCount > 0,
    diagnostics: finished.diagnostics,
    notes: [
      "Translation keys are compared exactly in a locale-wide global map; namespace-scoped parity is not inferred.",
      "Missing and extra keys describe only the caller-supplied reference and required locale subset, not vanilla, base-pack, fallback, or overlay coverage.",
      "Same-locale duplicate keys across supplied files are override evidence only because pack-stack and namespace iteration order was not supplied.",
      "Placeholder mismatches and runtime literal fallbacks are warnings, not proof that a resource pack is loader-invalid.",
      "Translation values are analyzed in memory and are never retained in this result.",
    ],
  };
}

export function resolveResourcepackTranslationValidationLimits(
  limits: Partial<ResourcepackTranslationValidationLimits> | undefined,
): ResourcepackTranslationValidationLimits {
  return resolveLimits(limits);
}
