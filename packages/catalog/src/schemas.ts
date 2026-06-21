import { type } from "arktype";

export const Source = type({
  id: "string",
  kind: "string",
  url: "string",
  "retrievedAt?": "string",
});

export const Domain = type({
  id: "'datapack' | 'resourcepack' | 'paper-plugin'",
  skill: "string",
  title: "string",
  description: "string",
  status: "string",
  primarySources: Source.array(),
});

export const Reference = type({
  id: "string",
  domain: "'datapack' | 'resourcepack' | 'paper-plugin'",
  title: "string",
  path: "string",
});

export const Catalog = type({
  schemaVersion: "1",
  latest: {
    java: "string",
  },
  supportPolicy: {
    javaPrimarySince: "string",
    legacyBefore: "string",
    domains: "string[]",
  },
  sourcePolicy: {
    license: "string",
    minecraftWikiTextRedistribution: "string",
    minecraftWikiUse: "string",
    factPriority: "string[]",
  },
  domains: Domain.array(),
  references: Reference.array(),
});

export const VersionSummary = type({
  id: "string",
  type: "string",
  releaseTime: "string",
  time: "string",
  sha1: "string",
  source: "string",
  coverage: "string",
});

export const VersionIndex = type({
  schemaVersion: "1",
  edition: "'java'",
  support: {
    primarySince: "string",
    legacyBefore: "string",
  },
  latest: {
    release: "string",
    snapshot: "string | null",
  },
  versions: VersionSummary.array(),
  sources: Source.array(),
});

export const DomainCoverage = type({
  status: "string",
  facts: "string[]",
  unknowns: "string[]",
});

export const Download = type({
  sha1: "string",
  size: "number",
  url: "string",
});

export const AssetIndex = type({
  id: "string",
  sha1: "string",
  size: "number",
  totalSize: "number",
  url: "string",
});

export const VersionDetail = type({
  schemaVersion: "1",
  edition: "'java'",
  version: "string",
  type: "string",
  releaseTime: "string",
  coverage: "string",
  protocolVersion: "number | null",
  worldVersion: "number | null",
  stable: "boolean | null",
  javaVersion: {
    component: "string | null",
    majorVersion: "number | null",
  },
  assetIndex: AssetIndex.or("null"),
  downloads: "Record<string, unknown>",
  packFormats: {
    data: "number | null",
    dataMinor: "number | null",
    resource: "number | null",
    resourceMinor: "number | null",
    status: "string",
  },
  domains: {
    datapack: DomainCoverage,
    resourcepack: DomainCoverage,
    "paper-plugin": DomainCoverage,
  },
  sources: Source.array(),
});

export const DomainId = type("'datapack' | 'resourcepack' | 'paper-plugin'");
export const Edition = type("'java'");

export type CatalogData = typeof Catalog.infer;
export type DomainData = typeof Domain.infer;
export type ReferenceData = typeof Reference.infer;
export type VersionIndexData = typeof VersionIndex.infer;
export type VersionSummaryData = typeof VersionSummary.infer;
export type VersionDetailData = typeof VersionDetail.infer;
export type DomainCoverageData = typeof DomainCoverage.infer;
export type DomainIdData = typeof DomainId.infer;
export type EditionData = typeof Edition.infer;
