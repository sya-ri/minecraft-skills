# minecraft-skills

CLI for version-aware Minecraft authoring facts, generated skills, and AI agent lookups.

## Install

```sh
npx minecraft-skills minecraft latest
```

Node.js 22.12 or newer is required.

## Examples

```sh
minecraft-skills minecraft latest
minecraft-skills skill list
minecraft-skills skill show minecraft-paper-plugins
minecraft-skills skill write minecraft-paper-plugins --output ./skills
minecraft-skills plugin paper context 26.2
minecraft-skills plugin paper recipes
minecraft-skills plugin paper recipe paper-event-listener
minecraft-skills plugin paper recipe paper-player-identity-and-display
minecraft-skills plugin paper search-scenarios "Paper event listener"
minecraft-skills plugin paper search-scenarios "full inventory reward leftovers"
minecraft-skills plugin paper scenarios
minecraft-skills plugin paper scenario paper-event-listener-review
minecraft-skills plugin paper plan paper-event-listener-review 26.2
minecraft-skills plugin paper plan paper-item-delivery-review 1.21.11
minecraft-skills plugin paper search-scenarios "inventory GUI shift-click drag"
minecraft-skills plugin paper recipe paper-inventory-gui-interactions
minecraft-skills plugin paper plan paper-inventory-gui-interaction-review 1.21.11
minecraft-skills plugin paper plan paper-administrative-command-operability-review 26.2
minecraft-skills plugin paper plan paper-player-identity-and-display-review 1.21.11
minecraft-skills plugin paper recipe paper-itemstack-semantic-identity
minecraft-skills plugin paper plan paper-itemstack-semantic-identity-review 26.2
minecraft-skills plugin paper recipe paper-player-session-lifecycle
minecraft-skills plugin paper plan paper-player-session-lifecycle-review 1.21.11
minecraft-skills plugin paper recipe paper-bossbar-audience-lifecycle
minecraft-skills plugin paper plan paper-bossbar-audience-lifecycle-review 26.2
minecraft-skills plugin paper search-scenarios "transactional config hot reload last known good"
minecraft-skills plugin paper plan paper-plugin-configuration-lifecycle-review 1.21.11
minecraft-skills plugin paper search-scenarios "MockBukkit loaded server test evidence"
minecraft-skills plugin paper plan paper-plugin-testing-evidence-review 1.21.11
minecraft-skills plugin paper preflight 26.2
minecraft-skills plugin paper evidence 26.2
minecraft-skills plugin paper guardrails
minecraft-skills plugin paper guardrail paper-api-surface-limits
minecraft-skills plugin paper guardrail paper-player-identity-and-display
minecraft-skills plugin paper guardrail paper-itemstack-semantic-identity
minecraft-skills plugin paper guardrail paper-player-session-lifecycle-safety
minecraft-skills plugin paper guardrail paper-bossbar-audience-lifecycle-safety
minecraft-skills plugin paper guardrail paper-plugin-configuration-lifecycle-safety
minecraft-skills plugin paper diagnostics
minecraft-skills plugin paper diagnostic paper-api-member-unverified
minecraft-skills plugin paper diagnostic paper-player-identity-display-confusion
minecraft-skills plugin paper diagnostic paper-itemstack-identity-or-state-loss
minecraft-skills plugin paper diagnostic paper-player-session-lifecycle-unsafe
minecraft-skills plugin paper diagnostic paper-bossbar-audience-lifecycle-unsafe
minecraft-skills plugin paper diagnostic paper-plugin-configuration-lifecycle-unsafe
minecraft-skills plugin paper claim-policies
minecraft-skills plugin paper claim-policy paper-type-or-member-exists
minecraft-skills plugin paper output-requirements
minecraft-skills plugin paper output-requirement paper-plugin-output-safety
minecraft-skills plugin paper response-patterns
minecraft-skills plugin paper response-pattern paper-api-answer
minecraft-skills plugin paper intents
minecraft-skills plugin paper intent verify-paper-type-or-member
minecraft-skills plugin paper checklist
minecraft-skills datapack checklists
minecraft-skills plugin paper fact-surfaces
minecraft-skills plugin paper fact-surface paper-api-surface
minecraft-skills data coverage
minecraft-skills minecraft support-matrix
minecraft-skills minecraft support --domain paper-plugin
minecraft-skills data manifest
minecraft-skills data fetch paper-api-surface --version 26.2
minecraft-skills minecraft list
minecraft-skills minecraft search-all "bundle item model" --domain resourcepack
minecraft-skills minecraft suggest-lookups "migrate resource pack item model" --domain resourcepack
minecraft-skills minecraft analyze-log ./logs/latest.log --max-mixin-failures 50
minecraft-skills minecraft explain-path 26.2 assets/example/items/widget.json --domain resourcepack
minecraft-skills minecraft analyze-performance ./performance-samples.json
minecraft-skills minecraft pack-formats
minecraft-skills minecraft pack-format 26.2 datapack
minecraft-skills minecraft versions-for-pack-format resourcepack 88
minecraft-skills minecraft show 26.2
minecraft-skills minecraft compare 1.20.6 1.21
minecraft-skills minecraft validate-mixin-config ./example.mixins.json
minecraft-skills minecraft validate-mixin-config ./example.mixins.json --archive-entries ./archive-entries.json --archive-entries-complete true
minecraft-skills datapack server-reports latest
minecraft-skills datapack schema latest
minecraft-skills datapack find execute
minecraft-skills datapack search-schema latest --kind advancement --contains criteria
minecraft-skills datapack commands latest --prefix execute --limit 10
minecraft-skills datapack compare-commands 1.20.6 1.21 --prefix attribute
minecraft-skills minecraft registry-entries 26.2 --registry minecraft:item --exact minecraft:stone
minecraft-skills minecraft compare-registry-entries 26.1.2 26.2 --registry minecraft:attribute --prefix minecraft:armor
minecraft-skills datapack vanilla-paths latest --contains recipe
minecraft-skills datapack vanilla-json fetch 26.2
minecraft-skills datapack vanilla-json search minecraft:diamond --version 26.2 --kind recipe --scope values
minecraft-skills datapack vanilla-json clean 26.2
minecraft-skills datapack validate-project 26.2 ./my-data-pack
minecraft-skills resourcepack vanilla-paths latest --contains models/block
minecraft-skills resourcepack compare-vanilla-paths 1.20.6 1.21 --prefix assets/minecraft/models/item/
minecraft-skills resourcepack assets status 26.2
minecraft-skills resourcepack assets fetch 26.2 --index-only
minecraft-skills resourcepack assets find "diamond sword" --kind item-definition
minecraft-skills resourcepack assets search 26.2 --contains diamond_sword --extension json --fetch
minecraft-skills resourcepack assets get 26.2 assets/minecraft/models/item/diamond_sword.json
minecraft-skills resourcepack models latest
minecraft-skills resourcepack search-models latest --kind item-definition --contains bundle
minecraft-skills resourcepack inspect-png-alpha ./assets/example/textures/item/widget.png --require-nonempty --minimum-transparent-margin-pixels 1
minecraft-skills resourcepack validate-png ./pack.png
minecraft-skills resourcepack validate-project 26.2 ./my-resource-pack
minecraft-skills player-skin validate-layout ./skin.png --base-rect 8,8,8,8 --hat-rect 40,8,8,8
minecraft-skills player-texture download 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef --kind skin --output ./skin.png
minecraft-skills minecraft validate-access-list ./whitelist.json
minecraft-skills minecraft validate-access-list ./custom.json --kind banned-players
minecraft-skills blockbench inspect-project ./model.bbmodel --require-animation idle --require-group seat
minecraft-skills resourcepack validate-translations 26.2 ./my-resource-pack/assets/example/lang/en_us.json ./my-resource-pack/assets/example/lang/ja_jp.json --pack-root ./my-resource-pack --required-locale ja_jp
minecraft-skills resourcepack sound inspect ./source.wav
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
minecraft-skills plugin paper validate-jar ./build/libs/example.jar --max-archive-bytes 16777216
minecraft-skills plugin velocity validate-jar ./build/libs/example.jar
minecraft-skills plugin velocity validate-jar ./build/libs/example.jar --target-java 26
minecraft-skills fabric toolchain 1.21.11 --limit 10 --timeout-ms 5000
minecraft-skills fabric validate-mod ./example-mod.jar
minecraft-skills fabric validate-mod ./example-mod.jar --max-archive-bytes 104857600
minecraft-skills fabric mods inventory ./server/mods
minecraft-skills fabric mods diff ./server/mods ./client/mods
minecraft-skills minecraft search "Fabric Client GameTest visual evidence" --kind authoring-recipe
minecraft-skills minecraft search "Fabric GUI scale clipping" --kind authoring-recipe
minecraft-skills velocity toolchain --limit 10 --timeout-ms 5000
minecraft-skills modrinth search "voice chat" --version 1.21.11 --type mod --loader fabric
minecraft-skills modrinth versions simple-voice-chat --game-version 1.21.11 --loader fabric
minecraft-skills modrinth compatibility sodium iris --game-version 1.21.11 --loader fabric
minecraft-skills modrinth get project simple-voice-chat
minecraft-skills modrinth validate-pack ./example.mrpack
minecraft-skills modrinth validate-pack ./example.mrpack --allow-download-host downloads.example.org
minecraft-skills modrinth validate-pack ./example.mrpack --max-archive-bytes 104857600
minecraft-skills server validate-properties ./server.properties --version 1.21.11
minecraft-skills player-profile lookup-name jeb_
minecraft-skills player-profile textures 853c80ef-3c37-49fd-aa49-938b674adae6
```

