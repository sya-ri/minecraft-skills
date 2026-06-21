import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getVersionDetail, listVersions } from "@minecraft-skills/catalog";
import { buildVanillaData, type VanillaPathIndex } from "./vanillaInventory.js";

type Download = {
  url: string;
};

export type IngestVanillaInventoriesOptions = {
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

function writePathIndex(root: string, version: string, paths: VanillaPathIndex): void {
  const outputRoot = join(root, "packages/data/data/java/vanilla-paths");
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(
    join(outputRoot, `${version}.resourcepack.txt`),
    `${paths.resourcepack.join("\n")}\n`,
  );
  writeFileSync(join(outputRoot, `${version}.datapack.txt`), `${paths.datapack.join("\n")}\n`);
}

export async function ingestVanillaInventories(
  options: IngestVanillaInventoriesOptions,
): Promise<number> {
  const tempRoot = mkdtempSync(join(tmpdir(), "minecraft-skills-vanilla-inventories-"));
  let written = 0;

  try {
    for (const version of listVersions("java")) {
      const output = join(
        options.root,
        `packages/data/data/java/vanilla-inventories/${version.id}.json`,
      );
      if (existsSync(output) && !options.force) {
        options.log?.(`skip ${version.id}: vanilla inventory already exists`);
        continue;
      }

      const detail = getVersionDetail("java", version.id);
      const client = readDownload(detail.downloads, "client");
      const server = readDownload(detail.downloads, "server");
      const baseName = safeFileName(version.id);
      const clientJarPath = join(tempRoot, `${baseName}-client.jar`);
      const serverJarPath = join(tempRoot, `${baseName}-server.jar`);

      options.log?.(`fetch ${version.id}: client jar`);
      await downloadToFile(client.url, clientJarPath);
      options.log?.(`fetch ${version.id}: server jar`);
      await downloadToFile(server.url, serverJarPath);

      const { inventory, paths } = buildVanillaData({
        version: detail.version,
        clientJarPath,
        serverJarPath,
        clientJarUrl: client.url,
        serverJarUrl: server.url,
        retrievedAt: options.retrievedAt,
      });
      writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`);
      writePathIndex(options.root, detail.version, paths);
      written += 1;
      options.log?.(`wrote ${version.id}`);

      unlinkSync(clientJarPath);
      unlinkSync(serverJarPath);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  return written;
}
