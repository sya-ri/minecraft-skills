import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getVerifiedJavaPlayerTextures,
  type JavaPlayerProfileFetch,
  lookupJavaPlayerProfileByName,
} from "./javaPlayerProfileNetwork.js";

const profileName = "jeb_";
const uuid = "853c80ef-3c37-49fd-aa49-938b674adae6";
const undashedUuid = "853c80ef3c3749fdaa49938b674adae6";
const skinHash = "a".repeat(64);
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2_048 });
const encodedPublicKey = (publicKey.export({ format: "der", type: "spki" }) as Buffer).toString(
  "base64",
);

function signedSession(): Record<string, unknown> {
  const payload = {
    timestamp: 1_777_777_777_777,
    profileId: undashedUuid,
    profileName,
    signatureRequired: true,
    textures: {
      SKIN: {
        url: `http://textures.minecraft.net/texture/${skinHash}`,
        metadata: { model: "slim" },
      },
    },
  };
  const value = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  const signature = sign("sha1", Buffer.from(value, "ascii"), privateKey).toString("base64");
  return {
    id: undashedUuid,
    name: profileName,
    properties: [{ name: "textures", value, signature }],
  };
}

function keys(): Record<string, unknown> {
  return {
    profilePropertyKeys: [{ publicKey: encodedPublicKey }],
    playerCertificateKeys: [],
  };
}

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Response(typeof value === "string" ? value : JSON.stringify(value), {
    ...init,
    headers,
  });
}

function profileFetch(options: {
  lookup?: Response | (() => Response);
  session?: Response | (() => Response);
  publicKeys?: Response | (() => Response);
  requests?: Array<{ url: string; init?: RequestInit }>;
}): JavaPlayerProfileFetch {
  return async (url, init) => {
    options.requests?.push({ url, ...(init === undefined ? {} : { init }) });
    if (url.includes("/lookup/name/")) {
      const response = options.lookup ?? jsonResponse({ id: undashedUuid, name: profileName });
      return typeof response === "function" ? response() : response;
    }
    if (url === "https://api.minecraftservices.com/publickeys") {
      const response = options.publicKeys ?? jsonResponse(keys());
      return typeof response === "function" ? response() : response;
    }
    const response = options.session ?? jsonResponse(signedSession());
    return typeof response === "function" ? response() : response;
  };
}

