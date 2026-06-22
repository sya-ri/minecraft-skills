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
  getCacheDataRoot,
  getCacheRoot,
  getCoverageSummary,
  getDataManifest,
  getDatapackSchemaSurface,
  getDomain,
  getFactSurface,
  getJavaReportsSummary,
  getPaperApiIndex,
  getPaperApiReference,
  getPaperApiSurface,
  getPaperPluginData,
  getResourcepackModelSummary,
  getSkillPayload,
  getSourcePolicy,
  getSupportMatrix,
  getVanillaInventory,
  getVersionDetail,
  listAuthoringChecklists,
  listCachedDataFiles,
  listDomains,
  listFactSurfaces,
  listPackFormats,
  listReferences,
  listSkills,
  listVersions,
  type PaperMemberSearchOptions,
  type PaperTypeSearchOptions,
  type ResourcepackModelPathSearchOptions,
  resolveVersion,
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

function printHelp(output: Output): void {
  output.write(`minecraft-skills

Usage:
  minecraft-skills domains
  minecraft-skills skills [--domain datapack|resourcepack|paper-plugin]
  minecraft-skills skill <name>
  minecraft-skills write-skill <name> --output <dir> [--force]
  minecraft-skills authoring-checklists [--domain datapack|resourcepack|paper-plugin]
  minecraft-skills authoring-checklist <datapack|resourcepack|paper-plugin>
  minecraft-skills fact-surfaces [--domain datapack|resourcepack|paper-plugin]
  minecraft-skills fact-surface <id>
  minecraft-skills coverage
  minecraft-skills data-manifest
  minecraft-skills support-matrix
  minecraft-skills cache-dir
  minecraft-skills cache-list
  minecraft-skills cache-clean
  minecraft-skills fetch-data <kind> [--version version] [--path path] [--base-url url] [--force]
  minecraft-skills latest [--edition java]
  minecraft-skills versions [--edition java]
  minecraft-skills pack-formats [--edition java]
  minecraft-skills show-version [version] [--edition java]
  minecraft-skills compare-versions <from> <to> [--edition java]
  minecraft-skills server-reports [version] [--edition java]
  minecraft-skills datapack-schema [version] [--edition java]
  minecraft-skills search-datapack-schema [version] [--kind kind] [--path field.path] [--contains text] [--limit 50]
  minecraft-skills compare-datapack-schema <from> <to> [--kind kind] [--contains text] [--limit 50]
  minecraft-skills commands [version] [--contains text] [--prefix literal] [--parser parser] [--limit 50]
  minecraft-skills compare-commands <from> <to> [--contains text] [--prefix literal] [--parser parser] [--limit 50]
  minecraft-skills resourcepack-models [version] [--edition java]
  minecraft-skills search-models [version] [--kind model|item-definition] [--contains text] [--prefix path] [--limit 50]
  minecraft-skills vanilla-inventory [version] [--edition java]
  minecraft-skills vanilla-paths [version] [--domain datapack|resourcepack] [--prefix path] [--contains text] [--extension json] [--limit 50]
  minecraft-skills compare-vanilla-paths <from> <to> [--domain datapack|resourcepack] [--prefix path] [--contains text] [--extension json] [--limit 50]
  minecraft-skills paper-api [version]
  minecraft-skills paper-api-index [version]
  minecraft-skills compare-paper-api <from> <to>
  minecraft-skills paper-api-surface [version]
  minecraft-skills paper-types [version] [--package package.name] [--contains text] [--limit 50]
  minecraft-skills paper-members [version] [--type qualified.Type] [--package package.name] [--kind method|constructor|field-or-enum-constant|unknown] [--contains text] [--limit 50]
  minecraft-skills compare-paper-api-surface <from> <to>
  minecraft-skills paper-events <query> [--version latest] [--source paper] [--limit 20]
  minecraft-skills references [--domain datapack|resourcepack|paper-plugin]
  minecraft-skills domain <datapack|resourcepack|paper-plugin>
  minecraft-skills paper
  minecraft-skills source-policy

Commands:
  domains        List supported authoring domains.
  skills         List installable Agent Skill folders in this repository.
  skill          Print packaged Agent Skill payload JSON.
  write-skill    Write a packaged Agent Skill folder to disk.
  authoring-checklists
                 List pre-generation checks for each supported authoring domain.
  authoring-checklist
                 Print the pre-generation checklist for one authoring domain.
  fact-surfaces  List machine-verifiable fact surfaces and their guarantees.
  fact-surface   Print one fact surface by id.
  coverage       Print bundled data coverage summary JSON.
  data-manifest  Print downloadable data manifest JSON.
  support-matrix Print version aliases and bundled/downloadable data support matrix.
  cache-dir      Print the OS cache directory used by minecraft-skills.
  cache-list     Print cached data files for the current data version.
  cache-clean    Remove cached files for the current data version.
  fetch-data     Download manifest data entries into the local cache.
  latest         Print the latest bundled version for an edition.
  versions       List bundled version metadata.
  pack-formats   List data/resource pack formats and Paper support by version.
  show-version   Print canonical JSON for a version.
  compare-versions
                 Compare bundled version metadata and vanilla inventory summaries.
  server-reports
                 Print compact official server reports summary for a bundled version.
  datapack-schema
                 Print observed vanilla datapack JSON schema surface for a bundled version.
  search-datapack-schema
                 Search observed vanilla datapack JSON field paths.
  compare-datapack-schema
                 Compare observed datapack JSON field paths between bundled versions.
  commands       Search executable command syntax paths from generated server reports.
  compare-commands
                 Compare executable command syntax paths between bundled versions.
  resourcepack-models
                 Print compact resource pack model summary for a bundled version.
  search-models  Search vanilla resource pack model and item definition paths.
  vanilla-inventory
                 Print vanilla client asset and server data inventory JSON.
  vanilla-paths  Search bundled vanilla asset/data paths for a version.
  compare-vanilla-paths
                 Compare bundled vanilla asset/data paths between versions.
  paper-api      Print Paper API dependency, Javadocs, and docs links for a version.
  paper-api-index
                 Print Paper Javadocs package index for a supported version.
  compare-paper-api
                 Compare Paper Javadocs package indexes between supported versions.
  paper-api-surface
                 Print Paper Javadocs type and member search-index surface.
  paper-types    Search Paper Javadocs type names.
  paper-members  Search Paper Javadocs member labels by type/package/kind.
  compare-paper-api-surface
                 Compare Paper Javadocs type and member surfaces between versions.
  paper-events   Search Paper/Bukkit events through the configured spigot-event-list API.
  references     List generated skill references.
  domain         Print canonical JSON for an authoring domain.
  paper          Print canonical Paper plugin support and event search JSON.
  source-policy  Print source and license policy JSON.`);
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
  const [command, ...args] = argv;
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
