import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  inspectJavaPlayerSessionResponse,
  normalizeJavaPlayerName,
  normalizeJavaPlayerUuid,
  parseJavaPlayerProfileLookupResponse,
  verifyJavaPlayerTextureMetadata,
} from "./javaPlayerProfile.js";

const profileName = "jeb_";
const uuid = "853c80ef-3c37-49fd-aa49-938b674adae6";
const undashedUuid = "853c80ef3c3749fdaa49938b674adae6";
const otherUuid = "12345678-1234-1234-1234-123456789abc";
const otherUndashedUuid = "12345678123412341234123456789abc";
const skinHash = "a".repeat(64);
const capeHash = "b".repeat(64);
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2_048 });
const encodedPublicKey = (publicKey.export({ format: "der", type: "spki" }) as Buffer).toString(
  "base64",
);

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    timestamp: 1_777_777_777_777,
    profileId: undashedUuid,
    profileName,
    signatureRequired: true,
    textures: {
      SKIN: {
        url: `http://textures.minecraft.net/texture/${skinHash}`,
        metadata: { model: "slim" },
      },
      CAPE: {
        url: `https://textures.minecraft.net/texture/${capeHash}`,
      },
    },
    ...overrides,
  };
}

function signedSession(
  texturePayload: Record<string, unknown> = payload(),
  sessionOverrides: Record<string, unknown> = {},
): { sessionResponse: Record<string, unknown>; value: string; signature: string } {
  const value = Buffer.from(JSON.stringify(texturePayload), "utf8").toString("base64");
  const signature = sign("sha1", Buffer.from(value, "ascii"), privateKey).toString("base64");
  return {
    sessionResponse: {
      id: undashedUuid,
      name: profileName,
      properties: [{ name: "textures", value, signature }],
      ...sessionOverrides,
    },
    value,
    signature,
  };
}

function publicKeysResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    profilePropertyKeys: [{ publicKey: encodedPublicKey }],
    playerCertificateKeys: [],
    ...overrides,
  };
}

function firstSessionProperty(sessionResponse: Record<string, unknown>): Record<string, unknown> {
  const properties = sessionResponse.properties;
  const firstProperty = Array.isArray(properties) ? properties[0] : undefined;
  if (typeof firstProperty !== "object" || firstProperty === null) {
    throw new Error("test fixture is missing its first session property");
  }
  return firstProperty as Record<string, unknown>;
}

function verifyFixture(
  texturePayload: Record<string, unknown> = payload(),
  options: {
    sessionOverrides?: Record<string, unknown>;
    keyOverrides?: Record<string, unknown>;
  } = {},
) {
  const session = signedSession(texturePayload, options.sessionOverrides);
  return verifyJavaPlayerTextureMetadata({
    sessionResponse: session.sessionResponse,
    publicKeysResponse: publicKeysResponse(options.keyOverrides),
    expectedUuid: uuid,
  });
}

