import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import {
  type PlayerSkinLayoutValidationResult,
  validatePlayerSkinLayout,
} from "./playerSkinLayout.js";
import {
  type ResourcepackPngValidationResult,
  validateResourcepackPng,
} from "./resourcepackPng.js";

const textureHost = "textures.minecraft.net";
const textureHashPattern = /^[0-9a-f]{64}$/;
const textureKinds = new Set<JavaPlayerTextureKind>(["skin", "cape", "elytra"]);
const userAgent = "sya-ri/minecraft-skills/0.1.7 (github.com/sya-ri/minecraft-skills)";

/** Fixed network and inspection limits for Java player texture downloads. */
export const javaPlayerTextureDownloadLimits = Object.freeze({
  requestTimeoutMs: 5_000,
  maxResponseBytes: 1_048_576,
  maxResponseChunks: 4_096,
  maxPngChunks: 4_096,
  maxPngDiagnostics: 32,
} as const);

const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
)?.get;
const typedArrayByteOffset = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset",
)?.get;
const typedArrayBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer")?.get;

const clientClasses = Object.freeze([
  "net.minecraft.client.renderer.texture.SkinTextureDownloader",
  "net.minecraft.client.gui.components.PlayerFaceExtractor",
] as const);

const authlibClasses = Object.freeze([
  "com.mojang.authlib.yggdrasil.TextureUrlChecker",
  "com.mojang.authlib.yggdrasil.response.MinecraftTexturesPayload",
] as const);

/** Version-pinned official artifacts used to bound this narrow download surface. */
export const javaPlayerTextureSourceEvidence = Object.freeze({
  minecraftVersion: "26.2",
  versionMetadataUrl:
    "https://piston-meta.mojang.com/v1/packages/c75d82e7fa6eca5a043dab0c6cf77cb8317644f4/26.2.json",
  clientArtifactUrl:
    "https://piston-data.mojang.com/v1/objects/2dc72797acbc1b63fc16a11c4ac393605f453754/client.jar",
  clientSha1: "2dc72797acbc1b63fc16a11c4ac393605f453754",
  clientClasses,
  authlib: Object.freeze({
    version: "9.0.75",
    artifactUrl: "https://libraries.minecraft.net/com/mojang/authlib/9.0.75/authlib-9.0.75.jar",
    sha1: "d61056a234d5e4b272e09d59b0713f80d6c0b6af",
    classes: authlibClasses,
  }),
  stability: "version-specific-undocumented" as const,
  notes: Object.freeze([
    "The audited Authlib TextureUrlChecker recognizes the textures.minecraft.net host; this downloader deliberately narrows that behavior to one internally constructed HTTPS path.",
    "The audited client SkinTextureDownloader accepts current 64x64 and legacy 64x32 skin dimensions; the existing player-skin layout validator records that evidence.",
    "Timeouts, redirect rejection, response limits, and content checks are this tool's security boundary, not claims that the audited client applies the same limits.",
    "The audited artifacts do not establish a stable contract that a texture path hash equals the SHA-256 digest of downloaded PNG bytes.",
  ]),
});

const nonGuarantees = Object.freeze([
  "The requested reference hash and downloaded SHA-256 digest are separate observations; equality is not required and does not prove authenticity.",
  "Profile-property signatures, texture provenance, account ownership, player identity, profile freshness, and current skin selection are not checked.",
  "Texture ownership, licensing, and permission to redistribute downloaded bytes are not checked.",
  "PNG IDAT pixels are not decoded, so pixel alpha, rendered appearance, and decoder compatibility are not proved.",
  "Cape and elytra dimensions, UV layout, animation, and rendering behavior are not validated.",
  "Legacy skin pixel conversion, face cropping, image editing, cache integration, and runtime texture registration are not performed.",
]);

export type JavaPlayerTextureKind = "skin" | "cape" | "elytra";

export type JavaPlayerTextureFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type JavaPlayerTextureEvidence = {
  requestedReferenceHash: string;
  downloadedContentSha256: string;
};

export type JavaPlayerTextureContent = {
  kind: JavaPlayerTextureKind;
  bytes: Uint8Array;
  byteLength: number;
  evidence: JavaPlayerTextureEvidence;
  png: ResourcepackPngValidationResult;
  skinLayout: PlayerSkinLayoutValidationResult | null;
};

