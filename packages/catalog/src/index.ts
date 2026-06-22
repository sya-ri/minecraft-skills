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
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
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
  hasBundledDataFile,
  hasCachedDataFile,
  hasDataFile,
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
  const scenarios = listAuthoringScenarios(domain ? { domain } : {});
  const scored = scenarios
    .map((scenario) => {
      let score = 0;
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

function pathExtension(path: string): string | null {
  const file = path.split("/").at(-1) ?? "";
  const dot = file.lastIndexOf(".");
  return dot === -1 ? null : file.slice(dot + 1).toLowerCase();
}

function normalizePackPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "");
}

function classifyDatapackPath(path: string): PackFileClassification | undefined {
  const normalized = normalizePackPath(path);
  if (normalized === "pack.mcmeta") {
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

function objectSchema(properties: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: true,
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

function packMetadataJsonSchema(domain: "datapack" | "resourcepack", packFormat: number | null) {
  return objectSchema({
    pack: {
      type: "object",
      required: ["pack_format", "description"],
      additionalProperties: true,
      properties: {
        pack_format: packFormat === null ? { type: "integer" } : { const: packFormat },
        supported_formats: {
          oneOf: [
            { type: "integer" },
            {
              type: "object",
              additionalProperties: true,
              properties: {
                min_inclusive: { type: "integer" },
                max_inclusive: { type: "integer" },
              },
            },
          ],
        },
        description: {},
      },
    },
    ...(domain === "resourcepack"
      ? {
          overlays: {
            type: "object",
            additionalProperties: true,
            properties: {
              entries: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: true,
                  properties: {
                    directory: { type: "string" },
                    formats: {},
                  },
                },
              },
            },
          },
        }
      : {}),
  });
}

function staticPackFileJsonSchema(options: {
  file: PackFileClassification;
  version: string;
  packFormat: number | null;
}): Record<string, unknown> | null {
  const { file } = options;
  if (
    file.schemaKind === "pack-metadata" &&
    (file.domain === "datapack" || file.domain === "resourcepack")
  ) {
    return packMetadataJsonSchema(file.domain, options.packFormat);
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
                  additionalProperties: true,
                  properties: {
                    name: { type: "string" },
                    type: { type: "string" },
                    volume: { type: "number" },
                    pitch: { type: "number" },
                    weight: { type: "integer" },
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
          note: "This identifies the asset file format only; minecraft-skills does not validate audio codec details.",
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
  packFormat: number | null;
}): PackFileSchemaResult {
  const jsonSchema = staticPackFileJsonSchema({
    file: options.file,
    version: options.version,
    packFormat: options.packFormat,
  });
  return {
    schemaVersion: 1,
    edition: options.edition,
    version: options.version,
    file: options.file,
    available: jsonSchema !== null,
    normative: false,
    coverage: jsonSchema ? "known-pack-file-format" : null,
    notes: jsonSchema
      ? [
          "This schema describes the known file container/shape only.",
          "It is not a complete normative Minecraft validation schema.",
          "Use observedFields when present for vanilla-observed shape evidence.",
        ]
      : ["No schema is available for this file kind."],
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
  const normalized = normalizePackPath(file.path);
  const parts = normalized.split("/");
  if (file.kind === "pack-metadata") {
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

  if (file.kind === "pack-metadata") {
    return staticPackFileSchema({ edition: editionId, version, file, packFormat });
  }

  if (file.domain === "datapack") {
    const surface = getDatapackSchemaSurface(editionId, version);
    const kind = surface.kinds.find((entry) => entry.kind === file.schemaKind);
    if (!kind) {
      if (file.kind === "function" || file.kind === "structure") {
        return staticPackFileSchema({ edition: editionId, version, file, packFormat });
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
      return staticPackFileSchema({ edition: editionId, version, file, packFormat });
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
    return {
      ...base,
      validated: false,
      valid: false,
      contentKind: "unknown",
      notes: [
        ...notes,
        "Content was not validated because no version-compatible schema is available.",
      ],
      issues: [
        validationIssue({
          path: options.path,
          message: "No version-compatible schema is available for this file.",
          keyword: "schema-unavailable",
        }),
      ],
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

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  const validate = ajv.compile(schema.jsonSchema);
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
