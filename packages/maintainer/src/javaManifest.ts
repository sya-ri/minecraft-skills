type MojangManifestVersion = {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
  sha1: string;
};

type MojangManifest = {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MojangManifestVersion[];
};

type JavaVersionIndex = {
  schemaVersion: 1;
  edition: "java";
  support: {
    primarySince: "1.13";
    legacyBefore: "1.13";
  };
  latest: {
    release: string;
    snapshot: string | null;
  };
  versions: Array<{
    id: string;
    type: string;
    releaseTime: string;
    time: string;
    sha1: string;
    source: "mojang-version-manifest-v2";
    coverage: "manifest-only";
  }>;
  sources: Array<{
    id: "mojang-version-manifest-v2";
    kind: "official";
    url: string;
    retrievedAt: string;
  }>;
};

const manifestUrl = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

function assertManifest(value: unknown): asserts value is MojangManifest {
  if (!value || typeof value !== "object" || !("versions" in value)) {
    throw new Error("Invalid Mojang version manifest: missing versions");
  }
  if (!Array.isArray((value as { versions: unknown }).versions)) {
    throw new Error("Invalid Mojang version manifest: versions must be an array");
  }
}

export function buildJavaVersionIndex(manifest: unknown, retrievedAt: string): JavaVersionIndex {
  assertManifest(manifest);
  const releases = manifest.versions.filter((version) => version.type === "release");
  const cutoff = releases.find((version) => version.id === "1.13");
  if (!cutoff) {
    throw new Error("Mojang version manifest does not contain Java release 1.13");
  }

  const cutoffTime = Date.parse(cutoff.releaseTime);
  const supportedReleases = releases.filter(
    (version) => Date.parse(version.releaseTime) >= cutoffTime,
  );

  const latestRelease = supportedReleases[0];
  if (!latestRelease) {
    throw new Error("Mojang version manifest did not produce any Java 1.13+ releases");
  }

  return {
    schemaVersion: 1,
    edition: "java",
    support: {
      primarySince: "1.13",
      legacyBefore: "1.13",
    },
    latest: {
      release: latestRelease.id,
      snapshot: null,
    },
    versions: supportedReleases.map((version) => ({
      id: version.id,
      type: version.type,
      releaseTime: version.releaseTime,
      time: version.time,
      sha1: version.sha1,
      source: "mojang-version-manifest-v2",
      coverage: "manifest-only",
    })),
    sources: [
      {
        id: "mojang-version-manifest-v2",
        kind: "official",
        url: manifestUrl,
        retrievedAt,
      },
    ],
  };
}
