const velocityRepositoryUrl = "https://repo.papermc.io/repository/maven-public/";
const velocityApiMetadataUrl = `${velocityRepositoryUrl}com/velocitypowered/velocity-api/maven-metadata.xml`;
const velocityDevelopmentDocsUrl =
  "https://docs.papermc.io/velocity/dev/creating-your-first-plugin/";
const velocityFaqUrl = "https://docs.papermc.io/velocity/faq/";
const velocityJavadocsUrl = "https://jd.papermc.io/velocity/";
const velocityMetaUserAgent = "sya-ri/minecraft-skills/0.1.7 (github.com/sya-ri/minecraft-skills)";
const maxMetadataBytes = 128 * 1024;
const maxDocumentationBytes = 512 * 1024;
const maxExtractedDocumentationCharacters = 256 * 1024;
const maxHtmlTagCharacters = 8192;
const maxXmlElements = 1024;
const maxXmlDepth = 4;
const maxMavenVersions = 512;
const maxVersionLength = 128;

export type VelocityMetaFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type VelocityToolchainResolutionOptions = {
  limit?: number;
  timeoutMs?: number;
};

export type VelocityToolchainSourceStatus = "retrieved" | "unavailable" | "malformed";

export type VelocityToolchainResolutionResult = {
  schemaVersion: 1;
  retrievedAt: string;
  api: {
    groupId: "com.velocitypowered";
    artifactId: "velocity-api";
    version: string;
    coordinate: string;
    releaseVersion: string | null;
    repositoryUrl: string;
    metadataUrl: string;
    metadataLastUpdated: string;
    candidates: string[];
    candidateCount: number;
    candidatesTruncated: boolean;
    candidateOrdering: "latest-then-release-then-reverse-metadata-order";
  };
  documentation: {
    developmentGuideUrl: string;
    javadocsUrl: string;
    javaRequirementUrl: string;
    recommendedApiVersion: string | null;
    repositoryConfirmed: boolean;
  };
  javaRequirement: {
    minimumVersion: number;
    appliesTo: string;
    sourceUrl: string;
    corroboratedByDevelopmentGuide: boolean;
  } | null;
  compatibility: {
    minecraftGameVersions: "not-inferred";
    explanation: string;
  };
  provenance: {
    kind: "official-live";
    sources: Array<{
      purpose: "api-metadata" | "development-guide" | "java-requirement";
      url: string;
      status: VelocityToolchainSourceStatus;
      checkedAt: string;
      retrievedAt?: string;
      detail?: string;
    }>;
  };
  warnings: string[];
};

type XmlNode = {
  name: string;
  text: string;
  children: XmlNode[];
};

type MavenMetadata = {
  latest: string;
  release: string | null;
  versions: string[];
  lastUpdated: string;
};

type OptionalDocument =
  | { status: "retrieved"; text: string }
  | { status: "unavailable"; detail: string };

type DevelopmentEvidence = {
  status: VelocityToolchainSourceStatus;
  recommendedApiVersion: string | null;
  repositoryConfirmed: boolean;
  minimumProjectJava: number | null;
  detail?: string;
};

type JavaRequirementEvidence = {
  status: VelocityToolchainSourceStatus;
  minimumVelocityMajor: number | null;
  minimumJava: number | null;
  appliesTo: string | null;
  detail?: string;
};

function hasAsciiControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      (codePoint < 32 && character !== "\t" && character !== "\n" && character !== "\r") ||
      codePoint === 127
    );
  });
}

function boundedErrorDetail(value: string): string {
  const sanitized = [...value]
    .map((character) => {
      return /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(character) ? " " : character;
    })
    .join("")
    .trim();
  return [...sanitized].slice(0, 256).join("") || "Unknown error";
}

function validateLimit(value: number | undefined): number {
  const limit = value ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("Velocity toolchain limit must be between 1 and 50");
  }
  return limit;
}

function validateTimeout(value: number | undefined): number {
  const timeoutMs = value ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error("Velocity toolchain timeout must be between 100 and 30000 milliseconds");
  }
  return timeoutMs;
}

function validateVersion(value: string, field: string): string {
  if (
    value.length === 0 ||
    value.length > maxVersionLength ||
    !/^[0-9A-Za-z][0-9A-Za-z._+-]*$/.test(value)
  ) {
    throw new Error(
      `Velocity Maven metadata field ${field} must be a version token up to ${maxVersionLength} characters`,
    );
  }
  return value;
}

