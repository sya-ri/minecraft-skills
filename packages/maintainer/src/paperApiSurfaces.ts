import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPaperPluginData } from "@minecraft-skills/catalog";

type SearchIndexEntry = {
  p?: string;
  c?: string;
  l?: string;
  u?: string;
};

type PaperApiSurface = {
  schemaVersion: 1;
  projectId: "paper";
  minecraftVersion: string;
  coverage: "javadocs-search-index";
  javadocsUrl: string;
  typeCount: number;
  memberCount: number;
  types: Array<{
    packageName: string;
    name: string;
    qualifiedName: string;
    url: string;
  }>;
  members: Array<{
    packageName: string;
    typeName: string;
    qualifiedTypeName: string;
    name: string;
    label: string;
    kind: "constructor" | "method" | "field-or-enum-constant" | "unknown";
    url: string;
  }>;
  sources: Array<{
    id: string;
    kind: string;
    url: string;
    retrievedAt: string;
  }>;
};

export type IngestPaperApiSurfacesOptions = {
  root: string;
  retrievedAt: string;
  onlyVersion?: string;
  force?: boolean;
  log?: (message: string) => void;
};

function extractSearchIndex(js: string, variableName: string): SearchIndexEntry[] {
  const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = js.match(new RegExp(`${escapedName}\\s*=\\s*(\\[[\\s\\S]*?\\]);`));
  if (!match?.[1]) {
    throw new Error(`Could not find ${variableName} assignment`);
  }
  const parsed = JSON.parse(match[1]) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${variableName} is not an array`);
  }
  return parsed.filter((entry): entry is SearchIndexEntry =>
    Boolean(entry && typeof entry === "object"),
  );
}

function typeUrl(javadocsUrl: string, packageName: string, typeName: string, url?: string): string {
  if (url) {
    return new URL(url, javadocsUrl).toString();
  }
  return new URL(`${packageName.replaceAll(".", "/")}/${typeName}.html`, javadocsUrl).toString();
}

function memberUrl(
  javadocsUrl: string,
  packageName: string,
  typeName: string,
  memberName: string,
  url?: string,
): string {
  const base = typeUrl(javadocsUrl, packageName, typeName);
  if (!url) {
    return `${base}#${encodeURIComponent(memberName)}`;
  }
  if (url.startsWith("#")) {
    return `${base}${url}`;
  }
  if (!url.includes("/") && !url.includes(".html")) {
    return `${base}#${url}`;
  }
  return new URL(url, base).toString();
}

function memberKind(
  typeName: string,
  name: string,
  label: string,
): "constructor" | "method" | "field-or-enum-constant" | "unknown" {
  if (!label.includes("(")) {
    return "field-or-enum-constant";
  }
  if (name === typeName || label.startsWith(`${typeName}(`)) {
    return "constructor";
  }
  return "method";
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#40;", "(")
    .replaceAll("&#41;", ")");
}

