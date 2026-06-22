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
- Start from a known task shape with `datapack plan`, `resourcepack plan`, or `plugin paper plan` to
  resolve a scenario into the exact recipes, intent lookups, diagnostics, claim policies, fact
  surfaces, and response patterns an agent should use.

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

minecraft-skills plugin paper context 1.21.11
minecraft-skills plugin paper recipes
minecraft-skills plugin paper recipe paper-event-listener
minecraft-skills plugin paper search-scenarios "Paper event listener"
minecraft-skills plugin paper scenarios
minecraft-skills plugin paper scenario paper-event-listener-review
minecraft-skills plugin paper plan paper-event-listener-review 1.21.11
minecraft-skills plugin paper preflight 1.21.11
minecraft-skills plugin paper evidence 1.21.11
minecraft-skills plugin paper intents
minecraft-skills plugin paper fact-surfaces
minecraft-skills plugin paper claim-policies
minecraft-skills plugin paper diagnostics
minecraft-skills plugin paper output-requirements
minecraft-skills plugin paper response-patterns

minecraft-skills minecraft support --domain paper-plugin
minecraft-skills data manifest
minecraft-skills data fetch paper-api-surface --version 1.21.11
```

Data pack lookups:

```sh
minecraft-skills minecraft show 26.2
minecraft-skills minecraft pack-formats
minecraft-skills datapack commands 26.2 --prefix execute --contains run
minecraft-skills datapack compare-commands 1.20.6 1.21 --prefix attribute
minecraft-skills datapack schema 26.2
minecraft-skills datapack search-schema 26.2 --kind advancement --contains criteria
minecraft-skills datapack compare-schema 26.2 26.2 --kind advancement
minecraft-skills datapack vanilla-paths 26.2 --contains recipe
```

Resource pack lookups:

```sh
minecraft-skills resourcepack vanilla-paths 26.2 --contains models/block/acacia_button
minecraft-skills resourcepack compare-vanilla-paths 1.20.6 1.21 --prefix assets/minecraft/models/item/
minecraft-skills resourcepack models 26.2
minecraft-skills resourcepack search-models 26.2 --kind item-definition --contains bundle
```

Paper plugin lookups:

```sh
minecraft-skills plugin paper info
minecraft-skills plugin paper api 1.21.11
minecraft-skills plugin paper api-index 1.21.11
minecraft-skills plugin paper api-surface 1.21.11
minecraft-skills plugin paper types 1.21.11 --contains org.bukkit.entity.Player
minecraft-skills plugin paper members 1.21.11 --type org.bukkit.entity.Player --contains sendMessage
minecraft-skills plugin paper compare-api 1.20.4 1.21.11
minecraft-skills plugin paper compare-api-surface 1.21.11 1.21.11
minecraft-skills plugin paper events "player join" --version 1.21.11
```

Paper API package indexes are available for every bundled Paper-supported Minecraft version from
1.13 onward. Type/member API surfaces use the modern Javadocs `type-search-index.js` and
`member-search-index.js` files when present. Older Javadocs that do not expose those files are
covered with legacy `allclasses-noframe.html` and `index-all.html` extraction. These surfaces still
prove name presence only; they do not prove runtime behavior, nullability, overload semantics, or
thread safety.

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

The server exposes the same catalog as tools, resources, and prompts. Prompts:

- `use_minecraft_datapacks`
- `use_minecraft_resourcepacks`
- `use_minecraft_paper_plugins`

Skill and data resources are exposed under:

- `minecraft-skills://skills/<skill>/...`
- `minecraft-skills://data/...`

## Package API

Use `@minecraft-skills/catalog` for validated data access:

```ts
import {
  getAuthoringContext,
  getAuthoringDiagnostic,
  getAuthoringPlan,
  getAuthoringRecipe,
  getAuthoringScenario,
  getClaimPolicy,
  getOutputRequirement,
  getResponsePattern,
  searchAuthoringScenarios,
  searchCommands,
  searchPaperMembers,
  searchVanillaPaths,
} from "@minecraft-skills/catalog";

const context = getAuthoringContext({ domain: "paper-plugin", version: "1.21.11" });
const diagnostic = getAuthoringDiagnostic("paper-api-member-unverified");
const recipe = getAuthoringRecipe("paper-event-listener");
const scenario = getAuthoringScenario("paper-event-listener-review");
const matchingScenarios = searchAuthoringScenarios({
  query: "Paper event listener",
  domain: "paper-plugin",
});
const plan = getAuthoringPlan({ scenario: "paper-event-listener-review", version: "1.21.11" });
const claimPolicy = getClaimPolicy("paper-type-or-member-exists");
const outputRequirement = getOutputRequirement("paper-plugin-output-safety");
const responsePattern = getResponsePattern("paper-api-answer");

const commandMatches = searchCommands({ version: "26.2", prefix: "execute", limit: 10 });
const assetMatches = searchVanillaPaths({
  version: "26.2",
  domain: "resourcepack",
  contains: "models/item",
});
const playerMembers = searchPaperMembers({
  version: "1.21.11",
  type: "org.bukkit.entity.Player",
  contains: "sendMessage",
});
```

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
Cache defaults:

- macOS: `~/Library/Caches/minecraft-skills`
- Linux: `${XDG_CACHE_HOME:-~/.cache}/minecraft-skills`
- Windows: `%LOCALAPPDATA%\minecraft-skills\Cache`

Set `MINECRAFT_SKILLS_CACHE_DIR` to override the location.
