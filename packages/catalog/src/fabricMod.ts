import { inspectModrinthArchive, type ModrinthArchiveDiagnostic } from "./modrinthZip.js";

const fabricModSpecification = "https://docs.fabricmc.net/develop/loader/fabric-mod-json";
const fabricModMetadataPath = "fabric.mod.json";
const fabricModIdPattern = /^[a-z][a-z0-9_-]{1,63}$/;
const fabricModEnvironments = new Set(["*", "client", "server"]);
const fabricModDependencyFields = [
  "depends",
  "recommends",
  "suggests",
  "breaks",
  "conflicts",
] as const;
const maxDiagnosticTextLength = 2_048;
const maxArchivePathLength = 4_096;
const maxFieldTextLength = 8_192;
const maxContainerEntries = 10_000;
const maxJavaInteger = 2_147_483_647;
const windowsReservedPathSegment =
  /^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3])$/i;

export type FabricModArchiveEntry = {
  path: string;
  size?: number;
  directory?: boolean;
};

export type FabricModValidationStrength = "none" | "metadata" | "binary";

export type FabricModValidationLimits = {
  maxArchiveBytes: number;
  maxArchiveEntries: number;
  maxMetadataBytes: number;
  maxEntryUncompressedBytes: number;
  maxTotalUncompressedBytes: number;
  maxCompressionRatio: number;
  maxDiagnostics: number;
  maxMetadataNodes: number;
  maxMetadataDepth: number;
  maxMetadataStringBytes: number;
};

export const defaultFabricModValidationLimits: Readonly<FabricModValidationLimits> = Object.freeze({
  maxArchiveBytes: 256 * 1024 * 1024,
  maxArchiveEntries: 20_000,
  maxMetadataBytes: 2 * 1024 * 1024,
  maxEntryUncompressedBytes: 256 * 1024 * 1024,
  maxTotalUncompressedBytes: 1024 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxDiagnostics: 200,
  maxMetadataNodes: 20_000,
  maxMetadataDepth: 64,
  maxMetadataStringBytes: 2 * 1024 * 1024,
});

export type FabricModValidationOptions = {
  metadata: unknown;
  archiveEntries?: FabricModArchiveEntry[];
  limits?: Partial<FabricModValidationLimits>;
};

export type FabricModJarValidationOptions = {
  limits?: Partial<FabricModValidationLimits>;
};

export type FabricModDiagnostic = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

export type FabricModValidationResult = {
  schemaVersion: 1;
  specification: string;
  valid: boolean;
  errorCount: number;
  warningCount: number;
  validationStrength: FabricModValidationStrength;
  coverage: {
    schema: "fabric.mod.json-v1-structural";
    checked: string[];
    notChecked: string[];
  };
  diagnosticsTruncated: boolean;
  omittedDiagnosticCount: number;
  mod: {
    metadataSchemaVersion: number | null;
    id: string | null;
    version: string | null;
    name: string | null;
    environment: string | null;
    entrypointGroups: number;
    mixinConfigurations: number;
    nestedJars: number;
    referencedFiles: number;
  } | null;
  archive: {
    provided: boolean;
    entries: number;
    missingReferencedFiles: number;
  };
  limits: FabricModValidationLimits;
  diagnostics: FabricModDiagnostic[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || (0x7f <= codePoint && codePoint <= 0x9f)) return true;
  }
  return false;
}

function boundedText(value: string): string {
  const sanitized = [...value]
    .map((character) => (hasControlCharacter(character) ? " " : character))
    .join("");
  return sanitized.length <= maxDiagnosticTextLength
    ? sanitized
    : `${sanitized.slice(0, maxDiagnosticTextLength - 1)}\u2026`;
}

function normalizedLimit(value: unknown, fallback: number, integer = true): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    0 < value &&
    (!integer || Number.isSafeInteger(value))
    ? Math.min(value, fallback)
    : fallback;
}

export function resolveFabricModValidationLimits(
  limits: Partial<FabricModValidationLimits> | undefined,
): FabricModValidationLimits {
  return {
    maxArchiveBytes: normalizedLimit(
      limits?.maxArchiveBytes,
      defaultFabricModValidationLimits.maxArchiveBytes,
    ),
    maxArchiveEntries: normalizedLimit(
      limits?.maxArchiveEntries,
      defaultFabricModValidationLimits.maxArchiveEntries,
    ),
    maxMetadataBytes: normalizedLimit(
      limits?.maxMetadataBytes,
      defaultFabricModValidationLimits.maxMetadataBytes,
    ),
    maxEntryUncompressedBytes: normalizedLimit(
      limits?.maxEntryUncompressedBytes,
      defaultFabricModValidationLimits.maxEntryUncompressedBytes,
    ),
    maxTotalUncompressedBytes: normalizedLimit(
      limits?.maxTotalUncompressedBytes,
      defaultFabricModValidationLimits.maxTotalUncompressedBytes,
    ),
    maxCompressionRatio: normalizedLimit(
      limits?.maxCompressionRatio,
      defaultFabricModValidationLimits.maxCompressionRatio,
      false,
    ),
    maxDiagnostics: normalizedLimit(
      limits?.maxDiagnostics,
      defaultFabricModValidationLimits.maxDiagnostics,
    ),
    maxMetadataNodes: normalizedLimit(
      limits?.maxMetadataNodes,
      defaultFabricModValidationLimits.maxMetadataNodes,
    ),
    maxMetadataDepth: normalizedLimit(
      limits?.maxMetadataDepth,
      defaultFabricModValidationLimits.maxMetadataDepth,
    ),
    maxMetadataStringBytes: normalizedLimit(
      limits?.maxMetadataStringBytes,
      defaultFabricModValidationLimits.maxMetadataStringBytes,
    ),
  };
}