function stripTags(value: string): string {
  return decodeHtml(value.replaceAll(/<[^>]*>/g, ""))
    .replaceAll(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchTextWithFinalUrl(url: string): Promise<{ text: string; finalUrl: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return {
    text: await response.text(),
    finalUrl: response.url,
  };
}

export function buildPaperApiSurface(options: {
  minecraftVersion: string;
  javadocsUrl: string;
  typeSearchIndexJs: string;
  memberSearchIndexJs: string;
  retrievedAt: string;
}): PaperApiSurface {
  const types = extractSearchIndex(options.typeSearchIndexJs, "typeSearchIndex")
    .filter((entry) => entry.p && entry.l)
    .map((entry) => {
      const packageName = entry.p ?? "";
      const name = entry.l ?? "";
      return {
        packageName,
        name,
        qualifiedName: `${packageName}.${name}`,
        url: typeUrl(options.javadocsUrl, packageName, name, entry.u),
      };
    })
    .sort((left, right) => left.qualifiedName.localeCompare(right.qualifiedName));

  const members = extractSearchIndex(options.memberSearchIndexJs, "memberSearchIndex")
    .filter((entry) => entry.p && entry.c && entry.l)
    .map((entry) => {
      const packageName = entry.p ?? "";
      const typeName = entry.c ?? "";
      const label = entry.l ?? "";
      const name = label.split("(")[0]?.trim() ?? label;
      return {
        packageName,
        typeName,
        qualifiedTypeName: `${packageName}.${typeName}`,
        name,
        label,
        kind: memberKind(typeName, name, label),
        url: memberUrl(options.javadocsUrl, packageName, typeName, name, entry.u),
      };
    })
    .sort((left, right) =>
      `${left.qualifiedTypeName}#${left.label}`.localeCompare(
        `${right.qualifiedTypeName}#${right.label}`,
      ),
    );

  return {
    schemaVersion: 1,
    projectId: "paper",
    minecraftVersion: options.minecraftVersion,
    coverage: "javadocs-search-index",
    javadocsUrl: options.javadocsUrl,
    typeCount: types.length,
    memberCount: members.length,
    types,
    members,
    sources: [
      {
        id: `paper-javadocs-type-search-index-${options.minecraftVersion}`,
        kind: "official-javadocs-search-index",
        url: new URL("type-search-index.js", options.javadocsUrl).toString(),
        retrievedAt: options.retrievedAt,
      },
      {
        id: `paper-javadocs-member-search-index-${options.minecraftVersion}`,
        kind: "official-javadocs-search-index",
        url: new URL("member-search-index.js", options.javadocsUrl).toString(),
        retrievedAt: options.retrievedAt,
      },
    ],
  };
}

export function buildLegacyPaperApiSurface(options: {
  minecraftVersion: string;
  javadocsUrl: string;
  allClassesHtml: string;
  indexAllHtml: string;
  allClassesUrl: string;
  indexAllUrl: string;
  retrievedAt: string;
}): PaperApiSurface {
  const types = [
    ...options.allClassesHtml.matchAll(
      /<li>\s*<a href="([^"]+)" title="[^"]* in ([^"]+)">([\s\S]*?)<\/a>\s*<\/li>/g,
    ),
  ]
    .map((match) => {
      const href = match[1] ?? "";
      const packageName = decodeHtml(match[2] ?? "").trim();
      const name = stripTags(match[3] ?? "");
      return {
        packageName,
        name,
        qualifiedName: `${packageName}.${name}`,
        url: new URL(href, options.javadocsUrl).toString(),
      };
    })
    .filter((entry) => entry.packageName && entry.name)
    .sort((left, right) => left.qualifiedName.localeCompare(right.qualifiedName));

  const seenMembers = new Set<string>();
  const members = [
    ...options.indexAllHtml.matchAll(
      /<dt><span class="memberNameLink"><a href="([^"]+)">([\s\S]*?)<\/a><\/span> - ([\s\S]*?)<\/dt>/g,
    ),
  ]
    .map((match) => {
      const href = decodeHtml(match[1] ?? "");
      const label = stripTags(match[2] ?? "");
      const description = stripTags(match[3] ?? "");
      const htmlPath = href.split("#")[0] ?? "";
      const typePath = htmlPath.replace(/\.html$/, "");
      const segments = typePath.split("/").filter(Boolean);
      const typeName = segments.pop() ?? "";
      const packageName = segments.join(".");
      const name = label.split("(")[0]?.trim() ?? label;
      const kind = description.toLowerCase().includes("method")
        ? memberKind(typeName, name, label)
        : memberKind(typeName, name, label);
      return {
        packageName,
        typeName,
        qualifiedTypeName: `${packageName}.${typeName}`,
        name,
        label,
        kind,
        url: new URL(href, options.javadocsUrl).toString(),
      };
    })
    .filter((entry) => entry.packageName && entry.typeName && entry.label)
    .filter((entry) => {
      const key = `${entry.qualifiedTypeName}#${entry.label}#${entry.url}`;
      if (seenMembers.has(key)) {
        return false;
      }
      seenMembers.add(key);
      return true;
    })
    .sort((left, right) =>
      `${left.qualifiedTypeName}#${left.label}`.localeCompare(
        `${right.qualifiedTypeName}#${right.label}`,
      ),
    );

  return {
    schemaVersion: 1,
    projectId: "paper",
    minecraftVersion: options.minecraftVersion,
    coverage: "javadocs-search-index",
    javadocsUrl: options.javadocsUrl,
    typeCount: types.length,
    memberCount: members.length,
    types,
    members,
    sources: [
      {
        id: `paper-javadocs-allclasses-${options.minecraftVersion}`,
        kind: "official-javadocs-legacy-index",
        url: options.allClassesUrl,
        retrievedAt: options.retrievedAt,
      },
      {
        id: `paper-javadocs-index-all-${options.minecraftVersion}`,
        kind: "official-javadocs-legacy-index",
        url: options.indexAllUrl,
        retrievedAt: options.retrievedAt,
      },
    ],
  };
}

