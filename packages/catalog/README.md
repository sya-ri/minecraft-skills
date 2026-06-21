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
  comparePaperApi,
  getJavaReportsSummary,
  getPaperApiIndex,
  getPaperApiReference,
  getPaperPluginData,
  getResourcepackModelSummary,
  getVersionDetail,
  searchCommands,
  searchResourcepackModelPaths,
  searchVanillaPaths,
} from "@minecraft-skills/catalog";

const version = getVersionDetail("java", "26.2");
const reports = getJavaReportsSummary("java", "26.2");
const commands = searchCommands({ version: "26.2", prefix: "execute", limit: 10 });
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
const paperApi = getPaperApiReference("1.21.11");
const paperApiIndex = getPaperApiIndex("1.21.11");
const paperApiDiff = comparePaperApi("1.20.4", "1.21.11");
const paper = getPaperPluginData();
```

## Coverage

Primary support starts at Java Edition 1.13 and includes Java data packs, Java resource packs, and
Paper-first plugins. The package treats unknown fields as gaps instead of inferred facts.
