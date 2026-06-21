import { readDataJson } from "@minecraft-skills/data";
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

export function getVersionDetail(edition = "java", requested = "latest"): VersionDetailData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  return VersionDetail.assert(readDataJson(`${editionId}/version-details/${version}.json`));
}

export function getSourcePolicy(): CatalogData["sourcePolicy"] {
  return getCatalog().sourcePolicy;
}
