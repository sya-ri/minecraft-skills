# @minecraft-skills/mcp

MCP server exposing Minecraft Skills data to AI agents.

## Install

```sh
npx -y @minecraft-skills/mcp
```

Node.js 22.12 or newer is required.

## MCP Client Config

Use the package as a stdio MCP server:

```json
{
  "mcpServers": {
    "minecraft-skills": {
      "command": "npx",
      "args": ["-y", "@minecraft-skills/mcp"]
    }
  }
}
```

For local development from this repository, build first and point the client at the built server:

```sh
mise exec -- pnpm --filter @minecraft-skills/mcp build
```

```json
{
  "mcpServers": {
    "minecraft-skills": {
      "command": "node",
      "args": ["/absolute/path/to/minecraft-skills/packages/mcp/dist/server.mjs"]
    }
  }
}
```

## Agent Instructions

For steadier Minecraft answers, add a short project instruction to `AGENTS.md`, `CLAUDE.md`, or the
equivalent agent guidance file:

```md
Use minecraft-skills MCP tools whenever a task involves Minecraft.
Do not guess Minecraft facts when a minecraft-skills MCP lookup can verify them.
If MCP cannot answer, check local project files or approved web sources; label any remaining
assumption and ask the user to confirm it.
```

## Tools

- `latest_version`
- `list_skills`
- `get_skill`
- `list_authoring_checklists`
- `get_authoring_checklist`
- `list_authoring_recipes`
- `get_authoring_recipe`
- `search_authoring_scenarios`
- `list_authoring_scenarios`
- `get_authoring_scenario`
- `get_authoring_plan`
- `list_authoring_guardrails`
- `get_authoring_guardrail`
- `list_authoring_diagnostics`
- `get_authoring_diagnostic`
- `get_authoring_context`
- `list_claim_policies`
- `get_claim_policy`
- `list_output_requirements`
- `get_output_requirement`
- `list_response_patterns`
- `get_response_pattern`
- `get_authoring_preflight`
- `get_evidence_bundle`
- `list_intent_lookups`
- `get_intent_lookup`
- `list_fact_surfaces`
- `get_fact_surface`
- `get_coverage_summary`
- `get_data_manifest`
- `get_support_matrix`
- `list_version_support`
- `get_cache_status`
- `fetch_data`
- `clean_cache`
- `list_versions`
- `get_version`
- `list_pack_formats`
- `get_pack_format`
- `find_versions_by_pack_format`
- `compare_versions`
- `search_all`
- `get_fabric_toolchain`
- `search_modrinth_projects`
- `list_modrinth_project_versions`
- `get_modrinth_resource`
- `validate_modrinth_pack`
- `find_datapack_entries`
- `find_resourcepack_assets`
- `validate_resourcepack_project`
- `explain_pack_path`
- `suggest_minecraft_lookups`
- `get_server_reports`
- `search_registry_entries`
- `compare_registry_entries`
- `get_datapack_schema_surface`
- `search_datapack_schema`
- `compare_datapack_schema`
- `search_commands`
- `compare_commands`
- `get_vanilla_inventory`
- `search_vanilla_paths`
- `compare_vanilla_paths`
- `get_resourcepack_model_summary`
- `search_resourcepack_models`
- `get_resourcepack_assets_status`
- `fetch_resourcepack_assets`
- `search_resourcepack_assets`
- `get_resourcepack_asset`
- `get_paper_plugin_data`
- `get_paper_api_reference`
- `get_paper_api_index`
- `compare_paper_api`
- `get_paper_api_surface`
- `search_paper_types`
- `search_paper_members`
- `compare_paper_api_surface`
- `search_paper_events`
- `list_domains`
- `list_references`
- `get_source_policy`

`search_catalog`, `search_authoring_scenarios`, and `suggest_minecraft_lookups` recognize a bounded
set of high-confidence Japanese Minecraft terms while returning the original Unicode query.
Explicit data-pack, resource-pack, and Paper-plugin phrases can be mixed with English, and a domain
filter can disambiguate secondary terms. Ambiguous standalone Japanese words are not expanded.

`validate_modrinth_pack` accepts index JSON and optional archive-entry metadata; MCP does not accept
binary ZIP uploads. Supply optional compressed sizes, flags, compression methods, CRC-32 values,
and Unix modes for stronger metadata checks. The result therefore reports `validationStrength` as
`none` or `metadata`, never `binary`. Downloads use Modrinth's official four-host allowlist by
default. `additionalDownloadHosts` explicitly extends it and produces non-official-host warnings;
`limits` bounds entries, sizes, ratios, and retained diagnostics.

`compare_registry_entries` emits entry and protocol ID changes only for registries indexed in both
versions. Its `outcome` and bounded `excludedRegistries` fields expose incomplete coverage without
turning missing report data into false additions or removals. Protocol changes require numeric IDs
in both versions; null-to-number and number-to-null observations are not classified as changes.

## Resources

Agent Skill files are exposed under `minecraft-skills://skills/<skill>/...`, including:

- `minecraft-skills://skills/minecraft-datapacks/SKILL.md`
- `minecraft-skills://skills/minecraft-resourcepacks/SKILL.md`
- `minecraft-skills://skills/minecraft-paper-plugins/SKILL.md`

Data resources are exposed under `minecraft-skills://data/...`, including:

- `minecraft-skills://data/fact-surfaces.json`
- `minecraft-skills://data/intent-lookups.json`
- `minecraft-skills://data/authoring-recipes.json`
- `minecraft-skills://data/authoring-scenarios.json`
- `minecraft-skills://data/authoring-guardrails.json`
- `minecraft-skills://data/authoring-diagnostics.json`
- `minecraft-skills://data/claim-policies.json`
- `minecraft-skills://data/output-requirements.json`
- `minecraft-skills://data/response-patterns.json`
- `minecraft-skills://data/authoring-checklists.json`
- `minecraft-skills://data/authoring-checklists/paper-plugin.json`
- `minecraft-skills://data/authoring-recipes/paper-event-listener.json`
- `minecraft-skills://data/authoring-scenarios/paper-event-listener-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-api-surface-limits.json`
- `minecraft-skills://data/authoring-diagnostics/paper-api-member-unverified.json`
- `minecraft-skills://data/claim-policies/paper-type-or-member-exists.json`
- `minecraft-skills://data/output-requirements/paper-plugin-output-safety.json`
- `minecraft-skills://data/response-patterns/paper-api-answer.json`
- `minecraft-skills://data/intent-lookups/verify-paper-type-or-member.json`
- `minecraft-skills://data/fact-surfaces/datapack-schema-surface.json`
- `minecraft-skills://data/data-manifest.json`
- `minecraft-skills://data/java/datapack-schema-surfaces/26.2.json`
- `minecraft-skills://data/java/paper-api-surfaces/26.2.json`

## Prompts

- `use_minecraft_datapacks`
- `use_minecraft_resourcepacks`
- `use_minecraft_paper_plugins`

Each prompt accepts optional `target_version` and `task` arguments and points the client at the
matching skill resource plus the most relevant MCP tools.

The server is designed for version-aware Minecraft Java data pack, resource pack, and Paper plugin
authoring assistance.
