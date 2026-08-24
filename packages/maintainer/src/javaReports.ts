import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, delimiter, join } from "node:path";
import { listZipEntries } from "./zip.js";

type CommandNode = {
  type: string;
  children?: Record<string, CommandNode>;
  executable?: boolean;
  parser?: string;
};

type DatapackEntry = {
  elements?: boolean;
  entries?: Record<string, RegistryEntryReport>;
  format?: string;
  protocol_id?: number;
  stable?: boolean;
  tags?: boolean;
};

type RegistryEntryReport = {
  protocol_id?: number;
};

type RegistryReport = {
  entries?: Record<string, RegistryEntryReport>;
  protocol_id?: number;
};

export type JavaRegistryEntry = {
  registryId: string;
  entryId: string;
  protocolId: number | null;
};

export const javaRegistryEntryIndexHeader = "registry_id\tentry_id\tentry_protocol_id";

export type JavaReportsSummary = {
  schemaVersion: 1;
  edition: "java";
  version: string;
  coverage: "server-reports";
  commands: {
    rootLiterals: string[];
    executablePathCount: number;
    argumentParsers: string[];
  };
  datapack: {
    otherTypes: Array<{
      id: string;
      elements: boolean | null;
      format: string | null;
      stable: boolean | null;
      tags: boolean | null;
    }>;
    registries: Array<{
      id: string;
      elements: boolean | null;
      stable: boolean | null;
      tags: boolean | null;
      entryCount: number | null;
      protocolId: number | null;
      entryIndexStatus: "indexed" | "unindexed";
    }>;
    registryEntries: {
      path: string;
      coverage: "official-report" | "official-report-unavailable";
      indexedRegistryCount: number;
      unindexedRegistryCount: number;
      entryCount: number;
    };
  };
  reports: Array<{
    path: string;
    size: number;
  }>;
  sources: Array<{
    id: string;
    kind: string;
    url: string;
    retrievedAt: string;
  }>;
};

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be a plain object`);
  }
  return value;
}

function readJsonObject(path: string, label: string): Record<string, unknown> {
  return requirePlainObject(readJson(path), `${label} root`);
}

const namespacedIdPattern = /^[a-z0-9_.-]+:[a-z0-9/._-]+$/;

function requireNamespacedId(value: string, label: string): void {
  if (!namespacedIdPattern.test(value)) {
    throw new Error(`${label} must be a namespaced Minecraft identifier: ${JSON.stringify(value)}`);
  }
}

function readOptionalProtocolId(record: Record<string, unknown>, label: string): number | null {
  if (!Object.hasOwn(record, "protocol_id")) {
    return null;
  }
  const value = record.protocol_id;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.protocol_id must be a non-negative safe integer`);
  }
  return value;
}

