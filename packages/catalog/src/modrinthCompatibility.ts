const modrinthApiRoot = "https://api.modrinth.com/v2";
const modrinthUserAgent = "sya-ri/minecraft-skills/0.1.6 (github.com/sya-ri/minecraft-skills)";

export const modrinthCompatibilityLimits = Object.freeze({
  minProjects: 2,
  maxProjects: 10,
  defaultCandidateLimit: 3,
  maxCandidateLimit: 10,
  maxConcurrentRequests: 4,
  defaultTimeoutMs: 10_000,
  maxTimeoutMs: 30_000,
  maxResponseBytes: 2 * 1024 * 1024,
  maxVersionsPerProject: 2_000,
  maxMetadataValues: 128,
  maxOutputMetadataValues: 50,
  maxPairEvaluationsPerProject: 100_000,
  maxUniquePairsPerProject: 10_000,
  maxOutputPairs: 50,
} as const);

export type ModrinthCompatibilityOptions = {
  projects: string[];
  gameVersion?: string;
  loader?: string;
  featured?: boolean;
  limit?: number;
  timeoutMs?: number;
};

export type ModrinthCompatibilityVersion = {
  id: string;
  projectId: string;
  versionNumber: string;
  versionType: "release" | "beta" | "alpha";
  featured: boolean;
  datePublished: string;
  gameVersions: string[];
  gameVersionsTruncated: boolean;
  loaders: string[];
  loadersTruncated: boolean;
};

export type ModrinthCompatibilityValueSet = {
  total: number;
  truncated: boolean;
  values: string[];
};

export type ModrinthCompatibilityPairVersion = Pick<
  ModrinthCompatibilityVersion,
  "id" | "projectId" | "versionNumber" | "versionType" | "featured" | "datePublished"
>;

export type ModrinthCompatibilityPair = {
  gameVersion: string;
  loader: string;
  selectionBasis: "latest-date-published-after-filters";
  projects: Array<{
    project: string;
    version: ModrinthCompatibilityPairVersion;
  }>;
};

export type ModrinthCompatibilityPairSet = {
  status: "computed" | "indeterminate";
  total: number;
  truncated: boolean;
  pairs: ModrinthCompatibilityPair[];
};

export type ModrinthCompatibilityProjectResult = {
  project: string;
  canonicalProjectId: string | null;
  canonicalRequestUrl: string | null;
  versionsRequestUrl: string | null;
  status: "ok" | "no-matching-versions" | "request-failed" | "invalid-response";
  failurePhase: "project-check" | "versions" | null;
  httpStatus: number | null;
  matchedVersionCount: number;
  selectionBasis: "latest-date-published-after-filters" | null;
  selectedVersion: ModrinthCompatibilityVersion | null;
  candidatesTruncated: boolean;
  candidates: ModrinthCompatibilityVersion[];
  metadata: {
    gameVersions: ModrinthCompatibilityValueSet;
    loaders: ModrinthCompatibilityValueSet;
  };
  reason: string | null;
};

export type ModrinthCompatibilityResult = {
  schemaVersion: 1;
  scope: "modrinth-version-metadata";
  requestsComplete: boolean;
  outcome: "compatible" | "no-common-pair" | "indeterminate";
  requestedProjectCount: number;
  duplicateProjectsRemoved: number;
  projectCount: number;
  filters: {
    gameVersion: string | null;
    loader: string | null;
    featured: boolean | null;
  };
  limits: {
    candidateVersionsPerProject: number;
    requestTimeoutMs: number;
    concurrentRequests: number;
    responseBytesPerRequest: number;
    versionsPerProject: number;
    pairEvaluationsPerProject: number;
    commonPairs: number;
    metadataValues: number;
  };
  metadataIntersection: {
    status: "computed" | "indeterminate";
    gameVersions: ModrinthCompatibilityValueSet;
    loaders: ModrinthCompatibilityValueSet;
  };
  commonPairs: ModrinthCompatibilityPairSet;
  projects: ModrinthCompatibilityProjectResult[];
  notes: string[];
};

export type ModrinthCompatibilityFetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers?: { get: (name: string) => string | null };
  body?: ReadableStream<Uint8Array> | null;
};

export type ModrinthCompatibilityFetch = (
  url: string,
  init?: RequestInit,
) => Promise<ModrinthCompatibilityFetchResponse>;

type NormalizedVersion = ModrinthCompatibilityVersion & {
  publishedTime: number;
  allGameVersions: string[];
  allLoaders: string[];
};

type InternalProjectResult = {
  output: ModrinthCompatibilityProjectResult;
  gameVersions: Set<string>;
  loaders: Set<string>;
  pairs: Map<string, InternalPairCandidate>;
};

type CanonicalProjectResult = {
  project: string;
  canonicalRequestUrl: string | null;
  canonicalProjectId: string | null;
  error: ProjectLookupError | null;
};

type InternalPairCandidate = {
  gameVersion: string;
  loader: string;
  version: NormalizedVersion;
};

class ProjectLookupError extends Error {
  constructor(
    readonly kind: "request-failed" | "invalid-response",
    message: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeBoundedText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  if (value.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new Error(`${label} must contain well-formed Unicode`);
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(`${label} must contain well-formed Unicode`);
    }
  }
  const normalized = value.trim().normalize("NFC");
  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }
  if (/\p{Cc}/u.test(normalized)) {
    throw new Error(`${label} must not contain control characters`);
  }
  if (normalized === "." || normalized === "..") {
    throw new Error(`${label} must not be a relative path segment`);
  }
  return normalized;
}

function normalizeProjects(projects: unknown): {
  requestedProjectCount: number;
  projects: string[];
} {
  if (!Array.isArray(projects)) {
    throw new Error("Modrinth compatibility projects must be an array");
  }
  if (
    projects.length < modrinthCompatibilityLimits.minProjects ||
    projects.length > modrinthCompatibilityLimits.maxProjects
  ) {
    throw new Error(
      `Modrinth compatibility requires between ${modrinthCompatibilityLimits.minProjects} and ${modrinthCompatibilityLimits.maxProjects} projects`,
    );
  }
  const unique = new Set<string>();
  for (const [index, project] of projects.entries()) {
    unique.add(normalizeBoundedText(project, `Project ${index + 1}`, 96));
  }
  if (unique.size < modrinthCompatibilityLimits.minProjects) {
    throw new Error("Modrinth compatibility requires at least two distinct projects");
  }
  return { requestedProjectCount: projects.length, projects: [...unique] };
}

function normalizeOptionalFilter(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return normalizeBoundedText(value, label, 64);
}

function normalizeInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return resolved;
}

function buildProjectVersionsUrl(
  project: string,
  filters: { gameVersion?: string; loader?: string; featured?: boolean },
): string {
  const url = new URL(`${modrinthApiRoot}/project/${encodeURIComponent(project)}/version`);
  if (filters.gameVersion) {
    url.searchParams.set("game_versions", JSON.stringify([filters.gameVersion]));
  }
  if (filters.loader) {
    url.searchParams.set("loaders", JSON.stringify([filters.loader]));
  }
  if (filters.featured !== undefined) {
    url.searchParams.set("featured", String(filters.featured));
  }
  url.searchParams.set("include_changelog", "false");
  return url.toString();
}

function buildProjectCheckUrl(project: string): string {
  return new URL(`${modrinthApiRoot}/project/${encodeURIComponent(project)}/check`).toString();
}

