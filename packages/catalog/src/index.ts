import {
  type CachedDataFile,
  type CleanMojangServerJarResult,
  cleanCachedData,
  cleanMojangServerJar,
  type DataManifest,
  type DataManifestEntry,
  type FetchDataOptions,
  type FetchDataResult,
  type FetchMinecraftAssetFileOptions,
  type FetchMinecraftAssetFileResult,
  type FetchMinecraftAssetsArchiveOptions,
  type FetchMinecraftAssetsArchiveResult,
  type FetchMinecraftAssetsIndexOptions,
  type FetchMinecraftAssetsIndexResult,
  fetchData,
  fetchMinecraftAssetFile,
  fetchMinecraftAssetsArchive,
  fetchMinecraftAssetsIndex,
  fetchMojangServerJar,
  getCacheDataRoot,
  getCacheRoot,
  getDataManifest,
  getMinecraftAssetsStatus,
  getMojangServerJarStatus,
  hasBundledDataFile,
  hasCachedDataFile,
  hasCachedMinecraftAssetFile,
  hasDataFile,
  listCachedDataFiles,
  listCachedMojangServerJarEntries,
  type MinecraftAssetsStatus,
  type MojangServerJarEntry,
  type MojangServerJarStatus,
  readCachedMinecraftAssetText,
  readCachedMojangServerJarText,
  readDataJson,
  readDataText,
  readMinecraftAssetsIndex,
  type SearchMinecraftAssetsOptions,
  type SearchMinecraftAssetsResult,
  scanCachedMojangServerJarText,
  searchMinecraftAssets,
} from "@minecraft-skills/data";
import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import {
  type DatapackProjectDiagnostic,
  type DatapackProjectDiagnosticSeverity,
  type DatapackProjectFile,
  type DatapackProjectValidationIncompleteReason,
  type DatapackProjectValidationLimitName,
  type DatapackProjectValidationLimits,
  type DatapackProjectValidationOptions,
  type DatapackProjectValidationResult,
  defaultDatapackProjectValidationLimits,
  resolveDatapackProjectValidationLimits,
  validateDatapackReferenceGraph,
} from "./datapackProject.js";
import { inspectModrinthArchive } from "./modrinthZip.js";
import { compareObservedProtocolIds } from "./registryEntryComparison.js";
import {
  defaultResourcepackPngValidationLimits,
  type ResourcepackPngDiagnostic,
  type ResourcepackPngValidationLimits,
  type ResourcepackPngValidationOptions,
  type ResourcepackPngValidationResult,
  resolveResourcepackPngValidationLimits,
  validateResourcepackPng,
} from "./resourcepackPng.js";
import {
  defaultResourcepackProjectValidationLimits,
  type ResourcepackPngValidationIncompleteReason,
  type ResourcepackProjectDiagnostic,
  type ResourcepackProjectDiagnosticSeverity,
  type ResourcepackProjectFile,
  type ResourcepackProjectPngValidationLimitName,
  type ResourcepackProjectValidationLimitName,
  type ResourcepackProjectValidationLimits,
  type ResourcepackProjectValidationOptions,
  type ResourcepackProjectValidationResult,
  type ResourcepackSoundValidationIncompleteReason,
  resolveResourcepackProjectValidationLimits,
  validateResourcepackReferenceGraph,
} from "./resourcepackProject.js";
import {
  defaultResourcepackTranslationValidationLimits,
  type ResourcepackTranslationComparison,
  type ResourcepackTranslationDiagnostic,
  type ResourcepackTranslationFile,
  type ResourcepackTranslationIncompleteReason,
  type ResourcepackTranslationLocaleSummary,
  type ResourcepackTranslationValidationLimitName,
  type ResourcepackTranslationValidationLimits,
  type ResourcepackTranslationValidationOptions,
  type ResourcepackTranslationValidationResult,
  resolveResourcepackTranslationValidationLimits,
  validateResourcepackTranslationsInput,
} from "./resourcepackTranslations.js";
import {
  AuthoringChecklist,
  type AuthoringChecklistData,
  AuthoringChecklistIndex,
  type AuthoringChecklistIndexData,
  type AuthoringChecklistStepData,
  AuthoringDiagnostic,
  type AuthoringDiagnosticData,
  AuthoringDiagnosticIndex,
  type AuthoringDiagnosticIndexData,
  AuthoringGuardrail,
  type AuthoringGuardrailData,
  AuthoringGuardrailIndex,
  type AuthoringGuardrailIndexData,
  AuthoringRecipe,
  type AuthoringRecipeData,
  AuthoringRecipeIndex,
  type AuthoringRecipeIndexData,
  type AuthoringRecipeStepData,
  AuthoringScenario,
  type AuthoringScenarioData,
  AuthoringScenarioIndex,
  type AuthoringScenarioIndexData,
  Catalog,
  type CatalogData,
  ClaimPolicy,
  type ClaimPolicyData,
  ClaimPolicyIndex,
  type ClaimPolicyIndexData,
  type DomainData,
  DomainId,
  type DomainIdData,
  Edition,
  type EditionData,
  FactSurface,
  type FactSurfaceData,
  FactSurfaceIndex,
  type FactSurfaceIndexData,
  IntentLookup,
  type IntentLookupData,
  IntentLookupIndex,
  type IntentLookupIndexData,
  type IntentLookupStepData,
  JavaReportsSummary,
  type JavaReportsSummaryData,
  ObservedDatapackSchemaSurface,
  type ObservedDatapackSchemaSurfaceData,
  OutputRequirement,
  type OutputRequirementData,
  OutputRequirementIndex,
  type OutputRequirementIndexData,
  PaperApiIndex,
  type PaperApiIndexData,
  type PaperApiMemberData,
  PaperApiSurface,
  type PaperApiSurfaceData,
  type PaperApiTypeData,
  PaperPluginData,
  type PaperPluginDataData,
  type ReferenceData,
  ResourcepackModelSummary,
  type ResourcepackModelSummaryData,
  ResponsePattern,
  type ResponsePatternData,
  ResponsePatternIndex,
  type ResponsePatternIndexData,
  type SkillData,
  VanillaInventory,
  type VanillaInventoryData,
  VersionDetail,
  type VersionDetailData,
  VersionIndex,
  type VersionIndexData,
  type VersionSummaryData,
} from "./schemas.js";

