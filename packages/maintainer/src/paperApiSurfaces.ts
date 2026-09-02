import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPaperPluginData } from "@minecraft-skills/catalog";

type SearchIndexEntry = {
  p?: string;
  c?: string;
  l?: string;
  u?: string;
};

type PaperApiType = {
  packageName: string;
  name: string;
  qualifiedName: string;
  url: string;
  directSupertypes?: string[];
};

type PaperApiSurface = {
  schemaVersion: 1;
  projectId: "paper";
  minecraftVersion: string;
  coverage: "javadocs-search-index";
  javadocsUrl: string;
  inheritanceCoverage?: "javadocs-overview-tree";
  typeCount: number;
  memberCount: number;
  types: PaperApiType[];
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
  url?: string,
): "constructor" | "method" | "field-or-enum-constant" | "unknown" {
  if (!label.includes("(")) {
    return "field-or-enum-constant";
  }
  const simpleTypeName = typeName.split(".").at(-1) ?? typeName;
  let decodedUrl = url ?? "";
  try {
    decodedUrl = decodeURIComponent(decodedUrl);
  } catch {
    // A malformed search-index URL must not prevent generation.
  }
  if (
    decodedUrl.includes("<init>") ||
    name === typeName ||
    name === simpleTypeName ||
    label.startsWith(`${typeName}(`) ||
    label.startsWith(`${simpleTypeName}(`)
  ) {
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

function normalizedTypeUrl(url: string): string {
  const normalized = new URL(url);
  normalized.hash = "";
  return normalized.toString();
}

function extractAnchorType(
  anchor: string,
  javadocsUrl: string,
  typeByUrl: ReadonlyMap<string, string>,
): string | null {
  const href = anchor.match(/\bhref="([^"]+)"/i)?.[1];
  if (!href) return null;
  try {
    return (
      typeByUrl.get(normalizedTypeUrl(new URL(decodeHtml(href), javadocsUrl).toString())) ?? null
    );
  } catch {
    return null;
  }
}

export function extractPaperDirectSupertypes(options: {
  overviewTreeHtml: string;
  javadocsUrl: string;
  types: readonly PaperApiType[];
}): Map<string, string[]> {
  const typeByUrl = new Map(
    options.types.map((entry) => [normalizedTypeUrl(entry.url), entry.qualifiedName]),
  );
  const directSupertypes = new Map<string, Set<string>>();
  const hierarchyStart = options.overviewTreeHtml.search(/<h2\b[^>]*>\s*Class Hierarchy\s*<\/h2>/i);
  if (hierarchyStart < 0) {
    return new Map();
  }

  const hierarchyHtml = options.overviewTreeHtml.slice(hierarchyStart);
  const structuralTag = /<ul\b[^>]*>|<\/ul\s*>|<li\b[^>]*>|<\/li\s*>/gi;
  const parentTypes: Array<string | null> = [];
  let activeListItemType: string | null = null;
  let listItemContentStart: number | null = null;

  const addSupertype = (typeName: string, supertypeName: string | null): void => {
    if (!supertypeName || typeName === supertypeName) return;
    const existing = directSupertypes.get(typeName) ?? new Set<string>();
    existing.add(supertypeName);
    directSupertypes.set(typeName, existing);
  };

  for (const match of hierarchyHtml.matchAll(structuralTag)) {
    const index = match.index ?? 0;
    if (listItemContentStart !== null) {
      const content = hierarchyHtml.slice(listItemContentStart, index);
      const anchors = [...content.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map(
        (anchorMatch) => anchorMatch[0] ?? "",
      );
      const currentAnchor = anchors.find(
        (anchor) =>
          /\bclass="[^"]*\btype-name-link\b[^"]*"/i.test(anchor) ||
          /\bclass="[^"]*\btypeNameLink\b[^"]*"/i.test(anchor),
      );
      activeListItemType = currentAnchor
        ? extractAnchorType(currentAnchor, options.javadocsUrl, typeByUrl)
        : null;
      if (activeListItemType) {
        addSupertype(activeListItemType, parentTypes.at(-1) ?? null);
        const additionalRelations = content.match(
          /\((?:also extends|implements)\s+([\s\S]*?)\)\s*$/i,
        )?.[1];
        if (additionalRelations) {
          for (const anchor of additionalRelations.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
            addSupertype(
              activeListItemType,
              extractAnchorType(anchor[0], options.javadocsUrl, typeByUrl),
            );
          }
        }
      }
      listItemContentStart = null;
    }

    const tag = (match[0] ?? "").toLowerCase();
    if (tag.startsWith("<li")) {
      activeListItemType = null;
      listItemContentStart = index + (match[0]?.length ?? 0);
    } else if (tag.startsWith("<ul")) {
      parentTypes.push(activeListItemType);
      activeListItemType = null;
    } else if (tag.startsWith("</ul")) {
      parentTypes.pop();
      activeListItemType = null;
    } else if (tag.startsWith("</li")) {
      activeListItemType = null;
    }
  }

  return new Map(
    [...directSupertypes].map(([typeName, entries]) => [
      typeName,
      [...entries].sort((left, right) => left.localeCompare(right)),
    ]),
  );
}

function attachPaperTypeHierarchy(options: {
  types: PaperApiType[];
  overviewTreeHtml?: string | undefined;
  javadocsUrl: string;
}): { types: PaperApiType[]; covered: boolean } {
  if (!options.overviewTreeHtml) return { types: options.types, covered: false };
  const directSupertypes = extractPaperDirectSupertypes({
    overviewTreeHtml: options.overviewTreeHtml,
    javadocsUrl: options.javadocsUrl,
    types: options.types,
  });
  if (directSupertypes.size === 0) return { types: options.types, covered: false };
  return {
    types: options.types.map((entry) => {
      const supertypes = directSupertypes.get(entry.qualifiedName);
      return supertypes ? { ...entry, directSupertypes: supertypes } : entry;
    }),
    covered: true,
  };
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
  overviewTreeHtml?: string | undefined;
  retrievedAt: string;
}): PaperApiSurface {
  const hierarchy = attachPaperTypeHierarchy({
    types: extractSearchIndex(options.typeSearchIndexJs, "typeSearchIndex")
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
      .sort((left, right) => left.qualifiedName.localeCompare(right.qualifiedName)),
    overviewTreeHtml: options.overviewTreeHtml,
    javadocsUrl: options.javadocsUrl,
  });
  const { types } = hierarchy;

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
        kind: memberKind(typeName, name, label, entry.u),
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
    ...(hierarchy.covered ? { inheritanceCoverage: "javadocs-overview-tree" as const } : {}),
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
      ...(hierarchy.covered
        ? [
            {
              id: `paper-javadocs-overview-tree-${options.minecraftVersion}`,
              kind: "official-javadocs-type-hierarchy",
              url: new URL("overview-tree.html", options.javadocsUrl).toString(),
              retrievedAt: options.retrievedAt,
            },
          ]
        : []),
    ],
  };
}

