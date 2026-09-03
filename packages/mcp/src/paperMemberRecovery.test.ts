import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@minecraft-skills/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@minecraft-skills/catalog")>()),
  searchPaperMembersWithData: mocks.search,
}));

import { callMinecraftSkillsTool, tools } from "./tools.js";

describe("Paper member recovery tool", () => {
  beforeEach(() => {
    mocks.search.mockReset().mockResolvedValue({ version: "26.2", members: [] });
  });

  it("documents the explicit cache-write option with a read-only default", () => {
    const tool = tools.find((entry) => entry.name === "search_paper_members");
    expect(tool?.inputSchema.properties).toMatchObject({
      fetchMissing: { type: "boolean", default: false },
    });
    expect(tool?.description).toContain("Read-only by default");
    expect(tool?.description).toContain("local cache");
  });

  it.each([
    undefined,
    false,
    "true",
    true,
  ])("allows recovery only for literal boolean true (%s)", async (fetchMissing) => {
    const query = { version: "26.2", type: "JavaPlugin", contains: "onDisable", limit: 10 };
    const result = await callMinecraftSkillsTool("search_paper_members", {
      ...query,
      ...(fetchMissing === undefined ? {} : { fetchMissing }),
    });
    expect(result.isError).not.toBe(true);
    expect(mocks.search).toHaveBeenCalledExactlyOnceWith({
      ...query,
      fetchMissing: fetchMissing === true,
    });
  });

  it("keeps a failed verified fetch as a tool error without member facts", async () => {
    mocks.search.mockRejectedValue(new Error("Integrity mismatch for exact-version surface"));
    const result = await callMinecraftSkillsTool("search_paper_members", {
      version: "26.2",
      fetchMissing: true,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Integrity mismatch");
    expect(result.content[0]?.text).not.toContain('"members"');
  });
});
