# minecraft-skills

### Compare omitted block-state defaults during a migration

`minecraft-skills normalize-migration-block-states <input.json>` fills omitted
properties using a caller-supplied, generated `reports/blocks.json`. The same
operation is available as the `normalize_migration_block_states` MCP tool and
`normalizeMigrationBlockStates` catalog export. The input envelope is:

```json
{
  "version": "the-report-version",
  "source": "description of the verified report source",
  "blocks": {
    "example:block": {
      "properties": { "powered": ["false", "true"] },
      "states": [
        { "default": true, "properties": { "powered": "false" } },
        { "properties": { "powered": "true" } }
      ]
    }
  },
  "states": [{ "Name": "example:block" }]
}
```

Use the actual parsed report as `blocks`; the example is only a small fixture.
An omitted `powered` property becomes `false` here, while an explicitly supplied
`true` remains `true`. Unknown blocks, properties, values, combinations, missing
defaults and ambiguous defaults fail instead of being silently normalized.
Source labels are caller evidence, not authenticated provenance. The tool does
not read or edit a world, infer version-specific renames, compare screenshots, or
declare two worlds equivalent. Compare the returned states separately, retaining
the raw differences and an explicit account of the covered coordinates.

Limits are 4,096 block definitions, 200,000 reported state combinations, 100,000
input states, 64 properties per state and 16 MiB of inspected identifier/value
characters. Empty input coverage does not pass. The CLI additionally limits its
JSON input file to 64 MiB.

[![npm](https://img.shields.io/npm/v/minecraft-skills.svg)](https://www.npmjs.com/package/minecraft-skills)
[![npm data](https://img.shields.io/npm/v/%40minecraft-skills%2Fdata.svg?label=%40minecraft-skills%2Fdata)](https://www.npmjs.com/package/@minecraft-skills/data)
[![npm catalog](https://img.shields.io/npm/v/%40minecraft-skills%2Fcatalog.svg?label=%40minecraft-skills%2Fcatalog)](https://www.npmjs.com/package/@minecraft-skills/catalog)
[![npm rcon](https://img.shields.io/npm/v/%40minecraft-skills%2Frcon.svg?label=%40minecraft-skills%2Frcon)](https://www.npmjs.com/package/@minecraft-skills/rcon)
[![npm mcp](https://img.shields.io/npm/v/%40minecraft-skills%2Fmcp.svg?label=%40minecraft-skills%2Fmcp)](https://www.npmjs.com/package/@minecraft-skills/mcp)

Version-aware Minecraft authoring data, Agent Skills, CLI commands, and MCP tools for AI agents
that create or review Java data packs, Java resource packs, and Paper plugins.

minecraft-skills helps agents verify Minecraft facts before writing code or pack files and handle
incomplete evidence without guessing.

## Installation

Node.js 22.12 or newer is required.

### CLI

Run the published CLI without a global installation:

```sh
npx minecraft-skills minecraft latest
```

Use the same `npx minecraft-skills` prefix for the commands in the
[usage guide](docs/USAGE.md).

### MCP

For AI clients that support stdio MCP servers, add this entry to the client's MCP configuration:

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

The server runs as `npx -y @minecraft-skills/mcp`. After running the CLI or configuring the MCP
server, see the [usage guide](docs/USAGE.md) for its command and capability reference.

## Optional Evaluation History

Maintainers and contributors can explicitly opt in to local MCP tool evaluation history with
`minecraft-skills evaluation enable`. It is disabled by default, stores raw tool requests and
responses only under `~/.minecraft-skills/evaluation`, and never uploads records or creates issues
automatically. See [Optional Evaluation History](docs/EVALUATION_HISTORY.md) for privacy guidance,
project-level opt-out, scoring, search, deletion, and the manual sanitized-feedback workflow.

## Agent Skills

Clients that support external skills can use the bundled skill folders:

- [`skills/minecraft-datapacks`](packages/data/data/skills/minecraft-datapacks)
- [`skills/minecraft-resourcepacks`](packages/data/data/skills/minecraft-resourcepacks)
- [`skills/minecraft-paper-plugins`](packages/data/data/skills/minecraft-paper-plugins)

## Documentation

- [Usage](docs/USAGE.md): CLI commands, MCP capabilities, package APIs, cache behavior, and
  authoring workflows.
- [Version Support](docs/VERSION_SUPPORT.md): bundled and downloadable data by Minecraft version.
- [Source Strategy](docs/SOURCE_STRATEGY.md): source tiers, redistribution rules, and claim wording.
- [RCON](docs/RCON.md): configuration and permission presets.
- [Optional Evaluation History](docs/EVALUATION_HISTORY.md): opt-in local MCP request, response,
  and quality records for improving minecraft-skills.
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