function readOptionalBoolean(
  record: Record<string, unknown>,
  key: "elements" | "stable" | "tags",
  label: string,
): boolean | undefined {
  if (!Object.hasOwn(record, key)) {
    return undefined;
  }
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`${label}.${key} must be a boolean`);
  }
  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: "format",
  label: string,
): string | undefined {
  if (!Object.hasOwn(record, key)) {
    return undefined;
  }
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${label}.${key} must be a string`);
  }
  return value;
}

function validateRegistryContainer(
  value: unknown,
  label: string,
): Record<string, DatapackEntry & RegistryReport> {
  const registries = requirePlainObject(value, label);
  const validated: Record<string, DatapackEntry & RegistryReport> = {};
  for (const [registryId, rawRegistry] of Object.entries(registries)) {
    requireNamespacedId(registryId, `${label} registry ID`);
    const registryLabel = `${label}.${registryId}`;
    const registry = requirePlainObject(rawRegistry, registryLabel);
    const protocolId = readOptionalProtocolId(registry, registryLabel);
    const entry: DatapackEntry & RegistryReport = {};
    for (const key of ["elements", "stable", "tags"] as const) {
      const booleanValue = readOptionalBoolean(registry, key, registryLabel);
      if (booleanValue !== undefined) {
        entry[key] = booleanValue;
      }
    }
    const format = readOptionalString(registry, "format", registryLabel);
    if (format !== undefined) {
      entry.format = format;
    }
    if (protocolId !== null) {
      entry.protocol_id = protocolId;
    }
    if (Object.hasOwn(registry, "entries")) {
      const entries = requirePlainObject(registry.entries, `${registryLabel}.entries`);
      const validatedEntries: Record<string, RegistryEntryReport> = {};
      for (const [entryId, rawEntry] of Object.entries(entries)) {
        requireNamespacedId(entryId, `${label}.${registryId} entry ID`);
        const entryLabel = `${registryLabel}.entries.${entryId}`;
        const entryRecord = requirePlainObject(rawEntry, entryLabel);
        const entryProtocolId = readOptionalProtocolId(entryRecord, entryLabel);
        validatedEntries[entryId] =
          entryProtocolId === null ? {} : { protocol_id: entryProtocolId };
      }
      entry.entries = validatedEntries;
    }
    validated[registryId] = entry;
  }
  return validated;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function collectCommandPaths(
  node: CommandNode,
  current: string[],
  paths: string[],
  parsers: Set<string>,
): void {
  if (node.executable) {
    paths.push(current.join(" "));
  }
  for (const [name, child] of Object.entries(node.children ?? {})) {
    if (child.type === "argument" && child.parser) {
      parsers.add(child.parser);
      collectCommandPaths(child, [...current, `<${name}:${child.parser}>`], paths, parsers);
      continue;
    }
    collectCommandPaths(child, [...current, name], paths, parsers);
  }
}

function readCommands(reportsDir: string): {
  rootLiterals: string[];
  executablePaths: string[];
  argumentParsers: string[];
} {
  const root = readJson(join(reportsDir, "commands.json")) as CommandNode;
  const paths: string[] = [];
  const parsers = new Set<string>();
  collectCommandPaths(root, [], paths, parsers);
  return {
    rootLiterals: Object.keys(root.children ?? {}).sort(),
    executablePaths: paths.sort(),
    argumentParsers: [...parsers].sort(),
  };
}

function readDatapackReports(reportsDir: string): {
  otherTypes: JavaReportsSummary["datapack"]["otherTypes"];
  registries: JavaReportsSummary["datapack"]["registries"];
  registryEntries: JavaRegistryEntry[];
  registryEntryCoverage: JavaReportsSummary["datapack"]["registryEntries"]["coverage"];
} {
  const datapackPath = join(reportsDir, "datapack.json");
  const datapack = existsSync(datapackPath) ? readJsonObject(datapackPath, "datapack.json") : {};
  const registryDumpPath = join(reportsDir, "registries.json");
  const registryDump = existsSync(registryDumpPath)
    ? validateRegistryContainer(
        readJsonObject(registryDumpPath, "registries.json"),
        "registries.json",
      )
    : {};
  const others = Object.hasOwn(datapack, "others")
    ? requirePlainObject(datapack.others, "datapack.json.others")
    : {};
  for (const [id, value] of Object.entries(others)) {
    requirePlainObject(value, `datapack.json.others.${id}`);
  }
  const datapackRegistries = Object.hasOwn(datapack, "registries")
    ? validateRegistryContainer(datapack.registries, "datapack.json.registries")
    : {};
  const registryIds = new Set([...Object.keys(datapackRegistries), ...Object.keys(registryDump)]);
  const registryEntries = new Map<string, JavaRegistryEntry>();
  let hasExplicitEntryReport = existsSync(registryDumpPath);

  const collectEntries = (
    registryId: string,
    source: DatapackEntry | RegistryReport | undefined,
    sourceName: string,
  ): boolean => {
    const entries = source?.entries;
    if (!entries) {
      return false;
    }
    hasExplicitEntryReport = true;
    for (const [entryId, entry] of Object.entries(entries)) {
      const protocolId = entry.protocol_id ?? null;
      const key = `${registryId}\t${entryId}`;
      const existing = registryEntries.get(key);
      if (
        existing?.protocolId !== null &&
        existing?.protocolId !== undefined &&
        protocolId !== null &&
        existing.protocolId !== protocolId
      ) {
        throw new Error(
          `Conflicting protocol IDs for ${registryId} ${entryId}: ${existing.protocolId} and ${protocolId} (${sourceName})`,
        );
      }
      registryEntries.set(key, {
        registryId,
        entryId,
        protocolId: existing?.protocolId ?? protocolId,
      });
    }
    return true;
  };

  const indexedRegistryIds = new Set<string>();
  for (const id of registryIds) {
    const datapackEntry = datapackRegistries[id];
    const registryReport = registryDump[id];
    if (collectEntries(id, datapackEntry, "datapack.json")) {
      indexedRegistryIds.add(id);
    }
    if (collectEntries(id, registryReport, "registries.json")) {
      indexedRegistryIds.add(id);
    }
  }

  const sortedRegistryEntries = [...registryEntries.values()].sort(
    (left, right) =>
      compareStrings(left.registryId, right.registryId) ||
      compareStrings(left.entryId, right.entryId),
  );
  const registryEntryCounts = new Map<string, number>();
  for (const registryEntry of sortedRegistryEntries) {
    registryEntryCounts.set(
      registryEntry.registryId,
      (registryEntryCounts.get(registryEntry.registryId) ?? 0) + 1,
    );
  }

  return {
    otherTypes: Object.entries(others)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([id, value]) => {
        const entry = requirePlainObject(value, `datapack.json.others.${id}`);
        return {
          id,
          elements: typeof entry.elements === "boolean" ? entry.elements : null,
          format: typeof entry.format === "string" ? entry.format : null,
          stable: typeof entry.stable === "boolean" ? entry.stable : null,
          tags: typeof entry.tags === "boolean" ? entry.tags : null,
        };
      }),
    registries: [...registryIds].sort(compareStrings).map((id) => {
      const entry = datapackRegistries[id];
      const report = registryDump[id];
      const entryCount = registryEntryCounts.get(id) ?? 0;
      const entryIndexStatus = indexedRegistryIds.has(id) ? "indexed" : "unindexed";
      const datapackProtocolId = typeof entry?.protocol_id === "number" ? entry.protocol_id : null;
      const reportProtocolId = typeof report?.protocol_id === "number" ? report.protocol_id : null;
      if (
        datapackProtocolId !== null &&
        reportProtocolId !== null &&
        datapackProtocolId !== reportProtocolId
      ) {
        throw new Error(
          `Conflicting registry protocol IDs for ${id}: ${datapackProtocolId} and ${reportProtocolId}`,
        );
      }
      return {
        id,
        elements: typeof entry?.elements === "boolean" ? entry.elements : null,
        stable: typeof entry?.stable === "boolean" ? entry.stable : null,
        tags: typeof entry?.tags === "boolean" ? entry.tags : null,
        entryCount: entryIndexStatus === "indexed" ? entryCount : null,
        protocolId: reportProtocolId ?? datapackProtocolId,
        entryIndexStatus,
      };
    }),
    registryEntries: sortedRegistryEntries,
    registryEntryCoverage: hasExplicitEntryReport
      ? "official-report"
      : "official-report-unavailable",
  };
}

function assertTsvValue(value: string, label: string): void {
  if (/[\t\r\n]/.test(value)) {
    throw new Error(`${label} cannot contain tabs or newlines: ${JSON.stringify(value)}`);
  }
}

export function serializeJavaRegistryEntries(entries: JavaRegistryEntry[]): string {
  const lines = [javaRegistryEntryIndexHeader];
  for (const entry of entries) {
    assertTsvValue(entry.registryId, "Registry ID");
    assertTsvValue(entry.entryId, "Registry entry ID");
    lines.push(
      `${entry.registryId}\t${entry.entryId}\t${entry.protocolId === null ? "" : entry.protocolId}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function reportFiles(reportsDir: string): JavaReportsSummary["reports"] {
  return readdirSync(reportsDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      return {
        path: `reports/${name}`,
        size: statSync(join(reportsDir, name)).size,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function listJarFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...listJarFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".jar")) {
      result.push(path);
    }
  }
  return result.sort();
}

