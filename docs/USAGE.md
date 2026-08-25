# Usage

This page is the practical reference for the public CLI, MCP server, package APIs, and bundled
Agent Skill folders.

## What You Can Build With It

Use minecraft-skills when an AI agent needs exact, version-aware Minecraft facts before generating
or reviewing authoring output:

- Data packs: command tree paths, observed datapack JSON shapes, pack formats, and vanilla datapack
  file paths.
- Resource packs: pack formats, vanilla asset/model paths, and observed model/item definition
  shapes.
- Paper plugins: supported Paper versions, Paper API package/type/member indexes, Javadocs-derived
  surfaces, and event discovery from the `sya-ri/spigot-event-list` API contract.

The public entrypoints are designed around two workflows:

- Start broad with `datapack context <version>`, `resourcepack context <version>`, or
  `plugin paper context <version>` to get domain guidance, available surfaces, evidence,
  diagnostics, and response rules.
- Search from task wording with `datapack search-scenarios <query>`,
  `resourcepack search-scenarios <query>`, or `plugin paper search-scenarios <query>` when an agent
  needs a data-backed route into the right scenario.
- Search lightweight catalog entries with `datapack search <query>`, `resourcepack search <query>`,
  `plugin paper search <query>`, or `minecraft search <query>` before using broad `list_*`
  commands. Add `--kind` to narrow to recipes, intents, guardrails, diagnostics, claim policies,
  fact surfaces, source tiers, community datasets, or version support entries.
- Start from a known task shape with `datapack plan`, `resourcepack plan`, or `plugin paper plan` to
  resolve a scenario into the exact recipes, intent lookups, diagnostics, claim policies, fact
  surfaces, and response patterns an agent should use.

Before intent-based discovery searches, translate non-English user wording into concise English
canonical Minecraft terms. For example, route a localized request for a player join listener with
`player join event listener`. Keep exact identifiers, namespace IDs, file paths, project titles,
and content literals unchanged. Use the English terms only for the lookup and keep the user's
requested response language. This is a caller-side normalization rule: CLI and MCP entrypoints do
not expand language-specific aliases or reject Unicode query values.

## CLI

Install/run after publishing:

```sh
npx minecraft-skills minecraft latest
```

Common entrypoints:

```sh
minecraft-skills minecraft latest
minecraft-skills skill list
minecraft-skills skill show minecraft-paper-plugins
minecraft-skills skill write minecraft-paper-plugins --output ./skills

minecraft-skills plugin paper context 26.2
minecraft-skills plugin paper recipes
minecraft-skills plugin paper recipe paper-event-listener
minecraft-skills plugin paper search "event listener" --kind authoring-recipe
minecraft-skills plugin paper search-scenarios "Paper event listener"
minecraft-skills plugin paper search-scenarios "full inventory reward leftovers"
minecraft-skills plugin paper scenarios
minecraft-skills plugin paper scenario paper-event-listener-review
minecraft-skills plugin paper plan paper-event-listener-review 26.2
minecraft-skills plugin paper plan paper-item-delivery-review 1.21.11
minecraft-skills plugin paper search-scenarios "inventory GUI shift-click drag"
minecraft-skills plugin paper recipe paper-inventory-gui-interactions
minecraft-skills plugin paper plan paper-inventory-gui-interaction-review 26.2
minecraft-skills plugin paper plan paper-administrative-command-operability-review 26.2
minecraft-skills plugin paper plan paper-player-identity-and-display-review 1.21.11
minecraft-skills plugin paper recipe paper-itemstack-semantic-identity
minecraft-skills plugin paper plan paper-itemstack-semantic-identity-review 26.2
minecraft-skills plugin paper search "custom payload RPC codec" --kind authoring-recipe
minecraft-skills plugin paper search-scenarios "chunked upload request correlation"
minecraft-skills plugin paper plan paper-plugin-protocol-safety-review 1.21.11
minecraft-skills plugin paper recipe paper-scheduled-task-lifecycle
minecraft-skills plugin paper plan paper-scheduled-task-lifecycle-review 1.21.11
minecraft-skills plugin paper guardrail paper-scheduled-task-lifecycle-safety
minecraft-skills plugin paper diagnostic paper-scheduled-task-lifecycle-unsafe
minecraft-skills plugin paper recipe paper-player-session-lifecycle
minecraft-skills plugin paper plan paper-player-session-lifecycle-review 1.21.11
minecraft-skills plugin paper guardrail paper-player-session-lifecycle-safety
minecraft-skills plugin paper guardrail paper-event-listener-semantics-safety
minecraft-skills plugin paper diagnostic paper-player-session-lifecycle-unsafe
minecraft-skills plugin paper search-scenarios "transactional config hot reload last known good"
minecraft-skills plugin paper plan paper-plugin-configuration-lifecycle-review 1.21.11
minecraft-skills plugin paper guardrail paper-plugin-configuration-lifecycle-safety
minecraft-skills plugin paper diagnostic paper-plugin-configuration-lifecycle-unsafe
minecraft-skills plugin paper recipe paper-bossbar-audience-lifecycle
minecraft-skills plugin paper plan paper-bossbar-audience-lifecycle-review 26.2
minecraft-skills plugin paper guardrail paper-bossbar-audience-lifecycle-safety
minecraft-skills plugin paper diagnostic paper-bossbar-audience-lifecycle-unsafe
minecraft-skills plugin paper recipe paper-persistent-data-contract
minecraft-skills plugin paper plan paper-persistent-data-contract-review 1.21.11
minecraft-skills plugin paper diagnostic paper-event-listener-semantics-unsafe
minecraft-skills plugin paper recipe paper-custom-recipe-registration
minecraft-skills plugin paper plan paper-custom-recipe-review 1.21.11
minecraft-skills plugin paper guardrail paper-custom-recipe-ownership
minecraft-skills plugin paper diagnostic paper-custom-recipe-registration-unsafe
minecraft-skills plugin paper recipe paper-display-interaction-contract
minecraft-skills plugin paper plan paper-display-interaction-contract-review 1.21.11
minecraft-skills plugin paper search-scenarios "bounded per-key delta coalescing contention"
minecraft-skills plugin paper plan paper-high-frequency-persistence-review 1.21.11
minecraft-skills plugin paper guardrail paper-high-frequency-persistence-safety
minecraft-skills plugin paper diagnostic paper-high-frequency-persistence-unsafe
minecraft-skills plugin paper search-scenarios "opaque cursor stale response duplicate page"
minecraft-skills plugin paper plan paper-server-backed-paged-ui-review 1.21.11
minecraft-skills plugin paper guardrail paper-server-backed-paged-ui-safety
minecraft-skills plugin paper diagnostic paper-server-backed-paged-ui-unsafe
minecraft-skills plugin paper search-scenarios "PlayerDeathEvent respawn keepInventory itemsToKeep"
minecraft-skills plugin paper plan paper-death-respawn-handoff-review 1.21.11
minecraft-skills plugin paper guardrail paper-death-respawn-handoff-safety
minecraft-skills plugin paper diagnostic paper-death-respawn-handoff-unsafe
minecraft-skills plugin paper search-scenarios "sidebar prior foreign scoreboard late hide"
minecraft-skills plugin paper plan paper-scoreboard-ownership-lifecycle-review 1.21.11
minecraft-skills plugin paper guardrail paper-scoreboard-ownership-lifecycle-safety
minecraft-skills plugin paper diagnostic paper-scoreboard-ownership-lifecycle-unsafe
minecraft-skills plugin paper search-scenarios "MockBukkit loaded server test evidence"
minecraft-skills plugin paper plan paper-plugin-testing-evidence-review 1.21.11
minecraft-skills plugin paper search-scenarios "bounded block edits across chunk boundaries"
minecraft-skills plugin paper recipe paper-world-operation-safety
minecraft-skills plugin paper plan paper-world-operation-safety-review 26.2
minecraft-skills plugin paper recipe paper-attribute-effect-ownership
minecraft-skills plugin paper plan paper-attribute-effect-ownership-review 1.21.11
minecraft-skills plugin paper guardrail paper-attribute-effect-ownership-safety
minecraft-skills plugin paper diagnostic paper-attribute-effect-ownership-unsafe
minecraft-skills plugin paper search-scenarios "ModelEngine carrier attach animation reload"
minecraft-skills plugin paper plan paper-modelengine-runtime-binding-review 1.21.11
minecraft-skills plugin paper guardrail paper-modelengine-runtime-binding-safety
minecraft-skills plugin paper diagnostic paper-modelengine-runtime-binding-unsafe
minecraft-skills plugin paper recipe paper-region-protection-policy
minecraft-skills plugin paper plan paper-region-protection-policy-review 1.21.11
minecraft-skills plugin paper guardrail paper-region-protection-policy-safety
minecraft-skills plugin paper diagnostic paper-region-protection-policy-incomplete
minecraft-skills plugin paper preflight 26.2
minecraft-skills plugin paper evidence 26.2
minecraft-skills source report paper-plugin 26.2
minecraft-skills source datasets
minecraft-skills minecraft search "prismarine assets" --kind community-dataset
minecraft-skills minecraft search-all "bundle item model" --domain resourcepack
minecraft-skills minecraft analyze-log ./logs/latest.log --max-mixin-failures 50
minecraft-skills fabric toolchain 1.21.11
minecraft-skills fabric validate-mod ./example-mod.jar
minecraft-skills fabric validate-mod ./example-mod.jar --max-archive-bytes 104857600
minecraft-skills fabric mods inventory ./server/mods
minecraft-skills fabric mods diff ./server/mods ./client/mods
minecraft-skills velocity toolchain
minecraft-skills minecraft validate-mixin-config ./example.mixins.json
minecraft-skills minecraft validate-mixin-config ./example.mixins.json --archive-entries ./archive-entries.json --archive-entries-complete true
minecraft-skills modrinth search "voice chat" --version 1.21.11 --type mod --loader fabric
minecraft-skills modrinth versions simple-voice-chat --game-version 1.21.11 --loader fabric
minecraft-skills modrinth compatibility sodium iris --game-version 1.21.11 --loader fabric
minecraft-skills modrinth get project simple-voice-chat
minecraft-skills modrinth validate-pack ./example.mrpack
minecraft-skills modrinth validate-pack ./example.mrpack --allow-download-host downloads.example.org
minecraft-skills modrinth validate-pack ./example.mrpack --max-archive-bytes 104857600
minecraft-skills server validate-properties ./server.properties --version 1.21.11
minecraft-skills plugin paper validate-jar ./build/libs/example.jar
minecraft-skills plugin velocity validate-jar ./build/libs/example.jar
minecraft-skills player-profile lookup-name jeb_
minecraft-skills player-profile textures 853c80ef-3c37-49fd-aa49-938b674adae6
minecraft-skills blockbench inspect-project ./model.bbmodel --require-animation idle --require-group seat
minecraft-skills minecraft suggest-lookups "migrate resource pack item model" --domain resourcepack
minecraft-skills minecraft explain-path 26.2 assets/example/items/widget.json --domain resourcepack
minecraft-skills minecraft analyze-performance ./performance-samples.json
minecraft-skills plugin paper intents
minecraft-skills plugin paper fact-surfaces
minecraft-skills plugin paper claim-policies
minecraft-skills plugin paper diagnostics
minecraft-skills plugin paper output-requirements
minecraft-skills plugin paper response-patterns

minecraft-skills minecraft support --domain paper-plugin

minecraft-skills rcon init --config ./.minecraft-skills/rcon.json --preset readonly
minecraft-skills rcon status --config ./.minecraft-skills/rcon.json
minecraft-skills rcon run list --config ./.minecraft-skills/rcon.json
```