For intent-based discovery searches, translate non-English user wording into concise English
canonical Minecraft terms before passing the query. Keep exact identifiers, namespace IDs, file
paths, project titles, and content literals unchanged. Use the English terms only for the lookup and
keep the user's requested response language. The CLI does not expand language-specific aliases or
reject Unicode query values.

`player-profile lookup-name` and `player-profile textures` send the supplied Java name or UUID to
fixed Mojang services. They do not accept caller endpoints, headers, bodies, or cache paths and do
not write a disk cache or application log. Only `found` and `verified` return exit code 0; every
other structured JSON outcome returns 1.

The exact service paths and response shapes are derived from the official Minecraft 26.2 Authlib
9.0.75 artifact and are version-specific, undocumented behavior. `verified` means only that the
textures property signature and UUID/name binding passed. The 64-hex reference is extracted from
verified signed metadata; the returned canonical HTTPS URL is derived by placing that reference
into the fixed official URL shape and is not itself a signed string. Neither proves PNG bytes, a
content digest, freshness/current selection, account ownership, or a license. This profile command
does not download the PNG; pass a returned hash to the separate `player-texture download <hash>
--kind skin|cape|elytra --output <new.png>` command when bytes are needed. Skin layout inspection and
face cropping remain separate operations.

Registry comparisons emit entry and protocol ID changes only for registries indexed in both
versions. `outcome` reports whether the requested scope was fully, partially, or not comparable;
`excludedRegistries` contains bounded per-version coverage statuses. Protocol changes require
numeric IDs in both versions; null-to-number and number-to-null observations are not classified as
changes.

