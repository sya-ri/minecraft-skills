import { createHash } from "node:crypto";
import { openZipArchive, type ZipArchive } from "@minecraft-skills/data";

const fabricApiRepositoryUrl = "https://maven.fabricmc.net/";
const fabricApiArtifactPath = "net/fabricmc/fabric-api/fabric-api";
const fabricApiMetadataUrl = `${fabricApiRepositoryUrl}${fabricApiArtifactPath}/maven-metadata.xml`;
const fabricApiUserAgent = "sya-ri/minecraft-skills/0.1.8 (github.com/sya-ri/minecraft-skills)";

export const fabricApiRenderingPackagePrefixes = [
  "net.fabricmc.fabric.api.client.rendering.v1",
  "net.fabricmc.fabric.api.client.renderer.v1",
] as const;

export const fabricApiSurfaceLimits = Object.freeze({
  maxMetadataBytes: 256 * 1024,
  maxPomBytes: 256 * 1024,
  maxChecksumBytes: 1024,
  maxArchiveBytes: 16 * 1024 * 1024,
  maxArchiveEntries: 5_000,
  maxArchiveUncompressedBytes: 64 * 1024 * 1024,
  maxSearchIndexBytes: 2 * 1024 * 1024,
  maxSearchIndexEntries: 20_000,
  maxMavenVersions: 10_000,
  maxPomDependencies: 512,
  maxResultLimit: 200,
  maxTimeoutMs: 60_000,
  defaultTimeoutMs: 15_000,
});

export type FabricApiSurfaceFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type FabricApiMemberKind = "constructor" | "method" | "field-or-enum-constant" | "unknown";

export type FabricApiRenderingModule = {
  groupId: "net.fabricmc.fabric-api";
  artifactId: string;
  version: string;
  coordinate: string;
};

export type FabricApiRenderingType = {
  packageName: string;
  name: string;
  qualifiedName: string;
  javadocPath: string;
};

export type FabricApiRenderingMember = {
  packageName: string;
  typeName: string;
  qualifiedTypeName: string;
  name: string;
  label: string;
  signature: string;
  signatureSource: "url-fragment" | "display-label";
  kind: FabricApiMemberKind;
  javadocPath: string;
  javadocFragment: string;
};

type FabricApiRenderingSurface = {
  gameVersion: string;
  fabricApiVersion: string;
  artifact: {
    groupId: "net.fabricmc.fabric-api";
    artifactId: "fabric-api";
    version: string;
    coordinate: string;
    classifier: "fatjavadoc";
    extension: "jar";
  };
  versionSelection: {
    strategy: "highest-semver-with-exact-game-version-suffix";
    exactSuffix: string;
    reportedLatest: string | null;
    reportedRelease: string | null;
    matchingCandidateCount: number;
    candidates: string[];
    candidatesTruncated: boolean;
    reportedLatestUsed: false;
    reportedReleaseUsed: false;
  };
  renderingModules: FabricApiRenderingModule[];
  source: {
    kind: "official-live";
    repositoryUrl: string;
    metadataUrl: string;
    aggregatePomUrl: string;
    fatJavadocUrl: string;
    fatJavadocSha256Url: string;
    fatJavadocSha256: string;
    checkedAt: string;
  };
  coverage: {
    kind: "official-fatjavadoc-search-index";
    packagePrefixes: readonly string[];
    typeCount: number;
    memberCount: number;
    guarantees: string[];
    nonGuarantees: string[];
  };
  types: FabricApiRenderingType[];
  members: FabricApiRenderingMember[];
};

export type FabricApiTypeSearchOptions = {
  gameVersion: string;
  query?: string;
  packagePrefix?: string;
  limit?: number;
  timeoutMs?: number;
};

export type FabricApiMemberSearchOptions = FabricApiTypeSearchOptions & {
  type?: string;
  kind?: FabricApiMemberKind;
};

type FabricApiSearchContext = Omit<FabricApiRenderingSurface, "types" | "members">;

export type FabricApiTypeSearchResult = FabricApiSearchContext & {
  schemaVersion: 1;
  search: {
    query: string | null;
    packagePrefix: string | null;
    totalMatches: number;
    returned: number;
    truncated: boolean;
    limit: number;
  };
  types: FabricApiRenderingType[];
};

export type FabricApiMemberSearchResult = FabricApiSearchContext & {
  schemaVersion: 1;
  search: {
    query: string | null;
    type: string | null;
    kind: FabricApiMemberKind | null;
    packagePrefix: string | null;
    totalMatches: number;
    returned: number;
    truncated: boolean;
    limit: number;
  };
  members: FabricApiRenderingMember[];
};

type XmlNode = {
  name: string;
  text: string;
  children: XmlNode[];
};

type SearchIndexEntry = {
  p?: string;
  c?: string;
  l: string;
  u?: string;
  k?: string;
};

function boundedErrorDetail(value: string): string {
  const sanitized = [...value]
    .map((character) => (/\p{C}/u.test(character) ? " " : character))
    .join("")
    .trim();
  return [...sanitized].slice(0, 256).join("") || "Unknown error";
}