function appendXmlText(stack: XmlNode[], text: string): void {
  if (!text) {
    return;
  }
  const current = stack.at(-1);
  if (!current) {
    if (text.trim()) {
      throw new Error("Velocity Maven metadata has text outside the root element");
    }
    return;
  }
  if (text.includes("&") || hasAsciiControlCharacter(text)) {
    throw new Error("Velocity Maven metadata contains unsupported text encoding");
  }
  current.text += text;
}

function validateXmlStructure(node: XmlNode, parent: string | null): void {
  const allowedChildren: Record<string, readonly string[]> = {
    metadata: ["groupId", "artifactId", "versioning"],
    versioning: ["latest", "release", "versions", "lastUpdated"],
    versions: ["version"],
  };
  const allowed = parent === null ? ["metadata"] : allowedChildren[parent];
  if (!allowed?.includes(node.name)) {
    throw new Error(
      `Velocity Maven metadata element <${node.name}> is not allowed under ${parent ?? "the document"}`,
    );
  }
  if (node.children.length > 0 && node.text.trim()) {
    throw new Error(`Velocity Maven metadata element <${node.name}> mixes text and child elements`);
  }
  for (const child of node.children) {
    validateXmlStructure(child, node.name);
  }
}

function parseBoundedXml(xml: string): XmlNode {
  let body = xml.startsWith("\uFEFF") ? xml.slice(1) : xml;
  body = body.replace(
    /^\s*<\?xml\s+version=(?:"1\.0"|'1\.0')\s+encoding=(?:"UTF-8"|'UTF-8')\s*\?>\s*/i,
    "",
  );
  if (/<!|<\?/.test(body)) {
    throw new Error(
      "Velocity Maven metadata contains a forbidden declaration or processing instruction",
    );
  }

  const stack: XmlNode[] = [];
  let root: XmlNode | undefined;
  let cursor = 0;
  let elementCount = 0;
  for (const match of body.matchAll(/<[^>]*>/g)) {
    const index = match.index;
    const tag = match[0];
    appendXmlText(stack, body.slice(cursor, index));
    cursor = index + tag.length;
    if (tag.length > 256) {
      throw new Error("Velocity Maven metadata contains an oversized XML tag");
    }

    const closing = /^<\/([A-Za-z][A-Za-z0-9-]*)>$/.exec(tag);
    if (closing) {
      const node = stack.pop();
      if (!node || node.name !== closing[1]) {
        throw new Error(`Velocity Maven metadata has a mismatched closing tag ${tag}`);
      }
      continue;
    }

    const opening = /^<([A-Za-z][A-Za-z0-9-]*)>$/.exec(tag);
    if (!opening) {
      throw new Error(
        `Velocity Maven metadata contains unsupported XML syntax ${tag.slice(0, 64)}`,
      );
    }
    const name = opening[1];
    if (!name) {
      throw new Error("Velocity Maven metadata contains an empty XML element name");
    }
    elementCount += 1;
    if (elementCount > maxXmlElements) {
      throw new Error(`Velocity Maven metadata exceeds the ${maxXmlElements} element limit`);
    }
    if (stack.length + 1 > maxXmlDepth) {
      throw new Error(`Velocity Maven metadata exceeds the XML depth limit of ${maxXmlDepth}`);
    }
    const node: XmlNode = { name, text: "", children: [] };
    const parent = stack.at(-1);
    if (parent) {
      parent.children.push(node);
    } else if (root) {
      throw new Error("Velocity Maven metadata contains multiple root elements");
    } else {
      root = node;
    }
    stack.push(node);
  }
  appendXmlText(stack, body.slice(cursor));
  if (stack.length !== 0) {
    throw new Error(`Velocity Maven metadata has an unclosed <${stack.at(-1)?.name}> element`);
  }
  if (!root) {
    throw new Error("Velocity Maven metadata has no root element");
  }
  validateXmlStructure(root, null);
  return root;
}

function childrenNamed(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((child) => child.name === name);
}

function requiredChild(node: XmlNode, name: string): XmlNode {
  const children = childrenNamed(node, name);
  if (children.length !== 1 || !children[0]) {
    throw new Error(
      `Velocity Maven metadata element <${node.name}> must contain exactly one <${name}>`,
    );
  }
  return children[0];
}

