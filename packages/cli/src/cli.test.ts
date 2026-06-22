import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./cli.js";

async function capture(argv: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(argv, {
    write: (value) => stdout.push(value),
    error: (value) => stderr.push(value),
  });
  return { code, stdout, stderr };
}

describe("minecraft-skills CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints domains", async () => {
    const result = await capture(["domains"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("paper-plugin");
  });

  it("prints installable skills", async () => {
    const result = await capture(["skills", "--domain", "paper-plugin"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toEqual([
      "minecraft-paper-plugins\tpaper-plugin\tskills/minecraft-paper-plugins\tMinecraft Paper Plugins",
    ]);
  });

  it("prints packaged skill payloads", async () => {
    const result = await capture(["skill", "minecraft-paper-plugins"]);
    const output = result.stdout.join("\n");
    expect(result.code).toBe(0);
    expect(output).toContain('"name": "minecraft-paper-plugins"');
    expect(output).toContain("# Minecraft Paper Plugins");
    expect(output).toContain("display_name");
    expect(output).toContain("Minecraft Paper Plugins");
    expect(output).toContain("# Paper Plugin Sources");
  });

  it("writes packaged skill folders", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-cli-"));
    try {
      const result = await capture(["write-skill", "minecraft-paper-plugins", "--output", root]);
      const skillRoot = join(root, "minecraft-paper-plugins");
      expect(result.code).toBe(0);
      expect(result.stdout).toContain(join(skillRoot, "SKILL.md"));
      expect(readFileSync(join(skillRoot, "SKILL.md"), "utf8")).toContain(
        "# Minecraft Paper Plugins",
      );
      expect(readFileSync(join(skillRoot, "agents/openai.yaml"), "utf8")).toContain("display_name");
      expect(readFileSync(join(skillRoot, "references/sources.md"), "utf8")).toContain(
        "# Paper Plugin Sources",
      );

      const blocked = await capture(["write-skill", "minecraft-paper-plugins", "--output", root]);
      expect(blocked.code).toBe(1);
      expect(blocked.stderr.join("\n")).toContain("Refusing to overwrite existing file");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints bundled coverage summary", async () => {
    const result = await capture(["coverage"]);
    const output = result.stdout.join("\n");
    expect(result.code).toBe(0);
    expect(output).toContain('"complete": true');
    expect(output).toContain('"latestSupportedVersion": "1.21.11"');
    expect(output).toContain('"packagedPayloads": 3');
  });

  it("prints fact surfaces and their non-guarantees", async () => {
    const list = await capture(["fact-surfaces", "--domain", "datapack"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "datapack-schema-surface"');
    expect(list.stdout.join("\n")).toContain('"id": "command-paths"');

    const single = await capture(["fact-surface", "paper-api-surface"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain("does not prove method behavior");
  });

  it("prints authoring checklists", async () => {
    const list = await capture(["authoring-checklists", "--domain", "paper-plugin"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"domain": "paper-plugin"');
    expect(list.stdout.join("\n")).toContain("verify-types-members-and-events");

    const single = await capture(["authoring-checklist", "datapack"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain("verify-commands-and-paths");
    expect(single.stdout.join("\n")).toContain("search-datapack-schema");
  });

  it("prints authoring guardrails", async () => {
    const list = await capture(["authoring-guardrails", "--domain", "paper-plugin"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "global-source-provenance"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-api-surface-limits"');

    const single = await capture(["authoring-guardrail", "paper-api-surface-limits"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain("Javadocs package, type, and member indexes");
    expect(single.stdout.join("\n")).toContain("nonexistent APIs");
  });

  it("prints claim policies", async () => {
    const list = await capture(["claim-policies", "--domain", "paper-plugin"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "paper-type-or-member-exists"');
    expect(list.stdout.join("\n")).toContain('"id": "folia-or-thread-safety"');

    const single = await capture(["claim-policy", "command-syntax-exists"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain("parser shape, not gameplay behavior");
    expect(single.stdout.join("\n")).toContain("will succeed at runtime");
  });

  it("prints authoring preflight payloads", async () => {
    const datapack = await capture(["preflight", "datapack", "26.2"]);
    expect(datapack.code).toBe(0);
    expect(datapack.stdout.join("\n")).toContain('"resolvedVersion": "26.2"');
    expect(datapack.stdout.join("\n")).toContain('"id": "verify-commands-and-paths"');

    const paper = await capture(["preflight", "paper-plugin", "26.2"]);
    expect(paper.code).toBe(0);
    expect(paper.stdout.join("\n")).toContain("Paper is not marked supported for 26.2");
  });

  it("prints authoring contexts", async () => {
    const result = await capture(["authoring-context", "paper-plugin", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"resolvedVersion": "1.21.11"');
    expect(result.stdout.join("\n")).toContain('"guardrails"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-api-surface-limits"');
    expect(result.stdout.join("\n")).toContain('"claimPolicies"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-type-or-member-exists"');
    expect(result.stdout.join("\n")).toContain('"intentLookups"');
    expect(result.stdout.join("\n")).toContain('"id": "verify-paper-type-or-member"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-javadocs"');
  });

  it("prints evidence bundles", async () => {
    const result = await capture(["evidence", "paper-plugin", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"minecraftWikiTextRedistribution": "forbidden"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-javadocs"');
    expect(result.stdout.join("\n")).toContain('"kind": "paper-api-surface"');
  });

  it("prints intent lookups", async () => {
    const list = await capture(["intent-lookups", "--domain", "paper-plugin"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "verify-paper-type-or-member"');
    expect(list.stdout.join("\n")).toContain('"id": "discover-paper-event-candidates"');

    const single = await capture(["intent-lookup", "verify-command-syntax"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain('"search_commands"');
    expect(single.stdout.join("\n")).toContain("does not prove gameplay behavior");
  });

  it("prints data manifest and cache state", async () => {
    const manifest = await capture(["data-manifest"]);
    expect(manifest.code).toBe(0);
    expect(manifest.stdout.join("\n")).toContain('"dataVersion": "2026.06.22-1"');

    const cacheDir = await capture(["cache-dir"]);
    expect(cacheDir.code).toBe(0);
    expect(cacheDir.stdout[0]).toContain("minecraft-skills");

    const cacheList = await capture(["cache-list"]);
    expect(cacheList.code).toBe(0);
    expect(cacheList.stdout.join("\n")).toContain('"files"');
  });

  it("prints support matrix aliases", async () => {
    const result = await capture(["support-matrix"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"latestWithDatapackSchemaSurface": "26.2"');
    expect(result.stdout.join("\n")).toContain('"latestWithPaperApiSurface": "1.21.11"');
  });

  it("prints per-version support", async () => {
    const result = await capture(["version-support", "--domain", "paper-plugin"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"version": "26.2"');
    expect(result.stdout.join("\n")).toContain('"supported": false');
    expect(result.stdout.join("\n")).toContain('"version": "1.21.11"');
    expect(result.stdout.join("\n")).toContain('"latestBuild": 69');
  });

  it("fetches downloadable data into the cache", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-cli-cache-"));
    const previousCacheDir = process.env.MINECRAFT_SKILLS_CACHE_DIR;
    process.env.MINECRAFT_SKILLS_CACHE_DIR = root;
    try {
      const body = readFileSync(
        join(process.cwd(), "../data/data/java/datapack-schema-surfaces/26.2.json"),
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string) => ({
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => body,
        })),
      );

      const result = await capture([
        "fetch-data",
        "datapack-schema-surface",
        "--version",
        "26.2",
        "--force",
      ]);
      expect(result.code).toBe(0);
      expect(result.stdout.join("\n")).toContain("java/datapack-schema-surfaces/26.2.json");
    } finally {
      if (previousCacheDir === undefined) {
        delete process.env.MINECRAFT_SKILLS_CACHE_DIR;
      } else {
        process.env.MINECRAFT_SKILLS_CACHE_DIR = previousCacheDir;
      }
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints latest Java version", async () => {
    expect((await capture(["latest"])).stdout).toEqual(["26.2"]);
  });

  it("prints effective version coverage", async () => {
    const result = await capture(["versions"]);
    expect(result.stdout[0]).toBe("26.2\trelease\t2026-06-16T12:03:33+00:00\tversion-json-and-jar");
  });

  it("prints pack formats by version", async () => {
    const result = await capture(["pack-formats"]);
    expect(result.stdout[0]).toContain("26.2\t2026-06-16T12:03:33+00:00\tdata=107");
    expect(result.stdout[0]).toContain("resource=88");
    expect(result.stdout[0]).toContain("paper=not-yet-published");
  });

  it("filters references by domain", async () => {
    const result = await capture(["references", "--domain", "paper-plugin"]);
    expect(result.stdout.join("\n")).toContain("minecraft-paper-plugins");
  });

  it("prints Paper plugin support data", async () => {
    const result = await capture(["paper"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"minecraftVersion": "1.21.11"');
    expect(result.stdout.join("\n")).toContain(
      "https://spigot-event-list.s7a.dev/api/search/events",
    );
  });

  it("prints Paper API references", async () => {
    const result = await capture(["paper-api", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("io.papermc.paper:paper-api:1.21.11-R0.1-SNAPSHOT");
    expect(result.stdout.join("\n")).toContain("https://jd.papermc.io/paper/1.21.11/");
  });

  it("prints Paper API package indexes", async () => {
    const result = await capture(["paper-api-index", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("io.papermc.paper.threadedregions.scheduler");
  });

  it("prints and searches Paper API surfaces", async () => {
    const surface = await capture(["paper-api-surface", "1.21.11"]);
    expect(surface.code).toBe(0);
    expect(surface.stdout.join("\n")).toContain('"coverage": "javadocs-search-index"');

    const types = await capture([
      "paper-types",
      "1.21.11",
      "--contains",
      "org.bukkit.entity.Player",
      "--limit",
      "5",
    ]);
    expect(types.code).toBe(0);
    expect(types.stdout.join("\n")).toContain("org.bukkit.entity.Player");

    const members = await capture([
      "paper-members",
      "1.21.11",
      "--type",
      "org.bukkit.entity.Player",
      "--contains",
      "sendMessage",
      "--kind",
      "method",
      "--limit",
      "5",
    ]);
    expect(members.code).toBe(0);
    expect(members.stdout.join("\n")).toContain("sendMessage");
  });

  it("compares Paper API package indexes", async () => {
    const result = await capture(["compare-paper-api", "1.20.4", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"added"');
    expect(result.stdout.join("\n")).toContain("io.papermc.paper.datacomponent");
  });

  it("compares Paper API surfaces", async () => {
    const result = await capture(["compare-paper-api-surface", "1.21.11", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"addedTypes": []');
    expect(result.stdout.join("\n")).toContain('"changes": []');
  });

  it("prints vanilla inventory", async () => {
    const result = await capture(["vanilla-inventory"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"version": "26.2"');
    expect(result.stdout.join("\n")).toContain('"assets/minecraft/models"');
    expect(result.stdout.join("\n")).toContain('"data/minecraft/tags"');
  });

  it("prints and searches observed datapack schema surfaces", async () => {
    const surface = await capture(["datapack-schema", "26.2"]);
    expect(surface.code).toBe(0);
    expect(surface.stdout.join("\n")).toContain("vanilla-observed-datapack-json-shape");

    const search = await capture([
      "search-datapack-schema",
      "26.2",
      "--kind",
      "advancement",
      "--contains",
      "criteria",
      "--limit",
      "5",
    ]);
    expect(search.code).toBe(0);
    expect(search.stdout.join("\n")).toContain('"path": "$.criteria"');
  });

  it("compares observed datapack schema surfaces", async () => {
    const result = await capture(["compare-datapack-schema", "26.2", "26.2"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"addedTotal": 0');
    expect(result.stdout.join("\n")).toContain('"changes": []');
  });

  it("searches vanilla paths", async () => {
    const result = await capture([
      "vanilla-paths",
      "26.2",
      "--domain",
      "resourcepack",
      "--prefix",
      "assets/minecraft/models/block/",
      "--contains",
      "acacia_button",
      "--extension",
      "json",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("assets/minecraft/models/block/acacia_button.json");
  });

  it("compares vanilla paths", async () => {
    const result = await capture([
      "compare-vanilla-paths",
      "1.20.6",
      "1.21",
      "--domain",
      "resourcepack",
      "--prefix",
      "assets/minecraft/models/item/",
      "--limit",
      "10",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain(
      "assets/minecraft/models/item/music_disc_creator.json",
    );
  });

  it("prints version comparison", async () => {
    const result = await capture(["compare-versions", "1.20.6", "1.21"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"from": "1.20.6"');
    expect(result.stdout.join("\n")).toContain('"to": "1.21"');
    expect(result.stdout.join("\n")).toContain('"vanillaInventory"');
  });

  it("prints server reports", async () => {
    const result = await capture(["server-reports"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"coverage": "server-reports"');
    expect(result.stdout.join("\n")).toContain('"execute"');
  });

  it("searches command paths", async () => {
    const result = await capture(["commands", "26.2", "--prefix", "execute"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"matchedPaths"');
    expect(result.stdout.join("\n")).toContain("execute");
  });

  it("compares command paths", async () => {
    const result = await capture(["compare-commands", "1.20.6", "1.21", "--prefix", "attribute"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("modifier add");
  });

  it("prints resourcepack model summaries", async () => {
    const result = await capture(["resourcepack-models", "26.2"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"coverage": "client-resourcepack-models"');
    expect(result.stdout.join("\n")).toContain('"minecraft:model"');
  });

  it("searches resourcepack model paths", async () => {
    const result = await capture([
      "search-models",
      "26.2",
      "--kind",
      "item-definition",
      "--contains",
      "bundle",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("assets/minecraft/items/bundle.json");
  });

  it("searches Paper events", async () => {
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ events: [{ name: "PlayerJoinEvent" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await capture(["paper-events", "player join", "--version", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("PlayerJoinEvent");
    const url = fetchMock.mock.calls[0]?.[0] ?? "";
    expect(url).toContain("q=player+join");
    expect(url).toContain("version=1.21.11");
  });

  it("reports unknown commands", async () => {
    const result = await capture(["nope"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["Unknown command: nope"]);
  });
});
