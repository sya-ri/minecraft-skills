#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CatalogSearchKind,
  type CommandComparisonOptions,
  type CommandSearchOptions,
  classifyPackFiles,
  cleanCachedData,
  compareCommands,
  compareDatapackSchema,
  comparePaperApi,
  comparePaperApiSurface,
  compareVanillaPaths,
  compareVersions,
  type DatapackSchemaComparisonOptions,
  type DatapackSchemaSearchOptions,
  fetchData,
  getAuthoringChecklist,
  getAuthoringContext,
  getAuthoringDiagnostic,
  getAuthoringGuardrail,
  getAuthoringPlan,
  getAuthoringPreflight,
  getAuthoringRecipe,
  getAuthoringScenario,
  getCacheDataRoot,
  getCacheRoot,
  getClaimPolicy,
  getCommunityDataset,
  getCoverageSummary,
  getDataManifest,
  getDatapackSchemaSurface,
  getDomain,
  getEvidenceBundle,
  getFactSurface,
  getIntentLookup,
  getJavaReportsSummary,
  getOutputRequirement,
  getPackFileSchema,
  getPackMigrationPlan,
  getPaperApiIndex,
  getPaperApiReference,
  getPaperApiSurface,
  getPaperPluginData,
  getResourcepackModelSummary,
  getResponsePattern,
  getSkillPayload,
  getSourcePolicy,
  getSourceReport,
  getSourceTier,
  getSupportMatrix,
  getVanillaInventory,
  getVersionDetail,
  listAuthoringChecklists,
  listAuthoringDiagnostics,
  listAuthoringGuardrails,
  listAuthoringRecipes,
  listAuthoringScenarios,
  listCachedDataFiles,
  listClaimPolicies,
  listCommunityDatasets,
  listDomains,
  listFactSurfaces,
  listIntentLookups,
  listOutputRequirements,
  listPackFormats,
  listReferences,
  listResponsePatterns,
  listSkills,
  listSourceTiers,
  listVersionSupport,
  listVersions,
  type PaperMemberSearchOptions,
  type PaperTypeSearchOptions,
  type ResourcepackModelPathSearchOptions,
  resolveVersion,
  searchAuthoringScenarios,
  searchCatalog,
  searchCommands,
  searchDatapackSchema,
  searchPaperEvents,
  searchPaperMembers,
  searchPaperTypes,
  searchResourcepackModelPaths,
  searchVanillaPaths,
  type VanillaPathComparisonOptions,
  type VanillaPathSearchOptions,
  validatePackFilesContent,
} from "@minecraft-skills/catalog";

type Output = {
  write: (value: string) => void;
  error: (value: string) => void;
};

function isDirectRun(metaUrl: string): boolean {
  return process.argv[1]
    ? realpathSync(fileURLToPath(metaUrl)) === realpathSync(process.argv[1])
    : false;
}

const defaultOutput: Output = {
  write: (value) => console.log(value),
  error: (value) => console.error(value),
};

function readOption(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return args[index + 1] ?? fallback;
}

function positionalArgs(args: string[]): string[] {
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }
    if (arg.startsWith("--")) {
      index += 1;
      continue;
    }
    positional.push(arg);
  }
  return positional;
}

function packRelativePath(filePath: string, packRoot: string): string {
  if (!packRoot) {
    return filePath.replaceAll("\\", "/");
  }
  return relative(resolve(packRoot), resolve(filePath)).replaceAll("\\", "/");
}

function withDefaultDomain(args: string[], domain: "datapack" | "resourcepack"): string[] {
  return args.includes("--domain") ? args : [...args, "--domain", domain];
}

function withAuthoringDomain(args: string[], domain: "datapack" | "resourcepack" | "paper-plugin") {
  return args.includes("--domain") ? args : [...args, "--domain", domain];
}

function normalizeDomainAuthoringSubcommand(
  domain: "datapack" | "resourcepack" | "paper-plugin",
  subcommand: string,
  rest: string[],
): string[] | undefined {
  const aliases: Record<string, string> = {
    checklists: "authoring-checklists",
    checklist: "authoring-checklist",
    recipes: "authoring-recipes",
    recipe: "authoring-recipe",
    "search-scenarios": "authoring-scenario-search",
    "scenario-search": "authoring-scenario-search",
    scenarios: "authoring-scenarios",
    scenario: "authoring-scenario",
    plan: "authoring-plan",
    guardrails: "authoring-guardrails",
    guardrail: "authoring-guardrail",
    diagnostics: "authoring-diagnostics",
    diagnostic: "authoring-diagnostic",
    intents: "intent-lookups",
    intent: "intent-lookup",
    "fact-surfaces": "fact-surfaces",
    "fact-surface": "fact-surface",
    "claim-policies": "claim-policies",
    "claim-policy": "claim-policy",
    "output-requirements": "output-requirements",
    "output-requirement": "output-requirement",
    "response-patterns": "response-patterns",
    "response-pattern": "response-pattern",
  };

  if (subcommand === "context") {
    return ["authoring-context", domain, ...rest];
  }
  if (subcommand === "preflight") {
    return ["preflight", domain, ...rest];
  }
  if (subcommand === "evidence") {
    return ["evidence", domain, ...rest];
  }
  if (subcommand === "search") {
    return ["catalog-search", ...withAuthoringDomain(rest, domain)];
  }
  if (subcommand === "checklist") {
    return ["authoring-checklist", domain, ...rest];
  }

  const command = aliases[subcommand];
  if (!command) {
    return undefined;
  }
  if (
    subcommand.endsWith("s") ||
    subcommand === "search-scenarios" ||
    subcommand === "scenario-search"
  ) {
    return [command, ...withAuthoringDomain(rest, domain)];
  }
  return [command, ...rest];
}

