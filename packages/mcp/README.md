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
- `list_fact_surfaces`
- `get_fact_surface`
- `get_coverage_summary`
- `get_data_manifest`
- `get_support_matrix`
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
