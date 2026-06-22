# minecraft-skills

Version-aware Minecraft authoring data, Agent Skills, CLI, and MCP tools for AI agents that create
or review:

- Java data packs
- Java resource packs
- Paper-first server plugins

The goal is to make AI output less likely to invent Minecraft facts. The project provides exact
lookup surfaces, source-backed workflows, and response rules so an agent can say what is verified,
what is missing, and what must not be inferred.

## What It Provides

- Installable Agent Skill folders for datapacks, resourcepacks, and Paper plugins.
- A CLI for Minecraft versions, pack formats, command paths, vanilla paths, observed JSON/model
  shapes, Paper support, Paper API surfaces, and event discovery.
- An MCP server exposing the same data as tools, resources, and prompts.
- A TypeScript catalog API with ArkType validation.
- Bundled Java 1.13+ extracted data, plus SHA-256 verified cache downloads for heavier generated
  surfaces.
- AI safety data: authoring checklists, recipes, guardrails, claim policies, output requirements,
  and response patterns.

## Quick Start

After publishing:

```sh
npx minecraft-skills latest
npx -y @minecraft-skills/mcp
```

Useful first commands:

```sh
minecraft-skills authoring-context paper-plugin 1.21.11
minecraft-skills authoring-recipes --domain datapack
minecraft-skills commands 26.2 --prefix execute
minecraft-skills vanilla-paths 26.2 --domain resourcepack --contains models/item
minecraft-skills paper-members 1.21.11 --type org.bukkit.entity.Player --contains sendMessage
```

For full CLI, MCP, package API, cache, and skill usage, see [docs/USAGE.md](docs/USAGE.md).

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
