# Contributing

This repository uses mise, pnpm workspaces, TypeScript, ArkType, tsdown, tsgo, Vitest, Biome, and
sherif.

## Setup

```sh
mise trust
mise install
mise exec -- pnpm install
CI=true mise exec -- pnpm run check
```

## Release Readiness

Published package manifests are checked with pnpm because pnpm rewrites `workspace:` dependencies to
concrete versions in packed packages.

```sh
mise exec -- pnpm run check
mise exec -- pnpm run pack:dry-run
mise exec -- pnpm run pack:smoke
mise exec -- pnpm run publish:dry-run
```

Public publishing is intentionally manual. The `Release` GitHub Actions workflow defaults to a dry
run. To publish, configure `NPM_TOKEN`, run the workflow from `main`, and set `dry_run` to `false`.
The publish job uses npm provenance via GitHub OIDC and publishes:

- `@minecraft-skills/data`
- `@minecraft-skills/catalog`
- `minecraft-skills`
- `@minecraft-skills/mcp`

## Skill Payload Mirrors

The canonical editable skill folders live under `skills/`. The npm data package also ships mirrored
copies under `packages/data/data/skills/` so published consumers can read skill payloads and run
`minecraft-skills write-skill <name> --output <dir>`.

Do not replace `packages/data/data/skills/` with symlinks. `pnpm pack` does not include symlinks
that point outside the package, which would make the published `@minecraft-skills/data` tarball miss
the skill payloads. Repository validation checks that each mirrored skill payload matches the
canonical `skills/` source.

## Maintainer Flow

Before publishing or claiming the bundled data is current, compare checked-in latest metadata with
Mojang and PaperMC:

```sh
mise exec -- pnpm --filter @minecraft-skills/maintainer build
node packages/maintainer/dist/cli.mjs audit-current-sources
```

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
node packages/maintainer/dist/cli.mjs ingest-paper-api-indexes \
  --retrieved-at 2026-06-22T00:00:00.000Z
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

After changing generated reports, inventories, resource pack model summaries, Paper build data, or
Paper API indexes, materialize derived coverage facts into the checked-in version detail JSON:

```sh
node packages/maintainer/dist/cli.mjs materialize-version-details
```

Regenerate one vanilla inventory from already downloaded jars:

```sh
node packages/maintainer/dist/cli.mjs ingest-vanilla-inventory \
  --version 26.2 \
  --client-jar /tmp/minecraft-26.2-client.jar \
  --server-jar /tmp/minecraft-26.2-server.jar \
  --retrieved-at 2026-06-22T00:00:00+09:00
```