The `paper-event-listener-review` scenario verifies more than event and member names. Its recipe,
checklist, guardrail, and diagnostic require an explicit handler role, priority,
`ignoreCancelled` decision, MONITOR read-only behavior, documented synchronous or asynchronous
execution context, and registration owner. Dynamic listeners must retain their exact instance for
scoped teardown, while in-flight callbacks still gate side effects because unregistration cannot
change the handler snapshot of a dispatch that has already started.

`minecraft analyze-log <file>` structures a Minecraft Java log, stack trace, or crash report into
bounded events, exception chains, explicit Mixin failure facts, explicit class-loading failure
evidence, crash metadata, explicit platform versions, JAR artifacts, and explicitly named
mods/plugins. It accepts a regular file or symlink
target, uses one file handle, checks size and timestamps before and after the bounded read, and
rejects malformed UTF-8. Analysis limits, including `--max-mixin-failures`, can be lowered with the
documented `--max-*` flags but cannot exceed Catalog defaults. Class-loading failure retention can
be bounded independently with `--max-class-loading-failures`.
Credentials, IP addresses, absolute paths, ANSI/OSC controls, unsafe C0/C1 controls, bidi
overrides, and malformed Unicode are sanitized before parsing or retention. `deepestCause` follows
only the explicit primary `Caused by` chain; suppressed branches and extracted component labels do
not establish blame. `mixinFailures` recognizes only explicit Mixin exception wording for missing
shadow targets, missing injection targets, failed injection checks, direct class loads from a
defined mixin package, and non-private static members. It does not infer responsibility or validate
mappings, refmaps, Mixin configuration, target bytecode, a proposed fix, or runtime compatibility.
`noRefmapReported` is true only for the explicit no-refmap statement in the same exception message;
false is not evidence that a refmap was loaded or correct. Total, retained, and omitted Mixin
failure counts expose `--max-mixin-failures` truncation.
`classLoadingFailures` records only explicit `NoClassDefFoundError` and
`ClassNotFoundException` symbols. Slash and dot forms are normalized, matching evidence within one
exception chain is collapsed, and `initialization-failed` requires the exact
`Could not initialize class` wording. These facts do not prove a dependency, classpath, JAR content,
shading decision, owner, fix, or root cause.

The `paper-inventory-gui-interaction-review` scenario routes custom inventory menus through a
default-deny click-and-drag policy. Its recipe and guardrail explicitly cover top, bottom, and
outside slots; shift transfer; number-key, hotbar, and offhand swaps; double-click collection;
complete drag raw-slot sets; allowed-slot matrices; and guarded close or reopen scheduling from
click, drag, and close handlers. Editable sessions must choose per-session or deliberately shared
ownership, settle their stacks exactly once across close, replacement, disconnect, death, and
shutdown, and define an explicit overflow outcome. The diagnostic also rejects deprecated
`InventoryClickEvent.setCursor` mutation and direct conditional reopen from `InventoryCloseEvent`.

The `paper-plugin-testing-evidence-review` scenario maps every runtime claim to the minimum boundary
that can observe it. Pure unit tests cover deterministic rules, test doubles cover plugin-owned
contracts, MockBukkit covers only explicitly supported harness behavior, and plugin bootstrap,
registration, scheduler integration, reload, and disable changes require a loaded target-version
Paper server. Packet transport and shape need a protocol oracle; rendering, audio, input, resource-
pack application, and other client-visible outcomes need a real instrumented client or captured
client state. The recipe also requires controlled time and task ordering, lifecycle and stale
completion cases, isolated cleanup, and a final report of exact commands, versions, baselines,
skips, unavailable environments, and manual checks.

The `paper-plugin-configuration-lifecycle-review` scenario treats operator files as desired input,
one immutable snapshot and resource bundle as effective state, and every reload as a revisioned
prepare/commit/retire transition. It requires validated startup readiness, last-known-good
preservation, explicit restart-required or degraded outcomes, generation-fenced consumers,
conflict-safe writes, redacted status, and idempotent disable cleanup. The workflow distinguishes a
plugin-owned configuration reload from deprecated server-wide reload and Paper server-
configuration reload commands, and requires both deterministic race tests and loaded-server
lifecycle evidence.

The `paper-custom-recipe-review` scenario requires stable plugin-owned `NamespacedKey`s and a staged
desired set before reconciling only owned keys. It records each `addRecipe` and `removeRecipe`
result, surfaces partial recovery toward the last-known-good set, distinguishes material matching
from `RecipeChoice.ExactChoice` full-stack matching aside from amount, detects equal-input shaped
or shapeless signatures before mutation, and keeps online-client recipe-list resend separate from
recipe-book discover/undiscover state.

