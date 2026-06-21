import { hasDataFile, readDataJson } from "@minecraft-skills/data";
import {
  Catalog,
  type CatalogData,
  type DomainData,
  DomainId,
  type DomainIdData,
  Edition,
  type EditionData,
  PaperPluginData,
  type PaperPluginDataData,
  type ReferenceData,
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
  PaperPluginDataData,
  ReferenceData,
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
    const facts = [`paper_supported=true`, `paper_minecraft_version=${detail.version}`];
    if (paper.latest.minecraftVersion === detail.version) {
      facts.push(`paper_latest_build=${paper.latest.build}`);
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

export function getVersionDetail(edition = "java", requested = "latest"): VersionDetailData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  const detailPath = `${editionId}/version-details/${version}.json`;
  if (hasDataFile(detailPath)) {
    return withVanillaInventoryCoverage(
      withPaperPluginCoverage(VersionDetail.assert(readDataJson(detailPath))),
    );
  }
  const summary = getVersionIndex(editionId).versions.find((candidate) => candidate.id === version);
  if (!summary) {
    throw new Error(`Unsupported ${editionId} version: ${version}`);
  }
  return withVanillaInventoryCoverage(
    withPaperPluginCoverage(makeManifestOnlyDetail(editionId, summary)),
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