`minecraft analyze-log <file>` accepts a regular file or a symlink to a regular file, reads it from
one stable file handle, rejects a size/timestamp change during the read, and requires valid UTF-8.
The default ceilings are 2 MiB of UTF-8 input and 2 Mi decoded characters. `--max-input-bytes` and
every analysis option (`--max-characters`, `--max-lines`, `--max-line-characters`, `--max-events`,
`--max-exception-chains`, `--max-mixin-failures`, `--max-class-loading-failures`,
`--max-exception-depth`,
`--max-exception-entries`, `--max-stack-frames`, `--max-platforms`, `--max-artifacts`,
`--max-components`, `--max-text-characters`, and `--max-retained-text-characters`) may lower but
never raise the published Catalog limits. Output distinguishes primary, cause, and suppressed
branches; `deepestCause` follows only the explicit primary `Caused by` chain. Credentials, IP
addresses, absolute paths, ANSI/OSC controls, unsafe controls, bidi overrides, and malformed
Unicode are sanitized before parsing or retention. JAR, mod, and plugin labels remain evidence,
not attribution. `mixinFailures` records bounded facts from five explicit Mixin message shapes:
missing shadow targets, missing injection targets, failed injection checks, direct class loads from
a defined mixin package, and non-private static members. It does not identify responsibility or
validate mappings, refmaps, configuration, target bytecode, fixes, or runtime compatibility.
Explicit `NoClassDefFoundError` and `ClassNotFoundException` symbols are normalized
and grouped only within the same exception chain; they do not establish a dependency, classpath,
JAR content, shading decision, owner, fix, or root cause.

The Modrinth command uses the public v2 search API and supports `--category`, sorting with
`--index`, and pagination with `--offset` and `--limit` in addition to the filters shown above.

