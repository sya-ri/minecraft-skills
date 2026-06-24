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
import { listZipEntries, readZipEntry } from "./zip.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = join(packageRoot, "data");
const cacheEnvName = "MINECRAFT_SKILLS_CACHE_DIR";
const minecraftAssetsRepository = "InventivetalentDev/minecraft-assets";
const minecraftAssetsRawBase = `https://raw.githubusercontent.com/${minecraftAssetsRepository}`;
const minecraftAssetsApiBase = `https://api.github.com/repos/${minecraftAssetsRepository}`;
const minecraftAssetsArchiveBase = `https://github.com/${minecraftAssetsRepository}/archive`;

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

export type MinecraftAssetsSource = {
  schemaVersion: 1;
  repository: typeof minecraftAssetsRepository;
  version: string;
  ref: string;
  fetchedAt: string;
  urls: {
    tree: string;
    rawBase: string;
    archive: string;
  };
};

export type MinecraftAssetsIndex = {
  schemaVersion: 1;
  source: MinecraftAssetsSource;
  paths: string[];
};

export type MinecraftAssetsStatus = {
  schemaVersion: 1;
  version: string;
  ref: string;
  cacheRoot: string;
  versionRoot: string;
  sourceFile: string;
  indexFile: string;
  archiveFile: string;
  sourceCached: boolean;
  indexCached: boolean;
  archiveCached: boolean;
  cachedFileCount: number;
};

export type FetchMinecraftAssetFileOptions = {
  version: string;
  path: string;
  ref?: string;
  force?: boolean;
  fetch?: typeof fetch;
};

export type FetchMinecraftAssetFileResult = {
  schemaVersion: 1;
  version: string;
  ref: string;
  path: string;
  file: string;
  bytes: number;
  cached: boolean;
  source: MinecraftAssetsSource;
};

export type FetchMinecraftAssetsIndexOptions = {
  version: string;
  ref?: string;
  force?: boolean;
  fetch?: typeof fetch;
};

export type FetchMinecraftAssetsIndexResult = {
  schemaVersion: 1;
  version: string;
  ref: string;
  file: string;
  pathCount: number;
  cached: boolean;
  source: MinecraftAssetsSource;
};

export type FetchMinecraftAssetsArchiveOptions = FetchMinecraftAssetsIndexOptions;

export type FetchMinecraftAssetsArchiveResult = {
  schemaVersion: 1;
  version: string;
  ref: string;
  file: string;
  bytes: number;
  cached: boolean;
  index: FetchMinecraftAssetsIndexResult;
  source: MinecraftAssetsSource;
};

export type SearchMinecraftAssetsOptions = {
  version: string;
  ref?: string;
  prefix?: string;
  contains?: string;
  suffix?: string;
  extension?: string;
  limit?: number;
};

export type SearchMinecraftAssetsResult = {
  schemaVersion: 1;
  version: string;
  ref: string;
  source: MinecraftAssetsSource;
  total: number;
  matches: string[];
};

export type MojangServerJarStatus = {
  schemaVersion: 1;
  version: string;
  file: string;
  cached: boolean;
  bytes: number | null;
};

export type FetchMojangServerJarOptions = {
  version: string;
  url: string;
  sha1?: string | null;
  force?: boolean;
  fetch?: typeof fetch;
};

export type FetchMojangServerJarResult = {
  schemaVersion: 1;
  version: string;
  url: string;
  sha1: string;
  file: string;
  bytes: number;
  cached: boolean;
};