function hasUnsupportedControl(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      (codePoint < 32 && character !== "\t" && character !== "\n" && character !== "\r") ||
      codePoint === 127
    );
  });
}

function validateGameVersion(value: string): string {
  if (
    value.length < 1 ||
    value.length > 128 ||
    value.trim() !== value ||
    !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(value)
  ) {
    throw new Error(
      "Fabric API surface gameVersion must be a Maven-safe Minecraft version token up to 128 characters",
    );
  }
  return value;
}

function validateTimeout(value: number | undefined): number {
  const timeoutMs = value ?? fabricApiSurfaceLimits.defaultTimeoutMs;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > fabricApiSurfaceLimits.maxTimeoutMs
  ) {
    throw new Error(
      `Fabric API surface timeoutMs must be between 100 and ${fabricApiSurfaceLimits.maxTimeoutMs}`,
    );
  }
  return timeoutMs;
}

function validateLimit(value: number | undefined): number {
  const limit = value ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > fabricApiSurfaceLimits.maxResultLimit) {
    throw new Error(
      `Fabric API surface limit must be between 1 and ${fabricApiSurfaceLimits.maxResultLimit}`,
    );
  }
  return limit;
}

function normalizeOptionalSearchText(value: string | undefined, field: string): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 512 || hasUnsupportedControl(normalized)) {
    throw new Error(`Fabric API surface ${field} must contain 1 to 512 supported characters`);
  }
  return normalized;
}

function isCoveredPackage(packageName: string): boolean {
  return fabricApiRenderingPackagePrefixes.some(
    (prefix) => packageName === prefix || packageName.startsWith(`${prefix}.`),
  );
}

function validatePackagePrefix(value: string | undefined): string | null {
  const packagePrefix = normalizeOptionalSearchText(value, "packagePrefix");
  if (
    packagePrefix !== null &&
    !fabricApiRenderingPackagePrefixes.some(
      (root) => packagePrefix === root || packagePrefix.startsWith(`${root}.`),
    )
  ) {
    throw new Error(
      `Fabric API surface packagePrefix must be one of ${fabricApiRenderingPackagePrefixes.join(
        ", ",
      )} or a subpackage`,
    );
  }
  return packagePrefix;
}

function appendXmlText(stack: XmlNode[], text: string, label: string): void {
  if (!text) return;
  const current = stack.at(-1);
  if (!current) {
    if (text.trim()) throw new Error(`${label} has text outside the root element`);
    return;
  }
  if (text.includes("&") || hasUnsupportedControl(text)) {
    throw new Error(`${label} contains unsupported XML text encoding`);
  }
  current.text += text;
}

