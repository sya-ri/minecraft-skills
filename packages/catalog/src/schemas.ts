import { type } from "arktype";

export const Source = type({
  id: "string",
  kind: "string",
  url: "string",
  "retrievedAt?": "string",
});

export const DomainId = type("'datapack' | 'resourcepack' | 'paper-plugin'");
export const Edition = type("'java'");

export const Domain = type({
  id: DomainId,
  skill: "string",
  title: "string",
  description: "string",
  status: "string",
  primarySources: Source.array(),
});

export const Reference = type({
  id: "string",
  domain: DomainId,
  title: "string",
  path: "string",
});

export const Skill = type({
  name: "string",
  domain: DomainId,
  path: "string",
  skillFile: "string",
  agentMetadata: "string",
  title: "string",
  description: "string",
});

export const SourceTier = type({
  id: "string",
  title: "string",
  useFor: "string[]",
  examples: "string[]",
  limits: "string[]",
});

export const CommunityDataset = type({
  id: "string",
  title: "string",
  url: "string",
  useFor: "string[]",
  limits: "string[]",
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
    minecraftWikiAutomation: "string",
    factPriority: "string[]",
    sourceTiers: SourceTier.array(),
    prohibitedAutomation: "string[]",
    recommendedCommunityDatasets: CommunityDataset.array(),
  },
  domains: Domain.array(),
  skills: Skill.array(),
  references: Reference.array(),
});

export const FactSurface = type({
  id: "string",
  domains: DomainId.array(),
  title: "string",
  dataKind: "string",
  coverage: "string",
  provenance: "string",
  guarantees: "string[]",
  nonGuarantees: "string[]",
  cli: "string[]",
  mcp: "string[]",
  packageApis: "string[]",
});

export const FactSurfaceIndex = type({
  schemaVersion: "1",
  generatedFrom: "string",
  surfaces: FactSurface.array(),
});

export const AuthoringChecklistToolRefs = type({
  cli: "string[]",
  mcp: "string[]",
  packageApis: "string[]",
});

export const AuthoringChecklistStep = type({
  id: "string",
  reason: "string",
  tools: AuthoringChecklistToolRefs,
  evidence: "string[]",
  failureMode: "string",
});

export const AuthoringChecklist = type({
  domain: DomainId,
  title: "string",
  steps: AuthoringChecklistStep.array(),
});

export const AuthoringChecklistIndex = type({
  schemaVersion: "1",
  generatedFrom: "string",
  checklists: AuthoringChecklist.array(),
});

export const AuthoringRecipeToolRefs = type({
  cli: "string[]",
  mcp: "string[]",
  packageApis: "string[]",
});

export const AuthoringRecipeStep = type({
  id: "string",
  action: "string",
  tools: AuthoringRecipeToolRefs,
  evidence: "string[]",
  stopIfMissing: "string",
});

export const AuthoringRecipe = type({
  id: "string",
  domains: DomainId.array(),
  title: "string",
  when: "string[]",
  steps: AuthoringRecipeStep.array(),
  finalChecks: "string[]",
  failureMode: "string",
});

export const AuthoringRecipeIndex = type({
  schemaVersion: "1",
  generatedFrom: "string",
  recipes: AuthoringRecipe.array(),
});

export const AuthoringScenarioLookups = type({
  recipes: "string[]",
  intents: "string[]",
  diagnostics: "string[]",
  claimPolicies: "string[]",
  factSurfaces: "string[]",
  responsePatterns: "string[]",
});

export const AuthoringScenario = type({
  id: "string",
  domains: DomainId.array(),
  title: "string",
  userPrompt: "string",
  useWhen: "string[]",
  requiredLookups: AuthoringScenarioLookups,
  successCriteria: "string[]",
  mustAvoid: "string[]",
  failureMode: "string",
});

export const AuthoringScenarioIndex = type({
  schemaVersion: "1",
  generatedFrom: "string",
  scenarios: AuthoringScenario.array(),
});

export const AuthoringGuardrail = type({
  id: "string",
  domains: DomainId.array(),
  title: "string",
  rules: "string[]",
  requiredEvidence: "string[]",
  failureMode: "string",
});

