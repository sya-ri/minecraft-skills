import { hasDataFile, readDataJson } from "@minecraft-skills/data";
import {
  Catalog,
  type CatalogData,
  type DomainData,
  DomainId,
  type DomainIdData,
  Edition,
  type EditionData,
  type ReferenceData,
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
  ReferenceData,
  VersionDetailData,
  VersionIndexData,
  VersionSummaryData,
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
    packFormats: {
      data: null,
      resource: null,
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

export function getVersionDetail(edition = "java", requested = "latest"): VersionDetailData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  const detailPath = `${editionId}/version-details/${version}.json`;
  if (hasDataFile(detailPath)) {
    return VersionDetail.assert(readDataJson(detailPath));
  }
  const summary = getVersionIndex(editionId).versions.find((candidate) => candidate.id === version);
  if (!summary) {
    throw new Error(`Unsupported ${editionId} version: ${version}`);
  }
  return makeManifestOnlyDetail(editionId, summary);
}

export function getSourcePolicy(): CatalogData["sourcePolicy"] {
  return getCatalog().sourcePolicy;
}