`resourcepack validate-png` reads one regular local file through a bounded handle and validates its
PNG signature, chunk framing, IHDR fields, method values, ordering, and scanned CRCs. It rejects
symlinks and special files. Lower the conservative limits with `--max-bytes`, `--max-width`,
`--max-height`, `--max-pixels`, `--max-chunks`, and `--max-diagnostics`.

`resourcepack inspect-png-alpha` reuses that stable regular-file reader and structural validation,
then boundedly decodes the static PNG image. Content is exactly a decoded alpha sample other than
zero. The JSON result contains alpha counts, zero-based half-open content bounds, and transparent
top/right/bottom/left margins; it contains no paths, pixels, or RGB samples and never modifies the
file. Use `--max-inflated-bytes` to lower the filtered-image byte ceiling. Optional
`--require-nonempty` and `--minimum-transparent-margin-pixels <n>` apply caller policy without
turning an unrequested empty image into an invalid PNG. Exit code 0 requires complete pixel
inspection and a policy status of `met` or `not-requested`; structurally invalid, indeterminate,
not-met, and not-checked results return exit code 1.

`datapack validate-project` recursively scans a stable regular local directory tree. It rejects
observed symbolic links and special entries, identity-binds every text-file handle, and aborts when
captured ancestor or entry identities change. Node does not expose openat-style relative directory
traversal, so callers handling a malicious local writer must quiesce the tree while validation runs.
The command validates safe paths, version-correct plural/singular directories, duplicate/case
collisions, root `pack.mcmeta`, version-aware file content, command-position function calls,
function and registry tags, advancement parents, and local tag/advancement cycles. It bounds files,
directory depth, paths, aggregate UTF-8 text, parsed JSON, graph work, and diagnostics. By default,
submitted namespaces are treated as a closed project so missing references fail. Use
`--allow-merged-namespace-dependencies` when another pack or mod may contribute to the same
namespace; unresolved dependencies then make `validationComplete` false. Schema-unavailable JSON,
macro-expanded commands, pack overlays, and unsupported graph kinds are likewise reported as
incomplete rather than guessed.

`resourcepack validate-project` recursively checks item-definition and legacy override model targets,
model parents, textures, inherited texture variables, `sounds.json` file/event references, and local
model and sound-event cycles against the project and target-version vanilla assets. Special
item-model base references are included. PNG files receive the same bounded structural validation,
while OGG files are read only through their strict 58-byte Ogg/Vorbis
identification page using exact bounded prefix reads from regular files. Full audio decoding is out
of scope. Stereo is accepted with a positional-attenuation warning; more than two channels is an
error. Unverified external sound references keep a warning-only project valid but set validation
completeness false. Directory traversal is iterative and applies file, directory-depth, path, and
aggregate JSON- and binary-byte limits before loading project content. Invalid graphs, PNG files,
or audio headers are printed as JSON and return exit code 1.

