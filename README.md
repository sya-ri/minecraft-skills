# minecraft-skills

Versioned AI skills, canonical data, CLI, and MCP tooling for Minecraft authors and their AI
agents.

## Scope

Primary support starts at Java Edition 1.13. The initial domains are:

- Java data packs
- Java resource packs
- Paper-first server plugins

Minecraft Wiki is used for navigation and provenance, not copied or closely paraphrased prose.
Redistributable facts should come from official metadata, extracted vanilla data, PaperMC sources,
or reviewed original guidance.

## Tooling

This repository uses mise, pnpm workspaces, TypeScript, ArkType, tsdown, tsgo, Vitest, Biome, and
sherif.

```sh
mise trust
mise install
mise exec -- pnpm install
CI=true mise exec -- pnpm check
```

## Packages

- `packages/data`: canonical versioned JSON data, publishable as `@minecraft-skills/data`.
- `packages/catalog`: ArkType-validated read APIs, publishable as `@minecraft-skills/catalog`.
- `packages/cli`: public CLI, publishable as `minecraft-skills`.
- `packages/mcp`: MCP server, publishable as `@minecraft-skills/mcp`.
- `packages/maintainer`: private maintainer validation and generation tooling.

## CLI

```sh
minecraft-skills latest
minecraft-skills skills
minecraft-skills skill minecraft-paper-plugins
minecraft-skills write-skill minecraft-paper-plugins --output ./skills
minecraft-skills coverage
minecraft-skills versions
minecraft-skills pack-formats
minecraft-skills show-version 1.21.11
minecraft-skills compare-versions 1.20.6 1.21
minecraft-skills server-reports latest
minecraft-skills commands latest --prefix execute --contains run
minecraft-skills compare-commands 1.20.6 1.21 --prefix attribute
minecraft-skills resourcepack-models latest
minecraft-skills search-models latest --kind item-definition --contains bundle
minecraft-skills vanilla-inventory latest
minecraft-skills vanilla-paths latest --domain resourcepack --contains models/block/acacia_button
minecraft-skills compare-vanilla-paths 1.20.6 1.21 --domain resourcepack --prefix assets/minecraft/models/item/
minecraft-skills paper
minecraft-skills paper-api 1.21.11
minecraft-skills paper-api-index 1.21.11
minecraft-skills compare-paper-api 1.20.4 1.21.11
minecraft-skills paper-events "player join" --version 1.21.11
minecraft-skills references --domain paper-plugin
```

`minecraft-skills compare-commands` and `minecraft-skills compare-vanilla-paths` return added and
removed command syntax or asset/data paths between bundled versions. `minecraft-skills
resourcepack-models` returns observed vanilla model JSON and item definition JSON shape summaries
extracted from official client jars. `minecraft-skills paper` returns PaperMC support metadata,
per-version Paper build summaries, official Paper docs source links, and the
`sya-ri/spigot-event-list` event search API contract. `minecraft-skills paper-api` returns the
versioned Paper API dependency, Javadocs URL, Paper docs, and Folia/scheduler reference links.
`minecraft-skills compare-paper-api` compares versioned Paper Javadocs package indexes so agents can
spot API package surface changes without copying Javadocs prose. `minecraft-skills paper-events`
calls the event API for live event discovery. `minecraft-skills skill <name>` returns the packaged
Agent Skill payload, including `SKILL.md`, agent metadata, and generated references.
`minecraft-skills coverage` returns bundled coverage counts for Java releases, datapack/resourcepack
facts, Paper plugin data, and packaged skill payloads.
`minecraft-skills write-skill <name> --output <dir>` writes a packaged Agent Skill folder to disk,
preserving `SKILL.md`, `agents/openai.yaml`, and generated references.

## MCP

After publishing, the MCP server is intended to be runnable with:

```sh
npx @minecraft-skills/mcp
```

The server exposes tools for version lookup, pack formats, server reports, command search and
comparison, vanilla asset/data path search and comparison, resource pack model summaries, Paper
support metadata, installable skill folder discovery, packaged skill payload lookup, and
Paper/Bukkit event search.

The server also exposes Agent Skill files as MCP resources under
`minecraft-skills://skills/<skill>/...`, including `SKILL.md`, `agents/openai.yaml`, and generated
reference markdown.

The server also exposes MCP prompts for starting domain-specific assistance:
`use_minecraft_datapacks`, `use_minecraft_resourcepacks`, and `use_minecraft_paper_plugins`.
Each prompt accepts optional `target_version` and `task` arguments, points the client at the matching
skill resource, and names the MCP tools to prefer for that domain.

## Release Readiness

Published package manifests are checked with pnpm because pnpm rewrites `workspace:` dependencies to
concrete versions in packed packages.

```sh
mise exec -- pnpm run check
mise exec -- pnpm run pack:dry-run
mise exec -- pnpm run publish:dry-run
```

Public publishing is intentionally manual. The `Release` GitHub Actions workflow defaults to a dry
run. To publish, configure `NPM_TOKEN`, run the workflow from `main`, and set `dry_run` to `false`.
The publish job uses npm provenance via GitHub OIDC and publishes:

