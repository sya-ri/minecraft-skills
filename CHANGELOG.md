# Changelog

All notable changes to this project are documented here.

## Unreleased

### Fixed

- Cross-search now preserves available results when downloadable data pack schema or Paper API
  indexes are absent, with explicit source-availability gaps and opt-in fetch guidance. Unsupported
  Paper versions do not substitute latest API facts; searches remain offline and read-only.

## 0.1.8 - 2026-09-03

### Added

- Added a repository-local evaluation maintenance skill and a read-only, time-bounded report helper
  that ranks one snapshot of allowlisted metadata without exposing free-form needs or raw payloads.
- Added exact evaluation record ID filtering so safe summaries can be compared without relying on
  free-text search ordering.
- Added exact-version Fabric API rendering type and declared-member searches across Catalog, CLI,
  and MCP using official Maven candidates, aggregate POM coordinates, and SHA-256-verified fat
  Javadoc indexes. Searches retain nested types and overload-specific URL signatures without
  claiming Mojang client API, full Java declaration, or rendering behavior coverage.

### Fixed

- Fabric toolchain lookup now follows the documented Minecraft 26.1+ unobfuscated/no-remap policy,
  including weekly snapshot IDs from `26w14a`; reports the mapping mode and Loom
  plugin ID without inferring them from Intermediary sentinel values; and recommends a compatible
  Loader even when Fabric Meta publishes no Yarn mappings or a supplemental mapping endpoint is
  unavailable or exceeds the lookup deadline. Uncovered earlier `26w` IDs explicitly report an
  unknown mapping policy instead of asserting a mapping dependency or Loom plugin.
- Added a model-visible, per-call MCP evaluation receipt so repeated or concurrent calls to the
  same tool retain the correct record ID even when clients hide result metadata, while keeping the
  receipt out of the stored response. Evaluation guidance now also rejects ambiguous pending-ID
  guesses and keeps stable missing-feature keys focused on reusable, in-scope capabilities.
- Paper member searches scoped to a type now include declarations from known supertypes when the
  generated Javadocs surface has overview-tree hierarchy coverage. Results retain each declaration's
  owning type and report both the coverage level and searched types.

### Changed

- Pinned downloadable data to the immutable `v0.1.8` release tag. Data version `2026.09.03-15`
  includes regenerated Paper 26.2 API declarations and hierarchy coverage.
- Updated the transitive PostCSS dependency to 8.5.25.

## 0.1.7 - 2026-09-02

### Added

- Default-off local MCP evaluation history across the CLI and MCP server, storing raw tool calls
  under `~/.minecraft-skills/evaluation` for explicit scoring, information-need notes, recurring-gap
  search, and deletion. Records retain the minecraft-skills MCP and catalog data versions, and the
  status, pending, search, and gap views surface those versions for later comparison. Project
  markers can override the global opt-in for sensitive work.
- Evaluation privacy and contribution guidance, including a dedicated sanitized-feedback Issue Form.
- Bundled Mojang and PaperMC source data is refreshed for this release. The data version is
  `2026.08.31-14`, Paper 26.2 records build 121, and the Paper API indexes, derived version
  coverage, and heavy-data manifest have been regenerated from the current source snapshot.

### Fixed

- Made local validation and cached logical data paths portable across Windows and POSIX checkouts.
- Hardened evaluation deletion against failed removals and owned crash-residue temporary files,
  preserved JSON keys such as `__proto__`, and rejected symlink components in storage paths.

### Documentation

- Streamlined the README into a focused project overview and quick start, with detailed operations
  moved into the usage and maintenance guides.
- Restructured the usage guide around the public CLI, MCP, package, and Agent Skill interfaces so
  commands and capability boundaries are easier to find.

## 0.1.6 - 2026-08-26

### Added

- Bounded offline Paper and Bukkit plugin JAR descriptor validation across Catalog, CLI, and MCP,
  covering stable archive reads, root `paper-plugin.yml` and `plugin.yml` parsing, Paper-first
  descriptor selection, documented fields and dependency metadata, and declared Java binary names
  without loading classes or claiming runtime or dependency compatibility.
- Bounded JVM class-loading failure evidence in Minecraft Java log and crash-report analysis,
  extracting explicit missing-class and initialization-failed cases from `ClassNotFoundException`
  and `NoClassDefFoundError`, normalizing slash and dot class symbols, coalescing matching evidence
  within one exception chain, and retaining only explicit evidence plus at most the first directly
  associated frame or artifact without inferring dependency, ownership, blame, or root cause.
