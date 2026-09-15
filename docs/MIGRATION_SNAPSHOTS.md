# Compare migration snapshots

`minecraft-skills compare-migration-snapshots before.json after.json` compares bounded,
caller-normalized observations. Catalog: `compareMigrationSnapshots(before, after)`.
MCP: `compare_migration_snapshots` with `before` and `after` objects.

```json
{"version":"source","coverage":"region-A:blockstates:normalizer-v1","complete":true,"records":[{"key":"overworld:0,64,0","value":{"block":"minecraft:stone","properties":{}}}]}
```

Each snapshot must identify the actual observed version, coverage and normalization contract,
completion, and unique keyed JSON values. Object and record order do not matter; array order does.
Finite JSON values only, at most 100,000 records, 512-character keys, 32 nesting levels and
16 MiB of normalized record data are accepted. CLI inputs are bounded regular local JSON files
up to 24 MiB; links and special files are refused.

The output contains added/removed/changed keys, total differences and at most 100 change entries.
Values are omitted, but keys may themselves be sensitive; choose logical coordinates or case IDs
and review reports before sharing. Empty observations, incomplete captures or different coverage
produce `incomplete`, never `equal`. CLI exit 0 requires equality; every other verdict exits 1.

This does not read NBT, upgrade a world, validate claimed coverage, or establish visual/gameplay
equivalence. Supply version-aware extraction separately and record every intentional normalization
rule. Do not remove unsupported fields to force equality. Compare block states, block entities,
entity/item data and required gameplay state as separate covered datasets where appropriate.
Prioritize spawn and measured player routes in test selection, and report unobserved areas. A
matching block-only dataset does not establish that inventories or entities migrated correctly.
