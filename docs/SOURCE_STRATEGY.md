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

- `canonical-official`: Mojang version metadata and downloads served through Piston endpoints,
  official jars, generated reports, PaperMC API, Paper Javadocs, Fabric Meta version metadata, and
  FabricMC's official Maven metadata and Fabric API Javadoc search indexes.
  Use this for version-specific facts that generated files or code depend on.
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

## Mojang Piston Endpoints

Piston is Mojang's official delivery infrastructure for Java Edition metadata and downloads. In
practice, minecraft-skills treats `piston-meta.mojang.com` as the source for version manifests and
per-version metadata, and `piston-data.mojang.com` as the source for official client/server jar
downloads referenced by that metadata.

Use Piston-backed Mojang data for release ids, release times, jar URLs, SHA-1 hashes, protocol/world
versions, Java runtime metadata, and pack format extraction inputs. Refer to it in user-facing docs
as "Mojang official version metadata and downloads, served through Piston endpoints" so the
infrastructure name does not look like a third-party source.

## Fabric Meta v2

[Fabric Meta](https://github.com/FabricMC/fabric-meta) is FabricMC's official live JSON API for
game, Loader, Intermediary, and Yarn version metadata, hosted at
`https://meta.fabricmc.net/`. The toolchain lookup uses only the game-version-specific v2 endpoints
and preserves their documented newest-first ordering. An upstream `stable` field may guide
selection, but it must not be restated as proof that a mod, Fabric API release, or full dependency
graph is compatible.

Live responses are treated as untrusted input despite the official source: requests are timed out,
response bytes and entry counts are bounded, required fields and numeric ranges are validated, and
the Loader-provided Intermediary pairing is cross-checked when the Intermediary endpoint returns a
candidate.

## Fabric API Rendering Surface

Fabric API type and member searches read only fixed URLs under FabricMC's official
[`maven.fabricmc.net` repository](https://maven.fabricmc.net/net/fabricmc/fabric-api/fabric-api/).
The aggregate artifact's `maven-metadata.xml` is filtered by the exact `+<gameVersion>` suffix;
the highest numeric `major.minor.patch` core wins. The global Maven `latest` and `release` fields
are reported but never used to select a Minecraft-specific version. No nearest-version fallback
or `latest` game-version alias is inferred.

The exact aggregate POM establishes rendering-related dependency coordinates. The matching
`fatjavadoc.jar` and its official SHA-256 sidecar establish the archive identity; the checksum is
an integrity check from the same HTTPS origin, not an independent signature or trust source.
Bounded requests reject redirects, unexpected content types, invalid UTF-8, excess bytes and
timeouts. XML declarations/entities beyond the basic UTF-8 declaration and executable search-index
JavaScript are rejected; search-index assignments are parsed as JSON, never evaluated. The shared
ZIP reader validates central/local consistency and selected-entry CRCs, with archive, entry-count,
declared expansion, and pre-inflation search-index byte ceilings.

Only `net.fabricmc.fabric.api.client.rendering.v1` and
`net.fabricmc.fabric.api.client.renderer.v1`, including dot-delimited subpackages, are indexed.
Results retain exact artifact URLs, checksum, retrieval time, POM module coordinates, Java owners,
display labels, archive-relative Javadoc paths, and decoded Javadoc URL signatures (`u`) when
present. Nested type dots and overload-specific signatures are preserved. No Javadoc prose or
binary content is returned or written to disk.

This is name and URL-signature evidence from a selected published artifact, not a guarantee of
runtime behavior, full signatures with return types/generics/parameter names, inherited members,
Java visibility, deprecation status, complete dependency compatibility, or rendering correctness.
The aggregate indexes do not associate symbols with Maven modules, so per-symbol module ownership
is not inferred. Mojang client classes and mappings remain outside this surface; names used only
as Fabric API parameter types do not establish the corresponding Mojang class API.

## Fabric Client GameTest Visual Evidence

The [official Fabric automated-testing guide](https://docs.fabricmc.net/develop/automatic-testing)
is the primary documentation evidence that Fabric exposes client game tests, demonstrates a client
screenshot path, documents a client test run task, and describes a virtual-framebuffer production
run for CI. The [official Loom Fabric API DSL guide](https://docs.fabricmc.net/develop/loom/fabric-api)
is primary evidence for the current documented test-configuration surface. Exact entrypoint,
context, wait, screenshot, and Gradle API names remain version-specific and must be checked against
the target Fabric API Javadocs or selected mappings before implementation code names them.

The bundled visual-evidence records are human-reviewed workflow guidance, not facts imported from
those pages. Official documentation does not prove that a project's case matrix is deterministic,
that its readiness barriers reached the intended frame, that crop bounds match runtime layout, that
a selected range covers the suite, or that baseline and artifact reconciliation is sound. Those
claims require a versioned suite definition, full-frame and manifest digests, explicit run mode,
set reconciliation, causal failure phases, and environment-specific results. A virtual framebuffer
can exercise a client render path in its recorded environment, but does not establish physical
display, GPU and driver, native input, accessibility, shader, or complete modpack behavior.

## Fabric Client GUI Guidance

The [official Fabric custom-screen guide](https://docs.fabricmc.net/develop/rendering/gui/custom-screens)
and [GUI drawing guide](https://docs.fabricmc.net/develop/rendering/gui-graphics) are the primary
documentation evidence for current screen initialization, drawing, and clipping concepts. Exact
Minecraft client names remain version- and mapping-specific, so implementations must also verify
the selected target-version mappings before naming Screen, window, input, drawing, or scissor APIs.

The bundled scale and clipping records are human-reviewed design guidance. Official documentation
can establish the current API surface and clipping facilities, but it does not prove that a
project's layout rectangles, pre-clip content bounds, hit regions, translations, state variants, or
screenshots are correct. Those claims require deterministic project geometry assertions paired
with actual client rendering over the documented case matrix.

## Stable Format Specifications

Container validators may use the format publisher's stable specification for format-level facts.
The resource-pack PNG validator uses the [W3C PNG specification](https://www.w3.org/TR/png-3/) for
signature, chunk, IHDR, ordering, and CRC rules. That evidence establishes only the documented PNG
structural surface; it does not establish target-version Minecraft behavior, rendered appearance,
or animation semantics.

The Java player-skin layout validator is pinned to the current official Minecraft 26.2 metadata at
`https://piston-meta.mojang.com/v1/packages/c75d82e7fa6eca5a043dab0c6cf77cb8317644f4/26.2.json`
and its client artifact SHA-1 `2dc72797acbc1b63fc16a11c4ac393605f453754`. Audited client
classes are `SkinTextureDownloader`, `PlayerFaceExtractor`, `SkinManager`,
`SkinManager$TextureCache`, and `PlayerModelType`. That evidence establishes accepted 64x64 and
legacy 64x32 source dimensions, the client's legacy-to-64x64 processing path, canonical base-face
and hat source rectangles, and slim/wide metadata behavior. It does not establish decoded pixel or
alpha results, skin ownership or signatures, network retrieval, or later GUI scaling, filtering,
blending, clipping, or scissor state.

The Java player-texture downloader additionally audits Authlib 9.0.75 artifact SHA-1
`d61056a234d5e4b272e09d59b0713f80d6c0b6af`, including `TextureUrlChecker` and
`MinecraftTexturesPayload`. It narrows the observed canonical texture service to one internally
constructed HTTPS host/path and treats all live responses as untrusted. The pinned classes do not
establish that the path reference equals a downloaded SHA-256, nor do they prove profile
signatures, provenance, account identity or ownership, freshness, licensing, pixel appearance, or
cape/elytra layout.

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