- Bounded Paper block and entity world-operation guidance for work spanning chunks or Folia
  ownership boundaries, with pre-enumerated target chunks, explicit generation and ticket policy,
  per-tick and per-region caps, immutable-coordinate and `EntityScheduler` ownership handoffs,
  typed partial outcomes, idempotent reconciliation, and terminal ticket cleanup.
- Fabric client UI scaling and clipping guidance across Catalog, CLI, and MCP, using one immutable
  scaled-viewport layout for drawing, clipping, and hit testing, with pre-clip bounds, localized
  text, minimum viewport, GUI-scale and `Auto` window variants, target-mapping verification,
  deterministic geometry assertions, and rendered client or screenshot evidence.
- Reproducible Fabric Client GameTest visual-evidence guidance across data, Catalog, CLI, and MCP,
  including stable semantic case IDs, bounded readiness barriers, phase-aware full-frame and crop
  artifacts, explicit comparison and baseline-update runs, selection and completeness
  reconciliation, idempotent cleanup, causal failure phases, and explicit evidence limits for
  non-render, virtual-framebuffer, and interactive-client runs.
- Paper plugin configuration lifecycle guidance across data, Catalog, CLI, and MCP, modeling startup
  and hot reload as immutable prepare, commit, and retire generations with last-known-good
  preservation, revision ordering, owned resources, typed restart or degraded outcomes,
  conflict-safe writes, and disable cleanup.
- Paper ItemStack semantic-identity and presentation-update guidance across data, Catalog, CLI, and
  MCP. It requires stable namespaced logical IDs with separate schema versions, distinguishes
  identity from similarity and rendering, clones or owns stacks before mutation, preserves all
  non-allowlisted metadata and components, migrates deterministically and idempotently, leaves
  unknown items untouched, and tests duplicate lore, rollback, aliasing, comparisons, and unrelated
  state preservation.
- Searchable Paper scheduled-task lifecycle guidance across recipes, scenarios, checklists,
  guardrails, diagnostics, CLI, Catalog, MCP tools/resources, and the Paper skill. It covers plugin
  and feature ownership, lifecycle generations for replacement and reload, background-to-API
  execution contexts, Folia state ownership, admission-first idempotent teardown, cancellation of
  pending versus already-running work, separately owned executors and child resources, late-
  publication fences, and deterministic plus loaded-plugin runtime evidence.
- Paper event-listener execution and registration guidance covering priority ordering,
  `ignoreCancelled`, MONITOR observation, asynchronous dispatch, feature-owned unregistration,
  in-flight callback fences, and deterministic lifecycle evidence.
- Bounded static PNG alpha inspection across the Catalog API, CLI, and MCP, including every legal
  color-type/bit-depth combination, filters 0-4, Adam7, PLTE/tRNS semantics, nonzero-alpha counts,
  zero-based half-open content bounds, four-side transparent margins, optional nonempty/minimum-
  margin policy, exact filtered-byte bounds, and consumed/trailing zlib evidence without returning
  paths, pixels, or RGB samples or modifying source files.
- Fixed-host, bounded Minecraft Java player-texture download and inspection across Catalog and CLI,
  with strict lowercase reference hashes, skin/cape/elytra kinds, PNG and skin-layout evidence,
  five-second fetch/body timeout, redirect and response limits, separate downloaded SHA-256
  evidence, and exclusive identity-verified creation of new `.png` output files.
- Minecraft Java player-skin layout validation across Catalog, CLI, and MCP, including current
  64x64 and legacy 64x32 dimensions, canonical base-face and hat source rectangles, bounded
  structured inputs, pinned 26.2 client evidence, and explicit PNG/pixel/rendering claim boundaries.
- Bounded datapack project validation across the catalog API, CLI, and MCP, including portable
  paths, `pack.mcmeta`, version-aware file checks, function/tag/advancement-parent references,
  registry evidence, cycle detection, external-reference uncertainty, and explicit completeness.
- Bounded offline `server.properties` validation across Catalog, CLI, MCP, and natural-language
  discovery, with Java Properties parsing, duplicate last-wins evidence, conservative scalar and
  file-local correlation checks, strict file/UTF-8 preflight, value-free results, and explicit
  unknown target-version/runtime-encoding coverage.
