import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getVersionDetail, listVersions } from "@minecraft-skills/catalog";
import {
  buildJavaReportsSummary,
  generateJavaReports,
  javaRegistryEntryIndexHeader,
  writeJavaReportsSummary,
} from "./javaReports.js";

type Download = {
  url: string;
};

export type ExistingReportsSummary = {
  version?: string;
  datapack?: {
    registries?: Array<{
      id?: string;
      entryCount?: number | null;
      entryIndexStatus?: "indexed" | "unindexed";
    }>;
    registryEntries?: {
      path?: string;
      coverage?: "official-report" | "official-report-unavailable";
      indexedRegistryCount?: number;
      unindexedRegistryCount?: number;
      entryCount?: number;
    };
  };
  reports?: Array<{
    path?: string;
  }>;
  sources?: Array<{
    retrievedAt?: string;
  }>;
};

export type IngestJavaReportSummariesOptions = {
  root: string;
  retrievedAt: string;
  javaBin: string;
  force: boolean;
  log?: (message: string) => void;
};

async function downloadToFile(url: string, path: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function parseExistingJavaReportsSummary(
  value: unknown,
): ExistingReportsSummary | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  if (value.version !== undefined && typeof value.version !== "string") {
    return undefined;
  }

  const summary: ExistingReportsSummary = {};
  if (typeof value.version === "string") {
    summary.version = value.version;
  }

  if (value.datapack !== undefined) {
    const rawDatapack = value.datapack;
    if (!isPlainObject(rawDatapack)) {
      return undefined;
    }
    const datapack: NonNullable<ExistingReportsSummary["datapack"]> = {};
    if (rawDatapack.registries !== undefined) {
      if (!Array.isArray(rawDatapack.registries)) {
        return undefined;
      }
      const registries: NonNullable<NonNullable<ExistingReportsSummary["datapack"]>["registries"]> =
        [];
      for (const rawRegistry of rawDatapack.registries) {
        if (!isPlainObject(rawRegistry)) {
          return undefined;
        }
        if (rawRegistry.id !== undefined && typeof rawRegistry.id !== "string") {
          return undefined;
        }
        if (
          rawRegistry.entryCount !== undefined &&
          rawRegistry.entryCount !== null &&
          typeof rawRegistry.entryCount !== "number"
        ) {
          return undefined;
        }
        if (
          rawRegistry.entryIndexStatus !== undefined &&
          rawRegistry.entryIndexStatus !== "indexed" &&
          rawRegistry.entryIndexStatus !== "unindexed"
        ) {
          return undefined;
        }
        const registry: (typeof registries)[number] = {};
        if (typeof rawRegistry.id === "string") {
          registry.id = rawRegistry.id;
        }
        if (typeof rawRegistry.entryCount === "number" || rawRegistry.entryCount === null) {
          registry.entryCount = rawRegistry.entryCount;
        }
        if (
          rawRegistry.entryIndexStatus === "indexed" ||
          rawRegistry.entryIndexStatus === "unindexed"
        ) {
          registry.entryIndexStatus = rawRegistry.entryIndexStatus;
        }
        registries.push(registry);
      }
      datapack.registries = registries;
    }
    if (rawDatapack.registryEntries !== undefined) {
      const rawMetadata = rawDatapack.registryEntries;
      if (!isPlainObject(rawMetadata)) {
        return undefined;
      }
      if (rawMetadata.path !== undefined && typeof rawMetadata.path !== "string") {
        return undefined;
      }
      if (
        rawMetadata.coverage !== undefined &&
        rawMetadata.coverage !== "official-report" &&
        rawMetadata.coverage !== "official-report-unavailable"
      ) {
        return undefined;
      }
      for (const key of ["indexedRegistryCount", "unindexedRegistryCount", "entryCount"] as const) {
        if (rawMetadata[key] !== undefined && typeof rawMetadata[key] !== "number") {
          return undefined;
        }
      }
      const metadata: NonNullable<
        NonNullable<ExistingReportsSummary["datapack"]>["registryEntries"]
      > = {};
      if (typeof rawMetadata.path === "string") {
        metadata.path = rawMetadata.path;
      }
      if (
        rawMetadata.coverage === "official-report" ||
        rawMetadata.coverage === "official-report-unavailable"
      ) {
        metadata.coverage = rawMetadata.coverage;
      }
      if (typeof rawMetadata.indexedRegistryCount === "number") {
        metadata.indexedRegistryCount = rawMetadata.indexedRegistryCount;
      }
      if (typeof rawMetadata.unindexedRegistryCount === "number") {
        metadata.unindexedRegistryCount = rawMetadata.unindexedRegistryCount;
      }
      if (typeof rawMetadata.entryCount === "number") {
        metadata.entryCount = rawMetadata.entryCount;
      }
      datapack.registryEntries = metadata;
    }
    summary.datapack = datapack;
  }

  if (value.reports !== undefined) {
    if (!Array.isArray(value.reports)) {
      return undefined;
    }
    const reports: NonNullable<ExistingReportsSummary["reports"]> = [];
    for (const rawReport of value.reports) {
      if (
        !isPlainObject(rawReport) ||
        (rawReport.path !== undefined && typeof rawReport.path !== "string")
      ) {
        return undefined;
      }
      reports.push(typeof rawReport.path === "string" ? { path: rawReport.path } : {});
    }
    summary.reports = reports;
  }

  if (value.sources !== undefined) {
    if (!Array.isArray(value.sources)) {
      return undefined;
    }
    const sources: NonNullable<ExistingReportsSummary["sources"]> = [];
    for (const rawSource of value.sources) {
      if (
        !isPlainObject(rawSource) ||
        (rawSource.retrievedAt !== undefined && typeof rawSource.retrievedAt !== "string")
      ) {
        return undefined;
      }
      sources.push(
        typeof rawSource.retrievedAt === "string" ? { retrievedAt: rawSource.retrievedAt } : {},
      );
    }
    summary.sources = sources;
  }

  return summary;
}

