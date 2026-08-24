import { describe, expect, it, vi } from "vitest";

const dataMocks = vi.hoisted(() => ({
  readDataJson: vi.fn(),
}));

vi.mock("@minecraft-skills/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@minecraft-skills/data")>();
  dataMocks.readDataJson.mockImplementation(actual.readDataJson);
  return {
    ...actual,
    readDataJson: dataMocks.readDataJson,
  };
});

import { searchPaperMembers, searchPaperTypes } from "./index.js";

function surfaceReadCount(version: string): number {
  const path = `java/paper-api-surfaces/${version}.json`;
  return dataMocks.readDataJson.mock.calls.filter(([relativePath]) => relativePath === path).length;
}

describe("Paper API surface cache", () => {
  it("reuses recent surfaces and evicts the least recently used version", () => {
    searchPaperTypes({ version: "1.20.2", contains: "Player", limit: 1 });
    const members = searchPaperMembers({ version: "1.20.2", contains: "Player", limit: 1 });
    expect(surfaceReadCount("1.20.2")).toBe(1);
    const member = members.members[0];
    if (!member) throw new Error("Expected a Paper member fixture");
    const memberName = member.name;
    member.name = "mutated";
    expect(
      searchPaperMembers({
        version: "1.20.2",
        type: member.qualifiedTypeName,
        contains: member.label,
        limit: 1,
      }).members[0]?.name,
    ).toBe(memberName);

    searchPaperTypes({ version: "1.20.4", contains: "Player", limit: 1 });
    searchPaperTypes({ version: "1.20.2", contains: "Player", limit: 1 });
    searchPaperTypes({ version: "1.20.6", contains: "Player", limit: 1 });
    expect(surfaceReadCount("1.20.4")).toBe(1);
    expect(surfaceReadCount("1.20.6")).toBe(1);

    searchPaperTypes({ version: "1.20.2", contains: "Player", limit: 1 });
    expect(surfaceReadCount("1.20.2")).toBe(1);
    searchPaperTypes({ version: "1.20.4", contains: "Player", limit: 1 });
    expect(surfaceReadCount("1.20.4")).toBe(2);
  });
});
