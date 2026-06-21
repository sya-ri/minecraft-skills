import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPaperPluginData } from "@minecraft-skills/catalog";

type PaperApiPackage = {
  name: string;
  url: string;
};

type PaperApiIndex = {
  schemaVersion: 1;
  projectId: "paper";
  minecraftVersion: string;
  coverage: "javadocs-package-index";
  javadocsUrl: string;
  packageCount: number;
  packages: PaperApiPackage[];
  sources: Array<{
    id: string;
    kind: string;
    url: string;
    retrievedAt: string;
  }>;
};

export type IngestPaperApiIndexesOptions = {
  root: string;
  retrievedAt: string;
  log?: (message: string) => void;
};

function decodeHtml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function extractPaperPackages(html: string, javadocsUrl: string): PaperApiPackage[] {
  const packages = new Map<string, PaperApiPackage>();
  const linkPattern = /href="([^"]*package-(?:summary|frame)\.html)"[^>]*>([^<]+)<\/a>/g;
  const packageSearchIndexPattern = /"l":"([^"]+)"/g;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1];
    const name = decodeHtml(match[2]?.trim() ?? "");
    if (!href || !name || !/^(co|com|io|net|org)\./.test(name)) {
      continue;
    }
    packages.set(name, {
      name,
      url: new URL(
        href.replace(/package-frame\.html$/, "package-summary.html"),
        javadocsUrl,
      ).toString(),
    });
  }

  for (const match of html.matchAll(packageSearchIndexPattern)) {
    const name = decodeHtml(match[1]?.trim() ?? "");
    if (!name || !/^(co|com|io|net|org)\./.test(name)) {
      continue;
    }
    packages.set(name, {
      name,
      url: new URL(`${name.replaceAll(".", "/")}/package-summary.html`, javadocsUrl).toString(),
    });
  }

  return [...packages.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchPaperJavadocsIndex(
  javadocsUrl: string,
): Promise<{ html: string; url: string }> {
  const candidates = [
    javadocsUrl,
    new URL("overview-summary.html", javadocsUrl).toString(),
    new URL("overview-frame.html", javadocsUrl).toString(),
    new URL("package-search-index.js", javadocsUrl).toString(),
  ];

  for (const url of candidates) {
    let html: string;
    try {
      html = await fetchText(url);
    } catch {
      continue;
    }
    if (extractPaperPackages(html, javadocsUrl).length > 0) {
      return { html, url };
    }
  }

  return { html: await fetchText(javadocsUrl), url: javadocsUrl };
}

export function buildPaperApiIndex(options: {
  minecraftVersion: string;
  javadocsUrl: string;
  html: string;
  retrievedAt: string;
}): PaperApiIndex {
  const packages = extractPaperPackages(options.html, options.javadocsUrl);
  if (packages.length === 0) {
    throw new Error(`No Paper API packages found in ${options.javadocsUrl}`);
  }
  return {
    schemaVersion: 1,
    projectId: "paper",
    minecraftVersion: options.minecraftVersion,
    coverage: "javadocs-package-index",
    javadocsUrl: options.javadocsUrl,
    packageCount: packages.length,
    packages,
    sources: [
      {
        id: `paper-javadocs-${options.minecraftVersion}`,
        kind: "official-javadocs",
        url: options.javadocsUrl,
        retrievedAt: options.retrievedAt,
      },
    ],
  };
}

export async function ingestPaperApiIndexes(
  options: IngestPaperApiIndexesOptions,
): Promise<number> {
  const outputRoot = join(options.root, "packages/data/data/java/paper-api-indexes");
  mkdirSync(outputRoot, { recursive: true });
  let written = 0;

  for (const version of getPaperPluginData().versions) {
    const javadocsUrl = `https://jd.papermc.io/paper/${version}/`;
    options.log?.(`fetch ${version}: Paper Javadocs package index`);
    const { html, url } = await fetchPaperJavadocsIndex(javadocsUrl);
    let index: PaperApiIndex;
    try {
      index = buildPaperApiIndex({
        minecraftVersion: version,
        javadocsUrl,
        html,
        retrievedAt: options.retrievedAt,
      });
    } catch (error) {
      options.log?.(`skip ${version}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (url !== javadocsUrl) {
      index.sources.push({
        id: `paper-javadocs-index-${version}`,
        kind: "official-javadocs-index",
        url,
        retrievedAt: options.retrievedAt,
      });
    }
    writeFileSync(join(outputRoot, `${version}.json`), `${JSON.stringify(index, null, 2)}\n`);
    written += 1;
  }

  return written;
}
