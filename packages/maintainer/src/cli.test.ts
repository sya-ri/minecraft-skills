import { describe, expect, it } from "vitest";
import { validateRepository } from "./cli.js";

describe("maintainer validation", () => {
  it("validates the checked-in generated structure", () => {
    expect(validateRepository()).toEqual({
      ok: true,
      messages: [],
    });
  });
});
