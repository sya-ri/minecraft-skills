import { getDataManifest, hasDataFile, readDataJson } from "@minecraft-skills/data";

export const blockStateLimits = Object.freeze({
  maxBlocks: 10000,
  maxStatesPerBlock: 32768,
  maxTotalStates: 1000000,
  maxProperties: 64,
  maxValues: 256,
  maxResultStates: 4096,
});
export type BlockState = { id: number; properties: Record<string, string>; default?: boolean };
export type BlockStateDefinition = { properties: Record<string, string[]>; states: BlockState[] };
export type BlockStateSource = {
  kind: "official-generated";
  url: string;
  serverSha1: string;
  reportSha256: string;
  retrievedAt: string;
};
export type BlockStateSurface = {
  schemaVersion: 1;
  version: string;
  source: BlockStateSource;
  blockCount: number;
  stateCount: number;
  blocks: Record<string, BlockStateDefinition>;
};
export type BlockStateDefinitionOptions = {
  version: string;
  blockId: string;
  offset?: number;
  limit?: number;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function token(value: string): boolean {
  return /^[a-z0-9_]+$/.test(value) && value.length <= 128;
}
function normalizeBlock(value: unknown, label: string): BlockStateDefinition {
  const block = record(value, label);
  const rawProperties =
    block.properties === undefined ? {} : record(block.properties, `${label}.properties`);
  const entries = Object.entries(rawProperties);
  if (entries.length > blockStateLimits.maxProperties)
    throw new Error(`${label} exceeds property limit`);
  const properties = Object.fromEntries(
    entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, values]) => {
        if (
          !token(name) ||
          !Array.isArray(values) ||
          values.length === 0 ||
          values.length > blockStateLimits.maxValues ||
          values.some((v) => typeof v !== "string" || !token(v)) ||
          new Set(values).size !== values.length
        )
          throw new Error(`${label} has invalid property values`);
        return [name, [...values] as string[]];
      }),
  );
  if (
    !Array.isArray(block.states) ||
    block.states.length === 0 ||
    block.states.length > blockStateLimits.maxStatesPerBlock
  )
    throw new Error(`${label} has invalid states`);
  const ids = new Set<number>();
  const tuples = new Set<string>();
  let defaults = 0;
  const states = block.states.map((raw): BlockState => {
    const state = record(raw, `${label}.state`);
    if (
      typeof state.id !== "number" ||
      !Number.isSafeInteger(state.id) ||
      state.id < 0 ||
      ids.has(state.id)
    )
      throw new Error(`${label} has invalid or duplicate state ID`);
    ids.add(state.id);
    if (state.default !== undefined && typeof state.default !== "boolean")
      throw new Error(`${label} has invalid default marker`);
    if (state.default === true) defaults++;
    const values =
      state.properties === undefined ? {} : record(state.properties, `${label}.state.properties`);
    if (Object.keys(values).length !== entries.length)
      throw new Error(`${label} state does not specify every property`);
    const pairs = Object.keys(properties).map((name) => {
      const value = values[name];
      if (
        !Object.hasOwn(values, name) ||
        typeof value !== "string" ||
        !properties[name]?.includes(value)
      )
        throw new Error(`${label} state has an unreported property value`);
      return [name, value] as const;
    });
    const tuple = JSON.stringify(pairs);
    if (tuples.has(tuple)) throw new Error(`${label} has duplicate property tuples`);
    tuples.add(tuple);
    return {
      id: state.id,
      properties: Object.fromEntries(pairs),
      ...(state.default === true ? { default: true } : {}),
    };
  });
  if (defaults !== 1) throw new Error(`${label} must report exactly one default state`);
  return { properties, states: states.sort((a, b) => a.id - b.id) };
}

