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
minecraft-skills versions
minecraft-skills pack-formats
minecraft-skills show-version 1.21.11
minecraft-skills compare-versions 1.20.6 1.21
minecraft-skills server-reports latest
minecraft-skills commands latest --prefix execute --contains run
minecraft-skills resourcepack-models latest
minecraft-skills search-models latest --kind item-definition --contains bundle
minecraft-skills vanilla-inventory latest
minecraft-skills vanilla-paths latest --domain resourcepack --contains models/block/acacia_button
minecraft-skills paper
minecraft-skills paper-events "player join" --version 1.21.11
minecraft-skills references --domain paper-plugin
```

`minecraft-skills resourcepack-models` returns observed vanilla model JSON and item definition JSON
shape summaries extracted from official client jars. `minecraft-skills paper` returns PaperMC
support metadata, per-version Paper build summaries, official Paper docs source links, and the
`sya-ri/spigot-event-list` event search API contract. `minecraft-skills paper-events` calls that API
for live event discovery.

## MCP

After publishing, the MCP server is intended to be runnable with:

```sh
npx @minecraft-skills/mcp
```

The server exposes tools for version lookup, pack formats, server reports, command search, vanilla
asset/data path search, resource pack model summaries, Paper support metadata, and Paper/Bukkit event
search.

## Package API

`@minecraft-skills/catalog` validates bundled data with ArkType and exposes read APIs for agents and
other tools:

```ts
import {
  getResourcepackModelSummary,
  getVersionDetail,
  searchCommands,
  searchResourcepackModelPaths,
} from "@minecraft-skills/catalog";

const version = getVersionDetail("java", "26.2");
const commands = searchCommands({ version: "26.2", prefix: "execute", limit: 10 });
const models = getResourcepackModelSummary("java", "26.2");
const itemDefinitions = searchResourcepackModelPaths({
  version: "26.2",
  kind: "item-definition",
  contains: "bundle",
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

Generated skills are committed under `skills/` and should not be edited directly.

- `skills/minecraft-datapacks`
- `skills/minecraft-resourcepacks`
- `skills/minecraft-paper-plugins`
