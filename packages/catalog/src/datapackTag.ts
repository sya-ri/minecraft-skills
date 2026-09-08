import { type DatapackProjectFile, inspectJsonTree } from "./datapackProject.js";

export const datapackTagResolutionVersions = ["26.2", "1.21.11"] as const;
export const defaultDatapackTagResolutionLimits = Object.freeze({
  maxPacks: 32,
  maxFiles: 25_000,
  maxPathLength: 4_096,
  maxTextContentCharacters: 16 * 1_024 * 1_024,
  maxContentNodes: 250_000,
  maxContentDepth: 128,
  maxGraphOperations: 250_000,
});
export type DatapackTagResolutionLimits = {
  -readonly [Key in keyof typeof defaultDatapackTagResolutionLimits]: number;
};
export type DatapackTagPack = { id: string; files: DatapackProjectFile[] };
export type DatapackTagResolutionOptions = {
  edition?: string;
  version: string;
  registry: string;
  tag: string;
  /** Lowest priority first; the last pack has highest priority. */
  packs: DatapackTagPack[];
  /** Use cached official vanilla tag JSON as the lowest-priority pack. Never downloads. */
  includeVanilla?: boolean;
  limit?: number;
  limits?: Partial<DatapackTagResolutionLimits>;
};
export type DatapackTagSource = { pack: string; path: string; tag: string; index: number | null };
export type DatapackTagMember = {
  id: string;
  /** First contributing leaf occurrence after deduplication. */
  source: DatapackTagSource;
  evidence: "registry-index" | "file-path";
};
export type DatapackTagDiagnostic = {
  code: string;
  tag: string;
  source: DatapackTagSource | null;
  reference: string | null;
  required: boolean | null;
};
export type DatapackTagReference = {
  source: DatapackTagSource;
  reference: string;
  required: boolean;
  state: "resolved" | "unresolved" | "unverified";
};
export type DatapackTagIncompleteReason =
  | "pack-metadata-unavailable"
  | "pack-metadata-invalid"
  | "pack-overlays"
  | "pack-filters"
  | "content-unavailable"
  | "vanilla-content-unavailable"
  | "registry-index-unavailable"
  | "element-content-unvalidated"
  | "unsupported-tag-extension"
  | "invalid-tag-definition"
  | "cycle"
  | "limit-exceeded";
export type DatapackTagDefinition = {
  pack: string;
  path: string;
  tag: string;
  replace: boolean;
  effective: boolean;
  entryCount: number;
};
export type DatapackTagResolutionResult = {
  schemaVersion: 1;
  edition: "java";
  version: string;
  registry: string;
  tag: string;
  packOrder: string[];
  status: "resolved" | "incomplete" | "unresolved";
  resolutionComplete: boolean;
  resolutionIncompleteReasons: DatapackTagIncompleteReason[];
  members: DatapackTagMember[];
  memberCount: number;
  candidateMembers: DatapackTagMember[];
  candidateMemberCount: number;
  definitions: DatapackTagDefinition[];
  definitionCount: number;
  diagnostics: DatapackTagDiagnostic[];
  diagnosticCount: number;
  visitedTags: number;
  checkedReferences: number;
  references: DatapackTagReference[];
  optionalMissingReferences: number;
  exceededLimits: Array<keyof DatapackTagResolutionLimits>;
  appliedLimits: DatapackTagResolutionLimits & { maxResultsPerSection: number };
  truncated: boolean;
  notes: string[];
};

type JsonObject = Record<string, unknown>;
function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function location(value: string): string | null {
  if (value.length > 512) return null;
  const id = value.includes(":") ? value : `minecraft:${value}`;
  if (!/^[a-z0-9_.-]+:[a-z0-9/._-]+$/.test(id)) return null;
  const parts = id.split(":")[1]?.split("/") ?? [];
  return parts.some((part) => !part || part === "." || part === "..") ? null : id;
}
function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.includes("\\") &&
    !path.includes(":") &&
    ![...path].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) &&
    path.split("/").every((part) => part && part !== "." && part !== "..")
  );
}
function tagPath(registry: string, id: string): string {
  const [namespace, path] = id.split(":");
  return `data/${namespace}/tags/${registry}/${path}.json`;
}

