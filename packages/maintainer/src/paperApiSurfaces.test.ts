import { describe, expect, it } from "vitest";
import { buildPaperApiSurface } from "./paperApiSurfaces.js";

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
});