/** Normalize only facts explicitly present in Mojang's blocks.json report. */
export function buildBlockStateSurface(
  report: unknown,
  version: string,
  source: BlockStateSource,
): BlockStateSurface {
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/.test(version))
    throw new Error("Invalid block-state version");
  if (
    !source ||
    typeof source !== "object" ||
    source.kind !== "official-generated" ||
    !/^https:\/\/piston-data\.mojang\.com\/v1\/objects\/[0-9a-f]{40}\/server\.jar$/.test(
      source.url,
    ) ||
    !/^[0-9a-f]{40}$/.test(source.serverSha1) ||
    !source.url.includes(`/${source.serverSha1}/`) ||
    !/^[0-9a-f]{64}$/.test(source.reportSha256) ||
    typeof source.retrievedAt !== "string" ||
    !Number.isFinite(Date.parse(source.retrievedAt))
  )
    throw new Error("Invalid block-state source provenance");
  const entries = Object.entries(record(report, "blocks report"));
  if (entries.length === 0 || entries.length > blockStateLimits.maxBlocks)
    throw new Error("Block count exceeds limits");
  let stateCount = 0;
  const allIds = new Set<number>();
  const blocks = Object.fromEntries(
    entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, value]) => {
        if (!/^[a-z0-9_.-]+:[a-z0-9/._-]+$/.test(id) || id.length > 256)
          throw new Error("Invalid block resource ID");
        const block = normalizeBlock(value, id);
        stateCount += block.states.length;
        if (stateCount > blockStateLimits.maxTotalStates)
          throw new Error("Report exceeds total state limit");
        for (const state of block.states) {
          if (allIds.has(state.id)) throw new Error("Duplicate state ID across blocks");
          allIds.add(state.id);
        }
        return [id, block];
      }),
  );
  return { schemaVersion: 1, version, source, blockCount: entries.length, stateCount, blocks };
}

export function readBlockStateDefinition(options: BlockStateDefinitionOptions) {
  const { version, blockId } = options;
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/.test(version))
    throw new Error("Invalid block-state version");
  if (
    typeof blockId !== "string" ||
    blockId.length > 256 ||
    !/^[a-z0-9_.-]+:[a-z0-9/._-]+$/.test(blockId)
  )
    throw new Error("blockId must be a namespaced resource ID");
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 256;
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > blockStateLimits.maxResultStates
  )
    throw new Error("Invalid block-state pagination");
  const path = `java/block-states/${version}.json`;
  const base = { schemaVersion: 1 as const, version, blockId };
  const downloadable = getDataManifest().downloadable.some(
    (entry) => entry.path === path && entry.kind === "block-state-surface",
  );
  if (!hasDataFile(path))
    return {
      ...base,
      status: "unavailable" as const,
      reason: downloadable ? "data-not-cached" : "unsupported-version",
      fetch: downloadable ? { kind: "block-state-surface", version } : null,
    };
  const stored = readDataJson<BlockStateSurface>(path);
  if (stored.schemaVersion !== 1 || stored.version !== version)
    throw new Error("Block-state surface version mismatch");
  const surface = buildBlockStateSurface(stored.blocks, version, stored.source);
  if (stored.blockCount !== surface.blockCount || stored.stateCount !== surface.stateCount)
    throw new Error("Block-state surface count mismatch");
  const blocks = surface.blocks;
  if (!Object.hasOwn(blocks, blockId))
    return { ...base, status: "not-found" as const, source: surface.source };
  const block = normalizeBlock(blocks[blockId], blockId);
  const states = block.states.slice(offset, offset + limit);
  const nextOffset = offset + states.length < block.states.length ? offset + states.length : null;
  return {
    ...base,
    status: "available" as const,
    source: surface.source,
    properties: block.properties,
    defaultState: block.states.find((s) => s.default === true),
    stateCount: block.states.length,
    offset,
    limit,
    returned: states.length,
    truncated: nextOffset !== null,
    nextOffset,
    states,
    nonClaims: [
      "State IDs apply only to the reported version; hardness, collision shapes, and runtime behavior are not inspected.",
    ],
  };
}
