# minecraft-skills

CLI for version-aware Minecraft authoring facts, generated skills, and AI agent lookups.

## Install

```sh
npx minecraft-skills latest
```

Node.js 22.12 or newer is required.

## Examples

```sh
minecraft-skills latest
minecraft-skills versions
minecraft-skills pack-formats
minecraft-skills show-version 26.2
minecraft-skills compare-versions 1.20.6 1.21
minecraft-skills server-reports latest
minecraft-skills commands latest --prefix execute --limit 10
minecraft-skills vanilla-paths latest --domain datapack --contains recipe
minecraft-skills vanilla-paths latest --domain resourcepack --contains models/block
minecraft-skills resourcepack-models latest
minecraft-skills search-models latest --kind item-definition --contains bundle
minecraft-skills paper
minecraft-skills paper-events "player join" --version 1.21.11
```

## Data Sources

Bundled facts come from Mojang version metadata, extracted official client/server jars, PaperMC API
and docs, and the `sya-ri/spigot-event-list` API contract. Minecraft Wiki is used only for
navigation and provenance, not redistributed prose.