function normalizeSubcommands(argv: string[]): string[] {
  const [group, subcommand, ...rest] = argv;
  if (!group || !subcommand || subcommand.startsWith("-")) {
    return argv;
  }

  const groupedCommand = `${group} ${subcommand}`;
  const aliases: Record<string, string> = {
    "data manifest": "data-manifest",
    "data fetch": "fetch-data",
    "data cache-dir": "cache-dir",
    "data cache-list": "cache-list",
    "data cache-clean": "cache-clean",
    "data coverage": "coverage",
    "minecraft latest": "latest",
    "minecraft list": "versions",
    "minecraft versions": "versions",
    "minecraft show": "show-version",
    "minecraft compare": "compare-versions",
    "minecraft support": "version-support",
    "minecraft support-matrix": "support-matrix",
    "minecraft pack-formats": "pack-formats",
    "minecraft vanilla-inventory": "vanilla-inventory",
    "minecraft sources": "source-report",
    "minecraft search": "catalog-search",
    "datapack server-reports": "server-reports",
    "datapack schema": "datapack-schema",
    "datapack search-schema": "search-datapack-schema",
    "datapack compare-schema": "compare-datapack-schema",
    "datapack classify-files": "classify-files",
    "datapack file-schema": "file-schema",
    "datapack validate-files": "validate-files",
    "datapack migration-plan": "migration-plan",
    "datapack commands": "commands",
    "datapack compare-commands": "compare-commands",
    "resourcepack models": "resourcepack-models",
    "resourcepack classify-files": "classify-files",
    "resourcepack file-schema": "file-schema",
    "resourcepack validate-files": "validate-files",
    "resourcepack migration-plan": "migration-plan",
    "resourcepack search-models": "search-models",
    "skill list": "skills",
    "skill show": "skill",
    "skill write": "write-skill",
    "reference list": "references",
    "domain list": "domains",
    "domain show": "domain",
    "source policy": "source-policy",
    "source report": "source-report",
    "source tiers": "source-tiers",
    "source tier": "source-tier",
    "source datasets": "community-datasets",
    "source dataset": "community-dataset",
    "source search": "catalog-search",
  };

  if (groupedCommand === "datapack vanilla-paths") {
    return ["vanilla-paths", ...withDefaultDomain(rest, "datapack")];
  }
  if (groupedCommand === "datapack compare-vanilla-paths") {
    return ["compare-vanilla-paths", ...withDefaultDomain(rest, "datapack")];
  }
  if (groupedCommand === "datapack classify-files") {
    return ["classify-files", ...withDefaultDomain(rest, "datapack")];
  }
  if (groupedCommand === "datapack file-schema") {
    return ["file-schema", ...withDefaultDomain(rest, "datapack")];
  }
  if (groupedCommand === "datapack validate-files") {
    return ["validate-files", ...withDefaultDomain(rest, "datapack")];
  }
  if (groupedCommand === "datapack migration-plan") {
    return ["migration-plan", ...withDefaultDomain(rest, "datapack")];
  }
  if (group === "datapack") {
    const command = normalizeDomainAuthoringSubcommand("datapack", subcommand, rest);
    if (command) {
      return command;
    }
  }
  if (groupedCommand === "resourcepack vanilla-paths") {
    return ["vanilla-paths", ...withDefaultDomain(rest, "resourcepack")];
  }
  if (groupedCommand === "resourcepack compare-vanilla-paths") {
    return ["compare-vanilla-paths", ...withDefaultDomain(rest, "resourcepack")];
  }
  if (groupedCommand === "resourcepack classify-files") {
    return ["classify-files", ...withDefaultDomain(rest, "resourcepack")];
  }
  if (groupedCommand === "resourcepack file-schema") {
    return ["file-schema", ...withDefaultDomain(rest, "resourcepack")];
  }
  if (groupedCommand === "resourcepack validate-files") {
    return ["validate-files", ...withDefaultDomain(rest, "resourcepack")];
  }
  if (groupedCommand === "resourcepack migration-plan") {
    return ["migration-plan", ...withDefaultDomain(rest, "resourcepack")];
  }
  if (group === "resourcepack") {
    const command = normalizeDomainAuthoringSubcommand("resourcepack", subcommand, rest);
    if (command) {
      return command;
    }
  }
  if (group === "plugin" && subcommand === "paper") {
    const [paperSubcommand, ...paperRest] = rest;
    if (!paperSubcommand) {
      return ["paper"];
    }
    const paperAliases: Record<string, string> = {
      api: "paper-api",
      "api-index": "paper-api-index",
      "compare-api": "compare-paper-api",
      "api-surface": "paper-api-surface",
      types: "paper-types",
      members: "paper-members",
      "compare-api-surface": "compare-paper-api-surface",
      events: "paper-events",
      info: "paper",
    };
    const command = normalizeDomainAuthoringSubcommand("paper-plugin", paperSubcommand, paperRest);
    if (command) {
      return command;
    }
    const paperCommand = paperAliases[paperSubcommand];
    if (paperCommand) {
      return [paperCommand, ...paperRest];
    }
  }
  const command = aliases[groupedCommand];
  return command ? [command, ...rest] : argv;
}

const flatCommandSuggestions: Record<string, string> = {
  domains: "domain list",
  skills: "skill list",
  skill: "skill show",
  "write-skill": "skill write",
  authoring: "datapack context, resourcepack context, or plugin paper context",
  "authoring-checklists":
    "datapack checklists, resourcepack checklists, or plugin paper checklists",
  "authoring-checklist": "datapack checklist, resourcepack checklist, or plugin paper checklist",
  "authoring-recipes": "datapack recipes, resourcepack recipes, or plugin paper recipes",
  "authoring-recipe": "datapack recipe, resourcepack recipe, or plugin paper recipe",
  "authoring-scenario-search":
    "datapack search-scenarios, resourcepack search-scenarios, or plugin paper search-scenarios",
  "authoring-scenarios": "datapack scenarios, resourcepack scenarios, or plugin paper scenarios",
  "authoring-scenario": "datapack scenario, resourcepack scenario, or plugin paper scenario",
  "authoring-plan": "datapack plan, resourcepack plan, or plugin paper plan",
  "authoring-guardrails":
    "datapack guardrails, resourcepack guardrails, or plugin paper guardrails",
  "authoring-guardrail": "datapack guardrail, resourcepack guardrail, or plugin paper guardrail",
  "authoring-diagnostics":
    "datapack diagnostics, resourcepack diagnostics, or plugin paper diagnostics",
  "authoring-diagnostic":
    "datapack diagnostic, resourcepack diagnostic, or plugin paper diagnostic",
  "authoring-context": "datapack context, resourcepack context, or plugin paper context",
  "claim-policies":
    "datapack claim-policies, resourcepack claim-policies, or plugin paper claim-policies",
  "claim-policy": "datapack claim-policy, resourcepack claim-policy, or plugin paper claim-policy",
  "output-requirements":
    "datapack output-requirements, resourcepack output-requirements, or plugin paper output-requirements",
  "output-requirement":
    "datapack output-requirement, resourcepack output-requirement, or plugin paper output-requirement",
  "response-patterns":
    "datapack response-patterns, resourcepack response-patterns, or plugin paper response-patterns",
  "response-pattern":
    "datapack response-pattern, resourcepack response-pattern, or plugin paper response-pattern",
  preflight: "datapack preflight, resourcepack preflight, or plugin paper preflight",
  evidence: "datapack evidence, resourcepack evidence, or plugin paper evidence",
  "intent-lookups": "datapack intents, resourcepack intents, or plugin paper intents",
  "intent-lookup": "datapack intent, resourcepack intent, or plugin paper intent",
  "fact-surfaces":
    "datapack fact-surfaces, resourcepack fact-surfaces, or plugin paper fact-surfaces",
  "fact-surface": "datapack fact-surface, resourcepack fact-surface, or plugin paper fact-surface",
  coverage: "data coverage",
  "data-manifest": "data manifest",
  "support-matrix": "minecraft support-matrix",
  "version-support": "minecraft support",
  version:
    "minecraft latest, minecraft list, minecraft show, minecraft compare, or minecraft support",
  "cache-dir": "data cache-dir",
  "cache-list": "data cache-list",
  "cache-clean": "data cache-clean",
  "fetch-data": "data fetch",
  latest: "minecraft latest",
  versions: "minecraft list",
  "pack-formats": "minecraft pack-formats",
  "show-version": "minecraft show",
  "compare-versions": "minecraft compare",
  "server-reports": "datapack server-reports",
  "datapack-schema": "datapack schema",
  "search-datapack-schema": "datapack search-schema",
  "compare-datapack-schema": "datapack compare-schema",
  "classify-files": "datapack classify-files or resourcepack classify-files",
  "file-schema": "datapack file-schema or resourcepack file-schema",
  "validate-files": "datapack validate-files or resourcepack validate-files",
  "migration-plan": "datapack migration-plan or resourcepack migration-plan",
  commands: "datapack commands",
  "compare-commands": "datapack compare-commands",
  "resourcepack-models": "resourcepack models",
  "search-models": "resourcepack search-models",
  "vanilla-inventory": "minecraft vanilla-inventory",
  "vanilla-paths": "datapack vanilla-paths or resourcepack vanilla-paths",
  "compare-vanilla-paths": "datapack compare-vanilla-paths or resourcepack compare-vanilla-paths",
  "paper-api": "plugin paper api",
  "paper-api-index": "plugin paper api-index",
  "compare-paper-api": "plugin paper compare-api",
  "paper-api-surface": "plugin paper api-surface",
  "paper-types": "plugin paper types",
  "paper-members": "plugin paper members",
  "compare-paper-api-surface": "plugin paper compare-api-surface",
  "paper-events": "plugin paper events",
  paper:
    "plugin paper info, plugin paper api, plugin paper types, plugin paper members, or plugin paper events",
  references: "reference list",
  domain: "domain show",
  "source-policy": "source policy",
  "source-report": "source report or minecraft sources",
  "source-tiers": "source tiers",
  "source-tier": "source tier",
  "community-datasets": "source datasets",
  "community-dataset": "source dataset",
};

