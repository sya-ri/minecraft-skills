# minecraft-skills

CLI for version-aware Minecraft authoring facts, generated skills, and AI agent lookups.

## Install

```sh
npx minecraft-skills minecraft latest
```

Node.js 22.12 or newer is required.

## Examples

```sh
minecraft-skills minecraft latest
minecraft-skills skill list
minecraft-skills skill show minecraft-paper-plugins
minecraft-skills skill write minecraft-paper-plugins --output ./skills
minecraft-skills plugin paper context 26.2
minecraft-skills plugin paper recipes
minecraft-skills plugin paper recipe paper-event-listener
minecraft-skills plugin paper search-scenarios "Paper event listener"
minecraft-skills plugin paper scenarios
minecraft-skills plugin paper scenario paper-event-listener-review
minecraft-skills plugin paper plan paper-event-listener-review 26.2
minecraft-skills plugin paper preflight 26.2
minecraft-skills plugin paper evidence 26.2
minecraft-skills plugin paper guardrails
minecraft-skills plugin paper guardrail paper-api-surface-limits
minecraft-skills plugin paper diagnostics
minecraft-skills plugin paper diagnostic paper-api-member-unverified
minecraft-skills plugin paper claim-policies
minecraft-skills plugin paper claim-policy paper-type-or-member-exists
minecraft-skills plugin paper output-requirements
minecraft-skills plugin paper output-requirement paper-plugin-output-safety
minecraft-skills plugin paper response-patterns
minecraft-skills plugin paper response-pattern paper-api-answer
minecraft-skills plugin paper intents
minecraft-skills plugin paper intent verify-paper-type-or-member
minecraft-skills plugin paper checklist
minecraft-skills datapack checklists
minecraft-skills plugin paper fact-surfaces
minecraft-skills plugin paper fact-surface paper-api-surface
minecraft-skills data coverage
minecraft-skills minecraft support-matrix
minecraft-skills minecraft support --domain paper-plugin
minecraft-skills data manifest
minecraft-skills data fetch paper-api-surface --version 26.2
minecraft-skills minecraft list
minecraft-skills minecraft search-all "bundle item model" --domain resourcepack
minecraft-skills minecraft suggest-lookups "migrate resource pack item model" --domain resourcepack
minecraft-skills minecraft explain-path 26.2 assets/example/items/widget.json --domain resourcepack
minecraft-skills minecraft pack-formats
minecraft-skills minecraft pack-format 26.2 datapack
minecraft-skills minecraft versions-for-pack-format resourcepack 88
minecraft-skills minecraft show 26.2
minecraft-skills minecraft compare 1.20.6 1.21
minecraft-skills datapack server-reports latest
minecraft-skills datapack schema latest
minecraft-skills datapack find execute
minecraft-skills datapack search-schema latest --kind advancement --contains criteria
minecraft-skills datapack commands latest --prefix execute --limit 10
minecraft-skills datapack compare-commands 1.20.6 1.21 --prefix attribute
minecraft-skills datapack vanilla-paths latest --contains recipe
minecraft-skills resourcepack vanilla-paths latest --contains models/block
minecraft-skills resourcepack compare-vanilla-paths 1.20.6 1.21 --prefix assets/minecraft/models/item/
minecraft-skills resourcepack assets status 26.2
minecraft-skills resourcepack assets fetch 26.2 --index-only
minecraft-skills resourcepack assets find "diamond sword" --kind item-definition
minecraft-skills resourcepack assets search 26.2 --contains diamond_sword --extension json --fetch
minecraft-skills resourcepack assets get 26.2 assets/minecraft/models/item/diamond_sword.json
minecraft-skills resourcepack models latest
minecraft-skills resourcepack search-models latest --kind item-definition --contains bundle
minecraft-skills resourcepack validate-project 26.2 ./my-resource-pack
minecraft-skills plugin paper info
minecraft-skills plugin paper api 26.2
minecraft-skills plugin paper api-index 26.2
minecraft-skills plugin paper api-surface 26.2
minecraft-skills plugin paper types 26.2 --contains org.bukkit.entity.Player
minecraft-skills plugin paper members 26.2 --type org.bukkit.entity.Player --contains sendMessage
minecraft-skills plugin paper compare-api 1.20.4 26.2
minecraft-skills plugin paper compare-api-surface 26.2 26.2
minecraft-skills plugin paper events "player join" --version 26.2
minecraft-skills fabric toolchain 1.21.11 --limit 10 --timeout-ms 5000
minecraft-skills modrinth search "voice chat" --version 1.21.11 --type mod --loader fabric
minecraft-skills modrinth versions simple-voice-chat --game-version 1.21.11 --loader fabric
minecraft-skills modrinth get project simple-voice-chat
minecraft-skills modrinth validate-pack ./example.mrpack
minecraft-skills modrinth validate-pack ./example.mrpack --allow-download-host downloads.example.org
minecraft-skills modrinth validate-pack ./example.mrpack --max-archive-bytes 104857600
```

