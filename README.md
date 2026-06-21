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

## Skills

Generated skills are committed under `skills/` and should not be edited directly.

- `skills/minecraft-datapacks`
- `skills/minecraft-resourcepacks`
- `skills/minecraft-paper-plugins`