export const AuthoringGuardrailIndex = type({
  schemaVersion: "1",
  generatedFrom: "string",
  guardrails: AuthoringGuardrail.array(),
});

export const AuthoringDiagnosticToolRefs = type({
  cli: "string[]",
  mcp: "string[]",
  packageApis: "string[]",
});

export const AuthoringDiagnostic = type({
  id: "string",
  domains: DomainId.array(),
  title: "string",
  severity: "'error' | 'warning'",
  detectWhen: "string[]",
  requiredChecks: "string[]",
  evidence: "string[]",
  tools: AuthoringDiagnosticToolRefs,
  failIf: "string[]",
  safeResponse: "string[]",
  failureMode: "string",
});

export const AuthoringDiagnosticIndex = type({
  schemaVersion: "1",
  generatedFrom: "string",
  diagnostics: AuthoringDiagnostic.array(),
});

export const ClaimPolicyToolRefs = type({
  cli: "string[]",
  mcp: "string[]",
  packageApis: "string[]",
});

export const ClaimPolicy = type({
  id: "string",
  domains: DomainId.array(),
  claim: "string",
  requiredEvidence: "string[]",
  allowedWording: "string[]",
  disallowedWording: "string[]",
  tools: ClaimPolicyToolRefs,
  failureMode: "string",
});

export const ClaimPolicyIndex = type({
  schemaVersion: "1",
  generatedFrom: "string",
  policies: ClaimPolicy.array(),
});

export const OutputRequirement = type({
  id: "string",
  domains: DomainId.array(),
  title: "string",
  mustInclude: "string[]",
  includeWhenRelevant: "string[]",
  mustNotInclude: "string[]",
  failureMode: "string",
});

export const OutputRequirementIndex = type({
  schemaVersion: "1",
  generatedFrom: "string",
  requirements: OutputRequirement.array(),
});

export const ResponsePattern = type({
  id: "string",
  domains: DomainId.array(),
  title: "string",
  useWhen: "string[]",
  requiredSections: "string[]",
  evidenceStatements: "string[]",
  gapStatements: "string[]",
  mustAvoid: "string[]",
  failureMode: "string",
});

export const ResponsePatternIndex = type({
  schemaVersion: "1",
  generatedFrom: "string",
  patterns: ResponsePattern.array(),
});

export const IntentLookupToolRefs = type({
  cli: "string[]",
  mcp: "string[]",
  packageApis: "string[]",
});

export const IntentLookupStep = type({
  purpose: "string",
  tools: IntentLookupToolRefs,
  evidence: "string[]",
  failureMode: "string",
});

export const IntentLookup = type({
  id: "string",
  domains: DomainId.array(),
  title: "string",
  when: "string[]",
  lookups: IntentLookupStep.array(),
});

