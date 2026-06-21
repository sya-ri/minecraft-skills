import { describe, expect, it } from "vitest";
import { getDataRoot, hasDataFile, readDataJson } from "./index.js";

describe("@minecraft-skills/data", () => {
  it("loads bundled catalog JSON", () => {
    const catalog = readDataJson<{ latest: { java: string } }>("catalog.json");
    expect(catalog.latest.java).toBe("26.2");
  });

  it("exposes a package data root", () => {
    expect(getDataRoot()).toMatch(/packages\/data\/data$/);
  });

  it("checks bundled data files", () => {
    expect(hasDataFile("catalog.json")).toBe(true);
    expect(hasDataFile("missing.json")).toBe(false);
  });
});
