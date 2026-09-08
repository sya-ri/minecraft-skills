import { type DefaultTreeAdapterMap, defaultTreeAdapter, parse } from "parse5";

/** Fixed ceilings for one indexed Javadocs page and its selected member. */
export const javadocMemberDetailsLimits = Object.freeze({
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

export type JavadocMemberDetailsExtraction = {
  status: "available" | "unavailable";
  unavailableReason: "anchor-not-found" | "ambiguous-anchor" | "unsupported-format" | null;
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
      count > javadocMemberDetailsLimits.maxHtmlNodes ||
      current.depth > javadocMemberDetailsLimits.maxHtmlDepth
    ) {
      throw new Error("Javadocs HTML exceeds the structure limit");
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
  remaining = javadocMemberDetailsLimits.maxOutputCharacters;
  truncated = false;

  text(value: string): string {
    const limit = Math.min(this.remaining, javadocMemberDetailsLimits.maxFieldCharacters);
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
    if (createdNodes > javadocMemberDetailsLimits.maxHtmlNodes) {
      throw new Error("Javadocs HTML exceeds the structure limit");
    }
  };
  const checkParentDepth = (parent: Node) => {
    let current: Node | null = parent;
    let depth = 0;
    while (current) {
      depth += 1;
      if (depth > javadocMemberDetailsLimits.maxHtmlDepth) {
        throw new Error("Javadocs HTML exceeds the structure limit");
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

export function extractJavadocMemberDetails(
  html: string,
  fragment: string,
): JavadocMemberDetailsExtraction {
  const document = parseBoundedDocument(html);
  const pageElements = elements(document);
  const anchors = pageElements.filter(
    (node) =>
      attribute(node, "id") === fragment ||
      (node.tagName === "a" && attribute(node, "name") === fragment),
  );
  const empty: JavadocMemberDetailsExtraction = {
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
  const notes: JavadocMemberDetailsExtraction["notes"] = [];
  for (const list of sectionElements.filter(
    (node) => node.tagName === "dl" && (hasClass(node, "notes") || !modern),
  )) {
    let note: JavadocMemberDetailsExtraction["notes"][number] | undefined;
    for (const node of children(list)) {
      if (!isElement(node)) continue;
      if (node.tagName === "dt") {
        if (notes.length >= javadocMemberDetailsLimits.maxNotes) {
          budget.truncated = true;
          note = undefined;
          continue;
        }
        note = { label: budget.text(plainText(node)), entries: [] };
        notes.push(note);
      } else if (node.tagName === "dd" && note) {
        if (note.entries.length >= javadocMemberDetailsLimits.maxNoteEntries) {
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
      extractionComplete: !budget.truncated,
      truncated: budget.truncated,
      unavailableFields: modern ? [] : ["returnTypeText", "parametersText", "throwsText"],
      scope: "selected-declaration-documentation",
    },
  };
}
