import { beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({ present: vi.fn(), read: vi.fn() }));
vi.mock("@minecraft-skills/data", () => ({
  hasDataFile: data.present,
  readDataJson: data.read,
  getDataManifest: () => ({
    downloadable: [{ path: "java/block-states/26.2.json", kind: "block-state-surface" }],
  }),
}));

import {
  type BlockStateSource,
  buildBlockStateSurface,
  readBlockStateDefinition,
} from "./blockStates.js";

const source: BlockStateSource = {
  kind: "official-generated",
  url: `https://piston-data.mojang.com/v1/objects/${"a".repeat(40)}/server.jar`,
  serverSha1: "a".repeat(40),
  reportSha256: "b".repeat(64),
  retrievedAt: "2026-09-07T18:01:33Z",
};
function report() {
  return {
    "minecraft:stone": { states: [{ id: 0, default: true }] },
    "example:switch": {
      properties: { powered: ["false", "true"] },
      states: [
        { id: 1, properties: { powered: "false" }, default: true },
        { id: 2, properties: { powered: "true" } },
      ],
    },
  };
}
describe("official block state facts", () => {
  it("rejects invalid cached provenance and partial data before reporting missing blocks", () => {
    data.present.mockReturnValue(true);
    const surface = buildBlockStateSurface(report(), "26.2", source);
    data.read.mockReturnValue({ ...surface, source: null });
    expect(() =>
      readBlockStateDefinition({ version: "26.2", blockId: "minecraft:stone" }),
    ).toThrow();
    data.read.mockReturnValue({
      ...surface,
      blocks: { "minecraft:stone": surface.blocks["minecraft:stone"] },
    });
    expect(() => readBlockStateDefinition({ version: "26.2", blockId: "example:switch" })).toThrow(
      "count mismatch",
    );
    data.read.mockReturnValue({ ...surface, stateCount: surface.stateCount + 1 });
    expect(() => readBlockStateDefinition({ version: "26.2", blockId: "minecraft:stone" })).toThrow(
      "count mismatch",
    );
  });
  beforeEach(() => {
    data.present.mockReset().mockReturnValue(true);
    data.read.mockReset().mockReturnValue(buildBlockStateSurface(report(), "26.2", source));
  });
  it("retains exact values and the explicitly marked default through pagination", () => {
    const result = readBlockStateDefinition({
      version: "26.2",
      blockId: "example:switch",
      offset: 1,
      limit: 1,
    });
    expect(result).toMatchObject({
      status: "available",
      properties: { powered: ["false", "true"] },
      defaultState: { id: 1 },
      states: [{ id: 2 }],
      returned: 1,
      truncated: false,
      stateCount: 2,
    });
    expect(
      readBlockStateDefinition({ version: "26.2", blockId: "example:switch", limit: 1 }),
    ).toMatchObject({ truncated: true, nextOffset: 1 });
  });
  it("supports blocks without properties and distinguishes unavailable from unknown ID", () => {
    expect(readBlockStateDefinition({ version: "26.2", blockId: "minecraft:stone" })).toMatchObject(
      { status: "available", properties: {}, defaultState: { id: 0, properties: {} } },
    );
    expect(readBlockStateDefinition({ version: "26.2", blockId: "example:missing" }).status).toBe(
      "not-found",
    );
    data.present.mockReturnValue(false);
    expect(readBlockStateDefinition({ version: "26.2", blockId: "minecraft:stone" })).toMatchObject(
      { status: "unavailable", fetch: { kind: "block-state-surface", version: "26.2" } },
    );
  });
  it("rejects invalid defaults, undeclared property values, and duplicate IDs/tuples", () => {
    for (const states of [
      [{ id: 1 }],
      [
        { id: 1, default: true },
        { id: 2, default: true },
      ],
      [{ id: 1, default: true }, { id: 1 }],
    ])
      expect(() =>
        buildBlockStateSurface({ "minecraft:stone": { states } }, "26.2", source),
      ).toThrow();
    const bad = report();
    bad["example:switch"].states.splice(1, 1, { id: 2, properties: { powered: "maybe" } });
    expect(() => buildBlockStateSurface(bad, "26.2", source)).toThrow("unreported");
    const duplicate = report();
    duplicate["example:switch"].states.splice(1, 1, { id: 2, properties: { powered: "false" } });
    expect(() => buildBlockStateSurface(duplicate, "26.2", source)).toThrow(
      "duplicate property tuples",
    );
  });
  it("rejects cross-block ID reuse and mismatched provenance", () => {
    const bad = report();
    bad["example:switch"].states.splice(0, 1, {
      id: 0,
      properties: { powered: "false" },
      default: true,
    });
    expect(() => buildBlockStateSurface(bad, "26.2", source)).toThrow("across blocks");
    expect(() =>
      buildBlockStateSurface(report(), "26.2", { ...source, serverSha1: "c".repeat(40) }),
    ).toThrow("provenance");
  });
  it("rejects traversal, unbounded output, and wrong-version data", () => {
    expect(() =>
      readBlockStateDefinition({ version: "../26.2", blockId: "minecraft:stone" }),
    ).toThrow();
    expect(() =>
      readBlockStateDefinition({ version: "26.2", blockId: "minecraft:stone", limit: 4097 }),
    ).toThrow();
    expect(() =>
      readBlockStateDefinition({ version: "26.2", blockId: "minecraft:stone", offset: -1 }),
    ).toThrow();
    data.read.mockReturnValue({
      ...buildBlockStateSurface(report(), "26.2", source),
      version: "1.21.11",
    });
    expect(() => readBlockStateDefinition({ version: "26.2", blockId: "minecraft:stone" })).toThrow(
      "version mismatch",
    );
  });
});
