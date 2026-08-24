import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildModrinthProjectSearchUrl,
  buildModrinthProjectVersionsUrl,
  buildModrinthResourceUrl,
  buildPaperEventSearchUrl,
  classifyPackFiles,
  compareCommands,
  compareDatapackSchema,
  comparePaperApi,
  comparePaperApiSurface,
  compareVanillaPaths,
  compareVersions,
  explainPackPath,
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
  getClaimPolicy,
  getCoverageSummary,
  getDatapackSchemaSurface,
  getDomain,
  getEvidenceBundle,
  getFactSurface,
  getIntentLookup,
  getJavaReportsSummary,
  getModrinthResource,
  getMojangVersionMetadata,
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
  getVersionDetail,
  listAuthoringChecklists,
  listAuthoringDiagnostics,
  listAuthoringGuardrails,
  listAuthoringRecipes,
  listAuthoringScenarios,
  listClaimPolicies,
  listCommunityDatasets,
  listDomains,
  listFactSurfaces,
  listIntentLookups,
  listModrinthProjectVersions,
  listOutputRequirements,
  listPackFormats,
  listResponsePatterns,
  listSkills,
  listSourceTiers,
  listVersionSupport,
  resolveVersion,
  searchAll,
  searchAuthoringScenarios,
  searchCatalog,
  searchCommands,
  searchDatapackSchema,
  searchModrinthProjects,
  searchPaperMembers,
  searchPaperTypes,
  searchResourcepackModelPaths,
  searchVanillaDatapackJsonFiles,
  searchVanillaPaths,
  suggestMinecraftLookups,
  validatePackFileContent,
  validatePackFilesContent,
} from "./index.js";

