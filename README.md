# minecraft-skills

[![npm](https://img.shields.io/npm/v/minecraft-skills.svg)](https://www.npmjs.com/package/minecraft-skills)
[![npm data](https://img.shields.io/npm/v/%40minecraft-skills%2Fdata.svg?label=%40minecraft-skills%2Fdata)](https://www.npmjs.com/package/@minecraft-skills/data)
[![npm catalog](https://img.shields.io/npm/v/%40minecraft-skills%2Fcatalog.svg?label=%40minecraft-skills%2Fcatalog)](https://www.npmjs.com/package/@minecraft-skills/catalog)
[![npm rcon](https://img.shields.io/npm/v/%40minecraft-skills%2Frcon.svg?label=%40minecraft-skills%2Frcon)](https://www.npmjs.com/package/@minecraft-skills/rcon)
[![npm mcp](https://img.shields.io/npm/v/%40minecraft-skills%2Fmcp.svg?label=%40minecraft-skills%2Fmcp)](https://www.npmjs.com/package/@minecraft-skills/mcp)

Version-aware Minecraft authoring data, Agent Skills, CLI commands, and MCP tools for AI agents
that create or review Java data packs, Java resource packs, and Paper plugins.

minecraft-skills helps agents verify Minecraft facts before writing code or pack files and handle
incomplete evidence without guessing.

## Quick Start

Node.js 22.12 or newer is required.

For AI clients that support MCP, add the server to the client's MCP configuration:

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

Run the CLI without installing it globally:

```sh
npx minecraft-skills minecraft latest
```

A few representative commands:

```sh
npx minecraft-skills plugin paper context 26.2
npx minecraft-skills datapack validate-project 26.2 ./my-data-pack
npx minecraft-skills resourcepack validate-project 26.2 ./my-resource-pack
```

See the [usage guide](docs/USAGE.md) for the full reference for the CLI, MCP server, package APIs,
cache behavior, and authoring workflows.

## Agent Skills

Clients that support external skills can use the bundled skill folders:

- [`skills/minecraft-datapacks`](packages/data/data/skills/minecraft-datapacks)
- [`skills/minecraft-resourcepacks`](packages/data/data/skills/minecraft-resourcepacks)
- [`skills/minecraft-paper-plugins`](packages/data/data/skills/minecraft-paper-plugins)

## Documentation

- [Usage](docs/USAGE.md): CLI, MCP, package APIs, cache behavior, and authoring workflows.
- [Version Support](docs/VERSION_SUPPORT.md): bundled and downloadable data by Minecraft version.
- [Source Strategy](docs/SOURCE_STRATEGY.md): source tiers, redistribution rules, and claim wording.
- [RCON](docs/RCON.md): configuration and permission presets.
- [Mixin Configuration Validation](docs/MIXIN_CONFIG_VALIDATION.md): validator scope and limits.
- [WAVE Audio Inspection](docs/WAVE_AUDIO_INSPECTION.md): parser and signal-metric boundaries.
- [Changelog](CHANGELOG.md): release history.

## Published Packages

- [`minecraft-skills`](packages/cli): command-line interface.
- [`@minecraft-skills/mcp`](packages/mcp): MCP server for AI clients.
- [`@minecraft-skills/catalog`](packages/catalog): validated read APIs.
- [`@minecraft-skills/data`](packages/data): versioned data and Agent Skills.
- [`@minecraft-skills/rcon`](packages/rcon): RCON configuration and execution utilities.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, maintainer workflows, data regeneration, and
release checks.