export type JavaPlayerTextureResultContext = {
  schemaVersion: 1;
  scope: "java-player-texture-download";
  limits: {
    requestTimeoutMs: 5_000;
    maxResponseBytes: 1_048_576;
    maxResponseChunks: 4_096;
    maxPngChunks: 4_096;
    maxPngDiagnostics: 32;
  };
  networkPolicy: {
    scheme: "https";
    host: "textures.minecraft.net";
    path: "/texture/<64-lowercase-hex>";
    redirect: "reject";
    responseStatus: 200;
    contentType: "image/png";
    contentEncoding: "identity";
  };
  sourceEvidence: {
    minecraftVersion: "26.2";
    versionMetadataUrl: string;
    clientArtifactUrl: string;
    clientSha1: "2dc72797acbc1b63fc16a11c4ac393605f453754";
    clientClasses: Array<(typeof clientClasses)[number]>;
    authlib: {
      version: "9.0.75";
      artifactUrl: string;
      sha1: "d61056a234d5e4b272e09d59b0713f80d6c0b6af";
      classes: Array<(typeof authlibClasses)[number]>;
    };
    stability: "version-specific-undocumented";
    notes: string[];
  };
  nonGuarantees: string[];
  privacy: {
    acceptsPlayerIdentity: false;
    acceptsCallerUrl: false;
    acceptsCallerHeaders: false;
    returnsFilesystemPaths: false;
  };
};

export type JavaPlayerTextureInvalidInputResult = JavaPlayerTextureResultContext & {
  status: "invalid-input";
  kind: JavaPlayerTextureKind | null;
  code: "invalid-reference-hash" | "invalid-kind" | "invalid-bytes";
};

export type JavaPlayerTextureInvalidContentResult = JavaPlayerTextureResultContext & {
  status: "invalid-content";
  kind: JavaPlayerTextureKind;
  code: "response-byte-limit-exceeded" | "invalid-png" | "invalid-skin-layout";
  byteLength: number;
  evidence: JavaPlayerTextureEvidence | null;
  png: ResourcepackPngValidationResult | null;
  skinLayout: PlayerSkinLayoutValidationResult | null;
};

export type JavaPlayerTextureContentInspectionResult =
  | (JavaPlayerTextureResultContext & {
      status: "accepted";
      content: JavaPlayerTextureContent;
    })
  | JavaPlayerTextureInvalidInputResult
  | JavaPlayerTextureInvalidContentResult;

export type JavaPlayerTextureRequestFailureResult = JavaPlayerTextureResultContext & {
  status: "request-failed";
  kind: JavaPlayerTextureKind;
  code: "timeout" | "network";
};

export type JavaPlayerTextureInvalidResponseResult = JavaPlayerTextureResultContext & {
  status: "invalid-response";
  kind: JavaPlayerTextureKind;
  code:
    | "response-inspection-failed"
    | "redirect-rejected"
    | "unexpected-status"
    | "invalid-content-type"
    | "unsupported-content-encoding"
    | "invalid-content-length"
    | "response-byte-limit-exceeded"
    | "missing-body"
    | "body-read-failed"
    | "content-length-mismatch"
    | "invalid-body-chunk"
    | "response-chunk-limit-exceeded";
  httpStatus: number | null;
};

export type JavaPlayerTextureDownloadResult =
  | (JavaPlayerTextureResultContext & {
      status: "downloaded";
      content: JavaPlayerTextureContent;
    })
  | JavaPlayerTextureInvalidInputResult
  | JavaPlayerTextureInvalidContentResult
  | JavaPlayerTextureRequestFailureResult
  | JavaPlayerTextureInvalidResponseResult;

type ValidatedInput = {
  hash: string;
  kind: JavaPlayerTextureKind;
};

type BoundedResponseBytes =
  | { status: "read"; bytes: Uint8Array }
  | {
      status: "invalid-response";
      code: JavaPlayerTextureInvalidResponseResult["code"];
      httpStatus: number | null;
    };

