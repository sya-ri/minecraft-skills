import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type PaperPluginData = {
  schemaVersion: 1;
  latest: {
    minecraftVersion: string;
    build: number;
  };
  support: {
    minecraftLatestGap: {
      javaLatest: string;
      paperLatest: string;
      status: "paper-current-with-java-latest" | "paper-not-yet-published-for-java-latest";
    };
  };
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

type PaperDownloadBuildJson = {
  id: number;
  channel?: string;
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

function assertPaperDownloadBuilds(value: unknown): asserts value is PaperDownloadBuildJson[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid PaperMC downloads builds JSON: expected array");
  }
  for (const build of value) {
    if (!build || typeof build !== "object" || typeof (build as { id?: unknown }).id !== "number") {
      throw new Error("Invalid PaperMC downloads builds JSON: build id must be a number");
    }
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchDownloadBuilds(version: string): Promise<number[]> {
  const url = `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`;
  const json = await fetchJson(url);
  assertPaperDownloadBuilds(json);
  return json.map((build) => build.id).sort((left, right) => left - right);
}

export async function ingestPaperBuilds(options: IngestPaperBuildsOptions): Promise<number> {
  const paperPath = join(options.root, "packages/data/data/java/paper.json");
  const paper = JSON.parse(readFileSync(paperPath, "utf8")) as PaperPluginData;
  const versionBuilds: NonNullable<PaperPluginData["versionBuilds"]> = [];

  for (const version of paper.versions) {
    options.log?.(`fetch ${version}: Paper downloads builds`);
    let builds: number[];
    try {
      builds = await fetchDownloadBuilds(version);
    } catch {
      const url = `https://api.papermc.io/v2/projects/paper/versions/${version}`;
      const json = await fetchJson(url);
      assertPaperVersionBuilds(json);
      if (json.version !== version) {
        throw new Error(`PaperMC builds JSON is for ${json.version}, expected ${version}`);
      }
      builds = json.builds;
    }
    const latestBuild = Math.max(...builds);
    if (!Number.isFinite(latestBuild)) {
      options.log?.(`skip ${version}: no Paper builds`);
      continue;
    }
    versionBuilds.push({
      minecraftVersion: version,
      latestBuild,
      buildCount: builds.length,
    });
  }

  const sources = paper.sources.filter(
    (source) =>
      source.id !== "papermc-api-paper-version-builds" &&
      source.id !== "papermc-downloads-paper-version-builds",
  );
  sources.push({
    id: "papermc-downloads-paper-version-builds",
    kind: "official-bulk",
    url: "https://fill.papermc.io/v3/projects/paper/versions/{minecraftVersion}/builds",
    retrievedAt: options.retrievedAt,
  });
  const versions = versionBuilds.map((build) => build.minecraftVersion);
  const latest = versionBuilds.at(-1);
  if (!latest) {
    throw new Error("PaperMC downloads API did not contain builds for supported versions");
  }

  writeFileSync(
    paperPath,
    `${JSON.stringify(
      {
        ...paper,
        latest: {
          minecraftVersion: latest.minecraftVersion,
          build: latest.latestBuild,
        },
        support: {
          ...paper.support,
          minecraftLatestGap: {
            ...paper.support.minecraftLatestGap,
            paperLatest: latest.minecraftVersion,
            status:
              paper.support.minecraftLatestGap.javaLatest === latest.minecraftVersion
                ? "paper-current-with-java-latest"
                : "paper-not-yet-published-for-java-latest",
          },
        },
        versions,
        versionBuilds,
        sources,
      },
      null,
      2,
    )}\n`,
  );

  return versionBuilds.length;
}
