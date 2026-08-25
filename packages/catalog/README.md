# @minecraft-skills/catalog

ArkType-validated read APIs for the bundled Minecraft Skills data package.

## Install

```sh
pnpm add @minecraft-skills/catalog
```

Node.js 22.12 or newer is required.

## Examples

```ts
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  analyzeMinecraftLog,
  analyzeMinecraftPerformance,
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
  paperPluginJarValidationLimits,
  getVerifiedJavaPlayerTextures,
  getResourcepackModelSummary,
  getResponsePattern,
  resolveVelocityToolchain,
  getSkillPayload,
  getSourceReport,
  getSupportMatrix,
  getVersionDetail,
  inspectBlockbenchProject,
  inspectWaveAudio,
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
  lookupJavaPlayerProfileByName,
  listFactSurfaces,
  listIntentLookups,
  listModrinthProjectVersions,
  listOutputRequirements,
  listResponsePatterns,
  findVersionsByPackFormat,
  downloadJavaPlayerTexture,
  inspectJavaPlayerTextureBytes,
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
  inspectResourcepackPngAlphaBounds,
  validateDatapackProject,
  validateFabricMod,
  validateFabricModJar,
  validateResourcepackProject,
  validateResourcepackPng,
  validatePlayerSkinLayout,
  validateServerProperties,
  validateServerAccessList,
  validateMixinConfig,
  validateResourcepackTranslations,
  validateModrinthPack,
  validateModrinthPackArchive,
  validatePaperPluginArchiveMetadata,
  validatePaperPluginJar,
  validateVelocityPluginArchiveMetadata,
  validateVelocityPluginJar,
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
const adminCommandPlan = getAuthoringPlan({
  scenario: "paper-administrative-command-operability-review",
  version: "26.2",
});
const playerIdentityPlan = getAuthoringPlan({
  scenario: "paper-player-identity-and-display-review",
  version: "1.21.11",
});
const itemStackIdentityPlan = getAuthoringPlan({
  scenario: "paper-itemstack-semantic-identity-review",
  version: "26.2",
});
const sessionPlan = getAuthoringPlan({
  scenario: "paper-player-session-lifecycle-review",
  version: "1.21.11",
});
const configurationLifecyclePlan = getAuthoringPlan({
  scenario: "paper-plugin-configuration-lifecycle-review",
  version: "1.21.11",
});
const bossBarPlan = getAuthoringPlan({
  scenario: "paper-bossbar-audience-lifecycle-review",
  version: "26.2",
});
const scheduledTaskPlan = getAuthoringPlan({
  scenario: "paper-scheduled-task-lifecycle-review",
  version: "1.21.11",
});
const persistentDataPlan = getAuthoringPlan({
  scenario: "paper-persistent-data-contract-review",
  version: "1.21.11",
});
const testingEvidencePlan = getAuthoringPlan({
  scenario: "paper-plugin-testing-evidence-review",
  version: "1.21.11",
});
const preflight = getAuthoringPreflight({ domain: "paper-plugin", version: "26.2" });
const evidence = getEvidenceBundle({ domain: "paper-plugin", version: "26.2" });
const checklists = listAuthoringChecklists();
const recipes = listAuthoringRecipes({ domain: "paper-plugin" });
const listenerRecipe = getAuthoringRecipe("paper-event-listener");
const itemDeliveryRecipe = getAuthoringRecipe("paper-safe-item-delivery");
const inventoryRecipe = getAuthoringRecipe("paper-inventory-gui-interactions");
const adminCommandRecipe = getAuthoringRecipe("paper-administrative-command-operability");
const itemStackIdentityRecipe = getAuthoringRecipe("paper-itemstack-semantic-identity");
const scheduledTaskRecipe = getAuthoringRecipe("paper-scheduled-task-lifecycle");
const sessionRecipe = getAuthoringRecipe("paper-player-session-lifecycle");
const configurationLifecycleRecipe = getAuthoringRecipe("paper-plugin-configuration-lifecycle");
const bossBarRecipe = getAuthoringRecipe("paper-bossbar-audience-lifecycle");
const persistentDataRecipe = getAuthoringRecipe("paper-persistent-data-contract");
const testingEvidenceRecipe = getAuthoringRecipe("paper-plugin-testing-evidence");
const scenarios = listAuthoringScenarios({ domain: "paper-plugin" });
const scenarioMatches = searchAuthoringScenarios({
  query: "Paper event listener",
  domain: "paper-plugin",
});
const listenerScenario = getAuthoringScenario("paper-event-listener-review");
const itemDeliveryScenario = getAuthoringScenario("paper-item-delivery-review");
const inventoryScenario = getAuthoringScenario("paper-inventory-gui-interaction-review");
const playerIdentityScenario = getAuthoringScenario(
  "paper-player-identity-and-display-review",
);
const configurationLifecycleScenario = getAuthoringScenario(
  "paper-plugin-configuration-lifecycle-review",
);
const bossBarScenario = getAuthoringScenario("paper-bossbar-audience-lifecycle-review");
const itemStackIdentityScenario = getAuthoringScenario(
  "paper-itemstack-semantic-identity-review",
);
const testingEvidenceScenario = getAuthoringScenario(
  "paper-plugin-testing-evidence-review",
);
const guardrails = listAuthoringGuardrails({ domain: "paper-plugin" });
const paperApiGuardrail = getAuthoringGuardrail("paper-api-surface-limits");
const eventListenerGuardrail = getAuthoringGuardrail("paper-event-listener-semantics-safety");
const itemDeliveryGuardrail = getAuthoringGuardrail("paper-inventory-delivery-outcomes");
const itemStackIdentityGuardrail = getAuthoringGuardrail("paper-itemstack-semantic-identity");
const scheduledTaskGuardrail = getAuthoringGuardrail("paper-scheduled-task-lifecycle-safety");
const sessionGuardrail = getAuthoringGuardrail("paper-player-session-lifecycle-safety");
const configurationLifecycleGuardrail = getAuthoringGuardrail(
  "paper-plugin-configuration-lifecycle-safety",
);
const bossBarGuardrail = getAuthoringGuardrail("paper-bossbar-audience-lifecycle-safety");
const persistentDataGuardrail = getAuthoringGuardrail("paper-persistent-data-contract");
const testingEvidenceGuardrail = getAuthoringGuardrail("paper-plugin-testing-evidence");
const diagnostics = listAuthoringDiagnostics({ domain: "paper-plugin" });
const apiDiagnostic = getAuthoringDiagnostic("paper-api-member-unverified");
const eventListenerDiagnostic = getAuthoringDiagnostic("paper-event-listener-semantics-unsafe");
const testingEvidenceDiagnostic = getAuthoringDiagnostic("paper-plugin-test-evidence-gap");
const itemDeliveryDiagnostic = getAuthoringDiagnostic("paper-inventory-leftovers-unhandled");
const itemStackIdentityDiagnostic = getAuthoringDiagnostic(
  "paper-itemstack-identity-or-state-loss",
);
const scheduledTaskDiagnostic = getAuthoringDiagnostic("paper-scheduled-task-lifecycle-unsafe");
const sessionDiagnostic = getAuthoringDiagnostic("paper-player-session-lifecycle-unsafe");
const configurationLifecycleDiagnostic = getAuthoringDiagnostic(
  "paper-plugin-configuration-lifecycle-unsafe",
);
const bossBarDiagnostic = getAuthoringDiagnostic("paper-bossbar-audience-lifecycle-unsafe");
const persistentDataDiagnostic = getAuthoringDiagnostic("paper-persistent-data-contract-unsafe");
const adminCommandScenario = getAuthoringScenario(
  "paper-administrative-command-operability-review",
);
const adminCommandGuardrail = getAuthoringGuardrail(
  "paper-administrative-command-operability",
);
const adminCommandDiagnostic = getAuthoringDiagnostic(
  "paper-administrative-command-incomplete",
);
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
const profile = await lookupJavaPlayerProfileByName("jeb_");
const textures = await getVerifiedJavaPlayerTextures(
  "853c80ef-3c37-49fd-aa49-938b674adae6",
);
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
const velocityToolchain = await resolveVelocityToolchain({ limit: 10, timeoutMs: 5000 });
const fabricMetadata = validateFabricMod({
  metadata: {
    schemaVersion: 1,
    id: "example_mod",
    version: "1.0.0",
  },
  archiveEntries: [{ path: "fabric.mod.json" }],
});
// Supply bytes from a bounded local-file reader owned by the caller.
declare const localJarBytes: Uint8Array;
const fabricJar = validateFabricModJar(localJarBytes);
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
const mixinConfig = validateMixinConfig({
  config:
    '{"minVersion":"0.8.7","package":"com.example.mixin","mixins":["ExampleMixin"]}',
  archiveEntries: ["com/example/mixin/ExampleMixin.class"],
  archiveEntriesComplete: true,
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
const datapackProject = validateDatapackProject({
  version: "26.2",
  files: [
    {
      path: "pack.mcmeta",
      content: { pack: { pack_format: 107, description: "Example" } },
    },
    {
      path: "data/example/function/main.mcfunction",
      content: "function #example:load",
    },
    {
      path: "data/example/tags/function/load.json",
      content: { values: ["example:main"] },
    },
  ],
});
// Submitted namespaces are closed by default. Set assumeLocalNamespacesComplete: false only when
// another pack or mod may merge dependencies into the same namespace; unresolved targets then
// remain explicit completeness warnings instead of hard missing-reference errors.
const serverProperties = validateServerProperties({
  targetVersion: "1.21.11",
  content: "server-port=25565\nonline-mode=true\n",
});
// `serverProperties` never contains property values. Java Properties syntax validation is
// complete within the published bounds, while exact target-version keys/defaults and the
// Minecraft runtime reader/encoding remain explicit unknowns.
const logAnalysis = analyzeMinecraftLog({
  text: `[12:00:00] [Server thread/ERROR]: java.lang.NoClassDefFoundError: com/example/api/MissingService
