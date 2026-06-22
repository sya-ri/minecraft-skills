# Changelog

All notable changes to this project are documented here.

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