async function readBoundedResponse(
  response: ModrinthCompatibilityFetchResponse,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const contentLength = response.headers?.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    const declaredBytes = Number(contentLength);
    if (
      !Number.isSafeInteger(declaredBytes) ||
      declaredBytes > modrinthCompatibilityLimits.maxResponseBytes
    ) {
      throw new ProjectLookupError(
        "invalid-response",
        `Response exceeded the ${modrinthCompatibilityLimits.maxResponseBytes}-byte limit.`,
      );
    }
  }

  if (response.body) {
    const reader = response.body.getReader();
    const cancelOnAbort = () => {
      void reader.cancel().catch(() => undefined);
    };
    signal.addEventListener("abort", cancelOnAbort, { once: true });
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    let chunkCount = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunkCount += 1;
        if (chunkCount > 8_192 || !(value instanceof Uint8Array)) {
          await reader.cancel().catch(() => undefined);
          throw new ProjectLookupError("invalid-response", "Response body stream was invalid.");
        }
        byteLength += value.byteLength;
        if (byteLength > modrinthCompatibilityLimits.maxResponseBytes) {
          await reader.cancel().catch(() => undefined);
          throw new ProjectLookupError(
            "invalid-response",
            `Response exceeded the ${modrinthCompatibilityLimits.maxResponseBytes}-byte limit.`,
          );
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(byteLength);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes;
    } finally {
      signal.removeEventListener("abort", cancelOnAbort);
    }
  }

  throw new ProjectLookupError(
    "invalid-response",
    "Response body did not provide a bounded readable stream.",
  );
}

function validateResponseEnvelope(value: unknown): ModrinthCompatibilityFetchResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProjectLookupError("invalid-response", "Response envelope was invalid.");
  }
  const response = value as Partial<ModrinthCompatibilityFetchResponse>;
  if (
    typeof response.ok !== "boolean" ||
    !Number.isInteger(response.status) ||
    (response.status ?? 0) < 100 ||
    (response.status ?? 0) > 599 ||
    typeof response.statusText !== "string" ||
    response.statusText.length > 256 ||
    response.ok !== ((response.status ?? 0) >= 200 && (response.status ?? 0) < 300)
  ) {
    throw new ProjectLookupError("invalid-response", "Response envelope was invalid.");
  }
  return response as ModrinthCompatibilityFetchResponse;
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new ProjectLookupError("invalid-response", "Response was not valid UTF-8 JSON.");
  }
}

function releaseResponseBody(
  response: ModrinthCompatibilityFetchResponse,
  controller: AbortController,
): void {
  try {
    if (response.body && !response.body.locked) {
      void Promise.resolve(response.body.cancel()).catch(() => undefined);
    }
  } catch {
    // Aborting the request below still releases a malformed or already-failed response stream.
  } finally {
    controller.abort();
  }
}

function releaseUnknownResponseBody(value: unknown, controller: AbortController): void {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    try {
      const body = (value as { body?: unknown }).body;
      if (body && typeof body === "object") {
        const stream = body as { locked?: unknown; cancel?: unknown };
        if (stream.locked !== true && typeof stream.cancel === "function") {
          const cancellation = stream.cancel.call(body) as unknown;
          void Promise.resolve(cancellation).catch(() => undefined);
        }
      }
    } catch {
      // Best effort: aborting the request below remains the primary release path.
    }
  }
  controller.abort();
}

async function requestModrinthJson(
  url: string,
  timeoutMs: number,
  fetchResponse: ModrinthCompatibilityFetch,
): Promise<{ httpStatus: number; value: unknown }> {
  const controller = new AbortController();
  const timeoutError = new ProjectLookupError(
    "request-failed",
    `Request timed out after ${timeoutMs} ms.`,
  );
  let didTimeout = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      didTimeout = true;
      controller.abort();
      reject(timeoutError);
    }, timeoutMs);
  });
  try {
    let rawResponse: unknown;
    try {
      rawResponse = await Promise.race([
        fetchResponse(url, {
          headers: { "User-Agent": modrinthUserAgent },
          signal: controller.signal,
        }),
        timedOut,
      ]);
    } catch {
      if (didTimeout) throw timeoutError;
      throw new ProjectLookupError(
        "request-failed",
        "Request failed before a response was received.",
      );
    }

    let response: ModrinthCompatibilityFetchResponse;
    try {
      response = validateResponseEnvelope(rawResponse);
    } catch (error) {
      releaseUnknownResponseBody(rawResponse, controller);
      throw error;
    }
    if (!response.ok) {
      releaseResponseBody(response, controller);
      throw new ProjectLookupError(
        "request-failed",
        `Modrinth returned HTTP ${response.status}.`,
        response.status,
      );
    }

    try {
      const bytes = await Promise.race([
        readBoundedResponse(response, controller.signal),
        timedOut,
      ]);
      return { httpStatus: response.status, value: parseJson(bytes) };
    } catch (error) {
      releaseResponseBody(response, controller);
      if (didTimeout) throw timeoutError;
      const normalized = normalizeProjectLookupError(error);
      throw normalized.httpStatus === null
        ? new ProjectLookupError(normalized.kind, normalized.message, response.status)
        : normalized;
    }
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProjectLookupError("invalid-response", `${label} was not an object.`);
  }
  return value as Record<string, unknown>;
}

