# @minecraft-skills/data

Redistributable canonical data for Minecraft Skills consumers.

## Contents

- Java 1.13+ release index and version details.
- Extracted data/resource pack format numbers.
- Official server report summaries and command path indexes.
- Vanilla client asset and server data inventories.
- Vanilla resource pack model and item definition JSON shape summaries.
- PaperMC support metadata, per-version Paper build summaries, Paper docs source links, and
  `sya-ri/spigot-event-list` API contract metadata.

## Use

Most consumers should use `@minecraft-skills/catalog`, which validates these files and exposes
stable read APIs. This package is useful when an agent or tool needs direct access to the underlying
JSON/text data files.

```ts
import { readDataJson, readDataText } from "@minecraft-skills/data";

const versions = readDataJson("java/versions.json");
const commandPaths = readDataText("java/command-paths/26.2.txt");
```

Minecraft Wiki prose is not redistributed in this package.