- Bounded Minecraft Java log and crash-report analysis across Catalog, CLI, and MCP, including
  structured log events, explicit exception and suppressed branches, last explicit primary
  causes, bounded facts from five explicit Mixin runtime failure message shapes, crash metadata,
  platform/version statements, JAR artifacts, and explicitly named mod/plugin IDs. Credentials, IP
  addresses, absolute paths, terminal controls, and unsafe Unicode are sanitized before retained
  output, and extracted labels are never presented as blame or Mixin validation.
- Bounded CLI inventory and two-directory factual diff for direct Fabric mod JARs, including
  stable one-file reads, hashes, normalized metadata and validation status, duplicate-ID and
  ambiguity reporting, deterministic limits, and automation-friendly exit codes without exposing
  absolute paths or archive bytes.
- Offline Fabric mod validation across the Catalog API, CLI, and MCP, covering bounded structural
  rules for current `fabric.mod.json` schema v1, portable archive paths, referenced-file presence,
  and bounded JAR structure. CLI binary reads require one stable regular `.jar` file; MCP accepts
  metadata and optional entry metadata, but not binary JARs.
- Bounded offline Velocity plugin JAR validation across Catalog, CLI, MCP, and English discovery,
  separating binary ZIP/CRC/classfile/Java-target/annotation evidence from metadata-only MCP input
  and explicitly retaining dependency, linkage, injection, API-compatibility, and runtime limits.
- Bounded offline validation for vanilla Java server `whitelist.json`, `ops.json`,
  `banned-players.json`, and `banned-ips.json` across Catalog, CLI, MCP, and English discovery.
  Results detect duplicate identities and ban expiration state without returning player names,
  UUIDs, IP addresses, ban reasons, ban sources, or local paths.
- Bounded Java player name-to-profile resolution and signed texture-metadata verification across
  Catalog, CLI, and MCP. Requests use only fixed Mojang services, reject redirects, bound decoded
  responses and timeouts, distinguish profile/key/signature failure outcomes, and expose only
  canonical identity, texture references derived from verified signed metadata, and model evidence
  without downloading PNG data.
- Bounded `.bbmodel` metadata and exact animation/group name inspection across Catalog, CLI, and
  MCP, with conservative unknown results for newer, compressed, custom/plugin, unsupported, or
  incomplete inputs and explicit non-guarantees for runtime, rendering, and ModelEngine behavior.
- Bounded offline SpongePowered Mixin configuration validation across Catalog, CLI, and a
  metadata-only MCP tool, including raw duplicate-key evidence, audited VersionNumber/Gson field
  shapes, duplicate declaration checks, and optional supplied-archive presence evidence which does
  not infer runtime classpath absence.
- Bounded Minecraft performance time-series analysis across Catalog, CLI, and MCP, including
  coverage, quantiles, threshold intervals, before/after comparisons, trends, exact-timestamp MSPT
  associations, and scoped spark follow-up without causal claims.
- Bounded resource-pack translation catalog validation across Catalog, CLI, and MCP, including raw
  duplicate-key evidence, exact global locale-key comparison, source-accurate Mojang placeholder
  normalization, caller-selected locale parity, unknown override-order reporting, stable-file CLI
  reads, and value-private output.
- Bounded, non-mutating RIFF/WAVE PCM and IEEE-float source inspection through the Catalog API and
  `resourcepack sound inspect` CLI command, including stable regular-file reads, structural and
  sample diagnostics, SHA-256, duration, sample peak and RMS dBFS, and factual full-scale counts.
- Loss-safe Paper item-delivery authoring guidance across recipes, scenarios, guardrails, and
  diagnostics, including partial inventory insertion, explicit overflow outcomes, retry safety,
  and target-version verification for convenience and fallback APIs.
- Paper custom inventory GUI interaction safety guidance across recipes, scenarios, guardrails,
  diagnostics, CLI, Catalog, and MCP surfaces, including default-deny click and drag handling,
  deferred close-handler transitions, supported cursor mutation, per-session ownership, and
  exactly-once editable-slot settlement with explicit overflow outcomes.
- Generic Paper administrative-command operability guidance across recipes, scenarios, guardrails,
  diagnostics, Catalog, CLI, MCP tools/resources, and natural-language discovery. It covers
  operation matrices, explicit support or rejection for every applicable command-sender subtype
  including command minecarts and an unknown-subtype fallback,
  online/offline targets, permissions, protected secret input, bounded bulk scope, justified safe
  out-of-band alternatives, atomic last-known-good reload, effective-state inspection,
  invoker/target feedback, recovery, retry, partial failure, and failure-path tests.
