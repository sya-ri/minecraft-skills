import { hasDataFile, readDataJson, readDataText } from "@minecraft-skills/data";
import {
  Catalog,
  type CatalogData,
  type DomainData,
  DomainId,
  type DomainIdData,
  Edition,
  type EditionData,
  JavaReportsSummary,
  type JavaReportsSummaryData,
  PaperPluginData,
  type PaperPluginDataData,
  type ReferenceData,
  ResourcepackModelSummary,
  type ResourcepackModelSummaryData,
  VanillaInventory,
  type VanillaInventoryData,
  VersionDetail,
  type VersionDetailData,
  VersionIndex,
  type VersionIndexData,
  type VersionSummaryData,
} from "./schemas.js";

export type {
  CatalogData,
  DomainData,
  DomainIdData,
  EditionData,
  JavaReportsSummaryData,
  PaperPluginDataData,
  ReferenceData,
  ResourcepackModelSummaryData,
  VanillaInventoryData,
  VersionDetailData,
  VersionIndexData,
  VersionSummaryData,
};

export type PackFormatSummary = {
  version: string;
  releaseTime: string;
  data: number | null;
  dataMinor: number | null;
  resource: number | null;
  resourceMinor: number | null;
  paperPluginStatus: string;
};

export type InventoryTopLevelChange = {
  path: string;
  from?: {
    count: number;
    jsonCount: number;
  };
  to?: {
    count: number;
    jsonCount: number;
  };
};

export type VersionComparison = {
  edition: EditionData;
  from: string;
  to: string;
  packFormats: {
    data: { from: number | null; to: number | null; changed: boolean };
    dataMinor: { from: number | null; to: number | null; changed: boolean };
    resource: { from: number | null; to: number | null; changed: boolean };
    resourceMinor: { from: number | null; to: number | null; changed: boolean };
  };
  domains: {
    datapack: { from: string; to: string; changed: boolean };
    resourcepack: { from: string; to: string; changed: boolean };
    "paper-plugin": { from: string; to: string; changed: boolean };
  };
  vanillaInventory: {
    resources: {
      entryCount: { from: number; to: number; changed: boolean };
      added: InventoryTopLevelChange[];
      removed: InventoryTopLevelChange[];
      changed: InventoryTopLevelChange[];
    };
    datapack: {
      entryCount: { from: number; to: number; changed: boolean };
      added: InventoryTopLevelChange[];
      removed: InventoryTopLevelChange[];
      changed: InventoryTopLevelChange[];
    };
  };
};

export type PaperEventSearchOptions = {
  query: string;
  version?: string;
  source?: string;
  limit?: number;
};

export type VanillaPathDomain = "datapack" | "resourcepack";

export type VanillaPathSearchOptions = {
  edition?: string;
  version?: string;
  domain?: VanillaPathDomain;
  prefix?: string;
  contains?: string;
  extension?: string;
  limit?: number;
};

export type VanillaPathSearchResult = {
  edition: EditionData;
  version: string;
  domain: VanillaPathDomain;
  totalPaths: number;
  matchedPaths: number;
  truncated: boolean;
  paths: string[];
};

export type CommandSearchOptions = {
  edition?: string;
  version?: string;
  contains?: string;
  prefix?: string;
  parser?: string;
  limit?: number;
};

export type CommandSearchResult = {
  edition: EditionData;
  version: string;
  totalPaths: number;
  matchedPaths: number;
  truncated: boolean;
  paths: string[];
};

export type ResourcepackModelPathSearchOptions = {
  edition?: string;
  version?: string;
  contains?: string;
  prefix?: string;
  kind?: "model" | "item-definition";
  limit?: number;
};

export type ResourcepackModelPathSearchResult = {
  edition: EditionData;
  version: string;
  totalPaths: number;
  matchedPaths: number;
  truncated: boolean;
  paths: string[];
};

export type FetchJson = (url: string) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

export function getCatalog(): CatalogData {
  return Catalog.assert(readDataJson("catalog.json"));
}

export function listDomains(): DomainData[] {
  return getCatalog().domains;
}

export function getDomain(domain: string): DomainData {
  const domainId = DomainId.assert(domain);
  const found = listDomains().find((candidate) => candidate.id === domainId);
  if (!found) {
    throw new Error(`Unknown domain: ${domain}`);
  }
  return found;
}

