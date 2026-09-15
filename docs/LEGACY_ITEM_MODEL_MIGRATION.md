# Legacy item model migration

`minecraft-skills migrate-legacy-item-model example:item/wand model.json` prints a proposed
conversion without writing files. Catalog: `migrateLegacyItemModel(modelId, model)`.
MCP: `migrate_legacy_item_model` with `modelId` and a parsed `model` object.

The converter supports one numeric property per model:

- `custom_model_data`: positive, exactly float-representable integers, mapped to float index 0.
- `damage`: finite normalized thresholds in `[0, 1]`, optionally combined with `damaged: 0` or `damaged: 1`.

Duplicate and unordered thresholds preserve the last matching source override. Thresholds use
float32 semantics. Damage branches are split by `minecraft:damaged` only when their selected
models differ. Redundant thresholds are omitted without changing model selection. The input
limit is 4,096 overrides and 2 MiB of JSON.

Mixed numeric properties, unsupported predicates and inexact custom-model-data values return
`unsupported` with no generated output. Zero/negative custom-model-data thresholds are excluded
because absent component behavior must not be inferred from a legacy numeric predicate. Damage
thresholds may be zero. Callers must verify damage normalization, damaged-state semantics and
maximum durability against the source and target versions before applying the generated output.

For an input such as:

```json
{"parent":"item/generated","textures":{"layer0":"example:item/wand"},"overrides":[{"predicate":{"custom_model_data":1},"model":"example:item/red_wand"}]}
```

The output separates `generated.geometry` (the original geometry without `overrides`) and
`generated.itemDefinition` (a `minecraft:range_dispatch` over float index 0, retaining a fallback
to `example:item/wand`). Install them at distinct model and item-definition paths. Geometry,
textures and display transforms are retained. Referenced models are not recursively converted.

Check source and target schemas through version-aware lookups before applying the output; this
is a schema-to-schema transformation, not a target-version compatibility check. It preserves
numeric selection for compatible stored data; it neither rewrites item stacks nor chooses new
`item_model` identifiers. For new item designs, use an explicit namespaced item model for stable
presentation identity and expanded custom-model-data fields only for the variation required by
that definition. Gameplay identity should be managed separately by the plugin.

The CLI accepts a bounded regular local JSON file up to 2 MiB and refuses links/special files.
Exit 0 means converted or unchanged; exit 1 means unsupported or invalid input. A successful
conversion does not prove reference validity or visual equivalence. Validate the assembled pack,
compare selected models at integer states and adjacent float32 boundaries, and compare resolved
geometry, textures and inventory/first-person/third-person transforms. Use the target client to
check model baking, atlas membership, UV bounds and shader loading. When rendered comparisons
are needed, record the same render conditions on both clients. Blockbench can inspect retained geometry and
display transforms, but its preview alone is not evidence of the game's item selection behavior.