- Paper player identity and display authoring guidance across data, Catalog, CLI, and MCP, covering
  stable persistence, exact offline resolution, intentional per-transport labels, bounded profile
  lookup, authentication and proxy identity assumptions, rename continuity, and cross-server cache
  convergence.
- Searchable Paper plugin-message, custom-payload, RPC, codec, request-correlation, and chunked-upload
  protocol guidance across recipes, scenarios, guardrails, diagnostics, CLI, and MCP resources. The
  workflow requires namespaced lifecycle-managed channels, versioned message kinds, exact decoding,
  bounds before allocation, hard output caps during decompression, authenticated connection identity,
  session-scoped correlation and idempotency, one terminal response, bounded chunk/backpressure
  state, complete timeout/reconnect/disable cleanup, safe execution contexts, hostile tests, and
  target-version API evidence for transport members and limits.
- Paper player-session lifecycle safety guidance across data, Catalog, CLI, and MCP, covering
  per-connection generations, idempotent teardown and partial rollback, stale async publication
  fences, revisioned durable flushes, shutdown barriers, fallback reconciliation, and leak
  observability without mixing in inventory contents or ownership settlement.
- Paper BossBar audience-lifecycle guidance across data, Catalog, CLI, and MCP, covering one owner
  generation per logical slot, explicit eligibility gates, deterministic arbitration with
  hysteresis, authoritative viewer-set reconciliation, bounded revisioned writers, stale update
  rejection, idempotent terminal cleanup, backend handoff boundaries, and viewer-leak race tests.
- Paper PersistentDataContainer contract guidance across data, Catalog, CLI, MCP, and English
  discovery, covering NamespacedKey ownership, primitive-versus-complex type semantics, bounded
  custom data, holder lifetime and publication, explicit cross-holder copy, selective replacement
  and removal, failure-safe schema migration, foreign-key preservation, and restart evidence
  without mixing in ItemStack identity or presentation policy.
- Paper Display and Interaction entity contract guidance across data, Catalog, CLI, MCP, and English
  discovery, covering shared local-space geometry, separate visual and hit-target semantics, owned
  pair generations, input-unavailable pending hit targets, serialized registered publication,
  bounded reconciliation, explicit cleanup, event and hand deduplication, and target-client
  alignment evidence without duplicating generic lifecycle rules.
- Paper high-frequency persistence and transaction-contention guidance across data, Catalog, CLI,
  and MCP, covering measured rate/durability/ordering decisions, direct atomic writes versus
  bounded per-key delta coalescing, exact partial-flush accounting, verified fresh whole-transaction
  retries, side-effect safety, shutdown recovery, observability, and real-adapter evidence.
- Server-backed paged Minecraft UI guidance across data, Catalog, CLI, and MCP, covering bounded
  source queries, stable unique ordering, server-owned cursors or explicit revisions, page and UI
  states, generation-fenced response acceptance, changed-payload deduplication semantics, shrink
  recovery, bounded prefetch, and deterministic boundary and mutation tests.
- Paper death and respawn handoff guidance across data, Catalog, CLI, and MCP, with exclusive
  vanilla-death, plugin-owned downed, and respawn-pending states; exactly-once item and experience
  settlement; fail-closed cancellation ambiguity and staged downed side effects; explicit bed,
  respawn-anchor, world, and plugin destination precedence; separate post-respawn application
  outcomes; owned temporary-state restoration; and duplicate, unavailable-world, reconnect, reload,
  and disable recovery tests.
- Paper scoreboard and sidebar ownership lifecycle guidance across data, Catalog, CLI, and MCP,
  covering exact prior-board restoration, private or shared-board ownership, collision-safe
  objectives and teams, deterministic bounded snapshot diffs, stale-update fences, foreign
  takeover preservation, and complete viewer and plugin cleanup.
- Paper mob-navigation ownership guidance across data, Catalog, CLI, and MCP, with one vanilla,
  plugin-target, plugin-path, or stopped controller phase; generation-scoped target leases;
  typed calculation, post-call, progress, and recovery outcomes; bounded entity-context admission
  and replanning; fail-closed foreign intervention; lifecycle convergence; and deterministic plus
  loaded target-version Paper evidence.
