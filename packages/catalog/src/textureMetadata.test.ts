import { describe, expect, it } from "vitest";
import { validateTextureMetadata as validate } from "./textureMetadata.js";

describe("common texture metadata", () => {
  it("uses square frames without explicit dimensions", () =>
    expect(validate({ animation: {} }, 16, 64)).toMatchObject({
      valid: true,
      frameSize: { width: 16, height: 16 },
      frameCount: 4,
    }));
  it("uses whole image height when only width is supplied", () =>
    expect(validate({ animation: { width: 16 } }, 64, 32)).toMatchObject({
      valid: true,
      frameSize: { width: 16, height: 32 },
      frameCount: 4,
    }));
  it("uses whole image width when only height is supplied", () =>
    expect(validate({ animation: { height: 16 } }, 32, 64)).toMatchObject({
      valid: true,
      frameSize: { width: 32, height: 16 },
      frameCount: 4,
    }));
  it("checks explicit frame bounds", () => {
    expect(validate({ animation: { frames: [0, { index: 3, time: 20 }] } }, 16, 64).valid).toBe(
      true,
    );
    expect(validate({ animation: { frames: [4] } }, 16, 64).valid).toBe(false);
  });
  it.each([0, -1, 1.5, "2", null])("rejects invalid frame time %s", (time) =>
    expect(validate({ animation: { frames: [{ index: 0, time }] } }, 16, 16).valid).toBe(false));
  it("rejects non-divisible dimensions", () =>
    expect(validate({ animation: { width: 15 } }, 16, 64).valid).toBe(false));
  it("checks blur/clamp and villager hats", () => {
    expect(
      validate({ texture: { blur: true, clamp: false }, villager: { hat: "partial" } }, 16, 16)
        .valid,
    ).toBe(true);
    expect(validate({ texture: { blur: 1 } }, 16, 16).valid).toBe(false);
  });
  it("does not pass unknown sections or fields", () => {
    expect(validate({ animation: { future: true } }, 16, 16)).toMatchObject({
      valid: false,
      validationComplete: false,
    });
    expect(validate({ future: {} }, 16, 16)).toMatchObject({
      valid: false,
      validationComplete: false,
    });
  });
  it("does not pass unobserved empty animations", () =>
    expect(validate({ animation: { frames: [] } }, 16, 16)).toMatchObject({
      valid: false,
      validationComplete: false,
    }));
  it("refuses sparse frame arrays", () =>
    expect(validate({ animation: { frames: Array(2) } }, 16, 16).valid).toBe(false));
  it("bounds frame work", () =>
    expect(validate({ animation: { frames: Array(100001) } }, 16, 16)).toMatchObject({
      valid: false,
      validationComplete: false,
    }));
  it.each([NaN, Infinity, 0, -1, 1.5])("rejects invalid dimensions %s", (width) =>
    expect(validate({}, width, 16).valid).toBe(false));
});