type DirectByteView =
  | {
      status: "ready";
      byteLength: number;
      byteOffset: number;
      buffer: ArrayBuffer | SharedArrayBuffer;
    }
  | { status: "invalid" };

type ByteSnapshot =
  | { status: "ready"; bytes: Uint8Array; byteLength: number }
  | { status: "invalid" }
  | { status: "limit-exceeded"; byteLength: number };

type NetworkReadResult = BoundedResponseBytes | { status: "request-failed"; code: "network" };

type TimeoutResult = { status: "timeout" };

function resultContext(): JavaPlayerTextureResultContext {
  return {
    schemaVersion: 1,
    scope: "java-player-texture-download",
    limits: { ...javaPlayerTextureDownloadLimits },
    networkPolicy: {
      scheme: "https",
      host: textureHost,
      path: "/texture/<64-lowercase-hex>",
      redirect: "reject",
      responseStatus: 200,
      contentType: "image/png",
      contentEncoding: "identity",
    },
    sourceEvidence: {
      minecraftVersion: javaPlayerTextureSourceEvidence.minecraftVersion,
      versionMetadataUrl: javaPlayerTextureSourceEvidence.versionMetadataUrl,
      clientArtifactUrl: javaPlayerTextureSourceEvidence.clientArtifactUrl,
      clientSha1: javaPlayerTextureSourceEvidence.clientSha1,
      clientClasses: [...javaPlayerTextureSourceEvidence.clientClasses],
      authlib: {
        version: javaPlayerTextureSourceEvidence.authlib.version,
        artifactUrl: javaPlayerTextureSourceEvidence.authlib.artifactUrl,
        sha1: javaPlayerTextureSourceEvidence.authlib.sha1,
        classes: [...javaPlayerTextureSourceEvidence.authlib.classes],
      },
      stability: javaPlayerTextureSourceEvidence.stability,
      notes: [...javaPlayerTextureSourceEvidence.notes],
    },
    nonGuarantees: [...nonGuarantees],
    privacy: {
      acceptsPlayerIdentity: false,
      acceptsCallerUrl: false,
      acceptsCallerHeaders: false,
      returnsFilesystemPaths: false,
    },
  };
}

function validateInput(
  hash: unknown,
  kind: unknown,
): ValidatedInput | JavaPlayerTextureInvalidInputResult {
  const normalizedKind =
    typeof kind === "string" && textureKinds.has(kind as JavaPlayerTextureKind)
      ? (kind as JavaPlayerTextureKind)
      : null;
  if (typeof hash !== "string" || !textureHashPattern.test(hash)) {
    return {
      ...resultContext(),
      status: "invalid-input",
      kind: normalizedKind,
      code: "invalid-reference-hash",
    };
  }
  if (normalizedKind === null) {
    return {
      ...resultContext(),
      status: "invalid-input",
      kind: null,
      code: "invalid-kind",
    };
  }
  return { hash, kind: normalizedKind };
}

function preflightDirectByteView(value: unknown): DirectByteView {
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    !ArrayBuffer.isView(value)
  ) {
    return { status: "invalid" };
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
      return { status: "invalid" };
    }
    if (
      Object.getOwnPropertyDescriptor(value, "byteLength") !== undefined ||
      Object.getOwnPropertyDescriptor(value, "byteOffset") !== undefined ||
      Object.getOwnPropertyDescriptor(value, "buffer") !== undefined ||
      !typedArrayByteLength ||
      !typedArrayByteOffset ||
      !typedArrayBuffer
    ) {
      return { status: "invalid" };
    }
    const byteLength = typedArrayByteLength.call(value) as unknown;
    const byteOffset = typedArrayByteOffset.call(value) as unknown;
    const buffer = typedArrayBuffer.call(value) as unknown;
    if (
      typeof byteLength !== "number" ||
      !Number.isSafeInteger(byteLength) ||
      byteLength < 0 ||
      typeof byteOffset !== "number" ||
      !Number.isSafeInteger(byteOffset) ||
      byteOffset < 0 ||
      (!(buffer instanceof ArrayBuffer) && !(buffer instanceof SharedArrayBuffer))
    ) {
      return { status: "invalid" };
    }
    return { status: "ready", byteLength, byteOffset, buffer };
  } catch {
    return { status: "invalid" };
  }
}