The `paper-modelengine-runtime-binding-review` scenario covers the runtime contract between an
already selected Paper carrier and an existing Model Engine blueprint. It requires exact Paper,
Model Engine plugin, and integration-artifact evidence; exact-case blueprint and animation
identifiers; carrier configuration before attachment; positive attachment verification before
publication; owned-carrier removal versus borrowed-carrier restoration; and one declared owner for
each idle, locomotion, and action channel. Reload or
reimport uses a target-supported coexistence or fail-closed cutover transaction with one publication
point, then fences callbacks and retires the old generation. Teleport, despawn, and disable have
explicit revalidation and idempotent cleanup. Deterministic fakes prove only the plugin-owned adapter
contract. Missing-plugin, safely constructible incompatible-version, and attachment-rejection
outcomes need loaded fixtures. External API compatibility, successful attachment, animation
behavior, and cleanup need the exact supported loaded artifacts, while rendered-model and carrier-
suppression claims also need a paired target client or captured client state. Resolve all external
names against the selected installed generation and its
[official Model Engine documentation](https://git.mythiccraft.io/mythiccraft/model-engine-4/-/wikis/home);
use the [Paper plugin lifecycle](https://docs.papermc.io/paper/dev/how-do-plugins-work/) and
[entity teleport](https://docs.papermc.io/paper/dev/entity-teleport/) documentation for the target
Paper behavior. Combat, damage, hitboxes, loot, spawn policy, individual assets, interaction
geometry, and generic scheduler, event, or persistent-data design remain separate concerns.

The `paper-region-protection-policy-review` scenario normalizes direct and indirect Paper event
paths into one actor, source, action, target, cause, boundary, and outcome decision. The policy must
define its default and bypass, public, vanilla, and plugin exceptions, decide every source,
destination, or multi-target effect, and preserve intended mechanics instead of blanket-cancelling
environmental events. Table-driven allow and deny cases plus positive preserved-mechanics evidence
cover the policy; listener execution and direct plugin world-operation lifecycles stay separate.

For a release-oriented table of every checked-in Java version, pack format, domain coverage, Paper
support, and heavy-data availability, see [VERSION_SUPPORT.md](VERSION_SUPPORT.md).

```sh
minecraft-skills data manifest
minecraft-skills data fetch paper-api-surface --version 26.2
```

RCON configuration, permission presets, and MCP tool behavior are documented in
[RCON.md](RCON.md).

Data pack lookups:

```sh
minecraft-skills minecraft show 26.2
minecraft-skills minecraft pack-formats
minecraft-skills minecraft pack-format 26.2 datapack
minecraft-skills minecraft versions-for-pack-format datapack 107 --minor 1
minecraft-skills datapack find execute
minecraft-skills datapack commands 26.2 --prefix execute --contains run
minecraft-skills datapack compare-commands 1.20.6 1.21 --prefix attribute
minecraft-skills minecraft registry-entries 26.2 --registry minecraft:item --exact minecraft:stone
minecraft-skills minecraft compare-registry-entries 26.1.2 26.2 --registry minecraft:attribute --prefix minecraft:armor
minecraft-skills datapack schema 26.2
minecraft-skills datapack search-schema 26.2 --kind advancement --contains criteria
minecraft-skills datapack compare-schema 26.2 26.2 --kind advancement
minecraft-skills datapack classify-files data/example/advancement/root.json data/example/functions/tick.mcfunction
minecraft-skills datapack file-schema 26.2 data/example/advancement/root.json
minecraft-skills datapack migration-plan 1.20.6 1.21 data/example/advancement/root.json
minecraft-skills datapack vanilla-paths 26.2 --contains recipe
minecraft-skills datapack vanilla-json status 26.2
minecraft-skills datapack vanilla-json fetch 26.2
minecraft-skills datapack vanilla-json files 26.2 --kind recipe --contains diamond
minecraft-skills datapack vanilla-json get 26.2 data/minecraft/recipe/diamond_block.json
minecraft-skills datapack vanilla-json search minecraft:diamond --version 26.2 --kind recipe --scope values
minecraft-skills datapack vanilla-json clean 26.2
minecraft-skills datapack validate-project 26.2 ./my-data-pack
```

`datapack validate-project` scans a stable regular-file directory, rejects observed links and
special entries, identity-binds opened text files, and aborts detected ancestor/entry changes. Since
Node does not expose openat-style relative directory traversal, quiesce trees that a malicious local
writer could mutate concurrently. The validator checks portable paths and collisions, root
`pack.mcmeta`, version-correct directories and file content, command-position function calls,
function and registry tags, advancement parents, and local tag/advancement cycles. Submitted
references are compared with local files, versioned vanilla datapack paths, and official registry
entry indexes where coverage exists. Submitted namespaces are closed by default; pass
`--allow-merged-namespace-dependencies` when another pack or mod can contribute to the same
namespace. Optional missing tag entries remain valid. External dependencies, JSON without
version-compatible schema coverage, dynamic macros, pack overlays, unindexed registries, and
unsupported graph kinds are reported through completeness metadata. Files, depth, paths, UTF-8 text,
parsed nodes, function lines, graph work, and retained diagnostics all have fixed ceilings.

Registry comparisons emit entry and protocol ID changes only for registries indexed in both
versions. Check `outcome` and the bounded `excludedRegistries` statuses before treating a partial
comparison as complete. Protocol changes require numeric IDs in both versions; null-to-number and
number-to-null observations are not classified as changes.

Resource pack lookups:

```sh
minecraft-skills minecraft pack-format 26.2 resourcepack
minecraft-skills minecraft versions-for-pack-format resourcepack 88
minecraft-skills resourcepack vanilla-paths 26.2 --contains models/block/acacia_button
minecraft-skills resourcepack compare-vanilla-paths 1.20.6 1.21 --prefix assets/minecraft/models/item/
minecraft-skills resourcepack assets status 26.2
minecraft-skills resourcepack assets fetch 26.2 --index-only
minecraft-skills resourcepack assets find "diamond sword" --kind item-definition
minecraft-skills resourcepack assets search 26.2 --contains diamond_sword --extension json --fetch
minecraft-skills resourcepack assets get 26.2 assets/minecraft/models/item/diamond_sword.json
minecraft-skills resourcepack models 26.2
minecraft-skills resourcepack search-models 26.2 --kind item-definition --contains bundle
minecraft-skills resourcepack classify-files assets/example/items/widget.json assets/example/textures/item/widget.png
minecraft-skills resourcepack file-schema 26.2 assets/example/items/widget.json
minecraft-skills resourcepack inspect-png-alpha ./assets/example/textures/item/widget.png --require-nonempty --minimum-transparent-margin-pixels 1
minecraft-skills resourcepack validate-png ./pack.png
minecraft-skills resourcepack validate-project 26.2 ./my-resource-pack
minecraft-skills player-skin validate-layout ./skin.png --base-rect 8,8,8,8 --hat-rect 40,8,8,8
minecraft-skills player-texture download 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef --kind skin --output ./skin.png
minecraft-skills resourcepack validate-translations 26.2 ./my-resource-pack/assets/example/lang/en_us.json ./my-resource-pack/assets/example/lang/ja_jp.json --pack-root ./my-resource-pack --required-locale ja_jp
minecraft-skills resourcepack sound inspect ./source.wav
minecraft-skills resourcepack migration-plan 1.20.6 1.21 assets/example/items/widget.json
minecraft-skills minecraft validate-access-list ./whitelist.json
minecraft-skills minecraft validate-access-list ./custom.json --kind banned-ips
```

`file-schema` returns the best available schema for known pack file kinds. For model/item JSON and
datapack JSON kinds with extracted vanilla examples, the result includes observed fields. For
`pack.mcmeta`, tags, functions, structures, blockstates, sounds, atlases, fonts, language files,
textures, particles, shaders, post effects, equipment, and sound assets, it returns a non-normative
format schema so agents can still reason about the file safely. Binary/text assets identify their
container format and link back to the relevant command or in-game validation checks instead of
pretending to validate payload internals.

`validate-files` is conservative: invalid JSON, pack format mismatches, and known layouts used
before their target-version support are reported as invalid. Missing minecraft-skills schemas or
custom resource pack folders are reported as unvalidated gaps rather than proof that the file is
invalid.

`resourcepack validate-png` safely reads one regular local file up to the configured byte cap and
checks its PNG signature, chunk framing, IHDR fields, method values, ordering, and scanned CRCs.
Symlinks and special files are rejected.

`resourcepack inspect-png-alpha` uses the same stable regular-file reader and CRC-verified structure
walk before decoding. Content is exactly a static-image pixel whose decoded alpha sample is not
zero. The result reports alpha counts, zero-based half-open content bounds, transparent margins on
all four sides, exact expected/actual filtered bytes, and compressed-byte consumption evidence. It
does not crop, rewrite, render, or return local paths, pixels, or RGB samples. The default limits can
only be lowered, including `--max-inflated-bytes`. If the checked expected filtered byte count is
above that ceiling, the PNG can remain structurally valid while pixel inspection is indeterminate.

`--require-nonempty` and `--minimum-transparent-margin-pixels <n>` are optional caller policies.
Without a policy, a completely transparent image is a valid completed fact with null bounds and
margins. Exit code 0 requires complete pixel inspection and policy status `met` or `not-requested`.
Invalid or indeterminate pixels and `not-met` or `not-checked` policy return exit code 1.

`resourcepack validate-project` scans a complete directory and verifies item-definition model and
special base references, legacy `overrides[].model` targets, model parents, texture paths, inherited
texture variables, local model-parent cycles, `sounds.json` file/event targets, and local sound-event
cycles. Model and texture references are checked against both project files and the target version's
vanilla asset path index. PNG files receive the same bounded structural validation, while each OGG
file is read only through its strict 58-byte Ogg/Vorbis identification page. WAV, Opus, truncated or
corrupt headers, and invalid Vorbis identification fields are errors. Stereo produces a
positional-attenuation warning; more than two channels is an error because Minecraft's OpenAL upload
path supports mono and stereo. Unavailable headers and external sound file/event references are
warnings that also make validation completeness false. The command does not decode complete audio,
duration, loudness, or later Vorbis packets. Variables that can only be resolved inside an unbundled
vanilla parent are reported individually as warnings.

Project requests, sound graphs, binary input, and retained diagnostics use published hard ceilings;
results echo applied/exceeded limits, processed-file and completeness metadata, and exact
omitted-diagnostic counts. The CLI applies matching file, directory-depth, path, aggregate JSON-byte,
and aggregate binary-byte bounds while scanning, before it allocates the catalog request.

The structural validator and alpha inspector follow the
[W3C PNG Third Edition](https://www.w3.org/TR/png-3/). Structural validation alone does not
decompress IDAT. Alpha inspection concatenates IDAT payloads as one zlib input and uses Node's
documented [`info` result and `bytesWritten` evidence](https://nodejs.org/api/zlib.html) together
with an exact expected filtered byte count. The package supports its declared minimum Node 22.12;
the trailing-input behavior and consumed-byte accounting are covered on Node 22 as well as the
development runtime. It does not depend on the newer `rejectGarbageAfterEnd` option, which is not
available at the minimum runtime.

PNG recommends that decoders ignore unused bytes after a complete zlib stream. When Node reports a
trustworthy consumed count, the inspector reports both consumed and trailing compressed bytes and
warns about any ignored suffix; it does not claim that suffix belonged to or was semantically
validated as part of the zlib stream. If consumed-byte evidence is unavailable, inspection stays
indeterminate. Neither validator interprets APNG frames or animation `.mcmeta`, proves Minecraft
rendering, or requires square, power-of-two, or fixed-size `pack.png` dimensions. Incomplete reads
and safety-limit stops are explicit in the result. Project errors return exit code 1; variables that
can only be resolved inside an unbundled vanilla parent remain warnings.

`player-skin validate-layout` composes bounded complete-PNG structure validation with Java
player-skin dimensions and face UVs. It accepts current 64x64 and legacy 64x32 sources. Optional
`--base-rect` and `--hat-rect` values use `x,y,width,height`; canonical values are `8,8,8,8` and
`40,8,8,8`. These are zero-based half-open source rectangles, so a width or height of 7 detects a
one-pixel right or bottom omission. Any PNG error keeps layout not checked and returns exit code 1.
Pixels, alpha, legacy conversion output, GUI scaling, texture filtering, blending, clipping, and
scissor state are not checked.

`player-texture download` accepts only a strict lowercase 64-hex reference, a
`skin|cape|elytra` kind, and a new exact-`.png` output path. It never accepts a caller URL, player
name, port, query, request body, or headers. The fixed texture host request has a five-second
fetch/body timeout, manual redirect rejection, status/content-type/identity-encoding checks, a
one-MiB byte cap, and a 4,096 response-chunk cap. Output creation is exclusive and verifies regular
file and parent identities before and after writing; existing, linked/reparse, special, raced, or
partially written targets never count as success. Exit code 0 means download validation and save
both succeeded. JSON omits the path and byte array. The requested reference and downloaded SHA-256
are separate evidence, not authenticity, profile signature, provenance, identity, ownership,
freshness, or licensing claims.

`minecraft validate-access-list` validates the four canonical vanilla server files:
`whitelist.json`, `ops.json`, `banned-players.json`, and `banned-ips.json`. Canonical filenames infer
the kind; renamed files require `--kind`. The validator is offline and does not resolve accounts or
verify UUID/name and IP ownership. Duplicate identities, canonical field types, operator levels,
ban serializer dates, permanent versus dated bans, and already-expired dated bans are reported
without copying player names, UUIDs, IPs, reasons, or sources into output. CLI reads require a
stable regular-file target, strict UTF-8, and the same fixed request ceilings used by Catalog and
MCP. Pass a 24-character canonical UTC `--evaluated-at` value to reproduce expiry classification;
the effective instant is always returned.
Field names, operator levels, and ban date syntax are grounded in the official Java 26.2 server
serializers; unknown fork fields are warnings, and future serializer changes are not inferred.
This is canonical-output validation, not a loader-acceptance oracle: current loaders default some
missing or malformed ban data and operator fields and clamp operator levels, so `valid: false` does
not prove that the server will reject the file.

Blockbench project inspection:

```sh
minecraft-skills blockbench inspect-project ./model.bbmodel \
  --require-animation idle \
  --require-animation walk \
  --require-group body \
  --require-group seat
```

The command accepts one stable regular UTF-8 `.bbmodel` file, refuses links, and bounds path,
file, JSON, traversal, name, request, and diagnostic work. Names are exact and case-sensitive. Exit
code 0 means the audited layout was completely inspected and every requested name was present;
missing or unknown requirements and invalid/unsafe inputs return 1. Newer versions, `<lz>`
compression, custom/plugin model formats, unsupported shapes, and exceeded limits are
indeterminate rather than invalid. Output omits file paths, texture sources, embedded data, and
editor state.

This is deliberately a metadata/name inspector, not a complete `.bbmodel` validator. It does not
check animation runtime/keyframes, textures, rendering, export, plugin semantics, or ModelEngine
blueprint compatibility. A group named `seat` proves only that exact group name and no mounting or
seating behavior. The boundary follows the official
[Blockbench `.bbmodel` documentation](https://www.blockbench.net/wiki/docs/bbmodel/) and a pinned
[Blockbench 5.1.6 format implementation](https://github.com/JannisX11/blockbench/blob/47e633e4a1338f957ee7baa0acbcf54da11e77df/js/formats/bbmodel.js).

`resourcepack validate-translations` reads explicit stable UTF-8 files under `--pack-root` and
preserves raw JSON duplicate-key evidence. Catalog analysis merges exact keys globally per locale,
then compares only `--required-locale` selections against `--reference-locale` (default `en_us`).
Missing/extra keys, placeholder reference mismatches, and unknown cross-file override order are
warnings, not loader-invalid claims. Output never includes translation values or local paths.

`resourcepack sound inspect` accepts exactly one lower-case `.wav` final regular file entry. It
rejects final symbolic-link or junction entries and special files, verifies file identity and size
around a bounded positional read, and emits no path or source bytes in JSON. The result reports
RIFF/WAVE PCM or IEEE-float structure,
duration, SHA-256, sample peak/RMS dBFS, and factual at-or-beyond-full-scale sample count. It does
not convert, normalize, measure LUFS/SPL/perceived loudness, or repeat Ogg/Vorbis validation. Invalid
or incomplete results return exit code 1.

Paper plugin lookups:

```sh
minecraft-skills plugin paper info
minecraft-skills plugin paper api 26.2
minecraft-skills plugin paper api-index 26.2
minecraft-skills plugin paper api-surface 26.2
minecraft-skills plugin paper types 26.2 --contains org.bukkit.entity.Player
minecraft-skills plugin paper members 26.2 --type org.bukkit.entity.Player --contains sendMessage
minecraft-skills plugin paper compare-api 1.20.4 26.2
minecraft-skills plugin paper compare-api-surface 26.2 26.2
minecraft-skills plugin paper events "player join" --version 26.2
minecraft-skills plugin paper validate-jar ./build/libs/example.jar
```

`plugin paper validate-jar <file.jar>` is an offline artifact preflight for root `plugin.yml` and
`paper-plugin.yml`. It performs a no-follow/nonblocking open where supported and identity-checks the
regular file path and handle around the bounded read, then validates ZIP structure. As Paper does,
it selects `paper-plugin.yml` first and treats a coexisting `plugin.yml` as shadowed. It validates
the active descriptor's CRC/UTF-8/YAML and checks declared class names against exact JAR entries
without expanding bytecode. Missing archive-local classes remain warnings because libraries or
dependencies may provide them. `paper-plugin.yml` remains experimental, and unknown keys, runtime
parser parity, class resolution/interfaces, and actual server load are reported as incomplete
rather than guessed. Syntactically valid `api-version` values that are not current known Paper
releases also remain unknown. For MCP clients,
`validate_paper_plugin_jar` accepts descriptor text plus `archiveEntries`; set
`archiveEntriesComplete` true only for a complete central-directory listing because descriptor
absence claims depend on a complete, fully normalized list. MCP cannot claim binary integrity.

Velocity plugin artifacts:

```sh
minecraft-skills plugin velocity validate-jar ./build/libs/example.jar
minecraft-skills plugin velocity validate-jar ./build/libs/example.jar --target-java 26
```

`plugin velocity validate-jar` is a bounded, offline artifact preflight for root
`velocity-plugin.json`. It validates ZIP central/local structure, descriptor and entrypoint CRC,
fatal UTF-8 JSON, current Velocity descriptor fields and plugin IDs, the exact declared entrypoint
class path, bounded classfile identity, selected Java target, and runtime-visible `@Plugin`
annotation evidence for that entrypoint. Other classfiles are not scanned for their Java target.
The default target is Java 25, the current Velocity 4 minimum; `--target-java` may select a newer
runtime but cannot go below 25. This surface intentionally does not model older Velocity lines.
Missing or different annotation metadata is reported as evidence, not as proof that the loader will
reject the plugin.

The validator does not resolve dependency predicates or satisfaction, verify complete class
bytecode or JVM linkage, reproduce every Gson runtime coercion, check classpath/shaded dependencies
or Velocity API compatibility, prove constructor/Guice injection, start Velocity, or establish
runtime behavior or security.
`validate_velocity_plugin_jar` accepts descriptor JSON plus bounded `archiveEntries` metadata only.
It cannot prove ZIP headers, CRC, entrypoint classfile/Java target, or annotation contents; set
`archiveEntriesComplete` true only for a complete, fully normalized central-directory listing.
Descriptor text is scanned for duplicate object keys before parsing. A parsed descriptor object
cannot preserve that source-level evidence, so its result reports `duplicateKeysChecked: false` and
an explicit incomplete reason.

`modrinth search` queries Modrinth's public v2 search API without authentication. Optional filters
include `--version`, `--type`, `--loader`, and `--category`; `--index` accepts `relevance`,
`downloads`, `follows`, `newest`, or `updated`. Use `--offset` and `--limit` (maximum 100) for
pagination.

`modrinth versions <project-id-or-slug>` lists the versions published for one project. Filter with
`--game-version`, `--loader`, or `--featured true|false`. Changelogs are omitted by default to keep
responses small; pass `--include-changelog true` when they are needed.

`modrinth compatibility <project-id-or-slug...>` compares 2-10 projects using their public
[Modrinth version metadata](https://docs.modrinth.com/api/operations/getprojectversions). It returns
bounded common game-version/loader pairs, the latest `date_published` concrete version for each
project in every returned pair, and independent game-version and loader intersections for
diagnostics. IDs and slugs are first resolved with Modrinth's
[project check endpoint](https://docs.modrinth.com/api/operations/checkprojectvalidity), so aliases
are deduplicated even when filters return no versions. Optional `--game-version`, `--loader`, and
`--featured true|false` filters are applied before comparison. `--limit` bounds each project's
general candidate list; requests use bounded concurrency, response sizes, and `--timeout-ms`. A
slug beginning with `--` must follow the `--` option terminator. Common pairs are ordered by the
least-recent latest candidate across all projects before bounded output is applied. A common
metadata pair is not proof that the projects interoperate at runtime; a failed canonical
lookup makes the outcome indeterminate instead of guessing. `requestsComplete` reports whether all
lookups completed and validated; `outcome` separately reports `compatible`, `no-common-pair`, or
`indeterminate`.

`modrinth get` covers the other common public read APIs: project details and dependencies, version
details and file-hash lookup, users, categories, loaders, game versions, project/side types,
donation/report types, and instance statistics. Run the CLI help to see the accepted resource names.

`minecraft validate-mixin-config <config.json>` performs a bounded offline Mixin configuration
preflight. `--archive-entries` accepts a JSON string array of logical paths from one supplied
archive; `--archive-entries-complete` defaults to false and applies only to that archive. Local
absence is unknown because dependencies, the wider runtime classpath, and plugin-generated mixins
are not inspected. Raw CLI text retains duplicate-key source evidence, while the Catalog and MCP
object form cannot prove original source-key uniqueness. Definitive errors exit 1; warnings and
unknown archive evidence remain valid and exit 0. See
[Mixin configuration validation](MIXIN_CONFIG_VALIDATION.md) for pinned upstream sources, checked
fields, bounds, and explicit non-goals.

`modrinth validate-pack <file.mrpack>` performs an offline preflight of the ZIP container and
`modrinth.index.json`. It checks portable normalized paths and ancestor collisions, required
SHA-1/SHA-512 hashes, HTTPS download hosts, file sizes, environments, dependency metadata,
override layering, and index/archive consistency. Binary validation also checks ZIP flags,
central/local header agreement, extra-field record bounds, alternate Unicode path fields, bounded
expansion, expanded sizes, CRC-32, overlapping data, and Unix type/marker consistency. It rejects
symlinks, devices, and other special files. It does not download the referenced files. The default bounds are 512 MiB
of archive input, 25,000 entries, a 16 MiB index, 512 MiB per entry, 4 GiB total expanded data, a
200:1 ratio, and 200 retained diagnostics. `--max-archive-bytes` can lower, but never raise, the
archive-input bound.

Object-form validation also caps index file traversal at the configured archive-entry limit,
portable paths at 4,096 characters, URLs at 8,192 characters, and downloads at 64 per file.

The official default host allowlist is `cdn.modrinth.com`, `github.com`,
`raw.githubusercontent.com`, and `gitlab.com`. Repeat `--allow-download-host <host>` only when an
additional exact host is intentionally trusted; each such URL remains visible as a warning, and a
warning-only result exits 0. Results distinguish `none`, `metadata`, and `binary` archive assurance
in `validationStrength`. The Catalog equivalent is
`validateModrinthPack({ index, archiveEntries, additionalDownloadHosts, limits })`; MCP clients can
use `validate_modrinth_pack` with JSON and entry metadata without sending archive binaries.

`fabric toolchain <game-version>` queries the official live Fabric Meta v2 Loader, Intermediary,
and Yarn endpoints in parallel. Results preserve Fabric Meta's newest-first candidate order and
recommend the first entries marked `stable`, falling back to the first entries when no stable entry
is listed. The flag remains upstream selection metadata: it does not prove that a mod, Fabric API
build, or complete project dependency set is compatible. Candidate tuples combine entries listed
for the same game version; Fabric Meta does not publish those Cartesian combinations as a separate
guarantee. Output is bounded with `--limit` (maximum 50), requests default to a 5000 ms timeout, and
versions without Yarn mappings return an explicit incomplete result instead of inventing a tuple.

`velocity toolchain` resolves the current `com.velocitypowered:velocity-api` coordinate from the
official PaperMC Maven repository, then cross-checks the official Velocity development guide and
Java FAQ. Maven XML and documentation reads have response-size, schema/parser, and timeout bounds;
`--limit` (maximum 50) bounds the deterministic candidate list and `--timeout-ms` defaults to 5000.
The result includes retrieval time, source statuses, repository and Javadocs links, and the Java
minimum only when the official FAQ range applies to the resolved API major. Documentation drift is
reported without silently replacing Maven's `latest` value. Velocity API and server versions do
not prove Minecraft protocol, client, or backend-server compatibility, so no game-version mapping
is inferred.

`server validate-properties` reads a regular file once with no-follow/nonblocking flags where
available plus bigint path/handle identity and timestamp checks, rejects non-UTF-8 or oversized
input, and does not use the network. Node does not expose openat-style ancestor-relative traversal;
quiesce a tree that a malicious local writer can replace concurrently. Validation follows Java
Properties natural/logical line, separator, continuation, and escape semantics; it then checks
duplicates, conservative Java-width stable scalar types, and only RCON/resource-pack correlations
provable inside the same file. No property values are returned. Unknown keys, target-version
membership, the server's runtime reader/encoding, proxy authentication, and fork-specific behavior
remain explicit gaps, so `validationComplete` is false without official generated defaults.

`fabric validate-mod <file.jar>` reads one regular local JAR only after checking the 256 MiB hard
ceiling, then confirms file identity, size, and timestamps before and after the read. A lower
ceiling can be selected with `--max-archive-bytes`; callers cannot raise the published maximum. The
offline validator checks bounded structural rules for current `fabric.mod.json` schema v1,
portable and duplicate archive paths, bounded ZIP expansion, and presence of referenced icons,
mixin configurations, access wideners, and nested JARs. It does not validate dependency predicates
or satisfaction, entrypoint classes or runtime loading, mixin/access-widener syntax, nested JAR
metadata, or icon pixels. Invalid metadata or archives return exit code 1.

The Catalog APIs are `validateFabricMod({ metadata, archiveEntries, limits })` for metadata-only
evidence and `validateFabricModJar(bytes, { limits })` for local binary validation. MCP clients use
`validate_fabric_mod` with parsed metadata or bounded JSON text and optional archive-entry metadata;
binary JARs are deliberately unsupported. MCP preflights JSON complexity, array count, path length,
numeric fields, and limits against the Catalog hard ceilings before invoking validation. Its
`limits` object exposes only archive-entry count, metadata byte/node/depth/string-byte, and retained
diagnostic ceilings; binary ZIP size and compression limits remain exclusive to local JAR
validation.

`fabric mods inventory <directory>` is a local CLI-only direct-directory inventory. It scans no
subdirectories and selects only entry basenames with the exact lowercase `.jar` suffix, so `.JAR`
and nested JARs are ignored. The root must be a direct directory, not a symbolic link or directory
junction. Each selected JAR must remain a regular file rather than a symbolic link, junction,
directory, or special entry. The command first collects a bounded candidate-name set, then sorts it
by basename and reads one stable file at a time through the same identity, size, and timestamp
checks as `fabric validate-mod`.

Inventory entries report only basename, byte length, SHA-256, Fabric mod ID/version/environment,
and binary validation strength, validity, and error/warning counts. Absolute input paths, JAR
bytes/base64, and operating-system error details are not included in JSON. Duplicate declared mod
IDs are retained as factual groups. The published hard ceilings are 10,000 direct directory
entries, 512 JAR candidates, 256 MiB per JAR, 1 GiB of `accountedJarBytes`, 200 retained scan
diagnostics, and 100 retained duplicate-ID groups. Entry or JAR-count overflow discards the
incomplete candidate selection. Once all candidate names are known, lexicographic order makes the
total-byte cutoff deterministic. Limit overflow, a read race, or a scan failure sets
`validationComplete` false. Invalid, rejected, duplicate, or incomplete inventories exit 1;
complete inventories containing only valid unique mods exit 0.

`fabric mods diff <left-directory> <right-directory>` inventories both sides and safely pairs only
unique, valid entries with non-null mod IDs. The result reports added and removed IDs plus version,
environment, SHA-256, validation-status, and filename changes. Duplicate-ID or identified invalid
entries are placed in `ambiguous`; rejected or missing-ID entries are placed in `unidentified`
instead of being paired by filename or position. `comparisonComplete` is true only when both scans
complete with no ambiguous or unidentified entries. `hasDifferences` covers reported additions,
removals, or changed pairs among retained pairable entries. When a scan is incomplete, those entries
remain useful evidence, but additions and removals do not describe the complete directory; use
`comparisonComplete` as that completeness guard. A difference, ambiguity, unidentified entry, or
incomplete comparison exits 1; only a complete identical comparison exits 0.

Inventory and diff do not resolve dependency graphs or load order; prove Minecraft-version
compatibility, authenticity, Modrinth origin, or runtime startup; or download, update, or delete
files. They are factual local comparisons, not compatibility or launch guarantees. There is no
Catalog or MCP equivalent because neither surface accepts or traverses local filesystem paths.

`player-profile lookup-name <name>` resolves bounded Java profile identity, while `player-profile
textures <uuid>` returns verified signed texture metadata. The MCP equivalents are
`lookup_java_player_profile` and `get_verified_java_player_textures`; the Catalog equivalents are
`lookupJavaPlayerProfileByName` and `getVerifiedJavaPlayerTextures`. The supplied name or UUID is
sent only to fixed Mojang services. These surfaces accept no caller endpoint, headers, request body,
or cache path and write no disk cache or application log.

The exact endpoints and response shapes are derived from the official Minecraft 26.2
[Authlib 9.0.75 artifact](https://libraries.minecraft.net/com/mojang/authlib/9.0.75/authlib-9.0.75.jar)
(SHA-1 `d61056a234d5e4b272e09d59b0713f80d6c0b6af`) and are version-specific,
undocumented service behavior. `verified` establishes only the textures-property signature and
session/payload UUID-name binding. The 64-hex reference is extracted from verified signed metadata;
the canonical HTTPS URL is derived by placing that reference into the fixed official URL shape and
is not itself a signed string. Neither establishes PNG bytes, a content digest, current skin
selection, ownership, or licensing. The profile resolver does not fetch PNG bytes; pass a returned
hash to the separate [`player-texture download`](../packages/cli/README.md#examples) command as
`player-texture download <hash> --kind skin|cape|elytra --output <new.png>` when bytes are needed.
Skin layout inspection and face cropping remain separate operations.

Paper API package indexes are available for every bundled Paper-supported Minecraft version from
1.13 onward. Type/member API surfaces use the modern Javadocs `type-search-index.js` and
`member-search-index.js` files when present. Older Javadocs that do not expose those files are
covered with legacy `allclasses-noframe.html` and `index-all.html` extraction. These surfaces still
prove name presence only; they do not prove runtime behavior, nullability, overload semantics, or
thread safety.

## Performance Time-Series Analysis

`minecraft analyze-performance <file>` reads normalized observations from a bounded local JSON
file. It does not query a server, Grafana, Prometheus, logs, or a project-specific metric source.
The accepted sample fields are `timestamp`, `tps`, `mspt`, `cpuPercent`, `heapUsedBytes`,
`loadedChunks`, `entities`, `players`, and `gcPauseMs`; identity, UUID, coordinates, host, and
source-label fields are rejected.

```json
{
  "samples": [
    { "timestamp": "2026-08-25T00:00:00.000Z", "tps": 20, "mspt": 41.5 },
    { "timestamp": "2026-08-25T00:01:00.000Z", "tps": 19.7, "mspt": 48.2 }
  ],
  "expectedIntervalSeconds": 60,
  "thresholds": { "cpuPercent": { "maximum": 85 } }
}
```

Timestamps must be strictly increasing canonical UTC instants with millisecond precision. The
result reports missing-data coverage, min/p50/p95/max, observed threshold violations and bounded
consecutive intervals, linear trends, optional before/after evidence, and Pearson associations
with MSPT for at least ten exact-timestamp, non-constant aligned observations. It does not
interpolate values or perform a significance test, and association, trend, or before/after change
must not be interpreted as causation.

The only automatic thresholds are the [Paper command reference](https://docs.papermc.io/paper/reference/commands/)
target of 20 TPS and 50 ms tick budget. Other metrics are evaluated only when an explicit threshold
is supplied. A violation recommends only a scoped spark capture while the issue is occurring, in
line with Paper's [profiling](https://docs.papermc.io/paper/profiling/) and
[basic troubleshooting](https://docs.papermc.io/paper/basic-troubleshooting/) guidance; it does not
name a root cause.

Defaults cap normalized input at 4 MiB of UTF-8 and 4,194,304 UTF-16 code units, 10,000 samples, a
366-day window, 500 retained diagnostics, eight fixed series, and 100 retained violation intervals
per series. The CLI
also rejects a non-regular or final symlink file, path or same-handle identity changes during
positioned reads, malformed UTF-8, duplicate object keys, JSON deeper than 16 containers, and JSON
beyond the fixed structural-node budget before `JSON.parse`. Invalid or insufficient input and
threshold violations exit 1; only an analyzed result without violations exits 0. Catalog and MCP
inputs are already parsed objects, so they cannot prove whether the original source JSON contained
duplicate keys.

## Authoring Safety Data

Use these together before writing or reviewing generated output:

- `datapack context`, `resourcepack context`, or `plugin paper context`: preflight, recipes,
  scenarios, guardrails, diagnostics, claim policies, output requirements, response patterns,
  intent routing, and evidence in one payload.
- `datapack recipes`, `resourcepack recipes`, or `plugin paper recipes`: ordered lookup workflows
  for common tasks.
- `datapack search-scenarios`, `resourcepack search-scenarios`, or
  `plugin paper search-scenarios`: task-wording search over existing scenario, recipe, and intent
  text.
- `datapack scenarios`, `resourcepack scenarios`, or `plugin paper scenarios`: realistic task
  shapes plus required lookup IDs for evaluation and self-review.
- `datapack plan`, `resourcepack plan`, or `plugin paper plan`: one scenario with all required
  recipes, intent lookups, diagnostics, claim policies, fact surfaces, response patterns, and
  optional version evidence resolved.
- `datapack diagnostics`, `resourcepack diagnostics`, or `plugin paper diagnostics`: pass/fail
  checks to run before returning generated files, code, or source-backed answers.
- `datapack claim-policies`, `resourcepack claim-policies`, or `plugin paper claim-policies`:
  required evidence plus safe and unsafe wording for specific claim types.
- `datapack output-requirements`, `resourcepack output-requirements`, or
  `plugin paper output-requirements`: final-answer and generated-file checks.
- `datapack response-patterns`, `resourcepack response-patterns`, or
  `plugin paper response-patterns`: answer shapes for verified facts, missing evidence, and
  non-guarantees.
- `datapack fact-surfaces`, `resourcepack fact-surfaces`, or `plugin paper fact-surfaces`: what
  each machine-verifiable data surface can and cannot prove.
- `source report [domain] [version]` or `minecraft sources [domain] [version]`: allowed source
  tiers, prohibited automation, structured community datasets, and optional domain/version
  provenance.

The Paper item-delivery scenario requires partial inventory insertion to account for every
uninserted stack exactly once. It also requires an explicit reject, defer, persist, or verified
fallback policy before delivery is reported complete. `Player.give` and similar convenience APIs
must be verified in the target-version member surface and behavior documentation instead of being
recommended for every Paper version.

For Paper administrator, moderator, configuration, and maintenance commands, use scenario
`paper-administrative-command-operability-review`. Its plan checks the complete mutation,
inspection, reload, recovery, and retry surface; explicit support or rejection for player, local
and remote console, command block, command minecart, proxied, custom, and unknown senders; online
or offline targets;
permissions; protected secret input; justified safe out-of-band alternatives; bounded bulk scope;
atomic last-known-good reload; invoker/target feedback; effective-state status; and failure-path
tests.

For Paper player data, use
`plugin paper plan paper-player-identity-and-display-review <version>`. The resolved workflow keeps
stable identity separate from mutable account names and presentation labels, verifies the actual
Player, OfflinePlayer, profile, and display APIs used, and requires rename, offline, cache, and
cross-server tests. The workflow also makes online-mode, offline-mode, and trusted proxy identity
assumptions explicit before treating a UUID as authoritative.

For plugin-defined Paper items, resolve
`plugin paper plan paper-itemstack-semantic-identity-review <version>`. The plan uses a stable
namespaced logical item ID plus a separate schema version, distinguishes semantic identity from
`ItemStack.isSimilar` and client rendering, and refreshes only an explicit owned presentation
allowlist on a cloned or otherwise owned stack. It preserves enchantments, attributes, damage,
unowned PDC, data components, subtype metadata, and other out-of-scope state by default. Migrations
are deterministic and idempotent, publish only after success, leave unknown items untouched, and
require duplicate-lore, repeat-migration, comparison-purpose, aliasing, rollback, and unrelated-
state preservation tests.

For Paper connection-scoped state, resolve
`plugin paper plan paper-player-session-lifecycle-review <version>`. The plan separates durable
player records from one connection generation, requires target-version type/member evidence before
naming lifecycle APIs, and routes quit, kick, relevant transfer, connection close, failed partial
initialization, plugin stop, repeated signals, and reconciliation through one idempotent teardown.
It also requires stale-callback publication fences, revisioned persistence, a bounded shutdown
barrier, leak observability, and race tests. Item or inventory contents and ownership settlement are
explicitly outside this guidance.

For a Paper BossBar whose candidates or viewers change over time, resolve
`plugin paper plan paper-bossbar-audience-lifecycle-review <version>`. The plan gives each logical
slot one owner generation and one bounded revisioned writer, evaluates explicit audience gates,
selects competing candidates by stable priority with controlled hysteresis, and reconciles an
authoritative desired viewer identity set by remove/add differences. Replacement, owner or
encounter end, owning-session close, reconnect, backend transfer, reload, and disable converge on
one idempotent hide-and-detach path; a non-owning viewer-session end removes only that viewer from a
shared bar. The workflow includes stale-update and viewer-leak tests. Cross-server ownership is
an explicit plugin policy, not a guarantee of the Paper BossBar API. Boss AI, encounter mechanics,
custom mobs, ModelEngine, scoreboards, action bars, and vanilla `/bossbar` command authoring are
outside this workflow.
For delayed, repeating, or asynchronous Paper work, resolve
`plugin paper plan paper-scheduled-task-lifecycle-review <version>`. The plan verifies the
target-version scheduler and lifecycle surfaces, gives each task a plugin and feature owner, and
uses a lifecycle generation for work replaced by reload or reconfiguration. It separates
background work from Bukkit or Paper publication, selects Folia schedulers by state ownership when
Folia is in scope, closes admission before idempotent teardown, and treats cancellation as an
attempt rather than proof that an already-running callback stopped. Custom executors and child
operations require their own bounded cleanup. Controlled cancellation, disable, late-completion,
and publication-fence tests keep the final runtime claim aligned with its evidence.
For Paper custom metadata storage, resolve
`plugin paper plan paper-persistent-data-contract-review <version>`. The plan distinguishes
NamespacedKey ownership, primitive type matching, complex payload validation, holder lifetime,
snapshot publication, cross-holder transfer, `copyTo` replacement, selective removal, and bounded
schema migration. It preserves foreign and unsupported-future records and requires target-version
loaded-server evidence for holder save, unload, reload, or restart claims. ItemStack identity,
similarity, and presentation refresh remain a separate concern.
For clickable Paper in-world displays, resolve
`plugin paper plan paper-display-interaction-contract-review <version>`. The plan defines one
local-space coordinate contract for both the visual Display and separate Interaction hit target,
keeps subtype origins and client-rendered transforms distinct from hitbox dimensions, and keeps
pending hit targets input-unavailable until a complete registered generation is published through
one serialized transition. It then applies bounded reconciliation and explicit removal, selects one
right-click event path and hand policy, then requires pure layout, loaded-server lifecycle, and
target-client visual and click-boundary evidence. Generic scheduler, PDC, event-priority,
ItemStack-identity, and cross-chunk behavior stays in dedicated guidance.

For frequent or contended Paper database writes, resolve
`plugin paper plan paper-high-frequency-persistence-review <version>`. Start with a producer matrix
covering steady and peak rate, burst duration, key cardinality, pending memory, durability and
visibility budgets, and ordering semantics. The workflow then selects either a database-side atomic
mutation or bounded per-key delta coalescing, keeps database I/O outside the server or region tick
context, and requires explicit key, byte, age, in-flight, admission, and retry bounds.

Flushes use immutable batch snapshots and exact accepted-to-durable accounting. A known partial
result requeues only its uncommitted remainder, while an unknown commit outcome must be reconciled
through idempotency, a revision, a durable batch ledger, or a supported adapter check before any
reapplication. Only serialization or deadlock conflicts verified against the selected database and
driver may retry, and each retry starts a fresh whole transaction without external side effects.
Shutdown closes admission before a bounded barrier and either reaches the durability budget or
hands an explicit remainder to restart recovery. Deterministic interleaving tests are necessary but
do not replace contention tests against the real adapter and driver. Player connection generations,
reconnect, quit, stale publication, and teardown remain in `paper-player-session-lifecycle`.

The off-thread boundary follows Paper's official [scheduling guidance](https://docs.papermc.io/paper/dev/scheduler/)
and [database guidance](https://docs.papermc.io/paper/dev/using-databases/). JDBC defines a transaction
as one unit and documents rollback before restarting failed work in its
[transaction guide](https://docs.oracle.com/javase/tutorial/jdbc/basics/transactions.html). Its
[`SQLTransactionRollbackException`](https://docs.oracle.com/en/java/javase/26/docs/api/java.sql/java/sql/SQLTransactionRollbackException.html)
also requires consulting the driver vendor's documented conditions, so the bundled workflow does
not hard-code one database product's retry codes or exception layout.

For Paper equipment attributes, transient session attributes, and potion effects, resolve
`plugin paper plan paper-attribute-effect-ownership-review <version>`. Attribute contributions use
stable plugin-owned keys and a deterministic desired-state reconcile that preserves foreign
modifiers. Equipment checks distinguish absent ItemMeta attributes from explicit overrides and
prove effective vanilla `ItemType` defaults. Potion effects have no per-source owner key, so the
plan requires an explicit type-collision policy and preserves unexpected active or hidden chains
rather than deleting by type. Capacity modifiers are applied before finite nonnegative health and
absorption clamps, and tests cover multiple sources, weaker reapply, expiry, death, quit,
reconnect, reload, and repeated cleanup. Logical ItemStack identity, persistent-data schema,
scheduling, and combat-balance values remain separate concerns.

For a Minecraft inventory, menu, or protocol-driven screen backed by a database or service, resolve
`plugin paper plan paper-server-backed-paged-ui-review <version>`. The workflow requires one bounded
page to be fetched at the source, a stable ID and total order with a unique tie-breaker, and either
a server-owned opaque cursor or an explicit snapshot revision with honest live-versus-snapshot
semantics. Responses carry bounded items, continuation and exhaustion, plus a request generation;
the UI exposes distinct loading, empty, error, and terminal states and rejects duplicate, reversed,
out-of-order, cyclic, or late pages. Repeated stable IDs use an explicit snapshot-conflict or
versioned live-replacement rule instead of silently choosing the first or last payload. Query,
authorization, reopen, reconnect, and data-shrink transitions reset, validate, refresh, or clamp
navigation, while requests, retained rows, retries, and prefetch remain bounded. Inventory click
safety, rendering geometry, screen-specific design, persistence flushing, and business-specific
page sizes remain separate concerns.

For Paper player death and respawn ownership, resolve
`plugin paper plan paper-death-respawn-handoff-review <version>`. The plan first verifies the
target's death cancellation, revive, item, experience, respawn, location, and world-lookup
contracts. It makes vanilla death, plugin-owned downed, and respawn pending mutually exclusive for
one death epoch; reconciles drops, items-to-keep, keep-inventory, retained experience, and dropped
experience into one settlement receipt; and never replays that receipt during recovery. A final
cancelled value cannot prove which listener owns the outcome, so downed side effects remain staged
until a cooperative ownership contract succeeds and ambiguous cancel-to-uncancel-to-recancel flows
fail closed. Destination selection starts from Paper's server-selected location and preserves bed,
respawn-anchor, or world fallback behavior by default. It validates any explicit plugin candidate
and records the actual post-reset outcome separately. Only plugin-owned temporary state may be
restored or cleared. Duplicate callbacks, invalid or unavailable worlds, quit, reconnect, reload,
and disable must
converge without an extra teleport or guessed fallback world.

For Paper scoreboards and sidebars, resolve
`plugin paper plan paper-scoreboard-ownership-lifecycle-review <version>`. The plan captures the
exact scoreboard visible before installation and restores it only while the same owner still
controls the installed board, so a foreign replacement is never overwritten. It requires either a
private board per viewer or a shared-board group owner whose objectives and teams remain registered
until the last member stops displaying it; a shared group owns one compatible snapshot, so
viewer-specific content requires a private board or another group. Stable target-bounded
identifiers, deterministic tie-broken snapshot diffs, explicit truncation, and generation-fenced
delayed updates cover publication. Mid-session
eligibility, join, quit, reconnect, world change, rapid replacement, reload, disable, and
restoration failure all have explicit test and cleanup outcomes. Numeric limits and event behavior
must come from the selected target-version Paper evidence rather than copied constants.

## Source Policy

Bundled facts come from Mojang version metadata and downloads served through Piston endpoints,
extracted official client/server jars, PaperMC API and docs, structured community datasets, and the
`sya-ri/spigot-event-list` API contract.
Minecraft Wiki is human-only background; AI workflows should not fetch, crawl, summarize, or cite
Wiki pages.

See [SOURCE_STRATEGY.md](SOURCE_STRATEGY.md) for source tiers, community structured datasets, and
validation rules.

## MCP

Run the server with:

```sh
npx -y @minecraft-skills/mcp
```

Typical stdio MCP client config:

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

For steadier agent behavior, add this to `AGENTS.md`, `CLAUDE.md`, or the equivalent project
instruction file:

```md
Use minecraft-skills MCP tools whenever a task involves Minecraft.
Do not guess Minecraft facts when a minecraft-skills MCP lookup can verify them.
If MCP cannot answer, check local project files or approved web sources; label any remaining
assumption and ask the user to confirm it.
```

The server exposes the same catalog as tools, resources, and prompts. Prompts:

- `use_minecraft_datapacks`
- `use_minecraft_resourcepacks`
- `use_minecraft_paper_plugins`

Analysis and pack tools include:

- `analyze_minecraft_log`
- `classify_pack_files`
- `get_pack_file_schema`
- `validate_datapack_json`
- `inspect_resourcepack_png_alpha_bounds`
- `validate_player_skin_layout`
- `validate_resourcepack_png`
- `validate_datapack_project`
- `validate_resourcepack_project`
- `validate_server_access_list`
- `inspect_blockbench_project`
- `validate_mixin_config`
- `analyze_minecraft_performance`
- `validate_resourcepack_translations`
- `get_pack_migration_plan`
- `get_pack_format`
- `find_versions_by_pack_format`
- `get_mojang_version_metadata`
- `fetch_mojang_server_jar`
- `search_vanilla_datapack_json_files`
- `search_vanilla_datapack_json_content`
- `get_vanilla_datapack_json`
- `search_community_datasets`
- `get_resourcepack_assets_status`
- `fetch_resourcepack_assets`
- `search_resourcepack_assets`
- `get_resourcepack_asset`
- `search_all`
- `search_registry_entries`
- `compare_registry_entries`
- `find_datapack_entries`
- `find_resourcepack_assets`
- `explain_pack_path`
- `suggest_minecraft_lookups`
- `lookup_java_player_profile`
- `get_verified_java_player_textures`

`inspect_resourcepack_png_alpha_bounds` accepts only canonical padded Base64 for one complete PNG,
not a local path, URL, or pixel array. Request-object descriptors are preflighted without invoking
accessors or Proxy traps, and decoded length is checked before Base64 allocation. Malformed PNG or
zlib bytes and inspection safety stops are returned as bounded Catalog validation results; invalid
MCP request shape or encoding remains a tool-input error.

Skill and data resources are exposed under:

- `minecraft-skills://skills/<skill>/...`
- `minecraft-skills://data/...`

## Package API

Use `@minecraft-skills/catalog` for validated data access:

```ts
import { readFileSync } from "node:fs";
import {
  analyzeMinecraftLog,
  getAuthoringContext,
  getAuthoringDiagnostic,
  getAuthoringGuardrail,
  getAuthoringPlan,
  getAuthoringRecipe,
  getAuthoringScenario,
  getClaimPolicy,
  getMinecraftAssetsStatus,
  getMojangVersionMetadata,
  getOutputRequirement,
  getPackFormat,
  getResponsePattern,
  downloadJavaPlayerTexture,
  findVersionsByPackFormat,
  inspectResourcepackPngAlphaBounds,
  inspectBlockbenchProject,
  searchAuthoringScenarios,
  searchCommands,
  searchMinecraftAssets,
  searchPaperMembers,
  searchVanillaPaths,
  analyzeMinecraftPerformance,
  validateResourcepackPng,
  validatePlayerSkinLayout,
  inspectJavaPlayerTextureBytes,
  validateDatapackProject,
  validateResourcepackProject,
  resolveVelocityToolchain,
  validateServerAccessList,
  validateResourcepackTranslations,
} from "@minecraft-skills/catalog";

const context = getAuthoringContext({ domain: "paper-plugin", version: "26.2" });
const velocity = await resolveVelocityToolchain({ limit: 5, timeoutMs: 5000 });
const logAnalysis = analyzeMinecraftLog({
  text: `[12:00:00] [Server thread/ERROR]: java.lang.NoClassDefFoundError: com/example/api/MissingService
Caused by: java.lang.ClassNotFoundException: com.example.api.MissingService`,
});
const performance = analyzeMinecraftPerformance({
  samples: [
    { timestamp: "2026-08-25T00:00:00.000Z", tps: 20, mspt: 41.5 },
    { timestamp: "2026-08-25T00:01:00.000Z", tps: 19.7, mspt: 48.2 },
  ],
  expectedIntervalSeconds: 60,
});
const diagnostic = getAuthoringDiagnostic("paper-api-member-unverified");
const recipe = getAuthoringRecipe("paper-event-listener");
const scenario = getAuthoringScenario("paper-event-listener-review");
const itemDeliveryDiagnostic = getAuthoringDiagnostic("paper-inventory-leftovers-unhandled");
const itemDeliveryRecipe = getAuthoringRecipe("paper-safe-item-delivery");
const itemDeliveryScenario = getAuthoringScenario("paper-item-delivery-review");
const worldOperationGuardrail = getAuthoringGuardrail("paper-world-operation-safety");
const worldOperationDiagnostic = getAuthoringDiagnostic("paper-world-operation-unbounded");
const worldOperationRecipe = getAuthoringRecipe("paper-world-operation-safety");
const worldOperationScenario = getAuthoringScenario("paper-world-operation-safety-review");
const matchingScenarios = searchAuthoringScenarios({
  query: "Paper event listener",
  domain: "paper-plugin",
});
const plan = getAuthoringPlan({ scenario: "paper-event-listener-review", version: "26.2" });
const playerIdentityPlan = getAuthoringPlan({
  scenario: "paper-player-identity-and-display-review",
  version: "1.21.11",
});
const claimPolicy = getClaimPolicy("paper-type-or-member-exists");
const outputRequirement = getOutputRequirement("paper-plugin-output-safety");
const responsePattern = getResponsePattern("paper-api-answer");
const packFormat = getPackFormat("java", "26.2", "datapack");
const mojangMetadata = getMojangVersionMetadata("java", "26.2");
const matchingPackVersions = findVersionsByPackFormat({
  domain: "resourcepack",
  format: 88,
});
const assetStatus = getMinecraftAssetsStatus("26.2");
const resourcepackAssetMatches = searchMinecraftAssets({
  version: "26.2",
  contains: "diamond_sword",
  extension: "json",
});
const resourcepackProject = validateResourcepackProject({
  version: "26.2",
  files: [
    {
      path: "assets/example/models/item/widget.json",
      content: { parent: "minecraft:item/generated" },
    },
  ],
});
const pngValidation = validateResourcepackPng(readFileSync("./pack.png"), {
  limits: { maxInputBytes: 4 * 1024 * 1024 },
});
const pngAlphaBounds = inspectResourcepackPngAlphaBounds(
  readFileSync("./assets/example/textures/item/widget.png"),
  {
    requirements: { nonEmpty: true, minimumTransparentMarginPixels: 1 },
    limits: { maxInflatedBytes: 16 * 1024 * 1024 },
  },
);
const playerSkinLayout = validatePlayerSkinLayout({
  width: 64,
  height: 64,
  sourceRects: { base: { x: 8, y: 8, width: 8, height: 8 } },
});
const inspectedPlayerTexture = inspectJavaPlayerTextureBytes(
  "0123456789abcdef".repeat(4),
  "skin",
  readFileSync("./skin.png"),
);
const downloadedPlayerTexture = await downloadJavaPlayerTexture(
  "0123456789abcdef".repeat(4),
  "skin",
);

const datapackProject = validateDatapackProject({
  version: "26.2",
  files: [
    {
      path: "pack.mcmeta",
      content: { pack: { pack_format: 107, description: "Example" } },
    },
    {
      path: "data/example/function/main.mcfunction",
      content: "function #example:load",
    },
    {
      path: "data/example/tags/function/load.json",
      content: { values: ["example:main"] },
    },
  ],
});
// Set assumeLocalNamespacesComplete: false when another pack or mod may merge dependencies into
// the same namespace. The default closed-project mode reports missing submitted-namespace targets.
const accessList = validateServerAccessList({
  kind: "whitelist",
  content: "[]",
  evaluatedAt: "2026-08-25T00:00:00.000Z",
const blockbenchProject = inspectBlockbenchProject({
  project:
    '{"meta":{"format_version":"5.0","model_format":"free"},"groups":[{"name":"seat"}],"animations":[{"name":"idle"}]}',
  requireAnimations: ["idle", "walk"],
  requireGroups: ["body", "seat"],
});

const translationParity = validateResourcepackTranslations({
  version: "26.2",
  referenceLocale: "en_us",
  requiredLocales: ["ja_jp"],
  files: [
    {
      path: "assets/example/lang/en_us.json",
      content: '{"example.greeting":"Hello %s"}',
    },
    {
      path: "assets/example/lang/ja_jp.json",
      content: '{"example.greeting":"%s さん、こんにちは"}',
    },
  ],
  argumentCounts: { "example.greeting": 1 },
});

// ResourcepackProjectFile.content accepts a Uint8Array for OGG files. Only the first 58 bytes are
// needed; callers should avoid reading a complete audio file solely for validation.

const commandMatches = searchCommands({ version: "26.2", prefix: "execute", limit: 10 });
const assetMatches = searchVanillaPaths({
  version: "26.2",
  domain: "resourcepack",
  contains: "models/item",
});
const playerMembers = searchPaperMembers({
  version: "26.2",
  type: "org.bukkit.entity.Player",
  contains: "sendMessage",
});
```

`inspectResourcepackPngAlphaBounds` snapshots a direct `Uint8Array` or `Buffer` before inspection,
reuses `validateResourcepackPng`'s CRC-verified chunk walk, and returns bounded static-alpha facts.
It supports every legal PNG color-type/bit-depth combination, filters 0-4, and Adam7, including
16-bit alpha and sub-byte samples. PLTE/tRNS order, length, palette bounds, masked low-bit color
keys, and exact 16-bit keys are validated before alpha facts are complete. Option, limit, and
requirement objects are descriptor-preflighted; invalid public input becomes a diagnostic result
instead of invoking accessors or throwing.
The world-operation guidance is for bounded block and entity work that crosses chunk, tick,
asynchronous, unload, teleport, or Folia region boundaries. It requires target chunks and generation
policy to be fixed before mutation, forbids waiting or blocking a server tick owner via `Future.get()`
or `Future.join()`, re-resolves location coordinates in their region owner, and hands entity work to
the entity scheduler so the callback can revalidate the current entity. It returns typed partial
outcomes, reconciles retries idempotently, and releases operation-owned chunk tickets on every
terminal path. It does not require unsafe cross-region `World.getEntity()` lookup as the only entity
handoff, treat `isChunkLoaded()` as a lease, async completion as arbitrary-thread mutation safety,
`applyPhysics=false` as a general safety guarantee, entity unload as death, teleport completion as
unconditional success, or lifecycle events as complete cleanup. An `EntityScheduler` retired callback
runs in critical code, so it should only record or forward minimal terminal intent; entity, chunk,
world, and ticket-level cleanup belongs in a verified safe execution context.

Resolve the Javadocs URL for the requested version with `getPaperApiReference`; the current official
primary references include Paper's [World Javadocs](https://jd.papermc.io/paper/26.2/org/bukkit/World.html),
[Block Javadocs](https://jd.papermc.io/paper/26.2/org/bukkit/block/Block.html),
[Entity Javadocs](https://jd.papermc.io/paper/26.2/org/bukkit/entity/Entity.html),
[ChunkUnloadEvent Javadocs](https://jd.papermc.io/paper/26.2/org/bukkit/event/world/ChunkUnloadEvent.html),
[RegionScheduler Javadocs](https://jd.papermc.io/paper/26.2/io/papermc/paper/threadedregions/scheduler/RegionScheduler.html),
[EntityScheduler Javadocs](https://jd.papermc.io/paper/26.2/io/papermc/paper/threadedregions/scheduler/EntityScheduler.html),
[Paper and Folia scheduler guidance](https://docs.papermc.io/paper/dev/folia-support/), and
[Folia's region ownership overview](https://docs.papermc.io/folia/reference/overview/). API
availability and callback or completion context must still be checked for the actual target version.

Piston is Mojang's official metadata/download infrastructure, not a third-party dataset. Use
`get_mojang_version_metadata` when an agent needs the official version metadata URL, client/server
jar URLs, SHA-1s, protocol/world versions, Java runtime metadata, or pack format evidence. Use
`fetch_mojang_server_jar` before `search_vanilla_datapack_json_files`,
`search_vanilla_datapack_json_content`, or `get_vanilla_datapack_json` when exact vanilla
`data/**/*.json` content is needed from the official server jar. Content search reads the cached jar
from disk once per request, validates ZIP metadata and entry checksums, extracts selected files in a
bounded batch, and searches complete parsed keys or primitive values. It reports when byte, file,
traversal, or output limits make the scan incomplete. A content search considers at most 10,000
files, 2 MiB per file, 64 MiB of decoded JSON, 100,000 JSON nodes per file, and 1,000,000 JSON nodes
for the whole request. It returns at most 100 files and 10 match details per file. Exact reads are
limited to 2 MiB. Server-jar downloads are capped by the official declared size (or 256 MiB when
unavailable), use a 30-second deadline, and are rechecked against the official size and SHA-1 on
every read. The MCP exact-read tool returns one representation at a time: `output: "parsed"`
(default) or `output: "text"`. Its serialized response is capped at 200,000 bytes and reports
`truncated`, original, and returned byte counts when only a prefix can be returned. Modern
bundler-format server downloads are resolved through `META-INF/versions.list`, verified against the
declared nested SHA-256, and inspected only after the nested payload is confirmed to contain
datapack data. Use `datapack vanilla-json clean [version]` to remove a stale cached server jar.

Use `@minecraft-skills/data` only when direct access to bundled JSON/text files is needed.

## Skills

Standalone Agent Skill folders are committed under:

- `skills/minecraft-datapacks`
- `skills/minecraft-resourcepacks`
- `skills/minecraft-paper-plugins`

The npm data package also mirrors these under `data/skills/`. Use:

```sh
minecraft-skills skill write minecraft-paper-plugins --output ./skills
```

## Cache

Heavy generated surfaces are listed in `data manifest` and downloaded with `data fetch`. This
includes datapack schema surfaces, Paper API type/member surfaces, and resourcepack model summaries.
External resource pack asset references from `InventivetalentDev/minecraft-assets` use a separate
`minecraft-assets/<version>` cache. `resourcepack assets get` caches one file, while
`resourcepack assets fetch` caches the searchable path index and archive for a version.
Official server jars used by `datapack vanilla-json` are stored under
`mojang-server-jars/<version>.jar`. Inspect them with `datapack vanilla-json status [version]`, replace
a stale or failed-integrity entry with `datapack vanilla-json fetch --force [version]`, and remove it
with `datapack vanilla-json clean [version]`.
Cache defaults:

- macOS: `~/Library/Caches/minecraft-skills`
- Linux: `${XDG_CACHE_HOME:-~/.cache}/minecraft-skills`
- Windows: `%LOCALAPPDATA%\minecraft-skills\Cache`

Set `MINECRAFT_SKILLS_CACHE_DIR` to override the location.