const commandGroups = new Set([
  "data",
  "minecraft",
  "datapack",
  "resourcepack",
  "plugin",
  "skill",
  "reference",
  "domain",
  "source",
]);

const pluginPaperSuggestions: Record<string, string> = {
  context: "plugin paper context",
  preflight: "plugin paper preflight",
  evidence: "plugin paper evidence",
  "search-scenarios": "plugin paper search-scenarios",
  search: "plugin paper search",
  plan: "plugin paper plan",
  recipes: "plugin paper recipes",
  recipe: "plugin paper recipe",
  scenarios: "plugin paper scenarios",
  scenario: "plugin paper scenario",
  checklists: "plugin paper checklists",
  checklist: "plugin paper checklist",
  guardrails: "plugin paper guardrails",
  guardrail: "plugin paper guardrail",
  diagnostics: "plugin paper diagnostics",
  diagnostic: "plugin paper diagnostic",
  intents: "plugin paper intents",
  intent: "plugin paper intent",
  "fact-surfaces": "plugin paper fact-surfaces",
  "fact-surface": "plugin paper fact-surface",
  "claim-policies": "plugin paper claim-policies",
  "claim-policy": "plugin paper claim-policy",
  "output-requirements": "plugin paper output-requirements",
  "output-requirement": "plugin paper output-requirement",
  "response-patterns": "plugin paper response-patterns",
  "response-pattern": "plugin paper response-pattern",
  info: "plugin paper info",
  api: "plugin paper api",
  "api-index": "plugin paper api-index",
  "compare-api": "plugin paper compare-api",
  "api-surface": "plugin paper api-surface",
  types: "plugin paper types",
  members: "plugin paper members",
  "compare-api-surface": "plugin paper compare-api-surface",
  events: "plugin paper events",
};

