import { getDataManifest, hasDataFile, readDataJson } from "@minecraft-skills/data";

export const entityMetadataLimits = Object.freeze({
  maxEntities: 4096,
  maxHierarchy: 64,
  maxFields: 255,
  maxTypeCharacters: 2048,
  maxGaps: 4096,
  maxTotalFields: 65536,
});
export const entityMetadataArtifacts = Object.freeze({
  "26.2": { serverSha1: "823e2250d24b3ddac457a60c92a6a941943fcd6a", mappingsSha1: null },
  "1.21.11": {
    serverSha1: "64bb6d763bed0a9f1d632ec347938594144943ed",
    mappingsSha1: "5621e9253f05fd57872bbe7f8ddf5f9a7d525955",
  },
});
export type EntityMetadataEntry = {
  index: number;
  declaredIn: string;
  accessor: string;
  valueType: string;
  serializer: string;
  serializerId: number;
};
export type EntityMetadataDefinition = {
  className: string;
  hierarchy: string[];
  metadata: EntityMetadataEntry[];
};
export type EntityMetadataGap = { entityId: string; code: string; detail: string };
export type EntityMetadataSource = {
  kind: "official-reflection";
  url: string;
  serverSha1: string;
  mappings: { url: string; sha1: string } | null;
  reportSha256: string;
  extractorSha256: string;
  retrievedAt: string;
};
export type EntityMetadataSurface = {
  schemaVersion: 1;
  version: string;
  source: EntityMetadataSource;
  registryEntityIds: string[];
  entityCount: number;
  metadataFieldCount: number;
  coverage: {
    registryEntityCount: number;
    extractedEntityCount: number;
    missingEntityIds: string[];
    complete: boolean;
  };
  gaps: EntityMetadataGap[];
  entities: Record<string, EntityMetadataDefinition>;
};
export type EntityMetadataOptions = { version: string; entityId: string };

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function resourceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 256 &&
    /^minecraft:[a-z0-9_./-]+$/.test(value) &&
    value.split(/[/:]/).every((part) => part !== "." && part !== ".." && part.length > 0)
  );
}
function className(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 512 &&
    /^net\.minecraft\.(?:[A-Za-z_$][\w$]*\.)*[A-Za-z_$][\w$]*$/.test(value)
  );
}
function memberName(value: unknown): value is string {
  return typeof value === "string" && value.length <= 256 && /^[A-Za-z_$][\w$]*$/.test(value);
}
function uniqueIds(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > entityMetadataLimits.maxEntities ||
    !value.every(resourceId) ||
    new Set(value).size !== value.length
  )
    throw new Error(`${label} must contain bounded unique Minecraft entity IDs`);
  return [...value].sort();
}
function normalizeEntity(value: unknown, label: string): EntityMetadataDefinition {
  const entity = record(value, label);
  if (
    !className(entity.className) ||
    !Array.isArray(entity.hierarchy) ||
    entity.hierarchy.length === 0 ||
    entity.hierarchy.length > entityMetadataLimits.maxHierarchy ||
    !entity.hierarchy.every(className) ||
    new Set(entity.hierarchy).size !== entity.hierarchy.length ||
    entity.hierarchy[0] !== entity.className ||
    entity.hierarchy.at(-1) !== "net.minecraft.world.entity.Entity"
  )
    throw new Error(`${label} has an invalid class hierarchy`);
  if (
    !Array.isArray(entity.metadata) ||
    entity.metadata.length === 0 ||
    entity.metadata.length > entityMetadataLimits.maxFields
  )
    throw new Error(`${label} has invalid accessor declarations`);
  const hierarchy = entity.hierarchy as string[];
  const declarations = new Set<string>();
  const metadata = entity.metadata.map((value, position): EntityMetadataEntry => {
    const entry = record(value, `${label}.metadata`);
    if (entry.index !== position)
      throw new Error(`${label} metadata indexes must be unique and contiguous from zero`);
    if (
      !className(entry.declaredIn) ||
      !hierarchy.includes(entry.declaredIn) ||
      !memberName(entry.accessor) ||
      !memberName(entry.serializer) ||
      typeof entry.serializerId !== "number" ||
      !Number.isInteger(entry.serializerId) ||
      entry.serializerId < 0 ||
      entry.serializerId > 65535 ||
      typeof entry.valueType !== "string" ||
      entry.valueType.length === 0 ||
      entry.valueType.length > entityMetadataLimits.maxTypeCharacters ||
      !/^[A-Za-z0-9_.$<>?,[\] &]+$/.test(entry.valueType)
    )
      throw new Error(`${label} has invalid accessor or serializer facts`);
    const declaration = `${entry.declaredIn}.${entry.accessor}`;
    if (declarations.has(declaration)) throw new Error(`${label} repeats an accessor declaration`);
    declarations.add(declaration);
    return {
      index: position,
      declaredIn: entry.declaredIn,
      accessor: entry.accessor,
      valueType: entry.valueType,
      serializer: entry.serializer,
      serializerId: entry.serializerId,
    };
  });
  return { className: entity.className, hierarchy: [...entity.hierarchy] as string[], metadata };
}

