import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openZipArchive, type ZipArchive } from "./zip.js";

export type { ZipArchive, ZipEntry } from "./zip.js";
export {
  listZipEntries,
  openZipArchive,
  readZipEntries,
  readZipEntry,
} from "./zip.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = join(packageRoot, "data");
const cacheEnvName = "MINECRAFT_SKILLS_CACHE_DIR";
const minecraftAssetsRepository = "InventivetalentDev/minecraft-assets";
const minecraftAssetsRawBase = `https://raw.githubusercontent.com/${minecraftAssetsRepository}`;
const minecraftAssetsApiBase = `https://api.github.com/repos/${minecraftAssetsRepository}`;
const minecraftAssetsArchiveBase = `https://github.com/${minecraftAssetsRepository}/archive`;
const maxMojangServerJarBytes = 256 * 1024 * 1024;
const maxBundledServerJarBytes = 128 * 1024 * 1024;
const maxBundlerVersionsListBytes = 1024 * 1024;
const maxMojangServerJarTextBytes = 2 * 1024 * 1024;
const maxMojangServerJarFetchTimeoutMs = 120_000;
const defaultMojangServerJarFetchTimeoutMs = 30_000;
const maxBundlerVersionLineCharacters = 8_192;
const maxBundlerVersionIdCharacters = 128;
const maxBundlerRelativePathCharacters = 4_000;

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
  /** Optional per-entry download deadline, including response body consumption. */
  timeoutMs?: number;
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
  size?: number | null;
  force?: boolean;
  timeoutMs?: number;
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

export type CleanMojangServerJarResult = {
  schemaVersion: 1;
  version: string;
  file: string;
  removed: boolean;
  bytesFreed: number;
};

export type MojangServerJarEntry = {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
};

export type MojangServerJarVerification = {
  sha1?: string | null;
  size?: number | null;
};

export type MojangServerJarTextEntry = MojangServerJarEntry & {
  content: string;
};

export type ScanCachedMojangServerJarTextOptions = {
  include?: (entry: MojangServerJarEntry) => boolean;
  maxEntries?: number;
  maxEntryBytes?: number;
  maxTotalBytes?: number;
  sha1?: string | null;
  size?: number | null;
};

export type ScanCachedMojangServerJarTextResult = {
  entries: MojangServerJarEntry[];
  selectedEntries: number;
  scannedEntries: number;
  scannedBytes: number;
  skippedOversizedEntries: number;
  skippedBudgetEntries: number;
  skippedPaths: string[];
  truncated: boolean;
  texts: MojangServerJarTextEntry[];
};

function assertSafeRelativePath(relativePath: string): void {
  if (
    relativePath.length === 0 ||
    relativePath.length > 4_096 ||
    relativePath.includes("\0") ||
    isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/).includes("..")
  ) {
    throw new Error("Data path must be a safe relative path containing 1 to 4096 characters");
  }
}

