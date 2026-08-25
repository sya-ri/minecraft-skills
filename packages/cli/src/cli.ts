#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeMinecraftLog,
  blockbenchProjectInspectionLimits,
  type CatalogSearchKind,
  type CommandComparisonOptions,
  type CommandSearchOptions,
  classifyPackFiles,
  cleanCachedData,
  cleanMojangServerJar,
  compareCommands,
  compareDatapackSchema,
  comparePaperApi,
  comparePaperApiSurface,
  compareRegistryEntries,
  compareVanillaPaths,
  compareVersions,
  type DatapackSchemaComparisonOptions,
  type DatapackSchemaSearchOptions,
  defaultFabricModValidationLimits,
  defaultMinecraftLogAnalysisLimits,
  defaultModrinthPackValidationLimits,
  defaultResourcepackPngAlphaBoundsLimits,
  defaultResourcepackPngValidationLimits,
  defaultResourcepackProjectValidationLimits,
  defaultServerAccessListValidationLimits,
  downloadJavaPlayerTexture,
  explainPackPath,
  fetchData,
  fetchMinecraftAssetFile,
  fetchMinecraftAssetsArchive,
  fetchMinecraftAssetsIndex,
  fetchMojangServerJarForVersion,
  findDatapackEntries,
  findResourcepackAssets,
  findVersionsByPackFormat,
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
  getFabricToolchainCompatibility,
  getFactSurface,
  getIntentLookup,
  getJavaReportsSummary,
  getMinecraftAssetsStatus,
  getModrinthResource,
  getMojangServerJarStatus,
  getOutputRequirement,
  getPackFileSchema,
  getPackFormat,
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
  getVanillaDatapackJson,
  getVanillaInventory,
  getVerifiedJavaPlayerTextures,
  getVersionDetail,
  inferServerAccessListKind,
  inspectBlockbenchProject,
  inspectResourcepackPngAlphaBounds,
  type JavaPlayerTextureKind,
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
  listModrinthProjectVersions,
  listOutputRequirements,
  listPackFormats,
  listReferences,
  listResponsePatterns,
  listSkills,
  listSourceTiers,
  listVersionSupport,
  listVersions,
  lookupJavaPlayerProfileByName,
  type MinecraftLogAnalysisLimits,
  type PaperMemberSearchOptions,
  type PaperTypeSearchOptions,
  type PlayerSkinSourceRectangleInput,
  paperPluginJarValidationLimits,
  playerSkinLayoutValidationLimits,
  type RegistryEntryComparisonOptions,
  type RegistryEntrySearchOptions,
  type ResourcepackModelPathSearchOptions,
  type ResourcepackPngAlphaBoundsLimits,
  type ResourcepackPngValidationLimits,
  resolveModrinthCompatibility,
  resolveResourcepackPngAlphaBoundsLimits,
  resolveResourcepackPngValidationLimits,
  resolveVelocityToolchain,
  resolveVersion,
  type ServerAccessListKind,
  searchAll,
  searchAuthoringScenarios,
  searchCatalog,
  searchCommands,
  searchDatapackSchema,
  searchMinecraftAssets,
  searchModrinthProjects,
  searchPaperEvents,
  searchPaperMembers,
  searchPaperTypes,
  searchRegistryEntries,
  searchResourcepackModelPaths,
  searchVanillaDatapackJsonContent,
  searchVanillaDatapackJsonFiles,
  searchVanillaPaths,
  serverAccessListKinds,
  suggestMinecraftLookups,
  type VanillaPathComparisonOptions,
  type VanillaPathSearchOptions,
  validateDatapackProject,
  validateFabricModJar,
  validateMixinConfig,
  validateModrinthPackArchive,
  validatePackFilesContent,
  validatePaperPluginJar,
  validatePlayerSkinLayout,
  validateResourcepackPng,
  validateResourcepackProject,
  validateServerAccessList,
  validateServerProperties,
  validateVelocityPluginJar,
  velocityPluginJarValidationLimits,
} from "@minecraft-skills/catalog";
import {
  createRconConfig,
  getRconConfigStatus,
  type RconPermissionPreset,
  runRconCommand,
} from "@minecraft-skills/rcon";
import { readBlockbenchProjectFile } from "./blockbenchProjectFile.js";
import { readBoundedArchiveFile } from "./boundedArchiveFile.js";
import { readDatapackProjectFiles } from "./datapackProjectFiles.js";
import { diffFabricModDirectories, inventoryFabricModsDirectory } from "./fabricModDirectory.js";
import { readFabricModJarFile } from "./fabricModJarFile.js";
import { readBoundedPngFile } from "./filePrefix.js";
import { readBoundedMinecraftLog } from "./minecraftLogFile.js";
import { readMixinConfigCliFiles } from "./mixinConfigFiles.js";
import {
  validateNewPlayerTexturePngPath,
  writeNewPlayerTexturePng,
} from "./playerTextureOutput.js";
import { readResourcepackProjectFiles } from "./resourcepackProjectFiles.js";
import { readServerAccessListFile } from "./serverAccessListFile.js";
import { readBoundedServerProperties } from "./serverPropertiesFile.js";

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

const minecraftLogLimitOptions: Readonly<Record<string, keyof MinecraftLogAnalysisLimits>> = {
  "--max-input-bytes": "maxInputBytes",
  "--max-characters": "maxCharacters",
  "--max-lines": "maxLines",
  "--max-line-characters": "maxLineCharacters",
  "--max-events": "maxEvents",
  "--max-exception-chains": "maxExceptionChains",
  "--max-exception-depth": "maxExceptionDepth",
  "--max-exception-entries": "maxExceptionEntries",
  "--max-stack-frames": "maxStackFrames",
  "--max-platforms": "maxPlatforms",
  "--max-artifacts": "maxArtifacts",
  "--max-components": "maxComponents",
  "--max-text-characters": "maxTextCharacters",
  "--max-retained-text-characters": "maxRetainedTextCharacters",
};

function parseMinecraftLogArgs(args: string[]): {
  filePath: string;
  maxInputBytes: number;
  limits: Partial<MinecraftLogAnalysisLimits>;
} {
  const files: string[] = [];
  const seenOptions = new Set<string>();
  const values = new Map<string, number>();
  const allowedOptions = new Set(Object.keys(minecraftLogLimitOptions));
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (!arg.startsWith("--")) {
      files.push(arg);
      continue;
    }
    if (!allowedOptions.has(arg)) {
      throw new Error(`minecraft analyze-log received unknown option: ${arg}`);
    }
    if (seenOptions.has(arg)) {
      throw new Error(`minecraft analyze-log option must not be repeated: ${arg}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`minecraft analyze-log ${arg} requires a value`);
    }
    const parsed = readIntegerArg(value, `minecraft analyze-log ${arg}`);
    if (parsed < 1) {
      throw new Error(`minecraft analyze-log ${arg} must be at least 1`);
    }
    values.set(arg, parsed);
    seenOptions.add(arg);
    index += 1;
  }
  if (files.length !== 1) {
    throw new Error("minecraft analyze-log requires exactly one <file>");
  }

  const limits: Partial<MinecraftLogAnalysisLimits> = {};
  for (const [option, name] of Object.entries(minecraftLogLimitOptions)) {
    const value = values.get(option);
    if (value === undefined) continue;
    if (value > defaultMinecraftLogAnalysisLimits[name]) {
      throw new Error(
        `minecraft analyze-log ${option} must not exceed ${defaultMinecraftLogAnalysisLimits[name]}`,
      );
    }
    limits[name] = value;
  }
  const maxInputBytes = limits.maxInputBytes ?? defaultMinecraftLogAnalysisLimits.maxInputBytes;
  return { filePath: files[0] ?? "", maxInputBytes, limits };
}

function readOption(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return args[index + 1] ?? fallback;
}

function parsePlayerTextureDownloadArgs(args: string[]): {
  hash: string;
  kind: JavaPlayerTextureKind;
  outputPath: string;
} {
  const options = new Map<string, string>();
  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    if (arg !== "--kind" && arg !== "--output") {
      throw new Error(`player-texture download received unknown option: ${arg}`);
    }
    if (options.has(arg)) {
      throw new Error(`player-texture download option must not be repeated: ${arg}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`player-texture download ${arg} requires a value`);
    }
    options.set(arg, value);
    index += 1;
  }

  const [hash, ...extraPositionals] = positionals;
  if (!hash || extraPositionals.length > 0 || !/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error(
      "player-texture download requires exactly one lowercase 64-hex texture reference hash",
    );
  }
  const kind = options.get("--kind");
  if (kind !== "skin" && kind !== "cape" && kind !== "elytra") {
    throw new Error("player-texture download --kind must be skin, cape, or elytra");
  }
  const outputPath = options.get("--output");
  if (!outputPath) {
    throw new Error("player-texture download requires --output <new.png>");
  }
  return { hash, kind, outputPath };
}

const resourcepackPngValueOptions = [
  "--max-bytes",
  "--max-width",
  "--max-height",
  "--max-pixels",
  "--max-chunks",
  "--max-diagnostics",
] as const;

const resourcepackPngAlphaValueOptions = [
  ...resourcepackPngValueOptions,
  "--max-inflated-bytes",
  "--minimum-transparent-margin-pixels",
] as const;

const maximumMinimumTransparentMarginPixels = Math.max(
  defaultResourcepackPngAlphaBoundsLimits.maxWidth,
  defaultResourcepackPngAlphaBoundsLimits.maxHeight,
);

const playerSkinRectangleValueOptions = ["--base-rect", "--hat-rect"] as const;
const playerSkinLayoutValueOptions = [
  ...resourcepackPngValueOptions,
  ...playerSkinRectangleValueOptions,
] as const;