Caused by: java.lang.ClassNotFoundException: com.example.api.MissingService`,
  limits: { maxMixinFailures: 50, maxClassLoadingFailures: 50 },
});
const blockbenchProject = inspectBlockbenchProject({
  project:
    '{"meta":{"format_version":"5.0","model_format":"free"},"groups":[{"name":"seat"}],"animations":[{"name":"idle"}]}',
  requireAnimations: ["idle", "walk"],
  requireGroups: ["body", "seat"],
});
const translations = validateResourcepackTranslations({
  version: "26.2",
  referenceLocale: "en_us",
  requiredLocales: ["ja_jp"],
  files: [
    {
      path: "assets/example/lang/en_us.json",
      content: '{"example.greeting":"Hello %s"}',
    },
    {
      path: "assets/example/lang/ja_jp.json",
      content: '{"example.greeting":"%s さん、こんにちは"}',
    },
  ],
  argumentCounts: { "example.greeting": 1 },
});
const waveSource = inspectWaveAudio(await readFile("./source.wav"));
// Reports bounded RIFF/WAVE PCM or IEEE-float structure, SHA-256, duration, sample peak dBFS,
// unweighted sample RMS dBFS, and a factual integer-endpoint/float-magnitude count. It does not
// convert or normalize audio, measure LUFS, or prove clipping or decoder compatibility.
// Add assets/<namespace>/sounds.json as JSON content and local .ogg files as Uint8Array content.
// Supply at most the first 58 bytes needed for each Ogg/Vorbis identification page. Complete local
// PNG files may also be supplied as Uint8Array content for bounded structural validation.
// `limits` may lower (but never raise) the published file, path, content-node, content-size,
// aggregate-binary, model-graph-work, sound-event, and sound-entry ceilings. `pngLimits` similarly
// lowers the project PNG byte, dimension, pixel, and chunk ceilings.
// Results distinguish input `totalFiles` from `processedFiles`, expose `validationComplete` and
// sound- and PNG-specific incomplete reasons, echo `appliedLimits`, and report exact
// retained/omitted diagnostic counts without retaining an unbounded diagnostic array.
const resourcepackPng = validateResourcepackPng(readFileSync("./pack.png"), {
  limits: { maxInputBytes: 4 * 1024 * 1024, maxPixels: 16_777_216 },
});
const textureAlpha = inspectResourcepackPngAlphaBounds(
  readFileSync("./assets/example/textures/item/widget.png"),
  {
    requirements: { nonEmpty: true, minimumTransparentMarginPixels: 1 },
    limits: { maxInflatedBytes: 16 * 1024 * 1024 },
  },
);
const playerSkinLayout = validatePlayerSkinLayout({
  width: 64,
  height: 64,
  sourceRects: {
    base: { x: 8, y: 8, width: 8, height: 8 },
    hat: { x: 40, y: 8, width: 8, height: 8 },
  },
});
const inspectedPlayerTexture = inspectJavaPlayerTextureBytes(
  "0123456789abcdef".repeat(4),
  "skin",
  readFileSync("./skin.png"),
);
const downloadedPlayerTexture = await downloadJavaPlayerTexture(
  "0123456789abcdef".repeat(4),
  "skin",
);
const accessList = validateServerAccessList({
  kind: "ops",
  evaluatedAt: "2026-08-25T00:00:00.000Z",
  content: '[{"uuid":"123e4567-e89b-42d3-a456-426614174000","name":"Player","level":4,"bypassesPlayerLimit":false}]',
});
// The result contains only bounded counts and fixed entry/field locations. It never returns input
// names, UUIDs, IP addresses, ban reasons, or ban sources, and performs no network lookup. Its
// evaluatedAt field records the canonical UTC instant used for expiration classification.
// It checks canonical serializer output, not every defaulted or clamped shape the server loader
// may accept, so `valid: false` does not guarantee loader rejection.
// Translation files are merged by exact locale key, not by namespace. Raw JSON proves duplicate
// source keys; parsed object input explicitly leaves source-key uniqueness unknown. Results never
// retain translation values, and requiredLocales is explicit-only. Placeholder normalization and
// runtime fallback evidence are source-verified against the official Mojang 26.2 client; other
// target versions keep that runtime claim incomplete instead of extrapolating it.
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
const paperPluginMetadata = validatePaperPluginArchiveMetadata({
  archiveEntries: [
    { path: "plugin.yml", size: 96 },
    { path: "dev/example/ExamplePlugin.class", size: 1 },
  ],
  archiveEntriesComplete: true,
  pluginYml: "name: ExamplePlugin\nversion: '1'\nmain: dev.example.ExamplePlugin\napi-version: '26.2'",
});
const velocityPluginBinary = validateVelocityPluginJar({
  archive: readFileSync("./build/libs/example.jar"),
});
const velocityPluginMetadata = validateVelocityPluginArchiveMetadata({
  descriptor: { id: "example", main: "dev.example.ExamplePlugin" },
  archiveEntries: [
    { path: "velocity-plugin.json", size: 64 },
    { path: "dev/example/ExamplePlugin.class", size: 1 },
  ],
  archiveEntriesComplete: true,
});
const sources = getSourceReport({ domain: "datapack", version: "26.2" });
const sourceTiers = listSourceTiers();
const communityDatasets = listCommunityDatasets();
```

