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

  it("compares Paper API package indexes", async () => {
    const result = await capture(["compare-paper-api", "1.20.4", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"added"');
    expect(result.stdout.join("\n")).toContain("io.papermc.paper.datacomponent");
  });

  it("prints vanilla inventory", async () => {
    const result = await capture(["vanilla-inventory"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"version": "26.2"');
    expect(result.stdout.join("\n")).toContain('"assets/minecraft/models"');
    expect(result.stdout.join("\n")).toContain('"data/minecraft/tags"');
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