export * from "./blockbenchProject.js";
export * from "./fabricMeta.js";
export * from "./fabricMod.js";
export * from "./javaClassArchive.js";
export * from "./javaPlayerProfile.js";
export * from "./javaPlayerProfileNetwork.js";
export {
  downloadJavaPlayerTexture,
  inspectJavaPlayerTextureBytes,
  type JavaPlayerTextureContent,
  type JavaPlayerTextureContentInspectionResult,
  type JavaPlayerTextureDownloadResult,
  type JavaPlayerTextureEvidence,
  type JavaPlayerTextureFetch,
  type JavaPlayerTextureInvalidContentResult,
  type JavaPlayerTextureInvalidInputResult,
  type JavaPlayerTextureInvalidResponseResult,
  type JavaPlayerTextureKind,
  type JavaPlayerTextureRequestFailureResult,
  type JavaPlayerTextureResultContext,
  javaPlayerTextureDownloadLimits,
  javaPlayerTextureSourceEvidence,
} from "./javaPlayerTexture.js";
export * from "./minecraftLog.js";
export * from "./minecraftPerformance.js";
export * from "./mixinConfig.js";
export {
  type ModrinthCompatibilityFetch,
  type ModrinthCompatibilityFetchResponse,
  type ModrinthCompatibilityOptions,
  type ModrinthCompatibilityPair,
  type ModrinthCompatibilityPairSet,
  type ModrinthCompatibilityPairVersion,
  type ModrinthCompatibilityProjectResult,
  type ModrinthCompatibilityResult,
  type ModrinthCompatibilityValueSet,
  type ModrinthCompatibilityVersion,
  modrinthCompatibilityLimits,
  resolveModrinthCompatibility,
} from "./modrinthCompatibility.js";
export * from "./paperPluginJar.js";
export {
  type PlayerSkinCanonicalRectangle,
  type PlayerSkinLayoutDiagnostic,
  type PlayerSkinLayoutValidationInput,
  type PlayerSkinLayoutValidationLimits,
  type PlayerSkinLayoutValidationResult,
  type PlayerSkinRequestedSourceRectangles,
  type PlayerSkinSourceRectangleInput,
  playerSkinLayoutValidationLimits,
  validatePlayerSkinLayout,
} from "./playerSkinLayout.js";
export {
  defaultResourcepackPngAlphaBoundsLimits,
  inspectResourcepackPngAlphaBounds,
  type ResourcepackPngAlphaBoundsDiagnostic,
  type ResourcepackPngAlphaBoundsLimits,
  type ResourcepackPngAlphaBoundsOptions,
  type ResourcepackPngAlphaBoundsRequirements,
  type ResourcepackPngAlphaBoundsResult,
  type ResourcepackPngAlphaInspectionReason,
  type ResourcepackPngAlphaInspectionStatus,
  type ResourcepackPngAlphaRequirementFailure,
  type ResourcepackPngAlphaRequirementsResult,
  type ResourcepackPngAlphaTransparencySource,
  type ResourcepackPngContentBounds,
  type ResourcepackPngTransparentMargins,
  resolveResourcepackPngAlphaBoundsLimits,
} from "./resourcepackPngAlpha.js";
export { vorbisIdentificationPageBytes } from "./resourcepackSound.js";
export * from "./serverAccessList.js";
export * from "./serverProperties.js";
export * from "./velocityMeta.js";
export * from "./velocityPluginJar.js";
export * from "./waveAudio.js";
export type {
  AuthoringChecklistData,
  AuthoringChecklistIndexData,
  AuthoringChecklistStepData,
  AuthoringDiagnosticData,
  AuthoringDiagnosticIndexData,
  AuthoringGuardrailData,
  AuthoringGuardrailIndexData,
  AuthoringRecipeData,
  AuthoringRecipeIndexData,
  AuthoringRecipeStepData,
  AuthoringScenarioData,
  AuthoringScenarioIndexData,
  CachedDataFile,
  CatalogData,
  ClaimPolicyData,
  ClaimPolicyIndexData,
  CleanMojangServerJarResult,
  DataManifest,
  DataManifestEntry,
  DatapackProjectDiagnostic,
  DatapackProjectDiagnosticSeverity,
  DatapackProjectFile,
  DatapackProjectValidationIncompleteReason,
  DatapackProjectValidationLimitName,
  DatapackProjectValidationLimits,
  DatapackProjectValidationOptions,
  DatapackProjectValidationResult,
  DomainData,
  DomainIdData,
  EditionData,
  FactSurfaceData,
  FactSurfaceIndexData,
  FetchDataOptions,
  FetchDataResult,
  FetchMinecraftAssetFileOptions,
  FetchMinecraftAssetFileResult,
  FetchMinecraftAssetsArchiveOptions,
  FetchMinecraftAssetsArchiveResult,
  FetchMinecraftAssetsIndexOptions,
  FetchMinecraftAssetsIndexResult,
  IntentLookupData,
  IntentLookupIndexData,
  IntentLookupStepData,
  JavaReportsSummaryData,
  MinecraftAssetsStatus,
  MojangServerJarEntry,
  MojangServerJarStatus,
  ObservedDatapackSchemaSurfaceData,
  OutputRequirementData,
  OutputRequirementIndexData,
  PaperApiIndexData,
  PaperApiMemberData,
  PaperApiSurfaceData,
  PaperApiTypeData,
  PaperPluginDataData,
  ReferenceData,
  ResourcepackModelSummaryData,
  ResourcepackPngDiagnostic,
  ResourcepackPngValidationIncompleteReason,
  ResourcepackPngValidationLimits,
  ResourcepackPngValidationOptions,
  ResourcepackPngValidationResult,
  ResourcepackProjectDiagnostic,
  ResourcepackProjectDiagnosticSeverity,
  ResourcepackProjectFile,
  ResourcepackProjectPngValidationLimitName,
  ResourcepackProjectValidationLimitName,
  ResourcepackProjectValidationLimits,
  ResourcepackProjectValidationOptions,
  ResourcepackProjectValidationResult,
  ResourcepackSoundValidationIncompleteReason,
  ResourcepackTranslationComparison,
  ResourcepackTranslationDiagnostic,
  ResourcepackTranslationFile,
  ResourcepackTranslationIncompleteReason,
  ResourcepackTranslationLocaleSummary,
  ResourcepackTranslationValidationLimitName,
  ResourcepackTranslationValidationLimits,
  ResourcepackTranslationValidationOptions,
  ResourcepackTranslationValidationResult,
  ResponsePatternData,
  ResponsePatternIndexData,
  SearchMinecraftAssetsOptions,
  SearchMinecraftAssetsResult,
  SkillData,
  VanillaInventoryData,
  VersionDetailData,
  VersionIndexData,
  VersionSummaryData,
};
export {
  cleanCachedData,
  cleanMojangServerJar,
  defaultDatapackProjectValidationLimits,
  defaultResourcepackPngValidationLimits,
  defaultResourcepackProjectValidationLimits,
  defaultResourcepackTranslationValidationLimits,
  fetchData,
  fetchMinecraftAssetFile,
  fetchMinecraftAssetsArchive,
  fetchMinecraftAssetsIndex,
  fetchMojangServerJar,
  getCacheDataRoot,
  getCacheRoot,
  getDataManifest,
  getMinecraftAssetsStatus,
  getMojangServerJarStatus,
  hasBundledDataFile,
  hasCachedDataFile,
  hasCachedMinecraftAssetFile,
  hasDataFile,
  listCachedDataFiles,
  listCachedMojangServerJarEntries,
  readCachedMinecraftAssetText,
  readCachedMojangServerJarText,
  resolveDatapackProjectValidationLimits,
  resolveResourcepackPngValidationLimits,
  resolveResourcepackProjectValidationLimits,
  resolveResourcepackTranslationValidationLimits,
  searchMinecraftAssets,
  validateResourcepackPng,
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

export type PackFormatDomain = "datapack" | "resourcepack";

export type PackFormatLookup = {
  schemaVersion: 1;
  edition: EditionData;
  version: string;
  releaseTime: string;
  domain: PackFormatDomain;
  format: number | null;
  minor: number | null;
  status: VersionDetailData["packFormats"]["status"];
};

export type PackFormatVersionMatch = {
  version: string;
  releaseTime: string;
  domain: PackFormatDomain;
  format: number;
  minor: number | null;
  exactMinor: boolean;
  paperPluginStatus: string;
};

export type PackFormatVersionSearch = {
  schemaVersion: 1;
  edition: EditionData;
  domain: PackFormatDomain;
  format: number;
  minor: number | null;
  matches: PackFormatVersionMatch[];
};

export type MojangVersionMetadata = {
  schemaVersion: 1;
  edition: EditionData;
  version: string;
  type: string;
  releaseTime: string;
  protocolVersion: number | null;
  worldVersion: number | null;
  javaVersion: VersionDetailData["javaVersion"] | null;
  packFormats: VersionDetailData["packFormats"];
  official: {
    versionMetadataUrl: string | null;
    clientJarUrl: string | null;
    clientJarSha1: string | null;
    serverJarUrl: string | null;
    serverJarSha1: string | null;
    assetIndexUrl: string | null;
    assetIndexSha1: string | null;
  };
  provenance: {
    tier: "official" | "official-extracted";
    sources: VersionDetailData["sources"];
    note: string;
  };
};

export type FactSurfaceQuery = {
  domain?: string;
};

export type AuthoringChecklistQuery = {
  domain?: string;
};

export type AuthoringRecipeQuery = {
  domain?: string;
};

export type AuthoringScenarioQuery = {
  domain?: string;
};

export type AuthoringScenarioSearchOptions = {
  query: string;
  domain?: string;
  limit?: number;
};

export type AuthoringScenarioSearchMatch = {
  source: "scenario" | "recipe" | "intent";
  id: string;
  field: string;
  text: string;
  matchedTokens: string[];
};

export type AuthoringScenarioSearchResult = {
  scenario: AuthoringScenarioData;
  score: number;
  matches: AuthoringScenarioSearchMatch[];
};

export type AuthoringScenarioSearchResults = {
  query: string;
  domain?: DomainIdData;
  limit: number;
  truncated: boolean;
  results: AuthoringScenarioSearchResult[];
};

export type CatalogSearchKind =
  | "skill"
  | "reference"
  | "fact-surface"
  | "authoring-checklist"
  | "authoring-recipe"
  | "authoring-scenario"
  | "authoring-guardrail"
  | "authoring-diagnostic"
  | "claim-policy"
  | "output-requirement"
  | "response-pattern"
  | "intent-lookup"
  | "source-tier"
  | "community-dataset"
  | "version-support";

export type CatalogSearchOptions = {
  query: string;
  domain?: string;
  kind?: CatalogSearchKind;
  limit?: number;
};

export type CatalogSearchMatch = {
  field: string;
  text: string;
  matchedTokens: string[];
};

export type CatalogSearchResult = {
  kind: CatalogSearchKind;
  id: string;
  title: string;
  domains: DomainIdData[];
  score: number;
  matches: CatalogSearchMatch[];
  item: unknown;
};

export type CatalogSearchResults = {
  query: string;
  domain?: DomainIdData;
  kind?: CatalogSearchKind;
  limit: number;
  truncated: boolean;
  results: CatalogSearchResult[];
};

export type CrossSearchOptions = {
  query: string;
  edition?: string;
  version?: string;
  domain?: "datapack" | "resourcepack" | "paper-plugin";
  limit?: number;
};

export type CrossSearchEntry = {
  surface: string;
  domain: DomainIdData | "minecraft";
  kind: string;
  title: string;
  score: number;
  matches: string[];
  lookup: string;
};

export type CrossSearchResults = {
  schemaVersion: 1;
  query: string;
  edition: EditionData;
  version: string;
  domain?: "datapack" | "resourcepack" | "paper-plugin";
  limit: number;
  truncated: boolean;
  results: CrossSearchEntry[];
  gaps: string[];
};

export type ResourcepackAssetFindOptions = {
  query: string;
  edition?: string;
  version?: string;
  kind?:
    | "model"
    | "item-definition"
    | "texture"
    | "sound"
    | "language"
    | "blockstate"
    | "atlas"
    | "font"
    | "any";
  limit?: number;
};

export type ResourcepackAssetFindResult = {
  schemaVersion: 1;
  query: string;
  edition: EditionData;
  version: string;
  kind: NonNullable<ResourcepackAssetFindOptions["kind"]>;
  sections: Array<{
    source: string;
    total: number;
    truncated: boolean;
    paths: string[];
    note?: string;
  }>;
};

export type DatapackEntryFindOptions = {
  query: string;
  edition?: string;
  version?: string;
  limit?: number;
};

export type DatapackEntryFindResult = {
  schemaVersion: 1;
  query: string;
  edition: EditionData;
  version: string;
  sections: Array<{
    source: string;
    total: number;
    truncated: boolean;
    entries: unknown[];
    lookup: string;
  }>;
};

export type PackPathExplanationOptions = {
  path: string;
  edition?: string;
  version?: string;
  domain?: "datapack" | "resourcepack";
};

export type PackPathExplanation = {
  schemaVersion: 1;
  edition: EditionData;
  version: string;
  path: string;
  classification: PackFileClassification;
  schema: PackFileSchemaResult | null;
  nextLookups: string[];
  notes: string[];
};

export type LookupSuggestionOptions = {
  task: string;
  edition?: string;
  version?: string;
  domain?: "datapack" | "resourcepack" | "paper-plugin";
  limit?: number;
};

export type LookupSuggestionResult = {
  schemaVersion: 1;
  task: string;
  edition: EditionData;
  version: string;
  domain?: "datapack" | "resourcepack" | "paper-plugin";
  suggestedTools: Array<{
    tool: string;
    reason: string;
  }>;
  catalog: CatalogSearchResults;
  scenarios: AuthoringScenarioSearchResults;
};

export type AuthoringGuardrailQuery = {
  domain?: string;
};

export type AuthoringDiagnosticQuery = {
  domain?: string;
};

export type ClaimPolicyQuery = {
  domain?: string;
};

export type OutputRequirementQuery = {
  domain?: string;
};

export type ResponsePatternQuery = {
  domain?: string;
};

export type IntentLookupQuery = {
  domain?: string;
};

export type AuthoringPreflightOptions = {
  domain: string;
  edition?: string;
  version?: string;
};

export type EvidenceBundleOptions = {
  domain: string;
  edition?: string;
  version?: string;
};

export type SourceReportOptions = {
  domain?: string;
  edition?: string;
  version?: string;
};

export type AuthoringContextOptions = {
  domain: string;
  edition?: string;
  version?: string;
};

export type AuthoringPlanOptions = {
  scenario: string;
  edition?: string;
  version?: string;
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

export type ModrinthSearchIndex = "relevance" | "downloads" | "follows" | "newest" | "updated";

export type ModrinthProjectSearchOptions = {
  query: string;
  version?: string;
  projectType?: string;
  loader?: string;
  category?: string;
  index?: ModrinthSearchIndex;
  offset?: number;
  limit?: number;
};

export type ModrinthProjectVersionsOptions = {
  project: string;
  gameVersions?: string[];
  loaders?: string[];
  featured?: boolean;
  includeChangelog?: boolean;
};

export type ModrinthResourceKind =
  | "project"
  | "project-dependencies"
  | "version"
  | "version-file"
  | "user"
  | "categories"
  | "loaders"
  | "game-versions"
  | "project-types"
  | "side-types"
  | "donation-platforms"
  | "report-types"
  | "statistics";

export type ModrinthResourceOptions = {
  resource: ModrinthResourceKind;
  identifier?: string;
  algorithm?: "sha1" | "sha512";
};

export type ModrinthPackArchiveEntry = {
  path: string;
  size?: number;
  compressedSize?: number;
  directory?: boolean;
  compressionMethod?: number;
  flags?: number;
  crc32?: number;
  unixMode?: number;
};

export type ModrinthPackValidationStrength = "none" | "metadata" | "binary";

export type ModrinthPackValidationLimits = {
  maxArchiveBytes: number;
  maxArchiveEntries: number;
  maxIndexBytes: number;
  maxEntryUncompressedBytes: number;
  maxTotalUncompressedBytes: number;
  maxCompressionRatio: number;
  maxDiagnostics: number;
};

export const defaultModrinthPackValidationLimits: Readonly<ModrinthPackValidationLimits> =
  Object.freeze({
    maxArchiveBytes: 512 * 1024 * 1024,
    maxArchiveEntries: 25_000,
    maxIndexBytes: 16 * 1024 * 1024,
    maxEntryUncompressedBytes: 512 * 1024 * 1024,
    maxTotalUncompressedBytes: 4 * 1024 * 1024 * 1024,
    maxCompressionRatio: 200,
    maxDiagnostics: 200,
  });

export type ModrinthPackValidationOptions = {
  index: unknown;
  archiveEntries?: ModrinthPackArchiveEntry[];
  additionalDownloadHosts?: string[];
  limits?: Partial<ModrinthPackValidationLimits>;
};

export type ModrinthPackArchiveValidationOptions = {
  additionalDownloadHosts?: string[];
  limits?: Partial<ModrinthPackValidationLimits>;
};

export type ModrinthPackDiagnostic = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

export type ModrinthPackValidationResult = {
  schemaVersion: 1;
  specification: string;
  valid: boolean;
  errorCount: number;
  warningCount: number;
  validationStrength: ModrinthPackValidationStrength;
  diagnosticsTruncated: boolean;
  omittedDiagnosticCount: number;
  index: {
    formatVersion: number | null;
    game: string | null;
    versionId: string | null;
    name: string | null;
    files: number;
    dependencies: string[];
  } | null;
  archive: {
    provided: boolean;
    entries: number;
    overrideFiles: number;
  };
  diagnostics: ModrinthPackDiagnostic[];
};

export type PaperApiReference = {
  requestedVersion: string;
  supported: boolean;
  minecraftVersion: string;
  latestSupportedVersion: string;
  latestBuild: number | null;
  buildCount: number | null;
  apiDependency: string | null;
  javadocsUrl: string | null;
  docs: {
    paperDev: string;
    pluginConfiguration: string;
    commands: string;
    scheduling: string;
    foliaSupport: string;
    foliaOverview: string;
  };
  eventSearch: {
    url: string;
    defaultVersion: string;
    paperSources: string[];
  };
};

export type PaperApiComparison = {
  from: string;
  to: string;
  packageCount: {
    from: number;
    to: number;
    changed: boolean;
  };
  added: PaperApiIndexData["packages"];
  removed: PaperApiIndexData["packages"];
};

export type PaperTypeSearchOptions = {
  version?: string;
  packageName?: string;
  contains?: string;
  limit?: number;
};

export type PaperTypeSearchResult = {
  version: string;
  totalTypes: number;
  matchedTypes: number;
  truncated: boolean;
  types: PaperApiTypeData[];
};

export type PaperMemberSearchOptions = {
  version?: string;
  type?: string;
  packageName?: string;
  contains?: string;
  kind?: PaperApiMemberData["kind"];
  limit?: number;
};

export type PaperMemberSearchResult = {
  version: string;
  totalMembers: number;
  matchedMembers: number;
  truncated: boolean;
  members: PaperApiMemberData[];
};

export type PaperApiSurfaceComparison = {
  from: string;
  to: string;
  typeCount: {
    from: number;
    to: number;
    changed: boolean;
  };
  memberCount: {
    from: number;
    to: number;
    changed: boolean;
  };
  addedTypes: PaperApiTypeData[];
  removedTypes: PaperApiTypeData[];
  addedMembers: PaperApiMemberData[];
  removedMembers: PaperApiMemberData[];
  changes: Array<
    | { change: "added_type"; type: PaperApiTypeData }
    | { change: "removed_type"; type: PaperApiTypeData }
    | { change: "added_member"; member: PaperApiMemberData }
    | { change: "removed_member"; member: PaperApiMemberData }
  >;
};

export type SupportMatrix = {
  schemaVersion: 1;
  aliases: {
    latestJava: string;
    latestPaper: string;
    latestWithDatapackSchemaSurface: string | null;
    latestWithPaperApiSurface: string | null;
    latestWithResourcepackModels: string | null;
  };
  bundled: {
    javaVersions: number;
    paperVersions: number;
    datapackSchemaSurfaces: string[];
    paperApiSurfaces: string[];
    resourcepackModelSummaries: string[];
  };
  downloadable: Array<{
    kind: string;
    version?: string;
    path: string;
  }>;
};

export type AuthoringPreflight = {
  schemaVersion: 1;
  domain: DomainIdData;
  edition: EditionData;
  requestedVersion: string;
  resolvedVersion: string;
  checklist: AuthoringChecklistData;
  factSurfaces: FactSurfaceData[];
  version: VersionDetailData;
  domainCoverage: VersionDetailData["domains"][DomainIdData];
  supportMatrix: SupportMatrix;
  downloadable: Array<{
    kind: string;
    version?: string;
    path: string;
    bundled: boolean;
    cached: boolean;
    available: boolean;
  }>;
  paper?: PaperApiReference;
  warnings: string[];
};

export type VersionSupportQuery = {
  edition?: string;
  domain?: string;
};

export type VersionSupportEntry = {
  edition: EditionData;
  version: string;
  type: string;
  releaseTime: string;
  packFormats: VersionDetailData["packFormats"];
  domains: VersionDetailData["domains"];
  paper: {
    supported: boolean;
    latestBuild: number | null;
    buildCount: number | null;
  };
  surfaces: {
    datapackSchemaSurface: {
      bundled: boolean;
      cached: boolean;
      downloadable: boolean;
      available: boolean;
    };
    paperApiSurface: {
      bundled: boolean;
      cached: boolean;
      downloadable: boolean;
      available: boolean;
    };
    resourcepackModels: {
      bundled: boolean;
      cached: boolean;
      downloadable: boolean;
      available: boolean;
    };
  };
};

export type EvidenceBundle = {
  schemaVersion: 1;
  domain: DomainIdData;
  edition: EditionData;
  requestedVersion: string;
  resolvedVersion: string;
  sourcePolicy: CatalogData["sourcePolicy"];
  primarySources: DomainData["primarySources"];
  versionSources: VersionDetailData["sources"];
  factSurfaces: Array<
    Pick<
      FactSurfaceData,
      "id" | "title" | "dataKind" | "coverage" | "provenance" | "guarantees" | "nonGuarantees"
    >
  >;
  dataFiles: Array<{
    kind: string;
    path: string;
    bundled: boolean;
    cached: boolean;
    available: boolean;
  }>;
  links: Array<{
    id: string;
    kind: string;
    url: string;
  }>;
  warnings: string[];
};

export type SourceReport = {
  schemaVersion: 1;
  sourcePolicy: CatalogData["sourcePolicy"];
  domains: CatalogData["domains"];
  recommendedCommunityDatasets: CatalogData["sourcePolicy"]["recommendedCommunityDatasets"];
  prohibitedAutomation: string[];
  domain?: EvidenceBundle["domain"];
  edition?: EvidenceBundle["edition"];
  requestedVersion?: EvidenceBundle["requestedVersion"];
  resolvedVersion?: EvidenceBundle["resolvedVersion"];
  primarySources?: EvidenceBundle["primarySources"];
  versionSources?: EvidenceBundle["versionSources"];
  factSurfaces?: EvidenceBundle["factSurfaces"];
  dataFiles?: EvidenceBundle["dataFiles"];
  links?: EvidenceBundle["links"];
  warnings?: EvidenceBundle["warnings"];
};

export type SourceTierData = CatalogData["sourcePolicy"]["sourceTiers"][number];
export type CommunityDatasetData =
  CatalogData["sourcePolicy"]["recommendedCommunityDatasets"][number];

export type AuthoringContext = {
  schemaVersion: 1;
  domain: DomainIdData;
  edition: EditionData;
  requestedVersion: string;
  resolvedVersion: string;
  preflight: AuthoringPreflight;
  recipes: AuthoringRecipeData[];
  scenarios: AuthoringScenarioData[];
  guardrails: AuthoringGuardrailData[];
  diagnostics: AuthoringDiagnosticData[];
  claimPolicies: ClaimPolicyData[];
  outputRequirements: OutputRequirementData[];
  responsePatterns: ResponsePatternData[];
  intentLookups: IntentLookupData[];
  evidence: EvidenceBundle;
};

export type AuthoringPlan = {
  schemaVersion: 1;
  scenario: AuthoringScenarioData;
  domain: DomainIdData;
  recipes: AuthoringRecipeData[];
  intentLookups: IntentLookupData[];
  diagnostics: AuthoringDiagnosticData[];
  claimPolicies: ClaimPolicyData[];
  factSurfaces: FactSurfaceData[];
  responsePatterns: ResponsePatternData[];
  preflight?: AuthoringPreflight;
  evidence?: EvidenceBundle;
};

export type SkillReferencePayload = {
  reference: ReferenceData;
  markdown: string;
};

export type SkillPayload = {
  skill: SkillData;
  skillMarkdown: string;
  agentMetadata: string;
  references: SkillReferencePayload[];
};

export type CoverageSummary = {
  schemaVersion: 1;
  generatedFrom: "bundled-data";
  latest: CatalogData["latest"];
  supportPolicy: CatalogData["supportPolicy"];
  domains: {
    total: number;
    ids: DomainIdData[];
  };
  skills: {
    total: number;
    packagedPayloads: number;
  };
  java: {
    releases: {
      total: number;
      latest: string;
      oldest: string;
    };
    requiredData: {
      complete: boolean;
      missing: { version: string; path: string }[];
    };
    packFormats: {
      extracted: number;
      missing: number;
    };
    datapack: {
      serverReports: number;
      commandPathIndexes: number;
      registryEntryIndexes: number;
      vanillaInventories: number;
      vanillaPathIndexes: number;
      observedSchemaSurfaces: number;
      versionsWithoutUnknowns: number;
    };
    resourcepack: {
      vanillaInventories: number;
      vanillaPathIndexes: number;
      modelSummaries: number;
      versionsWithoutUnknowns: number;
    };
    paperPlugin: {
      supportedVersions: number;
      latestSupportedVersion: string;
      latestBuild: number;
      versionBuilds: number;
      apiPackageIndexes: number;
      apiSurfaces: number;
      versionsWithoutUnknowns: number;
      missingApiPackageIndexes: string[];
      missingApiSurfaces: string[];
    };
  };
};

export type VanillaPathDomain = "datapack" | "resourcepack";

export type PackFileClassificationDomain = "datapack" | "resourcepack" | "unknown";

export type PackFileClassification = {
  path: string;
  domain: PackFileClassificationDomain;
  kind: string;
  namespace: string | null;
  extension: string | null;
  json: boolean;
  schemaAvailable: boolean;
  schemaKind: string | null;
  notes: string[];
};

export type PackFileClassificationOptions = {
  paths: string[];
  domain?: "datapack" | "resourcepack";
};

export type PackFileClassificationResult = {
  schemaVersion: 1;
  requestedDomain?: "datapack" | "resourcepack";
  totalFiles: number;
  classifiedFiles: number;
  schemaAvailableFiles: number;
  kinds: Array<{
    domain: PackFileClassificationDomain;
    kind: string;
    count: number;
    schemaAvailable: boolean;
  }>;
  files: PackFileClassification[];
};

export type PackFileSchemaOptions = {
  path: string;
  version?: string;
  edition?: string;
  domain?: "datapack" | "resourcepack";
};

export type ObservedJsonSchemaField = {
  path: string;
  valueKinds: string[];
  count: number;
  samples: string[];
};

export type PackFileSchemaResult = {
  schemaVersion: 1;
  edition: EditionData;
  version: string;
  file: PackFileClassification;
  available: boolean;
  normative: false;
  coverage: string | null;
  notes: string[];
  observedFields: ObservedJsonSchemaField[];
  jsonSchema: Record<string, unknown> | null;
};

export type PackFileValidationInput = {
  path: string;
  content: string | unknown;
};

export type PackFileValidationOptions = PackFileValidationInput & {
  version?: string;
  edition?: string;
  domain?: "datapack" | "resourcepack";
};

export type PackFilesValidationOptions = {
  files: PackFileValidationInput[];
  version?: string;
  edition?: string;
  domain?: "datapack" | "resourcepack";
};

export type PackFileValidationIssue = {
  path: string;
  message: string;
  keyword: string | null;
  schemaPath: string | null;
  params: Record<string, unknown>;
};

export type PackFileValidationResult = {
  schemaVersion: 1;
  edition: EditionData;
  version: string;
  path: string;
  file: PackFileClassification;
  schemaAvailable: boolean;
  validated: boolean;
  valid: boolean;
  contentKind: "json" | "text" | "unknown";
  notes: string[];
  issues: PackFileValidationIssue[];
};

export type PackFilesValidationResult = {
  schemaVersion: 1;
  edition: EditionData;
  version: string;
  requestedDomain?: "datapack" | "resourcepack";
  totalFiles: number;
  validatedFiles: number;
  validFiles: number;
  invalidFiles: number;
  files: PackFileValidationResult[];
};

export type PackMigrationPlanOptions = {
  domain: "datapack" | "resourcepack";
  from: string;
  to: string;
  edition?: string;
  paths?: string[];
  limit?: number;
};

export type PackMigrationPlanResult = {
  schemaVersion: 1;
  edition: EditionData;
  domain: "datapack" | "resourcepack";
  from: string;
  to: string;
  summary: {
    packFormatChanged: boolean;
    minorPackFormatChanged: boolean;
    domainCoverageChanged: boolean;
    classifiedFiles: number;
    schemaBackedFiles: number;
  };
  versionComparison: VersionComparison;
  fileClassification: PackFileClassificationResult;
  schemaLookups: PackFileSchemaResult[];
  pathChanges: VanillaPathComparisonResult;
  schemaChanges: Array<{
    kind: string;
    addedTotal: number;
    removedTotal: number;
    truncated: boolean;
    added: Array<{ kind: string; path: string }>;
    removed: Array<{ kind: string; path: string }>;
  }>;
  considerations: string[];
  recommendedChecks: string[];
};

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

export type VanillaDatapackJsonSearchOptions = {
  edition?: string;
  version?: string;
  prefix?: string;
  contains?: string;
  kind?: string;
  limit?: number;
};

export type VanillaDatapackJsonSearchResult = {
  schemaVersion: 1;
  edition: EditionData;
  version: string;
  cache: MojangServerJarStatus;
  totalJsonFiles: number;
  matchedFiles: number;
  truncated: boolean;
  files: MojangServerJarEntry[];
  notes: string[];
};

export type VanillaDatapackJsonContentSearchOptions = {
  edition?: string;
  version?: string;
  query: string;
  prefix?: string;
  kind?: string;
  scope?: "keys" | "values" | "all";
  caseSensitive?: boolean;
  limit?: number;
  matchesPerFile?: number;
};

export type VanillaDatapackJsonContentMatch = {
  pointer: string | null;
  pointerTruncated?: true;
  matchedIn: "key" | "value";
  preview: string;
};

export type VanillaDatapackJsonContentSearchResult = {
  schemaVersion: 1;
  edition: EditionData;
  version: string;
  query: string;
  scope: "keys" | "values" | "all";
  caseSensitive: boolean;
  cache: MojangServerJarStatus;
  totalJsonFiles: number;
  candidateFiles: number;
  scannedFiles: number;
  scannedBytes: number;
  matchedFiles: number;
  returnedFiles: number;
  invalidJsonFiles: number;
  traversalLimitedFiles: number;
  skippedTraversalFiles: number;
  traversalLimitedPaths: string[];
  traversalSkippedPaths: string[];
  traversedNodes: number;
  traversalNodeLimit: number;
  skippedOversizedFiles: number;
  skippedBudgetFiles: number;
  scanComplete: boolean;
  truncated: boolean;
  files: Array<{
    path: string;
    kind: string;
    compressedSize: number;
    uncompressedSize: number;
    matches: VanillaDatapackJsonContentMatch[];
    matchesTruncated: boolean;
  }>;
  skippedPaths: string[];
  notes: string[];
};

export type VanillaDatapackJsonOptions = {
  edition?: string;
  version?: string;
  path: string;
  parse?: boolean;
};

export type VanillaDatapackJsonResult = {
  schemaVersion: 1;
  edition: EditionData;
  version: string;
  path: string;
  cache: MojangServerJarStatus;
  content: string;
  json: unknown | null;
  notes: string[];
};

export type FetchMojangServerJarForVersionOptions = {
  edition?: string;
  version?: string;
  force?: boolean;
  fetch?: typeof fetch;
};

export type VanillaPathComparisonOptions = {
  edition?: string;
  from: string;
  to: string;
  domain?: VanillaPathDomain;
  prefix?: string;
  contains?: string;
  extension?: string;
  limit?: number;
};

export type VanillaPathComparisonResult = {
  edition: EditionData;
  from: string;
  to: string;
  domain: VanillaPathDomain;
  fromTotalPaths: number;
  toTotalPaths: number;
  addedTotal: number;
  removedTotal: number;
  truncated: boolean;
  added: string[];
  removed: string[];
};

export type DatapackSchemaSearchOptions = {
  edition?: string;
  version?: string;
  kind?: string;
  path?: string;
  contains?: string;
  limit?: number;
};

export type DatapackSchemaSearchResult = {
  edition: EditionData;
  version: string;
  totalFields: number;
  matchedFields: number;
  truncated: boolean;
  fields: Array<
    ObservedDatapackSchemaSurfaceData["kinds"][number]["fieldPaths"][number] & {
      kind: string;
    }
  >;
};

export type DatapackSchemaComparisonOptions = {
  edition?: string;
  from: string;
  to: string;
  kind?: string;
  contains?: string;
  limit?: number;
};

export type DatapackSchemaComparisonResult = {
  edition: EditionData;
  from: string;
  to: string;
  fromTotalFields: number;
  toTotalFields: number;
  addedTotal: number;
  removedTotal: number;
  truncated: boolean;
  added: Array<{ kind: string; path: string }>;
  removed: Array<{ kind: string; path: string }>;
  changes: Array<
    | { change: "field_path_added"; field: { kind: string; path: string } }
    | { change: "field_path_removed"; field: { kind: string; path: string } }
  >;
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

export type CommandComparisonOptions = {
  edition?: string;
  from: string;
  to: string;
  contains?: string;
  prefix?: string;
  parser?: string;
  limit?: number;
};

export type CommandComparisonResult = {
  edition: EditionData;
  from: string;
  to: string;
  fromTotalPaths: number;
  toTotalPaths: number;
  addedTotal: number;
  removedTotal: number;
  truncated: boolean;
  added: string[];
  removed: string[];
};

export type RegistryEntry = {
  registryId: string;
  entryId: string;
  protocolId: number | null;
};

export type RegistryEntryProtocolIdChange = {
  registryId: string;
  entryId: string;
  from: number;
  to: number;
};

export type RegistryEntryFilter = {
  exact?: string;
  contains?: string;
  prefix?: string;
  registry?: string;
};

export type RegistryEntrySearchOptions = RegistryEntryFilter & {
  edition?: string;
  version?: string;
  limit?: number;
};

export type RegistryEntryStatus =
  | "all"
  | "indexed"
  | "unindexed"
  | "unknown"
  | "official-report-unavailable";

export type RegistryEntryComparisonOutcome = "compared" | "partially-compared" | "not-comparable";

export type RegistryEntryComparisonExclusion = {
  registryId: string;
  from: RegistryEntryStatus;
  to: RegistryEntryStatus;
};

export type RegistryEntrySearchResult = {
  schemaVersion: 1;
  edition: EditionData;
  version: string;
  indexCoverage: JavaReportsSummaryData["datapack"]["registryEntries"];
  registryFilter: string | null;
  registryStatus: RegistryEntryStatus;
  totalEntries: number;
  matchedEntries: number;
  truncated: boolean;
  entries: RegistryEntry[];
};

export type RegistryEntryComparisonOptions = RegistryEntryFilter & {
  edition?: string;
  from: string;
  to: string;
  limit?: number;
};

export type RegistryEntryComparisonResult = {
  schemaVersion: 1;
  edition: EditionData;
  registryFilter: string | null;
  from: {
    version: string;
    registryStatus: RegistryEntryStatus;
    indexCoverage: JavaReportsSummaryData["datapack"]["registryEntries"];
    totalEntries: number;
  };
  to: {
    version: string;
    registryStatus: RegistryEntryStatus;
    indexCoverage: JavaReportsSummaryData["datapack"]["registryEntries"];
    totalEntries: number;
  };
  outcome: RegistryEntryComparisonOutcome;
  comparedRegistryCount: number;
  excludedRegistriesTotal: number;
  addedTotal: number;
  removedTotal: number;
  changedProtocolIdsTotal: number;
  truncated: boolean;
  excludedRegistries: RegistryEntryComparisonExclusion[];
  added: RegistryEntry[];
  removed: RegistryEntry[];
  changedProtocolIds: RegistryEntryProtocolIdChange[];
  notes: string[];
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

export type FetchJson = (
  url: string,
  init?: RequestInit,
) => Promise<{
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

export function listSkills(domain?: string): SkillData[] {
  const catalog = getCatalog();
  if (!domain) {
    return catalog.skills;
  }
  const domainId = DomainId.assert(domain);
  return catalog.skills.filter((skill) => skill.domain === domainId);
}

export function listFactSurfaces(query: FactSurfaceQuery = {}): FactSurfaceData[] {
  const index = FactSurfaceIndex.assert(readDataJson("fact-surfaces.json"));
  if (!query.domain) {
    return index.surfaces;
  }
  const domain = DomainId.assert(query.domain);
  return index.surfaces.filter((surface) => surface.domains.includes(domain));
}

export function getFactSurface(id: string): FactSurfaceData {
  const found = listFactSurfaces().find((surface) => surface.id === id);
  if (!found) {
    throw new Error(`Unknown fact surface: ${id}`);
  }
  return FactSurface.assert(found);
}

export function listAuthoringChecklists(
  query: AuthoringChecklistQuery = {},
): AuthoringChecklistData[] {
  const index = AuthoringChecklistIndex.assert(readDataJson("authoring-checklists.json"));
  if (!query.domain) {
    return index.checklists;
  }
  const domain = DomainId.assert(query.domain);
  return index.checklists.filter((checklist) => checklist.domain === domain);
}

export function getAuthoringChecklist(domain: string): AuthoringChecklistData {
  const domainId = DomainId.assert(domain);
  const found = listAuthoringChecklists().find((checklist) => checklist.domain === domainId);
  if (!found) {
    throw new Error(`Unknown authoring checklist domain: ${domain}`);
  }
  return AuthoringChecklist.assert(found);
}

export function listAuthoringRecipes(query: AuthoringRecipeQuery = {}): AuthoringRecipeData[] {
  const index = AuthoringRecipeIndex.assert(readDataJson("authoring-recipes.json"));
  if (!query.domain) {
    return index.recipes;
  }
  const domain = DomainId.assert(query.domain);
  return index.recipes.filter((recipe) => recipe.domains.includes(domain));
}

export function getAuthoringRecipe(id: string): AuthoringRecipeData {
  const found = listAuthoringRecipes().find((recipe) => recipe.id === id);
  if (!found) {
    throw new Error(`Unknown authoring recipe: ${id}`);
  }
  return AuthoringRecipe.assert(found);
}

export function listAuthoringScenarios(
  query: AuthoringScenarioQuery = {},
): AuthoringScenarioData[] {
  const index = AuthoringScenarioIndex.assert(readDataJson("authoring-scenarios.json"));
  if (!query.domain) {
    return index.scenarios;
  }
  const domain = DomainId.assert(query.domain);
  return index.scenarios.filter((scenario) => scenario.domains.includes(domain));
}

export function getAuthoringScenario(id: string): AuthoringScenarioData {
  const found = listAuthoringScenarios().find((scenario) => scenario.id === id);
  if (!found) {
    throw new Error(`Unknown authoring scenario: ${id}`);
  }
  return AuthoringScenario.assert(found);
}

const scenarioSearchStopWords = new Set([
  "and",
  "for",
  "the",
  "that",
  "this",
  "with",
  "from",
  "into",
  "when",
  "what",
  "which",
  "create",
  "review",
  "write",
  "generate",
]);

function tokenizeScenarioSearch(value: string): string[] {
  const tokens = value
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !scenarioSearchStopWords.has(token));
  return [...new Set(tokens)];
}

function normalizeSearchText(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const discoverySearchStopWords = new Set([
  ...scenarioSearchStopWords,
  "find",
  "get",
  "list",
  "lookup",
  "need",
  "please",
  "search",
  "show",
  "use",
  "using",
  "want",
]);

const contextualDiscoveryIntentWords = new Set(["handler", "listener"]);

function tokenizeDiscoveryQuery(query: string): string[] {
  const tokens = [
    ...new Set(
      normalizeSearchText(query)
        .split(/\s+/)
        .filter((token) => token && !discoverySearchStopWords.has(token)),
    ),
  ];
  const specificTokens = tokens.filter((token) => !contextualDiscoveryIntentWords.has(token));
  return specificTokens.length > 0 ? specificTokens : tokens;
}

const discoveryFillerTokens = new Set([
  "api",
  "asset",
  "audio",
  "block",
  "command",
  "data",
  "datapack",
  "definition",
  "field",
  "image",
  "item",
  "language",
  "member",
  "model",
  "pack",
  "paper",
  "path",
  "plugin",
  "resource",
  "resourcepack",
  "schema",
  "sound",
  "state",
  "texture",
  "translation",
  "type",
]);

function primaryDiscoveryTerm(query: string): string {
  const tokens = tokenizeDiscoveryQuery(query);
  const searchableTokens = tokens.filter((token) => !discoveryFillerTokens.has(token));
  return searchableTokens.reduce(
    (longest, token) => (token.length > longest.length ? token : longest),
    searchableTokens[0] ?? "",
  );
}

const vanillaJsonDiscoveryFillerTokens = new Set([
  "advancement",
  "advancements",
  "built",
  "builtin",
  "official",
  "json",
  "inspect",
  "loot",
  "contain",
  "contains",
  "content",
  "file",
  "files",
  "predicate",
  "predicates",
  "recipe",
  "recipes",
  "reference",
  "references",
  "table",
  "tables",
  "tag",
  "tags",
  "vanilla",
  "worldgen",
]);

function vanillaJsonDiscoveryTerm(query: string): string {
  const tokens = tokenizeDiscoveryQuery(query).filter(
    (token) => !discoveryFillerTokens.has(token) && !vanillaJsonDiscoveryFillerTokens.has(token),
  );
  return tokens.reduce(
    (longest, token) => (token.length > longest.length ? token : longest),
    tokens[0] ?? "",
  );
}

function vanillaJsonDiscoveryKind(query: string): string | undefined {
  if (/\badvancements?\b/.test(query)) return "advancement";
  if (/\bloot(?:[ -]+tables?)?\b/.test(query)) return "loot_table";
  if (/\brecipes?\b/.test(query)) return "recipe";
  if (/\bpredicates?\b/.test(query)) return "predicate";
  if (/\btags?\b/.test(query)) return "tag";
  if (/\bworldgen\b/.test(query)) return "worldgen";
  return undefined;
}

function discoveryContainsOption(term: string): string {
  return term ? ` --contains ${JSON.stringify(term)}` : "";
}

function matchesDiscoveryQuery(query: string, ...values: string[]): boolean {
  const tokens = tokenizeDiscoveryQuery(query);
  const haystack = normalizeSearchText(values.join(" "));
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

function isFabricToolchainDiscoveryQuery(query: string): boolean {
  const normalized = normalizeSearchText(query);
  if (/\b(loader|intermediary|mapping|mappings)\b/.test(normalized)) {
    return true;
  }
  const hasMinecraftOrFabricContext = /\b(minecraft|fabric)\b/.test(normalized);
  return hasMinecraftOrFabricContext && /\b(yarn|toolchain)\b/.test(normalized);
}

function isServerPropertiesValidationQuery(query: string): boolean {
  const normalized = normalizeSearchText(query);
  if (
    /\bserver properties\b/.test(normalized) &&
    /\b(check|lint|parse|review|validat(?:e|es|ed|ing|ion|or))\b/.test(normalized)
  ) {
    return true;
  }
  if (/\bserver[.]properties\b/i.test(query)) return true;
  const hasPropertyKey =
    /\b(enable-rcon|online-mode|query[.]port|rcon[.](?:password|port)|resource-pack-sha1|server-port)\b/i.test(
      query,
    );
  return hasPropertyKey && /\b(config|configuration|properties|server)\b/.test(normalized);
}

function isFabricModValidationDiscoveryQuery(query: string): boolean {
  const normalized = normalizeSearchText(query);
  const hasFabricArtifact =
    /\bfabric mod json\b/.test(normalized) ||
    (/\bfabric\b/.test(normalized) && /\b(mod (?:artifact|jar|metadata)|jar)\b/.test(normalized));
  const hasValidationIntent =
    /\b(validat(?:e|es|ed|ing|ion)?|verif(?:y|ies|ied|ication)|check|inspect|lint)\b/.test(
      normalized,
    );
  return hasFabricArtifact && hasValidationIntent;
}

function isVelocityPluginJarValidationDiscoveryQuery(query: string): boolean {
  const normalized = normalizeSearchText(query);
  if (!/\bvelocity\b/u.test(normalized)) return false;
  const hasArtifactContext =
    /\b(?:artifact|classfile|descriptor|entrypoint|jar|jdk|metadata|plugin)\b/u.test(normalized) ||
    /\b(?:java target|velocity plugin json)\b/u.test(normalized);
  const hasValidationIntent =
    /\b(?:check|inspect|lint|validat(?:e|es|ed|ing|ion)?|verif(?:y|ies|ied|ication))\b/u.test(
      normalized,
    );
  return hasArtifactContext && hasValidationIntent;
}

function isServerAccessListValidationQuery(query: string): boolean {
  const normalized = normalizeSearchText(query);
  if (/\b(whitelist json|ops json|banned players json|banned ips json)\b/.test(normalized)) {
    return true;
  }
  const hasValidationIntent = /\b(validate|check|inspect|lint|verify|diagnose)\b/.test(normalized);
  const hasAccessListSubject =
    /\b(server access list|server allowlist|server whitelist|server operator list|minecraft operator list|player ban list|ip ban list|whitelist file|server ban list file)\b/.test(
      normalized,
    );
  return hasValidationIntent && hasAccessListSubject;
}

function isMinecraftPerformanceAnalysisQuery(query: string): boolean {
  const normalized = normalizeSearchText(query);
  const hasAnalysisIntent =
    /\b(analyze|analyse|check|compare|diagnose|inspect|investigate|measure|review|trend|verify)\b/.test(
      normalized,
    );
  const hasPerformanceSeries =
    /\b(tps|mspt|tick lag|tick time|server performance|minecraft performance|performance regression|performance time series|performance timeseries)\b/.test(
      normalized,
    );
  return hasAnalysisIntent && hasPerformanceSeries;
}

function isPaperItemDeliveryDiscoveryQuery(query: string): boolean {
  const normalized = normalizeSearchText(query);
  const hasItemContext = /\b(inventory|item|items|itemstack|stack|stacks)\b/.test(normalized);
  const hasOverflowContext =
    /\b(full inventory|inventory (?:is )?full|overflow|leftover|leftovers|uninserted|did not fit|does not fit|cannot fit|item loss|lost item|lost items)\b/.test(
      normalized,
    );
  if (hasItemContext && hasOverflowContext) {
    return true;
  }
  if (
    /\b(resource ?pack|asset|blockstate|font|model|sound|texture|translation)\b/.test(normalized)
  ) {
    return false;
  }
  const hasDeliveryAction = /\b(award|deliver|give|grant|refund|restore|reward)\b/.test(normalized);
  const hasRecipientContext = /\b(inventory|player|recipient)\b/.test(normalized);
  return hasDeliveryAction && hasItemContext && hasRecipientContext;
}

function isPaperInventoryGuiDiscoveryQuery(query: string): boolean {
  const normalized = normalizeSearchText(query);
  const hasPaperContext =
    /\b(paper|bukkit|spigot|plugin|inventoryclickevent|inventorydragevent)\b/.test(normalized);
  const hasExplicitPackContext =
    /\b(resource ?pack|data ?pack|asset|blockstate|font|model|texture|translation|mcfunction|worldgen)\b/.test(
      normalized,
    );
  if (hasExplicitPackContext && !hasPaperContext) {
    return false;
  }
  const hasInventoryContext =
    /\b(inventory|inventories|inventoryview|inventoryclickevent|inventorydragevent|gui|menu|shop|selector|chest interface|virtual inventory)\b/.test(
      normalized,
    );
  const hasInteractionContext =
    /\b(click|shift click|drag|hotbar|number key|offhand|double click|collect to cursor|swap|transfer|allowed slot|cancel|close|reopen)\b/.test(
      normalized,
    );
  const hasCustomContext =
    hasPaperContext || /\b(custom|gui|menu|shop|selector|virtual|protected)\b/.test(normalized);
  return hasInventoryContext && hasInteractionContext && hasCustomContext;
}

function isPaperItemStackSemanticIdentityDiscoveryQuery(
  query: string,
  domain?: DomainIdData,
): boolean {
  const normalized = normalizeSearchText(query);
  const hasExplicitPaperContext = /\b(paper|bukkit|spigot|paper plugin)\b/.test(normalized);
  const hasBukkitItemApiContext =
    /\b(itemmeta|item meta|persistentdatacontainer|persistent data container|pdc|namespacedkey|namespaced key)\b/.test(
      normalized,
    );
  const hasExplicitNonPaperPlatform = /\b(fabric|forge|neoforge|quilt|sponge)\b/.test(normalized);
  if (hasExplicitNonPaperPlatform && !hasExplicitPaperContext) {
    return false;
  }
  const hasExplicitPackContext =
    /\b(resource ?pack|data ?pack|asset|blockstate|texture|mcfunction|worldgen)\b/.test(normalized);
  if (hasExplicitPackContext && !hasExplicitPaperContext && !hasBukkitItemApiContext) {
    return false;
  }
  const hasItemContext =
    /\b(itemstack|item stack|itemmeta|item meta|custom item|plugin item|persistentdatacontainer|persistent data container|pdc)\b/.test(
      normalized,
    );
  const hasSemanticOrUpdateContext =
    /\b(identity|identifier|identify|recognize|recognition|semantic|schema|migrat(?:e|es|ed|ing|ion)|versioned|display name|custom name|item name|lore|item model|custom model data|metadata|preserv(?:e|es|ed|ing|ation)|clone|alias|similar|similarity|stackability|refresh|update)\b/.test(
      normalized,
    );
  return (
    hasItemContext &&
    hasSemanticOrUpdateContext &&
    (domain === "paper-plugin" || hasExplicitPaperContext || hasBukkitItemApiContext)
  );
}

function isPaperPluginConfigurationLifecycleQuery(query: string): boolean {
  const normalized = normalizeSearchText(query);
  const hasPaperContext =
    /\b(paper|bukkit|spigot|javaplugin|paper plugin|bukkit plugin|spigot plugin)\b/.test(
      normalized,
    );
  const hasConfigurationContext =
    /\b(config|configuration|config yml|yaml|reloadconfig|saveconfig|savedefaultconfig)\b/.test(
      normalized,
    );
  const hasLifecycleContext =
    /\b(startup|enable|disable|load|reload|hot reload|save|migration|migrate|atomic|transaction|rollback|last known good|generation|restart required)\b/.test(
      normalized,
    );
  return hasPaperContext && hasConfigurationContext && hasLifecycleContext;
}

function isVelocityToolchainDiscoveryQuery(query: string): boolean {
  const normalized = normalizeSearchText(query);
  const describesMotion =
    /\b(?:entity|player) velocity\b|\bvelocity (?:vector|vectors)\b|\b(?:get|set) velocity\b|\b(?:getvelocity|setvelocity|knockback|motion|movement|physics|speed)\b/.test(
      normalized,
    );
  if (describesMotion) {
    return false;
  }
  return (
    /\bvelocity\b/.test(normalized) &&
    /\b(artifact|coordinate|dependencies|dependency|gradle|java|jdk|latest|maven|release|snapshot|toolchain|versions?)\b/.test(
      normalized,
    )
  );
}

function isPaperWorldOperationSafetyDiscoveryQuery(query: string): boolean {
  const normalized = normalizeSearchText(query);
  if (/\bpaper world operation safety(?: review)?\b/.test(normalized)) {
    return true;
  }
  const hasPaperContext =
    /\b(paper|bukkit|spigot|plugin|getchunkatasync|chunkunloadevent|regionscheduler|entityscheduler)\b/.test(
      normalized,
    ) || /\bplugin chunk tickets?\b/.test(normalized);
  const hasExplicitPackContext =
    /\b(resource ?pack|data ?pack|asset|blockstate|font|model|texture|translation|mcfunction|worldgen)\b/.test(
      normalized,
    );
  const hasExplicitNonPaperPlatform = /\b(fabric|forge|neoforge|quilt)\b/.test(normalized);
  if (hasExplicitPackContext || hasExplicitNonPaperPlatform) {
    return false;
  }

  const hasChunkLifecycleContext =
    /\b(chunk|chunks|getchunkatasync|chunkunloadevent)\b/.test(normalized) &&
    /\b(load|loading|loaded|unload|unloading|unloaded|generate|generation|ticket|tickets|pin|pinned|residency|lease|border|boundary|boundaries|cross chunk|crossing chunks)\b/.test(
      normalized,
    );
  const hasWorldTarget = /\b(block|blocks|entity|entities|world|location|region|chunks?)\b/.test(
    normalized,
  );
  const hasMutation =
    /\b(edit|update|mutate|mutation|set|replace|scan|drop|spawn|remove|delete|move|moving|teleport|process|operation)\b/.test(
      normalized,
    );
  const hasBoundedLifecycleIntent =
    /\b(bounded|limit|limited|batch|per tick|time budget|cross chunk|chunk boundary|chunk boundaries|region boundary|region boundaries|regionscheduler|entityscheduler|folia region|unload race|disable race|plugin disable|stale|idempotent|reconcile|reconciliation|partial retry|ticket leak)\b/.test(
      normalized,
    );
  const hasBoundedWorldMutationContext = hasWorldTarget && hasMutation && hasBoundedLifecycleIntent;

  return hasPaperContext && (hasChunkLifecycleContext || hasBoundedWorldMutationContext);
}

function scoreDiscoveryMatch(query: string, actual: string[], semantic: string[] = []): number {
  const actualText = normalizeSearchText(actual.join(" "));
  const semanticText = normalizeSearchText(semantic.join(" "));
  return tokenizeDiscoveryQuery(query).reduce((score, token) => {
    if (actualText.includes(token)) return score + 20;
    if (semanticText.includes(token)) return score + 25;
    return score;
  }, 0);
}

function isModrinthCompatibilityTask(value: string): boolean {
  const normalized = normalizeSearchText(value);
  const hasModrinthContext = /\b(modrinth|mods?|modpacks?)\b/.test(normalized);
  const hasCompatibilityIntent =
    /\b(compatibility|compatible|common versions?|same versions?|together|work with)\b/.test(
      normalized,
    ) || /互換|共通.*バージョン|一緒に使/.test(value);
  return hasModrinthContext && hasCompatibilityIntent;
}

function resourcepackDiscoveryTerms(path: string): string {
  const terms = ["resourcepack resource pack", "asset"];
  if (path.includes("/items/")) terms.push("item item definition model");
  if (path.includes("/models/")) terms.push("model");
  if (path.includes("/textures/") || path.endsWith(".png")) terms.push("texture image");
  if (path.includes("/sounds/") || path.endsWith(".ogg")) terms.push("sound audio");
  if (path.includes("/lang/")) terms.push("language translation");
  if (path.includes("/blockstates/")) terms.push("block state");
  if (path.includes("/atlases/")) terms.push("atlas");
  if (path.includes("/font/")) terms.push("font");
  return terms.join(" ");
}

function scoreScenarioSearchText(
  options: {
    source: AuthoringScenarioSearchMatch["source"];
    id: string;
    field: string;
    text: string;
    weight: number;
  },
  tokens: string[],
): { score: number; match?: AuthoringScenarioSearchMatch } {
  const haystack = options.text.toLowerCase();
  const matchedTokens = tokens.filter((token) => haystack.includes(token));
  if (matchedTokens.length === 0) {
    return { score: 0 };
  }
  return {
    score: matchedTokens.length * options.weight,
    match: {
      source: options.source,
      id: options.id,
      field: options.field,
      text: options.text,
      matchedTokens,
    },
  };
}

function collectScenarioSearchTexts(scenario: AuthoringScenarioData): Array<{
  source: AuthoringScenarioSearchMatch["source"];
  id: string;
  field: string;
  text: string;
  weight: number;
}> {
  return [
    { source: "scenario", id: scenario.id, field: "id", text: scenario.id, weight: 6 },
    { source: "scenario", id: scenario.id, field: "title", text: scenario.title, weight: 6 },
    {
      source: "scenario",
      id: scenario.id,
      field: "userPrompt",
      text: scenario.userPrompt,
      weight: 5,
    },
    ...scenario.useWhen.map((text) => ({
      source: "scenario" as const,
      id: scenario.id,
      field: "useWhen",
      text,
      weight: 4,
    })),
    ...scenario.successCriteria.map((text) => ({
      source: "scenario" as const,
      id: scenario.id,
      field: "successCriteria",
      text,
      weight: 2,
    })),
    ...scenario.mustAvoid.map((text) => ({
      source: "scenario" as const,
      id: scenario.id,
      field: "mustAvoid",
      text,
      weight: 1,
    })),
    {
      source: "scenario",
      id: scenario.id,
      field: "failureMode",
      text: scenario.failureMode,
      weight: 1,
    },
    ...scenario.requiredLookups.recipes.flatMap((id) => {
      const recipe = getAuthoringRecipe(id);
      return [
        { source: "recipe" as const, id, field: "id", text: recipe.id, weight: 4 },
        { source: "recipe" as const, id, field: "title", text: recipe.title, weight: 4 },
        ...recipe.when.map((text) => ({
          source: "recipe" as const,
          id,
          field: "when",
          text,
          weight: 3,
        })),
      ];
    }),
    ...scenario.requiredLookups.intents.flatMap((id) => {
      const intent = getIntentLookup(id);
      return [
        { source: "intent" as const, id, field: "id", text: intent.id, weight: 3 },
        { source: "intent" as const, id, field: "title", text: intent.title, weight: 3 },
        ...intent.when.map((text) => ({
          source: "intent" as const,
          id,
          field: "when",
          text,
          weight: 2,
        })),
      ];
    }),
  ];
}

export function searchAuthoringScenarios(
  options: AuthoringScenarioSearchOptions,
): AuthoringScenarioSearchResults {
  const query = options.query.trim();
  if (!query) {
    throw new Error("Authoring scenario search requires a non-empty query");
  }
  const limit = normalizeLimit(options.limit, 10, 100);
  const domain = options.domain ? DomainId.assert(options.domain) : undefined;
  const tokens = tokenizeScenarioSearch(query);
  const paperItemDeliveryQuery = isPaperItemDeliveryDiscoveryQuery(query);
  const paperInventoryGuiQuery = isPaperInventoryGuiDiscoveryQuery(query);
  const paperWorldOperationQuery = isPaperWorldOperationSafetyDiscoveryQuery(query);
  const paperItemStackSemanticIdentityQuery = isPaperItemStackSemanticIdentityDiscoveryQuery(
    query,
    domain,
  );
  const scenarios = listAuthoringScenarios(domain ? { domain } : {});
  const scored = scenarios
    .map((scenario) => {
      if (scenario.id === "paper-world-operation-safety-review" && !paperWorldOperationQuery) {
        return { scenario, score: 0, matches: [] };
      }
      let score =
        (paperItemDeliveryQuery && scenario.id === "paper-item-delivery-review") ||
        (paperInventoryGuiQuery && scenario.id === "paper-inventory-gui-interaction-review") ||
        (paperWorldOperationQuery && scenario.id === "paper-world-operation-safety-review") ||
        (paperItemStackSemanticIdentityQuery &&
          scenario.id === "paper-itemstack-semantic-identity-review")
          ? 1_000
          : 0;
      const matches: AuthoringScenarioSearchMatch[] = [];
      for (const text of collectScenarioSearchTexts(scenario)) {
        const result = scoreScenarioSearchText(text, tokens);
        score += result.score;
        if (result.match) {
          matches.push(result.match);
        }
      }
      return { scenario, score, matches };
    })
    .filter((result) => result.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.scenario.id.localeCompare(right.scenario.id),
    );

  return {
    query,
    ...(domain ? { domain } : {}),
    limit,
    truncated: scored.length > limit,
    results: scored.slice(0, limit),
  };
}

function requireSingleScenarioDomain(scenario: AuthoringScenarioData): DomainIdData {
  if (scenario.domains.length !== 1) {
    throw new Error(`Authoring scenario must have exactly one domain: ${scenario.id}`);
  }
  return DomainId.assert(scenario.domains[0]);
}

export function getAuthoringPlan(options: AuthoringPlanOptions): AuthoringPlan {
  const scenario = getAuthoringScenario(options.scenario);
  const domain = requireSingleScenarioDomain(scenario);
  const preflight = options.version
    ? getAuthoringPreflight({
        domain,
        version: options.version,
        ...(options.edition ? { edition: options.edition } : {}),
      })
    : undefined;
  const evidence = preflight
    ? getEvidenceBundle({
        domain,
        edition: preflight.edition,
        version: preflight.resolvedVersion,
      })
    : undefined;

  return {
    schemaVersion: 1,
    scenario,
    domain,
    recipes: scenario.requiredLookups.recipes.map(getAuthoringRecipe),
    intentLookups: scenario.requiredLookups.intents.map(getIntentLookup),
    diagnostics: scenario.requiredLookups.diagnostics.map(getAuthoringDiagnostic),
    claimPolicies: scenario.requiredLookups.claimPolicies.map(getClaimPolicy),
    factSurfaces: scenario.requiredLookups.factSurfaces.map(getFactSurface),
    responsePatterns: scenario.requiredLookups.responsePatterns.map(getResponsePattern),
    ...(preflight ? { preflight } : {}),
    ...(evidence ? { evidence } : {}),
  };
}

export function listAuthoringGuardrails(
  query: AuthoringGuardrailQuery = {},
): AuthoringGuardrailData[] {
  const index = AuthoringGuardrailIndex.assert(readDataJson("authoring-guardrails.json"));
  if (!query.domain) {
    return index.guardrails;
  }
  const domain = DomainId.assert(query.domain);
  return index.guardrails.filter((guardrail) => guardrail.domains.includes(domain));
}

export function getAuthoringGuardrail(id: string): AuthoringGuardrailData {
  const found = listAuthoringGuardrails().find((guardrail) => guardrail.id === id);
  if (!found) {
    throw new Error(`Unknown authoring guardrail: ${id}`);
  }
  return AuthoringGuardrail.assert(found);
}

export function listAuthoringDiagnostics(
  query: AuthoringDiagnosticQuery = {},
): AuthoringDiagnosticData[] {
  const index = AuthoringDiagnosticIndex.assert(readDataJson("authoring-diagnostics.json"));
  if (!query.domain) {
    return index.diagnostics;
  }
  const domain = DomainId.assert(query.domain);
  return index.diagnostics.filter((diagnostic) => diagnostic.domains.includes(domain));
}

export function getAuthoringDiagnostic(id: string): AuthoringDiagnosticData {
  const found = listAuthoringDiagnostics().find((diagnostic) => diagnostic.id === id);
  if (!found) {
    throw new Error(`Unknown authoring diagnostic: ${id}`);
  }
  return AuthoringDiagnostic.assert(found);
}

export function listClaimPolicies(query: ClaimPolicyQuery = {}): ClaimPolicyData[] {
  const index = ClaimPolicyIndex.assert(readDataJson("claim-policies.json"));
  if (!query.domain) {
    return index.policies;
  }
  const domain = DomainId.assert(query.domain);
  return index.policies.filter((policy) => policy.domains.includes(domain));
}

export function getClaimPolicy(id: string): ClaimPolicyData {
  const found = listClaimPolicies().find((policy) => policy.id === id);
  if (!found) {
    throw new Error(`Unknown claim policy: ${id}`);
  }
  return ClaimPolicy.assert(found);
}

export function listOutputRequirements(
  query: OutputRequirementQuery = {},
): OutputRequirementData[] {
  const index = OutputRequirementIndex.assert(readDataJson("output-requirements.json"));
  if (!query.domain) {
    return index.requirements;
  }
  const domain = DomainId.assert(query.domain);
  return index.requirements.filter((requirement) => requirement.domains.includes(domain));
}

export function getOutputRequirement(id: string): OutputRequirementData {
  const found = listOutputRequirements().find((requirement) => requirement.id === id);
  if (!found) {
    throw new Error(`Unknown output requirement: ${id}`);
  }
  return OutputRequirement.assert(found);
}

export function listResponsePatterns(query: ResponsePatternQuery = {}): ResponsePatternData[] {
  const index = ResponsePatternIndex.assert(readDataJson("response-patterns.json"));
  if (!query.domain) {
    return index.patterns;
  }
  const domain = DomainId.assert(query.domain);
  return index.patterns.filter((pattern) => pattern.domains.includes(domain));
}

export function getResponsePattern(id: string): ResponsePatternData {
  const found = listResponsePatterns().find((pattern) => pattern.id === id);
  if (!found) {
    throw new Error(`Unknown response pattern: ${id}`);
  }
  return ResponsePattern.assert(found);
}

export function listIntentLookups(query: IntentLookupQuery = {}): IntentLookupData[] {
  const index = IntentLookupIndex.assert(readDataJson("intent-lookups.json"));
  if (!query.domain) {
    return index.intents;
  }
  const domain = DomainId.assert(query.domain);
  return index.intents.filter((intent) => intent.domains.includes(domain));
}

export function getIntentLookup(id: string): IntentLookupData {
  const found = listIntentLookups().find((intent) => intent.id === id);
  if (!found) {
    throw new Error(`Unknown intent lookup: ${id}`);
  }
  return IntentLookup.assert(found);
}

const catalogSearchKinds = new Set<CatalogSearchKind>([
  "skill",
  "reference",
  "fact-surface",
  "authoring-checklist",
  "authoring-recipe",
  "authoring-scenario",
  "authoring-guardrail",
  "authoring-diagnostic",
  "claim-policy",
  "output-requirement",
  "response-pattern",
  "intent-lookup",
  "source-tier",
  "community-dataset",
  "version-support",
]);
const catalogSearchTokenScale = 10;

type CatalogSearchCandidate = {
  kind: CatalogSearchKind;
  id: string;
  title: string;
  domains: DomainIdData[];
  fields: Array<{ field: string; text: string; weight: number }>;
  item: unknown;
};

function parseCatalogSearchKind(kind: string): CatalogSearchKind {
  if (catalogSearchKinds.has(kind as CatalogSearchKind)) {
    return kind as CatalogSearchKind;
  }
  throw new Error(`Unknown catalog search kind: ${kind}`);
}

function candidateDomains(value: { domain?: string; domains?: string[] }): DomainIdData[] {
  if (value.domain) {
    return [DomainId.assert(value.domain)];
  }
  return (value.domains ?? []).map((domain) => DomainId.assert(domain));
}

function addTexts(
  fields: Array<{ field: string; text: string; weight: number }>,
  field: string,
  values: unknown,
  weight: number,
): void {
  if (typeof values === "string") {
    fields.push({ field, text: values, weight });
    return;
  }
  if (Array.isArray(values)) {
    for (const value of values) {
      addTexts(fields, field, value, weight);
    }
  }
}

function collectCatalogSearchCandidates(): CatalogSearchCandidate[] {
  const candidates: CatalogSearchCandidate[] = [];
  for (const skill of listSkills()) {
    candidates.push({
      kind: "skill",
      id: skill.name,
      title: skill.title,
      domains: [skill.domain],
      fields: [
        { field: "name", text: skill.name, weight: 6 },
        { field: "title", text: skill.title, weight: 5 },
        { field: "path", text: skill.path, weight: 2 },
      ],
      item: skill,
    });
  }
  for (const reference of listReferences()) {
    candidates.push({
      kind: "reference",
      id: reference.id,
      title: reference.title,
      domains: [reference.domain],
      fields: [
        { field: "id", text: reference.id, weight: 6 },
        { field: "title", text: reference.title, weight: 5 },
        { field: "path", text: reference.path, weight: 2 },
      ],
      item: reference,
    });
  }
  for (const surface of listFactSurfaces()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "id", text: surface.id, weight: 6 },
      { field: "title", text: surface.title, weight: 5 },
      { field: "dataKind", text: surface.dataKind, weight: 4 },
      { field: "coverage", text: surface.coverage, weight: 2 },
      { field: "provenance", text: surface.provenance, weight: 2 },
    ];
    addTexts(fields, "guarantees", surface.guarantees, 2);
    addTexts(fields, "nonGuarantees", surface.nonGuarantees, 2);
    addTexts(fields, "cli", surface.cli, 3);
    addTexts(fields, "mcp", surface.mcp, 3);
    addTexts(fields, "packageApis", surface.packageApis, 3);
    candidates.push({
      kind: "fact-surface",
      id: surface.id,
      title: surface.title,
      domains: candidateDomains(surface),
      fields,
      item: surface,
    });
  }
  for (const checklist of listAuthoringChecklists()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "domain", text: checklist.domain, weight: 6 },
      { field: "title", text: checklist.title, weight: 5 },
    ];
    for (const step of checklist.steps) {
      addTexts(fields, "steps.id", step.id, 4);
      addTexts(fields, "steps.reason", step.reason, 2);
      addTexts(fields, "steps.evidence", step.evidence, 2);
      addTexts(fields, "steps.failureMode", step.failureMode, 1);
      addTexts(fields, "steps.tools.cli", step.tools.cli, 3);
      addTexts(fields, "steps.tools.mcp", step.tools.mcp, 3);
      addTexts(fields, "steps.tools.packageApis", step.tools.packageApis, 3);
    }
    candidates.push({
      kind: "authoring-checklist",
      id: checklist.domain,
      title: checklist.title,
      domains: [checklist.domain],
      fields,
      item: checklist,
    });
  }
  for (const recipe of listAuthoringRecipes()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "id", text: recipe.id, weight: 6 },
      { field: "title", text: recipe.title, weight: 5 },
    ];
    addTexts(fields, "when", recipe.when, 4);
    addTexts(fields, "finalChecks", recipe.finalChecks, 3);
    addTexts(fields, "failureMode", recipe.failureMode, 1);
    for (const step of recipe.steps) {
      addTexts(fields, "steps.id", step.id, 4);
      addTexts(fields, "steps.action", step.action, 3);
      addTexts(fields, "steps.evidence", step.evidence, 2);
      addTexts(fields, "steps.stopIfMissing", step.stopIfMissing, 2);
      addTexts(fields, "steps.tools.cli", step.tools.cli, 3);
      addTexts(fields, "steps.tools.mcp", step.tools.mcp, 3);
      addTexts(fields, "steps.tools.packageApis", step.tools.packageApis, 3);
    }
    candidates.push({
      kind: "authoring-recipe",
      id: recipe.id,
      title: recipe.title,
      domains: recipe.domains,
      fields,
      item: recipe,
    });
  }
  for (const scenario of listAuthoringScenarios()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "id", text: scenario.id, weight: 6 },
      { field: "title", text: scenario.title, weight: 5 },
      { field: "userPrompt", text: scenario.userPrompt, weight: 4 },
      { field: "failureMode", text: scenario.failureMode, weight: 1 },
    ];
    addTexts(fields, "useWhen", scenario.useWhen, 4);
    addTexts(fields, "successCriteria", scenario.successCriteria, 2);
    addTexts(fields, "mustAvoid", scenario.mustAvoid, 2);
    addTexts(fields, "requiredLookups.recipes", scenario.requiredLookups.recipes, 3);
    addTexts(fields, "requiredLookups.intents", scenario.requiredLookups.intents, 3);
    addTexts(fields, "requiredLookups.diagnostics", scenario.requiredLookups.diagnostics, 3);
    addTexts(fields, "requiredLookups.claimPolicies", scenario.requiredLookups.claimPolicies, 3);
    addTexts(fields, "requiredLookups.factSurfaces", scenario.requiredLookups.factSurfaces, 3);
    addTexts(
      fields,
      "requiredLookups.responsePatterns",
      scenario.requiredLookups.responsePatterns,
      3,
    );
    candidates.push({
      kind: "authoring-scenario",
      id: scenario.id,
      title: scenario.title,
      domains: scenario.domains,
      fields,
      item: scenario,
    });
  }
  for (const guardrail of listAuthoringGuardrails()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "id", text: guardrail.id, weight: 6 },
      { field: "title", text: guardrail.title, weight: 5 },
      { field: "failureMode", text: guardrail.failureMode, weight: 1 },
    ];
    addTexts(fields, "rules", guardrail.rules, 3);
    addTexts(fields, "requiredEvidence", guardrail.requiredEvidence, 2);
    candidates.push({
      kind: "authoring-guardrail",
      id: guardrail.id,
      title: guardrail.title,
      domains: guardrail.domains,
      fields,
      item: guardrail,
    });
  }
  for (const diagnostic of listAuthoringDiagnostics()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "id", text: diagnostic.id, weight: 6 },
      { field: "title", text: diagnostic.title, weight: 5 },
      { field: "severity", text: diagnostic.severity, weight: 4 },
      { field: "failureMode", text: diagnostic.failureMode, weight: 1 },
    ];
    addTexts(fields, "detectWhen", diagnostic.detectWhen, 3);
    addTexts(fields, "requiredChecks", diagnostic.requiredChecks, 3);
    addTexts(fields, "evidence", diagnostic.evidence, 2);
    addTexts(fields, "failIf", diagnostic.failIf, 2);
    addTexts(fields, "safeResponse", diagnostic.safeResponse, 2);
    candidates.push({
      kind: "authoring-diagnostic",
      id: diagnostic.id,
      title: diagnostic.title,
      domains: diagnostic.domains,
      fields,
      item: diagnostic,
    });
  }
  for (const policy of listClaimPolicies()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "id", text: policy.id, weight: 6 },
      { field: "claim", text: policy.claim, weight: 5 },
      { field: "failureMode", text: policy.failureMode, weight: 1 },
    ];
    addTexts(fields, "requiredEvidence", policy.requiredEvidence, 3);
    addTexts(fields, "allowedWording", policy.allowedWording, 2);
    addTexts(fields, "disallowedWording", policy.disallowedWording, 2);
    candidates.push({
      kind: "claim-policy",
      id: policy.id,
      title: policy.claim,
      domains: policy.domains,
      fields,
      item: policy,
    });
  }
  for (const requirement of listOutputRequirements()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "id", text: requirement.id, weight: 6 },
      { field: "title", text: requirement.title, weight: 5 },
      { field: "failureMode", text: requirement.failureMode, weight: 1 },
    ];
    addTexts(fields, "mustInclude", requirement.mustInclude, 3);
    addTexts(fields, "includeWhenRelevant", requirement.includeWhenRelevant, 2);
    addTexts(fields, "mustNotInclude", requirement.mustNotInclude, 2);
    candidates.push({
      kind: "output-requirement",
      id: requirement.id,
      title: requirement.title,
      domains: requirement.domains,
      fields,
      item: requirement,
    });
  }
  for (const pattern of listResponsePatterns()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "id", text: pattern.id, weight: 6 },
      { field: "title", text: pattern.title, weight: 5 },
      { field: "failureMode", text: pattern.failureMode, weight: 1 },
    ];
    addTexts(fields, "useWhen", pattern.useWhen, 4);
    addTexts(fields, "requiredSections", pattern.requiredSections, 3);
    addTexts(fields, "evidenceStatements", pattern.evidenceStatements, 2);
    addTexts(fields, "gapStatements", pattern.gapStatements, 2);
    addTexts(fields, "mustAvoid", pattern.mustAvoid, 2);
    candidates.push({
      kind: "response-pattern",
      id: pattern.id,
      title: pattern.title,
      domains: pattern.domains,
      fields,
      item: pattern,
    });
  }
  for (const intent of listIntentLookups()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "id", text: intent.id, weight: 6 },
      { field: "title", text: intent.title, weight: 5 },
    ];
    addTexts(fields, "when", intent.when, 4);
    for (const lookup of intent.lookups) {
      addTexts(fields, "lookups.purpose", lookup.purpose, 3);
      addTexts(fields, "lookups.evidence", lookup.evidence, 2);
      addTexts(fields, "lookups.failureMode", lookup.failureMode, 1);
      addTexts(fields, "lookups.tools.cli", lookup.tools.cli, 3);
      addTexts(fields, "lookups.tools.mcp", lookup.tools.mcp, 3);
      addTexts(fields, "lookups.tools.packageApis", lookup.tools.packageApis, 3);
    }
    candidates.push({
      kind: "intent-lookup",
      id: intent.id,
      title: intent.title,
      domains: intent.domains,
      fields,
      item: intent,
    });
  }
  for (const tier of listSourceTiers()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "id", text: tier.id, weight: 6 },
      { field: "title", text: tier.title, weight: 5 },
    ];
    addTexts(fields, "useFor", tier.useFor, 3);
    addTexts(fields, "limits", tier.limits, 2);
    addTexts(fields, "examples", tier.examples, 2);
    candidates.push({
      kind: "source-tier",
      id: tier.id,
      title: tier.title,
      domains: [],
      fields,
      item: tier,
    });
  }
  for (const dataset of listCommunityDatasets()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "id", text: dataset.id, weight: 6 },
      { field: "title", text: dataset.title, weight: 5 },
      { field: "url", text: dataset.url, weight: 2 },
    ];
    addTexts(fields, "useFor", dataset.useFor, 3);
    addTexts(fields, "limits", dataset.limits, 2);
    candidates.push({
      kind: "community-dataset",
      id: dataset.id,
      title: dataset.title,
      domains: [],
      fields,
      item: dataset,
    });
  }
  for (const support of listVersionSupport()) {
    const fields: CatalogSearchCandidate["fields"] = [
      { field: "version", text: support.version, weight: 6 },
      { field: "releaseTime", text: support.releaseTime, weight: 2 },
      {
        field: "paper.supported",
        text: support.paper.supported ? "paper supported" : "paper unsupported",
        weight: 3,
      },
    ];
    for (const domain of Object.values(support.domains)) {
      addTexts(fields, "domains.status", domain.status, 3);
      addTexts(fields, "domains.facts", domain.facts, 2);
      addTexts(fields, "domains.unknowns", domain.unknowns, 2);
    }
    candidates.push({
      kind: "version-support",
      id: support.version,
      title: support.version,
      domains: ["datapack", "resourcepack", "paper-plugin"],
      fields,
      item: support,
    });
  }
  return candidates;
}