describe("Java player profile pure validation", () => {
  it("normalizes bounded Java names and both UUID spellings without accepting coercion", () => {
    expect(normalizeJavaPlayerName("JeB_")).toEqual({
      status: "normalized",
      lookupName: "jeb_",
    });
    expect(normalizeJavaPlayerName({ toString: () => "jeb_" })).toEqual({
      status: "invalid-input",
      field: "name",
      code: "unsupported-format",
    });
    expect(normalizeJavaPlayerName("x".repeat(17)).status).toBe("invalid-input");
    expect(normalizeJavaPlayerUuid(undashedUuid)).toEqual({
      status: "normalized",
      uuid,
      undashedUuid,
    });
    expect(normalizeJavaPlayerUuid(uuid.toUpperCase())).toEqual({
      status: "normalized",
      uuid,
      undashedUuid,
    });
    expect(normalizeJavaPlayerUuid({ valueOf: () => undashedUuid }).status).toBe("invalid-input");
  });

  it("parses a canonical name lookup without invoking hostile nested values", () => {
    expect(
      parseJavaPlayerProfileLookupResponse({ id: undashedUuid, name: "JeB_" }, "jeb_"),
    ).toEqual({
      status: "found",
      profile: { uuid, name: "JeB_" },
    });

    const hostileName = {
      toString(): never {
        throw new Error("must not execute");
      },
    };
    expect(() =>
      parseJavaPlayerProfileLookupResponse({ id: undashedUuid, name: hostileName }, "jeb_"),
    ).not.toThrow();
    expect(
      parseJavaPlayerProfileLookupResponse({ id: undashedUuid, name: hostileName }, "jeb_"),
    ).toMatchObject({ status: "invalid-response", code: "invalid-schema" });
    expect(
      parseJavaPlayerProfileLookupResponse({ id: undashedUuid, name: "other" }, "jeb_"),
    ).toMatchObject({ status: "identity-mismatch", code: "requested-name" });

    let coercedExpectedName = false;
    const hostileExpectedName = {
      toString(): never {
        coercedExpectedName = true;
        throw new Error("must not execute");
      },
    };
    expect(
      parseJavaPlayerProfileLookupResponse(
        { id: undashedUuid, name: profileName },
        hostileExpectedName as unknown as string,
      ),
    ).toMatchObject({ status: "invalid-response", code: "invalid-schema" });
    expect(coercedExpectedName).toBe(false);
  });

  it.each([
    ["array", [undashedUuid, profileName]],
    [
      "class",
      new (class ProfileResponse {
        id = undashedUuid;
        name = profileName;
      })(),
    ],
    ["unknown field", { id: undashedUuid, name: profileName, unexpected: true }],
  ])("rejects a %s response as non-JSON schema data", (_label, value) => {
    expect(parseJavaPlayerProfileLookupResponse(value, "jeb_")).toMatchObject({
      status: "invalid-response",
      code: "invalid-schema",
    });
  });

  it("rejects proxy, revoked proxy, accessor, symbol, and hidden-property responses", () => {
    const proxy = new Proxy({ id: undashedUuid, name: profileName }, {});
    const revocable = Proxy.revocable({ id: undashedUuid, name: profileName }, {});
    revocable.revoke();
    let getterCalled = false;
    const accessor = { id: undashedUuid } as Record<string, unknown>;
    Object.defineProperty(accessor, "name", {
      enumerable: true,
      get() {
        getterCalled = true;
        return profileName;
      },
    });
    const symbol = { id: undashedUuid, name: profileName } as Record<PropertyKey, unknown>;
    symbol[Symbol("hidden")] = true;
    const hidden = { id: undashedUuid } as Record<string, unknown>;
    Object.defineProperty(hidden, "name", { enumerable: false, value: profileName });

    for (const value of [proxy, revocable.proxy, accessor, symbol, hidden]) {
      expect(() => parseJavaPlayerProfileLookupResponse(value, "jeb_")).not.toThrow();
      expect(parseJavaPlayerProfileLookupResponse(value, "jeb_").status).toBe("invalid-response");
    }
    expect(getterCalled).toBe(false);
  });

  it("distinguishes a missing textures property from a missing property signature", () => {
    expect(
      inspectJavaPlayerSessionResponse(
        { id: undashedUuid, name: profileName, properties: [] },
        uuid,
      ),
    ).toEqual({ status: "textures-property-missing", endpoint: "session-profile" });

    const { sessionResponse } = signedSession();
    const unsigned = structuredClone(sessionResponse);
    delete (unsigned.properties as Array<Record<string, unknown>>)[0]?.signature;
    expect(inspectJavaPlayerSessionResponse(unsigned, uuid)).toEqual({
      status: "signature-missing",
      endpoint: "session-profile",
    });
  });

  it("verifies signed metadata and exposes only canonical bounded references", () => {
    const result = verifyFixture();
    expect(result).toEqual({
      status: "verified",
      data: {
        profile: { uuid, name: profileName },
        timestamp: 1_777_777_777_777,
        textures: {
          skin: {
            hash: skinHash,
            canonicalUrl: `https://textures.minecraft.net/texture/${skinHash}`,
            model: "slim",
            modelEvidence: "signed-metadata-model-slim",
          },
          cape: {
            hash: capeHash,
            canonicalUrl: `https://textures.minecraft.net/texture/${capeHash}`,
          },
          elytra: null,
        },
        verification: {
          state: "verified",
          algorithm: "SHA1withRSA",
          keySource: "official-profile-property-keys",
        },
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain(encodedPublicKey);
    expect(serialized).not.toContain(signedSession().value);
    expect(serialized).not.toContain(signedSession().signature);
  });

  it("does not depend on unrelated player-certificate key data", () => {
    const hostileCertificateKeys = new Proxy([], {
      get(): never {
        throw new Error("unrelated data must not be read");
      },
    });
    const result = verifyFixture(payload(), {
      keyOverrides: {
        playerCertificateKeys: hostileCertificateKeys,
        futureKeyCategory: { anything: true },
      },
    });
    expect(result.status).toBe("verified");
  });

  it("reports malformed value, malformed signature, invalid signature, and unusable keys separately", () => {
    const valid = signedSession();
    const invalidValue = structuredClone(valid.sessionResponse);
    firstSessionProperty(invalidValue).value = "***";
    expect(
      verifyJavaPlayerTextureMetadata({
        sessionResponse: invalidValue,
        publicKeysResponse: publicKeysResponse(),
        expectedUuid: uuid,
      }),
    ).toMatchObject({ status: "invalid-response", code: "invalid-textures-payload" });

    const malformedSignature = structuredClone(valid.sessionResponse);
    firstSessionProperty(malformedSignature).signature = "***";
    expect(
      verifyJavaPlayerTextureMetadata({
        sessionResponse: malformedSignature,
        publicKeysResponse: publicKeysResponse(),
        expectedUuid: uuid,
      }),
    ).toMatchObject({ status: "invalid-signature", code: "malformed-signature" });

    const invalidSignature = structuredClone(valid.sessionResponse);
    firstSessionProperty(invalidSignature).signature = Buffer.alloc(256).toString("base64");
    expect(
      verifyJavaPlayerTextureMetadata({
        sessionResponse: invalidSignature,
        publicKeysResponse: publicKeysResponse(),
        expectedUuid: uuid,
      }),
    ).toMatchObject({ status: "invalid-signature", code: "verification-failed" });

    expect(
      verifyJavaPlayerTextureMetadata({
        sessionResponse: valid.sessionResponse,
        publicKeysResponse: publicKeysResponse({
          profilePropertyKeys: [{ publicKey: "AAAA" }],
        }),
        expectedUuid: uuid,
      }),
    ).toMatchObject({ status: "key-unavailable", code: "no-usable-keys" });
  });

  it("rejects unsafe integers, oversized collections, and unknown signed fields", () => {
    expect(verifyFixture(payload({ timestamp: Number.MAX_SAFE_INTEGER + 1 }))).toMatchObject({
      status: "invalid-response",
      code: "invalid-textures-payload",
    });
    expect(
      inspectJavaPlayerSessionResponse(
        {
          id: undashedUuid,
          name: profileName,
          properties: Array.from({ length: 17 }, () => ({ name: "other", value: "x" })),
        },
        uuid,
      ),
    ).toMatchObject({ status: "invalid-response", code: "invalid-schema" });
    expect(verifyFixture(payload({ unknownSignedField: true }))).toMatchObject({
      status: "invalid-response",
      code: "invalid-textures-payload",
    });
  });

  it("binds the requested UUID, session name, and signed payload identity", () => {
    expect(
      inspectJavaPlayerSessionResponse(
        { id: otherUndashedUuid, name: profileName, properties: [] },
        uuid,
      ),
    ).toMatchObject({ status: "identity-mismatch", code: "requested-uuid" });
    expect(verifyFixture(payload({ profileId: otherUndashedUuid }))).toMatchObject({
      status: "identity-mismatch",
      code: "payload-uuid",
    });
    expect(verifyFixture(payload({ profileName: "other" }))).toMatchObject({
      status: "identity-mismatch",
      code: "payload-name",
    });
    expect(
      verifyFixture(payload({ profileId: otherUndashedUuid }), {
        sessionOverrides: { id: otherUndashedUuid },
      }),
    ).toMatchObject({ status: "identity-mismatch", code: "requested-uuid" });
    expect(otherUuid).not.toBe(uuid);
  });

  it.each([
    ["off-host", `https://example.com/texture/${skinHash}`],
    ["unsupported scheme", `ftp://textures.minecraft.net/texture/${skinHash}`],
    ["wrong path", `https://textures.minecraft.net/textures/${skinHash}`],
    ["query", `https://textures.minecraft.net/texture/${skinHash}?x=1`],
    ["userinfo", `https://user@textures.minecraft.net/texture/${skinHash}`],
    ["port", `https://textures.minecraft.net:443/texture/${skinHash}`],
  ])("rejects a %s texture reference", (_label, url) => {
    expect(
      verifyFixture(
        payload({
          textures: { SKIN: { url } },
        }),
      ),
    ).toMatchObject({ status: "invalid-response", code: "unsafe-texture-reference" });
  });

  it("accepts the current official HTTP reference only as evidence for a rebuilt HTTPS URL", () => {
    const wide = verifyFixture(
      payload({
        textures: {
          SKIN: { url: `http://textures.minecraft.net/texture/${skinHash}` },
        },
      }),
    );
    expect(wide).toMatchObject({
      status: "verified",
      data: {
        textures: {
          skin: {
            canonicalUrl: `https://textures.minecraft.net/texture/${skinHash}`,
            model: "wide",
            modelEvidence: "signed-metadata-model-absent",
          },
        },
      },
    });
  });

  it("rejects hostile verification root inputs without throwing or reading accessors", () => {
    const validInput = {
      sessionResponse: signedSession().sessionResponse,
      publicKeysResponse: publicKeysResponse(),
      expectedUuid: uuid,
    };
    const revocable = Proxy.revocable(validInput, {});
    revocable.revoke();
    let getterCalled = false;
    const accessor = { ...validInput } as Record<string, unknown>;
    Object.defineProperty(accessor, "expectedUuid", {
      enumerable: true,
      get() {
        getterCalled = true;
        return uuid;
      },
    });
    const hidden = { ...validInput } as Record<string, unknown>;
    Object.defineProperty(hidden, "expectedUuid", { enumerable: false, value: uuid });
    const symbol = { ...validInput } as Record<PropertyKey, unknown>;
    symbol[Symbol("unexpected")] = true;
    const unknown = { ...validInput, endpoint: "https://attacker.invalid" };
    const classInput = new (class VerificationInput {
      sessionResponse = validInput.sessionResponse;
      publicKeysResponse = validInput.publicKeysResponse;
      expectedUuid = uuid;
    })();

    for (const input of [
      revocable.proxy,
      accessor,
      hidden,
      symbol,
      unknown,
      classInput,
      [validInput],
    ]) {
      expect(() => verifyJavaPlayerTextureMetadata(input)).not.toThrow();
      expect(verifyJavaPlayerTextureMetadata(input)).toEqual({
        status: "invalid-input",
        field: "verification-input",
        code: "unsupported-structure",
      });
    }
    expect(getterCalled).toBe(false);
  });

  it("rejects hostile nested session data without coercion", () => {
    const revocable = Proxy.revocable({ id: undashedUuid }, {});
    revocable.revoke();
    const hostileName = {
      valueOf(): never {
        throw new Error("must not execute");
      },
      toString(): never {
        throw new Error("must not execute");
      },
    };
    for (const sessionResponse of [
      revocable.proxy,
      { id: undashedUuid, name: hostileName, properties: [] },
    ]) {
      expect(() =>
        verifyJavaPlayerTextureMetadata({
          sessionResponse,
          publicKeysResponse: publicKeysResponse(),
          expectedUuid: uuid,
        }),
      ).not.toThrow();
      expect(
        verifyJavaPlayerTextureMetadata({
          sessionResponse,
          publicKeysResponse: publicKeysResponse(),
          expectedUuid: uuid,
        }).status,
      ).toBe("invalid-response");
    }
  });
});
