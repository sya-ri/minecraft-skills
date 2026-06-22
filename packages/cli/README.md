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
minecraft-skills skills
minecraft-skills skill minecraft-paper-plugins
minecraft-skills write-skill minecraft-paper-plugins --output ./skills
minecraft-skills authoring-context paper-plugin 1.21.11
minecraft-skills authoring-recipes --domain paper-plugin
minecraft-skills authoring-recipe paper-event-listener
minecraft-skills preflight paper-plugin 1.21.11
minecraft-skills evidence paper-plugin 1.21.11
minecraft-skills authoring-guardrails --domain paper-plugin
minecraft-skills authoring-guardrail paper-api-surface-limits
minecraft-skills claim-policies --domain paper-plugin
minecraft-skills claim-policy paper-type-or-member-exists
minecraft-skills output-requirements --domain paper-plugin
minecraft-skills output-requirement paper-plugin-output-safety
minecraft-skills response-patterns --domain paper-plugin
minecraft-skills response-pattern paper-api-answer
minecraft-skills intent-lookups --domain paper-plugin
minecraft-skills intent-lookup verify-paper-type-or-member
minecraft-skills authoring-checklist paper-plugin
minecraft-skills authoring-checklists --domain datapack
minecraft-skills fact-surfaces --domain paper-plugin
minecraft-skills fact-surface paper-api-surface
minecraft-skills coverage
minecraft-skills support-matrix
minecraft-skills version-support --domain paper-plugin
minecraft-skills data-manifest
minecraft-skills fetch-data paper-api-surface --version 1.21.11
minecraft-skills versions
minecraft-skills pack-formats
minecraft-skills show-version 26.2
minecraft-skills compare-versions 1.20.6 1.21
minecraft-skills server-reports latest
minecraft-skills datapack-schema latest
minecraft-skills search-datapack-schema latest --kind advancement --contains criteria
minecraft-skills commands latest --prefix execute --limit 10
minecraft-skills compare-commands 1.20.6 1.21 --prefix attribute
minecraft-skills vanilla-paths latest --domain datapack --contains recipe
minecraft-skills vanilla-paths latest --domain resourcepack --contains models/block
minecraft-skills compare-vanilla-paths 1.20.6 1.21 --domain resourcepack --prefix assets/minecraft/models/item/
minecraft-skills resourcepack-models latest
minecraft-skills search-models latest --kind item-definition --contains bundle
minecraft-skills paper
minecraft-skills paper-api 1.21.11
minecraft-skills paper-api-index 1.21.11
minecraft-skills paper-api-surface 1.21.11
minecraft-skills paper-types 1.21.11 --contains org.bukkit.entity.Player
minecraft-skills paper-members 1.21.11 --type org.bukkit.entity.Player --contains sendMessage
minecraft-skills compare-paper-api 1.20.4 1.21.11
minecraft-skills compare-paper-api-surface 1.21.11 1.21.11
minecraft-skills paper-events "player join" --version 1.21.11
```

`support-matrix` shows the latest bundled aliases and which generated surfaces are bundled or
downloadable. `data-manifest`, `cache-dir`, `cache-list`, `cache-clean`, and `fetch-data` manage
SHA-256 verified heavyweight data in the local OS cache.
`authoring-context <domain> [version]` returns preflight, recipes, guardrails, intent lookup
routing, and evidence in one payload for starting an authoring task.
`authoring-recipes` lists ordered workflows for common authoring tasks.
`authoring-guardrails` lists output rules and required evidence that prevent unsupported claims.
`claim-policies` maps claim types to required evidence plus allowed and disallowed wording.
`output-requirements` lists final-answer and generated-file checks for one authoring domain.
`response-patterns` lists source-backed answer shapes for verified facts, missing evidence, and
safe gap wording.
`preflight <domain> [version]` returns resolved version coverage, the domain checklist, fact
surfaces, relevant downloadable data, and warnings. `authoring-checklist <domain>` returns only the
pre-generation checks an AI agent should perform before writing files or code. `fact-surfaces`
explains what each machine-verifiable data surface can and cannot prove.
`version-support` lists per-version coverage and surface availability for choosing a target version.
`evidence <domain> [version]` returns source policy, source URLs, relevant data files, and warnings
for provenance-aware answers.
`intent-lookups` maps authoring intents to the exact CLI/MCP/package APIs and evidence surfaces an
agent should inspect before answering.

## Data Sources

Bundled facts come from Mojang version metadata, extracted official client/server jars, PaperMC API
and docs, and the `sya-ri/spigot-event-list` API contract. Minecraft Wiki is used only for
navigation and provenance, not redistributed prose.
