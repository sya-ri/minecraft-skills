# Changelog

All notable changes to this project are documented here.

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