function requireResponseString(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximumLength) {
    throw new ProjectLookupError("invalid-response", `${label} was not a bounded string.`);
  }
  if (/\p{Cc}/u.test(value)) {
    throw new ProjectLookupError("invalid-response", `${label} contained control characters.`);
  }
  return value.normalize("NFC");
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > modrinthCompatibilityLimits.maxMetadataValues) {
    throw new ProjectLookupError("invalid-response", `${label} was not a bounded string array.`);
  }
  const normalized = new Set<string>();
  for (const entry of value) {
    normalized.add(requireResponseString(entry, `${label} entry`, 64));
  }
  return [...normalized].sort(compareText);
}

function isValidCalendarDate(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (daysInMonth[month - 1] ?? 0);
}

function boundedValues(values: Iterable<string>): ModrinthCompatibilityValueSet {
  const all = [...new Set(values)].sort(compareText);
  return {
    total: all.length,
    truncated: all.length > modrinthCompatibilityLimits.maxOutputMetadataValues,
    values: all.slice(0, modrinthCompatibilityLimits.maxOutputMetadataValues),
  };
}

function outputVersion(version: NormalizedVersion): ModrinthCompatibilityVersion {
  return {
    id: version.id,
    projectId: version.projectId,
    versionNumber: version.versionNumber,
    versionType: version.versionType,
    featured: version.featured,
    datePublished: version.datePublished,
    gameVersions: [...version.gameVersions],
    gameVersionsTruncated: version.gameVersionsTruncated,
    loaders: [...version.loaders],
    loadersTruncated: version.loadersTruncated,
  };
}

function parseVersions(value: unknown, canonicalProjectId: string): NormalizedVersion[] {
  if (!Array.isArray(value) || value.length > modrinthCompatibilityLimits.maxVersionsPerProject) {
    throw new ProjectLookupError(
      "invalid-response",
      `Response was not an array of at most ${modrinthCompatibilityLimits.maxVersionsPerProject} versions.`,
    );
  }
  const versions: NormalizedVersion[] = [];
  const ids = new Set<string>();
  for (const [index, raw] of value.entries()) {
    const record = requireRecord(raw, `Version ${index + 1}`);
    const id = requireResponseString(record.id, `Version ${index + 1} id`, 128);
    if (ids.has(id)) {
      throw new ProjectLookupError("invalid-response", "Response contained duplicate version IDs.");
    }
    ids.add(id);
    const projectId = requireResponseString(
      record.project_id,
      `Version ${index + 1} project_id`,
      128,
    );
    if (projectId !== canonicalProjectId) {
      throw new ProjectLookupError(
        "invalid-response",
        "Version response project_id did not match the canonical project ID.",
      );
    }
    const versionNumber = requireResponseString(
      record.version_number,
      `Version ${index + 1} version_number`,
      256,
    );
    if (
      record.version_type !== "release" &&
      record.version_type !== "beta" &&
      record.version_type !== "alpha"
    ) {
      throw new ProjectLookupError(
        "invalid-response",
        `Version ${index + 1} version_type was invalid.`,
      );
    }
    if (typeof record.featured !== "boolean") {
      throw new ProjectLookupError(
        "invalid-response",
        `Version ${index + 1} featured was not boolean.`,
      );
    }
    const rawDate = requireResponseString(
      record.date_published,
      `Version ${index + 1} date_published`,
      64,
    );
    if (!isValidCalendarDate(rawDate)) {
      throw new ProjectLookupError(
        "invalid-response",
        `Version ${index + 1} date_published was not ISO-8601.`,
      );
    }
    const publishedTime = Date.parse(rawDate);
    if (!Number.isFinite(publishedTime)) {
      throw new ProjectLookupError(
        "invalid-response",
        `Version ${index + 1} date_published was invalid.`,
      );
    }
    const allGameVersions = requireStringArray(
      record.game_versions,
      `Version ${index + 1} game_versions`,
    );
    const allLoaders = requireStringArray(record.loaders, `Version ${index + 1} loaders`);
    versions.push({
      id,
      projectId,
      versionNumber,
      versionType: record.version_type,
      featured: record.featured,
      datePublished: new Date(publishedTime).toISOString(),
      gameVersions: allGameVersions.slice(0, modrinthCompatibilityLimits.maxOutputMetadataValues),
      gameVersionsTruncated:
        allGameVersions.length > modrinthCompatibilityLimits.maxOutputMetadataValues,
      loaders: allLoaders.slice(0, modrinthCompatibilityLimits.maxOutputMetadataValues),
      loadersTruncated: allLoaders.length > modrinthCompatibilityLimits.maxOutputMetadataValues,
      publishedTime,
      allGameVersions,
      allLoaders,
    });
  }
  return versions.sort(
    (left, right) =>
      right.publishedTime - left.publishedTime ||
      compareText(left.id, right.id) ||
      compareText(left.versionNumber, right.versionNumber),
  );
}