export type MojangServerJarEntry = {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
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

function assertSafeMinecraftVersion(version: string): void {
  if (
    version.length === 0 ||
    version.includes("\0") ||
    version.includes("/") ||
    version.includes("\\") ||
    version.split(".").includes("..")
  ) {
    throw new Error(`Minecraft asset version must be a safe ref-like value: ${version}`);
  }
}

function assertSafeAssetPath(assetPath: string): void {
  assertSafeRelativePath(assetPath);
  if (!assetPath.startsWith("assets/")) {
    throw new Error(`Minecraft asset path must start with assets/: ${assetPath}`);
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

function minecraftAssetsRoot(): string {
  return join(cacheRootForPlatform(), "minecraft-assets");
}

function minecraftAssetsVersionRoot(version: string): string {
  assertSafeMinecraftVersion(version);
  return join(minecraftAssetsRoot(), version);
}

function minecraftAssetsSourceFile(version: string): string {
  return join(minecraftAssetsVersionRoot(version), "source.json");
}

function minecraftAssetsIndexFile(version: string): string {
  return join(minecraftAssetsVersionRoot(version), "index.json");
}

function minecraftAssetsArchiveFile(version: string): string {
  return join(minecraftAssetsVersionRoot(version), "archive.zip");
}

function mojangServerJarsRoot(): string {
  return join(cacheRootForPlatform(), "mojang-server-jars");
}

function mojangServerJarFile(version: string): string {
  assertSafeMinecraftVersion(version);
  return join(mojangServerJarsRoot(), `${version}.jar`);
}

function minecraftAssetsCachedFile(version: string, assetPath: string): string {
  assertSafeAssetPath(assetPath);
  return join(minecraftAssetsVersionRoot(version), "files", assetPath);
}

function minecraftAssetsRef(version: string, ref = version): string {
  assertSafeMinecraftVersion(version);
  if (ref.length === 0 || ref.includes("\0")) {
    throw new Error(`Minecraft asset ref must be a safe non-empty value: ${ref}`);
  }
  return ref;
}

function encodeRef(ref: string): string {
  return ref
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function minecraftAssetsSource(version: string, ref = version): MinecraftAssetsSource {
  const resolvedRef = minecraftAssetsRef(version, ref);
  const encodedRef = encodeRef(resolvedRef);
  return {
    schemaVersion: 1,
    repository: minecraftAssetsRepository,
    version,
    ref: resolvedRef,
    fetchedAt: new Date().toISOString(),
    urls: {
      tree: `${minecraftAssetsApiBase}/git/trees/${encodedRef}?recursive=1`,
      rawBase: `${minecraftAssetsRawBase}/${encodedRef}`,
      archive: `${minecraftAssetsArchiveBase}/${encodedRef}.zip`,
    },
  };
}

function cachedMinecraftAssetsSource(version: string): MinecraftAssetsSource | undefined {
  const file = minecraftAssetsSourceFile(version);
  if (!existsSync(file)) {
    return undefined;
  }
  return JSON.parse(readFileSync(file, "utf8")) as MinecraftAssetsSource;
}

function assertCompatibleMinecraftAssetsRef(
  version: string,
  ref: string,
  force: boolean | undefined,
): void {
  if (force) {
    return;
  }
  const cached = cachedMinecraftAssetsSource(version);
  if (cached && cached.ref !== ref) {
    throw new Error(
      `Minecraft assets cache for ${version} uses ref ${cached.ref}, not ${ref}; pass force to replace it`,
    );
  }
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

export function getMinecraftAssetsCacheRoot(): string {
  return minecraftAssetsRoot();
}

export function getMinecraftAssetsVersionCacheRoot(version: string): string {
  return minecraftAssetsVersionRoot(version);
}

export function getCachedMinecraftAssetPath(version: string, assetPath: string): string {
  return minecraftAssetsCachedFile(version, assetPath);
}

export function hasCachedMinecraftAssetFile(version: string, assetPath: string): boolean {
  return existsSync(minecraftAssetsCachedFile(version, assetPath));
}

export function readCachedMinecraftAssetText(version: string, assetPath: string): string {
  return readFileSync(minecraftAssetsCachedFile(version, assetPath), "utf8");
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

function countCachedMinecraftAssetFiles(version: string): number {
  const root = join(minecraftAssetsVersionRoot(version), "files");
  if (!existsSync(root)) {
    return 0;
  }
  let count = 0;
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
      if (entry.isFile()) {
        count += 1;
      }
    }
  }
  return count;
}

export function getMinecraftAssetsStatus(version: string, ref = version): MinecraftAssetsStatus {
  const resolvedRef = minecraftAssetsRef(version, ref);
  const sourceFile = minecraftAssetsSourceFile(version);
  const indexFile = minecraftAssetsIndexFile(version);
  const archiveFile = minecraftAssetsArchiveFile(version);
  return {
    schemaVersion: 1,
    version,
    ref: resolvedRef,
    cacheRoot: minecraftAssetsRoot(),
    versionRoot: minecraftAssetsVersionRoot(version),
    sourceFile,
    indexFile,
    archiveFile,
    sourceCached: existsSync(sourceFile),
    indexCached: existsSync(indexFile),
    archiveCached: existsSync(archiveFile),
    cachedFileCount: countCachedMinecraftAssetFiles(version),
  };
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

async function fetchJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function writeJsonAtomic(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const tempFile = join(tmpdir(), `minecraft-skills-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(tempFile, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tempFile, file);
}

function writeBytesAtomic(file: string, bytes: Buffer): void {
  mkdirSync(dirname(file), { recursive: true });
  const tempFile = join(tmpdir(), `minecraft-skills-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(tempFile, bytes);
  renameSync(tempFile, file);
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha1(buffer: Buffer): string {
  return createHash("sha1").update(buffer).digest("hex");
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
    writeBytesAtomic(output, bytes);
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

export function getMojangServerJarStatus(version: string): MojangServerJarStatus {
  const file = mojangServerJarFile(version);
  return {
    schemaVersion: 1,
    version,
    file,
    cached: existsSync(file),
    bytes: existsSync(file) ? statSync(file).size : null,
  };
}

export async function fetchMojangServerJar(
  options: FetchMojangServerJarOptions,
): Promise<FetchMojangServerJarResult> {
  assertSafeMinecraftVersion(options.version);
  const output = mojangServerJarFile(options.version);
  if (!options.force && existsSync(output)) {
    const bytes = readFileSync(output);
    return {
      schemaVersion: 1,
      version: options.version,
      url: options.url,
      sha1: sha1(bytes),
      file: output,
      bytes: bytes.length,
      cached: true,
    };
  }
  const bytes = await fetchBytes(options.url, options.fetch ?? fetch);
  const actualSha1 = sha1(bytes);
  if (options.sha1 && actualSha1 !== options.sha1) {
    throw new Error(
      `Integrity mismatch for Mojang server jar ${options.version}: expected ${options.sha1}, got ${actualSha1}`,
    );
  }
  writeBytesAtomic(output, bytes);
  return {
    schemaVersion: 1,
    version: options.version,
    url: options.url,
    sha1: actualSha1,
    file: output,
    bytes: bytes.length,
    cached: false,
  };
}

function readCachedMojangServerJar(version: string): Buffer {
  const file = mojangServerJarFile(version);
  if (!existsSync(file)) {
    throw new Error(
      [
        `No cached Mojang server jar for ${version}.`,
        `In MCP, call fetch_mojang_server_jar with {"version":"${version}"}, then retry.`,
      ].join(" "),
    );
  }
  return readFileSync(file);
}

export function listCachedMojangServerJarEntries(version: string): MojangServerJarEntry[] {
  const jar = readCachedMojangServerJar(version);
  return listZipEntries(jar)
    .filter((entry) => !entry.directory)
    .map((entry) => ({
      path: entry.name,
      compressedSize: entry.compressedSize,
      uncompressedSize: entry.uncompressedSize,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function readCachedMojangServerJarText(version: string, path: string): string {
  assertSafeRelativePath(path);
  const jar = readCachedMojangServerJar(version);
  return readZipEntry(jar, path).toString("utf8");
}

export async function fetchMinecraftAssetFile(
  options: FetchMinecraftAssetFileOptions,
): Promise<FetchMinecraftAssetFileResult> {
  const source = minecraftAssetsSource(options.version, options.ref);
  assertCompatibleMinecraftAssetsRef(options.version, source.ref, options.force);
  assertSafeAssetPath(options.path);
  const output = minecraftAssetsCachedFile(options.version, options.path);
  if (!options.force && existsSync(output)) {
    return {
      schemaVersion: 1,
      version: options.version,
      ref: source.ref,
      path: options.path,
      file: output,
      bytes: statSync(output).size,
      cached: true,
      source,
    };
  }
  const url = `${source.urls.rawBase}/${options.path}`;
  const bytes = await fetchBytes(url, options.fetch ?? fetch);
  writeBytesAtomic(output, bytes);
  writeJsonAtomic(minecraftAssetsSourceFile(options.version), source);
  return {
    schemaVersion: 1,
    version: options.version,
    ref: source.ref,
    path: options.path,
    file: output,
    bytes: bytes.length,
    cached: false,
    source,
  };
}

type GitHubTreeResponse = {
  tree?: Array<{
    path?: string;
    type?: string;
  }>;
  truncated?: boolean;
};

export async function fetchMinecraftAssetsIndex(
  options: FetchMinecraftAssetsIndexOptions,
): Promise<FetchMinecraftAssetsIndexResult> {
  const source = minecraftAssetsSource(options.version, options.ref);
  assertCompatibleMinecraftAssetsRef(options.version, source.ref, options.force);
  const output = minecraftAssetsIndexFile(options.version);
  if (!options.force && existsSync(output)) {
    const index = JSON.parse(readFileSync(output, "utf8")) as MinecraftAssetsIndex;
    return {
      schemaVersion: 1,
      version: options.version,
      ref: index.source.ref,
      file: output,
      pathCount: index.paths.length,
      cached: true,
      source: index.source,
    };
  }
  const tree = await fetchJson<GitHubTreeResponse>(source.urls.tree, options.fetch ?? fetch);
  if (!Array.isArray(tree.tree)) {
    throw new Error(`Invalid GitHub tree response for ${minecraftAssetsRepository} ${source.ref}`);
  }
  if (tree.truncated) {
    throw new Error(
      `GitHub tree response was truncated for ${minecraftAssetsRepository} ${source.ref}`,
    );
  }
  const paths = tree.tree
    .filter((entry) => entry.type === "blob" && typeof entry.path === "string")
    .map((entry) => entry.path ?? "")
    .filter((path) => path.startsWith("assets/"))
    .sort((left, right) => left.localeCompare(right));
  const index: MinecraftAssetsIndex = {
    schemaVersion: 1,
    source,
    paths,
  };
  writeJsonAtomic(output, index);
  writeJsonAtomic(minecraftAssetsSourceFile(options.version), source);
  return {
    schemaVersion: 1,
    version: options.version,
    ref: source.ref,
    file: output,
    pathCount: paths.length,
    cached: false,
    source,
  };
}

export async function fetchMinecraftAssetsArchive(
  options: FetchMinecraftAssetsArchiveOptions,
): Promise<FetchMinecraftAssetsArchiveResult> {
  const source = minecraftAssetsSource(options.version, options.ref);
  assertCompatibleMinecraftAssetsRef(options.version, source.ref, options.force);
  const output = minecraftAssetsArchiveFile(options.version);
  const index = await fetchMinecraftAssetsIndex(options);
  if (!options.force && existsSync(output)) {
    return {
      schemaVersion: 1,
      version: options.version,
      ref: source.ref,
      file: output,
      bytes: statSync(output).size,
      cached: true,
      index,
      source,
    };
  }
  const bytes = await fetchBytes(source.urls.archive, options.fetch ?? fetch);
  writeBytesAtomic(output, bytes);
  writeJsonAtomic(minecraftAssetsSourceFile(options.version), source);
  return {
    schemaVersion: 1,
    version: options.version,
    ref: source.ref,
    file: output,
    bytes: bytes.length,
    cached: false,
    index,
    source,
  };
}

export function readMinecraftAssetsIndex(version: string): MinecraftAssetsIndex {
  const indexFile = minecraftAssetsIndexFile(version);
  if (!existsSync(indexFile)) {
    throw new Error(
      [
        `No cached Minecraft assets index for ${version}.`,
        `In MCP, call fetch_resourcepack_assets with {"version":"${version}","indexOnly":true}, then retry the search.`,
        `In CLI, run minecraft-skills resourcepack assets fetch ${version} --index-only.`,
      ].join(" "),
    );
  }
  return JSON.parse(readFileSync(indexFile, "utf8")) as MinecraftAssetsIndex;
}

export function searchMinecraftAssets(
  options: SearchMinecraftAssetsOptions,
): SearchMinecraftAssetsResult {
  const index = readMinecraftAssetsIndex(options.version);
  if (options.ref && options.ref !== index.source.ref) {
    throw new Error(
      `Cached Minecraft assets index for ${options.version} uses ref ${index.source.ref}, not ${options.ref}`,
    );
  }
  const limit = options.limit ?? 50;
  let paths = index.paths;
  if (options.prefix) {
    paths = paths.filter((path) => path.startsWith(options.prefix ?? ""));
  }
  if (options.contains) {
    paths = paths.filter((path) => path.includes(options.contains ?? ""));
  }
  if (options.suffix) {
    paths = paths.filter((path) => path.endsWith(options.suffix ?? ""));
  }
  if (options.extension) {
    const extension = options.extension.startsWith(".")
      ? options.extension
      : `.${options.extension}`;
    paths = paths.filter((path) => path.endsWith(extension));
  }
  return {
    schemaVersion: 1,
    version: index.source.version,
    ref: index.source.ref,
    source: index.source,
    total: paths.length,
    matches: paths.slice(0, limit),
  };
}

export function cleanCachedData(dataVersion = getDataManifest().dataVersion): string {
  const root = cacheDataRoot(dataVersion);
  rmSync(root, { recursive: true, force: true });
  return root;
}