function parseBoundedXml(xml: string, label: string): XmlNode {
  let body = xml.startsWith("\uFEFF") ? xml.slice(1) : xml;
  body = body.replace(
    /^\s*<\?xml\s+version=(?:"1\.0"|'1\.0')\s+encoding=(?:"UTF-8"|'UTF-8')\s*\?>\s*/i,
    "",
  );
  if (/<!|<\?/.test(body)) {
    throw new Error(`${label} contains a forbidden declaration or processing instruction`);
  }

  const stack: XmlNode[] = [];
  let root: XmlNode | undefined;
  let cursor = 0;
  let elementCount = 0;
  for (const match of body.matchAll(/<[^>]*>/g)) {
    const index = match.index;
    const tag = match[0];
    appendXmlText(stack, body.slice(cursor, index), label);
    cursor = index + tag.length;
    if (tag.length > 2_048) throw new Error(`${label} contains an oversized XML tag`);

    const closing = /^<\/([A-Za-z_][A-Za-z0-9_.:-]*)\s*>$/.exec(tag);
    if (closing) {
      const node = stack.pop();
      if (!node || node.name !== closing[1]) {
        throw new Error(`${label} has a mismatched closing tag ${tag.slice(0, 64)}`);
      }
      if (node.children.length > 0 && node.text.trim()) {
        throw new Error(`${label} <${node.name}> mixes text and child elements`);
      }
      continue;
    }

    const opening =
      /^<([A-Za-z_][A-Za-z0-9_.-]*)(?:\s+[A-Za-z_][A-Za-z0-9_.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*(\/?)>$/.exec(
        tag,
      );
    if (!opening) {
      throw new Error(`${label} contains unsupported XML syntax ${tag.slice(0, 64)}`);
    }
    const name = opening[1];
    if (!name) throw new Error(`${label} contains an empty XML element name`);
    elementCount += 1;
    if (elementCount > 25_000) throw new Error(`${label} exceeds the XML element limit`);
    if (stack.length + 1 > 16) throw new Error(`${label} exceeds the XML depth limit`);
    const node: XmlNode = { name, text: "", children: [] };
    const parent = stack.at(-1);
    if (parent) parent.children.push(node);
    else if (root) throw new Error(`${label} contains multiple root elements`);
    else root = node;
    if (opening[2] !== "/") stack.push(node);
  }
  appendXmlText(stack, body.slice(cursor), label);
  if (stack.length !== 0) {
    throw new Error(`${label} has an unclosed <${stack.at(-1)?.name}> element`);
  }
  if (!root) throw new Error(`${label} has no root element`);
  return root;
}

function childrenNamed(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((child) => child.name === name);
}

function exactlyOneChild(node: XmlNode, name: string, label: string): XmlNode {
  const matches = childrenNamed(node, name);
  if (matches.length !== 1 || !matches[0]) {
    throw new Error(`${label} <${node.name}> must contain exactly one <${name}>`);
  }
  return matches[0];
}

function optionalLeaf(node: XmlNode, name: string, label: string): string | null {
  const matches = childrenNamed(node, name);
  if (matches.length > 1) throw new Error(`${label} contains duplicate <${name}> elements`);
  const child = matches[0];
  if (!child) return null;
  if (child.children.length > 0 || !child.text || child.text.trim() !== child.text) {
    throw new Error(`${label} <${name}> must contain one trimmed text value`);
  }
  return child.text;
}

function requiredLeaf(node: XmlNode, name: string, label: string): string {
  const value = optionalLeaf(node, name, label);
  if (value === null) throw new Error(`${label} must contain exactly one <${name}>`);
  return value;
}

function validateMavenToken(value: string, field: string, maxLength = 256): string {
  if (
    value.length < 1 ||
    value.length > maxLength ||
    !/^[0-9A-Za-z][0-9A-Za-z._+-]*$/.test(value)
  ) {
    throw new Error(`${field} must be a Maven token up to ${maxLength} characters`);
  }
  return value;
}

function numericVersionParts(
  version: string,
  gameVersion: string,
): readonly [number, number, number] {
  const suffix = `+${gameVersion}`;
  const core = version.slice(0, -suffix.length);
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(core);
  if (!match) {
    throw new Error(
      `Fabric API Maven metadata version ${version} has the exact ${suffix} suffix but not a supported semantic version core`,
    );
  }
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  if (parts.some((part) => !Number.isSafeInteger(part))) {
    throw new Error(`Fabric API Maven metadata version ${version} exceeds numeric limits`);
  }
  return parts;
}

function compareFabricApiVersions(left: string, right: string, gameVersion: string): number {
  const leftParts = numericVersionParts(left, gameVersion);
  const rightParts = numericVersionParts(right, gameVersion);
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left.localeCompare(right);
}

function parseMavenMetadata(
  xml: string,
  gameVersion: string,
): {
  selected: string;
  candidates: string[];
  reportedLatest: string | null;
  reportedRelease: string | null;
} {
  const label = "Fabric API Maven metadata";
  const root = parseBoundedXml(xml, label);
  if (root.name !== "metadata") throw new Error(`${label} root must be <metadata>`);
  const groupId = requiredLeaf(root, "groupId", label);
  const artifactId = requiredLeaf(root, "artifactId", label);
  if (groupId !== "net.fabricmc.fabric-api" || artifactId !== "fabric-api") {
    throw new Error(`${label} identified unexpected artifact ${groupId}:${artifactId}`);
  }
  const versioning = exactlyOneChild(root, "versioning", label);
  const versionsNode = exactlyOneChild(versioning, "versions", label);
  const versionNodes = childrenNamed(versionsNode, "version");
  if (versionNodes.length < 1 || versionNodes.length > fabricApiSurfaceLimits.maxMavenVersions) {
    throw new Error(
      `${label} must list between 1 and ${fabricApiSurfaceLimits.maxMavenVersions} versions`,
    );
  }
  const versions = versionNodes.map((node, index) => {
    if (node.children.length > 0 || !node.text || node.text.trim() !== node.text) {
      throw new Error(`${label} versions[${index}] must contain one trimmed text value`);
    }
    return validateMavenToken(node.text, `${label} versions[${index}]`);
  });
  if (new Set(versions).size !== versions.length) {
    throw new Error(`${label} contains duplicate version entries`);
  }

  const exactSuffix = `+${gameVersion}`;
  const candidates = versions.filter((version) => version.endsWith(exactSuffix));
  for (const candidate of candidates) numericVersionParts(candidate, gameVersion);
  candidates.sort((left, right) => compareFabricApiVersions(left, right, gameVersion));
  if (!candidates[0]) {
    throw new Error(
      `Fabric API Maven metadata has no version with exact Minecraft suffix ${exactSuffix}`,
    );
  }
  const latestValue = optionalLeaf(versioning, "latest", label);
  const releaseValue = optionalLeaf(versioning, "release", label);
  return {
    selected: candidates[0],
    candidates,
    reportedLatest:
      latestValue === null ? null : validateMavenToken(latestValue, `${label} latest`),
    reportedRelease:
      releaseValue === null ? null : validateMavenToken(releaseValue, `${label} release`),
  };
}

function isRenderingModule(artifactId: string): boolean {
  return (
    artifactId === "fabric-model-loading-api-v1" || /^fabric-render(?:er|ing)-/.test(artifactId)
  );
}

function parseAggregatePom(xml: string, expectedVersion: string): FabricApiRenderingModule[] {
  const label = "Fabric API aggregate POM";
  const root = parseBoundedXml(xml, label);
  if (root.name !== "project") throw new Error(`${label} root must be <project>`);
  const groupId = requiredLeaf(root, "groupId", label);
  const artifactId = requiredLeaf(root, "artifactId", label);
  const version = requiredLeaf(root, "version", label);
  if (
    groupId !== "net.fabricmc.fabric-api" ||
    artifactId !== "fabric-api" ||
    version !== expectedVersion
  ) {
    throw new Error(
      `${label} identified unexpected artifact ${groupId}:${artifactId}:${version}; expected net.fabricmc.fabric-api:fabric-api:${expectedVersion}`,
    );
  }
  const dependencies = exactlyOneChild(root, "dependencies", label).children.filter(
    (child) => child.name === "dependency",
  );
  if (dependencies.length > fabricApiSurfaceLimits.maxPomDependencies) {
    throw new Error(`${label} exceeds the dependency limit`);
  }
  const seen = new Set<string>();
  const modules: FabricApiRenderingModule[] = [];
  for (const [index, dependency] of dependencies.entries()) {
    const dependencyLabel = `${label} dependency[${index}]`;
    const dependencyGroup = validateMavenToken(
      requiredLeaf(dependency, "groupId", dependencyLabel),
      `${dependencyLabel} groupId`,
    );
    const dependencyArtifact = validateMavenToken(
      requiredLeaf(dependency, "artifactId", dependencyLabel),
      `${dependencyLabel} artifactId`,
    );
    const dependencyVersion = validateMavenToken(
      requiredLeaf(dependency, "version", dependencyLabel),
      `${dependencyLabel} version`,
    );
    const coordinate = `${dependencyGroup}:${dependencyArtifact}:${dependencyVersion}`;
    if (seen.has(`${dependencyGroup}:${dependencyArtifact}`)) {
      throw new Error(
        `${label} contains duplicate dependency ${dependencyGroup}:${dependencyArtifact}`,
      );
    }
    seen.add(`${dependencyGroup}:${dependencyArtifact}`);
    if (dependencyGroup === "net.fabricmc.fabric-api" && isRenderingModule(dependencyArtifact)) {
      modules.push({
        groupId: "net.fabricmc.fabric-api",
        artifactId: dependencyArtifact,
        version: dependencyVersion,
        coordinate,
      });
    }
  }
  if (
    !modules.some((module) => module.artifactId === "fabric-rendering-v1") ||
    !modules.some((module) => module.artifactId === "fabric-renderer-api-v1")
  ) {
    throw new Error(
      `${label} does not identify both fabric-rendering-v1 and fabric-renderer-api-v1`,
    );
  }
  return modules.sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

async function rejectResponse(response: Response, message: string): Promise<never> {
  try {
    void response.body?.cancel().catch(() => {});
  } catch {
    // Cancellation is best-effort; a failing or hanging stream must not hide this error.
  }
  throw new Error(message);
}

async function fetchBoundedBytes(options: {
  url: string;
  label: string;
  maxBytes: number;
  accept: string;
  expectedContentType: RegExp;
  signal: AbortSignal;
  fetchImpl: FabricApiSurfaceFetch;
}): Promise<Buffer> {
  let response: Response;
  try {
    response = await options.fetchImpl(options.url, {
      headers: { Accept: options.accept, "User-Agent": fabricApiUserAgent },
      redirect: "error",
      signal: options.signal,
    });
  } catch (error) {
    throw new Error(
      `${options.label} request failed: ${boundedErrorDetail(
        error instanceof Error ? error.message : String(error),
      )}`,
    );
  }
  if (response.redirected || (response.status >= 300 && response.status <= 399)) {
    return rejectResponse(response, `${options.label} response redirected unexpectedly`);
  }
  if (!response.ok) {
    return rejectResponse(
      response,
      `${options.label} request failed: ${response.status} ${boundedErrorDetail(response.statusText)}`,
    );
  }
  const contentType = response.headers.get("content-type");
  if (contentType !== null && !options.expectedContentType.test(contentType)) {
    return rejectResponse(
      response,
      `${options.label} response has unsupported Content-Type ${boundedErrorDetail(contentType)}`,
    );
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return rejectResponse(response, `${options.label} response has invalid Content-Length`);
    }
    if (Number(contentLength) > options.maxBytes) {
      return rejectResponse(
        response,
        `${options.label} response exceeds the ${options.maxBytes} byte limit`,
      );
    }
  }
  if (!response.body) throw new Error(`${options.label} response body is empty`);

  const reader = response.body.getReader();
  const cancelReader = () => {
    try {
      void reader.cancel().catch(() => {});
    } catch {
      // Abort cleanup must not replace the request's own error.
    }
  };
  options.signal.addEventListener("abort", cancelReader, { once: true });
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    options.signal.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > options.maxBytes) {
        try {
          void reader.cancel().catch(() => {});
        } catch {
          // Cancellation is best-effort and must not replace the size error.
        }
        throw new Error(`${options.label} response exceeds the ${options.maxBytes} byte limit`);
      }
      chunks.push(value);
    }
    options.signal.throwIfAborted();
  } finally {
    options.signal.removeEventListener("abort", cancelReader);
    reader.releaseLock();
  }
  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    totalBytes,
  );
}

