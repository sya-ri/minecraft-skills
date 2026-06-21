# @minecraft-skills/data

Redistributable canonical data for Minecraft Skills consumers.

## Contents

- Java 1.13+ release index and version details.
- Extracted data/resource pack format numbers.
- Official server report summaries and command path indexes.
- Vanilla client asset and server data inventories.
- Vanilla resource pack model and item definition JSON shape summaries.
- Packaged Agent Skill payloads under `skills/`, mirrored from the repository root skill folders.
- PaperMC support metadata, per-version Paper build summaries, Paper docs source links, and
  `sya-ri/spigot-event-list` API contract metadata.
- Paper Javadocs package indexes for Paper versions where package tables or search indexes are
  available.

## Use

Most consumers should use `@minecraft-skills/catalog`, which validates these files and exposes
stable read APIs. This package is useful when an agent or tool needs direct access to the underlying
JSON/text data files.

```ts
import { readDataJson, readDataText } from "@minecraft-skills/data";

const versions = readDataJson("java/versions.json");
const commandPaths = readDataText("java/command-paths/26.2.txt");
const paperSkill = readDataText("skills/minecraft-paper-plugins/SKILL.md");
```

Minecraft Wiki prose is not redistributed in this package.