function optionalLeaf(node: XmlNode, name: string): string | null {
  const children = childrenNamed(node, name);
  if (children.length > 1) {
    throw new Error(
      `Velocity Maven metadata element <${node.name}> contains duplicate <${name}> elements`,
    );
  }
  const child = children[0];
  if (!child) {
    return null;
  }
  if (child.children.length > 0 || child.text.trim() !== child.text || !child.text) {
    throw new Error(`Velocity Maven metadata element <${name}> must contain one text value`);
  }
  return child.text;
}

function requiredLeaf(node: XmlNode, name: string): string {
  const value = optionalLeaf(node, name);
  if (value === null) {
    throw new Error(
      `Velocity Maven metadata element <${node.name}> must contain exactly one <${name}>`,
    );
  }
  return value;
}

function parseMavenTimestamp(value: string): string {
  if (!/^\d{14}$/.test(value)) {
    throw new Error("Velocity Maven metadata lastUpdated must use yyyyMMddHHmmss UTC format");
  }
  const parts = [
    Number(value.slice(0, 4)),
    Number(value.slice(4, 6)),
    Number(value.slice(6, 8)),
    Number(value.slice(8, 10)),
    Number(value.slice(10, 12)),
    Number(value.slice(12, 14)),
  ] as const;
  const timestamp = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== parts[0] ||
    date.getUTCMonth() + 1 !== parts[1] ||
    date.getUTCDate() !== parts[2] ||
    date.getUTCHours() !== parts[3] ||
    date.getUTCMinutes() !== parts[4] ||
    date.getUTCSeconds() !== parts[5]
  ) {
    throw new Error("Velocity Maven metadata lastUpdated is not a valid UTC timestamp");
  }
  return date.toISOString();
}

function parseMavenMetadata(xml: string): MavenMetadata {
  const root = parseBoundedXml(xml);
  const groupId = requiredLeaf(root, "groupId");
  const artifactId = requiredLeaf(root, "artifactId");
  if (groupId !== "com.velocitypowered" || artifactId !== "velocity-api") {
    throw new Error(
      `Velocity Maven metadata identified unexpected artifact ${groupId}:${artifactId}`,
    );
  }
  const versioning = requiredChild(root, "versioning");
  const latest = validateVersion(requiredLeaf(versioning, "latest"), "latest");
  const releaseValue = optionalLeaf(versioning, "release");
  const release = releaseValue === null ? null : validateVersion(releaseValue, "release");
  if (release !== null && /-SNAPSHOT$/i.test(release)) {
    throw new Error("Velocity Maven metadata release version must not be a SNAPSHOT");
  }
  const versionsNode = requiredChild(versioning, "versions");
  const versionNodes = childrenNamed(versionsNode, "version");
  if (versionNodes.length === 0 || versionNodes.length > maxMavenVersions) {
    throw new Error(`Velocity Maven metadata must list between 1 and ${maxMavenVersions} versions`);
  }
  const versions = versionNodes.map((node, index) => {
    if (node.children.length > 0 || node.text.trim() !== node.text || !node.text) {
      throw new Error(`Velocity Maven metadata versions[${index}] must contain one text value`);
    }
    return validateVersion(node.text, `versions[${index}]`);
  });
  if (new Set(versions).size !== versions.length) {
    throw new Error("Velocity Maven metadata contains duplicate version entries");
  }
  if (!versions.includes(latest)) {
    throw new Error("Velocity Maven metadata latest version is absent from the versions list");
  }
  if (release !== null && !versions.includes(release)) {
    throw new Error("Velocity Maven metadata release version is absent from the versions list");
  }
  return {
    latest,
    release,
    versions,
    lastUpdated: parseMavenTimestamp(requiredLeaf(versioning, "lastUpdated")),
  };
}