function decodeUtf8(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

function parseChecksum(bytes: Uint8Array): string {
  const value = decodeUtf8(bytes, "Fabric API fat Javadoc SHA-256").trim();
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error("Fabric API fat Javadoc SHA-256 must contain exactly 64 lowercase hex digits");
  }
  return value;
}

function validateIndexString(
  value: unknown,
  field: string,
  options: { required?: boolean; maxLength?: number } = {},
): string | undefined {
  if (value === undefined && !options.required) return undefined;
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > (options.maxLength ?? 2_048) ||
    hasUnsupportedControl(value)
  ) {
    throw new Error(`${field} must be a bounded non-empty string`);
  }
  return value;
}

function extractSearchIndex(js: string, variableName: string): SearchIndexEntry[] {
  if (Buffer.byteLength(js, "utf8") > fabricApiSurfaceLimits.maxSearchIndexBytes) {
    throw new Error(
      `${variableName} exceeds the ${fabricApiSurfaceLimits.maxSearchIndexBytes} byte limit`,
    );
  }
  const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `^\\s*${escapedName}\\s*=\\s*(\\[[\\s\\S]*\\]);\\s*updateSearchResults\\(\\);\\s*$`,
  ).exec(js.startsWith("\uFEFF") ? js.slice(1) : js);
  if (!match?.[1]) throw new Error(`Could not find canonical ${variableName} assignment`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    throw new Error(`${variableName} assignment is not valid JSON`);
  }
  if (!Array.isArray(parsed)) throw new Error(`${variableName} is not an array`);
  if (parsed.length > fabricApiSurfaceLimits.maxSearchIndexEntries) {
    throw new Error(`${variableName} exceeds the search-index entry limit`);
  }
  return parsed.map((value, index) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`${variableName}[${index}] must be an object`);
    }
    const record = value as Record<string, unknown>;
    const unknownKeys = Object.keys(record).filter(
      (key) => key !== "p" && key !== "c" && key !== "l" && key !== "u" && key !== "k",
    );
    if (unknownKeys.length > 0) {
      throw new Error(`${variableName}[${index}] contains unsupported keys`);
    }
    const kind = validateIndexString(record.k, `${variableName}[${index}].k`, { maxLength: 8 });
    if (kind !== undefined && !/^\d+$/.test(kind)) {
      throw new Error(`${variableName}[${index}].k must be a decimal Javadoc category`);
    }
    return {
      ...(validateIndexString(record.p, `${variableName}[${index}].p`) !== undefined
        ? { p: record.p as string }
        : {}),
      ...(validateIndexString(record.c, `${variableName}[${index}].c`) !== undefined
        ? { c: record.c as string }
        : {}),
      l: validateIndexString(record.l, `${variableName}[${index}].l`, { required: true }) ?? "",
      ...(validateIndexString(record.u, `${variableName}[${index}].u`) !== undefined
        ? { u: record.u as string }
        : {}),
      ...(kind !== undefined ? { k: kind } : {}),
    };
  });
}

