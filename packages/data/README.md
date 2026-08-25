# @minecraft-skills/data

Redistributable canonical data for Minecraft Skills consumers.

## Contents

- Java 1.13+ release index and version details.
- Machine-readable authoring checklists for pre-generation AI validation.
- Machine-readable authoring recipes for ordered common-task lookup workflows.
- Machine-readable authoring scenarios for realistic task evaluation and self-review.
- Machine-readable authoring guardrails for output safety.
- Machine-readable authoring diagnostics for pre-finalization pass/fail checks.
- Paper scheduled-task lifecycle guidance for task ownership, lifecycle generations, execution
  contexts, cancellation fences, plugin teardown, external-resource cleanup, and runtime evidence.
- Paper event-listener execution guidance for priority ordering, prior cancellation,
  `ignoreCancelled`, MONITOR observation, asynchronous dispatch, registration ownership, and
  in-flight teardown behavior.
- Paper player-session lifecycle guidance for connection generations, idempotent teardown,
  stale-callback fences, bounded durable flushes, reconciliation, and leak observability.
- Paper BossBar audience-lifecycle guidance for owner generations, explicit viewer gates, stable
  arbitration with hysteresis, add/remove set reconciliation, bounded revisioned updates, and
  terminal cleanup across replacement, reconnect, transfer, and disable.
- Paper PersistentDataContainer contract guidance for NamespacedKey ownership, exact primitive and
  complex types, bounded payloads, holder publication and transfer, copy/remove semantics,
  failure-safe schema migrations, foreign-key preservation, and runtime persistence evidence.
- Paper display and Interaction entity contract guidance for shared local-space layout, independent
  visual and hit-target semantics, input-unavailable pending hit targets, registered pair
  publication, bounded reconciliation, event deduplication, explicit cleanup, and client-visible
  alignment evidence.
- Paper high-frequency persistence guidance for measured write-path selection, bounded per-key
  delta coalescing, exact partial-flush accounting, verified whole-transaction retries, shutdown
  recovery, and real-adapter contention evidence.
- Paper item-delivery safety entries for partial insertion, explicit overflow handling, and
  target-version API verification.
- Paper custom inventory GUI safety entries for default-deny interactions, supported cursor
  mutation, close-handler deferral, session ownership, and exactly-once editable-slot settlement.
- Generic Paper administrative-command guidance for operation coverage, sender and target models,
  permissions, protected secret input, justified safe out-of-band alternatives, bulk scope,
  atomic reload rollback, observability, recovery, and failure tests.
- Paper player identity and display guidance for stable persistence, offline resolution, explicit
  presentation sources, bounded profile lookup, and cross-server cache convergence.
- Paper ItemStack semantic-identity guidance for namespaced logical IDs, separate schema versions,
  purpose-specific similarity decisions, owned presentation refresh, state-preserving idempotent
  migration, unknown-item pass-through, and duplicate-lore or rollback tests.
- Paper plugin testing-evidence guidance that maps pure tests, owned fakes, MockBukkit, loaded
  target-version Paper servers, and client-visible verification to bounded runtime claims.
- Paper custom-recipe lifecycle guidance for stable plugin-owned keys, owned-key reconciliation,
  observed registry mutation results, partial recovery, ingredient identity, shaped/shapeless
  collision detection, and independent client resend and recipe-book discovery policies.
- Paper attribute and effect ownership guidance for stable modifier keys, owned-only ItemMeta and
  AttributeInstance reconciliation, preserved vanilla defaults and foreign state, explicit
  potion-type collisions, safe capacity clamping, and lifecycle regression evidence.
- Paper and Model Engine runtime-binding guidance for exact artifact and identifier evidence,
  fail-closed carrier attachment, animation-channel ownership, generation replacement, and
  loaded-server plus paired-client verification.
- Machine-readable claim policies for evidence-bounded wording.
- Machine-readable output requirements for final-answer and generated-file checks.
- Machine-readable response patterns for verified facts, missing evidence, and gap wording.
- Machine-readable fact surface guidance that states what each data surface can and cannot prove.
- Extracted data/resource pack format numbers.
- Official server report summaries, command path indexes, and registry entry TSV indexes.
- Vanilla client asset and server data inventories.
- Downloadable vanilla resource pack model and item definition JSON shape summaries.
- Packaged Agent Skill payloads under `skills/`, mirrored from the repository root skill folders.
- PaperMC support metadata, per-version Paper build summaries, Paper docs source links, and
  `sya-ri/spigot-event-list` API contract metadata.
