import {
  inspectJavaPlayerSessionResponse,
  type JavaPlayerForbiddenOutcome,
  type JavaPlayerIdentityMismatchOutcome,
  type JavaPlayerInvalidInputOutcome,
  type JavaPlayerInvalidResponseOutcome,
  type JavaPlayerInvalidSignatureOutcome,
  type JavaPlayerKeyUnavailableOutcome,
  type JavaPlayerNotFoundOutcome,
  type JavaPlayerRateLimitedOutcome,
  type JavaPlayerSignatureMissingOutcome,
  type JavaPlayerTexturesPropertyMissingOutcome,
  type JavaPlayerUpstreamErrorOutcome,
  javaPlayerProfileSourceEvidence,
  normalizeJavaPlayerName,
  normalizeJavaPlayerUuid,
  parseJavaPlayerProfileLookupResponse,
  type VerifiedJavaPlayerTextures,
  verifyJavaPlayerTextureMetadata,
} from "./javaPlayerProfile.js";

const profileLookupBaseUrl = "https://api.mojang.com/minecraft/profile/lookup/name";
const sessionProfileBaseUrl = "https://sessionserver.mojang.com/session/minecraft/profile";
const publicKeysUrl = "https://api.minecraftservices.com/publickeys";
const userAgent = "sya-ri/minecraft-skills/0.1.6 (github.com/sya-ri/minecraft-skills)";
const requestTimeoutMs = 5_000;
const maxProfileLookupResponseBytes = 8 * 1_024;
const maxSessionProfileResponseBytes = 64 * 1_024;
const maxPublicKeysResponseBytes = 64 * 1_024;
const maxResponseChunks = 4_096;
const maxRetryAfterSeconds = 3_600;

export type JavaPlayerProfileFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type JavaPlayerProfileLookupOutcome =
  | {
      status: "found";
      profile: {
        uuid: string;
        name: string;
      };
      source: typeof javaPlayerProfileSourceEvidence;
    }
  | JavaPlayerInvalidInputOutcome
  | JavaPlayerNotFoundOutcome
  | JavaPlayerForbiddenOutcome
  | JavaPlayerRateLimitedOutcome
  | JavaPlayerUpstreamErrorOutcome
  | JavaPlayerInvalidResponseOutcome
  | JavaPlayerIdentityMismatchOutcome;

export type VerifiedJavaPlayerTexturesOutcome =
  | {
      status: "verified";
      data: VerifiedJavaPlayerTextures;
      source: typeof javaPlayerProfileSourceEvidence;
    }
  | JavaPlayerInvalidInputOutcome
  | JavaPlayerNotFoundOutcome
  | JavaPlayerForbiddenOutcome
  | JavaPlayerRateLimitedOutcome
  | JavaPlayerUpstreamErrorOutcome
  | JavaPlayerInvalidResponseOutcome
  | JavaPlayerIdentityMismatchOutcome
  | JavaPlayerTexturesPropertyMissingOutcome
  | JavaPlayerSignatureMissingOutcome
  | JavaPlayerInvalidSignatureOutcome
  | JavaPlayerKeyUnavailableOutcome;

type JsonReadFailureCode =
  | "invalid-status"
  | "invalid-content-type"
  | "unsupported-content-encoding"
  | "invalid-content-length"
  | "oversized-response"
  | "response-chunk-limit-exceeded"
  | "truncated-response"
  | "missing-body"
  | "body-read-failed"
  | "invalid-utf8"
  | "invalid-json";

type JsonRequestResult =
  | { kind: "ok"; value: unknown }
  | { kind: "network" }
  | { kind: "timeout" }
  | { kind: "http"; status: number; retryAfterSeconds: number | null }
  | { kind: "invalid-response"; code: JsonReadFailureCode };

function runBestEffortCleanup(cleanup: () => PromiseLike<unknown> | unknown): void {
  try {
    void Promise.resolve(cleanup()).catch(() => undefined);
  } catch {
    // Cleanup is best-effort and never replaces the bounded structured outcome.
  }
}

type ResponseCleanup = {
  cancel: () => void;
  complete: () => void;
  useReader: (reader: ReadableStreamDefaultReader<Uint8Array>) => boolean;
};

function createResponseCleanup(response: Response, signal: AbortSignal): ResponseCleanup {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let settled = false;

  const removeAbortListener = (): void => {
    signal.removeEventListener("abort", cancel);
  };
  const cancel = (): void => {
    if (settled) {
      return;
    }
    settled = true;
    removeAbortListener();
    if (reader === undefined) {
      runBestEffortCleanup(() => response.body?.cancel());
    } else {
      const activeReader = reader;
      runBestEffortCleanup(() => activeReader.cancel());
    }
  };
  const complete = (): void => {
    if (settled) {
      return;
    }
    settled = true;
    removeAbortListener();
    if (reader !== undefined) {
      const activeReader = reader;
      runBestEffortCleanup(() => activeReader.releaseLock());
    }
  };
  const useReader = (nextReader: ReadableStreamDefaultReader<Uint8Array>): boolean => {
    if (settled) {
      runBestEffortCleanup(() => nextReader.cancel());
      return false;
    }
    reader = nextReader;
    return true;
  };

  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) {
    cancel();
  }
  return { cancel, complete, useReader };
}

