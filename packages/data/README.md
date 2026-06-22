# @minecraft-skills/data

Redistributable canonical data for Minecraft Skills consumers.

## Contents

- Java 1.13+ release index and version details.
- Machine-readable authoring checklists for pre-generation AI validation.
- Machine-readable authoring guardrails for output safety.
- Machine-readable fact surface guidance that states what each data surface can and cannot prove.
- Extracted data/resource pack format numbers.
- Official server report summaries and command path indexes.
- Vanilla client asset and server data inventories.
- Vanilla resource pack model and item definition JSON shape summaries.
- Packaged Agent Skill payloads under `skills/`, mirrored from the repository root skill folders.
- PaperMC support metadata, per-version Paper build summaries, Paper docs source links, and
  `sya-ri/spigot-event-list` API contract metadata.
- Paper Javadocs package indexes for Paper versions where package tables or search indexes are
  available.
- Download manifest metadata for heavyweight generated surfaces that can be fetched into an OS
  cache with SHA-256 verification.

## Use

Most consumers should use `@minecraft-skills/catalog`, which validates these files and exposes
stable read APIs. This package is useful when an agent or tool needs direct access to the underlying
JSON/text data files.

```ts
import { fetchData, getDataManifest, readDataJson, readDataText } from "@minecraft-skills/data";

const versions = readDataJson("java/versions.json");
const checklists = readDataJson("authoring-checklists.json");
const guardrails = readDataJson("authoring-guardrails.json");
const factSurfaces = readDataJson("fact-surfaces.json");
const intentLookups = readDataJson("intent-lookups.json");
const commandPaths = readDataText("java/command-paths/26.2.txt");
const paperSkill = readDataText("skills/minecraft-paper-plugins/SKILL.md");
const manifest = getDataManifest();
await fetchData({ kind: "paper-api-surface", version: "1.21.11" });
```

Downloaded data is cached under the platform cache directory for the manifest data version. Set
`MINECRAFT_SKILLS_CACHE_DIR` to override that location.

Minecraft Wiki prose is not redistributed in this package.