export function listReferences(domain?: string): ReferenceData[] {
  const catalog = getCatalog();
  if (!domain) {
    return catalog.references;
  }
  const domainId = DomainId.assert(domain);
  return catalog.references.filter((reference) => reference.domain === domainId);
}

export function getVersionIndex(edition = "java"): VersionIndexData {
  const editionId = Edition.assert(edition);
  return VersionIndex.assert(readDataJson(`${editionId}/versions.json`));
}

export function resolveVersion(edition = "java", requested = "latest"): string {
  const index = getVersionIndex(edition);
  if (requested === "latest" || requested === "latest-release") {
    return index.latest.release;
  }
  if (requested === "latest-snapshot") {
    if (!index.latest.snapshot) {
      throw new Error(`No bundled latest snapshot for ${edition}`);
    }
    return index.latest.snapshot;
  }
  const found = index.versions.find((version) => version.id === requested);
  if (!found) {
    throw new Error(`Unsupported ${edition} version: ${requested}`);
  }
  return found.id;
}

export function listVersions(edition = "java"): VersionSummaryData[] {
  return getVersionIndex(edition).versions;
}

function makeManifestOnlyDetail(
  edition: EditionData,
  version: VersionSummaryData,
): VersionDetailData {
  return VersionDetail.assert({
    schemaVersion: 1,
    edition,
    version: version.id,
    type: version.type,
    releaseTime: version.releaseTime,
    coverage: version.coverage,
    protocolVersion: null,
    worldVersion: null,
    stable: null,
    javaVersion: {
      component: null,
      majorVersion: null,
    },
    assetIndex: null,
    downloads: {},
    packFormats: {
      data: null,
      dataMinor: null,
      resource: null,
      resourceMinor: null,
      status: "not-extracted",
    },
    domains: {
      datapack: {
        status: "seed",
        facts: [],
        unknowns: ["data_pack_format", "command_tree", "registries", "vanilla_reports"],
      },
      resourcepack: {
        status: "seed",
        facts: [],
        unknowns: ["resource_pack_format", "asset_index", "model_schema"],
      },
      "paper-plugin": {
        status: "seed",
        facts: [],
        unknowns: ["paper_api_version", "server_api_changes", "folia_compatibility_notes"],
      },
    },
    sources: getVersionIndex(edition).sources,
  });
}

function withPaperPluginCoverage(detail: VersionDetailData): VersionDetailData {
  const paper = getPaperPluginData();
  if (paper.versions.includes(detail.version)) {
    const build = paper.versionBuilds.find(
      (candidate) => candidate.minecraftVersion === detail.version,
    );
    const facts = [`paper_supported=true`, `paper_minecraft_version=${detail.version}`];
    if (build) {
      facts.push(
        `paper_latest_build=${build.latestBuild}`,
        `paper_build_count=${build.buildCount}`,
      );
    }
    if (paper.latest.minecraftVersion === detail.version) {
      facts.push(`paper_global_latest_build=${paper.latest.build}`);
    }
    return VersionDetail.assert({
      ...detail,
      domains: {
        ...detail.domains,
        "paper-plugin": {
          status: "supported",
          facts,
          unknowns: ["server_api_changes", "folia_compatibility_notes"],
        },
      },
    });
  }

  return VersionDetail.assert({
    ...detail,
    domains: {
      ...detail.domains,
      "paper-plugin": {
        status: "not-yet-published",
        facts: [
          "paper_supported=false",
          `paper_latest_supported=${paper.latest.minecraftVersion}`,
          `paper_latest_build=${paper.latest.build}`,
        ],
        unknowns: ["paper_api_version", "server_api_changes", "folia_compatibility_notes"],
      },
    },
  });
}

function withVanillaInventoryCoverage(detail: VersionDetailData): VersionDetailData {
  const inventoryPath = `java/vanilla-inventories/${detail.version}.json`;
  if (!hasDataFile(inventoryPath)) {
    return detail;
  }
  return VersionDetail.assert({
    ...detail,
    domains: {
      ...detail.domains,
      datapack: {
        status: "inventory-extracted",
        facts: [...detail.domains.datapack.facts, `vanilla_data_inventory=${detail.version}`],
        unknowns: ["command_tree", "vanilla_reports"],
      },
      resourcepack: {
        status: "inventory-extracted",
        facts: [...detail.domains.resourcepack.facts, `vanilla_asset_inventory=${detail.version}`],
        unknowns: ["model_schema"],
      },
    },
  });
}