function pairKey(gameVersion: string, loader: string): string {
  return `${gameVersion}\u0000${loader}`;
}

function buildPairIndex(
  versions: NormalizedVersion[],
  filters: { gameVersion?: string; loader?: string },
): Map<string, InternalPairCandidate> {
  const pairs = new Map<string, InternalPairCandidate>();
  let evaluations = 0;
  for (const version of versions) {
    const gameVersions = filters.gameVersion ? [filters.gameVersion] : version.allGameVersions;
    const loaders = filters.loader ? [filters.loader] : version.allLoaders;
    const pairCount = gameVersions.length * loaders.length;
    evaluations += pairCount;
    if (evaluations > modrinthCompatibilityLimits.maxPairEvaluationsPerProject) {
      throw new ProjectLookupError(
        "invalid-response",
        `Version metadata exceeded the ${modrinthCompatibilityLimits.maxPairEvaluationsPerProject}-pair evaluation limit.`,
      );
    }
    for (const gameVersion of gameVersions) {
      for (const loader of loaders) {
        const key = pairKey(gameVersion, loader);
        if (pairs.has(key)) continue;
        if (pairs.size >= modrinthCompatibilityLimits.maxUniquePairsPerProject) {
          throw new ProjectLookupError(
            "invalid-response",
            `Version metadata exceeded the ${modrinthCompatibilityLimits.maxUniquePairsPerProject}-unique-pair limit.`,
          );
        }
        pairs.set(key, { gameVersion, loader, version });
      }
    }
  }
  return pairs;
}

function outputPairVersion(version: NormalizedVersion): ModrinthCompatibilityPairVersion {
  return {
    id: version.id,
    projectId: version.projectId,
    versionNumber: version.versionNumber,
    versionType: version.versionType,
    featured: version.featured,
    datePublished: version.datePublished,
  };
}

function emptyMetadata(): ModrinthCompatibilityProjectResult["metadata"] {
  return {
    gameVersions: { total: 0, truncated: false, values: [] },
    loaders: { total: 0, truncated: false, values: [] },
  };
}

function failedProject(
  canonical: CanonicalProjectResult,
  versionsRequestUrl: string | null,
  error: ProjectLookupError,
  failurePhase: "project-check" | "versions",
): InternalProjectResult {
  return {
    output: {
      project: canonical.project,
      canonicalProjectId: canonical.canonicalProjectId,
      canonicalRequestUrl: canonical.canonicalRequestUrl,
      versionsRequestUrl,
      status: error.kind,
      failurePhase,
      httpStatus: error.httpStatus,
      matchedVersionCount: 0,
      selectionBasis: null,
      selectedVersion: null,
      candidatesTruncated: false,
      candidates: [],
      metadata: emptyMetadata(),
      reason: error.message,
    },
    gameVersions: new Set(),
    loaders: new Set(),
    pairs: new Map(),
  };
}