export function searchCatalog(options: CatalogSearchOptions): CatalogSearchResults {
  const query = options.query.trim();
  if (!query) {
    throw new Error("Catalog search requires a non-empty query");
  }
  const limit = normalizeLimit(options.limit, 10, 200);
  const domain = options.domain ? DomainId.assert(options.domain) : undefined;
  const kind = options.kind ? parseCatalogSearchKind(options.kind) : undefined;
  const tokens = tokenizeScenarioSearch(query);
  const scored = collectCatalogSearchCandidates()
    .filter((candidate) => !kind || candidate.kind === kind)
    .filter(
      (candidate) =>
        !domain || candidate.domains.length === 0 || candidate.domains.includes(domain),
    )
    .map((candidate) => {
      const tokenWeights = new Map<string, number>();
      const matches: CatalogSearchMatch[] = [];
      for (const field of candidate.fields) {
        const haystack = field.text.toLowerCase();
        const matchedTokens = tokens.filter((token) => haystack.includes(token));
        if (matchedTokens.length === 0) {
          continue;
        }
        for (const token of matchedTokens) {
          tokenWeights.set(token, Math.max(tokenWeights.get(token) ?? 0, field.weight));
        }
        matches.push({ field: field.field, text: field.text, matchedTokens });
      }
      const score =
        [...tokenWeights.values()].reduce((total, weight) => total + weight, 0) *
        catalogSearchTokenScale;
      return { candidate, score, matches };
    })
    .filter((result) => result.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.kind.localeCompare(right.candidate.kind) ||
        left.candidate.id.localeCompare(right.candidate.id),
    );

  return {
    query,
    ...(domain ? { domain } : {}),
    ...(kind ? { kind } : {}),
    limit,
    truncated: scored.length > limit,
    results: scored.slice(0, limit).map(({ candidate, score, matches }) => ({
      kind: candidate.kind,
      id: candidate.id,
      title: candidate.title,
      domains: candidate.domains,
      score,
      matches,
      item: candidate.item,
    })),
  };
}

function relevantDownloadableEntries(domain: DomainIdData, version: string): DataManifestEntry[] {
  return getDataManifest().downloadable.filter((entry) => {
    if (entry.version && entry.version !== version) {
      return false;
    }
    if (domain === "datapack") {
      return entry.kind === "datapack-schema-surface";
    }
    if (domain === "paper-plugin") {
      return entry.kind === "paper-api-surface";
    }
    if (domain === "resourcepack") {
      return entry.kind === "resourcepack-model-summary";
    }
    return false;
  });
}

export function getAuthoringPreflight(options: AuthoringPreflightOptions): AuthoringPreflight {
  const domain = DomainId.assert(options.domain);
  const edition = Edition.assert(options.edition ?? "java");
  const requestedVersion = options.version ?? "latest";
  const paper = domain === "paper-plugin" ? getPaperApiReference(requestedVersion) : undefined;
  const resolvedVersion = paper?.requestedVersion ?? resolveVersion(edition, requestedVersion);
  const version = getVersionDetail(edition, resolvedVersion);
  const domainCoverage = version.domains[domain];
  const downloadable = relevantDownloadableEntries(domain, resolvedVersion).map((entry) => ({
    kind: entry.kind,
    ...(entry.version ? { version: entry.version } : {}),
    path: entry.path,
    bundled: hasBundledDataFile(entry.path),
    cached: hasCachedDataFile(entry.path),
    available: hasDataFile(entry.path),
  }));
  const warnings: string[] = [];

  if (domainCoverage.unknowns.length > 0) {
    warnings.push(
      `Domain coverage has unknowns for ${domain} ${resolvedVersion}: ${domainCoverage.unknowns.join(", ")}`,
    );
  }
  if (paper && !paper.supported) {
    warnings.push(
      `Paper is not marked supported for ${paper.requestedVersion}; latest supported Paper version is ${paper.latestSupportedVersion}`,
    );
  }
  for (const entry of downloadable) {
    if (!entry.available) {
      warnings.push(`Download ${entry.kind} ${entry.version ?? entry.path} before relying on it`);
    }
  }

  return {
    schemaVersion: 1,
    domain,
    edition,
    requestedVersion,
    resolvedVersion,
    checklist: getAuthoringChecklist(domain),
    factSurfaces: listFactSurfaces({ domain }),
    version,
    domainCoverage,
    supportMatrix: getSupportMatrix(),
    downloadable,
    ...(paper ? { paper } : {}),
    warnings,
  };
}

function manifestHasDownloadable(kind: string, version: string): boolean {
  return getDataManifest().downloadable.some(
    (entry) => entry.kind === kind && entry.version === version,
  );
}

function unavailableDataFileMessage(options: {
  label: string;
  kind: string;
  edition: string;
  version: string;
  path: string;
}): string {
  const entry = getDataManifest().downloadable.find(
    (candidate) => candidate.kind === options.kind && candidate.path === options.path,
  );
  const base = `No available ${options.label} for ${options.edition} ${options.version}.`;
  if (!entry) {
    return base;
  }
  return [
    base,
    `This data is downloadable.`,
    `In MCP, call fetch_data with {"kind":"${options.kind}","version":"${options.version}"}, then retry this lookup.`,
    `In CLI, run minecraft-skills data fetch --kind ${options.kind} --version ${options.version}.`,
  ].join(" ");
}

export function listVersionSupport(query: VersionSupportQuery = {}): VersionSupportEntry[] {
  const edition = Edition.assert(query.edition ?? "java");
  const domain = query.domain ? DomainId.assert(query.domain) : undefined;
  const paper = getPaperPluginData();

  return listVersions(edition)
    .map((summary) => {
      const detail = getVersionDetail(edition, summary.id);
      const paperBuild = paper.versionBuilds.find(
        (candidate) => candidate.minecraftVersion === summary.id,
      );
      const datapackSchemaPath = `${edition}/datapack-schema-surfaces/${summary.id}.json`;
      const paperApiSurfacePath = `${edition}/paper-api-surfaces/${summary.id}.json`;
      const resourcepackModelsPath = `${edition}/resourcepack-models/${summary.id}.json`;
      return {
        edition,
        version: summary.id,
        type: summary.type,
        releaseTime: summary.releaseTime,
        packFormats: detail.packFormats,
        domains: detail.domains,
        paper: {
          supported: paper.versions.includes(summary.id),
          latestBuild: paperBuild?.latestBuild ?? null,
          buildCount: paperBuild?.buildCount ?? null,
        },
        surfaces: {
          datapackSchemaSurface: {
            bundled: hasBundledDataFile(datapackSchemaPath),
            cached: hasCachedDataFile(datapackSchemaPath),
            downloadable: manifestHasDownloadable("datapack-schema-surface", summary.id),
            available: hasDataFile(datapackSchemaPath),
          },
          paperApiSurface: {
            bundled: hasBundledDataFile(paperApiSurfacePath),
            cached: hasCachedDataFile(paperApiSurfacePath),
            downloadable: manifestHasDownloadable("paper-api-surface", summary.id),
            available: hasDataFile(paperApiSurfacePath),
          },
          resourcepackModels: {
            bundled: hasBundledDataFile(resourcepackModelsPath),
            cached: hasCachedDataFile(resourcepackModelsPath),
            downloadable: manifestHasDownloadable("resourcepack-model-summary", summary.id),
            available: hasDataFile(resourcepackModelsPath),
          },
        },
      };
    })
    .filter((entry) => {
      if (!domain) {
        return true;
      }
      return entry.domains[domain].status !== "seed";
    });
}

function evidenceDataFilePaths(domain: DomainIdData, edition: EditionData, version: string) {
  const common = [
    { kind: "version-detail", path: `${edition}/version-details/${version}.json` },
    { kind: "vanilla-inventory", path: `${edition}/vanilla-inventories/${version}.json` },
  ];
  if (domain === "datapack") {
    return [
      ...common,
      { kind: "server-reports", path: `${edition}/reports/${version}.json` },
      { kind: "command-paths", path: `${edition}/command-paths/${version}.txt` },
      { kind: "registry-entries", path: `${edition}/registry-entries/${version}.tsv` },
      { kind: "vanilla-paths", path: `${edition}/vanilla-paths/${version}.datapack.txt` },
      {
        kind: "datapack-schema-surface",
        path: `${edition}/datapack-schema-surfaces/${version}.json`,
      },
    ];
  }
  if (domain === "resourcepack") {
    return [
      ...common,
      { kind: "vanilla-paths", path: `${edition}/vanilla-paths/${version}.resourcepack.txt` },
      {
        kind: "resourcepack-model-summary",
        path: `${edition}/resourcepack-models/${version}.json`,
      },
    ];
  }
  return [
    { kind: "paper-project", path: `${edition}/paper.json` },
    { kind: "paper-api-index", path: `${edition}/paper-api-indexes/${version}.json` },
    { kind: "paper-api-surface", path: `${edition}/paper-api-surfaces/${version}.json` },
  ];
}