export function readExistingJavaReportsSummary(path: string): ExistingReportsSummary | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  const source = readFileSync(path, "utf8");
  try {
    const parsed: unknown = JSON.parse(source);
    return parseExistingJavaReportsSummary(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const namespacedIdPattern = /^[a-z0-9_.-]+:[a-z0-9/._-]+$/;

export function isJavaRegistryEntryIndexValid(
  rawSummary: unknown,
  index: string | undefined,
): boolean {
  const summary = parseExistingJavaReportsSummary(rawSummary);
  if (!summary) {
    return false;
  }
  const version = summary.version;
  const registries = summary.datapack?.registries;
  const metadata = summary.datapack?.registryEntries;
  if (!version || !registries || !metadata || index === undefined) {
    return false;
  }
  if (
    metadata.path !== `java/registry-entries/${version}.tsv` ||
    (metadata.coverage !== "official-report" &&
      metadata.coverage !== "official-report-unavailable") ||
    !Number.isSafeInteger(metadata.indexedRegistryCount) ||
    !Number.isSafeInteger(metadata.unindexedRegistryCount) ||
    !Number.isSafeInteger(metadata.entryCount) ||
    (metadata.indexedRegistryCount ?? -1) < 0 ||
    (metadata.unindexedRegistryCount ?? -1) < 0 ||
    (metadata.entryCount ?? -1) < 0
  ) {
    return false;
  }

  const indexedRegistries = registries.filter(
    (registry) => registry.entryIndexStatus === "indexed",
  );
  const unindexedRegistries = registries.filter(
    (registry) => registry.entryIndexStatus === "unindexed",
  );
  if (
    registries.some(
      (registry) => typeof registry.id !== "string" || !namespacedIdPattern.test(registry.id),
    ) ||
    new Set(registries.map((registry) => registry.id)).size !== registries.length ||
    indexedRegistries.length + unindexedRegistries.length !== registries.length ||
    metadata.indexedRegistryCount !== indexedRegistries.length ||
    metadata.unindexedRegistryCount !== unindexedRegistries.length ||
    unindexedRegistries.some((registry) => registry.entryCount !== null) ||
    (metadata.coverage === "official-report-unavailable" && indexedRegistries.length > 0)
  ) {
    return false;
  }

  const normalized = index.replaceAll("\r\n", "\n");
  const lines = normalized.endsWith("\n")
    ? normalized.slice(0, -1).split("\n")
    : normalized.split("\n");
  if (lines.shift() !== javaRegistryEntryIndexHeader || lines.some((line) => line.length === 0)) {
    return false;
  }

  const indexedById = new Map(indexedRegistries.map((registry) => [registry.id, registry]));
  const counts = new Map<string, number>();
  let previousKey: string | undefined;
  for (const line of lines) {
    const columns = line.split("\t");
    if (columns.length !== 3) {
      return false;
    }
    const [registryId, entryId, protocolId] = columns as [string, string, string];
    if (
      !registryId ||
      !entryId ||
      !namespacedIdPattern.test(registryId) ||
      !namespacedIdPattern.test(entryId) ||
      !indexedById.has(registryId) ||
      (protocolId !== "" &&
        (!/^(0|[1-9]\d*)$/.test(protocolId) || !Number.isSafeInteger(Number(protocolId))))
    ) {
      return false;
    }
    const key = `${registryId}\t${entryId}`;
    if (previousKey !== undefined && compareStrings(previousKey, key) >= 0) {
      return false;
    }
    previousKey = key;
    counts.set(registryId, (counts.get(registryId) ?? 0) + 1);
  }

  if (metadata.entryCount !== lines.length) {
    return false;
  }
  return indexedRegistries.every(
    (registry) => registry.entryCount === (counts.get(registry.id ?? "") ?? 0),
  );
}

export function shouldIngestJavaReports(
  rawSummary: unknown,
  registryEntryIndex: string | undefined,
): boolean {
  const summary = parseExistingJavaReportsSummary(rawSummary);
  if (!summary) {
    return true;
  }
  const hasRegistryReport = summary.reports?.some(
    (report) => report.path === "reports/registries.json",
  );
  if (hasRegistryReport === true && (summary.datapack?.registries?.length ?? 0) === 0) {
    return true;
  }
  return !isJavaRegistryEntryIndexValid(summary, registryEntryIndex);
}

export function listPendingJavaReportVersions(root: string): string[] {
  const reportsRoot = join(root, "packages/data/data/java/reports");
  return listVersions("java")
    .filter((version) => {
      const summary = readExistingJavaReportsSummary(join(reportsRoot, `${version.id}.json`));
      const registryEntryIndexPath = join(
        root,
        "packages/data/data/java/registry-entries",
        `${version.id}.tsv`,
      );
      const registryEntryIndex = existsSync(registryEntryIndexPath)
        ? readFileSync(registryEntryIndexPath, "utf8")
        : undefined;
      return shouldIngestJavaReports(summary, registryEntryIndex);
    })
    .map((version) => version.id);
}

function existingRetrievedAt(summary: ExistingReportsSummary | undefined): string | undefined {
  return summary?.sources?.find((source) => typeof source.retrievedAt === "string")?.retrievedAt;
}

export async function ingestJavaReportSummaries(
  options: IngestJavaReportSummariesOptions,
): Promise<number> {
  const reportsRoot = join(options.root, "packages/data/data/java/reports");
  const tempRoot = mkdtempSync(join(tmpdir(), "minecraft-skills-java-reports-"));
  let written = 0;

  try {
    for (const version of listVersions("java")) {
      const output = join(reportsRoot, `${version.id}.json`);
      const existing = readExistingJavaReportsSummary(output);
      const registryEntryIndexPath = join(
        options.root,
        "packages/data/data/java/registry-entries",
        `${version.id}.tsv`,
      );
      const existingRegistryEntryIndex = existsSync(registryEntryIndexPath)
        ? readFileSync(registryEntryIndexPath, "utf8")
        : undefined;
      if (!options.force && !shouldIngestJavaReports(existing, existingRegistryEntryIndex)) {
        options.log?.(`skip ${version.id}: Java reports summary is complete`);
        continue;
      }

      const detail = getVersionDetail("java", version.id);
      const server = readDownload(detail.downloads, "server");
      const baseName = safeFileName(version.id);
      const serverJarPath = join(tempRoot, `${baseName}-server.jar`);
      const workDir = join(tempRoot, `${baseName}-work`);
      const outputDir = join(tempRoot, `${baseName}-generated`);

      try {
        options.log?.(`fetch ${version.id}: server jar`);
        await downloadToFile(server.url, serverJarPath);
        options.log?.(`generate ${version.id}: server reports`);
        generateJavaReports({
          javaBin: options.javaBin,
          serverJarPath,
          workDir,
          outputDir,
        });
        const retrievedAt =
          (!options.force ? existingRetrievedAt(existing) : undefined) ?? options.retrievedAt;
        const result = buildJavaReportsSummary({
          version: detail.version,
          reportsDir: join(outputDir, "reports"),
          serverJarUrl: server.url,
          retrievedAt,
        });
        writeJavaReportsSummary({
          root: options.root,
          version: detail.version,
          ...result,
        });
        written += 1;
        options.log?.(`wrote ${version.id}`);
      } finally {
        if (existsSync(serverJarPath)) {
          unlinkSync(serverJarPath);
        }
        rmSync(workDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  return written;
}