- Paper plugin testing-evidence guidance across data, Catalog, CLI, and MCP, mapping pure tests,
  owned fakes, MockBukkit, loaded target-version servers, and client-visible verification to the
  claims each layer can prove, with deterministic lifecycle testing and exact limitations reporting.
- Paper custom-recipe lifecycle guidance across recipes, scenarios, guardrails, and diagnostics,
  covering stable plugin-owned `NamespacedKey`s, owned-key-only reconciliation, observed add/remove
  results and partial recovery, deliberate material versus `RecipeChoice.ExactChoice` matching,
  canonical shaped/shapeless collision detection, and separate online-client resend and recipe-book
  discovery policies.
- Paper attribute-modifier and potion-effect ownership guidance across data, Catalog, CLI, and MCP,
  covering stable keyed equipment and session reconciliation, implicit vanilla ItemType defaults,
  non-keyed potion-effect collision policies, capacity-before-current-value clamping, and
  table-driven reapply, expiry, death, quit, reconnect, and reload evidence.
- Model Engine runtime-binding and animation-ownership guidance across data, Catalog, CLI, and MCP,
  requiring exact Paper, plugin, adapter, blueprint, and animation evidence; carrier configuration
  before verified attachment and publication; explicit idle, locomotion, and action ownership;
  fail-closed generation replacement and cleanup; and exact-artifact loaded-server plus paired-client
  evidence without embedding guessed external API names.
- Generic Paper region-protection policy guidance across data, Catalog, CLI, and MCP, covering
  actor, source, action, target, cause, boundary, and outcome decisions; explicit defaults and
  exceptions; indirect and cross-boundary paths; preserved mechanics; and table-driven evidence.
- Version-aware resource-pack project reference validation across the catalog API, CLI, and MCP,
  including modern and legacy item models, model parents, inherited textures, safe asset paths, and
  parent/texture-variable cycles.
- Resource-pack `sounds.json` file/event reference validation, local event-cycle detection, and
  strict bounded checks of each OGG file's 58-byte Ogg/Vorbis identification page across the
  catalog API, CLI, and MCP. Validation uses iterative graph traversal, rejects channel counts above
  two, preserves per-entry diagnostics, and reports bounded request, diagnostic, and completeness
  metadata.
- Bounded structural resource-pack PNG validation across the Catalog API, CLI, MCP, and project
  validator, including signature, chunk framing, IHDR, method, CRC, ordering, and truncation checks
  with configurable byte, dimension, pixel, chunk, and diagnostic limits.
- Binary-safe resource-pack directory scanning that validates PNG bytes within configured per-file
  and aggregate binary caps and reads only the first 58 bytes of each OGG file instead of decoding
  binary contents as UTF-8 or loading complete audio.
- Official live Fabric Meta v2 toolchain lookup across the catalog API, CLI, MCP server, and
  natural-language discovery, with bounded Loader, Intermediary, Yarn, and tuple candidates.
- Official live Velocity toolchain resolution across the catalog API, CLI, MCP server, and
  natural-language discovery, with bounded Maven metadata and documentation reads, dependency and
  Java requirement provenance, drift warnings, and no inferred Minecraft compatibility.
- Version-specific official server report registry entry indexes, with exact, prefix, contains,
  registry, added/removed/protocol-ID comparison, and bounded-result filters across Catalog, CLI,
  and MCP. Comparisons exclude registries not indexed in both versions and report their coverage
  statuses instead of inferring false additions or removals; protocol changes require numeric IDs
  on both sides.
- Bounded parsed-key and primitive-value search across vanilla datapack JSON in cached official
  Mojang server jars, exposed through the catalog API, CLI, and MCP server.
- CLI status, fetch, file listing, and exact-read commands for the vanilla datapack JSON cache.
- Public Modrinth v2 project search integration across the catalog API, CLI, and MCP server, with
  version, project type, loader, category, sorting, and pagination filters.
- Modrinth project version listing by project ID or slug, with Minecraft version, loader, featured,
  and changelog filters.
- Bounded compatibility resolution for 2-10 Modrinth projects, including common Minecraft
  version/loader metadata pairs, canonical alias deduplication, and pair-specific latest published
  project versions.
- Typed access to common public Modrinth project, dependency, version, file-hash, user, tag, and
  statistics resources.
- Offline `.mrpack` and `modrinth.index.json` validation across the catalog API, CLI, and MCP,
  including bounded ZIP reads and expansion, CRC/header/flag/extra-field integrity, special-file
  and portable path safety, official download-host enforcement, archive assurance levels, hashes,
  environment values, environment-aware override conflicts, and index/archive consistency checks.

