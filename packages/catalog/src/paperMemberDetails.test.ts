import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaperMemberDetails, searchPaperMembers } from "./index.js";
import {
  fetchPaperMemberDetails,
  type PaperMemberDetailsFetch,
  paperMemberDetailsLimits,
} from "./paperMemberDetails.js";
import type { PaperApiSurfaceData } from "./schemas.js";

const base = "https://jd.papermc.io/paper/26.2/";
const path = "org/example/Outer.Inner.html";
const fragment = "accept(java.lang.String...)";
const memberUrl = `${base}${path}#${fragment}`;
const surface: PaperApiSurfaceData = {
  schemaVersion: 1,
  projectId: "paper",
  minecraftVersion: "26.2",
  coverage: "javadocs-search-index",
  javadocsUrl: base,
  typeCount: 0,
  memberCount: 1,
  types: [],
  sources: [],
  members: [
    {
      packageName: "org.example",
      typeName: "Outer.Inner",
      qualifiedTypeName: "org.example.Outer.Inner",
      name: "accept",
      label: "accept(String...)",
      kind: "method",
      url: memberUrl,
    },
  ],
};

// Small synthetic fixtures preserve the structures observed in official 26.2/1.16.5 and 1.13.2 doclets.
const modern = `<!doctype html><html><body>
<section class="detail" id="accept(int)"><div class="member-signature">void wrong(int n)</div><div class="block">OTHER OVERLOAD</div></section>
<section class="detail" id="${fragment}"><h3>accept</h3><div class="horizontal-scroll">
<div class="member-signature"><span class="annotations">@NotNull</span> <span class="modifiers">public</span>
<span class="return-type"><a href="Other.html">Map</a>&lt;String, Integer&gt;</span> <span class="element-name">accept</span><wbr><span class="parameters">(@Nullable String... values)</span> throws <span class="exceptions">IllegalArgumentException</span></div>
<div class="deprecation-block"><span class="deprecated-label">Deprecated.</span> Use the replacement.</div>
<div class="block">Records <code>values</code>.<p>Empty values are preserved &amp; reported.<script>SECRET_SCRIPT</script><style>SECRET_STYLE</style><template>SECRET_TEMPLATE</template></div>
<dl class="notes"><dt>Parameters:</dt><dd><code>values</code> - Values to record.</dd><dt>Returns:</dt><dd>A map of counts.</dd><dt>Throws:</dt><dd><code>IllegalArgumentException</code> - Invalid values.</dd><dt>API Note:</dt><dd>No external requests.</dd></dl>
</div></section>
<section class="detail" id="next()"><div class="member-signature">void next()</div><div class="block">NEXT MEMBER</div></section>
</body></html>`;

