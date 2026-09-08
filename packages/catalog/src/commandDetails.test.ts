import { beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({ present: vi.fn(), read: vi.fn() }));
vi.mock("@minecraft-skills/data", () => ({
  hasDataFile: data.present,
  readDataJson: data.read,
  getDataManifest: () => ({
    downloadable: [{ path: "java/command-trees/26.2.json", kind: "command-tree-surface" }],
  }),
}));

import { buildCommandTreeSurface, readCommandDetails } from "./commandDetails.js";

const source = {
  kind: "official-generated" as const,
  url: `https://piston-data.mojang.com/v1/objects/${"a".repeat(40)}/server.jar`,
  serverSha1: "a".repeat(40),
  reportSha256: "b".repeat(64),
  retrievedAt: "2026-09-07T18:01:33Z",
};
const report = () => ({
  type: "root",
  children: {
    sample: {
      type: "literal",
      children: {
        count: {
          type: "argument",
          parser: "brigadier:integer",
          properties: { min: 1, max: 10 },
          executable: true,
        },
      },
    },
    alias: { type: "literal", redirect: ["sample"] },
    run: { type: "literal" },
  },
});
describe("command tree details", () => {
  it("rejects partial cached trees before reporting a missing command path", () => {
    data.present.mockReturnValue(true);
    const surface = buildCommandTreeSurface(report(), "26.2", source);
    data.read.mockReturnValue({ ...surface, root: { type: "root", children: {} } });
    expect(() => readCommandDetails({ version: "26.2", path: ["sample"] })).toThrow(
      "node count mismatch",
    );
  });
  beforeEach(() => {
    data.present.mockReset().mockReturnValue(true);
    data.read.mockReset().mockReturnValue(buildCommandTreeSurface(report(), "26.2", source));
  });
  it("preserves parser constraints and explicit redirects without expanding them", () => {
    const result = readCommandDetails({ version: "26.2", depth: 2 });
    expect(result).toMatchObject({ status: "available", returned: 5, truncated: false });
    if (result.status !== "available") throw new Error("expected available");
    expect(result.nodes.find((n) => n.parser)).toMatchObject({
      path: ["sample", "count"],
      executable: true,
      properties: { min: 1, max: 10 },
    });
    expect(result.nodes.find((n) => n.path[0] === "alias")).toMatchObject({
      redirect: ["sample"],
      children: [],
    });
    expect(result.nodes.find((n) => n.path[0] === "run")).not.toHaveProperty("redirect");
  });
  it("bounds depth and count while retaining child names for navigation", () => {
    expect(readCommandDetails({ version: "26.2", path: ["sample"], depth: 0 })).toMatchObject({
      returned: 1,
      truncated: true,
      truncationReasons: ["depth-limit"],
      nodes: [{ children: ["count"] }],
    });
    expect(readCommandDetails({ version: "26.2", limit: 1, depth: 2 })).toMatchObject({
      returned: 1,
      truncated: true,
      truncationReasons: ["node-limit"],
    });
  });
  it("distinguishes absent paths, absent caches, and unsupported versions", () => {
    expect(readCommandDetails({ version: "26.2", path: ["missing"] })).toMatchObject({
      status: "not-found",
    });
    data.present.mockReturnValue(false);
    expect(readCommandDetails({ version: "26.2" })).toMatchObject({
      status: "unavailable",
      reason: "data-not-cached",
    });
    expect(readCommandDetails({ version: "1.13" })).toMatchObject({
      status: "unavailable",
      reason: "unsupported-version",
      fetch: null,
    });
  });
  it("rejects traversal injection, excessive limits, corrupt trees and invalid provenance", () => {
    expect(() => readCommandDetails({ version: "../26.2" })).toThrow();
    expect(() => readCommandDetails({ version: "26.2", path: ["\u0000"] })).toThrow();
    expect(() => readCommandDetails({ version: "26.2", depth: 9 })).toThrow();
    expect(() => readCommandDetails({ version: "26.2", limit: 2001 })).toThrow();
    expect(() =>
      buildCommandTreeSurface(
        { type: "root", children: { x: { type: "argument" } } },
        "26.2",
        source,
      ),
    ).toThrow("parser");
    expect(() =>
      buildCommandTreeSurface(report(), "26.2", { ...source, serverSha1: "c".repeat(40) }),
    ).toThrow("provenance");
  });
  it("rejects cycles through the depth budget and does not follow prototype properties", () => {
    const cyclic: { type: string; children: Record<string, unknown> } = {
      type: "literal",
      children: {},
    };
    cyclic.children.loop = cyclic;
    expect(() =>
      buildCommandTreeSurface({ type: "root", children: { cyclic } }, "26.2", source),
    ).toThrow("limits");
    expect(readCommandDetails({ version: "26.2", path: ["toString"] })).toMatchObject({
      status: "not-found",
    });
  });
});