function assertSafeMinecraftVersion(version: string): void {
  if (
    version.length === 0 ||
    version.length > 128 ||
    version.includes("\0") ||
    version.includes("/") ||
    version.includes("\\") ||
    version.split(".").includes("..")
  ) {
    throw new Error(
      "Minecraft asset version must be a safe ref-like value of at most 128 characters",
    );
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
      const logicalPath = relative(root, absolute).split(sep).join("/");
      found.push({
        dataVersion,
        path: logicalPath,
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

async function fetchBytes(
  url: string,
  fetchImpl: typeof fetch,
  maxBytes?: number,
  timeoutMs?: number,
): Promise<Buffer> {
  const controller = timeoutMs === undefined ? undefined : new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout =
    timeoutMs === undefined
      ? undefined
      : new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Fetch timed out after ${timeoutMs} ms`));
            controller?.abort();
          }, timeoutMs);
        });
  const withinDeadline = <T>(operation: Promise<T>): Promise<T> =>
    timeout ? Promise.race([operation, timeout]) : operation;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await withinDeadline(
      fetchImpl(url, controller ? { signal: controller.signal } : undefined),
    );
    if (!response.ok) {
      await withinDeadline(response.body?.cancel() ?? Promise.resolve());
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    if (maxBytes === undefined) {
      return Buffer.from(await withinDeadline(response.arrayBuffer()));
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
      await withinDeadline(response.body?.cancel() ?? Promise.resolve());
      throw new Error(`Refusing to fetch ${url}: response exceeds ${maxBytes} bytes`);
    }
    if (!response.body) {
      const bytes = Buffer.from(await withinDeadline(response.arrayBuffer()));
      if (bytes.length > maxBytes) {
        throw new Error(`Refusing to fetch ${url}: response exceeds ${maxBytes} bytes`);
      }
      return bytes;
    }
    reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    while (true) {
      const chunk = await withinDeadline(reader.read());
      if (chunk.done) {
        break;
      }
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maxBytes) {
        await withinDeadline(reader.cancel());
        throw new Error(`Refusing to fetch ${url}: response exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(chunk.value));
    }
    return Buffer.concat(chunks, totalBytes);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    if (controller?.signal.aborted && reader) {
      void reader.cancel().catch(() => undefined);
    }
    reader?.releaseLock();
  }
}

function readBoundedRegularFile(
  file: string,
  maxBytes: number,
  expectedSize: number | null | undefined,
  label: string,
): Buffer {
  const descriptor = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const before = fstatSync(descriptor);
    if (!before.isFile()) {
      throw new Error(`${label} is not a regular file`);
    }
    if (before.size > maxBytes || (expectedSize != null && before.size !== expectedSize)) {
      throw new Error(`${label} has an unexpected size`);
    }
    const bytes = Buffer.allocUnsafe(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const read = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (read === 0) {
        throw new Error(`${label} changed while being read`);
      }
      offset += read;
    }
    const after = fstatSync(descriptor);
    if (
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs
    ) {
      throw new Error(`${label} changed while being read`);
    }
    return bytes;
  } finally {
    closeSync(descriptor);
  }
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function fetchData(options: FetchDataOptions = {}): Promise<FetchDataResult> {
  if (
    options.timeoutMs !== undefined &&
    (!Number.isSafeInteger(options.timeoutMs) ||
      options.timeoutMs < 1 ||
      options.timeoutMs > 120_000)
  ) {
    throw new Error("fetchData timeoutMs must be an integer between 1 and 120000");
  }
  const manifest = getDataManifest();
  const entries = matchingEntries(options);
  if (entries.length === 0) {
    throw new Error("No downloadable data entries matched the request");
  }
  const fetchImpl = options.fetch ?? fetch;
  const fetched: FetchDataResult["fetched"] = [];
  const skipped: FetchDataResult["skipped"] = [];

  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
      throw new Error(`Invalid manifest size for ${entry.path}`);
    }
    const output = cachedPath(entry.path, manifest.dataVersion);
    if (!options.force && existsSync(output)) {
      skipped.push({ path: entry.path, file: output, reason: "already-cached" });
      continue;
    }
    const bytes = await fetchBytes(
      entryUrl(entry, options),
      fetchImpl,
      entry.size,
      options.timeoutMs,
    );
    if (bytes.length !== entry.size) {
      throw new Error(
        `Size mismatch for ${entry.path}: expected ${entry.size} bytes, got ${bytes.length}`,
      );
    }
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

export function cleanMojangServerJar(version: string): CleanMojangServerJarResult {
  assertSafeMinecraftVersion(version);
  const file = mojangServerJarFile(version);
  const removed = existsSync(file);
  const bytesFreed = removed ? statSync(file).size : 0;
  rmSync(file, { force: true });
  return {
    schemaVersion: 1,
    version,
    file,
    removed,
    bytesFreed,
  };
}

export async function fetchMojangServerJar(
  options: FetchMojangServerJarOptions,
): Promise<FetchMojangServerJarResult> {
  assertSafeMinecraftVersion(options.version);
  if (options.sha1 != null && !/^[0-9a-f]{40}$/.test(options.sha1)) {
    throw new Error("Mojang server jar SHA-1 must contain 40 lowercase hexadecimal characters");
  }
  if (
    options.size != null &&
    (!Number.isSafeInteger(options.size) ||
      options.size < 0 ||
      options.size > maxMojangServerJarBytes)
  ) {
    throw new Error(`Mojang server jar size must be between 0 and ${maxMojangServerJarBytes}`);
  }
  const timeoutMs = options.timeoutMs ?? defaultMojangServerJarFetchTimeoutMs;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > maxMojangServerJarFetchTimeoutMs
  ) {
    throw new Error(
      `Mojang server jar fetch timeout must be between 1 and ${maxMojangServerJarFetchTimeoutMs} ms`,
    );
  }
  const output = mojangServerJarFile(options.version);
  if (!options.force && existsSync(output)) {
    let bytes: Buffer;
    try {
      bytes = readBoundedRegularFile(
        output,
        maxMojangServerJarBytes,
        options.size,
        `Cached Mojang server jar ${options.version}`,
      );
    } catch (error) {
      throw new Error(`${errorMessage(error)}; refetch it with force enabled`);
    }
    const actualSha1 = sha1(bytes);
    if (options.sha1 && actualSha1 !== options.sha1) {
      throw new Error(
        `Cached Mojang server jar ${options.version} failed SHA-1 verification; refetch it with force enabled`,
      );
    }
    return {
      schemaVersion: 1,
      version: options.version,
      url: options.url,
      sha1: actualSha1,
      file: output,
      bytes: bytes.length,
      cached: true,
    };
  }
  const bytes = await fetchBytes(
    options.url,
    options.fetch ?? fetch,
    options.size ?? maxMojangServerJarBytes,
    timeoutMs,
  );
  if (options.size != null && bytes.length !== options.size) {
    throw new Error(
      `Size mismatch for Mojang server jar ${options.version}: expected ${options.size}, got ${bytes.length}`,
    );
  }
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

function readCachedMojangServerJar(
  version: string,
  verification: MojangServerJarVerification = {},
): Buffer {
  const file = mojangServerJarFile(version);
  if (!existsSync(file)) {
    throw new Error(
      [
        `No cached Mojang server jar for ${version}.`,
        `In the CLI, run minecraft-skills datapack vanilla-json fetch ${version}, then retry.`,
        `In MCP, call fetch_mojang_server_jar with {"version":"${version}"}, then retry.`,
      ].join(" "),
    );
  }
  if (verification.sha1 != null && !/^[0-9a-f]{40}$/.test(verification.sha1)) {
    throw new Error("Mojang server jar SHA-1 must contain 40 lowercase hexadecimal characters");
  }
  let jar: Buffer;
  try {
    jar = readBoundedRegularFile(
      file,
      maxMojangServerJarBytes,
      verification.size,
      `Cached Mojang server jar ${version}`,
    );
  } catch (error) {
    throw new Error(`${errorMessage(error)}; remove or refetch it`);
  }
  if (verification.sha1 && sha1(jar) !== verification.sha1) {
    throw new Error(`Cached Mojang server jar ${version} failed SHA-1 verification; refetch it`);
  }
  return jar;
}

function resolveMojangServerJarPayload(version: string, outerJar: Buffer): ZipArchive {
  const outerArchive = openZipArchive(outerJar);
  const outerEntries = outerArchive.entries;
  const versionsListPath = "META-INF/versions.list";
  const versionsListEntry = outerEntries.find(
    (entry) => entry.name === versionsListPath && !entry.directory,
  );
  if (!versionsListEntry) {
    if (outerEntries.some((entry) => entry.name.startsWith("data/") && !entry.directory)) {
      return outerArchive;
    }
    throw new Error(
      `Cached Mojang server jar ${version} contains neither datapack data nor bundler metadata`,
    );
  }
  if (versionsListEntry.uncompressedSize > maxBundlerVersionsListBytes) {
    throw new Error(`Mojang bundler versions list exceeds ${maxBundlerVersionsListBytes} bytes`);
  }
  let versionsList: string;
  try {
    versionsList = new TextDecoder("utf-8", { fatal: true }).decode(
      outerArchive.readEntry(versionsListPath),
    );
  } catch (error) {
    throw new Error(`Invalid Mojang bundler versions list: ${errorMessage(error)}`);
  }
  const lines = versionsList.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 1 || lines.length > 1_024) {
    throw new Error("Invalid Mojang bundler versions list: expected 1 to 1024 entries");
  }
  const versions = lines.map((line) => {
    if (line.length > maxBundlerVersionLineCharacters) {
      throw new Error(
        `Invalid Mojang bundler versions list entry: line exceeds ${maxBundlerVersionLineCharacters} characters`,
      );
    }
    const fields = line.split("\t");
    if (fields.length !== 3) {
      throw new Error("Invalid Mojang bundler versions list entry");
    }
    const [expectedSha256, id, relativePath] = fields as [string, string, string];
    if (
      id.length < 1 ||
      id.length > maxBundlerVersionIdCharacters ||
      relativePath.length < 1 ||
      relativePath.length > maxBundlerRelativePathCharacters
    ) {
      throw new Error(
        "Invalid Mojang bundler versions list entry: id or path length is out of bounds",
      );
    }
    if (!/^[0-9a-f]{64}$/.test(expectedSha256)) {
      throw new Error("Invalid Mojang bundler SHA-256");
    }
    assertSafeMinecraftVersion(id);
    assertSafeRelativePath(relativePath);
    if (!/^[A-Za-z0-9._/-]+$/.test(relativePath) || relativePath.includes("//")) {
      throw new Error("Invalid Mojang bundler relative path");
    }
    return { expectedSha256, id, path: `META-INF/versions/${relativePath}` };
  });
  const matchingVersions = versions.filter((entry) => entry.id === version);
  if (matchingVersions.length !== 1) {
    throw new Error(
      `Invalid Mojang bundler versions list: expected exactly one entry for ${version}`,
    );
  }
  const bundledPath = matchingVersions[0]?.path;
  const expectedSha256 = matchingVersions[0]?.expectedSha256;
  if (!bundledPath || !expectedSha256) {
    throw new Error(`Invalid Mojang bundler versions list entry for ${version}`);
  }
  const bundledEntries = outerEntries.filter(
    (entry) => entry.name === bundledPath && !entry.directory,
  );
  const bundledEntry = bundledEntries[0];
  if (bundledEntries.length !== 1 || !bundledEntry) {
    throw new Error(`Invalid Mojang bundler archive: expected exactly one ${bundledPath}`);
  }
  if (bundledEntry.uncompressedSize > maxBundledServerJarBytes) {
    throw new Error(
      `Bundled Mojang server jar ${bundledPath} exceeds ${maxBundledServerJarBytes} bytes`,
    );
  }
  const payload = outerArchive.readEntry(bundledPath);
  const actualSha256 = sha256(payload);
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Mojang bundled server jar ${bundledPath} failed SHA-256 verification: expected ${expectedSha256}, got ${actualSha256}`,
    );
  }
  const payloadArchive = openZipArchive(payload);
  if (!payloadArchive.entries.some((entry) => entry.name.startsWith("data/") && !entry.directory)) {
    throw new Error(`Mojang bundled server jar ${bundledPath} contains no datapack data`);
  }
  return payloadArchive;
}

function mojangServerJarEntries(archive: ZipArchive): MojangServerJarEntry[] {
  const entries = archive.entries
    .filter((entry) => !entry.directory)
    .map((entry) => ({
      path: entry.name,
      compressedSize: entry.compressedSize,
      uncompressedSize: entry.uncompressedSize,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index - 1]?.path === entries[index]?.path) {
      throw new Error(`Invalid Mojang server jar: duplicate entry ${entries[index]?.path}`);
    }
  }
  return entries;
}

export function listCachedMojangServerJarEntries(
  version: string,
  verification: MojangServerJarVerification = {},
): MojangServerJarEntry[] {
  const archive = resolveMojangServerJarPayload(
    version,
    readCachedMojangServerJar(version, verification),
  );
  return mojangServerJarEntries(archive);
}

export function readCachedMojangServerJarText(
  version: string,
  path: string,
  verification: MojangServerJarVerification = {},
): string {
  assertSafeRelativePath(path);
  const archive = resolveMojangServerJarPayload(
    version,
    readCachedMojangServerJar(version, verification),
  );
  const entry = mojangServerJarEntries(archive).find((candidate) => candidate.path === path);
  if (!entry) {
    throw new Error(`Zip entry not found: ${path}`);
  }
  if (entry.uncompressedSize > maxMojangServerJarTextBytes) {
    throw new Error(
      `Mojang server jar text entry ${path} exceeds ${maxMojangServerJarTextBytes} bytes`,
    );
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(archive.readEntry(path));
  } catch (error) {
    throw new Error(`Mojang server jar text entry ${path} is invalid: ${errorMessage(error)}`);
  }
}

function boundedPositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
  label: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}`);
  }
  return resolved;
}