### Changed

- Agent-facing CLI help, MCP prompts and input schemas, documentation, and bundled skills now direct
  callers to translate non-English discovery intent into concise English canonical Minecraft terms
  while preserving exact identifiers, paths, project titles, and content literals. Search runtimes
  continue to accept Unicode input without language-specific alias expansion.
- Discovery queries now match natural-language words across case, camelCase, and Minecraft
  identifier separators, so queries such as `Player Join Event`, `Diamond Sword`, and
  `bundle item model` find structured API and asset results without changing literal `contains`
  filters.
- Vanilla datapack JSON searches now read cached Mojang server jars once per request and batch
  selected entry extraction while preserving total and filtered result counts.
- Paper API searches now reuse up to two parsed and validated version surfaces in the same process
  while public surface results remain independent mutable values.
- Bundled Mojang and PaperMC source data is refreshed for this release: the latest Java release is
  26.2, Paper 26.2 records build 119, and the Paper API indexes, derived version coverage, and data
  manifest have been regenerated from the current source snapshot.

### Fixed

- Vanilla datapack JSON readers now resolve the nested server payload inside modern Mojang bundler
  jars instead of reporting an empty `data/**` inventory from the outer launcher jar.
- Java server report ingestion now retains registries from `reports/registries.json` when
  `datapack.json` is unavailable and merges registry IDs from both reports when both are present.
- Java report refreshes now detect and repair incomplete registry summaries, download one official
  server jar at a time, and run correctly with platform-native classpaths.
- Data Refresh now builds every workspace package before source audits, validates generated
  `YYYY.MM.DD-run-number` manifest versions by contract, and derives current Paper version, build,
  coverage, and support-matrix expectations from bundled data, preventing valid refreshes from
  failing because of missing build artifacts or stale hard-coded values.
- Current-source audit tests now inject bundled-source baselines instead of loading generated
  catalog data, isolating deterministic fixtures while production audits continue to compare
  checked-in values with live Mojang and PaperMC sources.

## 0.1.5 - 2026-06-24

### Added

- MCP and catalog lookups for Mojang official version metadata, including client/server download
  metadata, SHA-1s, Java runtime metadata, and version-specific pack format evidence.
- Server jar fetch and vanilla datapack JSON lookup tools for inspecting official `data/...` files
  from Mojang server jars.
- `validate_datapack_json` MCP alias for validating datapack JSON entries directly.
- Community dataset search tooling for discovering structured supplemental datasets such as
  PrismarineJS data and assets mirrors.

### Documentation

- Documented Mojang Piston endpoints as the official delivery infrastructure behind Mojang version
  metadata and client/server jar downloads.
- Expanded MCP usage documentation for the new Mojang metadata, vanilla datapack JSON, validation,
  and community dataset tools.

## 0.1.4 - 2026-06-24

### Added

- Version-aware `pack.mcmeta` schema handling for legacy pack formats, 1.20.2+ range metadata, and
  1.21.9+ minor-aware pack format metadata.
- Pack format lookup APIs, CLI commands, and MCP tools for resolving version to pack format and
  pack format to matching bundled versions.
- Optional `InventivetalentDev/minecraft-assets` resource pack asset cache helpers for one-file
  fetches, version path indexes, archive references, CLI commands, and MCP tools.
- Discovery-oriented search tools across catalog guidance, datapack command/schema/path indexes,
  resourcepack path/model/asset indexes, and Paper API indexes.
- Path explanation and lookup suggestion tools for routing natural-language Minecraft tasks to the
  right CLI, package API, or MCP lookups.

### Changed

- Resource pack validation now treats unknown custom folders and missing minecraft-skills schemas as
  unvalidated gaps rather than proof that a file is invalid.
- Known target-version layout mismatches, invalid JSON, and pack format mismatches still fail
  validation.
- Source policy now documents `InventivetalentDev/minecraft-assets` as a supplemental mirror while
  keeping Mojang-derived data canonical for version-specific claims.

## 0.1.3 - 2026-06-23

### Added

- `@minecraft-skills/rcon` package for RCON configuration, regex permissions, and command
  execution utilities.
- `minecraft-skills rcon status`, `minecraft-skills rcon init`, and `minecraft-skills rcon run`
  CLI commands.
- MCP RCON config/status tools, with command execution exposed only when RCON configuration is
  present.