function parseRetryAfter(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d{1,64}$/.test(trimmed)) {
    return null;
  }
  try {
    const seconds = BigInt(trimmed);
    if (seconds <= 0n) {
      return null;
    }
    return Number(seconds > BigInt(maxRetryAfterSeconds) ? maxRetryAfterSeconds : seconds);
  } catch {
    return null;
  }
}

async function readBoundedJson(
  response: Response,
  maxBytes: number,
  cleanup: ResponseCleanup,
): Promise<
  { kind: "ok"; value: unknown } | { kind: "invalid-response"; code: JsonReadFailureCode }
> {
  try {
    const contentTypeHeader = response.headers.get("content-type");
    if (contentTypeHeader !== null && typeof contentTypeHeader !== "string") {
      return { kind: "invalid-response", code: "invalid-content-type" };
    }
    const contentType = contentTypeHeader?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/json") {
      return { kind: "invalid-response", code: "invalid-content-type" };
    }
    const contentEncodingHeader = response.headers.get("content-encoding");
    if (contentEncodingHeader !== null && typeof contentEncodingHeader !== "string") {
      return { kind: "invalid-response", code: "unsupported-content-encoding" };
    }
    const contentEncoding = contentEncodingHeader?.trim().toLowerCase();
    const normalizedContentEncoding =
      contentEncoding === undefined || contentEncoding === "" ? "identity" : contentEncoding;
    if (!["identity", "gzip", "deflate", "br"].includes(normalizedContentEncoding)) {
      return { kind: "invalid-response", code: "unsupported-content-encoding" };
    }

    let declaredLength: number | null = null;
    const contentLength = response.headers.get("content-length");
    if (contentLength !== null) {
      if (typeof contentLength !== "string" || !/^\d+$/.test(contentLength)) {
        return { kind: "invalid-response", code: "invalid-content-length" };
      }
      declaredLength = Number(contentLength);
      if (!Number.isSafeInteger(declaredLength)) {
        return { kind: "invalid-response", code: "invalid-content-length" };
      }
      if (declaredLength > maxBytes) {
        return { kind: "invalid-response", code: "oversized-response" };
      }
    }
    if (response.body === null) {
      return { kind: "invalid-response", code: "missing-body" };
    }

    const reader = response.body.getReader();
    if (!cleanup.useReader(reader)) {
      return { kind: "invalid-response", code: "body-read-failed" };
    }
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    let responseChunks = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      responseChunks += 1;
      if (responseChunks > maxResponseChunks) {
        return { kind: "invalid-response", code: "response-chunk-limit-exceeded" };
      }
      if (
        !Number.isSafeInteger(value.byteLength) ||
        value.byteLength < 0 ||
        maxBytes - totalBytes < value.byteLength
      ) {
        return { kind: "invalid-response", code: "oversized-response" };
      }
      totalBytes += value.byteLength;
      if (value.byteLength === 0) {
        continue;
      }
      chunks.push(value);
    }
    if (
      normalizedContentEncoding === "identity" &&
      declaredLength !== null &&
      totalBytes !== declaredLength
    ) {
      return { kind: "invalid-response", code: "truncated-response" };
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    } catch {
      return { kind: "invalid-response", code: "invalid-utf8" };
    }
    try {
      return { kind: "ok", value: JSON.parse(text) as unknown };
    } catch {
      return { kind: "invalid-response", code: "invalid-json" };
    }
  } catch {
    return { kind: "invalid-response", code: "body-read-failed" };
  }
}

async function requestJson(
  url: string,
  maxBytes: number,
  fetchImpl: JavaPlayerProfileFetch,
): Promise<JsonRequestResult> {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<JsonRequestResult>((resolve) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolve({ kind: "timeout" });
    }, requestTimeoutMs);
  });

  const request = (async (): Promise<JsonRequestResult> => {
    let cleanup: ResponseCleanup | undefined;
    let completed = false;
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": userAgent,
        },
        redirect: "manual",
        signal: controller.signal,
      });
      cleanup = createResponseCleanup(response, controller.signal);
      if (controller.signal.aborted) {
        return { kind: "timeout" };
      }
      const status = response.status;
      if (typeof status !== "number" || !Number.isInteger(status) || status < 100 || status > 599) {
        return { kind: "invalid-response", code: "invalid-status" };
      }
      if (status !== 200) {
        return {
          kind: "http",
          status,
          retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
        };
      }
      const result = await readBoundedJson(response, maxBytes, cleanup);
      completed = result.kind === "ok";
      return result;
    } catch {
      return timedOut ? { kind: "timeout" } : { kind: "network" };
    } finally {
      if (completed) {
        cleanup?.complete();
      } else {
        cleanup?.cancel();
      }
    }
  })();

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