describe("Java player profile fixed-endpoint network boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("looks up a name through the fixed official endpoint with a closed request", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await lookupJavaPlayerProfileByName("JeB_", profileFetch({ requests }));

    expect(result).toMatchObject({
      status: "found",
      profile: { uuid, name: profileName },
      source: {
        minecraftVersion: "26.2",
        authlib: {
          version: "9.0.75",
          sha1: "d61056a234d5e4b272e09d59b0713f80d6c0b6af",
        },
        stability: "version-specific-undocumented",
      },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.mojang.com/minecraft/profile/lookup/name/jeb_");
    expect(requests[0]?.init?.redirect).toBe("manual");
    expect(requests[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(requests[0]?.init?.headers).get("accept")).toBe("application/json");
    expect(new Headers(requests[0]?.init?.headers).get("authorization")).toBeNull();
    expect(requests[0]?.init).not.toHaveProperty("body");
  });

  it("resolves signed metadata through only the fixed session and key endpoints", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await getVerifiedJavaPlayerTextures(uuid, profileFetch({ requests }));

    expect(result).toMatchObject({
      status: "verified",
      data: {
        profile: { uuid, name: profileName },
        textures: {
          skin: {
            hash: skinHash,
            canonicalUrl: `https://textures.minecraft.net/texture/${skinHash}`,
            model: "slim",
          },
        },
        verification: { state: "verified" },
      },
    });
    expect(requests.map(({ url }) => url)).toEqual([
      `https://sessionserver.mojang.com/session/minecraft/profile/${undashedUuid}?unsigned=false`,
      "https://api.minecraftservices.com/publickeys",
    ]);
    expect(requests.every(({ init }) => init?.redirect === "manual")).toBe(true);
  });

  it("accepts the official endpoint header shapes while bounding decoded bodies", async () => {
    const lookupBody = JSON.stringify({ id: undashedUuid, name: profileName });
    const result = await lookupJavaPlayerProfileByName(
      profileName,
      profileFetch({
        lookup: new Response(lookupBody, {
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(lookupBody)),
          },
        }),
      }),
    );
    expect(result.status).toBe("found");

    const sessionBody = JSON.stringify(signedSession());
    const keysBody = JSON.stringify(keys());
    const compressed = await getVerifiedJavaPlayerTextures(
      uuid,
      profileFetch({
        session: new Response(sessionBody, {
          headers: {
            "Content-Type": "application/json",
            "Content-Encoding": "gzip",
            "Content-Length": "1051",
          },
        }),
        publicKeys: new Response(keysBody, {
          headers: {
            "Content-Type": "application/json",
            "Content-Encoding": "gzip",
            "Content-Length": "3989",
          },
        }),
      }),
    );
    expect(compressed.status).toBe("verified");
  });

  it.each([
    [403, { status: "forbidden", endpoint: "name-lookup", httpStatus: 403 }],
    [404, { status: "not-found", endpoint: "name-lookup" }],
    [503, { status: "upstream-error", code: "service-unavailable", httpStatus: 503 }],
  ])("keeps HTTP %i distinct at the profile lookup boundary", async (status, expected) => {
    const result = await lookupJavaPlayerProfileByName(
      profileName,
      profileFetch({ lookup: new Response(null, { status }) }),
    );
    expect(result).toMatchObject(expected);
  });

  it("bounds numeric Retry-After without accepting date or injected text", async () => {
    const bounded = await lookupJavaPlayerProfileByName(
      profileName,
      profileFetch({
        lookup: new Response(null, {
          status: 429,
          headers: { "Retry-After": "999999999999999999999999" },
        }),
      }),
    );
    expect(bounded).toEqual({
      status: "rate-limited",
      endpoint: "name-lookup",
      httpStatus: 429,
      retryAfterSeconds: 3_600,
    });

    const malformed = await lookupJavaPlayerProfileByName(
      profileName,
      profileFetch({
        lookup: new Response(null, {
          status: 429,
          headers: { "Retry-After": "Wed, 21 Oct 2030 07:28:00 GMT secret" },
        }),
      }),
    );
    expect(malformed).toMatchObject({ status: "rate-limited", retryAfterSeconds: null });
  });

  it("rejects redirects instead of following them", async () => {
    const result = await lookupJavaPlayerProfileByName(
      profileName,
      profileFetch({
        lookup: new Response(null, {
          status: 302,
          headers: { Location: "https://attacker.invalid/profile" },
        }),
      }),
    );
    expect(result).toEqual({
      status: "upstream-error",
      endpoint: "name-lookup",
      code: "redirect-rejected",
      httpStatus: 302,
    });
    expect(JSON.stringify(result)).not.toContain("attacker.invalid");
  });

  it.each([
    [
      "content type",
      () => new Response("{}", { headers: { "Content-Type": "text/plain" } }),
      "invalid-content-type",
    ],
    [
      "content encoding",
      () =>
        new Response("{}", {
          headers: { "Content-Type": "application/json", "Content-Encoding": "zstd" },
        }),
      "unsupported-content-encoding",
    ],
    [
      "invalid content length",
      () =>
        new Response("{}", {
          headers: { "Content-Type": "application/json", "Content-Length": "not-a-number" },
        }),
      "invalid-content-length",
    ],
    [
      "truncated body",
      () =>
        new Response("{}", {
          headers: { "Content-Type": "application/json", "Content-Length": "3" },
        }),
      "truncated-response",
    ],
    ["invalid JSON", () => jsonResponse("{"), "invalid-json"],
  ])("rejects an invalid %s response", async (_label, response, code) => {
    const result = await lookupJavaPlayerProfileByName(
      profileName,
      profileFetch({ lookup: response }),
    );
    expect(result).toMatchObject({ status: "invalid-response", code });
  });

  it("stops streaming lookup responses above the byte limit", async () => {
    const result = await lookupJavaPlayerProfileByName(
      profileName,
      profileFetch({ lookup: jsonResponse(`"${"x".repeat(8 * 1_024)}"`) }),
    );
    expect(result).toMatchObject({ status: "invalid-response", code: "oversized-response" });
  });

  it("keeps the oversize outcome when stream cancellation throws", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8 * 1_024 + 1));
      },
      cancel(): never {
        throw new Error("cancel failure must not escape");
      },
    });
    const result = await lookupJavaPlayerProfileByName(
      profileName,
      profileFetch({
        lookup: new Response(stream, { headers: { "Content-Type": "application/json" } }),
      }),
    );
    expect(result).toMatchObject({ status: "invalid-response", code: "oversized-response" });
  });

  it("classifies hostile response status and header access without throwing", async () => {
    const statusProxy = new Proxy(jsonResponse({ id: undashedUuid, name: profileName }), {
      get(target, property, receiver) {
        if (property === "status") {
          throw new Error("status getter failure");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const headerFailure = {
      status: 200,
      headers: {
        get(): never {
          throw new Error("header getter failure");
        },
      },
      body: new ReadableStream(),
    } as unknown as Response;

    const cases = [
      {
        response: statusProxy,
        expected: {
          status: "upstream-error",
          endpoint: "name-lookup",
          code: "network",
        },
      },
      {
        response: headerFailure,
        expected: {
          status: "invalid-response",
          endpoint: "name-lookup",
          code: "body-read-failed",
        },
      },
    ] as const;
    for (const { response, expected } of cases) {
      const result = await lookupJavaPlayerProfileByName(
        profileName,
        profileFetch({ lookup: response }),
      );
      expect(result).toEqual(expected);
    }

    let coercedStatus = false;
    const nonNumericStatus = {
      status: {
        valueOf(): never {
          coercedStatus = true;
          throw new Error("status must not be coerced");
        },
      },
      headers: new Headers({ "Content-Type": "application/json" }),
      body: new ReadableStream(),
    } as unknown as Response;
    await expect(
      lookupJavaPlayerProfileByName(profileName, profileFetch({ lookup: nonNumericStatus })),
    ).resolves.toMatchObject({ status: "invalid-response", code: "invalid-status" });
    expect(coercedStatus).toBe(false);
  });

  it("classifies a body reader failure as an invalid response", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(): never {
        throw new Error("reader failure");
      },
    });
    const result = await lookupJavaPlayerProfileByName(
      profileName,
      profileFetch({
        lookup: new Response(stream, { headers: { "Content-Type": "application/json" } }),
      }),
    );
    expect(result).toEqual({
      status: "invalid-response",
      endpoint: "name-lookup",
      code: "body-read-failed",
    });
  });

  it("rejects unknown response fields after bounded JSON parsing", async () => {
    const result = await lookupJavaPlayerProfileByName(
      profileName,
      profileFetch({
        lookup: jsonResponse({ id: undashedUuid, name: profileName, rawUrl: "secret" }),
      }),
    );
    expect(result).toMatchObject({ status: "invalid-response", code: "invalid-schema" });
  });

  it("aborts a request after the fixed timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl: JavaPlayerProfileFetch = async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    const lookup = lookupJavaPlayerProfileByName(profileName, fetchImpl);
    const result = expect(lookup).resolves.toEqual({
      status: "upstream-error",
      endpoint: "name-lookup",
      code: "timeout",
    });
    await vi.advanceTimersByTimeAsync(5_000);
    await result;
  });

  it("never includes thrown transport details, input identity, or a request URL in failures", async () => {
    const fetchImpl: JavaPlayerProfileFetch = async () => {
      throw new Error(
        `token=secret profile=${profileName} uuid=${uuid} https://attacker.invalid/private`,
      );
    };
    const result = await lookupJavaPlayerProfileByName(profileName, fetchImpl);
    const serialized = JSON.stringify(result);
    expect(result).toEqual({
      status: "upstream-error",
      endpoint: "name-lookup",
      code: "network",
    });
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain(profileName);
    expect(serialized).not.toContain(uuid);
    expect(serialized).not.toContain("http");
  });

  it("keeps key endpoint failures distinct from profile and signature outcomes", async () => {
    const forbidden = await getVerifiedJavaPlayerTextures(
      uuid,
      profileFetch({ publicKeys: new Response(null, { status: 403 }) }),
    );
    expect(forbidden).toEqual({
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "forbidden",
      httpStatus: 403,
    });

    const rateLimited = await getVerifiedJavaPlayerTextures(
      uuid,
      profileFetch({
        publicKeys: new Response(null, { status: 429, headers: { "Retry-After": "15" } }),
      }),
    );
    expect(rateLimited).toEqual({
      status: "rate-limited",
      endpoint: "public-keys",
      httpStatus: 429,
      retryAfterSeconds: 15,
    });

    const malformed = await getVerifiedJavaPlayerTextures(
      uuid,
      profileFetch({ publicKeys: jsonResponse("{") }),
    );
    expect(malformed).toEqual({
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "invalid-response",
    });
  });

  it("fails closed on unsigned session metadata before requesting public keys", async () => {
    const session = signedSession();
    delete (session.properties as Array<Record<string, unknown>>)[0]?.signature;
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await getVerifiedJavaPlayerTextures(
      uuid,
      profileFetch({ session: jsonResponse(session), requests }),
    );
    expect(result).toEqual({ status: "signature-missing", endpoint: "session-profile" });
    expect(requests.map(({ url }) => url)).toEqual([
      `https://sessionserver.mojang.com/session/minecraft/profile/${undashedUuid}?unsigned=false`,
    ]);
  });
});