function copyDirectByteView(view: Extract<DirectByteView, { status: "ready" }>): Uint8Array | null {
  try {
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    return Uint8Array.prototype.slice.call(bytes) as Uint8Array;
  } catch {
    return null;
  }
}

function snapshotBytes(value: unknown): ByteSnapshot {
  const view = preflightDirectByteView(value);
  if (view.status === "invalid") return view;
  if (javaPlayerTextureDownloadLimits.maxResponseBytes < view.byteLength) {
    return { status: "limit-exceeded", byteLength: view.byteLength };
  }
  const bytes = copyDirectByteView(view);
  return bytes === null
    ? { status: "invalid" }
    : { status: "ready", bytes, byteLength: view.byteLength };
}

function inspectValidatedBytes(
  input: ValidatedInput,
  bytes: Uint8Array,
): JavaPlayerTextureContentInspectionResult {
  if (javaPlayerTextureDownloadLimits.maxResponseBytes < bytes.byteLength) {
    return {
      ...resultContext(),
      status: "invalid-content",
      kind: input.kind,
      code: "response-byte-limit-exceeded",
      byteLength: bytes.byteLength,
      evidence: null,
      png: null,
      skinLayout: null,
    };
  }

  const downloadedContentSha256 = createHash("sha256").update(bytes).digest("hex");
  const evidence = {
    requestedReferenceHash: input.hash,
    downloadedContentSha256,
  } satisfies JavaPlayerTextureEvidence;
  const png = validateResourcepackPng(bytes, {
    limits: {
      maxInputBytes: javaPlayerTextureDownloadLimits.maxResponseBytes,
      maxChunks: javaPlayerTextureDownloadLimits.maxPngChunks,
      maxDiagnostics: javaPlayerTextureDownloadLimits.maxPngDiagnostics,
    },
  });
  if (!png.valid || !png.validationComplete) {
    return {
      ...resultContext(),
      status: "invalid-content",
      kind: input.kind,
      code: "invalid-png",
      byteLength: bytes.byteLength,
      evidence,
      png,
      skinLayout: null,
    };
  }

  let skinLayout: PlayerSkinLayoutValidationResult | null = null;
  if (input.kind === "skin") {
    if (png.width === null || png.height === null) {
      return {
        ...resultContext(),
        status: "invalid-content",
        kind: input.kind,
        code: "invalid-png",
        byteLength: bytes.byteLength,
        evidence,
        png,
        skinLayout: null,
      };
    }
    skinLayout = validatePlayerSkinLayout({ width: png.width, height: png.height });
    if (!skinLayout.valid) {
      return {
        ...resultContext(),
        status: "invalid-content",
        kind: input.kind,
        code: "invalid-skin-layout",
        byteLength: bytes.byteLength,
        evidence,
        png,
        skinLayout,
      };
    }
  }

  return {
    ...resultContext(),
    status: "accepted",
    content: {
      kind: input.kind,
      bytes,
      byteLength: bytes.byteLength,
      evidence,
      png,
      skinLayout,
    },
  };
}

/**
 * Inspects already downloaded bytes using the same bounded content checks as the network API.
 *
 * The input is snapshotted before hashing and validation. No URL or player identity is accepted.
 */
export function inspectJavaPlayerTextureBytes(
  hash: unknown,
  kind: unknown,
  bytes: unknown,
): JavaPlayerTextureContentInspectionResult {
  const input = validateInput(hash, kind);
  if (!("hash" in input)) return input;
  const snapshot = snapshotBytes(bytes);
  if (snapshot.status === "invalid") {
    return {
      ...resultContext(),
      status: "invalid-input",
      kind: input.kind,
      code: "invalid-bytes",
    };
  }
  if (snapshot.status === "limit-exceeded") {
    return {
      ...resultContext(),
      status: "invalid-content",
      kind: input.kind,
      code: "response-byte-limit-exceeded",
      byteLength: snapshot.byteLength,
      evidence: null,
      png: null,
      skinLayout: null,
    };
  }
  return inspectValidatedBytes(input, snapshot.bytes);
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The already selected bounded outcome remains authoritative if cleanup fails.
  }
}