export function buildEntityMetadataSurface(
  report: unknown,
  version: string,
  registryEntityIds: string[],
  source: EntityMetadataSource,
): EntityMetadataSurface {
  const artifact = entityMetadataArtifacts[version as keyof typeof entityMetadataArtifacts];
  if (!artifact) throw new Error("Entity metadata supports exact versions 26.2 and 1.21.11");
  if (
    source.kind !== "official-reflection" ||
    source.serverSha1 !== artifact.serverSha1 ||
    source.url !== `https://piston-data.mojang.com/v1/objects/${artifact.serverSha1}/server.jar` ||
    !/^[a-f0-9]{64}$/.test(source.reportSha256) ||
    !/^[a-f0-9]{64}$/.test(source.extractorSha256) ||
    !Number.isFinite(Date.parse(source.retrievedAt)) ||
    (artifact.mappingsSha1 === null
      ? source.mappings !== null
      : source.mappings?.sha1 !== artifact.mappingsSha1 ||
        source.mappings.url !==
          `https://piston-data.mojang.com/v1/objects/${artifact.mappingsSha1}/server.txt`)
  )
    throw new Error("Entity metadata source provenance mismatch");
  const input = record(report, "entity metadata report");
  if (
    input.schemaVersion !== 1 ||
    input.version !== version ||
    input.serverSha1 !== artifact.serverSha1 ||
    (input.mappingsSha1 ?? null) !== artifact.mappingsSha1
  )
    throw new Error("Entity metadata extraction artifact mismatch");
  const registryIds = uniqueIds(registryEntityIds, "Registry coverage");
  const discovered = uniqueIds(input.discoveredEntityIds, "Discovered declarations");
  if (discovered.some((id) => !registryIds.includes(id)))
    throw new Error("Entity metadata report contains an unregistered entity ID");
  const rawEntities = Object.entries(record(input.entities, "entities"));
  if (rawEntities.length > entityMetadataLimits.maxEntities)
    throw new Error("Entity metadata entity count exceeds limit");
  let metadataFieldCount = 0;
  const entities = Object.fromEntries(
    rawEntities
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, value]) => {
        if (!resourceId(id) || !discovered.includes(id))
          throw new Error("Entity metadata includes an undiscovered entity ID");
        const entity = normalizeEntity(value, id);
        metadataFieldCount += entity.metadata.length;
        if (metadataFieldCount > entityMetadataLimits.maxTotalFields)
          throw new Error("Entity metadata total field count exceeds limit");
        return [id, entity];
      }),
  );
  if (!Array.isArray(input.gaps) || input.gaps.length > entityMetadataLimits.maxGaps)
    throw new Error("Entity metadata gaps exceed limit");
  const gaps = input.gaps.map((value): EntityMetadataGap => {
    const gap = record(value, "extraction gap");
    if (
      !resourceId(gap.entityId) ||
      !registryIds.includes(gap.entityId) ||
      typeof gap.code !== "string" ||
      !/^[a-z-]{1,128}$/.test(gap.code) ||
      typeof gap.detail !== "string" ||
      gap.detail.length > 512
    )
      throw new Error("Invalid entity metadata extraction gap");
    if (Object.hasOwn(entities, gap.entityId))
      throw new Error(
        "Entity metadata cannot contain both extracted facts and an extraction gap for the same entity",
      );
    return { entityId: gap.entityId, code: gap.code, detail: gap.detail };
  });
  const missingEntityIds = registryIds.filter((id) => !Object.hasOwn(entities, id));
  for (const id of missingEntityIds) {
    if (!gaps.some((gap) => gap.entityId === id))
      gaps.push({
        entityId: id,
        code: "entity-declaration-missing",
        detail: "The official registry ID has no extracted static declaration evidence.",
      });
  }
  if (gaps.length > entityMetadataLimits.maxGaps)
    throw new Error("Entity metadata gaps exceed limit");
  const serializerIds = new Map<string, number>();
  const serializerNames = new Map<number, string>();
  const classDefinitions = new Map<string, string>();
  const declarationFacts = new Map<string, string>();
  const parentDefinitions = new Map<string, string>();
  for (const entity of Object.values(entities)) {
    const signature = JSON.stringify(entity);
    if (
      classDefinitions.has(entity.className) &&
      classDefinitions.get(entity.className) !== signature
    )
      throw new Error("Inconsistent entity metadata for the same runtime class");
    classDefinitions.set(entity.className, signature);
    for (let index = 0; index < entity.hierarchy.length; index += 1) {
      const owner = entity.hierarchy[index];
      if (!owner) continue;
      const hierarchy = entity.hierarchy.slice(index);
      const inherited = new Set(hierarchy);
      const definition = JSON.stringify({
        hierarchy,
        metadata: entity.metadata.filter((entry) => inherited.has(entry.declaredIn)),
      });
      if (parentDefinitions.has(owner) && parentDefinitions.get(owner) !== definition)
        throw new Error("Inconsistent inherited entity metadata declarations");
      parentDefinitions.set(owner, definition);
    }
    for (const entry of entity.metadata) {
      const declaration = `${entry.declaredIn}.${entry.accessor}`;
      const facts = JSON.stringify(entry);
      if (declarationFacts.has(declaration) && declarationFacts.get(declaration) !== facts)
        throw new Error("Inconsistent entity accessor declaration facts");
      declarationFacts.set(declaration, facts);
      if (
        (serializerIds.has(entry.serializer) &&
          serializerIds.get(entry.serializer) !== entry.serializerId) ||
        (serializerNames.has(entry.serializerId) &&
          serializerNames.get(entry.serializerId) !== entry.serializer)
      )
        throw new Error("Inconsistent entity metadata serializer identity");
      serializerIds.set(entry.serializer, entry.serializerId);
      serializerNames.set(entry.serializerId, entry.serializer);
    }
  }
  return {
    schemaVersion: 1,
    version,
    source,
    registryEntityIds: registryIds,
    entityCount: rawEntities.length,
    metadataFieldCount,
    coverage: {
      registryEntityCount: registryIds.length,
      extractedEntityCount: rawEntities.length,
      missingEntityIds,
      complete: missingEntityIds.length === 0 && gaps.length === 0,
    },
    gaps: gaps.sort((a, b) => a.entityId.localeCompare(b.entityId) || a.code.localeCompare(b.code)),
    entities,
  };
}

