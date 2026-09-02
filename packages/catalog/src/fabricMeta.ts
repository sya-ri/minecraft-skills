const fabricMetaBaseUrl = "https://meta.fabricmc.net/v2/versions";
const fabricMetaUserAgent = "sya-ri/minecraft-skills/0.1.7 (github.com/sya-ri/minecraft-skills)";
const maxGameVersionLength = 128;
const maxVersionLength = 256;
const maxMavenCoordinateLength = 512;
const maxSeparatorLength = 32;
const maxResponseBytes = 1024 * 1024;
const maxResponseEntries = 10_000;
const maxBuildNumber = 2_147_483_647;
const fabricUnobfuscatedSince = { label: "26.1", major: 26, minor: 1 } as const;
const fabricUnobfuscatedWeeklySnapshotSince = {
  label: "26w14a",
  year: 26,
  week: 14,
  revision: "a",
} as const;
const fabricMappingsDocumentationUrl = "https://docs.fabricmc.net/develop/porting/mappings";
const fabricLoomDocumentationUrl = "https://docs.fabricmc.net/develop/loom";
const fabricVersionNormalizationDocumentationUrl =
  "https://docs.fabricmc.net/develop/loader/fabric-mod-json";

export type FabricMetaEndpoint = "loader" | "yarn" | "intermediary";

export type FabricLoaderVersion = {
  separator: string;
  build: number;
  maven: string;
  version: string;
  stable: boolean;
};

export type FabricIntermediaryVersion = {
  maven: string;
  version: string;
  stable: boolean;
};

export type FabricYarnVersion = {
  gameVersion: string;
  separator: string;
  build: number;
  maven: string;
  version: string;
  stable: boolean;
};

export type FabricLoaderPair = {
  loader: FabricLoaderVersion;
  intermediary: FabricIntermediaryVersion;
};

export type FabricToolchainTuple = {
  loader: FabricLoaderVersion;
  intermediary: FabricIntermediaryVersion;
  yarn: FabricYarnVersion;
};

export type FabricMappingMode = "intermediary-yarn" | "unobfuscated" | "unknown";

export type FabricLoomPluginId = "net.fabricmc.fabric-loom" | "net.fabricmc.fabric-loom-remap";

export type FabricToolchainLookupOptions = {
  gameVersion: string;
  limit?: number;
  timeoutMs?: number;
};

export type FabricToolchainLookupResult = {
  schemaVersion: 1;
  gameVersion: string;
  source: {
    kind: "official-live";
    baseUrl: string;
    endpoints: Record<FabricMetaEndpoint, string>;
    endpointAvailability: Record<FabricMetaEndpoint, "available" | "unavailable">;
    upstreamOrdering: "newest-first";
  };
  selection: {
    stablePreferred: true;
    meaning: string;
  };
  mappingPolicy: {
    kind: "maintained-official-documentation";
    coverage: "covered" | "unknown";
    unobfuscatedSince: "26.1";
    unobfuscatedWeeklySnapshotSince: "26w14a";
    documentation: {
      mappings: string;
      loom: string;
      versionNormalization: string;
    };
  };
  mappingMode: FabricMappingMode;
  mappingsRequired: boolean | null;
  loomPluginId: FabricLoomPluginId | null;
  counts: {
    loaderPairs: number;
    intermediaries: number;
    yarnMappings: number;
    possibleTuples: number;
  };
  truncated: {
    loaderPairs: boolean;
    intermediaries: boolean;
    yarnMappings: boolean;
    tuples: boolean;
  };
  candidates: {
    loaderPairs: FabricLoaderPair[];
    intermediaries: FabricIntermediaryVersion[];
    yarnMappings: FabricYarnVersion[];
  };
  recommendedLoader: FabricLoaderVersion | null;
  recommended: FabricToolchainTuple | null;
  tuples: FabricToolchainTuple[];
  notes: string[];
};

export type FabricMetaFetch = (url: string, init?: RequestInit) => Promise<Response>;

function hasAsciiControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
}

function boundedErrorDetail(value: string): string {
  const sanitized = [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127 ? " " : character;
    })
    .join("")
    .trim();
  return sanitized.slice(0, 256) || "Unknown error";
}

function validateBoundedString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new Error(
      `Fabric Meta response field ${field} must be a non-empty string up to ${maxLength} characters`,
    );
  }
  if (value.trim() !== value || hasAsciiControlCharacter(value)) {
    throw new Error(`Fabric Meta response field ${field} contains unsupported whitespace`);
  }
  return value;
}

function validateStable(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Fabric Meta response field ${field} must be boolean`);
  }
  return value;
}

function validateBuild(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maxBuildNumber
  ) {
    throw new Error(
      `Fabric Meta response field ${field} must be an integer between 0 and ${maxBuildNumber}`,
    );
  }
  return value;
}

function validateRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Fabric Meta response field ${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function validateResponseArray(value: unknown, endpoint: FabricMetaEndpoint): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Fabric Meta ${endpoint} response must be an array`);
  }
  if (value.length > maxResponseEntries) {
    throw new Error(
      `Fabric Meta ${endpoint} response exceeds the ${maxResponseEntries} entry limit`,
    );
  }
  return value;
}

function validateMavenCoordinate(
  value: unknown,
  field: string,
  artifact: "fabric-loader" | "intermediary" | "yarn",
  version: string,
): string {
  const coordinate = validateBoundedString(value, field, maxMavenCoordinateLength);
  if (coordinate !== `net.fabricmc:${artifact}:${version}`) {
    throw new Error(`Fabric Meta response field ${field} does not match its version field`);
  }
  return coordinate;
}

function validateLoaderVersion(value: unknown, field: string): FabricLoaderVersion {
  const record = validateRecord(value, field);
  const version = validateBoundedString(record.version, `${field}.version`, maxVersionLength);
  return {
    separator: validateBoundedString(record.separator, `${field}.separator`, maxSeparatorLength),
    build: validateBuild(record.build, `${field}.build`),
    maven: validateMavenCoordinate(record.maven, `${field}.maven`, "fabric-loader", version),
    version,
    stable: validateStable(record.stable, `${field}.stable`),
  };
}

function validateIntermediaryVersion(value: unknown, field: string): FabricIntermediaryVersion {
  const record = validateRecord(value, field);
  const version = validateBoundedString(record.version, `${field}.version`, maxVersionLength);
  return {
    maven: validateMavenCoordinate(record.maven, `${field}.maven`, "intermediary", version),
    version,
    stable: validateStable(record.stable, `${field}.stable`),
  };
}

function validateYarnVersion(
  value: unknown,
  field: string,
  gameVersion: string,
): FabricYarnVersion {
  const record = validateRecord(value, field);
  const responseGameVersion = validateBoundedString(
    record.gameVersion,
    `${field}.gameVersion`,
    maxGameVersionLength,
  );
  if (responseGameVersion !== gameVersion) {
    throw new Error(
      `Fabric Meta response field ${field}.gameVersion does not match requested game version ${gameVersion}`,
    );
  }
  const version = validateBoundedString(record.version, `${field}.version`, maxVersionLength);
  return {
    gameVersion: responseGameVersion,
    separator: validateBoundedString(record.separator, `${field}.separator`, maxSeparatorLength),
    build: validateBuild(record.build, `${field}.build`),
    maven: validateMavenCoordinate(record.maven, `${field}.maven`, "yarn", version),
    version,
    stable: validateStable(record.stable, `${field}.stable`),
  };
}

function uniqueBy<T>(values: T[], key: (value: T) => string, label: string): T[] {
  const seen = new Map<string, T>();
  return values.filter((value) => {
    const candidateKey = key(value);
    const previous = seen.get(candidateKey);
    if (previous !== undefined) {
      if (JSON.stringify(previous) !== JSON.stringify(value)) {
        throw new Error(`Fabric Meta response contains conflicting duplicate ${label} entries`);
      }
      return false;
    }
    seen.set(candidateKey, value);
    return true;
  });
}

