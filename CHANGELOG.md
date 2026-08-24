# Changelog

All notable changes to this project are documented here.

## Unreleased

### Added

- Public Modrinth v2 project search integration across the catalog API, CLI, and MCP server, with
  version, project type, loader, category, sorting, and pagination filters.
- Modrinth project version listing by project ID or slug, with Minecraft version, loader, featured,
  and changelog filters.
- Typed access to common public Modrinth project, dependency, version, file-hash, user, tag, and
  statistics resources.

### Changed

- Discovery queries now match natural-language words across case, camelCase, and Minecraft
  identifier separators, so queries such as `Player Join Event`, `Diamond Sword`, and
  `bundle item model` find structured API and asset results without changing literal `contains`
  filters.
- Vanilla datapack JSON searches now scan cached Mojang server jar entries once per request while
  preserving total and filtered result counts.
- Paper API searches now reuse up to two parsed and validated version surfaces in the same process
  while public surface results remain independent mutable values.

### Fixed

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