function testJar(entries: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const contentBytes = Buffer.from(content);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(contentBytes.length, 18);
    local.writeUInt32LE(contentBytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);
    localParts.push(local, contentBytes);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(contentBytes.length, 20);
    central.writeUInt32LE(contentBytes.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centralParts.push(central);
    offset += local.length + contentBytes.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function withCachedServerJar(
  version: string,
  entries: Record<string, string>,
  run: () => void,
): void {
  const root = mkdtempSync(join(tmpdir(), "minecraft-skills-test-"));
  const previous = process.env.MINECRAFT_SKILLS_CACHE_DIR;
  process.env.MINECRAFT_SKILLS_CACHE_DIR = root;
  try {
    const jarDir = join(root, "mojang-server-jars");
    mkdirSync(jarDir, { recursive: true });
    writeFileSync(join(jarDir, `${version}.jar`), testJar(entries));
    run();
  } finally {
    if (previous === undefined) {
      delete process.env.MINECRAFT_SKILLS_CACHE_DIR;
    } else {
      process.env.MINECRAFT_SKILLS_CACHE_DIR = previous;
    }
    rmSync(root, { recursive: true, force: true });
  }
}

describe("catalog", () => {
  it("loads supported domains", () => {
    expect(listDomains().map((domain) => domain.id)).toEqual([
      "datapack",
      "resourcepack",
      "paper-plugin",
    ]);
  });

  it("returns Mojang/Piston official version metadata", () => {
    const metadata = getMojangVersionMetadata("java", "26.2");
    expect(metadata.version).toBe("26.2");
    expect(metadata.official.serverJarUrl).toContain("piston-data.mojang.com");
    expect(metadata.official.versionMetadataUrl).toContain("piston-meta.mojang.com");
    expect(metadata.packFormats.data).toBe(107);
    expect(metadata.provenance.tier).toBe("official");
  });

  it("searches and reads cached vanilla datapack JSON from a Mojang server jar", () => {
    withCachedServerJar(
      "26.2",
      {
        "data/minecraft/recipe/test.json": '{"type":"minecraft:crafting_shapeless"}',
        "data/minecraft/loot_table/blocks/test.json": '{"type":"minecraft:block"}',
      },
      () => {
        const search = searchVanillaDatapackJsonFiles({
          version: "26.2",
          kind: "recipe",
          contains: "test",
        });
        expect(search.matchedFiles).toBe(1);
        expect(search.files[0]?.path).toBe("data/minecraft/recipe/test.json");

        const file = getVanillaDatapackJson({
          version: "26.2",
          path: "data/minecraft/recipe/test.json",
        });
        expect(file.json).toEqual({ type: "minecraft:crafting_shapeless" });
      },
    );
  });

  it("lists installable skill folders", () => {
    expect(listSkills().map((skill) => skill.name)).toEqual([
      "minecraft-datapacks",
      "minecraft-resourcepacks",
      "minecraft-paper-plugins",
    ]);
    expect(listSkills("paper-plugin")).toEqual([
      expect.objectContaining({
        name: "minecraft-paper-plugins",
        path: "skills/minecraft-paper-plugins",
        agentMetadata: "skills/minecraft-paper-plugins/agents/openai.yaml",
      }),
    ]);
  });

  it("loads packaged skill payloads", () => {
    const payload = getSkillPayload("minecraft-paper-plugins");
    expect(payload.skill.domain).toBe("paper-plugin");
    expect(payload.skillMarkdown).toContain("# Minecraft Paper Plugins");
    expect(payload.agentMetadata).toContain('display_name: "Minecraft Paper Plugins"');
    expect(payload.references).toEqual([
      expect.objectContaining({
        reference: expect.objectContaining({
          id: "paper-plugin-sources",
          path: "skills/minecraft-paper-plugins/references/sources.md",
        }),
        markdown: expect.stringContaining("# Paper Plugin Sources"),
      }),
    ]);
  });

  it("lists fact surfaces with guarantees and non-guarantees", () => {
    const datapackSurfaces = listFactSurfaces({ domain: "datapack" });
    expect(datapackSurfaces.map((surface) => surface.id)).toContain("datapack-schema-surface");
    expect(datapackSurfaces.map((surface) => surface.id)).toContain("command-paths");

    const schemaSurface = getFactSurface("datapack-schema-surface");
    expect(schemaSurface.nonGuarantees).toContain("not a normative schema");
    expect(schemaSurface.cli).toContain("datapack search-schema");

    expect(() => getFactSurface("missing")).toThrow("Unknown fact surface: missing");
  });

  it("lists authoring checklists for generation preflight", () => {
    const checklists = listAuthoringChecklists();
    expect(checklists.map((checklist) => checklist.domain)).toEqual([
      "datapack",
      "resourcepack",
      "paper-plugin",
    ]);

    const datapack = getAuthoringChecklist("datapack");
    expect(datapack.steps.map((step) => step.id)).toContain("verify-commands-and-paths");
    expect(datapack.steps.flatMap((step) => step.tools.cli)).toContain("datapack commands");
    expect(datapack.steps.flatMap((step) => step.tools.mcp)).toContain("search_commands");

    const paper = getAuthoringChecklist("paper-plugin");
    expect(paper.steps.map((step) => step.id)).toContain("verify-types-members-and-events");
    expect(paper.steps.flatMap((step) => step.tools.packageApis)).toContain("searchPaperMembers");

    expect(() => getAuthoringChecklist("missing")).toThrow("missing");
  });

  it("lists authoring recipes for ordered task workflows", () => {
    const datapack = listAuthoringRecipes({ domain: "datapack" });
    expect(datapack.map((recipe) => recipe.id)).toContain("datapack-function-command");
    expect(datapack.map((recipe) => recipe.id)).toContain("datapack-observed-json");

    const paper = getAuthoringRecipe("paper-event-listener");
    expect(paper.domains).toEqual(["paper-plugin"]);
    expect(paper.steps.map((step) => step.id)).toContain("discover-event-candidates");
    expect(paper.finalChecks).toContain("paper-event-candidate");

    expect(() => getAuthoringRecipe("missing")).toThrow("Unknown authoring recipe: missing");
  });

  it("lists authoring scenarios for realistic task evaluation", () => {
    const paperScenarios = listAuthoringScenarios({ domain: "paper-plugin" });
    expect(paperScenarios.map((scenario) => scenario.id)).toContain("paper-event-listener-review");
    expect(paperScenarios.map((scenario) => scenario.id)).toContain("paper-api-scheduler-review");

    const scenario = getAuthoringScenario("paper-event-listener-review");
    expect(scenario.requiredLookups.recipes).toContain("paper-event-listener");
    expect(scenario.requiredLookups.diagnostics).toContain("paper-event-candidate-unverified");
    expect(scenario.mustAvoid).toContain(
      "generating listener code for an event candidate that was not API-verified",
    );

    expect(() => getAuthoringScenario("missing")).toThrow("Unknown authoring scenario: missing");
  });

  it("searches authoring scenarios from task wording", () => {
    const result = searchAuthoringScenarios({
      query: "Paper event listener",
      domain: "paper-plugin",
    });

    expect(result.domain).toBe("paper-plugin");
    expect(result.results[0]?.scenario.id).toBe("paper-event-listener-review");
    expect(result.results[0]?.matches.some((match) => match.source === "recipe")).toBe(true);
    expect(result.results[0]?.matches.flatMap((match) => match.matchedTokens)).toContain("event");
    expect(result.results.every((entry) => entry.score > 0)).toBe(true);
  });

  it("searches lightweight catalog entries by text, kind, and domain", () => {
    const result = searchCatalog({
      query: "Paper event listener",
      domain: "paper-plugin",
      kind: "authoring-recipe",
    });

    expect(result.domain).toBe("paper-plugin");
    expect(result.kind).toBe("authoring-recipe");
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        kind: "authoring-recipe",
        id: "paper-event-listener",
      }),
    );
    expect(result.results[0]?.matches.map((match) => match.field)).toContain("title");

    const sourceResult = searchCatalog({
      query: "prismarine assets",
      kind: "community-dataset",
    });
    expect(sourceResult.results.map((entry) => entry.id)).toContain(
      "prismarinejs-minecraft-assets",
    );
  });

  it("builds authoring plans with scenario lookups resolved", () => {
    const plan = getAuthoringPlan({
      scenario: "paper-event-listener-review",
      version: "1.21.11",
    });

    expect(plan.domain).toBe("paper-plugin");
    expect(plan.scenario.id).toBe("paper-event-listener-review");
    expect(plan.recipes.map((recipe) => recipe.id)).toContain("paper-event-listener");
    expect(plan.intentLookups.map((intent) => intent.id)).toContain(
      "discover-paper-event-candidates",
    );
    expect(plan.diagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-event-candidate-unverified",
    );
    expect(plan.claimPolicies.map((policy) => policy.id)).toContain("paper-event-candidate");
    expect(plan.factSurfaces.map((surface) => surface.id)).toContain("paper-event-search");
    expect(plan.responsePatterns.map((pattern) => pattern.id)).toContain("paper-api-answer");
    expect(plan.preflight?.resolvedVersion).toBe("1.21.11");
    expect(plan.evidence?.links.map((link) => link.id)).toContain("paper-javadocs");
  });

  it("lists authoring guardrails for output safety", () => {
    const guardrails = listAuthoringGuardrails({ domain: "paper-plugin" });
    expect(guardrails.map((guardrail) => guardrail.id)).toContain("global-source-provenance");
    expect(guardrails.map((guardrail) => guardrail.id)).toContain("paper-api-surface-limits");

    const paper = getAuthoringGuardrail("paper-api-surface-limits");
    expect(paper.rules).toContain(
      "Javadocs package, type, and member indexes prove names and labels only.",
    );
    expect(paper.failureMode).toContain("nonexistent APIs");

    expect(() => getAuthoringGuardrail("missing")).toThrow("Unknown authoring guardrail: missing");
  });

  it("lists authoring diagnostics for pre-finalization checks", () => {
    const paperDiagnostics = listAuthoringDiagnostics({ domain: "paper-plugin" });
    expect(paperDiagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-api-member-unverified",
    );
    expect(paperDiagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-threading-assumption",
    );

    const diagnostic = getAuthoringDiagnostic("paper-api-member-unverified");
    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.failIf).toContain(
      "plugin code references an API type or member that was not found or explicitly marked unverified",
    );
    expect(diagnostic.tools.packageApis).toContain("searchPaperMembers");

    expect(() => getAuthoringDiagnostic("missing")).toThrow(
      "Unknown authoring diagnostic: missing",
    );
  });

  it("lists claim policies for evidence-bounded wording", () => {
    const paperPolicies = listClaimPolicies({ domain: "paper-plugin" });
    expect(paperPolicies.map((policy) => policy.id)).toContain("paper-type-or-member-exists");
    expect(paperPolicies.map((policy) => policy.id)).toContain("folia-or-thread-safety");

    const commandPolicy = getClaimPolicy("command-syntax-exists");
    expect(commandPolicy.domains).toEqual(["datapack"]);
    expect(commandPolicy.allowedWording).toContain(
      "The checked command path proves parser shape, not gameplay behavior.",
    );
    expect(commandPolicy.disallowedWording).toContain(
      "The command will succeed at runtime because the parser path exists.",
    );

    expect(() => getClaimPolicy("missing")).toThrow("Unknown claim policy: missing");
  });

  it("lists output requirements for final answer checks", () => {
    const paperRequirements = listOutputRequirements({ domain: "paper-plugin" });
    expect(paperRequirements.map((requirement) => requirement.id)).toContain(
      "global-version-and-evidence",
    );
    expect(paperRequirements.map((requirement) => requirement.id)).toContain(
      "paper-plugin-output-safety",
    );

    const paper = getOutputRequirement("paper-plugin-output-safety");
    expect(paper.mustInclude).toContain("Javadocs type/member evidence for referenced API names");
    expect(paper.mustNotInclude).toContain("listener code for unverified event class names");

    expect(() => getOutputRequirement("missing")).toThrow("Unknown output requirement: missing");
  });

  it("lists response patterns for source-backed answers", () => {
    const paperPatterns = listResponsePatterns({ domain: "paper-plugin" });
    expect(paperPatterns.map((pattern) => pattern.id)).toContain("verified-authoring-answer");
    expect(paperPatterns.map((pattern) => pattern.id)).toContain("paper-api-answer");

    const pattern = getResponsePattern("paper-api-answer");
    expect(pattern.requiredSections).toContain(
      "Javadocs type/member evidence for referenced API names",
    );
    expect(pattern.gapStatements).toContain(
      "The Javadocs search index proves name presence, not behavior, nullability, or thread safety.",
    );

    expect(() => getResponsePattern("missing")).toThrow("Unknown response pattern: missing");
  });

  it("builds authoring preflight payloads with coverage warnings", () => {
    const datapack = getAuthoringPreflight({ domain: "datapack", version: "26.2" });
    expect(datapack).toMatchObject({
      schemaVersion: 1,
      domain: "datapack",
      resolvedVersion: "26.2",
    });
    expect(datapack.checklist.domain).toBe("datapack");
    expect(datapack.factSurfaces.map((surface) => surface.id)).toContain("command-paths");
    expect(datapack.domainCoverage.unknowns).toEqual([]);
    expect(datapack.downloadable).toContainEqual(
      expect.objectContaining({
        kind: "datapack-schema-surface",
        version: "26.2",
        available: true,
      }),
    );

    const paper = getAuthoringPreflight({ domain: "paper-plugin", version: "26.1" });
    expect(paper.paper?.supported).toBe(false);
    expect(paper.warnings.join("\n")).toContain("Paper is not marked supported for 26.1");
    expect(paper.domainCoverage.status).toBe("not-yet-published");
  });

  it("builds authoring contexts with preflight, intent lookups, and evidence", () => {
    const context = getAuthoringContext({ domain: "paper-plugin", version: "1.21.11" });
    expect(context).toMatchObject({
      schemaVersion: 1,
      domain: "paper-plugin",
      resolvedVersion: "1.21.11",
    });
    expect(context.preflight.checklist.domain).toBe("paper-plugin");
    expect(context.recipes.map((recipe) => recipe.id)).toContain("paper-event-listener");
    expect(context.scenarios.map((scenario) => scenario.id)).toContain(
      "paper-event-listener-review",
    );
    expect(context.guardrails.map((guardrail) => guardrail.id)).toContain(
      "paper-api-surface-limits",
    );
    expect(context.diagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-api-member-unverified",
    );
    expect(context.claimPolicies.map((policy) => policy.id)).toContain(
      "paper-type-or-member-exists",
    );
    expect(context.outputRequirements.map((requirement) => requirement.id)).toContain(
      "paper-plugin-output-safety",
    );
    expect(context.responsePatterns.map((pattern) => pattern.id)).toContain("paper-api-answer");
    expect(context.intentLookups.map((intent) => intent.id)).toContain(
      "verify-paper-type-or-member",
    );
    expect(context.evidence.links.map((link) => link.id)).toContain("paper-javadocs");
  });

  it("builds evidence bundles for answer provenance", () => {
    const datapack = getEvidenceBundle({ domain: "datapack", version: "26.2" });
    expect(datapack).toMatchObject({
      schemaVersion: 1,
      domain: "datapack",
      resolvedVersion: "26.2",
      sourcePolicy: {
        minecraftWikiTextRedistribution: "forbidden",
      },
    });
    expect(datapack.primarySources.map((source) => source.id)).toContain(
      "mojang-version-manifest-v2",
    );
    expect(datapack.factSurfaces.map((surface) => surface.id)).toContain("command-paths");
    expect(datapack.dataFiles).toContainEqual(
      expect.objectContaining({
        kind: "server-reports",
        path: "java/reports/26.2.json",
        available: true,
      }),
    );
    expect(datapack.links.map((link) => link.id)).toContain("mojang-version-json");

    const paper = getEvidenceBundle({ domain: "paper-plugin", version: "1.21.11" });
    expect(paper.links.map((link) => link.id)).toContain("paper-javadocs");
    expect(paper.dataFiles).toContainEqual(
      expect.objectContaining({
        kind: "paper-api-surface",
        path: "java/paper-api-surfaces/1.21.11.json",
        available: true,
      }),
    );
  });

  it("builds source reports with allowed source tiers", () => {
    const policy = getSourcePolicy();
    expect(policy.minecraftWikiAutomation).toBe("forbidden");
    expect(policy.sourceTiers.map((tier) => tier.id)).toContain("community-structured");
    expect(policy.recommendedCommunityDatasets.map((source) => source.id)).toContain(
      "prismarinejs-minecraft-data",
    );
    expect(policy.recommendedCommunityDatasets.map((source) => source.id)).toContain(
      "misode-mcmeta",
    );
    expect(listSourceTiers().map((tier) => tier.id)).toContain("canonical-official");
    expect(getSourceTier("community-structured").examples).toContain("PrismarineJS/minecraft-data");
    expect(listCommunityDatasets().map((dataset) => dataset.id)).toContain(
      "prismarinejs-minecraft-assets",
    );

    const report = getSourceReport({ domain: "datapack", version: "26.2" });
    expect(report.domain).toBe("datapack");
    expect(report.resolvedVersion).toBe("26.2");
    expect(report.primarySources?.map((source) => source.id)).toEqual(
      expect.arrayContaining([
        "mojang-version-manifest-v2",
        "misode-mcmeta-data-json",
        "prismarinejs-minecraft-data",
      ]),
    );
    expect(report.prohibitedAutomation).toContain(
      "Do not fetch, crawl, summarize, or cite Minecraft Wiki pages in AI workflows.",
    );
  });

  it("lists intent lookups for choosing exact fact surfaces", () => {
    const datapack = listIntentLookups({ domain: "datapack" });
    expect(datapack.map((intent) => intent.id)).toContain("verify-command-syntax");
    expect(datapack.map((intent) => intent.id)).toContain("verify-datapack-json-shape");

    const paper = getIntentLookup("verify-paper-type-or-member");
    expect(paper.domains).toEqual(["paper-plugin"]);
    expect(paper.lookups[0]?.tools.cli).toContain("plugin paper members");
    expect(paper.lookups[0]?.tools.mcp).toContain("search_paper_members");
    expect(paper.lookups[0]?.failureMode).toContain("does not prove runtime behavior");

    expect(() => getIntentLookup("missing")).toThrow("Unknown intent lookup: missing");
  });

  it("lists per-version support for target selection", () => {
    const support = listVersionSupport({ domain: "paper-plugin" });
    expect(support).toHaveLength(50);
    expect(support[0]).toMatchObject({
      edition: "java",
      version: "26.2",
      paper: {
        supported: true,
        latestBuild: 30,
      },
      surfaces: {
        datapackSchemaSurface: {
          available: true,
        },
      },
    });
    const latestPaper = support.find((entry) => entry.version === "26.2");
    expect(latestPaper).toMatchObject({
      paper: {
        supported: true,
        latestBuild: 30,
      },
      surfaces: {
        paperApiSurface: {
          available: true,
          downloadable: true,
        },
      },
    });
  });

  it("summarizes bundled coverage", () => {
    const summary = getCoverageSummary();
    expect(summary.latest.java).toBe("26.2");
    expect(summary.java.releases).toEqual({
      total: 50,
      latest: "26.2",
      oldest: "1.13",
    });
    expect(summary.java.requiredData).toEqual({
      complete: true,
      missing: [],
    });
    expect(summary.java.packFormats).toEqual({
      extracted: 50,
      missing: 0,
    });
    expect(summary.java.datapack.serverReports).toBe(50);
    expect(summary.java.datapack.observedSchemaSurfaces).toBe(50);
    expect(summary.java.resourcepack.modelSummaries).toBe(50);
    expect(summary.java.paperPlugin).toMatchObject({
      supportedVersions: 46,
      latestSupportedVersion: "26.2",
      latestBuild: 30,
      apiPackageIndexes: 46,
      apiSurfaces: 38,
      versionsWithoutUnknowns: 46,
      missingApiPackageIndexes: [],
    });
    expect(summary.java.paperPlugin.missingApiSurfaces).toEqual([
      "1.13",
      "1.14",
      "1.15",
      "1.17",
      "1.18",
      "1.19",
      "1.20",
      "1.21",
    ]);
    expect(summary.skills).toEqual({
      total: 3,
      packagedPayloads: 3,
    });
  });

  it("exposes support matrix aliases for data selection", () => {
    const matrix = getSupportMatrix();
    expect(matrix.aliases).toMatchObject({
      latestJava: "26.2",
      latestPaper: "26.2",
      latestWithDatapackSchemaSurface: "26.2",
      latestWithPaperApiSurface: "26.2",
    });
    expect(matrix.downloadable).toContainEqual(
      expect.objectContaining({
        kind: "datapack-schema-surface",
        version: "26.2",
      }),
    );
  });

  it("resolves the latest Java version", () => {
    expect(resolveVersion("java", "latest")).toBe("26.2");
  });

  it("does not pretend a release is a bundled snapshot", () => {
    expect(() => resolveVersion("java", "latest-snapshot")).toThrow(
      "No bundled latest snapshot for java",
    );
  });

  it("loads extracted version details for the latest release", () => {
    const version = getVersionDetail("java", "26.2");
    expect(version.coverage).toBe("version-json-and-jar");
    expect(version.packFormats.data).toBe(107);
    expect(version.packFormats.resource).toBe(88);
    expect(version.packFormats.status).toBe("extracted");
  });

  it("loads extracted legacy details for the oldest supported release", () => {
    const version = getVersionDetail("java", "1.13");
    expect(version.coverage).toBe("version-json-and-jar");
    expect(version.packFormats.data).toBe(4);
    expect(version.packFormats.resource).toBe(4);
    expect(version.packFormats.status).toBe("extracted");
  });

  it("classifies datapack and resourcepack file paths", () => {
    const result = classifyPackFiles({
      paths: [
        "data/example/advancement/root.json",
        "data/example/functions/tick.mcfunction",
        "assets/example/models/item/widget.json",
        "assets/example/textures/item/widget.png",
        "README.md",
      ],
    });

    expect(result.totalFiles).toBe(5);
    expect(result.classifiedFiles).toBe(4);
    expect(result.files).toContainEqual(
      expect.objectContaining({
        path: "data/example/advancement/root.json",
        domain: "datapack",
        kind: "advancement",
        schemaAvailable: true,
        schemaKind: "advancement",
      }),
    );
    expect(result.files).toContainEqual(
      expect.objectContaining({
        path: "assets/example/models/item/widget.json",
        domain: "resourcepack",
        kind: "model",
        schemaAvailable: true,
        schemaKind: "model",
      }),
    );
    expect(result.files).toContainEqual(
      expect.objectContaining({
        path: "README.md",
        domain: "unknown",
        schemaAvailable: false,
      }),
    );
  });

  it("returns non-normative observed schemas for pack files", () => {
    const datapack = getPackFileSchema({
      version: "26.2",
      path: "data/example/advancement/root.json",
      domain: "datapack",
    });
    expect(datapack).toMatchObject({
      available: true,
      normative: false,
      file: {
        kind: "advancement",
        schemaKind: "advancement",
      },
      coverage: "vanilla-observed-datapack-json-shape",
    });
    expect(datapack.observedFields.map((field) => field.path)).toContain("$.criteria");
    expect(datapack.jsonSchema?.["x-minecraft-skills"]).toMatchObject({
      normative: false,
    });

    const resourcepack = getPackFileSchema({
      version: "26.2",
      path: "assets/example/items/widget.json",
      domain: "resourcepack",
    });
    expect(resourcepack).toMatchObject({
      available: true,
      normative: false,
      file: {
        kind: "item-definition",
        schemaKind: "item-definition",
      },
      coverage: "client-resourcepack-models",
    });
    expect(resourcepack.observedFields.map((field) => field.path)).toContain("model.type");

    const oldItemDefinition = getPackFileSchema({
      version: "1.20.6",
      path: "assets/example/items/widget.json",
      domain: "resourcepack",
    });
    expect(oldItemDefinition.available).toBe(false);
    expect(oldItemDefinition.notes.join("\n")).toContain("does not expose assets/minecraft/items");

    const oldSingularAdvancement = getPackFileSchema({
      version: "1.20.6",
      path: "data/example/advancement/root.json",
      domain: "datapack",
    });
    expect(oldSingularAdvancement.available).toBe(false);
    expect(oldSingularAdvancement.notes.join("\n")).toContain(
      "does not expose datapack schema kind 'advancement'",
    );

    const unknown = getPackFileSchema({
      version: "26.2",
      path: "assets/example/textures/item/widget.png",
      domain: "resourcepack",
    });
    expect(unknown.available).toBe(true);
    expect(unknown.jsonSchema).toMatchObject({
      contentMediaType: "image/png",
    });
  });

  it("returns schemas for known datapack and resourcepack file formats", () => {
    const paths = [
      ["datapack", "pack.mcmeta"],
      ["datapack", "data/example/tags/block/widgets.json"],
      ["datapack", "data/example/function/tick.mcfunction"],
      ["datapack", "data/example/structure/widgets/root.nbt"],
      ["resourcepack", "pack.mcmeta"],
      ["resourcepack", "assets/example/blockstates/widget.json"],
      ["resourcepack", "assets/example/sounds.json"],
      ["resourcepack", "assets/example/atlases/blocks.json"],
      ["resourcepack", "assets/example/font/default.json"],
      ["resourcepack", "assets/example/lang/en_us.json"],
      ["resourcepack", "assets/example/textures/item/widget.png"],
      ["resourcepack", "assets/example/sounds/widget.ogg"],
      ["resourcepack", "assets/example/particles/widget.json"],
      ["resourcepack", "assets/example/shaders/core/widget.json"],
      ["resourcepack", "assets/example/post_effect/widget.json"],
      ["resourcepack", "assets/example/equipment/widget.json"],
    ] as const;

    for (const [domain, path] of paths) {
      const schema = getPackFileSchema({ version: "26.2", domain, path });
      expect(schema.available, path).toBe(true);
      expect(schema.normative).toBe(false);
      expect(schema.jsonSchema, path).not.toBeNull();
    }
  });

  it("validates pack file content against version-aware schemas", () => {
    const packMetadata = validatePackFileContent({
      version: "26.2",
      domain: "datapack",
      path: "pack.mcmeta",
      content: JSON.stringify({
        pack: {
          pack_format: 107,
          description: "test",
        },
      }),
    });
    expect(packMetadata).toMatchObject({
      validated: true,
      valid: true,
      contentKind: "json",
      schemaAvailable: true,
    });

    const wrongPackFormat = validatePackFileContent({
      version: "26.2",
      domain: "datapack",
      path: "pack.mcmeta",
      content: {
        pack: {
          pack_format: 90,
          description: "test",
        },
      },
    });
    expect(wrongPackFormat.valid).toBe(false);
    expect(wrongPackFormat.issues.map((issue) => issue.keyword)).toContain("const");

    const legacySupportedFormats = validatePackFileContent({
      version: "1.20.1",
      domain: "datapack",
      path: "pack.mcmeta",
      content: {
        pack: {
          pack_format: 15,
          supported_formats: {
            min_inclusive: 15,
            max_inclusive: 18,
          },
          description: "test",
        },
      },
    });
    expect(legacySupportedFormats.valid).toBe(false);
    expect(legacySupportedFormats.issues.map((issue) => issue.keyword)).toContain("not");

    const rangedSupportedFormats = validatePackFileContent({
      version: "1.20.2",
      domain: "datapack",
      path: "pack.mcmeta",
      content: {
        pack: {
          pack_format: 18,
          supported_formats: {
            min_inclusive: 15,
            max_inclusive: 18,
          },
          description: "test",
        },
      },
    });
    expect(rangedSupportedFormats.valid).toBe(true);

    const legacyOverlays = validatePackFileContent({
      version: "1.20.1",
      domain: "resourcepack",
      path: "pack.mcmeta",
      content: {
        pack: {
          pack_format: 15,
          description: "test",
        },
        overlays: {
          entries: [
            {
              directory: "old",
              formats: {
                min_inclusive: 15,
                max_inclusive: 18,
              },
            },
          ],
        },
      },
    });
    expect(legacyOverlays.valid).toBe(false);
    expect(legacyOverlays.issues.map((issue) => issue.keyword)).toContain("not");

    const rangedOverlays = validatePackFileContent({
      version: "1.20.2",
      domain: "resourcepack",
      path: "pack.mcmeta",
      content: {
        pack: {
          pack_format: 18,
          description: "test",
        },
        overlays: {
          entries: [
            {
              directory: "old",
              formats: {
                min_inclusive: 15,
                max_inclusive: 18,
              },
            },
          ],
        },
      },
    });
    expect(rangedOverlays.valid).toBe(true);

    const minorPackFormat = validatePackFileContent({
      version: "1.21.9",
      domain: "datapack",
      path: "pack.mcmeta",
      content: {
        pack: {
          description: "test",
          min_format: [88, 0],
          max_format: [88, 0],
        },
      },
    });
    expect(minorPackFormat.valid).toBe(true);

    const minorSupportedFormats = validatePackFileContent({
      version: "1.21.9",
      domain: "resourcepack",
      path: "pack.mcmeta",
      content: {
        pack: {
          description: "test",
          supported_formats: {
            min_format: [69, 0],
            max_format: [69, 0],
          },
        },
        overlays: {
          entries: [
            {
              directory: "minor",
              formats: {
                min_format: 69,
                max_format: [69, 0],
              },
            },
          ],
        },
      },
    });
    expect(minorSupportedFormats.valid).toBe(true);

    const missingMinorFormat = validatePackFileContent({
      version: "1.21.9",
      domain: "datapack",
      path: "pack.mcmeta",
      content: {
        pack: {
          description: "test",
        },
      },
    });
    expect(missingMinorFormat.valid).toBe(false);
    expect(missingMinorFormat.issues.map((issue) => issue.keyword)).toContain("anyOf");

    const invalidJson = validatePackFileContent({
      version: "26.2",
      domain: "datapack",
      path: "data/example/advancement/root.json",
      content: "{",
    });
    expect(invalidJson).toMatchObject({
      validated: false,
      valid: false,
      contentKind: "json",
    });
    expect(invalidJson.issues[0]?.keyword).toBe("parse");

    const unsupportedVersionLayout = validatePackFileContent({
      version: "1.20.6",
      domain: "resourcepack",
      path: "assets/example/items/widget.json",
      content: { model: { type: "minecraft:model", model: "minecraft:item/widget" } },
    });
    expect(unsupportedVersionLayout).toMatchObject({
      validated: false,
      valid: false,
      schemaAvailable: false,
    });
    expect(unsupportedVersionLayout.issues[0]?.keyword).toBe("version-layout-unsupported");

    const latestItemDefinitionWithCustomFields = validatePackFileContent({
      version: "26.2",
      domain: "resourcepack",
      path: "assets/example/items/widget.json",
      content: {
        model: {
          type: "minecraft:condition",
          property: "minecraft:using_item",
          on_true: { type: "minecraft:model", model: "minecraft:item/widget_active" },
          on_false: { type: "minecraft:model", model: "minecraft:item/widget" },
        },
        oversize_in_gui: true,
      },
    });
    expect(latestItemDefinitionWithCustomFields).toMatchObject({
      validated: true,
      valid: true,
      schemaAvailable: true,
    });

    const customJsonLayout = validatePackFileContent({
      version: "26.2",
      domain: "resourcepack",
      path: "assets/example/custom/widget.json",
      content: { custom: true },
    });
    expect(customJsonLayout).toMatchObject({
      validated: true,
      valid: true,
      schemaAvailable: true,
    });

    const unknownBinaryLayout = validatePackFileContent({
      version: "26.2",
      domain: "resourcepack",
      path: "assets/example/custom/widget.bin",
      content: "bytes",
    });
    expect(unknownBinaryLayout).toMatchObject({
      validated: false,
      valid: true,
      schemaAvailable: false,
    });
    expect(unknownBinaryLayout.issues).toEqual([]);

    const batch = validatePackFilesContent({
      version: "26.2",
      domain: "resourcepack",
      files: [
        {
          path: "assets/example/models/item/widget.json",
          content: { parent: "minecraft:item/generated" },
        },
        {
          path: "assets/example/lang/en_us.json",
          content: { "item.example.widget": "Widget" },
        },
      ],
    });
    expect(batch).toMatchObject({
      totalFiles: 2,
      validatedFiles: 2,
      validFiles: 2,
      invalidFiles: 0,
    });
  });

  it("builds pack migration plans with considerations", () => {
    const datapack = getPackMigrationPlan({
      domain: "datapack",
      from: "1.20.6",
      to: "1.21",
      paths: [
        "pack.mcmeta",
        "data/example/advancement/root.json",
        "data/example/functions/tick.mcfunction",
      ],
      limit: 5,
    });
    expect(datapack).toMatchObject({
      schemaVersion: 1,
      domain: "datapack",
      from: "1.20.6",
      to: "1.21",
      summary: {
        packFormatChanged: true,
        schemaBackedFiles: 2,
      },
    });
    expect(datapack.schemaLookups.map((lookup) => lookup.file.kind)).toEqual([
      "pack-metadata",
      "advancement",
      "function",
    ]);
    expect(datapack.schemaLookups.map((lookup) => lookup.available)).toEqual([true, true, false]);
    expect(datapack.considerations.join("\n")).toContain("pack.mcmeta");
    expect(datapack.recommendedChecks).toContain("datapack compare-schema");

    const resourcepack = getPackMigrationPlan({
      domain: "resourcepack",
      from: "1.20.6",
      to: "1.21",
      paths: ["assets/example/items/widget.json"],
      limit: 5,
    });
    expect(resourcepack.summary.packFormatChanged).toBe(true);
    expect(resourcepack.summary.schemaBackedFiles).toBe(0);
    expect(resourcepack.schemaLookups[0]?.file.kind).toBe("item-definition");
    expect(resourcepack.schemaLookups[0]?.available).toBe(false);
    expect(resourcepack.recommendedChecks).toContain("resourcepack file-schema");
  });

  it("keeps Minecraft Wiki prose out of redistributable data", () => {
    expect(getSourcePolicy().minecraftWikiTextRedistribution).toBe("forbidden");
    expect(getSourcePolicy().minecraftWikiAutomation).toBe("forbidden");
  });

  it("loads Paper plugin source metadata", () => {
    expect(getDomain("paper-plugin").primarySources.map((source) => source.id)).toContain(
      "spigot-event-list",
    );
  });

  it("loads Paper plugin data and event search contract", () => {
    const paper = getPaperPluginData();
    expect(paper.latest).toEqual({
      minecraftVersion: "26.2",
      build: 30,
    });
    expect(paper.support.minecraftLatestGap).toEqual({
      javaLatest: "26.2",
      paperLatest: "26.2",
      status: "paper-current-with-java-latest",
    });
    expect(paper.versionBuilds).toContainEqual({
      minecraftVersion: "1.21.11",
      latestBuild: 132,
      buildCount: 92,
    });
    expect(paper.eventSearch.paperSources).toEqual(["spigot", "paper"]);
    expect(paper.sources.map((source) => source.id)).toContain("papermc-docs-paper-folia-support");
  });

  it("builds Paper event search URLs", () => {
    const url = buildPaperEventSearchUrl({
      query: "player join",
      version: "1.21.11",
      source: "paper",
      limit: 5,
    });
    expect(url).toContain("https://spigot-event-list.s7a.dev/api/search/events");
    expect(url).toContain("q=player+join");
    expect(url).toContain("version=1.21.11");
    expect(url).toContain("source=paper");
    expect(url).toContain("limit=5");
  });

  it("builds Modrinth project search URLs with facets", () => {
    const url = new URL(
      buildModrinthProjectSearchUrl({
        query: "voice chat",
        version: "1.21.11",
        projectType: "mod",
        loader: "fabric",
        category: "technology",
        index: "downloads",
        offset: 20,
        limit: 25,
      }),
    );
    expect(url.origin + url.pathname).toBe("https://api.modrinth.com/v2/search");
    expect(url.searchParams.get("query")).toBe("voice chat");
    expect(url.searchParams.get("index")).toBe("downloads");
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(JSON.parse(url.searchParams.get("facets") ?? "[]")).toEqual([
      ["versions:1.21.11"],
      ["all_project_types:mod"],
      ["categories:fabric"],
      ["categories:technology"],
    ]);
  });

  it("searches Modrinth with an identifying user agent", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const result = await searchModrinthProjects({ query: "sodium" }, async (url, init) => {
      requestUrl = url;
      requestInit = init;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ hits: [{ slug: "sodium" }] }),
      };
    });
    expect(requestUrl).toContain("query=sodium");
    expect(new Headers(requestInit?.headers).get("User-Agent")).toContain("minecraft-skills");
    expect(result).toEqual({ hits: [{ slug: "sodium" }] });
  });

  it("builds filtered Modrinth project version URLs", () => {
    const url = new URL(
      buildModrinthProjectVersionsUrl({
        project: "simple-voice-chat",
        gameVersions: ["1.21.11"],
        loaders: ["fabric", "neoforge"],
        featured: true,
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://api.modrinth.com/v2/project/simple-voice-chat/version",
    );
    expect(JSON.parse(url.searchParams.get("game_versions") ?? "[]")).toEqual(["1.21.11"]);
    expect(JSON.parse(url.searchParams.get("loaders") ?? "[]")).toEqual(["fabric", "neoforge"]);
    expect(url.searchParams.get("featured")).toBe("true");
    expect(url.searchParams.get("include_changelog")).toBe("false");
  });

  it("lists Modrinth project versions with an identifying user agent", async () => {
    let requestInit: RequestInit | undefined;
    const result = await listModrinthProjectVersions({ project: "sodium" }, async (_url, init) => {
      requestInit = init;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => [{ id: "version-id", version_number: "1.0.0" }],
      };
    });
    expect(new Headers(requestInit?.headers).get("User-Agent")).toContain("minecraft-skills");
    expect(result).toEqual([{ id: "version-id", version_number: "1.0.0" }]);
  });

  it("builds Modrinth public resource URLs", () => {
    expect(buildModrinthResourceUrl({ resource: "project", identifier: "sodium" })).toBe(
      "https://api.modrinth.com/v2/project/sodium",
    );
    expect(
      buildModrinthResourceUrl({
        resource: "version-file",
        identifier: "abc123",
        algorithm: "sha512",
      }),
    ).toContain("version_file/abc123?algorithm=sha512");
    expect(buildModrinthResourceUrl({ resource: "game-versions" })).toBe(
      "https://api.modrinth.com/v2/tag/game_version",
    );
  });

  it("gets a Modrinth public resource", async () => {
    const result = await getModrinthResource({ resource: "statistics" }, async (url, init) => ({
      ok: url.endsWith("/statistics") && new Headers(init?.headers).has("User-Agent"),
      status: 200,
      statusText: "OK",
      json: async () => ({ projects: 123 }),
    }));
    expect(result).toEqual({ projects: 123 });
  });

  it("builds Paper API references for supported versions", () => {
    const reference = getPaperApiReference("1.21.11");
    expect(reference.supported).toBe(true);
    expect(reference.apiDependency).toBe("io.papermc.paper:paper-api:1.21.11-R0.1-SNAPSHOT");
    expect(reference.javadocsUrl).toBe("https://jd.papermc.io/paper/1.21.11/");
    expect(reference.docs.foliaSupport).toBe("https://docs.papermc.io/paper/dev/folia-support/");
  });

  it("loads Paper API package indexes", () => {
    const index = getPaperApiIndex("1.21.11");
    expect(index.minecraftVersion).toBe("1.21.11");
    expect(index.packageCount).toBeGreaterThan(100);
    expect(index.packages.map((entry) => entry.name)).toContain(
      "io.papermc.paper.threadedregions.scheduler",
    );
  });

  it("loads legacy Paper API package indexes when Javadocs expose package tables", () => {
    const index = getPaperApiIndex("1.13.2");
    expect(index.minecraftVersion).toBe("1.13.2");
    expect(index.packageCount).toBeGreaterThan(50);
    expect(index.packages.map((entry) => entry.name)).toContain("org.bukkit.plugin");
  });

  it("compares Paper API package indexes", () => {
    const comparison = comparePaperApi("1.20.4", "1.21.11");
    expect(comparison.from).toBe("1.20.4");
    expect(comparison.to).toBe("1.21.11");
    expect(comparison.packageCount.changed).toBe(true);
    expect(comparison.added.map((entry) => entry.name)).toContain("io.papermc.paper.datacomponent");
  });

  it("loads and searches Paper API type/member surfaces", () => {
    const surface = getPaperApiSurface("1.21.11");
    const freshSurface = getPaperApiSurface("1.21.11");
    expect(freshSurface).not.toBe(surface);
    surface.types.pop();
    expect(freshSurface.types).toHaveLength(freshSurface.typeCount);
    expect(surface.coverage).toBe("javadocs-search-index");
    expect(surface.typeCount).toBeGreaterThan(1_000);
    expect(surface.memberCount).toBeGreaterThan(20_000);
    expect(
      searchPaperTypes({
        version: "1.21.11",
        contains: "org.bukkit.entity.Player",
        limit: 10,
      }).types,
    ).toContainEqual(expect.objectContaining({ qualifiedName: "org.bukkit.entity.Player" }));
    expect(
      searchPaperMembers({
        version: "1.21.11",
        type: "org.bukkit.entity.Player",
        contains: "sendMessage",
        kind: "method",
        limit: 10,
      }).members,
    ).toContainEqual(
      expect.objectContaining({
        qualifiedTypeName: "org.bukkit.entity.Player",
        name: "sendMessage",
        kind: "method",
      }),
    );
  });

  it("compares Paper API surfaces", () => {
    const comparison = comparePaperApiSurface("1.21.11", "1.21.11");
    expect(comparison.typeCount.changed).toBe(false);
    expect(comparison.memberCount.changed).toBe(false);
    expect(comparison.addedTypes).toEqual([]);
    expect(comparison.removedMembers).toEqual([]);
    expect(comparison.changes).toEqual([]);
  });

  it("builds Paper API references for unsupported versions", () => {
    const reference = getPaperApiReference("26.1");
    expect(reference.supported).toBe(false);
    expect(reference.minecraftVersion).toBe("26.2");
    expect(reference.latestSupportedVersion).toBe("26.2");
    expect(reference.apiDependency).toBeNull();
    expect(reference.javadocsUrl).toBeNull();
  });

  it("marks Paper-supported version details", () => {
    const version = getVersionDetail("java", "1.21.11");
    expect(version.domains["paper-plugin"].status).toBe("api-reference-linked");
    expect(version.domains["paper-plugin"].facts).toContain("paper_supported=true");
    expect(version.domains["paper-plugin"].facts).toContain("paper_latest_build=132");
    expect(version.domains["paper-plugin"].facts).toContain("paper_build_count=92");
    expect(version.domains["paper-plugin"].facts).toContain(
      "paper_api_dependency=io.papermc.paper:paper-api:1.21.11-R0.1-SNAPSHOT",
    );
    expect(version.domains["paper-plugin"].facts).toContain(
      "paper_javadocs=https://jd.papermc.io/paper/1.21.11/",
    );
    expect(version.domains["paper-plugin"].facts).toContain("paper_api_package_index=1.21.11");
    expect(version.domains["paper-plugin"].facts).toContain("paper_api_surface=1.21.11");
    expect(version.domains["paper-plugin"].facts).toContain(
      "paper_folia_support_docs=https://docs.papermc.io/paper/dev/folia-support/",
    );
    expect(version.domains["paper-plugin"].unknowns).toEqual([]);
  });

  it("links Paper API package indexes for legacy supported versions", () => {
    const version = getVersionDetail("java", "1.13");
    expect(version.domains["paper-plugin"].status).toBe("api-reference-linked");
    expect(version.domains["paper-plugin"].facts).toContain("paper_api_package_index=1.13");
    expect(version.domains["paper-plugin"].unknowns).toEqual([]);
  });

  it("marks Java versions that Paper has not published yet", () => {
    const version = getVersionDetail("java", "26.1");
    expect(version.domains["paper-plugin"].status).toBe("not-yet-published");
    expect(version.domains["paper-plugin"].facts).toContain("paper_supported=false");
    expect(version.domains["paper-plugin"].facts).toContain("paper_latest_supported=26.2");
  });

  it("lists pack formats for all bundled releases", () => {
    const formats = listPackFormats();
    expect(formats).toHaveLength(50);
    expect(formats[0]).toMatchObject({
      version: "26.2",
      data: 107,
      resource: 88,
      paperPluginStatus: "api-reference-linked",
    });
    expect(formats.at(-1)).toMatchObject({
      version: "1.13",
      data: 4,
      resource: 4,
    });
  });

  it("looks up pack formats by version and versions by pack format", () => {
    expect(getPackFormat("java", "26.2", "datapack")).toMatchObject({
      version: "26.2",
      domain: "datapack",
      format: 107,
      minor: 1,
    });
    expect(getPackFormat("java", "1.20.2", "resourcepack")).toMatchObject({
      version: "1.20.2",
      domain: "resourcepack",
      format: 18,
      minor: null,
    });

    const legacyMatches = findVersionsByPackFormat({
      domain: "datapack",
      format: 4,
    });
    expect(legacyMatches.matches.map((match) => match.version)).toContain("1.13");
    expect(legacyMatches.matches.map((match) => match.version)).toContain("1.14.4");

    const minorMatches = findVersionsByPackFormat({
      domain: "datapack",
      format: 101,
      minor: 1,
    });
    expect(minorMatches.matches.map((match) => match.version)).toEqual([
      "26.1.2",
      "26.1.1",
      "26.1",
    ]);
    expect(minorMatches.matches.every((match) => match.exactMinor)).toBe(true);
  });

  it("loads vanilla inventory for latest release", () => {
    const inventory = getVanillaInventory("java", "latest");
    expect(inventory.version).toBe("26.2");
    expect(inventory.resources.entryCount).toBeGreaterThan(10_000);
    expect(inventory.datapack.entryCount).toBeGreaterThan(8_000);
    expect(inventory.resources.topLevel.map((entry) => entry.path)).toContain(
      "assets/minecraft/models",
    );
    expect(inventory.datapack.topLevel.map((entry) => entry.path)).toContain("data/minecraft/tags");
  });

  it("loads and searches observed datapack schema surfaces", () => {
    const surface = getDatapackSchemaSurface("java", "26.2");
    expect(surface.coverage).toBe("vanilla-observed-datapack-json-shape");
    expect(surface.kindCount).toBeGreaterThan(20);
    expect(surface.kinds.map((kind) => kind.kind)).toContain("advancement");
    const search = searchDatapackSchema({
      version: "26.2",
      kind: "advancement",
      contains: "criteria",
      limit: 10,
    });
    expect(search.fields).toContainEqual(expect.objectContaining({ path: "$.criteria" }));
  });

  it("compares observed datapack schema surfaces", () => {
    const comparison = compareDatapackSchema({ from: "26.2", to: "26.2" });
    expect(comparison.addedTotal).toBe(0);
    expect(comparison.removedTotal).toBe(0);
    expect(comparison.added).toEqual([]);
    expect(comparison.changes).toEqual([]);
  });

  it("annotates version details when vanilla inventory is bundled", () => {
    const version = getVersionDetail("java", "26.2");
    expect(version.domains.datapack.status).toBe("reports-extracted");
    expect(version.domains.resourcepack.status).toBe("models-extracted");
    expect(version.domains.datapack.facts).toContain("vanilla_data_inventory=26.2");
    expect(version.domains.datapack.facts).toContain("server_reports=26.2");
    expect(version.domains.datapack.facts).toContain("datapack_schema_surface=26.2");
    expect(version.domains.resourcepack.facts).toContain("vanilla_asset_inventory=26.2");
    expect(version.domains.resourcepack.facts).toContain("resourcepack_models=26.2");
    expect(version.domains.datapack.unknowns).toEqual([]);
    expect(version.domains.resourcepack.unknowns).toEqual([]);
  });

  it("loads server reports summary for latest release", () => {
    const reports = getJavaReportsSummary("java", "latest");
    expect(reports.version).toBe("26.2");
    expect(reports.commands.rootLiterals).toContain("execute");
    expect(reports.commands.executablePathCount).toBeGreaterThan(1_000);
    expect(reports.datapack.registries.map((registry) => registry.id)).toContain(
      "minecraft:enchantment",
    );
  });

  it("compares version metadata and vanilla inventory summaries", () => {
    const comparison = compareVersions("java", "1.20.6", "1.21");
    expect(comparison.from).toBe("1.20.6");
    expect(comparison.to).toBe("1.21");
    expect(comparison.packFormats.data.changed).toBe(true);
    expect(comparison.packFormats.resource.changed).toBe(true);
    expect(comparison.vanillaInventory.resources.entryCount.changed).toBe(true);
    expect(comparison.vanillaInventory.datapack.entryCount.changed).toBe(true);
  });

  it("compares vanilla datapack paths between versions", () => {
    const comparison = compareVanillaPaths({
      from: "1.20.6",
      to: "1.21",
      domain: "datapack",
      prefix: "data/minecraft/advancement/adventure/",
      limit: 5,
    });
    expect(comparison.addedTotal).toBeGreaterThan(0);
    expect(comparison.added).toContain("data/minecraft/advancement/adventure/blowback.json");
  });

  it("compares command syntax paths between versions", () => {
    const comparison = compareCommands({
      from: "1.20.6",
      to: "1.21",
      prefix: "attribute",
      limit: 10,
    });
    expect(comparison.addedTotal).toBeGreaterThan(0);
    expect(comparison.added).toContain(
      "attribute <target:minecraft:entity> <attribute:minecraft:resource> modifier add <id:minecraft:resource_location> <value:brigadier:double> add_value",
    );
  });

  it("searches vanilla paths", () => {
    const result = searchVanillaPaths({
      version: "26.2",
      domain: "resourcepack",
      prefix: "assets/minecraft/models/block/",
      contains: "acacia_button",
      extension: "json",
      limit: 10,
    });
    expect(result.version).toBe("26.2");
    expect(result.domain).toBe("resourcepack");
    expect(result.paths).toContain("assets/minecraft/models/block/acacia_button.json");
  });

  it("searches command paths", () => {
    const result = searchCommands({
      version: "26.2",
      prefix: "execute",
      limit: 5,
    });
    expect(result.version).toBe("26.2");
    expect(result.paths.every((path) => path.startsWith("execute"))).toBe(true);
  });

  it("loads resourcepack model summaries", () => {
    const summary = getResourcepackModelSummary("java", "26.2");
    expect(summary.version).toBe("26.2");
    expect(summary.files.models.count).toBeGreaterThan(3_000);
    expect(summary.files.itemDefinitions.count).toBeGreaterThan(1_000);
    expect(summary.modelJson.topLevelKeys.map((entry) => entry.value)).toContain("parent");
    expect(summary.itemDefinitionJson.modelTypes.map((entry) => entry.value)).toContain(
      "minecraft:model",
    );
  });

  it("searches resourcepack model paths", () => {
    const result = searchResourcepackModelPaths({
      version: "26.2",
      kind: "item-definition",
      contains: "bundle",
      limit: 10,
    });
    expect(result.version).toBe("26.2");
    expect(result.totalPaths).toBe(
      getResourcepackModelSummary("java", "26.2").files.itemDefinitions.count,
    );
    expect(result.paths).toContain("assets/minecraft/items/bundle.json");
    expect(result.paths.every((path) => path.includes("/items/"))).toBe(true);
    expect(
      searchResourcepackModelPaths({
        version: "26.2",
        kind: "item-definition",
        contains: "bundle item model",
      }).paths,
    ).toEqual([]);
  });

  it("searches across Minecraft surfaces", () => {
    const result = searchAll({
      version: "26.2",
      query: "find item model for bundle",
      domain: "resourcepack",
      limit: 80,
    });
    expect(result.results.map((entry) => entry.surface)).toContain("resourcepack-models");
    expect(result.results.map((entry) => entry.title)).toContain(
      "assets/minecraft/items/bundle.json",
    );
    expect(
      result.results.find((entry) => entry.title === "assets/minecraft/items/bundle.json")?.lookup,
    ).toContain('--prefix "assets/minecraft/items/bundle.json"');

    const lime = searchAll({
      version: "26.2",
      query: "lime model",
      domain: "resourcepack",
      limit: 200,
    });
    expect(lime.results.map((entry) => entry.surface)).toContain("resourcepack-models");

    const itemModels = searchAll({
      version: "26.2",
      query: "item model",
      domain: "resourcepack",
      limit: 200,
    });
    expect(itemModels.results.map((entry) => entry.kind)).toContain("item-definition");

    const paper = searchAll({
      version: "26.2",
      query: "listener for Paper Plugin Player Join Event",
      domain: "paper-plugin",
      limit: 80,
    });
    expect(paper.results.map((entry) => entry.title)).toContain(
      "org.bukkit.event.player.PlayerJoinEvent",
    );

    const paperEvent = searchAll({
      version: "26.2",
      query: "paper event",
      domain: "paper-plugin",
      limit: 10,
    });
    expect(paperEvent.results[0]?.surface).toBe("catalog");

    const large = searchAll({
      version: "26.2",
      query: "minecraft version",
      limit: 200,
    });
    expect(large.results.filter((entry) => entry.surface === "catalog").length).toBeGreaterThan(
      100,
    );
    expect(large.truncated).toBe(false);
  });

  it("finds resourcepack assets from all available indexes", () => {
    const result = findResourcepackAssets({
      version: "26.2",
      query: "resourcepack Diamond Sword",
      kind: "item-definition",
    });
    expect(
      result.sections.some((section) =>
        section.paths.includes("assets/minecraft/items/diamond_sword.json"),
      ),
    ).toBe(true);
  });

  it("finds datapack entries", () => {
    const result = findDatapackEntries({
      version: "26.2",
      query: "search for datapack execute command",
      limit: 10,
    });
    expect(result.sections.find((section) => section.source === "commands")?.total).toBeGreaterThan(
      0,
    );
  });

  it("explains pack paths with next lookups", () => {
    const result = explainPackPath({
      version: "26.2",
      domain: "resourcepack",
      path: "assets/example/items/widget.json",
    });
    expect(result.classification.kind).toBe("item-definition");
    expect(result.nextLookups.join("\n")).toContain("resourcepack file-schema");
  });

  it("suggests lookup tools from task text", () => {
    const result = suggestMinecraftLookups({
      version: "26.2",
      task: "migrate resource pack item model",
      domain: "resourcepack",
    });
    expect(result.suggestedTools.map((entry) => entry.tool).join("\n")).toContain(
      "resourcepack assets find",
    );
    expect(result.catalog.results.length).toBeGreaterThan(0);
  });
});
