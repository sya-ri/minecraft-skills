import { describe, expect, it } from "vitest";
import {
  buildPaperEventSearchUrl,
  compareCommands,
  compareDatapackSchema,
  comparePaperApi,
  comparePaperApiSurface,
  compareVanillaPaths,
  compareVersions,
  getAuthoringChecklist,
  getCoverageSummary,
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
  listDomains,
  listFactSurfaces,
  listPackFormats,
  listSkills,
  resolveVersion,
  searchCommands,
  searchDatapackSchema,
  searchPaperMembers,
  searchPaperTypes,
  searchResourcepackModelPaths,
  searchVanillaPaths,
} from "./index.js";

describe("catalog", () => {
  it("loads supported domains", () => {
    expect(listDomains().map((domain) => domain.id)).toEqual([
      "datapack",
      "resourcepack",
      "paper-plugin",
    ]);
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
    expect(schemaSurface.cli).toContain("search-datapack-schema");

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
    expect(datapack.steps.flatMap((step) => step.tools.cli)).toContain("commands");
    expect(datapack.steps.flatMap((step) => step.tools.mcp)).toContain("search_commands");

    const paper = getAuthoringChecklist("paper-plugin");
    expect(paper.steps.map((step) => step.id)).toContain("verify-types-members-and-events");
    expect(paper.steps.flatMap((step) => step.tools.packageApis)).toContain("searchPaperMembers");

    expect(() => getAuthoringChecklist("missing")).toThrow("missing");
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
    expect(summary.java.datapack.observedSchemaSurfaces).toBe(1);
    expect(summary.java.resourcepack.modelSummaries).toBe(50);
    expect(summary.java.paperPlugin).toMatchObject({
      supportedVersions: 43,
      latestSupportedVersion: "1.21.11",
      latestBuild: 69,
      apiPackageIndexes: 43,
      apiSurfaces: 1,
      versionsWithoutUnknowns: 43,
      missingApiPackageIndexes: [],
    });
    expect(summary.java.paperPlugin.missingApiSurfaces).toHaveLength(42);
    expect(summary.skills).toEqual({
      total: 3,
      packagedPayloads: 3,
    });
  });

  it("exposes support matrix aliases for data selection", () => {
    const matrix = getSupportMatrix();
    expect(matrix.aliases).toMatchObject({
      latestJava: "26.2",
      latestPaper: "1.21.11",
      latestWithDatapackSchemaSurface: "26.2",
      latestWithPaperApiSurface: "1.21.11",
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

  it("keeps Minecraft Wiki prose out of redistributable data", () => {
    expect(getSourcePolicy().minecraftWikiTextRedistribution).toBe("forbidden");
  });

  it("loads Paper plugin source metadata", () => {
    expect(getDomain("paper-plugin").primarySources.map((source) => source.id)).toContain(
      "spigot-event-list",
    );
  });

  it("loads Paper plugin data and event search contract", () => {
    const paper = getPaperPluginData();
    expect(paper.latest).toEqual({
      minecraftVersion: "1.21.11",
      build: 69,
    });
    expect(paper.support.minecraftLatestGap).toEqual({
      javaLatest: "26.2",
      paperLatest: "1.21.11",
      status: "paper-not-yet-published-for-java-latest",
    });
    expect(paper.versionBuilds).toContainEqual({
      minecraftVersion: "1.21.11",
      latestBuild: 69,
      buildCount: 32,
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

  it("builds Paper API references for unsupported future versions", () => {
    const reference = getPaperApiReference("26.2");
    expect(reference.supported).toBe(false);
    expect(reference.minecraftVersion).toBe("1.21.11");
    expect(reference.latestSupportedVersion).toBe("1.21.11");
    expect(reference.apiDependency).toBeNull();
    expect(reference.javadocsUrl).toBeNull();
  });

  it("marks Paper-supported version details", () => {
    const version = getVersionDetail("java", "1.21.11");
    expect(version.domains["paper-plugin"].status).toBe("api-reference-linked");
    expect(version.domains["paper-plugin"].facts).toContain("paper_supported=true");
    expect(version.domains["paper-plugin"].facts).toContain("paper_latest_build=69");
    expect(version.domains["paper-plugin"].facts).toContain("paper_build_count=32");
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
    expect(version.domains["paper-plugin"].facts).toContain("paper_global_latest_build=69");
    expect(version.domains["paper-plugin"].unknowns).toEqual([]);
  });

  it("links Paper API package indexes for legacy supported versions", () => {
    const version = getVersionDetail("java", "1.13");
    expect(version.domains["paper-plugin"].status).toBe("api-reference-linked");
    expect(version.domains["paper-plugin"].facts).toContain("paper_api_package_index=1.13");
    expect(version.domains["paper-plugin"].unknowns).toEqual([]);
  });

  it("marks Java versions that Paper has not published yet", () => {
    const version = getVersionDetail("java", "26.2");
    expect(version.domains["paper-plugin"].status).toBe("not-yet-published");
    expect(version.domains["paper-plugin"].facts).toContain("paper_supported=false");
    expect(version.domains["paper-plugin"].facts).toContain("paper_latest_supported=1.21.11");
  });

  it("lists pack formats for all bundled releases", () => {
    const formats = listPackFormats();
    expect(formats).toHaveLength(50);
    expect(formats[0]).toMatchObject({
      version: "26.2",
      data: 107,
      resource: 88,
      paperPluginStatus: "not-yet-published",
    });
    expect(formats.at(-1)).toMatchObject({
      version: "1.13",
      data: 4,
      resource: 4,
    });
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
    expect(result.paths).toContain("assets/minecraft/items/bundle.json");
    expect(result.paths.every((path) => path.includes("/items/"))).toBe(true);
  });
});
