#!/usr/bin/env node
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CommandComparisonOptions,
  type CommandSearchOptions,
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
  getCoverageSummary,
  getDataManifest,
  getDatapackSchemaSurface,
  getDomain,
  getEvidenceBundle,
  getFactSurface,
  getIntentLookup,
  getJavaReportsSummary,
  getOutputRequirement,
  getPaperApiIndex,
  getPaperApiReference,
  getPaperApiSurface,
  getPaperPluginData,
  getResourcepackModelSummary,
  getResponsePattern,
  getSkillPayload,
  getSourcePolicy,
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
  listDomains,
  listFactSurfaces,
  listIntentLookups,
  listOutputRequirements,
  listPackFormats,
  listReferences,
  listResponsePatterns,
  listSkills,
  listVersionSupport,
  listVersions,
  type PaperMemberSearchOptions,
  type PaperTypeSearchOptions,
  type ResourcepackModelPathSearchOptions,
  resolveVersion,
  searchAuthoringScenarios,
  searchCommands,
  searchDatapackSchema,
  searchPaperEvents,
  searchPaperMembers,
  searchPaperTypes,
  searchResourcepackModelPaths,
  searchVanillaPaths,
  type VanillaPathComparisonOptions,
  type VanillaPathSearchOptions,
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

function withDefaultDomain(args: string[], domain: "datapack" | "resourcepack"): string[] {
  return args.includes("--domain") ? args : [...args, "--domain", domain];
}

function normalizeSubcommands(argv: string[]): string[] {
  const [group, subcommand, ...rest] = argv;
  if (!group || !subcommand || subcommand.startsWith("-")) {
    return argv;
  }

  const groupedCommand = `${group} ${subcommand}`;
  const aliases: Record<string, string> = {
    "authoring context": "authoring-context",
    "authoring search-scenarios": "authoring-scenario-search",
    "authoring scenario-search": "authoring-scenario-search",
    "authoring scenarios": "authoring-scenarios",
    "authoring scenario": "authoring-scenario",
    "authoring plan": "authoring-plan",
    "authoring recipes": "authoring-recipes",
    "authoring recipe": "authoring-recipe",
    "authoring checklists": "authoring-checklists",
    "authoring checklist": "authoring-checklist",
    "authoring guardrails": "authoring-guardrails",
    "authoring guardrail": "authoring-guardrail",
    "authoring diagnostics": "authoring-diagnostics",
    "authoring diagnostic": "authoring-diagnostic",
    "authoring preflight": "preflight",
    "authoring evidence": "evidence",
    "authoring intents": "intent-lookups",
    "authoring intent": "intent-lookup",
    "authoring fact-surfaces": "fact-surfaces",
    "authoring fact-surface": "fact-surface",
    "authoring claim-policies": "claim-policies",
    "authoring claim-policy": "claim-policy",
    "authoring output-requirements": "output-requirements",
    "authoring output-requirement": "output-requirement",
    "authoring response-patterns": "response-patterns",
    "authoring response-pattern": "response-pattern",
    "data manifest": "data-manifest",
    "data fetch": "fetch-data",
    "data cache-dir": "cache-dir",
    "data cache-list": "cache-list",
    "data cache-clean": "cache-clean",
    "data coverage": "coverage",
    "data support-matrix": "support-matrix",
    "version latest": "latest",
    "version list": "versions",
    "version show": "show-version",
    "version compare": "compare-versions",
    "version support": "version-support",
    "version pack-formats": "pack-formats",
    "datapack server-reports": "server-reports",
    "datapack schema": "datapack-schema",
    "datapack search-schema": "search-datapack-schema",
    "datapack compare-schema": "compare-datapack-schema",
    "datapack commands": "commands",
    "datapack compare-commands": "compare-commands",
    "datapack vanilla-inventory": "vanilla-inventory",
    "resourcepack models": "resourcepack-models",
    "resourcepack search-models": "search-models",
    "resourcepack vanilla-inventory": "vanilla-inventory",
    "paper api": "paper-api",
    "paper api-index": "paper-api-index",
    "paper compare-api": "compare-paper-api",
    "paper api-surface": "paper-api-surface",
    "paper types": "paper-types",
    "paper members": "paper-members",
    "paper compare-api-surface": "compare-paper-api-surface",
    "paper events": "paper-events",
    "paper info": "paper",
    "skill list": "skills",
    "skill show": "skill",
    "skill write": "write-skill",
    "reference list": "references",
    "domain list": "domains",
    "domain show": "domain",
    "source policy": "source-policy",
  };

  if (groupedCommand === "datapack vanilla-paths") {
    return ["vanilla-paths", ...withDefaultDomain(rest, "datapack")];
  }
  if (groupedCommand === "datapack compare-vanilla-paths") {
    return ["compare-vanilla-paths", ...withDefaultDomain(rest, "datapack")];
  }
  if (groupedCommand === "resourcepack vanilla-paths") {
    return ["vanilla-paths", ...withDefaultDomain(rest, "resourcepack")];
  }
  if (groupedCommand === "resourcepack compare-vanilla-paths") {
    return ["compare-vanilla-paths", ...withDefaultDomain(rest, "resourcepack")];
  }

  const command = aliases[groupedCommand];
  return command ? [command, ...rest] : argv;
}