function packageToPath(packageName: string): string {
  return packageName.split(".").map(encodeURIComponent).join("/");
}

function typeJavadocPath(packageName: string, typeName: string): string {
  return `${packageToPath(packageName)}/${typeName.split(".").map(encodeURIComponent).join(".")}.html`;
}

function validateJavaDottedName(value: string, field: string): void {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(value)) {
    throw new Error(`${field} must be a supported dotted Java identifier`);
  }
}

function decodeJavadocSignature(value: string, field: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new Error(`${field} contains malformed percent encoding`);
  }
  if (
    !decoded ||
    decoded.length > 4_096 ||
    hasUnsupportedControl(decoded) ||
    /[/#\\:]/.test(decoded)
  ) {
    throw new Error(`${field} decodes to an unsupported Javadoc signature`);
  }
  return decoded;
}

function classifyMember(
  typeName: string,
  name: string,
  label: string,
  signature: string,
): FabricApiMemberKind {
  if (!label.includes("(")) return "field-or-enum-constant";
  const simpleTypeName = typeName.split(".").at(-1) ?? typeName;
  if (
    signature.startsWith("<init>(") ||
    name === typeName ||
    name === simpleTypeName ||
    label.startsWith(`${typeName}(`) ||
    label.startsWith(`${simpleTypeName}(`)
  ) {
    return "constructor";
  }
  return "method";
}

