# JAR Inventory and Comparison

Use a common inventory to compare local Fabric mods, Paper/Bukkit plugins and Velocity plugins
without treating file names or unknown metadata as plugin versions. Collection reads and hashes
local bytes; comparison operates on extracted records and never loads plugin code.

```sh
minecraft-skills minecraft jars inventory ./plugins
minecraft-skills minecraft jars diff ./before ./after
```

## Collection

The generic CLI scans one direct directory for `.jar` basenames case-insensitively. It is
non-recursive, does not follow links or read special files, and uses the existing Fabric scanner's
file/directory identity and change checks. Nothing is downloaded, updated or deleted. SHA-256 covers
the stable bytes read for each archive; it does not authenticate a publisher or validate every ZIP
resource. Nested archives and runtime classpaths remain outside the inventory.

Catalog `inspectJarInventoryRecord(archiveName, bytes)` reuses the platform descriptor parsers:

| Platform | Identity / version source |
| --- | --- |
| `fabric` | Root `fabric.mod.json` ID and version |
| `paper` | Active `paper-plugin.yml` or `plugin.yml` name and version; Paper descriptor precedence applies |
| `velocity` | Root `velocity-plugin.json` ID and optional version |

Descriptor identity is separate from full plugin validation. Invalid unrelated descriptor fields,
missing entrypoint classes, or unknown runtime compatibility do not turn parsed name/version fields
into a successful plugin validation. A missing optional Velocity version stays null. The Paper
validator now exposes bounded active-descriptor `identity` fields and the Velocity validator exposes
its already-parsed `version`; shadowed/unparsed Paper descriptors have no identity result.
Multiple platform descriptors, absent descriptors, unreadable metadata and missing identity fields
remain explicit gaps. Unknown archive identities are not guessed from basenames.

CLI output contains `evidenceStrength: "binary"`, a versioned `inventory` suitable for comparison,
a `summary` of duplicate identities and unknown fields, and bounded collection diagnostics. Archive
basenames are logical names; absolute directory paths and operating-system error details are not
returned. A complete inventory requires successful collection, identified records and no duplicate
platform/ID groups. Optional missing versions remain visible without invalidating known identity.

## Extracted Record Contract

MCP `compare_jar_inventories` and Catalog `compareJarInventories({ left, right })` accept two inventories:

```json
{
  "schemaVersion": 1,
  "scanComplete": true,
  "records": [
    {
      "archiveName": "example.jar",
      "platform": "paper",
      "id": "Example",
      "version": "1.0.0",
      "sha256": null,
      "byteLength": 1024,
      "metadataIssue": null
    }
  ]
}
```

`platform`, `id`, `version`, `sha256` and `byteLength` may be null for unknown evidence; an ID requires
a platform. `metadataIssue` is null or one of `archive-limit`, `archive-unreadable`,
`descriptor-missing`, `multiple-platform-descriptors`, `identity-unavailable`, or `jar-read-failed`.
`scanComplete` is a caller claim about direct archive candidates. All fields are required; unsafe or
duplicate archive basenames, unsupported fields, accessors and invalid bounds are rejected. Catalog
`normalizeJarInventory` validates and sorts records, and `summarizeJarInventory` reports coverage.
MCP accepts no local path or binary payload and never grants byte-verification evidence.

## Comparison Semantics

Records pair only by exact platform and declared ID. Equal IDs on different platforms stay separate;
case folding, loader aliases and dependency identities are not inferred. Duplicate groups are
`ambiguous`, and unknown identities are `unidentified`. They are never arbitrarily paired by filename.

Known unequal SHA-256 values establish `contentChanged: true` relative to the supplied hashes.
Missing hashes yield null, even when one side has a digest. Version changes likewise require two
known values. Basename changes are reported separately from content changes. A pair may be both
changed by known metadata and unresolved for byte comparison. Equal known hashes can settle byte
comparison even when an optional version is absent.

Added/removed identities are reported only when the opposite inventory is both complete and fully
identified. Otherwise records are `unmatched`; omission does not prove absence. `hasDifferences` is
true for observed changes, false for complete equal comparisons, and null when no difference is
known but comparison remains incomplete. `comparisonComplete` requires complete scans, unique known
identities and known hashes. Counts reflect all records even when result arrays are truncated.

CLI inventory exits 0 for complete collection/identity evidence. CLI diff exits 0 only for complete
comparisons without differences. Changed/incomplete outcomes return 1 with JSON; invalid command
arguments return 1 with stderr. `collectionEvidence` distinguishes CLI's local collection from the
comparison's supplied-metadata contract. Runtime startup, dependency graphs, load order, Minecraft
compatibility, archive authenticity and nested plugin identities are not established.

## Limits and Compatibility

Generic collection inspects at most 10,000 direct directory entries, 512 JARs, 64 MiB per archive,
1 GiB of accounted reads, and 16,384 entries per archive. Basenames are bounded to 255 characters,
IDs to 128 and versions to 2,048. Diagnostic and per-category comparison output is capped at 200 with
total counts and truncation flags. Format-specific descriptor parser bounds also apply.

Existing `fabric mods inventory` / `fabric mods diff` commands and exported Fabric types retain their
schema, fields, defaults, lowercase `.jar` selection and 256 MiB per-JAR ceiling. Their directory
discovery and stable-read implementation is shared with the new generic command; the new generic
comparison contract applies to `minecraft jars diff` and `compare_jar_inventories`.