function printHelp(output: Output): void {
  output.write(`minecraft-skills

Version-aware Minecraft authoring facts for AI agents and pack/plugin authors.
All fact commands print JSON unless noted. Treat missing, unknown, or not-extracted fields as gaps,
not permission to guess.

Usage:
  minecraft-skills <group> <command> [options]
  minecraft-skills help

Start here:
  minecraft-skills datapack context [version]
  minecraft-skills resourcepack context [version]
  minecraft-skills plugin paper context [version]
      Broad preflight payload for one domain/version: checklist, recipes, scenarios, diagnostics,
      claim policies, response patterns, intent routing, evidence, and warnings.
  minecraft-skills datapack search-scenarios <query>
  minecraft-skills resourcepack search-scenarios <query>
  minecraft-skills plugin paper search-scenarios <query>
      Route a user task to existing scenarios using scenario, recipe, and intent text.
  minecraft-skills datapack search <query> [--kind kind] [--limit 10]
  minecraft-skills resourcepack search <query> [--kind kind] [--limit 10]
  minecraft-skills plugin paper search <query> [--kind kind] [--limit 10]
      Search lightweight catalog entries before using broad list commands. Covers skills,
      references, fact surfaces, recipes, scenarios, guardrails, diagnostics, claim policies,
      output requirements, response patterns, intent lookups, source tiers, datasets, and support.
  minecraft-skills plugin paper plan <scenario-id> [version]
      Resolve one scenario into exact recipes, intent lookups, diagnostics, claim policies,
      fact surfaces, response patterns, and optional version evidence.
  minecraft-skills datapack preflight [version]
  minecraft-skills resourcepack preflight [version]
  minecraft-skills plugin paper preflight [version]
      Check target-version coverage, support gaps, downloadable surfaces, and warnings before
      generating files or code.
  minecraft-skills datapack evidence [version]
  minecraft-skills resourcepack evidence [version]
  minecraft-skills plugin paper evidence [version]
      Print source policy, data files, links, and warnings for provenance-aware answers.
  minecraft-skills source report [domain] [version]
  minecraft-skills minecraft sources [domain] [version]
      Print allowed source tiers, prohibited automation, community structured datasets, and optional
      domain/version provenance.
  minecraft-skills source tiers
  minecraft-skills source datasets
      Inspect source tiers and recommended structured community datasets such as PrismarineJS and
      misode/mcmeta.

Domains:
  datapack        Java data packs: commands, server reports, pack formats, vanilla data paths,
                  and observed datapack JSON shapes.
  resourcepack    Java resource packs: pack formats, vanilla asset paths, model summaries,
                  and observed item/model shapes.
  plugin paper    Paper-first plugins: Paper support, Javadocs indexes/surfaces, API names,
                  event candidates, and Folia/threading caveats. Domain id: paper-plugin.

Common workflows:
  Pick a safe workflow for a task:
    minecraft-skills plugin paper search-scenarios "Paper event listener"
    minecraft-skills plugin paper plan paper-event-listener-review 1.21.11

  Generate or review a datapack function:
    minecraft-skills datapack context 26.2
    minecraft-skills datapack commands 26.2 --prefix execute --contains run

  Check resource pack paths and model shapes:
    minecraft-skills resourcepack preflight 26.2
    minecraft-skills resourcepack vanilla-paths 26.2 --contains models/item
    minecraft-skills resourcepack search-models 26.2 --kind item-definition --contains bundle

  Check Paper API names and events:
    minecraft-skills plugin paper preflight 1.21.11
    minecraft-skills plugin paper types 1.21.11 --contains org.bukkit.entity.Player
    minecraft-skills plugin paper members 1.21.11 --type org.bukkit.entity.Player --contains sendMessage
    minecraft-skills plugin paper events "player join" --version 26.2

Safety notes:
  - Command paths prove parser shape, not gameplay success, permissions, or runtime behavior.
  - Vanilla path matches prove bundled vanilla file presence, not custom content validity.
  - Observed JSON/model surfaces are not normative schemas.
  - Paper Javadocs indexes prove API name presence, not behavior, nullability, overload semantics,
    thread safety, or Folia safety.
  - Paper event search results are candidates until checked against Paper/Bukkit API surfaces.
  - Minecraft Wiki pages are human-only background: do not fetch, crawl, summarize, or cite them in
    AI workflows.

Grouped commands:
  minecraft-skills datapack context|preflight|evidence [version] [--edition java]
  minecraft-skills resourcepack context|preflight|evidence [version] [--edition java]
  minecraft-skills plugin paper context|preflight|evidence [version] [--edition java]
  minecraft-skills datapack|resourcepack search-scenarios <query> [--limit 10]
  minecraft-skills plugin paper search-scenarios <query> [--limit 10]
  minecraft-skills datapack|resourcepack search <query> [--kind kind] [--limit 10]
  minecraft-skills plugin paper search <query> [--kind kind] [--limit 10]
  minecraft-skills datapack|resourcepack plan <scenario-id> [version] [--edition java]
  minecraft-skills plugin paper plan <scenario-id> [version] [--edition java]
  minecraft-skills datapack|resourcepack recipes|recipe|scenarios|scenario|checklists|checklist
  minecraft-skills plugin paper recipes|recipe|scenarios|scenario|checklists|checklist
  minecraft-skills datapack|resourcepack guardrails|guardrail|diagnostics|diagnostic
  minecraft-skills plugin paper guardrails|guardrail|diagnostics|diagnostic
  minecraft-skills datapack|resourcepack intents|intent|fact-surfaces|fact-surface
  minecraft-skills plugin paper intents|intent|fact-surfaces|fact-surface
  minecraft-skills datapack|resourcepack claim-policies|claim-policy
  minecraft-skills plugin paper claim-policies|claim-policy
  minecraft-skills datapack|resourcepack output-requirements|output-requirement
  minecraft-skills plugin paper output-requirements|output-requirement
  minecraft-skills datapack|resourcepack response-patterns|response-pattern
  minecraft-skills plugin paper response-patterns|response-pattern
  minecraft-skills datapack commands [version] [--contains text] [--prefix literal] [--parser parser] [--limit 50]
  minecraft-skills datapack schema [version] [--edition java]
  minecraft-skills datapack search-schema [version] [--kind kind] [--path field.path] [--contains text] [--limit 50]
  minecraft-skills datapack compare-schema <from> <to> [--kind kind] [--contains text] [--limit 50]
  minecraft-skills datapack classify-files <path...>
  minecraft-skills datapack file-schema [version] <path>
  minecraft-skills datapack validate-files <version> <file...> [--pack-root dir]
  minecraft-skills datapack migration-plan <from> <to> [path...] [--limit 50]
  minecraft-skills datapack server-reports [version] [--edition java]
  minecraft-skills datapack vanilla-paths [version] [--prefix path] [--contains text] [--extension json] [--limit 50]
  minecraft-skills resourcepack vanilla-paths [version] [--prefix path] [--contains text] [--extension json] [--limit 50]
  minecraft-skills resourcepack models [version] [--edition java]
  minecraft-skills resourcepack classify-files <path...>
  minecraft-skills resourcepack file-schema [version] <path>
  minecraft-skills resourcepack validate-files <version> <file...> [--pack-root dir]
  minecraft-skills resourcepack migration-plan <from> <to> [path...] [--limit 50]
  minecraft-skills resourcepack search-models [version] [--kind model|item-definition] [--contains text] [--prefix path] [--limit 50]
  minecraft-skills plugin paper info
  minecraft-skills plugin paper api|api-index|api-surface [version]
  minecraft-skills plugin paper types [version] [--package package.name] [--contains text] [--limit 50]
  minecraft-skills plugin paper members [version] [--type qualified.Type] [--package package.name] [--kind method|constructor|field-or-enum-constant|unknown] [--contains text] [--limit 50]
  minecraft-skills plugin paper events <query> [--version latest] [--source paper] [--limit 20]
  minecraft-skills minecraft latest|list|show|compare|support|support-matrix|pack-formats|vanilla-inventory
  minecraft-skills minecraft search <query> [--domain datapack|resourcepack|paper-plugin] [--kind kind] [--limit 10]
  minecraft-skills minecraft sources [datapack|resourcepack|paper-plugin] [version]
  minecraft-skills data manifest|fetch|cache-dir|cache-list|cache-clean|coverage
  minecraft-skills skill list|show|write
  minecraft-skills reference list [--domain datapack|resourcepack|paper-plugin]
  minecraft-skills domain show <datapack|resourcepack|paper-plugin>
  minecraft-skills source policy
  minecraft-skills source report [datapack|resourcepack|paper-plugin] [version]
  minecraft-skills source tiers|tier|datasets|dataset
  minecraft-skills source search <query> [--kind source-tier|community-dataset] [--limit 10]

Command reference:
  domain list    List supported authoring domains.
  skill list     List installable Agent Skill folders in this repository.
  skill show     Print packaged Agent Skill payload JSON.
  skill write    Write a packaged Agent Skill folder to disk.
  datapack|resourcepack context; plugin paper context
                 Print preflight, recipes, diagnostics, intent lookups, and evidence for a domain.
  datapack|resourcepack search-scenarios; plugin paper search-scenarios
                 Search scenarios by task wording using scenario, recipe, and intent text.
  datapack|resourcepack search; plugin paper search; minecraft search
                 Search lightweight catalog entries by text, kind, and domain before listing all entries.
  datapack|resourcepack plan; plugin paper plan
                 Print one scenario with all required lookups resolved.
  datapack|resourcepack preflight; plugin paper preflight
                 Print resolved version, checklist, fact surfaces, coverage, and warnings.
  datapack|resourcepack evidence; plugin paper evidence
                 Print source policy, primary sources, data files, links, and warnings.
  datapack|resourcepack or plugin paper checklists|checklist|recipes|recipe|scenarios|scenario
                 Inspect domain checklists, ordered workflows, and realistic task shapes.
  datapack|resourcepack or plugin paper guardrails|guardrail|diagnostics|diagnostic
                 Inspect output rules and pre-finalization diagnostics.
  datapack|resourcepack or plugin paper claim-policies|claim-policy|output-requirements|output-requirement
                 Inspect required evidence and final-output checks.
  datapack|resourcepack or plugin paper response-patterns|response-pattern|intents|intent|fact-surfaces|fact-surface
                 Inspect answer patterns, intent routing, and fact-surface guarantees.
  data coverage|manifest
                 Print bundled coverage or downloadable data manifest JSON.
  data cache-dir|cache-list|cache-clean|fetch
                 Inspect, clean, or download SHA-256 verified cache data.
  minecraft latest|list|pack-formats|show|compare|support|support-matrix|vanilla-inventory
                 Inspect bundled version metadata and per-domain version support.
  datapack server-reports|schema|search-schema|compare-schema|commands|compare-commands
                 Inspect command paths, observed datapack JSON shapes, file schemas, file kinds, and file content validation.
  datapack vanilla-paths|compare-vanilla-paths
                 Search or compare bundled vanilla datapack paths.
  resourcepack vanilla-paths|compare-vanilla-paths|models|search-models
                 Inspect vanilla assets, model summaries, item/model paths, file schemas, file kinds, and file content validation.
  plugin paper info|api|api-index|compare-api|api-surface|types|members|compare-api-surface|events
                 Inspect Paper support, Javadocs-derived API surfaces, and event candidates.
  reference list Print generated skill references.
  domain show    Print canonical JSON for an authoring domain.
  source policy  Print source and license policy JSON.
  source report  Print source tiers, prohibited automation, community datasets, and optional
                 domain/version provenance.
  source tiers   Print source tier JSON entries.
  source tier    Print one source tier by id.
  source datasets
                 Print recommended structured community dataset JSON entries.
  source dataset Print one structured community dataset by id.

Options:
  --domain <domain>      Filter to datapack, resourcepack, or paper-plugin where supported.
  --edition java         Select edition. Only java is currently supported.
  --version <version>    Select a version for commands that accept named options.
  --limit <n>            Limit search results. Search commands validate their own maximums.
  --pack-root <dir>      Strip a local pack root when validating files so paths become pack-relative.
  --force                Overwrite or refetch where supported.

Cache:
  Heavy generated surfaces are listed in data manifest and stored in the OS cache. Use data cache-dir,
  data cache-list, data cache-clean, and data fetch. Set MINECRAFT_SKILLS_CACHE_DIR to override it.

More:
  docs/USAGE.md has full CLI, MCP, package API, cache, and skill usage.`);
}