- Catalog search commands and tools for finding recipes, scenarios, guardrails, diagnostics, claim
  policies, fact surfaces, source tiers, datasets, and version-support entries without listing all
  data first.
- RCON configuration JSON Schema and documentation.

### Changed

- Agent Skill payloads now describe CLI command usage only, instead of mixing CLI, MCP, and package
  API entrypoints.
- Maintainer validation now checks version-support documentation and prevents MCP/package API
  entrypoint wording from returning to Skill-facing files.

## 0.1.2 - 2026-06-23

### Added

- Source tier and source report APIs, CLI commands, and MCP tools for checking allowed evidence,
  prohibited automation, and structured community datasets.
- Recommended structured community source entries for PrismarineJS `minecraft-data`,
  PrismarineJS `minecraft-assets`, and `misode/mcmeta`.
- `docs/SOURCE_STRATEGY.md` for source tiers, importer policy, structured community dataset use,
  and claim wording.

### Changed

- Minecraft Wiki is now treated as human-only background; AI workflows must not fetch, crawl,
  summarize, or cite Wiki pages as machine evidence.
- Maintainer validation now rejects Minecraft Wiki URLs, deprecated Wiki navigation source entries,
  and old Wiki navigation/provenance wording in agent-facing files.

## 0.1.1 - 2026-06-23

### Added

- Version-aware pack file content validation APIs in `@minecraft-skills/catalog`.
- `datapack validate-files` and `resourcepack validate-files` CLI commands.
- `validate_pack_files` MCP tool for validating datapack/resourcepack file content passed by agents.
- Maintainer validation coverage for every bundled Java version and every vanilla datapack/resourcepack
  path index entry.

### Changed

- Pack file schema lookup now rejects target-version-incompatible layouts instead of returning
  misleading schemas.
- Pack migration plans count only target-version-available schema lookups as schema-backed.
- Pack schema coverage now includes additional known resourcepack/datapack file containers such as
  marker files, shader sources, text assets, binary font assets, and embedded vanilla datapacks.

## 0.1.0 - 2026-06-22

Initial public release of minecraft-skills.

### Packages

- `minecraft-skills`: public CLI for Minecraft version, datapack, resourcepack, Paper plugin, data,
  and skill lookups.
- `@minecraft-skills/catalog`: ArkType-validated package API for agents and tools.
- `@minecraft-skills/data`: bundled canonical indexes plus a heavy-data manifest for on-demand
  downloads.
- `@minecraft-skills/mcp`: MCP server exposing the same versioned facts and authoring workflows.

### Skills

- Agent Skill payloads for Minecraft Java datapacks, resourcepacks, and Paper plugins.
- Shared agent maintenance skill for future Minecraft/Paper version updates under `.agents/skills`,
  with `.codex/skills` and `.claude/skills` symlinked to the canonical copy.

### Versioned Data

- Java Edition release coverage from 1.13 through 26.2.
- Extracted pack formats, command paths, server reports, vanilla datapack/resourcepack paths,
  vanilla inventories, and version detail metadata.
- Observed datapack JSON shape surfaces and resourcepack model summaries as downloadable heavy data.
- Paper support metadata from PaperMC downloads API, including alpha builds when Paper publishes
  them.
- Paper API package indexes and Javadocs-derived type/member surfaces through 26.2 where available.
- Paper event-search routing through the `sya-ri/spigot-event-list` API contract.

### Authoring Support

- Authoring checklists, recipes, scenarios, diagnostics, guardrails, claim policies, output
  requirements, response patterns, and evidence bundles.
- CLI/API/MCP preflight and context commands for safer AI output before generating datapacks,
  resourcepacks, or Paper plugin code.
- Version-by-version support table for Java, datapack, resourcepack, Paper, Paper API surfaces, and
  downloadable heavy data.

### Maintenance

- Weekly/manual GitHub Actions data refresh workflow for Mojang and PaperMC source drift.
- SHA-256 verified heavy-data manifest and cache fetch support.
- Release verification through Biome, sherif, build, typecheck, Vitest, repository validation, npm
  publish dry-run, and package smoke testing.

### Known Limits

- Paper API type/member surfaces prove name presence only. They do not prove runtime behavior,
  nullability, overload semantics, thread safety, or Folia safety.
- Minecraft Wiki prose is not redistributed; agents should use bundled source references and fetch
  current source pages when prose-level interpretation is needed.
