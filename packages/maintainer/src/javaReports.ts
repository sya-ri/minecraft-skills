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
import { join } from "node:path";
import { listZipEntries } from "./zip.js";

type CommandNode = {
  type: string;
  children?: Record<string, CommandNode>;
  executable?: boolean;
  parser?: string;
};

type DatapackEntry = {
  elements?: boolean;
  format?: string;
  stable?: boolean;
  tags?: boolean;
};

type RegistryReport = {
  entries?: Record<string, unknown>;
  protocol_id?: number;
};

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
    }>;
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

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
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
} {
  const datapackPath = join(reportsDir, "datapack.json");
  const datapack = existsSync(datapackPath) ? asObject(readJson(datapackPath)) : {};
  const registryDumpPath = join(reportsDir, "registries.json");
  const registryDump = existsSync(registryDumpPath) ? asObject(readJson(registryDumpPath)) : {};
  const others = asObject(datapack.others);
  const datapackRegistries = asObject(datapack.registries);
  const registryIds = new Set([...Object.keys(datapackRegistries), ...Object.keys(registryDump)]);

  return {
    otherTypes: Object.entries(others)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, value]) => {
        const entry = value as DatapackEntry;
        return {
          id,
          elements: typeof entry.elements === "boolean" ? entry.elements : null,
          format: typeof entry.format === "string" ? entry.format : null,
          stable: typeof entry.stable === "boolean" ? entry.stable : null,
          tags: typeof entry.tags === "boolean" ? entry.tags : null,
        };
      }),
    registries: [...registryIds]
      .sort((left, right) => left.localeCompare(right))
      .map((id) => {
        const entry = datapackRegistries[id] as DatapackEntry | undefined;
        const report = registryDump[id] as RegistryReport | undefined;
        return {
          id,
          elements: typeof entry?.elements === "boolean" ? entry.elements : null,
          stable: typeof entry?.stable === "boolean" ? entry.stable : null,
          tags: typeof entry?.tags === "boolean" ? entry.tags : null,
          entryCount: report?.entries ? Object.keys(report.entries).length : null,
          protocolId: typeof report?.protocol_id === "number" ? report.protocol_id : null,
        };
      }),
  };
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
  const serverJar = versionJars.find((path) => path.includes("/server-"));
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
        [mainJar, ...libraries].join(":"),
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
}): { summary: JavaReportsSummary; commandPaths: string[] } {
  const commands = readCommands(options.reportsDir);
  const datapack = readDatapackReports(options.reportsDir);
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
      datapack,
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
  };
}

export function writeJavaReportsSummary(options: {
  root: string;
  version: string;
  summary: JavaReportsSummary;
  commandPaths: string[];
}): void {
  const reportsRoot = join(options.root, "packages/data/data/java/reports");
  const commandRoot = join(options.root, "packages/data/data/java/command-paths");
  mkdirSync(reportsRoot, { recursive: true });
  mkdirSync(commandRoot, { recursive: true });
  writeFileSync(
    join(reportsRoot, `${options.version}.json`),
    `${JSON.stringify(options.summary, null, 2)}\n`,
  );
  writeFileSync(
    join(commandRoot, `${options.version}.txt`),
    `${options.commandPaths.join("\n")}\n`,
  );
}
