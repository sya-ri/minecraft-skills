import { describe, expect, it } from "vitest";
import { paperMemberMatchesType } from "./paperMemberSearch.js";
import type { PaperApiMemberData } from "./schemas.js";

const constructorMember: PaperApiMemberData = {
  packageName: "example",
  typeName: "MemberOnly",
  qualifiedTypeName: "example.MemberOnly",
  name: "MemberOnly",
  label: "MemberOnly()",
  kind: "constructor",
  url: "https://example.invalid/MemberOnly.html#%3Cinit%3E()",
};

describe("paperMemberMatchesType", () => {
  it("preserves direct constructor searches for member-only unindexed types", () => {
    expect(
      paperMemberMatchesType({
        member: constructorMember,
        typeName: "example.MemberOnly",
        resolvedTypeNames: new Set(),
        searchedTypeNames: new Set(),
      }),
    ).toBe(true);
  });

  it("excludes ancestor constructors without excluding the requested type constructor", () => {
    const resolvedTypeNames = new Set(["example.Child"]);
    const searchedTypeNames = new Set(["example.Child", "example.MemberOnly"]);
    expect(
      paperMemberMatchesType({
        member: constructorMember,
        typeName: "example.Child",
        resolvedTypeNames,
        searchedTypeNames,
      }),
    ).toBe(false);
    expect(
      paperMemberMatchesType({
        member: { ...constructorMember, qualifiedTypeName: "example.Child", typeName: "Child" },
        typeName: "example.Child",
        resolvedTypeNames,
        searchedTypeNames,
      }),
    ).toBe(true);
  });
});
