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
Before intent-based search tools, translate non-English user intent into concise English canonical
Minecraft terms. Keep exact identifiers, namespace IDs, file paths, project titles, and content
literals unchanged. Use the English terms only for the lookup, and keep the user's requested
response language.
If MCP cannot answer, check local project files or approved web sources; label any remaining
assumption and ask the user to confirm it.
```

This normalization is performed by the caller. MCP search tools do not expand language-specific
aliases or reject Unicode query values.

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

Use `search_catalog` without a domain for `Fabric GUI scale clipping`, then read
`fabric-client-ui-scale-clipping`, `fabric-client-ui-scale-clipping-safety`, or
`fabric-client-ui-scale-clipping-unsafe` with the matching authoring getter. These records are
domain-neutral guidance; they do not claim a complete Fabric authoring context or target-version
client API surface.
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
- `analyze_minecraft_log`
- `validate_fabric_mod`
- `get_fabric_toolchain`
- `resolve_velocity_toolchain`
- `search_modrinth_projects`
- `list_modrinth_project_versions`
- `resolve_modrinth_compatibility`
- `get_modrinth_resource`
- `validate_modrinth_pack`
- `validate_paper_plugin_jar`
- `validate_velocity_plugin_jar`
- `validate_mixin_config`
- `find_datapack_entries`
- `find_resourcepack_assets`
- `inspect_resourcepack_png_alpha_bounds`
- `validate_player_skin_layout`
- `validate_resourcepack_png`
- `validate_datapack_project`
- `validate_resourcepack_project`
- `validate_server_properties`
- `validate_server_access_list`
- `inspect_blockbench_project`
- `analyze_minecraft_performance`
- `validate_resourcepack_translations`
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
- `get_mojang_version_metadata`
- `fetch_mojang_server_jar`
- `search_vanilla_datapack_json_files`
- `search_vanilla_datapack_json_content`
- `get_vanilla_datapack_json`
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
- `lookup_java_player_profile`
- `get_verified_java_player_textures`

The profile tools send the supplied Java name or UUID only to fixed Mojang profile, session, and
public-key services. They accept no caller URL, headers, body, or cache path and write no disk cache
or application log. Their exact endpoints and response shapes are version-specific, undocumented
behavior pinned to the official Minecraft 26.2 Authlib 9.0.75 artifact.

`get_verified_java_player_textures` returns metadata only. `verified` establishes the signed
textures-property signature and UUID/name binding. Its 64-hex reference is extracted from verified
signed metadata; its canonical HTTPS URL is derived from that reference and is not itself a signed
string. Neither proves PNG bytes or a content digest, current skin selection, account ownership, or
licensing. The MCP tool does not download images; pass a returned hash to the separate CLI
[`player-texture download`](../cli/README.md#examples) command when bytes are needed. Skin layout
inspection and face cropping remain outside this tool.

Use `search_catalog` without a domain for `Fabric Client GameTest visual evidence`, then retrieve
the matching recipe, scenario, guardrail, diagnostic, intent, claim policy, and output requirement
with their direct getters or `get_authoring_plan`. The records use the existing `resourcepack`
client-asset authoring domain and require stable case IDs and readiness,
full-frame evidence before optional bounds-verified crops, explicit baseline-update mode, selected
set and artifact reconciliation, causal failure phases, and separate limits for non-render,
virtual-framebuffer client, and interactive-client evidence. They do not define a complete Fabric
authoring domain or claim one concrete client-test API across versions.

`validate_resourcepack_png` accepts canonical padded Base64 for one complete PNG, rejects malformed
or oversized input before decoding, and returns bounded structural and CRC diagnostics. It does not
decompress IDAT or claim the texture can be rendered.

`inspect_resourcepack_png_alpha_bounds` also accepts only canonical padded Base64, with no file
path or URL input. It returns the Catalog's bounded static-alpha facts and optional nonempty or
minimum-transparent-margin policy result. Content means alpha is nonzero; bounds are zero-based and
half-open. The tool does not crop, rewrite, render, or return paths, pixels, or RGB samples.
Malformed PNG/zlib data and inspection safety stops remain normal validation results rather than
MCP transport errors. Invalid request objects, noncanonical Base64, and limits that try to raise a
published ceiling are tool-input errors.

`validate_player_skin_layout` accepts only bounded structured `width`, `height`, and optional
`sourceRects.base` / `sourceRects.hat` objects. It returns canonical Java face UV rectangles and
current 64x64 or legacy 64x32 layout status without receiving image bytes, filesystem paths, URLs,
or player identity. It does not infer slim/wide from pixels or claim decoded alpha, conversion, or
GUI-rendering validity.

`validate_datapack_project` accepts a bounded list of project-relative paths with optional JSON,
mcmeta, or mcfunction content. It checks safe and version-correct paths, `pack.mcmeta`,
command-position function calls, function/registry tags, advancement parents, local cycles, and
bundled vanilla evidence. Omit NBT payloads; structure contents are indexed by path only. Submitted
namespaces are assumed complete by default. Set `assumeLocalNamespacesComplete` to false when
another pack or mod may merge resources into the same namespace. Those unresolved dependencies,
JSON without version-compatible schema coverage, dynamic macro commands, pack overlays, and
unsupported graph kinds are returned as explicit completeness gaps.

`analyze_minecraft_log` accepts Minecraft Java log, stack-trace, or crash-report text within both a
2 MiB UTF-8 ceiling and a 2 Mi-character ceiling. Its optional `limits` object can only lower the
Catalog ceilings for input bytes, characters, lines, line
length, events, exception chains/depth/entries, Mixin failure facts, class-loading failures, stack
frames, platforms, artifacts, components, per-value text, and aggregate retained text. The result
keeps suppressed branches distinct and defines `deepestCause` as the last explicit `Caused by` on
the primary chain. Credentials, IP addresses, absolute paths, terminal controls, and unsafe Unicode
are sanitized before parsing or retention. Explicit JAR/mod/plugin labels are evidence only and do
not assign responsibility.
`mixinFailures` summarizes only five explicit Mixin exception message shapes: missing shadow or
injection targets, failed injection checks, direct class loads from a defined mixin package, and
non-private static members. The output does not validate mappings, refmaps, Mixin configuration,
target bytecode, fixes, or runtime compatibility.
It groups slash/dot forms from explicit `NoClassDefFoundError` and `ClassNotFoundException` evidence
within one chain, while reserving `initialization-failed` for explicit `Could not initialize class`
wording. Explicit class labels do not prove dependencies, classpaths, JAR contents, shading,
ownership, fixes, or root causes.

`validate_resourcepack_project` checks model, texture, and `sounds.json` reference graphs. For an
OGG file, send canonical `contentBase64` containing no more than its first 58 bytes; the tool rejects
larger payloads and rejects arbitrary OGG `content`, then validates only the Ogg/Vorbis
identification page. For a PNG file, send canonical `contentBase64` for the complete file; arbitrary
PNG `content` is also rejected, and omitted PNG content remains an explicit incomplete-validation
condition. The request schema and runtime cap file count, path length, per-file binary input, and
aggregate binary input before decoding. The catalog layer additionally bounds total content, JSON
nodes/depth, sound events/entries, model-graph work, and retained diagnostics. Result metadata
reports applied/exceeded limits, processed files, completeness (including unverified external sound
references), and omitted diagnostic counts. `limits.maxBinaryContentBytes` may lower the project
aggregate before any Base64 payload is decoded, while `pngLimits` lowers PNG-specific byte,
dimension, pixel, and chunk caps; neither can raise the conservative defaults.

`validate_server_properties` accepts one bounded text payload and an optional target-version label.
Its schema caps characters and runtime preflight separately caps UTF-8 bytes before Catalog work.
It performs no filesystem or network access and never returns property values. Results distinguish
Java Properties syntax evidence, a conservative stable key/value subset, unknown keys, and
unverified target-version/runtime-encoding coverage; therefore exact version support is never
inferred from the caller's label.

`validate_server_access_list` accepts a `kind` and JSON `content` for one canonical vanilla server
access-list file. Character and byte size, entry count, per-entry fields, string length, JSON
nodes/depth, and retained diagnostics all use fixed ceilings. It performs no network lookup and
never returns player names, UUIDs, IP addresses, ban reasons, or ban sources from the request.
An optional 24-character canonical UTC `evaluatedAt` makes ban-expiry classification reproducible;
the effective instant is always returned.
The tool checks canonical serializer output, not every defaulted or clamped shape accepted by the
server loader; `valid: false` therefore does not guarantee loader rejection.

`inspect_blockbench_project` accepts bounded raw `.bbmodel` JSON text or a safe structured object,
plus repeatable exact animation/group requirements. Raw text reports duplicate-key evidence;
object input reports source uniqueness as unknown. The result contains only bounded metadata and
names. Newer formats, `<lz>` compression, unknown/custom formats, unsupported shapes, and exceeded
limits remain indeterminate, so requested absence is `unknown`. A present name does not validate
animation playback, textures, rendering/export, plugin semantics, ModelEngine compatibility, or
behavior associated with any group (including one named `seat`).

`analyze_minecraft_performance` accepts 2-10,000 normalized, strictly ordered canonical UTC
samples through a closed structured schema. It exposes only TPS, MSPT, CPU percent, heap used
bytes, loaded chunks, entities, players, and GC pause milliseconds; identity, UUID, coordinate,
host, and source-label fields are not accepted. Results cover missing data, min/p50/p95/max,
bounded threshold intervals, trends, optional before/after evidence, and exact-timestamp MSPT
associations with at least ten aligned non-constant observations.

Only Paper's [20 TPS target and 50 ms tick budget](https://docs.papermc.io/paper/reference/commands/)
are automatic thresholds. All other thresholds are explicit. Associations and changes are
descriptive candidate signals, never causal conclusions. Threshold violations recommend only a
scoped spark capture following Paper's [profiling guidance](https://docs.papermc.io/paper/profiling/)
while the issue is active. MCP receives an already-parsed object, so it cannot detect duplicate
keys that may have existed in source JSON; use the file CLI when source-level uniqueness matters.

`validate_resourcepack_translations` accepts bounded raw JSON text or parsed locale objects. Raw
text can prove duplicate source keys; parsed objects report source-key uniqueness as unknown. The
tool compares exact global keys and normalized placeholder reference multisets only for supplied,
explicitly required locales. It never returns translation values, and its schema plus runtime
preflight reject accessors, symbols, proxies, non-plain objects, sparse arrays, and aggregate work
above the published limits.

`validate_modrinth_pack` accepts index JSON and optional archive-entry metadata; MCP does not accept
binary ZIP uploads. Supply optional compressed sizes, flags, compression methods, CRC-32 values,
and Unix modes for stronger metadata checks. The result therefore reports `validationStrength` as
`none` or `metadata`, never `binary`. Downloads use Modrinth's official four-host allowlist by
default. `additionalDownloadHosts` explicitly extends it and produces non-official-host warnings;
`limits` bounds entries, sizes, ratios, and retained diagnostics.

`resolve_velocity_toolchain` performs the same bounded official PaperMC Maven/docs lookup as the
CLI. Its provenance distinguishes retrieved, unavailable, and malformed sources, and its result
explicitly declines to infer Minecraft compatibility from Velocity versions.

`validate_fabric_mod` accepts parsed `fabric.mod.json` data or bounded JSON text plus optional
`archiveEntries`; it never accepts binary JAR content. Input arrays, path strings, JSON complexity,
and caller-supplied limits are checked against fixed Catalog ceilings before validation. It covers
bounded structural rules for current schema v1 and available archive-reference evidence, but does
not validate dependency predicates or satisfaction, entrypoint classes or runtime loading,
mixin/access-widener syntax, nested JAR metadata, or icon pixels. `limits` can lower only the
archive-entry count, metadata byte/node/depth/string-byte, and retained-diagnostic ceilings that
this metadata-only surface actually applies.

`validate_paper_plugin_jar` accepts bounded `pluginYml` / `paperPluginYml` text and JAR entry
metadata, not binary uploads. Callers must state whether the entry list is complete. Paper's
`paper-plugin.yml`-first probing determines the active descriptor; a coexisting `plugin.yml` is
reported as shadowed and is not treated as runtime configuration. An incomplete listing that only
observes `plugin.yml` leaves descriptor selection unknown and skips semantic validation because an
unobserved `paper-plugin.yml` could shadow it. A missing root descriptor becomes
an error only for a complete, fully normalized listing. A declared class absent from that listing is
only a warning because a library or dependency classloader may supply it. Syntactically valid but
currently unlisted Paper API release values also remain unknown. The result always identifies
metadata-only strength and leaves ZIP structure, descriptor CRC integrity, class bytecode and
resolution, exact runtime YAML parity, and server loading unproven. Use the CLI command for binary
JAR validation.

`validate_velocity_plugin_jar` accepts bounded `velocity-plugin.json` text or a parsed JSON object,
JAR entry metadata, and an explicit completeness flag. It validates current descriptor structure,
plugin IDs, and entrypoint-path evidence without accepting binary uploads. The result is always
metadata-only: ZIP central/local headers, CRC integrity, entrypoint classfile identity and Java
target, runtime-visible `@Plugin` contents, dependency satisfaction, JVM linkage, Guice injection,
Velocity loading, runtime behavior, and security remain unproven. Missing-entry errors require a
complete list whose entries all pass normalization; otherwise absence remains unknown. Use the CLI
command when binary evidence is required. Descriptor strings are checked for duplicate JSON object
keys before parsing. Parsed object input cannot represent duplicates, so the result exposes
`duplicateKeysChecked: false` and keeps source-key uniqueness incomplete.

`validate_mixin_config` accepts raw Mixin config JSON text or an already-parsed object plus optional
logical entry paths from one supplied archive. Raw text preserves duplicate-key source evidence;
parsed objects cannot prove original key uniqueness. `archiveEntriesComplete` applies only to the
supplied archive, so locally missing references remain unknown rather than proving runtime
classpath absence. The tool accepts no local filesystem paths or binary archives and does not
inspect bytecode, target/injection behavior, mappings, or launcher integration. See
[Mixin configuration validation](../../docs/MIXIN_CONFIG_VALIDATION.md).

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
- `minecraft-skills://data/authoring-recipes/paper-safe-item-delivery.json`
- `minecraft-skills://data/authoring-scenarios/paper-event-listener-review.json`
- `minecraft-skills://data/authoring-scenarios/paper-item-delivery-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-api-surface-limits.json`
- `minecraft-skills://data/authoring-guardrails/paper-event-listener-semantics-safety.json`
- `minecraft-skills://data/authoring-guardrails/paper-inventory-delivery-outcomes.json`
- `minecraft-skills://data/authoring-diagnostics/paper-api-member-unverified.json`
- `minecraft-skills://data/authoring-diagnostics/paper-event-listener-semantics-unsafe.json`
- `minecraft-skills://data/authoring-diagnostics/paper-inventory-leftovers-unhandled.json`
- `minecraft-skills://data/authoring-recipes/paper-inventory-gui-interactions.json`
- `minecraft-skills://data/authoring-scenarios/paper-inventory-gui-interaction-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-inventory-gui-interaction-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-inventory-gui-interaction-unbounded.json`
- `minecraft-skills://data/authoring-recipes/paper-administrative-command-operability.json`
- `minecraft-skills://data/authoring-scenarios/paper-administrative-command-operability-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-administrative-command-operability.json`
- `minecraft-skills://data/authoring-diagnostics/paper-administrative-command-incomplete.json`
- `minecraft-skills://data/authoring-recipes/paper-player-identity-and-display.json`
- `minecraft-skills://data/authoring-scenarios/paper-player-identity-and-display-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-player-identity-and-display.json`
- `minecraft-skills://data/authoring-diagnostics/paper-player-identity-display-confusion.json`
- `minecraft-skills://data/authoring-recipes/paper-itemstack-semantic-identity.json`
- `minecraft-skills://data/authoring-scenarios/paper-itemstack-semantic-identity-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-itemstack-semantic-identity.json`
- `minecraft-skills://data/authoring-diagnostics/paper-itemstack-identity-or-state-loss.json`
- `minecraft-skills://data/authoring-recipes/paper-plugin-protocol-safety.json`
- `minecraft-skills://data/authoring-scenarios/paper-plugin-protocol-safety-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-plugin-protocol-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-plugin-protocol-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-scheduled-task-lifecycle.json`
- `minecraft-skills://data/authoring-scenarios/paper-scheduled-task-lifecycle-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-scheduled-task-lifecycle-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-scheduled-task-lifecycle-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-player-session-lifecycle.json`
- `minecraft-skills://data/authoring-scenarios/paper-player-session-lifecycle-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-player-session-lifecycle-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-player-session-lifecycle-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-bossbar-audience-lifecycle.json`
- `minecraft-skills://data/authoring-scenarios/paper-bossbar-audience-lifecycle-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-bossbar-audience-lifecycle-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-bossbar-audience-lifecycle-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-plugin-configuration-lifecycle.json`
- `minecraft-skills://data/authoring-scenarios/paper-plugin-configuration-lifecycle-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-plugin-configuration-lifecycle-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-plugin-configuration-lifecycle-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-persistent-data-contract.json`
- `minecraft-skills://data/authoring-scenarios/paper-persistent-data-contract-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-persistent-data-contract.json`
- `minecraft-skills://data/authoring-diagnostics/paper-persistent-data-contract-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-display-interaction-contract.json`
- `minecraft-skills://data/authoring-scenarios/paper-display-interaction-contract-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-display-interaction-contract.json`
- `minecraft-skills://data/authoring-diagnostics/paper-display-interaction-contract-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-high-frequency-persistence.json`
- `minecraft-skills://data/authoring-scenarios/paper-high-frequency-persistence-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-high-frequency-persistence-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-high-frequency-persistence-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-server-backed-paged-ui.json`
- `minecraft-skills://data/authoring-scenarios/paper-server-backed-paged-ui-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-server-backed-paged-ui-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-server-backed-paged-ui-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-death-respawn-handoff.json`
- `minecraft-skills://data/authoring-scenarios/paper-death-respawn-handoff-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-death-respawn-handoff-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-death-respawn-handoff-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-plugin-testing-evidence.json`
- `minecraft-skills://data/authoring-scenarios/paper-plugin-testing-evidence-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-plugin-testing-evidence.json`
- `minecraft-skills://data/authoring-diagnostics/paper-plugin-test-evidence-gap.json`
- `minecraft-skills://data/authoring-recipes/fabric-client-gametest-visual-evidence.json`
- `minecraft-skills://data/authoring-scenarios/fabric-client-gametest-visual-evidence-review.json`
- `minecraft-skills://data/authoring-guardrails/fabric-client-gametest-visual-evidence-integrity.json`
- `minecraft-skills://data/authoring-diagnostics/fabric-client-gametest-visual-evidence-gap.json`
- `minecraft-skills://data/intent-lookups/verify-fabric-client-visual-evidence.json`
- `minecraft-skills://data/claim-policies/fabric-client-visual-evidence-claim.json`
- `minecraft-skills://data/output-requirements/fabric-client-visual-evidence-report.json`
- `minecraft-skills://data/authoring-recipes/fabric-client-ui-scale-clipping.json`
- `minecraft-skills://data/authoring-guardrails/fabric-client-ui-scale-clipping-safety.json`
- `minecraft-skills://data/authoring-diagnostics/fabric-client-ui-scale-clipping-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-world-operation-safety.json`
- `minecraft-skills://data/authoring-scenarios/paper-world-operation-safety-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-world-operation-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-world-operation-unbounded.json`
- `minecraft-skills://data/authoring-recipes/paper-custom-recipe-registration.json`
- `minecraft-skills://data/authoring-scenarios/paper-custom-recipe-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-custom-recipe-ownership.json`
- `minecraft-skills://data/authoring-diagnostics/paper-custom-recipe-registration-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-attribute-effect-ownership.json`
- `minecraft-skills://data/authoring-scenarios/paper-attribute-effect-ownership-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-attribute-effect-ownership-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-attribute-effect-ownership-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-modelengine-runtime-binding.json`
- `minecraft-skills://data/authoring-scenarios/paper-modelengine-runtime-binding-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-modelengine-runtime-binding-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-modelengine-runtime-binding-unsafe.json`
- `minecraft-skills://data/authoring-recipes/paper-region-protection-policy.json`
- `minecraft-skills://data/authoring-scenarios/paper-region-protection-policy-review.json`
- `minecraft-skills://data/authoring-guardrails/paper-region-protection-policy-safety.json`
- `minecraft-skills://data/authoring-diagnostics/paper-region-protection-policy-incomplete.json`
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
