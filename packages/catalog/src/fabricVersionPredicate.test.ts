import { describe, expect, it } from "vitest";
import { compileFabricVersionPredicate } from "./fabricVersionPredicate.js";

describe("Fabric Loader version predicates", () => {
  it.each([
    ["*", "custom-build", true],
    ["", "custom-build", true],
    [" *  * ", "anything", true],
    ["1.2", "1.2.0.0", true],
    ["1.2", "1.2.0.1", false],
    ["=01.02", "1.2", true],
    ["=１.٢", "1.2", true],
    [">=1.2 <2", "1.9.0", true],
    [">=1.2 <2", "2", false],
    [">1", "1.0.0", false],
    ["<=1.2", "1.2", true],
    ["~1.2", "1.2.9", true],
    ["~1.2", "1.3", false],
    ["~1", "1.0.4", true],
    ["~1", "1.1", false],
    ["^0.2.3", "0.9", true],
    ["^0.2.3", "1", false],
    ["1.x", "1.0-alpha", true],
    ["1.2.X", "1.2.0-alpha", true],
    ["1.2.*", "1.3", false],
    ["1.x.x", "1.4", true],
    ["1.x", "1.x", false],
    ["=1.2+abc", "1.2+different", true],
    [">1.0-alpha.2", "1.0-alpha.10", true],
    ["<1.0-alpha.a", "1.0-alpha.2", true],
    [">1.0-1", "1.0-01", true],
    [">1.0-alpha", "1.0-alpha.1", true],
    [">=1.0-", "1.0-alpha", true],
    ["<1.0", "1.0-", true],
    ["release", "release", true],
    [">=release", "release", true],
    ["~release", "release", true],
    ["^release", "release-other", false],
    ["1.x.2", "1.x.2", true],
    [">=2147483648", "2147483648", true],
    [">=1", "snapshot", false],
    ["1.0", "v1.0", false],
    ["\t>=1\t", "2", true],
  ])("%s against %s matches %s", (predicate, candidate, expected) => {
    expect(compileFabricVersionPredicate(predicate)(candidate)).toBe(expected);
  });

  it("uses OR arrays, including empty arrays matching no version", () => {
    expect(compileFabricVersionPredicate(["1", ">=3 <4"])("3.5")).toBe(true);
    expect(compileFabricVersionPredicate(["1", ">=3 <4"])("2")).toBe(false);
    expect(compileFabricVersionPredicate([])("1")).toBe(false);
  });

  it.each([
    ">release",
    "<snapshot",
    ">=1.x",
    "~1.2.x",
    ">= 1",
    "=",
  ])("rejects malformed/exclusive nonsemantic predicate %s", (predicate) => {
    expect(() => compileFabricVersionPredicate(predicate)).toThrow();
  });

  it("parses all OR alternatives before matching", () => {
    expect(() => compileFabricVersionPredicate(["*", ">snapshot"])).toThrow();
  });
});
