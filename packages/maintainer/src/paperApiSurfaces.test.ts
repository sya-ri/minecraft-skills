import { describe, expect, it } from "vitest";
import { buildLegacyPaperApiSurface, buildPaperApiSurface } from "./paperApiSurfaces.js";

describe("buildPaperApiSurface", () => {
  it("normalizes Paper Javadocs type and member search indexes", () => {
    const surface = buildPaperApiSurface({
      minecraftVersion: "1.21.11",
      javadocsUrl: "https://jd.papermc.io/paper/1.21.11/",
      typeSearchIndexJs:
        'typeSearchIndex = [{"p":"org.bukkit.entity","l":"Player"},{"p":"org.bukkit.event.player","l":"PlayerJoinEvent"}];updateSearchResults();',
      memberSearchIndexJs:
        'memberSearchIndex = [{"p":"org.bukkit.entity","c":"Player","l":"sendMessage(String)","u":"sendMessage(java.lang.String)"},{"p":"org.bukkit.entity","c":"Player","l":"Player()","u":"%3Cinit%3E()"},{"p":"org.bukkit.entity","c":"Player","l":"DEFAULT_SPEED"}];updateSearchResults();',
      retrievedAt: "2026-06-22T00:00:00.000Z",
    });

    expect(surface.typeCount).toBe(2);
    expect(surface.types[0]).toEqual({
      packageName: "org.bukkit.entity",
      name: "Player",
      qualifiedName: "org.bukkit.entity.Player",
      url: "https://jd.papermc.io/paper/1.21.11/org/bukkit/entity/Player.html",
    });
    expect(surface.memberCount).toBe(3);
    expect(surface.members).toContainEqual(
      expect.objectContaining({
        qualifiedTypeName: "org.bukkit.entity.Player",
        label: "sendMessage(String)",
        kind: "method",
        url: "https://jd.papermc.io/paper/1.21.11/org/bukkit/entity/Player.html#sendMessage(java.lang.String)",
      }),
    );
    expect(surface.members.map((member) => member.kind)).toContain("constructor");
    expect(surface.members.map((member) => member.kind)).toContain("field-or-enum-constant");
  });

  it("classifies nested type constructors from the simple type name and init URL", () => {
    const surface = buildPaperApiSurface({
      minecraftVersion: "26.2",
      javadocsUrl: "https://jd.papermc.io/paper/26.2/",
      typeSearchIndexJs:
        'typeSearchIndex = [{"p":"org.bukkit.entity","l":"Player.Spigot"}];updateSearchResults();',
      memberSearchIndexJs:
        'memberSearchIndex = [{"p":"org.bukkit.entity","c":"Player.Spigot","l":"Spigot()","u":"%3Cinit%3E()"}];updateSearchResults();',
      retrievedAt: "2026-09-03T00:00:00.000Z",
    });

    expect(surface.members).toContainEqual(
      expect.objectContaining({
        qualifiedTypeName: "org.bukkit.entity.Player.Spigot",
        name: "Spigot",
        kind: "constructor",
      }),
    );
  });

  it("extracts direct supertypes from modern Paper Javadocs overview trees", () => {
    const surface = buildPaperApiSurface({
      minecraftVersion: "26.2",
      javadocsUrl: "https://jd.papermc.io/paper/26.2/",
      typeSearchIndexJs:
        'typeSearchIndex = [{"p":"org.bukkit","l":"OfflinePlayer"},{"p":"org.bukkit.entity","l":"Entity"},{"p":"org.bukkit.entity","l":"HumanEntity"},{"p":"org.bukkit.entity","l":"Player"}];updateSearchResults();',
      memberSearchIndexJs:
        'memberSearchIndex = [{"p":"org.bukkit.entity","c":"Entity","l":"teleportAsync(Location)"}];updateSearchResults();',
      overviewTreeHtml: [
        '<h2 title="Class Hierarchy">Class Hierarchy</h2>',
        '<ul><li class="circle">java.lang.Object</li></ul>',
        '<h2 title="Interface Hierarchy">Interface Hierarchy</h2>',
        '<ul><li class="circle">org.bukkit.entity.<a href="org/bukkit/entity/Entity.html" class="type-name-link" title="interface in org.bukkit.entity">Entity</a>',
        '<ul><li class="circle">org.bukkit.entity.<a href="org/bukkit/entity/HumanEntity.html" class="type-name-link" title="interface in org.bukkit.entity">HumanEntity</a>',
        '<ul><li class="circle">org.bukkit.entity.<a href="org/bukkit/entity/Player.html" class="type-name-link" title="interface in org.bukkit.entity">Player</a> (also extends org.bukkit.<a href="org/bukkit/OfflinePlayer.html" title="interface in org.bukkit">OfflinePlayer</a>)</li></ul>',
        "</li></ul>",
        "</li></ul>",
      ].join("\n"),
      retrievedAt: "2026-09-03T00:00:00.000Z",
    });

    expect(surface.inheritanceCoverage).toBe("javadocs-overview-tree");
    expect(
      surface.types.find((entry) => entry.qualifiedName === "org.bukkit.entity.Player")
        ?.directSupertypes,
    ).toEqual(["org.bukkit.entity.HumanEntity", "org.bukkit.OfflinePlayer"]);
    expect(surface.sources.at(-1)?.kind).toBe("official-javadocs-type-hierarchy");
  });

  it("falls back to declared members when an overview tree yields no known hierarchy edges", () => {
    const surface = buildPaperApiSurface({
      minecraftVersion: "26.2",
      javadocsUrl: "https://jd.papermc.io/paper/26.2/",
      typeSearchIndexJs:
        'typeSearchIndex = [{"p":"org.bukkit.entity","l":"Player"}];updateSearchResults();',
      memberSearchIndexJs:
        'memberSearchIndex = [{"p":"org.bukkit.entity","c":"Player","l":"sendMessage(String)"}];updateSearchResults();',
      overviewTreeHtml: [
        '<h2 title="Class Hierarchy">Class Hierarchy</h2>',
        '<ul><li class="circle">java.lang.Object</li></ul>',
      ].join("\n"),
      retrievedAt: "2026-09-03T00:00:00.000Z",
    });

    expect(surface.inheritanceCoverage).toBeUndefined();
    expect(surface.types).toEqual([
      expect.not.objectContaining({ directSupertypes: expect.anything() }),
    ]);
    expect(surface.sources.map((source) => source.kind)).not.toContain(
      "official-javadocs-type-hierarchy",
    );
  });

  it("normalizes legacy Paper Javadocs allclasses and index-all pages", () => {
    const surface = buildLegacyPaperApiSurface({
      minecraftVersion: "1.13.2",
      javadocsUrl: "https://jd.papermc.io/paper/1.13.2/",
      allClassesUrl: "https://jd.papermc.io/paper/1.13.2/allclasses-noframe.html",
      indexAllUrl: "https://jd.papermc.io/paper/1.13.2/index-all.html",
      retrievedAt: "2026-06-22T00:00:00.000Z",
      allClassesHtml: [
        '<li><a href="org/bukkit/entity/Entity.html" title="interface in org.bukkit.entity"><span class="interfaceName">Entity</span></a></li>',
        '<li><a href="org/bukkit/entity/Player.html" title="interface in org.bukkit.entity"><span class="interfaceName">Player</span></a></li>',
        '<li><a href="org/bukkit/event/player/PlayerJoinEvent.html" title="class in org.bukkit.event.player">PlayerJoinEvent</a></li>',
      ].join("\n"),
      indexAllHtml: [
        '<dt><span class="memberNameLink"><a href="org/bukkit/entity/Player.html#sendMessage-java.lang.String-">sendMessage(String)</a></span> - Method in interface org.bukkit.entity.<a href="org/bukkit/entity/Player.html" title="interface in org.bukkit.entity">Player</a></dt>',
        '<dt><span class="memberNameLink"><a href="org/bukkit/Material.html#ACACIA_BUTTON">ACACIA_BUTTON</a></span> - org.bukkit.<a href="org/bukkit/Material.html" title="enum in org.bukkit">Material</a></dt>',
      ].join("\n"),
      overviewTreeHtml: [
        '<h2 title="Class Hierarchy">Class Hierarchy</h2>',
        '<ul><li class="circle">java.lang.Object</li></ul>',
        '<h2 title="Interface Hierarchy">Interface Hierarchy</h2>',
        '<ul><li class="circle">org.bukkit.entity.<a href="org/bukkit/entity/Entity.html" title="interface in org.bukkit.entity"><span class="typeNameLink">Entity</span></a>',
        '<ul><li class="circle">org.bukkit.entity.<a href="org/bukkit/entity/Player.html" title="interface in org.bukkit.entity"><span class="typeNameLink">Player</span></a></li></ul>',
        "</li></ul>",
      ].join("\n"),
    });

    expect(surface.typeCount).toBe(3);
    expect(surface.types).toContainEqual(
      expect.objectContaining({
        qualifiedName: "org.bukkit.entity.Player",
        directSupertypes: ["org.bukkit.entity.Entity"],
      }),
    );
    expect(surface.memberCount).toBe(2);
    expect(surface.members).toContainEqual(
      expect.objectContaining({
        qualifiedTypeName: "org.bukkit.entity.Player",
        label: "sendMessage(String)",
        kind: "method",
      }),
    );
    expect(surface.members).toContainEqual(
      expect.objectContaining({
        qualifiedTypeName: "org.bukkit.Material",
        label: "ACACIA_BUTTON",
        kind: "field-or-enum-constant",
      }),
    );
    expect(surface.sources.map((source) => source.kind)).toEqual([
      "official-javadocs-legacy-index",
      "official-javadocs-legacy-index",
      "official-javadocs-type-hierarchy",
    ]);
  });
});
