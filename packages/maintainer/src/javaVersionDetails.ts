import { existsSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildJavaVersionDetail } from "./javaVersionDetail.js";

type VersionSummary = {
  id: string;
  url: string;
};

type VersionIndex = {
  versions: VersionSummary[];
};

type MojangVersionJson = {
  downloads?: {
    client?: {
      url: string;
    };
  };
};

export type IngestJavaVersionDetailsOptions = {
  root: string;
  retrievedAt: string;
  includeClientJars: boolean;
  force: boolean;
  log?: (message: string) => void;
};

async function downloadToFile(url: string, path: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  writeFileSync(path, body);
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function safeFileName(version: string): string {
  return version.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

export async function ingestJavaVersionDetails(
  options: IngestJavaVersionDetailsOptions,
): Promise<number> {
  const versionIndexPath = join(options.root, "packages/data/data/java/versions.json");
  const versionIndex = readJsonFile<VersionIndex>(versionIndexPath);
  const tempRoot = mkdtempSync(join(tmpdir(), "minecraft-skills-java-details-"));
  let written = 0;

  for (const version of versionIndex.versions) {
    const output = join(options.root, `packages/data/data/java/version-details/${version.id}.json`);
    if (existsSync(output) && !options.force) {
      options.log?.(`skip ${version.id}: detail already exists`);
      continue;
    }

    options.log?.(`fetch ${version.id}: version json`);
    const baseName = safeFileName(version.id);
    const versionJsonPath = join(tempRoot, `${baseName}.json`);
    await downloadToFile(version.url, versionJsonPath);

    const versionJson = readJsonFile<MojangVersionJson>(versionJsonPath);
    const clientJarUrl = versionJson.downloads?.client?.url;
    let clientJarPath: string | undefined;
    if (options.includeClientJars && clientJarUrl) {
      options.log?.(`fetch ${version.id}: client jar`);
      clientJarPath = join(tempRoot, `${baseName}-client.jar`);
      await downloadToFile(clientJarUrl, clientJarPath);
    }

    const detailOptions: {
      versionJsonPath: string;
      clientJarPath?: string;
      versionJsonUrl: string;
      retrievedAt: string;
    } = {
      versionJsonPath,
      versionJsonUrl: version.url,
      retrievedAt: options.retrievedAt,
    };
    if (clientJarPath) {
      detailOptions.clientJarPath = clientJarPath;
    }
    const detail = buildJavaVersionDetail(detailOptions);
    writeFileSync(output, `${JSON.stringify(detail, null, 2)}\n`);
    written += 1;
    options.log?.(`wrote ${version.id}`);

    if (clientJarPath) {
      unlinkSync(clientJarPath);
    }
    unlinkSync(versionJsonPath);
  }

  return written;
}
