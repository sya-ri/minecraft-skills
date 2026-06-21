import { describe, expect, it } from "vitest";
import { buildPaperApiIndex } from "./paperApiIndexes.js";

describe("buildPaperApiIndex", () => {
  it("extracts package links without Javadocs prose", () => {
    const index = buildPaperApiIndex({
      minecraftVersion: "1.21.11",
      javadocsUrl: "https://jd.papermc.io/paper/1.21.11/",
      retrievedAt: "2026-06-22T00:00:00.000Z",
      html: `
        <a href="io/papermc/paper/threadedregions/scheduler/package-summary.html">io.papermc.paper.threadedregions.scheduler</a>
        <div>Scheduler package description that should not be copied.</div>
        <a href="org/bukkit/event/player/package-summary.html">org.bukkit.event.player</a>
        <a href="allclasses-index.html">All Classes</a>
      `,
    });

    expect(index.packageCount).toBe(2);
    expect(index.packages).toEqual([
      {
        name: "io.papermc.paper.threadedregions.scheduler",
        url: "https://jd.papermc.io/paper/1.21.11/io/papermc/paper/threadedregions/scheduler/package-summary.html",
      },
      {
        name: "org.bukkit.event.player",
        url: "https://jd.papermc.io/paper/1.21.11/org/bukkit/event/player/package-summary.html",
      },
    ]);
    expect(JSON.stringify(index)).not.toContain("Scheduler package description");
  });

  it("normalizes legacy package frame links to package summary URLs", () => {
    const index = buildPaperApiIndex({
      minecraftVersion: "1.13.2",
      javadocsUrl: "https://jd.papermc.io/paper/1.13.2/",
      retrievedAt: "2026-06-22T00:00:00.000Z",
      html: `
        <li><a href="com/destroystokyo/paper/event/player/package-frame.html" target="packageFrame">com.destroystokyo.paper.event.player</a></li>
        <li><a href="org/bukkit/plugin/package-frame.html" target="packageFrame">org.bukkit.plugin</a></li>
      `,
    });

    expect(index.packages).toEqual([
      {
        name: "com.destroystokyo.paper.event.player",
        url: "https://jd.papermc.io/paper/1.13.2/com/destroystokyo/paper/event/player/package-summary.html",
      },
      {
        name: "org.bukkit.plugin",
        url: "https://jd.papermc.io/paper/1.13.2/org/bukkit/plugin/package-summary.html",
      },
    ]);
  });

  it("extracts package names from modern Javadoc search indexes", () => {
    const index = buildPaperApiIndex({
      minecraftVersion: "1.20.5",
      javadocsUrl: "https://jd.papermc.io/paper/1.20.5/",
      retrievedAt: "2026-06-22T00:00:00.000Z",
      html: `
        packageSearchIndex = [{"l":"All Packages","u":"allpackages-index.html"},{"l":"io.papermc.paper.threadedregions.scheduler"},{"l":"org.bukkit.plugin"}];updateSearchResults();
      `,
    });

    expect(index.packages).toEqual([
      {
        name: "io.papermc.paper.threadedregions.scheduler",
        url: "https://jd.papermc.io/paper/1.20.5/io/papermc/paper/threadedregions/scheduler/package-summary.html",
      },
      {
        name: "org.bukkit.plugin",
        url: "https://jd.papermc.io/paper/1.20.5/org/bukkit/plugin/package-summary.html",
      },
    ]);
  });
});
