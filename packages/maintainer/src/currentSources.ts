import { getCatalog, getPaperPluginData } from "@minecraft-skills/catalog";

type FetchJson = (url: string) => Promise<unknown>;

type MojangManifest = {
  latest: {
    release: string;
    snapshot: string;
  };
};

type PaperProject = {
  versions: string[] | Record<string, string[]>;
};

type PaperVersionBuilds = {
  version: string;
  builds: number[];
};

type PaperDownloadBuild = {
  id: number;
};

export type CurrentSourceAudit = {
  ok: boolean;
  checkedAt: string;
  bundled: {
    javaLatestRelease: string;
    paperLatestVersion: string;
    paperLatestBuild: number;
  };
  current: {
    javaLatestRelease: string;
    javaLatestSnapshot: string;
    paperLatestVersion: string;
    paperLatestBuild: number;
  };
  mismatches: string[];
};

type CurrentSourceAuditOptions = {
  checkedAt?: string;
  fetchJson?: FetchJson;
  bundled?: CurrentSourceAudit["bundled"];
};

const mojangManifestUrl = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const paperProjectUrl = "https://fill.papermc.io/v3/projects/paper";

async function defaultFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<unknown>;
}

function assertMojangManifest(value: unknown): asserts value is MojangManifest {
  if (!value || typeof value !== "object" || !("latest" in value)) {
    throw new Error("Invalid Mojang version manifest: missing latest");
  }
  const latest = (value as { latest: unknown }).latest;
  if (!latest || typeof latest !== "object") {
    throw new Error("Invalid Mojang version manifest: latest must be an object");
  }
  const release = (latest as { release?: unknown }).release;
  const snapshot = (latest as { snapshot?: unknown }).snapshot;
  if (typeof release !== "string" || typeof snapshot !== "string") {
    throw new Error("Invalid Mojang version manifest: latest release/snapshot must be strings");
  }
}

function assertPaperProject(value: unknown): asserts value is PaperProject {
  if (!value || typeof value !== "object" || !("versions" in value)) {
    throw new Error("Invalid PaperMC project JSON: missing versions");
  }
  const versions = (value as { versions: unknown }).versions;
  if (!Array.isArray(versions) && (!versions || typeof versions !== "object")) {
    throw new Error("Invalid PaperMC project JSON: versions must be an array or grouped object");
  }
}

function assertPaperVersionBuilds(value: unknown): asserts value is PaperVersionBuilds {
  if (!value || typeof value !== "object" || !("builds" in value)) {
    throw new Error("Invalid PaperMC version builds JSON: missing builds");
  }
  if (!Array.isArray((value as { builds: unknown }).builds)) {
    throw new Error("Invalid PaperMC version builds JSON: builds must be an array");
  }
}

function assertPaperDownloadBuilds(value: unknown): asserts value is PaperDownloadBuild[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid PaperMC downloads builds JSON: expected array");
  }
  for (const build of value) {
    if (!build || typeof build !== "object" || typeof (build as { id?: unknown }).id !== "number") {
      throw new Error("Invalid PaperMC downloads builds JSON: build id must be a number");
    }
  }
}

function paperProjectVersions(project: PaperProject): string[] {
  if (Array.isArray(project.versions)) {
    return project.versions;
  }
  return Object.values(project.versions).flat();
}

function isSupportedPaperReleaseVersion(version: string): boolean {
  if (version.includes("-")) {
    return false;
  }
  const [major, minor] = version.split(".");
  if (major === "1") {
    return Number(minor) >= 13;
  }
  return Number(major) >= 26;
}

function compareMinecraftVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function supportedPaperReleaseVersions(project: PaperProject): string[] {
  return paperProjectVersions(project)
    .filter(isSupportedPaperReleaseVersion)
    .sort(compareMinecraftVersions);
}

function loadBundledSources(): CurrentSourceAudit["bundled"] {
  const catalog = getCatalog();
  const paper = getPaperPluginData();
  return {
    javaLatestRelease: catalog.latest.java,
    paperLatestVersion: paper.latest.minecraftVersion,
    paperLatestBuild: paper.latest.build,
  };
}

export async function auditCurrentSources(
  options: CurrentSourceAuditOptions = {},
): Promise<CurrentSourceAudit> {
  const fetchJson = options.fetchJson ?? defaultFetchJson;
  const checkedAt = options.checkedAt ?? new Date().toISOString();
  const bundled = options.bundled ?? loadBundledSources();

  const mojangManifest = await fetchJson(mojangManifestUrl);
  assertMojangManifest(mojangManifest);

  const paperProject = await fetchJson(paperProjectUrl);
  assertPaperProject(paperProject);
  const paperVersions = supportedPaperReleaseVersions(paperProject);
  const paperLatestVersion = paperVersions.at(-1);
  if (!paperLatestVersion) {
    throw new Error("PaperMC project JSON did not contain supported 1.13+ release versions");
  }

  const paperBuilds = await fetchJson(`${paperProjectUrl}/versions/${paperLatestVersion}/builds`);
  let paperLatestBuild: number;
  try {
    assertPaperDownloadBuilds(paperBuilds);
    paperLatestBuild = Math.max(...paperBuilds.map((build) => build.id));
  } catch {
    assertPaperVersionBuilds(paperBuilds);
    if (paperBuilds.version !== paperLatestVersion) {
      throw new Error(
        `PaperMC builds JSON is for ${paperBuilds.version}, expected ${paperLatestVersion}`,
      );
    }
    paperLatestBuild = Math.max(...paperBuilds.builds);
  }
  if (!Number.isFinite(paperLatestBuild)) {
    throw new Error(`PaperMC builds JSON for ${paperLatestVersion} did not contain any builds`);
  }

  const mismatches: string[] = [];
  if (bundled.javaLatestRelease !== mojangManifest.latest.release) {
    mismatches.push(
      `bundled Java latest ${bundled.javaLatestRelease} differs from Mojang latest release ${mojangManifest.latest.release}`,
    );
  }
  if (bundled.paperLatestVersion !== paperLatestVersion) {
    mismatches.push(
      `bundled Paper latest ${bundled.paperLatestVersion} differs from PaperMC latest ${paperLatestVersion}`,
    );
  }
  if (bundled.paperLatestBuild !== paperLatestBuild) {
    mismatches.push(
      `bundled Paper latest build ${bundled.paperLatestBuild} differs from PaperMC latest build ${paperLatestBuild}`,
    );
  }

  return {
    ok: mismatches.length === 0,
    checkedAt,
    bundled,
    current: {
      javaLatestRelease: mojangManifest.latest.release,
      javaLatestSnapshot: mojangManifest.latest.snapshot,
      paperLatestVersion,
      paperLatestBuild,
    },
    mismatches,
  };
}
