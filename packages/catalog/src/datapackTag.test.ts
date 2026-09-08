import { describe, expect, it } from "vitest";
import {
  type DatapackTagEvidence,
  type DatapackTagPack,
  type DatapackTagResolutionOptions,
  prepareDatapackTagResolution,
  resolveDatapackTagGraph,
} from "./datapackTag.js";
import { resolveDatapackTag } from "./index.js";

const metadata = {
  path: "pack.mcmeta",
  content: { pack: { description: "Test", min_format: 101, max_format: 101 } },
};
function pack(id: string, tags: Record<string, unknown>): DatapackTagPack {
  return {
    id,
    files: [
      metadata,
      ...Object.entries(tags).map(([tag, content]) => ({
        path: `data/test/tags/item/${tag}.json`,
        content,
      })),
    ],
  };
}
const base: DatapackTagEvidence = {
  registryEntries: new Set(["minecraft:stone", "minecraft:dirt", "minecraft:apple"]),
  registryIndexAvailable: true,
  fileBacked: false,
  vanillaPaths: new Set(),
  readVanillaTag() {
    throw new Error("Uncached");
  },
};
function resolve(
  packs: DatapackTagPack[],
  options: Partial<DatapackTagResolutionOptions> = {},
  evidence: Partial<DatapackTagEvidence> = {},
) {
  return resolveDatapackTagGraph(
    prepareDatapackTagResolution({
      version: "26.2",
      registry: "item",
      tag: "test:root",
      includeVanilla: false,
      packs,
      ...options,
    }),
    { ...base, ...evidence },
  );
}

