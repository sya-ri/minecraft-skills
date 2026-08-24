# @minecraft-skills/catalog

ArkType-validated read APIs for the bundled Minecraft Skills data package.

## Install

```sh
pnpm add @minecraft-skills/catalog
```

Node.js 22.12 or newer is required.

## Examples

```ts
import {
  compareCommands,
  compareDatapackSchema,
  comparePaperApi,
  comparePaperApiSurface,
  compareRegistryEntries,
  compareVanillaPaths,
  explainPackPath,
  fetchData,
  fetchMinecraftAssetFile,
  fetchMinecraftAssetsIndex,
  findDatapackEntries,
  findResourcepackAssets,
  getAuthoringChecklist,
  getAuthoringContext,
  getAuthoringDiagnostic,
  getAuthoringGuardrail,
  getAuthoringPlan,
  getAuthoringPreflight,
  getAuthoringRecipe,
  getAuthoringScenario,
  getClaimPolicy,
  getCoverageSummary,
  getDataManifest,
  getDatapackSchemaSurface,
  getEvidenceBundle,
  getFactSurface,
  getFabricToolchainCompatibility,
  getIntentLookup,
  getJavaReportsSummary,
  getModrinthResource,
  getMinecraftAssetsStatus,
  getPackFormat,
  getOutputRequirement,
  getPaperApiIndex,
  getPaperApiReference,
  getPaperApiSurface,
  getPaperPluginData,
  getResourcepackModelSummary,
  getResponsePattern,
  getSkillPayload,
  getSourceReport,
  getSupportMatrix,
  getVersionDetail,
  listAuthoringChecklists,
  listAuthoringDiagnostics,
  listAuthoringGuardrails,
  listAuthoringRecipes,
  listAuthoringScenarios,
  listClaimPolicies,
  listCommunityDatasets,
  listSkills,
  listSourceTiers,
  listVersionSupport,
  listFactSurfaces,
  listIntentLookups,
  listModrinthProjectVersions,
  listOutputRequirements,
  listResponsePatterns,
  findVersionsByPackFormat,
  resolveModrinthCompatibility,
  searchAuthoringScenarios,
  searchAll,
  searchCommands,
  searchDatapackSchema,
  searchMinecraftAssets,
  searchModrinthProjects,
  searchPaperMembers,
  searchPaperTypes,
  searchResourcepackModelPaths,
  searchRegistryEntries,
  searchVanillaDatapackJsonContent,
  searchVanillaPaths,
  suggestMinecraftLookups,
  validateResourcepackProject,
  validateModrinthPack,
  validateModrinthPackArchive,
} from "@minecraft-skills/catalog";

const version = getVersionDetail("java", "26.2");
const skills = listSkills();
const paperSkill = getSkillPayload("minecraft-paper-plugins");
const checklist = getAuthoringChecklist("paper-plugin");
const context = getAuthoringContext({ domain: "paper-plugin", version: "26.2" });
const plan = getAuthoringPlan({ scenario: "paper-event-listener-review", version: "26.2" });
const inventoryPlan = getAuthoringPlan({
  scenario: "paper-inventory-gui-interaction-review",
  version: "26.2",
});
const preflight = getAuthoringPreflight({ domain: "paper-plugin", version: "26.2" });
const evidence = getEvidenceBundle({ domain: "paper-plugin", version: "26.2" });
const checklists = listAuthoringChecklists();
const recipes = listAuthoringRecipes({ domain: "paper-plugin" });
const listenerRecipe = getAuthoringRecipe("paper-event-listener");
const itemDeliveryRecipe = getAuthoringRecipe("paper-safe-item-delivery");
const inventoryRecipe = getAuthoringRecipe("paper-inventory-gui-interactions");
const scenarios = listAuthoringScenarios({ domain: "paper-plugin" });
const scenarioMatches = searchAuthoringScenarios({
  query: "Paper event listener",
  domain: "paper-plugin",
});
const listenerScenario = getAuthoringScenario("paper-event-listener-review");
const itemDeliveryScenario = getAuthoringScenario("paper-item-delivery-review");
const inventoryScenario = getAuthoringScenario("paper-inventory-gui-interaction-review");
const guardrails = listAuthoringGuardrails({ domain: "paper-plugin" });
const paperApiGuardrail = getAuthoringGuardrail("paper-api-surface-limits");
const itemDeliveryGuardrail = getAuthoringGuardrail("paper-inventory-delivery-outcomes");
const diagnostics = listAuthoringDiagnostics({ domain: "paper-plugin" });
const apiDiagnostic = getAuthoringDiagnostic("paper-api-member-unverified");
const itemDeliveryDiagnostic = getAuthoringDiagnostic("paper-inventory-leftovers-unhandled");
const claimPolicies = listClaimPolicies({ domain: "paper-plugin" });
const memberClaimPolicy = getClaimPolicy("paper-type-or-member-exists");
const outputRequirements = listOutputRequirements({ domain: "paper-plugin" });
const paperOutputRequirement = getOutputRequirement("paper-plugin-output-safety");
const responsePatterns = listResponsePatterns({ domain: "paper-plugin" });
const paperApiAnswer = getResponsePattern("paper-api-answer");
const factSurfaces = listFactSurfaces({ domain: "paper-plugin" });
const apiSurfacePolicy = getFactSurface("paper-api-surface");
const intentLookups = listIntentLookups({ domain: "paper-plugin" });
const memberLookup = getIntentLookup("verify-paper-type-or-member");
const coverage = getCoverageSummary();
const support = getSupportMatrix();
const versionSupport = listVersionSupport({ domain: "paper-plugin" });
const manifest = getDataManifest();
await fetchData({ kind: "paper-api-surface", version: "26.2" });
const reports = getJavaReportsSummary("java", "26.2");
const packFormat = getPackFormat("java", "26.2", "datapack");
const packFormatVersions = findVersionsByPackFormat({
  domain: "resourcepack",
  format: 88,
});
const assetStatus = getMinecraftAssetsStatus("26.2");
await fetchMinecraftAssetsIndex({ version: "26.2" });
const assetPaths = searchMinecraftAssets({ version: "26.2", contains: "diamond_sword" });
const assetFile = await fetchMinecraftAssetFile({
  version: "26.2",
  path: "assets/minecraft/models/item/diamond_sword.json",
});
const anyMinecraftMatches = searchAll({ version: "26.2", query: "bundle item model" });
const fabricToolchain = await getFabricToolchainCompatibility({
  gameVersion: "1.21.11",
  limit: 10,
});
const modrinthProjects = await searchModrinthProjects({
  query: "voice chat",
  version: "1.21.11",
  projectType: "mod",
  loader: "fabric",
});
const modrinthVersions = await listModrinthProjectVersions({
  project: "simple-voice-chat",
  gameVersions: ["1.21.11"],
  loaders: ["fabric"],
});
const modrinthCompatibility = await resolveModrinthCompatibility({
  projects: ["sodium", "iris"],
  gameVersion: "1.21.11",
  loader: "fabric",
});
// Project IDs/slugs are canonicalized before version filters. Common pairs describe
// published metadata and do not guarantee runtime interoperability.
const modrinthProject = await getModrinthResource({
  resource: "project",
  identifier: "simple-voice-chat",
});
const modrinthPack = validateModrinthPack({
  index: {
    formatVersion: 1,
    game: "minecraft",
    versionId: "example-1.0.0",
    name: "Example",
    files: [],
    dependencies: { minecraft: "1.21.11" },
  },
  archiveEntries: [{ path: "modrinth.index.json" }],
});
const datapackEntries = findDatapackEntries({ version: "26.2", query: "execute" });
const resourcepackAssets = findResourcepackAssets({
  version: "26.2",
  query: "diamond sword",
  kind: "item-definition",
});
const pathExplanation = explainPackPath({
  version: "26.2",
  path: "assets/example/items/widget.json",
  domain: "resourcepack",
});
const lookupSuggestions = suggestMinecraftLookups({
  version: "26.2",
  task: "migrate resource pack item model",
  domain: "resourcepack",
});
const inventoryLookupSuggestions = suggestMinecraftLookups({
  version: "1.21.11",
  task: "inventory GUI shift-click drag",
  domain: "paper-plugin",
});
const commands = searchCommands({ version: "26.2", prefix: "execute", limit: 10 });
const commandDiff = compareCommands({ from: "1.20.6", to: "1.21", prefix: "attribute" });
const registryEntries = searchRegistryEntries({
  version: "26.2",
  registry: "minecraft:item",
  exact: "minecraft:stone",
});
const registryEntryDiff = compareRegistryEntries({
  from: "26.1.2",
  to: "26.2",
  registry: "minecraft:block",
});
// changedProtocolIds requires numeric IDs on both sides; null observations are not changes.
// Also includes added, removed, and bounded excludedRegistries coverage statuses.
const datapackSchema = getDatapackSchemaSurface("java", "26.2");
const advancementFields = searchDatapackSchema({
  version: "26.2",
  kind: "advancement",
  contains: "criteria",
});
const datapackSchemaDiff = compareDatapackSchema({ from: "26.2", to: "26.2" });
const models = getResourcepackModelSummary("java", "26.2");
const bundles = searchResourcepackModelPaths({
  version: "26.2",
  kind: "item-definition",
  contains: "bundle",
});
const resourcepackProject = validateResourcepackProject({
  version: "26.2",
  files: [
    {
      path: "assets/example/items/widget.json",
      content: { model: { type: "minecraft:model", model: "example:item/widget" } },
    },
    {
      path: "assets/example/models/item/widget.json",
      content: { parent: "minecraft:item/generated" },
    },
  ],
});
// Add assets/<namespace>/sounds.json as JSON content and local .ogg files as Uint8Array content.
// Supply at most the first 58 bytes needed for the Ogg/Vorbis identification page. Larger binary
// inputs are rejected before project processing. `limits` may lower (but never raise) the published
// file, path, content-node, content-size, model-graph-work, sound-event, and sound-entry ceilings.
// Results distinguish input `totalFiles` from `processedFiles`, expose `validationComplete` and
// sound-specific incomplete reasons, echo `appliedLimits`, and report exact retained/omitted
// diagnostic counts without retaining an unbounded diagnostic array.
const paths = searchVanillaPaths({
  version: "26.2",
  domain: "datapack",
  contains: "recipe",
});
const vanillaRecipeMatches = searchVanillaDatapackJsonContent({
  version: "26.2",
  query: "minecraft:diamond",
  kind: "recipe",
  scope: "values",
});
const pathDiff = compareVanillaPaths({
  from: "1.20.6",
  to: "1.21",
  domain: "resourcepack",
  prefix: "assets/minecraft/models/item/",
});
const paperApi = getPaperApiReference("26.2");
const paperApiIndex = getPaperApiIndex("26.2");
const paperApiDiff = comparePaperApi("1.20.4", "26.2");
const paperSurface = getPaperApiSurface("26.2");
const paperTypes = searchPaperTypes({ version: "26.2", contains: "Player" });
const paperMembers = searchPaperMembers({
  version: "26.2",
  type: "org.bukkit.entity.Player",
  contains: "sendMessage",
});
const paperSurfaceDiff = comparePaperApiSurface("26.2", "26.2");
const paper = getPaperPluginData();
const sources = getSourceReport({ domain: "datapack", version: "26.2" });
const sourceTiers = listSourceTiers();
const communityDatasets = listCommunityDatasets();
```

