import { describe, expect, it } from "vitest";
import { getDataRoot, readDataJson } from "./index.js";

describe("@minecraft-skills/data", () => {
  it("loads bundled catalog JSON", () => {
    const catalog = readDataJson<{ latest: { java: string } }>("catalog.json");
    expect(catalog.latest.java).toBe("26.2");
  });

  it("exposes a package data root", () => {
    expect(getDataRoot()).toMatch(/packages\/data\/data$/);
  });
});
