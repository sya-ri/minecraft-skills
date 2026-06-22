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

## Development

This repository uses mise, pnpm workspaces, TypeScript, ArkType, tsdown, tsgo, Vitest, Biome, and
sherif.

```sh
mise trust
mise install
mise exec -- pnpm install
CI=true mise exec -- pnpm run check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for maintainer workflows, release checks, and data
regeneration commands.

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
minecraft-skills fact-surfaces --domain datapack
minecraft-skills fact-surface datapack-schema-surface
minecraft-skills coverage
minecraft-skills data-manifest
minecraft-skills support-matrix
minecraft-skills cache-dir
minecraft-skills fetch-data paper-api-surface --version 1.21.11
minecraft-skills versions
minecraft-skills pack-formats
minecraft-skills show-version 1.21.11
minecraft-skills compare-versions 1.20.6 1.21
minecraft-skills server-reports latest
minecraft-skills datapack-schema latest
minecraft-skills search-datapack-schema latest --kind advancement --contains criteria
minecraft-skills compare-datapack-schema 26.2 26.2 --kind advancement
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
minecraft-skills paper-api-surface 1.21.11
minecraft-skills paper-types 1.21.11 --contains org.bukkit.entity.Player
minecraft-skills paper-members 1.21.11 --type org.bukkit.entity.Player --contains sendMessage
minecraft-skills compare-paper-api 1.20.4 1.21.11
minecraft-skills compare-paper-api-surface 1.21.11 1.21.11
minecraft-skills paper-events "player join" --version 1.21.11
minecraft-skills references --domain paper-plugin
```

`minecraft-skills compare-commands` and `minecraft-skills compare-vanilla-paths` return added and
removed command syntax or asset/data paths between bundled versions. `minecraft-skills
datapack-schema` returns observed vanilla datapack JSON field shapes extracted from official server
jars; it is not a normative schema. `minecraft-skills resourcepack-models` returns observed vanilla
model JSON and item definition JSON shape summaries extracted from official client jars.
`minecraft-skills paper` returns PaperMC support metadata, per-version Paper build summaries,
official Paper docs source links, and the `sya-ri/spigot-event-list` event search API contract.
`minecraft-skills paper-api` returns the versioned Paper API dependency, Javadocs URL, Paper docs,
and Folia/scheduler reference links. `minecraft-skills paper-api-surface` returns Javadocs
type/member search-index facts, and `minecraft-skills compare-paper-api-surface` compares those
facts without copying Javadocs prose. `minecraft-skills paper-events` calls the event API for live
event discovery. `minecraft-skills skill <name>` returns the packaged Agent Skill payload, including
`SKILL.md`, agent metadata, and generated references.
`minecraft-skills fact-surfaces` lists machine-verifiable data surfaces with what each surface can
and cannot prove, so agents can avoid treating observed data as normative specification.
`minecraft-skills coverage` returns bundled coverage counts for Java releases, datapack/resourcepack
facts, Paper plugin data, and packaged skill payloads.
`minecraft-skills write-skill <name> --output <dir>` writes a packaged Agent Skill folder to disk,
preserving `SKILL.md`, `agents/openai.yaml`, and generated references.
`minecraft-skills data-manifest`, `cache-dir`, `cache-list`, `cache-clean`, and `fetch-data` expose
downloadable heavy data and the local OS cache used by catalog lookups. Cache defaults are
`~/Library/Caches/minecraft-skills` on macOS, `${XDG_CACHE_HOME:-~/.cache}/minecraft-skills` on
Linux, and `%LOCALAPPDATA%\minecraft-skills\Cache` on Windows. Set
`MINECRAFT_SKILLS_CACHE_DIR` to override the location.

## MCP

After publishing, the MCP server is intended to be runnable with:

```sh
npx -y @minecraft-skills/mcp
```

Typical stdio MCP client config:

```json
{
  "mcpServers": {
    "minecraft-skills": {
      "command": "npx",
      "args": ["-y", "@minecraft-skills/mcp"]
    }
  }
}
```

The server exposes tools for version lookup, pack formats, server reports, command search and
comparison, observed datapack schema search/comparison, vanilla asset/data path search and
comparison, resource pack model summaries, Paper support metadata, Paper type/member surface search,
data manifest/cache status/fetch operations, installable skill folder discovery, packaged skill
payload lookup, and Paper/Bukkit event search.

The server also exposes Agent Skill files as MCP resources under
`minecraft-skills://skills/<skill>/...`, including `SKILL.md`, `agents/openai.yaml`, and generated
reference markdown.

The server also exposes MCP prompts for starting domain-specific assistance:
`use_minecraft_datapacks`, `use_minecraft_resourcepacks`, and `use_minecraft_paper_plugins`.
Each prompt accepts optional `target_version` and `task` arguments, points the client at the matching
skill resource, and names the MCP tools to prefer for that domain.

## Package API

`@minecraft-skills/catalog` validates bundled data with ArkType and exposes read APIs for agents and
other tools:

```ts
import {
  compareCommands,
  compareDatapackSchema,
  getDatapackSchemaSurface,
  getFactSurface,
  compareVanillaPaths,
  getCoverageSummary,
  getPaperApiSurface,
  getResourcepackModelSummary,
  getSkillPayload,
  getSupportMatrix,
  getVersionDetail,
  listSkills,
  listFactSurfaces,
  searchCommands,
  searchDatapackSchema,
  searchPaperMembers,
  searchPaperTypes,
  searchResourcepackModelPaths,
} from "@minecraft-skills/catalog";

const version = getVersionDetail("java", "26.2");
const skills = listSkills();
const paperSkill = getSkillPayload("minecraft-paper-plugins");
const factSurfaces = listFactSurfaces({ domain: "datapack" });
const schemaSurfacePolicy = getFactSurface("datapack-schema-surface");
const coverage = getCoverageSummary();
const support = getSupportMatrix();
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
const paperSurface = getPaperApiSurface("1.21.11");
const paperTypes = searchPaperTypes({
  version: "1.21.11",
  contains: "org.bukkit.entity.Player",
});
const playerMembers = searchPaperMembers({
  version: "1.21.11",
  type: "org.bukkit.entity.Player",
  contains: "sendMessage",
});
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