export function buildLegacyPaperApiSurface(options: {
  minecraftVersion: string;
  javadocsUrl: string;
  allClassesHtml: string;
  indexAllHtml: string;
  overviewTreeHtml?: string | undefined;
  allClassesUrl: string;
  indexAllUrl: string;
  retrievedAt: string;
}): PaperApiSurface {
  const hierarchy = attachPaperTypeHierarchy({
    types: [
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
      .sort((left, right) => left.qualifiedName.localeCompare(right.qualifiedName)),
    overviewTreeHtml: options.overviewTreeHtml,
    javadocsUrl: options.javadocsUrl,
  });
  const { types } = hierarchy;

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
        ? memberKind(typeName, name, label, href)
        : memberKind(typeName, name, label, href);
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
    ...(hierarchy.covered ? { inheritanceCoverage: "javadocs-overview-tree" as const } : {}),
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
      ...(hierarchy.covered
        ? [
            {
              id: `paper-javadocs-overview-tree-${options.minecraftVersion}`,
              kind: "official-javadocs-type-hierarchy",
              url: new URL("overview-tree.html", options.javadocsUrl).toString(),
              retrievedAt: options.retrievedAt,
            },
          ]
        : []),
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
    let overviewTreeHtml: string | undefined;
    try {
      options.log?.(`fetch ${version}: Paper Javadocs overview type hierarchy`);
      overviewTreeHtml = await fetchText(new URL("overview-tree.html", javadocsUrl).toString());
    } catch (error) {
      options.log?.(
        `continue ${version}: Paper Javadocs overview type hierarchy unavailable (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }
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
        overviewTreeHtml,
        retrievedAt: options.retrievedAt,
      });
      if (overviewTreeHtml && !surface.inheritanceCoverage) {
        options.log?.(
          `continue ${version}: Paper Javadocs overview type hierarchy did not yield known direct supertypes`,
        );
      }
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
          overviewTreeHtml,
          allClassesUrl: allClasses.finalUrl,
          indexAllUrl: indexAll.finalUrl,
          retrievedAt: options.retrievedAt,
        });
        if (overviewTreeHtml && !surface.inheritanceCoverage) {
          options.log?.(
            `continue ${version}: Paper legacy Javadocs overview type hierarchy did not yield known direct supertypes`,
          );
        }
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
