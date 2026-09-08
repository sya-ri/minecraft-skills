import { createHash } from "node:crypto";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  type FabricApiMember,
  type FabricApiModule,
  type FabricApiRenderingMember,
  type FabricApiRenderingModule,
  type FabricApiRenderingType,
  type FabricApiSurfaceFetch,
  type FabricApiType,
  fabricApiPackagePrefixes,
  fabricApiRenderingPackagePrefixes,
  fabricApiSurfaceLimits,
  getFabricApiMemberDetails,
  searchFabricApiMembers,
  searchFabricApiTypes,
} from "./fabricApiSurface.js";
import { javadocMemberDetailsLimits } from "./javadocMemberDetails.js";

const renderingPackage = "net.fabricmc.fabric.api.client.rendering.v1";
const rendererPackage = "net.fabricmc.fabric.api.client.renderer.v1";
const networkingPackage = "net.fabricmc.fabric.api.networking.v1";
const gametestPackage = "net.fabricmc.fabric.api.client.gametest";
const apiVersion = "0.159.0+26.2";
const metadata = `<metadata><groupId>net.fabricmc.fabric-api</groupId><artifactId>fabric-api</artifactId><versioning><latest>0.116.17+1.21.1</latest><release>0.116.17+1.21.1</release><versions><version>0.159.0+26.2</version><version>0.99.0+26.2</version><version>0.116.17+1.21.1</version><version>0.160.0+26.2.1</version><version>0.999.0+26.2-pre.1</version></versions></versioning></metadata>`;
const pom = `<?xml version="1.0" encoding="UTF-8"?><project xmlns="http://maven.apache.org/POM/4.0.0" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><modelVersion>4.0.0</modelVersion><groupId>net.fabricmc.fabric-api</groupId><artifactId>fabric-api</artifactId><version>${apiVersion}</version><dependencies><dependency><groupId>net.fabricmc.fabric-api</groupId><artifactId>fabric-rendering-v1</artifactId><version>25.3.3+515ac5339e</version><scope>compile</scope></dependency><dependency><groupId>net.fabricmc.fabric-api</groupId><artifactId>fabric-renderer-api-v1</artifactId><version>14.1.4+2b0d8a229e</version><scope>compile</scope></dependency><dependency><groupId>net.fabricmc.fabric-api</groupId><artifactId>fabric-model-loading-api-v1</artifactId><version>8.0.17+c80601bb9e</version><scope>compile</scope></dependency></dependencies></project>`;
const typeEntries = [
  { p: renderingPackage, l: "ArmorRenderer", k: "10" },
  { p: `${renderingPackage}.level`, l: "LevelRenderEvents.BeforeBlockOutline", k: "10" },
  { p: `${rendererPackage}.mesh`, l: "QuadView", k: "10" },
  { p: networkingPackage, l: "NetworkingFixture" },
  { p: gametestPackage, l: "ClientTestFixture" },
  { p: "net.fabricmc.fabric.api0", l: "NotCovered" },
  { p: "net.fabricmc.fabric.impl.networking", l: "NotImplementation" },
  { p: "net.fabricmc.loader.api", l: "NotLoader" },
  { p: "net.minecraft.client.renderer", l: "NotMojang" },
  { l: "All Classes and Interfaces", u: "allclasses-index.html", k: "18" },
];
const memberEntries = [
  {
    p: renderingPackage,
    c: "ArmorRenderer",
    l: "register(Renderer)",
    u: "register(net.minecraft.client.renderer.Renderer)",
  },
  {
    p: renderingPackage,
    c: "ArmorRenderer",
    l: "register(Renderer)",
    u: "register(net.fabricmc.example.Renderer)",
  },
  { p: renderingPackage, c: "ArmorRenderer", l: "ArmorRenderer()", u: "%3Cinit%3E()", k: "3" },
  {
    p: `${renderingPackage}.level`,
    c: "LevelRenderEvents.BeforeBlockOutline",
    l: "beforeBlockOutline(Context)",
    u: "beforeBlockOutline(net.fabricmc.fabric.api.client.rendering.v1.level.Context)",
  },
  { p: `${rendererPackage}.mesh`, c: "QuadView", l: "x(int)" },
  { p: `${rendererPackage}.mesh`, c: "QuadView", l: "DEFAULT", k: "2" },
  { p: networkingPackage, c: "NetworkingFixture", l: "registerPayload()" },
  { p: gametestPackage, c: "ClientTestFixture", l: "pressKey(int)" },
  { p: "net.fabricmc.fabric.api0", c: "NotCovered", l: "unexpected()" },
  { p: "net.fabricmc.fabric.impl.networking", c: "NotImplementation", l: "unexpected()" },
  { p: "net.fabricmc.loader.api", c: "NotLoader", l: "unexpected()" },
  { p: "net.minecraft.client.renderer", c: "NotMojang", l: "notIncluded()" },
];

