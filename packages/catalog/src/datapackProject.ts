export type DatapackProjectFile = {
  path: string;
  content?: unknown;
};

export type DatapackProjectDiagnosticSeverity = "error" | "warning";

export type DatapackProjectDiagnostic = {
  severity: DatapackProjectDiagnosticSeverity;
  code: string;
  path: string;
  reference: string | null;
  source?: string;
  message: string;
};

export type DatapackProjectValidationLimits = {
  maxFiles: number;
  maxPathLength: number;
  maxTextContentCharacters: number;
  maxContentNodes: number;
  maxContentDepth: number;
  maxFunctionLines: number;
  maxGraphOperations: number;
  maxDiagnosticTextLength: number;
};

export type DatapackProjectValidationLimitName = keyof DatapackProjectValidationLimits;

export type DatapackProjectValidationIncompleteReason =
  | "content-unavailable"
  | "dynamic-reference"
  | "external-reference"
  | "file-schema-unavailable"
  | "limit-exceeded"
  | "registry-index-unavailable"
  | "unsupported-reference-kind";

export const defaultDatapackProjectValidationLimits: Readonly<DatapackProjectValidationLimits> =
  Object.freeze({
    maxFiles: 25_000,
    maxPathLength: 4_096,
    maxTextContentCharacters: 16 * 1_024 * 1_024,
    maxContentNodes: 250_000,
    maxContentDepth: 128,
    maxFunctionLines: 250_000,
    maxGraphOperations: 250_000,
    maxDiagnosticTextLength: 2_048,
  });

export type DatapackProjectValidationOptions = {
  files: DatapackProjectFile[];
  edition?: string;
  version?: string;
  limit?: number;
  limits?: Partial<DatapackProjectValidationLimits>;
  assumeLocalNamespacesComplete?: boolean;
};

export type DatapackProjectValidationResult = {
  schemaVersion: 1;
  edition: "java";
  version: string;
  valid: boolean;
  totalFiles: number;
  processedFiles: number;
  validationComplete: boolean;
  validationIncompleteReasons: DatapackProjectValidationIncompleteReason[];
  appliedLimits: DatapackProjectValidationLimits & { maxDiagnostics: number };
  exceededLimits: DatapackProjectValidationLimitName[];
  packMetadataFiles: number;
  jsonFiles: number;
  parsedJsonFiles: number;
  functionFiles: number;
  inspectedFunctionFiles: number;
  tagFiles: number;
  advancementFiles: number;
  validatedContentFiles: number;
  invalidContentFiles: number;
  checkedReferences: number;
  resolvedReferences: number;
  missingReferences: number;
  optionalMissingReferences: number;
  unverifiedReferences: number;
  detectedCycles: number;
  unsupportedReferenceKinds: string[];
  errorCount: number;
  warningCount: number;
  diagnosticTotal: number;
  retainedDiagnosticCount: number;
  omittedDiagnosticCount: number;
  truncated: boolean;
  diagnostics: DatapackProjectDiagnostic[];
  notes: string[];
};

export type DatapackProjectRegistryEvidence = {
  id: string;
  entryIndexStatus: string;
  tags: boolean | null;
};

export type DatapackProjectContentValidation = {
  path: string;
  validated: boolean;
  valid: boolean;
  issues: Array<{ message: string; keyword: string | null; source?: string }>;
};

type ResolvedValidationOptions = {
  files: DatapackProjectFile[];
  version: string;
  directoryLayout: DatapackDirectoryLayout;
  assumeLocalNamespacesComplete: boolean;
  commandRoots: ReadonlySet<string>;
  vanillaPaths: readonly string[];
  registryEntries: ReadonlyArray<{ registryId: string; entryId: string }>;
  registryEntryIndexAvailable: boolean;
  registries: readonly DatapackProjectRegistryEvidence[];
  validateContent: (file: { path: string; content: unknown }) => DatapackProjectContentValidation;
  limit: number;
  limits: DatapackProjectValidationLimits;
};

type ProjectFile = DatapackProjectFile & {
  normalizedPath: string;
  validPath: boolean;
  contentAvailable: boolean;
};

type JsonObject = Record<string, unknown>;

type DatapackElement = {
  kind: string;
  id: string;
  file: ProjectFile;
};

type ParsedElement = DatapackElement & {
  json: JsonObject;
};

function datapackElementGraphKey(element: DatapackElement): string {
  return `${element.kind}\0${element.id}`;
}

type FileReferenceKind = "advancement" | "function" | `tag/${string}`;
type DatapackDirectoryLayout = "legacy-plural" | "singular";

const resourceLocationPattern = /^([a-z0-9_.-]+):([a-z0-9/._-]+)$/;
const namespacePattern = /^[a-z0-9_.-]+$/;
const resourcePathPattern = /^[a-z0-9/._-]+$/;

const legacyDirectoryAliases = new Map<string, string>([
  ["advancements", "advancement"],
  ["functions", "function"],
  ["item_modifiers", "item_modifier"],
  ["loot_tables", "loot_table"],
  ["predicates", "predicate"],
  ["recipes", "recipe"],
  ["structures", "structure"],
]);

const legacyTagAliases = new Map<string, string>([
  ["blocks", "block"],
  ["entity_types", "entity_type"],
  ["fluids", "fluid"],
  ["functions", "function"],
  ["game_events", "game_event"],
  ["items", "item"],
]);

const legacyTagDirectories = new Map<string, string>(
  [...legacyTagAliases].map(([legacy, canonical]) => [canonical, legacy]),
);
const legacyDirectories = new Map<string, string>(
  [...legacyDirectoryAliases].map(([legacy, canonical]) => [canonical, legacy]),
);

function hasSupportedReferenceGraph(kind: string): boolean {
  return kind === "advancement" || kind === "function" || kind.startsWith("tag/");
}

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (const character of command) {
    if (quote) {
      token += "\0";
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      token += "\0";
      continue;
    }
    if (character === "{") {
      braceDepth += 1;
      token += character;
      continue;
    }
    if (character === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      token += character;
      continue;
    }
    if (character === "[") {
      bracketDepth += 1;
      token += character;
      continue;
    }
    if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      token += character;
      continue;
    }
    if (/\s/u.test(character) && braceDepth === 0 && bracketDepth === 0) {
      if (token) {
        tokens.push(token);
        token = "";
      }
      continue;
    }
    token += character;
  }
  if (token) {
    tokens.push(token);
  }
  return tokens;
}

function canonicalCommandRoot(token: string | undefined): string | null {
  if (!token) {
    return null;
  }
  return token.startsWith("minecraft:") ? token.slice("minecraft:".length) : token;
}

function functionReferenceToken(token: string | undefined): string | null {
  const target = token?.split("{", 1)[0];
  if (!target || target.includes("$(")) {
    return null;
  }
  const value = target.startsWith("#") ? target.slice(1) : target;
  return parseResourceLocation(value) ? target : null;
}