function parseSurfaceArchive(archiveBytes: Buffer): {
  types: FabricApiRenderingType[];
  members: FabricApiRenderingMember[];
} {
  let archive: ZipArchive;
  try {
    archive = openZipArchive(archiveBytes);
  } catch (error) {
    throw new Error(
      `Fabric API fat Javadoc is not a supported ZIP archive: ${boundedErrorDetail(
        error instanceof Error ? error.message : String(error),
      )}`,
    );
  }
  if (archive.entries.length > fabricApiSurfaceLimits.maxArchiveEntries) {
    throw new Error("Fabric API fat Javadoc exceeds the archive entry limit");
  }
  const uncompressedBytes = archive.entries.reduce(
    (total, entry) => total + entry.uncompressedSize,
    0,
  );
  if (
    !Number.isSafeInteger(uncompressedBytes) ||
    uncompressedBytes > fabricApiSurfaceLimits.maxArchiveUncompressedBytes
  ) {
    throw new Error("Fabric API fat Javadoc exceeds the declared uncompressed-byte limit");
  }

  let indexEntries: Map<string, Buffer>;
  for (const indexName of ["type-search-index.js", "member-search-index.js"]) {
    const entry = archive.entries.find((candidate) => candidate.name === indexName);
    if (
      !entry ||
      entry.directory ||
      entry.uncompressedSize > fabricApiSurfaceLimits.maxSearchIndexBytes
    ) {
      throw new Error(
        `Fabric API fat Javadoc ${indexName} is absent or exceeds the search-index byte limit`,
      );
    }
  }
  try {
    indexEntries = archive.readEntries(["type-search-index.js", "member-search-index.js"]);
  } catch (error) {
    throw new Error(
      `Fabric API fat Javadoc is missing a valid search index: ${boundedErrorDetail(
        error instanceof Error ? error.message : String(error),
      )}`,
    );
  }
  const typeIndexBytes = indexEntries.get("type-search-index.js");
  const memberIndexBytes = indexEntries.get("member-search-index.js");
  if (!typeIndexBytes || !memberIndexBytes) {
    throw new Error("Fabric API fat Javadoc is missing required search indexes");
  }
  const typeEntries = extractSearchIndex(
    decodeUtf8(typeIndexBytes, "Fabric API type-search-index.js"),
    "typeSearchIndex",
  );
  const memberEntries = extractSearchIndex(
    decodeUtf8(memberIndexBytes, "Fabric API member-search-index.js"),
    "memberSearchIndex",
  );

  const types = typeEntries
    .filter((entry) => entry.p !== undefined && isCoveredPackage(entry.p))
    .map((entry) => {
      const packageName = entry.p ?? "";
      validateJavaDottedName(packageName, "typeSearchIndex package");
      validateJavaDottedName(entry.l, "typeSearchIndex label");
      if (entry.u !== undefined) {
        throw new Error(
          "Fabric API covered type search entries must not override their Javadoc path",
        );
      }
      const qualifiedName = `${packageName}.${entry.l}`;
      return {
        packageName,
        name: entry.l,
        qualifiedName,
        javadocPath: typeJavadocPath(packageName, entry.l),
      };
    })
    .sort((left, right) => left.qualifiedName.localeCompare(right.qualifiedName));
  const typeNames = new Set<string>();
  for (const entry of types) {
    if (typeNames.has(entry.qualifiedName)) {
      throw new Error(`Fabric API type search index contains duplicate ${entry.qualifiedName}`);
    }
    typeNames.add(entry.qualifiedName);
  }

  const members = memberEntries
    .filter((entry) => entry.p !== undefined && isCoveredPackage(entry.p))
    .map((entry, index) => {
      if (!entry.c)
        throw new Error(`memberSearchIndex[${index}].c is required in covered packages`);
      const packageName = entry.p ?? "";
      validateJavaDottedName(packageName, "memberSearchIndex package");
      validateJavaDottedName(entry.c, "memberSearchIndex type");
      const label = entry.l;
      const name = label.split("(")[0]?.trim() ?? label;
      const rawSignature = entry.u ?? label;
      const signature = decodeJavadocSignature(rawSignature, `memberSearchIndex[${index}].u`);
      return {
        packageName,
        typeName: entry.c,
        qualifiedTypeName: `${packageName}.${entry.c}`,
        name,
        label,
        signature,
        signatureSource:
          entry.u === undefined ? ("display-label" as const) : ("url-fragment" as const),
        kind: classifyMember(entry.c, name, label, signature),
        javadocPath: typeJavadocPath(packageName, entry.c),
        javadocFragment: rawSignature,
      };
    })
    .sort((left, right) =>
      `${left.qualifiedTypeName}#${left.signature}`.localeCompare(
        `${right.qualifiedTypeName}#${right.signature}`,
      ),
    );
  const memberNames = new Set<string>();
  for (const entry of members) {
    if (!typeNames.has(entry.qualifiedTypeName)) {
      throw new Error(
        `Fabric API member search index names an unindexed type ${entry.qualifiedTypeName}`,
      );
    }
    const key = `${entry.qualifiedTypeName}#${entry.signature}`;
    if (memberNames.has(key)) {
      throw new Error(`Fabric API member search index contains duplicate ${key}`);
    }
    memberNames.add(key);
  }
  if (types.length === 0 || members.length === 0) {
    throw new Error("Fabric API fat Javadoc has no covered rendering types or members");
  }
  return { types, members };
}