const flatCommandSuggestions: Record<string, string> = {
  domains: "domain list",
  skills: "skill list",
  skill: "skill show",
  "write-skill": "skill write",
  "authoring-checklists": "authoring checklists",
  "authoring-checklist": "authoring checklist",
  "authoring-recipes": "authoring recipes",
  "authoring-recipe": "authoring recipe",
  "authoring-scenario-search": "authoring search-scenarios",
  "authoring-scenarios": "authoring scenarios",
  "authoring-scenario": "authoring scenario",
  "authoring-plan": "authoring plan",
  "authoring-guardrails": "authoring guardrails",
  "authoring-guardrail": "authoring guardrail",
  "authoring-diagnostics": "authoring diagnostics",
  "authoring-diagnostic": "authoring diagnostic",
  "authoring-context": "authoring context",
  "claim-policies": "authoring claim-policies",
  "claim-policy": "authoring claim-policy",
  "output-requirements": "authoring output-requirements",
  "output-requirement": "authoring output-requirement",
  "response-patterns": "authoring response-patterns",
  "response-pattern": "authoring response-pattern",
  preflight: "authoring preflight",
  evidence: "authoring evidence",
  "intent-lookups": "authoring intents",
  "intent-lookup": "authoring intent",
  "fact-surfaces": "authoring fact-surfaces",
  "fact-surface": "authoring fact-surface",
  coverage: "data coverage",
  "data-manifest": "data manifest",
  "support-matrix": "data support-matrix",
  "version-support": "version support",
  "cache-dir": "data cache-dir",
  "cache-list": "data cache-list",
  "cache-clean": "data cache-clean",
  "fetch-data": "data fetch",
  latest: "version latest",
  versions: "version list",
  "pack-formats": "version pack-formats",
  "show-version": "version show",
  "compare-versions": "version compare",
  "server-reports": "datapack server-reports",
  "datapack-schema": "datapack schema",
  "search-datapack-schema": "datapack search-schema",
  "compare-datapack-schema": "datapack compare-schema",
  commands: "datapack commands",
  "compare-commands": "datapack compare-commands",
  "resourcepack-models": "resourcepack models",
  "search-models": "resourcepack search-models",
  "vanilla-inventory": "datapack vanilla-inventory or resourcepack vanilla-inventory",
  "vanilla-paths": "datapack vanilla-paths or resourcepack vanilla-paths",
  "compare-vanilla-paths": "datapack compare-vanilla-paths or resourcepack compare-vanilla-paths",
  "paper-api": "paper api",
  "paper-api-index": "paper api-index",
  "compare-paper-api": "paper compare-api",
  "paper-api-surface": "paper api-surface",
  "paper-types": "paper types",
  "paper-members": "paper members",
  "compare-paper-api-surface": "paper compare-api-surface",
  "paper-events": "paper events",
  paper: "paper info",
  references: "reference list",
  domain: "domain show",
  "source-policy": "source policy",
};

const commandGroups = new Set([
  "authoring",
  "data",
  "version",
  "datapack",
  "resourcepack",
  "paper",
  "skill",
  "reference",
  "domain",
  "source",
]);

