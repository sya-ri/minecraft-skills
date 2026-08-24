import { validateResourcepackSounds, vorbisIdentificationPageBytes } from "./resourcepackSound.js";

export type ResourcepackProjectFile = {
  path: string;
  content?: unknown;
};

export type ResourcepackProjectDiagnosticSeverity = "error" | "warning";

export type ResourcepackProjectDiagnostic = {
  severity: ResourcepackProjectDiagnosticSeverity;
  code: string;
  path: string;
  reference: string | null;
  source?: string;
  message: string;
};

export type ResourcepackProjectValidationLimits = {
  maxFiles: number;
  maxPathLength: number;
  maxTextContentCharacters: number;
  maxContentNodes: number;
  maxContentDepth: number;
  maxBinaryContentBytes: number;
  maxSoundHeaderBytes: number;
  maxSoundEvents: number;
  maxSoundEntries: number;
  maxModelGraphOperations: number;
  maxDiagnosticTextLength: number;
};

export type ResourcepackProjectValidationLimitName = keyof ResourcepackProjectValidationLimits;

export type ResourcepackSoundValidationIncompleteReason =
  | "definition-content-unavailable"
  | "sound-header-unavailable"
  | "reference-unverified"
  | "limit-exceeded";

export const defaultResourcepackProjectValidationLimits: Readonly<ResourcepackProjectValidationLimits> =
  Object.freeze({
    maxFiles: 25_000,
    maxPathLength: 4_096,
    maxTextContentCharacters: 16 * 1_024 * 1_024,
    maxContentNodes: 250_000,
    maxContentDepth: 128,
    maxBinaryContentBytes: 25_000 * vorbisIdentificationPageBytes,
    maxSoundHeaderBytes: vorbisIdentificationPageBytes,
    maxSoundEvents: 50_000,
    maxSoundEntries: 100_000,
    maxModelGraphOperations: 250_000,
    maxDiagnosticTextLength: 2_048,
  });

export type ResourcepackProjectValidationOptions = {
  files: ResourcepackProjectFile[];
  edition?: string;
  version?: string;
  limit?: number;
  limits?: Partial<ResourcepackProjectValidationLimits>;
};

export type ResourcepackProjectValidationResult = {
  schemaVersion: 1;
  edition: "java";
  version: string;
  valid: boolean;
  totalFiles: number;
  processedFiles: number;
  validationComplete: boolean;
  appliedLimits: ResourcepackProjectValidationLimits & { maxDiagnostics: number };
  exceededLimits: ResourcepackProjectValidationLimitName[];
  modelFiles: number;
  itemDefinitionFiles: number;
  soundDefinitionFiles: number;
  soundEvents: number;
  soundFileReferences: number;
  soundEventReferences: number;
  soundFiles: number;
  inspectedSoundFiles: number;
  soundValidationComplete: boolean;
  soundValidationIncompleteReasons: ResourcepackSoundValidationIncompleteReason[];
  binaryFiles: number;
  parsedJsonFiles: number;
  checkedReferences: number;
  errorCount: number;
  warningCount: number;
  diagnosticTotal: number;
  retainedDiagnosticCount: number;
  omittedDiagnosticCount: number;
  truncated: boolean;
  diagnostics: ResourcepackProjectDiagnostic[];
  notes: string[];
};

type ResolvedValidationOptions = {
  files: ResourcepackProjectFile[];
  version: string;
  vanillaPaths: readonly string[];
  limit: number;
  limits: ResourcepackProjectValidationLimits;
};

type ProjectFile = ResourcepackProjectFile & {
  normalizedPath: string;
  validPath: boolean;
  validAssetPath: boolean;
};

type JsonObject = Record<string, unknown>;

type ParsedModel = {
  id: string;
  file: ProjectFile;
  json: JsonObject;
  parent: string | null;
};

type TextureVariableResolution =
  | { status: "resolved"; reference: string }
  | { status: "missing" | "unknown" | "cycle" | "invalid"; reference: string };

type ModelTextureUsage = {
  textureEntries: Array<{ key: string; reference: string }>;
  references: Array<{ reference: string; variable: string | null }>;
};

const resourceLocationPattern = /^([a-z0-9_.-]+):([a-z0-9/._-]+)$/;
const builtInModelReferences = new Set(["builtin/entity", "builtin/generated"]);
const graphAssetCategories = new Set(["items", "models", "sounds", "textures"]);

