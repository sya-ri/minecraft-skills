# minecraft-skills

Minecraft authoring facts, Agent Skills, CLI, and MCP tools for AI agents that create or review
Java data packs, Java resource packs, and Paper plugins.

The project helps AI check real versioned data before it writes code or pack files. It provides:

- Skill folders for datapack, resourcepack, and Paper plugin authoring.
- CLI/API/MCP lookups for versions, pack formats, commands, vanilla paths, JSON/model shapes, Paper
  API indexes, and Paper events.
- Authoring guidance for what to verify, what evidence is required, and how to phrase unknowns.
- Bundled Java 1.13+ data, with cache downloads for heavier generated surfaces.

## Start Here

Install and run:

```sh
npx minecraft-skills minecraft latest
npx -y @minecraft-skills/mcp
```

Useful first commands:

```sh
minecraft-skills plugin paper context 26.2
minecraft-skills plugin paper search-scenarios "Paper event listener"
minecraft-skills plugin paper plan paper-event-listener-review 26.2
minecraft-skills datapack recipes
minecraft-skills datapack commands 26.2 --prefix execute
minecraft-skills resourcepack vanilla-paths 26.2 --contains models/item
minecraft-skills plugin paper members 26.2 --type org.bukkit.entity.Player --contains sendMessage
```

For the full CLI, MCP tools, package API, cache behavior, and authoring workflows, see
[docs/USAGE.md](docs/USAGE.md). Version-by-version coverage is summarized in
[docs/VERSION_SUPPORT.md](docs/VERSION_SUPPORT.md).

Release notes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Source Policy

Primary support starts at Java Edition 1.13. Redistributable facts should come from official Mojang
metadata, extracted vanilla client/server data, PaperMC API artifacts and docs, the
`sya-ri/spigot-event-list` API contract, or reviewed original guidance.

Minecraft Wiki may be used for navigation and provenance, but copied or closely paraphrased Wiki
prose is not redistributed.

## Packages

- `packages/data`: canonical versioned JSON/text data, publishable as `@minecraft-skills/data`.
- `packages/catalog`: ArkType-validated read APIs, publishable as `@minecraft-skills/catalog`.
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