class FabricModDiagnosticCollector {
  readonly limits: FabricModValidationLimits;
  private readonly retained: FabricModDiagnostic[] = [];
  errorCount = 0;
  warningCount = 0;

  constructor(limits: FabricModValidationLimits) {
    this.limits = limits;
  }

  add(
    severity: FabricModDiagnostic["severity"],
    code: string,
    path: string,
    message: string,
  ): void {
    if (severity === "error") this.errorCount += 1;
    else this.warningCount += 1;
    if (this.retained.length < this.limits.maxDiagnostics) {
      this.retained.push({
        severity,
        code,
        path: boundedText(path),
        message: boundedText(message),
      });
    }
  }

  finish(): Pick<
    FabricModValidationResult,
    "diagnostics" | "diagnosticsTruncated" | "omittedDiagnosticCount"
  > {
    const total = this.errorCount + this.warningCount;
    const diagnostics = this.retained.sort(
      (left, right) =>
        (left.severity === right.severity ? 0 : left.severity === "error" ? -1 : 1) ||
        compareText(left.path, right.path) ||
        compareText(left.code, right.code) ||
        compareText(left.message, right.message),
    );
    return {
      diagnostics,
      diagnosticsTruncated: diagnostics.length < total,
      omittedDiagnosticCount: Math.max(0, total - diagnostics.length),
    };
  }
}

function archivePathProblem(path: string, directory = false): string | null {
  if (!path) return "Path must not be empty.";
  if (path.length > maxArchivePathLength) {
    return `Path must not exceed ${maxArchivePathLength} characters.`;
  }
  if (hasControlCharacter(path)) return "Path must not contain control characters.";
  if (/^[A-Za-z]:/u.test(path)) return "Path must not start with a Windows drive name.";
  if (path.startsWith("/") || path.startsWith("\\"))
    return "Path must be relative to the JAR root.";
  if (path.includes("\\")) return "Path must use forward slashes.";
  const normalized = directory && path.endsWith("/") ? path.slice(0, -1) : path;
  if (!normalized) return "Path must identify an entry below the JAR root.";
  if (!directory && path.endsWith("/")) return "A file path must not end with a slash.";
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return "Path must be normalized without empty, dot, or parent-directory segments.";
  }
  for (const segment of segments) {
    if (/[<>"|?*]/u.test(segment) || segment.includes(":")) {
      return "Path contains characters unsafe on supported filesystems.";
    }
    if (/[. ]$/u.test(segment)) return "Path segments must not end with a dot or space.";
    const basename = (segment.split(".")[0] ?? "").replace(/[. ]+$/u, "");
    if (windowsReservedPathSegment.test(basename)) {
      return `Path segment is a reserved Windows device name: ${segment}`;
    }
  }
  return null;
}

function archivePathKey(path: string, directory = false): string {
  const normalized = directory && path.endsWith("/") ? path.slice(0, -1) : path;
  return normalized.normalize("NFC").toLowerCase().normalize("NFC");
}

function validText(
  value: unknown,
  path: string,
  collector: FabricModDiagnosticCollector,
  options: { allowEmpty?: boolean; allowControls?: boolean; maxLength?: number } = {},
): string | null {
  const maxLength = options.maxLength ?? collector.limits.maxMetadataStringBytes;
  if (typeof value !== "string") {
    collector.add("error", "metadata.invalid-type", path, "Value must be a string.");
    return null;
  }
  if ((!options.allowEmpty && value.length === 0) || value.length > maxLength) {
    collector.add(
      "error",
      "metadata.invalid-string",
      path,
      `Value must ${options.allowEmpty ? "" : "not be empty and "}not exceed ${maxLength} characters.`,
    );
    return null;
  }
  if (!options.allowControls && hasControlCharacter(value)) {
    collector.add(
      "error",
      "metadata.control-character",
      path,
      "Value must not contain control characters.",
    );
    return null;
  }
  return value;
}

