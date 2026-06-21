import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getVersionDetail, listVersions } from "@minecraft-skills/catalog";
import { buildResourcepackModelSummary } from "./resourcepackModels.js";

type Download = {
  url: string;
};

export type IngestResourcepackModelSummariesOptions = {
  root: string;
  retrievedAt: string;
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

function readDownload(downloads: Record<string, unknown>, key: string): Download {
  const download = downloads[key];
  if (download && typeof download === "object" && "url" in download) {
    const url = (download as { url: unknown }).url;
    if (typeof url === "string") {
      return { url };
    }
  }
  throw new Error(`Version detail does not include downloads.${key}.url`);
}

function safeFileName(version: string): string {
  return version.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

export async function ingestResourcepackModelSummaries(
  options: IngestResourcepackModelSummariesOptions,
): Promise<number> {
  const tempRoot = mkdtempSync(join(tmpdir(), "minecraft-skills-resourcepack-models-"));
  let written = 0;

  try {
    for (const version of listVersions("java")) {
      const output = join(
        options.root,
        `packages/data/data/java/resourcepack-models/${version.id}.json`,
      );
      if (existsSync(output) && !options.force) {
        options.log?.(`skip ${version.id}: resourcepack model summary already exists`);
        continue;
      }

      const detail = getVersionDetail("java", version.id);
      const client = readDownload(detail.downloads, "client");
      const clientJarPath = join(tempRoot, `${safeFileName(version.id)}-client.jar`);

      options.log?.(`fetch ${version.id}: client jar`);
      await downloadToFile(client.url, clientJarPath);

      const summary = buildResourcepackModelSummary({
        version: detail.version,
        clientJarPath,
        clientJarUrl: client.url,
        retrievedAt: options.retrievedAt,
      });
      mkdirSync(join(options.root, "packages/data/data/java/resourcepack-models"), {
        recursive: true,
      });
      writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
      written += 1;
      options.log?.(`wrote ${version.id}`);

      unlinkSync(clientJarPath);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  return written;
}
