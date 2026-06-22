# Usage

This page is the practical reference for the public CLI, MCP server, package APIs, and bundled
Agent Skill folders.

## CLI

Install/run after publishing:

```sh
npx minecraft-skills latest
```

Common entrypoints:

```sh
minecraft-skills latest
minecraft-skills skills
minecraft-skills skill minecraft-paper-plugins
minecraft-skills write-skill minecraft-paper-plugins --output ./skills

minecraft-skills authoring-context paper-plugin 1.21.11
minecraft-skills authoring-recipes --domain paper-plugin
minecraft-skills authoring-recipe paper-event-listener
minecraft-skills authoring-scenarios --domain paper-plugin
minecraft-skills authoring-scenario paper-event-listener-review
minecraft-skills preflight paper-plugin 1.21.11
minecraft-skills evidence paper-plugin 1.21.11
minecraft-skills intent-lookups --domain paper-plugin
minecraft-skills fact-surfaces --domain paper-plugin
minecraft-skills claim-policies --domain paper-plugin
minecraft-skills authoring-diagnostics --domain paper-plugin
minecraft-skills output-requirements --domain paper-plugin
minecraft-skills response-patterns --domain paper-plugin

minecraft-skills version-support --domain paper-plugin
minecraft-skills data-manifest
minecraft-skills fetch-data paper-api-surface --version 1.21.11
```

Data pack lookups:

```sh
minecraft-skills show-version 26.2
minecraft-skills pack-formats
minecraft-skills commands 26.2 --prefix execute --contains run
minecraft-skills compare-commands 1.20.6 1.21 --prefix attribute
minecraft-skills datapack-schema 26.2
minecraft-skills search-datapack-schema 26.2 --kind advancement --contains criteria
minecraft-skills compare-datapack-schema 26.2 26.2 --kind advancement
minecraft-skills vanilla-paths 26.2 --domain datapack --contains recipe
```

Resource pack lookups:

```sh
minecraft-skills vanilla-paths 26.2 --domain resourcepack --contains models/block/acacia_button
minecraft-skills compare-vanilla-paths 1.20.6 1.21 --domain resourcepack --prefix assets/minecraft/models/item/
minecraft-skills resourcepack-models 26.2
minecraft-skills search-models 26.2 --kind item-definition --contains bundle
```

Paper plugin lookups:

```sh
minecraft-skills paper
minecraft-skills paper-api 1.21.11
minecraft-skills paper-api-index 1.21.11
minecraft-skills paper-api-surface 1.21.11
minecraft-skills paper-types 1.21.11 --contains org.bukkit.entity.Player
minecraft-skills paper-members 1.21.11 --type org.bukkit.entity.Player --contains sendMessage
minecraft-skills compare-paper-api 1.20.4 1.21.11
minecraft-skills compare-paper-api-surface 1.21.11 1.21.11
minecraft-skills paper-events "player join" --version 1.21.11
```

## Authoring Safety Data

Use these together before writing or reviewing generated output:

- `authoring-context`: preflight, recipes, scenarios, guardrails, diagnostics, claim policies, output
  requirements, response patterns, intent routing, and evidence in one payload.
- `authoring-recipes`: ordered lookup workflows for common tasks.
- `authoring-scenarios`: realistic task shapes plus required lookup IDs for evaluation and
  self-review.
- `authoring-diagnostics`: pass/fail checks to run before returning generated files, code, or
  source-backed answers.
- `claim-policies`: required evidence plus safe and unsafe wording for specific claim types.
- `output-requirements`: final-answer and generated-file checks.
- `response-patterns`: answer shapes for verified facts, missing evidence, and non-guarantees.
- `fact-surfaces`: what each machine-verifiable data surface can and cannot prove.

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
  getAuthoringRecipe,
  getAuthoringScenario,
  getClaimPolicy,
  getOutputRequirement,
  getResponsePattern,
  searchCommands,
  searchPaperMembers,
  searchVanillaPaths,
} from "@minecraft-skills/catalog";

const context = getAuthoringContext({ domain: "paper-plugin", version: "1.21.11" });
const diagnostic = getAuthoringDiagnostic("paper-api-member-unverified");
const recipe = getAuthoringRecipe("paper-event-listener");
const scenario = getAuthoringScenario("paper-event-listener-review");
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
minecraft-skills write-skill minecraft-paper-plugins --output ./skills
```

## Cache

Heavy generated surfaces are listed in `data-manifest` and downloaded with `fetch-data`. Cache
defaults:

- macOS: `~/Library/Caches/minecraft-skills`
- Linux: `${XDG_CACHE_HOME:-~/.cache}/minecraft-skills`
- Windows: `%LOCALAPPDATA%\minecraft-skills\Cache`

Set `MINECRAFT_SKILLS_CACHE_DIR` to override the location.