function mapProfileRequestFailure(
  endpoint: "name-lookup" | "session-profile",
  result: Exclude<JsonRequestResult, { kind: "ok" }>,
):
  | JavaPlayerNotFoundOutcome
  | JavaPlayerForbiddenOutcome
  | JavaPlayerRateLimitedOutcome
  | JavaPlayerUpstreamErrorOutcome
  | JavaPlayerInvalidResponseOutcome {
  if (result.kind === "network" || result.kind === "timeout") {
    return {
      status: "upstream-error",
      endpoint,
      code: result.kind,
    };
  }
  if (result.kind === "invalid-response") {
    return {
      status: "invalid-response",
      endpoint,
      code: result.code,
    };
  }
  if (result.status === 204 || result.status === 404) {
    return { status: "not-found", endpoint };
  }
  if (result.status === 403) {
    return { status: "forbidden", endpoint, httpStatus: 403 };
  }
  if (result.status === 429) {
    return {
      status: "rate-limited",
      endpoint,
      httpStatus: 429,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  }
  if (result.status >= 300 && result.status < 400) {
    return {
      status: "upstream-error",
      endpoint,
      code: "redirect-rejected",
      httpStatus: result.status,
    };
  }
  if (result.status >= 500 && result.status < 600) {
    return {
      status: "upstream-error",
      endpoint,
      code: "service-unavailable",
      httpStatus: result.status,
    };
  }
  return {
    status: "upstream-error",
    endpoint,
    code: "unexpected-status",
    httpStatus: result.status,
  };
}

function mapPublicKeysRequestFailure(
  result: Exclude<JsonRequestResult, { kind: "ok" }>,
): JavaPlayerRateLimitedOutcome | JavaPlayerKeyUnavailableOutcome {
  if (result.kind === "network" || result.kind === "timeout") {
    return {
      status: "key-unavailable",
      endpoint: "public-keys",
      code: result.kind,
    };
  }
  if (result.kind === "invalid-response") {
    return {
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "invalid-response",
    };
  }
  if (result.status === 429) {
    return {
      status: "rate-limited",
      endpoint: "public-keys",
      httpStatus: 429,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  }
  if (result.status === 403) {
    return {
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "forbidden",
      httpStatus: 403,
    };
  }
  if (result.status === 204 || result.status === 404) {
    return {
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "not-found",
      httpStatus: result.status,
    };
  }
  if (result.status >= 300 && result.status < 400) {
    return {
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "redirect-rejected",
      httpStatus: result.status,
    };
  }
  if (result.status >= 500 && result.status < 600) {
    return {
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "service-unavailable",
      httpStatus: result.status,
    };
  }
  return {
    status: "key-unavailable",
    endpoint: "public-keys",
    code: "unexpected-status",
    httpStatus: result.status,
  };
}

export async function lookupJavaPlayerProfileByName(
  name: unknown,
  fetchImpl: JavaPlayerProfileFetch = fetch,
): Promise<JavaPlayerProfileLookupOutcome> {
  const normalized = normalizeJavaPlayerName(name);
  if (normalized.status !== "normalized") {
    return normalized;
  }
  const response = await requestJson(
    `${profileLookupBaseUrl}/${normalized.lookupName}`,
    maxProfileLookupResponseBytes,
    fetchImpl,
  );
  if (response.kind !== "ok") {
    return mapProfileRequestFailure("name-lookup", response);
  }
  const parsed = parseJavaPlayerProfileLookupResponse(response.value, normalized.lookupName);
  if (parsed.status !== "found") {
    return parsed;
  }
  return {
    ...parsed,
    source: javaPlayerProfileSourceEvidence,
  };
}

export async function getVerifiedJavaPlayerTextures(
  uuid: unknown,
  fetchImpl: JavaPlayerProfileFetch = fetch,
): Promise<VerifiedJavaPlayerTexturesOutcome> {
  const normalized = normalizeJavaPlayerUuid(uuid);
  if (normalized.status !== "normalized") {
    return normalized;
  }
  const sessionResponse = await requestJson(
    `${sessionProfileBaseUrl}/${normalized.undashedUuid}?unsigned=false`,
    maxSessionProfileResponseBytes,
    fetchImpl,
  );
  if (sessionResponse.kind !== "ok") {
    return mapProfileRequestFailure("session-profile", sessionResponse);
  }
  const inspection = inspectJavaPlayerSessionResponse(sessionResponse.value, normalized.uuid);
  if (inspection.status !== "ready-for-verification") {
    return inspection;
  }

  const publicKeysResponse = await requestJson(
    publicKeysUrl,
    maxPublicKeysResponseBytes,
    fetchImpl,
  );
  if (publicKeysResponse.kind !== "ok") {
    return mapPublicKeysRequestFailure(publicKeysResponse);
  }
  const verification = verifyJavaPlayerTextureMetadata({
    sessionResponse: sessionResponse.value,
    publicKeysResponse: publicKeysResponse.value,
    expectedUuid: normalized.uuid,
  });
  if (verification.status !== "verified") {
    return verification;
  }
  return {
    ...verification,
    source: javaPlayerProfileSourceEvidence,
  };
}