/** Runs only after JSON.parse and bounded tree inspection have succeeded. */
function duplicateJsonKey(text: string, maxDepth: number): boolean {
  const stack: Array<{ keys: Set<string>; expectingKey: boolean } | null> = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      const start = index;
      for (index += 1; index < text.length; index += 1) {
        if (text[index] === "\\") index += 1;
        else if (text[index] === '"') break;
      }
      const frame = stack.at(-1);
      if (frame?.expectingKey) {
        const key = JSON.parse(text.slice(start, index + 1)) as string;
        if (frame.keys.has(key)) return true;
        frame.keys.add(key);
        frame.expectingKey = false;
      }
    } else if (character === "{") stack.push({ keys: new Set(), expectingKey: true });
    else if (character === "[") stack.push(null);
    else if (character === "}" || character === "]") stack.pop();
    else if (character === ",") {
      const frame = stack.at(-1);
      if (frame) frame.expectingKey = true;
    }
    if (stack.length > maxDepth + 1) throw new Error("Datapack tag content: maxContentDepth");
  }
  return false;
}

export function prepareDatapackTagResolution(options: DatapackTagResolutionOptions) {
  if (options.edition !== undefined && options.edition !== "java") {
    throw new Error("Datapack tag resolution supports only Java Edition");
  }
  if (!(datapackTagResolutionVersions as readonly string[]).includes(options.version)) {
    throw new Error("Datapack tag resolution requires exact version 26.2 or 1.21.11");
  }
  const registry = typeof options.registry === "string" ? location(options.registry) : null;
  const tag = typeof options.tag === "string" ? location(options.tag) : null;
  if (!registry?.startsWith("minecraft:") || !tag) {
    throw new Error(
      "Datapack tag resolution requires a vanilla registry and a valid tag ID without #",
    );
  }
  if (options.includeVanilla !== undefined && typeof options.includeVanilla !== "boolean") {
    throw new Error("Datapack tag resolution includeVanilla must be boolean");
  }
  const limits: DatapackTagResolutionLimits = { ...defaultDatapackTagResolutionLimits };
  for (const key of Object.keys(limits) as Array<keyof DatapackTagResolutionLimits>) {
    const value = options.limits?.[key] ?? limits[key];
    if (!Number.isSafeInteger(value) || value < 1 || value > limits[key]) {
      throw new Error(`Datapack tag resolution ${key} must be between 1 and ${limits[key]}`);
    }
    limits[key] = value;
  }
  const limit = options.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error("Datapack tag resolution limit must be between 1 and 1000");
  }
  if (!Array.isArray(options.packs) || options.packs.length > limits.maxPacks) {
    throw new Error(`Datapack tag resolution accepts at most ${limits.maxPacks} ordered packs`);
  }
  const ids = new Set<string>();
  let files = 0;
  let characters = 0;
  let nodes = 0;
  const packs = options.packs.map((pack) => {
    if (
      !object(pack) ||
      typeof pack.id !== "string" ||
      !/^[a-zA-Z0-9_.-]{1,128}$/.test(pack.id) ||
      pack.id === "vanilla" ||
      ids.has(pack.id)
    ) {
      throw new Error(
        "Datapack tag pack IDs must be unique safe names (1-128 characters), excluding vanilla",
      );
    }
    ids.add(pack.id);
    if (!Array.isArray(pack.files)) {
      throw new Error("Datapack tag packs require a files array");
    }
    files += pack.files.length;
    if (files > limits.maxFiles) {
      throw new Error(`Datapack tag resolution accepts at most ${limits.maxFiles} total files`);
    }
    const paths = new Set<string>();
    const parsed = new Map<string, unknown>();
    for (const file of pack.files) {
      if (
        !object(file) ||
        typeof file.path !== "string" ||
        file.path.length > limits.maxPathLength ||
        !safePath(file.path) ||
        paths.has(file.path)
      ) {
        throw new Error("Datapack tag files require unique, safe, bounded pack-relative paths");
      }
      paths.add(file.path);
      if (file.content === undefined) continue;
      let content: unknown = file.content;
      const text = typeof content === "string";
      if (text) {
        characters += (content as string).length;
        if (characters > limits.maxTextContentCharacters)
          throw new Error("Datapack tag content exceeds maxTextContentCharacters");
        if (!/\.(json|mcmeta)$/.test(file.path)) continue;
        try {
          content = JSON.parse(content as string) as unknown;
        } catch {
          content = null;
        }
      }
      const inspected = inspectJsonTree(content, {
        maxNodes: limits.maxContentNodes - nodes,
        maxDepth: limits.maxContentDepth,
        maxTextCharacters: limits.maxTextContentCharacters - characters,
        countTextCharacters: !text,
      });
      nodes += inspected.nodes;
      characters += inspected.textCharacters;
      if (inspected.error || inspected.exceeded)
        throw new Error(`Datapack tag content: ${inspected.error ?? inspected.exceeded}`);
      if (
        typeof file.content === "string" &&
        content !== null &&
        duplicateJsonKey(file.content, limits.maxContentDepth)
      ) {
        throw new Error("Datapack tag JSON text contains duplicate object keys");
      }
      parsed.set(file.path, content);
    }
    return { id: pack.id, paths, parsed };
  });
  return {
    version: options.version,
    registry,
    tag,
    packs,
    includeVanilla: options.includeVanilla ?? true,
    limits,
    limit,
  };
}