function artifactUrls(version: string): {
  pom: string;
  fatJavadoc: string;
  fatJavadocSha256: string;
} {
  const encodedVersion = encodeURIComponent(version);
  const base = `${fabricApiRepositoryUrl}${fabricApiArtifactPath}/${encodedVersion}/`;
  const artifactName = `fabric-api-${version}`;
  const pom = `${base}${encodeURIComponent(artifactName)}.pom`;
  const fatJavadoc = `${base}${encodeURIComponent(`${artifactName}-fatjavadoc.jar`)}`;
  return { pom, fatJavadoc, fatJavadocSha256: `${fatJavadoc}.sha256` };
}

async function loadFabricApiRenderingSurface(
  gameVersionInput: string,
  timeoutMsInput: number | undefined,
  fetchImpl: FabricApiSurfaceFetch,
): Promise<FabricApiRenderingSurface> {
  const gameVersion = validateGameVersion(gameVersionInput);
  const timeoutMs = validateTimeout(timeoutMsInput);
  const controller = new AbortController();
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`Fabric API surface lookup timed out after ${timeoutMs} milliseconds`));
    }, timeoutMs);
  });
  try {
    const metadataBytes = await Promise.race([
      fetchBoundedBytes({
        url: fabricApiMetadataUrl,
        label: "Fabric API Maven metadata",
        maxBytes: fabricApiSurfaceLimits.maxMetadataBytes,
        accept: "application/xml,text/xml;q=0.9",
        expectedContentType: /^(?:application|text)\/xml(?:\s*;|$)/i,
        signal: controller.signal,
        fetchImpl,
      }),
      timeout,
    ]);
    const selection = parseMavenMetadata(
      decodeUtf8(metadataBytes, "Fabric API Maven metadata"),
      gameVersion,
    );
    const urls = artifactUrls(selection.selected);
    const [pomBytes, checksumBytes, archiveBytes] = await Promise.race([
      Promise.all([
        fetchBoundedBytes({
          url: urls.pom,
          label: "Fabric API aggregate POM",
          maxBytes: fabricApiSurfaceLimits.maxPomBytes,
          accept: "application/xml,text/xml;q=0.9,application/octet-stream;q=0.8",
          expectedContentType:
            /^(?:(?:application|text)\/xml|application\/octet-stream)(?:\s*;|$)/i,
          signal: controller.signal,
          fetchImpl,
        }),
        fetchBoundedBytes({
          url: urls.fatJavadocSha256,
          label: "Fabric API fat Javadoc SHA-256",
          maxBytes: fabricApiSurfaceLimits.maxChecksumBytes,
          accept: "text/plain",
          expectedContentType: /^(?:text\/plain|application\/octet-stream)(?:\s*;|$)/i,
          signal: controller.signal,
          fetchImpl,
        }),
        fetchBoundedBytes({
          url: urls.fatJavadoc,
          label: "Fabric API fat Javadoc",
          maxBytes: fabricApiSurfaceLimits.maxArchiveBytes,
          accept: "application/java-archive,application/zip,application/octet-stream",
          expectedContentType:
            /^(?:application\/(?:java-archive|x-java-archive|zip|octet-stream)|binary\/octet-stream)(?:\s*;|$)/i,
          signal: controller.signal,
          fetchImpl,
        }),
      ]),
      timeout,
    ]);
    const checksum = parseChecksum(checksumBytes);
    const actualChecksum = createHash("sha256").update(archiveBytes).digest("hex");
    if (actualChecksum !== checksum) {
      throw new Error(
        `Fabric API fat Javadoc SHA-256 mismatch: expected ${checksum}, got ${actualChecksum}`,
      );
    }
    const renderingModules = parseAggregatePom(
      decodeUtf8(pomBytes, "Fabric API aggregate POM"),
      selection.selected,
    );
    const parsedSurface = parseSurfaceArchive(archiveBytes);
    const candidates = selection.candidates.slice(0, 50);
    const checkedAt = new Date().toISOString();
    return {
      gameVersion,
      fabricApiVersion: selection.selected,
      artifact: {
        groupId: "net.fabricmc.fabric-api",
        artifactId: "fabric-api",
        version: selection.selected,
        coordinate: `net.fabricmc.fabric-api:fabric-api:${selection.selected}`,
        classifier: "fatjavadoc",
        extension: "jar",
      },
      versionSelection: {
        strategy: "highest-semver-with-exact-game-version-suffix",
        exactSuffix: `+${gameVersion}`,
        reportedLatest: selection.reportedLatest,
        reportedRelease: selection.reportedRelease,
        matchingCandidateCount: selection.candidates.length,
        candidates,
        candidatesTruncated: selection.candidates.length > candidates.length,
        reportedLatestUsed: false,
        reportedReleaseUsed: false,
      },
      renderingModules,
      source: {
        kind: "official-live",
        repositoryUrl: fabricApiRepositoryUrl,
        metadataUrl: fabricApiMetadataUrl,
        aggregatePomUrl: urls.pom,
        fatJavadocUrl: urls.fatJavadoc,
        fatJavadocSha256Url: urls.fatJavadocSha256,
        fatJavadocSha256: checksum,
        checkedAt,
      },
      coverage: {
        kind: "official-fatjavadoc-search-index",
        packagePrefixes: [...fabricApiRenderingPackagePrefixes],
        typeCount: parsedSurface.types.length,
        memberCount: parsedSurface.members.length,
        guarantees: [
          "Names, declaring types, display labels, and Javadoc URL signatures are present in the verified official Fabric API fat Javadoc search indexes for the selected artifact.",
          "The aggregate POM coordinates and fat Javadoc SHA-256 were fetched from the official Fabric Maven repository.",
        ],
        nonGuarantees: [
          "Search-index presence does not establish runtime behavior, binary compatibility, Java visibility, deprecation status, thread safety, or complete documentation prose.",
          "Rendering module coordinates are selected from aggregate POM dependency names; this surface does not attribute each symbol to one module.",
          "Members are declared search-index entries only; inherited members, return types, generic bounds, and parameter names are not extracted. signature preserves the decoded Javadoc URL fragment when present and otherwise its display label.",
          "Only the listed Fabric API package prefixes are indexed; Mojang client classes and mappings are outside this surface.",
        ],
      },
      ...parsedSurface,
    };
  } catch (error) {
    controller.abort();
    if (timedOut) {
      throw new Error(`Fabric API surface lookup timed out after ${timeoutMs} milliseconds`);
    }
    if (error instanceof Error && error.message.startsWith("Fabric API")) throw error;
    throw new Error(
      `Fabric API surface lookup failed: ${boundedErrorDetail(
        error instanceof Error ? error.message : String(error),
      )}`,
    );
  } finally {
    controller.abort();
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

function searchContext(surface: FabricApiRenderingSurface): FabricApiSearchContext {
  const { types: _types, members: _members, ...context } = surface;
  return context;
}

function packageMatches(packageName: string, prefix: string | null): boolean {
  return prefix === null || packageName === prefix || packageName.startsWith(`${prefix}.`);
}

export async function searchFabricApiTypes(
  options: FabricApiTypeSearchOptions,
  fetchImpl: FabricApiSurfaceFetch = fetch,
): Promise<FabricApiTypeSearchResult> {
  const limit = validateLimit(options.limit);
  const query = normalizeOptionalSearchText(options.query, "query");
  const packagePrefix = validatePackagePrefix(options.packagePrefix);
  const surface = await loadFabricApiRenderingSurface(
    options.gameVersion,
    options.timeoutMs,
    fetchImpl,
  );
  const needle = query?.toLowerCase() ?? null;
  const matches = surface.types.filter(
    (entry) =>
      packageMatches(entry.packageName, packagePrefix) &&
      (needle === null ||
        entry.name.toLowerCase().includes(needle) ||
        entry.qualifiedName.toLowerCase().includes(needle)),
  );
  return {
    schemaVersion: 1,
    ...searchContext(surface),
    search: {
      query,
      packagePrefix,
      totalMatches: matches.length,
      returned: Math.min(matches.length, limit),
      truncated: matches.length > limit,
      limit,
    },
    types: matches.slice(0, limit).map((entry) => ({ ...entry })),
  };
}

export async function searchFabricApiMembers(
  options: FabricApiMemberSearchOptions,
  fetchImpl: FabricApiSurfaceFetch = fetch,
): Promise<FabricApiMemberSearchResult> {
  const limit = validateLimit(options.limit);
  const query = normalizeOptionalSearchText(options.query, "query");
  const type = normalizeOptionalSearchText(options.type, "type");
  const packagePrefix = validatePackagePrefix(options.packagePrefix);
  if (
    options.kind !== undefined &&
    options.kind !== "constructor" &&
    options.kind !== "method" &&
    options.kind !== "field-or-enum-constant" &&
    options.kind !== "unknown"
  ) {
    throw new Error("Fabric API surface kind is unsupported");
  }
  const surface = await loadFabricApiRenderingSurface(
    options.gameVersion,
    options.timeoutMs,
    fetchImpl,
  );
  const needle = query?.toLowerCase() ?? null;
  const matches = surface.members.filter(
    (entry) =>
      packageMatches(entry.packageName, packagePrefix) &&
      (type === null || entry.typeName === type || entry.qualifiedTypeName === type) &&
      (options.kind === undefined || entry.kind === options.kind) &&
      (needle === null ||
        entry.name.toLowerCase().includes(needle) ||
        entry.label.toLowerCase().includes(needle) ||
        entry.signature.toLowerCase().includes(needle) ||
        entry.qualifiedTypeName.toLowerCase().includes(needle)),
  );
  return {
    schemaVersion: 1,
    ...searchContext(surface),
    search: {
      query,
      type,
      kind: options.kind ?? null,
      packagePrefix,
      totalMatches: matches.length,
      returned: Math.min(matches.length, limit),
      truncated: matches.length > limit,
      limit,
    },
    members: matches.slice(0, limit).map((entry) => ({ ...entry })),
  };
}
