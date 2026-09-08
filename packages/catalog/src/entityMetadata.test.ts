import { beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({ present: vi.fn(), read: vi.fn() }));
vi.mock("@minecraft-skills/data", () => ({
  hasDataFile: data.present,
  readDataJson: data.read,
  getDataManifest: () => ({
    downloadable: [{ path: "java/entity-metadata/26.2.json", kind: "entity-metadata-surface" }],
  }),
}));

import {
  buildEntityMetadataSurface,
  type EntityMetadataDefinition,
  type EntityMetadataSource,
  entityMetadataArtifacts,
  readEntityMetadata,
} from "./entityMetadata.js";

const rootClass = "net.minecraft.world.entity.Entity";
const ids = ["minecraft:marker", "minecraft:zombie"];
const source: EntityMetadataSource = {
  kind: "official-reflection",
  serverSha1: entityMetadataArtifacts["26.2"].serverSha1,
  url: `https://piston-data.mojang.com/v1/objects/${entityMetadataArtifacts["26.2"].serverSha1}/server.jar`,
  mappings: null,
  reportSha256: "a".repeat(64),
  extractorSha256: "b".repeat(64),
  retrievedAt: "2026-09-07T18:55:53Z",
};
function report() {
  return {
    schemaVersion: 1,
    version: "26.2",
    serverSha1: source.serverSha1,
    mappingsSha1: null,
    discoveredEntityIds: ids,
    gaps: [] as unknown[],
    entities: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          className: rootClass,
          hierarchy: [rootClass],
          metadata: [
            {
              index: 0,
              declaredIn: rootClass,
              accessor: "DATA_SHARED_FLAGS_ID",
              valueType: "java.lang.Byte",
              serializer: "BYTE",
              serializerId: 0,
            },
          ],
        },
      ]),
    ),
  };
}
const build = (input = report()) => buildEntityMetadataSurface(input, "26.2", ids, source);
function fixtureEntity(
  value: { entities: Record<string, EntityMetadataDefinition> },
  id = "minecraft:zombie",
) {
  const entity = value.entities[id];
  if (!entity) throw new Error("Missing entity fixture");
  return entity;
}
function fixtureEntry(
  value: { entities: Record<string, EntityMetadataDefinition> },
  id = "minecraft:zombie",
) {
  const entry = fixtureEntity(value, id).metadata[0];
  if (!entry) throw new Error("Missing metadata fixture");
  return entry;
}
const lookup = (entityId = "minecraft:zombie") =>
  readEntityMetadata({ version: "26.2", entityId }, () => ids);
