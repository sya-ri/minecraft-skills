import { createHash } from "node:crypto";
import { extractJavadocMemberDetails, javadocMemberDetailsLimits } from "./javadocMemberDetails.js";
import type { PaperApiMemberData, PaperApiSurfaceData } from "./schemas.js";

/** Fixed ceilings for one indexed, official Javadocs page and its selected member. */
export const paperMemberDetailsLimits = javadocMemberDetailsLimits;

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
      const details = extractJavadocMemberDetails(html, fragment);
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
        ...details,
        coverage: {
          ...details.coverage,
          nonClaims: [
            "Text and annotations are observed documentation, not inferred nullability, thread safety, or runtime behavior.",
            "Declaring-type documentation, linked pages, implementation source, and inherited documentation are not fetched.",
            "Versioned live Javadocs may change between Paper builds; this result identifies the retrieved page by time and hash.",
          ],
        },
      };
    };
    return await Promise.race([operation(), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
  }
}
