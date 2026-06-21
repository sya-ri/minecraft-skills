import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type PaperPluginData = {
  schemaVersion: 1;
  versions: string[];
  versionBuilds?: Array<{
    minecraftVersion: string;
    latestBuild: number;
    buildCount: number;
  }>;
  sources: Array<{
    id: string;
    kind: string;
    url: string;
    retrievedAt: string;
  }>;
};

type PaperVersionBuildsJson = {
  version: string;
  builds: number[];
};

export type IngestPaperBuildsOptions = {
  root: string;
  retrievedAt: string;
  log?: (message: string) => void;
};

function assertPaperVersionBuilds(value: unknown): asserts value is PaperVersionBuildsJson {
  if (!value || typeof value !== "object" || !("version" in value) || !("builds" in value)) {
    throw new Error("Invalid PaperMC version builds JSON");
  }
  const candidate = value as { version: unknown; builds: unknown };
  if (typeof candidate.version !== "string" || !Array.isArray(candidate.builds)) {
    throw new Error("Invalid PaperMC version builds JSON");
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function ingestPaperBuilds(options: IngestPaperBuildsOptions): Promise<number> {
  const paperPath = join(options.root, "packages/data/data/java/paper.json");
  const paper = JSON.parse(readFileSync(paperPath, "utf8")) as PaperPluginData;
  const versionBuilds: NonNullable<PaperPluginData["versionBuilds"]> = [];

  for (const version of paper.versions) {
    const url = `https://api.papermc.io/v2/projects/paper/versions/${version}`;
    options.log?.(`fetch ${version}: Paper builds`);
    const json = await fetchJson(url);
    assertPaperVersionBuilds(json);
    if (json.version !== version) {
      throw new Error(`PaperMC builds JSON is for ${json.version}, expected ${version}`);
    }
    const latestBuild = Math.max(...json.builds);
    if (!Number.isFinite(latestBuild)) {
      throw new Error(`PaperMC builds JSON for ${version} did not contain any builds`);
    }
    versionBuilds.push({
      minecraftVersion: version,
      latestBuild,
      buildCount: json.builds.length,
    });
  }

  const sources = paper.sources.filter(
    (source) => source.id !== "papermc-api-paper-version-builds",
  );
  sources.push({
    id: "papermc-api-paper-version-builds",
    kind: "official-bulk",
    url: "https://api.papermc.io/v2/projects/paper/versions/{minecraftVersion}",
    retrievedAt: options.retrievedAt,
  });

  writeFileSync(
    paperPath,
    `${JSON.stringify(
      {
        ...paper,
        versionBuilds,
        sources,
      },
      null,
      2,
    )}\n`,
  );

  return versionBuilds.length;
}
