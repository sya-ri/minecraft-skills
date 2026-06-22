# minecraft-skills

CLI for version-aware Minecraft authoring facts, generated skills, and AI agent lookups.

## Install

```sh
npx minecraft-skills version latest
```

Node.js 22.12 or newer is required.

## Examples

```sh
minecraft-skills version latest
minecraft-skills skill list
minecraft-skills skill show minecraft-paper-plugins
minecraft-skills skill write minecraft-paper-plugins --output ./skills
minecraft-skills authoring context paper-plugin 1.21.11
minecraft-skills authoring recipes --domain paper-plugin
minecraft-skills authoring recipe paper-event-listener
minecraft-skills authoring search-scenarios "Paper event listener" --domain paper-plugin
minecraft-skills authoring scenarios --domain paper-plugin
minecraft-skills authoring scenario paper-event-listener-review
minecraft-skills authoring plan paper-event-listener-review 1.21.11
minecraft-skills authoring preflight paper-plugin 1.21.11
minecraft-skills authoring evidence paper-plugin 1.21.11
minecraft-skills authoring guardrails --domain paper-plugin
minecraft-skills authoring guardrail paper-api-surface-limits
minecraft-skills authoring diagnostics --domain paper-plugin
minecraft-skills authoring diagnostic paper-api-member-unverified
minecraft-skills authoring claim-policies --domain paper-plugin
minecraft-skills authoring claim-policy paper-type-or-member-exists
minecraft-skills authoring output-requirements --domain paper-plugin
minecraft-skills authoring output-requirement paper-plugin-output-safety
minecraft-skills authoring response-patterns --domain paper-plugin
minecraft-skills authoring response-pattern paper-api-answer
minecraft-skills authoring intents --domain paper-plugin
minecraft-skills authoring intent verify-paper-type-or-member
minecraft-skills authoring checklist paper-plugin
minecraft-skills authoring checklists --domain datapack
minecraft-skills authoring fact-surfaces --domain paper-plugin
minecraft-skills authoring fact-surface paper-api-surface
minecraft-skills data coverage
minecraft-skills data support-matrix
minecraft-skills version support --domain paper-plugin
minecraft-skills data manifest
minecraft-skills data fetch paper-api-surface --version 1.21.11
minecraft-skills version list
minecraft-skills version pack-formats
minecraft-skills version show 26.2
minecraft-skills version compare 1.20.6 1.21
minecraft-skills datapack server-reports latest
minecraft-skills datapack schema latest
minecraft-skills datapack search-schema latest --kind advancement --contains criteria
minecraft-skills datapack commands latest --prefix execute --limit 10
minecraft-skills datapack compare-commands 1.20.6 1.21 --prefix attribute
minecraft-skills datapack vanilla-paths latest --contains recipe
minecraft-skills resourcepack vanilla-paths latest --contains models/block
minecraft-skills resourcepack compare-vanilla-paths 1.20.6 1.21 --prefix assets/minecraft/models/item/
minecraft-skills resourcepack models latest
minecraft-skills resourcepack search-models latest --kind item-definition --contains bundle
minecraft-skills paper info
minecraft-skills paper api 1.21.11
minecraft-skills paper api-index 1.21.11
minecraft-skills paper api-surface 1.21.11
minecraft-skills paper types 1.21.11 --contains org.bukkit.entity.Player
minecraft-skills paper members 1.21.11 --type org.bukkit.entity.Player --contains sendMessage
minecraft-skills paper compare-api 1.20.4 1.21.11
minecraft-skills paper compare-api-surface 1.21.11 1.21.11
minecraft-skills paper events "player join" --version 1.21.11
```

`data support-matrix` shows the latest bundled aliases and which generated surfaces are bundled or
downloadable. `data manifest`, `data cache-dir`, `data cache-list`, `data cache-clean`, and
`data fetch` manage SHA-256 verified heavyweight data in the local OS cache.
`authoring context <domain> [version]` returns preflight, recipes, scenarios, guardrails,
diagnostics, intent lookup routing, and evidence in one payload for starting an authoring task.
`authoring recipes` lists ordered workflows for common authoring tasks.
`authoring search-scenarios <query>` searches existing scenario, recipe, and intent text so an
agent can route task wording to a scenario without inventing one.
`authoring scenarios` lists realistic task shapes and required lookup IDs for evaluation.
`authoring plan <scenario-id> [version]` resolves one scenario into the exact recipes, intent
lookups, diagnostics, claim policies, fact surfaces, response patterns, and optional evidence to use.
`authoring guardrails` lists output rules and required evidence that prevent unsupported claims.
`authoring diagnostics` lists pass/fail checks to run before returning generated files, code, or
source-backed answers.
`authoring claim-policies` maps claim types to required evidence plus allowed and disallowed wording.
`authoring output-requirements` lists final-answer and generated-file checks for one authoring
domain.
`authoring response-patterns` lists source-backed answer shapes for verified facts, missing evidence, and
safe gap wording.
`authoring preflight <domain> [version]` returns resolved version coverage, the domain checklist,
fact surfaces, relevant downloadable data, and warnings. `authoring checklist <domain>` returns
only the pre-generation checks an AI agent should perform before writing files or code.
`authoring fact-surfaces` explains what each machine-verifiable data surface can and cannot prove.
`version support` lists per-version coverage and surface availability for choosing a target version.
`authoring evidence <domain> [version]` returns source policy, source URLs, relevant data files, and
warnings for provenance-aware answers.
`authoring intents` maps authoring intents to the exact CLI/MCP/package APIs and evidence surfaces
an agent should inspect before answering.

## Data Sources

Bundled facts come from Mojang version metadata, extracted official client/server jars, PaperMC API
and docs, and the `sya-ri/spigot-event-list` API contract. Minecraft Wiki is used only for
navigation and provenance, not redistributed prose.