describe("ordered datapack tag resolution", () => {
  it("merges low-to-high packs, resolves nested tags after replacement, and preserves first occurrence provenance", () => {
    const result = resolve([
      pack("base", { root: { values: ["stone"] }, nested: { values: ["apple"] } }),
      pack("replace", { root: { replace: true, values: ["#test:nested", "stone"] } }),
      pack("top", {
        root: { values: ["dirt", "stone"] },
        nested: { replace: true, values: ["stone", "apple"] },
      }),
    ]);
    expect(result.status).toBe("resolved");
    expect(result.packOrder).toEqual(["base", "replace", "top"]);
    expect(result.members.map((member) => member.id)).toEqual([
      "minecraft:stone",
      "minecraft:apple",
      "minecraft:dirt",
    ]);
    expect(result.members[0]?.source).toEqual({
      pack: "top",
      path: "data/test/tags/item/nested.json",
      tag: "test:nested",
      index: 0,
    });
    expect(
      result.definitions
        .filter((definition) => !definition.effective)
        .map((definition) => [definition.pack, definition.tag]),
    ).toEqual([
      ["base", "test:root"],
      ["base", "test:nested"],
    ]);
    expect(result.references).toContainEqual({
      source: {
        pack: "replace",
        path: "data/test/tags/item/root.json",
        tag: "test:root",
        index: 0,
      },
      reference: "#test:nested",
      required: true,
      state: "resolved",
    });
  });

  it("does not return partial membership when a required element or nested tag fails", () => {
    for (const missing of ["test:missing", "#test:missing", "#test:broken"]) {
      const result = resolve([
        pack("one", { root: { values: ["stone", missing] }, broken: { values: ["test:missing"] } }),
      ]);
      expect(result.status).toBe("unresolved");
      expect(result.members).toEqual([]);
      expect(result.candidateMembers).toEqual([]);
      expect(result.diagnostics.some((diagnostic) => diagnostic.code.startsWith("required-"))).toBe(
        true,
      );
    }
  });

  it("skips optional missing elements, absent tags and tags with required failures", () => {
    const result = resolve([
      pack("one", {
        root: {
          values: [
            "stone",
            { id: "test:missing", required: false },
            { id: "#test:missing", required: false },
            { id: "#test:broken", required: false },
          ],
        },
        broken: { values: ["test:missing"] },
      }),
    ]);
    expect(result.status).toBe("resolved");
    expect(result.optionalMissingReferences).toBe(3);
    expect(result.members.map((member) => member.id)).toEqual(["minecraft:stone"]);
  });

  it("keeps optional and required dependency cycles incomplete without guessing sorter order", () => {
    for (const required of [true, false]) {
      const result = resolve([
        pack("one", {
          root: { values: ["stone", { id: "#test:child", required }] },
          child: { values: ["#test:root"] },
        }),
      ]);
      expect(result.status).toBe("incomplete");
      expect(result.resolutionIncompleteReasons).toContain("cycle");
      expect(result.diagnostics).toContainEqual({
        code: "tag-cycle",
        tag: "test:root",
        source: null,
        reference: null,
        required: null,
      });
      expect(result.members).toEqual([]);
    }
  });

  it("uses the vanilla layer and allows a local replace to eliminate unavailable lower content", () => {
    const vanillaPaths = new Set(["data/test/tags/item/root.json"]);
    const loaded = resolve(
      [pack("one", { root: { values: ["dirt"] } })],
      { includeVanilla: true },
      { vanillaPaths, readVanillaTag: () => ({ values: ["stone"] }) },
    );
    expect(loaded.members.map((member) => member.id)).toEqual([
      "minecraft:stone",
      "minecraft:dirt",
    ]);
    expect(loaded.members[0]?.source.pack).toBe("vanilla");
    const unavailable = resolve(
      [pack("one", { root: { values: ["dirt"] } })],
      { includeVanilla: true },
      { vanillaPaths },
    );
    expect(unavailable.status).toBe("incomplete");
    expect(unavailable.resolutionIncompleteReasons).toContain("vanilla-content-unavailable");
    const replaced = resolve(
      [pack("one", { root: { replace: true, values: ["dirt"] } })],
      { includeVanilla: true },
      { vanillaPaths },
    );
    expect(replaced.status).toBe("resolved");
    expect(replaced.members.map((member) => member.id)).toEqual(["minecraft:dirt"]);
  });

  it("reports supplied content gaps and resolves them only after a higher replacement", () => {
    const missing = pack("one", { root: undefined });
    expect(resolve([missing]).resolutionIncompleteReasons).toContain("content-unavailable");
    expect(resolve([missing, pack("two", { root: { replace: true, values: [] } })]).status).toBe(
      "resolved",
    );
  });

  it("separates candidate membership for missing metadata, overlays, filters and custom file evidence", () => {
    const partial = pack("one", { root: { values: ["stone"] } });
    partial.files.shift();
    const result = resolve([partial]);
    expect(result.status).toBe("incomplete");
    expect(result.members).toEqual([]);
    expect(result.candidateMembers.map((member) => member.id)).toEqual(["minecraft:stone"]);
    const features = pack("features", { root: { values: ["stone"] } });
    features.files[0] = {
      path: "pack.mcmeta",
      content: { pack: {}, overlays: { entries: [] }, filter: { block: [] } },
    };
    expect(resolve([features]).resolutionIncompleteReasons).toEqual([
      "pack-filters",
      "pack-overlays",
    ]);
    expect(resolve([features], { tag: "test:possibly_in_overlay" }).status).toBe("incomplete");
    const custom = pack("custom", { root: { values: ["test:custom"] } });
    custom.files.push({ path: "data/test/item/custom.json", content: {} });
    const fileResult = resolve([custom], {}, { fileBacked: true });
    expect(fileResult.resolutionIncompleteReasons).toContain("element-content-unvalidated");
    expect(fileResult.candidateMembers[0]?.evidence).toBe("file-path");
  });

  it("does not treat unindexed optional elements as known absent", () => {
    const result = resolve(
      [pack("one", { root: { values: [{ id: "test:maybe", required: false }] } })],
      {},
      { registryIndexAvailable: false },
    );
    expect(result.status).toBe("incomplete");
    expect(result.optionalMissingReferences).toBe(0);
    expect(result.resolutionIncompleteReasons).toContain("registry-index-unavailable");
  });

  it("rejects malformed tag shapes and invalid resource IDs without inventing members", () => {
    for (const content of [
      "{",
      [],
      { replace: "true", values: [] },
      { values: ["#Test:bad"] },
      { values: ["test:../bad"] },
      { values: [{ id: "stone", required: "false" }] },
    ]) {
      const result = resolve([pack("one", { root: content })]);
      expect(result.status).toBe("incomplete");
      expect(result.members).toEqual([]);
    }
    expect(
      resolve([pack("one", { root: { values: ["stone"], remove: ["stone"] } })])
        .resolutionIncompleteReasons,
    ).toContain("unsupported-tag-extension");
  });

  it("bounds graph expansion, depth, diagnostics, references and retained provenance", () => {
    const tags = {
      root: { values: ["#test:child", "dirt", "apple", { id: "test:missing", required: false }] },
      child: { values: ["stone"] },
    };
    const capped = resolve([pack("one", tags)], { limit: 1 });
    expect(capped.status).toBe("resolved");
    expect(capped.memberCount).toBe(3);
    expect(capped.members).toHaveLength(1);
    expect(capped.definitionCount).toBe(2);
    expect(capped.references).toHaveLength(1);
    expect(capped.truncated).toBe(true);
    const limited = resolve([pack("one", tags)], { limits: { maxGraphOperations: 3 } });
    expect(limited.exceededLimits).toContain("maxGraphOperations");
    expect(limited.resolutionComplete).toBe(false);
    const deep = resolve(
      [
        pack("one", {
          root: { values: ["#test:a"] },
          a: { values: ["#test:b"] },
          b: { values: ["#test:c"] },
          c: { values: [] },
        }),
      ],
      { limits: { maxContentDepth: 2 } },
    );
    expect(deep.exceededLimits).toContain("maxContentDepth");
  });

  it("bounds all input packs and parsed/raw JSON before traversal", () => {
    const options = {
      version: "26.2",
      registry: "item",
      tag: "test:root",
      packs: [pack("one", { root: { values: [] } })],
    };
    expect(() =>
      prepareDatapackTagResolution({
        ...options,
        packs: [pack("duplicate", { root: '{"values":[],"v\\u0061lues":["stone"]}' })],
      }),
    ).toThrow("duplicate object keys");
    expect(() =>
      prepareDatapackTagResolution({
        ...options,
        packs: [pack("hidden_depth", { root: '{"a":[[[[0]]]],"a":1}' })],
        limits: { maxContentDepth: 2 },
      }),
    ).toThrow("maxContentDepth");
    expect(() =>
      prepareDatapackTagResolution({ ...options, packs: [pack("same", {}), pack("same", {})] }),
    ).toThrow("unique");
    expect(() => prepareDatapackTagResolution({ ...options, limits: { maxFiles: 1 } })).toThrow(
      "total files",
    );
    expect(() => prepareDatapackTagResolution({ ...options, limits: { maxPacks: 0 } })).toThrow(
      "maxPacks",
    );
    for (const path of [
      "../escape.json",
      "/root.json",
      "data\\test.json",
      "data/test/../root.json",
    ]) {
      expect(() =>
        prepareDatapackTagResolution({ ...options, packs: [{ id: "one", files: [{ path }] }] }),
      ).toThrow("safe");
    }
    for (const content of [JSON.stringify({ a: { b: { c: {} } } }), { a: { b: { c: {} } } }]) {
      expect(() =>
        prepareDatapackTagResolution({
          ...options,
          packs: [pack("one", { root: content })],
          limits: { maxContentDepth: 2 },
        }),
      ).toThrow("maxContentDepth");
    }
    expect(() =>
      prepareDatapackTagResolution({ ...options, limits: { maxTextContentCharacters: 4 } }),
    ).toThrow("maxTextContentCharacters");
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() =>
      prepareDatapackTagResolution({ ...options, packs: [pack("one", { root: cycle })] }),
    ).toThrow("cycles");
    expect(() =>
      prepareDatapackTagResolution({
        ...options,
        packs: [pack("one", { root: { values: new Array(20) } })],
        limits: { maxContentNodes: 10 },
      }),
    ).toThrow("maxContentNodes");
  });

  it("supports only verified exact versions and uses official registry evidence in the public API", () => {
    for (const version of ["26.2", "1.21.11"]) {
      const result = resolveDatapackTag({
        version,
        registry: "minecraft:item",
        tag: "test:root",
        includeVanilla: false,
        packs: [pack("one", { root: { values: ["stone", "apple"] } })],
      });
      expect(result.resolutionComplete).toBe(true);
      expect(result.memberCount).toBe(2);
    }
    for (const version of ["latest", "1.21", "26.3", "26.2-snapshot-1"]) {
      expect(() =>
        resolveDatapackTag({ version, registry: "item", tag: "test:root", packs: [] }),
      ).toThrow("exact version");
    }
    expect(() =>
      resolveDatapackTag({
        version: "26.2",
        registry: "not_a_registry",
        tag: "test:root",
        packs: [],
      }),
    ).toThrow("tag-enabled");
  });
});