`validateModrinthPack` is a pure, offline validator for parsed index JSON plus optional archive
entry metadata. `validateModrinthPackArchive` accepts local `.mrpack` bytes; neither function
downloads or resolves files listed by the pack. Validation follows the
[official Modrinth pack format](https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack).

The result reports `validationStrength` as `none` (index only), `metadata` (caller-supplied archive
metadata), or `binary` (the archive bytes were inspected). Binary inspection verifies ZIP central
and local headers, extra-field record bounds, flags, compression, bounded expansion, expanded
sizes, CRC-32, entry overlap, and Unix regular-file/directory markers according to the
[PKWARE ZIP APPNOTE](https://support.pkware.com/pkzip/appnote). It rejects symlinks and other
special files, malformed extra fields, and Unicode Path extras that could expose a name other than
the validated ZIP entry name.

Default limits are 512 MiB of archive input, 25,000 entries, a 16 MiB index, 512 MiB per expanded
entry, 4 GiB total expanded data, a 200:1 compression ratio, and 200 retained diagnostics. Lower
individual values through `limits`; totals still include diagnostics omitted from the bounded
result array. Download URLs default to Modrinth's four documented hosts (`cdn.modrinth.com`,
`github.com`, `raw.githubusercontent.com`, and `gitlab.com`). `additionalDownloadHosts` explicitly
allows exact extra hosts and emits a warning for every non-official URL.

Portable paths are capped at 4,096 characters, URLs at 8,192 characters, downloads at 64 per file,
and explicit additional hosts at 64 so object-form Catalog/MCP inputs remain bounded too.

## Coverage

Primary support starts at Java Edition 1.13 and includes Java data packs, Java resource packs, and
Paper-first plugins. The package treats unknown fields as gaps instead of inferred facts.

`getSourceReport({ domain, version })` returns source tiers, prohibited automation, structured
community datasets, and optional domain/version provenance. Minecraft Wiki is human-only
background; AI workflows should not fetch, crawl, summarize, or cite Wiki pages.
`listSourceTiers()` and `listCommunityDatasets()` expose the source policy as smaller lookup
surfaces for agents.