function findBundledServerJar(workDir: string): string {
  const versionJars = listJarFiles(join(workDir, "versions"));
  const serverJar = versionJars.find((path) => basename(path).startsWith("server-"));
  if (!serverJar) {
    throw new Error(`Could not find unpacked bundled server jar under ${workDir}/versions`);
  }
  return serverJar;
}

export function generateJavaReports(options: {
  javaBin: string;
  serverJarPath: string;
  workDir: string;
  outputDir: string;
}): void {
  rmSync(options.workDir, { recursive: true, force: true });
  mkdirSync(options.workDir, { recursive: true });
  const serverJar = readFileSync(options.serverJarPath);
  const bundled = listZipEntries(serverJar).some(
    (entry) => entry.name === "META-INF/versions.list",
  );
  const outputDir = options.outputDir;

  if (bundled) {
    run(options.javaBin, ["-jar", options.serverJarPath, "--help"], options.workDir);
    const mainJar = findBundledServerJar(options.workDir);
    const libraries = listJarFiles(join(options.workDir, "libraries"));
    run(
      options.javaBin,
      [
        "-cp",
        [mainJar, ...libraries].join(delimiter),
        "net.minecraft.data.Main",
        "--reports",
        "--output",
        outputDir,
      ],
      options.workDir,
    );
    return;
  }

  run(
    options.javaBin,
    ["-cp", options.serverJarPath, "net.minecraft.data.Main", "--reports", "--output", outputDir],
    options.workDir,
  );
}

