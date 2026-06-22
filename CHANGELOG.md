# Changelog

All notable changes to this project are documented here.

## 0.1.0 - 2026-06-22

### Added

- Public CLI, package API, MCP server, and Agent Skill payloads for Minecraft datapack,
  resourcepack, and Paper plugin authoring.
- Java Edition 1.13+ version, pack format, command path, vanilla path, inventory, reports, and
  coverage metadata.
- Paper plugin support metadata, package indexes, Javadocs-derived type/member API surfaces, and
  event-search routing through the `sya-ri/spigot-event-list` API contract.
- Authoring checklists, recipes, scenarios, diagnostics, guardrails, claim policies, output
  requirements, response patterns, and evidence bundles for safer AI output.
- Downloadable heavy data manifest and SHA-256 verified cache fetch support for datapack schema
  surfaces, Paper API surfaces, and resourcepack model summaries.
- Version-by-version support summary for Java, datapack, resourcepack, Paper, and heavy data
  availability.
- Weekly/manual GitHub Actions data refresh workflow that audits Mojang/PaperMC sources, regenerates
  data when drift is detected, runs checks, and opens a pull request.

### Changed

- Kept large generated surfaces out of the npm data package tarball; consumers fetch them into the
  platform cache on demand.
- Organized CLI commands under predictable `minecraft`, `datapack`, `resourcepack`, `plugin paper`,
  `data`, and `skill` command groups.

### Known Limits

- Paper API type/member surfaces prove name presence only. They intentionally do not prove runtime
  behavior, nullability, overload semantics, thread safety, or Folia safety.