function normalizeProjectLookupError(error: unknown): ProjectLookupError {
  return error instanceof ProjectLookupError
    ? error
    : new ProjectLookupError("invalid-response", "Response could not be validated.");
}

function withHttpStatus(error: unknown, httpStatus: number | null): ProjectLookupError {
  const normalized = normalizeProjectLookupError(error);
  return normalized.httpStatus === null && httpStatus !== null
    ? new ProjectLookupError(normalized.kind, normalized.message, httpStatus)
    : normalized;
}

async function resolveCanonicalProject(
  project: string,
  timeoutMs: number,
  fetchResponse: ModrinthCompatibilityFetch,
): Promise<CanonicalProjectResult> {
  let canonicalRequestUrl: string | null = null;
  let httpStatus: number | null = null;
  try {
    canonicalRequestUrl = buildProjectCheckUrl(project);
    const response = await requestModrinthJson(canonicalRequestUrl, timeoutMs, fetchResponse);
    httpStatus = response.httpStatus;
    const record = requireRecord(response.value, "Project check response");
    const canonicalProjectId = requireResponseString(record.id, "Project check id", 128);
    if (!/^[A-Za-z0-9_-]+$/.test(canonicalProjectId)) {
      throw new ProjectLookupError(
        "invalid-response",
        "Project check id was not a safe ASCII project ID.",
      );
    }
    return { project, canonicalRequestUrl, canonicalProjectId, error: null };
  } catch (error) {
    return {
      project,
      canonicalRequestUrl,
      canonicalProjectId: null,
      error: withHttpStatus(error, httpStatus),
    };
  }
}

async function resolveProject(
  canonical: CanonicalProjectResult,
  filters: { gameVersion?: string; loader?: string; featured?: boolean },
  candidateLimit: number,
  timeoutMs: number,
  fetchResponse: ModrinthCompatibilityFetch,
): Promise<InternalProjectResult> {
  if (canonical.error || !canonical.canonicalProjectId) {
    return failedProject(
      canonical,
      null,
      canonical.error ??
        new ProjectLookupError("invalid-response", "Canonical project ID was unavailable."),
      "project-check",
    );
  }
  let versionsRequestUrl: string | null = null;
  let httpStatus: number | null = null;
  try {
    versionsRequestUrl = buildProjectVersionsUrl(canonical.canonicalProjectId, filters);
    const response = await requestModrinthJson(versionsRequestUrl, timeoutMs, fetchResponse);
    httpStatus = response.httpStatus;
    const versions = parseVersions(response.value, canonical.canonicalProjectId).filter(
      (version) =>
        (!filters.gameVersion || version.allGameVersions.includes(filters.gameVersion)) &&
        (!filters.loader || version.allLoaders.includes(filters.loader)) &&
        (filters.featured === undefined || version.featured === filters.featured),
    );
    const gameVersions = filters.gameVersion
      ? new Set(versions.length > 0 ? [filters.gameVersion] : [])
      : new Set(versions.flatMap((version) => version.allGameVersions));
    const loaders = filters.loader
      ? new Set(versions.length > 0 ? [filters.loader] : [])
      : new Set(versions.flatMap((version) => version.allLoaders));
    const metadata = {
      gameVersions: boundedValues(gameVersions),
      loaders: boundedValues(loaders),
    };
    const pairs = buildPairIndex(versions, filters);
    if (versions.length === 0) {
      return {
        output: {
          project: canonical.project,
          canonicalProjectId: canonical.canonicalProjectId,
          canonicalRequestUrl: canonical.canonicalRequestUrl,
          versionsRequestUrl,
          status: "no-matching-versions",
          failurePhase: null,
          httpStatus: response.httpStatus,
          matchedVersionCount: 0,
          selectionBasis: null,
          selectedVersion: null,
          candidatesTruncated: false,
          candidates: [],
          metadata,
          reason:
            filters.gameVersion || filters.loader || filters.featured !== undefined
              ? "No public versions matched all requested metadata filters."
              : "The project returned no public versions.",
        },
        gameVersions,
        loaders,
        pairs,
      };
    }
    const candidates = versions.slice(0, candidateLimit).map(outputVersion);
    return {
      output: {
        project: canonical.project,
        canonicalProjectId: canonical.canonicalProjectId,
        canonicalRequestUrl: canonical.canonicalRequestUrl,
        versionsRequestUrl,
        status: "ok",
        failurePhase: null,
        httpStatus: response.httpStatus,
        matchedVersionCount: versions.length,
        selectionBasis: "latest-date-published-after-filters",
        selectedVersion: versions[0] ? outputVersion(versions[0]) : null,
        candidatesTruncated: versions.length > candidateLimit,
        candidates,
        metadata,
        reason: null,
      },
      gameVersions,
      loaders,
      pairs,
    };
  } catch (error) {
    return failedProject(
      canonical,
      versionsRequestUrl,
      withHttpStatus(error, httpStatus),
      "versions",
    );
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value !== undefined) {
        results[index] = await mapper(value);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => worker()),
  );
  return results;
}

