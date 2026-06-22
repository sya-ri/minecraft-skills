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
- `compare_versions`
- `get_server_reports`
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
- `minecraft-skills://data/java/paper-api-surfaces/1.21.11.json`

## Prompts

- `use_minecraft_datapacks`
- `use_minecraft_resourcepacks`
- `use_minecraft_paper_plugins`

Each prompt accepts optional `target_version` and `task` arguments and points the client at the
matching skill resource plus the most relevant MCP tools.

The server is designed for version-aware Minecraft Java data pack, resource pack, and Paper plugin
authoring assistance.