function uniqueLinks(links: EvidenceBundle["links"]): EvidenceBundle["links"] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.id}\0${link.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function getEvidenceBundle(options: EvidenceBundleOptions): EvidenceBundle {
  const preflight = getAuthoringPreflight(options);
  const domain = preflight.domain;
  const edition = preflight.edition;
  const domainData = getDomain(domain);
  const factSurfaces = preflight.factSurfaces.map(
    ({ id, title, dataKind, coverage, provenance, guarantees, nonGuarantees }) => ({
      id,
      title,
      dataKind,
      coverage,
      provenance,
      guarantees,
      nonGuarantees,
    }),
  );
  const dataFiles = evidenceDataFilePaths(domain, edition, preflight.resolvedVersion).map(
    (entry) => ({
      ...entry,
      bundled: hasBundledDataFile(entry.path),
      cached: hasCachedDataFile(entry.path),
      available: hasDataFile(entry.path),
    }),
  );
  const paperLinks = preflight.paper
    ? [
        { id: "paper-dev-docs", kind: "official", url: preflight.paper.docs.paperDev },
        { id: "paper-scheduler-docs", kind: "official", url: preflight.paper.docs.scheduling },
        {
          id: "paper-folia-support-docs",
          kind: "official",
          url: preflight.paper.docs.foliaSupport,
        },
        { id: "folia-overview-docs", kind: "official", url: preflight.paper.docs.foliaOverview },
        ...(preflight.paper.javadocsUrl
          ? [{ id: "paper-javadocs", kind: "official-api", url: preflight.paper.javadocsUrl }]
          : []),
        { id: "spigot-event-list-api", kind: "project-api", url: preflight.paper.eventSearch.url },
      ]
    : [];

  return {
    schemaVersion: 1,
    domain,
    edition,
    requestedVersion: preflight.requestedVersion,
    resolvedVersion: preflight.resolvedVersion,
    sourcePolicy: getSourcePolicy(),
    primarySources: domainData.primarySources,
    versionSources: preflight.version.sources,
    factSurfaces,
    dataFiles,
    links: uniqueLinks([
      ...domainData.primarySources.map((source) => ({
        id: source.id,
        kind: source.kind,
        url: source.url,
      })),
      ...preflight.version.sources.map((source) => ({
        id: source.id,
        kind: source.kind,
        url: source.url,
      })),
      ...paperLinks,
    ]),
    warnings: preflight.warnings,
  };
}

export function getAuthoringContext(options: AuthoringContextOptions): AuthoringContext {
  const preflight = getAuthoringPreflight(options);
  return {
    schemaVersion: 1,
    domain: preflight.domain,
    edition: preflight.edition,
    requestedVersion: preflight.requestedVersion,
    resolvedVersion: preflight.resolvedVersion,
    preflight,
    recipes: listAuthoringRecipes({ domain: preflight.domain }),
    scenarios: listAuthoringScenarios({ domain: preflight.domain }),
    guardrails: listAuthoringGuardrails({ domain: preflight.domain }),
    diagnostics: listAuthoringDiagnostics({ domain: preflight.domain }),
    claimPolicies: listClaimPolicies({ domain: preflight.domain }),
    outputRequirements: listOutputRequirements({ domain: preflight.domain }),
    responsePatterns: listResponsePatterns({ domain: preflight.domain }),
    intentLookups: listIntentLookups({ domain: preflight.domain }),
    evidence: getEvidenceBundle({
      domain: preflight.domain,
      edition: preflight.edition,
      version: preflight.resolvedVersion,
    }),
  };
}

export function getSkill(name: string): SkillData {
  const found = listSkills().find((skill) => skill.name === name);
  if (!found) {
    throw new Error(`Unknown skill: ${name}`);
  }
  return found;
}

export function getSkillPayload(name: string): SkillPayload {
  const skill = getSkill(name);
  return {
    skill,
    skillMarkdown: readDataText(skill.skillFile),
    agentMetadata: readDataText(skill.agentMetadata),
    references: listReferences(skill.domain).map((reference) => ({
      reference,
      markdown: readDataText(reference.path),
    })),
  };
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
    const reference = makePaperApiReference(paper, detail.version);
    const facts = [`paper_supported=true`, `paper_minecraft_version=${detail.version}`];
    if (build) {
      facts.push(
        `paper_latest_build=${build.latestBuild}`,
        `paper_build_count=${build.buildCount}`,
      );
    }
    if (reference.apiDependency) {
      facts.push(`paper_api_dependency=${reference.apiDependency}`);
    }
    if (reference.javadocsUrl) {
      facts.push(`paper_javadocs=${reference.javadocsUrl}`);
    }
    const hasPackageIndex = hasDataFile(`java/paper-api-indexes/${detail.version}.json`);
    if (hasPackageIndex) {
      facts.push(`paper_api_package_index=${detail.version}`);
    }
    const paperApiSurfaceFact = `paper_api_surface=${detail.version}`;
    if (
      hasDataFile(`java/paper-api-surfaces/${detail.version}.json`) &&
      !facts.includes(paperApiSurfaceFact)
    ) {
      facts.push(paperApiSurfaceFact);
    }
    facts.push(
      `paper_folia_support_docs=${reference.docs.foliaSupport}`,
      `paper_scheduler_docs=${reference.docs.scheduling}`,
    );
    if (paper.latest.minecraftVersion === detail.version) {
      facts.push(`paper_global_latest_build=${paper.latest.build}`);
    }
    return VersionDetail.assert({
      ...detail,
      domains: {
        ...detail.domains,
        "paper-plugin": {
          status: "api-reference-linked",
          facts,
          unknowns: hasPackageIndex ? [] : ["server_api_changes"],
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

function appendUnique(values: string[], ...added: string[]): string[] {
  return [...new Set([...values, ...added])];
}

function versionDownload(
  detail: VersionDetailData,
  id: string,
): { url?: string; sha1?: string; size?: number } | null {
  const value = detail.downloads[id];
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  return {
    ...(typeof candidate.url === "string" ? { url: candidate.url } : {}),
    ...(typeof candidate.sha1 === "string" ? { sha1: candidate.sha1 } : {}),
    ...(typeof candidate.size === "number" &&
    Number.isSafeInteger(candidate.size) &&
    candidate.size >= 0
      ? { size: candidate.size }
      : {}),
  };
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
        facts: appendUnique(
          detail.domains.datapack.facts,
          `vanilla_data_inventory=${detail.version}`,
        ),
        unknowns: ["command_tree", "vanilla_reports"],
      },
      resourcepack: {
        status: "inventory-extracted",
        facts: appendUnique(
          detail.domains.resourcepack.facts,
          `vanilla_asset_inventory=${detail.version}`,
        ),
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
  const facts = appendUnique(detail.domains.datapack.facts, `server_reports=${detail.version}`);
  const datapackSchemaSurfaceFact = `datapack_schema_surface=${detail.version}`;
  if (
    hasDataFile(`java/datapack-schema-surfaces/${detail.version}.json`) &&
    !facts.includes(datapackSchemaSurfaceFact)
  ) {
    facts.push(datapackSchemaSurfaceFact);
  }
  return VersionDetail.assert({
    ...detail,
    domains: {
      ...detail.domains,
      datapack: {
        status: "reports-extracted",
        facts,
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
        facts: appendUnique(
          detail.domains.resourcepack.facts,
          `resourcepack_models=${detail.version}`,
        ),
        unknowns: [],
      },
    },
  });
}

const versionDetailCache = new Map<string, VersionDetailData>();

export function getVersionDetail(edition = "java", requested = "latest"): VersionDetailData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  const cacheKey = `${editionId}/${version}`;
  const cached = versionDetailCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const detailPath = `${editionId}/version-details/${version}.json`;
  if (hasDataFile(detailPath)) {
    const detail = withResourcepackModelCoverage(
      withJavaReportsCoverage(
        withVanillaInventoryCoverage(
          withPaperPluginCoverage(VersionDetail.assert(readDataJson(detailPath))),
        ),
      ),
    );
    versionDetailCache.set(cacheKey, detail);
    return detail;
  }
  const summary = getVersionIndex(editionId).versions.find((candidate) => candidate.id === version);
  if (!summary) {
    throw new Error(`Unsupported ${editionId} version: ${version}`);
  }
  const detail = withResourcepackModelCoverage(
    withJavaReportsCoverage(
      withVanillaInventoryCoverage(
        withPaperPluginCoverage(makeManifestOnlyDetail(editionId, summary)),
      ),
    ),
  );
  versionDetailCache.set(cacheKey, detail);
  return detail;
}

export function getMojangVersionMetadata(
  edition = "java",
  requested = "latest",
): MojangVersionMetadata {
  const editionId = Edition.assert(edition);
  const detail = getVersionDetail(editionId, requested);
  const metadataSource = detail.sources.find((source) => source.id === "mojang-version-json");
  const client = versionDownload(detail, "client");
  const server = versionDownload(detail, "server");
  return {
    schemaVersion: 1,
    edition: editionId,
    version: detail.version,
    type: detail.type,
    releaseTime: detail.releaseTime,
    protocolVersion: detail.protocolVersion,
    worldVersion: detail.worldVersion,
    javaVersion: detail.javaVersion,
    packFormats: detail.packFormats,
    official: {
      versionMetadataUrl: metadataSource?.url ?? null,
      clientJarUrl: client?.url ?? null,
      clientJarSha1: client?.sha1 ?? null,
      serverJarUrl: server?.url ?? null,
      serverJarSha1: server?.sha1 ?? null,
      assetIndexUrl: detail.assetIndex?.url ?? null,
      assetIndexSha1: detail.assetIndex?.sha1 ?? null,
    },
    provenance: {
      tier: "official",
      sources: detail.sources,
      note: "Fields are copied from Mojang/Piston version metadata when present; pack formats may include values extracted from official jars for bundled versions.",
    },
  };
}

export function getSourcePolicy(): CatalogData["sourcePolicy"] {
  return getCatalog().sourcePolicy;
}

export function listSourceTiers(): SourceTierData[] {
  return getSourcePolicy().sourceTiers;
}

export function getSourceTier(id: string): SourceTierData {
  const tier = listSourceTiers().find((candidate) => candidate.id === id);
  if (!tier) {
    throw new Error(`Unknown source tier: ${id}`);
  }
  return tier;
}

export function listCommunityDatasets(): CommunityDatasetData[] {
  return getSourcePolicy().recommendedCommunityDatasets;
}

export function getCommunityDataset(id: string): CommunityDatasetData {
  const dataset = listCommunityDatasets().find((candidate) => candidate.id === id);
  if (!dataset) {
    throw new Error(`Unknown community dataset: ${id}`);
  }
  return dataset;
}

export function getSourceReport(options: SourceReportOptions = {}): SourceReport {
  const catalog = getCatalog();
  const sourcePolicy = getSourcePolicy();
  const base = {
    schemaVersion: 1 as const,
    sourcePolicy,
    domains: catalog.domains,
    recommendedCommunityDatasets: sourcePolicy.recommendedCommunityDatasets,
    prohibitedAutomation: sourcePolicy.prohibitedAutomation,
  };
  if (!options.domain) {
    return base;
  }
  const evidence = getEvidenceBundle({
    domain: options.domain,
    ...(options.edition ? { edition: options.edition } : {}),
    ...(options.version ? { version: options.version } : {}),
  });
  return {
    ...base,
    domain: evidence.domain,
    edition: evidence.edition,
    requestedVersion: evidence.requestedVersion,
    resolvedVersion: evidence.resolvedVersion,
    primarySources: evidence.primarySources,
    versionSources: evidence.versionSources,
    factSurfaces: evidence.factSurfaces,
    dataFiles: evidence.dataFiles,
    links: evidence.links,
    warnings: evidence.warnings,
  };
}

function countExisting(paths: string[]): number {
  return paths.filter((path) => hasDataFile(path)).length;
}

export function getCoverageSummary(): CoverageSummary {
  const catalog = getCatalog();
  const versions = listVersions("java");
  const paper = getPaperPluginData();
  const missing: CoverageSummary["java"]["requiredData"]["missing"] = [];
  let extractedPackFormats = 0;
  let datapackWithoutUnknowns = 0;
  let resourcepackWithoutUnknowns = 0;
  let paperWithoutUnknowns = 0;

  for (const version of versions) {
    const detail = getVersionDetail("java", version.id);
    const requiredPaths = [
      `java/version-details/${version.id}.json`,
      `java/reports/${version.id}.json`,
      `java/command-paths/${version.id}.txt`,
      `java/registry-entries/${version.id}.tsv`,
      `java/vanilla-inventories/${version.id}.json`,
      `java/vanilla-paths/${version.id}.datapack.txt`,
      `java/vanilla-paths/${version.id}.resourcepack.txt`,
    ];
    for (const path of requiredPaths) {
      if (!hasDataFile(path)) {
        missing.push({ version: version.id, path });
      }
    }
    if (
      detail.packFormats.status === "extracted" &&
      detail.packFormats.data !== null &&
      detail.packFormats.resource !== null
    ) {
      extractedPackFormats += 1;
    }
    if (detail.domains.datapack.unknowns.length === 0) {
      datapackWithoutUnknowns += 1;
    }
    if (detail.domains.resourcepack.unknowns.length === 0) {
      resourcepackWithoutUnknowns += 1;
    }
    if (detail.domains["paper-plugin"].unknowns.length === 0) {
      paperWithoutUnknowns += 1;
    }
  }

  const paperApiIndexes = paper.versions.filter((version) =>
    hasDataFile(`java/paper-api-indexes/${version}.json`),
  );
  const paperApiSurfaces = paper.versions.filter((version) =>
    hasDataFile(`java/paper-api-surfaces/${version}.json`),
  );

  return {
    schemaVersion: 1,
    generatedFrom: "bundled-data",
    latest: catalog.latest,
    supportPolicy: catalog.supportPolicy,
    domains: {
      total: catalog.domains.length,
      ids: catalog.domains.map((domain) => domain.id),
    },
    skills: {
      total: catalog.skills.length,
      packagedPayloads: catalog.skills.filter(
        (skill) => hasDataFile(skill.skillFile) && hasDataFile(skill.agentMetadata),
      ).length,
    },
    java: {
      releases: {
        total: versions.length,
        latest: versions[0]?.id ?? "",
        oldest: versions.at(-1)?.id ?? "",
      },
      requiredData: {
        complete: missing.length === 0,
        missing,
      },
      packFormats: {
        extracted: extractedPackFormats,
        missing: versions.length - extractedPackFormats,
      },
      datapack: {
        serverReports: countExisting(versions.map((version) => `java/reports/${version.id}.json`)),
        commandPathIndexes: countExisting(
          versions.map((version) => `java/command-paths/${version.id}.txt`),
        ),
        registryEntryIndexes: countExisting(
          versions.map((version) => `java/registry-entries/${version.id}.tsv`),
        ),
        vanillaInventories: countExisting(
          versions.map((version) => `java/vanilla-inventories/${version.id}.json`),
        ),
        vanillaPathIndexes: countExisting(
          versions.map((version) => `java/vanilla-paths/${version.id}.datapack.txt`),
        ),
        observedSchemaSurfaces: countExisting(
          versions.map((version) => `java/datapack-schema-surfaces/${version.id}.json`),
        ),
        versionsWithoutUnknowns: datapackWithoutUnknowns,
      },
      resourcepack: {
        vanillaInventories: countExisting(
          versions.map((version) => `java/vanilla-inventories/${version.id}.json`),
        ),
        vanillaPathIndexes: countExisting(
          versions.map((version) => `java/vanilla-paths/${version.id}.resourcepack.txt`),
        ),
        modelSummaries: countExisting(
          versions.map((version) => `java/resourcepack-models/${version.id}.json`),
        ),
        versionsWithoutUnknowns: resourcepackWithoutUnknowns,
      },
      paperPlugin: {
        supportedVersions: paper.versions.length,
        latestSupportedVersion: paper.latest.minecraftVersion,
        latestBuild: paper.latest.build,
        versionBuilds: paper.versionBuilds.length,
        apiPackageIndexes: paperApiIndexes.length,
        apiSurfaces: paperApiSurfaces.length,
        versionsWithoutUnknowns: paperWithoutUnknowns,
        missingApiPackageIndexes: paper.versions.filter(
          (version) => !paperApiIndexes.includes(version),
        ),
        missingApiSurfaces: paper.versions.filter((version) => !paperApiSurfaces.includes(version)),
      },
    },
  };
}

export function getSupportMatrix(): SupportMatrix {
  const versions = listVersions("java");
  const paper = getPaperPluginData();
  const datapackSchemaSurfaces = versions
    .map((version) => version.id)
    .filter((version) => hasBundledDataFile(`java/datapack-schema-surfaces/${version}.json`));
  const paperApiSurfaces = paper.versions.filter((version) =>
    hasBundledDataFile(`java/paper-api-surfaces/${version}.json`),
  );
  const resourcepackModelSummaries = versions
    .map((version) => version.id)
    .filter((version) => hasBundledDataFile(`java/resourcepack-models/${version}.json`));

  return {
    schemaVersion: 1,
    aliases: {
      latestJava: versions[0]?.id ?? "",
      latestPaper: paper.latest.minecraftVersion,
      latestWithDatapackSchemaSurface: datapackSchemaSurfaces[0] ?? null,
      latestWithPaperApiSurface: paperApiSurfaces.at(-1) ?? null,
      latestWithResourcepackModels: resourcepackModelSummaries[0] ?? null,
    },
    bundled: {
      javaVersions: versions.length,
      paperVersions: paper.versions.length,
      datapackSchemaSurfaces,
      paperApiSurfaces,
      resourcepackModelSummaries,
    },
    downloadable: getDataManifest().downloadable.map((entry) => ({
      kind: entry.kind,
      ...(entry.version ? { version: entry.version } : {}),
      path: entry.path,
    })),
  };
}

export function getPaperPluginData(): PaperPluginDataData {
  return PaperPluginData.assert(readDataJson("java/paper.json"));
}

function makePaperApiReference(
  paper: PaperPluginDataData,
  requested = "latest",
): PaperApiReference {
  const requestedVersion =
    requested === "latest" || requested === "latest-release"
      ? paper.latest.minecraftVersion
      : requested;
  const build = paper.versionBuilds.find(
    (candidate) => candidate.minecraftVersion === requestedVersion,
  );
  const supported = paper.versions.includes(requestedVersion);
  const minecraftVersion = supported ? requestedVersion : paper.latest.minecraftVersion;

  return {
    requestedVersion,
    supported,
    minecraftVersion,
    latestSupportedVersion: paper.latest.minecraftVersion,
    latestBuild: build?.latestBuild ?? null,
    buildCount: build?.buildCount ?? null,
    apiDependency: supported
      ? `io.papermc.paper:paper-api:${minecraftVersion}-R0.1-SNAPSHOT`
      : null,
    javadocsUrl: supported ? `https://jd.papermc.io/paper/${minecraftVersion}/` : null,
    docs: {
      paperDev: "https://docs.papermc.io/paper/dev/",
      pluginConfiguration: "https://docs.papermc.io/paper/dev/plugin-configurations/",
      commands: "https://docs.papermc.io/paper/reference/commands/",
      scheduling: "https://docs.papermc.io/paper/dev/scheduler/",
      foliaSupport: "https://docs.papermc.io/paper/dev/folia-support/",
      foliaOverview: "https://docs.papermc.io/folia/reference/overview/",
    },
    eventSearch: {
      url: paper.eventSearch.baseUrl,
      defaultVersion: supported ? minecraftVersion : paper.eventSearch.defaultVersion,
      paperSources: paper.eventSearch.paperSources,
    },
  };
}

export function getPaperApiReference(requested = "latest"): PaperApiReference {
  return makePaperApiReference(getPaperPluginData(), requested);
}

export function getPaperApiIndex(requested = "latest"): PaperApiIndexData {
  const reference = getPaperApiReference(requested);
  if (!reference.supported) {
    throw new Error(
      `No bundled Paper API index for ${reference.requestedVersion}; latest supported is ${reference.latestSupportedVersion}`,
    );
  }
  const path = `java/paper-api-indexes/${reference.minecraftVersion}.json`;
  if (!hasDataFile(path)) {
    throw new Error(`No bundled Paper API index for ${reference.minecraftVersion}`);
  }
  return PaperApiIndex.assert(readDataJson(path));
}

export function comparePaperApi(fromRequested: string, toRequested: string): PaperApiComparison {
  const from = getPaperApiIndex(fromRequested);
  const to = getPaperApiIndex(toRequested);
  const fromByName = new Map(from.packages.map((entry) => [entry.name, entry]));
  const toByName = new Map(to.packages.map((entry) => [entry.name, entry]));
  const added = to.packages.filter((entry) => !fromByName.has(entry.name));
  const removed = from.packages.filter((entry) => !toByName.has(entry.name));

  return {
    from: from.minecraftVersion,
    to: to.minecraftVersion,
    packageCount: {
      from: from.packageCount,
      to: to.packageCount,
      changed: from.packageCount !== to.packageCount,
    },
    added,
    removed,
  };
}

const paperApiSurfaceCache = new Map<string, PaperApiSurfaceData>();
const paperApiSurfaceCacheLimit = 2;

function readPaperApiSurface(requested = "latest"): PaperApiSurfaceData {
  const reference = getPaperApiReference(requested);
  if (!reference.supported) {
    throw new Error(
      `No bundled Paper API surface for ${reference.requestedVersion}; latest supported is ${reference.latestSupportedVersion}`,
    );
  }
  const cached = paperApiSurfaceCache.get(reference.minecraftVersion);
  if (cached) {
    paperApiSurfaceCache.delete(reference.minecraftVersion);
    paperApiSurfaceCache.set(reference.minecraftVersion, cached);
    return cached;
  }
  const path = `java/paper-api-surfaces/${reference.minecraftVersion}.json`;
  if (!hasDataFile(path)) {
    throw new Error(
      unavailableDataFileMessage({
        label: "Paper API surface",
        kind: "paper-api-surface",
        edition: "java",
        version: reference.minecraftVersion,
        path,
      }),
    );
  }
  const surface = PaperApiSurface.assert(readDataJson(path));
  paperApiSurfaceCache.set(reference.minecraftVersion, surface);
  if (paperApiSurfaceCache.size > paperApiSurfaceCacheLimit) {
    const oldestVersion = paperApiSurfaceCache.keys().next().value;
    if (oldestVersion) paperApiSurfaceCache.delete(oldestVersion);
  }
  return surface;
}

export function getPaperApiSurface(requested = "latest"): PaperApiSurfaceData {
  return structuredClone(readPaperApiSurface(requested));
}

export function searchPaperTypes(options: PaperTypeSearchOptions = {}): PaperTypeSearchResult {
  const surface = readPaperApiSurface(options.version ?? "latest");
  const limit = normalizeLimit(options.limit, 50, 500);
  const packageName = options.packageName?.trim();
  const contains = options.contains?.trim().toLowerCase();
  const matched = surface.types.filter((entry) => {
    if (packageName && entry.packageName !== packageName) {
      return false;
    }
    if (
      contains &&
      !entry.name.toLowerCase().includes(contains) &&
      !entry.qualifiedName.toLowerCase().includes(contains)
    ) {
      return false;
    }
    return true;
  });

  return {
    version: surface.minecraftVersion,
    totalTypes: surface.types.length,
    matchedTypes: matched.length,
    truncated: matched.length > limit,
    types: matched.slice(0, limit).map((entry) => ({ ...entry })),
  };
}

export function searchPaperMembers(
  options: PaperMemberSearchOptions = {},
): PaperMemberSearchResult {
  const surface = readPaperApiSurface(options.version ?? "latest");
  const limit = normalizeLimit(options.limit, 50, 500);
  const typeName = options.type?.trim();
  const packageName = options.packageName?.trim();
  const contains = options.contains?.trim().toLowerCase();
  const matched = surface.members.filter((entry) => {
    if (typeName && entry.qualifiedTypeName !== typeName && entry.typeName !== typeName) {
      return false;
    }
    if (packageName && entry.packageName !== packageName) {
      return false;
    }
    if (options.kind && entry.kind !== options.kind) {
      return false;
    }
    if (
      contains &&
      !entry.name.toLowerCase().includes(contains) &&
      !entry.label.toLowerCase().includes(contains) &&
      !entry.qualifiedTypeName.toLowerCase().includes(contains)
    ) {
      return false;
    }
    return true;
  });

  return {
    version: surface.minecraftVersion,
    totalMembers: surface.members.length,
    matchedMembers: matched.length,
    truncated: matched.length > limit,
    members: matched.slice(0, limit).map((entry) => ({ ...entry })),
  };
}

function memberKey(entry: PaperApiMemberData): string {
  return `${entry.qualifiedTypeName}#${entry.label}`;
}

export function comparePaperApiSurface(
  fromRequested: string,
  toRequested: string,
): PaperApiSurfaceComparison {
  const from = readPaperApiSurface(fromRequested);
  const to = readPaperApiSurface(toRequested);
  const fromTypes = new Map(from.types.map((entry) => [entry.qualifiedName, entry]));
  const toTypes = new Map(to.types.map((entry) => [entry.qualifiedName, entry]));
  const fromMembers = new Map(from.members.map((entry) => [memberKey(entry), entry]));
  const toMembers = new Map(to.members.map((entry) => [memberKey(entry), entry]));
  const addedTypes = to.types
    .filter((entry) => !fromTypes.has(entry.qualifiedName))
    .map((entry) => ({ ...entry }));
  const removedTypes = from.types
    .filter((entry) => !toTypes.has(entry.qualifiedName))
    .map((entry) => ({ ...entry }));
  const addedMembers = to.members
    .filter((entry) => !fromMembers.has(memberKey(entry)))
    .map((entry) => ({ ...entry }));
  const removedMembers = from.members
    .filter((entry) => !toMembers.has(memberKey(entry)))
    .map((entry) => ({ ...entry }));

  return {
    from: from.minecraftVersion,
    to: to.minecraftVersion,
    typeCount: {
      from: from.typeCount,
      to: to.typeCount,
      changed: from.typeCount !== to.typeCount,
    },
    memberCount: {
      from: from.memberCount,
      to: to.memberCount,
      changed: from.memberCount !== to.memberCount,
    },
    addedTypes,
    removedTypes,
    addedMembers,
    removedMembers,
    changes: [
      ...addedTypes.map((type) => ({ change: "added_type" as const, type })),
      ...removedTypes.map((type) => ({ change: "removed_type" as const, type })),
      ...addedMembers.map((member) => ({ change: "added_member" as const, member })),
      ...removedMembers.map((member) => ({ change: "removed_member" as const, member })),
    ],
  };
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

function packFormatForDomain(
  detail: VersionDetailData,
  domain: PackFormatDomain,
): { format: number | null; minor: number | null } {
  return domain === "datapack"
    ? { format: detail.packFormats.data, minor: detail.packFormats.dataMinor }
    : { format: detail.packFormats.resource, minor: detail.packFormats.resourceMinor };
}

function assertPackFormatDomain(value: string): PackFormatDomain {
  if (value === "datapack" || value === "resourcepack") {
    return value;
  }
  throw new Error("pack format domain must be datapack or resourcepack");
}

function assertNonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

export function getPackFormat(
  edition = "java",
  requested = "latest",
  domain: PackFormatDomain = "datapack",
): PackFormatLookup {
  const editionId = Edition.assert(edition);
  const domainId = assertPackFormatDomain(domain);
  const version = resolveVersion(editionId, requested);
  const detail = getVersionDetail(editionId, version);
  const format = packFormatForDomain(detail, domainId);
  return {
    schemaVersion: 1,
    edition: editionId,
    version: detail.version,
    releaseTime: detail.releaseTime,
    domain: domainId,
    format: format.format,
    minor: format.minor,
    status: detail.packFormats.status,
  };
}

export function findVersionsByPackFormat(options: {
  edition?: string;
  domain: PackFormatDomain;
  format: number;
  minor?: number | null;
}): PackFormatVersionSearch {
  const editionId = Edition.assert(options.edition ?? "java");
  const domain = assertPackFormatDomain(options.domain);
  const targetFormat = assertNonNegativeInteger(options.format, "format");
  const targetMinor =
    options.minor === undefined || options.minor === null
      ? null
      : assertNonNegativeInteger(options.minor, "minor");
  const matches = listVersions(editionId).flatMap((version): PackFormatVersionMatch[] => {
    const detail = getVersionDetail(editionId, version.id);
    const format = packFormatForDomain(detail, domain);
    if (format.format !== targetFormat) {
      return [];
    }
    if (targetMinor !== null && format.minor !== targetMinor) {
      return [];
    }
    return [
      {
        version: detail.version,
        releaseTime: detail.releaseTime,
        domain,
        format: format.format,
        minor: format.minor,
        exactMinor: targetMinor !== null,
        paperPluginStatus: detail.domains["paper-plugin"].status,
      },
    ];
  });
  return {
    schemaVersion: 1,
    edition: editionId,
    domain,
    format: targetFormat,
    minor: targetMinor,
    matches,
  };
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

const datapackSchemaSurfaceCache = new Map<string, ObservedDatapackSchemaSurfaceData>();

export function getDatapackSchemaSurface(
  edition = "java",
  requested = "latest",
): ObservedDatapackSchemaSurfaceData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  const cacheKey = `${editionId}/${version}`;
  const cached = datapackSchemaSurfaceCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const surfacePath = `${editionId}/datapack-schema-surfaces/${version}.json`;
  if (!hasDataFile(surfacePath)) {
    throw new Error(
      unavailableDataFileMessage({
        label: "observed datapack schema surface",
        kind: "datapack-schema-surface",
        edition: editionId,
        version,
        path: surfacePath,
      }),
    );
  }
  const surface = ObservedDatapackSchemaSurface.assert(readDataJson(surfacePath));
  datapackSchemaSurfaceCache.set(cacheKey, surface);
  return surface;
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

function flattenDatapackFields(
  surface: ObservedDatapackSchemaSurfaceData,
): Array<
  ObservedDatapackSchemaSurfaceData["kinds"][number]["fieldPaths"][number] & { kind: string }
> {
  return surface.kinds.flatMap((kind) =>
    kind.fieldPaths.map((field) => ({
      kind: kind.kind,
      ...field,
    })),
  );
}

export function searchDatapackSchema(
  options: DatapackSchemaSearchOptions = {},
): DatapackSchemaSearchResult {
  const editionId = Edition.assert(options.edition ?? "java");
  const surface = getDatapackSchemaSurface(editionId, options.version ?? "latest");
  const limit = normalizeLimit(options.limit, 50, 500);
  const kind = options.kind?.trim();
  const path = options.path?.trim();
  const contains = options.contains?.trim().toLowerCase();
  const fields = flattenDatapackFields(surface);
  const matched = fields.filter((field) => {
    if (kind && field.kind !== kind) {
      return false;
    }
    if (path && field.path !== path) {
      return false;
    }
    if (
      contains &&
      !field.kind.toLowerCase().includes(contains) &&
      !field.path.toLowerCase().includes(contains)
    ) {
      return false;
    }
    return true;
  });

  return {
    edition: editionId,
    version: surface.version,
    totalFields: fields.length,
    matchedFields: matched.length,
    truncated: matched.length > limit,
    fields: matched.slice(0, limit),
  };
}

function fieldKey(entry: { kind: string; path: string }): string {
  return `${entry.kind}\t${entry.path}`;
}

export function compareDatapackSchema(
  options: DatapackSchemaComparisonOptions,
): DatapackSchemaComparisonResult {
  const editionId = Edition.assert(options.edition ?? "java");
  const from = getDatapackSchemaSurface(editionId, options.from);
  const to = getDatapackSchemaSurface(editionId, options.to);
  const kind = options.kind?.trim();
  const contains = options.contains?.trim().toLowerCase();
  const filter = (field: { kind: string; path: string }) => {
    if (kind && field.kind !== kind) {
      return false;
    }
    if (
      contains &&
      !field.kind.toLowerCase().includes(contains) &&
      !field.path.toLowerCase().includes(contains)
    ) {
      return false;
    }
    return true;
  };
  const fromFields = flattenDatapackFields(from)
    .filter(filter)
    .map((field) => ({
      kind: field.kind,
      path: field.path,
    }));
  const toFields = flattenDatapackFields(to)
    .filter(filter)
    .map((field) => ({
      kind: field.kind,
      path: field.path,
    }));
  const limit = normalizeLimit(options.limit, 50, 500);
  const fromSet = new Set(fromFields.map(fieldKey));
  const toSet = new Set(toFields.map(fieldKey));
  const added = toFields.filter((entry) => !fromSet.has(fieldKey(entry)));
  const removed = fromFields.filter((entry) => !toSet.has(fieldKey(entry)));

  return {
    edition: editionId,
    from: from.version,
    to: to.version,
    fromTotalFields: fromFields.length,
    toTotalFields: toFields.length,
    addedTotal: added.length,
    removedTotal: removed.length,
    truncated: added.length > limit || removed.length > limit,
    added: added.slice(0, limit),
    removed: removed.slice(0, limit),
    changes: [
      ...added.map((field) => ({ change: "field_path_added" as const, field })),
      ...removed.map((field) => ({ change: "field_path_removed" as const, field })),
    ].slice(0, limit),
  };
}

const resourcepackModelSummaryCache = new Map<string, ResourcepackModelSummaryData>();

export function getResourcepackModelSummary(
  edition = "java",
  requested = "latest",
): ResourcepackModelSummaryData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  const cacheKey = `${editionId}/${version}`;
  const cached = resourcepackModelSummaryCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const modelsPath = `${editionId}/resourcepack-models/${version}.json`;
  if (!hasDataFile(modelsPath)) {
    throw new Error(
      unavailableDataFileMessage({
        label: "resourcepack model summary",
        kind: "resourcepack-model-summary",
        edition: editionId,
        version,
        path: modelsPath,
      }),
    );
  }
  const summary = ResourcepackModelSummary.assert(readDataJson(modelsPath));
  resourcepackModelSummaryCache.set(cacheKey, summary);
  return summary;
}

function pathExtension(path: string): string | null {
  const file = path.split("/").at(-1) ?? "";
  const dot = file.lastIndexOf(".");
  return dot === -1 ? null : file.slice(dot + 1).toLowerCase();
}

function normalizePackPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "");
}

function normalizeDatapackClassificationPath(path: string): string {
  const normalized = normalizePackPath(path);
  const parts = normalized.split("/");
  if (parts[0] === "data" && parts[2] === "datapacks") {
    const nestedDataIndex = parts.findIndex((part, index) => index > 2 && part === "data");
    if (nestedDataIndex !== -1) {
      return parts.slice(nestedDataIndex).join("/");
    }
  }
  return normalized;
}

function isEmbeddedDatapackPath(path: string): boolean {
  const parts = normalizePackPath(path).split("/");
  return parts[0] === "data" && parts[2] === "datapacks";
}

function classifyDatapackPath(path: string): PackFileClassification | undefined {
  const normalized = normalizeDatapackClassificationPath(path);
  if (normalized === "pack.mcmeta" || normalizePackPath(path).endsWith("/pack.mcmeta")) {
    return {
      path,
      domain: "datapack",
      kind: "pack-metadata",
      namespace: null,
      extension: "mcmeta",
      json: true,
      schemaAvailable: true,
      schemaKind: "pack-metadata",
      notes: [
        "pack.mcmeta is shared by datapacks and resourcepacks; pass a domain when ambiguous.",
      ],
    };
  }

  const parts = normalized.split("/");
  if (normalized === "data/.mcassetsroot") {
    return {
      path,
      domain: "datapack",
      kind: "asset-root-marker",
      namespace: null,
      extension: "mcassetsroot",
      json: false,
      schemaAvailable: true,
      schemaKind: "asset-root-marker",
      notes: ["Marker file extracted from official Minecraft data assets."],
    };
  }
  if (parts[0] !== "data" || !parts[1] || !parts[2]) {
    return undefined;
  }

  const extension = pathExtension(normalized);
  const json = extension === "json";
  let kind = parts[2];
  if (parts[2] === "tags") {
    kind = parts[3] ? `tag/${parts[3]}` : "tag";
  } else if (parts[2] === "worldgen") {
    kind = parts[3] ? `worldgen/${parts[3]}` : "worldgen";
  } else if (parts[2] === "functions" || parts[2] === "function") {
    kind = "function";
  } else if (parts[2] === "structures" || parts[2] === "structure") {
    kind = "structure";
  }

  const schemaAvailable =
    json ||
    kind === "function" ||
    kind === "structure" ||
    extension === "mcfunction" ||
    extension === "nbt";
  return {
    path,
    domain: "datapack",
    kind,
    namespace: parts[1],
    extension,
    json,
    schemaAvailable,
    schemaKind: schemaAvailable ? kind : null,
    notes: schemaAvailable
      ? ["Schema data is an observed vanilla JSON shape, not a normative validation schema."]
      : [],
  };
}

function classifyResourcepackPath(path: string): PackFileClassification | undefined {
  const normalized = normalizePackPath(path);
  if (normalized === "pack.mcmeta") {
    return {
      path,
      domain: "resourcepack",
      kind: "pack-metadata",
      namespace: null,
      extension: "mcmeta",
      json: true,
      schemaAvailable: true,
      schemaKind: "pack-metadata",
      notes: [
        "pack.mcmeta is shared by datapacks and resourcepacks; pass a domain when ambiguous.",
      ],
    };
  }

  const parts = normalized.split("/");
  if (normalized === "assets/.mcassetsroot") {
    return {
      path,
      domain: "resourcepack",
      kind: "asset-root-marker",
      namespace: null,
      extension: "mcassetsroot",
      json: false,
      schemaAvailable: true,
      schemaKind: "asset-root-marker",
      notes: ["Marker file extracted from official Minecraft client assets."],
    };
  }
  if (parts[0] !== "assets" || !parts[1] || !parts[2]) {
    return undefined;
  }

  const extension = pathExtension(normalized);
  const json = extension === "json";
  let kind = parts[2];
  let schemaKind: string | null = null;
  if (parts[2] === "models") {
    kind = "model";
    schemaKind = "model";
  } else if (parts[2] === "items") {
    kind = "item-definition";
    schemaKind = "item-definition";
  } else if (parts[2] === "blockstates") {
    kind = "blockstate";
    schemaKind = "blockstate";
  } else if (parts[2] === "lang") {
    kind = "language";
    schemaKind = "language";
  } else if (parts[2] === "textures") {
    kind = `texture/${parts[3] ?? "unknown"}`;
    schemaKind = "texture";
  } else if (parts[2] === "sounds.json") {
    kind = "sounds";
    schemaKind = "sounds";
  } else if (parts[2] === "atlases") {
    kind = "atlas";
    schemaKind = "atlas";
  } else if (parts[2] === "font" || parts[2] === "fonts") {
    kind = "font";
    schemaKind = "font";
  } else if (parts[2] === "particles") {
    kind = "particle";
    schemaKind = "particle";
  } else if (parts[2] === "shaders") {
    kind = `shader/${parts[3] ?? "unknown"}`;
    schemaKind = "shader";
  } else if (parts[2] === "post_effect") {
    kind = "post-effect";
    schemaKind = "post-effect";
  } else if (parts[2] === "equipment") {
    kind = "equipment";
    schemaKind = "equipment";
  } else if (parts[2] === "sounds") {
    kind = "sound-asset";
    schemaKind = "sound-asset";
  } else if (parts[2] === "texts") {
    kind = "text-asset";
    schemaKind = "text-asset";
  }

  const schemaAvailable = Boolean(schemaKind) || json;
  return {
    path,
    domain: "resourcepack",
    kind,
    namespace: parts[1],
    extension,
    json,
    schemaAvailable,
    schemaKind: schemaKind ?? (json ? kind : null),
    notes:
      json && schemaKind
        ? [
            "Schema data is an observed vanilla model/item shape, not a normative validation schema.",
          ]
        : [],
  };
}

function classifyPackPath(
  path: string,
  domain?: "datapack" | "resourcepack",
): PackFileClassification {
  const datapack = domain !== "resourcepack" ? classifyDatapackPath(path) : undefined;
  const resourcepack = domain !== "datapack" ? classifyResourcepackPath(path) : undefined;
  const classified = domain === "resourcepack" ? resourcepack : (datapack ?? resourcepack);
  if (classified) {
    return classified;
  }
  return {
    path,
    domain: "unknown",
    kind: "unknown",
    namespace: null,
    extension: pathExtension(path),
    json: pathExtension(path) === "json",
    schemaAvailable: false,
    schemaKind: null,
    notes: ["Path does not match a known Java datapack or resourcepack file location."],
  };
}

export function classifyPackFiles(
  options: PackFileClassificationOptions,
): PackFileClassificationResult {
  const domain =
    options.domain === "datapack" || options.domain === "resourcepack" ? options.domain : undefined;
  const files = options.paths
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => classifyPackPath(path, domain));
  const kinds = new Map<string, PackFileClassificationResult["kinds"][number]>();
  for (const file of files) {
    const key = `${file.domain}\t${file.kind}\t${file.schemaAvailable}`;
    const current = kinds.get(key);
    if (current) {
      current.count += 1;
    } else {
      kinds.set(key, {
        domain: file.domain,
        kind: file.kind,
        count: 1,
        schemaAvailable: file.schemaAvailable,
      });
    }
  }

  return {
    schemaVersion: 1,
    ...(domain ? { requestedDomain: domain } : {}),
    totalFiles: files.length,
    classifiedFiles: files.filter((file) => file.domain !== "unknown").length,
    schemaAvailableFiles: files.filter((file) => file.schemaAvailable).length,
    kinds: [...kinds.values()].sort(
      (left, right) =>
        left.domain.localeCompare(right.domain) ||
        left.kind.localeCompare(right.kind) ||
        Number(right.schemaAvailable) - Number(left.schemaAvailable),
    ),
    files,
  };
}

function jsonSchemaTypes(kinds: string[]): string[] {
  return kinds
    .map((kind) => (kind === "integer" ? "number" : kind))
    .filter((kind, index, all) => all.indexOf(kind) === index)
    .filter((kind) => ["array", "boolean", "null", "number", "object", "string"].includes(kind));
}

function observedFieldsJsonSchema(options: {
  title: string;
  description: string;
  fields: ObservedJsonSchemaField[];
  coverage: string;
}): Record<string, unknown> {
  const root = options.fields.find((field) => field.path === "$");
  const type = root ? jsonSchemaTypes(root.valueKinds) : ["object"];
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: options.title,
    description: options.description,
    type: type.length === 1 ? type[0] : type,
    additionalProperties: true,
    "x-minecraft-skills": {
      normative: false,
      coverage: options.coverage,
      fieldCount: options.fields.length,
      observedFields: options.fields,
      note: "Generated from observed vanilla files only. This is not a complete normative Minecraft schema.",
    },
  };
}

function datapackObservedFields(
  kind: ObservedDatapackSchemaSurfaceData["kinds"][number],
): ObservedJsonSchemaField[] {
  return kind.fieldPaths.map((field) => ({
    path: field.path,
    valueKinds: field.valueKinds.map((valueKind) => valueKind.kind),
    count: field.count,
    samples: field.samples,
  }));
}

function resourcepackObservedFields(
  fields: ResourcepackModelSummaryData["modelJson"]["fieldPaths"],
): ObservedJsonSchemaField[] {
  return fields.map((field) => {
    const separator = field.value.lastIndexOf(":");
    const path = separator === -1 ? field.value : field.value.slice(0, separator);
    const valueKind = separator === -1 ? "unknown" : field.value.slice(separator + 1);
    return {
      path: path || "$",
      valueKinds: valueKind === "unknown" ? [] : [valueKind],
      count: field.count,
      samples: field.samples,
    };
  });
}

function objectSchema(
  properties: Record<string, unknown> = {},
  options: { additionalProperties?: boolean } = {},
): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: options.additionalProperties ?? true,
    properties,
  };
}

function arrayOf(itemSchema: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "array",
    items: itemSchema,
  };
}

function stringOrStringArraySchema(): Record<string, unknown> {
  return {
    oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
  };
}

function packFormatRangeSchema(packFormat: number | null): Record<string, unknown> {
  return {
    oneOf: [
      packFormat === null ? { type: "integer" } : { const: packFormat },
      {
        type: "object",
        additionalProperties: false,
        required: ["min_inclusive", "max_inclusive"],
        properties: {
          min_inclusive: { type: "integer" },
          max_inclusive: { type: "integer" },
        },
      },
    ],
  };
}

function packFormatValueSchema(packFormat: number | null): Record<string, unknown> {
  return {
    oneOf: [
      packFormat === null ? { type: "integer" } : { const: packFormat },
      {
        type: "array",
        prefixItems: [
          packFormat === null ? { type: "integer" } : { const: packFormat },
          { type: "integer" },
        ],
        minItems: 2,
        maxItems: 2,
      },
      {
        type: "object",
        additionalProperties: true,
        properties: {
          major: packFormat === null ? { type: "integer" } : { const: packFormat },
          minor: { type: "integer" },
        },
      },
    ],
  };
}

function supportsPackMetadataRanges(detail: VersionDetailData): boolean {
  const firstSupported = getVersionDetail("java", "1.20.2");
  return Date.parse(detail.releaseTime) >= Date.parse(firstSupported.releaseTime);
}

function supportsMinorPackMetadata(detail: VersionDetailData, domain: "datapack" | "resourcepack") {
  return domain === "datapack"
    ? detail.packFormats.dataMinor !== null
    : detail.packFormats.resourceMinor !== null;
}

function packMetadataFormatMode(
  detail: VersionDetailData,
  domain: "datapack" | "resourcepack",
): "legacy" | "range" | "minor" {
  if (supportsMinorPackMetadata(detail, domain)) {
    return "minor";
  }
  if (supportsPackMetadataRanges(detail)) {
    return "range";
  }
  return "legacy";
}

function packMetadataSupportedFormatsSchema(mode: "range" | "minor"): Record<string, unknown> {
  if (mode === "range") {
    return packFormatRangeSchema(null);
  }
  return {
    oneOf: [
      packFormatRangeSchema(null),
      {
        type: "object",
        additionalProperties: true,
        properties: {
          min_format: packFormatValueSchema(null),
          max_format: packFormatValueSchema(null),
          formats: packFormatRangeSchema(null),
        },
        anyOf: [
          { required: ["min_format"] },
          { required: ["max_format"] },
          { required: ["formats"] },
        ],
      },
    ],
  };
}