function readResourcepackPngLimit(
  args: string[],
  option: string,
  fallback: number,
  command: string,
): number {
  if (!args.includes(option)) {
    return fallback;
  }
  const value = readOption(args, option, "");
  if (!/^\d+$/.test(value)) {
    throw new Error(`${command} ${option} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || fallback < parsed) {
    throw new Error(`${command} ${option} must be between 1 and ${fallback}`);
  }
  return parsed;
}

function readResourcepackPngLimits(
  args: string[],
  command = "resourcepack validate-png",
): ResourcepackPngValidationLimits {
  return resolveResourcepackPngValidationLimits({
    maxInputBytes: readResourcepackPngLimit(
      args,
      "--max-bytes",
      defaultResourcepackPngValidationLimits.maxInputBytes,
      command,
    ),
    maxWidth: readResourcepackPngLimit(
      args,
      "--max-width",
      defaultResourcepackPngValidationLimits.maxWidth,
      command,
    ),
    maxHeight: readResourcepackPngLimit(
      args,
      "--max-height",
      defaultResourcepackPngValidationLimits.maxHeight,
      command,
    ),
    maxPixels: readResourcepackPngLimit(
      args,
      "--max-pixels",
      defaultResourcepackPngValidationLimits.maxPixels,
      command,
    ),
    maxChunks: readResourcepackPngLimit(
      args,
      "--max-chunks",
      defaultResourcepackPngValidationLimits.maxChunks,
      command,
    ),
    maxDiagnostics: readResourcepackPngLimit(
      args,
      "--max-diagnostics",
      defaultResourcepackPngValidationLimits.maxDiagnostics,
      command,
    ),
  });
}

function readResourcepackPngAlphaLimits(args: string[]): ResourcepackPngAlphaBoundsLimits {
  const command = "resourcepack inspect-png-alpha";
  return resolveResourcepackPngAlphaBoundsLimits({
    ...readResourcepackPngLimits(args, command),
    maxInflatedBytes: readResourcepackPngLimit(
      args,
      "--max-inflated-bytes",
      defaultResourcepackPngAlphaBoundsLimits.maxInflatedBytes,
      command,
    ),
  });
}

function readMinimumTransparentMarginPixels(args: string[]): number | undefined {
  const option = "--minimum-transparent-margin-pixels";
  if (!args.includes(option)) {
    return undefined;
  }
  const value = readOption(args, option, "");
  if (!/^\d+$/.test(value)) {
    throw new Error(`resourcepack inspect-png-alpha ${option} must be a non-negative integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || maximumMinimumTransparentMarginPixels < parsed) {
    throw new Error(
      `resourcepack inspect-png-alpha ${option} must be between 0 and ${maximumMinimumTransparentMarginPixels}`,
    );
  }
  return parsed;
}

function readPlayerSkinRectangleOption(
  args: string[],
  option: (typeof playerSkinRectangleValueOptions)[number],
): PlayerSkinSourceRectangleInput | undefined {
  const indexes = args.flatMap((value, index) => (value === option ? [index] : []));
  if (indexes.length === 0) return undefined;
  if (indexes.length > 1) {
    throw new Error(`player-skin validate-layout option must not be repeated: ${option}`);
  }
  const value = args[(indexes[0] ?? 0) + 1];
  if (!value || !/^\d+,\d+,\d+,\d+$/.test(value)) {
    throw new Error(`${option} must be x,y,width,height using non-negative integers`);
  }
  const [x, y, width, height] = value.split(",").map(Number) as [number, number, number, number];
  const rectangle = { x, y, width, height };
  if (
    !Object.values(rectangle).every(Number.isSafeInteger) ||
    x < 0 ||
    y < 0 ||
    width < 1 ||
    height < 1 ||
    Object.values(rectangle).some(
      (coordinate) => playerSkinLayoutValidationLimits.maxCoordinate < coordinate,
    )
  ) {
    throw new Error(
      `${option} coordinates must be within 0..${playerSkinLayoutValidationLimits.maxCoordinate}, with positive width and height`,
    );
  }
  return { x, y, width, height };
}

function readBooleanOption(args: string[], name: string, fallback: boolean): boolean {
  return readBooleanValue(readOption(args, name, String(fallback)), name);
}

function readBooleanValue(value: string, name: string): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}

function readRepeatedOption(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) {
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${name} requires a value`);
    }
    values.push(value);
    index += 1;
  }
  return values;
}

const modrinthCompatibilityValueOptions = new Set([
  "--game-version",
  "--loader",
  "--featured",
  "--limit",
  "--timeout-ms",
]);

function parseModrinthCompatibilityArgs(args: string[]): {
  projects: string[];
  options: Map<string, string>;
} {
  const projects: string[] = [];
  const options = new Map<string, string>();
  let projectsOnly = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (!projectsOnly && arg === "--") {
      projectsOnly = true;
      continue;
    }
    if (projectsOnly || !arg.startsWith("--")) {
      projects.push(arg);
      continue;
    }
    if (!modrinthCompatibilityValueOptions.has(arg)) {
      throw new Error(`modrinth compatibility received unknown option: ${arg}`);
    }
    if (options.has(arg)) {
      throw new Error(`modrinth compatibility option must not be repeated: ${arg}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`modrinth compatibility ${arg} requires a value`);
    }
    options.set(arg, value);
    index += 1;
  }
  return { projects, options };
}

function parseServerPropertiesArgs(args: string[]): {
  path: string;
  targetVersion?: string;
} {
  const paths: string[] = [];
  let targetVersion: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument) continue;
    if (argument === "--version") {
      if (targetVersion !== undefined) {
        throw new Error("server validate-properties --version must not be repeated");
      }
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("server validate-properties --version requires a value");
      }
      targetVersion = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    }
    paths.push(argument);
  }
  if (1 < paths.length) {
    throw new Error("server validate-properties accepts at most one local server.properties file");
  }
  return { path: paths[0] ?? "server.properties", ...(targetVersion ? { targetVersion } : {}) };
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

function positionalArgsWithoutOptions(args: string[]): string[] {
  for (const arg of args) {
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return args;
}

function positionalArgsWithOptions(
  args: string[],
  options: {
    flags?: readonly string[];
    values?: readonly string[];
  } = {},
): string[] {
  const flags = new Set(options.flags ?? []);
  const values = new Set(["--edition", ...(options.values ?? [])]);
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }
    if (flags.has(arg)) {
      continue;
    }
    if (values.has(arg)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    positional.push(arg);
  }

  return positional;
}

function parseBlockbenchInspectionArgs(args: string[]): {
  filePath: string;
  requiredAnimations: string[];
  requiredGroups: string[];
  limit: number;
} {
  const positionals: string[] = [];
  const requiredAnimations: string[] = [];
  const requiredGroups: string[] = [];
  let limit = 100;
  let limitSeen = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument) {
      continue;
    }
    if (argument === "--require-animation" || argument === "--require-group") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`blockbench inspect-project ${argument} requires a value`);
      }
      (argument === "--require-animation" ? requiredAnimations : requiredGroups).push(value);
      index += 1;
      continue;
    }
    if (argument === "--limit") {
      if (limitSeen) {
        throw new Error("blockbench inspect-project --limit must not be repeated");
      }
      const value = args[index + 1];
      if (!value || !/^\d+$/u.test(value)) {
        throw new Error("blockbench inspect-project --limit requires a positive integer");
      }
      limit = Number(value);
      if (
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        blockbenchProjectInspectionLimits.maxDiagnostics < limit
      ) {
        throw new Error(
          `blockbench inspect-project --limit must be between 1 and ${blockbenchProjectInspectionLimits.maxDiagnostics}`,
        );
      }
      limitSeen = true;
      index += 1;
      continue;
    }
    if (argument.startsWith("--")) {
      throw new Error("blockbench inspect-project received an unknown option");
    }
    positionals.push(argument);
  }
  if (positionals.length !== 1) {
    throw new Error("blockbench inspect-project requires exactly one local .bbmodel file");
  }
  return {
    filePath: positionals[0] as string,
    requiredAnimations,
    requiredGroups,
    limit,
  };
}

function readPackFormatDomain(value: string): "datapack" | "resourcepack" {
  if (value === "datapack" || value === "resourcepack") {
    return value;
  }
  throw new Error("pack format domain must be datapack or resourcepack");
}

function readIntegerArg(value: string | undefined, label: string): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return Number(value);
}

function readOptionalAuthoringDomain(
  value: string,
): "datapack" | "resourcepack" | "paper-plugin" | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "datapack" || value === "resourcepack" || value === "paper-plugin") {
    return value;
  }
  throw new Error("domain must be datapack, resourcepack, or paper-plugin");
}