function invalidResponse(
  kind: JavaPlayerTextureKind,
  code: JavaPlayerTextureInvalidResponseResult["code"],
  httpStatus: number | null,
): JavaPlayerTextureInvalidResponseResult {
  return {
    ...resultContext(),
    status: "invalid-response",
    kind,
    code,
    httpStatus,
  };
}

async function readBoundedResponse(
  response: Response,
  signal: AbortSignal,
): Promise<BoundedResponseBytes> {
  let status: number;
  let redirected: boolean;
  let type: string;
  try {
    status = response.status;
    redirected = response.redirected;
    type = response.type;
  } catch {
    return { status: "invalid-response", code: "response-inspection-failed", httpStatus: null };
  }
  if (!Number.isSafeInteger(status) || status < 0 || 999 < status) {
    return { status: "invalid-response", code: "response-inspection-failed", httpStatus: null };
  }
  if (redirected || type === "opaqueredirect" || (300 <= status && status <= 399)) {
    await cancelBody(response);
    return { status: "invalid-response", code: "redirect-rejected", httpStatus: status };
  }
  if (status !== 200) {
    await cancelBody(response);
    return { status: "invalid-response", code: "unexpected-status", httpStatus: status };
  }

  let contentTypeHeader: string | null;
  let contentEncodingHeader: string | null;
  let contentLengthHeader: string | null;
  try {
    contentTypeHeader = response.headers.get("content-type");
    contentEncodingHeader = response.headers.get("content-encoding");
    contentLengthHeader = response.headers.get("content-length");
  } catch {
    await cancelBody(response);
    return { status: "invalid-response", code: "response-inspection-failed", httpStatus: status };
  }
  if (
    contentTypeHeader === null ||
    typeof contentTypeHeader !== "string" ||
    contentTypeHeader.split(";", 1)[0]?.trim().toLowerCase() !== "image/png"
  ) {
    await cancelBody(response);
    return { status: "invalid-response", code: "invalid-content-type", httpStatus: status };
  }
  if (contentEncodingHeader !== null && typeof contentEncodingHeader !== "string") {
    await cancelBody(response);
    return {
      status: "invalid-response",
      code: "unsupported-content-encoding",
      httpStatus: status,
    };
  }
  const contentEncoding = contentEncodingHeader?.trim().toLowerCase() ?? "";
  if (contentEncoding !== "" && contentEncoding !== "identity") {
    await cancelBody(response);
    return {
      status: "invalid-response",
      code: "unsupported-content-encoding",
      httpStatus: status,
    };
  }

  let declaredLength: number | null = null;
  if (contentLengthHeader !== null) {
    if (typeof contentLengthHeader !== "string" || !/^\d{1,16}$/.test(contentLengthHeader)) {
      await cancelBody(response);
      return {
        status: "invalid-response",
        code: "invalid-content-length",
        httpStatus: status,
      };
    }
    declaredLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(declaredLength)) {
      await cancelBody(response);
      return {
        status: "invalid-response",
        code: "invalid-content-length",
        httpStatus: status,
      };
    }
    if (javaPlayerTextureDownloadLimits.maxResponseBytes < declaredLength) {
      await cancelBody(response);
      return {
        status: "invalid-response",
        code: "response-byte-limit-exceeded",
        httpStatus: status,
      };
    }
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    if (response.body === null) {
      return { status: "invalid-response", code: "missing-body", httpStatus: status };
    }
    reader = response.body.getReader();
  } catch {
    return { status: "invalid-response", code: "response-inspection-failed", httpStatus: status };
  }

  const cancelReaderOnAbort = () => {
    try {
      void Promise.resolve(reader.cancel()).catch(() => undefined);
    } catch {
      // Abort cleanup is best-effort and never changes the already bounded timeout outcome.
    }
  };
  signal.addEventListener("abort", cancelReaderOnAbort, { once: true });
  if (signal.aborted) cancelReaderOnAbort();
  try {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    let responseChunks = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        responseChunks += 1;
        if (javaPlayerTextureDownloadLimits.maxResponseChunks < responseChunks) {
          try {
            await reader.cancel();
          } catch {
            // Cleanup cannot override the chunk-count limit outcome.
          }
          return {
            status: "invalid-response",
            code: "response-chunk-limit-exceeded",
            httpStatus: status,
          };
        }

        const view = preflightDirectByteView(item.value);
        if (view.status === "invalid") {
          try {
            await reader.cancel();
          } catch {
            // Cleanup cannot override the invalid-chunk outcome.
          }
          return { status: "invalid-response", code: "invalid-body-chunk", httpStatus: status };
        }
        if (
          !Number.isSafeInteger(totalBytes) ||
          javaPlayerTextureDownloadLimits.maxResponseBytes - totalBytes < view.byteLength
        ) {
          try {
            await reader.cancel();
          } catch {
            // Cleanup cannot override the decoded-size limit outcome.
          }
          return {
            status: "invalid-response",
            code: "response-byte-limit-exceeded",
            httpStatus: status,
          };
        }
        const chunk = copyDirectByteView(view);
        if (chunk === null) {
          try {
            await reader.cancel();
          } catch {
            // Cleanup cannot override the invalid-chunk outcome.
          }
          return { status: "invalid-response", code: "invalid-body-chunk", httpStatus: status };
        }
        totalBytes += view.byteLength;
        chunks.push(chunk);
      }
    } catch {
      return {
        status: "invalid-response",
        code: "body-read-failed",
        httpStatus: status,
      };
    }

    if (declaredLength !== null && declaredLength !== totalBytes) {
      return {
        status: "invalid-response",
        code: "content-length-mismatch",
        httpStatus: status,
      };
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { status: "read", bytes };
  } finally {
    signal.removeEventListener("abort", cancelReaderOnAbort);
  }
}