function index(variable: string, values: unknown[]): string {
  return `${variable} = ${JSON.stringify(values)};updateSearchResults();`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries: Array<[string, string]>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBytes = Buffer.from(name);
    const bytes = Buffer.from(text);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(bytes), 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);
    locals.push(local, bytes);
    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc32(bytes), 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centrals.push(central);
    offset += local.length + bytes.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function fixtureFetch(
  options: {
    metadata?: string;
    pom?: string;
    typeIndex?: string;
    memberIndex?: string;
    archive?: Buffer;
    checksum?: string;
    requests?: Array<{ url: string; init?: RequestInit }>;
    response?: (url: string) => Response | undefined;
  } = {},
): FabricApiSurfaceFetch {
  const archive =
    options.archive ??
    storedZip([
      ["type-search-index.js", options.typeIndex ?? index("typeSearchIndex", typeEntries)],
      ["member-search-index.js", options.memberIndex ?? index("memberSearchIndex", memberEntries)],
    ]);
  const sha256 = options.checksum ?? createHash("sha256").update(archive).digest("hex");
  return async (url, init) => {
    options.requests?.push({ url, ...(init === undefined ? {} : { init }) });
    const overridden = options.response?.(url);
    if (overridden !== undefined) return overridden;
    if (url.endsWith("maven-metadata.xml")) {
      return new Response(options.metadata ?? metadata, {
        headers: { "content-type": "text/xml" },
      });
    }
    if (url.endsWith(".pom"))
      return new Response(options.pom ?? pom, { headers: { "content-type": "text/xml" } });
    if (url.endsWith(".sha256"))
      return new Response(sha256, { headers: { "content-type": "text/plain" } });
    return new Response(new Uint8Array(archive), {
      headers: { "content-type": "application/java-archive" },
    });
  };
}