function printJson(output: Output, value: unknown): void {
  output.write(JSON.stringify(value, null, 2));
}

function writeFileSafely(path: string, content: string, force: boolean): void {
  if (!force && existsSync(path)) {
    throw new Error(`Refusing to overwrite existing file without --force: ${path}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function skillRelativePath(skillPath: string, filePath: string): string {
  const prefix = `${skillPath}/`;
  if (!filePath.startsWith(prefix)) {
    throw new Error(`Skill file path is outside skill folder: ${filePath}`);
  }
  return relative(skillPath, filePath);
}

function writeSkillFolder(name: string, outputRoot: string, force: boolean): string[] {
  const payload = getSkillPayload(name);
  const outputDir = join(outputRoot, payload.skill.name);
  const written: string[] = [];
  const files = [
    {
      path: "SKILL.md",
      content: payload.skillMarkdown,
    },
    {
      path: skillRelativePath(payload.skill.path, payload.skill.agentMetadata),
      content: payload.agentMetadata,
    },
    ...payload.references.map((reference) => ({
      path: skillRelativePath(payload.skill.path, reference.reference.path),
      content: reference.markdown,
    })),
  ];

  for (const file of files) {
    const outputPath = join(outputDir, file.path);
    writeFileSafely(outputPath, file.content, force);
    written.push(outputPath);
  }

  return written;
}

export async function runCli(argv: string[], output: Output = defaultOutput): Promise<number> {
  const flatSuggestion = flatCommandSuggestions[argv[0] ?? ""];
  const hasSubcommand = Boolean(argv[1] && !argv[1].startsWith("-"));
  if (flatSuggestion && !(commandGroups.has(argv[0] ?? "") && hasSubcommand)) {
    output.error(`Use subcommands: minecraft-skills ${flatSuggestion}`);
    return 1;
  }
  if (argv[0] === "plugin" && argv[1] && argv[1] !== "paper") {
    const suggestion = pluginPaperSuggestions[argv[1]];
    if (suggestion) {
      output.error(`Use subcommands: minecraft-skills ${suggestion}`);
      return 1;
    }
  }
  const normalizedArgv = normalizeSubcommands(argv);
  if (commandGroups.has(argv[0] ?? "") && hasSubcommand && normalizedArgv === argv) {
    if (argv[0] === "plugin" && argv[1] === "paper" && argv[2] && !argv[2].startsWith("-")) {
      output.error(`Unknown subcommand: plugin paper ${argv[2]}`);
      return 1;
    }
    output.error(`Unknown subcommand: ${argv[0]} ${argv[1]}`);
    return 1;
  }
  const [command, ...args] = normalizedArgv;
  const edition = readOption(args, "--edition", "java");

  try {
    if (!command || command === "help" || command === "--help" || command === "-h") {
      printHelp(output);
      return 0;
    }

    if (command === "domains") {
      for (const domain of listDomains()) {
        output.write(`${domain.id}\t${domain.skill}\t${domain.title}`);
      }
      return 0;
    }

    if (command === "skills") {
      const domain = args.includes("--domain") ? readOption(args, "--domain", "") : undefined;
      for (const skill of listSkills(domain)) {
        output.write(`${skill.name}\t${skill.domain}\t${skill.path}\t${skill.title}`);
      }
      return 0;
    }

    if (command === "skill") {
      const name = positionalArgs(args)[0];
      if (!name) {
        throw new Error("skill command requires a skill name");
      }
      printJson(output, getSkillPayload(name));
      return 0;
    }

    if (command === "write-skill") {
      const name = positionalArgs(args)[0];
      const outputRoot = readOption(args, "--output", "");
      if (!name) {
        throw new Error("write-skill command requires a skill name");
      }
      if (!outputRoot) {
        throw new Error("write-skill command requires --output <dir>");
      }
      for (const path of writeSkillFolder(name, outputRoot, args.includes("--force"))) {
        output.write(path);
      }
      return 0;
    }

    if (command === "authoring-checklists") {
      printJson(output, {
        schemaVersion: 1,
        checklists: listAuthoringChecklists({
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
        }),
      });
      return 0;
    }

    if (command === "authoring-checklist") {
      const domain = positionalArgs(args)[0];
      if (!domain) {
        throw new Error("authoring-checklist command requires a domain");
      }
      printJson(output, getAuthoringChecklist(domain));
      return 0;
    }

    if (command === "authoring-recipes") {
      printJson(output, {
        schemaVersion: 1,
        recipes: listAuthoringRecipes({
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
        }),
      });
      return 0;
    }

    if (command === "authoring-recipe") {
      const id = positionalArgs(args)[0];
      if (!id) {
        throw new Error("authoring-recipe command requires an id");
      }
      printJson(output, getAuthoringRecipe(id));
      return 0;
    }

    if (command === "authoring-scenario-search") {
      const query = positionalArgs(args).join(" ");
      if (!query) {
        throw new Error("authoring-scenario-search command requires a query");
      }
      printJson(
        output,
        searchAuthoringScenarios({
          query,
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
          ...(args.includes("--limit") ? { limit: Number(readOption(args, "--limit", "10")) } : {}),
        }),
      );
      return 0;
    }

    if (command === "authoring-scenarios") {
      printJson(output, {
        schemaVersion: 1,
        scenarios: listAuthoringScenarios({
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
        }),
      });
      return 0;
    }

    if (command === "authoring-scenario") {
      const id = positionalArgs(args)[0];
      if (!id) {
        throw new Error("authoring-scenario command requires an id");
      }
      printJson(output, getAuthoringScenario(id));
      return 0;
    }

    if (command === "authoring-plan") {
      const [scenario, version] = positionalArgs(args);
      if (!scenario) {
        throw new Error("authoring-plan command requires a scenario id");
      }
      printJson(
        output,
        getAuthoringPlan({
          scenario,
          edition,
          ...(version ? { version } : {}),
        }),
      );
      return 0;
    }

    if (command === "authoring-guardrails") {
      printJson(output, {
        schemaVersion: 1,
        guardrails: listAuthoringGuardrails({
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
        }),
      });
      return 0;
    }

    if (command === "authoring-guardrail") {
      const id = positionalArgs(args)[0];
      if (!id) {
        throw new Error("authoring-guardrail command requires an id");
      }
      printJson(output, getAuthoringGuardrail(id));
      return 0;
    }

    if (command === "authoring-diagnostics") {
      printJson(output, {
        schemaVersion: 1,
        diagnostics: listAuthoringDiagnostics({
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
        }),
      });
      return 0;
    }

    if (command === "authoring-diagnostic") {
      const id = positionalArgs(args)[0];
      if (!id) {
        throw new Error("authoring-diagnostic command requires an id");
      }
      printJson(output, getAuthoringDiagnostic(id));
      return 0;
    }

    if (command === "authoring-context") {
      const [domain, version] = positionalArgs(args);
      if (!domain) {
        throw new Error("authoring-context command requires a domain");
      }
      printJson(
        output,
        getAuthoringContext({
          domain,
          edition,
          ...(version ? { version } : {}),
        }),
      );
      return 0;
    }

    if (command === "claim-policies") {
      printJson(output, {
        schemaVersion: 1,
        policies: listClaimPolicies({
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
        }),
      });
      return 0;
    }

    if (command === "claim-policy") {
      const id = positionalArgs(args)[0];
      if (!id) {
        throw new Error("claim-policy command requires an id");
      }
      printJson(output, getClaimPolicy(id));
      return 0;
    }

    if (command === "output-requirements") {
      printJson(output, {
        schemaVersion: 1,
        requirements: listOutputRequirements({
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
        }),
      });
      return 0;
    }

    if (command === "output-requirement") {
      const id = positionalArgs(args)[0];
      if (!id) {
        throw new Error("output-requirement command requires an id");
      }
      printJson(output, getOutputRequirement(id));
      return 0;
    }

    if (command === "response-patterns") {
      printJson(output, {
        schemaVersion: 1,
        patterns: listResponsePatterns({
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
        }),
      });
      return 0;
    }

    if (command === "response-pattern") {
      const id = positionalArgs(args)[0];
      if (!id) {
        throw new Error("response-pattern command requires an id");
      }
      printJson(output, getResponsePattern(id));
      return 0;
    }

    if (command === "preflight") {
      const [domain, version] = positionalArgs(args);
      if (!domain) {
        throw new Error("preflight command requires a domain");
      }
      printJson(
        output,
        getAuthoringPreflight({
          domain,
          edition,
          ...(version ? { version } : {}),
        }),
      );
      return 0;
    }

    if (command === "evidence") {
      const [domain, version] = positionalArgs(args);
      if (!domain) {
        throw new Error("evidence command requires a domain");
      }
      printJson(
        output,
        getEvidenceBundle({
          domain,
          edition,
          ...(version ? { version } : {}),
        }),
      );
      return 0;
    }

    if (command === "intent-lookups") {
      printJson(output, {
        schemaVersion: 1,
        intents: listIntentLookups({
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
        }),
      });
      return 0;
    }

    if (command === "intent-lookup") {
      const id = positionalArgs(args)[0];
      if (!id) {
        throw new Error("intent-lookup command requires an id");
      }
      printJson(output, getIntentLookup(id));
      return 0;
    }

    if (command === "fact-surfaces") {
      printJson(output, {
        schemaVersion: 1,
        surfaces: listFactSurfaces({
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
        }),
      });
      return 0;
    }

    if (command === "fact-surface") {
      const id = positionalArgs(args)[0];
      if (!id) {
        throw new Error("fact-surface command requires an id");
      }
      printJson(output, getFactSurface(id));
      return 0;
    }

    if (command === "coverage") {
      printJson(output, getCoverageSummary());
      return 0;
    }

    if (command === "data-manifest") {
      printJson(output, getDataManifest());
      return 0;
    }

    if (command === "support-matrix") {
      printJson(output, getSupportMatrix());
      return 0;
    }

    if (command === "version-support") {
      printJson(output, {
        schemaVersion: 1,
        versions: listVersionSupport({
          edition,
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
        }),
      });
      return 0;
    }

    if (command === "cache-dir") {
      output.write(getCacheRoot());
      return 0;
    }

    if (command === "cache-list") {
      printJson(output, {
        cacheRoot: getCacheRoot(),
        dataRoot: getCacheDataRoot(),
        files: listCachedDataFiles(),
      });
      return 0;
    }

    if (command === "cache-clean") {
      output.write(cleanCachedData());
      return 0;
    }

    if (command === "fetch-data") {
      const [kind] = positionalArgs(args);
      const path = args.includes("--path") ? readOption(args, "--path", "") : undefined;
      if (!kind && !path) {
        throw new Error("fetch-data command requires <kind> or --path <path>");
      }
      printJson(
        output,
        await fetchData({
          ...(kind ? { kind } : {}),
          ...(path ? { path } : {}),
          ...(args.includes("--version") ? { version: readOption(args, "--version", "") } : {}),
          ...(args.includes("--base-url") ? { baseUrl: readOption(args, "--base-url", "") } : {}),
          force: args.includes("--force"),
        }),
      );
      return 0;
    }

    if (command === "latest") {
      output.write(resolveVersion(edition, "latest"));
      return 0;
    }

    if (command === "versions") {
      for (const version of listVersions(edition)) {
        const detail = getVersionDetail(edition, version.id);
        output.write(`${version.id}\t${version.type}\t${version.releaseTime}\t${detail.coverage}`);
      }
      return 0;
    }

    if (command === "pack-formats") {
      for (const format of listPackFormats(edition)) {
        output.write(
          [
            format.version,
            format.releaseTime,
            `data=${format.data ?? ""}`,
            `dataMinor=${format.dataMinor ?? ""}`,
            `resource=${format.resource ?? ""}`,
            `resourceMinor=${format.resourceMinor ?? ""}`,
            `paper=${format.paperPluginStatus}`,
          ].join("\t"),
        );
      }
      return 0;
    }

    if (command === "show-version") {
      const requested = positionalArgs(args)[0] ?? "latest";
      printJson(output, getVersionDetail(edition, requested));
      return 0;
    }

    if (command === "compare-versions") {
      const [from, to] = positionalArgs(args);
      if (!from || !to) {
        throw new Error("compare-versions command requires <from> and <to>");
      }
      printJson(output, compareVersions(edition, from, to));
      return 0;
    }

    if (command === "server-reports") {
      const requested = positionalArgs(args)[0] ?? "latest";
      printJson(output, getJavaReportsSummary(edition, requested));
      return 0;
    }

    if (command === "datapack-schema") {
      const requested = positionalArgs(args)[0] ?? "latest";
      printJson(output, getDatapackSchemaSurface(edition, requested));
      return 0;
    }

    if (command === "search-datapack-schema") {
      const requested = positionalArgs(args)[0] ?? "latest";
      const schemaOptions: DatapackSchemaSearchOptions = {
        edition,
        version: requested,
        limit: Number(readOption(args, "--limit", "50")),
      };
      if (args.includes("--kind")) {
        schemaOptions.kind = readOption(args, "--kind", "");
      }
      if (args.includes("--path")) {
        schemaOptions.path = readOption(args, "--path", "");
      }
      if (args.includes("--contains")) {
        schemaOptions.contains = readOption(args, "--contains", "");
      }
      printJson(output, searchDatapackSchema(schemaOptions));
      return 0;
    }

    if (command === "compare-datapack-schema") {
      const [from, to] = positionalArgs(args);
      if (!from || !to) {
        throw new Error("compare-datapack-schema command requires <from> and <to>");
      }
      const schemaOptions: DatapackSchemaComparisonOptions = {
        edition,
        from,
        to,
        limit: Number(readOption(args, "--limit", "50")),
      };
      if (args.includes("--kind")) {
        schemaOptions.kind = readOption(args, "--kind", "");
      }
      if (args.includes("--contains")) {
        schemaOptions.contains = readOption(args, "--contains", "");
      }
      printJson(output, compareDatapackSchema(schemaOptions));
      return 0;
    }

    if (command === "classify-files") {
      const paths = positionalArgs(args);
      if (paths.length === 0) {
        throw new Error("classify-files command requires at least one path");
      }
      const domainText = readOption(args, "--domain", "");
      if (domainText && domainText !== "datapack" && domainText !== "resourcepack") {
        throw new Error("classify-files --domain must be datapack or resourcepack");
      }
      const domain =
        domainText === "datapack" || domainText === "resourcepack" ? domainText : undefined;
      printJson(
        output,
        classifyPackFiles({
          paths,
          ...(domain ? { domain } : {}),
        }),
      );
      return 0;
    }

    if (command === "file-schema") {
      const positionals = positionalArgs(args);
      const [first, second] = positionals;
      const version = second ? first : "latest";
      const path = second ?? first;
      if (!path) {
        throw new Error("file-schema command requires <path> or <version> <path>");
      }
      const domainText = readOption(args, "--domain", "");
      if (domainText && domainText !== "datapack" && domainText !== "resourcepack") {
        throw new Error("file-schema --domain must be datapack or resourcepack");
      }
      const domain =
        domainText === "datapack" || domainText === "resourcepack" ? domainText : undefined;
      printJson(
        output,
        getPackFileSchema({
          edition,
          version: version ?? "latest",
          path,
          ...(domain ? { domain } : {}),
        }),
      );
      return 0;
    }

    if (command === "validate-files") {
      const [version, ...filePaths] = positionalArgs(args);
      if (!version || filePaths.length === 0) {
        throw new Error("validate-files command requires <version> and at least one <file>");
      }
      const domainText = readOption(args, "--domain", "");
      if (domainText !== "datapack" && domainText !== "resourcepack") {
        throw new Error("validate-files --domain must be datapack or resourcepack");
      }
      const packRoot = readOption(args, "--pack-root", "");
      printJson(
        output,
        validatePackFilesContent({
          edition,
          version,
          domain: domainText,
          files: filePaths.map((filePath) => ({
            path: packRelativePath(filePath, packRoot),
            content: readFileSync(filePath, "utf8"),
          })),
        }),
      );
      return 0;
    }

    if (command === "migration-plan") {
      const [from, to, ...paths] = positionalArgs(args);
      if (!from || !to) {
        throw new Error("migration-plan command requires <from> and <to>");
      }
      const domainText = readOption(args, "--domain", "");
      if (domainText !== "datapack" && domainText !== "resourcepack") {
        throw new Error("migration-plan --domain must be datapack or resourcepack");
      }
      printJson(
        output,
        getPackMigrationPlan({
          edition,
          domain: domainText,
          from,
          to,
          paths,
          limit: Number(readOption(args, "--limit", "50")),
        }),
      );
      return 0;
    }

    if (command === "commands") {
      const requested = positionalArgs(args)[0] ?? "latest";
      const commandOptions: CommandSearchOptions = {
        edition,
        version: requested,
        limit: Number(readOption(args, "--limit", "50")),
      };
      if (args.includes("--contains")) {
        commandOptions.contains = readOption(args, "--contains", "");
      }
      if (args.includes("--prefix")) {
        commandOptions.prefix = readOption(args, "--prefix", "");
      }
      if (args.includes("--parser")) {
        commandOptions.parser = readOption(args, "--parser", "");
      }
      printJson(output, searchCommands(commandOptions));
      return 0;
    }

    if (command === "compare-commands") {
      const [from, to] = positionalArgs(args);
      if (!from || !to) {
        throw new Error("compare-commands command requires <from> and <to>");
      }
      const commandOptions: CommandComparisonOptions = {
        edition,
        from,
        to,
        limit: Number(readOption(args, "--limit", "50")),
      };
      if (args.includes("--contains")) {
        commandOptions.contains = readOption(args, "--contains", "");
      }
      if (args.includes("--prefix")) {
        commandOptions.prefix = readOption(args, "--prefix", "");
      }
      if (args.includes("--parser")) {
        commandOptions.parser = readOption(args, "--parser", "");
      }
      printJson(output, compareCommands(commandOptions));
      return 0;
    }

    if (command === "resourcepack-models") {
      const requested = positionalArgs(args)[0] ?? "latest";
      printJson(output, getResourcepackModelSummary(edition, requested));
      return 0;
    }

    if (command === "search-models") {
      const requested = positionalArgs(args)[0] ?? "latest";
      const modelOptions: ResourcepackModelPathSearchOptions = {
        edition,
        version: requested,
        limit: Number(readOption(args, "--limit", "50")),
      };
      if (args.includes("--contains")) {
        modelOptions.contains = readOption(args, "--contains", "");
      }
      if (args.includes("--prefix")) {
        modelOptions.prefix = readOption(args, "--prefix", "");
      }
      if (args.includes("--kind")) {
        const kind = readOption(args, "--kind", "");
        if (kind !== "model" && kind !== "item-definition") {
          throw new Error("search-models --kind must be model or item-definition");
        }
        modelOptions.kind = kind;
      }
      printJson(output, searchResourcepackModelPaths(modelOptions));
      return 0;
    }

    if (command === "vanilla-inventory") {
      const requested = positionalArgs(args)[0] ?? "latest";
      printJson(output, getVanillaInventory(edition, requested));
      return 0;
    }

    if (command === "vanilla-paths") {
      const requested = positionalArgs(args)[0] ?? "latest";
      const domain = readOption(args, "--domain", "datapack");
      if (domain !== "datapack" && domain !== "resourcepack") {
        throw new Error("vanilla-paths --domain must be datapack or resourcepack");
      }
      const pathOptions: VanillaPathSearchOptions = {
        edition,
        version: requested,
        domain,
        limit: Number(readOption(args, "--limit", "50")),
      };
      if (args.includes("--prefix")) {
        pathOptions.prefix = readOption(args, "--prefix", "");
      }
      if (args.includes("--contains")) {
        pathOptions.contains = readOption(args, "--contains", "");
      }
      if (args.includes("--extension")) {
        pathOptions.extension = readOption(args, "--extension", "");
      }
      printJson(output, searchVanillaPaths(pathOptions));
      return 0;
    }

    if (command === "compare-vanilla-paths") {
      const [from, to] = positionalArgs(args);
      if (!from || !to) {
        throw new Error("compare-vanilla-paths command requires <from> and <to>");
      }
      const domain = readOption(args, "--domain", "datapack");
      if (domain !== "datapack" && domain !== "resourcepack") {
        throw new Error("compare-vanilla-paths --domain must be datapack or resourcepack");
      }
      const pathOptions: VanillaPathComparisonOptions = {
        edition,
        from,
        to,
        domain,
        limit: Number(readOption(args, "--limit", "50")),
      };
      if (args.includes("--prefix")) {
        pathOptions.prefix = readOption(args, "--prefix", "");
      }
      if (args.includes("--contains")) {
        pathOptions.contains = readOption(args, "--contains", "");
      }
      if (args.includes("--extension")) {
        pathOptions.extension = readOption(args, "--extension", "");
      }
      printJson(output, compareVanillaPaths(pathOptions));
      return 0;
    }

    if (command === "paper-events") {
      const query = positionalArgs(args).join(" ");
      const limitText = readOption(args, "--limit", "20");
      const source = args.includes("--source") ? readOption(args, "--source", "") : undefined;
      const version = readOption(args, "--version", "latest");
      const searchOptions = {
        query,
        version,
        limit: Number(limitText),
      };
      printJson(
        output,
        await searchPaperEvents(source ? { ...searchOptions, source } : searchOptions),
      );
      return 0;
    }

    if (command === "paper-api") {
      const requested = positionalArgs(args)[0] ?? "latest";
      printJson(output, getPaperApiReference(requested));
      return 0;
    }

    if (command === "paper-api-index") {
      const requested = positionalArgs(args)[0] ?? "latest";
      printJson(output, getPaperApiIndex(requested));
      return 0;
    }

    if (command === "compare-paper-api") {
      const [from, to] = positionalArgs(args);
      if (!from || !to) {
        throw new Error("compare-paper-api command requires <from> and <to>");
      }
      printJson(output, comparePaperApi(from, to));
      return 0;
    }

    if (command === "paper-api-surface") {
      const requested = positionalArgs(args)[0] ?? "latest";
      printJson(output, getPaperApiSurface(requested));
      return 0;
    }

    if (command === "paper-types") {
      const requested = positionalArgs(args)[0] ?? "latest";
      const searchOptions: PaperTypeSearchOptions = {
        version: requested,
        limit: Number(readOption(args, "--limit", "50")),
      };
      if (args.includes("--package")) {
        searchOptions.packageName = readOption(args, "--package", "");
      }
      if (args.includes("--contains")) {
        searchOptions.contains = readOption(args, "--contains", "");
      }
      printJson(output, searchPaperTypes(searchOptions));
      return 0;
    }

    if (command === "paper-members") {
      const requested = positionalArgs(args)[0] ?? "latest";
      const searchOptions: PaperMemberSearchOptions = {
        version: requested,
        limit: Number(readOption(args, "--limit", "50")),
      };
      if (args.includes("--type")) {
        searchOptions.type = readOption(args, "--type", "");
      }
      if (args.includes("--package")) {
        searchOptions.packageName = readOption(args, "--package", "");
      }
      if (args.includes("--contains")) {
        searchOptions.contains = readOption(args, "--contains", "");
      }
      if (args.includes("--kind")) {
        const kind = readOption(args, "--kind", "");
        if (
          kind !== "method" &&
          kind !== "constructor" &&
          kind !== "field-or-enum-constant" &&
          kind !== "unknown"
        ) {
          throw new Error(
            "paper-members --kind must be method, constructor, field-or-enum-constant, or unknown",
          );
        }
        searchOptions.kind = kind;
      }
      printJson(output, searchPaperMembers(searchOptions));
      return 0;
    }

    if (command === "compare-paper-api-surface") {
      const [from, to] = positionalArgs(args);
      if (!from || !to) {
        throw new Error("compare-paper-api-surface command requires <from> and <to>");
      }
      printJson(output, comparePaperApiSurface(from, to));
      return 0;
    }

    if (command === "references") {
      const domain = args.includes("--domain") ? readOption(args, "--domain", "") : undefined;
      for (const reference of listReferences(domain)) {
        output.write(`${reference.domain}\t${reference.id}\t${reference.path}`);
      }
      return 0;
    }

    if (command === "catalog-search") {
      const query = positionalArgs(args).join(" ");
      if (!query) {
        throw new Error("search command requires a query");
      }
      printJson(
        output,
        searchCatalog({
          query,
          ...(args.includes("--domain") ? { domain: readOption(args, "--domain", "") } : {}),
          ...(args.includes("--kind")
            ? { kind: readOption(args, "--kind", "") as CatalogSearchKind }
            : {}),
          ...(args.includes("--limit") ? { limit: Number(readOption(args, "--limit", "10")) } : {}),
        }),
      );
      return 0;
    }

    if (command === "domain") {
      const domain = args[0];
      if (!domain) {
        throw new Error("domain command requires a domain id");
      }
      printJson(output, getDomain(domain));
      return 0;
    }

    if (command === "paper") {
      printJson(output, getPaperPluginData());
      return 0;
    }

    if (command === "source-policy") {
      printJson(output, getSourcePolicy());
      return 0;
    }

    if (command === "source-report") {
      const [domain, positionalVersion] = positionalArgs(args);
      const version = readOption(args, "--version", positionalVersion ?? "");
      printJson(
        output,
        getSourceReport({
          ...(domain ? { domain } : {}),
          edition: readOption(args, "--edition", "java"),
          ...(version ? { version } : {}),
        }),
      );
      return 0;
    }

    if (command === "source-tiers") {
      printJson(output, listSourceTiers());
      return 0;
    }

    if (command === "source-tier") {
      const id = args[0];
      if (!id) {
        throw new Error("source tier command requires an id");
      }
      printJson(output, getSourceTier(id));
      return 0;
    }

    if (command === "community-datasets") {
      printJson(output, listCommunityDatasets());
      return 0;
    }

    if (command === "community-dataset") {
      const id = args[0];
      if (!id) {
        throw new Error("source dataset command requires an id");
      }
      printJson(output, getCommunityDataset(id));
      return 0;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    output.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (isDirectRun(import.meta.url)) {
  process.exitCode = await runCli(process.argv.slice(2));
}