export function buildJavaReportsSummary(options: {
  version: string;
  reportsDir: string;
  serverJarUrl: string;
  retrievedAt: string;
}): {
  summary: JavaReportsSummary;
  commandPaths: string[];
  registryEntries: JavaRegistryEntry[];
} {
  const commands = readCommands(options.reportsDir);
  const datapack = readDatapackReports(options.reportsDir);
  const indexedRegistryCount = datapack.registries.filter(
    (registry) => registry.entryIndexStatus === "indexed",
  ).length;
  return {
    summary: {
      schemaVersion: 1,
      edition: "java",
      version: options.version,
      coverage: "server-reports",
      commands: {
        rootLiterals: commands.rootLiterals,
        executablePathCount: commands.executablePaths.length,
        argumentParsers: commands.argumentParsers,
      },
      datapack: {
        otherTypes: datapack.otherTypes,
        registries: datapack.registries,
        registryEntries: {
          path: `java/registry-entries/${options.version}.tsv`,
          coverage: datapack.registryEntryCoverage,
          indexedRegistryCount,
          unindexedRegistryCount: datapack.registries.length - indexedRegistryCount,
          entryCount: datapack.registryEntries.length,
        },
      },
      reports: reportFiles(options.reportsDir),
      sources: [
        {
          id: "mojang-server-reports",
          kind: "official-generated",
          url: options.serverJarUrl,
          retrievedAt: options.retrievedAt,
        },
      ],
    },
    commandPaths: commands.executablePaths,
    registryEntries: datapack.registryEntries,
  };
}

export function writeJavaReportsSummary(options: {
  root: string;
  version: string;
  summary: JavaReportsSummary;
  commandPaths: string[];
  registryEntries: JavaRegistryEntry[];
}): void {
  const reportsRoot = join(options.root, "packages/data/data/java/reports");
  const commandRoot = join(options.root, "packages/data/data/java/command-paths");
  const registryEntryRoot = join(options.root, "packages/data/data/java/registry-entries");
  mkdirSync(reportsRoot, { recursive: true });
  mkdirSync(commandRoot, { recursive: true });
  mkdirSync(registryEntryRoot, { recursive: true });
  writeFileSync(
    join(reportsRoot, `${options.version}.json`),
    `${JSON.stringify(options.summary, null, 2)}\n`,
  );
  writeFileSync(
    join(commandRoot, `${options.version}.txt`),
    `${options.commandPaths.join("\n")}\n`,
  );
  writeFileSync(
    join(registryEntryRoot, `${options.version}.tsv`),
    serializeJavaRegistryEntries(options.registryEntries),
  );
}
