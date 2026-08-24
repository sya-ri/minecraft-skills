import { describe, expect, it } from "vitest";
import {
  compareRegistryEntries,
  getJavaReportsSummary,
  searchAll,
  searchRegistryEntries,
} from "./index.js";

describe("registry entry indexes", () => {
  it("searches exact 26.2 entries with their official report protocol ID", () => {
    const result = searchRegistryEntries({
      version: "26.2",
      registry: "minecraft:item",
      exact: "minecraft:stone",
    });

    expect(result.registryStatus).toBe("indexed");
    expect(result.matchedEntries).toBe(1);
    expect(result.entries).toEqual([
      {
        registryId: "minecraft:item",
        entryId: "minecraft:stone",
        protocolId: 1,
      },
    ]);
    expect(result.indexCoverage.entryCount).toBe(
      getJavaReportsSummary("java", "26.2").datapack.registryEntries.entryCount,
    );
  });

  it("combines prefix and contains filters before applying a deterministic limit", () => {
    const options = {
      version: "26.2",
      registry: "minecraft:block",
      prefix: "minecraft:",
      contains: "cinnabar",
      limit: 2,
    } as const;
    const first = searchRegistryEntries(options);
    const second = searchRegistryEntries(options);

    expect(first).toEqual(second);
    expect(first.matchedEntries).toBeGreaterThan(2);
    expect(first.truncated).toBe(true);
    expect(first.entries).toHaveLength(2);
    expect(first.entries.map((entry) => entry.entryId)).toEqual([
      "minecraft:chiseled_cinnabar",
      "minecraft:cinnabar",
    ]);
  });

  it("distinguishes unindexed, unknown, and unavailable official registry reports", () => {
    expect(
      searchRegistryEntries({ version: "26.2", registry: "minecraft:advancement" }).registryStatus,
    ).toBe("unindexed");
    expect(
      searchRegistryEntries({ version: "26.2", registry: "minecraft:not_a_registry" })
        .registryStatus,
    ).toBe("unknown");
    expect(
      searchRegistryEntries({ version: "1.13", registry: "minecraft:item" }).registryStatus,
    ).toBe("official-report-unavailable");
  });

  it.each([
    {
      from: "26.2",
      to: "26.2",
      registry: "minecraft:advancement",
      fromStatus: "unindexed",
      toStatus: "unindexed",
    },
    {
      from: "26.2",
      to: "26.2",
      registry: "minecraft:not_a_registry",
      fromStatus: "unknown",
      toStatus: "unknown",
    },
    {
      from: "1.13",
      to: "26.2",
      registry: "minecraft:item",
      fromStatus: "official-report-unavailable",
      toStatus: "indexed",
    },
  ] as const)("does not infer entry diffs from $fromStatus to $toStatus coverage", ({
    from,
    to,
    registry,
    fromStatus,
    toStatus,
  }) => {
    const result = compareRegistryEntries({ from, to, registry });

    expect(result.outcome).toBe("not-comparable");
    expect(result.comparedRegistryCount).toBe(0);
    expect(result.addedTotal).toBe(0);
    expect(result.removedTotal).toBe(0);
    expect(result.changedProtocolIdsTotal).toBe(0);
    expect(result.excludedRegistries).toEqual([
      { registryId: registry, from: fromStatus, to: toStatus },
    ]);
  });

  it("bounds and reports registries excluded from an unfiltered comparison", () => {
    const options = {
      from: "26.1.2",
      to: "26.2",
      exact: "minecraft:not_present",
      limit: 1,
    } as const;
    const first = compareRegistryEntries(options);
    const second = compareRegistryEntries(options);

    expect(first).toEqual(second);
    expect(first.outcome).toBe("partially-compared");
    expect(first.comparedRegistryCount).toBeGreaterThan(0);
    expect(first.excludedRegistriesTotal).toBeGreaterThan(1);
    expect(first.excludedRegistries).toHaveLength(1);
    expect(first.truncated).toBe(true);
    expect(first.addedTotal).toBe(0);
    expect(first.removedTotal).toBe(0);
    expect(first.changedProtocolIdsTotal).toBe(0);
  });

  it("does not infer global additions when one version lacks official registry entries", () => {
    const result = compareRegistryEntries({ from: "1.13", to: "26.2", limit: 1 });

    expect(result.from.indexCoverage.coverage).toBe("official-report-unavailable");
    expect(result.to.indexCoverage.coverage).toBe("official-report");
    expect(result.outcome).toBe("not-comparable");
    expect(result.comparedRegistryCount).toBe(0);
    expect(result.excludedRegistriesTotal).toBeGreaterThan(1);
    expect(result.excludedRegistries).toHaveLength(1);
    expect(result.addedTotal).toBe(0);
    expect(result.removedTotal).toBe(0);
    expect(result.changedProtocolIdsTotal).toBe(0);
    expect(result.truncated).toBe(true);
  });

  it("excludes a registry whose official entry coverage starts in only one compared version", () => {
    const result = compareRegistryEntries({
      from: "1.21.1",
      to: "1.21.2",
      registry: "minecraft:consume_effect_type",
    });

    expect(result.from.registryStatus).toBe("unknown");
    expect(result.to.registryStatus).toBe("indexed");
    expect(result.outcome).toBe("not-comparable");
    expect(result.comparedRegistryCount).toBe(0);
    expect(result.excludedRegistries).toEqual([
      {
        registryId: "minecraft:consume_effect_type",
        from: "unknown",
        to: "indexed",
      },
    ]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.changedProtocolIds).toEqual([]);
  });

  it("compares added and removed registry entry IDs", () => {
    const result = compareRegistryEntries({
      from: "26.1.2",
      to: "26.2",
      registry: "minecraft:block",
      exact: "minecraft:cinnabar",
    });

    expect(result.from.registryStatus).toBe("indexed");
    expect(result.to.registryStatus).toBe("indexed");
    expect(result.outcome).toBe("compared");
    expect(result.excludedRegistries).toEqual([]);
    expect(result.added).toEqual([
      {
        registryId: "minecraft:block",
        entryId: "minecraft:cinnabar",
        protocolId: 1012,
      },
    ]);
    expect(result.removed).toEqual([]);
    expect(result.changedProtocolIds).toEqual([]);
  });

  it("reports protocol ID changes and applies the comparison limit deterministically", () => {
    const result = compareRegistryEntries({
      from: "26.1.2",
      to: "26.2",
      registry: "minecraft:attribute",
      prefix: "minecraft:armor",
      limit: 1,
    });

    expect(result.addedTotal).toBe(0);
    expect(result.removedTotal).toBe(0);
    expect(result.outcome).toBe("compared");
    expect(result.changedProtocolIdsTotal).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.changedProtocolIds).toEqual([
      {
        registryId: "minecraft:attribute",
        entryId: "minecraft:armor",
        from: 0,
        to: 1,
      },
    ]);
    expect(result.notes.join(" ")).toContain("both versions expose numeric protocol IDs");
  });

  it.each([
    { query: "item registry", registryId: "minecraft:item", entryText: undefined },
    { query: "block registry", registryId: "minecraft:block", entryText: undefined },
    {
      query: "cinnabar registry entries",
      registryId: undefined,
      entryText: "cinnabar",
    },
  ])("routes '$query' to registry entry discovery", ({ query, registryId, entryText }) => {
    const result = searchAll({
      version: "26.2",
      domain: "datapack",
      query,
      limit: 100,
    });

    expect(
      result.results.some(
        (entry) =>
          entry.surface === "registry-entries" &&
          (registryId === undefined || entry.kind === registryId) &&
          (entryText === undefined || entry.title.includes(entryText)),
      ),
    ).toBe(true);
  });
});
