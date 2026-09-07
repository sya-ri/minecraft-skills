# Datapack tag resolution

`resolve_datapack_tag`, Catalog `resolveDatapackTag`, and CLI `datapack resolve-tag` inspect one
tag across an explicitly ordered pack stack. This answers which IDs contribute after another
pack appends, replaces a definition, or changes a nested tag. The initial supported versions
are exactly Java **26.2** and **1.21.11**; aliases and other versions are rejected.

```sh
minecraft-skills datapack resolve-tag 26.2 minecraft:item example:tools \
  --pack-root ./base-pack --pack-root ./higher-priority-pack
```

Roots are required and ordered from lowest to highest priority. The CLI uses the existing stable
directory scanner: it rejects links, special files, changes during traversal, unsafe paths, and
excessive input. It reads JSON, `pack.mcmeta`, and function text under one aggregate stack budget.
Output uses `pack-1`, `pack-2`, etc. in the same order, without exposing absolute local paths.
Exit status is zero only when `resolutionComplete` is true. `--limit` caps each output section.

The MCP and Catalog input expresses the same order with named packs:

```json
{
  "version": "26.2",
  "registry": "minecraft:item",
  "tag": "example:tools",
  "includeVanilla": true,
  "packs": [
    {
      "id": "base",
      "files": [
        {"path": "pack.mcmeta", "content": {"pack": {"pack_format": 107, "description": "Base"}}},
        {"path": "data/example/tags/item/tools.json", "content": {"values": ["minecraft:stick"]}}
      ]
    },
    {
      "id": "higher",
      "files": [
        {"path": "pack.mcmeta", "content": {"pack": {"pack_format": 107, "description": "Higher"}}},
        {"path": "data/example/tags/item/tools.json", "content": {"replace": true, "values": ["minecraft:iron_pickaxe"]}}
      ]
    }
  ]
}
```

The example resolves only `minecraft:iron_pickaxe`. IDs may omit the `minecraft:` namespace;
`tag` must not include `#`. A tag entry beginning with `#` refers to another tag in the same
registry. Nested tags use the final stack, including definitions from higher priority packs.
`replace: true` discards all lower contributions to that tag; later definitions can append again.
Duplicate members retain their first occurrence order and first contributing leaf source.

Every tag-enabled vanilla registry in the exact-version report is accepted, along with
`minecraft:function`. The directory is the registry path, such as `tags/item`,
`tags/worldgen/biome`, or `tags/function`. Static element IDs use the official registry entry
index. Data-defined registry elements and functions use file-path evidence. Referenced custom
element files produce incomplete candidates because their decoding/compilation is not checked.

By default cached official vanilla tag JSON forms a lowest-priority `vanilla` layer. The tool
never downloads a jar. When needed, fetch it explicitly with `fetch_mojang_server_jar` or
`minecraft-skills datapack vanilla-json fetch 26.2`, then retry. Uncached vanilla tag content
remains unknown, even for optional references; an effective local replacement can remove the
need for that lower content. `includeVanilla: false` / `--no-vanilla` excludes vanilla **tag
definitions**. Built-in element IDs and vanilla registry/function paths remain available as
existence evidence. Optional built-in experimental packs are not activated implicitly.

## Reading results

- `status: resolved` and `resolutionComplete: true` mean the selected tag graph was resolved
  against the supplied stack and supported evidence. `members` contains retained IDs and sources.
- `status: unresolved` means the selected tag is absent or has a required missing element/tag.
  A required failure invalidates the whole tag: no partial `members` are returned. A failed
  nested tag may be skipped when its parent reference has `required: false`.
- `status: incomplete` means the available evidence cannot establish membership. When the graph
  can still produce candidates, they appear separately in `candidateMembers`; `members` stays
  empty. Missing metadata/content, malformed definitions, missing registry indexes, unsupported
  extensions, overlays, filters, cycles and exhausted graph budgets are explicit reasons.
- `definitions` records the visited append/replace contributions and whether a higher replacement
  discarded them. `references` records each checked edge with its source and resolution state.
  Member `source` identifies the first leaf pack, file, tag, and zero-based `values` index.
  A file-level diagnostic uses `source.index: null`.
- `memberCount`, `candidateMemberCount`, `definitionCount`, `diagnosticCount` and
  `checkedReferences` describe totals before retention limits. `truncated` signals omitted
  output, independently of resolution completeness.

The default ceilings are 32 packs, 25,000 total files, 4,096 characters per path, 16 MiB of
aggregate text, 250,000 parsed nodes, depth 128, and 250,000 graph operations. Results retain
100 records per section by default (maximum 1,000). Catalog callers can lower work budgets.
Input exceeding a preflight ceiling is rejected before graph traversal. JSON text with duplicate
object keys is rejected; parsed JSON objects provide their supplied values as evidence.

This resolver assumes the caller selected the active roots and supplied their full inventories.
It does not load Minecraft, determine pack activation or format compatibility, apply overlays
or resource filters, select feature flags, decode custom registry JSON, compile functions, or
implement mod-loader extensions. Validate pack contents separately with `validate_datapack_project`.
Cycles including optional edges are reported as incomplete because the dependency sorter's
tie-breaking behavior is outside this bounded resolver.

## Verified sources

The semantics were checked against the official server artifacts for both supported versions:

| Version | Official server SHA-1 | Inspected classes |
| --- | --- | --- |
| 26.2 | [`823e2250d24b3ddac457a60c92a6a941943fcd6a`](https://piston-data.mojang.com/v1/objects/823e2250d24b3ddac457a60c92a6a941943fcd6a/server.jar) | `net.minecraft.tags.TagLoader`, `TagEntry` |
| 1.21.11 | [`64bb6d763bed0a9f1d632ec347938594144943ed`](https://piston-data.mojang.com/v1/objects/64bb6d763bed0a9f1d632ec347938594144943ed/server.jar) | `beg` (`TagLoader`), `bed` (`TagEntry`) |

The official [1.21.11 server mappings](https://piston-data.mojang.com/v1/objects/5621e9253f05fd57872bbe7f8ddf5f9a7d525955/server.txt)
were verified with SHA-1 `5621e9253f05fd57872bbe7f8ddf5f9a7d525955`. Both loaders clear the
accumulated list on replacement, retain ordered set membership, and discard a built tag's
membership when a required entry cannot resolve. Optional entries succeed without contributing
members when the target is absent.

Official release notes also describe [append/replace and nested same-type tags](https://www.minecraft.net/en-us/article/minecraft-snapshot-17w50a),
[optional entries](https://feedback.minecraft.net/hc/en-us/articles/360047630831-Minecraft-Java-Edition-1-16-2),
and [singular registry directory names](https://feedback.minecraft.net/hc/en-us/articles/27439697297421-Minecraft-Java-Edition-Snapshot-24w21b).
