import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

function readDatapack(reportsDir: string): {
  otherTypes: JavaReportsSummary["datapack"]["otherTypes"];
  registries: JavaReportsSummary["datapack"]["registries"];
} {
  const datapack = asObject(readJson(join(reportsDir, "datapack.json")));
  const registryDump = asObject(readJson(join(reportsDir, "registries.json")));
  const others = asObject(datapack.others);
  const registries = asObject(datapack.registries);

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
    registries: Object.entries(registries)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, value]) => {
        const entry = value as DatapackEntry;
        const report = registryDump[id] as RegistryReport | undefined;
        return {
          id,
          elements: typeof entry.elements === "boolean" ? entry.elements : null,
          stable: typeof entry.stable === "boolean" ? entry.stable : null,
          tags: typeof entry.tags === "boolean" ? entry.tags : null,
          entryCount: report?.entries ? Object.keys(report.entries).length : null,
          protocolId: typeof report?.protocol_id === "number" ? report.protocol_id : null,
        };
      }),
  };
}

function reportFiles(reportsDir: string): JavaReportsSummary["reports"] {
  const names = [
    "blocks.json",
    "commands.json",
    "datapack.json",
    "json-rpc-api-schema.json",
    "packets.json",
    "registries.json",
  ];
  return names
    .map((name) => {
      const content = readFileSync(join(reportsDir, name));
      return {
        path: `reports/${name}`,
        size: content.length,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function buildJavaReportsSummary(options: {
  version: string;
  reportsDir: string;
  serverJarUrl: string;
  retrievedAt: string;
}): { summary: JavaReportsSummary; commandPaths: string[] } {
  const commands = readCommands(options.reportsDir);
  const datapack = readDatapack(options.reportsDir);
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