describe("official entity metadata declarations", () => {
  beforeEach(() => {
    data.present.mockReset().mockReturnValue(true);
    data.read.mockReset().mockReturnValue(build());
  });
  it("returns inherited accessor facts with hashes and explicit non-claims", () => {
    expect(lookup()).toMatchObject({
      status: "available",
      source,
      coverage: { complete: true, registryEntityCount: 2 },
      hierarchy: [rootClass],
      fieldCount: 1,
      metadata: [
        {
          index: 0,
          accessor: "DATA_SHARED_FLAGS_ID",
          valueType: "java.lang.Byte",
          serializer: "BYTE",
          serializerId: 0,
        },
      ],
    });
    expect(JSON.stringify(lookup())).toContain("Default values, bit meanings");
    expect(lookup()).not.toHaveProperty("defaultValues");
  });
  it("distinguishes unsupported, uncached, unknown IDs and extraction gaps", () => {
    expect(lookup("minecraft:unknown").status).toBe("not-found");
    data.present.mockReturnValue(false);
    expect(lookup()).toMatchObject({
      status: "unavailable",
      reason: "data-not-cached",
      fetch: { kind: "entity-metadata-surface", version: "26.2" },
    });
    expect(
      readEntityMetadata({ version: "latest", entityId: "minecraft:zombie" }, () => ids),
    ).toMatchObject({ status: "unavailable", reason: "unsupported-version", fetch: null });
    data.present.mockReturnValue(true);
    const input = report();
    delete input.entities["minecraft:zombie"];
    data.read.mockReturnValue(build(input));
    expect(lookup()).toMatchObject({
      status: "incomplete",
      reason: "extraction-gap",
      coverage: { complete: false, missingEntityIds: ["minecraft:zombie"] },
    });
    expect(lookup("minecraft:marker")).toMatchObject({
      status: "available",
      coverage: { complete: false },
    });
  });
  it("rejects corrupt source, counts, coverage and unrelated declarations before returning not-found", () => {
    for (const mutate of [
      (value: ReturnType<typeof build>) => {
        value.source.serverSha1 = "a".repeat(40);
      },
      (value: ReturnType<typeof build>) => {
        value.entityCount = 1;
      },
      (value: ReturnType<typeof build>) => {
        value.coverage.registryEntityCount = 1;
      },
      (value: ReturnType<typeof build>) => {
        value.coverage.complete = false;
      },
      (value: ReturnType<typeof build>) => {
        fixtureEntry(value, "minecraft:marker").index = 5;
      },
      (value: ReturnType<typeof build>) => {
        value.version = "1.21.11";
      },
    ]) {
      const surface = structuredClone(build());
      mutate(surface);
      data.read.mockReturnValue(surface);
      expect(() => lookup("minecraft:unknown")).toThrow();
    }
    const reduced = report();
    delete reduced.entities["minecraft:zombie"];
    reduced.discoveredEntityIds = ["minecraft:marker"];
    data.read.mockReturnValue(
      buildEntityMetadataSurface(reduced, "26.2", ["minecraft:marker"], source),
    );
    expect(() => lookup("minecraft:unknown")).toThrow("registry coverage");
  });
  it("rejects duplicate/non-contiguous indexes, invalid serializers, hierarchy mismatches and ambiguous identities", () => {
    for (const mutate of [
      (value: ReturnType<typeof report>) => {
        fixtureEntry(value).index = 1;
      },
      (value: ReturnType<typeof report>) => {
        fixtureEntry(value).serializerId = -1;
      },
      (value: ReturnType<typeof report>) => {
        fixtureEntry(value).declaredIn = "net.minecraft.Other";
      },
      (value: ReturnType<typeof report>) => {
        fixtureEntry(value).serializerId = 1;
      },
      (value: ReturnType<typeof report>) => {
        fixtureEntity(value).metadata.push({ ...fixtureEntry(value) });
      },
      (value: ReturnType<typeof report>) => {
        fixtureEntity(value).hierarchy.push(rootClass);
      },
    ]) {
      const input = report();
      mutate(input);
      expect(() => build(input)).toThrow();
    }
  });
  it("preserves explicit failed-extraction gaps and validates supported-version artifact identities", () => {
    const input = report();
    delete input.entities["minecraft:zombie"];
    input.gaps = [
      {
        entityId: "minecraft:zombie",
        code: "declaration-extraction-failed",
        detail: "Missing generic type",
      },
    ];
    expect(build(input)).toMatchObject({ coverage: { complete: false }, gaps: input.gaps });
    expect(() => buildEntityMetadataSurface(input, "1.21.11", ids, source)).toThrow("provenance");
    expect(() => buildEntityMetadataSurface(input, "26.3", ids, source)).toThrow("exact versions");
    expect(() =>
      readEntityMetadata({ version: "../26.2", entityId: "minecraft:zombie" }, () => ids),
    ).toThrow();
    expect(() => lookup("minecraft:../zombie")).toThrow();
  });
  it("rejects truncated unique classes, contradictory inherited facts and facts overlapping extraction gaps", () => {
    const input = report();
    const zombie = fixtureEntity(input);
    zombie.className = "net.minecraft.world.entity.monster.zombie.Zombie";
    zombie.hierarchy = [zombie.className, rootClass];
    zombie.metadata.push({
      index: 1,
      declaredIn: zombie.className,
      accessor: "DATA_BABY_ID",
      valueType: "java.lang.Byte",
      serializer: "BYTE",
      serializerId: 0,
    });
    const surface = build(input);
    fixtureEntity(surface).metadata.pop();
    data.read.mockReturnValue(surface);
    expect(() => lookup()).toThrow("counts");
    fixtureEntry(input).valueType = "java.lang.String";
    expect(() => build(input)).toThrow("inherited");
    const overlap = report();
    overlap.gaps = [
      {
        entityId: "minecraft:zombie",
        code: "declaration-extraction-failed",
        detail: "Contradiction",
      },
    ];
    expect(() => build(overlap)).toThrow("both extracted facts");
  });
});
