import { createHash } from "node:crypto";
import { type DefaultTreeAdapterMap, defaultTreeAdapter, parse } from "parse5";
import type { PaperApiMemberData, PaperApiSurfaceData } from "./schemas.js";

/** Fixed ceilings for one indexed, official Javadocs page and its selected member. */
export const paperMemberDetailsLimits = Object.freeze({
  maxUrlCharacters: 4_096,
  maxPageBytes: 8 * 1024 * 1024,
  maxHtmlNodes: 200_000,
  maxHtmlDepth: 256,
  maxOutputCharacters: 32_768,
  maxFieldCharacters: 16_384,
  maxNotes: 64,
  maxNoteEntries: 128,
  defaultTimeoutMs: 10_000,
  maxTimeoutMs: 30_000,
});

export type PaperMemberDetailsOptions = {
  version?: string;
  /** Copy the exact URL from search_paper_members for this version. */
  memberUrl: string;
  timeoutMs?: number;
};

export type PaperMemberDetailsFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type PaperMemberDetailsResult = {
  schemaVersion: 1;
  version: string;
  member: PaperApiMemberData;
  status: "available" | "unavailable";
  unavailableReason: "anchor-not-found" | "ambiguous-anchor" | "unsupported-format" | null;
  source: {
    kind: "official-live-javadocs";
    url: string;
    pageUrl: string;
    retrievedAt: string;
    sha256: string;
    bytes: number;
  };
  format: "modern-section" | "legacy-block-list" | null;
  declarationText: string | null;
  returnTypeText: string | null;
  parametersText: string | null;
  throwsText: string | null;
  descriptionText: string | null;
  deprecationText: string | null;
  /** Original dt/dd labels and text; these are documentation, not interpreted guarantees. */
  notes: Array<{ label: string; entries: string[] }>;
  coverage: {
    extractionComplete: boolean;
    truncated: boolean;
    unavailableFields: string[];
    scope: "selected-declaration-documentation";
    nonClaims: string[];
  };
};

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

const excludedElements = new Set(["script", "style", "template", "svg", "noscript"]);
const blockElements = new Set(["p", "div", "pre", "li", "dt", "dd", "br", "h3", "h4"]);

function isElement(node: Node): node is Element {
  return "tagName" in node;
}

function children(node: Node): Node[] {
  return "childNodes" in node ? node.childNodes : [];
}

function attribute(node: Element, name: string): string | undefined {
  return node.attrs.find((entry) => entry.name === name)?.value;
}

function hasClass(node: Element, name: string): boolean {
  return (attribute(node, "class") ?? "").split(/\s+/u).includes(name);
}

/** Iterative traversal keeps adversarial depth off the JavaScript stack. */
function elements(root: Node): Element[] {
  const pending: Array<{ node: Node; depth: number }> = [{ node: root, depth: 0 }];
  const found: Element[] = [];
  let count = 0;
  while (pending.length) {
    const current = pending.pop();
    if (!current) break;
    count += 1;
    if (
      count > paperMemberDetailsLimits.maxHtmlNodes ||
      current.depth > paperMemberDetailsLimits.maxHtmlDepth
    ) {
      throw new Error("Paper Javadocs HTML exceeds the structure limit");
    }
    if (isElement(current.node)) {
      if (excludedElements.has(current.node.tagName)) continue;
      found.push(current.node);
    }
    const entries = children(current.node);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const node = entries[index];
      if (node) pending.push({ node, depth: current.depth + 1 });
    }
  }
  return found;
}

