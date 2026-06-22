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

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
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

    const smokeEnv = {
      MINECRAFT_SKILLS_CACHE_DIR: join(consumerDir, ".minecraft-skills-cache"),
    };
    const sourceDataRoot = join(root, "packages/data/data");

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
            'if (!readDataText("authoring-checklists.json").includes("Paper Plugin Authoring Checklist")) throw new Error("missing authoring checklists");',
            'if (!readDataText("authoring-recipes.json").includes("paper-event-listener")) throw new Error("missing authoring recipes");',
            'if (!readDataText("authoring-scenarios.json").includes("paper-event-listener-review")) throw new Error("missing authoring scenarios");',
            'if (!readDataText("authoring-guardrails.json").includes("paper-api-surface-limits")) throw new Error("missing authoring guardrails");',
            'if (!readDataText("authoring-diagnostics.json").includes("paper-api-member-unverified")) throw new Error("missing authoring diagnostics");',
            'if (!readDataText("claim-policies.json").includes("paper-type-or-member-exists")) throw new Error("missing claim policies");',
            'if (!readDataText("output-requirements.json").includes("paper-plugin-output-safety")) throw new Error("missing output requirements");',
            'if (!readDataText("response-patterns.json").includes("paper-api-answer")) throw new Error("missing response patterns");',
            'if (!readDataText("intent-lookups.json").includes("verify-paper-type-or-member")) throw new Error("missing intent lookups");',
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
            'import { cleanCachedData, fetchData, getAuthoringChecklist, getAuthoringContext, getAuthoringDiagnostic, getAuthoringGuardrail, getAuthoringPlan, getAuthoringPreflight, getAuthoringRecipe, getAuthoringScenario, getClaimPolicy, getCoverageSummary, getDataManifest, getDatapackSchemaSurface, getEvidenceBundle, getFactSurface, getIntentLookup, getOutputRequirement, getPaperApiSurface, getResponsePattern, getSupportMatrix, hasBundledDataFile, listAuthoringChecklists, listAuthoringDiagnostics, listAuthoringGuardrails, listAuthoringRecipes, listAuthoringScenarios, listClaimPolicies, listFactSurfaces, listIntentLookups, listOutputRequirements, listResponsePatterns, listVersionSupport, searchAuthoringScenarios } from "@minecraft-skills/catalog";',
            'import { readFileSync } from "node:fs";',
            'import { join } from "node:path";',
            `const sourceDataRoot = ${JSON.stringify(sourceDataRoot)};`,
            'const localFetch = async (url) => { const path = new URL(url).pathname.split("/packages/data/data/").at(1); if (!path) return new Response("missing path", { status: 404, statusText: "Not Found" }); return new Response(readFileSync(join(sourceDataRoot, path)), { status: 200, statusText: "OK" }); };',
            "cleanCachedData();",
            "const coverage = getCoverageSummary();",
            "const manifest = getDataManifest();",
            "const support = getSupportMatrix();",
            'const checklist = getAuthoringChecklist("paper-plugin");',
            'const context = getAuthoringContext({ domain: "paper-plugin", version: "1.21.11" });',
            'const plan = getAuthoringPlan({ scenario: "paper-event-listener-review", version: "1.21.11" });',
            'const scenarioSearch = searchAuthoringScenarios({ query: "Paper event listener", domain: "paper-plugin" });',
            'const preflight = getAuthoringPreflight({ domain: "paper-plugin", version: "26.2" });',
            'const evidence = getEvidenceBundle({ domain: "paper-plugin", version: "1.21.11" });',
            'const factSurface = getFactSurface("datapack-schema-surface");',
            'if (!coverage.java.requiredData.complete || coverage.java.releases.latest !== "26.2" || coverage.java.paperPlugin.apiPackageIndexes !== 43 || coverage.java.paperPlugin.missingApiPackageIndexes.length !== 0) throw new Error("bad coverage");',
            'if (manifest.downloadable.length !== 73 || !manifest.downloadable.some((entry) => entry.kind === "datapack-schema-surface" && entry.version === "1.13") || !manifest.downloadable.some((entry) => entry.kind === "paper-api-surface" && entry.version === "1.20.5") || manifest.cache.environmentVariable !== "MINECRAFT_SKILLS_CACHE_DIR") throw new Error("bad data manifest");',
            'if (hasBundledDataFile("java/datapack-schema-surfaces/1.13.json") || hasBundledDataFile("java/paper-api-surfaces/1.20.5.json")) throw new Error("heavy data should be downloaded, not bundled in npm package");',
            'await fetchData({ kind: "datapack-schema-surface", version: "1.13", fetch: localFetch });',
            'await fetchData({ kind: "paper-api-surface", version: "1.20.5", fetch: localFetch });',
            'if (support.aliases.latestJava !== "26.2" || support.aliases.latestPaper !== "1.21.11") throw new Error("bad support matrix");',
            'if (listAuthoringChecklists().length !== 3 || !checklist.steps.some((step) => step.id === "verify-types-members-and-events")) throw new Error("bad authoring checklist");',
            'if (!listAuthoringRecipes({ domain: "paper-plugin" }).some((recipe) => recipe.id === "paper-event-listener") || !getAuthoringRecipe("paper-event-listener").steps.some((step) => step.id === "discover-event-candidates")) throw new Error("bad authoring recipes");',
            'if (!listAuthoringScenarios({ domain: "paper-plugin" }).some((scenario) => scenario.id === "paper-event-listener-review") || !getAuthoringScenario("paper-event-listener-review").requiredLookups.diagnostics.includes("paper-event-candidate-unverified")) throw new Error("bad authoring scenarios");',
            'if (scenarioSearch.results[0]?.scenario.id !== "paper-event-listener-review" || !scenarioSearch.results[0]?.matches.some((match) => match.matchedTokens.includes("event"))) throw new Error("bad authoring scenario search");',
            'if (!listAuthoringGuardrails({ domain: "paper-plugin" }).some((guardrail) => guardrail.id === "paper-api-surface-limits") || !getAuthoringGuardrail("paper-api-surface-limits").rules.some((rule) => rule.includes("Javadocs package"))) throw new Error("bad authoring guardrails");',
            'if (!listAuthoringDiagnostics({ domain: "paper-plugin" }).some((diagnostic) => diagnostic.id === "paper-api-member-unverified") || !getAuthoringDiagnostic("paper-api-member-unverified").tools.packageApis.includes("searchPaperMembers")) throw new Error("bad authoring diagnostics");',
            'if (!listClaimPolicies({ domain: "paper-plugin" }).some((policy) => policy.id === "paper-type-or-member-exists") || !getClaimPolicy("command-syntax-exists").allowedWording.some((wording) => wording.includes("parser shape"))) throw new Error("bad claim policies");',
            'if (!listOutputRequirements({ domain: "paper-plugin" }).some((requirement) => requirement.id === "paper-plugin-output-safety") || !getOutputRequirement("paper-plugin-output-safety").mustNotInclude.some((rule) => rule.includes("unverified event class names"))) throw new Error("bad output requirements");',
            'if (!listResponsePatterns({ domain: "paper-plugin" }).some((pattern) => pattern.id === "paper-api-answer") || !getResponsePattern("paper-api-answer").gapStatements.some((statement) => statement.includes("name presence"))) throw new Error("bad response patterns");',
            'if (!context.recipes.some((recipe) => recipe.id === "paper-event-listener") || !context.scenarios.some((scenario) => scenario.id === "paper-event-listener-review") || !context.guardrails.some((guardrail) => guardrail.id === "paper-api-surface-limits") || !context.diagnostics.some((diagnostic) => diagnostic.id === "paper-api-member-unverified") || !context.claimPolicies.some((policy) => policy.id === "paper-type-or-member-exists") || !context.outputRequirements.some((requirement) => requirement.id === "paper-plugin-output-safety") || !context.responsePatterns.some((pattern) => pattern.id === "paper-api-answer") || !context.intentLookups.some((intent) => intent.id === "verify-paper-type-or-member") || !context.evidence.links.some((link) => link.id === "paper-javadocs")) throw new Error("bad authoring context");',
            'if (plan.scenario.id !== "paper-event-listener-review" || !plan.recipes.some((recipe) => recipe.id === "paper-event-listener") || !plan.diagnostics.some((diagnostic) => diagnostic.id === "paper-event-candidate-unverified") || plan.preflight?.resolvedVersion !== "1.21.11" || !plan.evidence?.links.some((link) => link.id === "paper-javadocs")) throw new Error("bad authoring plan");',
            'if (!preflight.warnings.some((warning) => warning.includes("Paper is not marked supported for 26.2"))) throw new Error("bad authoring preflight");',
            'if (!evidence.links.some((link) => link.id === "paper-javadocs") || evidence.sourcePolicy.minecraftWikiTextRedistribution !== "forbidden") throw new Error("bad evidence bundle");',
            'if (!listVersionSupport({ domain: "paper-plugin" }).some((entry) => entry.version === "1.21.11" && entry.paper.supported)) throw new Error("bad version support");',
            'if (!listIntentLookups({ domain: "paper-plugin" }).some((intent) => intent.id === "discover-paper-event-candidates") || !getIntentLookup("verify-paper-type-or-member").lookups[0].tools.mcp.includes("search_paper_members")) throw new Error("bad intent lookups");',
            'if (!factSurface.nonGuarantees.includes("not a normative schema") || listFactSurfaces({ domain: "paper-plugin" }).length < 4) throw new Error("bad fact surfaces");',
            'if (getDatapackSchemaSurface("java", "1.13").coverage !== "vanilla-observed-datapack-json-shape") throw new Error("missing old datapack schema surface");',
            'if (getPaperApiSurface("1.20.5").coverage !== "javadocs-search-index") throw new Error("missing old Paper API surface");',
          ].join(" "),
        ],
        consumerDir,
        smokeEnv,
      ),
    );
    commands.push(
      runCommand("pnpm", ["exec", "minecraft-skills", "minecraft", "latest"], consumerDir),
    );
    const latest = commands.at(-1)?.stdout;
    if (latest !== "26.2") {
      throw new Error(`minecraft-skills latest returned ${latest}, expected 26.2`);
    }
    commands.push(
      runCommand("pnpm", ["exec", "minecraft-skills", "minecraft", "support-matrix"], consumerDir),
    );
    if (!commands.at(-1)?.stdout.includes('"latestPaper": "1.21.11"')) {
      throw new Error("minecraft-skills support-matrix did not include latestPaper");
    }
    commands.push(
      runCommand(
        "pnpm",
        ["exec", "minecraft-skills", "minecraft", "support", "--domain", "paper-plugin"],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes('"latestBuild": 69')) {
      throw new Error("minecraft-skills version-support did not include latest Paper build");
    }
    commands.push(
      runCommand(
        "pnpm",
        ["exec", "minecraft-skills", "plugin", "paper", "context", "1.21.11"],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("verify-paper-type-or-member")) {
      throw new Error("minecraft-skills authoring-context did not include intent lookups");
    }
    if (!commands.at(-1)?.stdout.includes("paper-event-listener")) {
      throw new Error("minecraft-skills authoring-context did not include authoring recipes");
    }
    if (!commands.at(-1)?.stdout.includes("paper-event-listener-review")) {
      throw new Error("minecraft-skills authoring-context did not include authoring scenarios");
    }
    if (!commands.at(-1)?.stdout.includes("paper-plugin-output-safety")) {
      throw new Error("minecraft-skills authoring-context did not include output requirements");
    }
    if (!commands.at(-1)?.stdout.includes("paper-api-answer")) {
      throw new Error("minecraft-skills authoring-context did not include response patterns");
    }
    if (!commands.at(-1)?.stdout.includes("paper-api-member-unverified")) {
      throw new Error("minecraft-skills authoring-context did not include diagnostics");
    }
    commands.push(
      runCommand(
        "pnpm",
        ["exec", "minecraft-skills", "plugin", "paper", "search-scenarios", "Paper event listener"],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("paper-event-listener-review")) {
      throw new Error("minecraft-skills authoring-scenario-search did not route listener task");
    }
    if (!commands.at(-1)?.stdout.includes("matchedTokens")) {
      throw new Error("minecraft-skills authoring-scenario-search did not include match evidence");
    }
    commands.push(
      runCommand(
        "pnpm",
        [
          "exec",
          "minecraft-skills",
          "plugin",
          "paper",
          "plan",
          "paper-event-listener-review",
          "1.21.11",
        ],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("paper-event-candidate-unverified")) {
      throw new Error("minecraft-skills authoring-plan did not include required diagnostics");
    }
    if (!commands.at(-1)?.stdout.includes('"id": "paper-javadocs"')) {
      throw new Error("minecraft-skills authoring-plan did not include evidence links");
    }
    commands.push(
      runCommand(
        "pnpm",
        ["exec", "minecraft-skills", "plugin", "paper", "preflight", "26.2"],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("Paper is not marked supported for 26.2")) {
      throw new Error("minecraft-skills preflight did not include Paper support warning");
    }
    commands.push(
      runCommand(
        "pnpm",
        ["exec", "minecraft-skills", "plugin", "paper", "evidence", "1.21.11"],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes('"id": "paper-javadocs"')) {
      throw new Error("minecraft-skills evidence did not include Paper Javadocs link");
    }
    commands.push(
      runCommand("pnpm", ["exec", "minecraft-skills", "plugin", "paper", "checklist"], consumerDir),
    );
    if (!commands.at(-1)?.stdout.includes("verify-types-members-and-events")) {
      throw new Error("minecraft-skills authoring-checklist did not include Paper checks");
    }
    commands.push(
      runCommand(
        "pnpm",
        ["exec", "minecraft-skills", "plugin", "paper", "recipe", "paper-event-listener"],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("discover-event-candidates")) {
      throw new Error("minecraft-skills authoring-recipe did not include Paper event workflow");
    }
    commands.push(
      runCommand(
        "pnpm",
        ["exec", "minecraft-skills", "plugin", "paper", "scenario", "paper-event-listener-review"],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("paper-event-candidate-unverified")) {
      throw new Error("minecraft-skills authoring-scenario did not include Paper event checks");
    }
    commands.push(
      runCommand(
        "pnpm",
        ["exec", "minecraft-skills", "plugin", "paper", "guardrail", "paper-api-surface-limits"],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("Javadocs package, type, and member indexes")) {
      throw new Error("minecraft-skills authoring-guardrail did not include Paper API guardrail");
    }
    commands.push(
      runCommand(
        "pnpm",
        [
          "exec",
          "minecraft-skills",
          "plugin",
          "paper",
          "diagnostic",
          "paper-api-member-unverified",
        ],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("searchPaperMembers")) {
      throw new Error("minecraft-skills authoring-diagnostic did not include Paper API checks");
    }
    commands.push(
      runCommand(
        "pnpm",
        [
          "exec",
          "minecraft-skills",
          "plugin",
          "paper",
          "claim-policy",
          "paper-type-or-member-exists",
        ],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("name presence in Javadocs")) {
      throw new Error("minecraft-skills claim-policy did not include Paper member policy");
    }
    commands.push(
      runCommand(
        "pnpm",
        [
          "exec",
          "minecraft-skills",
          "plugin",
          "paper",
          "output-requirement",
          "paper-plugin-output-safety",
        ],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("unverified event class names")) {
      throw new Error("minecraft-skills output-requirement did not include Paper output safety");
    }
    commands.push(
      runCommand(
        "pnpm",
        ["exec", "minecraft-skills", "plugin", "paper", "response-pattern", "paper-api-answer"],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("name presence, not behavior")) {
      throw new Error("minecraft-skills response-pattern did not include Paper API answer pattern");
    }
    commands.push(
      runCommand(
        "pnpm",
        ["exec", "minecraft-skills", "plugin", "paper", "intent", "verify-paper-type-or-member"],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("search_paper_members")) {
      throw new Error("minecraft-skills intent-lookup did not include Paper member lookup");
    }
    commands.push(
      runCommand(
        "pnpm",
        ["exec", "minecraft-skills", "plugin", "paper", "fact-surface", "paper-api-surface"],
        consumerDir,
      ),
    );
    if (!commands.at(-1)?.stdout.includes("does not prove method behavior")) {
      throw new Error("minecraft-skills fact-surface did not include non-guarantees");
    }
    commands.push(
      runCommand(
        "pnpm",
        [
          "exec",
          "minecraft-skills",
          "skill",
          "write",
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
