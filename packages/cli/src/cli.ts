#!/usr/bin/env node
import {
  compareVersions,
  getDomain,
  getPaperPluginData,
  getSourcePolicy,
  getVanillaInventory,
  getVersionDetail,
  listDomains,
  listPackFormats,
  listReferences,
  listVersions,
  resolveVersion,
  searchPaperEvents,
} from "@minecraft-skills/catalog";

type Output = {
  write: (value: string) => void;
  error: (value: string) => void;
};

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
  minecraft-skills latest [--edition java]
  minecraft-skills versions [--edition java]
  minecraft-skills pack-formats [--edition java]
  minecraft-skills show-version [version] [--edition java]
  minecraft-skills compare-versions <from> <to> [--edition java]
  minecraft-skills vanilla-inventory [version] [--edition java]
  minecraft-skills paper-events <query> [--version latest] [--source paper] [--limit 20]
  minecraft-skills references [--domain datapack|resourcepack|paper-plugin]
  minecraft-skills domain <datapack|resourcepack|paper-plugin>
  minecraft-skills paper
  minecraft-skills source-policy

Commands:
  domains        List supported authoring domains.
  latest         Print the latest bundled version for an edition.
  versions       List bundled version metadata.
  pack-formats   List data/resource pack formats and Paper support by version.
  show-version   Print canonical JSON for a version.
  compare-versions
                 Compare bundled version metadata and vanilla inventory summaries.
  vanilla-inventory
                 Print vanilla client asset and server data inventory JSON.
  paper-events   Search Paper/Bukkit events through the configured spigot-event-list API.
  references     List generated skill references.
  domain         Print canonical JSON for an authoring domain.
  paper          Print canonical Paper plugin support and event search JSON.
  source-policy  Print source and license policy JSON.`);
}

function printJson(output: Output, value: unknown): void {
  output.write(JSON.stringify(value, null, 2));
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

    if (command === "vanilla-inventory") {
      const requested = positionalArgs(args)[0] ?? "latest";
      printJson(output, getVanillaInventory(edition, requested));
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

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await runCli(process.argv.slice(2));
}