function plainText(root: Node): string {
  const result: string[] = [];
  const pending: Array<{ node: Node; end: boolean }> = [{ node: root, end: false }];
  while (pending.length) {
    const current = pending.pop();
    if (!current) break;
    const { node, end } = current;
    if (isElement(node) && excludedElements.has(node.tagName)) continue;
    const block = isElement(node) && blockElements.has(node.tagName);
    if (block) result.push("\n");
    if (end) continue;
    if (node.nodeName === "#text" && "value" in node) result.push(node.value);
    if (block) pending.push({ node, end: true });
    const entries = children(node);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const child = entries[index];
      if (child) pending.push({ node: child, end: false });
    }
  }
  return result
    .join("")
    .replace(/[\u200b\u00ad]/gu, "")
    .replace(/\p{Cc}/gu, (character) => ("\n\r\t".includes(character) ? character : ""))
    .replace(/[\t\r\f \u00a0]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

class OutputBudget {
  remaining = paperMemberDetailsLimits.maxOutputCharacters;
  truncated = false;

  text(value: string): string {
    const limit = Math.min(this.remaining, paperMemberDetailsLimits.maxFieldCharacters);
    let result = value.slice(0, limit);
    // Do not split a UTF-16 surrogate pair at a retained-text boundary.
    if (/[\ud800-\udbff]$/u.test(result)) result = result.slice(0, -1);
    if (result.length < value.length) this.truncated = true;
    this.remaining -= result.length;
    return result;
  }

  node(node: Node | undefined): string | null {
    return node ? this.text(plainText(node)) : null;
  }
}

function legacySection(anchor: Element): Element | null {
  if (anchor.tagName !== "a" || !anchor.parentNode) return null;
  const siblings = children(anchor.parentNode);
  const position = siblings.indexOf(anchor);
  // Old doclets put an empty named anchor immediately before the member's block list.
  const next = siblings.slice(position + 1).find(isElement);
  if (next?.tagName !== "ul" || !hasClass(next, "blockList")) return null;
  const blocks = children(next).filter(
    (node): node is Element =>
      isElement(node) && node.tagName === "li" && hasClass(node, "blockList"),
  );
  return blocks.length === 1 ? (blocks[0] ?? null) : null;
}

function parseBoundedDocument(html: string): DefaultTreeAdapterMap["document"] {
  let createdNodes = 0;
  const countNode = () => {
    createdNodes += 1;
    if (createdNodes > paperMemberDetailsLimits.maxHtmlNodes) {
      throw new Error("Paper Javadocs HTML exceeds the structure limit");
    }
  };
  const checkParentDepth = (parent: Node) => {
    let current: Node | null = parent;
    let depth = 0;
    while (current) {
      depth += 1;
      if (depth > paperMemberDetailsLimits.maxHtmlDepth) {
        throw new Error("Paper Javadocs HTML exceeds the structure limit");
      }
      current = "parentNode" in current ? current.parentNode : null;
    }
  };
  const treeAdapter: typeof defaultTreeAdapter = {
    ...defaultTreeAdapter,
    createElement(...args) {
      countNode();
      return defaultTreeAdapter.createElement(...args);
    },
    createCommentNode(...args) {
      countNode();
      return defaultTreeAdapter.createCommentNode(...args);
    },
    insertText(...args) {
      countNode();
      defaultTreeAdapter.insertText(...args);
    },
    insertTextBefore(...args) {
      countNode();
      defaultTreeAdapter.insertTextBefore(...args);
    },
    appendChild(parent, child) {
      checkParentDepth(parent);
      defaultTreeAdapter.appendChild(parent, child);
    },
    insertBefore(parent, child, reference) {
      checkParentDepth(parent);
      defaultTreeAdapter.insertBefore(parent, child, reference);
    },
  };
  return parse(html, { scriptingEnabled: false, treeAdapter });
}

function extractDetails(
  html: string,
  fragment: string,
): Omit<PaperMemberDetailsResult, "schemaVersion" | "version" | "member" | "source"> {
  const document = parseBoundedDocument(html);
  const pageElements = elements(document);
  const anchors = pageElements.filter(
    (node) =>
      attribute(node, "id") === fragment ||
      (node.tagName === "a" && attribute(node, "name") === fragment),
  );
  const empty: ReturnType<typeof extractDetails> = {
    status: "unavailable",
    unavailableReason: anchors.length === 0 ? "anchor-not-found" : "unsupported-format",
    format: null,
    declarationText: null,
    returnTypeText: null,
    parametersText: null,
    throwsText: null,
    descriptionText: null,
    deprecationText: null,
    notes: [],
    coverage: {
      extractionComplete: false,
      truncated: false,
      unavailableFields: ["member-details"],
      scope: "selected-declaration-documentation",
      nonClaims: [
        "Text and annotations are observed documentation, not inferred nullability, thread safety, or runtime behavior.",
        "Declaring-type documentation, linked pages, implementation source, and inherited documentation are not fetched.",
        "Versioned live Javadocs may change between Paper builds; this result identifies the retrieved page by time and hash.",
      ],
    },
  };
  if (anchors.length > 1) return { ...empty, unavailableReason: "ambiguous-anchor" };
  const anchor = anchors[0];
  if (!anchor) return empty;
  const modern = anchor.tagName === "section" && hasClass(anchor, "detail");
  const section = modern ? anchor : legacySection(anchor);
  if (!section) return empty;
  const sectionElements = elements(section);
  // A member body must not include another member's detail container or legacy anchor.
  if (
    sectionElements.some(
      (node) => node !== section && node.tagName === "section" && hasClass(node, "detail"),
    )
  )
    return empty;
  const declarations = sectionElements.filter((node) =>
    modern ? hasClass(node, "member-signature") : node.tagName === "pre",
  );
  if (declarations.length !== 1) return empty;
  const declaration = declarations[0];
  if (!declaration || !plainText(declaration)) return empty;
  const budget = new OutputBudget();
  const declarationElements = elements(declaration);
  const component = (name: string): string | null =>
    budget.node(declarationElements.find((node) => hasClass(node, name)));
  const declarationText = budget.node(declaration);
  const returnTypeText = component("return-type");
  const parametersText = component("parameters");
  const throwsText = component("exceptions");
  const descriptionText = budget.node(sectionElements.find((node) => hasClass(node, "block")));
  const deprecationText = budget.node(
    sectionElements.find(
      (node) => hasClass(node, "deprecation-block") || hasClass(node, "deprecationBlock"),
    ),
  );
  const notes: PaperMemberDetailsResult["notes"] = [];
  for (const list of sectionElements.filter(
    (node) => node.tagName === "dl" && (hasClass(node, "notes") || !modern),
  )) {
    let note: PaperMemberDetailsResult["notes"][number] | undefined;
    for (const node of children(list)) {
      if (!isElement(node)) continue;
      if (node.tagName === "dt") {
        if (notes.length >= paperMemberDetailsLimits.maxNotes) {
          budget.truncated = true;
          note = undefined;
          continue;
        }
        note = { label: budget.text(plainText(node)), entries: [] };
        notes.push(note);
      } else if (node.tagName === "dd" && note) {
        if (note.entries.length >= paperMemberDetailsLimits.maxNoteEntries) {
          budget.truncated = true;
          continue;
        }
        note.entries.push(budget.text(plainText(node)));
      }
    }
  }
  return {
    ...empty,
    status: "available",
    unavailableReason: null,
    format: modern ? "modern-section" : "legacy-block-list",
    declarationText,
    returnTypeText,
    parametersText,
    throwsText,
    descriptionText,
    deprecationText,
    notes,
    coverage: {
      ...empty.coverage,
      extractionComplete: !budget.truncated,
      truncated: budget.truncated,
      unavailableFields: modern ? [] : ["returnTypeText", "parametersText", "throwsText"],
    },
  };
}

export function validatePaperMemberDetailsOptions(options: PaperMemberDetailsOptions): number {
  if (!options || typeof options !== "object")
    throw new Error("Paper member details options must be an object");
  if (
    typeof options.memberUrl !== "string" ||
    options.memberUrl.length === 0 ||
    options.memberUrl.length > paperMemberDetailsLimits.maxUrlCharacters
  ) {
    throw new Error("Paper member details requires a bounded exact indexed memberUrl");
  }
  if (
    options.version !== undefined &&
    (typeof options.version !== "string" ||
      options.version.length === 0 ||
      options.version.length > 128)
  ) {
    throw new Error("Paper member details version must be a bounded nonempty string");
  }
  const timeout = options.timeoutMs ?? paperMemberDetailsLimits.defaultTimeoutMs;
  if (
    !Number.isSafeInteger(timeout) ||
    timeout < 100 ||
    timeout > paperMemberDetailsLimits.maxTimeoutMs
  ) {
    throw new Error("Paper member details timeoutMs must be an integer from 100 to 30000");
  }
  return timeout;
}

async function readPage(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const fail = (message: string): never => {
    void response.body?.cancel().catch(() => {});
    throw new Error(message);
  };
  if (response.redirected || (response.status >= 300 && response.status < 400))
    return fail("Paper Javadocs redirects are not permitted");
  if (!response.ok) return fail(`Paper Javadocs request failed with HTTP ${response.status}`);
  const contentType = response.headers.get("content-type");
  if (contentType && !/^text\/html(?:\s*;|\s*$)/iu.test(contentType))
    return fail("Paper Javadocs response must be HTML");
  const length = response.headers.get("content-length");
  if (
    length !== null &&
    (!/^\d+$/u.test(length) || Number(length) > paperMemberDetailsLimits.maxPageBytes)
  )
    return fail(
      "Paper Javadocs response exceeds the page byte limit or has invalid Content-Length",
    );
  if (!response.body) throw new Error("Paper Javadocs response has no body");
  const reader = response.body.getReader();
  const cancelOnAbort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancelOnAbort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > paperMemberDetailsLimits.maxPageBytes)
        throw new Error("Paper Javadocs response exceeds the page byte limit");
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener("abort", cancelOnAbort);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Internal entry point: callers bind options to an already validated exact-version surface. */
export async function fetchPaperMemberDetails(
  surface: PaperApiSurfaceData,
  options: PaperMemberDetailsOptions,
  fetchImpl: PaperMemberDetailsFetch = fetch,
  now: () => Date = () => new Date(),
): Promise<PaperMemberDetailsResult> {
  const timeoutMs = validatePaperMemberDetailsOptions(options);
  const matches = surface.members.filter((member) => member.url === options.memberUrl);
  if (matches.length !== 1)
    throw new Error(
      "Paper memberUrl must exactly match one member in the requested version's API surface; copy its URL from search_paper_members",
    );
  const member = matches[0];
  if (!member) throw new Error("Paper member URL is not indexed");
  const url = new URL(member.url);
  const base = new URL(surface.javadocsUrl);
  if (
    url.origin !== "https://jd.papermc.io" ||
    base.origin !== url.origin ||
    url.username ||
    url.password ||
    url.search ||
    !url.pathname.startsWith(`/paper/${surface.minecraftVersion}/`) ||
    !url.pathname.endsWith(".html") ||
    !url.hash
  ) {
    throw new Error("Indexed Paper member URL is not a version-bound official Javadocs member URL");
  }
  let fragment: string;
  try {
    fragment = decodeURIComponent(url.hash.slice(1));
  } catch {
    throw new Error("Indexed Paper member URL has an invalid fragment");
  }
  url.hash = "";
  const pageUrl = url.toString();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Paper Javadocs lookup timed out"));
    }, timeoutMs);
  });
  try {
    const operation = async () => {
      let response: Response;
      try {
        response = await fetchImpl(pageUrl, {
          redirect: "error",
          signal: controller.signal,
          headers: {
            Accept: "text/html",
            "User-Agent": "sya-ri/minecraft-skills (Paper member details)",
          },
        });
      } catch {
        throw new Error("Paper Javadocs request failed; no fallback version was used");
      }
      if (controller.signal.aborted) {
        void response.body?.cancel().catch(() => {});
        throw new Error("Paper Javadocs lookup timed out");
      }
      if (response.url && response.url !== pageUrl) {
        void response.body?.cancel().catch(() => {});
        throw new Error("Paper Javadocs response URL differs from the indexed page");
      }
      const bytes = await readPage(response, controller.signal);
      if (controller.signal.aborted) throw new Error("Paper Javadocs lookup timed out");
      let html: string;
      try {
        html = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new Error("Paper Javadocs response is not valid UTF-8");
      }
      return {
        schemaVersion: 1 as const,
        version: surface.minecraftVersion,
        member: { ...member },
        source: {
          kind: "official-live-javadocs" as const,
          url: member.url,
          pageUrl,
          retrievedAt: now().toISOString(),
          sha256: createHash("sha256").update(bytes).digest("hex"),
          bytes: bytes.byteLength,
        },
        ...extractDetails(html, fragment),
      };
    };
    return await Promise.race([operation(), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
  }
}
