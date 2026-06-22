---
name: minecraft-version-maintenance
description: Update minecraft-skills for new Minecraft Java or Paper versions, including data ingestion, heavy-data manifest refresh, documentation updates, and release verification.
---

# Minecraft Version Maintenance

Use this skill when updating minecraft-skills for new Minecraft Java releases, Paper support changes,
or regenerated version coverage.

## Source Rules

- Treat Mojang version metadata, client/server jars, and generated reports as canonical for Java
  datapack/resourcepack facts.
- Treat PaperMC downloads API data as canonical for Paper support and builds:
  `https://fill.papermc.io/v3/projects/paper`
- Include Paper alpha builds when the downloads API exposes builds for a Minecraft version.
- Do not write guessed data. If a source cannot be fetched or generated, leave the surface absent and
  record the gap through generated support data.

## Standard Refresh Flow

Set a single timestamp and data version for the whole refresh:

```sh
export RETRIEVED_AT="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
export DATA_VERSION="$(date -u +%Y.%m.%d)-1"
```

Build the maintainer CLI before running ingestion commands:

```sh
mise exec -- pnpm --filter @minecraft-skills/maintainer build
```

Refresh the Java release index from Mojang:

```sh
curl -fsSL -o /tmp/minecraft-version-manifest-v2.json \
  https://piston-meta.mojang.com/mc/game/version_manifest_v2.json
mise exec -- node packages/maintainer/dist/cli.mjs ingest-java-manifest \
  --input /tmp/minecraft-version-manifest-v2.json \
  --retrieved-at "$RETRIEVED_AT"
```

Refresh Java version details. Use `--force` when adding or correcting existing versions:

```sh
mise exec -- node packages/maintainer/dist/cli.mjs ingest-java-version-details \
  --force \
  --retrieved-at "$RETRIEVED_AT"
```

Refresh generated vanilla inventories, datapack schema summaries, and resourcepack model summaries:

```sh
mise exec -- node packages/maintainer/dist/cli.mjs ingest-vanilla-inventories \
  --force \
  --retrieved-at "$RETRIEVED_AT"
mise exec -- node packages/maintainer/dist/cli.mjs ingest-datapack-schemas-all \
  --force \
  --retrieved-at "$RETRIEVED_AT"
mise exec -- node packages/maintainer/dist/cli.mjs ingest-resourcepack-models-all \
  --force \
  --retrieved-at "$RETRIEVED_AT"
```

Refresh Paper support from the downloads API, then fetch Paper Javadocs indexes and surfaces:

```sh
curl -fsSL -o /tmp/papermc-paper-project.json \
  https://fill.papermc.io/v3/projects/paper
mise exec -- node packages/maintainer/dist/cli.mjs ingest-paper-project \
  --project-json /tmp/papermc-paper-project.json \
  --retrieved-at "$RETRIEVED_AT"
mise exec -- node packages/maintainer/dist/cli.mjs ingest-paper-builds \
  --retrieved-at "$RETRIEVED_AT"
mise exec -- node packages/maintainer/dist/cli.mjs ingest-paper-api-indexes \
  --retrieved-at "$RETRIEVED_AT"
mise exec -- node packages/maintainer/dist/cli.mjs ingest-paper-api-surfaces \
  --retrieved-at "$RETRIEVED_AT"
```

If one new Paper API surface fails because Javadocs were still publishing, retry only that version:

```sh
mise exec -- node packages/maintainer/dist/cli.mjs ingest-paper-api-surfaces \
  --version <paper-version> \
  --force \
  --retrieved-at "$RETRIEVED_AT"
```

Materialize derived version facts after all source data is updated:

```sh
mise exec -- node packages/maintainer/dist/cli.mjs materialize-version-details
```

Regenerate the heavy-data manifest. For a fixed release tag, keep the base URL pinned to that tag:

```sh
mise exec -- node packages/maintainer/dist/cli.mjs write-data-manifest \
  --data-version "$DATA_VERSION" \
  --base-url https://raw.githubusercontent.com/sya-ri/minecraft-skills/v0.1.0/packages/data/data
```

## Documentation To Update Last

Update documentation only after data generation and `materialize-version-details` have completed.

- `docs/VERSION_SUPPORT.md`: must reflect the final checked-in support matrix, latest aliases, Paper
  build counts, API surface availability, and heavy-data coverage.
- `README.md`: update quick-start examples if latest recommended Java/Paper versions changed.
- `docs/USAGE.md`: update CLI/API/MCP examples when latest supported versions or command shapes
  changed.
- `docs/SOURCE_STRATEGY.md`: update when source tiers, allowed structured community datasets,
  forbidden automation, or importer policy changes.
- Package READMEs under `packages/*/README.md`: keep examples aligned with `docs/USAGE.md`.
- `CHANGELOG.md`: update when preparing or amending a release.
- `CONTRIBUTING.md`: update only when the maintenance process or source policy changes.

Do not manually edit generated JSON to make documentation pass. Regenerate the data instead, then
adjust docs to match the generated facts.

## Verification

Run these before committing:

```sh
mise exec -- pnpm exec biome check . --write
CI=true mise exec -- pnpm run check
mise exec -- pnpm run publish:dry-run
mise exec -- pnpm run pack:smoke
git diff --check
```

Run `publish:dry-run` and `pack:smoke` sequentially. They both build packages and clean `dist/`, so
running them in parallel can create false failures.

Before release/tag updates, confirm:

- `git status --short` has only intentional files.
- `docs/VERSION_SUPPORT.md` latest aliases match package API output.
- `packages/data/data/data-manifest.json` uses the intended release tag in `defaultBaseUrl`.
- No `.tgz`, `tarballs`, or temporary package-smoke output is left in the repository.
