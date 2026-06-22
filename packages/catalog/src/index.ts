import {
  type CachedDataFile,
  cleanCachedData,
  type DataManifest,
  type DataManifestEntry,
  type FetchDataOptions,
  type FetchDataResult,
  fetchData,
  getCacheDataRoot,
  getCacheRoot,
  getDataManifest,
  hasBundledDataFile,
  hasCachedDataFile,
  hasDataFile,
  listCachedDataFiles,
  readDataJson,
  readDataText,
} from "@minecraft-skills/data";
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
  CachedDataFile,
  CatalogData,
  ClaimPolicyData,
  ClaimPolicyIndexData,
  DataManifest,
  DataManifestEntry,
  DomainData,
  DomainIdData,
  EditionData,
  FactSurfaceData,
  FactSurfaceIndexData,
  FetchDataOptions,
  FetchDataResult,
  IntentLookupData,
  IntentLookupIndexData,
  IntentLookupStepData,
  JavaReportsSummaryData,
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
  ResponsePatternData,
  ResponsePatternIndexData,
  SkillData,
  VanillaInventoryData,
  VersionDetailData,
  VersionIndexData,
  VersionSummaryData,
};

export {
  cleanCachedData,
  fetchData,
  getCacheDataRoot,
  getCacheRoot,
  getDataManifest,
  listCachedDataFiles,
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

export type FactSurfaceQuery = {
  domain?: string;
};

export type AuthoringChecklistQuery = {
  domain?: string;
};

export type AuthoringRecipeQuery = {
  domain?: string;
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

export type AuthoringContextOptions = {
  domain: string;
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

export type AuthoringContext = {
  schemaVersion: 1;
  domain: DomainIdData;
  edition: EditionData;
  requestedVersion: string;
  resolvedVersion: string;
  preflight: AuthoringPreflight;
  recipes: AuthoringRecipeData[];
  guardrails: AuthoringGuardrailData[];
  diagnostics: AuthoringDiagnosticData[];
  claimPolicies: ClaimPolicyData[];
  outputRequirements: OutputRequirementData[];
  responsePatterns: ResponsePatternData[];
  intentLookups: IntentLookupData[];
  evidence: EvidenceBundle;
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
      `java/vanilla-inventories/${version.id}.json`,
      `java/vanilla-paths/${version.id}.datapack.txt`,
      `java/vanilla-paths/${version.id}.resourcepack.txt`,
      `java/resourcepack-models/${version.id}.json`,
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
      latestWithPaperApiSurface: paperApiSurfaces[0] ?? null,
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

export function getPaperApiSurface(requested = "latest"): PaperApiSurfaceData {
  const reference = getPaperApiReference(requested);
  if (!reference.supported) {
    throw new Error(
      `No bundled Paper API surface for ${reference.requestedVersion}; latest supported is ${reference.latestSupportedVersion}`,
    );
  }
  const path = `java/paper-api-surfaces/${reference.minecraftVersion}.json`;
  if (!hasDataFile(path)) {
    throw new Error(`No bundled Paper API surface for ${reference.minecraftVersion}`);
  }
  return PaperApiSurface.assert(readDataJson(path));
}

export function searchPaperTypes(options: PaperTypeSearchOptions = {}): PaperTypeSearchResult {
  const surface = getPaperApiSurface(options.version ?? "latest");
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
    types: matched.slice(0, limit),
  };
}

export function searchPaperMembers(
  options: PaperMemberSearchOptions = {},
): PaperMemberSearchResult {
  const surface = getPaperApiSurface(options.version ?? "latest");
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
    members: matched.slice(0, limit),
  };
}

function memberKey(entry: PaperApiMemberData): string {
  return `${entry.qualifiedTypeName}#${entry.label}`;
}

export function comparePaperApiSurface(
  fromRequested: string,
  toRequested: string,
): PaperApiSurfaceComparison {
  const from = getPaperApiSurface(fromRequested);
  const to = getPaperApiSurface(toRequested);
  const fromTypes = new Map(from.types.map((entry) => [entry.qualifiedName, entry]));
  const toTypes = new Map(to.types.map((entry) => [entry.qualifiedName, entry]));
  const fromMembers = new Map(from.members.map((entry) => [memberKey(entry), entry]));
  const toMembers = new Map(to.members.map((entry) => [memberKey(entry), entry]));
  const addedTypes = to.types.filter((entry) => !fromTypes.has(entry.qualifiedName));
  const removedTypes = from.types.filter((entry) => !toTypes.has(entry.qualifiedName));
  const addedMembers = to.members.filter((entry) => !fromMembers.has(memberKey(entry)));
  const removedMembers = from.members.filter((entry) => !toMembers.has(memberKey(entry)));

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

export function getVanillaInventory(edition = "java", requested = "latest"): VanillaInventoryData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  const inventoryPath = `${editionId}/vanilla-inventories/${version}.json`;
  if (!hasDataFile(inventoryPath)) {
    throw new Error(`No bundled vanilla inventory for ${editionId} ${version}`);
  }
  return VanillaInventory.assert(readDataJson(inventoryPath));
}

export function getDatapackSchemaSurface(
  edition = "java",
  requested = "latest",
): ObservedDatapackSchemaSurfaceData {
  const editionId = Edition.assert(edition);
  const version = resolveVersion(editionId, requested);
  const surfacePath = `${editionId}/datapack-schema-surfaces/${version}.json`;
  if (!hasDataFile(surfacePath)) {
    throw new Error(`No bundled observed datapack schema surface for ${editionId} ${version}`);
  }
  return ObservedDatapackSchemaSurface.assert(readDataJson(surfacePath));
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

function readVanillaPathList(
  edition: EditionData,
  version: string,
  domain: VanillaPathDomain,
): string[] {
  const pathIndex = `${edition}/vanilla-paths/${version}.${domain}.txt`;
  if (!hasDataFile(pathIndex)) {
    throw new Error(`No bundled vanilla path index for ${edition} ${version} ${domain}`);
  }
  return readDataText(pathIndex).trim().split(/\r?\n/).filter(Boolean);
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
