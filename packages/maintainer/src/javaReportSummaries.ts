import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getVersionDetail, listVersions } from "@minecraft-skills/catalog";
import {
  buildJavaReportsSummary,
  generateJavaReports,
  writeJavaReportsSummary,
} from "./javaReports.js";

type Download = {
  url: string;
};

type ExistingReportsSummary = {
  datapack?: {
    registries?: unknown[];
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

function readSummary(path: string): ExistingReportsSummary | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, "utf8")) as ExistingReportsSummary;
}

export function shouldIngestJavaReports(summary: ExistingReportsSummary | undefined): boolean {
  if (!summary) {
    return true;
  }
  const hasRegistryReport = summary.reports?.some(
    (report) => report.path === "reports/registries.json",
  );
  return hasRegistryReport === true && (summary.datapack?.registries?.length ?? 0) === 0;
}

export function listPendingJavaReportVersions(root: string): string[] {
  const reportsRoot = join(root, "packages/data/data/java/reports");
  return listVersions("java")
    .filter((version) => {
      return shouldIngestJavaReports(readSummary(join(reportsRoot, `${version.id}.json`)));
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
      const existing = readSummary(output);
      if (!options.force && !shouldIngestJavaReports(existing)) {
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