function intersection(
  projects: InternalProjectResult[],
  kind: "gameVersions" | "loaders",
): ModrinthCompatibilityValueSet {
  if (projects.length === 0) return boundedValues([]);
  const [first, ...rest] = projects;
  if (!first) return boundedValues([]);
  const values = [...first[kind]].filter((value) =>
    rest.every((project) => project[kind].has(value)),
  );
  return boundedValues(values);
}

function commonPairSet(projects: InternalProjectResult[]): ModrinthCompatibilityPairSet {
  const [first, ...rest] = projects;
  if (!first) {
    return { status: "computed", total: 0, truncated: false, pairs: [] };
  }
  const commonKeys = [...first.pairs.keys()]
    .filter((key) => rest.every((project) => project.pairs.has(key)))
    .map((key) => ({
      key,
      oldestLatestCandidate: Math.min(
        ...projects.map((project) => project.pairs.get(key)?.version.publishedTime ?? 0),
      ),
    }))
    .sort(
      (left, right) =>
        right.oldestLatestCandidate - left.oldestLatestCandidate ||
        compareText(left.key, right.key),
    );
  return {
    status: "computed",
    total: commonKeys.length,
    truncated: commonKeys.length > modrinthCompatibilityLimits.maxOutputPairs,
    pairs: commonKeys.slice(0, modrinthCompatibilityLimits.maxOutputPairs).map(({ key }) => {
      const target = first.pairs.get(key);
      if (!target) {
        throw new Error("Internal Modrinth compatibility pair index was inconsistent");
      }
      return {
        gameVersion: target.gameVersion,
        loader: target.loader,
        selectionBasis: "latest-date-published-after-filters" as const,
        projects: projects.map((project) => {
          const candidate = project.pairs.get(key);
          if (!candidate) {
            throw new Error("Internal Modrinth compatibility pair index was inconsistent");
          }
          return {
            project: project.output.project,
            version: outputPairVersion(candidate.version),
          };
        }),
      };
    }),
  };
}

function deduplicateCanonicalProjects(
  projects: CanonicalProjectResult[],
): CanonicalProjectResult[] {
  const seenProjectIds = new Set<string>();
  return projects.filter((project) => {
    const projectId = project.canonicalProjectId;
    if (!projectId) return true;
    if (seenProjectIds.has(projectId)) return false;
    seenProjectIds.add(projectId);
    return true;
  });
}

