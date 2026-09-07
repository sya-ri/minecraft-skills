import { searchPaperMembers } from "@minecraft-skills/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./cli.js";

async function capture(args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    write: (value) => stdout.push(value),
    error: (value) => stderr.push(value),
  });
  return { code, stdout, stderr };
}
afterEach(() => vi.unstubAllGlobals());

describe("plugin paper member-details CLI", () => {
  it("routes the indexed URL and uses extraction completeness for exit status", async () => {
    const member = searchPaperMembers({
      version: "1.20.2",
      type: "org.bukkit.inventory.Inventory",
      contains: "addItem",
      limit: 1,
    }).members[0];
    if (!member) throw new Error("Expected indexed fixture");
    const fragment = decodeURIComponent(new URL(member.url).hash.slice(1));
    const fetch = vi.fn(
      async () =>
        new Response(
          `<section class="detail" id="${fragment}"><div class="member-signature">void addItem()</div></section>`,
          { headers: { "content-type": "text/html" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const args = [
      "plugin",
      "paper",
      "member-details",
      "1.20.2",
      "--url",
      member.url,
      "--timeout-ms",
      "1000",
    ];
    const result = await capture(args);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout[0] ?? "")).toMatchObject({
      status: "available",
      version: "1.20.2",
      declarationText: "void addItem()",
    });
    fetch.mockImplementation(
      async () => new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    );
    const unavailable = await capture(args);
    expect(unavailable.code).toBe(1);
    expect(JSON.parse(unavailable.stdout[0] ?? "")).toMatchObject({
      status: "unavailable",
      unavailableReason: "anchor-not-found",
    });
  });

  it("rejects missing URLs, extra positionals, and unknown flags before network access", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const args of [
      [],
      ["--url"],
      ["1.20.2", "extra", "--url", "x"],
      ["--url", "x", "--unknown"],
      ["--url", "x", "--timeout-ms", "NaN"],
    ]) {
      const result = await capture(["plugin", "paper", "member-details", ...args]);
      expect(result.code).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