export type DatapackTagEvidence = {
  registryEntries: ReadonlySet<string>;
  registryIndexAvailable: boolean;
  fileBacked: boolean;
  vanillaPaths: ReadonlySet<string>;
  readVanillaTag: (path: string) => unknown;
};
type Entry = { id: string; tag: boolean; required: boolean; source: DatapackTagSource };
type TagResult = {
  state: "loaded" | "missing" | "failed" | "unknown";
  members: Map<string, DatapackTagMember>;
};

export function resolveDatapackTagGraph(
  input: ReturnType<typeof prepareDatapackTagResolution>,
  evidence: DatapackTagEvidence,
): DatapackTagResolutionResult {
  const registryPath = input.registry.slice("minecraft:".length);
  const reasons = new Set<DatapackTagIncompleteReason>();
  const exceeded = new Set<keyof DatapackTagResolutionLimits>();
  const diagnostics: DatapackTagDiagnostic[] = [];
  const definitions: DatapackTagDefinition[] = [];
  const references: DatapackTagReference[] = [];
  let diagnosticCount = 0;
  let definitionCount = 0;
  let checkedReferences = 0;
  let optionalMissingReferences = 0;
  let operations = 0;
  const diagnostic = (code: string, tag: string, entry?: Entry, source?: DatapackTagSource) => {
    diagnosticCount += 1;
    if (diagnostics.length < input.limit)
      diagnostics.push({
        code,
        tag,
        source: entry?.source ?? source ?? null,
        reference: entry ? `${entry.tag ? "#" : ""}${entry.id}` : null,
        required: entry?.required ?? null,
      });
  };
  const spend = () => {
    if (++operations <= input.limits.maxGraphOperations) return true;
    reasons.add("limit-exceeded");
    exceeded.add("maxGraphOperations");
    return false;
  };
  for (const pack of input.packs) {
    const metadata = pack.parsed.get("pack.mcmeta");
    const metadataSource = { pack: pack.id, path: "pack.mcmeta", tag: input.tag, index: null };
    if (metadata === undefined) {
      reasons.add("pack-metadata-unavailable");
      diagnostic("pack-metadata-unavailable", input.tag, undefined, metadataSource);
    } else if (!object(metadata) || !object(metadata.pack)) {
      reasons.add("pack-metadata-invalid");
      diagnostic("pack-metadata-invalid", input.tag, undefined, metadataSource);
    }
    if (object(metadata)) {
      if (Object.hasOwn(metadata, "overlays")) reasons.add("pack-overlays");
      if (Object.hasOwn(metadata, "filter")) reasons.add("pack-filters");
    }
  }
  const memo = new Map<string, TagResult>();
  const visiting = new Set<string>();
  const empty = (state: TagResult["state"]): TagResult => ({ state, members: new Map() });
  const visit = (id: string, depth: number): TagResult => {
    if (!spend()) return empty("unknown");
    const cached = memo.get(id);
    if (cached) return cached;
    if (visiting.has(id)) {
      reasons.add("cycle");
      diagnostic("tag-cycle", id);
      return empty("unknown");
    }
    if (depth > input.limits.maxContentDepth) {
      exceeded.add("maxContentDepth");
      reasons.add("limit-exceeded");
      return empty("unknown");
    }
    visiting.add(id);
    const path = tagPath(registryPath, id);
    const layers: Array<{ pack: string; content: unknown; missing: boolean }> = [];
    if (input.includeVanilla && evidence.vanillaPaths.has(path)) {
      let content: unknown;
      try {
        content = evidence.readVanillaTag(path);
      } catch {
        content = undefined;
      }
      layers.push({ pack: "vanilla", content, missing: content === undefined });
    }
    for (const pack of input.packs) {
      if (pack.paths.has(path))
        layers.push({
          pack: pack.id,
          content: pack.parsed.get(path),
          missing: !pack.parsed.has(path),
        });
    }
    let entries: Entry[] = [];
    let unknown = false;
    let present = false;
    let effectiveDefinitions: DatapackTagDefinition[] = [];
    const localReasons = new Set<DatapackTagIncompleteReason>();
    for (const layer of layers) {
      if (!spend()) {
        unknown = true;
        break;
      }
      if (layer.missing) {
        unknown = true;
        diagnostic("tag-content-unavailable", id, undefined, {
          pack: layer.pack,
          path,
          tag: id,
          index: null,
        });
        localReasons.add(
          layer.pack === "vanilla" ? "vanilla-content-unavailable" : "content-unavailable",
        );
        continue;
      }
      const content = layer.content;
      if (
        !object(content) ||
        !Array.isArray(content.values) ||
        (content.replace !== undefined && typeof content.replace !== "boolean")
      ) {
        diagnostic("invalid-tag-definition", id, undefined, {
          pack: layer.pack,
          path,
          tag: id,
          index: null,
        });
        unknown = true;
        localReasons.add("invalid-tag-definition");
        continue;
      }
      const parsed: Entry[] = [];
      let valid = true;
      let invalidIndex: number | null = null;
      for (let index = 0; index < content.values.length; index += 1) {
        if (!spend()) {
          unknown = true;
          valid = false;
          break;
        }
        const value: unknown = content.values[index];
        const raw = typeof value === "string" ? value : object(value) ? value.id : null;
        const required = object(value) && value.required !== undefined ? value.required : true;
        const nested = typeof raw === "string" && raw.startsWith("#");
        const entryId = typeof raw === "string" ? location(nested ? raw.slice(1) : raw) : null;
        if (!entryId || typeof required !== "boolean") {
          valid = false;
          invalidIndex = index;
          break;
        }
        parsed.push({
          id: entryId,
          tag: nested,
          required,
          source: { pack: layer.pack, path, tag: id, index },
        });
      }
      if (!valid) {
        unknown = true;
        if (invalidIndex !== null) {
          localReasons.add("invalid-tag-definition");
          diagnostic("invalid-tag-entry", id, undefined, {
            pack: layer.pack,
            path,
            tag: id,
            index: invalidIndex,
          });
        }
        continue;
      }
      present = true;
      if (content.replace === true) {
        entries = [];
        unknown = false;
        localReasons.clear();
        for (const definition of effectiveDefinitions) definition.effective = false;
        effectiveDefinitions = [];
      }
      if (Object.hasOwn(content, "remove")) localReasons.add("unsupported-tag-extension");
      entries = entries.concat(parsed);
      const definition = {
        pack: layer.pack,
        path,
        tag: id,
        replace: content.replace === true,
        effective: true,
        entryCount: parsed.length,
      };
      definitionCount += 1;
      if (definitions.length < input.limit) definitions.push(definition);
      effectiveDefinitions.push(definition);
    }
    for (const reason of localReasons) reasons.add(reason);
    const members = new Map<string, DatapackTagMember>();
    let failed = false;
    for (const entry of entries) {
      if (!spend()) {
        unknown = true;
        break;
      }
      checkedReferences += 1;
      const reference: DatapackTagReference = {
        source: entry.source,
        reference: `${entry.tag ? "#" : ""}${entry.id}`,
        required: entry.required,
        state: "unverified",
      };
      if (references.length < input.limit) references.push(reference);
      if (entry.tag) {
        const nested = visit(entry.id, depth + 1);
        if (nested.state === "unknown") unknown = true;
        else if (nested.state !== "loaded") {
          reference.state = "unresolved";
          diagnostic(
            entry.required ? "required-tag-unresolved" : "optional-tag-skipped",
            id,
            entry,
          );
          if (entry.required) failed = true;
          else optionalMissingReferences += 1;
        } else {
          reference.state = "resolved";
          for (const [memberId, member] of nested.members) {
            if (!spend()) {
              unknown = true;
              break;
            }
            if (!members.has(memberId)) members.set(memberId, member);
          }
        }
      } else {
        const [namespace, elementPath] = entry.id.split(":");
        const elementFile = `data/${namespace}/${registryPath}/${elementPath}.${registryPath === "function" ? "mcfunction" : "json"}`;
        const localElement =
          evidence.fileBacked && input.packs.some((pack) => pack.paths.has(elementFile));
        const vanillaElement = evidence.fileBacked && evidence.vanillaPaths.has(elementFile);
        if (evidence.registryEntries.has(entry.id) || localElement || vanillaElement) {
          reference.state = "resolved";
          if (localElement) reasons.add("element-content-unvalidated");
          if (!members.has(entry.id))
            members.set(entry.id, {
              id: entry.id,
              source: entry.source,
              evidence: evidence.fileBacked ? "file-path" : "registry-index",
            });
        } else if (!evidence.fileBacked && !evidence.registryIndexAvailable) {
          reasons.add("registry-index-unavailable");
          diagnostic("element-unverified", id, entry);
          unknown = true;
        } else {
          reference.state = "unresolved";
          diagnostic(
            entry.required ? "required-element-missing" : "optional-element-skipped",
            id,
            entry,
          );
          if (entry.required) failed = true;
          else optionalMissingReferences += 1;
        }
      }
    }
    visiting.delete(id);
    const state = unknown ? "unknown" : failed ? "failed" : present ? "loaded" : "missing";
    const result: TagResult = { state, members: state === "loaded" ? members : new Map() };
    memo.set(id, result);
    return result;
  };
  const root = visit(input.tag, 0);
  if (root.state === "missing") diagnostic("tag-missing", input.tag);
  const status =
    root.state === "unknown" || reasons.size > 0
      ? "incomplete"
      : root.state === "failed" || root.state === "missing"
        ? "unresolved"
        : "resolved";
  const members = [...root.members.values()];
  return {
    schemaVersion: 1,
    edition: "java",
    version: input.version,
    registry: input.registry,
    tag: input.tag,
    packOrder: [
      ...(input.includeVanilla ? ["vanilla"] : []),
      ...input.packs.map((pack) => pack.id),
    ],
    status,
    resolutionComplete: status === "resolved",
    resolutionIncompleteReasons: [...reasons].sort(),
    members: status === "resolved" ? members.slice(0, input.limit) : [],
    memberCount: status === "resolved" ? members.length : 0,
    candidateMembers: status === "incomplete" ? members.slice(0, input.limit) : [],
    candidateMemberCount: status === "incomplete" ? members.length : 0,
    definitions,
    definitionCount,
    diagnostics,
    diagnosticCount,
    visitedTags: memo.size,
    checkedReferences,
    references,
    optionalMissingReferences,
    exceededLimits: [...exceeded].sort(),
    appliedLimits: { ...input.limits, maxResultsPerSection: input.limit },
    truncated:
      members.length > input.limit ||
      definitionCount > definitions.length ||
      diagnosticCount > diagnostics.length ||
      checkedReferences > references.length,
    notes: [
      "Packs are ordered from lowest to highest priority. Only the selected registry/tag and its reachable tag dependencies are resolved.",
      "Members preserve first occurrence order and first leaf provenance. Definitions record append/replace contributors; source.index is the zero-based values index.",
      "Incomplete results expose candidateMembers separately; a required missing reference never returns a partial loaded tag.",
      "Pack activation, format compatibility, overlays, filters, feature flags, mod extensions, registry JSON decoding and function compilation are outside this resolver. Validate packs separately before loading them.",
      "Cycles, including optional dependency cycles, remain incomplete; Minecraft dependency-sorter tie breaking is not emulated.",
    ],
  };
}
