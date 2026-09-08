import { searchPaperMembers } from "@minecraft-skills/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callMinecraftSkillsTool, listMinecraftSkillsTools } from "./tools.js";

afterEach(() => vi.unstubAllGlobals());

describe("get_paper_member_details MCP", () => {
  it("exposes an exact-URL lookup and returns the selected version's documentation", async () => {
    expect(
      listMinecraftSkillsTools().find((tool) => tool.name === "get_paper_member_details")
        ?.inputSchema.required,
    ).toEqual(["memberUrl"]);
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
          `<section class="detail" id="${fragment}"><div class="member-signature"><span class="return-type">Map</span> addItem()</div><dl class="notes"><dt>Returns:</dt><dd>Remaining items.</dd></dl></section>`,
          { headers: { "content-type": "text/html" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await callMinecraftSkillsTool("get_paper_member_details", {
      version: "1.20.2",
      memberUrl: member.url,
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(result.content[0]?.text ?? "")).toMatchObject({
      status: "available",
      version: "1.20.2",
      returnTypeText: "Map",
      notes: [{ label: "Returns:", entries: ["Remaining items."] }],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid arguments and arbitrary URLs before network access", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const args of [
      {},
      { memberUrl: 7 },
      { memberUrl: "https://example.com/file#x" },
      { memberUrl: "a", version: 1 },
      { memberUrl: "a", timeoutMs: null },
      { memberUrl: "a", timeoutMs: 99 },
      { memberUrl: "a", extra: true },
    ]) {
      expect((await callMinecraftSkillsTool("get_paper_member_details", args)).isError).toBe(true);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
