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

const sentinelIntermediary = {
  maven: "net.fabricmc:intermediary:0.0.0",
  version: "0.0.0",
  stable: true,
};

function loader(
  version: string,
  build: number,
  stable: boolean,
  pairedIntermediary = intermediary,
) {
  return {
    loader: {
      separator: "+build.",
      build,
      maven: `net.fabricmc:fabric-loader:${version}`,
      version,
      stable,
    },
    intermediary: pairedIntermediary,
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
    expect(result.recommendedLoader?.version).toBe("0.16.9");
    expect(result.mappingMode).toBe("intermediary-yarn");
    expect(result.mappingsRequired).toBe(true);
    expect(result.loomPluginId).toBe("net.fabricmc.fabric-loom-remap");
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

  it("keeps legacy versions incomplete without Yarn while still recommending Loader", async () => {
    const result = await getFabricToolchainCompatibility(
      { gameVersion: "1.21.11" },
      fixtureFetch({
        loaders: [loader("0.17.0", 17, true, sentinelIntermediary)],
        yarnMappings: [],
        intermediaries: [sentinelIntermediary],
      }),
    );
    expect(result.recommended).toBeNull();
    expect(result.recommendedLoader?.version).toBe("0.17.0");
    expect(result.tuples).toEqual([]);
    expect(result.mappingMode).toBe("intermediary-yarn");
    expect(result.mappingsRequired).toBe(true);
    expect(result.loomPluginId).toBe("net.fabricmc.fabric-loom-remap");
    expect(result.notes.join(" ")).toContain("no Yarn mappings");
    expect(result.candidates.intermediaries[0]?.version).toBe("0.0.0");
    expect(result.notes.join(" ")).toContain("different from the requested game version");
  });

  it("uses the maintained no-remap policy for Minecraft 26.1 and newer", async () => {
    const result = await getFabricToolchainCompatibility(
      { gameVersion: "26.2" },
      fixtureFetch({
        loaders: [loader("0.19.5", 19, true, sentinelIntermediary)],
        yarnMappings: [],
        intermediaries: [sentinelIntermediary],
      }),
    );

    expect(result.mappingPolicy).toEqual({
      kind: "maintained-official-documentation",
      coverage: "covered",
      unobfuscatedSince: "26.1",
      unobfuscatedWeeklySnapshotSince: "26w14a",
      documentation: {
        mappings: "https://docs.fabricmc.net/develop/porting/mappings",
        loom: "https://docs.fabricmc.net/develop/loom",
        versionNormalization: "https://docs.fabricmc.net/develop/loader/fabric-mod-json",
      },
    });
    expect(result.mappingMode).toBe("unobfuscated");
    expect(result.mappingsRequired).toBe(false);
    expect(result.loomPluginId).toBe("net.fabricmc.fabric-loom");
    expect(result.recommendedLoader?.version).toBe("0.19.5");
    expect(result.recommended).toBeNull();
    expect(result.tuples).toEqual([]);
    expect(result.counts.possibleTuples).toBe(0);
    expect(result.notes.join(" ")).not.toContain("complete Loader + Intermediary + Yarn");
    expect(result.notes.join(" ")).toContain("their values do not decide the mapping mode");
  });

  it("applies the no-remap policy to date-based and post-transition weekly identifiers", async () => {
    for (const gameVersion of [
      "26.1.2",
      "26.1-snapshot-1",
      "26.1-pre-1",
      "26w14a",
      "26w14b",
      "27w01a",
    ]) {
      const result = await getFabricToolchainCompatibility(
        { gameVersion },
        fixtureFetch({
          loaders: [loader("0.19.5", 19, true, sentinelIntermediary)],
          yarnMappings: [],
          intermediaries: [sentinelIntermediary],
        }),
      );
      expect(result.mappingMode).toBe("unobfuscated");
    }
  });

  it("keeps pre-26.1 versions mapped even when Meta returns the sentinel Intermediary", async () => {
    for (const gameVersion of ["26.0", "25w45a"]) {
      const result = await getFabricToolchainCompatibility(
        { gameVersion },
        fixtureFetch({
          loaders: [loader("0.19.5", 19, true, sentinelIntermediary)],
          yarnMappings: [],
          intermediaries: [sentinelIntermediary],
        }),
      );

      expect(result.mappingMode).toBe("intermediary-yarn");
      expect(result.mappingsRequired).toBe(true);
      expect(result.loomPluginId).toBe("net.fabricmc.fabric-loom-remap");
    }
  });

  it("does not assert mapping requirements for uncovered pre-boundary 26w identifiers", async () => {
    for (const gameVersion of ["26w01a", "26w13a"]) {
      const result = await getFabricToolchainCompatibility(
        { gameVersion },
        fixtureFetch({
          loaders: [loader("0.19.5", 19, true, sentinelIntermediary)],
          yarnMappings: [],
          intermediaries: [sentinelIntermediary],
        }),
      );
      expect(result.mappingMode).toBe("unknown");
      expect(result.mappingPolicy.coverage).toBe("unknown");
      expect(result.mappingsRequired).toBeNull();
      expect(result.loomPluginId).toBeNull();
      expect(result.recommendedLoader?.version).toBe("0.19.5");
      expect(result.notes.join(" ")).toContain("need additional official normalization evidence");
    }
  });

  it("keeps a no-remap Loader recommendation when supplemental endpoints are unavailable", async () => {
    const result = await getFabricToolchainCompatibility({ gameVersion: "26w14a" }, async (url) =>
      url.includes("/loader/")
        ? response([loader("0.19.5", 19, true, sentinelIntermediary)])
        : new Response("gone", { status: 404, statusText: "Not Found" }),
    );

    expect(result.mappingMode).toBe("unobfuscated");
    expect(result.recommendedLoader?.version).toBe("0.19.5");
    expect(result.source.endpointAvailability).toEqual({
      loader: "available",
      yarn: "unavailable",
      intermediary: "unavailable",
    });
    expect(result.candidates.yarnMappings).toEqual([]);
    expect(result.candidates.intermediaries).toEqual([]);
    expect(result.notes.join(" ")).toContain(
      "supplemental Fabric Meta yarn endpoint was unavailable",
    );
    expect(result.notes.join(" ")).toContain(
      "supplemental Fabric Meta intermediary endpoint was unavailable",
    );
  });

  it.each([
    { init: { status: 404 }, expected: "404", cancellation: "complete" },
    {
      init: { headers: { "Content-Length": "invalid" } },
      expected: "invalid Content-Length header",
      cancellation: "reject",
    },
    {
      init: { headers: { "Content-Length": String(1024 * 1024 + 1) } },
      expected: "exceeds the 1048576 byte limit",
      cancellation: "hang",
    },
  ])("cancels rejected supplemental response bodies without replacing $expected", async ({
    init,
    expected,
    cancellation,
  }) => {
    const cancel = vi.fn(() => {
      if (cancellation === "reject") {
        return Promise.reject(new Error("cleanup failed"));
      }
      if (cancellation === "hang") {
        return new Promise<void>(() => {});
      }
    });
    const requests: RequestInit[] = [];
    const result = await getFabricToolchainCompatibility(
      { gameVersion: "26.2", timeoutMs: 100 },
      async (url, requestInit) => {
        if (requestInit !== undefined) {
          requests.push(requestInit);
        }
        if (url.includes("/loader/")) {
          return response([loader("0.19.5", 19, true, sentinelIntermediary)]);
        }
        if (url.includes("/yarn/")) {
          return new Response(new ReadableStream<Uint8Array>({ cancel }), init);
        }
        return response([sentinelIntermediary]);
      },
    );

    expect(result.recommendedLoader?.version).toBe("0.19.5");
    expect(result.source.endpointAvailability.yarn).toBe("unavailable");
    expect(result.notes.join(" ")).toContain(expected);
    expect(result.notes.join(" ")).not.toContain("cleanup failed");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(requests.every((request) => request.signal?.aborted)).toBe(true);
  });

  it("keeps a no-remap Loader recommendation when supplemental endpoints time out", async () => {
    vi.useFakeTimers();
    let abortedSupplementalRequests = 0;
    const fetchImpl: FabricMetaFetch = async (url, init) => {
      if (url.includes("/loader/")) {
        return response([loader("0.19.5", 19, true, sentinelIntermediary)]);
      }
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            abortedSupplementalRequests += 1;
            reject(new DOMException("aborted", "AbortError"));
          },
          { once: true },
        );
      });
    };

    const lookup = getFabricToolchainCompatibility(
      { gameVersion: "26w14a", timeoutMs: 100 },
      fetchImpl,
    );
    await vi.advanceTimersByTimeAsync(100);
    const result = await lookup;

    expect(result.recommendedLoader?.version).toBe("0.19.5");
    expect(result.source.endpointAvailability).toEqual({
      loader: "available",
      yarn: "unavailable",
      intermediary: "unavailable",
    });
    expect(result.notes.join(" ")).toContain(
      "supplemental Fabric Meta yarn endpoint was unavailable",
    );
    expect(result.notes.join(" ")).toContain("did not finish before the 100 millisecond deadline");
    expect(abortedSupplementalRequests).toBe(2);
  });

  it("releases and cancels an oversized supplemental stream", async () => {
    const cancel = vi.fn();
    const result = await getFabricToolchainCompatibility({ gameVersion: "26.2" }, async (url) => {
      if (url.includes("/loader/")) {
        return response([loader("0.19.5", 19, true, sentinelIntermediary)]);
      }
      if (url.includes("/yarn/")) {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(1024 * 1024 + 1));
            },
            cancel,
          }),
        );
      }
      return response([sentinelIntermediary]);
    });

    expect(result.recommendedLoader?.version).toBe("0.19.5");
    expect(result.source.endpointAvailability.yarn).toBe("unavailable");
    expect(result.notes.join(" ")).toContain("exceeds the 1048576 byte limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("omits invalid supplemental data without discarding a no-remap Loader result", async () => {
    const result = await getFabricToolchainCompatibility(
      { gameVersion: "26.2" },
      fixtureFetch({
        loaders: [loader("0.19.5", 19, true, sentinelIntermediary)],
        yarnMappings: [yarn(1, true)],
        intermediaries: [intermediary],
      }),
    );

    expect(result.recommendedLoader?.version).toBe("0.19.5");
    expect(result.source.endpointAvailability).toEqual({
      loader: "available",
      yarn: "unavailable",
      intermediary: "unavailable",
    });
    expect(result.candidates.yarnMappings).toEqual([]);
    expect(result.candidates.intermediaries).toEqual([]);
    expect(result.notes.join(" ")).toContain("does not match requested game version 26.2");
    expect(result.notes.join(" ")).toContain("responses are inconsistent for intermediary");
  });

  it("preserves a completed supplemental response when another ignores the abort signal", async () => {
    vi.useFakeTimers();
    const fetchImpl: FabricMetaFetch = async (url) => {
      if (url.includes("/loader/")) {
        return response([loader("0.19.5", 19, true, sentinelIntermediary)]);
      }
      if (url.includes("/intermediary/")) {
        return response([sentinelIntermediary]);
      }
      return new Promise(() => {});
    };
    const lookup = getFabricToolchainCompatibility(
      { gameVersion: "26.2", timeoutMs: 100 },
      fetchImpl,
    );
    await vi.advanceTimersByTimeAsync(100);
    const result = await lookup;

    expect(result.recommendedLoader?.version).toBe("0.19.5");
    expect(result.source.endpointAvailability).toEqual({
      loader: "available",
      yarn: "unavailable",
      intermediary: "available",
    });
    expect(result.candidates.intermediaries).toEqual([sentinelIntermediary]);
  });

  it("still rejects a no-remap Loader failure while cancelling supplemental requests", async () => {
    const fetchImpl: FabricMetaFetch = async (url, init) => {
      if (url.includes("/loader/")) {
        return new Response("down", { status: 503, statusText: "Service Unavailable" });
      }
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    };
    await expect(
      getFabricToolchainCompatibility({ gameVersion: "26.2" }, fetchImpl),
    ).rejects.toThrow("Fabric Meta loader request failed: 503 Service Unavailable");
  });

  it("still requires mapping endpoints for legacy versions", async () => {
    await expect(
      getFabricToolchainCompatibility({ gameVersion: "1.21.11" }, async (url) => {
        if (url.includes("/loader/")) {
          return response([loader("0.17.0", 17, true)]);
        }
        if (url.includes("/yarn/")) {
          return new Response("gone", { status: 404, statusText: "Not Found" });
        }
        return response([intermediary]);
      }),
    ).rejects.toThrow(
      "Fabric Meta yarn endpoint rejected Minecraft game version 1.21.11: 404 Not Found",
    );
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

  it.each([
    "1.21.11",
    "26.2",
  ])("aborts a %s lookup when Loader exceeds the timeout", async (gameVersion) => {
    vi.useFakeTimers();
    const fetchImpl: FabricMetaFetch = async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    const lookup = getFabricToolchainCompatibility({ gameVersion, timeoutMs: 100 }, fetchImpl);
    const rejection = expect(lookup).rejects.toThrow("timed out after 100 milliseconds");
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
  });
});
