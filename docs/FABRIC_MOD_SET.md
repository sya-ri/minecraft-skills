# Validate a selected Fabric mod set

Use `validate_fabric_mod_set`, Catalog `validateFabricModSet`, or
`minecraft-skills fabric validate-set selection.json` to check a fixed selection of Fabric
schema-v1 metadata. This closes the gap between validating one `fabric.mod.json` and checking
whether its declared dependencies are satisfied by the other selected mods and runtime versions.
`resolve_modrinth_compatibility` compares Modrinth game-version/loader support; it does not inspect
this local selection or its dependency declarations.

```json
{
  "mods": [
    {
      "label": "example.jar",
      "metadata": {
        "schemaVersion": 1,
        "id": "example",
        "version": "1.0.0",
        "depends": { "java": ">=21", "shared_api": "1.x" }
      }
    },
    {
      "metadata": {
        "schemaVersion": 1,
        "id": "shared",
        "version": "1.2.0",
        "provides": ["shared_api"]
      }
    }
  ],
  "environment": "server",
  "runtimeVersions": { "minecraft": "1.21.1", "java": "21", "fabricloader": "0.16.10" },
  "selectionComplete": true
}
```

The example versions illustrate input syntax; they are not a recommended toolchain. Supply the
exact built-in versions reported by your Loader instance, including its normalized Minecraft
version. The tool does not convert launcher snapshot names or guess Java/Loader versions. Each
`metadata` accepts either parsed JSON or raw `fabric.mod.json` JSON text. `label` is an optional
logical label of at most 256 characters; it is never opened as a path. The CLI opens only the one
specified regular JSON input file, with an 8 MiB byte limit and strict UTF-8 decoding.

## Result and completeness

`status` is `invalid` when a checked hard constraint fails, `satisfied` when the checked selected
metadata set is complete and has no hard failures, or `incomplete` otherwise. Soft warnings can
coexist with `satisfied`. The CLI exits zero only for `satisfied`.

`coverage.selectionComplete` preserves the caller's explicit assertion. Missing dependencies are
errors only when selection coverage and metadata inspection are complete. Otherwise they are
`unverified`; a supplied provider with a wrong version or a matching `breaks` declaration remains
a definite failure among the supplied metadata. Negative dependencies with an absent provider
also remain unverified when the selection is incomplete. Ambiguous selected providers are errors,
and dependencies referring to them are unverified.

Declared nested JARs always produce `coverage.nestedSelection: "unverified"` and
keep whole-set coverage incomplete. Supplying metadata for a possible nested child permits checking
that supplied relationship, but does not prove which nested candidates Loader selected. No child
is automatically selected, extracted, or downloaded. A failed bounded metadata snapshot also
prevents a complete result; diagnostics and coverage identify limits or malformed metadata.

This checks declared metadata relationships. It does not prove runtime loading, entrypoint or
mixin correctness, access-widener syntax, Java class compatibility, or successful game startup.
Dependency overrides, custom built-ins, alternative-version solving, original duplicate JSON
members, and old Loader implementation differences are outside the checked scope.

## Dependency rules

| Declaration | Missing or wrong-version provider in a complete set | Matching provider |
| --- | --- | --- |
| `depends` | Error | Satisfied |
| `recommends` | Warning | Satisfied |
| `suggests` | Informational metadata only | Informational metadata only |
| `breaks` | Satisfied when absent or nonmatching | Error |
| `conflicts` | Satisfied when absent or nonmatching | Warning |

`provides` aliases use their owning mod's version. Selected IDs and aliases must be unique,
including collisions with `minecraft`, `java`, and `fabricloader`. Duplicate aliases within one
mod and aliases that repeat the mod's own ID also conflict.

`environment` selects the physical client or dedicated-server environment. Inactive mods do not
provide active dependency identities. Loader's schema-v1 compatibility rule softens `depends`
and `recommends` to suggestions when no active provider exists but a matching environment-disabled
mod with that primary ID exists. The tool reports that rule explicitly when selection coverage is
complete. Disabled `provides` aliases are not used for this rule, matching Loader's discovery map.

Predicates follow Fabric's semantics: literal-space-separated terms are AND, predicate arrays
are OR, and an empty array matches no version. Empty/`*` terms match any version. Numeric semantic
versions support arbitrary component counts padded with zero, prerelease ordering, ignored build
metadata, comparisons, `~`, `^`, and equality wildcards. Fabric's `^0.2` permits later `0.x`
versions; npm semver's leading-zero caret behavior is not used. Nonsemantic versions use exact
friendly-string equality for inclusive operators; exclusive `<`/`>` bounds on them are invalid.
The parser retains Loader's fallback to nonsemantic string versions for malformed numeric forms.

## Bounds

Catalog and MCP accept optional `limits` that can only lower these ceilings:

| Limit | Ceiling |
| --- | --- |
| `maxMods` | 512 |
| `maxInputBytes` | 8 MiB aggregate metadata/runtime/label UTF-8 bytes |
| `maxDependencyEdges` | 50,000 declarations |
| `maxDiagnostics` | 200 retained diagnostics |
| `maxMetadataBytes` | 2 MiB per raw metadata document |
| `maxMetadataNodes` | 20,000 per metadata document |
| `maxMetadataDepth` | 64 |
| `maxMetadataStringBytes` | 2 MiB per metadata document |

Parsed metadata uses the existing bounded single-mod inspection and a safe snapshot. Aggregate
bytes for object input use that snapshot's JSON encoding. Version fields have an additional
8,192-character ceiling. Diagnostic text is bounded; full counts and omitted diagnostic counts
remain available when the retained diagnostic list is truncated. The tool returns summaries and
diagnostics rather than echoing complete metadata or every successful dependency edge.

## Reference semantics

The implementation and offline fixtures were checked against the
[Fabric metadata documentation](https://docs.fabricmc.net/develop/loader/fabric-mod-json) and
Fabric Loader commit `c75cac153757b1a75e63e901bed5bc97eff630d3`:

- [Version parsing and predicates](https://github.com/FabricMC/fabric-loader/blob/c75cac153757b1a75e63e901bed5bc97eff630d3/src/main/java/net/fabricmc/loader/impl/util/version/VersionPredicateParser.java)
- [Numeric and prerelease comparison](https://github.com/FabricMC/fabric-loader/blob/c75cac153757b1a75e63e901bed5bc97eff630d3/src/main/java/net/fabricmc/loader/impl/util/version/SemanticVersionImpl.java)
- [Operator behavior](https://github.com/FabricMC/fabric-loader/blob/c75cac153757b1a75e63e901bed5bc97eff630d3/src/main/java/net/fabricmc/loader/api/metadata/version/VersionComparisonOperator.java)
- [Environment softening and identity collisions](https://github.com/FabricMC/fabric-loader/blob/c75cac153757b1a75e63e901bed5bc97eff630d3/src/main/java/net/fabricmc/loader/impl/discovery/ModResolver.java)
- [Environment-disabled identity collection](https://github.com/FabricMC/fabric-loader/blob/c75cac153757b1a75e63e901bed5bc97eff630d3/src/main/java/net/fabricmc/loader/impl/discovery/ModDiscoverer.java)

The validator runs offline; these links identify its reference semantics and are not fetched when
the tool is called.
