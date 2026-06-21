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
  url: "string",
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

export const PaperPluginData = type({
  schemaVersion: "1",
  projectId: "'paper'",
  projectName: "string",
  latest: {
    minecraftVersion: "string",
    build: "number",
  },
  support: {
    primarySince: "string",
    legacyBefore: "string",
    minecraftLatestGap: {
      javaLatest: "string",
      paperLatest: "string",
      status: "string",
    },
  },
  versionGroups: "string[]",
  versions: "string[]",
  eventSearch: {
    provider: "string",
    baseUrl: "string",
    defaultVersion: "string",
    sources: "string[]",
    paperSources: "string[]",
    querySemantics: {
      defaultOperator: "string",
      orOperator: "string",
      quotedPhrases: "boolean",
      maxLimit: "number",
      defaultLimit: "number",
    },
  },
  sources: Source.array(),
});

export const InventoryTopLevel = type({
  path: "string",
  count: "number",
  jsonCount: "number",
  samples: "string[]",
});

export const InventorySection = type({
  entryCount: "number",
  namespaces: "string[]",
  topLevel: InventoryTopLevel.array(),
});

export const VanillaInventory = type({
  schemaVersion: "1",
  edition: "'java'",
  version: "string",
  coverage: "string",
  resources: InventorySection,
  datapack: InventorySection,
  sources: Source.array(),
});

export const ResourcepackModelCountSample = type({
  value: "string",
  count: "number",
  samples: "string[]",
});

export const ResourcepackModelSummary = type({
  schemaVersion: "1",
  edition: "'java'",
  version: "string",
  coverage: "'client-resourcepack-models'",
  files: {
    models: {
      count: "number",
      groups: ResourcepackModelCountSample.array(),
    },
    itemDefinitions: {
      count: "number",
      groups: ResourcepackModelCountSample.array(),
    },
  },
  modelJson: {
    topLevelKeys: ResourcepackModelCountSample.array(),
    fieldPaths: ResourcepackModelCountSample.array(),
    displayContexts: ResourcepackModelCountSample.array(),
    textureVariables: ResourcepackModelCountSample.array(),
    overridePredicateKeys: ResourcepackModelCountSample.array(),
  },
  itemDefinitionJson: {
    topLevelKeys: ResourcepackModelCountSample.array(),
    fieldPaths: ResourcepackModelCountSample.array(),
    modelTypes: ResourcepackModelCountSample.array(),
    propertyKeys: ResourcepackModelCountSample.array(),
  },
  sources: Source.array(),
});

export const ReportDatapackOtherType = type({
  id: "string",
  elements: "boolean | null",
  format: "string | null",
  stable: "boolean | null",
  tags: "boolean | null",
});

export const ReportDatapackRegistry = type({
  id: "string",
  elements: "boolean | null",
  stable: "boolean | null",
  tags: "boolean | null",
  entryCount: "number | null",
  protocolId: "number | null",
});

export const ReportFile = type({
  path: "string",
  size: "number",
});

export const JavaReportsSummary = type({
  schemaVersion: "1",
  edition: "'java'",
  version: "string",
  coverage: "'server-reports'",
  commands: {
    rootLiterals: "string[]",
    executablePathCount: "number",
    argumentParsers: "string[]",
  },
  datapack: {
    otherTypes: ReportDatapackOtherType.array(),
    registries: ReportDatapackRegistry.array(),
  },
  reports: ReportFile.array(),
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
export type PaperPluginDataData = typeof PaperPluginData.infer;
export type VanillaInventoryData = typeof VanillaInventory.infer;
export type ResourcepackModelSummaryData = typeof ResourcepackModelSummary.infer;
export type JavaReportsSummaryData = typeof JavaReportsSummary.infer;
export type DomainIdData = typeof DomainId.infer;
export type EditionData = typeof Edition.infer;