function withJavaReportsCoverage(detail: VersionDetailData): VersionDetailData {
  const reportsPath = `java/reports/${detail.version}.json`;
  if (!hasDataFile(reportsPath)) {
    return detail;
  }
  return VersionDetail.assert({
    ...detail,
    domains: {
      ...detail.domains,
      datapack: {
        status: "reports-extracted",
        facts: [...detail.domains.datapack.facts, `server_reports=${detail.version}`],
        unknowns: [],
      },
    },
  });
}

function withResourcepackModelCoverage(detail: VersionDetailData): VersionDetailData {
  const modelsPath = `java/resourcepack-models/${detail.version}.json`;
  if (!hasDataFile(modelsPath)) {
    return detail;
  }
  return VersionDetail.assert({
    ...detail,
    domains: {
      ...detail.domains,
      resourcepack: {
        status: "models-extracted",
        facts: [...detail.domains.resourcepack.facts, `resourcepack_models=${detail.version}`],
        unknowns: [],
      },
    },
  });
}

export function getVersionDetail(edition = "java", requested = "latest"): VersionDetailData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  const detailPath = `${editionId}/version-details/${version}.json`;
  if (hasDataFile(detailPath)) {
    return withResourcepackModelCoverage(
      withJavaReportsCoverage(
        withVanillaInventoryCoverage(
          withPaperPluginCoverage(VersionDetail.assert(readDataJson(detailPath))),
        ),
      ),
    );
  }
  const summary = getVersionIndex(editionId).versions.find((candidate) => candidate.id === version);
  if (!summary) {
    throw new Error(`Unsupported ${editionId} version: ${version}`);
  }
  return withResourcepackModelCoverage(
    withJavaReportsCoverage(
      withVanillaInventoryCoverage(
        withPaperPluginCoverage(makeManifestOnlyDetail(editionId, summary)),
      ),
    ),
  );
}

export function getSourcePolicy(): CatalogData["sourcePolicy"] {
  return getCatalog().sourcePolicy;
}

export function getPaperPluginData(): PaperPluginDataData {
  return PaperPluginData.assert(readDataJson("java/paper.json"));
}

export function listPackFormats(edition = "java"): PackFormatSummary[] {
  return listVersions(edition).map((version) => {
    const detail = getVersionDetail(edition, version.id);
    return {
      version: detail.version,
      releaseTime: detail.releaseTime,
      data: detail.packFormats.data,
      dataMinor: detail.packFormats.dataMinor,
      resource: detail.packFormats.resource,
      resourceMinor: detail.packFormats.resourceMinor,
      paperPluginStatus: detail.domains["paper-plugin"].status,
    };
  });
}

export function getVanillaInventory(edition = "java", requested = "latest"): VanillaInventoryData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  const inventoryPath = `${editionId}/vanilla-inventories/${version}.json`;
  if (!hasDataFile(inventoryPath)) {
    throw new Error(`No bundled vanilla inventory for ${editionId} ${version}`);
  }
  return VanillaInventory.assert(readDataJson(inventoryPath));
}

export function getJavaReportsSummary(
  edition = "java",
  requested = "latest",
): JavaReportsSummaryData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  const reportsPath = `${editionId}/reports/${version}.json`;
  if (!hasDataFile(reportsPath)) {
    throw new Error(`No bundled server reports summary for ${editionId} ${version}`);
  }
  return JavaReportsSummary.assert(readDataJson(reportsPath));
}

export function getResourcepackModelSummary(
  edition = "java",
  requested = "latest",
): ResourcepackModelSummaryData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  const modelsPath = `${editionId}/resourcepack-models/${version}.json`;
  if (!hasDataFile(modelsPath)) {
    throw new Error(`No bundled resourcepack model summary for ${editionId} ${version}`);
  }
  return ResourcepackModelSummary.assert(readDataJson(modelsPath));
}