export const IntentLookupIndex = type({
  schemaVersion: "1",
  generatedFrom: "string",
  intents: IntentLookup.array(),
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
  versionBuilds: type({
    minecraftVersion: "string",
    latestBuild: "number",
    buildCount: "number",
  }).array(),
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

export const PaperApiPackage = type({
  name: "string",
  url: "string",
});

export const PaperApiIndex = type({
  schemaVersion: "1",
  projectId: "'paper'",
  minecraftVersion: "string",
  coverage: "'javadocs-package-index'",
  javadocsUrl: "string",
  packageCount: "number",
  packages: PaperApiPackage.array(),
  sources: Source.array(),
});

export const PaperApiType = type({
  packageName: "string",
  name: "string",
  qualifiedName: "string",
  url: "string",
});

export const PaperApiMember = type({
  packageName: "string",
  typeName: "string",
  qualifiedTypeName: "string",
  name: "string",
  label: "string",
  kind: "'constructor' | 'method' | 'field-or-enum-constant' | 'unknown'",
  url: "string",
});

export const PaperApiSurface = type({
  schemaVersion: "1",
  projectId: "'paper'",
  minecraftVersion: "string",
  coverage: "'javadocs-search-index'",
  javadocsUrl: "string",
  typeCount: "number",
  memberCount: "number",
  types: PaperApiType.array(),
  members: PaperApiMember.array(),
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

export const ObservedValueKindCount = type({
  kind: "'array' | 'boolean' | 'null' | 'number' | 'object' | 'string'",
  count: "number",
});

export const ObservedDatapackField = type({
  path: "string",
  count: "number",
  valueKinds: ObservedValueKindCount.array(),
  samples: "string[]",
});

export const ObservedDatapackKind = type({
  kind: "string",
  fileCount: "number",
  topLevelKeys: ObservedDatapackField.array(),
  fieldPaths: ObservedDatapackField.array(),
});

export const ObservedDatapackSchemaSurface = type({
  schemaVersion: "1",
  edition: "'java'",
  version: "string",
  coverage: "'vanilla-observed-datapack-json-shape'",
  notes: "string[]",
  kindCount: "number",
  fileCount: "number",
  kinds: ObservedDatapackKind.array(),
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
  entryIndexStatus: "'indexed' | 'unindexed'",
});

export const ReportRegistryEntryIndex = type({
  path: "string",
  coverage: "'official-report' | 'official-report-unavailable'",
  indexedRegistryCount: "number",
  unindexedRegistryCount: "number",
  entryCount: "number",
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
    registryEntries: ReportRegistryEntryIndex,
  },
  reports: ReportFile.array(),
  sources: Source.array(),
});

export type CatalogData = typeof Catalog.infer;
export type AuthoringChecklistData = typeof AuthoringChecklist.infer;
export type AuthoringChecklistIndexData = typeof AuthoringChecklistIndex.infer;
export type AuthoringChecklistStepData = typeof AuthoringChecklistStep.infer;
export type AuthoringRecipeData = typeof AuthoringRecipe.infer;
export type AuthoringRecipeIndexData = typeof AuthoringRecipeIndex.infer;
export type AuthoringRecipeStepData = typeof AuthoringRecipeStep.infer;
export type AuthoringScenarioData = typeof AuthoringScenario.infer;
export type AuthoringScenarioIndexData = typeof AuthoringScenarioIndex.infer;
export type AuthoringGuardrailData = typeof AuthoringGuardrail.infer;
export type AuthoringGuardrailIndexData = typeof AuthoringGuardrailIndex.infer;
export type AuthoringDiagnosticData = typeof AuthoringDiagnostic.infer;
export type AuthoringDiagnosticIndexData = typeof AuthoringDiagnosticIndex.infer;
export type ClaimPolicyData = typeof ClaimPolicy.infer;
export type ClaimPolicyIndexData = typeof ClaimPolicyIndex.infer;
export type OutputRequirementData = typeof OutputRequirement.infer;
export type OutputRequirementIndexData = typeof OutputRequirementIndex.infer;
export type ResponsePatternData = typeof ResponsePattern.infer;
export type ResponsePatternIndexData = typeof ResponsePatternIndex.infer;
export type IntentLookupData = typeof IntentLookup.infer;
export type IntentLookupIndexData = typeof IntentLookupIndex.infer;
export type IntentLookupStepData = typeof IntentLookupStep.infer;
export type FactSurfaceData = typeof FactSurface.infer;
export type FactSurfaceIndexData = typeof FactSurfaceIndex.infer;
export type DomainData = typeof Domain.infer;
export type SkillData = typeof Skill.infer;
export type ReferenceData = typeof Reference.infer;
export type VersionIndexData = typeof VersionIndex.infer;
export type VersionSummaryData = typeof VersionSummary.infer;
export type VersionDetailData = typeof VersionDetail.infer;
export type DomainCoverageData = typeof DomainCoverage.infer;
export type PaperPluginDataData = typeof PaperPluginData.infer;
export type PaperApiIndexData = typeof PaperApiIndex.infer;
export type PaperApiTypeData = typeof PaperApiType.infer;
export type PaperApiMemberData = typeof PaperApiMember.infer;
export type PaperApiSurfaceData = typeof PaperApiSurface.infer;
export type VanillaInventoryData = typeof VanillaInventory.infer;
export type ObservedDatapackSchemaSurfaceData = typeof ObservedDatapackSchemaSurface.infer;
export type ResourcepackModelSummaryData = typeof ResourcepackModelSummary.infer;
export type JavaReportsSummaryData = typeof JavaReportsSummary.infer;
export type DomainIdData = typeof DomainId.infer;
export type EditionData = typeof Edition.infer;
