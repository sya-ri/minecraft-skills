import { describe, expect, it } from "vitest";
import {
  type ModrinthCompatibilityFetch,
  type ModrinthCompatibilityFetchResponse,
  modrinthCompatibilityLimits,
  resolveModrinthCompatibility,
} from "./modrinthCompatibility.js";

function version(
  id: string,
  projectId: string,
  datePublished: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    project_id: projectId,
    version_number: id,
    version_type: "release",
    featured: false,
    date_published: datePublished,
    game_versions: ["1.21.1"],
    loaders: ["fabric"],
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function projectRequest(url: string): { action: "check" | "version"; project: string } {
  const match = /^\/v2\/project\/([^/]+)\/(check|version)$/.exec(new URL(url).pathname);
  if (!match?.[1] || (match[2] !== "check" && match[2] !== "version")) {
    throw new Error(`Unexpected Modrinth fixture URL: ${url}`);
  }
  return { action: match[2], project: decodeURIComponent(match[1]) };
}

function defaultCanonicalProjectId(project: string): string {
  return `id-${project.replace(/[^A-Za-z0-9]+/g, "-")}`;
}

function checkedFetch(
  versionsFor: (
    canonicalProjectId: string,
    url: string,
    init: RequestInit | undefined,
  ) => ModrinthCompatibilityFetchResponse | Promise<ModrinthCompatibilityFetchResponse>,
  canonicalize: (project: string) => string = defaultCanonicalProjectId,
): ModrinthCompatibilityFetch {
  return async (url, init) => {
    const request = projectRequest(url);
    if (request.action === "check") {
      return jsonResponse({ id: canonicalize(request.project) });
    }
    return versionsFor(request.project, url, init);
  };
}

describe("Modrinth compatibility resolver", () => {
  it("keeps its public safety limits immutable at runtime", () => {
    expect(Object.isFrozen(modrinthCompatibilityLimits)).toBe(true);
    const original = modrinthCompatibilityLimits.maxProjects;
    expect(
      Reflect.set(
        modrinthCompatibilityLimits as unknown as Record<string, unknown>,
        "maxProjects",
        1_000,
      ),
    ).toBe(false);
    expect(modrinthCompatibilityLimits.maxProjects).toBe(original);
  });

  it("resolves deterministic metadata intersections and latest published candidates", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const result = await resolveModrinthCompatibility(
      {
        projects: [" alpha/project ", "beta", "beta"],
        gameVersion: "1.21.1",
        loader: "fabric",
        limit: 1,
      },
      async (url, init) => {
        calls.push({ url, init });
        const request = projectRequest(url);
        if (request.action === "check") {
          return jsonResponse({ id: defaultCanonicalProjectId(request.project) });
        }
        if (request.project.includes("alpha")) {
          return jsonResponse([
            version("alpha-old", request.project, "2026-01-01T00:00:00Z"),
            version("alpha-new", request.project, "2026-03-01T00:00:00Z", {
              version_type: "alpha",
              game_versions: ["1.21.1", "1.21.2"],
              loaders: ["fabric", "quilt"],
            }),
          ]);
        }
        return jsonResponse([
          version("beta-new", request.project, "2026-02-01T00:00:00Z", {
            featured: true,
            game_versions: ["1.21.1", "1.21.2"],
            loaders: ["fabric", "quilt"],
          }),
        ]);
      },
    );

    expect(result.requestsComplete).toBe(true);
    expect(result.outcome).toBe("compatible");
    expect(result.requestedProjectCount).toBe(3);
    expect(result.duplicateProjectsRemoved).toBe(1);
    expect(result.projects.map((project) => project.project)).toEqual(["alpha/project", "beta"]);
    expect(result.projects[0]?.selectedVersion?.id).toBe("alpha-new");
    expect(result.projects[0]?.selectedVersion?.versionType).toBe("alpha");
    expect(result.projects[0]?.selectionBasis).toBe("latest-date-published-after-filters");
    expect(result.projects[0]?.candidatesTruncated).toBe(true);
    expect(result.metadataIntersection.gameVersions.values).toEqual(["1.21.1"]);
    expect(result.metadataIntersection.loaders.values).toEqual(["fabric"]);
    expect(result.commonPairs).toMatchObject({
      status: "computed",
      total: 1,
      pairs: [
        {
          gameVersion: "1.21.1",
          loader: "fabric",
          projects: [
            { project: "alpha/project", version: { id: "alpha-new" } },
            { project: "beta", version: { id: "beta-new" } },
          ],
        },
      ],
    });
    expect(calls).toHaveLength(4);
    const checkCalls = calls.filter((call) => call.url.includes("/check"));
    const versionCalls = calls.filter((call) => call.url.includes("/version"));
    expect(checkCalls[0]?.url).toContain("/project/alpha%2Fproject/check");
    expect(versionCalls[0]?.url).toContain("/project/id-alpha-project/version");
    expect(versionCalls[0]?.url).toContain("game_versions=%5B%221.21.1%22%5D");
    expect(versionCalls[0]?.url).toContain("loaders=%5B%22fabric%22%5D");
    expect(versionCalls[0]?.url).toContain("include_changelog=false");
    expect(new Headers(versionCalls[0]?.init?.headers).get("User-Agent")).toContain(
      "minecraft-skills",
    );
    expect(result.notes.join(" ")).toContain("do not prove");
  });

  it("reports empty filtered projects without inventing fallback versions", async () => {
    const result = await resolveModrinthCompatibility(
      { projects: ["alpha", "beta"], loader: "neoforge", featured: true },
      checkedFetch((projectId) =>
        jsonResponse([version("fabric", projectId, "2026-01-01T00:00:00Z", { featured: true })]),
      ),
    );

    expect(result.requestsComplete).toBe(true);
    expect(result.outcome).toBe("no-common-pair");
    expect(result.projects.every((project) => project.status === "no-matching-versions")).toBe(
      true,
    );
    expect(result.projects[0]?.reason).toContain("matched all requested metadata filters");
    expect(result.metadataIntersection.status).toBe("computed");
    expect(result.metadataIntersection.loaders.values).toEqual([]);
  });

  it("canonicalizes and deduplicates aliases before filtered version requests", async () => {
    const calls: string[] = [];
    const aliases = new Map([
      ["sodium", "AANobbMI"],
      ["AANobbMI", "AANobbMI"],
      ["iris", "YL57xq9U"],
    ]);
    const result = await resolveModrinthCompatibility(
      { projects: ["sodium", "AANobbMI", "iris"], loader: "neoforge" },
      async (url) => {
        calls.push(url);
        const request = projectRequest(url);
        return request.action === "check"
          ? jsonResponse({ id: aliases.get(request.project) })
          : jsonResponse([]);
      },
    );

    expect(result.projectCount).toBe(2);
    expect(result.duplicateProjectsRemoved).toBe(1);
    expect(result.projects.map((project) => project.project)).toEqual(["sodium", "iris"]);
    expect(result.projects.map((project) => project.canonicalProjectId)).toEqual([
      "AANobbMI",
      "YL57xq9U",
    ]);
    expect(result.outcome).toBe("no-common-pair");
    expect(calls.filter((url) => url.includes("/version"))).toHaveLength(2);
    expect(calls.some((url) => url.includes("/project/AANobbMI/version"))).toBe(true);
  });

  it("rejects aliases that leave fewer than two distinct canonical projects", async () => {
    const calls: string[] = [];
    await expect(
      resolveModrinthCompatibility({ projects: ["sodium", "AANobbMI"] }, async (url) => {
        calls.push(url);
        return jsonResponse({ id: "AANobbMI" });
      }),
    ).rejects.toThrow("two distinct resolved projects");
    expect(calls).toHaveLength(2);
    expect(calls.every((url) => url.includes("/check"))).toBe(true);
  });

  it("makes compatibility indeterminate when canonical lookup fails", async () => {
    const calls: string[] = [];
    const result = await resolveModrinthCompatibility(
      { projects: ["available", "missing"], loader: "fabric" },
      async (url) => {
        calls.push(url);
        const request = projectRequest(url);
        if (request.action === "check") {
          return request.project === "missing"
            ? jsonResponse({ error: "not found" }, 404)
            : jsonResponse({ id: "available-id" });
        }
        return jsonResponse([version("available", request.project, "2026-01-01T00:00:00Z")]);
      },
    );

    expect(result.requestsComplete).toBe(false);
    expect(result.outcome).toBe("indeterminate");
    expect(result.projects[1]).toMatchObject({
      canonicalProjectId: null,
      versionsRequestUrl: null,
      status: "request-failed",
      failurePhase: "project-check",
      httpStatus: 404,
      reason: "Modrinth returned HTTP 404.",
    });
    expect(result.metadataIntersection).toMatchObject({
      status: "indeterminate",
      gameVersions: { values: [] },
      loaders: { values: [] },
    });
    expect(calls.some((url) => url.includes("/project/missing/version"))).toBe(false);
  });

  it("validates canonical lookup and version response schemas", async () => {
    const invalidCanonical = await resolveModrinthCompatibility(
      { projects: ["valid", "invalid"] },
      async (url) => {
        const request = projectRequest(url);
        if (request.action === "check") {
          return request.project === "invalid"
            ? jsonResponse({ slug: "invalid" })
            : jsonResponse({ id: "valid-id" });
        }
        return jsonResponse([version("valid", request.project, "2026-01-01T00:00:00Z")]);
      },
    );
    expect(invalidCanonical.projects[1]).toMatchObject({
      status: "invalid-response",
      failurePhase: "project-check",
      httpStatus: 200,
    });
    expect(invalidCanonical.projects[1]?.reason).toContain("Project check id");

    const invalidVersion = await resolveModrinthCompatibility(
      { projects: ["valid", "invalid"] },
      checkedFetch((projectId) =>
        projectId.includes("invalid")
          ? jsonResponse([version("bad", projectId, "not-a-date")])
          : jsonResponse([version("valid", projectId, "2026-01-01T00:00:00Z")]),
      ),
    );
    expect(invalidVersion.projects[1]?.status).toBe("invalid-response");
    expect(invalidVersion.projects[1]?.failurePhase).toBe("versions");
    expect(invalidVersion.projects[1]?.httpStatus).toBe(200);
    expect(invalidVersion.projects[1]?.reason).toContain("date_published");
  });

  it("preserves HTTP status for invalid JSON responses", async () => {
    const result = await resolveModrinthCompatibility(
      { projects: ["valid", "invalid-json"] },
      async (url) => {
        const request = projectRequest(url);
        if (request.action === "check") {
          return request.project === "invalid-json"
            ? new Response("{", { status: 200 })
            : jsonResponse({ id: "valid-id" });
        }
        return jsonResponse([version("valid", request.project, "2026-01-01T00:00:00Z")]);
      },
    );

    expect(result.projects[1]).toMatchObject({
      status: "invalid-response",
      failurePhase: "project-check",
      httpStatus: 200,
      reason: "Response was not valid UTF-8 JSON.",
    });
  });

  it("bounds project check and version response bodies", async () => {
    const oversizedResponse = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-length"
            ? String(modrinthCompatibilityLimits.maxResponseBytes + 1)
            : null,
      },
    });
    const oversizedVersions = await resolveModrinthCompatibility(
      { projects: ["large", "also-large"] },
      checkedFetch(oversizedResponse),
    );
    expect(
      oversizedVersions.projects.every((project) => project.status === "invalid-response"),
    ).toBe(true);
    expect(oversizedVersions.projects[0]?.reason).toContain("byte limit");

    const oversizedChecks = await resolveModrinthCompatibility(
      { projects: ["large", "also-large"] },
      oversizedResponse,
    );
    expect(
      oversizedChecks.projects.every(
        (project) =>
          project.failurePhase === "project-check" && project.status === "invalid-response",
      ),
    ).toBe(true);
  });

  it("enforces streamed response bounds when content-length is unavailable", async () => {
    const result = await resolveModrinthCompatibility(
      { projects: ["large", "also-large"] },
      checkedFetch(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(modrinthCompatibilityLimits.maxResponseBytes));
            controller.enqueue(new Uint8Array(1));
            controller.close();
          },
        }),
      })),
    );

    expect(result.requestsComplete).toBe(false);
    expect(result.projects.every((project) => project.status === "invalid-response")).toBe(true);
    expect(result.projects[0]?.reason).toContain("byte limit");
  });

  it("cancels non-success response bodies and aborts their requests", async () => {
    let cancellations = 0;
    const failedSignals: AbortSignal[] = [];
    const result = await resolveModrinthCompatibility(
      { projects: ["available", "missing"] },
      async (url, init) => {
        const request = projectRequest(url);
        if (request.action === "check" && request.project === "missing") {
          if (init?.signal) failedSignals.push(init.signal);
          return {
            ok: false,
            status: 404,
            statusText: "Not Found",
            body: new ReadableStream<Uint8Array>({
              cancel() {
                cancellations += 1;
              },
            }),
          };
        }
        if (request.action === "check") return jsonResponse({ id: "available-id" });
        return jsonResponse([version("available", request.project, "2026-01-01T00:00:00Z")]);
      },
    );

    expect(result.outcome).toBe("indeterminate");
    expect(cancellations).toBe(1);
    expect(failedSignals).toHaveLength(1);
    expect(failedSignals[0]?.aborted).toBe(true);
  });

  it("limits concurrent requests and preserves input order", async () => {
    let active = 0;
    let maximumActive = 0;
    const projects = ["one", "two", "three", "four", "five", "six"];
    const result = await resolveModrinthCompatibility({ projects }, async (url) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      const request = projectRequest(url);
      await new Promise((resolve) => setTimeout(resolve, request.project.includes("one") ? 10 : 1));
      active -= 1;
      return request.action === "check"
        ? jsonResponse({ id: defaultCanonicalProjectId(request.project) })
        : jsonResponse([
            version(`${request.project}-version`, request.project, "2026-01-01T00:00:00Z"),
          ]);
    });

    expect(maximumActive).toBeLessThanOrEqual(modrinthCompatibilityLimits.maxConcurrentRequests);
    expect(result.projects.map((project) => project.project)).toEqual(projects);
  });

  it("aborts timed-out canonical lookups", async () => {
    const result = await resolveModrinthCompatibility(
      { projects: ["slow", "fast"], timeoutMs: 5 },
      async (url) => {
        const request = projectRequest(url);
        if (request.project.includes("fast")) {
          return request.action === "check"
            ? jsonResponse({ id: "fast-id" })
            : jsonResponse([version("fast", request.project, "2026-01-01T00:00:00Z")]);
        }
        return new Promise<Response>(() => undefined);
      },
    );

    expect(result.projects[0]).toMatchObject({
      status: "request-failed",
      failurePhase: "project-check",
      reason: "Request timed out after 5 ms.",
    });
    expect(result.requestsComplete).toBe(false);
  });

  it("bounds common metadata output without changing its total", async () => {
    const gameVersions = Array.from({ length: 60 }, (_, index) => `test-${index}`);
    const result = await resolveModrinthCompatibility(
      { projects: ["one", "two"] },
      checkedFetch((projectId) =>
        jsonResponse([
          version(`${projectId}-version`, projectId, "2026-01-01T00:00:00Z", {
            game_versions: gameVersions,
          }),
        ]),
      ),
    );

    expect(result.metadataIntersection.gameVersions).toMatchObject({ total: 60, truncated: true });
    expect(result.metadataIntersection.gameVersions.values).toHaveLength(
      modrinthCompatibilityLimits.maxOutputMetadataValues,
    );
  });

  it("keeps the newest common pairs when pair output is truncated", async () => {
    const gameVersions = Array.from({ length: 60 }, (_, index) => `fixture-${index}`);
    const result = await resolveModrinthCompatibility(
      { projects: ["one", "two"] },
      checkedFetch((projectId) =>
        jsonResponse(
          gameVersions.map((gameVersion, index) =>
            version(
              `${projectId}-${index}`,
              projectId,
              new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
              { game_versions: [gameVersion] },
            ),
          ),
        ),
      ),
    );

    expect(result.commonPairs).toMatchObject({ total: 60, truncated: true });
    expect(result.commonPairs.pairs).toHaveLength(modrinthCompatibilityLimits.maxOutputPairs);
    expect(result.commonPairs.pairs[0]?.gameVersion).toBe("fixture-59");
    expect(result.commonPairs.pairs.map((pair) => pair.gameVersion)).not.toContain("fixture-0");
  });

  it("does not invent pairs from independent game-version and loader intersections", async () => {
    const result = await resolveModrinthCompatibility(
      { projects: ["alpha", "beta"] },
      checkedFetch((projectId) =>
        jsonResponse(
          projectId.includes("alpha")
            ? [
                version("alpha-120", projectId, "2026-01-01T00:00:00Z", {
                  game_versions: ["1.20"],
                  loaders: ["forge"],
                }),
                version("alpha-121", projectId, "2026-02-01T00:00:00Z", {
                  game_versions: ["1.21"],
                  loaders: ["fabric"],
                }),
              ]
            : [
                version("beta-120", projectId, "2026-01-01T00:00:00Z", {
                  game_versions: ["1.20"],
                  loaders: ["fabric"],
                }),
                version("beta-121", projectId, "2026-02-01T00:00:00Z", {
                  game_versions: ["1.21"],
                  loaders: ["forge"],
                }),
              ],
        ),
      ),
    );

    expect(result.metadataIntersection.gameVersions.values).toEqual(["1.20", "1.21"]);
    expect(result.metadataIntersection.loaders.values).toEqual(["fabric", "forge"]);
    expect(result.commonPairs).toMatchObject({ status: "computed", total: 0, pairs: [] });
    expect(result.outcome).toBe("no-common-pair");
  });

  it("uses bounded set intersections for maximum project and version inputs", async () => {
    const projectCount = modrinthCompatibilityLimits.maxProjects;
    const versionCount = modrinthCompatibilityLimits.maxVersionsPerProject;
    const projects = Array.from({ length: projectCount }, (_, index) => `project-${index}`);
    const gameVersions = Array.from({ length: versionCount }, (_, index) => `fixture-${index}`);
    const startedAt = Date.now();
    const result = await resolveModrinthCompatibility(
      { projects },
      checkedFetch((projectId) =>
        jsonResponse(
          gameVersions.map((gameVersion, index) =>
            version(`${projectId}-${index}`, projectId, "2026-01-01T00:00:00Z", {
              game_versions: [gameVersion],
            }),
          ),
        ),
      ),
    );
    const elapsedMs = Date.now() - startedAt;

    expect(result.projectCount).toBe(projectCount);
    expect(result.metadataIntersection.gameVersions.total).toBe(versionCount);
    expect(result.metadataIntersection.gameVersions.truncated).toBe(true);
    expect(result.commonPairs.total).toBe(versionCount);
    expect(result.commonPairs.truncated).toBe(true);
    expect(elapsedMs).toBeLessThan(5_000);
  });

  it("rejects version metadata that exceeds pair processing bounds", async () => {
    const values = Array.from(
      { length: modrinthCompatibilityLimits.maxMetadataValues },
      (_, index) => `value-${index}`,
    );
    const result = await resolveModrinthCompatibility(
      { projects: ["one", "two"] },
      checkedFetch((projectId) =>
        jsonResponse(
          Array.from({ length: 7 }, (_, index) =>
            version(`version-${index}`, projectId, `2026-01-0${index + 1}T00:00:00Z`, {
              game_versions: values,
              loaders: values,
            }),
          ),
        ),
      ),
    );

    expect(result.requestsComplete).toBe(false);
    expect(result.projects.every((project) => project.status === "invalid-response")).toBe(true);
    expect(result.projects[0]?.reason).toContain("pair limit");
  });

  it("rejects unsafe or unbounded project inputs", async () => {
    let fetchCalls = 0;
    const unused: ModrinthCompatibilityFetch = async () => {
      fetchCalls += 1;
      return jsonResponse([]);
    };
    await expect(
      resolveModrinthCompatibility({ projects: ["same", " same "] }, unused),
    ).rejects.toThrow("two distinct projects");
    await expect(
      resolveModrinthCompatibility(
        {
          projects: Array.from(
            { length: modrinthCompatibilityLimits.maxProjects + 1 },
            (_, index) => `project-${index}`,
          ),
        },
        unused,
      ),
    ).rejects.toThrow("between 2 and 10 projects");
    await expect(
      resolveModrinthCompatibility({ projects: ["safe", "bad\u0000project"] }, unused),
    ).rejects.toThrow("control characters");
    await expect(
      resolveModrinthCompatibility({ projects: ["safe", ".."] }, unused),
    ).rejects.toThrow("relative path segment");
    await expect(
      resolveModrinthCompatibility({ projects: ["safe", "\ud800"] }, unused),
    ).rejects.toThrow("well-formed Unicode");
    await expect(
      resolveModrinthCompatibility({ projects: ["safe", "x".repeat(1_000_000)] }, unused),
    ).rejects.toThrow("at most 96 characters");
    await expect(
      resolveModrinthCompatibility(
        { projects: ["safe", "other"], loader: "x".repeat(1_000_000) },
        unused,
      ),
    ).rejects.toThrow("at most 64 characters");
    expect(fetchCalls).toBe(0);
  });

  it("rejects unsafe canonical project IDs without requesting a normalized endpoint", async () => {
    const calls: string[] = [];
    const result = await resolveModrinthCompatibility(
      { projects: ["safe", "unsafe"] },
      async (url) => {
        calls.push(url);
        const request = projectRequest(url);
        if (request.action === "check") {
          return jsonResponse({ id: request.project === "unsafe" ? ".." : "safe-id" });
        }
        return jsonResponse([version("safe", request.project, "2026-01-01T00:00:00Z")]);
      },
    );

    expect(result.projects[1]).toMatchObject({
      status: "invalid-response",
      failurePhase: "project-check",
      httpStatus: 200,
    });
    expect(result.projects[1]?.reason).toContain("safe ASCII project ID");
    expect(calls.filter((url) => url.includes("/version"))).toHaveLength(1);
    expect(calls.some((url) => new URL(url).pathname === "/v2/version")).toBe(false);
  });
});
