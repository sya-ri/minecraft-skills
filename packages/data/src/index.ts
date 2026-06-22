import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = join(packageRoot, "data");
const cacheEnvName = "MINECRAFT_SKILLS_CACHE_DIR";

export type DataManifestEntry = {
  path: string;
  kind: string;
  edition?: string;
  version?: string;
  size: number;
  sha256: string;
  url: string;
};

export type DataManifest = {
  schemaVersion: 1;
  dataVersion: string;
  defaultBaseUrl: string;
  cache: {
    environmentVariable: typeof cacheEnvName;
  };
  downloadable: DataManifestEntry[];
};

export type FetchDataOptions = {
  path?: string;
  kind?: string;
  version?: string;
  baseUrl?: string;
  force?: boolean;
  fetch?: typeof fetch;
};

export type FetchDataResult = {
  dataVersion: string;
  cacheRoot: string;
  fetched: Array<{
    path: string;
    file: string;
    bytes: number;
    sha256: string;
  }>;
  skipped: Array<{
    path: string;
    file: string;
    reason: "already-cached";
  }>;
};

export type CachedDataFile = {
  dataVersion: string;
  path: string;
  file: string;
  bytes: number;
};

function assertSafeRelativePath(relativePath: string): void {
  if (
    relativePath.length === 0 ||
    relativePath.includes("\0") ||
    isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/).includes("..")
  ) {
    throw new Error(`Data path must be a safe relative path: ${relativePath}`);
  }
}

function bundledPath(relativePath: string): string {
  assertSafeRelativePath(relativePath);
  return join(dataRoot, relativePath);
}

function readBundledManifest(): DataManifest {
  return JSON.parse(readFileSync(bundledPath("data-manifest.json"), "utf8")) as DataManifest;
}

function cacheRootForPlatform(): string {
  const override = process.env[cacheEnvName];
  if (override) {
    return override;
  }
  const home = homedir();
  if (platform() === "darwin") {
    return join(home, "Library", "Caches", "minecraft-skills");
  }
  if (platform() === "win32") {
    return join(
      process.env.LOCALAPPDATA ?? join(home, "AppData", "Local"),
      "minecraft-skills",
      "Cache",
    );
  }
  return join(process.env.XDG_CACHE_HOME ?? join(home, ".cache"), "minecraft-skills");
}

function cacheDataRoot(dataVersion = getDataManifest().dataVersion): string {
  assertSafeRelativePath(dataVersion);
  return join(cacheRootForPlatform(), "data", dataVersion);
}

function cachedPath(relativePath: string, dataVersion = getDataManifest().dataVersion): string {
  assertSafeRelativePath(relativePath);
  return join(cacheDataRoot(dataVersion), relativePath);
}

function resolveDataPath(relativePath: string): string {
  const bundled = bundledPath(relativePath);
  if (existsSync(bundled)) {
    return bundled;
  }
  const cached = cachedPath(relativePath);
  if (existsSync(cached)) {
    return cached;
  }
  return bundled;
}

export function readDataJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolveDataPath(relativePath), "utf8")) as T;
}

export function readDataText(relativePath: string): string {
  return readFileSync(resolveDataPath(relativePath), "utf8");
}

export function hasDataFile(relativePath: string): boolean {
  return hasBundledDataFile(relativePath) || hasCachedDataFile(relativePath);
}

export function hasBundledDataFile(relativePath: string): boolean {
  return existsSync(bundledPath(relativePath));
}

export function hasCachedDataFile(
  relativePath: string,
  dataVersion = getDataManifest().dataVersion,
): boolean {
  return existsSync(cachedPath(relativePath, dataVersion));
}

export function getDataRoot(): string {
  return dataRoot;
}

export function getDataManifest(): DataManifest {
  return readBundledManifest();
}

export function getCacheRoot(): string {
  return cacheRootForPlatform();
}

export function getCacheDataRoot(dataVersion = getDataManifest().dataVersion): string {
  return cacheDataRoot(dataVersion);
}

export function getCachedDataPath(
  relativePath: string,
  dataVersion = getDataManifest().dataVersion,
): string {
  return cachedPath(relativePath, dataVersion);
}

export function listCachedDataFiles(dataVersion = getDataManifest().dataVersion): CachedDataFile[] {
  const root = cacheDataRoot(dataVersion);
  if (!existsSync(root)) {
    return [];
  }
  const found: CachedDataFile[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relative = absolute.slice(root.length + 1);
      found.push({
        dataVersion,
        path: relative,
        file: absolute,
        bytes: statSync(absolute).size,
      });
    }
  }
  return found.sort((left, right) => left.path.localeCompare(right.path));
}

function matchingEntries(options: FetchDataOptions): DataManifestEntry[] {
  const manifest = getDataManifest();
  return manifest.downloadable.filter((entry) => {
    if (options.path && entry.path !== options.path) {
      return false;
    }
    if (options.kind && entry.kind !== options.kind) {
      return false;
    }
    if (options.version && entry.version !== options.version) {
      return false;
    }
    return true;
  });
}

function entryUrl(entry: DataManifestEntry, options: FetchDataOptions): string {
  if (!options.baseUrl) {
    return entry.url;
  }
  return `${options.baseUrl.replace(/\/$/, "")}/${entry.path}`;
}

async function fetchBytes(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function fetchData(options: FetchDataOptions = {}): Promise<FetchDataResult> {
  const manifest = getDataManifest();
  const entries = matchingEntries(options);
  if (entries.length === 0) {
    throw new Error("No downloadable data entries matched the request");
  }
  const fetchImpl = options.fetch ?? fetch;
  const fetched: FetchDataResult["fetched"] = [];
  const skipped: FetchDataResult["skipped"] = [];

  for (const entry of entries) {
    const output = cachedPath(entry.path, manifest.dataVersion);
    if (!options.force && existsSync(output)) {
      skipped.push({ path: entry.path, file: output, reason: "already-cached" });
      continue;
    }
    const bytes = await fetchBytes(entryUrl(entry, options), fetchImpl);
    const actualSha256 = sha256(bytes);
    if (actualSha256 !== entry.sha256) {
      throw new Error(
        `Integrity mismatch for ${entry.path}: expected ${entry.sha256}, got ${actualSha256}`,
      );
    }
    mkdirSync(dirname(output), { recursive: true });
    const tempFile = join(tmpdir(), `minecraft-skills-${process.pid}-${Date.now()}.tmp`);
    writeFileSync(tempFile, bytes);
    renameSync(tempFile, output);
    fetched.push({
      path: entry.path,
      file: output,
      bytes: bytes.length,
      sha256: actualSha256,
    });
  }

  return {
    dataVersion: manifest.dataVersion,
    cacheRoot: getCacheRoot(),
    fetched,
    skipped,
  };
}

export function cleanCachedData(dataVersion = getDataManifest().dataVersion): string {
  const root = cacheDataRoot(dataVersion);
  rmSync(root, { recursive: true, force: true });
  return root;
}
