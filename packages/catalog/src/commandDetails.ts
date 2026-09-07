import { getDataManifest, hasDataFile, readDataJson } from "@minecraft-skills/data";
import type { BlockStateSource } from "./blockStates.js";

export const commandDetailLimits = Object.freeze({
  maxDepth: 128,
  maxNodes: 100000,
  maxResultDepth: 8,
  maxResultNodes: 2000,
});
export type CommandNode = {
  type: "root" | "literal" | "argument";
  executable: boolean;
  parser?: string;
  properties?: Record<string, string | number | boolean>;
  redirect?: string[];
  children: Record<string, CommandNode>;
};
export type CommandTreeSurface = {
  schemaVersion: 1;
  version: string;
  source: BlockStateSource;
  nodeCount: number;
  root: CommandNode;
};
export type CommandDetailsOptions = {
  version: string;
  path?: string[];
  depth?: number;
  limit?: number;
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Command node must be an object");
  return value as Record<string, unknown>;
}
function name(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    [...value].every((character) => character.charCodeAt(0) >= 32)
  );
}
export function buildCommandTreeSurface(
  report: unknown,
  version: string,
  source: BlockStateSource,
): CommandTreeSurface {
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/.test(version))
    throw new Error("Invalid command tree version");
  if (
    source.kind !== "official-generated" ||
    !/^[a-f0-9]{40}$/.test(source.serverSha1) ||
    source.url !== `https://piston-data.mojang.com/v1/objects/${source.serverSha1}/server.jar` ||
    !/^[a-f0-9]{64}$/.test(source.reportSha256) ||
    !Number.isFinite(Date.parse(source.retrievedAt))
  )
    throw new Error("Invalid command tree source provenance");
  let nodeCount = 0;
  const visit = (value: unknown, depth: number): CommandNode => {
    if (depth > commandDetailLimits.maxDepth || ++nodeCount > commandDetailLimits.maxNodes)
      throw new Error("Command tree exceeds traversal limits");
    const raw = object(value);
    if (raw.type !== "root" && raw.type !== "literal" && raw.type !== "argument")
      throw new Error("Invalid command node type");
    if ((depth === 0) !== (raw.type === "root"))
      throw new Error("Command root must occur only at the root");
    if (raw.executable !== undefined && typeof raw.executable !== "boolean")
      throw new Error("Invalid executable marker");
    if (raw.parser !== undefined && !name(raw.parser)) throw new Error("Invalid command parser");
    if (raw.type === "argument" && raw.parser === undefined)
      throw new Error("Argument node lacks parser evidence");
    const result: CommandNode = {
      type: raw.type,
      executable: raw.executable === true,
      children: {},
    };
    if (typeof raw.parser === "string") result.parser = raw.parser;
    if (raw.properties !== undefined) {
      const properties = object(raw.properties);
      if (
        Object.keys(properties).length > 64 ||
        Object.entries(properties).some(
          ([key, v]) =>
            !name(key) ||
            !(
              typeof v === "boolean" ||
              (typeof v === "string" && v.length <= 4096) ||
              (typeof v === "number" && Number.isFinite(v))
            ),
        )
      )
        throw new Error("Invalid parser properties");
      result.properties = { ...properties } as Record<string, string | number | boolean>;
    }
    if (raw.redirect !== undefined) {
      if (
        !Array.isArray(raw.redirect) ||
        raw.redirect.length > 128 ||
        raw.redirect.some((v) => !name(v))
      )
        throw new Error("Invalid command redirect");
      result.redirect = [...raw.redirect];
    }
    const children = raw.children === undefined ? {} : object(raw.children);
    if (Object.keys(children).length > 2048) throw new Error("Command node exceeds children limit");
    result.children = Object.fromEntries(
      Object.entries(children)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => {
          if (!name(key)) throw new Error("Invalid command child name");
          return [key, visit(value, depth + 1)];
        }),
    );
    return result;
  };
  const root = visit(report, 0);
  return { schemaVersion: 1, version, source, nodeCount, root };
}
export function readCommandDetails(options: CommandDetailsOptions) {
  const { version } = options,
    path = options.path ?? [],
    depth = options.depth ?? 1,
    limit = options.limit ?? 100;
  if (
    !/^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/.test(version) ||
    !Array.isArray(path) ||
    path.length > 128 ||
    path.some((p) => !name(p))
  )
    throw new Error("Invalid command lookup version or path");
  if (
    !Number.isInteger(depth) ||
    depth < 0 ||
    depth > commandDetailLimits.maxResultDepth ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > commandDetailLimits.maxResultNodes
  )
    throw new Error("Invalid command result limits");
  const dataPath = `java/command-trees/${version}.json`,
    base = { schemaVersion: 1 as const, version, path };
  const downloadable = getDataManifest().downloadable.some(
    (e) => e.path === dataPath && e.kind === "command-tree-surface",
  );
  if (!hasDataFile(dataPath))
    return {
      ...base,
      status: "unavailable" as const,
      reason: downloadable ? "data-not-cached" : "unsupported-version",
      fetch: downloadable ? { kind: "command-tree-surface", version } : null,
    };
  const stored = readDataJson<CommandTreeSurface>(dataPath);
  if (stored.schemaVersion !== 1 || stored.version !== version)
    throw new Error("Command surface version mismatch");
  const surface = buildCommandTreeSurface(stored.root, version, stored.source);
  if (stored.nodeCount !== surface.nodeCount)
    throw new Error("Command surface node count mismatch");
  let selected = surface.root;
  for (const segment of path) {
    if (!Object.hasOwn(selected.children, segment))
      return { ...base, status: "not-found" as const, source: surface.source };
    const child = selected.children[segment];
    if (!child) throw new Error("Invalid command child");
    selected = child;
  }
  type ResultNode = Omit<CommandNode, "children"> & { path: string[]; children: string[] };
  const nodes: ResultNode[] = [],
    reasons = new Set<string>();
  const queue = [{ node: selected, path, depth: 0 }];
  for (let i = 0; i < queue.length; i++) {
    if (nodes.length === limit) {
      reasons.add("node-limit");
      break;
    }
    const current = queue[i];
    if (!current) break;
    const { children, ...facts } = current.node;
    nodes.push({ ...facts, path: current.path, children: Object.keys(children) });
    if (Object.keys(children).length && current.depth === depth) reasons.add("depth-limit");
    else
      for (const [key, node] of Object.entries(children))
        queue.push({ node, path: [...current.path, key], depth: current.depth + 1 });
  }
  return {
    ...base,
    status: "available" as const,
    source: surface.source,
    depth,
    limit,
    returned: nodes.length,
    truncated: reasons.size > 0,
    truncationReasons: [...reasons],
    nodes,
    nonClaims: [
      "This is an official generated syntax tree, not command execution or context-dependent suggestions. Report permission predicates are not returned or evaluated. Only explicit report redirects are returned; missing redirects are not inferred.",
    ],
  };
}