function packMetadataJsonSchema(options: {
  domain: "datapack" | "resourcepack";
  detail: VersionDetailData;
  packFormat: number | null;
}) {
  const { domain, detail, packFormat } = options;
  const mode = packMetadataFormatMode(detail, domain);
  const packProperties: Record<string, unknown> = {
    pack_format: packFormat === null ? { type: "integer" } : { const: packFormat },
    description: {},
  };
  const packSchema: Record<string, unknown> = {
    type: "object",
    required: ["pack_format", "description"],
    additionalProperties: true,
    properties: packProperties,
  };
  if (mode === "minor") {
    packSchema.required = ["description"];
    packSchema.anyOf = [
      { required: ["pack_format"] },
      { required: ["supported_formats"] },
      { required: ["min_format", "max_format"] },
    ];
    packProperties.min_format = packFormatValueSchema(packFormat);
    packProperties.max_format = packFormatValueSchema(packFormat);
    packProperties.supported_formats = packMetadataSupportedFormatsSchema(mode);
  } else if (mode === "range") {
    packProperties.supported_formats = packMetadataSupportedFormatsSchema(mode);
  } else {
    packSchema.not = { required: ["supported_formats"] };
  }

  const rootProperties = {
    pack: packSchema,
    ...(mode === "range" || mode === "minor"
      ? {
          overlays: {
            type: "object",
            additionalProperties: true,
            properties: {
              entries: {
                type: "array",
                items: {
                  type: "object",
                  required: ["directory", "formats"],
                  additionalProperties: true,
                  properties: {
                    directory: { type: "string" },
                    formats:
                      mode === "minor"
                        ? packMetadataSupportedFormatsSchema(mode)
                        : packFormatRangeSchema(null),
                  },
                },
              },
            },
          },
        }
      : {}),
  };
  const schema = objectSchema(rootProperties);
  if (mode === "legacy") {
    schema.not = { required: ["overlays"] };
  }
  schema["x-minecraft-skills"] = {
    packMetadataFormat: mode,
    evidence:
      mode === "legacy"
        ? "Mojang client jar pack.mcmeta/version.json pack format extraction; no OverlayMetadataSection in official mappings before 1.20.2."
        : mode === "range"
          ? "Mojang official client mappings expose OverlayMetadataSection and PackMetadataSection#getDeclaredPackVersions from 1.20.2."
          : "Mojang official client mappings expose PackFormat plus min_format/max_format/supported_formats codec fields from 1.21.9.",
  };
  return schema;
}

function packMetadataNotes(detail: VersionDetailData): string[] {
  const dataMode = packMetadataFormatMode(detail, "datapack");
  const resourceMode = packMetadataFormatMode(detail, "resourcepack");
  if (dataMode === "minor" || resourceMode === "minor") {
    return [
      "pack.mcmeta uses target-version pack format data and permits the minor-aware min_format/max_format metadata shape for versions whose Mojang metadata includes pack format minors.",
    ];
  }
  if (dataMode === "range" || resourceMode === "range") {
    return [
      "pack.mcmeta uses the target version pack_format and permits supported_formats/overlays range metadata for versions with pack metadata range support.",
    ];
  }
  return [
    "pack.mcmeta uses the target version pack_format and rejects supported_formats/overlays because the target version predates pack metadata range support.",
  ];
}

function staticPackFileJsonSchema(options: {
  file: PackFileClassification;
  version: string;
  detail: VersionDetailData;
  packFormat: number | null;
}): Record<string, unknown> | null {
  const { file } = options;
  if (file.schemaKind === "asset-root-marker") {
    return {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "string",
      "x-minecraft-skills": {
        format: "Minecraft asset root marker file.",
        note: "Marker file extracted from official Minecraft jar assets; content is not semantically validated.",
      },
    };
  }
  if (
    file.schemaKind === "pack-metadata" &&
    (file.domain === "datapack" || file.domain === "resourcepack")
  ) {
    return packMetadataJsonSchema({
      domain: file.domain,
      detail: options.detail,
      packFormat: options.packFormat,
    });
  }
  if (file.domain === "datapack") {
    if (file.kind.startsWith("tag/") || file.kind === "tag") {
      return objectSchema({
        replace: { type: "boolean" },
        values: {
          type: "array",
          items: {
            oneOf: [
              { type: "string" },
              {
                type: "object",
                required: ["id"],
                additionalProperties: true,
                properties: {
                  id: { type: "string" },
                  required: { type: "boolean" },
                },
              },
            ],
          },
        },
      });
    }
    if (file.kind === "function" || file.extension === "mcfunction") {
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "string",
        contentMediaType: "text/x-minecraft-function",
        "x-minecraft-skills": {
          lineFormat:
            "UTF-8 text. Each non-empty, non-comment line is a Minecraft command without a leading slash.",
          commandLookup:
            "Use search_commands or compare_commands for target-version command syntax.",
        },
      };
    }
    if (file.kind === "structure" || file.extension === "nbt") {
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "string",
        contentEncoding: "base64",
        contentMediaType: "application/octet-stream",
        "x-minecraft-skills": {
          format: "Minecraft binary NBT structure file.",
          note: "This identifies the file format only; minecraft-skills does not validate NBT payload structure.",
        },
      };
    }
    if (file.json) {
      return objectSchema();
    }
  }

  if (file.domain === "resourcepack") {
    if (file.schemaKind === "blockstate") {
      return objectSchema({
        variants: {
          type: "object",
          additionalProperties: {
            oneOf: [
              { type: "object", additionalProperties: true },
              { type: "array", items: { type: "object", additionalProperties: true } },
            ],
          },
        },
        multipart: arrayOf(objectSchema()),
      });
    }
    if (file.schemaKind === "sounds") {
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: true,
          properties: {
            replace: { type: "boolean" },
            subtitle: { type: "string" },
            sounds: arrayOf({
              oneOf: [
                { type: "string" },
                {
                  type: "object",
                  required: ["name"],
                  additionalProperties: true,
                  properties: {
                    name: { type: "string" },
                    type: { type: "string", enum: ["file", "event"] },
                    volume: { type: "number", exclusiveMinimum: 0 },
                    pitch: { type: "number", exclusiveMinimum: 0 },
                    weight: { type: "integer", minimum: 1 },
                    stream: { type: "boolean" },
                    attenuation_distance: { type: "integer" },
                    preload: { type: "boolean" },
                  },
                },
              ],
            }),
          },
        },
      };
    }
    if (file.schemaKind === "atlas") {
      return objectSchema({
        sources: arrayOf(objectSchema()),
      });
    }
    if (file.schemaKind === "font") {
      if (!file.json) {
        return {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "string",
          contentMediaType: "application/octet-stream",
          "x-minecraft-skills": {
            format: "Resource pack binary font asset.",
            note: "This identifies the binary font asset file format only; minecraft-skills does not validate glyph data.",
          },
        };
      }
      return objectSchema({
        providers: arrayOf(objectSchema()),
      });
    }
    if (file.schemaKind === "language") {
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: { type: "string" },
      };
    }
    if (file.schemaKind === "particle") {
      return objectSchema({
        textures: stringOrStringArraySchema(),
      });
    }
    if (file.schemaKind === "shader" && !file.json) {
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "string",
        contentMediaType: "text/x-glsl",
        "x-minecraft-skills": {
          format: "Resource pack shader source asset.",
          note: "This identifies the shader source file format only; minecraft-skills does not validate GLSL syntax.",
        },
      };
    }
    if (file.schemaKind === "shader" || file.schemaKind === "post-effect") {
      return objectSchema();
    }
    if (file.schemaKind === "equipment") {
      return objectSchema();
    }
    if (file.schemaKind === "texture") {
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "string",
        contentEncoding: "base64",
        contentMediaType: file.extension === "png" ? "image/png" : "application/octet-stream",
        "x-minecraft-skills": {
          format: "Resource pack texture asset.",
          note: "This identifies the asset file format only; minecraft-skills does not validate image dimensions or animation metadata.",
        },
      };
    }
    if (file.schemaKind === "sound-asset") {
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "string",
        contentEncoding: "base64",
        contentMediaType: file.extension === "ogg" ? "audio/ogg" : "application/octet-stream",
        "x-minecraft-skills": {
          format: "Resource pack sound asset.",
          note: "Project validation checks the bounded 58-byte Ogg/Vorbis identification page; it does not fully decode audio packets.",
        },
      };
    }
    if (file.schemaKind === "text-asset") {
      if (file.json) {
        return objectSchema();
      }
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "string",
        contentMediaType: "text/plain",
        "x-minecraft-skills": {
          format: "Resource pack text asset.",
          note: "This identifies the text asset file format only; minecraft-skills does not validate prose content.",
        },
      };
    }
    if (file.json) {
      return objectSchema();
    }
  }
  return null;
}

function staticPackFileSchema(options: {
  edition: EditionData;
  version: string;
  file: PackFileClassification;
  detail: VersionDetailData;
  packFormat: number | null;
}): PackFileSchemaResult {
  const jsonSchema = staticPackFileJsonSchema({
    file: options.file,
    version: options.version,
    detail: options.detail,
    packFormat: options.packFormat,
  });
  const notes =
    jsonSchema && options.file.schemaKind === "pack-metadata"
      ? [
          "This schema describes the known file container/shape only.",
          ...packMetadataNotes(options.detail),
          "It is not a complete normative Minecraft validation schema.",
          "Use observedFields when present for vanilla-observed shape evidence.",
        ]
      : jsonSchema
        ? [
            "This schema describes the known file container/shape only.",
            "It is not a complete normative Minecraft validation schema.",
            "Use observedFields when present for vanilla-observed shape evidence.",
          ]
        : ["No schema is available for this file kind."];
  return {
    schemaVersion: 1,
    edition: options.edition,
    version: options.version,
    file: options.file,
    available: jsonSchema !== null,
    normative: false,
    coverage: jsonSchema ? "known-pack-file-format" : null,
    notes,
    observedFields: [],
    jsonSchema,
  };
}

function resourcepackVersionHasTopLevel(
  edition: EditionData,
  version: string,
  topLevel: string,
): boolean {
  if (topLevel === "pack.mcmeta") {
    return true;
  }
  const paths = readVanillaPathList(edition, version, "resourcepack");
  return paths.some(
    (path) =>
      path === `assets/minecraft/${topLevel}` || path.startsWith(`assets/minecraft/${topLevel}/`),
  );
}

const knownVanillaResourcepackTopLevels = new Set([
  "atlases",
  "blockstates",
  "equipment",
  "font",
  "fonts",
  "items",
  "lang",
  "models",
  "particles",
  "post_effect",
  "shaders",
  "sounds",
  "sounds.json",
  "texts",
  "textures",
]);

function unsupportedSchemaResult(options: {
  edition: EditionData;
  version: string;
  file: PackFileClassification;
  notes: string[];
}): PackFileSchemaResult {
  return {
    schemaVersion: 1,
    edition: options.edition,
    version: options.version,
    file: {
      ...options.file,
      schemaAvailable: false,
      schemaKind: null,
    },
    available: false,
    normative: false,
    coverage: null,
    notes: options.notes,
    observedFields: [],
    jsonSchema: null,
  };
}

function staticSchemaVersionSupport(options: {
  edition: EditionData;
  version: string;
  file: PackFileClassification;
  detail: VersionDetailData;
}): string[] {
  const { file } = options;
  const normalized =
    file.domain === "datapack"
      ? normalizeDatapackClassificationPath(file.path)
      : normalizePackPath(file.path);
  const parts = normalized.split("/");
  if (file.kind === "pack-metadata" || file.kind === "asset-root-marker") {
    return [];
  }
  if (file.domain === "datapack") {
    if (file.kind === "function") {
      const expected = (options.detail.packFormats.data ?? 0) >= 48 ? "function" : "functions";
      if (parts[2] !== expected) {
        return [
          `Target version ${options.version} expects datapack function files under data/<namespace>/${expected}/.`,
        ];
      }
    }
    if (file.kind === "structure") {
      const expected = (options.detail.packFormats.data ?? 0) >= 48 ? "structure" : "structures";
      if (parts[2] !== expected) {
        return [
          `Target version ${options.version} expects datapack structure files under data/<namespace>/${expected}/.`,
        ];
      }
    }
  }
  if (file.domain === "resourcepack") {
    const topLevel = parts[2];
    if (!topLevel) {
      return [`Target version ${options.version} has no matching resourcepack top-level path.`];
    }
    if (!knownVanillaResourcepackTopLevels.has(topLevel)) {
      return [];
    }
    if (topLevel === "sounds.json" || topLevel === "sounds") {
      return [];
    }
    const probe = topLevel === "sounds.json" ? "sounds.json" : topLevel;
    if (!resourcepackVersionHasTopLevel(options.edition, options.version, probe)) {
      return [
        `Target version ${options.version} does not expose assets/minecraft/${probe} in bundled vanilla resourcepack paths.`,
      ];
    }
  }
  return [];
}

export function getPackFileSchema(options: PackFileSchemaOptions): PackFileSchemaResult {
  const editionId = Edition.assert(options.edition ?? "java");
  const version = resolveVersion(editionId, options.version ?? "latest");
  const detail = getVersionDetail(editionId, version);
  const file = classifyPackPath(options.path, options.domain);
  const packFormat =
    file.domain === "datapack" ? detail.packFormats.data : detail.packFormats.resource;
  const unavailable = (notes: string[]): PackFileSchemaResult => ({
    schemaVersion: 1,
    edition: editionId,
    version,
    file,
    available: false,
    normative: false,
    coverage: null,
    notes,
    observedFields: [],
    jsonSchema: null,
  });

  if (!file.schemaAvailable || !file.schemaKind) {
    return unavailable(["No schema is available for this file kind.", ...file.notes]);
  }

  const staticSupportErrors = staticSchemaVersionSupport({
    edition: editionId,
    version,
    file,
    detail,
  });
  if (staticSupportErrors.length > 0) {
    return unsupportedSchemaResult({
      edition: editionId,
      version,
      file,
      notes: [
        ...staticSupportErrors,
        "No schema is returned because the requested file kind or layout is not supported by the target version data.",
      ],
    });
  }

  if (file.kind === "pack-metadata" || file.kind === "asset-root-marker") {
    return staticPackFileSchema({ edition: editionId, version, file, detail, packFormat });
  }

  if (file.domain === "datapack") {
    const surface = getDatapackSchemaSurface(editionId, version);
    const kind = surface.kinds.find((entry) => entry.kind === file.schemaKind);
    if (!kind) {
      if (file.kind === "function" || file.kind === "structure") {
        return staticPackFileSchema({ edition: editionId, version, file, detail, packFormat });
      }
      if (file.json && isEmbeddedDatapackPath(file.path)) {
        return staticPackFileSchema({ edition: editionId, version, file, detail, packFormat });
      }
      return unsupportedSchemaResult({
        edition: editionId,
        version,
        file,
        notes: [
          `Target version ${version} does not expose datapack schema kind '${file.schemaKind}'.`,
          "No schema is returned because using a kind from another version would be misleading.",
        ],
      });
    }
    const observedFields = datapackObservedFields(kind);
    return {
      schemaVersion: 1,
      edition: editionId,
      version: surface.version,
      file,
      available: true,
      normative: false,
      coverage: surface.coverage,
      notes: [
        "This schema is generated from observed vanilla datapack JSON field shapes.",
        "It is not a normative schema and cannot prove custom value validity.",
      ],
      observedFields,
      jsonSchema: observedFieldsJsonSchema({
        title: `Minecraft Java ${surface.version} datapack ${file.schemaKind}`,
        description: `Observed vanilla datapack JSON shape for ${file.schemaKind}.`,
        fields: observedFields,
        coverage: surface.coverage,
      }),
    };
  }

  if (file.domain === "resourcepack") {
    if (file.schemaKind !== "model" && file.schemaKind !== "item-definition") {
      return staticPackFileSchema({ edition: editionId, version, file, detail, packFormat });
    }
    const summary = getResourcepackModelSummary(editionId, version);
    const observedFields =
      file.schemaKind === "item-definition"
        ? resourcepackObservedFields(summary.itemDefinitionJson.fieldPaths)
        : resourcepackObservedFields(summary.modelJson.fieldPaths);
    return {
      schemaVersion: 1,
      edition: editionId,
      version: summary.version,
      file,
      available: true,
      normative: false,
      coverage: summary.coverage,
      notes: [
        "This schema is generated from observed vanilla resourcepack model/item JSON shapes.",
        "It is not a normative schema and cannot prove custom value validity.",
      ],
      observedFields,
      jsonSchema: observedFieldsJsonSchema({
        title: `Minecraft Java ${summary.version} resourcepack ${file.schemaKind}`,
        description: `Observed vanilla resourcepack JSON shape for ${file.schemaKind}.`,
        fields: observedFields,
        coverage: summary.coverage,
      }),
    };
  }

  return unavailable(["Path does not match a schema-backed datapack or resourcepack JSON file."]);
}

function validationIssue(options: {
  path: string;
  message: string;
  keyword?: string | null;
  schemaPath?: string | null;
  params?: Record<string, unknown>;
}): PackFileValidationIssue {
  return {
    path: options.path,
    message: options.message,
    keyword: options.keyword ?? null,
    schemaPath: options.schemaPath ?? null,
    params: options.params ?? {},
  };
}

function ajvIssue(path: string, error: ErrorObject): PackFileValidationIssue {
  return validationIssue({
    path: error.instancePath || path,
    message: error.message ?? "Schema validation failed.",
    keyword: error.keyword,
    schemaPath: error.schemaPath,
    params: error.params as Record<string, unknown>,
  });
}

function unavailableSchemaIsVersionMismatch(schema: PackFileSchemaResult): boolean {
  return schema.notes.some(
    (note) =>
      note.includes("not supported by the target version data") ||
      note.includes("expects datapack") ||
      note.includes("does not expose assets/minecraft/"),
  );
}

const validationAjv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false,
});
const validationFunctionCache = new Map<string, ValidateFunction>();

function validationSchemaCacheKey(schema: PackFileSchemaResult): string {
  return [
    schema.edition,
    schema.version,
    schema.file.domain,
    schema.file.kind,
    schema.file.schemaKind,
    schema.file.extension,
    schema.coverage,
  ].join("\0");
}

function getValidationFunction(schema: PackFileSchemaResult): ValidateFunction {
  if (!schema.jsonSchema) {
    throw new Error("Cannot compile a missing validation schema");
  }
  const key = validationSchemaCacheKey(schema);
  const cached = validationFunctionCache.get(key);
  if (cached) {
    return cached;
  }
  const validate = validationAjv.compile(schema.jsonSchema);
  validationFunctionCache.set(key, validate);
  return validate;
}

function parseValidationContent(options: {
  content: string | unknown;
  file: PackFileClassification;
}): {
  value: unknown;
  contentKind: PackFileValidationResult["contentKind"];
  issue?: PackFileValidationIssue;
} {
  if (typeof options.content !== "string") {
    return { value: options.content, contentKind: "unknown" };
  }
  if (!options.file.json) {
    return { value: options.content, contentKind: "text" };
  }
  try {
    return { value: JSON.parse(options.content) as unknown, contentKind: "json" };
  } catch (error) {
    return {
      value: null,
      contentKind: "json",
      issue: validationIssue({
        path: options.file.path,
        message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        keyword: "parse",
      }),
    };
  }
}

export function validatePackFileContent(
  options: PackFileValidationOptions,
): PackFileValidationResult {
  const schema = getPackFileSchema(options);
  const notes = [...schema.notes];
  const base = {
    schemaVersion: 1 as const,
    edition: schema.edition,
    version: schema.version,
    path: options.path,
    file: schema.file,
    schemaAvailable: schema.available,
  };

  if (!schema.available || !schema.jsonSchema) {
    const versionMismatch = unavailableSchemaIsVersionMismatch(schema);
    return {
      ...base,
      validated: false,
      valid: !versionMismatch,
      contentKind: "unknown",
      notes: [
        ...notes,
        versionMismatch
          ? "Content was rejected because this file layout is not version-compatible with the target version data."
          : "Content was not validated because minecraft-skills has no version-compatible schema for this file kind.",
      ],
      issues: versionMismatch
        ? [
            validationIssue({
              path: options.path,
              message: "This file layout is not supported by the target Minecraft version data.",
              keyword: "version-layout-unsupported",
            }),
          ]
        : [],
    };
  }

  const parsed = parseValidationContent({
    content: options.content,
    file: schema.file,
  });
  if (parsed.issue) {
    return {
      ...base,
      validated: false,
      valid: false,
      contentKind: parsed.contentKind,
      notes,
      issues: [parsed.issue],
    };
  }

  const validate = getValidationFunction(schema);
  const valid = validate(parsed.value);
  const issues = valid ? [] : (validate.errors ?? []).map((error) => ajvIssue(options.path, error));

  return {
    ...base,
    validated: true,
    valid,
    contentKind: parsed.contentKind,
    notes,
    issues,
  };
}

export function validatePackFilesContent(
  options: PackFilesValidationOptions,
): PackFilesValidationResult {
  const edition = Edition.assert(options.edition ?? "java");
  const version = resolveVersion(edition, options.version ?? "latest");
  const files = options.files.map((file) =>
    validatePackFileContent({
      edition,
      version,
      path: file.path,
      content: file.content,
      ...(options.domain ? { domain: options.domain } : {}),
    }),
  );
  return {
    schemaVersion: 1,
    edition,
    version,
    ...(options.domain ? { requestedDomain: options.domain } : {}),
    totalFiles: files.length,
    validatedFiles: files.filter((file) => file.validated).length,
    validFiles: files.filter((file) => file.valid).length,
    invalidFiles: files.filter((file) => !file.valid).length,
    files,
  };
}

export function validateDatapackProject(
  options: DatapackProjectValidationOptions,
): DatapackProjectValidationResult {
  const edition = Edition.assert(options.edition ?? "java");
  const version = resolveVersion(edition, options.version ?? "latest");
  const limit = normalizeLimit(options.limit, 100, 1_000);
  const limits = resolveDatapackProjectValidationLimits(options.limits);
  const detail = getVersionDetail(edition, version);
  const reports = getJavaReportsSummary(edition, version);
  const registryEntryIndexAvailable = hasDataFile(reports.datapack.registryEntries.path);
  const registryEntries = registryEntryIndexAvailable
    ? readRegistryEntryList(edition, reports)
    : [];
  return validateDatapackReferenceGraph({
    files: options.files,
    version,
    directoryLayout: (detail.packFormats.data ?? 0) >= 48 ? "singular" : "legacy-plural",
    assumeLocalNamespacesComplete: options.assumeLocalNamespacesComplete ?? true,
    commandRoots: new Set(
      readCommandPathList(edition, version).map((path) => path.split(" ", 1)[0] ?? ""),
    ),
    vanillaPaths: readVanillaPathList(edition, version, "datapack"),
    registryEntries,
    registryEntryIndexAvailable,
    registries: reports.datapack.registries,
    validateContent(file) {
      const result = validatePackFileContent({
        edition,
        version,
        domain: "datapack",
        path: file.path,
        content: file.content,
      });
      return {
        path: file.path,
        validated: result.validated,
        valid: result.valid,
        issues: result.issues.map((issue) => ({
          message: issue.message,
          keyword: issue.keyword,
          source: issue.path,
        })),
      };
    },
    limit,
    limits,
  });
}

export function validateResourcepackProject(
  options: ResourcepackProjectValidationOptions,
): ResourcepackProjectValidationResult {
  const edition = Edition.assert(options.edition ?? "java");
  const version = resolveVersion(edition, options.version ?? "latest");
  const limit = normalizeLimit(options.limit, 100, 1_000);
  return validateResourcepackReferenceGraph({
    files: options.files,
    version,
    vanillaPaths: readVanillaPathList(edition, version, "resourcepack"),
    limit,
    limits: resolveResourcepackProjectValidationLimits(options.limits),
    pngLimits: resolveResourcepackPngValidationLimits(options.pngLimits),
  });
}

export function validateResourcepackTranslations(
  options: ResourcepackTranslationValidationOptions,
): ResourcepackTranslationValidationResult {
  return validateResourcepackTranslationsInput(options, (edition, version) =>
    resolveVersion(Edition.assert(edition), version),
  );
}

export function explainPackPath(options: PackPathExplanationOptions): PackPathExplanation {
  const edition = Edition.assert(options.edition ?? "java");
  const version = resolveVersion(edition, options.version ?? "latest");
  const classification = classifyPackPath(options.path, options.domain);
  let schema: PackFileSchemaResult | null = null;
  try {
    schema = getPackFileSchema({
      edition,
      version,
      path: options.path,
      ...(options.domain ? { domain: options.domain } : {}),
    });
  } catch {
    schema = null;
  }
  const nextLookups: string[] = [];
  if (classification.domain === "datapack") {
    nextLookups.push(`datapack file-schema ${version} ${options.path}`);
    nextLookups.push(
      `datapack vanilla-paths ${version} --contains ${options.path.split("/").pop() ?? options.path}`,
    );
    if (classification.kind === "function") {
      nextLookups.push(`datapack commands ${version} --contains <command>`);
    }
  } else if (classification.domain === "resourcepack") {
    nextLookups.push(`resourcepack file-schema ${version} ${options.path}`);
    nextLookups.push(
      `resourcepack vanilla-paths ${version} --contains ${options.path.split("/").pop() ?? options.path}`,
    );
    if (classification.kind === "model" || classification.kind === "item-definition") {
      nextLookups.push(
        `resourcepack search-models ${version} --contains ${
          options.path
            .split("/")
            .pop()
            ?.replace(/\.json$/, "") ?? options.path
        }`,
      );
    }
    nextLookups.push(
      `resourcepack assets search ${version} --contains ${options.path.split("/").pop() ?? options.path}`,
    );
  } else {
    nextLookups.push(`minecraft search-all ${JSON.stringify(options.path)}`);
  }
  return {
    schemaVersion: 1,
    edition,
    version,
    path: options.path,
    classification,
    schema,
    nextLookups,
    notes: [
      ...classification.notes,
      ...(schema?.notes ?? []),
      "Use validate-files only as a conservative preflight; unvalidated gaps are not proof that a custom file is invalid.",
    ],
  };
}

export function suggestMinecraftLookups(options: LookupSuggestionOptions): LookupSuggestionResult {
  const task = options.task.trim();
  if (!task) {
    throw new Error("suggestMinecraftLookups requires a non-empty task");
  }
  const edition = Edition.assert(options.edition ?? "java");
  const version = resolveVersion(edition, options.version ?? "latest");
  const limit = normalizeLimit(options.limit, 8, 50);
  const lower = task.toLowerCase();
  const normalizedTask = normalizeSearchText(task);
  const paperItemDeliveryTask = isPaperItemDeliveryDiscoveryQuery(task);
  const paperInventoryGuiTask = isPaperInventoryGuiDiscoveryQuery(task);
  const paperWorldOperationTask = isPaperWorldOperationSafetyDiscoveryQuery(task);
  const paperItemStackSemanticIdentityTask = isPaperItemStackSemanticIdentityDiscoveryQuery(
    task,
    options.domain,
  );
  const paperConfigurationLifecycleTask = isPaperPluginConfigurationLifecycleQuery(task);
  const explicitDatapackTask =
    /\b(data ?pack|mcfunction|advancement|loot table|predicate|worldgen)\b/.test(normalizedTask);
  const explicitResourcepackTask =
    /\b(resource ?pack|asset|blockstate|font|model|texture|translation)\b/.test(normalizedTask);
  const hasDatapackContext = /\b(?:data[-_\s]*pack|datapack)\b/.test(lower);
  const hasResourcepackContext = /\b(?:resource[-_\s]*pack|resourcepack)\b/.test(lower);
  const hasExplicitPaperContext =
    /\b(?:paper[-_\s]+plugin|bukkit|spigot|offlineplayer|playerprofile|getchunkatasync|chunkunloadevent|regionscheduler|entityscheduler)\b/.test(
      lower,
    ) ||
    /\bplugin chunk tickets?\b/.test(lower) ||
    (/\bpaper\b/.test(lower) && !hasDatapackContext && !hasResourcepackContext) ||
    paperItemStackSemanticIdentityTask;
  const inferredDomains = [
    hasDatapackContext ? "datapack" : undefined,
    hasResourcepackContext ? "resourcepack" : undefined,
    hasExplicitPaperContext ? "paper-plugin" : undefined,
  ].filter((domain): domain is NonNullable<LookupSuggestionOptions["domain"]> => Boolean(domain));
  const inferredDomain = inferredDomains.length === 1 ? inferredDomains[0] : undefined;
  const searchDomain = options.domain ?? inferredDomain;
  const isPaperProtocolTask =
    /\b(?:plugin[-\s]+messag(?:e|ing)|custom[-\s]+payload|rpc|codec|request[-\s]+correlation|chunked[-\s]+upload)\b/.test(
      lower,
    );
  const suggestedTools: LookupSuggestionResult["suggestedTools"] = [];
  const add = (tool: string, reason: string) => {
    if (!suggestedTools.some((entry) => entry.tool === tool)) {
      suggestedTools.push({ tool, reason });
    }
  };

  add(
    `minecraft search-all ${JSON.stringify(task)} --version ${version}`,
    "Start with a cross-domain search.",
  );
  if (
    /\b(crash report|stack ?trace|latest\.log|debug\.log|server log|minecraft log|java exception|caused by|mixin apply|noclassdeffounderror|classnotfoundexception|could not initialize class|class[ -]?loading failures?)\b/.test(
      lower,
    )
  ) {
    add(
      "minecraft analyze-log <log-file>",
      "Extract bounded events, explicit exception branches and class-loading failure evidence, crash metadata, and referenced artifacts before diagnosing the log.",
    );
  }
  if (!options.domain && isServerAccessListValidationQuery(task)) {
    add(
      "minecraft validate-access-list <file> [--kind whitelist|ops|banned-players|banned-ips]",
      "Validate a vanilla server access-list JSON file offline without returning identities or ban text.",
    );
  }
  if (!options.domain && isMinecraftPerformanceAnalysisQuery(task)) {
    add(
      "minecraft analyze-performance <file>",
      "Analyze a bounded normalized Minecraft performance time series without inferring a root cause.",
    );
  }
  if (!searchDomain || searchDomain === "datapack") {
    const datapackProjectValidationTask =
      /(validat|verif|check|audit|lint|diagnos|broken|missing|reference|cycle)/.test(lower) &&
      /(data[-_\s]*pack|pack\.mcmeta|function[-_\s]+tag|advancement[-_\s]+parent|mcfunction)/.test(
        lower,
      );
    if (datapackProjectValidationTask) {
      add(
        `datapack validate-project ${version} <directory>`,
        "Validate a complete datapack directory, including local and vanilla references.",
      );
    }
    if (
      /(command|execute|function|advancement|loot|recipe|predicate|tag|datapack|data pack)/.test(
        lower,
      ) &&
      (options.domain === "datapack" ||
        explicitDatapackTask ||
        (!paperInventoryGuiTask && !paperWorldOperationTask))
    ) {
      add(
        `datapack find ${JSON.stringify(task)} --version ${version}`,
        "Search datapack commands, schemas, and vanilla data paths.",
      );
      add(`datapack context ${version}`, "Load datapack authoring guidance and evidence rules.");
    }
    if (
      /(vanilla|official|built[ -]?in)/.test(lower) &&
      /(advancement|loot|recipe|predicate|tag|worldgen|json)/.test(lower)
    ) {
      const resourceId = task.match(/\b[a-z0-9_.-]+:[a-z0-9_./-]+\b/i)?.[0];
      const kind = vanillaJsonDiscoveryKind(lower);
      const kindOption = kind ? ` --kind ${kind}` : "";
      const contentQuery = resourceId ?? vanillaJsonDiscoveryTerm(task);
      if (contentQuery) {
        add(
          `datapack vanilla-json search ${JSON.stringify(contentQuery)} --version ${version}${kindOption}`,
          "Search parsed vanilla datapack JSON keys and values in the cached official server jar.",
        );
      } else {
        add(
          `datapack vanilla-json files ${version}${kindOption}`,
          "List exact vanilla datapack JSON files in the cached official server jar.",
        );
      }
    }
  }
  if (!searchDomain || searchDomain === "resourcepack") {
    if (
      /(resource|asset|model|texture|item|blockstate|sound|font|lang|resource pack)/.test(lower) &&
      (options.domain === "resourcepack" ||
        explicitResourcepackTask ||
        (!paperItemDeliveryTask && !paperInventoryGuiTask && !paperWorldOperationTask))
    ) {
      add(
        `resourcepack assets find ${JSON.stringify(task)} --version ${version}`,
        "Search resourcepack paths, model summaries, and cached asset indexes.",
      );
      add(
        `resourcepack context ${version}`,
        "Load resourcepack authoring guidance and validation limits.",
      );
    }
  }
  if (!searchDomain || searchDomain === "paper-plugin") {
    const paperApiTask = /(paper|plugin|event|listener|bukkit|spigot|api|method|class|member)/.test(
      lower,
    );
    const commandTask = /\b(command|subcommand)\b/.test(lower);
    const administrativeRoleTask =
      /\b(admin|administrator|administrative|moderator|operator|maintenance|configuration)\b/.test(
        lower,
      );
    const administrativeOperationTask =
      /\b(permission|console|sender|reload|status|repair|reset|remove|ban|grant|revoke|recovery)\b/.test(
        lower,
      );
    const administrativeCommandTask =
      (options.domain === "paper-plugin" && (commandTask || administrativeOperationTask)) ||
      (!options.domain && commandTask && administrativeRoleTask);
    const playerIdentityTask =
      /(player|offlineplayer|playerprofile|gameprofile|uuid)/.test(lower) &&
      /(identity|name|display|profile|lookup|resolve|rename|offline|cache)/.test(lower) &&
      (searchDomain === "paper-plugin" ||
        /(paper|bukkit|spigot|offlineplayer|playerprofile)/.test(lower));
    if (
      paperItemDeliveryTask ||
      paperInventoryGuiTask ||
      paperWorldOperationTask ||
      paperItemStackSemanticIdentityTask ||
      paperApiTask ||
      administrativeCommandTask ||
      playerIdentityTask ||
      isPaperProtocolTask ||
      paperConfigurationLifecycleTask
    ) {
      add(
        `plugin paper search ${JSON.stringify(task)}`,
        "Search Paper plugin recipes, diagnostics, and source guidance.",
      );
      add(
        `plugin paper types ${version} --contains ${JSON.stringify(task)}`,
        "Search Paper API type names.",
      );
      add(
        `plugin paper members ${version} --contains ${JSON.stringify(task)}`,
        "Search Paper API member names.",
      );
    }
    if (paperConfigurationLifecycleTask) {
      add(
        `plugin paper plan paper-plugin-configuration-lifecycle-review ${version}`,
        "Resolve lifecycle-safe startup, transactional reload, persistence, observability, and test guidance.",
      );
    }
  }
  if (!searchDomain && isFabricToolchainDiscoveryQuery(task)) {
    add(
      `fabric toolchain ${JSON.stringify(version)}`,
      "Look up official live Fabric Loader, Intermediary, and Yarn candidates for the target game version.",
    );
  }
  if (!searchDomain && isVelocityToolchainDiscoveryQuery(task)) {
    add(
      "velocity toolchain",
      "Resolve the current official velocity-api coordinate, repository, documentation, and applicable Java requirement.",
    );
  }
  if (!searchDomain && isServerPropertiesValidationQuery(task)) {
    add(
      `server validate-properties server.properties --version ${version}`,
      "Validate bounded Java Properties syntax, duplicate effective values, stable value types, and file-local server property correlations without returning values.",
    );
  }
  if (!searchDomain && isFabricModValidationDiscoveryQuery(task)) {
    add(
      "fabric validate-mod <file.jar>",
      "Validate bounded Fabric Loader v1 metadata, JAR structure, and referenced-file presence offline.",
    );
  }
  if (!searchDomain && isVelocityPluginJarValidationDiscoveryQuery(task)) {
    add(
      "plugin velocity validate-jar <file.jar>",
      "Validate bounded Velocity descriptor, entrypoint class, annotation, and Java-target evidence offline.",
    );
  }
  const migrationTask =
    /\b(migrat(?:e|es|ed|ing|ion)?|upgrad(?:e|es|ed|ing)|port(?:s|ed|ing)?|version)\b/.test(
      lower,
    ) ||
    (/\bfrom\b/.test(lower) && /\bto\b/.test(lower));
  if (
    migrationTask &&
    !paperInventoryGuiTask &&
    (!paperItemStackSemanticIdentityTask || hasDatapackContext || hasResourcepackContext)
  ) {
    add(`minecraft pack-format ${version} datapack`, "Check target data pack format.");
    add(`minecraft pack-format ${version} resourcepack`, "Check target resource pack format.");
  }
  if (!options.domain && isModrinthCompatibilityTask(task)) {
    add(
      "modrinth compatibility <project-id-or-slug> <project-id-or-slug> [more projects]",
      "Resolve common game-version/loader metadata pairs and concrete project version candidates.",
    );
  }

  const explicitNonPaperPlatform =
    !searchDomain && /\b(?:fabric|forge|neoforge|quilt|velocity)\b/.test(lower);
  const catalogSearchLimit = explicitNonPaperPlatform ? 200 : limit;
  const scenarioSearchLimit = explicitNonPaperPlatform ? 100 : limit;

  let catalog = searchCatalog({
    query: task,
    ...(searchDomain ? { domain: searchDomain } : {}),
    limit: catalogSearchLimit,
  });
  let scenarios = searchAuthoringScenarios({
    query: task,
    ...(searchDomain ? { domain: searchDomain } : {}),
    limit: scenarioSearchLimit,
  });
  if (explicitNonPaperPlatform) {
    const catalogResults = catalog.results.filter(
      (entry) =>
        entry.domains.length === 0 || entry.domains.some((domain) => domain !== "paper-plugin"),
    );
    const scenarioResults = scenarios.results.filter((entry) =>
      entry.scenario.domains.some((domain) => domain !== "paper-plugin"),
    );
    catalog = {
      ...catalog,
      limit,
      truncated: catalog.truncated || catalogResults.length > limit,
      results: catalogResults.slice(0, limit),
    };
    scenarios = {
      ...scenarios,
      limit,
      truncated: scenarios.truncated || scenarioResults.length > limit,
      results: scenarioResults.slice(0, limit),
    };
  }
  return {
    schemaVersion: 1,
    task,
    edition,
    version,
    ...(searchDomain ? { domain: searchDomain } : {}),
    suggestedTools,
    catalog,
    scenarios,
  };
}

