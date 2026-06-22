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
  compareVanillaPaths,
  fetchData,
  getAuthoringChecklist,
  getAuthoringContext,
  getAuthoringGuardrail,
  getAuthoringPreflight,
  getClaimPolicy,
  getCoverageSummary,
  getDataManifest,
  getDatapackSchemaSurface,
  getEvidenceBundle,
  getFactSurface,
  getIntentLookup,
  getJavaReportsSummary,
  getOutputRequirement,
  getPaperApiIndex,
  getPaperApiReference,
  getPaperApiSurface,
  getPaperPluginData,
  getResourcepackModelSummary,
  getSkillPayload,
  getSupportMatrix,
  getVersionDetail,
  listAuthoringChecklists,
  listAuthoringGuardrails,
  listClaimPolicies,
  listSkills,
  listVersionSupport,
  listFactSurfaces,
  listIntentLookups,
  listOutputRequirements,
  searchCommands,
  searchDatapackSchema,
  searchPaperMembers,
  searchPaperTypes,
  searchResourcepackModelPaths,
  searchVanillaPaths,
} from "@minecraft-skills/catalog";

const version = getVersionDetail("java", "26.2");
const skills = listSkills();
const paperSkill = getSkillPayload("minecraft-paper-plugins");
const checklist = getAuthoringChecklist("paper-plugin");
const context = getAuthoringContext({ domain: "paper-plugin", version: "1.21.11" });
const preflight = getAuthoringPreflight({ domain: "paper-plugin", version: "1.21.11" });
const evidence = getEvidenceBundle({ domain: "paper-plugin", version: "1.21.11" });
const checklists = listAuthoringChecklists();
const guardrails = listAuthoringGuardrails({ domain: "paper-plugin" });
const paperApiGuardrail = getAuthoringGuardrail("paper-api-surface-limits");
const claimPolicies = listClaimPolicies({ domain: "paper-plugin" });
const memberClaimPolicy = getClaimPolicy("paper-type-or-member-exists");
const outputRequirements = listOutputRequirements({ domain: "paper-plugin" });
const paperOutputRequirement = getOutputRequirement("paper-plugin-output-safety");
const factSurfaces = listFactSurfaces({ domain: "paper-plugin" });
const apiSurfacePolicy = getFactSurface("paper-api-surface");
const intentLookups = listIntentLookups({ domain: "paper-plugin" });
const memberLookup = getIntentLookup("verify-paper-type-or-member");
const coverage = getCoverageSummary();
const support = getSupportMatrix();
const versionSupport = listVersionSupport({ domain: "paper-plugin" });
const manifest = getDataManifest();
await fetchData({ kind: "paper-api-surface", version: "1.21.11" });
const reports = getJavaReportsSummary("java", "26.2");
const commands = searchCommands({ version: "26.2", prefix: "execute", limit: 10 });
const commandDiff = compareCommands({ from: "1.20.6", to: "1.21", prefix: "attribute" });
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
const paths = searchVanillaPaths({
  version: "26.2",
  domain: "datapack",
  contains: "recipe",
});
const pathDiff = compareVanillaPaths({
  from: "1.20.6",
  to: "1.21",
  domain: "resourcepack",
  prefix: "assets/minecraft/models/item/",
});
const paperApi = getPaperApiReference("1.21.11");
const paperApiIndex = getPaperApiIndex("1.21.11");
const paperApiDiff = comparePaperApi("1.20.4", "1.21.11");
const paperSurface = getPaperApiSurface("1.21.11");
const paperTypes = searchPaperTypes({ version: "1.21.11", contains: "Player" });
const paperMembers = searchPaperMembers({
  version: "1.21.11",
  type: "org.bukkit.entity.Player",
  contains: "sendMessage",
});
const paperSurfaceDiff = comparePaperApiSurface("1.21.11", "1.21.11");
const paper = getPaperPluginData();
```

## Coverage

Primary support starts at Java Edition 1.13 and includes Java data packs, Java resource packs, and
Paper-first plugins. The package treats unknown fields as gaps instead of inferred facts.