function printHelp(output: Output): void {
  output.write(`minecraft-skills

Version-aware Minecraft authoring facts for AI agents and pack/plugin authors.
All fact commands print JSON unless noted. Treat missing, unknown, or not-extracted fields as gaps,
not permission to guess.

Usage:
  minecraft-skills <group> <command> [options]
  minecraft-skills help

Start here:
  minecraft-skills authoring context <domain> [version]
      Broad preflight payload for one domain/version: checklist, recipes, scenarios, diagnostics,
      claim policies, response patterns, intent routing, evidence, and warnings.
  minecraft-skills authoring search-scenarios <query> [--domain <domain>]
      Route a user task to existing scenarios using scenario, recipe, and intent text.
  minecraft-skills authoring plan <scenario-id> [version]
      Resolve one scenario into exact recipes, intent lookups, diagnostics, claim policies,
      fact surfaces, response patterns, and optional version evidence.
  minecraft-skills authoring preflight <domain> [version]
      Check target-version coverage, support gaps, downloadable surfaces, and warnings before
      generating files or code.
  minecraft-skills authoring evidence <domain> [version]
      Print source policy, data files, links, and warnings for provenance-aware answers.

Domains:
  datapack        Java data packs: commands, server reports, pack formats, vanilla data paths,
                  and observed datapack JSON shapes.
  resourcepack    Java resource packs: pack formats, vanilla asset paths, model summaries,
                  and observed item/model shapes.
  paper-plugin    Paper-first plugins: Paper support, Javadocs indexes/surfaces, API names,
                  event candidates, and Folia/threading caveats.

Common workflows:
  Pick a safe workflow for a task:
    minecraft-skills authoring search-scenarios "Paper event listener" --domain paper-plugin
    minecraft-skills authoring plan paper-event-listener-review 1.21.11

  Generate or review a datapack function:
    minecraft-skills authoring context datapack 26.2
    minecraft-skills datapack commands 26.2 --prefix execute --contains run

  Check resource pack paths and model shapes:
    minecraft-skills authoring preflight resourcepack 26.2
    minecraft-skills resourcepack vanilla-paths 26.2 --contains models/item
    minecraft-skills resourcepack search-models 26.2 --kind item-definition --contains bundle

  Check Paper API names and events:
    minecraft-skills authoring preflight paper-plugin 1.21.11
    minecraft-skills paper types 1.21.11 --contains org.bukkit.entity.Player
    minecraft-skills paper members 1.21.11 --type org.bukkit.entity.Player --contains sendMessage
    minecraft-skills paper events "player join" --version 1.21.11

Safety notes:
  - Command paths prove parser shape, not gameplay success, permissions, or runtime behavior.
  - Vanilla path matches prove bundled vanilla file presence, not custom content validity.
  - Observed JSON/model surfaces are not normative schemas.
  - Paper Javadocs indexes prove API name presence, not behavior, nullability, overload semantics,
    thread safety, or Folia safety.
  - Paper event search results are candidates until checked against Paper/Bukkit API surfaces.

Grouped commands:
  minecraft-skills authoring context <datapack|resourcepack|paper-plugin> [version] [--edition java]
  minecraft-skills authoring search-scenarios <query> [--domain datapack|resourcepack|paper-plugin] [--limit 10]
  minecraft-skills authoring plan <scenario-id> [version] [--edition java]
  minecraft-skills authoring preflight <datapack|resourcepack|paper-plugin> [version] [--edition java]
  minecraft-skills authoring evidence <datapack|resourcepack|paper-plugin> [version] [--edition java]
  minecraft-skills authoring recipes|recipe|scenarios|scenario|checklists|checklist|guardrails|guardrail|diagnostics|diagnostic
  minecraft-skills authoring intents|intent|fact-surfaces|fact-surface|claim-policies|claim-policy
  minecraft-skills authoring output-requirements|output-requirement|response-patterns|response-pattern
  minecraft-skills datapack commands [version] [--contains text] [--prefix literal] [--parser parser] [--limit 50]
  minecraft-skills datapack schema [version] [--edition java]
  minecraft-skills datapack search-schema [version] [--kind kind] [--path field.path] [--contains text] [--limit 50]
  minecraft-skills datapack compare-schema <from> <to> [--kind kind] [--contains text] [--limit 50]
  minecraft-skills datapack server-reports [version] [--edition java]
  minecraft-skills datapack vanilla-inventory [version] [--edition java]
  minecraft-skills datapack vanilla-paths [version] [--prefix path] [--contains text] [--extension json] [--limit 50]
  minecraft-skills resourcepack vanilla-paths [version] [--prefix path] [--contains text] [--extension json] [--limit 50]
  minecraft-skills resourcepack models [version] [--edition java]
  minecraft-skills resourcepack search-models [version] [--kind model|item-definition] [--contains text] [--prefix path] [--limit 50]
  minecraft-skills paper info
  minecraft-skills paper api|api-index|api-surface [version]
  minecraft-skills paper types [version] [--package package.name] [--contains text] [--limit 50]
  minecraft-skills paper members [version] [--type qualified.Type] [--package package.name] [--kind method|constructor|field-or-enum-constant|unknown] [--contains text] [--limit 50]
  minecraft-skills paper events <query> [--version latest] [--source paper] [--limit 20]
  minecraft-skills version latest|list|show|compare|support|pack-formats
  minecraft-skills data manifest|fetch|cache-dir|cache-list|cache-clean|coverage|support-matrix
  minecraft-skills skill list|show|write
  minecraft-skills reference list [--domain datapack|resourcepack|paper-plugin]
  minecraft-skills domain show <datapack|resourcepack|paper-plugin>
  minecraft-skills source policy

Command reference:
  domain list    List supported authoring domains.
  skill list     List installable Agent Skill folders in this repository.
  skill show     Print packaged Agent Skill payload JSON.
  skill write    Write a packaged Agent Skill folder to disk.
  authoring context
                 Print preflight, recipes, diagnostics, intent lookups, and evidence for a domain.
  authoring search-scenarios
                 Search scenarios by task wording using scenario, recipe, and intent text.
  authoring plan
                 Print one scenario with all required lookups resolved.
  authoring preflight
                 Print resolved version, checklist, fact surfaces, coverage, and warnings.
  authoring evidence
                 Print source policy, primary sources, data files, links, and warnings.
  authoring checklists|checklist|recipes|recipe|scenarios|scenario
                 Inspect domain checklists, ordered workflows, and realistic task shapes.
  authoring guardrails|guardrail|diagnostics|diagnostic
                 Inspect output rules and pre-finalization diagnostics.
  authoring claim-policies|claim-policy|output-requirements|output-requirement
                 Inspect required evidence and final-output checks.
  authoring response-patterns|response-pattern|intents|intent|fact-surfaces|fact-surface
                 Inspect answer patterns, intent routing, and fact-surface guarantees.
  data coverage|manifest|support-matrix
                 Print bundled coverage, downloadable data manifest, or support matrix JSON.
  data cache-dir|cache-list|cache-clean|fetch
                 Inspect, clean, or download SHA-256 verified cache data.
  version latest|list|pack-formats|show|compare|support
                 Inspect bundled version metadata and per-domain version support.
  datapack server-reports|vanilla-inventory|schema|search-schema|compare-schema|commands|compare-commands
                 Inspect command paths and observed datapack JSON shapes.
  datapack vanilla-paths|compare-vanilla-paths
                 Search or compare bundled vanilla datapack paths.
  resourcepack vanilla-inventory|vanilla-paths|compare-vanilla-paths|models|search-models
                 Inspect vanilla assets, model summaries, and item/model paths.
  paper info|api|api-index|compare-api|api-surface|types|members|compare-api-surface|events
                 Inspect Paper support, Javadocs-derived API surfaces, and event candidates.
  reference list Print generated skill references.
  domain show    Print canonical JSON for an authoring domain.
  source policy  Print source and license policy JSON.

Options:
  --domain <domain>      Filter to datapack, resourcepack, or paper-plugin where supported.
  --edition java         Select edition. Only java is currently supported.
  --version <version>    Select a version for commands that accept named options.
  --limit <n>            Limit search results. Search commands validate their own maximums.
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
  const normalizedArgv = normalizeSubcommands(argv);
  if (commandGroups.has(argv[0] ?? "") && hasSubcommand && normalizedArgv === argv) {
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

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    output.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (isDirectRun(import.meta.url)) {
  process.exitCode = await runCli(process.argv.slice(2));
}
