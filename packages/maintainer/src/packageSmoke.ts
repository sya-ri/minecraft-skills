import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type CommandResult = {
  command: string;
  stdout: string;
  stderr: string;
};

export type PackageSmokeResult = {
  ok: true;
  root: string;
  commands: CommandResult[];
};

const publishablePackages = [
  ["@minecraft-skills/data", "minecraft-skills-data-0.1.0.tgz"],
  ["@minecraft-skills/catalog", "minecraft-skills-catalog-0.1.0.tgz"],
  ["minecraft-skills", "minecraft-skills-0.1.0.tgz"],
  ["@minecraft-skills/mcp", "minecraft-skills-mcp-0.1.0.tgz"],
] as const;

function runCommand(command: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
  const commandText = [command, ...args].join(" ");
  const commandResult = {
    command: commandText,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
  };
  if (result.error) {
    throw new Error(`${commandText} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const output = [commandResult.stdout, commandResult.stderr].filter(Boolean).join("\n");
    throw new Error(`${commandText} failed with exit code ${result.status}\n${output}`);
  }
  return commandResult;
}

export function runPackageSmoke(options: { root: string; keepTemp?: boolean }): PackageSmokeResult {
  const root = resolve(options.root);
  const tempRoot = mkdtempSync(join(tmpdir(), "minecraft-skills-package-smoke-"));
  const tarballDir = join(tempRoot, "tarballs");
  const consumerDir = join(tempRoot, "consumer");
  const commands: CommandResult[] = [];

  try {
    mkdirSync(tarballDir, { recursive: true });
    mkdirSync(consumerDir, { recursive: true });

    for (const [packageName] of publishablePackages) {
      commands.push(
        runCommand(
          "pnpm",
          ["--filter", packageName, "pack", "--pack-destination", tarballDir],
          root,
        ),
      );
    }

    const dependencies = Object.fromEntries(
      publishablePackages.map(([packageName, tarball]) => [
        packageName,
        `file:${join(tarballDir, tarball)}`,
      ]),
    );
    writeFileSync(
      join(consumerDir, "package.json"),
      `${JSON.stringify(
        {
          name: "minecraft-skills-package-smoke",
          private: true,
          type: "module",
          dependencies,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(consumerDir, "pnpm-workspace.yaml"),
      [
        "overrides:",
        ...publishablePackages.map(
          ([packageName, tarball]) => `  "${packageName}": "file:${join(tarballDir, tarball)}"`,
        ),
        "",
      ].join("\n"),
    );

    commands.push(runCommand("pnpm", ["install", "--prefer-offline"], consumerDir));
    commands.push(
      runCommand(
        "node",
        [
          "--input-type=module",
          "--eval",
          [
            'import { readDataText } from "@minecraft-skills/data";',
            'if (!readDataText("skills/minecraft-paper-plugins/SKILL.md").includes("# Minecraft Paper Plugins")) throw new Error("missing skill payload");',
          ].join(" "),
        ],
        consumerDir,
      ),
    );
    commands.push(
      runCommand(
        "node",
        [
          "--input-type=module",
          "--eval",
          [
            'import { getCoverageSummary, getDatapackSchemaSurface, getPaperApiSurface } from "@minecraft-skills/catalog";',
            "const coverage = getCoverageSummary();",
            'if (!coverage.java.requiredData.complete || coverage.java.releases.latest !== "26.2" || coverage.java.datapack.observedSchemaSurfaces !== 1 || coverage.java.paperPlugin.apiPackageIndexes !== 43 || coverage.java.paperPlugin.apiSurfaces !== 1 || coverage.java.paperPlugin.missingApiPackageIndexes.length !== 0) throw new Error("bad coverage");',
            'if (getDatapackSchemaSurface("java", "26.2").coverage !== "vanilla-observed-datapack-json-shape") throw new Error("missing datapack schema surface");',
            'if (getPaperApiSurface("1.21.11").coverage !== "javadocs-search-index") throw new Error("missing Paper API surface");',
          ].join(" "),
        ],
        consumerDir,
      ),
    );
    commands.push(runCommand("pnpm", ["exec", "minecraft-skills", "latest"], consumerDir));
    const latest = commands.at(-1)?.stdout;
    if (latest !== "26.2") {
      throw new Error(`minecraft-skills latest returned ${latest}, expected 26.2`);
    }
    commands.push(
      runCommand(
        "pnpm",
        [
          "exec",
          "minecraft-skills",
          "write-skill",
          "minecraft-paper-plugins",
          "--output",
          join(consumerDir, "generated-skills"),
        ],
        consumerDir,
      ),
    );
    if (!existsSync(join(consumerDir, "generated-skills/minecraft-paper-plugins/SKILL.md"))) {
      throw new Error("write-skill did not materialize minecraft-paper-plugins/SKILL.md");
    }
    commands.push(
      runCommand(
        "node",
        [
          "--input-type=module",
          "--eval",
          [
            'import { createServer } from "@minecraft-skills/mcp";',
            'if (typeof createServer !== "function") throw new Error("missing MCP createServer export");',
          ].join(" "),
        ],
        consumerDir,
      ),
    );

    return {
      ok: true,
      root: tempRoot,
      commands,
    };
  } finally {
    if (!options.keepTemp) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}
