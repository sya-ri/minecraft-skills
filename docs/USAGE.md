# Usage

This guide maps the public minecraft-skills interfaces and explains what each command or capability
provides. Install the CLI or MCP server first by following the
[installation instructions](../README.md#installation).

Most structured lookup, analysis, and validation commands print JSON. Discovery, cache, and
file-writing commands may return plain text or paths. Missing, unknown, and not-extracted fields are
coverage gaps, not permission to guess.

## Choose an Interface

| Interface | Use it for |
| --- | --- |
| [CLI](#cli) | Local files, cache management, optional evaluation history, shell workflows, and direct JSON output. |
| [MCP](#mcp) | Giving an AI agent structured Minecraft lookup, validation, and authoring tools. |
| [Package APIs](#package-apis) | Calling the same catalog, validation, data, or RCON capabilities from TypeScript. |
| [Agent Skills](#agent-skills) | Teaching compatible agents the lookup order, evidence rules, and authoring workflow for a domain. |

## CLI

The command tree starts with:

```text
minecraft-skills <group> <subcommand> [arguments] [options]
```

In this guide, `minecraft-skills` denotes the CLI executable. When using the published package as
described in the [installation instructions](../README.md#cli), run it as `npx minecraft-skills`.
For example, run `npx minecraft-skills help` for complete argument and option syntax.

The sections below mirror the public command tree; each heading supplies the prefix for the
subcommands in its table.

### Command Groups

| Group | Use it for |
| --- | --- |
| [`minecraft`](#minecraft-skills-minecraft) | Versions, pack formats, cross-domain search, registries, logs, performance, and server-file validation. |
| [`datapack`](#minecraft-skills-datapack) | Data pack authoring guidance, commands, schemas, vanilla data, migration, and project validation. |
| [`resourcepack`](#minecraft-skills-resourcepack) | Resource pack guidance, assets, models, images, audio, translations, migration, and validation. |
| [`plugin`](#minecraft-skills-plugin) | Paper authoring and API lookup, plus Paper and Velocity plugin JAR preflight. |
| [`fabric`](#minecraft-skills-fabric) | Fabric toolchain lookup, rendering API search, and local mod inspection. |
| [`velocity`](#minecraft-skills-velocity) | Current Velocity toolchain lookup. |
| [`modrinth`](#minecraft-skills-modrinth) | Public project/version metadata, compatibility intersections, and modpack validation. |
| [`server`](#minecraft-skills-server) | Local server configuration validation. |
| [`player-profile`](#minecraft-skills-player-profile) | Java profile identity and verified signed texture metadata. |
| [`player-skin`](#minecraft-skills-player-skin) | Java skin dimensions and face-layout checks. |
| [`player-texture`](#minecraft-skills-player-texture) | Fixed-host texture download by validated 64-hex reference hash. |
| [`blockbench`](#minecraft-skills-blockbench) | Bounded Blockbench project metadata inspection. |
| [`rcon`](#minecraft-skills-rcon) | Permission-gated RCON configuration and execution. |
| [`data`](#minecraft-skills-data) | Heavy-data manifests, downloads, cache inspection, and coverage. |
| [`skill`](#minecraft-skills-skill) | Bundled Agent Skill discovery and export. |
| [`source`](#minecraft-skills-source) | Source policy, provenance reports, tiers, and structured datasets. |
| [`domain`](#minecraft-skills-domain) | Supported authoring-domain discovery. |
| [`reference`](#minecraft-skills-reference) | Bundled reference discovery. |
| [`evaluation`](#minecraft-skills-evaluation) | Opt-in local MCP request, response, and quality history. |

### Shared Authoring Commands

The `datapack`, `resourcepack`, and `plugin paper` CLI groups share the same authoring commands.
Replace `<domain>` below with one of those three prefixes.

| Subcommand | Purpose |
| --- | --- |
| `<domain> context [version]` | Get the broad domain context: preflight, guidance, scenarios, diagnostics, evidence, and response rules. |
| `<domain> preflight [version]` | Check version support, available data surfaces, downloads, and known gaps before authoring. |
| `<domain> evidence [version]` | Get the source policy, relevant files, links, and warnings for a source-backed answer. |
| `<domain> search <query>` | Search lightweight catalog entries, optionally narrowed by entry kind. |
| `<domain> search-scenarios <query>` | Route task wording to matching scenarios, recipes, and intent lookups. |
| `<domain> plan <scenario-id> [version]` | Resolve one scenario into its required recipes, diagnostics, policies, fact surfaces, and evidence. |
| `<domain> checklists` / `<domain> checklist` | List checklists for the domain or get its checklist. |
| `<domain> recipes` / `<domain> recipe <id>` | List authoring workflows or get one workflow. |
| `<domain> scenarios` / `<domain> scenario <id>` | List realistic task shapes or get one scenario. |
| `<domain> guardrails` / `<domain> guardrail <id>` | List safety constraints or get one guardrail. |
| `<domain> diagnostics` / `<domain> diagnostic <id>` | List final pass/fail checks or get one diagnostic. |
| `<domain> intents` / `<domain> intent <id>` | List intent-to-lookup routes or get one route. |
| `<domain> fact-surfaces` / `<domain> fact-surface <id>` | List what machine-verifiable surfaces can prove or get one surface. |
| `<domain> claim-policies` / `<domain> claim-policy <id>` | List evidence and wording policies or get one policy. |
| `<domain> output-requirements` / `<domain> output-requirement <id>` | List generated-output checks or get one requirement. |
| `<domain> response-patterns` / `<domain> response-pattern <id>` | List answer shapes for verified facts and gaps or get one pattern. |

Before an intent-based search, translate non-English task wording into concise English Minecraft
terms. Keep exact identifiers, namespace IDs, paths, project titles, and content literals unchanged,
and answer in the user's requested language.

### `minecraft-skills minecraft`

| Subcommand | Purpose |
| --- | --- |
| `latest` | Print the latest bundled Java release. |
| `list` / `versions` | List bundled Minecraft Java versions. |
| `show <version>` | Get one version's metadata and domain coverage. |
| `compare <from> <to>` | Compare version metadata and support. |
| `support [--domain <domain>]` | List version support entries, optionally narrowed by authoring domain. |
| `support-matrix` | Get aliases plus bundled and downloadable data availability. |
| `pack-formats` | List known data pack and resource pack formats. |
| `pack-format [version] [domain]` | Resolve a version's pack format. |
| `versions-for-pack-format <domain> <format> [minor]` | Find versions that use a pack format. |
| `vanilla-inventory [version]` | Get the extracted vanilla client/server path inventory. |
| `sources [domain] [version]` | Get the same provenance report as `source report`. |
| `search <query>` | Search catalog guidance, references, datasets, and support entries. |
| `search-all <query>` | Search across commands, registries, vanilla paths, models, assets, Paper APIs, and events. |
| `registry-entries [version]` | Search official registry entry indexes. |
| `compare-registry-entries <from> <to>` | Compare indexed entries and protocol IDs between versions. |
| `analyze-log <file>` | Structure a bounded Minecraft log, crash report, exception chain, and explicit Mixin/class-loading evidence. |
| `analyze-performance <file>` | Summarize a normalized performance time series and observed threshold violations. |
| `explain-path [version] <path>` | Explain a data pack or resource pack path in version context. |
| `suggest-lookups <task>` | Suggest the smallest lookup sequence for a task. |
| `validate-access-list <file>` | Validate canonical whitelist, operator, and ban-list JSON without returning private values. |
| `validate-mixin-config <file>` | Preflight a bounded Mixin configuration and optional archive-entry metadata. |

`minecraft search-all` / MCP `search_all` remains read-only and offline. Missing downloadable
data pack schema or Paper API indexes no longer prevent searches of available sources. Results
include `searchComplete: false`, structured `unavailableSurfaces`, and human-readable `gaps`.
For a manifest-listed download, an entry's `fetch` object can be passed to MCP `fetch_data`;
the corresponding CLI recovery is `minecraft-skills data fetch <kind> --version <version>`.
Fetch explicitly and retry to include that index. An unsupported Paper version is reported without
substituting another version's API. Corrupt indexed data still raises an error.

`searchComplete` concerns the availability of sources within the selected domain, including the
optional community asset cache; it does not certify full Minecraft knowledge or client behavior.
`truncated` independently indicates result limits, not missing sources. An empty partial result is
not evidence that a type, member, or behavior does not exist.

See [Performance Time-Series Analysis](../packages/cli/README.md#performance-time-series-analysis)
for the input contract and [Mixin Configuration Validation](MIXIN_CONFIG_VALIDATION.md) for that
validator's exact scope.

### `minecraft-skills datapack`

This group also supports every [shared authoring command](#shared-authoring-commands).

| Subcommand | Purpose |
| --- | --- |
| `server-reports [version]` | Get extracted server report summaries. |
| `schema [version]` | Get the downloadable data pack schema surface for a version. |
| `search-schema [version]` | Search observed data pack JSON kinds, paths, and fields. |
| `compare-schema <from> <to>` | Compare observed JSON schema surfaces. |
| `classify-files <path...>` | Classify paths by version-independent data pack file kind. |
| `file-schema [version] <path>` | Get the best available non-normative schema for a path. |
| `validate-files <version> <file...>` | Validate caller-selected files against available pack schemas. |
| `validate-project <version> <directory>` | Scan and validate a bounded local project, paths, contents, and supported reference graphs. |
| `migration-plan <from> <to> [path...]` | Build a version-aware migration checklist for selected paths. |
| `find <query>` | Search data pack entries from task wording. |
| `commands [version]` | Search the Brigadier command tree. |
| `compare-commands <from> <to>` | Compare command-tree paths between versions. |
| `vanilla-paths [version]` | Search extracted vanilla data paths. |
| `compare-vanilla-paths <from> <to>` | Compare vanilla data paths between versions. |

#### `minecraft-skills datapack vanilla-json`

These commands use official server JAR data cached by minecraft-skills.

| Subcommand | Purpose |
| --- | --- |
| `status [version]` | Inspect the cached server JAR status. |
| `fetch [version]` | Download and verify the official server JAR. |
| `clean [version]` | Remove the selected cached server JAR. |
| `files [version]` | Search JSON paths inside the verified server JAR. |
| `get <version> <path>` | Read one bounded vanilla `data/**/*.json` file. |
| `search <query>` | Search parsed keys or primitive values across vanilla JSON files. |

### `minecraft-skills resourcepack`

This group also supports every [shared authoring command](#shared-authoring-commands).

| Subcommand | Purpose |
| --- | --- |
| `models [version]` | Get the downloadable model and item-definition summary. |
| `search-models [version]` | Search model and item-definition paths and observed shapes. |
| `vanilla-paths [version]` | Search extracted vanilla asset paths. |
| `compare-vanilla-paths <from> <to>` | Compare vanilla asset paths between versions. |
| `classify-files <path...>` | Classify paths by version-independent resource pack file kind. |
| `file-schema [version] <path>` | Get the best available non-normative schema for a path. |
| `validate-files <version> <file...>` | Validate caller-selected files against available pack schemas. |
| `inspect-png-alpha <file>` | Inspect bounded static PNG alpha content, bounds, margins, and optional policies. |
| `validate-png <file>` | Validate complete PNG container structure, methods, ordering, and CRCs. |
| `validate-project <version> <directory>` | Validate a bounded project including models, textures, sounds, and local reference graphs. |
| `validate-translations <version> <file...> --pack-root <dir>` | Compare locale keys, duplicate-key evidence, and placeholders for selected locales. |
| `migration-plan <from> <to> [path...]` | Build a version-aware migration checklist for selected paths. |

#### `minecraft-skills resourcepack assets`

| Subcommand | Purpose |
| --- | --- |
| `status [version]` | Inspect the external vanilla asset cache for a version. |
| `fetch [version]` | Download the searchable asset index and, unless excluded, its archive. |
| `search [version]` | Search cached vanilla asset paths with path filters. |
| `find <query>` | Find likely models, item definitions, textures, sounds, languages, blockstates, atlases, or fonts from task wording. |
| `related [version] <path>` | Classify one asset path and return schema notes plus suggested next lookups. |
| `get <version> <path>` | Download and cache one bounded asset, then report its cache metadata. |

#### `minecraft-skills resourcepack sound`

| Subcommand | Purpose |
| --- | --- |
| `inspect <file.wav>` | Inspect bounded PCM/IEEE-float WAVE structure and sample peak/RMS facts. |

See [WAVE Audio Inspection](WAVE_AUDIO_INSPECTION.md) for the parser and signal-metric boundary.

### `minecraft-skills plugin`

| Subcommand group | Purpose |
| --- | --- |
| `paper` | Paper authoring guidance, API lookup, events, comparisons, and plugin JAR preflight. |
| `velocity` | Velocity plugin JAR preflight. |

#### `minecraft-skills plugin paper`

This group also supports every [shared authoring command](#shared-authoring-commands).

| Subcommand | Purpose |
| --- | --- |
| `info` | Get Paper support and source metadata. |
| `api [version]` | Resolve the Paper API dependency and documentation links. |
| `api-index [version]` | Get the Paper package/class index. |
| `compare-api <from> <to>` | Compare Paper package/class indexes. |
| `api-surface [version]` | Get the downloadable type/member surface. |
| `types [version]` | Search qualified Paper/Bukkit types. |
| `members [version]` | Search members within the type/member surface. |
| `compare-api-surface <from> <to>` | Compare Paper types and members between versions. |
| `events <query>` | Find event candidates and cross-check available version evidence. |
| `validate-jar <file.jar>` | Preflight a bounded local Paper/Bukkit plugin JAR and its active descriptor. |

Paper indexes prove API-name presence, not runtime behavior, nullability, overload semantics,
thread safety, or Folia safety. Resolve a matching authoring plan before turning names into code.

#### `minecraft-skills plugin velocity`

| Subcommand | Purpose |
| --- | --- |
| `validate-jar <file.jar>` | Preflight a bounded Velocity plugin JAR, descriptor, entrypoint class, Java target, and annotation evidence. |

### `minecraft-skills fabric`

| Subcommand | Purpose |
| --- | --- |
| `toolchain <game-version>` | Resolve the maintained mapping mode and Loom plugin, plus bounded Loader, Intermediary, and Yarn candidates from official Fabric Meta. |
| `validate-mod <file.jar>` | Validate bounded current `fabric.mod.json` schema-v1 and archive structure offline. |

#### `minecraft-skills fabric api`

| Subcommand | Purpose |
| --- | --- |
| `types <game-version>` | Search official Fabric API rendering Javadoc type names with `--query`, `--package-prefix`, and `--limit`. |
| `members <game-version>` | Search declared rendering members with `--query`, `--type`, `--kind`, `--package-prefix`, and `--limit`. |

Both searches resolve the highest Fabric API numeric version with the exact Minecraft suffix,
verify the official fat Javadoc archive, and return bounded structured evidence without prose.
Use `--timeout-ms` to set the shared network deadline (default 15,000 ms, maximum 60,000 ms).
The default result limit is 50 and the maximum is 200. Only Fabric API's `client.rendering.v1`
and `client.renderer.v1` package trees are covered; Mojang client APIs, inherited members, behavior,
return types, generic bounds, and parameter names remain unverified. See
[the source and parsing boundaries](SOURCE_STRATEGY.md#fabric-api-rendering-surface).

```sh
minecraft-skills fabric api types 26.2 --query LevelRenderEvents --limit 10
minecraft-skills fabric api members 26.2 --type ArmorRenderer --query register --kind method
```

#### `minecraft-skills fabric mods`

| Subcommand | Purpose |
| --- | --- |
| `inventory <directory>` | Inventory direct lowercase `.jar` files and report bounded identity, hash, metadata, and validation facts. |
| `diff <left> <right>` | Compare two inventories by unique valid mod ID and keep ambiguous entries explicit. |

### `minecraft-skills velocity`

| Subcommand | Purpose |
| --- | --- |
| `toolchain` | Resolve the current Velocity API coordinate, documentation, and applicable Java requirement. |

### `minecraft-skills modrinth`

| Subcommand | Purpose |
| --- | --- |
| `search <query>` | Search public Modrinth projects with optional version, type, loader, and category filters. |
| `versions <project>` | List public versions for one project. |
| `compatibility <project...>` | Find common game-version/loader metadata pairs across projects without claiming runtime interoperability. |
| `get <resource> [identifier]` | Read supported public project, version, user, taxonomy, or statistics resources. |
| `validate-pack <file.mrpack>` | Validate a local Modrinth pack archive and index without downloading referenced files. |

### `minecraft-skills server`

| Subcommand | Purpose |
| --- | --- |
| `validate-properties [file]` | Conservatively validate Java Properties syntax, stable scalar types, duplicates, and file-local correlations without returning values. |

### `minecraft-skills player-profile`

| Subcommand | Purpose |
| --- | --- |
| `lookup-name <name>` | Resolve bounded Java profile identity through a fixed Mojang service. |
| `textures <uuid>` | Verify signed texture metadata and profile/session binding through a fixed Mojang service. |

### `minecraft-skills player-skin`

| Subcommand | Purpose |
| --- | --- |
| `validate-layout <file>` | Combine complete PNG structure checks with accepted Java skin dimensions and optional face rectangles. |

### `minecraft-skills player-texture`

| Subcommand | Purpose |
| --- | --- |
| `download <hash> --kind <texture-kind> --output <new.png>` | Download one skin, cape, or elytra PNG from the fixed official host into a new file. |

### `minecraft-skills blockbench`

| Subcommand | Purpose |
| --- | --- |
| `inspect-project <file.bbmodel>` | Inspect bounded project metadata and exact animation/group names without claiming rendering or export validity. |

### `minecraft-skills rcon`

| Subcommand | Purpose |
| --- | --- |
| `init` | Write a new example configuration with a selected permission preset. |
| `status` | Inspect resolved configuration without printing secrets. |
| `run <command...>` | Run one command only when the selected profile allows it. |

See [RCON](RCON.md) for configuration locations, permission presets, and MCP behavior.

### `minecraft-skills data`

| Subcommand | Purpose |
| --- | --- |
| `manifest` | List heavy generated surfaces and their download metadata. |
| `fetch <kind> [--version <version>]` | Download and verify data by kind, or select one manifest entry with `--path <path>`. |
| `cache-dir` | Print the resolved cache root. |
| `cache-list` | List cached entries. |
| `cache-clean` | Remove cached generated data for the current data version. |
| `coverage` | Summarize bundled and downloadable fact coverage. |

### `minecraft-skills skill`

| Subcommand | Purpose |
| --- | --- |
| `list` | List bundled Agent Skill folders. |
| `show <name>` | Print one packaged Agent Skill payload. |
| `write <name> --output <dir>` | Write one packaged Agent Skill folder to disk. |

### `minecraft-skills source`

| Subcommand | Purpose |
| --- | --- |
| `policy` | Get the project-wide source and redistribution policy. |
| `report [domain] [version]` | Get domain/version provenance, relevant files, links, and warnings. |
| `tiers` / `tier <id>` | List source tiers or get one tier. |
| `datasets` / `dataset <id>` | List approved structured community datasets or get one dataset. |
| `search <query> [--kind <source-kind>]` | Search catalog entries, optionally restricted to source tiers or community datasets. |

### `minecraft-skills domain`

| Subcommand | Purpose |
| --- | --- |
| `list` | List supported authoring domains. |
| `show <domain>` | Get one domain's description, status, skill, and primary sources. |

### `minecraft-skills reference`

| Subcommand | Purpose |
| --- | --- |
| `list` | List bundled reference documents, optionally narrowed by domain. |

### `minecraft-skills evaluation`

Evaluation history is disabled by default. When explicitly enabled, the MCP server stores raw tool
arguments and results under `~/.minecraft-skills/evaluation`; it does not store conversation text,
ordinary CLI commands, MCP resources, or prompts. It never uploads, expires, or deletes records
automatically. Restart the MCP server after enabling recording so agents receive its evaluation
instructions.

| Subcommand | Purpose |
| --- | --- |
| `status` | Show global and current-directory effective state, marker, storage path, and record count. |
| `enable` / `disable` | Change the global opt-in without deleting existing records. |
| `search [query] [filters]` | Search newest summaries without displaying raw requests or responses. |
| `show <id>` | Display one complete raw record after a privacy warning. |
| `rate <id> --score <1-5> --information-need <text> --comment <text>` | Add or replace an evaluation; repeat `--missing-feature <key>=<summary>` as needed. |
| `gaps [query] [filters]` | Group recurring missing capabilities by stable key. |
| `delete <id...>` | Delete named records. |
| `delete --all --yes` | Explicitly delete all records and owned crash-residue record temp files. |

`search` filters are `--tool <name>`, `--evaluated <true|false>`, `--min-score <1-5>`,
`--max-score <1-5>`, `--missing-feature <key>`, `--since <ISO timestamp>`,
`--until <ISO timestamp>`, and `--limit <1-100>`. The free-text query searches only tool and
evaluation metadata. `gaps` accepts the same filters except `--evaluated`; its query searches gap
metadata, and it returns every matching aggregate.

Create `.minecraft-skills/evaluation.disabled` in a sensitive project to override the global
opt-in. See [Optional Evaluation History](EVALUATION_HISTORY.md) for raw-data warnings, MCP-root
fallback behavior, record schema, score anchors, and the manual sanitized Issue flow.

## MCP

The MCP server exposes the same catalog as flat tools, resources, and prompts. This section groups
the flat tool namespace by purpose; see the [MCP package reference](../packages/mcp/README.md#tools)
for package-level tool details and input schemas.

### Evaluation History

When local recording is enabled, each ordinary tool result appends an assistant-audience evaluation
receipt with its stored record ID and carries the same ID in
`_meta["minecraft-skills/evaluationRecordId"]`. `get_evaluation_status` reports the effective state
and current MCP/catalog data versions, `list_pending_evaluations` returns up to 100 newest
process-local unevaluated calls with their recorded MCP/catalog data versions, and
`record_tool_evaluation` records the information need, 1-5 score, comment, and optional missing
features. Evaluate each call immediately from its same-call receipt. Never map multiple same-name
pending calls by position or timestamps. Reuse stable keys for the same in-scope capability, and put
wrong-tool or out-of-scope gaps in the comment instead of `missingFeatures`. These management tools
are excluded from history. Pending results contain only ID, timestamps, tool, outcome, and recorded
MCP/catalog data versions; they do not repeat the raw request or response.

### Authoring Guidance

| Tools | Purpose |
| --- | --- |
| `search_catalog` | Search lightweight guidance, support, source, and reference entries. |
| `get_authoring_context` | Get the broad authoring payload for a domain and optional version. |
| `get_authoring_preflight`, `get_evidence_bundle` | Check support and obtain provenance before authoring. |
| `list_authoring_*`, `get_authoring_*` | Read checklists, recipes, scenarios, guardrails, and diagnostics. |
| `search_authoring_scenarios`, `get_authoring_plan` | Route task wording to scenarios, then resolve one into complete guidance and evidence. |
| `list_claim_policies`, `get_claim_policy` | Read evidence and wording policies. |
| `list_output_requirements`, `get_output_requirement` | Read generated-output checks. |
| `list_response_patterns`, `get_response_pattern` | Read answer shapes for verified facts and gaps. |
| `list_intent_lookups`, `get_intent_lookup` | Read intent-to-lookup routes. |
| `list_fact_surfaces`, `get_fact_surface` | Read what each machine-verifiable surface can prove. |

### Versions, Data, and Search

| Tools | Purpose |
| --- | --- |
| `latest_version`, `list_versions`, `get_version`, `compare_versions` | Resolve, list, inspect, or compare bundled Java versions. |
| `get_support_matrix`, `list_version_support` | Inspect bundled and downloadable support by version and domain. |
| `list_pack_formats`, `get_pack_format`, `find_versions_by_pack_format` | Navigate data pack and resource pack format mappings. |
| `get_coverage_summary`, `get_data_manifest` | Inspect fact coverage and downloadable surfaces. |
| `get_cache_status`, `fetch_data`, `clean_cache` | Inspect or manage heavy generated data. |
| `get_pack_migration_plan` | Build a version-aware data pack or resource pack migration checklist. |
| `search_all` | Search across the major version-aware fact surfaces. |
| `explain_pack_path`, `suggest_minecraft_lookups` | Interpret a path or plan a minimal lookup sequence. |

### Data Packs

| Tools | Purpose |
| --- | --- |
| `get_server_reports` | Read extracted official server report summaries. |
| `search_commands`, `compare_commands` | Inspect command-tree paths and changes. |
| `search_registry_entries`, `compare_registry_entries` | Inspect official registry indexes and changes. |
| `get_datapack_schema_surface`, `search_datapack_schema`, `compare_datapack_schema` | Inspect observed versioned JSON shapes. |
| `classify_pack_files`, `get_pack_file_schema`, `validate_pack_files` | Classify paths and validate caller-supplied files against available schemas. |
| `validate_datapack_json`, `validate_datapack_project` | Validate individual JSON or a bounded project and supported reference graphs. |
| `find_datapack_entries` | Search data pack commands, schema paths, and vanilla paths from task wording. |
| `get_mojang_version_metadata`, `fetch_mojang_server_jar` | Resolve official downloads and cache a verified server JAR. |
| `search_vanilla_datapack_json_files`, `search_vanilla_datapack_json_content`, `get_vanilla_datapack_json` | Search or read exact `data/**/*.json` content from the verified JAR. |
| `get_vanilla_inventory`, `search_vanilla_paths`, `compare_vanilla_paths` | Inspect or compare extracted vanilla paths. |

### Resource Packs

| Tools | Purpose |
| --- | --- |
| `get_resourcepack_model_summary`, `search_resourcepack_models` | Read or search model and item-definition summaries. |
| `get_resourcepack_assets_status`, `fetch_resourcepack_assets` | Inspect or populate the external vanilla asset cache. |
| `search_resourcepack_assets`, `find_resourcepack_assets`, `get_resourcepack_asset` | Search, discover, or read cached vanilla assets. |
| `search_vanilla_paths`, `compare_vanilla_paths` | Search or compare extracted vanilla asset paths. |
| `classify_pack_files`, `get_pack_file_schema`, `validate_pack_files` | Classify paths and validate caller-supplied files against available schemas. |
| `inspect_resourcepack_png_alpha_bounds`, `validate_resourcepack_png`, `validate_player_skin_layout` | Inspect PNG structure, alpha bounds, or Java skin layout. |
| `validate_resourcepack_project` | Validate supported model, texture, sound, and reference relationships. |
| `validate_resourcepack_translations` | Compare selected locale keys and placeholders without returning values. |

### Plugins, Platforms, and Diagnostics

| Tools | Purpose |
| --- | --- |
| `get_paper_plugin_data`, `get_paper_api_reference`, `get_paper_api_index`, `compare_paper_api` | Resolve Paper support, dependencies, documentation, and package/class indexes. |
| `get_paper_api_surface`, `search_paper_types`, `search_paper_members`, `compare_paper_api_surface` | Inspect Paper type/member surfaces and changes. Type-scoped member searches include declarations from known supertypes when Javadocs hierarchy coverage is available and report the declaring type plus every searched type. |
| `search_paper_events` | Find Paper/Bukkit event candidates. |
| `search_fabric_api_types`, `search_fabric_api_members` | Search exact-version official Fabric API rendering type/member indexes with artifact, POM, and checksum provenance; excludes Mojang client surface and behavior. |
| `validate_paper_plugin_jar`, `validate_velocity_plugin_jar` | Validate bounded descriptors and supplied archive evidence. |
| `get_fabric_toolchain`, `validate_fabric_mod`, `resolve_velocity_toolchain` | Resolve platform metadata, including Fabric mapping/Loom policy, or validate supplied Fabric mod metadata. |
| `search_modrinth_projects`, `list_modrinth_project_versions`, `resolve_modrinth_compatibility`, `get_modrinth_resource`, `validate_modrinth_pack` | Search public Modrinth metadata, intersect compatibility labels, or validate supplied pack metadata. |
| `validate_server_properties`, `validate_server_access_list`, `validate_mixin_config` | Validate server configuration and bounded Mixin evidence. |
| `analyze_minecraft_log`, `analyze_minecraft_performance`, `inspect_blockbench_project` | Structure diagnostics or inspect bounded project metadata. |
| `get_rcon_config_status`, `create_rcon_config`, `run_rcon_command` | Inspect, create, or use permission-gated RCON configuration. |
| `lookup_java_player_profile`, `get_verified_java_player_textures` | Resolve profile identity and verified signed texture metadata. |

### Sources

| Tools | Purpose |
| --- | --- |
| `list_domains`, `list_skills`, `get_skill`, `list_references` | Discover supported domains, packaged skills, and bundled references. |
| `get_source_policy`, `get_source_report` | Read the source strategy and domain/version provenance. |
| `list_source_tiers`, `get_source_tier` | Read source priority and automation rules. |
| `list_community_datasets`, `get_community_dataset`, `search_community_datasets` | Discover approved structured datasets. |

### Resources

| URI family | Contents |
| --- | --- |
| `minecraft-skills://skills/<skill>/...` | Packaged Agent Skill instructions and metadata. |
| `minecraft-skills://data/...` | Bundled versioned data and authoring catalog files. |

### Prompts

| Prompt | Domain |
| --- | --- |
| `use_minecraft_datapacks` | Java data packs. |
| `use_minecraft_resourcepacks` | Java resource packs. |
| `use_minecraft_paper_plugins` | Paper plugins. |

## Package APIs

| Package | Purpose |
| --- | --- |
| [`@minecraft-skills/catalog`](../packages/catalog) | Typed, validated read, search, comparison, analysis, and validation APIs. |
| [`@minecraft-skills/data`](../packages/data) | Direct access to bundled JSON, text, and Agent Skill payloads. |
| [`@minecraft-skills/rcon`](../packages/rcon) | RCON configuration, permission, and execution utilities. |

The Catalog API follows the same capability groups as the CLI and MCP server:

| API group | Purpose |
| --- | --- |
| Authoring | Context, preflight, plans, recipes, scenarios, diagnostics, policies, and evidence. |
| Versions and pack formats | Version metadata, support, aliases, pack formats, and comparisons. |
| Data packs | Commands, registries, schemas, vanilla data, migrations, and project validation. |
| Resource packs | Paths, models, assets, PNGs, skins, audio, translations, and project validation. |
| Paper and modding | Paper APIs/events, Fabric and Velocity metadata, and Modrinth metadata. |
| Analysis and validation | Logs, performance series, access lists, server properties, JARs, Mixin, and Blockbench. |

Use the package README linked in the first table for exact exports, input types, limits, and return
shapes instead of copying a large import list into this guide.

## Agent Skills

| Skill | Purpose |
| --- | --- |
| [`minecraft-datapacks`](../packages/data/data/skills/minecraft-datapacks) | Version-aware data pack commands, schemas, vanilla data, project checks, and migrations. |
| [`minecraft-resourcepacks`](../packages/data/data/skills/minecraft-resourcepacks) | Version-aware pack formats, assets, models, validation, and migrations. |
| [`minecraft-paper-plugins`](../packages/data/data/skills/minecraft-paper-plugins) | Paper-first API, event, lifecycle, scheduling, evidence, and migration guidance. |

Export a skill with the CLI `skill write` command or read it through the MCP skill resources.

## Cache

| Data | Cache entry | Managed by |
| --- | --- | --- |
| Heavy generated surfaces | Data cache root | `data manifest`, `data fetch`, and `data cache-*`. |
| External resource pack assets | `minecraft-assets/<version>` | `resourcepack assets status`, `fetch`, and `get`. |
| Official server JARs | `mojang-server-jars/<version>.jar` | `datapack vanilla-json status`, `fetch`, and `clean`. |

| Platform | Default cache root |
| --- | --- |
| macOS | `~/Library/Caches/minecraft-skills` |
| Linux | `${XDG_CACHE_HOME:-~/.cache}/minecraft-skills` |
| Windows | `%LOCALAPPDATA%\minecraft-skills\Cache` |

Set `MINECRAFT_SKILLS_CACHE_DIR` to override the cache root.

## Detailed References

| Reference | Contents |
| --- | --- |
| [Version Support](VERSION_SUPPORT.md) | Version-by-version bundled and downloadable coverage. |
| [Source Strategy](SOURCE_STRATEGY.md) | Source tiers, redistribution, provenance, and safe claim wording. |
| [RCON](RCON.md) | Configuration, profiles, permissions, and MCP behavior. |
| [Optional Evaluation History](EVALUATION_HISTORY.md) | Local opt-in, privacy, schema, scoring, gap analysis, and sanitized feedback. |
| [Mixin Configuration Validation](MIXIN_CONFIG_VALIDATION.md) | Audited source, checked fields, limits, and explicit non-goals. |
| [WAVE Audio Inspection](WAVE_AUDIO_INSPECTION.md) | WAVE parser and sample-metric boundary. |
| [CLI Package Reference](../packages/cli/README.md) | Exact CLI examples and command-specific behavior. |
| [MCP Package Reference](../packages/mcp/README.md) | Package-level tool details, resources, and prompts. |
| [Catalog Package Reference](../packages/catalog/README.md) | Complete TypeScript API examples and behavior. |

Minecraft Wiki is human-only background for this project. Automated workflows should use bundled
data, allowed structured datasets, official sources, and source reports as defined by the
[Source Strategy](SOURCE_STRATEGY.md).