function validateLoaderPairs(value: unknown): FabricLoaderPair[] {
  return uniqueBy(
    validateResponseArray(value, "loader").map((entry, index) => {
      const record = validateRecord(entry, `loader[${index}]`);
      return {
        loader: validateLoaderVersion(record.loader, `loader[${index}].loader`),
        intermediary: validateIntermediaryVersion(
          record.intermediary,
          `loader[${index}].intermediary`,
        ),
      };
    }),
    (entry) => `${entry.loader.version}\u0000${entry.intermediary.maven}`,
    "loader",
  );
}

function validateIntermediaries(value: unknown): FabricIntermediaryVersion[] {
  const intermediaries = uniqueBy(
    validateResponseArray(value, "intermediary").map((entry, index) =>
      validateIntermediaryVersion(entry, `intermediary[${index}]`),
    ),
    (entry) => `${entry.maven}\u0000${entry.version}\u0000${entry.stable}`,
    "intermediary",
  );
  if (intermediaries.length > 1) {
    const [first, ...rest] = intermediaries;
    if (
      first !== undefined &&
      rest.every((entry) => entry.maven === first.maven && entry.version === first.version)
    ) {
      throw new Error(
        `Fabric Meta intermediary response contains contradictory stable flags for ${first.maven}`,
      );
    }
    throw new Error(
      "Fabric Meta intermediary response contains multiple distinct candidates; expected at most one",
    );
  }
  return intermediaries;
}

function validateYarnMappings(value: unknown, gameVersion: string): FabricYarnVersion[] {
  return uniqueBy(
    validateResponseArray(value, "yarn").map((entry, index) =>
      validateYarnVersion(entry, `yarn[${index}]`, gameVersion),
    ),
    (entry) => entry.maven,
    "Yarn",
  );
}

function validateGameVersion(value: string): string {
  const gameVersion = value.trim();
  if (!gameVersion) {
    throw new Error("Fabric toolchain lookup requires a Minecraft game version");
  }
  if (gameVersion !== value || gameVersion.length > maxGameVersionLength) {
    throw new Error(
      `Minecraft game version must be at most ${maxGameVersionLength} characters without surrounding whitespace`,
    );
  }
  if (hasAsciiControlCharacter(gameVersion)) {
    throw new Error("Minecraft game version contains unsupported control characters");
  }
  return gameVersion;
}

function validateLimit(value: number | undefined): number {
  const limit = value ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("Fabric toolchain limit must be between 1 and 50");
  }
  return limit;
}

function validateTimeout(value: number | undefined): number {
  const timeoutMs = value ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error("Fabric Meta timeout must be between 100 and 30000 milliseconds");
  }
  return timeoutMs;
}

export function buildFabricMetaVersionUrl(
  endpoint: FabricMetaEndpoint,
  gameVersion: string,
): string {
  const version = validateGameVersion(gameVersion);
  return `${fabricMetaBaseUrl}/${endpoint}/${encodeURIComponent(version)}`;
}