export function readEntityMetadata(
  options: EntityMetadataOptions,
  readRegistryIds: () => string[],
) {
  const { version, entityId } = options;
  if (typeof version !== "string" || !/^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/.test(version))
    throw new Error("Entity metadata requires an exact version identifier");
  if (!resourceId(entityId)) throw new Error("entityId must be a namespaced Minecraft resource ID");
  const base = { schemaVersion: 1 as const, edition: "java" as const, version, entityId };
  const path = `java/entity-metadata/${version}.json`;
  const supported = Object.hasOwn(entityMetadataArtifacts, version);
  const downloadable =
    supported &&
    getDataManifest().downloadable.some(
      (entry) => entry.path === path && entry.kind === "entity-metadata-surface",
    );
  if (!supported || !hasDataFile(path))
    return {
      ...base,
      status: "unavailable" as const,
      reason: downloadable ? "data-not-cached" : "unsupported-version",
      fetch: downloadable ? { kind: "entity-metadata-surface", version } : null,
    };
  const surface = readDataJson<EntityMetadataSurface>(path);
  if (surface.schemaVersion !== 1 || surface.version !== version)
    throw new Error("Entity metadata surface version mismatch");
  // Revalidate the stored facts and recompute coverage instead of trusting serialized completeness.
  const checked = buildEntityMetadataSurface(
    {
      schemaVersion: 1,
      version,
      serverSha1: surface.source?.serverSha1,
      mappingsSha1: surface.source?.mappings?.sha1 ?? null,
      discoveredEntityIds: surface.registryEntityIds,
      entities: surface.entities,
      gaps: surface.gaps,
    },
    version,
    surface.registryEntityIds,
    surface.source,
  );
  const expectedRegistryIds = uniqueIds(readRegistryIds(), "Official entity registry coverage");
  const storedCoverage = record(surface.coverage, "entity metadata coverage");
  if (
    surface.entityCount !== checked.entityCount ||
    surface.metadataFieldCount !== checked.metadataFieldCount ||
    storedCoverage.registryEntityCount !== checked.coverage.registryEntityCount ||
    storedCoverage.extractedEntityCount !== checked.coverage.extractedEntityCount ||
    storedCoverage.complete !== checked.coverage.complete ||
    JSON.stringify(storedCoverage.missingEntityIds) !==
      JSON.stringify(checked.coverage.missingEntityIds) ||
    JSON.stringify(expectedRegistryIds) !== JSON.stringify(checked.registryEntityIds)
  )
    throw new Error("Entity metadata surface counts or registry coverage mismatch");
  if (!checked.registryEntityIds.includes(entityId))
    return { ...base, status: "not-found" as const, source: checked.source };
  const entity = checked.entities[entityId];
  if (!entity)
    return {
      ...base,
      status: "incomplete" as const,
      reason: "extraction-gap",
      source: checked.source,
      coverage: checked.coverage,
      gaps: checked.gaps.filter((gap) => gap.entityId === entityId),
    };
  return {
    ...base,
    status: "available" as const,
    source: checked.source,
    coverage: checked.coverage,
    gaps: checked.gaps,
    ...entity,
    fieldCount: entity.metadata.length,
    nonClaims: [
      "These are static EntityDataAccessor declarations and inherited indexes from the exact official server version.",
      "No entity instance or world was created. Default values, bit meanings, runtime initialization, behavior and custom mod metadata are not established.",
      "Serializer IDs are version-specific registry facts; wire encoding behavior is not decoded by this lookup.",
    ],
  };
}
