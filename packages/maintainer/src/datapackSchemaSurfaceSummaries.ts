import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getVersionDetail, listVersions } from "@minecraft-skills/catalog";
import {
  buildObservedDatapackSchemaSurface,
  writeObservedDatapackSchemaSurface,
} from "./datapackSchemaSurfaces.js";

type Download = {
  url: string;
};

export type IngestDatapackSchemaSurfacesOptions = {
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

export async function ingestDatapackSchemaSurfaces(
  options: IngestDatapackSchemaSurfacesOptions,
): Promise<number> {
  const outputRoot = join(options.root, "packages/data/data/java/datapack-schema-surfaces");
  mkdirSync(outputRoot, { recursive: true });
  const tempRoot = mkdtempSync(join(tmpdir(), "minecraft-skills-datapack-schemas-"));
  let written = 0;

  try {
    for (const version of listVersions("java")) {
      const output = join(outputRoot, `${version.id}.json`);
      if (existsSync(output) && !options.force) {
        options.log?.(`skip ${version.id}: datapack schema surface already exists`);
        continue;
      }

      const detail = getVersionDetail("java", version.id);
      const server = readDownload(detail.downloads, "server");
      const serverJarPath = join(tempRoot, `${safeFileName(version.id)}-server.jar`);

      options.log?.(`fetch ${version.id}: server jar`);
      await downloadToFile(server.url, serverJarPath);

      const surface = buildObservedDatapackSchemaSurface({
        version: detail.version,
        serverJarPath,
        serverJarUrl: server.url,
        retrievedAt: options.retrievedAt,
      });
      writeObservedDatapackSchemaSurface({ root: options.root, surface });
      written += 1;
      options.log?.(`wrote ${version.id}`);

      unlinkSync(serverJarPath);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  return written;
}