function response(html = modern): Response {
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
function fetchHtml(html = modern) {
  return vi.fn(async () => response(html));
}
function lookup(html = modern) {
  return fetchPaperMemberDetails(
    surface,
    { memberUrl },
    fetchHtml(html),
    () => new Date("2026-09-08T00:00:00.000Z"),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Paper member details", () => {
  it("extracts one exact overload's declaration and documented contract with source evidence", async () => {
    const fetch = fetchHtml();
    const result = await fetchPaperMemberDetails(surface, { memberUrl }, fetch);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      `${base}${path}`,
      expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }),
    );
    expect(result).toMatchObject({
      version: "26.2",
      status: "available",
      format: "modern-section",
      unavailableReason: null,
      returnTypeText: "Map<String, Integer>",
      parametersText: "(@Nullable String... values)",
      throwsText: "IllegalArgumentException",
      deprecationText: "Deprecated. Use the replacement.",
      coverage: { extractionComplete: true, truncated: false, unavailableFields: [] },
      source: {
        url: memberUrl,
        pageUrl: `${base}${path}`,
        bytes: Buffer.byteLength(modern),
        sha256: createHash("sha256").update(modern).digest("hex"),
      },
    });
    expect(result.declarationText).toContain("@NotNull");
    expect(result.descriptionText).toBe("Records values.\nEmpty values are preserved & reported.");
    expect(result.notes).toEqual([
      { label: "Parameters:", entries: ["values - Values to record."] },
      { label: "Returns:", entries: ["A map of counts."] },
      { label: "Throws:", entries: ["IllegalArgumentException - Invalid values."] },
      { label: "API Note:", entries: ["No external requests."] },
    ]);
    for (const unrelated of [
      "OTHER OVERLOAD",
      "NEXT MEMBER",
      "SECRET_SCRIPT",
      "SECRET_STYLE",
      "SECRET_TEMPLATE",
    ])
      expect(JSON.stringify(result)).not.toContain(unrelated);
    expect(result).not.toHaveProperty("threadSafe");
    expect(result).not.toHaveProperty("nullable");
  });

  it("reads the legacy named anchor and pre declaration without inventing separated Java types", async () => {
    const oldFragment = "accept-java.lang.String...-";
    const oldUrl = memberUrl.replace(fragment, oldFragment);
    const oldSurface = structuredClone(surface);
    const oldMember = oldSurface.members[0];
    if (!oldMember) throw new Error("Expected member");
    oldMember.url = oldUrl;
    const html = `<a name="${oldFragment}"></a><!-- spacer --><ul class="blockList"><li class="blockList"><h4>accept</h4><pre>@Nullable Map&lt;String, Integer&gt; accept&#8203;(String... values)</pre><div class="block">Legacy description.</div><dl><dt>Returns:</dt><dd>Recorded values.</dd></dl></li></ul><a name="next--"></a><ul class="blockList"><li class="blockList"><pre>void next()</pre><div class="block">NEXT MEMBER</div></li></ul>`;
    const result = await fetchPaperMemberDetails(
      oldSurface,
      { memberUrl: oldUrl },
      fetchHtml(html),
    );
    expect(result).toMatchObject({
      status: "available",
      format: "legacy-block-list",
      declarationText: "@Nullable Map<String, Integer> accept(String... values)",
      returnTypeText: null,
      parametersText: null,
      throwsText: null,
      descriptionText: "Legacy description.",
      coverage: { unavailableFields: ["returnTypeText", "parametersText", "throwsText"] },
    });
    expect(result.notes).toEqual([{ label: "Returns:", entries: ["Recorded values."] }]);
    expect(JSON.stringify(result)).not.toContain("NEXT MEMBER");
  });

  it("accepts encoded constructor anchors, fields, absent prose, and void signatures", async () => {
    const constructorUrl = `${base}${path}#%3Cinit%3E()`;
    const constructorSurface = structuredClone(surface);
    const originalMember = constructorSurface.members[0];
    if (!originalMember) throw new Error("Expected member");
    constructorSurface.members[0] = {
      ...originalMember,
      url: constructorUrl,
      kind: "constructor",
    };
    const constructorResult = await fetchPaperMemberDetails(
      constructorSurface,
      { memberUrl: constructorUrl },
      fetchHtml(
        '<section class="detail" id="&lt;init&gt;()"><div class="member-signature"><span class="element-name">Inner</span><span class="parameters">()</span></div></section>',
      ),
    );
    expect(constructorResult).toMatchObject({
      status: "available",
      declarationText: "Inner()",
      returnTypeText: null,
      descriptionText: null,
      notes: [],
    });
    const empty = await lookup(
      `<section class="detail" id="${fragment}"><div class="member-signature"><span class="return-type">void</span> accept()</div></section>`,
    );
    expect(empty).toMatchObject({
      returnTypeText: "void",
      notes: [],
      descriptionText: null,
      deprecationText: null,
    });
    const field = await lookup(
      `<section class="detail" id="${fragment}"><div class="member-signature"><span class="return-type">String</span> VALUE</div></section>`,
    );
    expect(field.parametersText).toBeNull();
  });

  it.each([
    ["<html><body>No matching member.</body></html>", "anchor-not-found"],
    [`${modern}<a id="${fragment}"></a>`, "ambiguous-anchor"],
    [`<div id="${fragment}"><pre>Not a supported doclet.</pre></div>`, "unsupported-format"],
    [
      `<section class="detail" id="${fragment}"><div class="member-signature">void accept()</div><section class="detail" id="nested()"><div class="member-signature">void nested()</div></section></section>`,
      "unsupported-format",
    ],
  ])("reports unavailable member evidence without guessing from other sections", async (html, reason) => {
    const result = await lookup(html);
    expect(result).toMatchObject({
      status: "unavailable",
      unavailableReason: reason,
      declarationText: null,
      coverage: { extractionComplete: false },
    });
  });

  it("bounds text, notes, and HTML structure with explicit incomplete output", async () => {
    const result = await lookup(modern.replace("Records <code>values</code>.", "z".repeat(40_000)));
    expect(result.coverage).toMatchObject({ truncated: true, extractionComplete: false });
    expect(result.descriptionText?.length).toBeLessThanOrEqual(
      paperMemberDetailsLimits.maxFieldCharacters,
    );
    const manyNotes = modern.replace(
      "<dt>API Note:</dt>",
      "<dt>Note:</dt><dd>value</dd>".repeat(100),
    );
    expect((await lookup(manyNotes)).coverage.truncated).toBe(true);
    await expect(lookup(`${"<div>".repeat(300)}${modern}${"</div>".repeat(300)}`)).rejects.toThrow(
      "structure limit",
    );
    await expect(lookup("<br>".repeat(paperMemberDetailsLimits.maxHtmlNodes + 1))).rejects.toThrow(
      "structure limit",
    );
  });

  it("rejects arbitrary URLs, another version, and non-exact anchors before network access", async () => {
    const fetch = fetchHtml();
    for (const url of [
      "https://example.com/a.html#x",
      memberUrl.replace("26.2", "1.21.11"),
      memberUrl.replace("String...", "String[]"),
      `${memberUrl} `,
    ]) {
      await expect(fetchPaperMemberDetails(surface, { memberUrl: url }, fetch)).rejects.toThrow(
        "exactly match",
      );
    }
    const poisoned = structuredClone(surface);
    const poisonedMember = poisoned.members[0];
    if (!poisonedMember) throw new Error("Expected member");
    poisonedMember.url = "https://evil.example/a.html#x";
    await expect(
      fetchPaperMemberDetails(poisoned, { memberUrl: poisonedMember.url }, fetch),
    ).rejects.toThrow("official Javadocs");
    await expect(
      fetchPaperMemberDetails(surface, { memberUrl, timeoutMs: 1 }, fetch),
    ).rejects.toThrow("timeoutMs");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects HTTP errors, redirects, wrong content, and malformed UTF-8", async () => {
    for (const [reply, message] of [
      [new Response("missing", { status: 404 }), "HTTP 404"],
      [new Response(null, { status: 302 }), "redirects"],
      [new Response("json", { headers: { "content-type": "application/json" } }), "must be HTML"],
      [new Response(new Uint8Array([0xff]), { headers: { "content-type": "text/html" } }), "UTF-8"],
      [
        new Response("html", {
          headers: { "content-type": "text/html", "content-length": "999999999" },
        }),
        "page byte limit",
      ],
    ] as const) {
      await expect(
        fetchPaperMemberDetails(surface, { memberUrl }, async () => reply),
      ).rejects.toThrow(message);
    }
    const redirected = response();
    Object.defineProperty(redirected, "url", { value: `${base}different.html` });
    await expect(
      fetchPaperMemberDetails(surface, { memberUrl }, async () => redirected),
    ).rejects.toThrow("differs");
  });

  it("enforces streamed body limits and cancels over-limit streams", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(paperMemberDetailsLimits.maxPageBytes + 1));
      },
      cancel,
    });
    await expect(
      fetchPaperMemberDetails(surface, { memberUrl }, async () => new Response(stream)),
    ).rejects.toThrow("page byte limit");
    expect(cancel).toHaveBeenCalled();
  });

  it("bounds stalled fetch and stalled body reads with one deadline", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    for (const fetch of [
      vi.fn<PaperMemberDetailsFetch>(() => new Promise<Response>(() => {})),
      vi.fn<PaperMemberDetailsFetch>(
        async () => new Response(new ReadableStream<Uint8Array>({ cancel })),
      ),
    ]) {
      const pending = expect(
        fetchPaperMemberDetails(surface, { memberUrl, timeoutMs: 100 }, fetch),
      ).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(100);
      await pending;
      expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    }
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("public Catalog API binds details to the requested surface and does not substitute latest", async () => {
    const indexed = searchPaperMembers({
      version: "1.20.2",
      type: "org.bukkit.inventory.Inventory",
      contains: "addItem",
      limit: 1,
    }).members[0];
    if (!indexed) throw new Error("Expected bundled member");
    const anchor = decodeURIComponent(new URL(indexed.url).hash.slice(1));
    const fetch = fetchHtml(
      `<section class="detail" id="${anchor}"><div class="member-signature">void addItem()</div></section>`,
    );
    const result = await getPaperMemberDetails(
      { version: "1.20.2", memberUrl: indexed.url },
      fetch,
    );
    expect(result.version).toBe("1.20.2");
    await expect(
      getPaperMemberDetails({ version: "0.0.0", memberUrl: indexed.url }, fetch),
    ).rejects.toThrow("No bundled Paper API surface");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