function inspectMetadataComplexity(
  value: unknown,
  collector: FabricModDiagnosticCollector,
): boolean {
  const stack: Array<{ value: unknown; depth: number; path: string; ancestors: object[] }> = [
    { value, depth: 0, path: "$", ancestors: [] },
  ];
  let nodes = 0;
  let stringBytes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    nodes += 1;
    if (collector.limits.maxMetadataNodes < nodes) {
      collector.add(
        "error",
        "metadata.node-limit",
        current.path,
        `Metadata exceeds the ${collector.limits.maxMetadataNodes}-node limit.`,
      );
      return false;
    }
    if (collector.limits.maxMetadataDepth < current.depth) {
      collector.add(
        "error",
        "metadata.depth-limit",
        current.path,
        `Metadata exceeds the ${collector.limits.maxMetadataDepth}-level nesting limit.`,
      );
      return false;
    }
    if (typeof current.value === "string") {
      stringBytes += Buffer.byteLength(current.value, "utf8");
      if (collector.limits.maxMetadataStringBytes < stringBytes) {
        collector.add(
          "error",
          "metadata.string-byte-limit",
          current.path,
          `Metadata strings exceed the ${collector.limits.maxMetadataStringBytes}-byte aggregate limit.`,
        );
        return false;
      }
      continue;
    }
    if (
      current.value === null ||
      typeof current.value === "boolean" ||
      (typeof current.value === "number" && Number.isFinite(current.value))
    ) {
      continue;
    }
    if (typeof current.value !== "object") {
      collector.add(
        "error",
        "metadata.non-json-value",
        current.path,
        "Metadata must contain only JSON values.",
      );
      return false;
    }
    if (current.ancestors.includes(current.value)) {
      collector.add(
        "error",
        "metadata.cyclic-value",
        current.path,
        "Metadata objects must not contain cycles.",
      );
      return false;
    }
    const ancestors = [...current.ancestors, current.value];
    if (Array.isArray(current.value)) {
      const arrayValue = current.value;
      if (arrayValue.length > maxContainerEntries) {
        collector.add(
          "error",
          "metadata.container-limit",
          current.path,
          `Arrays must not exceed ${maxContainerEntries} entries.`,
        );
        return false;
      }
      const arrayKeys = Reflect.ownKeys(arrayValue);
      if (
        arrayKeys.some(
          (key) =>
            typeof key === "symbol" ||
            (key !== "length" &&
              (!/^(?:0|[1-9]\d*)$/u.test(key) || arrayValue.length <= Number(key))),
        )
      ) {
        collector.add(
          "error",
          "metadata.non-json-array-property",
          current.path,
          "Metadata arrays must not contain named or symbol properties.",
        );
        return false;
      }
      for (let index = arrayValue.length - 1; 0 <= index; index -= 1) {
        const descriptor = Object.getOwnPropertyDescriptor(arrayValue, index);
        if (descriptor === undefined) {
          collector.add(
            "error",
            "metadata.sparse-array",
            `${current.path}[${index}]`,
            "Sparse arrays are not valid JSON values.",
          );
          return false;
        }
        if (!("value" in descriptor)) {
          collector.add(
            "error",
            "metadata.accessor-property",
            `${current.path}[${index}]`,
            "Metadata must use JSON data properties, not accessors.",
          );
          return false;
        }
        stack.push({
          value: descriptor.value,
          depth: current.depth + 1,
          path: `${current.path}[${index}]`,
          ancestors,
        });
      }
      continue;
    }
    if (!isRecord(current.value)) {
      collector.add(
        "error",
        "metadata.non-json-object",
        current.path,
        "Metadata objects must use the JSON object data model.",
      );
      return false;
    }
    const ownKeys = Reflect.ownKeys(current.value);
    if (ownKeys.some((key) => typeof key === "symbol")) {
      collector.add(
        "error",
        "metadata.symbol-property",
        current.path,
        "Metadata must not contain symbol properties.",
      );
      return false;
    }
    const keys = ownKeys as string[];
    if (keys.length > maxContainerEntries) {
      collector.add(
        "error",
        "metadata.container-limit",
        current.path,
        `Objects must not exceed ${maxContainerEntries} keys.`,
      );
      return false;
    }
    for (let index = keys.length - 1; 0 <= index; index -= 1) {
      const key = keys[index];
      if (key === undefined) continue;
      const descriptor = Object.getOwnPropertyDescriptor(current.value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        collector.add(
          "error",
          "metadata.accessor-property",
          `${current.path}.${key}`,
          "Metadata must use enumerable JSON data properties, not hidden properties or accessors.",
        );
        return false;
      }
      stringBytes += Buffer.byteLength(key, "utf8");
      if (collector.limits.maxMetadataStringBytes < stringBytes) {
        collector.add(
          "error",
          "metadata.string-byte-limit",
          current.path,
          `Metadata strings exceed the ${collector.limits.maxMetadataStringBytes}-byte aggregate limit.`,
        );
        return false;
      }
      stack.push({
        value: descriptor.value,
        depth: current.depth + 1,
        path: `${current.path}.${key}`,
        ancestors,
      });
    }
  }
  return true;
}

function cloneJsonData(value: unknown): unknown {
  if (Array.isArray(value)) {
    const clone = new Array<unknown>(value.length);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, index);
      if (descriptor !== undefined && "value" in descriptor) {
        clone[index] = cloneJsonData(descriptor.value);
      }
    }
    return clone;
  }
  if (isRecord(value)) {
    const clone: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && "value" in descriptor) {
        clone[key] = cloneJsonData(descriptor.value);
      }
    }
    return clone;
  }
  return value;
}

function parseMetadata(value: unknown, collector: FabricModDiagnosticCollector): unknown | null {
  if (typeof value !== "string") {
    return inspectMetadataComplexity(value, collector) ? cloneJsonData(value) : null;
  }
  const byteLength = Buffer.byteLength(value, "utf8");
  if (collector.limits.maxMetadataBytes < byteLength) {
    collector.add(
      "error",
      "metadata.byte-limit",
      fabricModMetadataPath,
      `fabric.mod.json has ${byteLength} UTF-8 bytes, above the ${collector.limits.maxMetadataBytes}-byte limit.`,
    );
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    collector.add(
      "error",
      "metadata.invalid-json",
      fabricModMetadataPath,
      "fabric.mod.json must contain valid JSON.",
    );
    return null;
  }
  return inspectMetadataComplexity(parsed, collector) ? cloneJsonData(parsed) : null;
}