function boundedDiagnosticValue(value: string, maxLength: number): string {
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

export function resolveResourcepackProjectValidationLimits(
  limits: Partial<ResourcepackProjectValidationLimits> | undefined,
): ResourcepackProjectValidationLimits {
  const resolve = (name: ResourcepackProjectValidationLimitName): number => {
    const fallback = defaultResourcepackProjectValidationLimits[name];
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
    maxBinaryContentBytes: resolve("maxBinaryContentBytes"),
    maxSoundHeaderBytes: resolve("maxSoundHeaderBytes"),
    maxSoundEvents: resolve("maxSoundEvents"),
    maxSoundEntries: resolve("maxSoundEntries"),
    maxModelGraphOperations: resolve("maxModelGraphOperations"),
    maxDiagnosticTextLength: resolve("maxDiagnosticTextLength"),
  };
}

type DiagnosticCollector = {
  add: (diagnostic: ResourcepackProjectDiagnostic & { readonly dedupeIdentity?: string }) => void;
  finish: () => {
    diagnostics: ResourcepackProjectDiagnostic[];
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
  const retainedErrors: ResourcepackProjectDiagnostic[] = [];
  const retainedWarnings: ResourcepackProjectDiagnostic[] = [];
  const boundedTextCache = new Map<string, string>();
  const rawTextIds = new Map<string, number>();
  let nextRawTextId = 0;
  let errorCount = 0;
  let warningCount = 0;

  const bounded = (value: string): string => {
    if (value.length <= options.maxTextLength) {
      return value;
    }
    const cached = boundedTextCache.get(value);
    if (cached !== undefined) {
      return cached;
    }
    const result = boundedDiagnosticValue(value, options.maxTextLength);
    boundedTextCache.set(value, result);
    return result;
  };
  const rawTextId = (value: string): number => {
    const existing = rawTextIds.get(value);
    if (existing !== undefined) {
      return existing;
    }
    const id = nextRawTextId;
    nextRawTextId += 1;
    rawTextIds.set(value, id);
    return id;
  };
  const compare = (
    left: ResourcepackProjectDiagnostic,
    right: ResourcepackProjectDiagnostic,
  ): number =>
    left.severity.localeCompare(right.severity) ||
    left.path.localeCompare(right.path) ||
    left.code.localeCompare(right.code) ||
    (left.source ?? "").localeCompare(right.source ?? "") ||
    (left.reference ?? "").localeCompare(right.reference ?? "");
  const retainSmallest = (
    heap: ResourcepackProjectDiagnostic[],
    diagnostic: ResourcepackProjectDiagnostic,
  ): void => {
    if (heap.length < options.limit) {
      heap.push(diagnostic);
      let index = heap.length - 1;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        const parentValue = heap[parent];
        const value = heap[index];
        if (!parentValue || !value || compare(parentValue, value) >= 0) {
          break;
        }
        heap[parent] = value;
        heap[index] = parentValue;
        index = parent;
      }
      return;
    }
    const largestRetained = heap[0];
    if (!largestRetained || compare(diagnostic, largestRetained) >= 0) {
      return;
    }
    heap[0] = diagnostic;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let largest = index;
      const leftValue = heap[left];
      const currentLargest = heap[largest];
      if (leftValue && currentLargest && compare(leftValue, currentLargest) > 0) {
        largest = left;
      }
      const rightValue = heap[right];
      const updatedLargest = heap[largest];
      if (rightValue && updatedLargest && compare(rightValue, updatedLargest) > 0) {
        largest = right;
      }
      if (largest === index) {
        break;
      }
      const value = heap[index];
      const child = heap[largest];
      if (!value || !child) {
        break;
      }
      heap[index] = child;
      heap[largest] = value;
      index = largest;
    }
  };

  return {
    add: (diagnostic) => {
      const normalized: ResourcepackProjectDiagnostic = {
        severity: diagnostic.severity,
        // Codes are fixed validator-owned identifiers rather than request text and remain stable even
        // when callers lower the diagnostic text limit.
        code: diagnostic.code,
        path: bounded(diagnostic.path),
        reference: diagnostic.reference === null ? null : bounded(diagnostic.reference),
        ...(diagnostic.source === undefined ? {} : { source: bounded(diagnostic.source) }),
        message: bounded(diagnostic.message),
      };
      // This identifier is generated internally from bounded numeric occurrence indexes. It keeps
      // separately-originating diagnostics distinct without retaining their displayed text in the
      // dedupe set, even when callers lower the text cap enough that display strings collide.
      const dedupeIdentity = diagnostic.dedupeIdentity;
      const key = dedupeIdentity
        ? [normalized.severity, normalized.code, "occurrence", dedupeIdentity].join("\0")
        : [
            diagnostic.severity === "error" ? 0 : 1,
            rawTextId(diagnostic.code),
            rawTextId(diagnostic.path),
            diagnostic.source === undefined ? -1 : rawTextId(diagnostic.source),
            diagnostic.reference === null ? -1 : rawTextId(diagnostic.reference),
          ].join(":");
      if (keys.has(key)) {
        return;
      }
      keys.add(key);
      if (normalized.severity === "error") {
        errorCount += 1;
        retainSmallest(retainedErrors, normalized);
      } else {
        warningCount += 1;
        retainSmallest(retainedWarnings, normalized);
      }
    },
    finish: () => {
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

function inspectRequestLimits(
  files: readonly ResourcepackProjectFile[],
  limits: ResourcepackProjectValidationLimits,
): ResourcepackProjectValidationLimitName[] {
  const exceeded = new Set<ResourcepackProjectValidationLimitName>();
  if (files.length > limits.maxFiles) {
    exceeded.add("maxFiles");
    return [...exceeded];
  }

  let textCharacters = 0;
  let contentNodes = 0;
  let binaryBytes = 0;
  const visitedObjects = new WeakSet<object>();
  const inspectContent = (content: unknown, countText: boolean): void => {
    const stack: Array<{ depth: number; value: unknown }> = [{ depth: 1, value: content }];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      contentNodes += 1;
      if (contentNodes > limits.maxContentNodes) {
        exceeded.add("maxContentNodes");
        return;
      }
      if (current.depth > limits.maxContentDepth) {
        exceeded.add("maxContentDepth");
        return;
      }
      if (typeof current.value === "string") {
        if (countText) {
          textCharacters += current.value.length;
          if (textCharacters > limits.maxTextContentCharacters) {
            exceeded.add("maxTextContentCharacters");
            return;
          }
        }
        continue;
      }
      if (current.value instanceof Uint8Array) {
        binaryBytes += current.value.byteLength;
        if (binaryBytes > limits.maxBinaryContentBytes) {
          exceeded.add("maxBinaryContentBytes");
          return;
        }
        continue;
      }
      if (typeof current.value !== "object" || current.value === null) {
        continue;
      }
      if (visitedObjects.has(current.value)) {
        exceeded.add("maxContentNodes");
        return;
      }
      visitedObjects.add(current.value);
      if (Array.isArray(current.value)) {
        for (let index = 0; index < current.value.length; index += 1) {
          if (contentNodes + stack.length >= limits.maxContentNodes) {
            exceeded.add("maxContentNodes");
            return;
          }
          const descriptor = Object.getOwnPropertyDescriptor(current.value, index);
          stack.push({
            depth: current.depth + 1,
            value: descriptor && "value" in descriptor ? descriptor.value : undefined,
          });
        }
        continue;
      }
      for (const key in current.value) {
        if (!Object.hasOwn(current.value, key)) {
          continue;
        }
        if (countText) {
          textCharacters += key.length;
          if (textCharacters > limits.maxTextContentCharacters) {
            exceeded.add("maxTextContentCharacters");
            return;
          }
        }
        const descriptor = Object.getOwnPropertyDescriptor(current.value, key);
        if (!descriptor || !("value" in descriptor)) {
          continue;
        }
        if (contentNodes + stack.length >= limits.maxContentNodes) {
          exceeded.add("maxContentNodes");
          return;
        }
        stack.push({ depth: current.depth + 1, value: descriptor.value });
      }
    }
  };

  for (const file of files) {
    if (file.path.length > limits.maxPathLength) {
      exceeded.add("maxPathLength");
    }
    if (
      file.path.toLowerCase().endsWith(".ogg") &&
      file.content instanceof Uint8Array &&
      file.content.byteLength > limits.maxSoundHeaderBytes
    ) {
      exceeded.add("maxSoundHeaderBytes");
    }
    if (file.content !== undefined) {
      inspectContent(file.content, true);
      if (typeof file.content === "string" && file.path.toLowerCase().endsWith(".json")) {
        try {
          inspectContent(JSON.parse(file.content) as unknown, false);
        } catch {
          // Invalid JSON is reported by the normal project validator; only successfully parsed
          // structures need the additional iterative node/depth budget check.
        }
      }
    }
  }
  return [...exceeded].sort();
}

function resourcepackValidationNotes(version: string): string[] {
  return [
    `Processed vanilla model and texture references were checked against the bundled Java ${version} resource-pack path index; sounds.json event and file references outside the submitted project are not bundled and remain unverified.`,
    "PNG files were indexed by path without decoding; OGG files were inspected only through their bounded 58-byte Ogg/Vorbis identification page.",
    "Full audio decoding, duration, loudness, and Vorbis comment, setup, and audio packet validation are outside this validation surface.",
    "Stereo audio is accepted with a positional-attenuation warning; channel counts above two are rejected because Minecraft's OpenAL upload path supports only mono and stereo buffers.",
    "Texture variables inherited only from a vanilla parent produce warnings because vanilla model contents are not bundled in this validation surface.",
  ];
}

function normalizeProjectPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

function validProjectPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    return false;
  }
  if (/\p{Cc}/u.test(normalized)) {
    return false;
  }
  return normalized.split("/").every((segment) => segment !== "." && segment !== "..");
}

