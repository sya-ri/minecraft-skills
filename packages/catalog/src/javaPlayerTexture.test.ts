import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  downloadJavaPlayerTexture,
  inspectJavaPlayerTextureBytes,
  type JavaPlayerTextureFetch,
  javaPlayerTextureDownloadLimits,
  javaPlayerTextureSourceEvidence,
} from "./javaPlayerTexture.js";

const referenceHash = "0123456789abcdef".repeat(4);
const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(value: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array = new Uint8Array()): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.byteLength);
  result.writeUInt32BE(data.byteLength, 0);
  typeBytes.copy(result, 4);
  Buffer.from(data).copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])), 8 + data.byteLength);
  return result;
}

function structuralPng(width = 64, height = 64): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", Buffer.from([0x78, 0x9c, 0x03, 0x00])),
    pngChunk("IEND"),
  ]);
}

function successResponse(bytes: Uint8Array, headers: Record<string, string> = {}): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-length": String(bytes.byteLength),
      ...headers,
    },
  });
}

function streamedResponse(
  stream: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
) {
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "image/png", ...headers },
  });
}

describe("inspectJavaPlayerTextureBytes", () => {
  it("records separate reference and downloaded SHA-256 evidence for a current skin", () => {
    const bytes = structuralPng();
    const result = inspectJavaPlayerTextureBytes(referenceHash, "skin", bytes);

    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.content.kind).toBe("skin");
    expect(result.content.byteLength).toBe(bytes.byteLength);
    expect(result.content.bytes).not.toBe(bytes);
    expect(Buffer.from(result.content.bytes)).toEqual(bytes);
    expect(result.content.evidence).toEqual({
      requestedReferenceHash: referenceHash,
      downloadedContentSha256: createHash("sha256").update(bytes).digest("hex"),
    });
    expect(result.content.evidence.downloadedContentSha256).not.toBe(referenceHash);
    expect(result.content.png).toMatchObject({
      valid: true,
      validationComplete: true,
      width: 64,
      height: 64,
    });
    expect(result.content.skinLayout).toMatchObject({ valid: true, layoutStatus: "current" });
    expect(result.nonGuarantees.join(" ")).toContain("does not prove authenticity");
  });

  it("accepts the audited legacy skin dimensions", () => {
    const result = inspectJavaPlayerTextureBytes(referenceHash, "skin", structuralPng(64, 32));

    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.content.skinLayout).toMatchObject({ valid: true, layoutStatus: "legacy" });
  });

  it.each([
    "cape",
    "elytra",
  ] as const)("keeps %s inspection to bounded PNG structure without a skin-layout claim", (kind) => {
    const result = inspectJavaPlayerTextureBytes(referenceHash, kind, structuralPng(17, 31));

    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.content.skinLayout).toBeNull();
    expect(result.nonGuarantees.join(" ")).toContain("Cape and elytra dimensions");
  });

  it("rejects unsupported skin dimensions after retaining PNG evidence", () => {
    const result = inspectJavaPlayerTextureBytes(referenceHash, "skin", structuralPng(64, 63));

    expect(result).toMatchObject({
      status: "invalid-content",
      kind: "skin",
      code: "invalid-skin-layout",
      png: { valid: true, validationComplete: true, width: 64, height: 63 },
      skinLayout: { valid: false, layoutStatus: "invalid" },
    });
  });

  it("rejects invalid PNG structure with bounded structural evidence", () => {
    const result = inspectJavaPlayerTextureBytes(referenceHash, "skin", Buffer.from("not a png"));

    expect(result).toMatchObject({
      status: "invalid-content",
      code: "invalid-png",
      png: { valid: false, validationComplete: false },
      skinLayout: null,
    });
  });

  it("requires a strict lowercase 64-hex reference and a closed texture kind", () => {
    expect(
      inspectJavaPlayerTextureBytes(referenceHash.toUpperCase(), "skin", structuralPng()),
    ).toMatchObject({ status: "invalid-input", code: "invalid-reference-hash" });
    expect(
      inspectJavaPlayerTextureBytes(referenceHash.slice(1), "skin", structuralPng()),
    ).toMatchObject({ status: "invalid-input", code: "invalid-reference-hash" });
    expect(inspectJavaPlayerTextureBytes(referenceHash, "head", structuralPng())).toMatchObject({
      status: "invalid-input",
      code: "invalid-kind",
      kind: null,
    });
  });

  it("rejects proxies, subclasses, and own byte metadata without invoking hostile behavior", () => {
    const revocable = Proxy.revocable(new Uint8Array([1]), {});
    revocable.revoke();
    expect(inspectJavaPlayerTextureBytes(referenceHash, "skin", revocable.proxy)).toMatchObject({
      status: "invalid-input",
      code: "invalid-bytes",
    });

    let subclassGetterCalls = 0;
    class HostileBytes extends Uint8Array {
      override get byteLength(): number {
        subclassGetterCalls += 1;
        return super.byteLength;
      }
    }
    expect(
      inspectJavaPlayerTextureBytes(referenceHash, "skin", new HostileBytes([1, 2, 3])),
    ).toMatchObject({ status: "invalid-input", code: "invalid-bytes" });
    expect(subclassGetterCalls).toBe(0);

    let ownGetterCalls = 0;
    const ownAccessor = new Uint8Array([1, 2, 3]);
    Object.defineProperty(ownAccessor, "byteLength", {
      get: () => {
        ownGetterCalls += 1;
        return 3;
      },
    });
    expect(inspectJavaPlayerTextureBytes(referenceHash, "skin", ownAccessor)).toMatchObject({
      status: "invalid-input",
      code: "invalid-bytes",
    });
    expect(ownGetterCalls).toBe(0);
  });

  it("reports the byte cap before copying an oversized direct view", () => {
    const bytes = new Uint8Array(javaPlayerTextureDownloadLimits.maxResponseBytes + 1);
    const result = inspectJavaPlayerTextureBytes(referenceHash, "skin", bytes);

    expect(result).toMatchObject({
      status: "invalid-content",
      code: "response-byte-limit-exceeded",
      byteLength: javaPlayerTextureDownloadLimits.maxResponseBytes + 1,
      evidence: null,
      png: null,
      skinLayout: null,
    });
  });

  it("publishes pinned source, network, privacy, and fixed-bound evidence", () => {
    const result = inspectJavaPlayerTextureBytes(referenceHash, "cape", structuralPng());

    expect(result.limits).toEqual({
      requestTimeoutMs: 5_000,
      maxResponseBytes: 1_048_576,
      maxResponseChunks: 4_096,
      maxPngChunks: 4_096,
      maxPngDiagnostics: 32,
    });
    expect(result.networkPolicy).toEqual({
      scheme: "https",
      host: "textures.minecraft.net",
      path: "/texture/<64-lowercase-hex>",
      redirect: "reject",
      responseStatus: 200,
      contentType: "image/png",
      contentEncoding: "identity",
    });
    expect(result.privacy).toEqual({
      acceptsPlayerIdentity: false,
      acceptsCallerUrl: false,
      acceptsCallerHeaders: false,
      returnsFilesystemPaths: false,
    });
    expect(javaPlayerTextureSourceEvidence).toMatchObject({
      minecraftVersion: "26.2",
      clientSha1: "2dc72797acbc1b63fc16a11c4ac393605f453754",
      authlib: {
        version: "9.0.75",
        sha1: "d61056a234d5e4b272e09d59b0713f80d6c0b6af",
      },
      stability: "version-specific-undocumented",
    });
    expect(JSON.stringify(result)).not.toContain("filesystem");
  });
});