function parseExecuteCommand(
  tokens: readonly string[],
  start: number,
  commandRoots: ReadonlySet<string>,
): { nestedStart: number | null; references: string[] } | null {
  const references: string[] = [];
  let cursor = start;
  const advance = (tokenCount: number): boolean => {
    if (cursor + tokenCount > tokens.length) {
      return false;
    }
    cursor += tokenCount;
    return true;
  };

  while (cursor < tokens.length) {
    const clause = canonicalCommandRoot(tokens[cursor]);
    if (clause === "run") {
      const nestedRoot = canonicalCommandRoot(tokens[cursor + 1]);
      return nestedRoot && commandRoots.has(nestedRoot)
        ? { nestedStart: cursor + 1, references }
        : null;
    }
    if (
      clause === "align" ||
      clause === "anchored" ||
      clause === "as" ||
      clause === "at" ||
      clause === "in" ||
      clause === "on" ||
      clause === "summon"
    ) {
      if (!advance(2)) {
        return null;
      }
      continue;
    }
    if (clause === "facing") {
      if (!advance(4)) {
        return null;
      }
      continue;
    }
    if (clause === "positioned") {
      const modifier = canonicalCommandRoot(tokens[cursor + 1]);
      if (!advance(modifier === "as" || modifier === "over" ? 3 : 4)) {
        return null;
      }
      continue;
    }
    if (clause === "rotated") {
      if (!advance(3)) {
        return null;
      }
      continue;
    }
    if (clause === "store") {
      const resultMode = canonicalCommandRoot(tokens[cursor + 1]);
      const destination = canonicalCommandRoot(tokens[cursor + 2]);
      if (resultMode !== "result" && resultMode !== "success") {
        return null;
      }
      const tokenCount =
        destination === "score" || destination === "bossbar"
          ? 5
          : destination === "entity" || destination === "storage"
            ? 7
            : destination === "block"
              ? 9
              : 0;
      if (tokenCount === 0 || !advance(tokenCount)) {
        return null;
      }
      continue;
    }
    if (clause !== "if" && clause !== "unless") {
      return null;
    }

    const condition = canonicalCommandRoot(tokens[cursor + 1]);
    if (condition === "function") {
      if (!advance(3)) {
        return null;
      }
      const reference = functionReferenceToken(tokens[cursor - 1]);
      if (reference) {
        references.push(reference);
      }
      continue;
    }
    if (condition === "dimension" || condition === "entity" || condition === "predicate") {
      if (!advance(3)) {
        return null;
      }
      continue;
    }
    if (condition === "stopwatch") {
      if (!advance(4)) {
        return null;
      }
      continue;
    }
    if (condition === "biome" || condition === "block") {
      if (!advance(6)) {
        return null;
      }
      continue;
    }
    if (condition === "blocks") {
      if (!advance(12)) {
        return null;
      }
      continue;
    }
    if (condition === "loaded") {
      if (!advance(5)) {
        return null;
      }
      continue;
    }
    if (condition === "data") {
      const source = canonicalCommandRoot(tokens[cursor + 2]);
      const tokenCount =
        source === "block" ? 7 : source === "entity" || source === "storage" ? 5 : 0;
      if (tokenCount === 0 || !advance(tokenCount)) {
        return null;
      }
      continue;
    }
    if (condition === "items") {
      const source = canonicalCommandRoot(tokens[cursor + 2]);
      const tokenCount = source === "block" ? 8 : source === "entity" ? 6 : 0;
      if (tokenCount === 0 || !advance(tokenCount)) {
        return null;
      }
      continue;
    }
    if (condition === "score") {
      const operator = canonicalCommandRoot(tokens[cursor + 4]);
      const tokenCount = operator === "matches" ? 6 : 7;
      if (
        (operator !== "matches" &&
          operator !== "<" &&
          operator !== "<=" &&
          operator !== "=" &&
          operator !== ">" &&
          operator !== ">=") ||
        !advance(tokenCount)
      ) {
        return null;
      }
      continue;
    }
    return null;
  }
  return { nestedStart: null, references };
}

function literalFunctionCommandReferences(
  command: string,
  commandRoots: ReadonlySet<string>,
): string[] {
  const tokens = tokenizeCommand(command);
  const references: string[] = [];
  let start = 0;
  while (start < tokens.length) {
    const root = canonicalCommandRoot(tokens[start]);
    if (root === "function") {
      const reference = functionReferenceToken(tokens[start + 1]);
      if (reference) {
        references.push(reference);
      }
      break;
    }
    if (root === "schedule" || root === "debug") {
      if (canonicalCommandRoot(tokens[start + 1]) === "function") {
        const reference = functionReferenceToken(tokens[start + 2]);
        if (reference) {
          references.push(reference);
        }
      }
      break;
    }
    if (root === "return") {
      if (
        canonicalCommandRoot(tokens[start + 1]) !== "run" ||
        !commandRoots.has(canonicalCommandRoot(tokens[start + 2]) ?? "")
      ) {
        break;
      }
      start += 2;
      continue;
    }
    if (root !== "execute") {
      break;
    }

    const parsedExecute = parseExecuteCommand(tokens, start + 1, commandRoots);
    if (!parsedExecute) {
      break;
    }
    references.push(...parsedExecute.references);
    if (parsedExecute.nestedStart === null) {
      break;
    }
    start = parsedExecute.nestedStart;
  }
  return references;
}

function hasDynamicCommandMacro(command: string): boolean {
  return command.includes("$(");
}

function boundedDiagnosticValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  let hash = 0x811c_9dc5;
  const sampleLength = Math.min(64, value.length);
  for (let index = 0; index < sampleLength; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x0100_0193);
  }
  for (
    let index = Math.max(sampleLength, value.length - sampleLength);
    index < value.length;
    index += 1
  ) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x0100_0193);
  }
  hash ^= value.length;
  hash = Math.imul(hash, 0x0100_0193);
  const marker = `…#${(hash >>> 0).toString(16).padStart(8, "0")}`;
  return marker.length >= maxLength
    ? marker.slice(marker.length - maxLength)
    : `${value.slice(0, maxLength - marker.length)}${marker}`;
}

export function resolveDatapackProjectValidationLimits(
  limits: Partial<DatapackProjectValidationLimits> | undefined,
): DatapackProjectValidationLimits {
  const resolve = (name: DatapackProjectValidationLimitName): number => {
    const fallback = defaultDatapackProjectValidationLimits[name];
    const requested = limits?.[name];
    return typeof requested === "number" && Number.isFinite(requested) && requested >= 1
      ? Math.min(Math.floor(requested), fallback)
      : fallback;
  };
  return {
    maxFiles: resolve("maxFiles"),
    maxPathLength: resolve("maxPathLength"),
    maxTextContentCharacters: resolve("maxTextContentCharacters"),
    maxContentNodes: resolve("maxContentNodes"),
    maxContentDepth: resolve("maxContentDepth"),
    maxFunctionLines: resolve("maxFunctionLines"),
    maxGraphOperations: resolve("maxGraphOperations"),
    maxDiagnosticTextLength: resolve("maxDiagnosticTextLength"),
  };
}

type DiagnosticCollector = {
  add: (diagnostic: DatapackProjectDiagnostic) => void;
  finish: () => {
    diagnostics: DatapackProjectDiagnostic[];
    errorCount: number;
    warningCount: number;
    diagnosticTotal: number;
  };
};