function validGraphAssetPath(path: string): boolean {
  const rootAsset = /^assets\/([^/]+)\/([^/]+)$/.exec(path);
  if (rootAsset?.[1] && rootAsset[2]?.toLowerCase() === "sounds.json") {
    return rootAsset[2] === "sounds.json" && /^[a-z0-9_.-]+$/.test(rootAsset[1]);
  }
  const matched = /^assets\/([^/]+)\/([^/]+)\/(.+)$/.exec(path);
  if (!matched?.[1] || !matched[2] || !matched[3]) {
    return true;
  }
  const category = matched[2];
  if (!graphAssetCategories.has(category.toLowerCase())) {
    return true;
  }
  const namespace = matched[1];
  if (
    category !== category.toLowerCase() ||
    namespace === "." ||
    namespace === ".." ||
    !/^[a-z0-9_.-]+$/.test(namespace)
  ) {
    return false;
  }
  return matched[3]
    .split("/")
    .every(
      (segment) =>
        segment.length > 0 && segment !== "." && segment !== ".." && /^[a-z0-9._-]+$/.test(segment),
    );
}

function isJsonObject(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function resourceLocation(reference: string): { namespace: string; path: string } | null {
  const value = reference.trim();
  if (value !== reference) {
    return null;
  }
  const qualified = value.includes(":") ? value : `minecraft:${value}`;
  const matched = resourceLocationPattern.exec(qualified);
  if (!matched?.[1] || !matched[2]) {
    return null;
  }
  if (matched[1] === "." || matched[1] === "..") {
    return null;
  }
  const pathSegments = matched[2].split("/");
  if (pathSegments.some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }
  return { namespace: matched[1], path: matched[2] };
}

function modelAssetPath(reference: string): string | null {
  const location = resourceLocation(reference);
  return location ? `assets/${location.namespace}/models/${location.path}.json` : null;
}

function textureAssetPath(reference: string): string | null {
  const location = resourceLocation(reference);
  return location ? `assets/${location.namespace}/textures/${location.path}.png` : null;
}

function modelIdFromPath(path: string): string | null {
  const matched = /^assets\/([^/]+)\/models\/(.+)\.json$/.exec(path);
  return matched?.[1] && matched[2] ? `${matched[1]}:${matched[2]}` : null;
}

function itemDefinitionPath(path: string): boolean {
  return /^assets\/[^/]+\/items\/.+\.json$/.test(path);
}

function binaryAssetPath(path: string): boolean {
  return /\.(?:png|ogg)$/i.test(path);
}

function parseProjectJson(
  file: ProjectFile,
): { json: JsonObject } | { error: string } | { unavailable: true } {
  if (typeof file.content === "string") {
    try {
      const parsed = JSON.parse(file.content) as unknown;
      return isJsonObject(parsed)
        ? { json: parsed }
        : { error: "Resource-pack JSON must contain an object at the document root." };
    } catch (error) {
      return {
        error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  if (isJsonObject(file.content)) {
    return { json: file.content };
  }
  return { unavailable: true };
}

function collectItemModelReferences(
  value: unknown,
  references: string[],
  visited: Set<object>,
): void {
  const pending = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null || visited.has(current)) {
      continue;
    }
    if (!Array.isArray(current) && !isJsonObject(current)) {
      continue;
    }
    visited.add(current);
    if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index -= 1) {
        const descriptor = Object.getOwnPropertyDescriptor(current, index);
        if (descriptor && "value" in descriptor) {
          pending.push(descriptor.value);
        }
      }
      continue;
    }
    const type = typeof current.type === "string" ? current.type : null;
    if ((type === "minecraft:model" || type === "model") && typeof current.model === "string") {
      references.push(current.model);
    }
    if ((type === "minecraft:special" || type === "special") && typeof current.base === "string") {
      references.push(current.base);
    }
    const keys = Object.keys(current).sort();
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      if (key !== undefined) {
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (descriptor && "value" in descriptor) {
          pending.push(descriptor.value);
        }
      }
    }
  }
}

