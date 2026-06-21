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
  comparePaperApi,
  compareVanillaPaths,
  getCoverageSummary,
  getJavaReportsSummary,
  getPaperApiIndex,
  getPaperApiReference,
  getPaperPluginData,
  getResourcepackModelSummary,
  getSkillPayload,
  getVersionDetail,
  listSkills,
  searchCommands,
  searchResourcepackModelPaths,
  searchVanillaPaths,
} from "@minecraft-skills/catalog";

const version = getVersionDetail("java", "26.2");
const skills = listSkills();
const paperSkill = getSkillPayload("minecraft-paper-plugins");
const coverage = getCoverageSummary();
const reports = getJavaReportsSummary("java", "26.2");
const commands = searchCommands({ version: "26.2", prefix: "execute", limit: 10 });
const commandDiff = compareCommands({ from: "1.20.6", to: "1.21", prefix: "attribute" });
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
const paper = getPaperPluginData();
```

## Coverage

Primary support starts at Java Edition 1.13 and includes Java data packs, Java resource packs, and
Paper-first plugins. The package treats unknown fields as gaps instead of inferred facts.
