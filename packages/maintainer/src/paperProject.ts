type PaperProjectJson = {
  project_id: string;
  project_name: string;
  version_groups: string[];
  versions: string[];
};

type PaperVersionBuildsJson = {
  version: string;
  builds: number[];
};

type PaperPluginData = {
  schemaVersion: 1;
  projectId: "paper";
  projectName: string;
  latest: {
    minecraftVersion: string;
    build: number;
  };
  support: {
    primarySince: "1.13";
    legacyBefore: "1.13";
    minecraftLatestGap: {
      javaLatest: string;
      paperLatest: string;
      status: "paper-current-with-java-latest" | "paper-not-yet-published-for-java-latest";
    };
  };
  versionGroups: string[];
  versions: string[];
  eventSearch: {
    provider: "sya-ri/spigot-event-list";
    baseUrl: "https://spigot-event-list.s7a.dev/api/search/events";
    defaultVersion: "latest";
    sources: ["spigot", "paper", "purpur", "bungee", "velocity"];
    paperSources: ["spigot", "paper"];
    querySemantics: {
      defaultOperator: "AND";
      orOperator: "OR";
      quotedPhrases: true;
      maxLimit: 100;
      defaultLimit: 20;
    };
  };
  sources: Array<{
    id: string;
    kind: string;
    url: string;
    retrievedAt: string;
  }>;
};

function assertPaperProject(value: unknown): asserts value is PaperProjectJson {
  if (!value || typeof value !== "object" || !("versions" in value)) {
    throw new Error("Invalid PaperMC project JSON: missing versions");
  }
  if (!Array.isArray((value as { versions: unknown }).versions)) {
    throw new Error("Invalid PaperMC project JSON: versions must be an array");
  }
}

function assertPaperVersionBuilds(value: unknown): asserts value is PaperVersionBuildsJson {
  if (!value || typeof value !== "object" || !("builds" in value)) {
    throw new Error("Invalid PaperMC version builds JSON: missing builds");
  }
  if (!Array.isArray((value as { builds: unknown }).builds)) {
    throw new Error("Invalid PaperMC version builds JSON: builds must be an array");
  }
}

function supportedReleaseVersions(project: PaperProjectJson): string[] {
  return project.versions.filter((version) => {
    if (version.includes("-")) {
      return false;
    }
    const [major, minor] = version.split(".");
    return major === "1" && Number(minor) >= 13;
  });
}

export function buildPaperPluginData(options: {
  projectJson: unknown;
  latestBuildsJson: unknown;
  javaLatest: string;
  retrievedAt: string;
}): PaperPluginData {
  assertPaperProject(options.projectJson);
  assertPaperVersionBuilds(options.latestBuildsJson);

  const versions = supportedReleaseVersions(options.projectJson);
  const latestVersion = versions.at(-1);
  const latestBuild = Math.max(...options.latestBuildsJson.builds);
  if (!latestVersion) {
    throw new Error("PaperMC project JSON did not contain supported 1.13+ release versions");
  }
  if (options.latestBuildsJson.version !== latestVersion) {
    throw new Error(
      `PaperMC builds JSON is for ${options.latestBuildsJson.version}, expected ${latestVersion}`,
    );
  }
  if (!Number.isFinite(latestBuild)) {
    throw new Error(`PaperMC builds JSON for ${latestVersion} did not contain any builds`);
  }

  const versionGroups = options.projectJson.version_groups.filter((group) => {
    const [major, minor] = group.split(".");
    return major === "1" && Number(minor) >= 13;
  });

  return {
    schemaVersion: 1,
    projectId: "paper",
    projectName: options.projectJson.project_name,
    latest: {
      minecraftVersion: latestVersion,
      build: latestBuild,
    },
    support: {
      primarySince: "1.13",
      legacyBefore: "1.13",
      minecraftLatestGap: {
        javaLatest: options.javaLatest,
        paperLatest: latestVersion,
        status:
          options.javaLatest === latestVersion
            ? "paper-current-with-java-latest"
            : "paper-not-yet-published-for-java-latest",
      },
    },
    versionGroups,
    versions,
    eventSearch: {
      provider: "sya-ri/spigot-event-list",
      baseUrl: "https://spigot-event-list.s7a.dev/api/search/events",
      defaultVersion: "latest",
      sources: ["spigot", "paper", "purpur", "bungee", "velocity"],
      paperSources: ["spigot", "paper"],
      querySemantics: {
        defaultOperator: "AND",
        orOperator: "OR",
        quotedPhrases: true,
        maxLimit: 100,
        defaultLimit: 20,
      },
    },
    sources: [
      {
        id: "papermc-api-project-paper",
        kind: "official",
        url: "https://api.papermc.io/v2/projects/paper",
        retrievedAt: options.retrievedAt,
      },
      {
        id: `papermc-api-paper-${latestVersion}-builds`,
        kind: "official",
        url: `https://api.papermc.io/v2/projects/paper/versions/${latestVersion}`,
        retrievedAt: options.retrievedAt,
      },
      {
        id: "spigot-event-list-search-api",
        kind: "project-api",
        url: "https://spigot-event-list.s7a.dev/api/search/events",
        retrievedAt: options.retrievedAt,
      },
      {
        id: "spigot-event-search-skill-api-reference",
        kind: "project-api-reference",
        url: "https://raw.githubusercontent.com/sya-ri/spigot-event-list/master/skills/spigot-event-search/references/api.md",
        retrievedAt: options.retrievedAt,
      },
    ],
  };
}