async function readBoundedJson(response: Response, endpoint: FabricMetaEndpoint): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new Error(`Fabric Meta ${endpoint} response has an invalid Content-Length header`);
    }
    if (Number(contentLength) > maxResponseBytes) {
      throw new Error(
        `Fabric Meta ${endpoint} response exceeds the ${maxResponseBytes} byte limit`,
      );
    }
  }

  if (!response.body) {
    throw new Error(`Fabric Meta ${endpoint} response body is empty`);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxResponseBytes) {
        throw new Error(
          `Fabric Meta ${endpoint} response exceeds the ${maxResponseBytes} byte limit`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
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
    throw new Error(`Fabric Meta ${endpoint} response is not valid UTF-8`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Fabric Meta ${endpoint} response is not valid JSON`);
  }
}

async function fetchEndpoint(
  endpoint: FabricMetaEndpoint,
  url: string,
  gameVersion: string,
  signal: AbortSignal,
  fetchImpl: FabricMetaFetch,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": fabricMetaUserAgent,
    },
    signal,
  });
  try {
    if (!response.ok) {
      const statusText = boundedErrorDetail(response.statusText);
      if (response.status === 400 || response.status === 404) {
        throw new Error(
          `Fabric Meta ${endpoint} endpoint rejected Minecraft game version ${gameVersion}: ${response.status} ${statusText}`,
        );
      }
      throw new Error(`Fabric Meta ${endpoint} request failed: ${response.status} ${statusText}`);
    }
    return await readBoundedJson(response, endpoint);
  } catch (error) {
    // Cleanup must neither replace the endpoint error nor delay the bounded lookup.
    void response.body?.cancel().catch(() => {});
    throw error;
  }
}

type OptionalEndpointResult<T> = {
  value: T | null;
  error: string | null;
};

async function fetchOptionalEndpoint<T>(
  endpoint: FabricMetaEndpoint,
  url: string,
  gameVersion: string,
  signal: AbortSignal,
  fetchImpl: FabricMetaFetch,
  validate: (value: unknown) => T,
): Promise<OptionalEndpointResult<T>> {
  try {
    return {
      value: validate(await fetchEndpoint(endpoint, url, gameVersion, signal, fetchImpl)),
      error: null,
    };
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    return {
      value: null,
      error: boundedErrorDetail(error instanceof Error ? error.message : String(error)),
    };
  }
}

function stableFirst<T>(values: T[], isStable: (value: T) => boolean): T[] {
  return [
    ...values.filter((value) => isStable(value)),
    ...values.filter((value) => !isStable(value)),
  ];
}

function resolveFabricMappingMode(gameVersion: string): FabricMappingMode {
  const dateBasedMatch = /^(\d+)\.(\d+)(?:$|[.\s-])/.exec(gameVersion);
  if (dateBasedMatch) {
    const major = Number(dateBasedMatch[1]);
    const minor = Number(dateBasedMatch[2]);
    if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor)) {
      return "unknown";
    }
    return major > fabricUnobfuscatedSince.major ||
      (major === fabricUnobfuscatedSince.major && minor >= fabricUnobfuscatedSince.minor)
      ? "unobfuscated"
      : "intermediary-yarn";
  }

  const weeklySnapshotMatch = /^(?:Snapshot )?(\d{2})w(\d{2})([a-z])(?:$|[-_\s])/i.exec(
    gameVersion,
  );
  if (!weeklySnapshotMatch) {
    return "intermediary-yarn";
  }
  const year = Number(weeklySnapshotMatch[1]);
  const week = Number(weeklySnapshotMatch[2]);
  const revision = weeklySnapshotMatch[3]?.toLowerCase();
  if (week < 1 || week > 53 || revision === undefined) {
    return "unknown";
  }
  const atOrAfterUnobfuscatedBoundary =
    year > fabricUnobfuscatedWeeklySnapshotSince.year ||
    (year === fabricUnobfuscatedWeeklySnapshotSince.year &&
      (week > fabricUnobfuscatedWeeklySnapshotSince.week ||
        (week === fabricUnobfuscatedWeeklySnapshotSince.week &&
          revision >= fabricUnobfuscatedWeeklySnapshotSince.revision)));
  if (atOrAfterUnobfuscatedBoundary) {
    return "unobfuscated";
  }
  return year < fabricUnobfuscatedWeeklySnapshotSince.year ? "intermediary-yarn" : "unknown";
}

function buildTuples(
  loaderPairs: FabricLoaderPair[],
  yarnMappings: FabricYarnVersion[],
  limit: number,
): FabricToolchainTuple[] {
  const tuples: FabricToolchainTuple[] = [];
  const orderedLoaders = stableFirst(loaderPairs, (entry) => entry.loader.stable);
  const orderedYarn = stableFirst(yarnMappings, (entry) => entry.stable);
  for (const loaderPair of orderedLoaders) {
    for (const yarn of orderedYarn) {
      tuples.push({ ...loaderPair, yarn });
      if (tuples.length === limit) {
        return tuples;
      }
    }
  }
  return tuples;
}

function assertIntermediaryConsistency(
  loaderPairs: FabricLoaderPair[],
  intermediaries: FabricIntermediaryVersion[],
): void {
  const intermediary = intermediaries[0];
  if (intermediary === undefined) {
    return;
  }
  for (const pair of loaderPairs) {
    if (
      pair.intermediary.maven !== intermediary.maven ||
      pair.intermediary.version !== intermediary.version
    ) {
      throw new Error(
        `Fabric Meta responses are inconsistent for intermediary ${pair.intermediary.maven}`,
      );
    }
    if (pair.intermediary.stable !== intermediary.stable) {
      throw new Error(
        `Fabric Meta responses contain contradictory stable flags for intermediary ${intermediary.maven}`,
      );
    }
  }
}

export async function getFabricToolchainCompatibility(
  options: FabricToolchainLookupOptions,
  fetchImpl: FabricMetaFetch = fetch,
): Promise<FabricToolchainLookupResult> {
  const gameVersion = validateGameVersion(options.gameVersion);
  const limit = validateLimit(options.limit);
  const timeoutMs = validateTimeout(options.timeoutMs);
  const mappingMode = resolveFabricMappingMode(gameVersion);
  const mappingsRequired = mappingMode === "unknown" ? null : mappingMode === "intermediary-yarn";
  const loomPluginId: FabricLoomPluginId | null =
    mappingMode === "unknown"
      ? null
      : mappingMode === "intermediary-yarn"
        ? "net.fabricmc.fabric-loom-remap"
        : "net.fabricmc.fabric-loom";
  const usesLegacyMappingSurface = mappingMode !== "unobfuscated";
  const endpoints: Record<FabricMetaEndpoint, string> = {
    loader: buildFabricMetaVersionUrl("loader", gameVersion),
    yarn: buildFabricMetaVersionUrl("yarn", gameVersion),
    intermediary: buildFabricMetaVersionUrl("intermediary", gameVersion),
  };
  const controller = new AbortController();
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`Fabric Meta lookup timed out after ${timeoutMs} milliseconds`));
    }, timeoutMs);
  });

  const endpointAvailability: Record<FabricMetaEndpoint, "available" | "unavailable"> = {
    loader: "available",
    yarn: "available",
    intermediary: "available",
  };
  const optionalEndpointFailures: Partial<Record<FabricMetaEndpoint, string>> = {};
  let raw: [unknown, unknown, unknown];
  try {
    if (usesLegacyMappingSurface) {
      raw = await Promise.race([
        Promise.all([
          fetchEndpoint("loader", endpoints.loader, gameVersion, controller.signal, fetchImpl),
          fetchEndpoint("yarn", endpoints.yarn, gameVersion, controller.signal, fetchImpl),
          fetchEndpoint(
            "intermediary",
            endpoints.intermediary,
            gameVersion,
            controller.signal,
            fetchImpl,
          ),
        ]),
        timeout,
      ]);
    } else {
      const optionalResults: Partial<
        Record<"yarn" | "intermediary", OptionalEndpointResult<unknown>>
      > = {};
      const loaderLookup = fetchEndpoint(
        "loader",
        endpoints.loader,
        gameVersion,
        controller.signal,
        fetchImpl,
      );
      const yarnLookup = fetchOptionalEndpoint(
        "yarn",
        endpoints.yarn,
        gameVersion,
        controller.signal,
        fetchImpl,
        (value) => validateYarnMappings(value, gameVersion),
      ).then((result) => {
        optionalResults.yarn = result;
      });
      const intermediaryLookup = fetchOptionalEndpoint(
        "intermediary",
        endpoints.intermediary,
        gameVersion,
        controller.signal,
        fetchImpl,
        validateIntermediaries,
      ).then((result) => {
        optionalResults.intermediary = result;
      });
      const optionalLookup = Promise.allSettled([yarnLookup, intermediaryLookup]);

      const loader = await Promise.race([loaderLookup, timeout]);
      try {
        await Promise.race([optionalLookup, timeout]);
      } catch (error) {
        if (!timedOut) {
          throw error;
        }
      }

      const optionalValue = (endpoint: "yarn" | "intermediary"): unknown => {
        const result = optionalResults[endpoint];
        if (result === undefined) {
          endpointAvailability[endpoint] = "unavailable";
          optionalEndpointFailures[endpoint] =
            `Fabric Meta ${endpoint} endpoint did not finish before the ${timeoutMs} millisecond deadline`;
          return [];
        }
        if (result.error !== null) {
          endpointAvailability[endpoint] = "unavailable";
          optionalEndpointFailures[endpoint] = result.error;
        }
        return result.value ?? [];
      };
      raw = [loader, optionalValue("yarn"), optionalValue("intermediary")];
    }
  } catch (error) {
    controller.abort();
    if (timedOut) {
      throw new Error(`Fabric Meta lookup timed out after ${timeoutMs} milliseconds`);
    }
    if (error instanceof Error && error.message.startsWith("Fabric Meta")) {
      throw error;
    }
    throw new Error(
      `Fabric Meta lookup failed: ${boundedErrorDetail(
        error instanceof Error ? error.message : String(error),
      )}`,
    );
  } finally {
    controller.abort();
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }

  const loaderPairs = validateLoaderPairs(raw[0]);
  const yarnMappings = validateYarnMappings(raw[1], gameVersion);
  let intermediaries = validateIntermediaries(raw[2]);
  if (loaderPairs.length === 0 && yarnMappings.length === 0 && intermediaries.length === 0) {
    throw new Error(`Fabric Meta has no entries for Minecraft game version ${gameVersion}`);
  }
  try {
    assertIntermediaryConsistency(loaderPairs, intermediaries);
  } catch (error) {
    if (usesLegacyMappingSurface) {
      throw error;
    }
    endpointAvailability.intermediary = "unavailable";
    optionalEndpointFailures.intermediary = boundedErrorDetail(
      error instanceof Error ? error.message : String(error),
    );
    intermediaries = [];
  }

  const recommendedLoader =
    stableFirst(loaderPairs, (entry) => entry.loader.stable)[0]?.loader ?? null;
  const possibleTuples = usesLegacyMappingSurface ? loaderPairs.length * yarnMappings.length : 0;
  const tuples = usesLegacyMappingSurface ? buildTuples(loaderPairs, yarnMappings, limit) : [];
  const notes = [
    "Fabric Meta documents endpoint results as newest-first; candidate arrays preserve that upstream order.",
    "The Loader recommendation prefers an entry whose upstream stable flag is true, then falls back to the first newest-first entry.",
    "Stable is Fabric Meta metadata, not a guarantee that a mod, Fabric API build, or complete project dependency set is compatible.",
    "The loader endpoint pairs each compatible loader candidate with Fabric Meta's best intermediary entry for the requested game version.",
  ];
  if (mappingMode === "intermediary-yarn") {
    notes.push(
      "The complete-toolchain recommendation also prefers a stable Yarn entry, then falls back to the first newest-first entry.",
      "Generated tuples combine Loader and Yarn entries listed for the same game version; Fabric Meta does not publish those Cartesian combinations as a separate compatibility guarantee.",
    );
  } else if (mappingMode === "unobfuscated") {
    notes.push(
      `The maintained Fabric mapping policy marks ${gameVersion} as unobfuscated because official Fabric documentation uses the no-remap Loom plugin for Minecraft ${fabricUnobfuscatedSince.label} and newer. A separate Intermediary or Yarn mappings dependency is not required.`,
      "Intermediary candidates returned by Fabric Meta are preserved as source metadata, but their values do not decide the mapping mode.",
    );
  } else {
    notes.push(
      `The maintained Fabric mapping policy does not cover ${gameVersion}, so the mapping mode is unknown and no mappings dependency or Loom plugin requirement is asserted. The documented weekly no-remap boundary starts at ${fabricUnobfuscatedWeeklySnapshotSince.label}; earlier weekly identifiers in that year need additional official normalization evidence.`,
      "The legacy Loader, Intermediary, and Yarn candidate and tuple surface is preserved for inspection while the mapping mode remains unknown.",
    );
  }
  for (const endpoint of ["yarn", "intermediary"] as const) {
    const failure = optionalEndpointFailures[endpoint];
    if (failure !== undefined) {
      notes.push(
        `The supplemental Fabric Meta ${endpoint} endpoint was unavailable for this no-remap lookup, so its candidates are omitted: ${failure}`,
      );
    }
  }
  if (loaderPairs.length === 0) {
    notes.push("Fabric Meta listed no compatible loader candidates for this game version.");
  }
  if (mappingMode === "intermediary-yarn" && yarnMappings.length === 0) {
    notes.push(
      "Fabric Meta listed no Yarn mappings for this game version, so a complete Loader + Intermediary + Yarn tuple cannot be recommended.",
    );
  }
  if (intermediaries.length === 0 && endpointAvailability.intermediary === "available") {
    notes.push(
      "Fabric Meta listed no standalone Intermediary candidate, so the Loader endpoint pairing could not be independently cross-checked.",
    );
  }
  if (intermediaries.some((entry) => entry.version !== gameVersion)) {
    notes.push(
      "Fabric Meta returned an Intermediary version identifier different from the requested game version; the official value is preserved and cross-checked rather than rewritten.",
    );
  }

  return {
    schemaVersion: 1,
    gameVersion,
    source: {
      kind: "official-live",
      baseUrl: fabricMetaBaseUrl,
      endpoints,
      endpointAvailability,
      upstreamOrdering: "newest-first",
    },
    selection: {
      stablePreferred: true,
      meaning:
        mappingMode === "unknown"
          ? "Prefer the first stable Loader and preserve the legacy tuple selection for inspection; the mapping policy is unknown, so this is not a mappings or Loom plugin recommendation."
          : mappingsRequired
            ? "Prefer the first Loader and Yarn entries marked stable while retaining the Loader endpoint's paired Intermediary; this is a selection heuristic, not an expanded compatibility guarantee."
            : "Prefer the first Loader entry marked stable for the maintained no-remap toolchain policy; this is a selection heuristic, not an expanded compatibility guarantee.",
    },
    mappingPolicy: {
      kind: "maintained-official-documentation",
      coverage: mappingMode === "unknown" ? "unknown" : "covered",
      unobfuscatedSince: fabricUnobfuscatedSince.label,
      unobfuscatedWeeklySnapshotSince: fabricUnobfuscatedWeeklySnapshotSince.label,
      documentation: {
        mappings: fabricMappingsDocumentationUrl,
        loom: fabricLoomDocumentationUrl,
        versionNormalization: fabricVersionNormalizationDocumentationUrl,
      },
    },
    mappingMode,
    mappingsRequired,
    loomPluginId,
    counts: {
      loaderPairs: loaderPairs.length,
      intermediaries: intermediaries.length,
      yarnMappings: yarnMappings.length,
      possibleTuples,
    },
    truncated: {
      loaderPairs: loaderPairs.length > limit,
      intermediaries: intermediaries.length > limit,
      yarnMappings: yarnMappings.length > limit,
      tuples: possibleTuples > limit,
    },
    candidates: {
      loaderPairs: loaderPairs.slice(0, limit),
      intermediaries: intermediaries.slice(0, limit),
      yarnMappings: yarnMappings.slice(0, limit),
    },
    recommendedLoader,
    recommended: tuples[0] ?? null,
    tuples,
    notes,
  };
}
