import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPaperApiSurface, ingestPaperApiSurfaces } from "./paperApiSurfaces.js";

vi.mock("@minecraft-skills/catalog", () => ({
  getPaperPluginData: () => ({ versions: ["26.3"] }),
}));

const oldDate = "2026-09-15T00:00:00.000Z";
const newDate = "2026-11-27T00:00:00.000Z";
const indexes = (land: boolean) => ({
  typeSearchIndexJs: `typeSearchIndex = ${JSON.stringify([
    { p: "org.bukkit.entity", l: "Entity" },
    { p: "org.bukkit.event.entity", l: "EntityEvent" },
    ...(land ? [{ p: "io.papermc.paper.event.entity", l: "EntityLandEvent" }] : []),
  ])};`,
  memberSearchIndexJs:
    'memberSearchIndex = [{"p":"org.bukkit.entity","c":"Entity","l":"getType()"}];',
});

describe("Paper API surface refresh", () => {
  let root: string;
  let output: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "paper-api-refresh-"));
    const directory = join(root, "packages/data/data/java/paper-api-surfaces");
    mkdirSync(directory, { recursive: true });
    output = join(directory, "26.3.json");
    writeFileSync(
      output,
      `${JSON.stringify(
        buildPaperApiSurface({
          minecraftVersion: "26.3",
          javadocsUrl: "https://jd.papermc.io/paper/26.3/",
          ...indexes(false),
          retrievedAt: oldDate,
        }),
        null,
        2,
      )}\n`,
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(root, { recursive: true, force: true });
  });
  function serve(land: boolean) {
    const source = indexes(land);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("type-search-index.js")) return new Response(source.typeSearchIndexJs);
      if (url.endsWith("member-search-index.js")) return new Response(source.memberSearchIndexJs);
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  it("updates an existing version when official indexes add a type", async () => {
    serve(true);
    expect(await ingestPaperApiSurfaces({ root, retrievedAt: newDate })).toBe(1);
    const result = JSON.parse(readFileSync(output, "utf8"));
    expect(result.types).toContainEqual(expect.objectContaining({ name: "EntityLandEvent" }));
    expect(result.sources[0].retrievedAt).toBe(newDate);
  });
  it("checks existing versions but preserves bytes and provenance when unchanged", async () => {
    const fetchMock = serve(false);
    const before = readFileSync(output, "utf8");
    expect(await ingestPaperApiSurfaces({ root, retrievedAt: newDate })).toBe(0);
    expect(fetchMock).toHaveBeenCalled();
    expect(readFileSync(output, "utf8")).toBe(before);
  });
  it("retains explicit force rewriting for unchanged sources", async () => {
    serve(false);
    expect(await ingestPaperApiSurfaces({ root, retrievedAt: newDate, force: true })).toBe(1);
    expect(JSON.parse(readFileSync(output, "utf8")).sources[0].retrievedAt).toBe(newDate);
  });
  it("preserves an existing surface when both official index formats fail", async () => {
    const fetchMock = serve(false);
    fetchMock.mockImplementation(async () => new Response("unavailable", { status: 503 }));
    const before = readFileSync(output, "utf8");
    expect(await ingestPaperApiSurfaces({ root, retrievedAt: newDate })).toBe(0);
    expect(readFileSync(output, "utf8")).toBe(before);
  });
  it("preserves known hierarchy coverage when the overview tree is unavailable", async () => {
    const original = JSON.parse(readFileSync(output, "utf8"));
    original.inheritanceCoverage = "javadocs-overview-tree";
    original.types[0].directSupertypes = ["org.bukkit.Nameable"];
    writeFileSync(output, `${JSON.stringify(original)}\n`);
    const before = readFileSync(output, "utf8");
    serve(true);
    expect(await ingestPaperApiSurfaces({ root, retrievedAt: newDate })).toBe(0);
    expect(readFileSync(output, "utf8")).toBe(before);
  });
  function seedValidators() {
    const original = JSON.parse(readFileSync(output, "utf8"));
    original.inheritanceCoverage = "javadocs-overview-tree";
    original.sources.push({
      id: "paper-javadocs-overview-tree-26.3",
      kind: "official-javadocs-type-hierarchy",
      url: "https://jd.papermc.io/paper/26.3/overview-tree.html",
      retrievedAt: oldDate,
    });
    for (const source of original.sources) source.lastModified = "Tue, 15 Sep 2026 00:00:00 GMT";
    original.sources[0].etag = '"types-v1"';
    writeFileSync(output, `${JSON.stringify(original)}\n`);
  }
  it("avoids all body downloads when every source returns 304", async () => {
    seedValidators();
    const before = readFileSync(output, "utf8");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("HEAD");
      return new Response(null, { status: 304 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await ingestPaperApiSurfaces({ root, retrievedAt: newDate })).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ "If-None-Match": '"types-v1"' });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
      "If-Modified-Since": "Tue, 15 Sep 2026 00:00:00 GMT",
    });
    expect(readFileSync(output, "utf8")).toBe(before);
  });
  it("downloads again when a conditional check reports a change", async () => {
    seedValidators();
    const source = indexes(true);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") return new Response(null, { status: 200 });
      if (url.endsWith("type-search-index.js")) return new Response(source.typeSearchIndexJs);
      if (url.endsWith("member-search-index.js")) return new Response(source.memberSearchIndexJs);
      return new Response(
        '<h2>Class Hierarchy</h2><ul><li>org.bukkit.event.entity.<a class="type-name-link" href="org/bukkit/event/entity/EntityEvent.html">EntityEvent</a><ul><li>io.papermc.paper.event.entity.<a class="type-name-link" href="io/papermc/paper/event/entity/EntityLandEvent.html">EntityLandEvent</a></li></ul></li></ul>',
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await ingestPaperApiSurfaces({ root, retrievedAt: newDate })).toBe(1);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("HEAD");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.parse(readFileSync(output, "utf8")).types).toContainEqual(
      expect.objectContaining({ name: "EntityLandEvent" }),
    );
  });
  it("records HTTP validators from successful source downloads", async () => {
    const source = indexes(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("overview-tree.html")) return new Response("not found", { status: 404 });
        return new Response(
          url.endsWith("type-search-index.js")
            ? source.typeSearchIndexJs
            : source.memberSearchIndexJs,
          {
            headers: { ETag: '"index-v2"', "Last-Modified": "Fri, 27 Nov 2026 00:00:00 GMT" },
          },
        );
      }),
    );
    expect(await ingestPaperApiSurfaces({ root, retrievedAt: newDate })).toBe(1);
    expect(JSON.parse(readFileSync(output, "utf8")).sources).toEqual([
      expect.objectContaining({
        etag: '"index-v2"',
        lastModified: "Fri, 27 Nov 2026 00:00:00 GMT",
      }),
      expect.objectContaining({
        etag: '"index-v2"',
        lastModified: "Fri, 27 Nov 2026 00:00:00 GMT",
      }),
    ]);
  });
});