function collectLegacyOverrideModelReferences(model: JsonObject): string[] {
  if (!Array.isArray(model.overrides)) {
    return [];
  }
  return model.overrides
    .filter(isJsonObject)
    .map((override) => override.model)
    .filter((reference): reference is string => typeof reference === "string")
    .sort();
}

function localParentChain(options: {
  root: ParsedModel;
  modelsByPath: ReadonlyMap<string, ParsedModel>;
  consume: () => boolean;
}): ParsedModel[] | null {
  const chain: ParsedModel[] = [];
  const visited = new Set<string>();
  let current: ParsedModel | undefined = options.root;
  while (current && !visited.has(current.file.normalizedPath)) {
    if (!options.consume()) {
      return null;
    }
    visited.add(current.file.normalizedPath);
    chain.push(current);
    const parentPath: string | null = current.parent ? modelAssetPath(current.parent) : null;
    current = parentPath ? options.modelsByPath.get(parentPath) : undefined;
  }
  return chain;
}

function collectModelTextureUsage(options: {
  model: ParsedModel;
  consume: () => boolean;
}): ModelTextureUsage | null {
  const textureKeys: string[] = [];
  const textures = isJsonObject(options.model.json.textures) ? options.model.json.textures : null;
  if (textures) {
    for (const key in textures) {
      if (!Object.hasOwn(textures, key)) {
        continue;
      }
      if (!options.consume()) {
        return null;
      }
      textureKeys.push(key);
    }
  }

  const references: string[] = [];
  const visited = new Set<object>();
  const pending: unknown[] = [options.model.json];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null || visited.has(current)) {
      continue;
    }
    if (!Array.isArray(current) && !isJsonObject(current)) {
      continue;
    }
    visited.add(current);
    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) {
        if (!options.consume()) {
          return null;
        }
        const descriptor = Object.getOwnPropertyDescriptor(current, index);
        if (descriptor && "value" in descriptor) {
          pending.push(descriptor.value);
        }
      }
      continue;
    }
    for (const key in current) {
      if (!Object.hasOwn(current, key)) {
        continue;
      }
      if (!options.consume()) {
        return null;
      }
      if (key === "textures") {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || !("value" in descriptor)) {
        continue;
      }
      if (key === "texture" && typeof descriptor.value === "string") {
        references.push(descriptor.value);
      }
      pending.push(descriptor.value);
    }
  }
  textureKeys.sort();
  references.sort();
  return {
    textureEntries: textureKeys.map((key) => ({ key, reference: `#${key}` })),
    references: references.map((reference) => ({
      reference,
      variable: reference.startsWith("#") ? reference.slice(1) : null,
    })),
  };
}

function resolveTextureVariable(options: {
  variable: string;
  textureValues: ReadonlyMap<string, unknown>;
  missingStatus: "missing" | "unknown";
  cache: Map<string, TextureVariableResolution>;
  consume: () => boolean;
  variableReference: (variable: string) => string;
  validResourceLocation: (reference: string) => boolean;
}): TextureVariableResolution | null {
  const path: string[] = [];
  const pathIndexes = new Map<string, number>();
  let variable = options.variable;
  let resolution: TextureVariableResolution;
  while (true) {
    if (!options.consume()) {
      return null;
    }
    const cached = options.cache.get(variable);
    if (cached) {
      resolution = cached;
      break;
    }
    const cycleStart = pathIndexes.get(variable);
    if (cycleStart !== undefined) {
      let first = path[cycleStart] ?? variable;
      for (let index = cycleStart + 1; index < path.length; index += 1) {
        const candidate = path[index];
        if (candidate && candidate < first) {
          first = candidate;
        }
      }
      resolution = { status: "cycle", reference: options.variableReference(first) };
      break;
    }
    pathIndexes.set(variable, path.length);
    path.push(variable);
    if (!options.textureValues.has(variable)) {
      resolution = {
        status: options.missingStatus,
        reference: options.variableReference(variable),
      };
      break;
    }
    const value = options.textureValues.get(variable);
    if (typeof value !== "string") {
      resolution = { status: "invalid", reference: options.variableReference(variable) };
      break;
    }
    if (!value.startsWith("#")) {
      resolution = options.validResourceLocation(value)
        ? { status: "resolved", reference: value }
        : { status: "invalid", reference: value };
      break;
    }
    variable = value.slice(1);
  }
  for (const entry of path) {
    options.cache.set(entry, resolution);
  }
  return resolution;
}

