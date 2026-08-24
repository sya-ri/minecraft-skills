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
  message: string;
};

export type ResourcepackProjectValidationOptions = {
  files: ResourcepackProjectFile[];
  edition?: string;
  version?: string;
  limit?: number;
};

export type ResourcepackProjectValidationResult = {
  schemaVersion: 1;
  edition: "java";
  version: string;
  valid: boolean;
  totalFiles: number;
  modelFiles: number;
  itemDefinitionFiles: number;
  binaryFiles: number;
  parsedJsonFiles: number;
  checkedReferences: number;
  errorCount: number;
  warningCount: number;
  diagnosticTotal: number;
  truncated: boolean;
  diagnostics: ResourcepackProjectDiagnostic[];
  notes: string[];
};

type ResolvedValidationOptions = {
  files: ResourcepackProjectFile[];
  version: string;
  vanillaPaths: readonly string[];
  limit: number;
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

const resourceLocationPattern = /^([a-z0-9_.-]+):([a-z0-9/._-]+)$/;
const builtInModelReferences = new Set(["builtin/entity", "builtin/generated"]);
const graphAssetCategories = new Set(["items", "models", "textures"]);

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
        : { error: "Resource-pack model JSON must contain an object at the document root." };
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
  if (Array.isArray(value)) {
    if (visited.has(value)) {
      return;
    }
    visited.add(value);
    for (const entry of value) {
      collectItemModelReferences(entry, references, visited);
    }
    return;
  }
  if (!isJsonObject(value) || visited.has(value)) {
    return;
  }
  visited.add(value);
  const type = typeof value.type === "string" ? value.type : null;
  if ((type === "minecraft:model" || type === "model") && typeof value.model === "string") {
    references.push(value.model);
  }
  if ((type === "minecraft:special" || type === "special") && typeof value.base === "string") {
    references.push(value.base);
  }
  for (const key of Object.keys(value).sort()) {
    collectItemModelReferences(value[key], references, visited);
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

function collectModelTextureVariableReferences(
  value: unknown,
  references: string[],
  visited: Set<object>,
): void {
  if (Array.isArray(value)) {
    if (visited.has(value)) {
      return;
    }
    visited.add(value);
    for (const entry of value) {
      collectModelTextureVariableReferences(entry, references, visited);
    }
    return;
  }
  if (!isJsonObject(value) || visited.has(value)) {
    return;
  }
  visited.add(value);
  for (const key of Object.keys(value).sort()) {
    if (key === "textures") {
      continue;
    }
    const entry = value[key];
    if (key === "texture" && typeof entry === "string") {
      references.push(entry);
    }
    collectModelTextureVariableReferences(entry, references, visited);
  }
}

function localParentChain(options: {
  root: ParsedModel;
  modelsByPath: ReadonlyMap<string, ParsedModel>;
}): ParsedModel[] {
  const chain: ParsedModel[] = [];
  const visited = new Set<string>();
  let current: ParsedModel | undefined = options.root;
  while (current && !visited.has(current.file.normalizedPath)) {
    visited.add(current.file.normalizedPath);
    chain.push(current);
    const parentPath: string | null = current.parent ? modelAssetPath(current.parent) : null;
    current = parentPath ? options.modelsByPath.get(parentPath) : undefined;
  }
  return chain;
}

function resolveTextureVariable(options: {
  contextRoot: ParsedModel;
  variable: string;
  modelsByPath: ReadonlyMap<string, ParsedModel>;
  vanillaPaths: ReadonlySet<string>;
  visitedVariables: Set<string>;
}): TextureVariableResolution {
  if (options.visitedVariables.has(options.variable)) {
    return { status: "cycle", reference: `#${options.variable}` };
  }
  options.visitedVariables.add(options.variable);

  const chain = localParentChain({
    root: options.contextRoot,
    modelsByPath: options.modelsByPath,
  });
  for (const model of chain) {
    const textures = isJsonObject(model.json.textures) ? model.json.textures : null;
    if (textures && Object.hasOwn(textures, options.variable)) {
      const value = textures[options.variable];
      if (typeof value !== "string") {
        return { status: "invalid", reference: `#${options.variable}` };
      }
      if (!value.startsWith("#")) {
        return resourceLocation(value)
          ? { status: "resolved", reference: value }
          : { status: "invalid", reference: value };
      }
      return resolveTextureVariable({
        ...options,
        variable: value.slice(1),
      });
    }
  }

  const lastModel = chain.at(-1);
  if (!lastModel?.parent) {
    return { status: "missing", reference: `#${options.variable}` };
  }
  const parentReference = lastModel.parent;
  if (builtInModelReferences.has(parentReference.replace(/^minecraft:/, ""))) {
    return { status: "missing", reference: `#${options.variable}` };
  }
  const parentPath = modelAssetPath(parentReference);
  if (!parentPath) {
    return { status: "missing", reference: `#${options.variable}` };
  }
  if (options.vanillaPaths.has(parentPath)) {
    return { status: "unknown", reference: `#${options.variable}` };
  }
  return { status: "missing", reference: `#${options.variable}` };
}

function canonicalCycle(cycle: string[]): string[] {
  let best = cycle;
  for (let index = 1; index < cycle.length; index += 1) {
    const rotated = [...cycle.slice(index), ...cycle.slice(0, index)];
    if (rotated.join("\0") < best.join("\0")) {
      best = rotated;
    }
  }
  return best;
}

export function validateResourcepackReferenceGraph(
  options: ResolvedValidationOptions,
): ResourcepackProjectValidationResult {
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
  const diagnostics: ResourcepackProjectDiagnostic[] = [];
  const diagnosticKeys = new Set<string>();
  let parsedJsonFiles = 0;
  let checkedReferences = 0;

  const addDiagnostic = (diagnostic: ResourcepackProjectDiagnostic): void => {
    const key = [diagnostic.severity, diagnostic.code, diagnostic.path, diagnostic.reference].join(
      "\0",
    );
    if (!diagnosticKeys.has(key)) {
      diagnosticKeys.add(key);
      diagnostics.push(diagnostic);
    }
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
          "Resource-pack item, model, and texture asset paths must use lowercase resource-location-safe namespaces and path segments.",
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
        addDiagnostic({
          severity: "error",
          code: "invalid-model-reference",
          path: itemDefinition.file.normalizedPath,
          reference,
          message: `Item definition model reference '${reference}' is not a valid resource location.`,
        });
      } else if (!assetExists(path)) {
        addDiagnostic({
          severity: "error",
          code: "missing-item-model",
          path: itemDefinition.file.normalizedPath,
          reference,
          message: `Item definition model '${reference}' was not found locally or in vanilla assets for ${options.version}.`,
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
        addDiagnostic({
          severity: "error",
          code: "invalid-model-parent",
          path: model.file.normalizedPath,
          reference: model.parent,
          message: `Model parent '${model.parent}' is not a valid resource location.`,
        });
      } else if (!builtIn && parentPath && !assetExists(parentPath)) {
        addDiagnostic({
          severity: "error",
          code: "missing-model-parent",
          path: model.file.normalizedPath,
          reference: model.parent,
          message: `Model parent '${model.parent}' was not found locally or in vanilla assets for ${options.version}.`,
        });
      } else if (!builtIn && parentPath && modelsByPath.has(parentPath)) {
        parentEdges.set(model.file.normalizedPath, parentPath);
      }
    }

    for (const reference of collectLegacyOverrideModelReferences(model.json)) {
      checkedReferences += 1;
      const path = modelAssetPath(reference);
      if (!path) {
        addDiagnostic({
          severity: "error",
          code: "invalid-model-override",
          path: model.file.normalizedPath,
          reference,
          message: `Legacy model override '${reference}' is not a valid resource location.`,
        });
      } else if (!assetExists(path)) {
        addDiagnostic({
          severity: "error",
          code: "missing-model-override",
          path: model.file.normalizedPath,
          reference,
          message: `Legacy model override '${reference}' was not found locally or in vanilla assets for ${options.version}.`,
        });
      } else if (modelsByPath.has(path)) {
        explicitModelRoots.add(path);
      }
    }
  }

  const referencedAsLocalParent = new Set(parentEdges.values());
  const contextRoots = [...modelsByPath.values()]
    .filter(
      (model) =>
        explicitModelRoots.has(model.file.normalizedPath) ||
        !referencedAsLocalParent.has(model.file.normalizedPath),
    )
    .sort((left, right) => left.file.normalizedPath.localeCompare(right.file.normalizedPath));
  for (const contextRoot of contextRoots) {
    const usages: Array<{ reference: string; sourcePath: string }> = [];
    for (const sourceModel of localParentChain({ root: contextRoot, modelsByPath })) {
      const textures = isJsonObject(sourceModel.json.textures) ? sourceModel.json.textures : null;
      if (textures) {
        for (const key of Object.keys(textures).sort()) {
          usages.push({ reference: `#${key}`, sourcePath: sourceModel.file.normalizedPath });
        }
      }
      const references: string[] = [];
      collectModelTextureVariableReferences(sourceModel.json, references, new Set());
      for (const reference of references.sort()) {
        if (reference.startsWith("#")) {
          usages.push({ reference, sourcePath: sourceModel.file.normalizedPath });
        } else {
          checkedReferences += 1;
          addDiagnostic({
            severity: "error",
            code: "invalid-texture-reference",
            path: contextRoot.file.normalizedPath,
            reference,
            message: `Model face texture '${reference}' used by '${sourceModel.file.normalizedPath}' must reference a texture variable beginning with '#'.`,
          });
        }
      }
    }
    usages.sort(
      (left, right) =>
        left.reference.localeCompare(right.reference) ||
        left.sourcePath.localeCompare(right.sourcePath),
    );
    for (const usage of usages) {
      checkedReferences += 1;
      const resolved = resolveTextureVariable({
        contextRoot,
        variable: usage.reference.slice(1),
        modelsByPath,
        vanillaPaths,
        visitedVariables: new Set(),
      });
      if (resolved.status === "resolved") {
        const texturePath = textureAssetPath(resolved.reference);
        if (texturePath && !assetExists(texturePath)) {
          addDiagnostic({
            severity: "error",
            code: "missing-texture",
            path: contextRoot.file.normalizedPath,
            reference: resolved.reference,
            message: `Texture '${resolved.reference}' used by '${usage.sourcePath}' was not found locally or in vanilla assets for ${options.version}.`,
          });
        }
        continue;
      }
      if (resolved.status === "unknown") {
        addDiagnostic({
          severity: "warning",
          code: "unverified-vanilla-texture-variable",
          path: contextRoot.file.normalizedPath,
          reference: resolved.reference,
          message: `Texture variable '${resolved.reference}' used by '${usage.sourcePath}' could only be resolved from a vanilla parent whose contents are not bundled.`,
        });
        continue;
      }
      if (resolved.status === "invalid") {
        addDiagnostic({
          severity: "error",
          code: "invalid-texture-reference",
          path: contextRoot.file.normalizedPath,
          reference: resolved.reference,
          message: `Texture variable '${usage.reference}' used by '${usage.sourcePath}' resolves to invalid texture reference '${resolved.reference}'.`,
        });
        continue;
      }
      addDiagnostic({
        severity: "error",
        code: resolved.status === "cycle" ? "texture-variable-cycle" : "missing-texture-variable",
        path: contextRoot.file.normalizedPath,
        reference: resolved.reference,
        message:
          resolved.status === "cycle"
            ? `Texture variable '${resolved.reference}' used by '${usage.sourcePath}' resolves through a cycle in this model context.`
            : `Texture variable '${resolved.reference}' used by '${usage.sourcePath}' is not defined by this model context or its local parents.`,
      });
    }
  }

  const visitState = new Map<string, "visiting" | "visited">();
  const cycleKeys = new Set<string>();
  const visitParent = (path: string, stack: string[]): void => {
    const state = visitState.get(path);
    if (state === "visited") {
      return;
    }
    if (state === "visiting") {
      const start = stack.indexOf(path);
      if (start !== -1) {
        const cycle = canonicalCycle(stack.slice(start));
        const key = cycle.join("\0");
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          const first = cycle[0];
          if (first) {
            const reference = [...cycle, first]
              .map((entry) => modelsByPath.get(entry)?.id ?? entry)
              .join(" -> ");
            addDiagnostic({
              severity: "error",
              code: "model-parent-cycle",
              path: first,
              reference,
              message: `Model parent references form a cycle: ${reference}.`,
            });
          }
        }
      }
      return;
    }
    visitState.set(path, "visiting");
    const parent = parentEdges.get(path);
    if (parent) {
      visitParent(parent, [...stack, path]);
    }
    visitState.set(path, "visited");
  };
  for (const path of [...modelsByPath.keys()].sort()) {
    visitParent(path, []);
  }

  diagnostics.sort(
    (left, right) =>
      left.severity.localeCompare(right.severity) ||
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      (left.reference ?? "").localeCompare(right.reference ?? ""),
  );
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = diagnostics.length - errorCount;

  return {
    schemaVersion: 1,
    edition: "java",
    version: options.version,
    valid: errorCount === 0,
    totalFiles: projectFiles.length,
    modelFiles: modelsByPath.size,
    itemDefinitionFiles: itemDefinitions.length,
    binaryFiles: projectFiles.filter((file) => binaryAssetPath(file.normalizedPath)).length,
    parsedJsonFiles,
    checkedReferences,
    errorCount,
    warningCount,
    diagnosticTotal: diagnostics.length,
    truncated: diagnostics.length > options.limit,
    diagnostics: diagnostics.slice(0, options.limit),
    notes: [
      `Vanilla references were checked against the bundled Java ${options.version} resource-pack path index.`,
      "PNG and OGG files were indexed by path and were not decoded as text.",
      "Texture variables inherited only from a vanilla parent produce warnings because vanilla model contents are not bundled in this validation surface.",
    ],
  };
}