function readResourcepackAssetKind(
  value: string,
):
  | "model"
  | "item-definition"
  | "texture"
  | "sound"
  | "language"
  | "blockstate"
  | "atlas"
  | "font"
  | "any" {
  if (
    value === "model" ||
    value === "item-definition" ||
    value === "texture" ||
    value === "sound" ||
    value === "language" ||
    value === "blockstate" ||
    value === "atlas" ||
    value === "font" ||
    value === "any"
  ) {
    return value;
  }
  throw new Error("resourcepack assets find --kind is invalid");
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
  if (group === "fabric" && subcommand === "mods") {
    const [modsSubcommand, ...modsRest] = rest;
    if (modsSubcommand === "inventory") {
      return ["fabric-mods-inventory", ...modsRest];
    }
    if (modsSubcommand === "diff") {
      return ["fabric-mods-diff", ...modsRest];
    }
    return argv;
  }
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
    "minecraft pack-format": "pack-format",
    "minecraft versions-for-pack-format": "versions-for-pack-format",
    "minecraft vanilla-inventory": "vanilla-inventory",
    "minecraft sources": "source-report",
    "minecraft search": "catalog-search",
    "minecraft search-all": "search-all",
    "minecraft registry-entries": "registry-entries",
    "minecraft compare-registry-entries": "compare-registry-entries",
    "minecraft explain-path": "explain-path",
    "minecraft suggest-lookups": "suggest-lookups",
    "minecraft analyze-log": "analyze-minecraft-log",
    "minecraft validate-access-list": "validate-server-access-list",
    "minecraft validate-mixin-config": "validate-mixin-config",
    "fabric toolchain": "fabric-toolchain",
    "velocity toolchain": "velocity-toolchain",
    "fabric validate-mod": "fabric-validate-mod",
    "blockbench inspect-project": "blockbench-inspect-project",
    "modrinth search": "modrinth-search",
    "modrinth versions": "modrinth-versions",
    "modrinth compatibility": "modrinth-compatibility",
    "modrinth get": "modrinth-get",
    "modrinth validate-pack": "modrinth-validate-pack",
    "server validate-properties": "server-validate-properties",
    "datapack server-reports": "server-reports",
    "datapack schema": "datapack-schema",
    "datapack search-schema": "search-datapack-schema",
    "datapack compare-schema": "compare-datapack-schema",
    "datapack classify-files": "classify-files",
    "datapack file-schema": "file-schema",
    "datapack validate-files": "validate-files",
    "datapack validate-project": "validate-datapack-project",
    "datapack migration-plan": "migration-plan",
    "datapack find": "datapack-find",
    "datapack commands": "commands",
    "datapack compare-commands": "compare-commands",
    "resourcepack models": "resourcepack-models",
    "resourcepack classify-files": "classify-files",
    "resourcepack file-schema": "file-schema",
    "resourcepack validate-files": "validate-files",
    "resourcepack inspect-png-alpha": "inspect-resourcepack-png-alpha",
    "resourcepack validate-png": "validate-resourcepack-png",
    "resourcepack validate-project": "validate-resourcepack-project",
    "resourcepack migration-plan": "migration-plan",
    "resourcepack search-models": "search-models",
    "player-skin validate-layout": "validate-player-skin-layout",
    "player-texture download": "download-player-texture",
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
    "rcon status": "rcon-status",
    "rcon init": "rcon-init",
    "rcon run": "rcon-run",
    "player-profile lookup-name": "player-profile-lookup-name",
    "player-profile textures": "player-profile-textures",
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
  if (group === "datapack" && subcommand === "vanilla-json") {
    const [jsonSubcommand, ...jsonRest] = rest;
    const jsonAliases: Record<string, string> = {
      status: "vanilla-datapack-json-status",
      fetch: "vanilla-datapack-json-fetch",
      clean: "vanilla-datapack-json-clean",
      files: "vanilla-datapack-json-files",
      get: "vanilla-datapack-json-get",
      search: "vanilla-datapack-json-search",
    };
    const command = jsonAliases[jsonSubcommand ?? ""];
    return command ? [command, ...jsonRest] : argv;
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
  if (group === "resourcepack" && subcommand === "assets") {
    const [assetSubcommand, ...assetRest] = rest;
    const assetAliases: Record<string, string> = {
      status: "resourcepack-assets-status",
      fetch: "resourcepack-assets-fetch",
      search: "resourcepack-assets-search",
      find: "resourcepack-assets-find",
      related: "resourcepack-assets-related",
      get: "resourcepack-assets-get",
    };
    const command = assetAliases[assetSubcommand ?? ""];
    return command ? [command, ...assetRest] : argv;
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
      "validate-jar": "paper-validate-jar",
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
  if (group === "plugin" && subcommand === "velocity") {
    const [velocitySubcommand, ...velocityRest] = rest;
    if (velocitySubcommand === "validate-jar") {
      return ["velocity-validate-jar", ...velocityRest];
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
  "registry-entries": "minecraft registry-entries",
  "compare-registry-entries": "minecraft compare-registry-entries",
  "validate-server-access-list": "minecraft validate-access-list",
  "validate-mixin-config": "minecraft validate-mixin-config",
  "server-reports": "datapack server-reports",
  "datapack-schema": "datapack schema",
  "search-datapack-schema": "datapack search-schema",
  "compare-datapack-schema": "datapack compare-schema",
  "classify-files": "datapack classify-files or resourcepack classify-files",
  "file-schema": "datapack file-schema or resourcepack file-schema",
  "validate-files": "datapack validate-files or resourcepack validate-files",
  "inspect-resourcepack-png-alpha": "resourcepack inspect-png-alpha",
  "validate-resourcepack-png": "resourcepack validate-png",
  "validate-datapack-project": "datapack validate-project",
  "validate-resourcepack-project": "resourcepack validate-project",
  "validate-player-skin-layout": "player-skin validate-layout",
  "download-player-texture": "player-texture download",
  "analyze-minecraft-log": "minecraft analyze-log",
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
  "paper-validate-jar": "plugin paper validate-jar",
  "velocity-validate-jar": "plugin velocity validate-jar",
  "fabric-toolchain": "fabric toolchain",
  "velocity-toolchain": "velocity toolchain",
  "server-validate-properties": "server validate-properties",
  "fabric-validate-mod": "fabric validate-mod",
  "fabric-mods-inventory": "fabric mods inventory",
  "fabric-mods-diff": "fabric mods diff",
  "blockbench-inspect-project": "blockbench inspect-project",
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
  "rcon-status": "rcon status",
  "rcon-init": "rcon init",
  "rcon-run": "rcon run",
  "player-profile-lookup-name": "player-profile lookup-name",
  "player-profile-textures": "player-profile textures",
};

const commandGroups = new Set([
  "data",
  "minecraft",
  "datapack",
  "resourcepack",
  "player-skin",
  "player-texture",
  "plugin",
  "fabric",
  "velocity",
  "server",
  "blockbench",
  "rcon",
  "player-profile",
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
For intent-based discovery searches, translate non-English user intent into concise English
canonical Minecraft terms before passing a query. Keep exact identifiers, namespace IDs, file
paths, project titles, and content literals unchanged. Use the English terms only for the lookup;
keep the user's requested response language.

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
  minecraft-skills minecraft validate-mixin-config <config.json> [--archive-entries entries.json] [--archive-entries-complete true|false]
      Validate bounded Mixin config JSON and optional JSON archive-entry path metadata offline.
  minecraft-skills rcon status [--config path] [--profile name]
      Inspect resolved RCON configuration without printing secrets.
  minecraft-skills rcon init [--config path] [--profile local] [--preset readonly|guarded|full]
      Write an example RCON config. Existing files produce a warning and are not overwritten unless
      --force is passed.
  minecraft-skills rcon run <command...> [--config path] [--profile name]
      Run one Minecraft RCON command only if the selected profile permissions allow it.
  minecraft-skills server validate-properties [server.properties] [--version version]
      Conservatively validate bounded Java Properties syntax, stable value types, duplicates, and
      file-local RCON/resource-pack correlations without returning property values.
  minecraft-skills player-profile lookup-name <name>
  minecraft-skills player-profile textures <uuid>
      Resolve a Java profile or verified signed texture metadata through fixed Mojang services.
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
  plugin velocity Bounded offline validation of Velocity plugin descriptors, entrypoint
                  classfiles, Java targets, and annotation evidence inside local JARs.

Utilities:
  player-skin     Java player skins: bounded PNG structure, accepted dimensions, and canonical
                  face/hat source rectangles.
  player-texture  Download one fixed-host Java skin, cape, or elytra PNG by texture reference hash.

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

  Structure a Minecraft Java log or crash report before diagnosing it:
    minecraft-skills minecraft analyze-log ./logs/latest.log

  Resolve Java profile identity and signed texture metadata:
    minecraft-skills player-profile lookup-name jeb_
    minecraft-skills player-profile textures 853c80ef-3c37-49fd-aa49-938b674adae6

Safety notes:
  - Command paths prove parser shape, not gameplay success, permissions, or runtime behavior.
  - Vanilla path matches prove bundled vanilla file presence, not custom content validity.
  - Observed JSON/model surfaces are not normative schemas.
  - Paper Javadocs indexes prove API name presence, not behavior, nullability, overload semantics,
    thread safety, or Folia safety.
  - Paper event search results are candidates until checked against Paper/Bukkit API surfaces.
  - server.properties validation does not prove target-version key membership, runtime encoding,
    proxy authentication, or fork-specific behavior; unknown keys remain explicit coverage gaps.
  - Fabric mod validation checks bounded schema-v1 structure and archive evidence; it does not
    validate dependency predicates, entrypoint/runtime loading, mixin/access-widener syntax,
    nested JAR metadata, or icon pixels.
  - Fabric mods inventory and diff inspect direct local JAR facts only. They do not resolve
    dependency graphs or load order, prove compatibility, authenticity, origin, or startup, or
    download, update, or delete files.
  - Fabric mods inventory is non-recursive and selects exact lowercase .jar basenames. Its fixed
    ceilings are 10000 entries, 512 JARs, 256 MiB per JAR, 1 GiB accounted bytes, 200 diagnostics,
    and 100 duplicate groups. Diff separates ambiguous/unidentified entries; comparisonComplete
    and hasDifferences drive its exit status.
  - Velocity JAR validation checks bounded archive, descriptor, entrypoint classfile, Java target,
    and runtime-visible annotation evidence. It does not load Velocity, resolve dependencies,
    prove JVM linkage or injection, or establish runtime behavior or security.
  - Mixin archive-entry evidence covers only the supplied archive. Missing local entries do not
    prove absence from dependencies, the runtime classpath, or plugin-generated mixins.
  - Minecraft Wiki pages are human-only background: do not fetch, crawl, summarize, or cite them in
    AI workflows.

Grouped commands:
  minecraft-skills datapack context|preflight|evidence [version] [--edition java]
  minecraft-skills resourcepack context|preflight|evidence [version] [--edition java]
  minecraft-skills plugin paper context|preflight|evidence [version] [--edition java]
  minecraft-skills player-profile lookup-name <name>
  minecraft-skills player-profile textures <uuid>
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
  minecraft-skills minecraft registry-entries [version] [--registry id] [--exact id] [--contains text] [--prefix id] [--limit 50]
  minecraft-skills minecraft compare-registry-entries <from> <to> [--registry id] [--exact id] [--contains text] [--prefix id] [--limit 50]
  minecraft-skills minecraft validate-access-list <file> [--kind whitelist|ops|banned-players|banned-ips] [--evaluated-at UTC-timestamp]
  minecraft-skills datapack schema [version] [--edition java]
  minecraft-skills datapack search-schema [version] [--kind kind] [--path field.path] [--contains text] [--limit 50]
  minecraft-skills datapack compare-schema <from> <to> [--kind kind] [--contains text] [--limit 50]
  minecraft-skills datapack classify-files <path...>
  minecraft-skills datapack file-schema [version] <path>
  minecraft-skills datapack validate-files <version> <file...> [--pack-root dir]
  minecraft-skills datapack validate-project <version> <directory> [--limit 100] [--allow-merged-namespace-dependencies]
  minecraft-skills datapack migration-plan <from> <to> [path...] [--limit 50]
  minecraft-skills datapack find <query...> [--version latest] [--limit 25]
  minecraft-skills datapack server-reports [version] [--edition java]
  minecraft-skills datapack vanilla-paths [version] [--prefix path] [--contains text] [--extension json] [--limit 50]
  minecraft-skills datapack vanilla-json status [version]
  minecraft-skills datapack vanilla-json fetch [version] [--force]
  minecraft-skills datapack vanilla-json clean [version]
  minecraft-skills datapack vanilla-json files [version] [--kind kind] [--prefix path] [--contains text] [--limit 25]
  minecraft-skills datapack vanilla-json get <version> <data/path.json> [--parse true|false]
  minecraft-skills datapack vanilla-json search <query...> [--version latest] [--kind kind] [--prefix path] [--scope keys|values|all] [--case-sensitive true|false] [--limit 25] [--matches-per-file 3]
  minecraft-skills resourcepack vanilla-paths [version] [--prefix path] [--contains text] [--extension json] [--limit 50]
  minecraft-skills resourcepack models [version] [--edition java]
  minecraft-skills resourcepack classify-files <path...>
  minecraft-skills resourcepack file-schema [version] <path>
  minecraft-skills resourcepack validate-files <version> <file...> [--pack-root dir]
  minecraft-skills resourcepack inspect-png-alpha <file> [--require-nonempty] [--minimum-transparent-margin-pixels n] [--max-bytes n] [--max-width n] [--max-height n] [--max-pixels n] [--max-chunks n] [--max-diagnostics n] [--max-inflated-bytes n]
  minecraft-skills resourcepack validate-png <file> [--max-bytes n] [--max-width n] [--max-height n] [--max-pixels n] [--max-chunks n] [--max-diagnostics n]
  minecraft-skills player-skin validate-layout <file> [--base-rect x,y,width,height] [--hat-rect x,y,width,height] [--max-bytes n] [--max-width n] [--max-height n] [--max-pixels n] [--max-chunks n] [--max-diagnostics n]
  minecraft-skills player-texture download <64-lowercase-hex> --kind skin|cape|elytra --output <new.png>
  minecraft-skills resourcepack validate-project <version> <directory> [--limit 100] [--max-bytes n] [--max-width n] [--max-height n] [--max-pixels n] [--max-chunks n]
  minecraft-skills resourcepack migration-plan <from> <to> [path...] [--limit 50]
  minecraft-skills resourcepack search-models [version] [--kind model|item-definition] [--contains text] [--prefix path] [--limit 50]
  minecraft-skills resourcepack assets status [version]
  minecraft-skills resourcepack assets fetch [version] [--index-only] [--force]
  minecraft-skills resourcepack assets search [version] [--prefix path] [--contains text] [--extension json] [--limit 50] [--fetch]
  minecraft-skills resourcepack assets find <query...> [--version latest] [--kind model|item-definition|texture|sound|language|blockstate|atlas|font|any] [--limit 25]
  minecraft-skills resourcepack assets related [version] <path>
  minecraft-skills resourcepack assets get <version> <path> [--force]
  minecraft-skills plugin paper info
  minecraft-skills plugin paper api|api-index|api-surface [version]
  minecraft-skills plugin paper types [version] [--package package.name] [--contains text] [--limit 50]
  minecraft-skills plugin paper members [version] [--type qualified.Type] [--package package.name] [--kind method|constructor|field-or-enum-constant|unknown] [--contains text] [--limit 50]
  minecraft-skills plugin paper events <query> [--version latest] [--source paper] [--limit 20]
  minecraft-skills plugin paper validate-jar <file.jar> [--max-archive-bytes bytes]
  minecraft-skills plugin velocity validate-jar <file.jar> [--target-java 25] [--max-archive-bytes bytes]
  minecraft-skills fabric toolchain <game-version> [--limit 10] [--timeout-ms 5000]
  minecraft-skills fabric validate-mod <file.jar> [--max-archive-bytes bytes]
  minecraft-skills fabric mods inventory <directory>
  minecraft-skills fabric mods diff <left-directory> <right-directory>
  minecraft-skills velocity toolchain [--limit 10] [--timeout-ms 5000]
  minecraft-skills blockbench inspect-project <file.bbmodel> [--require-animation name]... [--require-group name]... [--limit 100]
  minecraft-skills modrinth search <query...> [--version version] [--type type] [--loader loader] [--category category] [--index relevance|downloads|follows|newest|updated] [--offset 0] [--limit 10]
  minecraft-skills modrinth versions <project-id-or-slug> [--game-version version] [--loader loader] [--featured true|false] [--include-changelog true|false]
  minecraft-skills modrinth compatibility <project-id-or-slug...> [--game-version version] [--loader loader] [--featured true|false] [--limit 3] [--timeout-ms 10000] [-- <option-like-slug...>]
  minecraft-skills modrinth get <project|project-dependencies|version|version-file|user|categories|loaders|game-versions|project-types|side-types|donation-platforms|report-types|statistics> [identifier] [--algorithm sha1|sha512]
  minecraft-skills modrinth validate-pack <file.mrpack> [--allow-download-host host]... [--max-archive-bytes bytes]
  minecraft-skills server validate-properties [server.properties] [--version version]
  minecraft-skills minecraft latest|list|show|compare|support|support-matrix|pack-formats|vanilla-inventory|registry-entries|compare-registry-entries
  minecraft-skills minecraft pack-format [version] [datapack|resourcepack]
  minecraft-skills minecraft versions-for-pack-format <datapack|resourcepack> <format> [minor]
  minecraft-skills minecraft search <query> [--domain datapack|resourcepack|paper-plugin] [--kind kind] [--limit 10]
  minecraft-skills minecraft search-all <query...> [--version latest] [--domain datapack|resourcepack|paper-plugin] [--limit 20]
  minecraft-skills minecraft explain-path [version] <path> [--domain datapack|resourcepack]
  minecraft-skills minecraft suggest-lookups <task...> [--version latest] [--domain datapack|resourcepack|paper-plugin]
  minecraft-skills minecraft analyze-log <file> [--max-input-bytes bytes] [--max-characters chars] [--max-lines count] [--max-line-characters chars] [--max-events count] [--max-exception-chains count] [--max-exception-depth count] [--max-exception-entries count] [--max-stack-frames count]
    [--max-platforms count] [--max-artifacts count] [--max-components count] [--max-text-characters chars] [--max-retained-text-characters chars]
  minecraft-skills minecraft sources [datapack|resourcepack|paper-plugin] [version]
  minecraft-skills minecraft validate-mixin-config <config.json> [--archive-entries entries.json] [--archive-entries-complete true|false]
  minecraft-skills data manifest|fetch|cache-dir|cache-list|cache-clean|coverage
  minecraft-skills skill list|show|write
  minecraft-skills reference list [--domain datapack|resourcepack|paper-plugin]
  minecraft-skills domain show <datapack|resourcepack|paper-plugin>
  minecraft-skills source policy
  minecraft-skills source report [datapack|resourcepack|paper-plugin] [version]
  minecraft-skills source tiers|tier|datasets|dataset
  minecraft-skills source search <query> [--kind source-tier|community-dataset] [--limit 10]
  minecraft-skills rcon status [--config path] [--profile name]
  minecraft-skills rcon init [--config path] [--profile name] [--preset readonly|guarded|full] [--force]
  minecraft-skills rcon run <command...> [--config path] [--profile name] [--timeout-ms 2000]

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
  minecraft latest|list|pack-formats|pack-format|versions-for-pack-format|show|compare|support|support-matrix|vanilla-inventory|registry-entries|compare-registry-entries
                 Inspect bundled version metadata, registry entry indexes, and per-domain version support.
  datapack server-reports|schema|search-schema|compare-schema|commands|compare-commands
                 Inspect command paths, observed datapack JSON shapes, file schemas, file kinds, and file content validation.
  datapack vanilla-paths|compare-vanilla-paths
                 Search or compare bundled vanilla datapack paths.
  resourcepack vanilla-paths|compare-vanilla-paths|models|search-models|assets
                 Inspect vanilla assets, model summaries, item/model paths, file schemas, file kinds, and file content validation.
  plugin paper info|api|api-index|compare-api|api-surface|types|members|compare-api-surface|events
                 Inspect Paper support, Javadocs-derived API surfaces, and event candidates.
  fabric toolchain
                 Look up bounded Loader, Intermediary, and Yarn candidates from official Fabric Meta.
  fabric validate-mod
                 Check bounded structural rules for current schema v1 and JAR evidence offline.
  fabric mods inventory
                 Inventory direct lowercase .jar regular files with bounded stable reads and hashes;
                 invalid, rejected, duplicate, or incomplete results exit 1.
  fabric mods diff
                 Compare unique valid mod IDs; differences, ambiguity, or incomplete results exit 1.
  velocity toolchain
                 Resolve the current official velocity-api coordinate, documentation, and applicable Java requirement.
  blockbench inspect-project
                 Inspect bounded .bbmodel metadata and exact animation/group names without validating runtime behavior.
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
  rcon status   Print RCON config resolution status without secrets.
  rcon init     Create an RCON config file. Existing files are not overwritten unless --force is set.
  rcon run      Run one policy-checked Minecraft RCON command.

Options:
  --domain <domain>      Filter to datapack, resourcepack, or paper-plugin where supported.
  --edition java         Select edition. Only java is currently supported.
  --version <version>    Select a version for commands that accept named options.
  --limit <n>            Limit search results. Search commands validate their own maximums.
  --pack-root <dir>      Strip a local pack root when validating files so paths become pack-relative.
  --max-bytes <n>        Lower the PNG input-byte cap for resource-pack PNG validation.
  --max-width <n>        Lower the PNG width cap for resource-pack PNG validation.
  --max-height <n>       Lower the PNG height cap for resource-pack PNG validation.
  --max-pixels <n>       Lower the PNG total-pixel cap for resource-pack PNG validation.
  --max-chunks <n>       Lower the PNG chunk-count cap for resource-pack PNG validation.
  --max-diagnostics <n>  Lower retained diagnostics for standalone PNG validation.
  --max-inflated-bytes <n>
                         Lower filtered-image bytes decoded by PNG alpha inspection.
  --require-nonempty     Require at least one PNG pixel whose decoded alpha is nonzero.
  --minimum-transparent-margin-pixels <n>
                         Require this many transparent pixels on every content-box side.
  --force                Overwrite or refetch where supported.

Cache:
  Heavy generated surfaces are listed in data manifest and stored in the OS cache. Use data cache-dir,
  data cache-list, data cache-clean, and data fetch. Set MINECRAFT_SKILLS_CACHE_DIR to override it.

RCON:
  Config search order is --config, MINECRAFT_SKILLS_RCON_CONFIG, ./.minecraft-skills/rcon.json,
  ./minecraft-skills.rcon.json, user config, then env-only profile. Use $env:NAME in config values
  for secrets. Permissions use regex strings, deny before allow, with readonly, guarded, and full
  presets.

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

function readRconPreset(args: string[], fallback: RconPermissionPreset): RconPermissionPreset {
  const value = readOption(args, "--preset", fallback);
  if (value === "readonly" || value === "guarded" || value === "full") {
    return value;
  }
  throw new Error("rcon --preset must be readonly, guarded, or full");
}

export async function runCli(argv: string[], output: Output = defaultOutput): Promise<number> {
  const flatSuggestion = flatCommandSuggestions[argv[0] ?? ""];
  const hasSubcommand = Boolean(argv[1] && !argv[1].startsWith("-"));
  if (flatSuggestion && !(commandGroups.has(argv[0] ?? "") && hasSubcommand)) {
    output.error(`Use subcommands: minecraft-skills ${flatSuggestion}`);
    return 1;
  }
  if (argv[0] === "plugin" && argv[1] && argv[1] !== "paper" && argv[1] !== "velocity") {
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
    if (argv[0] === "plugin" && argv[1] === "velocity" && argv[2] && !argv[2].startsWith("-")) {
      output.error(`Unknown subcommand: plugin velocity ${argv[2]}`);
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

    if (command === "player-profile-lookup-name") {
      if (args.length !== 1 || args[0]?.startsWith("-")) {
        throw new Error("player-profile lookup-name requires exactly one Java player name");
      }
      const result = await lookupJavaPlayerProfileByName(args[0]);
      printJson(output, result);
      return result.status === "found" ? 0 : 1;
    }

    if (command === "player-profile-textures") {
      if (args.length !== 1 || args[0]?.startsWith("-")) {
        throw new Error("player-profile textures requires exactly one Java player UUID");
      }
      const result = await getVerifiedJavaPlayerTextures(args[0]);
      printJson(output, result);
      return result.status === "verified" ? 0 : 1;
    }

    if (command === "validate-mixin-config") {
      if (args.includes("--edition")) {
        throw new Error("Unknown option: --edition");
      }
      for (const option of ["--archive-entries", "--archive-entries-complete"]) {
        if (args.filter((arg) => arg === option).length > 1) {
          throw new Error(`minecraft validate-mixin-config option must not be repeated: ${option}`);
        }
      }
      const configPaths = positionalArgsWithOptions(args, {
        values: ["--archive-entries", "--archive-entries-complete"],
      });
      const configPath = configPaths[0];
      if (configPaths.length !== 1 || !configPath) {
        throw new Error(
          "minecraft validate-mixin-config requires exactly one local Mixin config JSON file",
        );
      }
      const archiveEntriesPath = args.includes("--archive-entries")
        ? readOption(args, "--archive-entries", "")
        : undefined;
      const archiveEntriesComplete = readBooleanOption(args, "--archive-entries-complete", false);
      if (archiveEntriesComplete && !archiveEntriesPath) {
        throw new Error(
          "minecraft validate-mixin-config --archive-entries-complete true requires --archive-entries",
        );
      }
      const files = readMixinConfigCliFiles({
        configPath,
        ...(archiveEntriesPath ? { archiveEntriesPath } : {}),
      });
      const result = validateMixinConfig({
        config: files.config,
        ...(files.archiveEntries !== undefined ? { archiveEntries: files.archiveEntries } : {}),
        archiveEntriesComplete,
      });
      printJson(output, result);
      return result.valid ? 0 : 1;
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

    if (command === "rcon-status") {
      printJson(
        output,
        getRconConfigStatus({
          ...(args.includes("--config") ? { configPath: readOption(args, "--config", "") } : {}),
          ...(args.includes("--profile") ? { profile: readOption(args, "--profile", "") } : {}),
        }),
      );
      return 0;
    }

    if (command === "rcon-init") {
      printJson(
        output,
        createRconConfig({
          ...(args.includes("--config") ? { configPath: readOption(args, "--config", "") } : {}),
          ...(args.includes("--profile") ? { profile: readOption(args, "--profile", "") } : {}),
          ...(args.includes("--host") ? { host: readOption(args, "--host", "") } : {}),
          ...(args.includes("--port") ? { port: readOption(args, "--port", "") } : {}),
          ...(args.includes("--password-env")
            ? { passwordEnv: readOption(args, "--password-env", "") }
            : {}),
          preset: readRconPreset(args, "readonly"),
          force: args.includes("--force"),
        }),
      );
      return 0;
    }

    if (command === "rcon-run") {
      const rconCommand = positionalArgs(args).join(" ");
      if (!rconCommand) {
        throw new Error("rcon run command requires a Minecraft command");
      }
      printJson(
        output,
        await runRconCommand({
          command: rconCommand,
          ...(args.includes("--config") ? { configPath: readOption(args, "--config", "") } : {}),
          ...(args.includes("--profile") ? { profile: readOption(args, "--profile", "") } : {}),
          ...(args.includes("--timeout-ms")
            ? { timeoutMs: Number(readOption(args, "--timeout-ms", "2000")) }
            : {}),
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

    if (command === "pack-format") {
      const [requested = "latest", positionalDomain] = positionalArgs(args);
      const domain = readPackFormatDomain(
        readOption(args, "--domain", positionalDomain ?? "datapack"),
      );
      printJson(output, getPackFormat(edition, requested, domain));
      return 0;
    }

    if (command === "versions-for-pack-format") {
      const [positionalDomain, positionalFormat, positionalMinor] = positionalArgs(args);
      const domain = readPackFormatDomain(
        args.includes("--domain") ? readOption(args, "--domain", "") : (positionalDomain ?? ""),
      );
      const format = readIntegerArg(
        args.includes("--format") ? readOption(args, "--format", "") : positionalFormat,
        "format",
      );
      const minorText = args.includes("--minor")
        ? readOption(args, "--minor", "")
        : positionalMinor;
      printJson(
        output,
        findVersionsByPackFormat({
          edition,
          domain,
          format,
          ...(minorText === undefined ? {} : { minor: readIntegerArg(minorText, "minor") }),
        }),
      );
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

    if (command === "registry-entries") {
      const requested = positionalArgs(args)[0] ?? "latest";
      const registryOptions: RegistryEntrySearchOptions = {
        edition,
        version: requested,
        limit: Number(readOption(args, "--limit", "50")),
      };
      if (args.includes("--registry")) {
        registryOptions.registry = readOption(args, "--registry", "");
      }
      if (args.includes("--exact")) {
        registryOptions.exact = readOption(args, "--exact", "");
      }
      if (args.includes("--contains")) {
        registryOptions.contains = readOption(args, "--contains", "");
      }
      if (args.includes("--prefix")) {
        registryOptions.prefix = readOption(args, "--prefix", "");
      }
      printJson(output, searchRegistryEntries(registryOptions));
      return 0;
    }

    if (command === "compare-registry-entries") {
      const [from, to] = positionalArgs(args);
      if (!from || !to) {
        throw new Error("compare-registry-entries command requires <from> and <to>");
      }
      const registryOptions: RegistryEntryComparisonOptions = {
        edition,
        from,
        to,
        limit: Number(readOption(args, "--limit", "50")),
      };
      if (args.includes("--registry")) {
        registryOptions.registry = readOption(args, "--registry", "");
      }
      if (args.includes("--exact")) {
        registryOptions.exact = readOption(args, "--exact", "");
      }
      if (args.includes("--contains")) {
        registryOptions.contains = readOption(args, "--contains", "");
      }
      if (args.includes("--prefix")) {
        registryOptions.prefix = readOption(args, "--prefix", "");
      }
      printJson(output, compareRegistryEntries(registryOptions));
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
      const version = (second ? first : "latest") ?? "latest";
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

    if (command === "validate-resourcepack-png") {
      const [filePath, ...extraPaths] = positionalArgsWithOptions(args, {
        values: resourcepackPngValueOptions,
      });
      if (!filePath || extraPaths.length > 0) {
        throw new Error("resourcepack validate-png requires exactly one <file>");
      }
      const limits = readResourcepackPngLimits(args);
      const result = validateResourcepackPng(readBoundedPngFile(filePath, limits.maxInputBytes), {
        limits,
      });
      printJson(output, result);
      return result.valid ? 0 : 1;
    }

    if (command === "inspect-resourcepack-png-alpha") {
      const [filePath, ...extraPaths] = positionalArgsWithOptions(args, {
        flags: ["--require-nonempty"],
        values: resourcepackPngAlphaValueOptions,
      });
      if (!filePath || extraPaths.length > 0) {
        throw new Error("resourcepack inspect-png-alpha requires exactly one <file>");
      }
      const limits = readResourcepackPngAlphaLimits(args);
      const minimumTransparentMarginPixels = readMinimumTransparentMarginPixels(args);
      const requirements = {
        ...(args.includes("--require-nonempty") ? { nonEmpty: true } : {}),
        ...(minimumTransparentMarginPixels === undefined ? {} : { minimumTransparentMarginPixels }),
      };
      const result = inspectResourcepackPngAlphaBounds(
        readBoundedPngFile(filePath, limits.maxInputBytes, "resourcepack inspect-png-alpha"),
        {
          limits,
          ...(Object.keys(requirements).length === 0 ? {} : { requirements }),
        },
      );
      printJson(output, result);
      return result.pixelInspectionComplete &&
        (result.requirements.status === "met" || result.requirements.status === "not-requested")
        ? 0
        : 1;
    }

    if (command === "download-player-texture") {
      const { hash, kind, outputPath } = parsePlayerTextureDownloadArgs(args);
      const outputTarget = validateNewPlayerTexturePngPath(outputPath);
      const result = await downloadJavaPlayerTexture(hash, kind);
      if (result.status !== "downloaded") {
        printJson(output, result);
        return 1;
      }
      writeNewPlayerTexturePng(outputTarget, result.content.bytes);
      printJson(output, {
        schemaVersion: result.schemaVersion,
        scope: result.scope,
        status: result.status,
        saved: true,
        content: {
          kind: result.content.kind,
          byteLength: result.content.byteLength,
          evidence: result.content.evidence,
          png: result.content.png,
          skinLayout: result.content.skinLayout,
        },
        limits: result.limits,
        networkPolicy: result.networkPolicy,
        sourceEvidence: result.sourceEvidence,
        nonGuarantees: result.nonGuarantees,
        privacy: result.privacy,
      });
      return 0;
    }

    if (command === "validate-player-skin-layout") {
      const [filePath, ...extraPaths] = positionalArgsWithOptions(args, {
        values: playerSkinLayoutValueOptions,
      });
      if (!filePath || extraPaths.length > 0) {
        throw new Error("player-skin validate-layout requires exactly one <file>");
      }
      const base = readPlayerSkinRectangleOption(args, "--base-rect");
      const hat = readPlayerSkinRectangleOption(args, "--hat-rect");
      const limits = readResourcepackPngLimits(args, "player-skin validate-layout");
      const png = validateResourcepackPng(
        readBoundedPngFile(filePath, limits.maxInputBytes, "player-skin validate-layout"),
        { limits },
      );
      const sourceRects = base || hat ? { ...(base ? { base } : {}), ...(hat ? { hat } : {}) } : {};
      const layout =
        png.valid && png.width !== null && png.height !== null
          ? validatePlayerSkinLayout({ width: png.width, height: png.height, sourceRects })
          : null;
      const result = {
        schemaVersion: 1,
        validationStrength: "png-structure-and-player-skin-layout",
        valid: png.valid && layout?.valid === true,
        png,
        layoutValidationStatus: layout ? "checked-from-valid-png-ihdr" : "not-checked",
        layout,
        notes: [
          "Player-skin layout is checked only when the bounded PNG validator accepts the complete container and IHDR; an invalid CRC, critical chunk, limit, or truncation keeps layout status not-checked.",
          "The PNG validator does not decompress IDAT. Pixel colors, alpha, legacy pixel conversion results, display scaling, filtering, blending, GUI clipping, and scissor state remain not checked.",
        ],
      };
      printJson(output, result);
      return result.valid ? 0 : 1;
    }

    if (command === "validate-resourcepack-project") {
      const [version, directory] = positionalArgs(args);
      if (!version || !directory) {
        throw new Error("resourcepack validate-project requires <version> and <directory>");
      }
      if (args.includes("--max-diagnostics")) {
        throw new Error(
          "resourcepack validate-project uses --limit for the shared diagnostic output cap",
        );
      }
      const pngLimits = readResourcepackPngLimits(args, "resourcepack validate-project");
      const result = validateResourcepackProject({
        edition,
        version,
        files: readResourcepackProjectFiles(
          directory,
          defaultResourcepackProjectValidationLimits,
          pngLimits,
        ),
        limit: Number(readOption(args, "--limit", "100")),
        pngLimits,
      });
      printJson(output, result);
      return result.valid ? 0 : 1;
    }

    if (command === "validate-datapack-project") {
      const [version, directory] = positionalArgsWithOptions(args, {
        flags: ["--allow-merged-namespace-dependencies"],
        values: ["--limit"],
      });
      if (!version || !directory) {
        throw new Error("datapack validate-project requires <version> and <directory>");
      }
      const result = validateDatapackProject({
        edition,
        version,
        files: readDatapackProjectFiles(directory),
        limit: Number(readOption(args, "--limit", "100")),
        assumeLocalNamespacesComplete: !args.includes("--allow-merged-namespace-dependencies"),
      });
      printJson(output, result);
      return result.valid ? 0 : 1;
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

    if (command === "datapack-find") {
      const query = positionalArgs(args).join(" ");
      if (!query) {
        throw new Error("datapack find command requires a query");
      }
      printJson(
        output,
        findDatapackEntries({
          edition,
          version: readOption(args, "--version", "latest"),
          query,
          limit: Number(readOption(args, "--limit", "25")),
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

    if (command === "resourcepack-assets-status") {
      const requested = positionalArgs(args)[0] ?? "latest";
      const version = resolveVersion(edition, requested);
      printJson(output, getMinecraftAssetsStatus(version, readOption(args, "--ref", version)));
      return 0;
    }

    if (command === "resourcepack-assets-fetch") {
      const requested = positionalArgs(args)[0] ?? "latest";
      const version = resolveVersion(edition, requested);
      const ref = readOption(args, "--ref", version);
      printJson(
        output,
        args.includes("--index-only")
          ? await fetchMinecraftAssetsIndex({
              version,
              ref,
              force: args.includes("--force"),
            })
          : await fetchMinecraftAssetsArchive({
              version,
              ref,
              force: args.includes("--force"),
            }),
      );
      return 0;
    }

    if (command === "resourcepack-assets-search") {
      const requested = positionalArgs(args)[0] ?? "latest";
      const version = resolveVersion(edition, requested);
      const ref = readOption(args, "--ref", version);
      if (args.includes("--fetch")) {
        await fetchMinecraftAssetsIndex({
          version,
          ref,
          force: args.includes("--force"),
        });
      }
      printJson(
        output,
        searchMinecraftAssets({
          version,
          ref,
          limit: Number(readOption(args, "--limit", "50")),
          ...(args.includes("--prefix") ? { prefix: readOption(args, "--prefix", "") } : {}),
          ...(args.includes("--contains") ? { contains: readOption(args, "--contains", "") } : {}),
          ...(args.includes("--suffix") ? { suffix: readOption(args, "--suffix", "") } : {}),
          ...(args.includes("--extension")
            ? { extension: readOption(args, "--extension", "") }
            : {}),
        }),
      );
      return 0;
    }

    if (command === "resourcepack-assets-find") {
      const query = positionalArgs(args).join(" ");
      if (!query) {
        throw new Error("resourcepack assets find command requires a query");
      }
      printJson(
        output,
        findResourcepackAssets({
          edition,
          version: readOption(args, "--version", "latest"),
          query,
          kind: readResourcepackAssetKind(readOption(args, "--kind", "any")),
          limit: Number(readOption(args, "--limit", "25")),
        }),
      );
      return 0;
    }

    if (command === "resourcepack-assets-related") {
      const positionals = positionalArgs(args);
      const [first, second] = positionals;
      const version = second ? (first ?? "latest") : "latest";
      const path = second ?? first;
      if (!path) {
        throw new Error("resourcepack assets related command requires <path> or <version> <path>");
      }
      printJson(
        output,
        explainPackPath({
          edition,
          version,
          path,
          domain: "resourcepack",
        }),
      );
      return 0;
    }

    if (command === "resourcepack-assets-get") {
      const [requested, assetPath] = positionalArgs(args);
      if (!requested || !assetPath) {
        throw new Error("resourcepack assets get command requires <version> and <path>");
      }
      const version = resolveVersion(edition, requested);
      printJson(
        output,
        await fetchMinecraftAssetFile({
          version,
          path: assetPath,
          ref: readOption(args, "--ref", version),
          force: args.includes("--force"),
        }),
      );
      return 0;
    }

    if (command === "vanilla-datapack-json-status") {
      const requested = positionalArgsWithOptions(args)[0] ?? "latest";
      printJson(output, getMojangServerJarStatus(resolveVersion(edition, requested)));
      return 0;
    }

    if (command === "vanilla-datapack-json-fetch") {
      const requested = positionalArgsWithOptions(args, { flags: ["--force"] })[0] ?? "latest";
      printJson(
        output,
        await fetchMojangServerJarForVersion({
          edition,
          version: requested,
          force: args.includes("--force"),
        }),
      );
      return 0;
    }

    if (command === "vanilla-datapack-json-clean") {
      const requested = positionalArgsWithOptions(args)[0] ?? "latest";
      printJson(output, cleanMojangServerJar(resolveVersion(edition, requested)));
      return 0;
    }

    if (command === "vanilla-datapack-json-files") {
      const requested =
        positionalArgsWithOptions(args, {
          values: ["--kind", "--prefix", "--contains", "--limit"],
        })[0] ?? "latest";
      printJson(
        output,
        searchVanillaDatapackJsonFiles({
          edition,
          version: requested,
          ...(args.includes("--kind") ? { kind: readOption(args, "--kind", "") } : {}),
          ...(args.includes("--prefix") ? { prefix: readOption(args, "--prefix", "") } : {}),
          ...(args.includes("--contains") ? { contains: readOption(args, "--contains", "") } : {}),
          limit: Number(readOption(args, "--limit", "25")),
        }),
      );
      return 0;
    }

    if (command === "vanilla-datapack-json-get") {
      const [requested, path] = positionalArgsWithOptions(args, { values: ["--parse"] });
      if (!requested || !path) {
        throw new Error("datapack vanilla-json get requires <version> and <data/path.json>");
      }
      printJson(
        output,
        getVanillaDatapackJson({
          edition,
          version: requested,
          path,
          parse: readBooleanOption(args, "--parse", true),
        }),
      );
      return 0;
    }

    if (command === "vanilla-datapack-json-search") {
      const query = positionalArgsWithOptions(args, {
        values: [
          "--version",
          "--kind",
          "--prefix",
          "--scope",
          "--case-sensitive",
          "--limit",
          "--matches-per-file",
        ],
      }).join(" ");
      if (!query) {
        throw new Error("datapack vanilla-json search requires a query");
      }
      const scope = readOption(args, "--scope", "all");
      if (scope !== "keys" && scope !== "values" && scope !== "all") {
        throw new Error("datapack vanilla-json search --scope must be keys, values, or all");
      }
      printJson(
        output,
        searchVanillaDatapackJsonContent({
          edition,
          version: readOption(args, "--version", "latest"),
          query,
          scope,
          caseSensitive: readBooleanOption(args, "--case-sensitive", false),
          ...(args.includes("--kind") ? { kind: readOption(args, "--kind", "") } : {}),
          ...(args.includes("--prefix") ? { prefix: readOption(args, "--prefix", "") } : {}),
          limit: Number(readOption(args, "--limit", "25")),
          matchesPerFile: Number(readOption(args, "--matches-per-file", "3")),
        }),
      );
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

    if (command === "paper-validate-jar") {
      const jarPaths = positionalArgs(args);
      const jarPath = jarPaths[0];
      if (jarPaths.length !== 1 || !jarPath) {
        throw new Error("plugin paper validate-jar requires exactly one local .jar file");
      }
      if (!jarPath.toLowerCase().endsWith(".jar")) {
        throw new Error("plugin paper validate-jar requires a file with the .jar extension");
      }
      const maxArchiveBytes = readIntegerArg(
        args.includes("--max-archive-bytes")
          ? readOption(args, "--max-archive-bytes", "")
          : String(paperPluginJarValidationLimits.maxArchiveBytes),
        "plugin paper validate-jar --max-archive-bytes",
      );
      if (maxArchiveBytes < 1 || maxArchiveBytes > paperPluginJarValidationLimits.maxArchiveBytes) {
        throw new Error(
          `plugin paper validate-jar --max-archive-bytes must be between 1 and ${paperPluginJarValidationLimits.maxArchiveBytes}`,
        );
      }
      const archive = readBoundedArchiveFile(jarPath, maxArchiveBytes, {
        command: "plugin paper validate-jar",
        extension: ".jar",
      });
      const result = validatePaperPluginJar({ archive });
      printJson(output, result);
      return result.valid ? 0 : 1;
    }

    if (command === "velocity-validate-jar") {
      const jarPaths = positionalArgsWithOptions(args, {
        values: ["--max-archive-bytes", "--target-java"],
      });
      const jarPath = jarPaths[0];
      if (jarPaths.length !== 1 || !jarPath) {
        throw new Error("plugin velocity validate-jar requires exactly one local .jar file");
      }
      if (!jarPath.toLowerCase().endsWith(".jar")) {
        throw new Error("plugin velocity validate-jar requires a file with the .jar extension");
      }
      const maxArchiveBytes = readIntegerArg(
        args.includes("--max-archive-bytes")
          ? readOption(args, "--max-archive-bytes", "")
          : String(velocityPluginJarValidationLimits.maxArchiveBytes),
        "plugin velocity validate-jar --max-archive-bytes",
      );
      if (
        maxArchiveBytes < 1 ||
        maxArchiveBytes > velocityPluginJarValidationLimits.maxArchiveBytes
      ) {
        throw new Error(
          `plugin velocity validate-jar --max-archive-bytes must be between 1 and ${velocityPluginJarValidationLimits.maxArchiveBytes}`,
        );
      }
      const targetJavaRelease = readIntegerArg(
        args.includes("--target-java")
          ? readOption(args, "--target-java", "")
          : String(velocityPluginJarValidationLimits.defaultTargetJavaRelease),
        "plugin velocity validate-jar --target-java",
      );
      if (
        targetJavaRelease < velocityPluginJarValidationLimits.minTargetJavaRelease ||
        targetJavaRelease > velocityPluginJarValidationLimits.maxTargetJavaRelease
      ) {
        throw new Error(
          `plugin velocity validate-jar --target-java must be between ${velocityPluginJarValidationLimits.minTargetJavaRelease} and ${velocityPluginJarValidationLimits.maxTargetJavaRelease}`,
        );
      }
      const archive = readBoundedArchiveFile(jarPath, maxArchiveBytes, {
        command: "plugin velocity validate-jar",
        extension: ".jar",
      });
      const result = validateVelocityPluginJar({ archive, targetJavaRelease });
      printJson(output, result);
      return result.valid ? 0 : 1;
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

    if (command === "search-all") {
      const query = positionalArgs(args).join(" ");
      if (!query) {
        throw new Error("search-all command requires a query");
      }
      const domain = args.includes("--domain")
        ? readOptionalAuthoringDomain(readOption(args, "--domain", ""))
        : undefined;
      printJson(
        output,
        searchAll({
          edition,
          version: readOption(args, "--version", "latest"),
          query,
          ...(domain ? { domain } : {}),
          limit: Number(readOption(args, "--limit", "20")),
        }),
      );
      return 0;
    }

    if (command === "fabric-validate-mod") {
      const modPaths = positionalArgsWithOptions(args, { values: ["--max-archive-bytes"] });
      const modPath = modPaths[0];
      if (modPaths.length !== 1 || !modPath) {
        throw new Error("fabric validate-mod requires exactly one local .jar file");
      }
      if (!modPath.toLowerCase().endsWith(".jar")) {
        throw new Error("fabric validate-mod requires a file with the .jar extension");
      }
      const maxArchiveBytes = readIntegerArg(
        args.includes("--max-archive-bytes")
          ? readOption(args, "--max-archive-bytes", "")
          : String(defaultFabricModValidationLimits.maxArchiveBytes),
        "fabric validate-mod --max-archive-bytes",
      );
      if (
        !Number.isSafeInteger(maxArchiveBytes) ||
        maxArchiveBytes < 1 ||
        defaultFabricModValidationLimits.maxArchiveBytes < maxArchiveBytes
      ) {
        throw new Error(
          `fabric validate-mod --max-archive-bytes must be between 1 and ${defaultFabricModValidationLimits.maxArchiveBytes}`,
        );
      }
      const archive = readFabricModJarFile(modPath, maxArchiveBytes);
      const result = validateFabricModJar(archive, { limits: { maxArchiveBytes } });
      printJson(output, result);
      return result.valid ? 0 : 1;
    }

    if (command === "fabric-mods-inventory") {
      const directoryPaths = positionalArgsWithoutOptions(args);
      const directoryPath = directoryPaths[0];
      if (directoryPaths.length !== 1 || !directoryPath) {
        throw new Error("fabric mods inventory requires exactly one local directory");
      }
      const result = inventoryFabricModsDirectory(directoryPath);
      printJson(output, result);
      return result.valid ? 0 : 1;
    }

    if (command === "fabric-mods-diff") {
      const directoryPaths = positionalArgsWithoutOptions(args);
      const leftPath = directoryPaths[0];
      const rightPath = directoryPaths[1];
      if (directoryPaths.length !== 2 || !leftPath || !rightPath) {
        throw new Error("fabric mods diff requires exactly two local directories");
      }
      const result = diffFabricModDirectories(
        inventoryFabricModsDirectory(leftPath),
        inventoryFabricModsDirectory(rightPath),
      );
      printJson(output, result);
      return result.comparisonComplete && !result.hasDifferences ? 0 : 1;
    }

    if (command === "fabric-toolchain") {
      const gameVersion = positionalArgs(args)[0];
      if (!gameVersion) {
        throw new Error("fabric toolchain requires a Minecraft game version");
      }
      printJson(
        output,
        await getFabricToolchainCompatibility({
          gameVersion,
          limit: Number(readOption(args, "--limit", "10")),
          timeoutMs: Number(readOption(args, "--timeout-ms", "5000")),
        }),
      );
      return 0;
    }

    if (command === "velocity-toolchain") {
      printJson(
        output,
        await resolveVelocityToolchain({
          limit: Number(readOption(args, "--limit", "10")),
          timeoutMs: Number(readOption(args, "--timeout-ms", "5000")),
        }),
      );
      return 0;
    }
    if (command === "blockbench-inspect-project") {
      const parsedArgs = parseBlockbenchInspectionArgs(args);
      const result = inspectBlockbenchProject({
        project: readBlockbenchProjectFile(parsedArgs.filePath),
        requireAnimations: parsedArgs.requiredAnimations,
        requireGroups: parsedArgs.requiredGroups,
        limit: parsedArgs.limit,
      });
      printJson(output, result);
      const requirementsSatisfied = [
        ...result.requested.animations,
        ...result.requested.groups,
      ].every((requirement) => requirement.status === "present");
      return result.inspectionComplete && requirementsSatisfied ? 0 : 1;
    }

    if (command === "modrinth-search") {
      const query = positionalArgs(args).join(" ");
      if (!query) {
        throw new Error("modrinth search requires a query");
      }
      const index = readOption(args, "--index", "relevance");
      if (
        index !== "relevance" &&
        index !== "downloads" &&
        index !== "follows" &&
        index !== "newest" &&
        index !== "updated"
      ) {
        throw new Error(
          "modrinth search --index must be relevance, downloads, follows, newest, or updated",
        );
      }
      const version = args.includes("--version") ? readOption(args, "--version", "") : undefined;
      const projectType = args.includes("--type") ? readOption(args, "--type", "") : undefined;
      const loader = args.includes("--loader") ? readOption(args, "--loader", "") : undefined;
      const category = args.includes("--category") ? readOption(args, "--category", "") : undefined;
      printJson(
        output,
        await searchModrinthProjects({
          query,
          index,
          offset: Number(readOption(args, "--offset", "0")),
          limit: Number(readOption(args, "--limit", "10")),
          ...(version ? { version } : {}),
          ...(projectType ? { projectType } : {}),
          ...(loader ? { loader } : {}),
          ...(category ? { category } : {}),
        }),
      );
      return 0;
    }

    if (command === "modrinth-versions") {
      const project = positionalArgs(args)[0];
      if (!project) {
        throw new Error("modrinth versions requires a project ID or slug");
      }
      const gameVersion = args.includes("--game-version")
        ? readOption(args, "--game-version", "")
        : undefined;
      const loader = args.includes("--loader") ? readOption(args, "--loader", "") : undefined;
      const featured = args.includes("--featured")
        ? readBooleanOption(args, "--featured", false)
        : undefined;
      printJson(
        output,
        await listModrinthProjectVersions({
          project,
          includeChangelog: readBooleanOption(args, "--include-changelog", false),
          ...(gameVersion ? { gameVersions: [gameVersion] } : {}),
          ...(loader ? { loaders: [loader] } : {}),
          ...(featured !== undefined ? { featured } : {}),
        }),
      );
      return 0;
    }

    if (command === "modrinth-compatibility") {
      const parsed = parseModrinthCompatibilityArgs(args);
      const gameVersion = parsed.options.get("--game-version");
      const loader = parsed.options.get("--loader");
      const featuredValue = parsed.options.get("--featured");
      const featured = featuredValue ? readBooleanValue(featuredValue, "--featured") : undefined;
      printJson(
        output,
        await resolveModrinthCompatibility({
          projects: parsed.projects,
          limit: Number(parsed.options.get("--limit") ?? "3"),
          timeoutMs: Number(parsed.options.get("--timeout-ms") ?? "10000"),
          ...(gameVersion ? { gameVersion } : {}),
          ...(loader ? { loader } : {}),
          ...(featured !== undefined ? { featured } : {}),
        }),
      );
      return 0;
    }

    if (command === "modrinth-get") {
      const [resource, identifier] = positionalArgs(args);
      const resources = [
        "project",
        "project-dependencies",
        "version",
        "version-file",
        "user",
        "categories",
        "loaders",
        "game-versions",
        "project-types",
        "side-types",
        "donation-platforms",
        "report-types",
        "statistics",
      ] as const;
      if (!resource || !resources.includes(resource as (typeof resources)[number])) {
        throw new Error(`modrinth get requires a supported resource: ${resources.join(", ")}`);
      }
      const algorithm = readOption(args, "--algorithm", "sha1");
      if (algorithm !== "sha1" && algorithm !== "sha512") {
        throw new Error("modrinth get --algorithm must be sha1 or sha512");
      }
      printJson(
        output,
        await getModrinthResource({
          resource: resource as (typeof resources)[number],
          ...(identifier ? { identifier } : {}),
          ...(resource === "version-file" ? { algorithm } : {}),
        }),
      );
      return 0;
    }

    if (command === "server-validate-properties") {
      const parsed = parseServerPropertiesArgs(args);
      const propertyPath = parsed.path;
      if (!propertyPath.toLowerCase().endsWith(".properties")) {
        throw new Error("server validate-properties requires a .properties file");
      }
      const result = validateServerProperties({
        content: readBoundedServerProperties(propertyPath),
        ...(parsed.targetVersion ? { targetVersion: parsed.targetVersion } : {}),
      });
      printJson(output, result);
      return result.valid && result.preflight.accepted ? 0 : 1;
    }

    if (command === "modrinth-validate-pack") {
      const packPaths = positionalArgs(args);
      const packPath = packPaths[0];
      if (packPaths.length !== 1 || !packPath) {
        throw new Error("modrinth validate-pack requires exactly one local .mrpack file");
      }
      if (!packPath.toLowerCase().endsWith(".mrpack")) {
        throw new Error("modrinth validate-pack requires a file with the .mrpack extension");
      }
      const maxArchiveBytes = readIntegerArg(
        args.includes("--max-archive-bytes")
          ? readOption(args, "--max-archive-bytes", "")
          : String(defaultModrinthPackValidationLimits.maxArchiveBytes),
        "modrinth validate-pack --max-archive-bytes",
      );
      if (
        !Number.isSafeInteger(maxArchiveBytes) ||
        maxArchiveBytes < 1 ||
        maxArchiveBytes > defaultModrinthPackValidationLimits.maxArchiveBytes
      ) {
        throw new Error(
          `modrinth validate-pack --max-archive-bytes must be between 1 and ${defaultModrinthPackValidationLimits.maxArchiveBytes}`,
        );
      }
      const archive = readBoundedArchiveFile(packPath, maxArchiveBytes, {
        command: "modrinth validate-pack",
        extension: ".mrpack",
      });
      const result = validateModrinthPackArchive(archive, {
        additionalDownloadHosts: readRepeatedOption(args, "--allow-download-host"),
        limits: { maxArchiveBytes },
      });
      printJson(output, result);
      return result.valid ? 0 : 1;
    }

    if (command === "validate-server-access-list") {
      const accessListPaths = positionalArgsWithOptions(args, {
        values: ["--kind", "--evaluated-at"],
      });
      const accessListPath = accessListPaths[0];
      if (accessListPaths.length !== 1 || !accessListPath) {
        throw new Error("minecraft validate-access-list requires exactly one local JSON file");
      }
      const requestedKind = args.includes("--kind") ? readOption(args, "--kind", "") : "";
      if (requestedKind && !serverAccessListKinds.includes(requestedKind as ServerAccessListKind)) {
        throw new Error(
          "minecraft validate-access-list --kind must be whitelist, ops, banned-players, or banned-ips",
        );
      }
      const inferredKind = inferServerAccessListKind(basename(accessListPath));
      if (requestedKind && inferredKind && requestedKind !== inferredKind) {
        throw new Error(
          "minecraft validate-access-list --kind does not match the canonical filename",
        );
      }
      const kind = (requestedKind as ServerAccessListKind) || inferredKind;
      if (!kind) {
        throw new Error(
          "minecraft validate-access-list requires --kind when the filename is not a canonical vanilla access-list filename",
        );
      }
      const result = validateServerAccessList({
        kind,
        content: readServerAccessListFile(
          accessListPath,
          defaultServerAccessListValidationLimits.maxInputBytes,
        ),
        ...(args.includes("--evaluated-at")
          ? { evaluatedAt: readOption(args, "--evaluated-at", "") }
          : {}),
      });
      printJson(output, result);
      return result.valid ? 0 : 1;
    }

    if (command === "explain-path") {
      const positionals = positionalArgs(args);
      const [first, second] = positionals;
      const version = (second ? first : readOption(args, "--version", "latest")) ?? "latest";
      const path = second ?? first;
      if (!path) {
        throw new Error("explain-path command requires <path> or <version> <path>");
      }
      const domain = args.includes("--domain") ? readOption(args, "--domain", "") : "";
      if (domain && domain !== "datapack" && domain !== "resourcepack") {
        throw new Error("explain-path --domain must be datapack or resourcepack");
      }
      printJson(
        output,
        explainPackPath({
          edition,
          version,
          path,
          ...(domain === "datapack" || domain === "resourcepack" ? { domain } : {}),
        }),
      );
      return 0;
    }

    if (command === "suggest-lookups") {
      const task = positionalArgs(args).join(" ");
      if (!task) {
        throw new Error("suggest-lookups command requires a task");
      }
      const domain = args.includes("--domain")
        ? readOptionalAuthoringDomain(readOption(args, "--domain", ""))
        : undefined;
      printJson(
        output,
        suggestMinecraftLookups({
          edition,
          version: readOption(args, "--version", "latest"),
          task,
          ...(domain ? { domain } : {}),
          limit: Number(readOption(args, "--limit", "8")),
        }),
      );
      return 0;
    }

    if (command === "analyze-minecraft-log") {
      const parsed = parseMinecraftLogArgs(args);
      printJson(
        output,
        analyzeMinecraftLog({
          text: readBoundedMinecraftLog(parsed.filePath, parsed.maxInputBytes),
          limits: parsed.limits,
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