function normalizeLimit(limit: number | undefined, defaultLimit: number, maxLimit: number): number {
  const resolved = limit ?? defaultLimit;
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > maxLimit) {
    throw new Error(`Limit must be between 1 and ${maxLimit}`);
  }
  return resolved;
}

export function searchResourcepackModelPaths(
  options: ResourcepackModelPathSearchOptions = {},
): ResourcepackModelPathSearchResult {
  const editionId = Edition.assert(options.edition ?? "java");
  const modelSummary = getResourcepackModelSummary(editionId, options.version ?? "latest");
  const pathIndex = `${editionId}/vanilla-paths/${modelSummary.version}.resourcepack.txt`;
  if (!hasDataFile(pathIndex)) {
    throw new Error(`No bundled resourcepack path index for ${editionId} ${modelSummary.version}`);
  }
  const paths = readDataText(pathIndex)
    .trim()
    .split(/\r?\n/)
    .filter((path) => {
      if (!path.endsWith(".json")) {
        return false;
      }
      if (options.kind === "item-definition") {
        return path.startsWith("assets/") && path.includes("/items/");
      }
      if (options.kind === "model") {
        return path.startsWith("assets/") && path.includes("/models/");
      }
      return path.startsWith("assets/") && (path.includes("/models/") || path.includes("/items/"));
    });
  const limit = normalizeLimit(options.limit, 50, 500);
  const contains = options.contains?.trim();
  const prefix = options.prefix?.trim();
  const matched = paths.filter((path) => {
    if (prefix && !path.startsWith(prefix)) {
      return false;
    }
    if (contains && !path.includes(contains)) {
      return false;
    }
    return true;
  });

  return {
    edition: editionId,
    version: modelSummary.version,
    totalPaths: paths.length,
    matchedPaths: matched.length,
    truncated: matched.length > limit,
    paths: matched.slice(0, limit),
  };
}

export function searchVanillaPaths(
  options: VanillaPathSearchOptions = {},
): VanillaPathSearchResult {
  const editionId = Edition.assert(options.edition ?? "java");
  const inventory = getVanillaInventory(editionId, options.version ?? "latest");
  const domain = options.domain ?? "datapack";
  const pathIndex = `${editionId}/vanilla-paths/${inventory.version}.${domain}.txt`;
  if (!hasDataFile(pathIndex)) {
    throw new Error(
      `No bundled vanilla path index for ${editionId} ${inventory.version} ${domain}`,
    );
  }
  const paths = readDataText(pathIndex).trim().split(/\r?\n/).filter(Boolean);
  const limit = normalizeLimit(options.limit, 50, 500);
  const prefix = options.prefix?.trim();
  const contains = options.contains?.trim();
  const extension = options.extension?.trim();

  const matched = paths.filter((path) => {
    if (prefix && !path.startsWith(prefix)) {
      return false;
    }
    if (contains && !path.includes(contains)) {
      return false;
    }
    if (extension && !path.endsWith(extension.startsWith(".") ? extension : `.${extension}`)) {
      return false;
    }
    return true;
  });

  return {
    edition: editionId,
    version: inventory.version,
    domain,
    totalPaths: paths.length,
    matchedPaths: matched.length,
    truncated: matched.length > limit,
    paths: matched.slice(0, limit),
  };
}

export function searchCommands(options: CommandSearchOptions = {}): CommandSearchResult {
  const editionId = Edition.assert(options.edition ?? "java");
  const reports = getJavaReportsSummary(editionId, options.version ?? "latest");
  const pathIndex = `${editionId}/command-paths/${reports.version}.txt`;
  if (!hasDataFile(pathIndex)) {
    throw new Error(`No bundled command path index for ${editionId} ${reports.version}`);
  }
  const paths = readDataText(pathIndex).trim().split(/\r?\n/).filter(Boolean);
  const limit = normalizeLimit(options.limit, 50, 500);
  const contains = options.contains?.trim();
  const prefix = options.prefix?.trim();
  const parser = options.parser?.trim();
  const matched = paths.filter((path) => {
    if (prefix && !path.startsWith(prefix)) {
      return false;
    }
    if (contains && !path.includes(contains)) {
      return false;
    }
    if (parser && !path.includes(`:${parser}>`)) {
      return false;
    }
    return true;
  });
  return {
    edition: editionId,
    version: reports.version,
    totalPaths: paths.length,
    matchedPaths: matched.length,
    truncated: matched.length > limit,
    paths: matched.slice(0, limit),
  };
}

