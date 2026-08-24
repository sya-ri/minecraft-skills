import { describe, expect, it } from "vitest";
import { validatePlayerSkinLayout } from "./playerSkinLayout.js";

function codes(input: unknown): string[] {
  return validatePlayerSkinLayout(input).diagnostics.map((item) => item.code);
}

describe("validatePlayerSkinLayout", () => {
  it("returns the canonical current face and hat layout", () => {
    const result = validatePlayerSkinLayout({ width: 64, height: 64 });

    expect(result.valid).toBe(true);
    expect(result.layoutStatus).toBe("current");
    expect(result.normalization).toBe("not-needed");
    expect(result.faceLayout).toEqual({
      textureDimensions: { width: 64, height: 64 },
      coordinateConvention: "zero-based-half-open",
      base: { x: 8, y: 8, width: 8, height: 8, xEndExclusive: 16, yEndExclusive: 16 },
      hat: { x: 40, y: 8, width: 8, height: 8, xEndExclusive: 48, yEndExclusive: 16 },
      compositionOrder: ["base", "hat"],
    });
    expect(result.requestedSourceRectChecks).toEqual({
      base: "not-supplied",
      hat: "not-supplied",
    });
  });

  it("accepts legacy 64x32 dimensions without claiming decoded conversion evidence", () => {
    const result = validatePlayerSkinLayout({ width: 64, height: 32 });

    expect(result.valid).toBe(true);
    expect(result.layoutStatus).toBe("legacy");
    expect(result.normalizedDimensions).toEqual({ width: 64, height: 64 });
    expect(result.normalization).toBe("client-converts-legacy-to-64x64");
    expect(result.notes.join(" ")).toContain("does not simulate or prove");
  });

  it("checks exact requested half-open source rectangles", () => {
    const matching = validatePlayerSkinLayout({
      width: 64,
      height: 64,
      sourceRects: {
        base: { x: 8, y: 8, width: 8, height: 8 },
        hat: { x: 40, y: 8, width: 8, height: 8 },
      },
    });
    expect(matching.valid).toBe(true);
    expect(matching.requestedSourceRectChecks).toEqual({ base: "matches", hat: "matches" });

    const clipped = validatePlayerSkinLayout({
      width: 64,
      height: 64,
      sourceRects: {
        base: { x: 8, y: 8, width: 7, height: 8 },
        hat: { x: 39, y: 8, width: 8, height: 8 },
      },
    });
    expect(clipped.valid).toBe(false);
    expect(clipped.requestedSourceRectChecks).toEqual({ base: "mismatch", hat: "mismatch" });
    expect(clipped.diagnostics.map((item) => item.code)).toEqual([
      "skin.face-base-rect-mismatch",
      "skin.face-hat-rect-mismatch",
    ]);
  });

  it("rejects dimensions outside the audited client layouts", () => {
    const result = validatePlayerSkinLayout({ width: 64, height: 63 });

    expect(result.inputAccepted).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.layoutStatus).toBe("invalid");
    expect(result.normalizedDimensions).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain("skin.unsupported-dimensions");
  });

  it("does not execute accessors and rejects symbol, hidden, unknown, and class properties", () => {
    let getterCalls = 0;
    const accessor = { height: 64 } as Record<string, unknown>;
    Object.defineProperty(accessor, "width", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 64;
      },
    });
    expect(codes(accessor)).toContain("input.accessor-property-not-accepted");
    expect(getterCalls).toBe(0);

    const hidden = { width: 64, height: 64 };
    Object.defineProperty(hidden, "extra", { enumerable: false, value: true });
    expect(codes(hidden)).toContain("input.non-enumerable-property-not-accepted");

    const symbol = { width: 64, height: 64, [Symbol("extra")]: true };
    expect(codes(symbol)).toContain("input.symbol-property-not-accepted");
    expect(codes({ width: 64, height: 64, playerName: "private" })).toContain(
      "input.unknown-property",
    );

    class Input {
      width = 64;
      height = 64;
    }
    expect(codes(new Input())).toContain("input.plain-object-required");
  });

  it("rejects proxies and both dense and sparse arrays without invoking traps", () => {
    let trapCalls = 0;
    const proxy = new Proxy(
      { width: 64, height: 64 },
      {
        ownKeys: () => {
          trapCalls += 1;
          return ["width", "height"];
        },
      },
    );
    expect(codes(proxy)).toEqual(["input.proxy-not-accepted"]);
    expect(trapCalls).toBe(0);

    expect(codes([64, 64])).toContain("input.object-required");
    expect(codes(new Array(2))).toContain("input.object-required");

    const revocable = Proxy.revocable({ width: 64, height: 64 }, {});
    revocable.revoke();
    expect(codes(revocable.proxy)).toEqual(["input.proxy-not-accepted"]);
  });

  it("enforces closed nested objects, safe integers, and fixed property limits", () => {
    expect(
      codes({
        width: 64,
        height: 64,
        sourceRects: { base: { x: 8, y: 8, width: 8, height: 8, extra: 1 } },
      }),
    ).toContain("input.property-limit-exceeded");
    expect(codes({ width: 64, height: Number.NaN })).toContain("input.safe-integer-required");
    expect(codes({ width: 64, height: Number.POSITIVE_INFINITY })).toContain(
      "input.safe-integer-required",
    );
    expect(codes({ width: 64, height: 64.5 })).toContain("input.safe-integer-required");
    expect(codes({ width: 64, height: 64, sourceRects: { overlay: {} } })).toContain(
      "input.unknown-property",
    );
    expect(validatePlayerSkinLayout({ width: 64, height: 64 }).notes.join(" ")).toContain(
      "depth-three and four-object-node limits are structural",
    );
  });

  it("keeps model and privacy evidence bounded to non-identity metadata", () => {
    const result = validatePlayerSkinLayout({ width: 64, height: 64 });

    expect(result.modelEvidence).toEqual({
      headUvDependsOnModel: false,
      legacyServiceMetadata: { slim: "slim", wide: "default" },
      missingOrUnknownMetadata: "wide",
      modelInferredFromPixels: false,
    });
    expect(result.sourceEvidence).toMatchObject({
      minecraftVersion: "26.2",
      versionMetadataUrl:
        "https://piston-meta.mojang.com/v1/packages/c75d82e7fa6eca5a043dab0c6cf77cb8317644f4/26.2.json",
      clientSha1: "2dc72797acbc1b63fc16a11c4ac393605f453754",
      classes: expect.arrayContaining([
        "net.minecraft.client.renderer.texture.SkinTextureDownloader",
        "net.minecraft.client.gui.components.PlayerFaceExtractor",
        "net.minecraft.client.resources.SkinManager$TextureCache",
        "net.minecraft.world.entity.player.PlayerModelType",
      ]),
    });
    expect(Object.isFrozen(result.sourceEvidence.classes)).toBe(true);
    expect(result.privacy).toEqual({
      acceptsPlayerIdentity: false,
      acceptsImagePixels: false,
      returnsFilesystemPaths: false,
    });
    expect(JSON.stringify(result)).not.toContain("playerName");

    const rejectedIdentity = validatePlayerSkinLayout({
      width: 64,
      height: 64,
      "PrivatePlayerName-123": true,
    });
    expect(rejectedIdentity.valid).toBe(false);
    expect(JSON.stringify(rejectedIdentity)).not.toContain("PrivatePlayerName-123");
  });
});