The Modrinth command uses the public v2 search API and supports `--category`, sorting with
`--index`, and pagination with `--offset` and `--limit` in addition to the filters shown above.

`resourcepack validate-project` recursively checks item-definition and legacy override model targets,
model parents, textures, and inherited texture variables against the project and target-version
vanilla assets. Special item-model base references are included. PNG and OGG files contribute paths
to the graph without being decoded as text. Invalid graphs are printed as JSON and return exit code 1.
`modrinth versions` accepts a project ID or slug and optional `--featured` and
`--include-changelog` boolean filters.
`modrinth get` exposes the remaining common public read resources, including dependencies, version
and file-hash metadata, users, tags, and statistics.
`modrinth validate-pack` requires the `.mrpack` extension and a regular file. It bounds reads from
one opened file handle, rejecting oversized files and files whose size changes during the read,
then validates the index plus binary ZIP integrity offline. `--max-archive-bytes` can lower, but
never raise, the 512 MiB default. It does not
download or resolve referenced files. Downloads are restricted to Modrinth's documented four
hosts unless an exact host is repeated with `--allow-download-host`. An explicitly allowed
non-official host produces a warning. Invalid packs return exit code 1; warning-only packs return 0.

`fabric toolchain` reads Loader, Intermediary, and Yarn candidates from the official live Fabric
Meta v2 API. It prefers upstream `stable` entries without treating that flag as a complete project
compatibility guarantee. Generated tuples only combine entries listed for the same game version;
they are not a separately published Fabric Meta guarantee. The command bounds returned candidates
and reports versions without Yarn as incomplete instead of guessing.

`minecraft support-matrix` shows the latest bundled aliases and which generated surfaces are bundled or
downloadable. `data manifest`, `data cache-dir`, `data cache-list`, `data cache-clean`, and
`data fetch` manage SHA-256 verified heavyweight data in the local OS cache.
`datapack context [version]`, `resourcepack context [version]`, or `plugin paper context [version]` returns preflight, recipes, scenarios, guardrails,
diagnostics, intent lookup routing, and evidence in one payload for starting an authoring task.
`datapack recipes`, `resourcepack recipes`, or `plugin paper recipes` lists ordered workflows for common authoring tasks.
`plugin paper search-scenarios <query>` searches existing scenario, recipe, and intent text so an
agent can route task wording to a scenario without inventing one.
`datapack scenarios`, `resourcepack scenarios`, or `plugin paper scenarios` lists realistic task shapes and required lookup IDs for evaluation.
`datapack plan <scenario-id> [version]`, `resourcepack plan <scenario-id> [version]`, or `plugin paper plan <scenario-id> [version]` resolves one scenario into the exact recipes, intent
lookups, diagnostics, claim policies, fact surfaces, response patterns, and optional evidence to use.
`datapack guardrails`, `resourcepack guardrails`, or `plugin paper guardrails` lists output rules and required evidence that prevent unsupported claims.
`datapack diagnostics`, `resourcepack diagnostics`, or `plugin paper diagnostics` lists pass/fail checks to run before returning generated files, code, or
source-backed answers.
`datapack claim-policies`, `resourcepack claim-policies`, or `plugin paper claim-policies` maps claim types to required evidence plus allowed and disallowed wording.
`datapack output-requirements`, `resourcepack output-requirements`, or `plugin paper output-requirements` lists final-answer and generated-file checks for one authoring
domain.
`datapack response-patterns`, `resourcepack response-patterns`, or `plugin paper response-patterns` lists source-backed answer shapes for verified facts, missing evidence, and
safe gap wording.
`datapack preflight [version]`, `resourcepack preflight [version]`, or `plugin paper preflight [version]` returns resolved version coverage, the domain checklist,
fact surfaces, relevant downloadable data, and warnings. `datapack checklist`, `resourcepack checklist`, or `plugin paper checklist` returns
only the pre-generation checks an AI agent should perform before writing files or code.
`datapack fact-surfaces`, `resourcepack fact-surfaces`, or `plugin paper fact-surfaces` explains what each machine-verifiable data surface can and cannot prove.
`minecraft support` lists per-version coverage and surface availability for choosing a target version.
`datapack evidence [version]`, `resourcepack evidence [version]`, or `plugin paper evidence [version]` returns source policy, source URLs, relevant data files, and
warnings for provenance-aware answers. `source report [domain] [version]` returns source tiers,
prohibited automation, structured community datasets, and optional domain/version provenance.
`source datasets` lists recommended structured community datasets such as PrismarineJS and
misode/mcmeta.
`datapack intents`, `resourcepack intents`, or `plugin paper intents` maps authoring intents to the exact CLI commands and evidence surfaces
an agent should inspect before answering.

## Data Sources

Bundled facts come from Mojang version metadata and downloads served through Piston endpoints,
extracted official client/server jars, PaperMC API and docs, structured community datasets, and the
`sya-ri/spigot-event-list` API contract. Minecraft Wiki is human-only background; AI workflows
should not fetch, crawl, summarize, or cite Wiki pages.
