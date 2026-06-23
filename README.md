# minecraft-skills

[![npm](https://img.shields.io/npm/v/minecraft-skills.svg)](https://www.npmjs.com/package/minecraft-skills)
[![npm data](https://img.shields.io/npm/v/%40minecraft-skills%2Fdata.svg?label=%40minecraft-skills%2Fdata)](https://www.npmjs.com/package/@minecraft-skills/data)
[![npm catalog](https://img.shields.io/npm/v/%40minecraft-skills%2Fcatalog.svg?label=%40minecraft-skills%2Fcatalog)](https://www.npmjs.com/package/@minecraft-skills/catalog)
[![npm rcon](https://img.shields.io/npm/v/%40minecraft-skills%2Frcon.svg?label=%40minecraft-skills%2Frcon)](https://www.npmjs.com/package/@minecraft-skills/rcon)
[![npm mcp](https://img.shields.io/npm/v/%40minecraft-skills%2Fmcp.svg?label=%40minecraft-skills%2Fmcp)](https://www.npmjs.com/package/@minecraft-skills/mcp)

Minecraft authoring facts, Agent Skills, CLI, and MCP tools for AI agents that create or review
Java data packs, Java resource packs, and Paper plugins.

The project helps AI check real versioned data before it writes code or pack files. It provides:

- Skill folders for datapack, resourcepack, and Paper plugin authoring.
- CLI/API/MCP lookups for versions, pack formats, commands, vanilla paths, JSON/model shapes, Paper
  API indexes, and Paper events.
- Authoring guidance for what to verify, what evidence is required, and how to phrase unknowns.
- Bundled Java 1.13+ data, with cache downloads for heavier generated surfaces.

## Start Here

For AI clients that support MCP, start with the MCP server. It exposes the versioned data, authoring
contexts, prompts, and lookup tools directly to the agent:

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

Then add the Agent Skill folders when your AI tool supports external skills. Use the installer
syntax for your tool, and point it at one or more of these repository folders:

- `skills/minecraft-datapacks`
- `skills/minecraft-resourcepacks`
- `skills/minecraft-paper-plugins`

Install and run manually:

```sh
npx minecraft-skills minecraft latest
npx -y @minecraft-skills/mcp
```

Useful first commands:

```sh
minecraft-skills plugin paper context 26.2
minecraft-skills plugin paper search "event listener" --kind authoring-recipe
minecraft-skills plugin paper search-scenarios "Paper event listener"
minecraft-skills plugin paper plan paper-event-listener-review 26.2
minecraft-skills datapack recipes
minecraft-skills datapack classify-files data/example/advancement/root.json
minecraft-skills datapack migration-plan 1.20.6 1.21 data/example/advancement/root.json
minecraft-skills minecraft pack-format 26.2 datapack
minecraft-skills minecraft versions-for-pack-format resourcepack 88
minecraft-skills datapack commands 26.2 --prefix execute
minecraft-skills resourcepack vanilla-paths 26.2 --contains models/item
minecraft-skills resourcepack assets search 26.2 --contains models/item --fetch
minecraft-skills resourcepack assets get 26.2 assets/minecraft/models/item/diamond_sword.json
minecraft-skills resourcepack file-schema 26.2 assets/example/items/widget.json
minecraft-skills plugin paper members 26.2 --type org.bukkit.entity.Player --contains sendMessage
```

For the full CLI, MCP tools, package API, cache behavior, and authoring workflows, see
[docs/USAGE.md](docs/USAGE.md). Version-by-version coverage is summarized in
[docs/VERSION_SUPPORT.md](docs/VERSION_SUPPORT.md).
RCON setup and permission presets are documented in [docs/RCON.md](docs/RCON.md).

Release notes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Source Policy

Primary support starts at Java Edition 1.13. Redistributable facts should come from official Mojang
metadata, extracted vanilla client/server data, PaperMC API artifacts and docs, structured
community datasets, the `sya-ri/spigot-event-list` API contract, or reviewed original guidance.

Minecraft Wiki is human-only background for this project. AI workflows should not fetch, crawl,
summarize, or cite Wiki pages; use bundled data, Mojang/Paper sources, source reports, and allowed
structured datasets instead.

See [Source Strategy](docs/SOURCE_STRATEGY.md) for source tiers, community structured datasets, and
validation rules.

## Packages

- `packages/data`: canonical versioned JSON/text data, publishable as `@minecraft-skills/data`.
- `packages/catalog`: ArkType-validated read APIs, publishable as `@minecraft-skills/catalog`.
- `packages/rcon`: RCON config, permission, and execution utilities, publishable as
  `@minecraft-skills/rcon`.
- `packages/cli`: public CLI, publishable as `minecraft-skills`.
- `packages/mcp`: MCP server, publishable as `@minecraft-skills/mcp`.
- `packages/maintainer`: private maintainer validation and generation tooling.

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