export function scanCachedMojangServerJarText(
  version: string,
  options: ScanCachedMojangServerJarTextOptions = {},
): ScanCachedMojangServerJarTextResult {
  assertSafeMinecraftVersion(version);
  const maxEntries = boundedPositiveInteger(options.maxEntries, 10_000, 20_000, "maxEntries");
  const maxEntryBytes = boundedPositiveInteger(
    options.maxEntryBytes,
    2 * 1024 * 1024,
    8 * 1024 * 1024,
    "maxEntryBytes",
  );
  const maxTotalBytes = boundedPositiveInteger(
    options.maxTotalBytes,
    64 * 1024 * 1024,
    128 * 1024 * 1024,
    "maxTotalBytes",
  );
  const archive = resolveMojangServerJarPayload(
    version,
    readCachedMojangServerJar(version, {
      ...(options.sha1 !== undefined ? { sha1: options.sha1 } : {}),
      ...(options.size !== undefined ? { size: options.size } : {}),
    }),
  );
  const entries = mojangServerJarEntries(archive);
  const selected = options.include ? entries.filter(options.include) : entries;
  const paths: string[] = [];
  let scannedBytes = 0;
  let skippedOversizedEntries = 0;
  let skippedBudgetEntries = 0;
  const skippedPaths: string[] = [];
  const recordSkipped = (path: string) => {
    if (skippedPaths.length < 20) {
      skippedPaths.push(path);
    }
  };

  for (const entry of selected) {
    if (entry.uncompressedSize > maxEntryBytes) {
      skippedOversizedEntries += 1;
      recordSkipped(entry.path);
      continue;
    }
    if (paths.length >= maxEntries || scannedBytes + entry.uncompressedSize > maxTotalBytes) {
      skippedBudgetEntries += 1;
      recordSkipped(entry.path);
      continue;
    }
    paths.push(entry.path);
    scannedBytes += entry.uncompressedSize;
  }

  const contents = archive.readEntries(paths);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const texts = paths.map((path) => {
    const entry = byPath.get(path);
    const content = contents.get(path);
    if (!entry || !content) {
      throw new Error(`Cached Mojang server jar scan lost selected entry: ${path}`);
    }
    return {
      ...entry,
      content: decoder.decode(content),
    };
  });
  return {
    entries,
    selectedEntries: selected.length,
    scannedEntries: texts.length,
    scannedBytes,
    skippedOversizedEntries,
    skippedBudgetEntries,
    skippedPaths,
    truncated: skippedOversizedEntries > 0 || skippedBudgetEntries > 0,
    texts,
  };
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