export async function resolveModrinthCompatibility(
  options: ModrinthCompatibilityOptions,
  fetchResponse: ModrinthCompatibilityFetch = (url, init) => fetch(url, init),
): Promise<ModrinthCompatibilityResult> {
  const normalized = normalizeProjects(options.projects);
  const gameVersion = normalizeOptionalFilter(options.gameVersion, "Game version");
  const loader = normalizeOptionalFilter(options.loader, "Loader");
  if (options.featured !== undefined && typeof options.featured !== "boolean") {
    throw new Error("Featured must be boolean");
  }
  const candidateLimit = normalizeInteger(
    options.limit,
    modrinthCompatibilityLimits.defaultCandidateLimit,
    1,
    modrinthCompatibilityLimits.maxCandidateLimit,
    "Candidate limit",
  );
  const timeoutMs = normalizeInteger(
    options.timeoutMs,
    modrinthCompatibilityLimits.defaultTimeoutMs,
    1,
    modrinthCompatibilityLimits.maxTimeoutMs,
    "Timeout",
  );
  const filters = {
    ...(gameVersion ? { gameVersion } : {}),
    ...(loader ? { loader } : {}),
    ...(options.featured !== undefined ? { featured: options.featured } : {}),
  };
  const fetchedCanonicalProjects = await mapWithConcurrency(
    normalized.projects,
    modrinthCompatibilityLimits.maxConcurrentRequests,
    (project) => resolveCanonicalProject(project, timeoutMs, fetchResponse),
  );
  const canonicalProjects = deduplicateCanonicalProjects(fetchedCanonicalProjects);
  if (canonicalProjects.length < modrinthCompatibilityLimits.minProjects) {
    throw new Error("Modrinth compatibility requires at least two distinct resolved projects");
  }
  const resolvedProjects = await mapWithConcurrency(
    canonicalProjects,
    modrinthCompatibilityLimits.maxConcurrentRequests,
    (project) => resolveProject(project, filters, candidateLimit, timeoutMs, fetchResponse),
  );
  const projects = resolvedProjects.map((project) => project.output);
  const requestsComplete = projects.every(
    (project) => project.status === "ok" || project.status === "no-matching-versions",
  );
  const metadataIntersection = requestsComplete
    ? {
        status: "computed" as const,
        gameVersions: intersection(resolvedProjects, "gameVersions"),
        loaders: intersection(resolvedProjects, "loaders"),
      }
    : {
        status: "indeterminate" as const,
        gameVersions: boundedValues([]),
        loaders: boundedValues([]),
      };
  const commonPairs = requestsComplete
    ? commonPairSet(resolvedProjects)
    : { status: "indeterminate" as const, total: 0, truncated: false, pairs: [] };
  return {
    schemaVersion: 1,
    scope: "modrinth-version-metadata",
    requestsComplete,
    outcome: !requestsComplete
      ? "indeterminate"
      : commonPairs.total > 0
        ? "compatible"
        : "no-common-pair",
    requestedProjectCount: normalized.requestedProjectCount,
    duplicateProjectsRemoved: normalized.requestedProjectCount - canonicalProjects.length,
    projectCount: resolvedProjects.length,
    filters: {
      gameVersion: gameVersion ?? null,
      loader: loader ?? null,
      featured: options.featured ?? null,
    },
    limits: {
      candidateVersionsPerProject: candidateLimit,
      requestTimeoutMs: timeoutMs,
      concurrentRequests: modrinthCompatibilityLimits.maxConcurrentRequests,
      responseBytesPerRequest: modrinthCompatibilityLimits.maxResponseBytes,
      versionsPerProject: modrinthCompatibilityLimits.maxVersionsPerProject,
      pairEvaluationsPerProject: modrinthCompatibilityLimits.maxPairEvaluationsPerProject,
      commonPairs: modrinthCompatibilityLimits.maxOutputPairs,
      metadataValues: modrinthCompatibilityLimits.maxOutputMetadataValues,
    },
    metadataIntersection,
    commonPairs,
    projects,
    notes: [
      "Results describe only metadata published for public Modrinth project versions.",
      "Common pairs are observed game-version and loader combinations from each concrete version's metadata; they do not prove that the projects interoperate at runtime.",
      "Independent game-version and loader intersections are supplemental and must not be combined into unlisted pairs.",
      "Explicit game-version and loader filters restrict reported targets even when a matching version lists additional metadata values.",
      "Selected versions are the latest date_published entries after explicit filters; release channel and featured status are not preferred unless filtered explicitly.",
      "Repeated identifiers are normalized locally, then slugs and IDs are canonicalized and deduplicated through Modrinth's project check endpoint before version filters are requested.",
    ],
  };
}
