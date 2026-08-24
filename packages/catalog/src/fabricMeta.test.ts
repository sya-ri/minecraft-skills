import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFabricMetaVersionUrl,
  type FabricMetaFetch,
  getFabricToolchainCompatibility,
} from "./fabricMeta.js";

const intermediary = {
  maven: "net.fabricmc:intermediary:1.21.11",
  version: "1.21.11",
  stable: true,
};

function loader(version: string, build: number, stable: boolean) {
  return {
    loader: {
      separator: "+build.",
      build,
      maven: `net.fabricmc:fabric-loader:${version}`,
      version,
      stable,
    },
    intermediary,
  };
}

function yarn(build: number, stable: boolean) {
  const version = `1.21.11+build.${build}`;
  return {
    gameVersion: "1.21.11",
    separator: "+build.",
    build,
    maven: `net.fabricmc:yarn:${version}`,
    version,
    stable,
  };
}

function response(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function fixtureFetch(options: {
  loaders?: unknown;
  yarnMappings?: unknown;
  intermediaries?: unknown;
  requests?: Array<{ url: string; init?: RequestInit }>;
}): FabricMetaFetch {
  return async (url, init) => {
    options.requests?.push({ url, ...(init ? { init } : {}) });
    if (url.includes("/loader/")) {
      return response(options.loaders ?? []);
    }
    if (url.includes("/yarn/")) {
      return response(options.yarnMappings ?? []);
    }
    return response(options.intermediaries ?? []);
  };
}

describe("Fabric Meta toolchain lookup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("URL-encodes the complete Minecraft game version path segment", () => {
    expect(buildFabricMetaVersionUrl("loader", "1.14 Pre-Release 5/rc")).toBe(
      "https://meta.fabricmc.net/v2/versions/loader/1.14%20Pre-Release%205%2Frc",
    );
  });

  it("prefers upstream stable entries while preserving bounded newest-first candidates", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await getFabricToolchainCompatibility(
      { gameVersion: "1.21.11", limit: 2 },
      fixtureFetch({
        loaders: [loader("0.17.0", 17, false), loader("0.16.9", 16, true)],
        yarnMappings: [yarn(2, false), yarn(1, true)],
        intermediaries: [intermediary],
        requests,
      }),
    );

    expect(result.recommended?.loader.version).toBe("0.16.9");
    expect(result.recommended?.yarn.version).toBe("1.21.11+build.1");
    expect(result.candidates.loaderPairs.map((entry) => entry.loader.version)).toEqual([
      "0.17.0",
      "0.16.9",
    ]);
    expect(result.counts).toEqual({
      loaderPairs: 2,
      intermediaries: 1,
      yarnMappings: 2,
      possibleTuples: 4,
    });
    expect(result.tuples).toHaveLength(2);
    expect(result.truncated.tuples).toBe(true);
    expect(result.selection.meaning).toContain("not an expanded compatibility guarantee");
    expect(requests).toHaveLength(3);
    expect(requests.every(({ init }) => init?.signal instanceof AbortSignal)).toBe(true);
    expect(new Headers(requests[0]?.init?.headers).get("User-Agent")).toContain("minecraft-skills");
  });

  it("falls back to the first newest-first entries when none are stable", async () => {
    const result = await getFabricToolchainCompatibility(
      { gameVersion: "1.21.11" },
      fixtureFetch({
        loaders: [loader("0.17.0", 17, false), loader("0.16.9", 16, false)],
        yarnMappings: [yarn(2, false), yarn(1, false)],
        intermediaries: [intermediary],
      }),
    );
    expect(result.recommended?.loader.version).toBe("0.17.0");
    expect(result.recommended?.yarn.version).toBe("1.21.11+build.2");
  });

  it("reports an incomplete result when Fabric Meta has no Yarn mappings", async () => {
    const sentinelIntermediary = {
      maven: "net.fabricmc:intermediary:0.0.0",
      version: "0.0.0",
      stable: true,
    };
    const result = await getFabricToolchainCompatibility(
      { gameVersion: "1.21.11" },
      fixtureFetch({
        loaders: [
          {
            ...loader("0.17.0", 17, true),
            intermediary: sentinelIntermediary,
          },
        ],
        yarnMappings: [],
        intermediaries: [sentinelIntermediary],
      }),
    );
    expect(result.recommended).toBeNull();
    expect(result.tuples).toEqual([]);
    expect(result.notes.join(" ")).toContain("no Yarn mappings");
    expect(result.candidates.intermediaries[0]?.version).toBe("0.0.0");
    expect(result.notes.join(" ")).toContain("different from the requested game version");
  });

  it("distinguishes a missing game version from an incomplete toolchain", async () => {
    await expect(
      getFabricToolchainCompatibility({ gameVersion: "missing-version" }, fixtureFetch({})),
    ).rejects.toThrow("no entries for Minecraft game version missing-version");

    await expect(
      getFabricToolchainCompatibility(
        { gameVersion: "missing-version" },
        async () => new Response("bad version", { status: 400, statusText: "Bad Request" }),
      ),
    ).rejects.toThrow("endpoint rejected Minecraft game version missing-version: 400 Bad Request");
  });

  it("rejects mismatched and malformed upstream response fields", async () => {
    await expect(
      getFabricToolchainCompatibility(
        { gameVersion: "1.21.11" },
        fixtureFetch({
          loaders: [loader("0.17.0", 17, true)],
          yarnMappings: [{ ...yarn(1, true), gameVersion: "1.21.10" }],
          intermediaries: [intermediary],
        }),
      ),
    ).rejects.toThrow("does not match requested game version 1.21.11");

    await expect(
      getFabricToolchainCompatibility(
        { gameVersion: "1.21.11" },
        fixtureFetch({
          loaders: [
            {
              ...loader("0.17.0", 17, true),
              loader: {
                ...loader("0.17.0", 17, true).loader,
                build: 2_147_483_648,
              },
            },
          ],
          yarnMappings: [yarn(1, true)],
          intermediaries: [intermediary],
        }),
      ),
    ).rejects.toThrow("loader[0].loader.build must be an integer between 0 and 2147483647");

    await expect(
      getFabricToolchainCompatibility(
        { gameVersion: "1.21.11" },
        fixtureFetch({
          loaders: [loader("0.17.0", 17, true)],
          yarnMappings: [yarn(1, true), { ...yarn(1, true), stable: false }],
          intermediaries: [intermediary],
        }),
      ),
    ).rejects.toThrow("conflicting duplicate Yarn entries");
  });

  it("rejects inconsistent intermediary data across official endpoints", async () => {
    await expect(
      getFabricToolchainCompatibility(
        { gameVersion: "1.21.11" },
        fixtureFetch({
          loaders: [loader("0.17.0", 17, true)],
          yarnMappings: [yarn(1, true)],
          intermediaries: [
            {
              ...intermediary,
              maven: "net.fabricmc:intermediary:1.21.10",
              version: "1.21.10",
            },
          ],
        }),
      ),
    ).rejects.toThrow("responses are inconsistent");

    await expect(
      getFabricToolchainCompatibility(
        { gameVersion: "1.21.11" },
        fixtureFetch({
          loaders: [loader("0.17.0", 17, true)],
          yarnMappings: [yarn(1, true)],
          intermediaries: [{ ...intermediary, stable: false }],
        }),
      ),
    ).rejects.toThrow("contradictory stable flags for intermediary");

    await expect(
      getFabricToolchainCompatibility(
        { gameVersion: "1.21.11" },
        fixtureFetch({
          loaders: [loader("0.17.0", 17, true)],
          yarnMappings: [yarn(1, true)],
          intermediaries: [intermediary, { ...intermediary, stable: false }],
        }),
      ),
    ).rejects.toThrow("intermediary response contains contradictory stable flags");

    await expect(
      getFabricToolchainCompatibility(
        { gameVersion: "1.21.11" },
        fixtureFetch({
          loaders: [loader("0.17.0", 17, true)],
          yarnMappings: [yarn(1, true)],
          intermediaries: [
            intermediary,
            {
              maven: "net.fabricmc:intermediary:1.21.10",
              version: "1.21.10",
              stable: true,
            },
          ],
        }),
      ),
    ).rejects.toThrow("multiple distinct candidates; expected at most one");
  });

  it("allows the standalone intermediary endpoint to return no candidate", async () => {
    const result = await getFabricToolchainCompatibility(
      { gameVersion: "1.21.11" },
      fixtureFetch({
        loaders: [loader("0.17.0", 17, true)],
        yarnMappings: [yarn(1, true)],
        intermediaries: [],
      }),
    );

    expect(result.recommended?.intermediary).toEqual(intermediary);
    expect(result.counts.intermediaries).toBe(0);
    expect(result.notes.join(" ")).toContain("could not be independently cross-checked");
  });

  it("rejects oversized response headers before parsing", async () => {
    const fetchImpl: FabricMetaFetch = async (url) => {
      if (url.includes("/loader/")) {
        return new Response("[]", {
          status: 200,
          headers: { "Content-Length": String(1024 * 1024 + 1) },
        });
      }
      return response([]);
    };
    await expect(
      getFabricToolchainCompatibility({ gameVersion: "1.21.11" }, fetchImpl),
    ).rejects.toThrow("response exceeds the 1048576 byte limit");
  });

  it("stops reading an oversized response when Content-Length is absent", async () => {
    const oversizedBody = `"${"x".repeat(1024 * 1024)}"`;
    const fetchImpl: FabricMetaFetch = async (url) =>
      url.includes("/loader/") ? new Response(oversizedBody) : response([]);
    await expect(
      getFabricToolchainCompatibility({ gameVersion: "1.21.11" }, fetchImpl),
    ).rejects.toThrow("response exceeds the 1048576 byte limit");
  });

  it("rejects a response with more than 10000 entries before validating entries", async () => {
    const fetchImpl: FabricMetaFetch = async (url) =>
      url.includes("/loader/")
        ? response(Array.from({ length: 10_001 }, () => null))
        : response([]);
    await expect(
      getFabricToolchainCompatibility({ gameVersion: "1.21.11" }, fetchImpl),
    ).rejects.toThrow("loader response exceeds the 10000 entry limit");
  });

  it("rejects an invalid Content-Length header", async () => {
    const fetchImpl: FabricMetaFetch = async (url) =>
      url.includes("/loader/")
        ? new Response("[]", { headers: { "Content-Length": "not-a-number" } })
        : response([]);
    await expect(
      getFabricToolchainCompatibility({ gameVersion: "1.21.11" }, fetchImpl),
    ).rejects.toThrow("loader response has an invalid Content-Length header");
  });

  it("rejects invalid UTF-8 before attempting to parse JSON", async () => {
    const fetchImpl: FabricMetaFetch = async (url) =>
      url.includes("/loader/") ? new Response(new Uint8Array([0xc3, 0x28])) : response([]);
    await expect(
      getFabricToolchainCompatibility({ gameVersion: "1.21.11" }, fetchImpl),
    ).rejects.toThrow("loader response is not valid UTF-8");
  });

  it("rejects invalid JSON", async () => {
    const fetchImpl: FabricMetaFetch = async (url) =>
      url.includes("/loader/") ? new Response("{") : response([]);
    await expect(
      getFabricToolchainCompatibility({ gameVersion: "1.21.11" }, fetchImpl),
    ).rejects.toThrow("loader response is not valid JSON");
  });

  it("aborts a lookup that exceeds the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl: FabricMetaFetch = async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    const lookup = getFabricToolchainCompatibility(
      { gameVersion: "1.21.11", timeoutMs: 100 },
      fetchImpl,
    );
    const rejection = expect(lookup).rejects.toThrow("timed out after 100 milliseconds");
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
  });
});