function compareValue<T>(from: T, to: T): { from: T; to: T; changed: boolean } {
  return {
    from,
    to,
    changed: from !== to,
  };
}

function compareInventorySection(
  from: VanillaInventoryData["resources"],
  to: VanillaInventoryData["resources"],
): VersionComparison["vanillaInventory"]["resources"] {
  const fromByPath = new Map(from.topLevel.map((entry) => [entry.path, entry]));
  const toByPath = new Map(to.topLevel.map((entry) => [entry.path, entry]));
  const added: InventoryTopLevelChange[] = [];
  const removed: InventoryTopLevelChange[] = [];
  const changed: InventoryTopLevelChange[] = [];

  for (const [path, entry] of toByPath) {
    const previous = fromByPath.get(path);
    if (!previous) {
      added.push({ path, to: { count: entry.count, jsonCount: entry.jsonCount } });
      continue;
    }
    if (previous.count !== entry.count || previous.jsonCount !== entry.jsonCount) {
      changed.push({
        path,
        from: { count: previous.count, jsonCount: previous.jsonCount },
        to: { count: entry.count, jsonCount: entry.jsonCount },
      });
    }
  }

  for (const [path, entry] of fromByPath) {
    if (!toByPath.has(path)) {
      removed.push({ path, from: { count: entry.count, jsonCount: entry.jsonCount } });
    }
  }

  return {
    entryCount: compareValue(from.entryCount, to.entryCount),
    added,
    removed,
    changed,
  };
}

export function compareVersions(
  edition = "java",
  fromRequested = "latest",
  toRequested = "latest",
): VersionComparison {
  const editionId = Edition.assert(edition);
  const from = getVersionDetail(editionId, fromRequested);
  const to = getVersionDetail(editionId, toRequested);
  const fromInventory = getVanillaInventory(editionId, from.version);
  const toInventory = getVanillaInventory(editionId, to.version);

  return {
    edition: editionId,
    from: from.version,
    to: to.version,
    packFormats: {
      data: compareValue(from.packFormats.data, to.packFormats.data),
      dataMinor: compareValue(from.packFormats.dataMinor, to.packFormats.dataMinor),
      resource: compareValue(from.packFormats.resource, to.packFormats.resource),
      resourceMinor: compareValue(from.packFormats.resourceMinor, to.packFormats.resourceMinor),
    },
    domains: {
      datapack: compareValue(from.domains.datapack.status, to.domains.datapack.status),
      resourcepack: compareValue(from.domains.resourcepack.status, to.domains.resourcepack.status),
      "paper-plugin": compareValue(
        from.domains["paper-plugin"].status,
        to.domains["paper-plugin"].status,
      ),
    },
    vanillaInventory: {
      resources: compareInventorySection(fromInventory.resources, toInventory.resources),
      datapack: compareInventorySection(fromInventory.datapack, toInventory.datapack),
    },
  };
}

export function buildPaperEventSearchUrl(options: PaperEventSearchOptions): string {
  const paper = getPaperPluginData();
  const query = options.query.trim();
  if (!query) {
    throw new Error("Paper event search requires a query");
  }
  const limit = options.limit ?? paper.eventSearch.querySemantics.defaultLimit;
  normalizeLimit(
    limit,
    paper.eventSearch.querySemantics.defaultLimit,
    paper.eventSearch.querySemantics.maxLimit,
  );

  const url = new URL(paper.eventSearch.baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("version", options.version ?? paper.eventSearch.defaultVersion);
  url.searchParams.set("limit", String(limit));
  if (options.source) {
    url.searchParams.set("source", options.source);
  }
  return url.toString();
}

export async function searchPaperEvents(
  options: PaperEventSearchOptions,
  fetchJson: FetchJson = fetch,
): Promise<unknown> {
  const url = buildPaperEventSearchUrl(options);
  const response = await fetchJson(url);
  if (!response.ok) {
    throw new Error(`Paper event search failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