describe("downloadJavaPlayerTexture", () => {
  it("constructs the only allowed HTTPS request and downloads bounded content", async () => {
    const bytes = structuralPng();
    const fetchImpl = vi.fn<JavaPlayerTextureFetch>(async () => successResponse(bytes));

    const result = await downloadJavaPlayerTexture(referenceHash, "skin", fetchImpl);

    expect(result.status).toBe("downloaded");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://textures.minecraft.net/texture/${referenceHash}`,
      expect.objectContaining({
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "image/png",
          "Accept-Encoding": "identity",
          "User-Agent": "sya-ri/minecraft-skills/0.1.8 (github.com/sya-ri/minecraft-skills)",
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("does no network work for invalid caller input", async () => {
    const fetchImpl = vi.fn<JavaPlayerTextureFetch>();

    const result = await downloadJavaPlayerTexture(referenceHash.toUpperCase(), "skin", fetchImpl);

    expect(result).toMatchObject({ status: "invalid-input", code: "invalid-reference-hash" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects redirects and unexpected statuses without leaking response detail", async () => {
    const redirect = await downloadJavaPlayerTexture(
      referenceHash,
      "skin",
      async () =>
        new Response("PRIVATE_REDIRECT_BODY", {
          status: 302,
          statusText: "PRIVATE_STATUS",
          headers: { location: "https://private.example/PRIVATE_LOCATION" },
        }),
    );
    expect(redirect).toMatchObject({
      status: "invalid-response",
      code: "redirect-rejected",
      httpStatus: 302,
    });
    expect(JSON.stringify(redirect)).not.toMatch(/PRIVATE|private\.example/);

    const missing = await downloadJavaPlayerTexture(
      referenceHash,
      "skin",
      async () =>
        new Response("PRIVATE_NOT_FOUND", { status: 404, statusText: "PRIVATE_NOT_FOUND" }),
    );
    expect(missing).toMatchObject({
      status: "invalid-response",
      code: "unexpected-status",
      httpStatus: 404,
    });
    expect(JSON.stringify(missing)).not.toContain("PRIVATE_NOT_FOUND");
  });

  it.each([
    ["text/plain", null, "invalid-content-type"],
    ["image/png", "gzip", "unsupported-content-encoding"],
  ] as const)("rejects content type %s and encoding %s", async (contentType, contentEncoding, code) => {
    const headers: Record<string, string> = { "content-type": contentType };
    if (contentEncoding !== null) headers["content-encoding"] = contentEncoding;
    const result = await downloadJavaPlayerTexture(
      referenceHash,
      "cape",
      async () => new Response(structuralPng(), { status: 200, headers }),
    );
    expect(result).toMatchObject({ status: "invalid-response", code, httpStatus: 200 });
  });

  it("accepts an explicit identity content encoding", async () => {
    const result = await downloadJavaPlayerTexture(referenceHash, "cape", async () =>
      successResponse(structuralPng(), { "content-encoding": "identity" }),
    );
    expect(result.status).toBe("downloaded");
  });

  it.each([
    "-1",
    "+1",
    "1.0",
    "9999999999999999",
  ])("rejects invalid declared content length %s", async (length) => {
    const result = await downloadJavaPlayerTexture(referenceHash, "skin", async () =>
      streamedResponse(new ReadableStream({ start: (controller) => controller.close() }), {
        "content-length": length,
      }),
    );
    expect(result).toMatchObject({ status: "invalid-response", code: "invalid-content-length" });
  });

  it("rejects declared and streamed byte limits before retaining oversized chunks", async () => {
    const declared = await downloadJavaPlayerTexture(referenceHash, "skin", async () =>
      streamedResponse(new ReadableStream(), {
        "content-length": String(javaPlayerTextureDownloadLimits.maxResponseBytes + 1),
      }),
    );
    expect(declared).toMatchObject({
      status: "invalid-response",
      code: "response-byte-limit-exceeded",
    });

    let cancelled = false;
    const oversizedChunk = new Uint8Array(javaPlayerTextureDownloadLimits.maxResponseBytes + 1);
    const streamed = await downloadJavaPlayerTexture(referenceHash, "skin", async () =>
      streamedResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(oversizedChunk);
          },
          cancel() {
            cancelled = true;
          },
        }),
      ),
    );
    expect(streamed).toMatchObject({
      status: "invalid-response",
      code: "response-byte-limit-exceeded",
    });
    expect(cancelled).toBe(true);
  });

  it("bounds zero-length response chunks independently of total bytes", async () => {
    let pulls = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls += 1;
          controller.enqueue(new Uint8Array());
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );

    const result = await downloadJavaPlayerTexture(referenceHash, "skin", async () =>
      streamedResponse(stream),
    );

    expect(result).toMatchObject({
      status: "invalid-response",
      code: "response-chunk-limit-exceeded",
      httpStatus: 200,
      limits: { maxResponseChunks: 4_096 },
    });
    expect(pulls).toBe(javaPlayerTextureDownloadLimits.maxResponseChunks + 1);
    expect(cancelled).toBe(true);
  });

  it("rejects hostile body byte views without invoking metadata accessors", async () => {
    let getterCalls = 0;
    const hostile = new Uint8Array([1, 2, 3]);
    Object.defineProperty(hostile, "byteLength", {
      get: () => {
        getterCalls += 1;
        return 3;
      },
    });
    const result = await downloadJavaPlayerTexture(referenceHash, "skin", async () =>
      streamedResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(hostile);
            controller.close();
          },
        }),
      ),
    );

    expect(result).toMatchObject({ status: "invalid-response", code: "invalid-body-chunk" });
    expect(getterCalls).toBe(0);
  });

  it("reports content-length mismatch without exposing body bytes", async () => {
    const bytes = structuralPng();
    const result = await downloadJavaPlayerTexture(referenceHash, "skin", async () =>
      successResponse(bytes, { "content-length": String(bytes.byteLength + 1) }),
    );

    expect(result).toMatchObject({
      status: "invalid-response",
      code: "content-length-mismatch",
      httpStatus: 200,
    });
  });

  it("closes response-inspection and network exceptions without leaking details", async () => {
    const inspection = await downloadJavaPlayerTexture(
      referenceHash,
      "skin",
      async () =>
        ({
          get status() {
            throw new Error("PRIVATE_RESPONSE_DETAIL");
          },
        }) as unknown as Response,
    );
    expect(inspection).toMatchObject({
      status: "invalid-response",
      code: "response-inspection-failed",
      httpStatus: null,
    });
    expect(JSON.stringify(inspection)).not.toContain("PRIVATE_RESPONSE_DETAIL");

    const network = await downloadJavaPlayerTexture(referenceHash, "skin", async () => {
      throw new Error("PRIVATE_NETWORK_DETAIL");
    });
    expect(network).toMatchObject({ status: "request-failed", code: "network" });
    expect(JSON.stringify(network)).not.toContain("PRIVATE_NETWORK_DETAIL");
  });
});

