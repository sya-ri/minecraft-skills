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
  const linkPattern = /href="([^"]*package-summary\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1];
    const name = decodeHtml(match[2]?.trim() ?? "");
    if (!href || !name || !/^(co|com|io|net|org)\./.test(name)) {
      continue;
    }
    packages.set(name, {
      name,
      url: new URL(href, javadocsUrl).toString(),
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
    const html = await fetchText(javadocsUrl);
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
    writeFileSync(join(outputRoot, `${version}.json`), `${JSON.stringify(index, null, 2)}\n`);
    written += 1;
  }

  return written;
}