function normalizeLimit(limit: number | undefined, defaultLimit: number, maxLimit: number): number {
  const resolved = limit ?? defaultLimit;
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > maxLimit) {
    throw new Error(`Limit must be between 1 and ${maxLimit}`);
  }
  return resolved;
}

function filterResourcepackModelPaths(
  paths: string[],
  options: Pick<ResourcepackModelPathSearchOptions, "contains" | "prefix" | "kind">,
): string[] {
  const contains = options.contains?.trim();
  const prefix = options.prefix?.trim();
  return paths.filter((path) => {
    if (!path.endsWith(".json")) {
      return false;
    }
    if (options.kind === "item-definition") {
      if (!path.startsWith("assets/") || !path.includes("/items/")) return false;
    } else if (options.kind === "model") {
      if (!path.startsWith("assets/") || !path.includes("/models/")) return false;
    } else if (
      !path.startsWith("assets/") ||
      (!path.includes("/models/") && !path.includes("/items/"))
    ) {
      return false;
    }
    if (prefix && !path.startsWith(prefix)) {
      return false;
    }
    if (contains && !path.includes(contains)) {
      return false;
    }
    return true;
  });
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
  const paths = readDataText(pathIndex).trim().split(/\r?\n/).filter(Boolean);
  const limit = normalizeLimit(options.limit, 50, 500);
  const modelPaths = filterResourcepackModelPaths(paths, {
    ...(options.kind ? { kind: options.kind } : {}),
  });
  const matched = filterResourcepackModelPaths(modelPaths, options);

  return {
    edition: editionId,
    version: modelSummary.version,
    totalPaths: modelPaths.length,
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
  const paths = readVanillaPathList(editionId, inventory.version, domain);
  const limit = normalizeLimit(options.limit, 50, 500);
  const matched = filterVanillaPaths(paths, options);

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

function vanillaDatapackJsonKind(path: string): string {
  const parts = path.split("/");
  if (parts[0] === "data" && parts[2] === "datapacks") {
    const nestedDataIndex = parts.findIndex((part, index) => index > 2 && part === "data");
    if (nestedDataIndex !== -1) {
      return vanillaDatapackJsonKind(parts.slice(nestedDataIndex).join("/"));
    }
  }
  if (parts[0] !== "data" || !parts[1] || !parts[2]) {
    return "unknown";
  }
  if (parts[2] === "tags") {
    return parts[3] ? `tag/${parts[3]}` : "tag";
  }
  if (parts[2] === "worldgen") {
    return parts[3] ? `worldgen/${parts[3]}` : "worldgen";
  }
  return parts[2];
}

function matchesVanillaDatapackJsonKind(path: string, expected: string): boolean {
  const actual = vanillaDatapackJsonKind(path);
  return actual === expected || actual.startsWith(`${expected}/`);
}

function assertVanillaDatapackJsonPath(path: string): string {
  if (typeof path !== "string" || path.length < 1 || path.length > 4_096) {
    throw new Error("Vanilla datapack JSON path must contain 1 to 4096 characters");
  }
  const normalized = normalizePackPath(path);
  if (!normalized.startsWith("data/") || !normalized.endsWith(".json")) {
    throw new Error("Vanilla datapack JSON path must be a data/**/*.json path");
  }
  return normalized;
}

function mojangServerDownload(detail: VersionDetailData): {
  url: string;
  sha1: string | null;
  size: number | null;
} {
  const server = versionDownload(detail, "server");
  if (!server?.url) {
    throw new Error(`No Mojang server jar download URL for ${detail.version}`);
  }
  return {
    url: server.url,
    sha1: server.sha1 ?? null,
    size: server.size ?? null,
  };
}

function mojangServerJarSelection(
  edition: EditionData,
  requested: string,
): {
  version: string;
  verification: { sha1: string | null; size: number | null };
} {
  const detail = getVersionDetail(edition, requested);
  const download = mojangServerDownload(detail);
  return {
    version: detail.version,
    verification: { sha1: download.sha1, size: download.size },
  };
}

function boundedOptionalVanillaJsonText(
  value: string | undefined,
  maximum: number,
  label: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maximum) {
    throw new Error(`${label} must be a string of at most ${maximum} characters`);
  }
  return value.trim();
}

export async function fetchMojangServerJarForVersion(
  options: FetchMojangServerJarForVersionOptions = {},
) {
  const edition = Edition.assert(options.edition ?? "java");
  const detail = getVersionDetail(edition, options.version ?? "latest");
  const download = mojangServerDownload(detail);
  return fetchMojangServerJar({
    version: detail.version,
    url: download.url,
    sha1: download.sha1,
    size: download.size,
    force: options.force === true,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}

export function searchVanillaDatapackJsonFiles(
  options: VanillaDatapackJsonSearchOptions = {},
): VanillaDatapackJsonSearchResult {
  const edition = Edition.assert(options.edition ?? "java");
  const limit = normalizeLimit(options.limit, 25, 200);
  const prefix = boundedOptionalVanillaJsonText(options.prefix, 4_096, "prefix");
  const contains = boundedOptionalVanillaJsonText(options.contains, 256, "contains");
  const kind = boundedOptionalVanillaJsonText(options.kind, 128, "kind");
  const { version, verification } = mojangServerJarSelection(edition, options.version ?? "latest");
  const entries = listCachedMojangServerJarEntries(version, verification);
  const jsonFiles = entries.filter(
    (entry) => entry.path.startsWith("data/") && entry.path.endsWith(".json"),
  );
  const files = jsonFiles.filter((entry) => {
    if (prefix && !entry.path.startsWith(prefix)) {
      return false;
    }
    if (contains && !entry.path.includes(contains)) {
      return false;
    }
    if (kind && !matchesVanillaDatapackJsonKind(entry.path, kind)) {
      return false;
    }
    return true;
  });
  return {
    schemaVersion: 1,
    edition,
    version,
    cache: getMojangServerJarStatus(version),
    totalJsonFiles: jsonFiles.length,
    matchedFiles: files.length,
    truncated: files.length > limit,
    files: files.slice(0, limit),
    notes: [
      "Reads vanilla datapack JSON file paths from a cached official Mojang server jar.",
      "If the jar is missing, fetch it first with fetch_mojang_server_jar.",
    ],
  };
}

function jsonPointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function appendBoundedJsonPointer(
  pointer: string | null,
  segment: string,
): { pointer: string | null; truncated: boolean } {
  if (pointer === null) {
    return { pointer: null, truncated: true };
  }
  const next = `${pointer}/${jsonPointerSegment(segment)}`;
  return next.length <= 1_024
    ? { pointer: next, truncated: false }
    : { pointer: null, truncated: true };
}

function jsonSearchPreview(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined) {
    return String(value);
  }
  return text.length <= 200 ? text : `${text.slice(0, 197)}...`;
}

function findVanillaDatapackJsonContentMatches(options: {
  value: unknown;
  query: string;
  scope: "keys" | "values" | "all";
  caseSensitive: boolean;
  limit: number;
  maxNodes: number;
}): {
  matches: VanillaDatapackJsonContentMatch[];
  truncated: boolean;
  traversalLimited: boolean;
  visitedNodes: number;
} {
  const normalize = options.caseSensitive
    ? (value: string) => value
    : (value: string) => value.toLowerCase();
  const needle = normalize(options.query);
  const matches: VanillaDatapackJsonContentMatch[] = [];
  const stack: Array<{
    value: unknown;
    pointer: string | null;
    pointerTruncated: boolean;
    key: string | null;
    depth: number;
  }> = [{ value: options.value, pointer: "", pointerTruncated: false, key: null, depth: 0 }];
  let visited = 0;
  let traversalLimited = false;

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      break;
    }
    if (visited >= options.maxNodes) {
      traversalLimited = true;
      break;
    }
    visited += 1;
    if (node.key !== null && options.scope !== "values" && normalize(node.key).includes(needle)) {
      matches.push({
        pointer: node.pointer,
        ...(node.pointerTruncated ? { pointerTruncated: true as const } : {}),
        matchedIn: "key",
        preview: jsonSearchPreview(node.key),
      });
    }
    const scalar =
      node.value === null ||
      typeof node.value === "string" ||
      typeof node.value === "number" ||
      typeof node.value === "boolean";
    if (scalar && options.scope !== "keys") {
      const preview = jsonSearchPreview(node.value);
      const searchable = typeof node.value === "string" ? node.value : String(node.value);
      if (normalize(searchable).includes(needle)) {
        matches.push({
          pointer: node.pointer,
          ...(node.pointerTruncated ? { pointerTruncated: true as const } : {}),
          matchedIn: "value",
          preview,
        });
      }
    }
    if (matches.length > options.limit) {
      return {
        matches: matches.slice(0, options.limit),
        truncated: true,
        traversalLimited,
        visitedNodes: visited,
      };
    }
    if (Array.isArray(node.value)) {
      if (node.depth >= 128 && node.value.length > 0) {
        traversalLimited = true;
        continue;
      }
      const available = Math.max(0, options.maxNodes - visited - stack.length);
      const childCount = Math.min(node.value.length, available);
      traversalLimited ||= childCount < node.value.length;
      for (let index = childCount - 1; index >= 0; index -= 1) {
        const childPointer = appendBoundedJsonPointer(node.pointer, String(index));
        stack.push({
          value: node.value[index],
          pointer: childPointer.pointer,
          pointerTruncated: node.pointerTruncated || childPointer.truncated,
          key: null,
          depth: node.depth + 1,
        });
      }
    } else if (node.value !== null && typeof node.value === "object") {
      const object = node.value as Record<string, unknown>;
      const keys = Object.keys(object);
      if (node.depth >= 128 && keys.length > 0) {
        traversalLimited = true;
        continue;
      }
      const available = Math.max(0, options.maxNodes - visited - stack.length);
      const childCount = Math.min(keys.length, available);
      traversalLimited ||= childCount < keys.length;
      for (let index = childCount - 1; index >= 0; index -= 1) {
        const key = keys[index];
        if (key === undefined) continue;
        const childPointer = appendBoundedJsonPointer(node.pointer, key);
        stack.push({
          value: object[key],
          pointer: childPointer.pointer,
          pointerTruncated: node.pointerTruncated || childPointer.truncated,
          key,
          depth: node.depth + 1,
        });
      }
    }
  }
  return { matches, truncated: traversalLimited, traversalLimited, visitedNodes: visited };
}

export function searchVanillaDatapackJsonContent(
  options: VanillaDatapackJsonContentSearchOptions,
): VanillaDatapackJsonContentSearchResult {
  if (typeof options.query !== "string" || options.query.length > 256) {
    throw new Error("searchVanillaDatapackJsonContent query must contain 1 to 256 characters");
  }
  const query = options.query.trim();
  if (!query) {
    throw new Error("searchVanillaDatapackJsonContent query must contain 1 to 256 characters");
  }
  const edition = Edition.assert(options.edition ?? "java");
  const limit = normalizeLimit(options.limit, 25, 100);
  const matchesPerFile = normalizeLimit(options.matchesPerFile, 3, 10);
  const scope = options.scope ?? "all";
  if (scope !== "keys" && scope !== "values" && scope !== "all") {
    throw new Error("searchVanillaDatapackJsonContent scope must be keys, values, or all");
  }
  const prefix = boundedOptionalVanillaJsonText(options.prefix, 4_096, "prefix");
  const kind = boundedOptionalVanillaJsonText(options.kind, 128, "kind");
  const { version, verification } = mojangServerJarSelection(edition, options.version ?? "latest");
  const scan = scanCachedMojangServerJarText(version, {
    include: (entry) =>
      entry.path.startsWith("data/") &&
      entry.path.endsWith(".json") &&
      (!prefix || entry.path.startsWith(prefix)) &&
      (!kind || matchesVanillaDatapackJsonKind(entry.path, kind)),
    maxEntries: 10_000,
    maxEntryBytes: 2 * 1024 * 1024,
    maxTotalBytes: 64 * 1024 * 1024,
    ...verification,
  });
  const totalJsonFiles = scan.entries.filter(
    (entry) => entry.path.startsWith("data/") && entry.path.endsWith(".json"),
  ).length;
  const files: VanillaDatapackJsonContentSearchResult["files"] = [];
  let matchedFiles = 0;
  let invalidJsonFiles = 0;
  let traversalLimitedFiles = 0;
  let skippedTraversalFiles = 0;
  const traversalLimitedPaths: string[] = [];
  const traversalSkippedPaths: string[] = [];
  let traversedNodes = 0;
  const traversalNodeLimit = 1_000_000;
  let matchDetailsTruncated = false;
  for (const entry of scan.texts) {
    const remainingTraversalNodes = traversalNodeLimit - traversedNodes;
    if (remainingTraversalNodes <= 0) {
      skippedTraversalFiles += 1;
      if (traversalSkippedPaths.length < 20) traversalSkippedPaths.push(entry.path);
      continue;
    }
    let value: unknown;
    try {
      value = JSON.parse(entry.content) as unknown;
    } catch {
      invalidJsonFiles += 1;
      continue;
    }
    const found = findVanillaDatapackJsonContentMatches({
      value,
      query,
      scope,
      caseSensitive: options.caseSensitive === true,
      limit: matchesPerFile,
      maxNodes: Math.min(100_000, remainingTraversalNodes),
    });
    traversedNodes += found.visitedNodes;
    if (found.traversalLimited) {
      traversalLimitedFiles += 1;
      if (traversalLimitedPaths.length < 20) traversalLimitedPaths.push(entry.path);
    }
    if (found.matches.length === 0) {
      continue;
    }
    matchedFiles += 1;
    matchDetailsTruncated ||= found.truncated;
    if (files.length < limit) {
      files.push({
        path: entry.path,
        kind: vanillaDatapackJsonKind(entry.path),
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
        matches: found.matches,
        matchesTruncated: found.truncated,
      });
    }
  }
  const scanComplete =
    !scan.truncated &&
    invalidJsonFiles === 0 &&
    traversalLimitedFiles === 0 &&
    skippedTraversalFiles === 0;
  return {
    schemaVersion: 1,
    edition,
    version,
    query,
    scope,
    caseSensitive: options.caseSensitive === true,
    cache: getMojangServerJarStatus(version),
    totalJsonFiles,
    candidateFiles: scan.selectedEntries,
    scannedFiles: scan.scannedEntries,
    scannedBytes: scan.scannedBytes,
    matchedFiles,
    returnedFiles: files.length,
    invalidJsonFiles,
    traversalLimitedFiles,
    skippedTraversalFiles,
    traversalLimitedPaths,
    traversalSkippedPaths,
    traversedNodes,
    traversalNodeLimit,
    skippedOversizedFiles: scan.skippedOversizedEntries,
    skippedBudgetFiles: scan.skippedBudgetEntries,
    scanComplete,
    truncated: !scanComplete || matchedFiles > files.length || matchDetailsTruncated,
    files,
    skippedPaths: scan.skippedPaths,
    notes: [
      "Searches parsed vanilla data/**/*.json keys and primitive values from one cached official Mojang server jar read.",
      "Matches are literal substrings; use kind or prefix to narrow broad queries.",
      "JSON pointers are omitted when they exceed 1024 characters; previews are limited to 200 characters.",
      "Traversal is limited to 100000 nodes per file and 1000000 nodes per request; incomplete files are reported.",
      "A result proves observed vanilla content only for this exact version, not custom pack validity or runtime behavior.",
      "Fetch the jar first with fetch_mojang_server_jar when the cache is missing.",
    ],
  };
}

export function getVanillaDatapackJson(
  options: VanillaDatapackJsonOptions,
): VanillaDatapackJsonResult {
  const path = assertVanillaDatapackJsonPath(options.path);
  const edition = Edition.assert(options.edition ?? "java");
  const { version, verification } = mojangServerJarSelection(edition, options.version ?? "latest");
  const content = readCachedMojangServerJarText(version, path, verification);
  const parse = options.parse !== false;
  let json: unknown | null = null;
  if (parse) {
    json = JSON.parse(content) as unknown;
  }
  return {
    schemaVersion: 1,
    edition,
    version,
    path,
    cache: getMojangServerJarStatus(version),
    content,
    json,
    notes: [
      "Content was read from a cached official Mojang server jar.",
      "Treat the file as vanilla evidence for the exact version, not as a complete custom pack schema.",
    ],
  };
}

function addCrossResult(
  results: CrossSearchEntry[],
  entry: Omit<CrossSearchEntry, "score"> & { score?: number },
): void {
  results.push({ ...entry, score: entry.score ?? entry.matches.length });
}

const genericRegistryDiscoveryTerms = new Set(["entries", "entry", "registries", "registry"]);

function matchesRegistryDiscoveryPrefilter(entry: RegistryEntry, term: string): boolean {
  if (!term || genericRegistryDiscoveryTerms.has(term)) {
    return true;
  }
  return (
    entry.registryId.toLowerCase().includes(term) || entry.entryId.toLowerCase().includes(term)
  );
}