function canonicalCycle(cycle: string[]): string[] {
  if (cycle.length < 2) {
    return cycle;
  }
  let firstIndex = 0;
  for (let index = 1; index < cycle.length; index += 1) {
    if ((cycle[index] ?? "") < (cycle[firstIndex] ?? "")) {
      firstIndex = index;
    }
  }
  return [...cycle.slice(firstIndex), ...cycle.slice(0, firstIndex)];
}

export function validateResourcepackReferenceGraph(
  options: ResolvedValidationOptions,
): ResourcepackProjectValidationResult {
  const collector = createDiagnosticCollector({
    limit: options.limit,
    maxTextLength: options.limits.maxDiagnosticTextLength,
  });
  const addDiagnostic = collector.add;
  const boundedDiagnosticValueCache = new Map<string, string>();
  const textureVariableReferenceCache = new Map<string, string>();
  const textureAssetPathCache = new Map<string, string | null>();
  const resourceLocationValidityCache = new Map<string, boolean>();
  const diagnosticValue = (value: string): string => {
    if (value.length <= options.limits.maxDiagnosticTextLength) {
      return value;
    }
    const cached = boundedDiagnosticValueCache.get(value);
    if (cached !== undefined) {
      return cached;
    }
    const bounded = boundedDiagnosticValue(value, options.limits.maxDiagnosticTextLength);
    boundedDiagnosticValueCache.set(value, bounded);
    return bounded;
  };
  const textureVariableReference = (variable: string): string => {
    const cached = textureVariableReferenceCache.get(variable);
    if (cached !== undefined) {
      return cached;
    }
    const reference = `#${variable}`;
    textureVariableReferenceCache.set(variable, reference);
    return reference;
  };
  const cachedTextureAssetPath = (reference: string): string | null => {
    if (textureAssetPathCache.has(reference)) {
      return textureAssetPathCache.get(reference) ?? null;
    }
    const path = textureAssetPath(reference);
    textureAssetPathCache.set(reference, path);
    return path;
  };
  const validResourceLocation = (reference: string): boolean => {
    const cached = resourceLocationValidityCache.get(reference);
    if (cached !== undefined) {
      return cached;
    }
    const valid = resourceLocation(reference) !== null;
    resourceLocationValidityCache.set(reference, valid);
    return valid;
  };
  const requestExceededLimits = inspectRequestLimits(options.files, options.limits);
  if (requestExceededLimits.length > 0) {
    for (const name of requestExceededLimits) {
      addDiagnostic({
        severity: "error",
        code: "resourcepack-validation-limit-exceeded",
        path: "",
        reference: name,
        source: "request",
        message: `Resource-pack project validation stopped before processing because '${name}' exceeded its applied limit of ${options.limits[name]}.`,
      });
    }
    const summary = collector.finish();
    return {
      schemaVersion: 1,
      edition: "java",
      version: options.version,
      valid: false,
      totalFiles: options.files.length,
      processedFiles: 0,
      validationComplete: false,
      appliedLimits: { ...options.limits, maxDiagnostics: options.limit },
      exceededLimits: requestExceededLimits,
      modelFiles: 0,
      itemDefinitionFiles: 0,
      soundDefinitionFiles: 0,
      soundEvents: 0,
      soundFileReferences: 0,
      soundEventReferences: 0,
      soundFiles: 0,
      inspectedSoundFiles: 0,
      soundValidationComplete: false,
      soundValidationIncompleteReasons: ["limit-exceeded"],
      binaryFiles: 0,
      parsedJsonFiles: 0,
      checkedReferences: 0,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      diagnosticTotal: summary.diagnosticTotal,
      retainedDiagnosticCount: summary.diagnostics.length,
      omittedDiagnosticCount: summary.diagnosticTotal - summary.diagnostics.length,
      truncated: summary.diagnosticTotal > summary.diagnostics.length,
      diagnostics: summary.diagnostics,
      notes: resourcepackValidationNotes(options.version),
    };
  }

  const projectFiles = options.files
    .map((file) => {
      const normalizedPath = normalizeProjectPath(file.path);
      return {
        ...file,
        normalizedPath,
        validPath: validProjectPath(file.path),
        validAssetPath: validGraphAssetPath(normalizedPath),
      };
    })
    .sort((left, right) => left.normalizedPath.localeCompare(right.normalizedPath));
  const localPaths = new Set(
    projectFiles
      .filter((file) => file.validPath && file.validAssetPath)
      .map((file) => file.normalizedPath),
  );
  const vanillaPaths = new Set(options.vanillaPaths);
  let parsedJsonFiles = 0;
  let checkedReferences = 0;
  let validationComplete = true;
  let modelGraphOperations = 0;
  let modelGraphLimitReached = false;
  const processingExceededLimits = new Set<ResourcepackProjectValidationLimitName>();
  const consumeModelGraphOperations = (count: number, path: string): boolean => {
    if (modelGraphOperations + count <= options.limits.maxModelGraphOperations) {
      modelGraphOperations += count;
      return true;
    }
    modelGraphLimitReached = true;
    validationComplete = false;
    if (!processingExceededLimits.has("maxModelGraphOperations")) {
      processingExceededLimits.add("maxModelGraphOperations");
      addDiagnostic({
        severity: "error",
        code: "resourcepack-validation-limit-exceeded",
        path,
        reference: "maxModelGraphOperations",
        source: "model-graph",
        message: `Model validation stopped after reaching its applied graph-work limit of ${options.limits.maxModelGraphOperations} operations.`,
      });
    }
    return false;
  };

  const duplicatePaths = new Set<string>();
  for (const file of projectFiles) {
    if (!file.validPath) {
      addDiagnostic({
        severity: "error",
        code: "invalid-project-path",
        path: file.normalizedPath || file.path,
        reference: file.path,
        message:
          "Resource-pack file paths must be relative and must not contain '.' or '..' segments, drive prefixes, or control characters.",
      });
    }
    if (file.validPath && !file.validAssetPath) {
      addDiagnostic({
        severity: "error",
        code: "invalid-resource-path",
        path: file.normalizedPath,
        reference: file.path,
        message:
          "Resource-pack item, model, sound, and texture asset paths must use lowercase resource-location-safe namespaces and path segments.",
      });
    }
  }
  for (let index = 1; index < projectFiles.length; index += 1) {
    if (
      projectFiles[index]?.validPath &&
      projectFiles[index - 1]?.validPath &&
      projectFiles[index]?.validAssetPath &&
      projectFiles[index - 1]?.validAssetPath &&
      projectFiles[index]?.normalizedPath === projectFiles[index - 1]?.normalizedPath
    ) {
      duplicatePaths.add(projectFiles[index]?.normalizedPath ?? "");
    }
  }
  for (const path of [...duplicatePaths].sort()) {
    addDiagnostic({
      severity: "error",
      code: "duplicate-file-path",
      path,
      reference: path,
      message: "The project contains the same normalized resource-pack path more than once.",
    });
  }

  const modelsByPath = new Map<string, ParsedModel>();
  const itemDefinitions: Array<{ file: ProjectFile; json: JsonObject }> = [];
  for (const file of projectFiles) {
    if (!file.validPath || !file.validAssetPath) {
      continue;
    }
    const modelId = modelIdFromPath(file.normalizedPath);
    if (!modelId && !itemDefinitionPath(file.normalizedPath)) {
      continue;
    }
    const parsed = parseProjectJson(file);
    if ("error" in parsed) {
      addDiagnostic({
        severity: "error",
        code: "invalid-json",
        path: file.normalizedPath,
        reference: null,
        message: parsed.error,
      });
      continue;
    }
    if ("unavailable" in parsed) {
      validationComplete = false;
      addDiagnostic({
        severity: "error",
        code: "json-content-unavailable",
        path: file.normalizedPath,
        reference: null,
        message: "JSON content is required to validate model references.",
      });
      continue;
    }
    parsedJsonFiles += 1;
    if (modelId) {
      modelsByPath.set(file.normalizedPath, {
        id: modelId,
        file,
        json: parsed.json,
        parent: typeof parsed.json.parent === "string" ? parsed.json.parent : null,
      });
    } else {
      itemDefinitions.push({ file, json: parsed.json });
    }
  }

  const assetExists = (path: string): boolean => localPaths.has(path) || vanillaPaths.has(path);
  const explicitModelRoots = new Set<string>();

  for (const itemDefinition of itemDefinitions) {
    const references: string[] = [];
    collectItemModelReferences(itemDefinition.json, references, new Set());
    for (const reference of references.sort()) {
      checkedReferences += 1;
      const path = modelAssetPath(reference);
      if (!path) {
        const displayedReference = diagnosticValue(reference);
        addDiagnostic({
          severity: "error",
          code: "invalid-model-reference",
          path: itemDefinition.file.normalizedPath,
          reference: displayedReference,
          message: `Item definition model reference '${displayedReference}' is not a valid resource location.`,
        });
      } else if (!assetExists(path)) {
        const displayedReference = diagnosticValue(reference);
        addDiagnostic({
          severity: "error",
          code: "missing-item-model",
          path: itemDefinition.file.normalizedPath,
          reference: displayedReference,
          message: `Item definition model '${displayedReference}' was not found locally or in vanilla assets for ${options.version}.`,
        });
      } else if (modelsByPath.has(path)) {
        explicitModelRoots.add(path);
      }
    }
  }

  const parentEdges = new Map<string, string>();
  for (const model of [...modelsByPath.values()].sort((left, right) =>
    left.file.normalizedPath.localeCompare(right.file.normalizedPath),
  )) {
    if (model.parent) {
      checkedReferences += 1;
      const builtIn = builtInModelReferences.has(model.parent.replace(/^minecraft:/, ""));
      const parentPath = modelAssetPath(model.parent);
      if (!builtIn && !parentPath) {
        const displayedParent = diagnosticValue(model.parent);
        addDiagnostic({
          severity: "error",
          code: "invalid-model-parent",
          path: model.file.normalizedPath,
          reference: displayedParent,
          message: `Model parent '${displayedParent}' is not a valid resource location.`,
        });
      } else if (!builtIn && parentPath && !assetExists(parentPath)) {
        const displayedParent = diagnosticValue(model.parent);
        addDiagnostic({
          severity: "error",
          code: "missing-model-parent",
          path: model.file.normalizedPath,
          reference: displayedParent,
          message: `Model parent '${displayedParent}' was not found locally or in vanilla assets for ${options.version}.`,
        });
      } else if (!builtIn && parentPath && modelsByPath.has(parentPath)) {
        parentEdges.set(model.file.normalizedPath, parentPath);
      }
    }

    for (const reference of collectLegacyOverrideModelReferences(model.json)) {
      checkedReferences += 1;
      const path = modelAssetPath(reference);
      if (!path) {
        const displayedReference = diagnosticValue(reference);
        addDiagnostic({
          severity: "error",
          code: "invalid-model-override",
          path: model.file.normalizedPath,
          reference: displayedReference,
          message: `Legacy model override '${displayedReference}' is not a valid resource location.`,
        });
      } else if (!assetExists(path)) {
        const displayedReference = diagnosticValue(reference);
        addDiagnostic({
          severity: "error",
          code: "missing-model-override",
          path: model.file.normalizedPath,
          reference: displayedReference,
          message: `Legacy model override '${displayedReference}' was not found locally or in vanilla assets for ${options.version}.`,
        });
      } else if (modelsByPath.has(path)) {
        explicitModelRoots.add(path);
      }
    }
  }

  const referencedAsLocalParent = new Set(parentEdges.values());
  const textureUsageByModel = new Map<string, ModelTextureUsage>();
  for (const model of [...modelsByPath.values()].sort((left, right) =>
    left.file.normalizedPath.localeCompare(right.file.normalizedPath),
  )) {
    const usage = collectModelTextureUsage({
      model,
      consume: () => consumeModelGraphOperations(1, model.file.normalizedPath),
    });
    if (!usage) {
      break;
    }
    textureUsageByModel.set(model.file.normalizedPath, usage);
  }
  const contextRoots = modelGraphLimitReached
    ? []
    : [...modelsByPath.values()]
        .filter(
          (model) =>
            explicitModelRoots.has(model.file.normalizedPath) ||
            !referencedAsLocalParent.has(model.file.normalizedPath),
        )
        .sort((left, right) => left.file.normalizedPath.localeCompare(right.file.normalizedPath));
  for (const contextRoot of contextRoots) {
    const chain = localParentChain({
      root: contextRoot,
      modelsByPath,
      consume: () => consumeModelGraphOperations(1, contextRoot.file.normalizedPath),
    });
    if (!chain) {
      break;
    }
    const usages: Array<{ reference: string; sourcePath: string; variable: string }> = [];
    const textureValues = new Map<string, unknown>();
    for (const sourceModel of chain) {
      const textures = isJsonObject(sourceModel.json.textures) ? sourceModel.json.textures : null;
      const cachedUsages = textureUsageByModel.get(sourceModel.file.normalizedPath);
      for (const entry of cachedUsages?.textureEntries ?? []) {
        if (!consumeModelGraphOperations(1, contextRoot.file.normalizedPath)) {
          break;
        }
        if (textures && !textureValues.has(entry.key)) {
          textureValues.set(entry.key, textures[entry.key]);
        }
        if (textures) {
          usages.push({
            reference: entry.reference,
            sourcePath: sourceModel.file.normalizedPath,
            variable: entry.key,
          });
        }
      }
      if (modelGraphLimitReached) {
        break;
      }
      for (const reference of cachedUsages?.references ?? []) {
        if (!consumeModelGraphOperations(1, contextRoot.file.normalizedPath)) {
          break;
        }
        if (reference.variable !== null) {
          usages.push({
            reference: reference.reference,
            sourcePath: sourceModel.file.normalizedPath,
            variable: reference.variable,
          });
        } else {
          checkedReferences += 1;
          const displayedReference = diagnosticValue(reference.reference);
          const displayedSourcePath = diagnosticValue(sourceModel.file.normalizedPath);
          addDiagnostic({
            severity: "error",
            code: "invalid-texture-reference",
            path: contextRoot.file.normalizedPath,
            reference: displayedReference,
            message: `Model face texture '${displayedReference}' used by '${displayedSourcePath}' must reference a texture variable beginning with '#'.`,
          });
        }
      }
      if (modelGraphLimitReached) {
        break;
      }
    }
    if (modelGraphLimitReached) {
      break;
    }
    const lastModel = chain.at(-1);
    const parentReference = lastModel?.parent ?? null;
    const parentPath = parentReference ? modelAssetPath(parentReference) : null;
    const missingStatus: "missing" | "unknown" =
      parentReference &&
      !builtInModelReferences.has(parentReference.replace(/^minecraft:/, "")) &&
      parentPath &&
      vanillaPaths.has(parentPath)
        ? "unknown"
        : "missing";
    const resolutionCache = new Map<string, TextureVariableResolution>();
    for (const usage of usages) {
      if (!consumeModelGraphOperations(1, contextRoot.file.normalizedPath)) {
        break;
      }
      checkedReferences += 1;
      const resolved = resolveTextureVariable({
        variable: usage.variable,
        textureValues,
        missingStatus,
        cache: resolutionCache,
        consume: () => consumeModelGraphOperations(1, contextRoot.file.normalizedPath),
        variableReference: textureVariableReference,
        validResourceLocation,
      });
      if (!resolved) {
        break;
      }
      const displayedResolvedReference = diagnosticValue(resolved.reference);
      const displayedUsageReference = diagnosticValue(usage.reference);
      const displayedUsageSourcePath = diagnosticValue(usage.sourcePath);
      if (resolved.status === "resolved") {
        const texturePath = cachedTextureAssetPath(resolved.reference);
        if (texturePath && !assetExists(texturePath)) {
          addDiagnostic({
            severity: "error",
            code: "missing-texture",
            path: contextRoot.file.normalizedPath,
            reference: displayedResolvedReference,
            message: `Texture '${displayedResolvedReference}' used by '${displayedUsageSourcePath}' was not found locally or in vanilla assets for ${options.version}.`,
          });
        }
        continue;
      }
      if (resolved.status === "unknown") {
        validationComplete = false;
        addDiagnostic({
          severity: "warning",
          code: "unverified-vanilla-texture-variable",
          path: contextRoot.file.normalizedPath,
          reference: displayedResolvedReference,
          message: `Texture variable '${displayedResolvedReference}' used by '${displayedUsageSourcePath}' could only be resolved from a vanilla parent whose contents are not bundled.`,
        });
        continue;
      }
      if (resolved.status === "invalid") {
        addDiagnostic({
          severity: "error",
          code: "invalid-texture-reference",
          path: contextRoot.file.normalizedPath,
          reference: displayedResolvedReference,
          message: `Texture variable '${displayedUsageReference}' used by '${displayedUsageSourcePath}' resolves to invalid texture reference '${displayedResolvedReference}'.`,
        });
        continue;
      }
      addDiagnostic({
        severity: "error",
        code: resolved.status === "cycle" ? "texture-variable-cycle" : "missing-texture-variable",
        path: contextRoot.file.normalizedPath,
        reference: displayedResolvedReference,
        message:
          resolved.status === "cycle"
            ? `Texture variable '${displayedResolvedReference}' used by '${displayedUsageSourcePath}' resolves through a cycle in this model context.`
            : `Texture variable '${displayedResolvedReference}' used by '${displayedUsageSourcePath}' is not defined by this model context or its local parents.`,
      });
    }
    if (modelGraphLimitReached) {
      break;
    }
  }

  const boundedModelCycleReference = (cycle: readonly string[]): string => {
    let result = "";
    for (let index = 0; index <= cycle.length; index += 1) {
      const path = cycle[index % cycle.length] ?? "";
      const modelId = modelsByPath.get(path)?.id ?? path;
      const addition = `${index === 0 ? "" : " -> "}${modelId}`;
      if (result.length + addition.length <= options.limits.maxDiagnosticTextLength) {
        result += addition;
        continue;
      }
      const omitted = cycle.length - index + 1;
      const suffix = ` -> … (${omitted} model${omitted === 1 ? "" : "s"} omitted)`;
      return `${result.slice(
        0,
        Math.max(0, options.limits.maxDiagnosticTextLength - suffix.length),
      )}${suffix}`;
    }
    return result;
  };
  const visitedParents = new Set<string>();
  parentCycleTraversal: for (const rootPath of [...modelsByPath.keys()].sort()) {
    if (modelGraphLimitReached) {
      break;
    }
    if (visitedParents.has(rootPath)) {
      continue;
    }
    const path: string[] = [];
    const activeIndex = new Map<string, number>();
    let current: string | undefined = rootPath;
    while (current && !visitedParents.has(current)) {
      if (!consumeModelGraphOperations(1, rootPath)) {
        break parentCycleTraversal;
      }
      const cycleStart = activeIndex.get(current);
      if (cycleStart !== undefined) {
        const cycle = canonicalCycle(path.slice(cycleStart));
        const first = cycle[0];
        if (first) {
          const reference = boundedModelCycleReference(cycle);
          addDiagnostic({
            severity: "error",
            code: "model-parent-cycle",
            path: first,
            reference,
            source: first,
            message: `Model parent references form a cycle: ${reference}.`,
          });
        }
        break;
      }
      activeIndex.set(current, path.length);
      path.push(current);
      current = parentEdges.get(current);
    }
    for (const visited of path) {
      visitedParents.add(visited);
    }
  }

  const soundValidation = validateResourcepackSounds({
    files: projectFiles,
    localPaths,
    limits: options.limits,
    addDiagnostic,
  });
  parsedJsonFiles += soundValidation.parsedJsonFiles;
  checkedReferences += soundValidation.checkedReferences;
  validationComplete &&= soundValidation.soundValidationComplete;
  const exceededLimits = [
    ...new Set([...processingExceededLimits, ...soundValidation.exceededLimits]),
  ].sort();
  const summary = collector.finish();

  return {
    schemaVersion: 1,
    edition: "java",
    version: options.version,
    valid: summary.errorCount === 0,
    totalFiles: projectFiles.length,
    processedFiles: projectFiles.length,
    validationComplete,
    appliedLimits: { ...options.limits, maxDiagnostics: options.limit },
    exceededLimits,
    modelFiles: modelsByPath.size,
    itemDefinitionFiles: itemDefinitions.length,
    soundDefinitionFiles: soundValidation.soundDefinitionFiles,
    soundEvents: soundValidation.soundEvents,
    soundFileReferences: soundValidation.soundFileReferences,
    soundEventReferences: soundValidation.soundEventReferences,
    soundFiles: soundValidation.soundFiles,
    inspectedSoundFiles: soundValidation.inspectedSoundFiles,
    soundValidationComplete: soundValidation.soundValidationComplete,
    soundValidationIncompleteReasons: soundValidation.incompleteReasons,
    binaryFiles: projectFiles.filter((file) => binaryAssetPath(file.normalizedPath)).length,
    parsedJsonFiles,
    checkedReferences,
    errorCount: summary.errorCount,
    warningCount: summary.warningCount,
    diagnosticTotal: summary.diagnosticTotal,
    retainedDiagnosticCount: summary.diagnostics.length,
    omittedDiagnosticCount: summary.diagnosticTotal - summary.diagnostics.length,
    truncated: summary.diagnosticTotal > summary.diagnostics.length,
    diagnostics: summary.diagnostics,
    notes: resourcepackValidationNotes(options.version),
  };
}
