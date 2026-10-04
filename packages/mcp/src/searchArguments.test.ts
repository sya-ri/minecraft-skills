import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ members: vi.fn(), assets: vi.fn(), fetchIndex: vi.fn() }));
vi.mock("@minecraft-skills/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@minecraft-skills/catalog")>()),
  searchPaperMembersWithData: mocks.members,
  searchMinecraftAssets: mocks.assets,
  fetchMinecraftAssetsIndex: mocks.fetchIndex,
}));

import { callMinecraftSkillsTool } from "./tools.js";

describe("MCP search argument contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.members.mockResolvedValue({ members: [] });
    mocks.assets.mockReturnValue({ paths: [] });
  });

  it.each([
    "search_paper_members",
    "search_resourcepack_assets",
  ])("%s rejects an ignored query and explains the supported filter before searching", async (tool) => {
    const result = await callMinecraftSkillsTool(tool, {
      version: "26.3",
      query: "startUsingItem",
      ...(tool === "search_resourcepack_assets" ? { fetch: true } : { fetchMissing: true }),
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("contains");
    expect(mocks.members).not.toHaveBeenCalled();
    expect(mocks.assets).not.toHaveBeenCalled();
    expect(mocks.fetchIndex).not.toHaveBeenCalled();
  });

  it.each([
    "search_paper_members",
    "search_resourcepack_assets",
  ])("%s rejects other undeclared filters before searching", async (tool) => {
    const result = await callMinecraftSkillsTool(tool, { version: "26.3", member: "breakBlock" });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("unknown argument");
    expect(mocks.members).not.toHaveBeenCalled();
    expect(mocks.assets).not.toHaveBeenCalled();
  });

  it("passes documented member and asset filters to their existing search implementations", async () => {
    expect(
      (
        await callMinecraftSkillsTool("search_paper_members", {
          version: "26.3",
          type: "LivingEntity",
          contains: "startUsingItem",
          limit: 2,
        })
      ).isError,
    ).not.toBe(true);
    expect(mocks.members).toHaveBeenCalledExactlyOnceWith({
      version: "26.3",
      type: "LivingEntity",
      contains: "startUsingItem",
      limit: 2,
      fetchMissing: false,
    });
    expect(
      (
        await callMinecraftSkillsTool("search_resourcepack_assets", {
          version: "26.3",
          contains: "experience",
          extension: ".png",
          limit: 20,
        })
      ).isError,
    ).not.toBe(true);
    expect(mocks.assets).toHaveBeenCalledExactlyOnceWith({
      version: "26.3",
      ref: "26.3",
      contains: "experience",
      extension: ".png",
      limit: 20,
    });
  });
});
