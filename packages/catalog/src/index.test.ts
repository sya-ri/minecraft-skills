import { describe, expect, it } from "vitest";
import {
  buildPaperEventSearchUrl,
  compareVersions,
  getDomain,
  getJavaReportsSummary,
  getPaperPluginData,
  getResourcepackModelSummary,
  getSourcePolicy,
  getVanillaInventory,
  getVersionDetail,
  listDomains,
  listPackFormats,
  resolveVersion,
  searchCommands,
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

  it("marks Paper-supported version details", () => {
    const version = getVersionDetail("java", "1.21.11");
    expect(version.domains["paper-plugin"].status).toBe("supported");
    expect(version.domains["paper-plugin"].facts).toContain("paper_supported=true");
    expect(version.domains["paper-plugin"].facts).toContain("paper_latest_build=69");
    expect(version.domains["paper-plugin"].facts).toContain("paper_build_count=32");
    expect(version.domains["paper-plugin"].facts).toContain("paper_global_latest_build=69");
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

  it("annotates version details when vanilla inventory is bundled", () => {
    const version = getVersionDetail("java", "26.2");
    expect(version.domains.datapack.status).toBe("reports-extracted");
    expect(version.domains.resourcepack.status).toBe("models-extracted");
    expect(version.domains.datapack.facts).toContain("vanilla_data_inventory=26.2");
    expect(version.domains.datapack.facts).toContain("server_reports=26.2");
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
