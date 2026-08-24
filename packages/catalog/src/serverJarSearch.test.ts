import type { MojangServerJarEntry } from "@minecraft-skills/data";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dataMocks = vi.hoisted(() => ({
  listCachedMojangServerJarEntries: vi.fn<(version: string) => MojangServerJarEntry[]>(),
}));

vi.mock("@minecraft-skills/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@minecraft-skills/data")>();
  return {
    ...actual,
    listCachedMojangServerJarEntries: dataMocks.listCachedMojangServerJarEntries,
  };
});

import { searchVanillaDatapackJsonFiles } from "./index.js";

describe("cached Mojang server jar search", () => {
  beforeEach(() => {
    dataMocks.listCachedMojangServerJarEntries.mockReset();
  });

  it("reads the server jar entry list once per search", () => {
    dataMocks.listCachedMojangServerJarEntries.mockReturnValue([
      {
        path: "assets/minecraft/lang/en_us.json",
        compressedSize: 1,
        uncompressedSize: 1,
      },
      {
        path: "data/minecraft/loot_table/blocks/test.json",
        compressedSize: 1,
        uncompressedSize: 1,
      },
      {
        path: "data/minecraft/recipe/test.json",
        compressedSize: 1,
        uncompressedSize: 1,
      },
      {
        path: "data/minecraft/recipe/test_alt.json",
        compressedSize: 1,
        uncompressedSize: 1,
      },
    ]);

    const result = searchVanillaDatapackJsonFiles({
      version: "26.2",
      kind: "recipe",
      contains: "test",
      limit: 1,
    });

    expect(dataMocks.listCachedMojangServerJarEntries).toHaveBeenCalledOnce();
    expect(dataMocks.listCachedMojangServerJarEntries).toHaveBeenCalledWith("26.2");
    expect(result.totalJsonFiles).toBe(3);
    expect(result.matchedFiles).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe("data/minecraft/recipe/test.json");
  });
});