- Paper Javadocs package indexes for Paper versions where package tables or search indexes are
  available.
- Download manifest metadata for heavyweight generated datapack schema surfaces, Paper API
  surfaces, and resourcepack model summaries that can be fetched into an OS cache with SHA-256
  verification.
- Optional `InventivetalentDev/minecraft-assets` resource pack asset cache helpers for one-file
  fetches, version path indexes, and version archive references.

## Use

Most consumers should use `@minecraft-skills/catalog`, which validates these files and exposes
stable read APIs. This package is useful when an agent or tool needs direct access to the underlying
JSON/text data files.

`java/registry-entries/<version>.tsv` uses the stable columns `registry_id`, `entry_id`, and
`entry_protocol_id`. A blank protocol column means the official generated report did not record
one. The companion server report summary distinguishes indexed registries, known but unindexed
registries, and versions where an official registry report was unavailable.

```ts
import {
  cleanMojangServerJar,
  fetchData,
  fetchMinecraftAssetFile,
  fetchMinecraftAssetsIndex,
  getDataManifest,
  scanCachedMojangServerJarText,
  searchMinecraftAssets,
  readDataJson,
  readDataText,
} from "@minecraft-skills/data";

const versions = readDataJson("java/versions.json");
const checklists = readDataJson("authoring-checklists.json");
const recipes = readDataJson("authoring-recipes.json");
const scenarios = readDataJson("authoring-scenarios.json");
const guardrails = readDataJson("authoring-guardrails.json");
const diagnostics = readDataJson("authoring-diagnostics.json");
const claimPolicies = readDataJson("claim-policies.json");
const outputRequirements = readDataJson("output-requirements.json");
const responsePatterns = readDataJson("response-patterns.json");
const factSurfaces = readDataJson("fact-surfaces.json");
const intentLookups = readDataJson("intent-lookups.json");
const commandPaths = readDataText("java/command-paths/26.2.txt");
const registryEntries = readDataText("java/registry-entries/26.2.tsv");
const paperSkill = readDataText("skills/minecraft-paper-plugins/SKILL.md");
const manifest = getDataManifest();
await fetchData({ kind: "paper-api-surface", version: "26.2" });
await fetchMinecraftAssetsIndex({ version: "26.2" });
const assets = searchMinecraftAssets({ version: "26.2", contains: "diamond_sword" });
await fetchMinecraftAssetFile({
  version: "26.2",
  path: "assets/minecraft/models/item/diamond_sword.json",
});
const vanillaJson = scanCachedMojangServerJarText("26.2", {
  include: (entry) => entry.path.startsWith("data/") && entry.path.endsWith(".json"),
});
const cleaned = cleanMojangServerJar("26.2");
```

Downloaded data is cached under the platform cache directory for the manifest data version. Set
`MINECRAFT_SKILLS_CACHE_DIR` to override that location.
External resource pack asset references are cached under `minecraft-assets/<version>` in the same
cache root.
`scanCachedMojangServerJarText` reads a cached server jar from disk once, validates ZIP metadata and
entry checksums, extracts selected text entries in one bounded batch, and applies entry-count,
per-entry, and total-byte limits. For modern Mojang bundler jars, `META-INF/versions.list` selects the
exact versioned nested server payload and its declared SHA-256 is verified before entries are listed
or read. Exact text reads are limited to 2 MiB. `cleanMojangServerJar` removes one stale cache entry.

`openZipArchive`, `listZipEntries`, `readZipEntry`, and `readZipEntries` expose the same bounded ZIP
reader for higher-level artifact validators. It rejects ZIP64, encrypted or unsupported flags,
duplicate names, inconsistent central/local metadata, overlapping records, malformed data
descriptors, oversized names, unsupported compression, and CRC/expanded-size mismatches. Only
requested entries are expanded; callers must apply concern-specific archive, entry-count, and
expanded-byte ceilings before reading untrusted content.

Minecraft Wiki prose is not redistributed in this package, and Wiki pages are not AI-fetchable
sources for minecraft-skills workflows.