function firstJsonObjectKey(value: string): string | null {
  let offset = 0;
  while (/\s/u.test(value[offset] ?? "")) offset += 1;
  if (value[offset] !== "{") return null;
  offset += 1;
  while (/\s/u.test(value[offset] ?? "")) offset += 1;
  if (value[offset] !== '"') return null;
  const start = offset;
  offset += 1;
  let escaped = false;
  while (offset < value.length) {
    const character = value[offset];
    if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === '"') {
      try {
        const key = JSON.parse(value.slice(start, offset + 1)) as unknown;
        return typeof key === "string" ? key : null;
      } catch {
        return null;
      }
    }
    offset += 1;
  }
  return null;
}

function validateModId(
  value: unknown,
  path: string,
  collector: FabricModDiagnosticCollector,
): string | null {
  const id = validText(value, path, collector, { maxLength: 64 });
  if (id !== null && !fabricModIdPattern.test(id)) {
    collector.add(
      "error",
      "metadata.invalid-mod-id",
      path,
      "Mod IDs must be 2-64 lowercase ASCII letters, digits, underscores, or hyphens and start with a lowercase letter.",
    );
    return null;
  }
  return id;
}

function validateContact(
  value: unknown,
  path: string,
  collector: FabricModDiagnosticCollector,
): void {
  if (!isRecord(value)) {
    collector.add("error", "metadata.invalid-type", path, "Contact information must be an object.");
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    validText(entry, `${path}.${key}`, collector, { allowEmpty: true, allowControls: true });
  }
}

function validatePeople(
  value: unknown,
  path: string,
  collector: FabricModDiagnosticCollector,
): void {
  if (!Array.isArray(value)) {
    collector.add("error", "metadata.invalid-type", path, "People must be an array.");
    return;
  }
  for (const [index, entry] of value.entries()) {
    const entryPath = `${path}[${index}]`;
    if (typeof entry === "string") {
      validText(entry, entryPath, collector, { allowEmpty: true, allowControls: true });
    } else if (isRecord(entry)) {
      validText(entry.name, `${entryPath}.name`, collector, {
        allowEmpty: true,
        allowControls: true,
      });
      if (entry.contact !== undefined)
        validateContact(entry.contact, `${entryPath}.contact`, collector);
    } else {
      collector.add(
        "error",
        "metadata.invalid-person",
        entryPath,
        "A person must be a name string or an object with a name.",
      );
    }
  }
}

function validateLicense(
  value: unknown,
  path: string,
  collector: FabricModDiagnosticCollector,
): void {
  if (typeof value === "string") {
    validText(value, path, collector, { allowEmpty: true, allowControls: true });
    return;
  }
  if (!Array.isArray(value)) {
    collector.add(
      "error",
      "metadata.invalid-license",
      path,
      "License must be a string or string array.",
    );
    return;
  }
  for (const [index, entry] of value.entries()) {
    validText(entry, `${path}[${index}]`, collector, {
      allowEmpty: true,
      allowControls: true,
    });
  }
}

function addReferencedPath(
  value: unknown,
  path: string,
  references: Map<string, string>,
  collector: FabricModDiagnosticCollector,
): string | null {
  const reference = validText(value, path, collector, { maxLength: maxArchivePathLength });
  if (reference === null) return null;
  const problem = archivePathProblem(reference);
  if (problem !== null) {
    collector.add("error", "metadata.unsafe-reference-path", path, problem);
    return null;
  }
  if (!references.has(reference)) references.set(reference, path);
  return reference;
}

function validateIcon(
  value: unknown,
  references: Map<string, string>,
  collector: FabricModDiagnosticCollector,
): void {
  if (typeof value === "string") {
    addReferencedPath(value, "$.icon", references, collector);
    return;
  }
  if (!isRecord(value) || Object.keys(value).length === 0) {
    collector.add(
      "error",
      "metadata.invalid-icon",
      "$.icon",
      "Icon must be a path or a non-empty size-to-path object.",
    );
    return;
  }
  for (const [size, path] of Object.entries(value)) {
    if (!/^[1-9]\d*$/u.test(size) || maxJavaInteger < Number(size)) {
      collector.add(
        "error",
        "metadata.invalid-icon-size",
        `$.icon.${size}`,
        `Icon size keys must be positive 32-bit integers no greater than ${maxJavaInteger}.`,
      );
    }
    addReferencedPath(path, `$.icon.${size}`, references, collector);
  }
}

function validateEnvironment(
  value: unknown,
  path: string,
  collector: FabricModDiagnosticCollector,
): string | null {
  const environment = validText(value, path, collector, { allowEmpty: true });
  if (environment === null) return null;
  const normalized = environment.toLowerCase();
  if (normalized === "" || normalized === "*") return "*";
  if (fabricModEnvironments.has(normalized)) return normalized;
  collector.add(
    "error",
    "metadata.invalid-environment",
    path,
    "Environment must be *, client, or server.",
  );
  return normalized;
}

function validateEntrypoints(value: unknown, collector: FabricModDiagnosticCollector): number {
  if (!isRecord(value)) {
    collector.add(
      "error",
      "metadata.invalid-type",
      "$.entrypoints",
      "Entrypoints must be an object.",
    );
    return 0;
  }
  for (const [key, entries] of Object.entries(value)) {
    const groupPath = `$.entrypoints.${key}`;
    if (key.length > maxFieldTextLength) {
      collector.add(
        "error",
        "metadata.invalid-entrypoint-key",
        groupPath,
        "Entrypoint keys must not exceed the configured field bound.",
      );
    }
    if (!Array.isArray(entries)) {
      collector.add(
        "error",
        "metadata.invalid-type",
        groupPath,
        "Each entrypoint group must be an array.",
      );
      continue;
    }
    for (const [index, entry] of entries.entries()) {
      const entryPath = `${groupPath}[${index}]`;
      if (typeof entry === "string") {
        validText(entry, entryPath, collector, { allowEmpty: true, allowControls: true });
      } else if (isRecord(entry)) {
        if (entry.adapter !== undefined) {
          validText(entry.adapter, `${entryPath}.adapter`, collector, {
            allowEmpty: true,
            allowControls: true,
          });
        }
        validText(entry.value, `${entryPath}.value`, collector, {
          allowEmpty: true,
          allowControls: true,
        });
      } else {
        collector.add(
          "error",
          "metadata.invalid-entrypoint",
          entryPath,
          "Entrypoints must be strings or adapter/value objects.",
        );
      }
    }
  }
  return Object.keys(value).length;
}

