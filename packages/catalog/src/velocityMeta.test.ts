import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveVelocityToolchain, type VelocityMetaFetch } from "./velocityMeta.js";

const metadataUrl =
  "https://repo.papermc.io/repository/maven-public/com/velocitypowered/velocity-api/maven-metadata.xml";
const developmentUrl = "https://docs.papermc.io/velocity/dev/creating-your-first-plugin/";
const faqUrl = "https://docs.papermc.io/velocity/faq/";

function metadata(options?: {
  groupId?: string;
  artifactId?: string;
  latest?: string;
  release?: string | null;
  versions?: string[];
  lastUpdated?: string;
}): string {
  const latest = options?.latest ?? "4.1.0-SNAPSHOT";
  const release = options?.release === undefined ? "4.0.0" : options.release;
  const versions = options?.versions ?? ["3.4.0", "4.0.0", "4.1.0-SNAPSHOT"];
  return `<?xml version="1.0" encoding="UTF-8"?>
<metadata>
  <groupId>${options?.groupId ?? "com.velocitypowered"}</groupId>
  <artifactId>${options?.artifactId ?? "velocity-api"}</artifactId>
  <versioning>
    <latest>${latest}</latest>
    ${release === null ? "" : `<release>${release}</release>`}
    <versions>${versions.map((version) => `<version>${version}</version>`).join("")}</versions>
    <lastUpdated>${options?.lastUpdated ?? "20260814105730"}</lastUpdated>
  </versioning>
</metadata>`;
}

function development(version = "4.1.0-SNAPSHOT", java = 25): string {
  return `<html><body>
    <p>Make sure your <strong>Project JDK</strong> is Java ${java} or later</p>
    <table><tr><td><code>com.velocitypowered</code></td><td><code>velocity-api</code></td><td>${version}</td></tr></table>
    <code>https://repo.papermc.io/repository/maven-public/</code>
  </body></html>`;
}

function faq(velocityMajor = 4, java = 25): string {
  return `<html><body><p>Velocity ${velocityMajor}.0.x and above requires at least Java ${java}.</p></body></html>`;
}

function textResponse(value: string, contentType?: string): Response {
  return new Response(value, {
    ...(contentType ? { headers: { "Content-Type": contentType } } : {}),
  });
}

function fixtureFetch(options?: {
  metadata?: string;
  development?: string;
  faq?: string;
  requests?: Array<{ url: string; init?: RequestInit }>;
}): VelocityMetaFetch {
  return async (url, init) => {
    options?.requests?.push({ url, ...(init ? { init } : {}) });
    if (url === metadataUrl) {
      return textResponse(options?.metadata ?? metadata(), "application/xml");
    }
    if (url === developmentUrl) {
      return textResponse(options?.development ?? development(), "text/html; charset=utf-8");
    }
    if (url === faqUrl) {
      return textResponse(options?.faq ?? faq(), "text/html; charset=utf-8");
    }
    throw new Error(`unexpected URL ${url}`);
  };
}