`validateResourcepackPng` validates complete bytes against the
[W3C PNG specification](https://www.w3.org/TR/png-3/) with bounded signature, chunk framing, IHDR,
method, ordering, and CRC checks. It does not decompress IDAT, validate rendered pixels, interpret
APNG or animation `.mcmeta` semantics, or require square, power-of-two, or fixed-size `pack.png`
dimensions. `validationComplete` and `exceededLimits` distinguish a completed structural result
from an input or scan that stopped at a safety boundary. Project validation applies the same checks
when a `.png` file supplies complete `Uint8Array` content and reports omitted content explicitly.

`inspectResourcepackPngAlphaBounds` reuses that CRC-verified structure walk, then boundedly inflates
and unfilters the static image for every legal PNG color-type/bit-depth combination and Adam7. It
defines content only as alpha other than zero and returns counts, zero-based half-open content
bounds, transparent margins, and caller policy. It does not crop, rewrite, render, or return paths,
pixels, or RGB samples. Empty images are valid facts unless the caller requests `nonEmpty`; an
expected filtered byte count above `maxInflatedBytes` leaves structural validation intact and makes
pixel inspection explicitly indeterminate.

`validatePlayerSkinLayout` accepts only structured dimensions and optional source rectangles. It
recognizes current 64x64 and legacy 64x32 Java skins, returns normalized 64x64 layout evidence, and
checks canonical zero-based half-open base-face `(8,8,8,8)` and hat `(40,8,8,8)` rectangles. It
does not accept image bytes or identity data and does not infer slim/wide from pixels. PNG structure,
IDAT, pixels, alpha/conversion results, display scaling, filtering, blending, clipping, and scissor
state are not checked by this API.

`inspectJavaPlayerTextureBytes` snapshots at most one MiB of direct `Uint8Array` or `Buffer` input,
records its SHA-256, applies bounded PNG structure validation, and applies player-layout validation
only for `skin`. `downloadJavaPlayerTexture` adds a fixed five-second request/body boundary for the
internally constructed `https://textures.minecraft.net/texture/<64-lowercase-hex>` URL. Redirects,
non-200 responses, non-PNG content, non-identity encoding, oversized bodies, hostile chunks, and
excess chunk counts are closed outcomes. Successful Catalog results retain bounded bytes for API
callers; the CLI deliberately omits them from JSON. The requested reference hash is not required to
equal the downloaded SHA-256 and neither value proves profile signatures, provenance, account or
texture ownership, freshness, licensing, rendered pixels, or cape/elytra layout.

`analyzeMinecraftLog` is a pure bounded parser for Minecraft Java log text, Java stack traces, and
crash reports. It separates primary cause and suppressed branches, records only explicit
platform/version and mod/plugin statements, and never infers ownership from Java package names.
All limits may be lowered but not raised. Credentials, IP addresses, absolute paths, ANSI/OSC and
unsafe Unicode controls are sanitized before values are retained or deduplicated; no raw input
line is returned. `mixinFailures` contains bounded facts only when explicit Mixin exception
messages state that a shadow or injection target was not found, an injection check failed, a class
from a defined mixin package was loaded directly, or a mixin contains a non-private static member.
The categories do not assign blame or validate mappings, refmaps, configuration, target bytecode,
fixes, or runtime compatibility. `noRefmapReported: false` means only that the same exception
message did not contain the recognized no-refmap statement; it does not prove that a refmap was
loaded or correct. Category-specific evidence fields are null when the message does not state them;
counts that cannot be represented as safe integers are also null. `mixinFailureTotal`, retained and
omitted counts, `maxMixinFailures`, and `exceededLimits` expose truncation explicitly.
It also groups explicit `NoClassDefFoundError` and
`ClassNotFoundException` symbols within each exception chain. Slash and dot symbol forms normalize
to one dotted value; `initialization-failed` requires explicit `Could not initialize class` wording.
The result does not infer dependencies, classpaths, JAR contents, shading, ownership, fixes, or root
causes. `classLoadingFailureTotal`, retained and omitted counts, `maxClassLoadingFailures`, and
`exceededLimits` expose truncation explicitly.

`validateFabricMod` checks bounded structural rules for current `fabric.mod.json` schema v1 data.
Without `archiveEntries` it proves metadata structure only; caller-supplied entries additionally
check archive paths and referenced-file presence. `validateFabricModJar` adds bounded inspection of
the actual ZIP bytes and reports binary evidence. Neither API validates dependency predicates or
satisfaction, entrypoint classes or runtime loading, mixin/access-widener syntax, nested JAR
metadata, or icon pixels.
`inspectBlockbenchProject` is a pure, bounded inspector for raw `.bbmodel` JSON text or a safe
structured object. It reports format metadata and exact case-sensitive animation/group name
evidence; raw text also reports duplicate-key evidence. Requested absence is `missing` only when
the relevant collection in an audited core layout was completely scanned. Newer versions, `<lz>`
compression, custom/plugin formats, unsupported shapes, and limit exhaustion return `unknown`
instead of claiming invalidity or absence.

The inspector follows the official
[Blockbench `.bbmodel` documentation](https://www.blockbench.net/wiki/docs/bbmodel/) and a pinned
[Blockbench 5.1.6 format implementation](https://github.com/JannisX11/blockbench/blob/47e633e4a1338f957ee7baa0acbcf54da11e77df/js/formats/bbmodel.js). It does not validate runtime
animations/keyframes, textures, rendering/export, plugin semantics, or ModelEngine compatibility.
A group named `seat` has no special meaning in this result.

`lookupJavaPlayerProfileByName` and `getVerifiedJavaPlayerTextures` use only fixed Mojang service
URLs and send the supplied name or UUID to those services. They accept an injected fetch function
for deterministic testing, but no caller endpoint, headers, request body, or cache path. They write
no disk cache or application log. Pure normalization, session inspection, and signature helpers are
also exported for offline validation of already-supplied data.

The exact paths, schemas, and SHA1withRSA compatibility behavior are pinned to the official
Minecraft 26.2 Authlib 9.0.75 artifact and are version-specific, undocumented service behavior. A
`verified` result proves only the textures-property signature and session/payload UUID-name binding.
The 64-hex references are extracted from verified signed metadata; canonical HTTPS URLs are derived
by placing those references into the fixed official URL shape and are not themselves signed
strings. Neither API claims that a reference proves PNG bytes, a content digest, current skin
selection, ownership, or licensing. `getVerifiedJavaPlayerTextures` does not download images; use
the separate `downloadJavaPlayerTexture` API or CLI
[`player-texture download`](../cli/README.md#examples) command when bytes are needed. Layout
inspection and face cropping remain separate operations.

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

`validateServerProperties` is a pure offline validator for one text payload. It follows
[`java.util.Properties.load(Reader)`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Properties.html#load(java.io.Reader))
logical-line, separator, continuation, and escape behavior,
then checks duplicate last-wins semantics, conservative stable scalar types, and only correlations
provable within the file. The API caps UTF-8 bytes, physical/logical lines and lengths,
continuations, entries, decoded key/value lengths, unknown-key evidence, and diagnostics. Limit
overrides may only lower the published ceilings. No values are retained in the result; passwords,
seeds, URL credentials/query strings, and token-like values are classified before parsed records
are retained for duplicate resolution or diagnostics.
Because no generated target-version default set or runtime reader is bundled, recognized keys do
not prove version membership and `validationComplete` remains false.

`validatePaperPluginJar({ archive })` performs a bounded offline inspection of Paper/Bukkit plugin
JAR bytes. It verifies ZIP central/local structure, selects root `paper-plugin.yml` before
`plugin.yml` like Paper does, checks the active descriptor's CRC and UTF-8/YAML structure, and
correlates declared entry-point classes with exact archive paths.
`validatePaperPluginArchiveMetadata` performs the same active-versus-shadowed descriptor checks
from caller-supplied text and entries without claiming binary integrity. An incomplete entry list
that observes only `plugin.yml` cannot prove it is active, so semantic validation waits until
`paper-plugin.yml` absence is established. A declared class absent
from the plugin JAR produces a warning, not an incompatibility error, because Paper may resolve it
through library or dependency classloaders; invalid or truncated metadata cannot even prove that
archive-local absence. Syntactically valid `api-version` values outside current known Paper release
identifiers remain unknown rather than being accepted or rejected speculatively. The result keeps
Paper's experimental `paper-plugin.yml`, unknown keys, unchecked class bytecode and resolution,
YAML runtime-parser parity, and unexecuted server loading in `incompleteReasons`. Hard ceilings are
exported as `paperPluginJarValidationLimits`; no network is used.

`validateVelocityPluginJar({ archive })` performs bounded binary inspection of a Velocity plugin
JAR. It verifies ZIP central/local structure, descriptor and entrypoint CRC, fatal UTF-8 JSON,
current descriptor structure and IDs, the exact main-class path, bounded classfile identity and Java
target, and runtime-visible `@Plugin` evidence. `validateVelocityPluginArchiveMetadata` accepts
descriptor JSON plus caller-supplied entries and cannot claim any binary, CRC, classfile, Java
target, or annotation proof. Text descriptors reject duplicate object keys before JSON parsing;
parsed descriptor objects cannot retain that source-level evidence and report it as incomplete.
Both functions leave dependency satisfaction, complete bytecode/JVM
linkage, exact Gson runtime coercion, classpath and Velocity API compatibility, Guice
construction/injection, actual Velocity loading, runtime behavior, and security unverified.
Annotation absence or mismatch is evidence, not proof of loader rejection. Fixed ceilings are
exported as `velocityPluginJarValidationLimits`; runtime targets start at the current Velocity 4
Java 25 floor, and older Velocity lines are not modeled.

`validateMixinConfig` is a pure bounded preflight for raw Mixin config JSON text or parsed JSON
objects plus optional logical entry paths from one supplied archive. Raw text retains duplicate-key
source evidence. A complete entry list is complete only for that archive; missing local entries are
unknown because dependencies, the runtime classpath, and plugin-generated mixins are not inspected.
The function does not inspect class bytecode, targets, injections, mappings, or launcher behavior.
See [Mixin configuration validation](../../docs/MIXIN_CONFIG_VALIDATION.md) for the pinned Mixin and
Gson sources, evidence levels, bounds, and non-goals.

## Performance Time-Series Analysis

`analyzeMinecraftPerformance(input, limits?)` is a deterministic, offline pure function for
normalized Minecraft performance observations:

```ts
const performance = analyzeMinecraftPerformance({
  samples: [
    { timestamp: "2026-08-25T00:00:00.000Z", tps: 20, mspt: 41.5 },
    { timestamp: "2026-08-25T00:01:00.000Z", tps: 19.7, mspt: 48.2 },
  ],
  expectedIntervalSeconds: 60,
});
```

The fixed series are TPS, MSPT, CPU percent, heap used bytes, loaded chunks, entities, players, and
GC pause milliseconds. Samples require strictly increasing canonical UTC timestamps and finite,
non-negative values. The API accepts no identity, UUID, coordinate, host, or metric-source label.
Only the [Paper-documented](https://docs.papermc.io/paper/reference/commands/) 20 TPS target and 50
ms tick budget are defaults; every other threshold is caller-supplied.

Results include coverage, min/p50/p95/max, bounded violation intervals, trends, optional
before/after summaries, and exact-row MSPT associations when at least ten aligned observations are
non-constant. Missing values are not interpolated. Associations, deltas, and trends are descriptive
candidate evidence, never causal or statistically significant conclusions. Threshold violations
only recommend a scoped spark profile using Paper's
[profiling guidance](https://docs.papermc.io/paper/profiling/).

The default ceilings are 4 MiB of UTF-8 and 4,194,304 UTF-16 code units for normalized input,
10,000 samples, a 366-day window, 500 retained diagnostics, eight series, and 100 retained intervals
per series. Limits may
only be lowered. Inputs must be plain, dense data structures without proxies, accessors, symbols,
sparse entries, or extra fields. Because this API receives an already-parsed object, it cannot
detect duplicate keys that existed in source JSON; use the file CLI when source-level uniqueness
must be checked.

## Coverage

Primary support starts at Java Edition 1.13 and includes Java data packs, Java resource packs, and
Paper-first plugins. The package treats unknown fields as gaps instead of inferred facts.

`getSourceReport({ domain, version })` returns source tiers, prohibited automation, structured
community datasets, and optional domain/version provenance. Minecraft Wiki is human-only
background; AI workflows should not fetch, crawl, summarize, or cite Wiki pages.
`listSourceTiers()` and `listCommunityDatasets()` expose the source policy as smaller lookup
surfaces for agents.