describe("Fabric API surface", () => {
  afterEach(() => vi.useRealTimers());

  it("selects highest numeric exact suffix independently of metadata order, latest and release", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await searchFabricApiTypes(
      { gameVersion: "26.2", limit: 1 },
      fixtureFetch({ requests }),
    );
    expect(result.fabricApiVersion).toBe(apiVersion);
    expect(result.versionSelection).toMatchObject({
      reportedLatest: "0.116.17+1.21.1",
      reportedRelease: "0.116.17+1.21.1",
      reportedLatestUsed: false,
      reportedReleaseUsed: false,
      matchingCandidateCount: 2,
      candidates: ["0.159.0+26.2", "0.99.0+26.2"],
    });
    expect(result.coverage).toMatchObject({
      packagePrefixes: ["net.fabricmc.fabric.api"],
      typeCount: 5,
      memberCount: 8,
    });
    expect(result.search).toMatchObject({
      totalMatches: 5,
      returned: 1,
      truncated: true,
      limit: 1,
    });
    expect(result.renderingModules.map((module) => module.coordinate)).toContain(
      "net.fabricmc.fabric-api:fabric-renderer-api-v1:14.1.4+2b0d8a229e",
    );
    expect(result.source.fatJavadocUrl).toBe(
      "https://maven.fabricmc.net/net/fabricmc/fabric-api/fabric-api/0.159.0%2B26.2/fabric-api-0.159.0%2B26.2-fatjavadoc.jar",
    );
    expect(requests).toHaveLength(4);
    expect(
      requests.every(
        ({ init }) => init?.redirect === "error" && init.signal instanceof AbortSignal,
      ),
    ).toBe(true);
    expect(result.coverage.nonGuarantees.join(" ")).toContain("Mojang client");
    expect(JSON.stringify(result)).not.toContain("NotCovered");
  });

  it("searches public networking and GameTest indexes while excluding implementation and foreign namespaces", async () => {
    const types = await searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch());
    expect(types.types.map((entry) => entry.name)).toEqual([
      "ClientTestFixture",
      "QuadView",
      "ArmorRenderer",
      "LevelRenderEvents.BeforeBlockOutline",
      "NetworkingFixture",
    ]);
    const members = await searchFabricApiMembers(
      { gameVersion: "26.2", packagePrefix: networkingPackage, query: "payload" },
      fixtureFetch(),
    );
    expect(members.members.map((entry) => entry.name)).toEqual(["registerPayload"]);
    const gameTest = await searchFabricApiMembers(
      { gameVersion: "26.2", type: "ClientTestFixture", query: "pressKey" },
      fixtureFetch(),
    );
    expect(gameTest.members[0]?.qualifiedTypeName).toBe(`${gametestPackage}.ClientTestFixture`);
    const all = await searchFabricApiMembers(
      { gameVersion: "26.2", packagePrefix: "net.fabricmc.fabric.api" },
      fixtureFetch(),
    );
    expect(all.members).toHaveLength(8);
    expect(all.members.some((entry) => entry.name === "unexpected")).toBe(false);
    expect(all.members.some((entry) => entry.name === "notIncluded")).toBe(false);
  });

  it("preserves rendering type aliases, scope constants and filtered results", async () => {
    expectTypeOf<FabricApiRenderingType>().toEqualTypeOf<FabricApiType>();
    expectTypeOf<FabricApiRenderingMember>().toEqualTypeOf<FabricApiMember>();
    expectTypeOf<FabricApiRenderingModule>().toEqualTypeOf<FabricApiModule>();
    expect(fabricApiPackagePrefixes).toEqual(["net.fabricmc.fabric.api"]);
    expect(fabricApiRenderingPackagePrefixes).toEqual([renderingPackage, rendererPackage]);
    const results = await searchFabricApiTypes(
      { gameVersion: "26.2", packagePrefix: renderingPackage },
      fixtureFetch(),
    );
    expect(results.types.map((entry) => entry.name)).toEqual([
      "ArmorRenderer",
      "LevelRenderEvents.BeforeBlockOutline",
    ]);
  });

  it("returns all Fabric API POM modules and keeps the legacy rendering subset", async () => {
    const broaderPom = pom.replace(
      "</dependencies>",
      "<dependency><groupId>net.fabricmc.fabric-api</groupId><artifactId>fabric-networking-api-v1</artifactId><version>1.0.0+fixture</version></dependency><dependency><groupId>org.example</groupId><artifactId>foreign-library</artifactId><version>1.0.0</version></dependency></dependencies>",
    );
    const result = await searchFabricApiTypes(
      { gameVersion: "26.2", packagePrefix: gametestPackage },
      fixtureFetch({ pom: broaderPom }),
    );
    expect(result.modules.map((module) => module.artifactId)).toEqual([
      "fabric-model-loading-api-v1",
      "fabric-networking-api-v1",
      "fabric-renderer-api-v1",
      "fabric-rendering-v1",
    ]);
    expect(result.modules[1]?.coordinate).toBe(
      "net.fabricmc.fabric-api:fabric-networking-api-v1:1.0.0+fixture",
    );
    expect(result.renderingModules.map((module) => module.artifactId)).toEqual([
      "fabric-model-loading-api-v1",
      "fabric-renderer-api-v1",
      "fabric-rendering-v1",
    ]);
  });

  it("accepts non-rendering artifacts and reports absent module groups as empty evidence", async () => {
    const networkingOnlyPom = pom.replace(
      /<dependencies>[\s\S]*<\/dependencies>/,
      "<dependencies><dependency><groupId>net.fabricmc.fabric-api</groupId><artifactId>fabric-networking-api-v1</artifactId><version>1.0.0+fixture</version></dependency></dependencies>",
    );
    for (const selectedPom of [
      networkingOnlyPom,
      pom.replace(/<dependencies>[\s\S]*<\/dependencies>/, "<dependencies/>"),
    ]) {
      const result = await searchFabricApiTypes(
        { gameVersion: "26.2", query: "NetworkingFixture" },
        fixtureFetch({
          pom: selectedPom,
          typeIndex: index("typeSearchIndex", [{ p: networkingPackage, l: "NetworkingFixture" }]),
          memberIndex: index("memberSearchIndex", [
            { p: networkingPackage, c: "NetworkingFixture", l: "registerPayload()" },
          ]),
        }),
      );
      expect(result.types[0]?.name).toBe("NetworkingFixture");
      expect(result.renderingModules).toEqual([]);
      expect(result.modules).toHaveLength(selectedPom === networkingOnlyPom ? 1 : 0);
    }
  });

  it("retains overloaded mapped fragments, nested owner paths, and declaring-only evidence", async () => {
    const overloads = await searchFabricApiMembers(
      { gameVersion: "26.2", type: "ArmorRenderer", query: "register", kind: "method" },
      fixtureFetch(),
    );
    expect(overloads.members).toHaveLength(2);
    expect(new Set(overloads.members.map((member) => member.signature)).size).toBe(2);
    expect(overloads.members.every((member) => member.signatureSource === "url-fragment")).toBe(
      true,
    );
    const mapped = await searchFabricApiMembers(
      { gameVersion: "26.2", query: "net.minecraft.client.renderer.Renderer" },
      fixtureFetch(),
    );
    expect(mapped.members).toHaveLength(1);
    const nested = await searchFabricApiTypes(
      { gameVersion: "26.2", query: "BeforeBlockOutline" },
      fixtureFetch(),
    );
    expect(nested.types[0]?.javadocPath).toBe(
      "net/fabricmc/fabric/api/client/rendering/v1/level/LevelRenderEvents.BeforeBlockOutline.html",
    );
    const constructorResult = await searchFabricApiMembers(
      { gameVersion: "26.2", kind: "constructor" },
      fixtureFetch(),
    );
    expect(constructorResult.members[0]?.signature).toBe("<init>()");
    expect(constructorResult.members[0]?.javadocFragment).toBe("%3Cinit%3E()");
  });

  it("extracts bounded lifecycle prose for one exact indexed member", async () => {
    const javadocPath = "net/fabricmc/fabric/api/client/rendering/v1/FabricRenderState.html";
    const html =
      '<!doctype html><html><body><section class="detail" id="clearExtraData()"><h3>clearExtraData</h3><div class="member-signature"><span class="modifiers">public</span> <span class="return-type">void</span> <span class="element-name">clearExtraData</span>()</div><div class="block">Clears extra data before the next extraction pass.</div><dl class="notes"><dt>API Note:</dt><dd>Render state instances may be reused.</dd></dl></section></body></html>';
    const archive = storedZip([
      [
        "type-search-index.js",
        index("typeSearchIndex", [{ p: renderingPackage, l: "FabricRenderState" }]),
      ],
      [
        "member-search-index.js",
        index("memberSearchIndex", [
          { p: renderingPackage, c: "FabricRenderState", l: "clearExtraData()" },
        ]),
      ],
      [javadocPath, html],
    ]);

    const result = await getFabricApiMemberDetails(
      {
        gameVersion: "26.2",
        fabricApiVersion: apiVersion,
        javadocPath,
        javadocFragment: "clearExtraData()",
      },
      fixtureFetch({ archive }),
      () => new Date("2026-09-08T00:00:00.000Z"),
    );

    expect(result).toMatchObject({
      schemaVersion: 1,
      gameVersion: "26.2",
      fabricApiVersion: apiVersion,
      member: {
        qualifiedTypeName: `${renderingPackage}.FabricRenderState`,
        name: "clearExtraData",
      },
      status: "available",
      format: "modern-section",
      declarationText: "public void clearExtraData()",
      returnTypeText: "void",
      descriptionText: "Clears extra data before the next extraction pass.",
      notes: [{ label: "API Note:", entries: ["Render state instances may be reused."] }],
      source: {
        kind: "official-verified-fatjavadoc-entry",
        archiveSha256: createHash("sha256").update(archive).digest("hex"),
        entryPath: javadocPath,
        entrySha256: createHash("sha256").update(html).digest("hex"),
        retrievedAt: "2026-09-08T00:00:00.000Z",
      },
      coverage: {
        scope: "selected-declaration-documentation",
        extractionComplete: true,
        truncated: false,
      },
    });
    expect(result.coverage.nonClaims.join(" ")).toContain("runtime behavior");
  });

  it("rejects artifact drift before downloading a different fat Javadoc", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    await expect(
      getFabricApiMemberDetails(
        {
          gameVersion: "26.2",
          fabricApiVersion: "0.158.0+26.2",
          javadocPath: `${renderingPackage.replaceAll(".", "/")}/ArmorRenderer.html`,
          javadocFragment: "register(net.minecraft.client.renderer.Renderer)",
        },
        fixtureFetch({ requests }),
      ),
    ).rejects.toThrow("artifact changed");
    expect(requests).toHaveLength(1);
  });

  it("uses the decoded exact anchor and rejects missing or oversized indexed pages", async () => {
    const javadocPath = `${renderingPackage.replaceAll(".", "/")}/ArmorRenderer.html`;
    const member = {
      p: renderingPackage,
      c: "ArmorRenderer",
      l: "ArmorRenderer()",
      u: "%3Cinit%3E()",
      k: "3",
    };
    const indexes: Array<[string, string]> = [
      [
        "type-search-index.js",
        index("typeSearchIndex", [{ p: renderingPackage, l: "ArmorRenderer" }]),
      ],
      ["member-search-index.js", index("memberSearchIndex", [member])],
    ];
    const html =
      '<section class="detail" id="&lt;init&gt;()"><div class="member-signature"><span class="element-name">ArmorRenderer</span><span class="parameters">()</span></div></section>';
    const available = await getFabricApiMemberDetails(
      {
        gameVersion: "26.2",
        fabricApiVersion: apiVersion,
        javadocPath,
        javadocFragment: "%3Cinit%3E()",
      },
      fixtureFetch({ archive: storedZip([...indexes, [javadocPath, html]]) }),
    );
    expect(available).toMatchObject({
      status: "available",
      declarationText: "ArmorRenderer()",
      member: { signature: "<init>()" },
    });

    await expect(
      getFabricApiMemberDetails(
        {
          gameVersion: "26.2",
          fabricApiVersion: apiVersion,
          javadocPath,
          javadocFragment: "%3Cinit%3E()",
        },
        fixtureFetch({ archive: storedZip(indexes) }),
      ),
    ).rejects.toThrow("missing the indexed member page");

    await expect(
      getFabricApiMemberDetails(
        {
          gameVersion: "26.2",
          fabricApiVersion: apiVersion,
          javadocPath,
          javadocFragment: "%3Cinit%3E()",
        },
        fixtureFetch({
          archive: storedZip([
            ...indexes,
            [javadocPath, "x".repeat(javadocMemberDetailsLimits.maxPageBytes + 1)],
          ]),
        }),
      ),
    ).rejects.toThrow("indexed member page exceeds");
  });

  it("filters exact package boundaries and reports an empty query match without widening coverage", async () => {
    const result = await searchFabricApiMembers(
      {
        gameVersion: "26.2",
        packagePrefix: `${rendererPackage}.mesh`,
        kind: "field-or-enum-constant",
      },
      fixtureFetch(),
    );
    expect(result.members.map((member) => member.name)).toEqual(["DEFAULT"]);
    const empty = await searchFabricApiTypes(
      { gameVersion: "26.2", query: "NoSuchName" },
      fixtureFetch(),
    );
    expect(empty.types).toEqual([]);
    expect(empty.search).toMatchObject({ totalMatches: 0, returned: 0, truncated: false });
    for (const packagePrefix of [
      "net.fabricmc.fabric.api0",
      "net.fabricmc.fabric.impl",
      "net.fabricmc.loader.api",
      "net.minecraft",
    ]) {
      const fetchMock = vi.fn<FabricApiSurfaceFetch>();
      await expect(
        searchFabricApiTypes({ gameVersion: "26.2", packagePrefix }, fetchMock),
      ).rejects.toThrow("packagePrefix");
      expect(fetchMock).not.toHaveBeenCalled();
    }
    const sibling = await searchFabricApiTypes(
      { gameVersion: "26.2", packagePrefix: `${renderingPackage}0` },
      fixtureFetch(),
    );
    expect(sibling.types).toEqual([]);
  });

  it.each([
    [
      "wrong artifact",
      metadata.replace("<artifactId>fabric-api</artifactId>", "<artifactId>other</artifactId>"),
      "unexpected artifact",
    ],
    [
      "duplicate",
      metadata.replace("<version>0.99.0+26.2</version>", "<version>0.159.0+26.2</version>"),
      "duplicate version",
    ],
    [
      "no exact suffix",
      metadata.replaceAll("+26.2</version>", "+26.2.1</version>"),
      "exact Minecraft suffix",
    ],
    [
      "unsupported exact core",
      metadata.replace("0.159.0+26.2", "0.159.0-beta+26.2"),
      "semantic version core",
    ],
    [
      "XXE",
      `<!DOCTYPE metadata [<!ENTITY test SYSTEM "file:///secret">]>${metadata}`,
      "forbidden declaration",
    ],
    ["unclosed XML", metadata.replace("</metadata>", ""), "unclosed"],
    [
      "duplicate version list",
      metadata.replace(
        "</versioning>",
        "<versions><version>0.1.0+26.2</version></versions></versioning>",
      ),
      "exactly one <versions>",
    ],
  ])("rejects %s metadata", async (_name, value, message) => {
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ metadata: value })),
    ).rejects.toThrow(message);
  });

  it.each([
    [pom.replace(apiVersion, "0.158.0+26.2"), "unexpected artifact"],
    [pom.replace("fabric-model-loading-api-v1", "fabric-rendering-v1"), "duplicate dependency"],
    [pom.replace("25.3.3+515ac5339e", `$\{unsafe.version}`), "Maven token"],
  ])("rejects inconsistent aggregate POM %s", async (value, message) => {
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ pom: value })),
    ).rejects.toThrow(message);
  });

  it("rejects checksum mismatch and malformed sidecars before reading any ZIP entry", async () => {
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ checksum: "0".repeat(64) })),
    ).rejects.toThrow("SHA-256 mismatch");
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ checksum: "not a checksum" })),
    ).rejects.toThrow("64 lowercase hex digits");
  });

  it("accepts the official Maven generic binary POM content type but still parses strict UTF-8 XML", async () => {
    const result = await searchFabricApiTypes(
      { gameVersion: "26.2" },
      fixtureFetch({
        response: (url) =>
          url.endsWith(".pom")
            ? new Response(pom, { headers: { "content-type": "application/octet-stream" } })
            : undefined,
      }),
    );
    expect(result.fabricApiVersion).toBe(apiVersion);
  });

  it("rejects duplicate ZIP names, corrupted CRC, absent indexes and oversized index declarations", async () => {
    const duplicate = storedZip([
      ["type-search-index.js", "[]"],
      ["type-search-index.js", "[]"],
    ]);
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ archive: duplicate })),
    ).rejects.toThrow("duplicate entry");
    const corrupted = storedZip([
      ["type-search-index.js", index("typeSearchIndex", typeEntries)],
      ["member-search-index.js", index("memberSearchIndex", memberEntries)],
    ]);
    corrupted[30 + "type-search-index.js".length] = 0x78;
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ archive: corrupted })),
    ).rejects.toThrow("CRC-32 mismatch");
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ archive: storedZip([]) })),
    ).rejects.toThrow("absent or exceeds");
    const oversized = storedZip([
      ["type-search-index.js", "x".repeat(fabricApiSurfaceLimits.maxSearchIndexBytes + 1)],
      ["member-search-index.js", "[]"],
    ]);
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ archive: oversized })),
    ).rejects.toThrow("search-index byte limit");
  });

  it("parses index JSON without executing JavaScript and rejects duplicate, empty and foreign-owner entries", async () => {
    await expect(
      searchFabricApiTypes(
        { gameVersion: "26.2" },
        fixtureFetch({
          typeIndex: `${index("typeSearchIndex", typeEntries)} globalThis.intrusion = true;`,
        }),
      ),
    ).rejects.toThrow("canonical typeSearchIndex assignment");
    await expect(
      searchFabricApiTypes(
        { gameVersion: "26.2" },
        fixtureFetch({ typeIndex: index("typeSearchIndex", [...typeEntries, typeEntries[0]]) }),
      ),
    ).rejects.toThrow("contains duplicate");
    await expect(
      searchFabricApiTypes(
        { gameVersion: "26.2" },
        fixtureFetch({
          memberIndex: index("memberSearchIndex", [...memberEntries, memberEntries[0]]),
        }),
      ),
    ).rejects.toThrow("contains duplicate");
    await expect(
      searchFabricApiTypes(
        { gameVersion: "26.2" },
        fixtureFetch({
          typeIndex: index("typeSearchIndex", []),
          memberIndex: index("memberSearchIndex", []),
        }),
      ),
    ).rejects.toThrow("no covered Fabric API");
    await expect(
      searchFabricApiTypes(
        { gameVersion: "26.2" },
        fixtureFetch({
          memberIndex: index("memberSearchIndex", [
            { p: renderingPackage, c: "Missing", l: "test()" },
          ]),
        }),
      ),
    ).rejects.toThrow("unindexed type");
  });

  it.each([
    [{ p: renderingPackage, l: "../Escape" }, "dotted Java identifier"],
    [
      { p: renderingPackage, l: "ArmorRenderer", u: "https://unexpected.invalid" },
      "override their Javadoc path",
    ],
    [{ p: renderingPackage, l: "ArmorRenderer", extra: "value" }, "unsupported keys"],
  ])("rejects malformed covered type %s", async (entry, message) => {
    await expect(
      searchFabricApiTypes(
        { gameVersion: "26.2" },
        fixtureFetch({ typeIndex: index("typeSearchIndex", [entry]) }),
      ),
    ).rejects.toThrow(message);
  });

  it.each([
    "https://unexpected.invalid",
    "%QQ",
    "name%00()",
  ])("rejects unsafe member fragment %s", async (fragment) => {
    await expect(
      searchFabricApiMembers(
        { gameVersion: "26.2" },
        fixtureFetch({
          memberIndex: index("memberSearchIndex", [
            { p: renderingPackage, c: "ArmorRenderer", l: "register()", u: fragment },
          ]),
        }),
      ),
    ).rejects.toThrow();
  });

  it("rejects oversized responses, invalid Content-Length, HTML and redirects", async () => {
    for (const override of [
      new Response("", {
        headers: {
          "content-type": "text/xml",
          "content-length": String(fabricApiSurfaceLimits.maxMetadataBytes + 1),
        },
      }),
      new Response("", { headers: { "content-type": "text/xml", "content-length": "-1" } }),
      new Response("<html/>", { headers: { "content-type": "text/html" } }),
      new Response("", { status: 302, headers: { location: "https://unexpected.invalid" } }),
      new Response("x".repeat(fabricApiSurfaceLimits.maxMetadataBytes + 1), {
        headers: { "content-type": "text/xml" },
      }),
    ]) {
      await expect(
        searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ response: () => override })),
      ).rejects.toThrow();
    }
  });

  it("bounds index and Maven entry counts", async () => {
    const versions = `<metadata><groupId>net.fabricmc.fabric-api</groupId><artifactId>fabric-api</artifactId><versioning><versions>${"<version>x</version>".repeat(fabricApiSurfaceLimits.maxMavenVersions + 1)}</versions></versioning></metadata>`;
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ metadata: versions })),
    ).rejects.toThrow("must list between");
    await expect(
      searchFabricApiTypes(
        { gameVersion: "26.2" },
        fixtureFetch({
          typeIndex: index(
            "typeSearchIndex",
            Array.from({ length: fabricApiSurfaceLimits.maxSearchIndexEntries + 1 }, () => ({
              l: "a",
            })),
          ),
        }),
      ),
    ).rejects.toThrow("entry limit");
  });

  it("bounds XML depth/elements and total archive entries before index parsing", async () => {
    for (const xml of [
      `${"<x>".repeat(17)}${"</x>".repeat(17)}`,
      `<metadata>${"<x/>".repeat(25_001)}</metadata>`,
    ]) {
      await expect(
        searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ metadata: xml })),
      ).rejects.toThrow("XML");
    }
    const crowded = storedZip(
      Array.from({ length: fabricApiSurfaceLimits.maxArchiveEntries + 1 }, (_, entry) => [
        `entry${entry}`,
        "",
      ]),
    );
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2" }, fixtureFetch({ archive: crowded })),
    ).rejects.toThrow("archive entry limit");
  });

  it.each([
    "reject",
    "hang",
  ] as const)("keeps HTTP and byte-limit errors when stream cancellation %s", async (behavior) => {
    vi.useFakeTimers();
    const cancel = () =>
      behavior === "hang"
        ? new Promise<void>(() => {})
        : Promise.reject(new Error("cancel failed"));
    const refused = new Response(new ReadableStream<Uint8Array>({ cancel }), { status: 404 });
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2", timeoutMs: 100 }, async () => refused),
    ).rejects.toThrow("request failed: 404");
    const oversized = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(fabricApiSurfaceLimits.maxMetadataBytes + 1));
        },
        cancel,
      }),
      { headers: { "content-type": "text/xml" } },
    );
    await expect(
      searchFabricApiTypes({ gameVersion: "26.2", timeoutMs: 100 }, async () => oversized),
    ).rejects.toThrow("byte limit");
    expect(oversized.body?.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("enforces one deadline even when the injected fetch ignores abort", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<FabricApiSurfaceFetch>(() => new Promise(() => {}));
    const pending = searchFabricApiTypes({ gameVersion: "26.2", timeoutMs: 100 }, fetchMock);
    const assertion = expect(pending).rejects.toThrow("timed out after 100 milliseconds");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("cancels a stalled response body at the shared deadline", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const stalled = new Response(new ReadableStream<Uint8Array>({ cancel }), {
      headers: { "content-type": "text/xml" },
    });
    const pending = searchFabricApiTypes(
      { gameVersion: "26.2", timeoutMs: 100 },
      async () => stalled,
    );
    const assertion = expect(pending).rejects.toThrow("timed out after 100 milliseconds");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(cancel).toHaveBeenCalledOnce();
    expect(stalled.body?.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("validates options before making requests", async () => {
    const fetchMock = vi.fn(fixtureFetch());
    for (const options of [
      { gameVersion: "../26.2" },
      { gameVersion: "26.2", limit: 0 },
      { gameVersion: "26.2", limit: 201 },
      { gameVersion: "26.2", timeoutMs: 99 },
      { gameVersion: "26.2", query: " " },
    ])
      await expect(searchFabricApiTypes(options, fetchMock)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