- `@minecraft-skills/data`
- `@minecraft-skills/catalog`
- `minecraft-skills`
- `@minecraft-skills/mcp`

## Package API

`@minecraft-skills/catalog` validates bundled data with ArkType and exposes read APIs for agents and
other tools:

```ts
import {
  compareCommands,
  compareVanillaPaths,
  getCoverageSummary,
  getResourcepackModelSummary,
  getSkillPayload,
  getVersionDetail,
  listSkills,
  searchCommands,
  searchResourcepackModelPaths,
} from "@minecraft-skills/catalog";

const version = getVersionDetail("java", "26.2");
const skills = listSkills();
const paperSkill = getSkillPayload("minecraft-paper-plugins");
const coverage = getCoverageSummary();
const commands = searchCommands({ version: "26.2", prefix: "execute", limit: 10 });
const commandDiff = compareCommands({ from: "1.20.6", to: "1.21", prefix: "attribute" });
const models = getResourcepackModelSummary("java", "26.2");
const itemDefinitions = searchResourcepackModelPaths({
  version: "26.2",
  kind: "item-definition",
  contains: "bundle",
});
const assetDiff = compareVanillaPaths({
  from: "1.20.6",
  to: "1.21",
  domain: "resourcepack",
  prefix: "assets/minecraft/models/item/",
});
```

## Maintainer Flow

Regenerate the Java 1.13+ release index from Mojang's version manifest:

```sh
curl -fsSL -o /tmp/minecraft-version-manifest-v2.json \
  https://piston-meta.mojang.com/mc/game/version_manifest_v2.json
mise exec -- pnpm --filter @minecraft-skills/maintainer build
node packages/maintainer/dist/cli.mjs ingest-java-manifest \
  --input /tmp/minecraft-version-manifest-v2.json \
  --retrieved-at 2026-06-22T00:00:00+09:00
```

Regenerate Java release details:

```sh
node packages/maintainer/dist/cli.mjs ingest-java-version-details \
  --force \
  --retrieved-at 2026-06-22T00:00:00+09:00
```

Generate and ingest server reports for a Java release. For modern bundled server jars, run the
server jar once with `--help` to unpack the inner server jar and libraries, then run Mojang's data
generator main class:

```sh
java -jar /tmp/minecraft-26.2-server.jar --help
cd /tmp/minecraft-skills-reports-26.2
CP=$(find libraries -name '*.jar' -print | paste -sd: -)
java -cp "versions/26.2/server-26.2.jar:$CP" net.minecraft.data.Main \
  --reports \
  --output /tmp/minecraft-skills-reports-26.2/generated
node packages/maintainer/dist/cli.mjs ingest-java-reports \
  --version 26.2 \
  --reports-dir /tmp/minecraft-skills-reports-26.2/generated/reports \
  --retrieved-at 2026-06-22T00:00:00+09:00
```

Regenerate Paper plugin support data:

```sh
curl -fsSL -o /tmp/papermc-paper-project.json https://api.papermc.io/v2/projects/paper
curl -fsSL -o /tmp/papermc-paper-1.21.11-builds.json \
  https://api.papermc.io/v2/projects/paper/versions/1.21.11
node packages/maintainer/dist/cli.mjs ingest-paper-project \
  --project-json /tmp/papermc-paper-project.json \
  --latest-builds-json /tmp/papermc-paper-1.21.11-builds.json \
  --retrieved-at 2026-06-22T00:00:00+09:00
node packages/maintainer/dist/cli.mjs ingest-paper-builds \
  --retrieved-at 2026-06-22T00:00:00+09:00
```

Regenerate all Java 1.13+ vanilla client asset and server data inventories:

```sh
node packages/maintainer/dist/cli.mjs ingest-vanilla-inventories \
  --retrieved-at 2026-06-22T00:00:00+09:00
```

Regenerate all Java 1.13+ resource pack model summaries:

```sh
node packages/maintainer/dist/cli.mjs ingest-resourcepack-models-all \
  --retrieved-at 2026-06-22T00:00:00+09:00
```

Regenerate one vanilla inventory from already downloaded jars:

```sh
node packages/maintainer/dist/cli.mjs ingest-vanilla-inventory \
  --version 26.2 \
  --client-jar /tmp/minecraft-26.2-client.jar \
  --server-jar /tmp/minecraft-26.2-server.jar \
  --retrieved-at 2026-06-22T00:00:00+09:00
```

## Skills

Generated skills are committed under `skills/` as standalone Agent Skills folders. Each skill has a
`SKILL.md`, targeted references, and `agents/openai.yaml` UI metadata.

- `skills/minecraft-datapacks`
- `skills/minecraft-resourcepacks`
- `skills/minecraft-paper-plugins`

Install or reference those folders directly from this repository when using a skill installer such
as `gh skills` or `npx skills`. The public npm data package also includes mirrored skill payloads
under `data/skills/`, so npm consumers can run `minecraft-skills write-skill <name> --output <dir>`
to materialize a standalone skill folder. Use `minecraft-skills skills` or MCP `list_skills` to
list installable skill folder paths.