describe("Velocity toolchain resolution", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves the live Maven latest coordinate with official documentation evidence", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await resolveVelocityToolchain(
      { limit: 2, timeoutMs: 1000 },
      fixtureFetch({ requests }),
      () => new Date("2026-08-24T10:00:00.000Z"),
    );

    expect(result).toMatchObject({
      schemaVersion: 1,
      retrievedAt: "2026-08-24T10:00:00.000Z",
      api: {
        version: "4.1.0-SNAPSHOT",
        coordinate: "com.velocitypowered:velocity-api:4.1.0-SNAPSHOT",
        releaseVersion: "4.0.0",
        repositoryUrl: "https://repo.papermc.io/repository/maven-public/",
        metadataLastUpdated: "2026-08-14T10:57:30.000Z",
        candidates: ["4.1.0-SNAPSHOT", "4.0.0"],
        candidateCount: 3,
        candidatesTruncated: true,
      },
      documentation: {
        recommendedApiVersion: "4.1.0-SNAPSHOT",
        repositoryConfirmed: true,
        javadocsUrl: "https://jd.papermc.io/velocity/",
      },
      javaRequirement: {
        minimumVersion: 25,
        appliesTo: "Velocity 4.0.x and above",
        corroboratedByDevelopmentGuide: true,
      },
      compatibility: { minecraftGameVersions: "not-inferred" },
      provenance: { kind: "official-live" },
    });
    expect(result.warnings.join(" ")).toContain("do not establish Minecraft game-version");
    expect(result.warnings.join(" ")).toContain("mutable SNAPSHOT");
    expect(requests.map(({ url }) => url)).toEqual([metadataUrl, developmentUrl, faqUrl]);
    expect(
      requests.every(({ init }) =>
        new Headers(init?.headers).get("User-Agent")?.includes("minecraft-skills"),
      ),
    ).toBe(true);
    expect(requests.every(({ init }) => init?.redirect === "error")).toBe(true);
    expect(requests.every(({ init }) => init?.signal instanceof AbortSignal)).toBe(true);
  });

  it("reports documentation drift without replacing Maven latest metadata", async () => {
    const result = await resolveVelocityToolchain(
      {},
      fixtureFetch({ development: development("4.0.0") }),
    );

    expect(result.api.version).toBe("4.1.0-SNAPSHOT");
    expect(result.documentation.recommendedApiVersion).toBe("4.0.0");
    expect(result.warnings.join(" ")).toContain("development guide recommends velocity-api 4.0.0");
  });

  it("omits optional evidence with actionable warnings when official docs are unavailable", async () => {
    const fetchImpl: VelocityMetaFetch = async (url) => {
      if (url === metadataUrl) {
        return textResponse(metadata(), "application/xml");
      }
      return new Response("maintenance", { status: 503, statusText: "Service Unavailable" });
    };
    const result = await resolveVelocityToolchain({}, fetchImpl);

    expect(result.api.coordinate).toBe("com.velocitypowered:velocity-api:4.1.0-SNAPSHOT");
    expect(result.documentation.recommendedApiVersion).toBeNull();
    expect(result.javaRequirement).toBeNull();
    expect(result.provenance.sources.map((source) => source.status)).toEqual([
      "retrieved",
      "unavailable",
      "unavailable",
    ]);
    expect(result.provenance.sources[0]).toHaveProperty("retrievedAt");
    expect(result.provenance.sources[1]).not.toHaveProperty("retrievedAt");
    expect(result.warnings.join(" ")).toContain("Inspect https://docs.papermc.io/velocity");
  });

  it("keeps Maven metadata usable when an optional documentation response is oversized", async () => {
    const result = await resolveVelocityToolchain(
      {},
      fixtureFetch({ development: "x".repeat(512 * 1024 + 1) }),
    );

    expect(result.api.version).toBe("4.1.0-SNAPSHOT");
    expect(result.provenance.sources.map((source) => source.status)).toEqual([
      "retrieved",
      "unavailable",
      "retrieved",
    ]);
    expect(result.javaRequirement?.minimumVersion).toBe(25);
    expect(result.warnings.join(" ")).toContain("exceeds the 524288 byte limit");
  });

  it("cancels optional response bodies rejected before streaming", async () => {
    let cancelCount = 0;
    const rejectedBody = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("maintenance"));
        },
        cancel() {
          cancelCount += 1;
        },
      });
    const fetchImpl: VelocityMetaFetch = async (url) => {
      if (url === metadataUrl) {
        return textResponse(metadata(), "application/xml");
      }
      if (url === developmentUrl) {
        return new Response(rejectedBody(), {
          status: 503,
          statusText: "Service Unavailable",
        });
      }
      return new Response(rejectedBody(), {
        headers: { "Content-Type": "text/plain" },
      });
    };

    const result = await resolveVelocityToolchain({}, fetchImpl);

    expect(result.provenance.sources.map((source) => source.status)).toEqual([
      "retrieved",
      "unavailable",
      "unavailable",
    ]);
    expect(cancelCount).toBe(2);
  });

  it("removes Unicode control formatting from reflected request errors", async () => {
    const fetchImpl: VelocityMetaFetch = async (url) => {
      if (url === metadataUrl) {
        return textResponse(metadata(), "application/xml");
      }
      if (url === developmentUrl) {
        throw new Error("spoof\u202ename\u0085line");
      }
      return textResponse(faq(), "text/html");
    };

    const result = await resolveVelocityToolchain({}, fetchImpl);
    const detail = result.provenance.sources.find(
      (source) => source.purpose === "development-guide",
    )?.detail;

    expect(detail).toContain("spoof name line");
    expect(detail).not.toMatch(/[\u0085\u202e]/u);
  });

  it("marks changed official documentation shapes as malformed", async () => {
    const result = await resolveVelocityToolchain(
      {},
      fixtureFetch({
        development: "<html><body>Dependency details moved.</body></html>",
        faq: "<html><body>Consult the release notes.</body></html>",
      }),
    );

    expect(result.provenance.sources.map((source) => source.status)).toEqual([
      "retrieved",
      "malformed",
      "malformed",
    ]);
    expect(result.javaRequirement).toBeNull();
    expect(result.warnings.join(" ")).toContain("expected dependency table");
    expect(result.warnings.join(" ")).toContain("expected Java requirement statement");
  });

  it("rejects truncated raw HTML elements instead of trusting their hidden text", async () => {
    const result = await resolveVelocityToolchain(
      {},
      fixtureFetch({
        development: `<html><body><script>${development("99.0.0-SNAPSHOT", 99)}`,
        faq: `<html><body><style>${faq(1, 99)}`,
      }),
    );

    expect(result.documentation.recommendedApiVersion).toBeNull();
    expect(result.javaRequirement).toBeNull();
    expect(result.provenance.sources.map((source) => source.status)).toEqual([
      "retrieved",
      "malformed",
      "malformed",
    ]);
    expect(result.warnings.join(" ")).toContain("ends inside a <script> element");
    expect(result.warnings.join(" ")).toContain("ends inside a <style> element");
  });

  it("does not apply a Java requirement outside the official FAQ version range", async () => {
    const result = await resolveVelocityToolchain(
      {},
      fixtureFetch({
        metadata: metadata({
          latest: "3.4.0",
          release: "3.4.0",
          versions: ["3.3.0", "3.4.0"],
        }),
        development: development("3.4.0", 17),
      }),
    );

    expect(result.javaRequirement).toBeNull();
    expect(result.warnings.join(" ")).toContain("does not establish a requirement");
  });

  it("rejects metadata for another Maven artifact and forbidden XML declarations", async () => {
    await expect(
      resolveVelocityToolchain(
        {},
        fixtureFetch({ metadata: metadata({ artifactId: "velocity-proxy" }) }),
      ),
    ).rejects.toThrow("unexpected artifact com.velocitypowered:velocity-proxy");

    await expect(
      resolveVelocityToolchain(
        {},
        fixtureFetch({
          metadata: `<!DOCTYPE metadata [<!ENTITY x "4.1.0-SNAPSHOT">]>${metadata()}`,
        }),
      ),
    ).rejects.toThrow("forbidden declaration");
  });

  it("rejects inconsistent or excessive Maven version lists", async () => {
    await expect(
      resolveVelocityToolchain(
        {},
        fixtureFetch({
          metadata: metadata({
            latest: "4.1.0-SNAPSHOT",
            versions: ["4.0.0"],
          }),
        }),
      ),
    ).rejects.toThrow("latest version is absent from the versions list");

    await expect(
      resolveVelocityToolchain(
        {},
        fixtureFetch({
          metadata: metadata({
            latest: "513.0.0",
            release: null,
            versions: Array.from({ length: 513 }, (_, index) => `${index + 1}.0.0`),
          }),
        }),
      ),
    ).rejects.toThrow("between 1 and 512 versions");

    await expect(
      resolveVelocityToolchain(
        {},
        fixtureFetch({ metadata: metadata({ release: "4.1.0-SNAPSHOT" }) }),
      ),
    ).rejects.toThrow("release version must not be a SNAPSHOT");
  });

  it("rejects oversized and invalid UTF-8 metadata before XML parsing", async () => {
    const oversizedHeaderFetch: VelocityMetaFetch = async (url) => {
      if (url === metadataUrl) {
        return new Response("<metadata/>", {
          headers: {
            "Content-Type": "application/xml",
            "Content-Length": String(128 * 1024 + 1),
          },
        });
      }
      return textResponse(url === faqUrl ? faq() : development(), "text/html");
    };
    await expect(resolveVelocityToolchain({}, oversizedHeaderFetch)).rejects.toThrow(
      "exceeds the 131072 byte limit",
    );

    const invalidUtf8Fetch: VelocityMetaFetch = async (url) => {
      if (url === metadataUrl) {
        return new Response(new Uint8Array([0xc3, 0x28]), {
          headers: { "Content-Type": "application/xml" },
        });
      }
      return textResponse(url === faqUrl ? faq() : development(), "text/html");
    };
    await expect(resolveVelocityToolchain({}, invalidUtf8Fetch)).rejects.toThrow(
      "response is not valid UTF-8",
    );
  });

  it("stops streaming metadata when Content-Length is absent", async () => {
    const fetchImpl: VelocityMetaFetch = async (url) => {
      if (url === metadataUrl) {
        return new Response("x".repeat(128 * 1024 + 1), {
          headers: { "Content-Type": "application/xml" },
        });
      }
      return textResponse(url === faqUrl ? faq() : development(), "text/html");
    };
    await expect(resolveVelocityToolchain({}, fetchImpl)).rejects.toThrow(
      "exceeds the 131072 byte limit",
    );
  });

  it("bounds optional documentation requests with the same timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl: VelocityMetaFetch = async (url) => {
      if (url === metadataUrl) {
        return textResponse(metadata(), "application/xml");
      }
      return new Promise(() => undefined);
    };
    const lookup = resolveVelocityToolchain({ timeoutMs: 100 }, fetchImpl);
    await vi.advanceTimersByTimeAsync(100);
    const result = await lookup;

    expect(result.api.version).toBe("4.1.0-SNAPSHOT");
    expect(result.provenance.sources.map((source) => source.status)).toEqual([
      "retrieved",
      "unavailable",
      "unavailable",
    ]);
  });

  it("times out when required Maven metadata does not respond", async () => {
    vi.useFakeTimers();
    const fetchImpl: VelocityMetaFetch = async (url) => {
      if (url === metadataUrl) {
        return new Promise(() => undefined);
      }
      return textResponse(url === faqUrl ? faq() : development(), "text/html");
    };
    const lookup = resolveVelocityToolchain({ timeoutMs: 100 }, fetchImpl);
    const rejection = expect(lookup).rejects.toThrow(
      "Velocity toolchain lookup timed out after 100 milliseconds",
    );
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
  });

  it("fails with an actionable outcome when Maven metadata is unavailable", async () => {
    const fetchImpl: VelocityMetaFetch = async (url) => {
      if (url === metadataUrl) {
        return new Response("maintenance", { status: 503, statusText: "Service Unavailable" });
      }
      return textResponse(url === faqUrl ? faq() : development(), "text/html");
    };
    await expect(resolveVelocityToolchain({}, fetchImpl)).rejects.toThrow(
      `Re-run the lookup later or inspect ${metadataUrl} manually`,
    );
  });

  it("validates public bounds before making requests", async () => {
    const fetchImpl = vi.fn<VelocityMetaFetch>();
    await expect(resolveVelocityToolchain({ limit: 0 }, fetchImpl)).rejects.toThrow(
      "limit must be between 1 and 50",
    );
    await expect(resolveVelocityToolchain({ timeoutMs: 99 }, fetchImpl)).rejects.toThrow(
      "timeout must be between 100 and 30000 milliseconds",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