PNG validation follows the [W3C PNG specification](https://www.w3.org/TR/png-3/) but does not
decompress IDAT or prove rendered texture validity. It does not impose square, power-of-two, or a
fixed `pack.png` size.

`player-skin validate-layout` first applies the same bounded complete-PNG validation, then checks
Minecraft Java current 64x64 or legacy 64x32 layout and optional zero-based half-open base-face and
hat source rectangles. A PNG CRC, critical-chunk, truncation, or safety-limit error leaves layout
explicitly not checked and makes the command fail. The JSON validation result omits the input path
and does not decode pixels or validate alpha, legacy conversion output, or GUI rendering behavior.

`player-texture download` accepts one strict lowercase 64-hex texture reference, one
`skin|cape|elytra` kind, and one new exact-`.png` output path. The HTTPS host and path shape, request
headers, redirect policy, five-second timeout, identity encoding, and one-MiB response cap are
fixed. Existing files, links/reparse points, special paths, changed parents, and create races are
rejected without overwrite; partial writes are identity-gated for cleanup. Exit code 0 means both
bounded download validation and verified save succeeded. JSON never contains the output path,
downloaded byte array, or base64. It reports the requested reference and downloaded SHA-256 as
separate observations and does not claim signatures, provenance, identity, ownership, freshness,
or licensing.

`minecraft validate-access-list` infers the list kind from the four canonical vanilla filenames or
accepts an explicit `--kind whitelist|ops|banned-players|banned-ips`. It rejects symbolic links,
directories, and special files, then verifies a stable regular-file identity around the positioned
bounded read and requires strict UTF-8. Results never contain input identities, addresses, reasons,
sources, or local paths. Validation is offline; it does not resolve player names or verify UUID/IP
ownership.
Pass canonical UTC `--evaluated-at 2026-08-25T00:00:00.000Z` to reproduce ban-expiry
classification; otherwise the returned `evaluatedAt` records the instant chosen by the validator.
This checks canonical serializer output; because current loaders default some fields and clamp
operator levels, a validation error does not prove that the server will reject the file.
aggregate JSON-byte limits before loading project content. Invalid graphs or audio headers are
printed as JSON and return exit code 1.

`blockbench inspect-project` reads one stable regular UTF-8 `.bbmodel` file without following a
link. Repeat `--require-animation` and `--require-group` for exact case-sensitive requirements. It
returns exit code 0 only when the supported project layout was completely inspected and every
requested name is present; missing, unknown, unsafe, or invalid input returns 1. Output contains
bounded metadata/name evidence, not local paths, textures, embedded image data, or editor state.
It is not a complete `.bbmodel`, runtime-animation, rendering/export, plugin-format, or ModelEngine
validator. In particular, a group named `seat` proves only that exact group name.

`resourcepack validate-translations` reads only explicitly listed regular UTF-8 files. It rejects
symlink files, pack-root escapes, unstable file snapshots, malformed UTF-8, and aggregate input
bounds before Catalog analysis. Raw JSON duplicate-key evidence is preserved, while output omits
translation values and local paths. Repeat `--required-locale` to select comparisons; no discovered
locale is compared implicitly.

`resourcepack sound inspect` accepts exactly one lower-case `.wav` final regular file entry and
performs a bounded, identity-stable read. It prints RIFF/WAVE PCM or IEEE-float metadata, SHA-256,
duration, sample peak dBFS, unweighted sample RMS dBFS, and a factual full-scale sample count without
including the input path or bytes. It does not convert or normalize audio, measure LUFS, or prove
clipping or decoder compatibility. Invalid or incomplete inspections return exit code 1.

`modrinth versions` accepts a project ID or slug and optional `--featured` and
`--include-changelog` boolean filters.
`modrinth compatibility` accepts 2-10 project IDs or slugs and reports bounded common
game-version/loader metadata pairs plus the latest published concrete version for each project in
each pair. IDs and slugs are canonicalized before version filters, so aliases remain deduplicated
when no versions match. When a slug begins with `--`, place the option terminator `--` before it.
Common pairs are ordered by the least-recent latest candidate across all projects before bounded
output is applied. This is metadata compatibility, not proof of runtime interoperability.
`modrinth get` exposes the remaining common public read resources, including dependencies, version
and file-hash metadata, users, tags, and statistics.
`modrinth validate-pack` requires the `.mrpack` extension and a regular file. It bounds reads from
one opened file handle, rejecting oversized files and files whose size changes during the read,
then validates the index plus binary ZIP integrity offline. `--max-archive-bytes` can lower, but
never raise, the 512 MiB default. It does not
download or resolve referenced files. Downloads are restricted to Modrinth's documented four
hosts unless an exact host is repeated with `--allow-download-host`. An explicitly allowed
non-official host produces a warning. Invalid packs return exit code 1; warning-only packs return 0.

`plugin paper validate-jar` requires a regular, non-symlink `.jar` file and performs no network
requests. It opens the file with no-follow and nonblocking flags where the platform exposes them,
identity-checks the path and handle before and after a bounded read under a 64 MiB ceiling (which
`--max-archive-bytes` may only lower), and validates ZIP structure. It follows Paper's
`paper-plugin.yml`-first probing, checks only the active descriptor's CRC and bounded alias-free
YAML, and compares declared main/bootstrap/loader class paths with the complete JAR listing. An
archive-local class absence is a warning because external classloaders may supply it. The output
does not include descriptor values or class bytes. Errors return 1;
warnings and explicitly incomplete/experimental coverage do not by themselves make the artifact
invalid.

`plugin velocity validate-jar` applies the same regular-file, non-symlink, stable-read, 64 MiB
ceiling before bounded ZIP inspection. It checks root `velocity-plugin.json` integrity and current
structural fields, exact entrypoint class presence, bounded classfile identity, that entrypoint's
selected Java target (Java 25 by default), and runtime-visible `@Plugin` evidence. Other classfiles
are not target-scanned. Targets below the current Velocity 4 Java 25 floor are rejected; older
Velocity lines are not modeled. It does not resolve dependency
satisfaction, prove full JVM linkage or Guice injection, check classpath/API compatibility, load
Velocity, or establish runtime behavior or security. Annotation absence or mismatch is evidence,
not a claim about loader rejection. Errors return 1; warnings and explicit unknowns return 0.

`minecraft validate-mixin-config` reads one bounded, stable, non-symlink regular UTF-8 config file,
rechecking both the named path and opened descriptor before and after positioned reads. Optional
`--archive-entries` input is a JSON string array of logical paths from one supplied archive;
`--archive-entries-complete` defaults to `false` and cannot be claimed without that array. Raw config
text preserves duplicate-key evidence. Definitive config errors return exit code 1, while warnings
and unknown local-absence evidence remain valid and return 0. The command does not inspect the wider
runtime classpath, bytecode, targets, injection behavior, mappings, or launcher integration. See
[Mixin configuration validation](../../docs/MIXIN_CONFIG_VALIDATION.md).

`fabric toolchain` reads Loader, Intermediary, and Yarn candidates from the official live Fabric
Meta v2 API. It prefers upstream `stable` entries without treating that flag as a complete project
compatibility guarantee. Generated tuples only combine entries listed for the same game version;
they are not a separately published Fabric Meta guarantee. The command bounds returned candidates
and reports versions without Yarn as incomplete instead of guessing.

`minecraft search "Fabric Client GameTest visual evidence"` returns guidance for stable case IDs,
bounded readiness, full-frame and runtime-bounds crop evidence, explicit compare versus
baseline-update modes, and manifest reconciliation across selected or resumed cases. The records
use the existing `resourcepack` client-asset authoring domain. Search the matching scenario,
guardrail, diagnostic, intent, claim policy, and output requirement by kind for the complete
contract. The records distinguish non-render assertions, virtual-framebuffer client runs, and
interactive clients; concrete test APIs still require current official Fabric documentation and
target-version API or mappings.

`minecraft search "Fabric GUI scale clipping"` returns domain-neutral Fabric client UI guidance
without introducing a full Fabric authoring context. The recipe and guardrail prevent reapplying
GUI scale to an already-scaled viewport, keep draw, clip, and hit-test rectangles in one layout
result, and require pre-clip content bounds plus paired geometry and actual-render checks. Any
concrete Screen, window, drawing, input, or scissor API still requires current official Fabric
documentation and target-version mappings.

`velocity toolchain` reads the current `com.velocitypowered:velocity-api` version from bounded
official PaperMC Maven metadata and cross-checks the official development guide and Java FAQ. It
returns the repository, development docs, Javadocs, retrieval time, and per-source provenance.
Documentation drift or temporary docs failures become actionable warnings when Maven metadata is
still usable; missing or malformed Maven metadata fails the command. Candidate ordering is
deterministic and bounded by `--limit`. Velocity API/server versions are never used to infer
Minecraft game-version compatibility.

`server validate-properties` requires one regular `.properties` file (default:
`./server.properties`). It opens with no-follow/nonblocking flags where the host exposes them,
binds the handle to bigint path identity and timestamps before and after reading, enforces strict
UTF-8 and the Catalog byte ceiling, and performs no network access. Node does not expose
openat-style ancestor-relative traversal, so quiesce a tree that a malicious local writer can
replace concurrently. Output never contains property values. Java Properties syntax, Java-width
stable scalar checks, duplicate effective values, and file-local RCON/resource-pack correlations
are reported separately from unknown keys, target-version membership, runtime encoding, proxy
configuration, and fork behavior. Invalid or preflight-rejected files return exit code 1;
warning-only files return 0.

`fabric validate-mod` requires one regular local `.jar` file. It checks the configured byte ceiling
before allocation and verifies the same file identity, size, and timestamps before and after the
read. `--max-archive-bytes` can lower but never raise the 256 MiB default. Validation checks
bounded structural rules for current `fabric.mod.json` schema v1, portable JAR paths, ZIP bounds,
and referenced-file presence; invalid results return exit code 1. It does not validate dependency
predicates or satisfaction, entrypoint classes or runtime loading, mixin/access-widener syntax,
nested JAR metadata, or icon pixels.

`fabric mods inventory <directory>` scans no subdirectories and selects only direct entries whose
basenames end in exact lowercase `.jar`; `.JAR` and nested JARs are ignored. The root must be a
direct directory, and JAR candidates must be regular files rather than symbolic links, directory
junctions, directories, or special entries. After a bounded entry scan, candidates are sorted by
basename and read one at a time with stable identity, size, and timestamp checks. Results contain
no absolute input path, archive bytes/base64, or operating-system error details. Each retained entry
reports its basename, byte length, SHA-256, Fabric mod ID/version/environment, and binary
validation strength, validity, and error/warning counts. Duplicate declared mod IDs are reported
as facts. Invalid, rejected, duplicate, or incomplete inventories return exit code 1.

The inventory hard ceilings are 10,000 direct entries, 512 JAR candidates, 256 MiB per JAR, 1 GiB
of `accountedJarBytes`, 200 retained scan diagnostics, and 100 retained duplicate-ID groups. Entry
or JAR-count overflow discards the incomplete candidate selection; the complete bounded candidate
set is otherwise sorted before the total-byte ceiling is applied. Lower internal test/library
limits cannot raise these public ceilings.

`fabric mods diff <left> <right>` inventories both directories and pairs only unique, valid,
non-null mod IDs. It reports additions, removals, and version, environment, SHA-256,
validation-status, and filename changes. Duplicate IDs or identified invalid entries go to
`ambiguous`; rejected or missing-ID entries go to `unidentified`, so neither is arbitrarily paired.
`comparisonComplete` requires both scans to complete without ambiguous or unidentified entries;
`hasDifferences` covers reported added, removed, or changed pairs among retained pairable entries.
When a scan is incomplete, additions and removals are not a complete directory comparison; use
`comparisonComplete` as that completeness guard. A difference, ambiguity, unidentified entry, or
incomplete scan returns exit code 1; a complete identical comparison returns 0.

These commands do not resolve dependency graphs or load order; prove Minecraft-version
compatibility, authenticity, Modrinth origin, or runtime startup; or download, update, or delete
files.

`minecraft support-matrix` shows the latest bundled aliases and which generated surfaces are bundled or
downloadable. `data manifest`, `data cache-dir`, `data cache-list`, `data cache-clean`, and
`data fetch` manage SHA-256 verified heavyweight data in the local OS cache.
`datapack context [version]`, `resourcepack context [version]`, or `plugin paper context [version]` returns preflight, recipes, scenarios, guardrails,
diagnostics, intent lookup routing, and evidence in one payload for starting an authoring task.
`datapack recipes`, `resourcepack recipes`, or `plugin paper recipes` lists ordered workflows for common authoring tasks.
`plugin paper search-scenarios <query>` searches existing scenario, recipe, and intent text so an
agent can route task wording to a scenario without inventing one.
`datapack scenarios`, `resourcepack scenarios`, or `plugin paper scenarios` lists realistic task shapes and required lookup IDs for evaluation.
`datapack plan <scenario-id> [version]`, `resourcepack plan <scenario-id> [version]`, or `plugin paper plan <scenario-id> [version]` resolves one scenario into the exact recipes, intent
lookups, diagnostics, claim policies, fact surfaces, response patterns, and optional evidence to use.
`datapack guardrails`, `resourcepack guardrails`, or `plugin paper guardrails` lists output rules and required evidence that prevent unsupported claims.
`datapack diagnostics`, `resourcepack diagnostics`, or `plugin paper diagnostics` lists pass/fail checks to run before returning generated files, code, or
source-backed answers.
`datapack claim-policies`, `resourcepack claim-policies`, or `plugin paper claim-policies` maps claim types to required evidence plus allowed and disallowed wording.
`datapack output-requirements`, `resourcepack output-requirements`, or `plugin paper output-requirements` lists final-answer and generated-file checks for one authoring
domain.
`datapack response-patterns`, `resourcepack response-patterns`, or `plugin paper response-patterns` lists source-backed answer shapes for verified facts, missing evidence, and
safe gap wording.
`datapack preflight [version]`, `resourcepack preflight [version]`, or `plugin paper preflight [version]` returns resolved version coverage, the domain checklist,
fact surfaces, relevant downloadable data, and warnings. `datapack checklist`, `resourcepack checklist`, or `plugin paper checklist` returns
only the pre-generation checks an AI agent should perform before writing files or code.
`datapack fact-surfaces`, `resourcepack fact-surfaces`, or `plugin paper fact-surfaces` explains what each machine-verifiable data surface can and cannot prove.
`minecraft support` lists per-version coverage and surface availability for choosing a target version.
`datapack evidence [version]`, `resourcepack evidence [version]`, or `plugin paper evidence [version]` returns source policy, source URLs, relevant data files, and
warnings for provenance-aware answers. `source report [domain] [version]` returns source tiers,
prohibited automation, structured community datasets, and optional domain/version provenance.
`source datasets` lists recommended structured community datasets such as PrismarineJS and
misode/mcmeta.
`datapack intents`, `resourcepack intents`, or `plugin paper intents` maps authoring intents to the exact CLI commands and evidence surfaces
an agent should inspect before answering.

`datapack vanilla-json status|fetch|files|get|search|clean` manages and searches exact vanilla
`data/**/*.json` files from the cached official Mojang server jar. `search` matches parsed JSON keys
or primitive values and reports incomplete scans instead of silently treating resource limits as no
matches. `clean [version]` removes a stale cached server jar.

`plugin paper plan paper-administrative-command-operability-review [version]` resolves generic
administrative-command checks for operational coverage, explicit support or rejection for every
applicable sender kind, explicit targets, permissions, protected secret input, justified safe
out-of-band alternatives, bulk confirmation, atomic reload rollback, effective-state inspection,
and observable success or failure results.

`plugin paper plan paper-itemstack-semantic-identity-review [version]` separates a stable
namespaced logical item ID and schema version from mutable names, lore, models, Material, similarity,
and rendering. It routes updates through an owned copy and a closed presentation allowlist,
preserves all other gameplay, PDC, component, and subtype state, leaves unknown items untouched,
and requires deterministic idempotent migrations with duplicate-lore, rollback, aliasing,
comparison-purpose, and unrelated-state preservation tests.

`plugin paper plan paper-plugin-configuration-lifecycle-review [version]` separates packaged
defaults, operator input, generated state, immutable effective snapshots, and derived resources. It
requires validated startup readiness, revisioned prepare/commit/retire reloads, last-known-good
preservation, explicit restart or degraded outcomes, conflict-safe writes, generation-fenced
consumers, redacted status, disable cleanup, and deterministic plus loaded-server lifecycle tests.

`plugin paper plan paper-plugin-testing-evidence-review [version]` maps runtime claims to pure
tests, plugin-owned fakes, explicitly supported MockBukkit behavior, a loaded target-version Paper
server, or client-visible evidence. It also requires controlled time and task ordering, lifecycle
and stale-completion cases, isolated cleanup, exact commands and versions, known baselines, and an
explicit list of skipped, unavailable, or manual checks.

## Performance Time-Series Analysis

`minecraft analyze-performance <file>` accepts a regular, final non-symlink UTF-8 JSON file with
2-10,000 strictly ordered canonical UTC samples. Each sample may contain only `timestamp` and the
normalized `tps`, `mspt`, `cpuPercent`, `heapUsedBytes`, `loadedChunks`, `entities`, `players`, or
`gcPauseMs` metrics. Player names, UUIDs, coordinates, hosts, and source labels are not accepted.

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

Only Paper's [20 TPS target and 50 ms tick budget](https://docs.papermc.io/paper/reference/commands/)
are default thresholds. Other thresholds must be explicit. Output includes missing-data coverage,
min/p50/p95/max, bounded violation intervals, trends, optional before/after summaries, and
exact-timestamp MSPT associations when there are at least ten aligned non-constant observations.
These are descriptive candidate signals, not causal or statistically significant conclusions. A
violation recommends only a scoped spark capture following Paper's
[profiling guidance](https://docs.papermc.io/paper/profiling/).

The CLI checks the 4 MiB UTF-8 byte and 4,194,304 UTF-16-code-unit ceilings before analysis and
rejects path or same-handle identity changes during positioned reads, malformed UTF-8, duplicate
JSON object keys, more than 16 nested containers, or more than `12 * maxSamples + 256` JSON value
nodes before parsing. Invalid or insufficient input and threshold violations exit 1. Only an
analyzed result with no violations exits 0.

## Data Sources

Bundled facts come from Mojang version metadata and downloads served through Piston endpoints,
extracted official client/server jars, PaperMC API and docs, structured community datasets, and the
`sya-ri/spigot-event-list` API contract. Minecraft Wiki is human-only background; AI workflows
should not fetch, crawl, summarize, or cite Wiki pages.