function validateMixins(
  value: unknown,
  references: Map<string, string>,
  collector: FabricModDiagnosticCollector,
): number {
  if (!Array.isArray(value)) {
    collector.add("error", "metadata.invalid-type", "$.mixins", "Mixins must be an array.");
    return 0;
  }
  for (const [index, entry] of value.entries()) {
    const entryPath = `$.mixins[${index}]`;
    if (typeof entry === "string") {
      addReferencedPath(entry, entryPath, references, collector);
      continue;
    }
    if (!isRecord(entry)) {
      collector.add(
        "error",
        "metadata.invalid-mixin",
        entryPath,
        "Mixin entries must be paths or config/environment objects.",
      );
      continue;
    }
    addReferencedPath(entry.config, `${entryPath}.config`, references, collector);
    if (entry.environment !== undefined) {
      validateEnvironment(entry.environment, `${entryPath}.environment`, collector);
    }
  }
  return value.length;
}

function validateNestedJars(
  value: unknown,
  references: Map<string, string>,
  collector: FabricModDiagnosticCollector,
): number {
  if (!Array.isArray(value)) {
    collector.add("error", "metadata.invalid-type", "$.jars", "Nested JARs must be an array.");
    return 0;
  }
  for (const [index, entry] of value.entries()) {
    const entryPath = `$.jars[${index}]`;
    if (!isRecord(entry)) {
      collector.add(
        "error",
        "metadata.invalid-nested-jar",
        entryPath,
        "Nested JAR entries must be objects with a file path.",
      );
      continue;
    }
    addReferencedPath(entry.file, `${entryPath}.file`, references, collector);
  }
  return value.length;
}

function validateStringMap(
  value: unknown,
  path: string,
  collector: FabricModDiagnosticCollector,
): void {
  if (!isRecord(value)) {
    collector.add("error", "metadata.invalid-type", path, "Value must be an object.");
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key.length > maxFieldTextLength) {
      collector.add(
        "error",
        "metadata.invalid-key",
        `${path}.${key}`,
        "Object keys must not exceed the configured field bound.",
      );
    }
    validText(entry, `${path}.${key}`, collector, { allowEmpty: true, allowControls: true });
  }
}

function validateDependencies(
  metadata: Record<string, unknown>,
  collector: FabricModDiagnosticCollector,
): void {
  for (const field of fabricModDependencyFields) {
    const value = metadata[field];
    if (value === undefined) continue;
    const fieldPath = `$.${field}`;
    if (!isRecord(value)) {
      collector.add(
        "error",
        "metadata.invalid-type",
        fieldPath,
        "Dependency declarations must be objects.",
      );
      continue;
    }
    for (const [id, predicate] of Object.entries(value)) {
      const path = `${fieldPath}.${id}`;
      validateModId(id, path, collector);
      if (typeof predicate === "string") {
        validText(predicate, path, collector);
        continue;
      }
      if (!Array.isArray(predicate)) {
        collector.add(
          "error",
          "metadata.invalid-dependency-range",
          path,
          "Dependency ranges must be a string or string array.",
        );
        continue;
      }
      for (const [index, entry] of predicate.entries())
        validText(entry, `${path}[${index}]`, collector);
    }
  }
}

