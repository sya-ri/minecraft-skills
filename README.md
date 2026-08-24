# minecraft-skills

[![npm](https://img.shields.io/npm/v/minecraft-skills.svg)](https://www.npmjs.com/package/minecraft-skills)
[![npm data](https://img.shields.io/npm/v/%40minecraft-skills%2Fdata.svg?label=%40minecraft-skills%2Fdata)](https://www.npmjs.com/package/@minecraft-skills/data)
[![npm catalog](https://img.shields.io/npm/v/%40minecraft-skills%2Fcatalog.svg?label=%40minecraft-skills%2Fcatalog)](https://www.npmjs.com/package/@minecraft-skills/catalog)
[![npm rcon](https://img.shields.io/npm/v/%40minecraft-skills%2Frcon.svg?label=%40minecraft-skills%2Frcon)](https://www.npmjs.com/package/@minecraft-skills/rcon)
[![npm mcp](https://img.shields.io/npm/v/%40minecraft-skills%2Fmcp.svg?label=%40minecraft-skills%2Fmcp)](https://www.npmjs.com/package/@minecraft-skills/mcp)

Minecraft authoring facts, Agent Skills, CLI, and MCP tools for AI agents that create or review
Java data packs, Java resource packs, and Paper plugins.

The project helps AI check real versioned data before it writes code or pack files. It provides:

- Skill folders for datapack, resourcepack, and Paper plugin authoring.
- CLI/API/MCP lookups for versions, pack formats, commands, registry entries, vanilla paths,
  JSON/model shapes, Paper API indexes, and Paper events.
- Authoring guidance for what to verify, what evidence is required, and how to phrase unknowns.
- Bundled Java 1.13+ data, with cache downloads for heavier generated surfaces.

## Start Here

For AI clients that support MCP, start with the MCP server. It exposes the versioned data, authoring
contexts, prompts, and lookup tools directly to the agent:

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

Then add the Agent Skill folders when your AI tool supports external skills. Use the installer
syntax for your tool, and point it at one or more of these repository folders:

- `skills/minecraft-datapacks`
- `skills/minecraft-resourcepacks`
- `skills/minecraft-paper-plugins`

Install and run manually:

```sh
npx minecraft-skills minecraft latest
npx -y @minecraft-skills/mcp
```

Useful first commands:

```sh
minecraft-skills plugin paper context 26.2
minecraft-skills plugin paper search "event listener" --kind authoring-recipe
minecraft-skills plugin paper search-scenarios "Paper event listener"
minecraft-skills plugin paper plan paper-event-listener-review 26.2
minecraft-skills plugin paper search-scenarios "full inventory reward leftovers"
minecraft-skills plugin paper plan paper-item-delivery-review 1.21.11
minecraft-skills plugin paper search-scenarios "inventory GUI shift-click drag"
minecraft-skills plugin paper plan paper-inventory-gui-interaction-review 1.21.11
minecraft-skills plugin paper plan paper-administrative-command-operability-review 26.2
minecraft-skills plugin paper plan paper-player-identity-and-display-review 1.21.11
minecraft-skills plugin paper search "custom payload RPC codec" --kind authoring-recipe
minecraft-skills plugin paper plan paper-plugin-protocol-safety-review 1.21.11
minecraft-skills plugin paper plan paper-player-session-lifecycle-review 1.21.11
minecraft-skills plugin paper plan paper-plugin-testing-evidence-review 1.21.11
minecraft-skills minecraft search-all "bundle item model" --domain resourcepack
minecraft-skills minecraft suggest-lookups "migrate resource pack item model" --domain resourcepack
minecraft-skills minecraft explain-path 26.2 assets/example/items/widget.json --domain resourcepack
minecraft-skills datapack recipes
minecraft-skills datapack find execute
minecraft-skills datapack classify-files data/example/advancement/root.json
minecraft-skills datapack migration-plan 1.20.6 1.21 data/example/advancement/root.json
minecraft-skills minecraft pack-format 26.2 datapack
minecraft-skills minecraft versions-for-pack-format resourcepack 88
minecraft-skills datapack commands 26.2 --prefix execute
minecraft-skills minecraft registry-entries 26.2 --registry minecraft:item --exact minecraft:stone
minecraft-skills minecraft compare-registry-entries 26.1.2 26.2 --registry minecraft:block
minecraft-skills resourcepack vanilla-paths 26.2 --contains models/item
minecraft-skills datapack vanilla-json fetch 26.2
minecraft-skills datapack vanilla-json search minecraft:diamond --version 26.2 --kind recipe
minecraft-skills datapack vanilla-json clean 26.2
minecraft-skills resourcepack assets find "diamond sword" --kind item-definition
minecraft-skills resourcepack assets search 26.2 --contains models/item --fetch
minecraft-skills resourcepack assets get 26.2 assets/minecraft/models/item/diamond_sword.json
minecraft-skills resourcepack file-schema 26.2 assets/example/items/widget.json
minecraft-skills resourcepack inspect-png-alpha ./assets/example/textures/item/widget.png --require-nonempty --minimum-transparent-margin-pixels 1
minecraft-skills resourcepack validate-png ./pack.png
minecraft-skills resourcepack validate-project 26.2 ./my-resource-pack
minecraft-skills player-skin validate-layout ./skin.png --base-rect 8,8,8,8 --hat-rect 40,8,8,8
minecraft-skills player-texture download 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef --kind skin --output ./skin.png
minecraft-skills plugin paper members 26.2 --type org.bukkit.entity.Player --contains sendMessage
minecraft-skills fabric toolchain 1.21.11
minecraft-skills velocity toolchain
minecraft-skills modrinth search "voice chat" --version 1.21.11 --type mod --loader fabric
minecraft-skills modrinth versions simple-voice-chat --game-version 1.21.11 --loader fabric
minecraft-skills modrinth compatibility sodium iris --game-version 1.21.11 --loader fabric
minecraft-skills modrinth get project simple-voice-chat
minecraft-skills modrinth validate-pack ./example.mrpack
```

For intent-based discovery, translate non-English user wording into concise English canonical
Minecraft terms before calling search commands or MCP tools. Keep exact identifiers, namespace
IDs, file paths, project titles, and content literals unchanged. Translation belongs in the caller;
use the English terms only for the lookup and keep the user's requested response language.
minecraft-skills does not expand language-specific aliases or reject Unicode query values.

`resourcepack validate-project` also validates `sounds.json` file/event references and local event
cycles. OGG inspection is intentionally bounded to the strict 58-byte Ogg/Vorbis identification
page; it does not fully decode audio. Stereo produces a positional warning, channel counts above two
are rejected, and unverified external sound references are surfaced through completeness metadata.
Complete PNG bytes are checked for bounded container structure, IHDR fields, and scanned chunk CRCs
without decompressing IDAT or claiming rendered-texture validity. File/content/graph/diagnostic work
is bounded, including a shared aggregate binary budget, and the result reports applied limits and
omitted diagnostic counts.

`resourcepack inspect-png-alpha` additionally decodes one bounded static PNG and reports nonzero-
alpha pixel counts, zero-based half-open content bounds, and transparent margins. It never crops or
rewrites the file and does not return paths, pixels, or RGB samples. Empty content is a valid fact;
it fails only when `--require-nonempty` or another requested policy is not met.

`player-skin validate-layout` composes that bounded PNG structural result with audited Minecraft
Java player-skin layout rules. It accepts current 64x64 and legacy 64x32 sources and checks optional
zero-based half-open face `(8,8,8,8)` and hat `(40,8,8,8)` rectangles. Layout remains explicitly
not checked whenever PNG structure is invalid. Pixel/alpha decoding, legacy conversion output, and
GUI scaling, filtering, blending, clipping, or scissor behavior remain outside its claims.

`player-texture download` accepts only a lowercase 64-hex texture reference and a closed
`skin|cape|elytra` kind. It constructs the fixed `https://textures.minecraft.net/texture/<hash>`
request internally, rejects redirects or non-PNG/encoded/oversized responses, and writes only a
new exact-`.png` regular file with exclusive creation. Success JSON omits downloaded bytes and the
filesystem path. The reference hash and downloaded SHA-256 are separate evidence; neither proves
profile signatures, provenance, ownership, freshness, or licensing.

`paper-plugin-testing-evidence-review` builds a claim-to-observation test plan. It distinguishes
pure logic and owned test doubles from MockBukkit-supported behavior, loaded target-version Paper
evidence, and client-visible checks. The guidance rejects compilation-only runtime claims,
nondeterministic wall-clock waits, silent stubs for unsupported harness behavior, and conclusions
that omit exact commands, versions, skipped checks, known baselines, or remaining manual work.

Registry comparisons report entry and protocol ID changes only where both versions have an official
entry index; protocol changes require numeric IDs on both sides. `outcome` and bounded
`excludedRegistries` fields expose partial coverage, while null-to-number observations are not
classified as protocol changes.

For the full CLI, MCP tools, package API, cache behavior, and authoring workflows, see
[docs/USAGE.md](docs/USAGE.md). Version-by-version coverage is summarized in
[docs/VERSION_SUPPORT.md](docs/VERSION_SUPPORT.md).
RCON setup and permission presets are documented in [docs/RCON.md](docs/RCON.md).

Release notes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Source Policy

Primary support starts at Java Edition 1.13. Redistributable facts should come from official Mojang
metadata and downloads served through Piston endpoints, extracted vanilla client/server data,
PaperMC API artifacts, Maven metadata, and docs, official live Fabric Meta version metadata,
structured community datasets, the `sya-ri/spigot-event-list` API contract, or reviewed original
guidance.

Minecraft Wiki is human-only background for this project. AI workflows should not fetch, crawl,
summarize, or cite Wiki pages; use bundled data, Mojang/Paper sources, source reports, and allowed
structured datasets instead.

See [Source Strategy](docs/SOURCE_STRATEGY.md) for source tiers, community structured datasets, and
validation rules.

## Packages

- `packages/data`: canonical versioned JSON/text data, publishable as `@minecraft-skills/data`.
- `packages/catalog`: ArkType-validated read APIs, publishable as `@minecraft-skills/catalog`.
- `packages/rcon`: RCON config, permission, and execution utilities, publishable as
  `@minecraft-skills/rcon`.
- `packages/cli`: public CLI, publishable as `minecraft-skills`.
- `packages/mcp`: MCP server, publishable as `@minecraft-skills/mcp`.
- `packages/maintainer`: private maintainer validation and generation tooling.

## Development

This repository uses mise, pnpm workspaces, TypeScript, ArkType, tsdown, tsgo, Vitest, Biome, and
sherif.

```sh
mise trust
mise install
mise exec -- pnpm install
CI=true mise exec -- pnpm run check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for maintainer workflows, release checks, and data
regeneration commands.
