# Changelog

All notable changes to this project are documented here.

## Unreleased

### Added

- Bounded static PNG alpha inspection across the Catalog API, CLI, and MCP, including every legal
  color-type/bit-depth combination, filters 0-4, Adam7, PLTE/tRNS semantics, nonzero-alpha counts,
  zero-based half-open content bounds, four-side transparent margins, optional nonempty/minimum-
  margin policy, exact filtered-byte bounds, and consumed/trailing zlib evidence without returning
  paths, pixels, or RGB samples or modifying source files.
- Minecraft Java player-skin layout validation across Catalog, CLI, and MCP, including current
  64x64 and legacy 64x32 dimensions, canonical base-face and hat source rectangles, bounded
  structured inputs, pinned 26.2 client evidence, and explicit PNG/pixel/rendering claim boundaries.
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

### Fixed

- Vanilla datapack JSON readers now resolve the nested server payload inside modern Mojang bundler
  jars instead of reporting an empty `data/**` inventory from the outer launcher jar.
- Java server report ingestion now retains registries from `reports/registries.json` when
  `datapack.json` is unavailable and merges registry IDs from both reports when both are present.
- Java report refreshes now detect and repair incomplete registry summaries, download one official
  server jar at a time, and run correctly with platform-native classpaths.

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
