# Source Strategy

This project provides machine-readable Minecraft authoring facts for AI agents. Source handling is
part of the product surface: agents should know what can be asserted, what is only a candidate, and
which sources must not be fetched automatically.

## Hard Rule

Minecraft Wiki is human-only background for this repository. AI workflows must not fetch, crawl,
summarize, or cite Minecraft Wiki pages as machine evidence.

The repository may mention this rule, but it must not expose Minecraft Wiki URLs, source ids, or
navigation entries as agent-usable sources. `pnpm validate` enforces this.

## Source Tiers

Use `minecraft-skills source report`, `minecraft-skills source tiers`, or MCP
`get_source_report`/`list_source_tiers` to inspect the machine-readable form of this policy.

- `canonical-official`: Mojang version metadata, official jars, generated reports, PaperMC API, and
  Paper Javadocs. Use this for version-specific facts that generated files or code depend on.
- `derived-bundled`: minecraft-skills indexes generated from official or accepted structured data,
  such as command paths, vanilla paths, observed JSON surfaces, and Paper API surfaces.
- `community-structured`: structured datasets that help fill search and migration workflows, but
  are not canonical by themselves.
- `human-reviewed-guidance`: original project guidance, recipes, diagnostics, claim policies, and
  response patterns.
- `human-only-background`: material maintainers may read manually outside automated AI retrieval.

## Structured Community Datasets

These sources are useful because they are structured and versioned. They should be imported as
machine-readable facts with explicit limits, not copied as prose.

| Dataset | Best use | Limit |
| --- | --- | --- |
| PrismarineJS `minecraft-data` | Blocks, items, entities, recipes, protocol versions, features, commands, sounds, and language-index lookups. | Supplemental; cross-check with Mojang-derived data before canonical claims. |
| PrismarineJS `minecraft-assets` | Resource pack asset names, image-oriented asset indexes, and legacy texture mapping candidates. | Supplemental; official jar extraction remains canonical for vanilla path presence. |
| `InventivetalentDev/minecraft-assets` | On-demand resource pack asset file lookup, version path index search, and cached archive references extracted from Minecraft client assets. | Supplemental mirror; do not treat as more canonical than Mojang metadata, official jars, or generated vanilla inventories. |
| `misode/mcmeta` | Version-controlled generated data/assets history, summaries, registries, and diffs. | Community processed; use as structured corroboration and migration input. |

## Importer Policy

Future importers should follow this shape:

1. Fetch or read a pinned upstream artifact.
2. Record source id, upstream URL, retrieved timestamp, and upstream version or commit when
   available.
3. Normalize into compact JSON under `packages/data/data`.
4. Mark the fact surface as `community-structured` unless corroborated by Mojang/Paper data.
5. Add conflict checks when an official or derived bundled source can disagree with the imported
   data.
6. Add tests and maintainer validation before exposing the data through CLI, MCP, or package APIs.

## Claim Wording

Use this wording discipline in generated answers and docs:

- Canonical official or derived bundled source: "verified for target version" only within the
  documented fact-surface guarantees.
- Community structured source: "candidate", "supplemental", or "observed in structured dataset"
  unless cross-checked.
- Missing source: state the gap and do not fill it from memory.
- Human-only background: do not cite it in AI output.

## Current Enforcement

`pnpm validate` checks that:

- Minecraft Wiki automation remains forbidden in `catalog.json`.
- Domains do not expose Minecraft Wiki entries as primary sources.
- Deprecated source kind `community-navigation` is not used.
- Agent-facing files do not reintroduce Minecraft Wiki URLs or old "navigation/provenance" wording.
- PrismarineJS, `InventivetalentDev/minecraft-assets`, and `misode/mcmeta` remain listed as
  recommended structured community datasets.