function validateArchiveEntries(
  archiveEntries: FabricModArchiveEntry[] | undefined,
  collector: FabricModDiagnosticCollector,
): {
  files: Map<string, string>;
  fileSizes: Map<string, number>;
  entries: number;
  checksPerformed: boolean;
  authoritative: boolean;
} {
  const files = new Map<string, string>();
  const fileSizes = new Map<string, number>();
  const normalized = new Map<string, string>();
  const fileKeys = new Map<string, string>();
  const descendantKeys = new Map<string, string>();
  if (archiveEntries === undefined) {
    return { files, fileSizes, entries: 0, checksPerformed: false, authoritative: false };
  }
  if (!Array.isArray(archiveEntries)) {
    collector.add(
      "error",
      "archive.invalid-entries",
      "archive",
      "Archive entries must be an array.",
    );
    return { files, fileSizes, entries: 0, checksPerformed: false, authoritative: false };
  }
  let authoritative = archiveEntries.length <= collector.limits.maxArchiveEntries;
  if (collector.limits.maxArchiveEntries < archiveEntries.length) {
    collector.add(
      "error",
      "archive.entry-limit",
      "archive",
      `Archive has ${archiveEntries.length} entries, above the ${collector.limits.maxArchiveEntries}-entry limit.`,
    );
  }
  const inspectedEntries = archiveEntries.slice(0, collector.limits.maxArchiveEntries);
  for (const [index, entry] of inspectedEntries.entries()) {
    const pointer = `archive[${index}]`;
    if (!isRecord(entry)) {
      authoritative = false;
      collector.add(
        "error",
        "archive.invalid-entry",
        pointer,
        "Archive entries require a string path.",
      );
      continue;
    }
    const pathDescriptor = Object.getOwnPropertyDescriptor(entry, "path");
    const sizeDescriptor = Object.getOwnPropertyDescriptor(entry, "size");
    const directoryDescriptor = Object.getOwnPropertyDescriptor(entry, "directory");
    if (
      pathDescriptor === undefined ||
      !("value" in pathDescriptor) ||
      typeof pathDescriptor.value !== "string"
    ) {
      authoritative = false;
      collector.add(
        "error",
        "archive.invalid-entry",
        pointer,
        "Archive entries require a string path.",
      );
      continue;
    }
    if (
      (sizeDescriptor !== undefined && !("value" in sizeDescriptor)) ||
      (directoryDescriptor !== undefined && !("value" in directoryDescriptor))
    ) {
      authoritative = false;
      collector.add(
        "error",
        "archive.accessor-property",
        pointer,
        "Archive entry metadata must use JSON data properties, not accessors.",
      );
      continue;
    }
    const path = pathDescriptor.value;
    const size = sizeDescriptor?.value;
    const directoryValue = directoryDescriptor?.value;
    const directory = directoryValue === true;
    if (directoryValue !== undefined && typeof directoryValue !== "boolean") {
      authoritative = false;
      collector.add(
        "error",
        "archive.invalid-directory",
        pointer,
        "directory must be boolean when present.",
      );
    }
    if (
      size !== undefined &&
      (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0)
    ) {
      collector.add(
        "error",
        "archive.invalid-size",
        pointer,
        "size must be a non-negative safe integer when present.",
      );
    }
    const problem = archivePathProblem(path, directory);
    if (problem !== null) {
      collector.add("error", "archive.unsafe-path", pointer, problem);
      continue;
    }
    if (!directory) {
      files.set(path, pointer);
      if (typeof size === "number" && Number.isSafeInteger(size) && 0 <= size) {
        fileSizes.set(path, size);
      }
    }
    const key = archivePathKey(path, directory);
    const prior = normalized.get(key);
    if (prior !== undefined) {
      collector.add(
        "error",
        prior === path ? "archive.duplicate-path" : "archive.normalized-path-conflict",
        pointer,
        `Archive path conflicts with ${prior}.`,
      );
      continue;
    }
    normalized.set(key, path);
    const segments = key.split("/");
    const ancestors = segments
      .slice(0, -1)
      .map((_, ancestorIndex) => segments.slice(0, ancestorIndex + 1).join("/"));
    const conflict =
      ancestors.map((ancestor) => fileKeys.get(ancestor)).find((value) => value !== undefined) ??
      (!directory ? descendantKeys.get(key) : undefined);
    if (conflict !== undefined) {
      collector.add(
        "error",
        "archive.path-conflict",
        pointer,
        `Archive file/directory layout conflicts with ${conflict}.`,
      );
    }
    if (!directory) fileKeys.set(key, path);
    for (const ancestor of ancestors) {
      if (!descendantKeys.has(ancestor)) descendantKeys.set(ancestor, path);
    }
  }
  return {
    files,
    fileSizes,
    entries: archiveEntries.length,
    checksPerformed: true,
    authoritative,
  };
}

type ParsedMod = NonNullable<FabricModValidationResult["mod"]>;

function validateMetadata(
  value: unknown,
  collector: FabricModDiagnosticCollector,
): { mod: ParsedMod | null; references: Map<string, string> } {
  const references = new Map<string, string>();
  const parsed = parseMetadata(value, collector);
  if (!isRecord(parsed)) {
    if (parsed !== null) {
      collector.add(
        "error",
        "metadata.invalid-root",
        "$",
        "fabric.mod.json must contain a JSON object.",
      );
    }
    return { mod: null, references };
  }
  if (typeof value === "string" && firstJsonObjectKey(value) !== "schemaVersion") {
    collector.add(
      "error",
      "metadata.schema-version-order",
      "$.schemaVersion",
      "schemaVersion must be the first property in fabric.mod.json.",
    );
  }
  const metadataSchemaVersion =
    typeof parsed.schemaVersion === "number" && Number.isSafeInteger(parsed.schemaVersion)
      ? parsed.schemaVersion
      : null;
  if (metadataSchemaVersion !== 1) {
    collector.add(
      "error",
      "metadata.unsupported-schema-version",
      "$.schemaVersion",
      "This validator supports the current fabric.mod.json schemaVersion 1.",
    );
  }
  const id = validateModId(parsed.id, "$.id", collector);
  const version = validText(parsed.version, "$.version", collector);
  const name =
    parsed.name === undefined
      ? id
      : validText(parsed.name, "$.name", collector, { allowEmpty: true, allowControls: true });
  if (parsed.description !== undefined) {
    validText(parsed.description, "$.description", collector, {
      allowEmpty: true,
      allowControls: true,
    });
  }
  let environment = "*";
  if (parsed.environment !== undefined) {
    const validated = validateEnvironment(parsed.environment, "$.environment", collector);
    if (validated !== null) environment = validated;
  }
  if (parsed.contact !== undefined) validateContact(parsed.contact, "$.contact", collector);
  if (parsed.authors !== undefined) validatePeople(parsed.authors, "$.authors", collector);
  if (parsed.contributors !== undefined) {
    validatePeople(parsed.contributors, "$.contributors", collector);
  }
  if (parsed.license !== undefined) validateLicense(parsed.license, "$.license", collector);
  if (parsed.icon !== undefined) validateIcon(parsed.icon, references, collector);
  const entrypointGroups =
    parsed.entrypoints === undefined ? 0 : validateEntrypoints(parsed.entrypoints, collector);
  const mixinConfigurations =
    parsed.mixins === undefined ? 0 : validateMixins(parsed.mixins, references, collector);
  const nestedJars =
    parsed.jars === undefined ? 0 : validateNestedJars(parsed.jars, references, collector);
  if (parsed.accessWidener !== undefined) {
    addReferencedPath(parsed.accessWidener, "$.accessWidener", references, collector);
  }
  if (parsed.languageAdapters !== undefined) {
    validateStringMap(parsed.languageAdapters, "$.languageAdapters", collector);
  }
  if (parsed.provides !== undefined) {
    if (!Array.isArray(parsed.provides)) {
      collector.add("error", "metadata.invalid-type", "$.provides", "provides must be an array.");
    } else {
      for (const [index, provided] of parsed.provides.entries()) {
        validateModId(provided, `$.provides[${index}]`, collector);
      }
    }
  }
  validateDependencies(parsed, collector);
  if (parsed.custom !== undefined && !isRecord(parsed.custom)) {
    collector.add(
      "error",
      "metadata.invalid-type",
      "$.custom",
      "custom must be an object when present.",
    );
  }
  return {
    mod: {
      metadataSchemaVersion,
      id,
      version,
      name,
      environment,
      entrypointGroups,
      mixinConfigurations,
      nestedJars,
      referencedFiles: references.size,
    },
    references,
  };
}