async function readBoundedText(
  response: Response,
  label: string,
  maxBytes: number,
  expectedContentType: RegExp,
): Promise<string> {
  const contentType = response.headers.get("content-type");
  if (contentType !== null && !expectedContentType.test(contentType)) {
    return rejectResponse(
      response,
      `${label} response has unsupported Content-Type ${boundedErrorDetail(contentType)}`,
    );
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return rejectResponse(response, `${label} response has an invalid Content-Length header`);
    }
    if (Number(contentLength) > maxBytes) {
      return rejectResponse(response, `${label} response exceeds the ${maxBytes} byte limit`);
    }
  }
  if (!response.body) {
    throw new Error(`${label} response body is empty`);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // Preserve the bounded-read error even if stream cleanup itself fails.
      }
      throw new Error(`${label} response exceeds the ${maxBytes} byte limit`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} response is not valid UTF-8`);
  }
}

async function rejectResponse(response: Response, message: string): Promise<never> {
  try {
    await response.body?.cancel();
  } catch {
    // Preserve the response validation error even if stream cleanup itself fails.
  }
  throw new Error(message);
}

async function fetchOfficialText(
  url: string,
  label: string,
  maxBytes: number,
  accept: string,
  expectedContentType: RegExp,
  signal: AbortSignal,
  fetchImpl: VelocityMetaFetch,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: accept, "User-Agent": velocityMetaUserAgent },
      redirect: "error",
      signal,
    });
  } catch (error) {
    throw new Error(
      `${label} request failed: ${boundedErrorDetail(
        error instanceof Error ? error.message : String(error),
      )}`,
    );
  }
  if (!response.ok) {
    return rejectResponse(
      response,
      `${label} request failed: ${response.status} ${boundedErrorDetail(response.statusText)}`,
    );
  }
  return readBoundedText(response, label, maxBytes, expectedContentType);
}

async function optionalDocument(promise: Promise<string>, url: string): Promise<OptionalDocument> {
  try {
    return { status: "retrieved", text: await promise };
  } catch (error) {
    return {
      status: "unavailable",
      detail: `${boundedErrorDetail(
        error instanceof Error ? error.message : String(error),
      )}. Inspect ${url} manually or re-run the lookup.`,
    };
  }
}

type HtmlTag = {
  closing: boolean;
  end: number;
  name: string;
  selfClosing: boolean;
};

const excludedHtmlContentElements = new Set(["script", "style", "svg", "template"]);

function findHtmlTagEnd(html: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start + 1; index < html.length; index += 1) {
    if (index - start + 1 > maxHtmlTagCharacters) {
      throw new Error(
        `official documentation contains an HTML tag over ${maxHtmlTagCharacters} characters`,
      );
    }
    const character = html[index];
    if (quote !== null) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") {
      return index;
    }
  }
  throw new Error("official documentation ends inside an HTML tag");
}

function readHtmlTag(html: string, start: number): HtmlTag {
  const end = findHtmlTagEnd(html, start);
  const source = html.slice(start, end + 1);
  const match = /^<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:-]*)\b/.exec(source);
  if (!match?.[2]) {
    throw new Error("official documentation contains unsupported HTML tag syntax");
  }
  return {
    closing: match[1] === "/",
    end,
    name: match[2].toLowerCase(),
    selfClosing: /\/\s*>$/.test(source),
  };
}

function findExcludedHtmlContentEnd(html: string, start: number, name: string): number {
  const closingPrefix = `</${name}`;
  let searchFrom = start;
  while (searchFrom < html.length) {
    const closingStart = html.indexOf("<", searchFrom);
    if (closingStart === -1) {
      break;
    }
    const candidate = html.slice(closingStart, closingStart + closingPrefix.length).toLowerCase();
    const boundary = html[closingStart + closingPrefix.length];
    if (
      candidate === closingPrefix &&
      (boundary === ">" ||
        boundary === " " ||
        boundary === "\t" ||
        boundary === "\r" ||
        boundary === "\n")
    ) {
      const closingTag = readHtmlTag(html, closingStart);
      if (closingTag.closing && closingTag.name === name) {
        return closingTag.end;
      }
    }
    searchFrom = closingStart + 1;
  }
  throw new Error(`official documentation ends inside a <${name}> element`);
}

function extractDocumentText(html: string): string {
  const result: string[] = [];
  let resultLength = 0;
  const append = (text: string) => {
    resultLength += text.length;
    if (resultLength > maxExtractedDocumentationCharacters) {
      throw new Error(
        `official documentation text exceeds ${maxExtractedDocumentationCharacters} characters`,
      );
    }
    result.push(text);
  };

  let cursor = 0;
  while (cursor < html.length) {
    const tagStart = html.indexOf("<", cursor);
    if (tagStart === -1) {
      append(html.slice(cursor));
      break;
    }
    append(html.slice(cursor, tagStart));

    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4);
      if (commentEnd === -1) {
        throw new Error("official documentation ends inside an HTML comment");
      }
      append(" ");
      cursor = commentEnd + 3;
      continue;
    }
    if (html.startsWith("<!", tagStart)) {
      const declarationEnd = findHtmlTagEnd(html, tagStart);
      const declaration = html.slice(tagStart, declarationEnd + 1);
      if (!/^<!doctype\s+html\s*>$/i.test(declaration)) {
        throw new Error("official documentation contains an unsupported HTML declaration");
      }
      append(" ");
      cursor = declarationEnd + 1;
      continue;
    }
    if (html.startsWith("<?", tagStart)) {
      throw new Error("official documentation contains an unsupported processing instruction");
    }

    const tag = readHtmlTag(html, tagStart);
    append(" ");
    if (!tag.closing && excludedHtmlContentElements.has(tag.name)) {
      if (tag.selfClosing) {
        throw new Error(
          `official documentation contains a self-closing <${tag.name}> content element`,
        );
      }
      cursor = findExcludedHtmlContentEnd(html, tag.end + 1, tag.name) + 1;
      continue;
    }
    cursor = tag.end + 1;
  }

  return result
    .join("")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function unavailableDevelopmentEvidence(detail: string): DevelopmentEvidence {
  return {
    status: "unavailable",
    recommendedApiVersion: null,
    repositoryConfirmed: false,
    minimumProjectJava: null,
    detail,
  };
}

function parseDevelopmentEvidence(document: OptionalDocument): DevelopmentEvidence {
  if (document.status === "unavailable") {
    return unavailableDevelopmentEvidence(document.detail);
  }
  try {
    const text = extractDocumentText(document.text);
    const coordinateMatch =
      /\bcom\.velocitypowered\s+velocity-api\s+([0-9A-Za-z][0-9A-Za-z._+-]{0,127})\b/.exec(text);
    const javaMatch = /\bProject JDK\s+is Java\s+(\d{1,3})\s+or later\b/i.exec(text);
    if (!coordinateMatch?.[1]) {
      return {
        status: "malformed",
        recommendedApiVersion: null,
        repositoryConfirmed: text.includes(velocityRepositoryUrl),
        minimumProjectJava: javaMatch?.[1] ? Number(javaMatch[1]) : null,
        detail:
          "Official Velocity development documentation no longer contains the expected dependency table. Inspect the page before copying a coordinate.",
      };
    }
    return {
      status: "retrieved",
      recommendedApiVersion: validateVersion(
        coordinateMatch[1],
        "developmentGuide.recommendedApiVersion",
      ),
      repositoryConfirmed: text.includes(velocityRepositoryUrl),
      minimumProjectJava: javaMatch?.[1] ? Number(javaMatch[1]) : null,
    };
  } catch (error) {
    return {
      status: "malformed",
      recommendedApiVersion: null,
      repositoryConfirmed: false,
      minimumProjectJava: null,
      detail: `${boundedErrorDetail(
        error instanceof Error ? error.message : String(error),
      )}. Inspect the official development guide manually.`,
    };
  }
}

function unavailableJavaEvidence(detail: string): JavaRequirementEvidence {
  return {
    status: "unavailable",
    minimumVelocityMajor: null,
    minimumJava: null,
    appliesTo: null,
    detail,
  };
}

function parseJavaRequirementEvidence(document: OptionalDocument): JavaRequirementEvidence {
  if (document.status === "unavailable") {
    return unavailableJavaEvidence(document.detail);
  }
  try {
    const text = extractDocumentText(document.text);
    const match =
      /\bVelocity\s+(\d{1,3})\.0\.x\s+and above requires at least Java\s+(\d{1,3})\b/i.exec(text);
    if (!match?.[1] || !match[2]) {
      return {
        status: "malformed",
        minimumVelocityMajor: null,
        minimumJava: null,
        appliesTo: null,
        detail:
          "Official Velocity FAQ no longer contains the expected Java requirement statement. Verify the FAQ manually before selecting a JDK.",
      };
    }
    const minimumVelocityMajor = Number(match[1]);
    const minimumJava = Number(match[2]);
    if (
      !Number.isInteger(minimumVelocityMajor) ||
      minimumVelocityMajor < 1 ||
      minimumVelocityMajor > 100 ||
      !Number.isInteger(minimumJava) ||
      minimumJava < 1 ||
      minimumJava > 100
    ) {
      throw new Error("official Velocity FAQ contains an out-of-range Java requirement");
    }
    return {
      status: "retrieved",
      minimumVelocityMajor,
      minimumJava,
      appliesTo: `Velocity ${minimumVelocityMajor}.0.x and above`,
    };
  } catch (error) {
    return {
      status: "malformed",
      minimumVelocityMajor: null,
      minimumJava: null,
      appliesTo: null,
      detail: `${boundedErrorDetail(
        error instanceof Error ? error.message : String(error),
      )}. Inspect the official Velocity FAQ manually.`,
    };
  }
}

function prioritizedVersions(metadata: MavenMetadata): string[] {
  const candidates = [
    metadata.latest,
    ...(metadata.release === null ? [] : [metadata.release]),
    ...metadata.versions.toReversed(),
  ];
  return [...new Set(candidates)];
}

function versionMajor(version: string): number | null {
  const match = /^(\d{1,3})(?:\.|$)/.exec(version);
  return match?.[1] ? Number(match[1]) : null;
}

function sourceEntry(
  purpose: "api-metadata" | "development-guide" | "java-requirement",
  url: string,
  status: VelocityToolchainSourceStatus,
  retrievedAt: string,
  detail?: string,
): VelocityToolchainResolutionResult["provenance"]["sources"][number] {
  return {
    purpose,
    url,
    status,
    checkedAt: retrievedAt,
    ...(status === "retrieved" ? { retrievedAt } : {}),
    ...(detail ? { detail } : {}),
  };
}

export async function resolveVelocityToolchain(
  options: VelocityToolchainResolutionOptions = {},
  fetchImpl: VelocityMetaFetch = fetch,
  now: () => Date = () => new Date(),
): Promise<VelocityToolchainResolutionResult> {
  const limit = validateLimit(options.limit);
  const timeoutMs = validateTimeout(options.timeoutMs);
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new Error(`Velocity toolchain lookup timed out after ${timeoutMs} milliseconds`));
    }, timeoutMs);
  });
  const withinDeadline = <T>(promise: Promise<T>) => Promise.race([promise, deadline]);

  const metadataRequest = withinDeadline(
    fetchOfficialText(
      velocityApiMetadataUrl,
      "Velocity API metadata",
      maxMetadataBytes,
      "application/xml, text/xml;q=0.9",
      /\b(?:application|text)\/(?:[A-Za-z0-9.+-]*\+)?xml\b/i,
      controller.signal,
      fetchImpl,
    ),
  );
  const developmentRequest = optionalDocument(
    withinDeadline(
      fetchOfficialText(
        velocityDevelopmentDocsUrl,
        "Velocity development guide",
        maxDocumentationBytes,
        "text/html",
        /\btext\/html\b/i,
        controller.signal,
        fetchImpl,
      ),
    ),
    velocityDevelopmentDocsUrl,
  );
  const faqRequest = optionalDocument(
    withinDeadline(
      fetchOfficialText(
        velocityFaqUrl,
        "Velocity FAQ",
        maxDocumentationBytes,
        "text/html",
        /\btext\/html\b/i,
        controller.signal,
        fetchImpl,
      ),
    ),
    velocityFaqUrl,
  );

  let metadataXml: string;
  let developmentDocument: OptionalDocument;
  let faqDocument: OptionalDocument;
  try {
    [metadataXml, developmentDocument, faqDocument] = await Promise.all([
      metadataRequest,
      developmentRequest,
      faqRequest,
    ]);
  } catch (error) {
    controller.abort();
    throw new Error(
      `Velocity API metadata is unavailable: ${boundedErrorDetail(
        error instanceof Error ? error.message : String(error),
      )}. Re-run the lookup later or inspect ${velocityApiMetadataUrl} manually.`,
    );
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }

  let metadata: MavenMetadata;
  try {
    metadata = parseMavenMetadata(metadataXml);
  } catch (error) {
    throw new Error(
      `Velocity API metadata is malformed: ${boundedErrorDetail(
        error instanceof Error ? error.message : String(error),
      )}. Inspect ${velocityApiMetadataUrl} before selecting a dependency.`,
    );
  }
  const retrievedDate = now();
  if (!Number.isFinite(retrievedDate.getTime())) {
    throw new Error("Velocity toolchain retrieval clock returned an invalid date");
  }
  const retrievedAt = retrievedDate.toISOString();
  const development = parseDevelopmentEvidence(developmentDocument);
  const javaEvidence = parseJavaRequirementEvidence(faqDocument);
  const allCandidates = prioritizedVersions(metadata);
  const warnings: string[] = [];

  if (development.status !== "retrieved") {
    warnings.push(
      development.detail ??
        `Velocity development guide could not be validated. Inspect ${velocityDevelopmentDocsUrl}.`,
    );
  } else {
    if (!development.repositoryConfirmed) {
      warnings.push(
        `The official Velocity development guide did not confirm ${velocityRepositoryUrl}; inspect the guide before configuring repositories.`,
      );
    }
    if (development.recommendedApiVersion !== metadata.latest) {
      warnings.push(
        `The official development guide recommends velocity-api ${development.recommendedApiVersion}, while Maven metadata marks ${metadata.latest} as latest. The resolved coordinate follows live Maven metadata; review the guide before upgrading.`,
      );
    }
  }
  if (javaEvidence.status !== "retrieved") {
    warnings.push(
      javaEvidence.detail ??
        `Velocity Java requirements could not be validated. Inspect ${velocityFaqUrl}.`,
    );
  }

  const latestMajor = versionMajor(metadata.latest);
  const requirementApplies =
    latestMajor !== null &&
    javaEvidence.minimumVelocityMajor !== null &&
    latestMajor >= javaEvidence.minimumVelocityMajor;
  if (javaEvidence.status === "retrieved" && !requirementApplies) {
    warnings.push(
      `The Java requirement documented for ${javaEvidence.appliesTo} does not establish a requirement for velocity-api ${metadata.latest}; no Java version was inferred.`,
    );
  }
  if (
    requirementApplies &&
    development.minimumProjectJava !== null &&
    development.minimumProjectJava !== javaEvidence.minimumJava
  ) {
    warnings.push(
      `Official Velocity pages disagree on Java requirements (${development.minimumProjectJava} versus ${javaEvidence.minimumJava}); verify both pages before choosing a JDK.`,
    );
  }
  if (/-SNAPSHOT$/i.test(metadata.latest)) {
    warnings.push(
      "The latest velocity-api coordinate is a mutable SNAPSHOT. Use dependency locking or a resolved timestamped snapshot when reproducible builds are required.",
    );
  }
  warnings.push(
    "Velocity API and server versions do not establish Minecraft game-version compatibility. Verify proxy protocol and backend support separately; this resolver does not infer it.",
  );

  return {
    schemaVersion: 1,
    retrievedAt,
    api: {
      groupId: "com.velocitypowered",
      artifactId: "velocity-api",
      version: metadata.latest,
      coordinate: `com.velocitypowered:velocity-api:${metadata.latest}`,
      releaseVersion: metadata.release,
      repositoryUrl: velocityRepositoryUrl,
      metadataUrl: velocityApiMetadataUrl,
      metadataLastUpdated: metadata.lastUpdated,
      candidates: allCandidates.slice(0, limit),
      candidateCount: allCandidates.length,
      candidatesTruncated: allCandidates.length > limit,
      candidateOrdering: "latest-then-release-then-reverse-metadata-order",
    },
    documentation: {
      developmentGuideUrl: velocityDevelopmentDocsUrl,
      javadocsUrl: velocityJavadocsUrl,
      javaRequirementUrl: velocityFaqUrl,
      recommendedApiVersion: development.recommendedApiVersion,
      repositoryConfirmed: development.repositoryConfirmed,
    },
    javaRequirement:
      requirementApplies && javaEvidence.minimumJava !== null && javaEvidence.appliesTo !== null
        ? {
            minimumVersion: javaEvidence.minimumJava,
            appliesTo: javaEvidence.appliesTo,
            sourceUrl: velocityFaqUrl,
            corroboratedByDevelopmentGuide:
              development.minimumProjectJava === javaEvidence.minimumJava,
          }
        : null,
    compatibility: {
      minecraftGameVersions: "not-inferred",
      explanation:
        "The official Maven metadata identifies Velocity API releases, not Minecraft protocol, client, or backend-server compatibility.",
    },
    provenance: {
      kind: "official-live",
      sources: [
        sourceEntry(
          "api-metadata",
          velocityApiMetadataUrl,
          "retrieved",
          retrievedAt,
          `Maven metadata last updated ${metadata.lastUpdated}`,
        ),
        sourceEntry(
          "development-guide",
          velocityDevelopmentDocsUrl,
          development.status,
          retrievedAt,
          development.detail,
        ),
        sourceEntry(
          "java-requirement",
          velocityFaqUrl,
          javaEvidence.status,
          retrievedAt,
          javaEvidence.detail,
        ),
      ],
    },
    warnings,
  };
}