function createDiagnosticCollector(options: {
  limit: number;
  maxTextLength: number;
}): DiagnosticCollector {
  const keys = new Set<string>();
  const retainedErrors: DatapackProjectDiagnostic[] = [];
  const retainedWarnings: DatapackProjectDiagnostic[] = [];
  let errorCount = 0;
  let warningCount = 0;
  const compare = (left: DatapackProjectDiagnostic, right: DatapackProjectDiagnostic): number =>
    left.severity.localeCompare(right.severity) ||
    left.path.localeCompare(right.path) ||
    left.code.localeCompare(right.code) ||
    (left.source ?? "").localeCompare(right.source ?? "") ||
    (left.reference ?? "").localeCompare(right.reference ?? "");
  return {
    add(diagnostic) {
      const bounded: DatapackProjectDiagnostic = {
        ...diagnostic,
        path: boundedDiagnosticValue(diagnostic.path, options.maxTextLength),
        reference:
          diagnostic.reference === null
            ? null
            : boundedDiagnosticValue(diagnostic.reference, options.maxTextLength),
        ...(diagnostic.source
          ? { source: boundedDiagnosticValue(diagnostic.source, options.maxTextLength) }
          : {}),
        message: boundedDiagnosticValue(diagnostic.message, options.maxTextLength),
      };
      const key = [
        bounded.severity,
        bounded.code,
        bounded.path,
        bounded.source ?? "",
        bounded.reference ?? "",
      ].join("\0");
      if (keys.has(key)) {
        return;
      }
      keys.add(key);
      if (diagnostic.severity === "error") {
        errorCount += 1;
        if (retainedErrors.length < options.limit) {
          retainedErrors.push(bounded);
        }
      } else {
        warningCount += 1;
        if (retainedWarnings.length < options.limit) {
          retainedWarnings.push(bounded);
        }
      }
    },
    finish() {
      const diagnostics = [...retainedErrors, ...retainedWarnings]
        .sort(compare)
        .slice(0, options.limit);
      return {
        diagnostics,
        errorCount,
        warningCount,
        diagnosticTotal: errorCount + warningCount,
      };
    },
  };
}

function normalizeProjectPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