function finishResult(options: {
  collector: FabricModDiagnosticCollector;
  strength: FabricModValidationStrength;
  mod: ParsedMod | null;
  archiveProvided: boolean;
  binaryStructureChecked: boolean;
  archiveEntryChecksPerformed: boolean;
  archiveEntriesAuthoritative: boolean;
  referenceChecksPerformed: boolean;
  archiveEntries: number;
  missingReferencedFiles: number;
}): FabricModValidationResult {
  const finished = options.collector.finish();
  return {
    schemaVersion: 1,
    specification: fabricModSpecification,
    valid: options.collector.errorCount === 0,
    errorCount: options.collector.errorCount,
    warningCount: options.collector.warningCount,
    validationStrength: options.strength,
    coverage: {
      schema: "fabric.mod.json-v1-structural",
      checked: [
        "bounded JSON structure and documented field shapes",
        "mod identifiers, environments, and safe referenced paths",
        ...(options.binaryStructureChecked ? ["bounded ZIP archive structure"] : []),
        ...(options.archiveEntryChecksPerformed
          ? ["bounded archive-entry paths, duplicate paths, and file/directory layout"]
          : []),
        ...(options.referenceChecksPerformed
          ? ["referenced-file presence against parsed metadata and authoritative archive entries"]
          : []),
      ],
      notChecked: [
        "duplicate JSON members or original property order for object-valued metadata",
        "contact URL or email semantics and SPDX license validity",
        "Fabric Loader version-predicate parsing or dependency satisfaction",
        "entrypoint classes, language adapters, mixin configs, or access-widener syntax",
        "nested JAR metadata, icon pixels, or runtime loading",
        ...(!options.archiveProvided
          ? ["archive structure and referenced-file presence without archive evidence"]
          : []),
        ...(options.archiveProvided && !options.archiveEntryChecksPerformed
          ? [
              "archive-entry paths, duplicate paths, and file/directory layout because no usable archive-entry list was available",
            ]
          : []),
        ...(options.archiveProvided && !options.referenceChecksPerformed
          ? [
              !options.archiveEntriesAuthoritative
                ? "referenced-file presence because no authoritative archive-entry list was available"
                : "referenced-file presence because metadata did not parse to an object",
            ]
          : []),
      ],
    },
    diagnosticsTruncated: finished.diagnosticsTruncated,
    omittedDiagnosticCount: finished.omittedDiagnosticCount,
    mod: options.mod,
    archive: {
      provided: options.archiveProvided,
      entries: options.archiveEntries,
      missingReferencedFiles: options.missingReferencedFiles,
    },
    limits: options.collector.limits,
    diagnostics: finished.diagnostics,
  };
}

function validateFabricModInternal(
  options: FabricModValidationOptions,
  internal: {
    collector: FabricModDiagnosticCollector;
    strength: FabricModValidationStrength;
    archiveProvided: boolean;
    binaryStructureChecked?: boolean;
    archiveEntries?: number;
  },
): FabricModValidationResult {
  const { mod, references } = validateMetadata(options.metadata, internal.collector);
  const archive = validateArchiveEntries(options.archiveEntries, internal.collector);
  const referenceChecksPerformed = archive.authoritative && mod !== null;
  let missingReferencedFiles = 0;
  if (archive.authoritative) {
    const metadataLocations = archive.files.has(fabricModMetadataPath) ? 1 : 0;
    if (metadataLocations === 0) {
      internal.collector.add(
        "error",
        "archive.metadata-missing",
        `archive:${fabricModMetadataPath}`,
        "The JAR must contain fabric.mod.json at its root.",
      );
    } else if (typeof options.metadata === "string") {
      const declaredSize = archive.fileSizes.get(fabricModMetadataPath);
      const actualSize = Buffer.byteLength(options.metadata, "utf8");
      if (declaredSize !== undefined && declaredSize !== actualSize) {
        internal.collector.add(
          "error",
          "archive.metadata-size-mismatch",
          `archive:${fabricModMetadataPath}`,
          `fabric.mod.json has ${actualSize} UTF-8 bytes but archive metadata reports ${declaredSize}.`,
        );
      }
    }
    if (referenceChecksPerformed) {
      for (const [reference, sourcePath] of references) {
        if (!archive.files.has(reference)) {
          missingReferencedFiles += 1;
          internal.collector.add(
            "error",
            "archive.reference-missing",
            sourcePath,
            `Referenced archive file is missing: ${reference}`,
          );
        }
      }
    }
  }
  return finishResult({
    collector: internal.collector,
    strength: internal.strength,
    mod,
    archiveProvided: internal.archiveProvided,
    binaryStructureChecked: internal.binaryStructureChecked ?? false,
    archiveEntryChecksPerformed: archive.checksPerformed,
    archiveEntriesAuthoritative: archive.authoritative,
    referenceChecksPerformed,
    archiveEntries: internal.archiveEntries ?? archive.entries,
    missingReferencedFiles,
  });
}

