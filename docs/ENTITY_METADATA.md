# Versioned entity metadata declarations

`get_entity_metadata`, Catalog `getEntityMetadata`, and CLI `minecraft entity-metadata` return
the static entity metadata declarations extracted from the exact official Java server. Initial
coverage is **26.2** and **1.21.11**. An unsupported version, including `latest`, stays unavailable;
the lookup never substitutes another version.

```sh
minecraft-skills minecraft entity-metadata 26.2 minecraft:armor_stand
minecraft-skills data fetch entity-metadata-surface --version 26.2
```

The lookup is read-only. In an installed package, run the explicit data fetch first if the result
is `unavailable` with `reason: data-not-cached`. Heavy JSON is omitted from npm tarballs. The
existing data cache verifies the manifest size and SHA-256 before using a downloaded surface.

The corresponding MCP request is:

```json
{"version":"26.2","entityId":"minecraft:armor_stand"}
```

Catalog callers use `getEntityMetadata({ version: "26.2", entityId: "minecraft:armor_stand" })`.
Discover IDs with the existing registry search filtered to `minecraft:entity_type`.

An available result includes the entity's official class name, its class hierarchy from child
to parent, and metadata entries ordered by their numeric index. Each entry contains:

| Field | Evidence |
| --- | --- |
| `index` | Value returned by the static `EntityDataAccessor.id()` |
| `declaredIn` | Official class declaring the accessor field |
| `accessor` | Official field name, using verified Mojang mappings where necessary |
| `valueType` | Mechanically extracted type argument `T` from `EntityDataAccessor<T>` |
| `serializer` | Official static serializer field associated with that accessor |
| `serializerId` | Value returned by `EntityDataSerializers.getSerializedId()` |

For example, 26.2 armor stands have 22 inherited declarations. Index 0 is the inherited
`Entity.DATA_SHARED_FLAGS_ID` with `java.lang.Byte` and serializer `BYTE` (ID 0); index 21 is
`ArmorStand.DATA_RIGHT_LEG_POSE` with `net.minecraft.core.Rotations` and serializer `ROTATIONS`
(ID 9). The checked-in exact-version surface and its source hashes provide the evidence.

These declarations do **not** establish entity-instance default values, the meaning of bits,
runtime initialization, behavioral effects, or mod-added metadata. The extractor creates no
entity instance or world. It does not decode serializer wire behavior. Numeric indexes and
serializer IDs must not be reused as cross-version constants.

## Coverage and integrity

The initial extracts contain all 158 official entity types in 26.2 and all 157 in 1.21.11, with
no extraction gaps. `coverage` compares extracted IDs with the independent generated official
entity registry. The result distinguishes `available`, `not-found`, `unavailable`, and
`incomplete` (a known entity whose declaration extraction failed).

If another entity has an extraction gap, a successfully extracted entity can still be available
with `coverage.complete: false`. Successful facts and a failure gap for the same entity are
rejected as contradictory. Available entries contain contiguous unique indexes starting at
zero and nonnegative serializer IDs. Validation also checks inherited declaration consistency,
identical definitions for the same runtime class, and one serializer name per serializer ID.
Persisted entity/field counts and coverage are recomputed before returning any lookup result,
including `not-found`; registry membership is checked against the independent official index.

Inputs are bounded to 4,096 entity types, 255 fields per entity, 65,536 total fields, 64 hierarchy
classes, 2,048 characters per type, and 4,096 extraction gaps. Ingestion accepts at most 16 MiB
of report text. Missing or corrupt evidence is never represented as an empty successful result.

## Reproduce the extraction

Use JDK 25 to run the checked-in, dependency-free launcher source. The helper verifies the
official outer artifact and mappings before using them, verifies each bundled jar's SHA-256,
and loads only those verified jars through an isolated class loader. It uses the official
bootstrap, then reflects static accessor fields through each entity's superclass chain.
Temporary jars are removed after the loader closes. No network or game server is started.

```sh
java packages/maintainer/scripts/ExtractEntityMetadata.java \
  26.2 /path/to/26.2-server.jar - /path/to/26.2-entity-metadata.json
java packages/maintainer/scripts/ExtractEntityMetadata.java \
  1.21.11 /path/to/1.21.11-server.jar /path/to/1.21.11-server-mappings.txt \
  /path/to/1.21.11-entity-metadata.json
pnpm build
node packages/maintainer/dist/cli.mjs ingest-entity-metadata \
  --version 26.2 --input /path/to/26.2-entity-metadata.json --retrieved-at <ISO-timestamp>
node packages/maintainer/dist/cli.mjs ingest-entity-metadata \
  --version 1.21.11 --input /path/to/1.21.11-entity-metadata.json --retrieved-at <ISO-timestamp>
node packages/maintainer/dist/cli.mjs write-data-manifest
```

The Java helper supports these pinned official artifacts only:

| Version | Server artifact SHA-1 | Naming evidence |
| --- | --- | --- |
| 26.2 | [`823e2250d24b3ddac457a60c92a6a941943fcd6a`](https://piston-data.mojang.com/v1/objects/823e2250d24b3ddac457a60c92a6a941943fcd6a/server.jar) | Official unobfuscated classes |
| 1.21.11 | [`64bb6d763bed0a9f1d632ec347938594144943ed`](https://piston-data.mojang.com/v1/objects/64bb6d763bed0a9f1d632ec347938594144943ed/server.jar) | [Official server mappings](https://piston-data.mojang.com/v1/objects/5621e9253f05fd57872bbe7f8ddf5f9a7d525955/server.txt), SHA-1 `5621e9253f05fd57872bbe7f8ddf5f9a7d525955` |

The ingested `source` retains the official URLs and SHA-1 hashes, raw extraction report SHA-256,
retrieval timestamp, and SHA-256 of the checked-in Java helper with LF line endings. Its method
and field mapping tables are separate; method overloads are resolved by parameter types. A
failed class/type/accessor extraction produces an explicit gap instead of partial entity fields.
Artifact/hash/bootstrap failures stop the extraction. Ingestion validates the report before
replacing a previously generated surface.