function validProjectPath(path: string): boolean {
  if (
    !path ||
    path.includes("\\") ||
    path.startsWith("/") ||
    /^[a-zA-Z]:/.test(path) ||
    /\p{Cc}/u.test(path)
  ) {
    return false;
  }
  const segments = path.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function isJsonObject(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalDirectory(directory: string, layout: DatapackDirectoryLayout): string | null {
  if (layout === "singular") {
    return legacyDirectoryAliases.has(directory) ? null : directory;
  }
  if (legacyDirectories.has(directory)) {
    return null;
  }
  return legacyDirectoryAliases.get(directory) ?? directory;
}

function canonicalTagCategory(category: string): string {
  return legacyTagAliases.get(category) ?? category;
}

function tagCategoryAliases(
  registries: readonly DatapackProjectRegistryEvidence[],
  layout: DatapackDirectoryLayout,
): Array<{ alias: string; category: string }> {
  const categories = new Set<string>(["function"]);
  for (const registry of registries) {
    if (registry.tags !== false && registry.id.startsWith("minecraft:")) {
      categories.add(registry.id.slice("minecraft:".length));
    }
  }
  const aliases: Array<{ alias: string; category: string }> = [];
  for (const category of categories) {
    aliases.push({
      alias:
        layout === "legacy-plural" ? (legacyTagDirectories.get(category) ?? category) : category,
      category,
    });
  }
  return aliases.sort(
    (left, right) =>
      right.alias.split("/").length - left.alias.split("/").length ||
      left.alias.localeCompare(right.alias),
  );
}

function datapackDirectoryLayoutMismatch(
  file: ProjectFile,
  layout: DatapackDirectoryLayout,
  registries: readonly DatapackProjectRegistryEvidence[],
): { actual: string; expected: string } | null {
  const matched = /^data\/[^/]+\/(.+)$/.exec(file.normalizedPath);
  const remainder = matched?.[1];
  if (!remainder) {
    return null;
  }
  if (!remainder.startsWith("tags/")) {
    const directory = remainder.split("/", 1)[0];
    if (!directory) {
      return null;
    }
    const expected =
      layout === "singular"
        ? legacyDirectoryAliases.get(directory)
        : legacyDirectories.get(directory);
    return expected ? { actual: directory, expected } : null;
  }

  const tagRemainder = remainder.slice("tags/".length);
  const categories = new Set<string>(["function"]);
  for (const registry of registries) {
    if (registry.tags !== false && registry.id.startsWith("minecraft:")) {
      categories.add(registry.id.slice("minecraft:".length));
    }
  }
  for (const category of categories) {
    const legacy = legacyTagDirectories.get(category);
    if (!legacy) {
      continue;
    }
    const actual = layout === "singular" ? legacy : category;
    const expected = layout === "singular" ? category : legacy;
    if (tagRemainder.startsWith(`${actual}/`)) {
      return { actual: `tags/${actual}`, expected: `tags/${expected}` };
    }
  }
  return null;
}

function datapackElementFromPath(
  file: ProjectFile,
  tagAliases: ReadonlyArray<{ alias: string; category: string }>,
  layout: DatapackDirectoryLayout,
): DatapackElement | null {
  const matched = /^data\/([^/]+)\/(.+)$/.exec(file.normalizedPath);
  const namespace = matched?.[1];
  const remainder = matched?.[2];
  if (!namespace || !remainder || !namespacePattern.test(namespace)) {
    return null;
  }
  if (remainder.startsWith("tags/")) {
    const tagRemainder = remainder.slice("tags/".length);
    for (const alias of tagAliases) {
      const prefix = `${alias.alias}/`;
      if (!tagRemainder.startsWith(prefix) || !tagRemainder.endsWith(".json")) {
        continue;
      }
      const path = tagRemainder.slice(prefix.length, -".json".length);
      if (!validResourcePath(path)) {
        return null;
      }
      return { kind: `tag/${alias.category}`, id: `${namespace}:${path}`, file };
    }
    return null;
  }
  const separator = remainder.indexOf("/");
  if (separator === -1) {
    return null;
  }
  let directory = canonicalDirectory(remainder.slice(0, separator), layout);
  if (!directory) {
    return null;
  }
  let filePath = remainder.slice(separator + 1);
  if (directory === "worldgen") {
    const registrySeparator = filePath.indexOf("/");
    if (registrySeparator === -1) {
      return null;
    }
    directory = `worldgen/${filePath.slice(0, registrySeparator)}`;
    filePath = filePath.slice(registrySeparator + 1);
  }
  const extension =
    directory === "function" ? ".mcfunction" : directory === "structure" ? ".nbt" : ".json";
  if (!filePath.endsWith(extension)) {
    return null;
  }
  const path = filePath.slice(0, -extension.length);
  if (!validResourcePath(path)) {
    return null;
  }
  return { kind: directory, id: `${namespace}:${path}`, file };
}

function validResourcePath(path: string): boolean {
  return (
    resourcePathPattern.test(path) &&
    path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  );
}

function parseResourceLocation(
  reference: string,
): { namespace: string; path: string; id: string } | null {
  const value = reference.trim();
  if (value !== reference) {
    return null;
  }
  const qualified = value.includes(":") ? value : `minecraft:${value}`;
  const matched = resourceLocationPattern.exec(qualified);
  if (!matched?.[1] || !matched[2] || !validResourcePath(matched[2])) {
    return null;
  }
  return { namespace: matched[1], path: matched[2], id: `${matched[1]}:${matched[2]}` };
}

function referenceCandidatePaths(
  kind: FileReferenceKind,
  id: string,
  layout: DatapackDirectoryLayout,
): string[] {
  const location = parseResourceLocation(id);
  if (!location) {
    return [];
  }
  if (kind === "function") {
    const directory = layout === "singular" ? "function" : "functions";
    return [`data/${location.namespace}/${directory}/${location.path}.mcfunction`];
  }
  if (kind === "advancement") {
    const directory = layout === "singular" ? "advancement" : "advancements";
    return [`data/${location.namespace}/${directory}/${location.path}.json`];
  }
  const category = kind.slice("tag/".length);
  const directory =
    layout === "legacy-plural" ? (legacyTagDirectories.get(category) ?? category) : category;
  return [`data/${location.namespace}/tags/${directory}/${location.path}.json`];
}

function registryElementCandidatePaths(
  category: string,
  id: string,
  layout: DatapackDirectoryLayout,
): string[] {
  const location = parseResourceLocation(id);
  if (!location) {
    return [];
  }
  const directory =
    layout === "legacy-plural" ? (legacyDirectories.get(category) ?? category) : category;
  return [`data/${location.namespace}/${directory}/${location.path}.json`];
}

function inspectJsonTree(
  value: unknown,
  options: {
    maxNodes: number;
    maxDepth: number;
    maxTextCharacters: number;
    countTextCharacters: boolean;
  },
): {
  nodes: number;
  textCharacters: number;
  error: string | null;
  exceeded: "maxContentDepth" | "maxContentNodes" | "maxTextContentCharacters" | null;
} {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const visited = new Set<object>();
  let nodes = 0;
  let textCharacters = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }
    nodes += 1;
    if (nodes > options.maxNodes) {
      return { nodes, textCharacters, error: null, exceeded: "maxContentNodes" };
    }
    if (current.depth > options.maxDepth) {
      return { nodes, textCharacters, error: null, exceeded: "maxContentDepth" };
    }
    if (current.value === null) {
      continue;
    }
    if (typeof current.value !== "object") {
      if (typeof current.value === "string") {
        if (options.countTextCharacters) {
          textCharacters += current.value.length;
          if (textCharacters > options.maxTextCharacters) {
            return {
              nodes,
              textCharacters,
              error: null,
              exceeded: "maxTextContentCharacters",
            };
          }
        }
        continue;
      }
      if (
        typeof current.value === "boolean" ||
        (typeof current.value === "number" && Number.isFinite(current.value))
      ) {
        continue;
      }
      return {
        nodes,
        textCharacters,
        error: "Parsed JSON content must contain only JSON-compatible primitive values.",
        exceeded: null,
      };
    }
    if (!Array.isArray(current.value) && !isJsonObject(current.value)) {
      return {
        nodes,
        textCharacters,
        error: "Parsed JSON content must contain only arrays, plain objects, and primitive values.",
        exceeded: null,
      };
    }
    if (visited.has(current.value)) {
      return {
        nodes,
        textCharacters,
        error: "Parsed JSON content must not contain cycles or shared objects.",
        exceeded: null,
      };
    }
    visited.add(current.value);
    if (
      Array.isArray(current.value) &&
      current.value.length > options.maxNodes - nodes - pending.length
    ) {
      return { nodes, textCharacters, error: null, exceeded: "maxContentNodes" };
    }
    const keys: string[] = [];
    for (const key in current.value) {
      if (!Object.hasOwn(current.value, key)) {
        continue;
      }
      if (nodes + pending.length + keys.length >= options.maxNodes) {
        return { nodes, textCharacters, error: null, exceeded: "maxContentNodes" };
      }
      if (!Array.isArray(current.value) && options.countTextCharacters) {
        textCharacters += key.length;
        if (textCharacters > options.maxTextCharacters) {
          return {
            nodes,
            textCharacters,
            error: null,
            exceeded: "maxTextContentCharacters",
          };
        }
      }
      keys.push(key);
    }
    if (
      Array.isArray(current.value) &&
      (keys.length !== current.value.length || keys.some((key, index) => key !== String(index)))
    ) {
      return {
        nodes,
        textCharacters,
        error: "Parsed JSON arrays must be dense and contain only indexed elements.",
        exceeded: null,
      };
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      if (key === undefined) {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(current.value, key);
      if (!descriptor || !("value" in descriptor)) {
        return {
          nodes,
          textCharacters,
          error: "Parsed JSON content must not contain accessor properties.",
          exceeded: null,
        };
      }
      pending.push({ value: descriptor.value, depth: current.depth + 1 });
    }
  }
  return { nodes, textCharacters, error: null, exceeded: null };
}

function parseProjectJson(
  file: ProjectFile,
  remainingNodes: number,
  maxDepth: number,
  remainingTextCharacters: number,
):
  | { json: JsonObject; nodes: number; textCharacters: number }
  | { unavailable: true }
  | { error: string; nodes: number; textCharacters: number }
  | {
      exceeded: "maxContentDepth" | "maxContentNodes" | "maxTextContentCharacters";
      nodes: number;
      textCharacters: number;
    } {
  if (!file.contentAvailable) {
    return { unavailable: true };
  }
  let parsed: unknown;
  if (typeof file.content === "string") {
    try {
      parsed = JSON.parse(file.content) as unknown;
    } catch (error) {
      return {
        error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        nodes: 0,
        textCharacters: 0,
      };
    }
  } else {
    parsed = file.content;
  }
  const inspected = inspectJsonTree(parsed, {
    maxNodes: remainingNodes,
    maxDepth,
    maxTextCharacters: remainingTextCharacters,
    countTextCharacters: typeof file.content !== "string",
  });
  if (inspected.exceeded) {
    return {
      exceeded: inspected.exceeded,
      nodes: inspected.nodes,
      textCharacters: inspected.textCharacters,
    };
  }
  if (inspected.error) {
    return {
      error: inspected.error,
      nodes: inspected.nodes,
      textCharacters: inspected.textCharacters,
    };
  }
  if (!isJsonObject(parsed)) {
    return {
      error: "Datapack JSON must contain an object at the document root.",
      nodes: inspected.nodes,
      textCharacters: inspected.textCharacters,
    };
  }
  return { json: parsed, nodes: inspected.nodes, textCharacters: inspected.textCharacters };
}

function collectCycles(options: {
  edges: ReadonlyMap<string, ReadonlySet<string>>;
  elements: ReadonlyMap<string, DatapackElement>;
  consume: () => boolean;
  report: (source: DatapackElement, reference: string) => void;
}): number {
  const state = new Map<string, "active" | "done">();
  let cycles = 0;
  for (const root of options.edges.keys()) {
    if (state.has(root)) {
      continue;
    }
    const stack: Array<{ id: string; targets: string[]; index: number }> = [
      { id: root, targets: [...(options.edges.get(root) ?? [])], index: 0 },
    ];
    state.set(root, "active");
    while (stack.length > 0) {
      if (!options.consume()) {
        return cycles;
      }
      const frame = stack.at(-1);
      if (!frame) {
        break;
      }
      const target = frame.targets[frame.index];
      if (target === undefined) {
        state.set(frame.id, "done");
        stack.pop();
        continue;
      }
      frame.index += 1;
      const targetState = state.get(target);
      if (targetState === "active") {
        cycles += 1;
        const source = options.elements.get(frame.id);
        if (source) {
          options.report(source, options.elements.get(target)?.id ?? target);
        }
        continue;
      }
      if (targetState === "done" || !options.edges.has(target)) {
        continue;
      }
      state.set(target, "active");
      stack.push({ id: target, targets: [...(options.edges.get(target) ?? [])], index: 0 });
    }
  }
  return cycles;
}

export function validateDatapackReferenceGraph(
  options: ResolvedValidationOptions,
): DatapackProjectValidationResult {
  const limits = options.limits;
  const diagnostics = createDiagnosticCollector({
    limit: options.limit,
    maxTextLength: limits.maxDiagnosticTextLength,
  });
  const exceededLimits = new Set<DatapackProjectValidationLimitName>();
  const incompleteReasons = new Set<DatapackProjectValidationIncompleteReason>();
  const unsupportedReferenceKinds = new Set<string>();
  const tagAliases = tagCategoryAliases(options.registries, options.directoryLayout);
  const totalFiles = options.files.length;
  if (totalFiles > limits.maxFiles) {
    exceededLimits.add("maxFiles");
    incompleteReasons.add("limit-exceeded");
    diagnostics.add({
      severity: "error",
      code: "file-limit-exceeded",
      path: "",
      reference: null,
      message: `Datapack project contains ${totalFiles} files, above the applied ${limits.maxFiles}-file limit.`,
    });
  }

  let textCharacters = 0;
  const projectFiles: ProjectFile[] = options.files
    .slice(0, limits.maxFiles)
    .map((file) => {
      const pathWithinLimit = file.path.length <= limits.maxPathLength;
      const normalizedPath = pathWithinLimit ? normalizeProjectPath(file.path) : "";
      const validPath = pathWithinLimit && validProjectPath(file.path);
      if (!pathWithinLimit) {
        exceededLimits.add("maxPathLength");
        incompleteReasons.add("limit-exceeded");
      }
      let contentAvailable = file.content !== undefined;
      if (typeof file.content === "string") {
        textCharacters += file.content.length;
        if (textCharacters > limits.maxTextContentCharacters) {
          exceededLimits.add("maxTextContentCharacters");
          incompleteReasons.add("limit-exceeded");
          contentAvailable = false;
        }
      }
      return { ...file, normalizedPath, validPath, contentAvailable };
    })
    .sort((left, right) => left.normalizedPath.localeCompare(right.normalizedPath));

  const lowerPaths = new Map<string, ProjectFile[]>();
  for (const file of projectFiles) {
    if (!file.validPath) {
      diagnostics.add({
        severity: "error",
        code: file.path.length > limits.maxPathLength ? "path-limit-exceeded" : "unsafe-file-path",
        path: file.path,
        reference: null,
        message:
          file.path.length > limits.maxPathLength
            ? `Datapack project path exceeds the applied ${limits.maxPathLength}-character limit.`
            : "Datapack project paths must be slash-separated, relative, non-empty, and free of control, dot, or empty segments.",
      });
      continue;
    }
    const key = file.normalizedPath.toLowerCase();
    const matches = lowerPaths.get(key) ?? [];
    matches.push(file);
    lowerPaths.set(key, matches);
  }
  for (const matches of lowerPaths.values()) {
    if (matches.length < 2) {
      continue;
    }
    for (const file of matches) {
      diagnostics.add({
        severity: "error",
        code: "duplicate-file-path",
        path: file.path,
        reference: matches[0]?.path ?? file.path,
        message:
          "Datapack project file paths must be unique under portable case-insensitive comparison.",
      });
    }
  }

  const packMetadataFiles = projectFiles.filter(
    (file) => file.validPath && file.normalizedPath === "pack.mcmeta",
  ).length;
  if (packMetadataFiles === 0) {
    diagnostics.add({
      severity: "error",
      code: "pack-metadata-missing",
      path: "pack.mcmeta",
      reference: null,
      message: "A datapack project must include pack.mcmeta at its root.",
    });
  }

  if (exceededLimits.has("maxTextContentCharacters")) {
    diagnostics.add({
      severity: "error",
      code: "text-content-limit-exceeded",
      path: "",
      reference: null,
      message: `Datapack project text content exceeds the applied ${limits.maxTextContentCharacters}-character aggregate limit.`,
    });
  }

  const contentValidations: DatapackProjectContentValidation[] = [];
  const invalidContentPaths = new Set<string>();
  const recordContentValidation = (
    validation: DatapackProjectContentValidation,
    schemaCoveredByGraph = false,
  ): void => {
    contentValidations.push(validation);
    if (!validation.valid) {
      invalidContentPaths.add(validation.path);
    }
    if (!validation.validated && validation.valid && !schemaCoveredByGraph) {
      incompleteReasons.add("file-schema-unavailable");
      diagnostics.add({
        severity: "warning",
        code: "pack-file-schema-unavailable",
        path: validation.path,
        reference: null,
        message:
          "No version-compatible file schema is available, so this JSON file could not be validated.",
      });
      return;
    }
    if (validation.valid) {
      return;
    }
    for (const issue of validation.issues) {
      if (issue.keyword === "parse") {
        continue;
      }
      diagnostics.add({
        severity: "error",
        code: "pack-file-content-invalid",
        path: validation.path,
        reference: null,
        ...(issue.source
          ? { source: issue.source }
          : issue.keyword === null
            ? {}
            : { source: issue.keyword }),
        message: issue.message,
      });
    }
  };

  const vanillaPaths = new Set(options.vanillaPaths);
  const validFilesByPath = new Map<string, ProjectFile>();
  const localNamespaces = new Set<string>();
  const elements = new Map<string, DatapackElement>();
  const elementsByPath = new Map<string, DatapackElement>();
  for (const file of projectFiles) {
    if (!file.validPath || lowerPaths.get(file.normalizedPath.toLowerCase())?.length !== 1) {
      continue;
    }
    validFilesByPath.set(file.normalizedPath, file);
    const dataPath = /^data\/([^/]+)\/(.+)$/.exec(file.normalizedPath);
    if (file.normalizedPath.startsWith("data/")) {
      const namespace = dataPath?.[1];
      const resourcePath = dataPath?.[2];
      if (
        !namespace ||
        !resourcePath ||
        !namespacePattern.test(namespace) ||
        !validResourcePath(resourcePath)
      ) {
        diagnostics.add({
          severity: "error",
          code: "invalid-datapack-resource-path",
          path: file.path,
          reference: null,
          message:
            "Datapack namespaces and resource paths must use lowercase resource-location-safe characters.",
        });
      } else {
        localNamespaces.add(namespace);
      }
    }
    const layoutMismatch = datapackDirectoryLayoutMismatch(
      file,
      options.directoryLayout,
      options.registries,
    );
    if (layoutMismatch) {
      diagnostics.add({
        severity: "error",
        code: "wrong-datapack-directory-layout",
        path: file.path,
        reference: layoutMismatch.expected,
        message: `Java ${options.version} expects ${layoutMismatch.expected} instead of ${layoutMismatch.actual} for this datapack resource directory.`,
      });
      continue;
    }
    const element = datapackElementFromPath(file, tagAliases, options.directoryLayout);
    if (!element) {
      continue;
    }
    const key = `${element.kind}\0${element.id}`;
    if (elements.has(key)) {
      diagnostics.add({
        severity: "error",
        code: "duplicate-resource-id",
        path: file.path,
        reference: element.id,
        message: `Multiple datapack files define the same ${element.kind} resource ID.`,
      });
      continue;
    }
    elements.set(key, element);
    elementsByPath.set(file.normalizedPath, element);
  }

  const parsedJsonByPath = new Map<string, JsonObject>();
  let contentNodes = 0;
  let parsedJsonFiles = 0;
  for (const file of [...validFilesByPath.values()].sort(
    (left, right) =>
      Number(right.normalizedPath === "pack.mcmeta") -
        Number(left.normalizedPath === "pack.mcmeta") ||
      left.normalizedPath.localeCompare(right.normalizedPath),
  )) {
    const jsonFile = file.normalizedPath.endsWith(".json") || file.normalizedPath === "pack.mcmeta";
    if (jsonFile) {
      const parsed = parseProjectJson(
        file,
        Math.max(0, limits.maxContentNodes - contentNodes),
        limits.maxContentDepth,
        Math.max(0, limits.maxTextContentCharacters - textCharacters),
      );
      contentNodes += "nodes" in parsed ? parsed.nodes : 0;
      textCharacters += "textCharacters" in parsed ? parsed.textCharacters : 0;
      if ("unavailable" in parsed) {
        incompleteReasons.add("content-unavailable");
        diagnostics.add({
          severity: "warning",
          code: "json-content-unavailable",
          path: file.path,
          reference: null,
          message:
            "JSON content was not supplied, so its file schema and references could not be inspected.",
        });
        continue;
      }
      if ("exceeded" in parsed) {
        exceededLimits.add(parsed.exceeded);
        incompleteReasons.add("limit-exceeded");
        diagnostics.add({
          severity: "error",
          code: "json-content-limit-exceeded",
          path: file.path,
          reference: null,
          source: parsed.exceeded,
          message: `JSON content exceeds the applied ${parsed.exceeded} limit.`,
        });
        recordContentValidation({
          path: file.path,
          validated: false,
          valid: false,
          issues: [
            { message: "JSON content exceeded a project validation limit.", keyword: "parse" },
          ],
        });
        continue;
      }
      if ("error" in parsed) {
        diagnostics.add({
          severity: "error",
          code: "invalid-json-content",
          path: file.path,
          reference: null,
          message: parsed.error,
        });
        recordContentValidation({
          path: file.path,
          validated: false,
          valid: false,
          issues: [{ message: parsed.error, keyword: "parse" }],
        });
        continue;
      }
      parsedJsonFiles += 1;
      parsedJsonByPath.set(file.normalizedPath, parsed.json);
      recordContentValidation(
        options.validateContent({ path: file.path, content: parsed.json }),
        elementsByPath.get(file.normalizedPath)?.kind.startsWith("tag/") ?? false,
      );
      continue;
    }
    if (
      file.normalizedPath.endsWith(".mcfunction") &&
      file.contentAvailable &&
      typeof file.content !== "string"
    ) {
      recordContentValidation({
        path: file.path,
        validated: false,
        valid: false,
        issues: [
          {
            message: "Datapack function content must be supplied as UTF-8 text.",
            keyword: "content-kind",
          },
        ],
      });
    }
  }

  const packMetadata = parsedJsonByPath.get("pack.mcmeta");
  const overlays =
    packMetadata && isJsonObject(packMetadata.overlays) ? packMetadata.overlays : null;
  if (overlays && Array.isArray(overlays.entries) && overlays.entries.length > 0) {
    unsupportedReferenceKinds.add("pack-overlays");
    incompleteReasons.add("unsupported-reference-kind");
    diagnostics.add({
      severity: "warning",
      code: "pack-overlays-unverified",
      path: "pack.mcmeta",
      reference: null,
      source: "$.overlays.entries",
      message:
        "Pack overlay roots are present, but this validator does not yet resolve overlay format ranges or inspect their reference graphs.",
    });
  }

  const parsedElements = new Map<string, ParsedElement>();
  let tagFiles = 0;
  let advancementFiles = 0;
  for (const [key, element] of [...elements].sort(([left], [right]) => left.localeCompare(right))) {
    if (!hasSupportedReferenceGraph(element.kind)) {
      unsupportedReferenceKinds.add(element.kind);
    }
    if (!element.file.normalizedPath.endsWith(".json")) {
      continue;
    }
    if (element.kind.startsWith("tag/")) {
      tagFiles += 1;
    } else if (element.kind === "advancement") {
      advancementFiles += 1;
    }
    const json = parsedJsonByPath.get(element.file.normalizedPath);
    if (json) {
      parsedElements.set(key, { ...element, json });
    }
  }

  if (unsupportedReferenceKinds.size > 0) {
    incompleteReasons.add("unsupported-reference-kind");
  }

  const registryEntries = new Set(
    options.registryEntries.map((entry) => `${entry.registryId}\0${entry.entryId}`),
  );
  const registryStatus = new Map(
    options.registries.map((registry) => [registry.id, registry.entryIndexStatus]),
  );
  const tagEdges = new Map<string, Set<string>>();
  const advancementEdges = new Map<string, Set<string>>();
  let graphOperations = 0;
  let graphLimitReported = false;
  const consumeGraphOperation = (): boolean => {
    graphOperations += 1;
    if (graphOperations <= limits.maxGraphOperations) {
      return true;
    }
    exceededLimits.add("maxGraphOperations");
    incompleteReasons.add("limit-exceeded");
    if (!graphLimitReported) {
      graphLimitReported = true;
      diagnostics.add({
        severity: "error",
        code: "graph-operation-limit-exceeded",
        path: "",
        reference: null,
        message: `Datapack reference analysis exceeds the applied ${limits.maxGraphOperations}-operation limit.`,
      });
    }
    return false;
  };

  let checkedReferences = 0;
  let resolvedReferences = 0;
  let missingReferences = 0;
  let optionalMissingReferences = 0;
  let unverifiedReferences = 0;

  const addEdge = (edges: Map<string, Set<string>>, source: string, target: string): void => {
    const targets = edges.get(source) ?? new Set<string>();
    targets.add(target);
    edges.set(source, targets);
  };

  const resolveFileReference = (reference: {
    source: DatapackElement;
    sourceLocation: string;
    value: string;
    kind: FileReferenceKind;
    required: boolean;
    edges?: Map<string, Set<string>>;
  }): void => {
    if (!consumeGraphOperation()) {
      return;
    }
    checkedReferences += 1;
    const parsed = parseResourceLocation(reference.value);
    if (!parsed) {
      missingReferences += 1;
      diagnostics.add({
        severity: "error",
        code: "invalid-resource-location",
        path: reference.source.file.path,
        reference: reference.value,
        source: reference.sourceLocation,
        message: "Datapack references must be valid lowercase resource locations.",
      });
      return;
    }
    const candidatePaths = referenceCandidatePaths(
      reference.kind,
      parsed.id,
      options.directoryLayout,
    );
    const localPath = candidatePaths.find((path) => validFilesByPath.has(path));
    if (localPath) {
      resolvedReferences += 1;
      if (reference.edges) {
        const target = elementsByPath.get(localPath);
        if (target) {
          addEdge(
            reference.edges,
            datapackElementGraphKey(reference.source),
            datapackElementGraphKey(target),
          );
        }
      }
      return;
    }
    if (parsed.namespace === "minecraft" && candidatePaths.some((path) => vanillaPaths.has(path))) {
      resolvedReferences += 1;
      return;
    }
    if (!reference.required) {
      optionalMissingReferences += 1;
      return;
    }
    if (
      !options.assumeLocalNamespacesComplete ||
      (parsed.namespace !== "minecraft" && !localNamespaces.has(parsed.namespace))
    ) {
      unverifiedReferences += 1;
      incompleteReasons.add("external-reference");
      diagnostics.add({
        severity: "warning",
        code: "external-reference-unverified",
        path: reference.source.file.path,
        reference: parsed.id,
        source: reference.sourceLocation,
        message:
          "Reference may be supplied by another pack or mod and cannot be verified from the submitted project alone.",
      });
      return;
    }
    missingReferences += 1;
    diagnostics.add({
      severity: "error",
      code: "missing-datapack-reference",
      path: reference.source.file.path,
      reference: parsed.id,
      source: reference.sourceLocation,
      message: `Required ${reference.kind} reference does not exist in the submitted project or bundled vanilla paths for Java ${options.version}.`,
    });
  };

  const resolveRegistryReference = (reference: {
    source: DatapackElement;
    sourceLocation: string;
    value: string;
    category: string;
    required: boolean;
  }): void => {
    if (!consumeGraphOperation()) {
      return;
    }
    checkedReferences += 1;
    const parsed = parseResourceLocation(reference.value);
    if (!parsed) {
      missingReferences += 1;
      diagnostics.add({
        severity: "error",
        code: "invalid-resource-location",
        path: reference.source.file.path,
        reference: reference.value,
        source: reference.sourceLocation,
        message: "Datapack tag values must be valid lowercase resource locations.",
      });
      return;
    }
    const registryId = `minecraft:${reference.category}`;
    const status = registryStatus.get(registryId);
    if (
      parsed.namespace === "minecraft" &&
      status === "indexed" &&
      options.registryEntryIndexAvailable
    ) {
      if (registryEntries.has(`${registryId}\0${parsed.id}`)) {
        resolvedReferences += 1;
        return;
      } else if (!reference.required) {
        optionalMissingReferences += 1;
        return;
      } else if (options.assumeLocalNamespacesComplete) {
        missingReferences += 1;
        diagnostics.add({
          severity: "error",
          code: "missing-registry-entry",
          path: reference.source.file.path,
          reference: parsed.id,
          source: reference.sourceLocation,
          message: `Required ${registryId} entry is absent from the bundled official registry index for Java ${options.version}.`,
        });
        return;
      }
    }
    const candidatePaths = registryElementCandidatePaths(
      reference.category,
      parsed.id,
      options.directoryLayout,
    );
    if (
      candidatePaths.some((path) => validFilesByPath.has(path)) ||
      (parsed.namespace === "minecraft" && candidatePaths.some((path) => vanillaPaths.has(path)))
    ) {
      resolvedReferences += 1;
      return;
    }
    if (!reference.required) {
      optionalMissingReferences += 1;
      return;
    }
    if (
      parsed.namespace !== "minecraft" &&
      options.assumeLocalNamespacesComplete &&
      localNamespaces.has(parsed.namespace)
    ) {
      missingReferences += 1;
      diagnostics.add({
        severity: "error",
        code: "missing-registry-entry",
        path: reference.source.file.path,
        reference: parsed.id,
        source: reference.sourceLocation,
        message: `Required ${registryId} entry is absent from the submitted project while local namespaces are assumed complete.`,
      });
      return;
    }
    unverifiedReferences += 1;
    const externalDependencyAllowed = !options.assumeLocalNamespacesComplete;
    incompleteReasons.add(
      externalDependencyAllowed || parsed.namespace !== "minecraft"
        ? "external-reference"
        : "registry-index-unavailable",
    );
    diagnostics.add({
      severity: "warning",
      code:
        parsed.namespace === "minecraft" && !externalDependencyAllowed
          ? "registry-entry-unverified"
          : "external-registry-entry-unverified",
      path: reference.source.file.path,
      reference: parsed.id,
      source: reference.sourceLocation,
      message:
        parsed.namespace === "minecraft" && !externalDependencyAllowed
          ? `Bundled Java ${options.version} data does not expose a complete ${registryId} entry index for this value.`
          : "Tag value may be supplied by another pack or mod and cannot be verified from the submitted project.",
    });
  };

  for (const parsed of [...parsedElements.values()].sort((left, right) =>
    left.file.path.localeCompare(right.file.path),
  )) {
    if (graphLimitReported) {
      break;
    }
    if (parsed.kind.startsWith("tag/")) {
      const category = canonicalTagCategory(parsed.kind.slice("tag/".length));
      if (parsed.json.replace !== undefined && typeof parsed.json.replace !== "boolean") {
        invalidContentPaths.add(parsed.file.path);
        diagnostics.add({
          severity: "error",
          code: "invalid-tag-replace",
          path: parsed.file.path,
          reference: parsed.id,
          source: "$.replace",
          message: "Datapack tag replace must be boolean when present.",
        });
      }
      if (!Array.isArray(parsed.json.values)) {
        invalidContentPaths.add(parsed.file.path);
        diagnostics.add({
          severity: "error",
          code: "invalid-tag-values",
          path: parsed.file.path,
          reference: parsed.id,
          source: "$.values",
          message: "Datapack tag JSON must contain a values array.",
        });
        continue;
      }
      for (let index = 0; index < parsed.json.values.length; index += 1) {
        if (!consumeGraphOperation()) {
          break;
        }
        const entry = parsed.json.values[index];
        const objectEntry = isJsonObject(entry) ? entry : null;
        const objectEntryId =
          objectEntry && typeof objectEntry.id === "string" ? objectEntry.id : null;
        const objectEntryRequired = objectEntry?.required;
        const objectEntryValid =
          objectEntryId !== null &&
          (objectEntryRequired === undefined || typeof objectEntryRequired === "boolean");
        const value = typeof entry === "string" ? entry : objectEntryValid ? objectEntryId : null;
        const required = typeof objectEntryRequired === "boolean" ? objectEntryRequired : true;
        const sourceLocation = `$.values[${index}]`;
        if (value === null) {
          invalidContentPaths.add(parsed.file.path);
          diagnostics.add({
            severity: "error",
            code: "invalid-tag-entry",
            path: parsed.file.path,
            reference: null,
            source: sourceLocation,
            message:
              "Tag entries must be resource-location strings or objects with string id and optional boolean required.",
          });
          continue;
        }
        if (value.startsWith("#")) {
          resolveFileReference({
            source: parsed,
            sourceLocation,
            value: value.slice(1),
            kind: `tag/${category}`,
            required,
            edges: tagEdges,
          });
        } else if (category === "function") {
          resolveFileReference({
            source: parsed,
            sourceLocation,
            value,
            kind: "function",
            required,
          });
        } else {
          resolveRegistryReference({
            source: parsed,
            sourceLocation,
            value,
            category,
            required,
          });
        }
      }
      continue;
    }
    if (parsed.kind === "advancement") {
      if (parsed.json.parent !== undefined) {
        if (typeof parsed.json.parent !== "string") {
          invalidContentPaths.add(parsed.file.path);
          diagnostics.add({
            severity: "error",
            code: "invalid-advancement-parent",
            path: parsed.file.path,
            reference: null,
            source: "$.parent",
            message: "Advancement parent must be a resource-location string when present.",
          });
        } else {
          resolveFileReference({
            source: parsed,
            sourceLocation: "$.parent",
            value: parsed.json.parent,
            kind: "advancement",
            required: true,
            edges: advancementEdges,
          });
        }
      }
      const rewards = isJsonObject(parsed.json.rewards) ? parsed.json.rewards : null;
      if (rewards) {
        const rewardReferenceFields = ["function", "loot", "recipes"].filter((field) =>
          Object.hasOwn(rewards, field),
        );
        if (rewardReferenceFields.length > 0) {
          unsupportedReferenceKinds.add("advancement-rewards");
          incompleteReasons.add("unsupported-reference-kind");
        }
      }
    }
  }

  let functionFiles = 0;
  let inspectedFunctionFiles = 0;
  let functionLines = 0;
  for (const element of [...elements.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (element.kind !== "function") {
      continue;
    }
    functionFiles += 1;
    if (typeof element.file.content !== "string" || !element.file.contentAvailable) {
      incompleteReasons.add("content-unavailable");
      diagnostics.add({
        severity: "warning",
        code: "function-content-unavailable",
        path: element.file.path,
        reference: element.id,
        message:
          "Function text was not supplied, so function and function-tag calls could not be inspected.",
      });
      continue;
    }
    inspectedFunctionFiles += 1;
    const lines = element.file.content.split(/\r\n?|\n/);
    for (let index = 0; index < lines.length; index += 1) {
      functionLines += 1;
      if (functionLines > limits.maxFunctionLines) {
        exceededLimits.add("maxFunctionLines");
        incompleteReasons.add("limit-exceeded");
        diagnostics.add({
          severity: "error",
          code: "function-line-limit-exceeded",
          path: element.file.path,
          reference: element.id,
          source: `line ${index + 1}`,
          message: `Function inspection exceeds the applied ${limits.maxFunctionLines}-line aggregate limit.`,
        });
        break;
      }
      const line = lines[index]?.trim() ?? "";
      if (!line || line.startsWith("#")) {
        continue;
      }
      const macroLine = line.startsWith("$");
      const command = macroLine ? line.slice(1) : line;
      if (macroLine && hasDynamicCommandMacro(command)) {
        incompleteReasons.add("dynamic-reference");
        unverifiedReferences += 1;
        diagnostics.add({
          severity: "warning",
          code: "dynamic-function-reference-unverified",
          path: element.file.path,
          reference: null,
          source: `line ${index + 1}`,
          message: "Macro-expanded function references cannot be resolved statically.",
        });
      }
      const references = literalFunctionCommandReferences(command, options.commandRoots);
      for (const reference of references) {
        resolveFileReference({
          source: element,
          sourceLocation: `line ${index + 1}`,
          value: reference.startsWith("#") ? reference.slice(1) : reference,
          kind: reference.startsWith("#") ? "tag/function" : "function",
          required: true,
        });
      }
    }
    if (functionLines > limits.maxFunctionLines || graphLimitReported) {
      break;
    }
  }

  const tagCycleElements = new Map<string, DatapackElement>();
  const advancementCycleElements = new Map<string, DatapackElement>();
  for (const element of elements.values()) {
    if (element.kind.startsWith("tag/")) {
      tagCycleElements.set(datapackElementGraphKey(element), element);
    } else if (element.kind === "advancement") {
      advancementCycleElements.set(datapackElementGraphKey(element), element);
    }
  }
  let detectedCycles = collectCycles({
    edges: tagEdges,
    elements: tagCycleElements,
    consume: consumeGraphOperation,
    report(source, reference) {
      diagnostics.add({
        severity: "error",
        code: "tag-reference-cycle",
        path: source.file.path,
        reference,
        message: "Local datapack tag references contain a cycle.",
      });
    },
  });
  detectedCycles += collectCycles({
    edges: advancementEdges,
    elements: advancementCycleElements,
    consume: consumeGraphOperation,
    report(source, reference) {
      diagnostics.add({
        severity: "error",
        code: "advancement-parent-cycle",
        path: source.file.path,
        reference,
        message: "Local advancement parent references contain a cycle.",
      });
    },
  });

  const finished = diagnostics.finish();
  const omittedDiagnosticCount = Math.max(
    0,
    finished.diagnosticTotal - finished.diagnostics.length,
  );
  const validatedContentFiles = contentValidations.filter(
    (validation) => validation.validated,
  ).length;
  const invalidContentFiles = invalidContentPaths.size;
  const unsupported = [...unsupportedReferenceKinds].sort();
  return {
    schemaVersion: 1,
    edition: "java",
    version: options.version,
    valid: finished.errorCount === 0,
    totalFiles,
    processedFiles: projectFiles.length,
    validationComplete: incompleteReasons.size === 0,
    validationIncompleteReasons: [...incompleteReasons].sort(),
    appliedLimits: { ...limits, maxDiagnostics: options.limit },
    exceededLimits: [...exceededLimits].sort(),
    packMetadataFiles,
    jsonFiles: projectFiles.filter(
      (file) => file.normalizedPath.endsWith(".json") || file.normalizedPath === "pack.mcmeta",
    ).length,
    parsedJsonFiles,
    functionFiles,
    inspectedFunctionFiles,
    tagFiles,
    advancementFiles,
    validatedContentFiles,
    invalidContentFiles,
    checkedReferences,
    resolvedReferences,
    missingReferences,
    optionalMissingReferences,
    unverifiedReferences,
    detectedCycles,
    unsupportedReferenceKinds: unsupported,
    errorCount: finished.errorCount,
    warningCount: finished.warningCount,
    diagnosticTotal: finished.diagnosticTotal,
    retainedDiagnosticCount: finished.diagnostics.length,
    omittedDiagnosticCount,
    truncated: omittedDiagnosticCount > 0 || exceededLimits.size > 0,
    diagnostics: finished.diagnostics,
    notes: [
      `Function, function-tag, tag-to-tag, direct tag-entry, and advancement-parent references were checked against the submitted project and bundled Java ${options.version} vanilla evidence where available.`,
      options.assumeLocalNamespacesComplete
        ? "Tag entries with required=false are allowed to be absent; unresolved references in submitted namespaces are errors because assumeLocalNamespacesComplete was enabled."
        : "Tag entries with required=false are allowed to be absent; unresolved references remain warnings because other packs or mods can merge the same namespace.",
      "JSON files without version-compatible schema or supported graph-parser coverage remain valid-but-unverified completeness gaps.",
      "Function inspection resolves literal function targets in recognized command positions; macro-expanded targets are reported as unverified.",
      "Pack overlay format ranges and overlay-root reference graphs are reported as unsupported rather than treated as part of the root datapack.",
      "Only function calls, tag entries, and advancement parents have dedicated graph parsers; every other recognized datapack resource kind is surfaced through unsupportedReferenceKinds until its semantic references are covered.",
      "NBT structure payload semantics and general command behavior are outside this validation surface.",
    ],
  };
}