describe("downloadJavaPlayerTexture timeout boundary", () => {
  it("returns after five seconds when fetch ignores AbortSignal forever", async () => {
    vi.useFakeTimers();
    try {
      const resultPromise = downloadJavaPlayerTexture(
        referenceHash,
        "skin",
        () => new Promise<Response>(() => undefined),
      );
      await vi.advanceTimersByTimeAsync(javaPlayerTextureDownloadLimits.requestTimeoutMs);

      await expect(resultPromise).resolves.toMatchObject({
        status: "request-failed",
        code: "timeout",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a response body when fetch resolves only after the timeout", async () => {
    vi.useFakeTimers();
    try {
      let resolveFetch!: (response: Response) => void;
      const delayedFetch = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
      const resultPromise = downloadJavaPlayerTexture(referenceHash, "skin", () => delayedFetch);
      await vi.advanceTimersByTimeAsync(javaPlayerTextureDownloadLimits.requestTimeoutMs);
      await expect(resultPromise).resolves.toMatchObject({
        status: "request-failed",
        code: "timeout",
      });

      let resolveCancelled!: () => void;
      const cancelled = new Promise<void>((resolve) => {
        resolveCancelled = resolve;
      });
      resolveFetch(
        streamedResponse(
          new ReadableStream({
            cancel() {
              resolveCancelled();
            },
          }),
        ),
      );
      await cancelled;
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns after five seconds when a response body read ignores AbortSignal forever", async () => {
    vi.useFakeTimers();
    try {
      let resolveCancelled!: () => void;
      const cancelled = new Promise<void>((resolve) => {
        resolveCancelled = resolve;
      });
      const neverReadingBody = new ReadableStream<Uint8Array>({
        pull: () => new Promise<void>(() => undefined),
        cancel() {
          resolveCancelled();
        },
      });
      const resultPromise = downloadJavaPlayerTexture(referenceHash, "skin", async () =>
        streamedResponse(neverReadingBody),
      );
      await vi.advanceTimersByTimeAsync(javaPlayerTextureDownloadLimits.requestTimeoutMs);

      await expect(resultPromise).resolves.toMatchObject({
        status: "request-failed",
        code: "timeout",
      });
      await cancelled;
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    "synchronous throw",
    "non-Promise return",
  ])("keeps timeout closed when a hostile reader cancel has a %s", async (behavior) => {
    vi.useFakeTimers();
    try {
      let cancelCalls = 0;
      const reader = {
        read: () => new Promise<never>(() => undefined),
        cancel: () => {
          cancelCalls += 1;
          if (behavior === "synchronous throw") throw new Error("PRIVATE_CANCEL_DETAIL");
          return undefined;
        },
      };
      const response = {
        status: 200,
        redirected: false,
        type: "default",
        headers: new Headers({ "content-type": "image/png" }),
        body: { getReader: () => reader },
      } as unknown as Response;
      const resultPromise = downloadJavaPlayerTexture(referenceHash, "skin", async () => response);
      await vi.advanceTimersByTimeAsync(javaPlayerTextureDownloadLimits.requestTimeoutMs);

      const result = await resultPromise;
      expect(result).toMatchObject({ status: "request-failed", code: "timeout" });
      expect(JSON.stringify(result)).not.toContain("PRIVATE_CANCEL_DETAIL");
      expect(cancelCalls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