function requireNonEmptySurface(surface: PaperApiSurface): void {
  if (surface.typeCount === 0 && surface.memberCount === 0) {
    throw new Error(
      `Paper API surface for ${surface.minecraftVersion} did not contain types or members`,
    );
  }
}

export async function ingestPaperApiSurfaces(
  options: IngestPaperApiSurfacesOptions,
): Promise<number> {
  const outputRoot = join(options.root, "packages/data/data/java/paper-api-surfaces");
  mkdirSync(outputRoot, { recursive: true });
  const versions = options.onlyVersion ? [options.onlyVersion] : getPaperPluginData().versions;
  let written = 0;

  for (const version of versions) {
    const output = join(outputRoot, `${version}.json`);
    if (!options.force && !options.onlyVersion && existsSync(output)) {
      options.log?.(`skip ${version}: Paper API surface already exists`);
      continue;
    }
    const javadocsUrl = `https://jd.papermc.io/paper/${version}/`;
    let surface: PaperApiSurface;
    try {
      options.log?.(`fetch ${version}: Paper Javadocs type/member search indexes`);
      const [typeSearchIndexJs, memberSearchIndexJs] = await Promise.all([
        fetchText(new URL("type-search-index.js", javadocsUrl).toString()),
        fetchText(new URL("member-search-index.js", javadocsUrl).toString()),
      ]);
      surface = buildPaperApiSurface({
        minecraftVersion: version,
        javadocsUrl,
        typeSearchIndexJs,
        memberSearchIndexJs,
        retrievedAt: options.retrievedAt,
      });
      requireNonEmptySurface(surface);
    } catch (error) {
      try {
        options.log?.(`fetch ${version}: Paper legacy Javadocs allclasses/index-all pages`);
        const [allClasses, indexAll] = await Promise.all([
          fetchTextWithFinalUrl(new URL("allclasses-noframe.html", javadocsUrl).toString()),
          fetchTextWithFinalUrl(new URL("index-all.html", javadocsUrl).toString()),
        ]);
        surface = buildLegacyPaperApiSurface({
          minecraftVersion: version,
          javadocsUrl: new URL(".", indexAll.finalUrl).toString(),
          allClassesHtml: allClasses.text,
          indexAllHtml: indexAll.text,
          allClassesUrl: allClasses.finalUrl,
          indexAllUrl: indexAll.finalUrl,
          retrievedAt: options.retrievedAt,
        });
        requireNonEmptySurface(surface);
      } catch (fallbackError) {
        if (options.onlyVersion) {
          throw fallbackError;
        }
        const message = error instanceof Error ? error.message : String(error);
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        options.log?.(
          `skip ${version}: Paper API surface unavailable (${message}; legacy fallback: ${fallbackMessage})`,
        );
        continue;
      }
    }
    writeFileSync(output, `${JSON.stringify(surface, null, 2)}\n`);
    written += 1;
  }

  return written;
}