/** Validates current Fabric Loader v1 metadata and optional untrusted JAR entry metadata offline. */
export function validateFabricMod(options: FabricModValidationOptions): FabricModValidationResult {
  const limits = resolveFabricModValidationLimits(options.limits);
  const collector = new FabricModDiagnosticCollector(limits);
  const archiveProvided = options.archiveEntries !== undefined;
  try {
    return validateFabricModInternal(options, {
      collector,
      strength: archiveProvided ? "metadata" : "none",
      archiveProvided,
    });
  } catch {
    collector.add(
      "error",
      "validation.inspection-failed",
      "$",
      "Fabric metadata inspection failed safely because an input value could not be read.",
    );
    return finishResult({
      collector,
      strength: archiveProvided ? "metadata" : "none",
      mod: null,
      archiveProvided,
      binaryStructureChecked: false,
      archiveEntryChecksPerformed: false,
      archiveEntriesAuthoritative: false,
      referenceChecksPerformed: false,
      archiveEntries: 0,
      missingReferencedFiles: 0,
    });
  }
}

function addArchiveDiagnostic(
  collector: FabricModDiagnosticCollector,
  diagnostic: ModrinthArchiveDiagnostic,
): void {
  collector.add(
    "error",
    diagnostic.code,
    diagnostic.path === undefined ? "archive" : `archive:${diagnostic.path}`,
    diagnostic.message,
  );
}

/** Reads and validates a local Fabric mod JAR without loading classes or contacting the network. */
export function validateFabricModJar(
  archive: Uint8Array,
  options: FabricModJarValidationOptions = {},
): FabricModValidationResult {
  const limits = resolveFabricModValidationLimits(options.limits);
  const collector = new FabricModDiagnosticCollector(limits);
  try {
    const inspected = inspectModrinthArchive(archive, {
      limits: {
        maxArchiveBytes: limits.maxArchiveBytes,
        maxArchiveEntries: limits.maxArchiveEntries,
        maxIndexBytes: limits.maxMetadataBytes,
        maxEntryUncompressedBytes: limits.maxEntryUncompressedBytes,
        maxTotalUncompressedBytes: limits.maxTotalUncompressedBytes,
        maxCompressionRatio: limits.maxCompressionRatio,
      },
      inspectModrinthIndex: false,
      capturePaths: new Set([fabricModMetadataPath]),
      maxCapturedEntryBytes: limits.maxMetadataBytes,
      maxCapturedTotalBytes: limits.maxMetadataBytes,
      addDiagnostic: (diagnostic) => addArchiveDiagnostic(collector, diagnostic),
    });
    const metadataBytes = inspected.capturedEntries.get(fabricModMetadataPath);
    let metadata: unknown = null;
    if (metadataBytes === undefined) {
      const metadataEntryPresent = inspected.entries.some(
        (entry) => entry.path === fabricModMetadataPath && !entry.directory,
      );
      if (metadataEntryPresent) {
        collector.add(
          "error",
          "archive.metadata-unreadable",
          `archive:${fabricModMetadataPath}`,
          "The root fabric.mod.json entry could not be read within the archive bounds.",
        );
      }
    } else {
      try {
        metadata = new TextDecoder("utf-8", { fatal: true }).decode(metadataBytes);
      } catch {
        collector.add(
          "error",
          "metadata.invalid-encoding",
          fabricModMetadataPath,
          "fabric.mod.json must be valid UTF-8.",
        );
      }
    }
    return validateFabricModInternal(
      {
        metadata,
        ...(inspected.entriesAuthoritative
          ? {
              archiveEntries: inspected.entries.map((entry) => ({
                path: entry.path,
                size: entry.size,
                directory: entry.directory,
              })),
            }
          : {}),
        limits,
      },
      {
        collector,
        strength: "binary",
        archiveProvided: true,
        binaryStructureChecked: true,
        archiveEntries: inspected.entries.length,
      },
    );
  } catch {
    collector.add(
      "error",
      "validation.inspection-failed",
      "archive",
      "Fabric mod JAR inspection failed safely because the input could not be read.",
    );
    return finishResult({
      collector,
      strength: "binary",
      mod: null,
      archiveProvided: true,
      binaryStructureChecked: false,
      archiveEntryChecksPerformed: false,
      archiveEntriesAuthoritative: false,
      referenceChecksPerformed: false,
      archiveEntries: 0,
      missingReferencedFiles: 0,
    });
  }
}