export function searchAll(options: CrossSearchOptions): CrossSearchResults {
  const query = options.query.trim();
  if (!query) {
    throw new Error("searchAll requires a non-empty query");
  }
  const edition = Edition.assert(options.edition ?? "java");
  const version = resolveVersion(edition, options.version ?? "latest");
  const limit = normalizeLimit(options.limit, 20, 200);
  const results: CrossSearchEntry[] = [];
  const gaps: string[] = [];
  let sourceTruncated = false;
  const discoveryTerm = primaryDiscoveryTerm(query);
  const include = (domain: DomainIdData | "minecraft") =>
    !options.domain || domain === options.domain || domain === "minecraft";

  if (!options.domain && isServerAccessListValidationQuery(query)) {
    addCrossResult(results, {
      surface: "server-access-list-tools",
      domain: "minecraft",
      kind: "offline-validator",
      title: "Validate vanilla server access-list JSON",
      score: 100,
      matches: [
        "whitelist.json and ops.json",
        "banned-players.json and banned-ips.json",
        "privacy-preserving offline validation",
      ],
      lookup:
        "minecraft validate-access-list <file> [--kind whitelist|ops|banned-players|banned-ips]",
    });
  }

  if (!options.domain && isMinecraftPerformanceAnalysisQuery(query)) {
    addCrossResult(results, {
      surface: "performance-analysis-tools",
      domain: "minecraft",
      kind: "offline-analyzer",
      title: "Analyze normalized Minecraft performance time series",
      score: 100,
      matches: [
        "TPS and MSPT threshold windows",
        "coverage, trend, before/after comparison, and aligned association",
        "bounded privacy-preserving input",
      ],
      lookup: "minecraft analyze-performance <file>",
    });
  }

  if (!options.domain && isModrinthCompatibilityTask(query)) {
    addCrossResult(results, {
      surface: "modrinth-tools",
      domain: "minecraft",
      kind: "compatibility-resolver",
      title: "Resolve common Modrinth project version metadata",
      score: 100,
      matches: ["Modrinth project compatibility", "common game-version and loader pairs"],
      lookup: "modrinth compatibility <project-id-or-slug> <project-id-or-slug> [more projects]",
    });
  }

  if (!options.domain && isServerPropertiesValidationQuery(query)) {
    addCrossResult(results, {
      surface: "server-properties-tools",
      domain: "minecraft",
      kind: "bounded-validator",
      title: "Validate a Java Edition server.properties file",
      score: 250,
      matches: [
        "Java Properties syntax",
        "duplicate last-wins evidence",
        "RCON and resource-pack correlations",
      ],
      lookup: `server validate-properties server.properties --version ${version}`,
    });
  }

  const catalog = searchCatalog({
    query,
    ...(options.domain ? { domain: options.domain } : {}),
    limit,
  });
  sourceTruncated ||= catalog.truncated;
  for (const item of catalog.results) {
    addCrossResult(results, {
      surface: "catalog",
      domain: item.domains[0] ?? "minecraft",
      kind: item.kind,
      title: item.title,
      score: item.score,
      matches: item.matches.map((match) => `${match.field}: ${match.text}`),
      lookup: `minecraft search ${JSON.stringify(query)}`,
    });
  }

  if (!options.domain && isFabricToolchainDiscoveryQuery(query)) {
    addCrossResult(results, {
      surface: "fabric-meta",
      domain: "minecraft",
      kind: "live-toolchain-lookup",
      title: "Fabric Loader + Intermediary + Yarn candidates",
      score: 100,
      matches: ["Fabric Loader", "Intermediary", "Yarn", "official Fabric Meta v2"],
      lookup: `fabric toolchain ${JSON.stringify(version)}`,
    });
  }

  if (!options.domain && isVelocityToolchainDiscoveryQuery(query)) {
    addCrossResult(results, {
      surface: "velocity-toolchain",
      domain: "minecraft",
      kind: "live-toolchain-resolution",
      title: "Velocity API dependency and Java requirement",
      score: 250,
      matches: ["velocity-api", "PaperMC Maven", "Velocity development docs", "Java requirement"],
      lookup: "velocity toolchain",
    });
  }

  if (!options.domain && isFabricModValidationDiscoveryQuery(query)) {
    addCrossResult(results, {
      surface: "fabric-mod-validation",
      domain: "minecraft",
      kind: "offline-artifact-validation",
      title: "Fabric mod metadata and JAR validation",
      score: 250,
      matches: ["fabric.mod.json schemaVersion 1", "JAR paths", "referenced files"],
      lookup: "fabric validate-mod <file.jar>",
    });
  }

  if (!options.domain && isVelocityPluginJarValidationDiscoveryQuery(query)) {
    addCrossResult(results, {
      surface: "velocity-plugin-validator",
      domain: "minecraft",
      kind: "offline-jar-validator",
      title: "Validate a Velocity plugin JAR",
      score: 100,
      matches: [
        "velocity-plugin.json",
        "entrypoint class",
        "runtime-visible @Plugin metadata",
        "Java classfile target",
      ],
      lookup: "plugin velocity validate-jar <file.jar>",
    });
  }

  if (include("datapack")) {
    const commands = filterCommandPaths(readCommandPathList(edition, version), {
      contains: discoveryTerm,
    });
    for (const path of commands.filter((entry) =>
      matchesDiscoveryQuery(query, entry, "datapack data pack command path"),
    )) {
      addCrossResult(results, {
        surface: "commands",
        domain: "datapack",
        kind: "command-path",
        title: path,
        score: scoreDiscoveryMatch(query, [path], ["datapack data pack command path"]),
        matches: [path],
        lookup: `datapack commands ${version} --contains ${JSON.stringify(path)} --limit 1`,
      });
    }
    const registryEntries = registryEntryState(edition, version, {}).entries.filter(
      (candidate) =>
        matchesRegistryDiscoveryPrefilter(candidate, discoveryTerm) &&
        matchesDiscoveryQuery(
          query,
          candidate.entryId,
          candidate.registryId,
          "minecraft registry registries entry entries identifier",
        ),
    );
    for (const entry of registryEntries) {
      addCrossResult(results, {
        surface: "registry-entries",
        domain: "datapack",
        kind: entry.registryId,
        title: entry.entryId,
        score: scoreDiscoveryMatch(
          query,
          [entry.entryId, entry.registryId],
          ["minecraft registry registries entry entries identifier"],
        ),
        matches: [
          entry.registryId,
          entry.entryId,
          ...(entry.protocolId === null ? [] : [`protocol_id=${entry.protocolId}`]),
        ],
        lookup: `minecraft registry-entries ${version} --registry ${JSON.stringify(
          entry.registryId,
        )} --exact ${JSON.stringify(entry.entryId)} --limit 1`,
      });
    }
    const schema = flattenDatapackFields(getDatapackSchemaSurface(edition, version)).filter(
      (field) =>
        (field.kind.toLowerCase().includes(discoveryTerm) ||
          field.path.toLowerCase().includes(discoveryTerm)) &&
        matchesDiscoveryQuery(query, field.kind, field.path, "datapack data pack schema field"),
    );
    for (const field of schema) {
      addCrossResult(results, {
        surface: "datapack-schema",
        domain: "datapack",
        kind: field.kind,
        title: field.path,
        score: scoreDiscoveryMatch(
          query,
          [field.path, field.kind],
          ["datapack data pack schema field"],
        ),
        matches: [field.path, field.kind],
        lookup: `datapack search-schema ${version} --kind ${JSON.stringify(
          field.kind,
        )} --path ${JSON.stringify(field.path)} --limit 1`,
      });
    }
    const paths = filterVanillaPaths(readVanillaPathList(edition, version, "datapack"), {
      contains: discoveryTerm,
    });
    for (const path of paths.filter((entry) =>
      matchesDiscoveryQuery(query, entry, "datapack data pack path"),
    )) {
      addCrossResult(results, {
        surface: "vanilla-paths",
        domain: "datapack",
        kind: "path",
        title: path,
        score: scoreDiscoveryMatch(query, [path], ["datapack data pack path"]),
        matches: [path],
        lookup: `datapack vanilla-paths ${version} --prefix ${JSON.stringify(path)} --limit 1`,
      });
    }
  }

  if (include("resourcepack")) {
    const resourcepackPaths = readVanillaPathList(edition, version, "resourcepack");
    const paths = filterVanillaPaths(resourcepackPaths, {
      contains: discoveryTerm,
    });
    for (const path of paths.filter((entry) =>
      matchesDiscoveryQuery(query, entry, resourcepackDiscoveryTerms(entry)),
    )) {
      addCrossResult(results, {
        surface: "vanilla-paths",
        domain: "resourcepack",
        kind: "path",
        title: path,
        score: scoreDiscoveryMatch(query, [path], [resourcepackDiscoveryTerms(path)]),
        matches: [path],
        lookup: `resourcepack vanilla-paths ${version} --prefix ${JSON.stringify(path)} --limit 1`,
      });
    }
    const models = filterResourcepackModelPaths(resourcepackPaths, {
      contains: discoveryTerm,
    });
    for (const path of models.filter((entry) =>
      matchesDiscoveryQuery(query, entry, resourcepackDiscoveryTerms(entry)),
    )) {
      const kind = path.includes("/items/") ? "item-definition" : "model";
      addCrossResult(results, {
        surface: "resourcepack-models",
        domain: "resourcepack",
        kind,
        title: path,
        score: scoreDiscoveryMatch(query, [path], [resourcepackDiscoveryTerms(path)]) + 5,
        matches: [path],
        lookup: `resourcepack search-models ${version} --kind ${kind} --prefix ${JSON.stringify(
          path,
        )} --limit 1`,
      });
    }
    try {
      const assets = readMinecraftAssetsIndex(version).paths.filter(
        (entry) =>
          entry.includes(discoveryTerm) &&
          matchesDiscoveryQuery(query, entry, resourcepackDiscoveryTerms(entry)),
      );
      for (const path of assets) {
        addCrossResult(results, {
          surface: "minecraft-assets-cache",
          domain: "resourcepack",
          kind: "asset",
          title: path,
          score: scoreDiscoveryMatch(query, [path], [resourcepackDiscoveryTerms(path)]),
          matches: [path],
          lookup: `resourcepack assets search ${version} --prefix ${JSON.stringify(path)} --limit 1`,
        });
      }
    } catch (error) {
      gaps.push(
        `minecraft-assets cache is not searchable for ${version}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (include("paper-plugin")) {
    const surface = getPaperApiSurface(version);
    const types = surface.types.filter(
      (entry) =>
        (entry.name.toLowerCase().includes(discoveryTerm) ||
          entry.qualifiedName.toLowerCase().includes(discoveryTerm)) &&
        matchesDiscoveryQuery(query, entry.name, entry.qualifiedName, "paper plugin api type"),
    );
    for (const type of types) {
      addCrossResult(results, {
        surface: "paper-api-types",
        domain: "paper-plugin",
        kind: "type",
        title: type.qualifiedName,
        score: scoreDiscoveryMatch(
          query,
          [type.name, type.qualifiedName],
          ["paper plugin api type"],
        ),
        matches: [type.qualifiedName],
        lookup: `plugin paper types ${version} --contains ${JSON.stringify(
          type.qualifiedName,
        )} --limit 1`,
      });
    }
    const members = surface.members.filter(
      (entry) =>
        (entry.name.toLowerCase().includes(discoveryTerm) ||
          entry.label.toLowerCase().includes(discoveryTerm) ||
          entry.qualifiedTypeName.toLowerCase().includes(discoveryTerm)) &&
        matchesDiscoveryQuery(
          query,
          entry.name,
          entry.label,
          entry.qualifiedTypeName,
          "paper plugin api member",
        ),
    );
    for (const member of members) {
      addCrossResult(results, {
        surface: "paper-api-members",
        domain: "paper-plugin",
        kind: member.kind,
        title: `${member.qualifiedTypeName}.${member.name}`,
        score: scoreDiscoveryMatch(
          query,
          [member.name, member.label, member.qualifiedTypeName],
          ["paper plugin api member"],
        ),
        matches: [member.name, member.qualifiedTypeName],
        lookup: `plugin paper members ${version} --type ${JSON.stringify(
          member.qualifiedTypeName,
        )} --kind ${member.kind} --contains ${JSON.stringify(member.label)} --limit 1`,
      });
    }
  }

  const sorted = results.sort(
    (left, right) =>
      right.score - left.score ||
      left.domain.localeCompare(right.domain) ||
      left.surface.localeCompare(right.surface) ||
      left.title.localeCompare(right.title),
  );
  return {
    schemaVersion: 1,
    query,
    edition,
    version,
    ...(options.domain ? { domain: options.domain } : {}),
    limit,
    truncated: sourceTruncated || sorted.length > limit,
    results: sorted.slice(0, limit),
    gaps,
  };
}

function resourcepackKindFilters(kind: NonNullable<ResourcepackAssetFindOptions["kind"]>): {
  prefix?: string;
  extension?: string;
  modelKind?: "model" | "item-definition";
} {
  if (kind === "model") return { prefix: "assets/", extension: "json", modelKind: "model" };
  if (kind === "item-definition")
    return { prefix: "assets/", extension: "json", modelKind: "item-definition" };
  if (kind === "texture") return { prefix: "assets/", extension: "png" };
  if (kind === "sound") return { prefix: "assets/", extension: "ogg" };
  if (kind === "language") return { prefix: "assets/", extension: "json" };
  if (kind === "blockstate") return { prefix: "assets/", extension: "json" };
  if (kind === "atlas") return { prefix: "assets/", extension: "json" };
  if (kind === "font") return { prefix: "assets/", extension: "json" };
  return {};
}

export function findResourcepackAssets(
  options: ResourcepackAssetFindOptions,
): ResourcepackAssetFindResult {
  const query = options.query.trim();
  if (!query) throw new Error("findResourcepackAssets requires a non-empty query");
  const edition = Edition.assert(options.edition ?? "java");
  const version = resolveVersion(edition, options.version ?? "latest");
  const limit = normalizeLimit(options.limit, 25, 500);
  const kind = options.kind ?? "any";
  const filters = resourcepackKindFilters(kind);
  const discoveryTerm = primaryDiscoveryTerm(query);
  const sections: ResourcepackAssetFindResult["sections"] = [];
  const vanilla = filterVanillaPaths(readVanillaPathList(edition, version, "resourcepack"), {
    contains: discoveryTerm,
    ...(filters.prefix ? { prefix: filters.prefix } : {}),
    ...(filters.extension ? { extension: filters.extension } : {}),
  }).filter((path) => matchesDiscoveryQuery(query, path, resourcepackDiscoveryTerms(path)));
  sections.push({
    source: "vanilla-paths",
    total: vanilla.length,
    truncated: vanilla.length > limit,
    paths: vanilla.slice(0, limit),
  });
  const models = filterResourcepackModelPaths(
    readVanillaPathList(edition, version, "resourcepack"),
    {
      contains: discoveryTerm,
      ...(filters.prefix ? { prefix: filters.prefix } : {}),
      ...(filters.modelKind ? { kind: filters.modelKind } : {}),
    },
  ).filter((path) => matchesDiscoveryQuery(query, path, resourcepackDiscoveryTerms(path)));
  sections.push({
    source: "resourcepack-models",
    total: models.length,
    truncated: models.length > limit,
    paths: models.slice(0, limit),
  });
  try {
    const extension = filters.extension
      ? filters.extension.startsWith(".")
        ? filters.extension
        : `.${filters.extension}`
      : undefined;
    const paths = readMinecraftAssetsIndex(version).paths.filter(
      (path) =>
        (!filters.prefix || path.startsWith(filters.prefix)) &&
        path.includes(discoveryTerm) &&
        (!extension || path.endsWith(extension)) &&
        matchesDiscoveryQuery(query, path, resourcepackDiscoveryTerms(path)),
    );
    sections.push({
      source: "minecraft-assets-cache",
      total: paths.length,
      truncated: paths.length > limit,
      paths: paths.slice(0, limit),
    });
  } catch (error) {
    sections.push({
      source: "minecraft-assets-cache",
      total: 0,
      truncated: false,
      paths: [],
      note: `Cache index unavailable: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
  return { schemaVersion: 1, query, edition, version, kind, sections };
}

export function findDatapackEntries(options: DatapackEntryFindOptions): DatapackEntryFindResult {
  const query = options.query.trim();
  if (!query) throw new Error("findDatapackEntries requires a non-empty query");
  const edition = Edition.assert(options.edition ?? "java");
  const version = resolveVersion(edition, options.version ?? "latest");
  const limit = normalizeLimit(options.limit, 25, 500);
  const discoveryTerm = primaryDiscoveryTerm(query);
  const commands = filterCommandPaths(readCommandPathList(edition, version), {
    contains: discoveryTerm,
  }).filter((path) => matchesDiscoveryQuery(query, path, "datapack data pack command path"));
  const schema = flattenDatapackFields(getDatapackSchemaSurface(edition, version)).filter(
    (field) =>
      (field.kind.toLowerCase().includes(discoveryTerm) ||
        field.path.toLowerCase().includes(discoveryTerm)) &&
      matchesDiscoveryQuery(query, field.kind, field.path, "datapack data pack schema field"),
  );
  const paths = filterVanillaPaths(readVanillaPathList(edition, version, "datapack"), {
    contains: discoveryTerm,
  }).filter((path) => matchesDiscoveryQuery(query, path, "datapack data pack path"));
  return {
    schemaVersion: 1,
    query,
    edition,
    version,
    sections: [
      {
        source: "commands",
        total: commands.length,
        truncated: commands.length > limit,
        entries: commands.slice(0, limit),
        lookup: `datapack commands ${version}${discoveryContainsOption(discoveryTerm)}`,
      },
      {
        source: "datapack-schema",
        total: schema.length,
        truncated: schema.length > limit,
        entries: schema.slice(0, limit),
        lookup: `datapack search-schema ${version}${discoveryContainsOption(discoveryTerm)}`,
      },
      {
        source: "vanilla-paths",
        total: paths.length,
        truncated: paths.length > limit,
        entries: paths.slice(0, limit),
        lookup: `datapack vanilla-paths ${version}${discoveryContainsOption(discoveryTerm)}`,
      },
    ],
  };
}

const vanillaPathListCache = new Map<string, string[]>();

function readVanillaPathList(
  edition: EditionData,
  version: string,
  domain: VanillaPathDomain,
): string[] {
  const pathIndex = `${edition}/vanilla-paths/${version}.${domain}.txt`;
  const cached = vanillaPathListCache.get(pathIndex);
  if (cached) {
    return cached;
  }
  if (!hasDataFile(pathIndex)) {
    throw new Error(`No bundled vanilla path index for ${edition} ${version} ${domain}`);
  }
  const paths = readDataText(pathIndex).trim().split(/\r?\n/).filter(Boolean);
  vanillaPathListCache.set(pathIndex, paths);
  return paths;
}

function filterVanillaPaths(
  paths: string[],
  options: Pick<VanillaPathSearchOptions, "prefix" | "contains" | "extension">,
): string[] {
  const prefix = options.prefix?.trim();
  const contains = options.contains?.trim();
  const extension = options.extension?.trim();

  return paths.filter((path) => {
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
}

function comparePathLists(options: {
  from: string[];
  to: string[];
  limit: number;
}): Pick<
  VanillaPathComparisonResult,
  "addedTotal" | "removedTotal" | "truncated" | "added" | "removed"
> {
  const fromSet = new Set(options.from);
  const toSet = new Set(options.to);
  const added = options.to.filter((path) => !fromSet.has(path));
  const removed = options.from.filter((path) => !toSet.has(path));
  return {
    addedTotal: added.length,
    removedTotal: removed.length,
    truncated: added.length > options.limit || removed.length > options.limit,
    added: added.slice(0, options.limit),
    removed: removed.slice(0, options.limit),
  };
}

export function compareVanillaPaths(
  options: VanillaPathComparisonOptions,
): VanillaPathComparisonResult {
  const editionId = Edition.assert(options.edition ?? "java");
  const from = resolveVersion(editionId, options.from);
  const to = resolveVersion(editionId, options.to);
  const domain = options.domain ?? "datapack";
  const fromPaths = filterVanillaPaths(readVanillaPathList(editionId, from, domain), options);
  const toPaths = filterVanillaPaths(readVanillaPathList(editionId, to, domain), options);
  const limit = normalizeLimit(options.limit, 50, 500);
  const comparison = comparePathLists({ from: fromPaths, to: toPaths, limit });

  return {
    edition: editionId,
    from,
    to,
    domain,
    fromTotalPaths: fromPaths.length,
    toTotalPaths: toPaths.length,
    ...comparison,
  };
}

const registryEntryIndexHeader = "registry_id\tentry_id\tentry_protocol_id";
const registryEntryListCache = new Map<string, RegistryEntry[]>();

function readRegistryEntryList(
  edition: EditionData,
  reports: JavaReportsSummaryData,
): RegistryEntry[] {
  const path = reports.datapack.registryEntries.path;
  const cached = registryEntryListCache.get(path);
  if (cached) {
    return cached;
  }
  if (!hasDataFile(path)) {
    throw new Error(`No bundled registry entry index for ${edition} ${reports.version}`);
  }
  const normalized = readDataText(path).replaceAll("\r\n", "\n");
  const lines = normalized.endsWith("\n")
    ? normalized.slice(0, -1).split("\n")
    : normalized.split("\n");
  if (lines.shift() !== registryEntryIndexHeader) {
    throw new Error(`Invalid registry entry index header for ${edition} ${reports.version}`);
  }

  const entries: RegistryEntry[] = [];
  let previousKey: string | undefined;
  for (const line of lines) {
    if (!line) {
      throw new Error(
        `Invalid blank row in registry entry index for ${edition} ${reports.version}`,
      );
    }
    const columns = line.split("\t");
    if (columns.length !== 3) {
      throw new Error(`Invalid registry entry index row for ${edition} ${reports.version}`);
    }
    const [registryId, entryId, protocolText] = columns as [string, string, string];
    const protocolId = protocolText === "" ? null : Number(protocolText);
    if (
      !registryId ||
      !entryId ||
      (protocolId !== null && (!Number.isSafeInteger(protocolId) || protocolId < 0))
    ) {
      throw new Error(`Invalid registry entry index value for ${edition} ${reports.version}`);
    }
    const key = `${registryId}\t${entryId}`;
    if (previousKey !== undefined && previousKey >= key) {
      throw new Error(`Unsorted registry entry index for ${edition} ${reports.version}`);
    }
    previousKey = key;
    entries.push({ registryId, entryId, protocolId });
  }
  if (entries.length !== reports.datapack.registryEntries.entryCount) {
    throw new Error(`Registry entry index count mismatch for ${edition} ${reports.version}`);
  }
  registryEntryListCache.set(path, entries);
  return entries;
}

function registryEntryStatus(
  reports: JavaReportsSummaryData,
  registry: string | undefined,
): RegistryEntryStatus {
  if (!registry) {
    return "all";
  }
  const known = reports.datapack.registries.find((candidate) => candidate.id === registry);
  if (known) {
    return known.entryIndexStatus;
  }
  return reports.datapack.registryEntries.coverage === "official-report-unavailable"
    ? "official-report-unavailable"
    : "unknown";
}

function filterRegistryEntries(
  entries: RegistryEntry[],
  options: RegistryEntryFilter,
): RegistryEntry[] {
  const registry = options.registry?.trim();
  const exact = options.exact?.trim();
  const contains = options.contains?.trim();
  const prefix = options.prefix?.trim();
  return entries.filter((entry) => {
    if (registry && entry.registryId !== registry) {
      return false;
    }
    if (exact && entry.entryId !== exact) {
      return false;
    }
    if (prefix && !entry.entryId.startsWith(prefix)) {
      return false;
    }
    if (contains && !entry.entryId.includes(contains)) {
      return false;
    }
    return true;
  });
}

function registryEntryState(
  edition: EditionData,
  requested: string,
  filter: RegistryEntryFilter,
): {
  reports: JavaReportsSummaryData;
  registry: string | undefined;
  status: RegistryEntryStatus;
  scopedEntries: RegistryEntry[];
  entries: RegistryEntry[];
} {
  const reports = getJavaReportsSummary(edition, requested);
  const registry = filter.registry?.trim() || undefined;
  const status = registryEntryStatus(reports, registry);
  const allEntries = readRegistryEntryList(edition, reports);
  const scopedEntries = registry
    ? allEntries.filter((entry) => entry.registryId === registry)
    : allEntries;
  const { registry: _registry, ...entryFilters } = filter;
  return {
    reports,
    registry,
    status,
    scopedEntries,
    entries: filterRegistryEntries(scopedEntries, entryFilters),
  };
}

export function searchRegistryEntries(
  options: RegistryEntrySearchOptions = {},
): RegistryEntrySearchResult {
  const edition = Edition.assert(options.edition ?? "java");
  const limit = normalizeLimit(options.limit, 50, 500);
  const state = registryEntryState(edition, options.version ?? "latest", options);
  return {
    schemaVersion: 1,
    edition,
    version: state.reports.version,
    indexCoverage: state.reports.datapack.registryEntries,
    registryFilter: state.registry ?? null,
    registryStatus: state.status,
    totalEntries: state.scopedEntries.length,
    matchedEntries: state.entries.length,
    truncated: state.entries.length > limit,
    entries: state.entries.slice(0, limit),
  };
}

function registryEntryKey(entry: RegistryEntry): string {
  return `${entry.registryId}\t${entry.entryId}`;
}

export function compareRegistryEntries(
  options: RegistryEntryComparisonOptions,
): RegistryEntryComparisonResult {
  const edition = Edition.assert(options.edition ?? "java");
  const limit = normalizeLimit(options.limit, 50, 500);
  const from = registryEntryState(edition, options.from, options);
  const to = registryEntryState(edition, options.to, options);
  const registryFilter = from.registry ?? to.registry;
  const registryIds = registryFilter
    ? [registryFilter]
    : [
        ...new Set([
          ...from.reports.datapack.registries.map((registry) => registry.id),
          ...to.reports.datapack.registries.map((registry) => registry.id),
        ]),
      ].sort();
  const comparableRegistryIds = new Set<string>();
  const excludedRegistries: RegistryEntryComparisonExclusion[] = [];
  for (const registryId of registryIds) {
    const fromStatus = registryEntryStatus(from.reports, registryId);
    const toStatus = registryEntryStatus(to.reports, registryId);
    if (fromStatus === "indexed" && toStatus === "indexed") {
      comparableRegistryIds.add(registryId);
    } else {
      excludedRegistries.push({ registryId, from: fromStatus, to: toStatus });
    }
  }

  const comparableFromEntries = from.entries.filter((entry) =>
    comparableRegistryIds.has(entry.registryId),
  );
  const comparableToEntries = to.entries.filter((entry) =>
    comparableRegistryIds.has(entry.registryId),
  );
  const fromByKey = new Map(comparableFromEntries.map((entry) => [registryEntryKey(entry), entry]));
  const toByKey = new Map(comparableToEntries.map((entry) => [registryEntryKey(entry), entry]));
  const added = comparableToEntries.filter((entry) => !fromByKey.has(registryEntryKey(entry)));
  const removed = comparableFromEntries.filter((entry) => !toByKey.has(registryEntryKey(entry)));
  const changedProtocolIds = comparableToEntries.flatMap((entry) => {
    const previous = fromByKey.get(registryEntryKey(entry));
    if (!previous) {
      return [];
    }
    const change = compareObservedProtocolIds(previous.protocolId, entry.protocolId);
    if (!change) {
      return [];
    }
    return [
      {
        registryId: entry.registryId,
        entryId: entry.entryId,
        ...change,
      },
    ];
  });
  const outcome: RegistryEntryComparisonOutcome =
    comparableRegistryIds.size === 0
      ? "not-comparable"
      : excludedRegistries.length === 0
        ? "compared"
        : "partially-compared";
  return {
    schemaVersion: 1,
    edition,
    registryFilter: registryFilter ?? null,
    from: {
      version: from.reports.version,
      registryStatus: from.status,
      indexCoverage: from.reports.datapack.registryEntries,
      totalEntries: from.entries.length,
    },
    to: {
      version: to.reports.version,
      registryStatus: to.status,
      indexCoverage: to.reports.datapack.registryEntries,
      totalEntries: to.entries.length,
    },
    outcome,
    comparedRegistryCount: comparableRegistryIds.size,
    excludedRegistriesTotal: excludedRegistries.length,
    addedTotal: added.length,
    removedTotal: removed.length,
    changedProtocolIdsTotal: changedProtocolIds.length,
    truncated:
      excludedRegistries.length > limit ||
      added.length > limit ||
      removed.length > limit ||
      changedProtocolIds.length > limit,
    excludedRegistries: excludedRegistries.slice(0, limit),
    added: added.slice(0, limit),
    removed: removed.slice(0, limit),
    changedProtocolIds: changedProtocolIds.slice(0, limit),
    notes: [
      "Protocol ID changes are reported only when both versions expose numeric protocol IDs; null-to-number and number-to-null observations are not classified as changes.",
    ],
  };
}

export function searchCommands(options: CommandSearchOptions = {}): CommandSearchResult {
  const editionId = Edition.assert(options.edition ?? "java");
  const reports = getJavaReportsSummary(editionId, options.version ?? "latest");
  const paths = readCommandPathList(editionId, reports.version);
  const limit = normalizeLimit(options.limit, 50, 500);
  const matched = filterCommandPaths(paths, options);

  return {
    edition: editionId,
    version: reports.version,
    totalPaths: paths.length,
    matchedPaths: matched.length,
    truncated: matched.length > limit,
    paths: matched.slice(0, limit),
  };
}

function readCommandPathList(edition: EditionData, version: string): string[] {
  const pathIndex = `${edition}/command-paths/${version}.txt`;
  if (!hasDataFile(pathIndex)) {
    throw new Error(`No bundled command path index for ${edition} ${version}`);
  }
  return readDataText(pathIndex).trim().split(/\r?\n/).filter(Boolean);
}

function filterCommandPaths(
  paths: string[],
  options: Pick<CommandSearchOptions, "contains" | "prefix" | "parser">,
): string[] {
  const contains = options.contains?.trim();
  const prefix = options.prefix?.trim();
  const parser = options.parser?.trim();
  return paths.filter((path) => {
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
}

export function compareCommands(options: CommandComparisonOptions): CommandComparisonResult {
  const editionId = Edition.assert(options.edition ?? "java");
  const from = resolveVersion(editionId, options.from);
  const to = resolveVersion(editionId, options.to);
  const fromPaths = filterCommandPaths(readCommandPathList(editionId, from), options);
  const toPaths = filterCommandPaths(readCommandPathList(editionId, to), options);
  const limit = normalizeLimit(options.limit, 50, 500);
  const comparison = comparePathLists({ from: fromPaths, to: toPaths, limit });

  return {
    edition: editionId,
    from,
    to,
    fromTotalPaths: fromPaths.length,
    toTotalPaths: toPaths.length,
    ...comparison,
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function migrationPackFormatChanged(
  comparison: VersionComparison,
  domain: "datapack" | "resourcepack",
): boolean {
  return domain === "datapack"
    ? comparison.packFormats.data.changed
    : comparison.packFormats.resource.changed;
}

function migrationMinorPackFormatChanged(
  comparison: VersionComparison,
  domain: "datapack" | "resourcepack",
): boolean {
  return domain === "datapack"
    ? comparison.packFormats.dataMinor.changed
    : comparison.packFormats.resourceMinor.changed;
}

function migrationConsiderations(options: {
  domain: "datapack" | "resourcepack";
  comparison: VersionComparison;
  classification: PackFileClassificationResult;
  pathChanges: VanillaPathComparisonResult;
  schemaChanges: PackMigrationPlanResult["schemaChanges"];
}): string[] {
  const considerations: string[] = [];
  if (migrationPackFormatChanged(options.comparison, options.domain)) {
    considerations.push(
      options.domain === "datapack"
        ? "Update pack.mcmeta pack_format for data packs and verify data pack compatibility warnings in the target version."
        : "Update pack.mcmeta pack_format for resource packs and verify resource pack compatibility warnings in the target version.",
    );
  }
  if (migrationMinorPackFormatChanged(options.comparison, options.domain)) {
    considerations.push(
      "Review supported_formats/min_format/max_format handling if this pack declares version ranges.",
    );
  }
  if (options.pathChanges.addedTotal > 0 || options.pathChanges.removedTotal > 0) {
    considerations.push(
      "Compare vanilla paths for renamed, added, or removed files that custom content overrides or references.",
    );
  }
  if (options.schemaChanges.some((change) => change.addedTotal > 0 || change.removedTotal > 0)) {
    considerations.push(
      "Review observed JSON shape changes for schema-backed file kinds used by this pack.",
    );
  }
  if (options.classification.files.some((file) => file.domain === "unknown")) {
    considerations.push(
      "Some paths were not recognized as Java datapack/resourcepack files; review them manually before migration.",
    );
  }
  if (options.domain === "datapack") {
    considerations.push(
      "Run command and loot/advancement/predicate/function checks against the target version; observed schema surfaces are not normative validators.",
    );
  } else {
    considerations.push(
      "Review model, item definition, texture, atlas, font, and language files in-game; observed model surfaces are not normative validators.",
    );
  }
  return considerations;
}

export function getPackMigrationPlan(options: PackMigrationPlanOptions): PackMigrationPlanResult {
  const editionId = Edition.assert(options.edition ?? "java");
  const from = resolveVersion(editionId, options.from);
  const to = resolveVersion(editionId, options.to);
  const limit = normalizeLimit(options.limit, 50, 500);
  const classification = classifyPackFiles({
    paths: options.paths ?? [],
    domain: options.domain,
  });
  const versionComparison = compareVersions(editionId, from, to);
  const schemaLookups = classification.files
    .filter((file) => file.schemaAvailable)
    .slice(0, limit)
    .map((file) =>
      getPackFileSchema({
        edition: editionId,
        version: to,
        path: file.path,
        domain: options.domain,
      }),
    );
  const pathChanges = compareVanillaPaths({
    edition: editionId,
    from,
    to,
    domain: options.domain,
    limit,
  });
  const schemaKinds = uniqueStrings(
    classification.files
      .map((file) => file.schemaKind)
      .filter((kind): kind is string => {
        if (typeof kind !== "string") {
          return false;
        }
        if (options.domain === "resourcepack") {
          return kind === "model" || kind === "item-definition";
        }
        return !["function", "structure", "pack-metadata"].includes(kind);
      }),
  );
  const schemaChanges =
    options.domain === "datapack"
      ? schemaKinds.map((kind) => {
          const comparison = compareDatapackSchema({ edition: editionId, from, to, kind, limit });
          return {
            kind,
            addedTotal: comparison.addedTotal,
            removedTotal: comparison.removedTotal,
            truncated: comparison.truncated,
            added: comparison.added,
            removed: comparison.removed,
          };
        })
      : schemaKinds.map((kind) => {
          const fromSchema = getPackFileSchema({
            edition: editionId,
            version: from,
            domain: options.domain,
            path:
              kind === "item-definition"
                ? "assets/minecraft/items/example.json"
                : "assets/minecraft/models/item/example.json",
          });
          const toSchema = getPackFileSchema({
            edition: editionId,
            version: to,
            domain: options.domain,
            path:
              kind === "item-definition"
                ? "assets/minecraft/items/example.json"
                : "assets/minecraft/models/item/example.json",
          });
          const fromFields = new Set(fromSchema.observedFields.map((field) => field.path));
          const toFields = new Set(toSchema.observedFields.map((field) => field.path));
          const added = toSchema.observedFields
            .filter((field) => !fromFields.has(field.path))
            .map((field) => ({ kind, path: field.path }));
          const removed = fromSchema.observedFields
            .filter((field) => !toFields.has(field.path))
            .map((field) => ({ kind, path: field.path }));
          return {
            kind,
            addedTotal: added.length,
            removedTotal: removed.length,
            truncated: added.length > limit || removed.length > limit,
            added: added.slice(0, limit),
            removed: removed.slice(0, limit),
          };
        });
  const considerations = migrationConsiderations({
    domain: options.domain,
    comparison: versionComparison,
    classification,
    pathChanges,
    schemaChanges,
  });

  return {
    schemaVersion: 1,
    edition: editionId,
    domain: options.domain,
    from,
    to,
    summary: {
      packFormatChanged: migrationPackFormatChanged(versionComparison, options.domain),
      minorPackFormatChanged: migrationMinorPackFormatChanged(versionComparison, options.domain),
      domainCoverageChanged:
        versionComparison.domains[options.domain].from !==
        versionComparison.domains[options.domain].to,
      classifiedFiles: classification.classifiedFiles,
      schemaBackedFiles: schemaLookups.filter((lookup) => lookup.available).length,
    },
    versionComparison,
    fileClassification: classification,
    schemaLookups,
    pathChanges,
    schemaChanges,
    considerations,
    recommendedChecks:
      options.domain === "datapack"
        ? [
            "datapack classify-files",
            "datapack file-schema",
            "datapack compare-schema",
            "datapack compare-commands",
            "datapack compare-vanilla-paths",
          ]
        : [
            "resourcepack classify-files",
            "resourcepack file-schema",
            "resourcepack compare-vanilla-paths",
            "resourcepack search-models",
          ],
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

const modrinthPackSpecification =
  "https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack";
const modrinthPackEnvironmentValues = new Set(["required", "optional", "unsupported"]);
const modrinthPackOverrideRoots = new Set(["overrides", "server-overrides", "client-overrides"]);
export const modrinthPackOfficialDownloadHosts = Object.freeze([
  "cdn.modrinth.com",
  "github.com",
  "raw.githubusercontent.com",
  "gitlab.com",
] as const);
const modrinthPackOfficialDownloadHostSet = new Set<string>(modrinthPackOfficialDownloadHosts);
const windowsReservedPathSegment =
  /^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3])$/i;
const maxModrinthPackDiagnosticTextLength = 2_048;
const maxModrinthPackPathLength = 4_096;
const maxModrinthPackDownloadLength = 8_192;
const maxModrinthPackDownloadsPerFile = 64;
const maxModrinthPackMetadataTextLength = 4_096;
const maxModrinthPackDependencies = 256;
const maxModrinthPackAdditionalHosts = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || codePoint === 0x7f) {
      return true;
    }
  }
  return false;
}

function hasUnencodedUriCharacter(value: string): boolean {
  const illegalAscii = '<>"{}|\\^`';
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x20 || codePoint >= 0x7f || illegalAscii.includes(character)) {
      return true;
    }
  }
  return false;
}

function sortModrinthPackDiagnostics(
  diagnostics: ModrinthPackDiagnostic[],
): ModrinthPackDiagnostic[] {
  return diagnostics.sort(
    (left, right) =>
      (left.severity === right.severity ? 0 : left.severity === "error" ? -1 : 1) ||
      compareText(left.path, right.path) ||
      compareText(left.code, right.code) ||
      compareText(left.message, right.message),
  );
}

function normalizedModrinthPackLimit(
  value: unknown,
  fallback: number,
  minimum = 0,
  integer = true,
): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    (!integer || Number.isSafeInteger(value)) &&
    value >= minimum
    ? Math.min(value, fallback)
    : fallback;
}

function resolveModrinthPackValidationLimits(
  limits: Partial<ModrinthPackValidationLimits> | undefined,
): ModrinthPackValidationLimits {
  return {
    maxArchiveBytes: normalizedModrinthPackLimit(
      limits?.maxArchiveBytes,
      defaultModrinthPackValidationLimits.maxArchiveBytes,
      1,
    ),
    maxArchiveEntries: normalizedModrinthPackLimit(
      limits?.maxArchiveEntries,
      defaultModrinthPackValidationLimits.maxArchiveEntries,
      1,
    ),
    maxIndexBytes: normalizedModrinthPackLimit(
      limits?.maxIndexBytes,
      defaultModrinthPackValidationLimits.maxIndexBytes,
      1,
    ),
    maxEntryUncompressedBytes: normalizedModrinthPackLimit(
      limits?.maxEntryUncompressedBytes,
      defaultModrinthPackValidationLimits.maxEntryUncompressedBytes,
      1,
    ),
    maxTotalUncompressedBytes: normalizedModrinthPackLimit(
      limits?.maxTotalUncompressedBytes,
      defaultModrinthPackValidationLimits.maxTotalUncompressedBytes,
      1,
    ),
    maxCompressionRatio: normalizedModrinthPackLimit(
      limits?.maxCompressionRatio,
      defaultModrinthPackValidationLimits.maxCompressionRatio,
      1,
      false,
    ),
    maxDiagnostics: normalizedModrinthPackLimit(
      limits?.maxDiagnostics,
      defaultModrinthPackValidationLimits.maxDiagnostics,
      1,
    ),
  };
}

class ModrinthPackDiagnosticCollector {
  readonly limits: ModrinthPackValidationLimits;
  private readonly retained: ModrinthPackDiagnostic[] = [];
  errorCount = 0;
  warningCount = 0;

  constructor(limits: ModrinthPackValidationLimits) {
    this.limits = limits;
  }

  add(
    severity: ModrinthPackDiagnostic["severity"],
    code: string,
    path: string,
    message: string,
  ): void {
    if (severity === "error") {
      this.errorCount += 1;
    } else {
      this.warningCount += 1;
    }
    if (this.retained.length < this.limits.maxDiagnostics) {
      this.retained.push({
        severity,
        code,
        path: this.boundedText(path),
        message: this.boundedText(message),
      });
    }
  }

  private boundedText(value: string): string {
    return value.length <= maxModrinthPackDiagnosticTextLength
      ? value
      : `${value.slice(0, maxModrinthPackDiagnosticTextLength - 1)}\u2026`;
  }

  finish(): {
    diagnostics: ModrinthPackDiagnostic[];
    diagnosticsTruncated: boolean;
    omittedDiagnosticCount: number;
  } {
    const total = this.errorCount + this.warningCount;
    const retainedOriginalCount = this.retained.length;
    if (total > retainedOriginalCount) {
      return {
        diagnostics: sortModrinthPackDiagnostics(this.retained),
        diagnosticsTruncated: true,
        omittedDiagnosticCount: total - retainedOriginalCount,
      };
    }
    return {
      diagnostics: sortModrinthPackDiagnostics(this.retained),
      diagnosticsTruncated: false,
      omittedDiagnosticCount: 0,
    };
  }
}

function modrinthPackPathProblem(path: string, directory = false): string | null {
  if (!path) {
    return "Path must not be empty.";
  }
  if (path.length > maxModrinthPackPathLength) {
    return `Path must not exceed ${maxModrinthPackPathLength} characters.`;
  }
  if (hasControlCharacter(path)) {
    return "Path must not contain control characters.";
  }
  if (/^[A-Za-z]:/.test(path)) {
    return "Path must not start with a Windows drive name.";
  }
  if (path.startsWith("/") || path.startsWith("\\")) {
    return "Path must be relative to the Minecraft instance directory.";
  }
  if (path.includes("\\")) {
    return "Path must use forward slashes.";
  }

  const normalizedPath = directory && path.endsWith("/") ? path.slice(0, -1) : path;
  if (!normalizedPath) {
    return "Path must identify an entry below the archive root.";
  }
  if (!directory && path.endsWith("/")) {
    return "A file path must not end with a slash.";
  }
  const segments = normalizedPath.split("/");
  if (segments.some((segment) => segment === "..")) {
    return "Path must not contain a parent-directory segment (..).";
  }
  if (segments.some((segment) => segment === "." || segment === "")) {
    return "Path must be normalized without dot or empty segments.";
  }
  for (const segment of segments) {
    if (/[<>"|?*]/u.test(segment)) {
      return "Path segments must not contain characters forbidden by Windows filesystems.";
    }
    if (segment.includes(":")) {
      return "Path segments must not contain a colon or Windows alternate-data-stream name.";
    }
    if (/[. ]$/u.test(segment)) {
      return "Path segments must not end with a dot or space.";
    }
    const basename = (segment.split(".")[0] ?? "").replace(/[. ]+$/u, "");
    if (windowsReservedPathSegment.test(basename)) {
      return `Path segment is a reserved Windows device name: ${segment}`;
    }
  }
  return null;
}

function modrinthPackPathKey(path: string, directory = false): string {
  const pathWithoutSlash = directory && path.endsWith("/") ? path.slice(0, -1) : path;
  return pathWithoutSlash.normalize("NFC").toLowerCase().normalize("NFC");
}

function modrinthPackSortablePath(path: string): string {
  const boundedPath =
    path.length <= maxModrinthPackPathLength ? path : path.slice(0, maxModrinthPackPathLength);
  return boundedPath.normalize("NFC").toLowerCase().normalize("NFC");
}

function modrinthPackArchiveEntryPointer(path: string, position: number): string {
  return path.length <= maxModrinthPackPathLength
    ? `archive:${path}`
    : `archive:<entry-${position}-path-too-long>`;
}

function modrinthPackAncestorKeys(pathKey: string): string[] {
  const segments = pathKey.split("/");
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join("/"));
}

function modrinthPackDownloadProblem(download: string): { message: string | null; host: string } {
  if (!download) {
    return { message: "Download URL must not be empty.", host: "" };
  }
  if (download.length > maxModrinthPackDownloadLength) {
    return {
      message: `Download URL must not exceed ${maxModrinthPackDownloadLength} characters.`,
      host: "",
    };
  }
  if (hasUnencodedUriCharacter(download)) {
    return {
      message: "Download URL must be an RFC 3986 URI without spaces or other unencoded characters.",
      host: "",
    };
  }
  if (/%(?![0-9a-f]{2})/i.test(download)) {
    return { message: "Download URL must not contain malformed percent encoding.", host: "" };
  }
  try {
    const url = new URL(download);
    if (url.protocol !== "https:") {
      return { message: "Download URL must use HTTPS.", host: "" };
    }
    if (!url.hostname) {
      return { message: "Download URL must include a host.", host: "" };
    }
    if (url.username || url.password) {
      return { message: "Download URL must not contain credentials.", host: "" };
    }
    if (url.port) {
      return { message: "Download URL must use the standard HTTPS port.", host: "" };
    }
    return { message: null, host: url.hostname.toLowerCase().replace(/\.$/u, "") };
  } catch {
    return { message: "Download URL must be a valid absolute HTTPS URL.", host: "" };
  }
}

function modrinthPackResult(options: {
  collector: ModrinthPackDiagnosticCollector;
  index: ModrinthPackValidationResult["index"];
  archiveProvided: boolean;
  archiveEntries: number;
  overrideFiles: number;
  validationStrength: ModrinthPackValidationStrength;
}): ModrinthPackValidationResult {
  const diagnosticsResult = options.collector.finish();
  return {
    schemaVersion: 1,
    specification: modrinthPackSpecification,
    valid: options.collector.errorCount === 0,
    errorCount: options.collector.errorCount,
    warningCount: options.collector.warningCount,
    validationStrength: options.validationStrength,
    diagnosticsTruncated: diagnosticsResult.diagnosticsTruncated,
    omittedDiagnosticCount: diagnosticsResult.omittedDiagnosticCount,
    index: options.index,
    archive: {
      provided: options.archiveProvided,
      entries: options.archiveEntries,
      overrideFiles: options.overrideFiles,
    },
    diagnostics: diagnosticsResult.diagnostics,
  };
}

function normalizeAdditionalDownloadHost(host: unknown): string | null {
  if (typeof host !== "string" || !host || host.length > 253 || host.includes(":")) {
    return null;
  }
  try {
    const url = new URL(`https://${host}/`);
    if (
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.hostname.toLowerCase().replace(/\.$/u, "");
  } catch {
    return null;
  }
}

function findModrinthPackFileConflict(
  pathKey: string,
  files: Map<string, string>,
  descendants: Map<string, string>,
): string | undefined {
  const ancestor = modrinthPackAncestorKeys(pathKey)
    .map((key) => files.get(key))
    .find((value) => value !== undefined);
  return ancestor ?? descendants.get(pathKey);
}

function registerModrinthPackFile(
  pathKey: string,
  pointer: string,
  files: Map<string, string>,
  descendants: Map<string, string>,
): void {
  files.set(pathKey, pointer);
  registerModrinthPackDescendant(pathKey, pointer, descendants);
}

function registerModrinthPackDescendant(
  pathKey: string,
  pointer: string,
  descendants: Map<string, string>,
): void {
  for (const ancestor of modrinthPackAncestorKeys(pathKey)) {
    if (!descendants.has(ancestor)) {
      descendants.set(ancestor, pointer);
    }
  }
}

function boundedModrinthPackRecordKeys(
  record: Record<string, unknown>,
  limit: number,
): { keys: string[]; truncated: boolean } {
  const keys: string[] = [];
  let truncated = false;
  for (const key in record) {
    if (!Object.hasOwn(record, key)) {
      continue;
    }
    if (keys.length === limit) {
      truncated = true;
      break;
    }
    keys.push(key);
  }
  const decoratedKeys = keys.map((key, index) => ({
    key,
    index,
    sortKey:
      key.length <= maxModrinthPackPathLength ? key : key.slice(0, maxModrinthPackPathLength),
  }));
  decoratedKeys.sort(
    (left, right) => compareText(left.sortKey, right.sortKey) || left.index - right.index,
  );
  return { keys: decoratedKeys.map((entry) => entry.key), truncated };
}

type ModrinthPackInternalValidationOptions = {
  collector: ModrinthPackDiagnosticCollector;
  strength: ModrinthPackValidationStrength;
  skipIndexValidation?: boolean;
  archiveProvided?: boolean;
  archiveEntryCount?: number;
};

/**
 * Validates Modrinth pack index data and optional archive metadata without network access.
 * Archive paths are treated as untrusted input and checked before layer projection.
 */
export function validateModrinthPack(
  options: ModrinthPackValidationOptions,
): ModrinthPackValidationResult {
  const limits = resolveModrinthPackValidationLimits(options.limits);
  return validateModrinthPackInternal(options, {
    collector: new ModrinthPackDiagnosticCollector(limits),
    strength: options.archiveEntries === undefined ? "none" : "metadata",
  });
}

function validateModrinthPackInternal(
  options: ModrinthPackValidationOptions,
  internal: ModrinthPackInternalValidationOptions,
): ModrinthPackValidationResult {
  const { collector } = internal;
  const { limits } = collector;
  const add = collector.add.bind(collector);

  const additionalDownloadHosts = new Set<string>();
  if (options.additionalDownloadHosts !== undefined) {
    if (!Array.isArray(options.additionalDownloadHosts)) {
      add(
        "error",
        "validation.invalid-download-hosts",
        "options.additionalDownloadHosts",
        "additionalDownloadHosts must be an array of host names when present.",
      );
    } else {
      if (options.additionalDownloadHosts.length > maxModrinthPackAdditionalHosts) {
        add(
          "error",
          "validation.download-host-limit",
          "options.additionalDownloadHosts",
          `additionalDownloadHosts must not contain more than ${maxModrinthPackAdditionalHosts} entries.`,
        );
      }
      const boundedHosts = options.additionalDownloadHosts.slice(0, maxModrinthPackAdditionalHosts);
      for (const [index, host] of boundedHosts.entries()) {
        const normalizedHost = normalizeAdditionalDownloadHost(host);
        if (!normalizedHost) {
          add(
            "error",
            "validation.invalid-download-host",
            `options.additionalDownloadHosts/${index}`,
            "Additional download hosts must be bare host names without a scheme, port, or path.",
          );
        } else {
          additionalDownloadHosts.add(normalizedHost);
        }
      }
    }
  }

  let indexValue = options.index;
  let indexByteSize: number | undefined;
  let indexFailureAlreadyReported = internal.skipIndexValidation === true;
  if (typeof indexValue === "string") {
    indexByteSize = Buffer.byteLength(indexValue, "utf8");
    if (indexByteSize > limits.maxIndexBytes) {
      add(
        "error",
        "index.size-limit",
        "modrinth.index.json",
        `Index is ${indexByteSize} bytes; the configured limit is ${limits.maxIndexBytes}.`,
      );
      indexValue = null;
      indexFailureAlreadyReported = true;
    } else {
      try {
        indexValue = JSON.parse(indexValue.replace(/^\uFEFF/u, "")) as unknown;
      } catch {
        add("error", "index.invalid-json", "modrinth.index.json", "Index must contain valid JSON.");
        indexValue = null;
        indexFailureAlreadyReported = true;
      }
    }
  }

  const downloadedPaths = new Map<string, { pointer: string; raw: string }>();
  const downloadedFiles = new Map<string, string>();
  const downloadedDescendants = new Map<string, string>();
  let indexSummary: ModrinthPackValidationResult["index"] = null;
  if (internal.skipIndexValidation) {
    indexSummary = null;
  } else if (!isRecord(indexValue)) {
    if (!indexFailureAlreadyReported) {
      add("error", "index.invalid-type", "modrinth.index.json", "Index must be a JSON object.");
    }
  } else {
    const dependencyKeyResult = isRecord(indexValue.dependencies)
      ? boundedModrinthPackRecordKeys(indexValue.dependencies, maxModrinthPackDependencies)
      : { keys: [], truncated: false };
    const dependencyKeys = dependencyKeyResult.keys;
    indexSummary = {
      formatVersion: typeof indexValue.formatVersion === "number" ? indexValue.formatVersion : null,
      game: typeof indexValue.game === "string" ? indexValue.game : null,
      versionId:
        typeof indexValue.versionId === "string" &&
        indexValue.versionId.length <= maxModrinthPackMetadataTextLength
          ? indexValue.versionId
          : null,
      name:
        typeof indexValue.name === "string" &&
        indexValue.name.length <= maxModrinthPackMetadataTextLength
          ? indexValue.name
          : null,
      files: Array.isArray(indexValue.files) ? indexValue.files.length : 0,
      dependencies: dependencyKeys.map((dependency, index) =>
        dependency.length <= maxModrinthPackPathLength
          ? dependency
          : `<dependency-${index}-name-too-long>`,
      ),
    };

    if (dependencyKeyResult.truncated) {
      add(
        "error",
        "index.dependency-limit",
        "/dependencies",
        `dependencies exceeds the ${maxModrinthPackDependencies}-entry safety limit.`,
      );
    }

    if (indexValue.formatVersion !== 1) {
      add("error", "index.format-version", "/formatVersion", "formatVersion must be the number 1.");
    }
    if (indexValue.game !== "minecraft") {
      add("error", "index.game", "/game", 'game must be the string "minecraft".');
    }
    for (const [field, label] of [
      ["versionId", "versionId"],
      ["name", "name"],
    ] as const) {
      const value = indexValue[field];
      if (
        typeof value !== "string" ||
        value.length > maxModrinthPackMetadataTextLength ||
        !value.trim()
      ) {
        add(
          "error",
          `index.${field === "versionId" ? "version-id" : "name"}`,
          `/${field}`,
          `${label} must be a non-empty string no longer than ${maxModrinthPackMetadataTextLength} characters.`,
        );
      }
    }
    if (
      indexValue.summary !== undefined &&
      (typeof indexValue.summary !== "string" ||
        indexValue.summary.length > maxModrinthPackMetadataTextLength)
    ) {
      add(
        "error",
        "index.summary",
        "/summary",
        `summary must be a string no longer than ${maxModrinthPackMetadataTextLength} characters when present.`,
      );
    }

    if (!isRecord(indexValue.dependencies)) {
      add(
        "error",
        "index.dependencies",
        "/dependencies",
        "dependencies must be an object containing Minecraft and loader version strings.",
      );
    } else {
      if (
        typeof indexValue.dependencies.minecraft !== "string" ||
        indexValue.dependencies.minecraft.length > maxModrinthPackMetadataTextLength ||
        !indexValue.dependencies.minecraft.trim()
      ) {
        add(
          "error",
          "index.minecraft-dependency",
          "/dependencies/minecraft",
          `dependencies.minecraft must be a non-empty version string no longer than ${maxModrinthPackMetadataTextLength} characters.`,
        );
      }
      for (const dependency of dependencyKeys) {
        const value = indexValue.dependencies[dependency];
        const dependencyPointer =
          dependency.length <= maxModrinthPackPathLength
            ? `/dependencies/${dependency}`
            : "/dependencies/<name-too-long>";
        if (dependency.length > maxModrinthPackPathLength) {
          add(
            "error",
            "index.dependency-name-length",
            dependencyPointer,
            `Dependency identifiers must not exceed ${maxModrinthPackPathLength} characters.`,
          );
        }
        if (
          typeof value !== "string" ||
          value.length > maxModrinthPackMetadataTextLength ||
          !value.trim()
        ) {
          add(
            "error",
            "index.dependency-version",
            dependencyPointer,
            `Dependency versions must be non-empty strings no longer than ${maxModrinthPackMetadataTextLength} characters.`,
          );
        }
      }
    }

    if (!Array.isArray(indexValue.files)) {
      add("error", "index.files", "/files", "files must be an array.");
    } else {
      if (indexValue.files.length > limits.maxArchiveEntries) {
        add(
          "error",
          "index.file-limit",
          "/files",
          `files has ${indexValue.files.length} entries; the configured limit is ${limits.maxArchiveEntries}.`,
        );
      }
      const boundedFiles = indexValue.files.slice(0, limits.maxArchiveEntries);
      for (const [fileIndex, fileValue] of boundedFiles.entries()) {
        const pointer = `/files/${fileIndex}`;
        if (!isRecord(fileValue)) {
          add("error", "file.invalid-type", pointer, "Each file entry must be an object.");
          continue;
        }

        if (typeof fileValue.path !== "string") {
          add("error", "file.path", `${pointer}/path`, "File path must be a string.");
        } else {
          const pathProblem = modrinthPackPathProblem(fileValue.path);
          if (pathProblem) {
            add("error", "file.unsafe-path", `${pointer}/path`, pathProblem);
          } else {
            const pathKey = modrinthPackPathKey(fileValue.path);
            const previous = downloadedPaths.get(pathKey);
            if (previous) {
              add(
                "error",
                previous.raw === fileValue.path
                  ? "file.duplicate-path"
                  : "file.normalized-path-conflict",
                `${pointer}/path`,
                `File path conflicts with ${previous.pointer} after portable path normalization: ${fileValue.path}`,
              );
            } else {
              const conflictPointer = findModrinthPackFileConflict(
                pathKey,
                downloadedFiles,
                downloadedDescendants,
              );
              if (conflictPointer) {
                add(
                  "error",
                  "file.path-conflict",
                  `${pointer}/path`,
                  `File path has a file/directory conflict with ${conflictPointer}: ${fileValue.path}`,
                );
              }
              downloadedPaths.set(pathKey, { pointer: `${pointer}/path`, raw: fileValue.path });
              registerModrinthPackFile(
                pathKey,
                `${pointer}/path`,
                downloadedFiles,
                downloadedDescendants,
              );
            }
          }
        }

        if (!isRecord(fileValue.hashes)) {
          add("error", "file.hashes", `${pointer}/hashes`, "hashes must be an object.");
        } else {
          if (
            typeof fileValue.hashes.sha1 !== "string" ||
            fileValue.hashes.sha1.length !== 40 ||
            !/^[0-9a-f]{40}$/i.test(fileValue.hashes.sha1)
          ) {
            add(
              "error",
              "file.sha1",
              `${pointer}/hashes/sha1`,
              "SHA-1 must be a 40-character hexadecimal string.",
            );
          }
          if (
            typeof fileValue.hashes.sha512 !== "string" ||
            fileValue.hashes.sha512.length !== 128 ||
            !/^[0-9a-f]{128}$/i.test(fileValue.hashes.sha512)
          ) {
            add(
              "error",
              "file.sha512",
              `${pointer}/hashes/sha512`,
              "SHA-512 must be a 128-character hexadecimal string.",
            );
          }
        }

        if (!Array.isArray(fileValue.downloads) || fileValue.downloads.length === 0) {
          add(
            "error",
            "file.downloads",
            `${pointer}/downloads`,
            "downloads must be a non-empty array of HTTPS URLs.",
          );
        } else {
          if (fileValue.downloads.length > maxModrinthPackDownloadsPerFile) {
            add(
              "error",
              "file.download-limit",
              `${pointer}/downloads`,
              `downloads must not contain more than ${maxModrinthPackDownloadsPerFile} URLs.`,
            );
          }
          const downloads = new Set<string>();
          const boundedDownloads = fileValue.downloads.slice(0, maxModrinthPackDownloadsPerFile);
          for (const [downloadIndex, downloadValue] of boundedDownloads.entries()) {
            const downloadPointer = `${pointer}/downloads/${downloadIndex}`;
            if (typeof downloadValue !== "string") {
              add("error", "file.download", downloadPointer, "Download URL must be a string.");
              continue;
            }
            const downloadCheck = modrinthPackDownloadProblem(downloadValue);
            if (downloadCheck.message) {
              add("error", "file.download", downloadPointer, downloadCheck.message);
            } else if (!modrinthPackOfficialDownloadHostSet.has(downloadCheck.host)) {
              if (additionalDownloadHosts.has(downloadCheck.host)) {
                add(
                  "warning",
                  "file.unofficial-download-host",
                  downloadPointer,
                  `Download host ${downloadCheck.host} was explicitly allowed but is not in Modrinth's official four-host allowlist.`,
                );
              } else {
                add(
                  "error",
                  "file.download-host",
                  downloadPointer,
                  `Download host ${downloadCheck.host} is not allowed. Use an official host or explicitly add this exact host.`,
                );
              }
            }
            if (downloadValue.length > maxModrinthPackDownloadLength) {
              continue;
            }
            if (downloads.has(downloadValue)) {
              add(
                "warning",
                "file.duplicate-download",
                downloadPointer,
                "Download URL is duplicated within this file entry.",
              );
            }
            downloads.add(downloadValue);
          }
        }

        if (
          typeof fileValue.fileSize !== "number" ||
          !Number.isSafeInteger(fileValue.fileSize) ||
          fileValue.fileSize < 0
        ) {
          add(
            "error",
            "file.size",
            `${pointer}/fileSize`,
            "fileSize must be a non-negative safe integer.",
          );
        }

        if (fileValue.env !== undefined) {
          if (!isRecord(fileValue.env)) {
            add("error", "file.env", `${pointer}/env`, "env must be an object when present.");
          } else {
            for (const side of ["client", "server"] as const) {
              if (
                typeof fileValue.env[side] !== "string" ||
                fileValue.env[side].length > 16 ||
                !modrinthPackEnvironmentValues.has(fileValue.env[side])
              ) {
                add(
                  "error",
                  "file.env-side",
                  `${pointer}/env/${side}`,
                  `${side} must be required, optional, or unsupported.`,
                );
              }
            }
            if (fileValue.env.client === "unsupported" && fileValue.env.server === "unsupported") {
              add(
                "warning",
                "file.unused-environment",
                `${pointer}/env`,
                "File is unsupported on both client and server and will not be installed.",
              );
            }
          }
        }
      }
    }
  }

  const archiveEntries = options.archiveEntries;
  let overrideFiles = 0;
  if (archiveEntries !== undefined && !Array.isArray(archiveEntries)) {
    add(
      "error",
      "archive.invalid-entries",
      "archive",
      "archiveEntries must be an array when present.",
    );
  } else if (archiveEntries) {
    if (archiveEntries.length > limits.maxArchiveEntries) {
      add(
        "error",
        "archive.entry-limit",
        "archive",
        `Archive has ${archiveEntries.length} entries; the configured limit is ${limits.maxArchiveEntries}.`,
      );
      return modrinthPackResult({
        collector,
        index: indexSummary,
        archiveProvided: true,
        archiveEntries: archiveEntries.length,
        overrideFiles,
        validationStrength: internal.strength,
      });
    }

    const seenArchivePaths = new Map<
      string,
      { pointer: string; raw: string; directory: boolean }
    >();
    const archiveFiles = new Map<string, string>();
    const archiveDescendants = new Map<string, string>();
    const overrideTargets = new Map<
      string,
      Array<{ layer: string; path: string; directory: boolean }>
    >();
    const clientOverridePaths = {
      nodes: new Map<string, { path: string; directory: boolean }>(),
      files: new Map<string, string>(),
      descendants: new Map<string, string>(),
    };
    const serverOverridePaths = {
      nodes: new Map<string, { path: string; directory: boolean }>(),
      files: new Map<string, string>(),
      descendants: new Map<string, string>(),
    };
    let indexEntries = 0;
    let indexEntrySize: number | undefined;
    let totalUncompressedSize = 0;
    let totalLimitReported = false;

    const orderedEntries = archiveEntries
      .map((entry, position) => {
        const path = isRecord(entry) && typeof entry.path === "string" ? entry.path : "";
        const boundedPath =
          path.length <= maxModrinthPackPathLength
            ? path
            : path.slice(0, maxModrinthPackPathLength);
        return {
          entry,
          position,
          boundedPath,
          sortKey: modrinthPackSortablePath(boundedPath),
        };
      })
      .sort(
        (left, right) =>
          compareText(left.sortKey, right.sortKey) ||
          compareText(left.boundedPath, right.boundedPath) ||
          left.position - right.position,
      );
    for (const { entry, position } of orderedEntries) {
      if (!isRecord(entry) || typeof entry.path !== "string") {
        add(
          "error",
          "archive.invalid-entry",
          `archive:${position}`,
          "Each archive entry must be an object with a string path.",
        );
        continue;
      }
      const entryPointer = modrinthPackArchiveEntryPointer(entry.path, position);
      if (entry.directory !== undefined && typeof entry.directory !== "boolean") {
        add(
          "error",
          "archive.invalid-directory",
          entryPointer,
          "Archive entry directory must be a boolean when present.",
        );
      }
      const directory =
        typeof entry.directory === "boolean" ? entry.directory : entry.path.endsWith("/");
      const pathProblem = modrinthPackPathProblem(entry.path, directory);
      if (pathProblem) {
        add("error", "archive.unsafe-path", entryPointer, pathProblem);
        continue;
      }
      if (entry.size !== undefined && (!Number.isSafeInteger(entry.size) || entry.size < 0)) {
        add(
          "error",
          "archive.invalid-size",
          entryPointer,
          "Archive entry size must be a non-negative safe integer when present.",
        );
      }
      const validSize =
        typeof entry.size === "number" && Number.isSafeInteger(entry.size) && entry.size >= 0;
      if (validSize && entry.size !== undefined) {
        if (entry.size > limits.maxEntryUncompressedBytes) {
          add(
            "error",
            "archive.entry-size-limit",
            entryPointer,
            `Entry expands to ${entry.size} bytes; the configured per-entry limit is ${limits.maxEntryUncompressedBytes}.`,
          );
        }
        if (
          !totalLimitReported &&
          totalUncompressedSize > limits.maxTotalUncompressedBytes - entry.size
        ) {
          add(
            "error",
            "archive.total-size-limit",
            "archive",
            `Archive entries exceed the configured total uncompressed limit of ${limits.maxTotalUncompressedBytes} bytes.`,
          );
          totalLimitReported = true;
        } else if (!totalLimitReported) {
          totalUncompressedSize += entry.size;
        }
      }
      if (
        entry.compressedSize !== undefined &&
        (!Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0)
      ) {
        add(
          "error",
          "archive.invalid-compressed-size",
          entryPointer,
          "Compressed size must be a non-negative safe integer when present.",
        );
      }
      const validatedCompressedSize =
        typeof entry.compressedSize === "number" &&
        Number.isSafeInteger(entry.compressedSize) &&
        entry.compressedSize >= 0
          ? entry.compressedSize
          : undefined;
      if (
        validSize &&
        entry.size !== undefined &&
        validatedCompressedSize !== undefined &&
        (entry.size === 0
          ? 0
          : validatedCompressedSize === 0
            ? Number.POSITIVE_INFINITY
            : entry.size / validatedCompressedSize) > limits.maxCompressionRatio
      ) {
        add(
          "error",
          "archive.compression-ratio-limit",
          entryPointer,
          `Entry compression ratio exceeds the configured limit of ${limits.maxCompressionRatio}:1.`,
        );
      }
      if (
        entry.compressionMethod !== undefined &&
        (!Number.isSafeInteger(entry.compressionMethod) ||
          (entry.compressionMethod !== 0 && entry.compressionMethod !== 8))
      ) {
        add(
          "error",
          "archive.unsupported-compression",
          entryPointer,
          "compressionMethod must be ZIP stored (0) or deflate (8) when present.",
        );
      }
      if (
        entry.compressionMethod === 0 &&
        validSize &&
        entry.size !== undefined &&
        validatedCompressedSize !== undefined &&
        validatedCompressedSize !== entry.size
      ) {
        add(
          "error",
          "archive.stored-size-mismatch",
          entryPointer,
          "Stored ZIP entries must have equal compressed and uncompressed sizes.",
        );
      }
      if (
        entry.flags !== undefined &&
        (!Number.isSafeInteger(entry.flags) || entry.flags < 0 || entry.flags > 0xffff)
      ) {
        add("error", "archive.invalid-flags", entryPointer, "flags must be a 16-bit integer.");
      } else if (entry.flags !== undefined) {
        if ((entry.flags & 0x0041) !== 0) {
          add(
            "error",
            "archive.encrypted-entry",
            entryPointer,
            "Encrypted ZIP entries are not supported.",
          );
        }
        if ((entry.flags & ~(0x0041 | 0x080e)) !== 0) {
          add(
            "error",
            "archive.unsupported-flags",
            entryPointer,
            "ZIP entry uses unsupported general-purpose flags.",
          );
        }
        if (entry.compressionMethod === 0 && (entry.flags & 0x0006) !== 0) {
          add(
            "error",
            "archive.unsupported-flags",
            entryPointer,
            "Deflate compression-option flags cannot be used by a stored entry.",
          );
        }
      }
      if (
        entry.crc32 !== undefined &&
        (!Number.isSafeInteger(entry.crc32) || entry.crc32 < 0 || entry.crc32 > 0xffffffff)
      ) {
        add("error", "archive.invalid-crc32", entryPointer, "crc32 must be a 32-bit integer.");
      }
      if (
        entry.unixMode !== undefined &&
        (!Number.isSafeInteger(entry.unixMode) || entry.unixMode < 0 || entry.unixMode > 0xffff)
      ) {
        add(
          "error",
          "archive.invalid-unix-mode",
          entryPointer,
          "unixMode must be a 16-bit integer.",
        );
      } else if (entry.unixMode !== undefined) {
        const fileType = entry.unixMode & 0xf000;
        if (fileType !== 0 && fileType !== 0x4000 && fileType !== 0x8000) {
          add(
            "error",
            "archive.special-file",
            entryPointer,
            "Archive entries must be regular files or directories, not symlinks, devices, or other special files.",
          );
        } else if ((fileType === 0x4000) !== directory && fileType !== 0) {
          add(
            "error",
            "archive.unix-mode-mismatch",
            entryPointer,
            "Unix file type does not match the archive directory metadata.",
          );
        }
      }

      const pathWithoutSlash =
        directory && entry.path.endsWith("/") ? entry.path.slice(0, -1) : entry.path;
      const pathKey = modrinthPackPathKey(entry.path, directory);
      const previous = seenArchivePaths.get(pathKey);
      if (previous) {
        add(
          "error",
          previous.raw === pathWithoutSlash
            ? "archive.duplicate-path"
            : "archive.normalized-path-conflict",
          entryPointer,
          `Archive entry conflicts with ${previous.pointer} after portable path normalization.`,
        );
      } else {
        seenArchivePaths.set(pathKey, { pointer: entryPointer, raw: pathWithoutSlash, directory });
        const conflictPointer = directory
          ? modrinthPackAncestorKeys(pathKey)
              .map((key) => archiveFiles.get(key))
              .find((value) => value !== undefined)
          : findModrinthPackFileConflict(pathKey, archiveFiles, archiveDescendants);
        if (conflictPointer) {
          add(
            "error",
            "archive.path-conflict",
            entryPointer,
            `Archive path has a file/directory conflict with ${conflictPointer}.`,
          );
        }
        if (!directory) {
          registerModrinthPackFile(pathKey, entryPointer, archiveFiles, archiveDescendants);
        } else {
          registerModrinthPackDescendant(pathKey, entryPointer, archiveDescendants);
        }
      }

      if (pathWithoutSlash === "modrinth.index.json") {
        if (directory) {
          add(
            "error",
            "archive.index-directory",
            entryPointer,
            "modrinth.index.json must be a file at the archive root.",
          );
        } else {
          indexEntries += 1;
          indexEntrySize = entry.size;
          if (validSize && entry.size !== undefined && entry.size > limits.maxIndexBytes) {
            add(
              "error",
              "archive.index-size-limit",
              entryPointer,
              `Index entry is ${entry.size} bytes; the configured limit is ${limits.maxIndexBytes}.`,
            );
          }
        }
        continue;
      }

      const [root, ...targetSegments] = pathWithoutSlash.split("/");
      if (!root || !modrinthPackOverrideRoots.has(root)) {
        add(
          "warning",
          "archive.unrecognized-entry",
          entryPointer,
          "Entry is outside the standard override directories and is not installed by the .mrpack format.",
        );
        continue;
      }
      if (targetSegments.length === 0) {
        continue;
      }

      const target = targetSegments.join("/");
      const targetKey = modrinthPackPathKey(target);
      const targets = overrideTargets.get(targetKey) ?? [];
      targets.push({ layer: root, path: entryPointer, directory });
      overrideTargets.set(targetKey, targets);
      const applicableOverridePaths =
        root === "overrides"
          ? [clientOverridePaths, serverOverridePaths]
          : root === "client-overrides"
            ? [clientOverridePaths]
            : [serverOverridePaths];
      const typeConflictPointers = new Set<string>();
      const hierarchyConflictPointers = new Set<string>();
      for (const paths of applicableOverridePaths) {
        const previousNode = paths.nodes.get(targetKey);
        if (previousNode && previousNode.directory !== directory) {
          typeConflictPointers.add(previousNode.path);
        } else if (!previousNode) {
          paths.nodes.set(targetKey, { path: entryPointer, directory });
        }

        const conflictPointer = directory
          ? modrinthPackAncestorKeys(targetKey)
              .map((key) => paths.files.get(key))
              .find((value) => value !== undefined)
          : findModrinthPackFileConflict(targetKey, paths.files, paths.descendants);
        if (conflictPointer) {
          hierarchyConflictPointers.add(conflictPointer);
        }
        if (directory) {
          registerModrinthPackDescendant(targetKey, entryPointer, paths.descendants);
        } else if (!paths.files.has(targetKey)) {
          registerModrinthPackFile(targetKey, entryPointer, paths.files, paths.descendants);
        }
      }
      for (const conflictPointer of [...typeConflictPointers].sort(compareText)) {
        add(
          "error",
          "archive.override-path-conflict",
          entryPointer,
          `Projected override path changes between a file and directory at ${conflictPointer}.`,
        );
      }
      for (const conflictPointer of [...hierarchyConflictPointers].sort(compareText)) {
        add(
          "error",
          "archive.override-path-conflict",
          entryPointer,
          `Projected override path has a file/directory conflict with ${conflictPointer}.`,
        );
      }
      if (directory) {
        continue;
      }
      overrideFiles += 1;
    }

    if (indexEntries === 0) {
      add(
        "error",
        "archive.index-missing",
        "archive:modrinth.index.json",
        "Archive must contain modrinth.index.json at its root.",
      );
    } else if (indexEntries > 1) {
      add(
        "error",
        "archive.index-duplicate",
        "archive:modrinth.index.json",
        "Archive must contain exactly one root modrinth.index.json file.",
      );
    }
    if (
      indexEntries === 1 &&
      indexByteSize !== undefined &&
      indexEntrySize !== undefined &&
      indexByteSize !== indexEntrySize
    ) {
      add(
        "error",
        "archive.index-size-mismatch",
        "archive:modrinth.index.json",
        `Index JSON has ${indexByteSize} UTF-8 bytes but archive metadata reports ${indexEntrySize}.`,
      );
    }

    for (const [targetKey, targets] of [...overrideTargets].sort(([left], [right]) =>
      compareText(left, right),
    )) {
      const fileTargets = targets.filter((target) => !target.directory);
      const directoryTargets = targets.filter((target) => target.directory);
      const fileLayers = [...new Set(fileTargets.map((target) => target.layer))].sort(compareText);
      if (fileLayers.includes("overrides") && fileLayers.length > 1) {
        add(
          "warning",
          "archive.override-layer-conflict",
          targets[0]?.path ?? `archive:${targetKey}`,
          `Override layers ${fileLayers.join(", ")} target the same installed path; the environment-specific layer overwrites overrides/${targetKey}.`,
        );
      }
      const downloadedPath = downloadedPaths.get(targetKey);
      if (downloadedPath && directoryTargets.length > 0) {
        add(
          "error",
          "archive.download-override-path-conflict",
          targets[0]?.path ?? `archive:${targetKey}`,
          `Override directory conflicts with downloaded file ${downloadedPath.pointer}: ${targetKey}`,
        );
      } else if (downloadedPath && fileTargets.length > 0) {
        add(
          "warning",
          "archive.download-override-conflict",
          targets[0]?.path ?? `archive:${targetKey}`,
          `Override targets the same installed path as ${downloadedPath.pointer}: ${targetKey}`,
        );
      } else if (fileTargets.length > 0) {
        const downloadedConflict = findModrinthPackFileConflict(
          targetKey,
          downloadedFiles,
          downloadedDescendants,
        );
        if (downloadedConflict) {
          add(
            "error",
            "archive.download-override-path-conflict",
            targets[0]?.path ?? `archive:${targetKey}`,
            `Override path has a file/directory conflict with ${downloadedConflict}: ${targetKey}`,
          );
        }
      } else {
        const downloadedAncestor = modrinthPackAncestorKeys(targetKey)
          .map((key) => downloadedFiles.get(key))
          .find((value) => value !== undefined);
        if (downloadedAncestor) {
          add(
            "error",
            "archive.download-override-path-conflict",
            targets[0]?.path ?? `archive:${targetKey}`,
            `Override directory has a downloaded-file ancestor at ${downloadedAncestor}: ${targetKey}`,
          );
        }
      }
    }
  }

  return modrinthPackResult({
    collector,
    index: indexSummary,
    archiveProvided: internal.archiveProvided ?? archiveEntries !== undefined,
    archiveEntries:
      internal.archiveEntryCount ?? (Array.isArray(archiveEntries) ? archiveEntries.length : 0),
    overrideFiles,
    validationStrength: internal.strength,
  });
}

/** Reads and validates a local `.mrpack` archive without downloading referenced files. */
export function validateModrinthPackArchive(
  archive: Uint8Array,
  options: ModrinthPackArchiveValidationOptions = {},
): ModrinthPackValidationResult {
  const limits = resolveModrinthPackValidationLimits(options.limits);
  const collector = new ModrinthPackDiagnosticCollector(limits);
  const inspected = inspectModrinthArchive(archive, {
    limits,
    addDiagnostic: (diagnostic) => {
      const code =
        diagnostic.code === "archive.eocd-invalid" ||
        diagnostic.code === "archive.inspection-failed"
          ? "archive.invalid-zip"
          : diagnostic.code;
      collector.add(
        "error",
        code,
        diagnostic.path ? `archive:${diagnostic.path}` : "archive",
        diagnostic.message,
      );
    },
  });

  let index: string | undefined;
  if (inspected.indexBytes !== null) {
    try {
      index = new TextDecoder("utf-8", { fatal: true }).decode(inspected.indexBytes);
    } catch {
      collector.add(
        "error",
        "archive.index-encoding",
        "archive:modrinth.index.json",
        "modrinth.index.json must use valid UTF-8 encoding.",
      );
    }
  }

  return validateModrinthPackInternal(
    {
      index,
      ...(inspected.entriesAuthoritative
        ? {
            archiveEntries: inspected.entries.map((entry) => ({
              path: entry.path,
              directory: entry.directory,
            })),
          }
        : {}),
      ...(options.additionalDownloadHosts
        ? { additionalDownloadHosts: options.additionalDownloadHosts }
        : {}),
      limits,
    },
    {
      collector,
      strength: "binary",
      skipIndexValidation: index === undefined,
      archiveProvided: true,
      archiveEntryCount: inspected.entries.length,
    },
  );
}

const modrinthApiBaseUrl = "https://api.modrinth.com/v2/search";
const modrinthUserAgent = "sya-ri/minecraft-skills/0.1.5 (github.com/sya-ri/minecraft-skills)";

export function buildModrinthProjectSearchUrl(options: ModrinthProjectSearchOptions): string {
  const query = options.query.trim();
  if (!query) {
    throw new Error("Modrinth project search requires a query");
  }
  const limit = normalizeLimit(options.limit, 10, 100);
  const offset = options.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("Offset must be a non-negative integer");
  }

  const url = new URL(modrinthApiBaseUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("index", options.index ?? "relevance");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));

  const facets: string[][] = [];
  if (options.version) {
    facets.push([`versions:${options.version}`]);
  }
  if (options.projectType) {
    facets.push([`all_project_types:${options.projectType}`]);
  }
  if (options.loader) {
    facets.push([`categories:${options.loader}`]);
  }
  if (options.category) {
    facets.push([`categories:${options.category}`]);
  }
  if (facets.length > 0) {
    url.searchParams.set("facets", JSON.stringify(facets));
  }
  return url.toString();
}

export async function searchModrinthProjects(
  options: ModrinthProjectSearchOptions,
  fetchJson: FetchJson = fetch,
): Promise<unknown> {
  const url = buildModrinthProjectSearchUrl(options);
  const response = await fetchJson(url, {
    headers: { "User-Agent": modrinthUserAgent },
  });
  if (!response.ok) {
    throw new Error(`Modrinth project search failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export function buildModrinthProjectVersionsUrl(options: ModrinthProjectVersionsOptions): string {
  const project = options.project.trim();
  if (!project) {
    throw new Error("Modrinth project versions lookup requires a project ID or slug");
  }
  const url = new URL(`https://api.modrinth.com/v2/project/${encodeURIComponent(project)}/version`);
  if (options.gameVersions && options.gameVersions.length > 0) {
    url.searchParams.set("game_versions", JSON.stringify(options.gameVersions));
  }
  if (options.loaders && options.loaders.length > 0) {
    url.searchParams.set("loaders", JSON.stringify(options.loaders));
  }
  if (options.featured !== undefined) {
    url.searchParams.set("featured", String(options.featured));
  }
  url.searchParams.set("include_changelog", String(options.includeChangelog ?? false));
  return url.toString();
}

export async function listModrinthProjectVersions(
  options: ModrinthProjectVersionsOptions,
  fetchJson: FetchJson = fetch,
): Promise<unknown> {
  const url = buildModrinthProjectVersionsUrl(options);
  const response = await fetchJson(url, {
    headers: { "User-Agent": modrinthUserAgent },
  });
  if (!response.ok) {
    throw new Error(
      `Modrinth project versions lookup failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

const modrinthStaticResourcePaths: Partial<Record<ModrinthResourceKind, string>> = {
  categories: "tag/category",
  loaders: "tag/loader",
  "game-versions": "tag/game_version",
  "project-types": "tag/project_type",
  "side-types": "tag/side_type",
  "donation-platforms": "tag/donation_platform",
  "report-types": "tag/report_type",
  statistics: "statistics",
};

export function buildModrinthResourceUrl(options: ModrinthResourceOptions): string {
  const staticPath = modrinthStaticResourcePaths[options.resource];
  if (staticPath) {
    return `https://api.modrinth.com/v2/${staticPath}`;
  }
  const identifier = options.identifier?.trim();
  if (!identifier) {
    throw new Error(`Modrinth ${options.resource} lookup requires an identifier`);
  }
  const encoded = encodeURIComponent(identifier);
  const paths: Partial<Record<ModrinthResourceKind, string>> = {
    project: `project/${encoded}`,
    "project-dependencies": `project/${encoded}/dependencies`,
    version: `version/${encoded}`,
    "version-file": `version_file/${encoded}`,
    user: `user/${encoded}`,
  };
  const path = paths[options.resource];
  if (!path) {
    throw new Error(`Unsupported Modrinth resource: ${options.resource}`);
  }
  const url = new URL(`https://api.modrinth.com/v2/${path}`);
  if (options.resource === "version-file" && options.algorithm) {
    url.searchParams.set("algorithm", options.algorithm);
  }
  return url.toString();
}

export async function getModrinthResource(
  options: ModrinthResourceOptions,
  fetchJson: FetchJson = fetch,
): Promise<unknown> {
  const response = await fetchJson(buildModrinthResourceUrl(options), {
    headers: { "User-Agent": modrinthUserAgent },
  });
  if (!response.ok) {
    throw new Error(`Modrinth resource lookup failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