async function fetchAndReadBounded(
  input: ValidatedInput,
  fetchImpl: JavaPlayerTextureFetch,
  signal: AbortSignal,
): Promise<NetworkReadResult> {
  let response: Response;
  try {
    response = await fetchImpl(`https://${textureHost}/texture/${input.hash}`, {
      method: "GET",
      headers: {
        Accept: "image/png",
        "Accept-Encoding": "identity",
        "User-Agent": userAgent,
      },
      redirect: "manual",
      signal,
    });
  } catch {
    return { status: "request-failed", code: "network" };
  }
  if (signal.aborted) {
    void cancelBody(response);
    return { status: "request-failed", code: "network" };
  }
  return readBoundedResponse(response, signal);
}

/**
 * Downloads one texture from the fixed canonical Minecraft texture host and validates its bytes.
 *
 * Callers supply only a strict lowercase reference hash and texture kind. They cannot influence the
 * request URL, headers, body, redirect behavior, timeout, or response limits.
 */
export async function downloadJavaPlayerTexture(
  hash: unknown,
  kind: unknown,
  fetchImpl: JavaPlayerTextureFetch = fetch,
): Promise<JavaPlayerTextureDownloadResult> {
  const input = validateInput(hash, kind);
  if (!("hash" in input)) return input;

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<TimeoutResult>((resolve) => {
    timeout = setTimeout(() => {
      resolve({ status: "timeout" });
      controller.abort();
    }, javaPlayerTextureDownloadLimits.requestTimeoutMs);
  });
  const operationPromise: Promise<NetworkReadResult> = fetchAndReadBounded(
    input,
    fetchImpl,
    controller.signal,
  ).catch(() => ({ status: "request-failed", code: "network" }));
  try {
    const bounded = await Promise.race([operationPromise, timeoutPromise]);
    if (bounded.status === "timeout") {
      return {
        ...resultContext(),
        status: "request-failed",
        kind: input.kind,
        code: "timeout",
      };
    }
    if (bounded.status === "request-failed") {
      return {
        ...resultContext(),
        status: "request-failed",
        kind: input.kind,
        code: bounded.code,
      };
    }
    if (bounded.status === "invalid-response") {
      return invalidResponse(input.kind, bounded.code, bounded.httpStatus);
    }
    const inspected = inspectValidatedBytes(input, bounded.bytes);
    if (inspected.status !== "accepted") return inspected;
    return {
      ...inspected,
      status: "downloaded",
    };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
