#!/usr/bin/env node
import {
  getDomain,
  getSourcePolicy,
  getVersionDetail,
  listDomains,
  listReferences,
  listVersions,
  resolveVersion,
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

function printHelp(output: Output): void {
  output.write(`minecraft-skills

Usage:
  minecraft-skills domains
  minecraft-skills latest [--edition java]
  minecraft-skills versions [--edition java]
  minecraft-skills show-version [version] [--edition java]
  minecraft-skills references [--domain datapack|resourcepack|paper-plugin]
  minecraft-skills domain <datapack|resourcepack|paper-plugin>
  minecraft-skills source-policy

Commands:
  domains        List supported authoring domains.
  latest         Print the latest bundled version for an edition.
  versions       List bundled version metadata.
  show-version   Print canonical JSON for a version.
  references     List generated skill references.
  domain         Print canonical JSON for an authoring domain.
  source-policy  Print source and license policy JSON.`);
}

function printJson(output: Output, value: unknown): void {
  output.write(JSON.stringify(value, null, 2));
}

export function runCli(argv: string[], output: Output = defaultOutput): number {
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

    if (command === "show-version") {
      const requested = args.find((arg) => !arg.startsWith("--")) ?? "latest";
      printJson(output, getVersionDetail(edition, requested));
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
  process.exitCode = runCli(process.argv.slice(2));
}
