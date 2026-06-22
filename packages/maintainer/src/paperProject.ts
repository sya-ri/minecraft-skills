type PaperProjectJson = {
  project_id?: string;
  project_name?: string;
  project?: {
    id?: string;
    name?: string;
  };
  version_groups?: string[];
  versions: string[] | Record<string, string[]>;
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
  versionBuilds: Array<{
    minecraftVersion: string;
    latestBuild: number;
    buildCount: number;
  }>;
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
  const versions = (value as { versions: unknown }).versions;
  if (!Array.isArray(versions) && (!versions || typeof versions !== "object")) {
    throw new Error("Invalid PaperMC project JSON: versions must be an array or grouped object");
  }
}

function paperProjectId(project: PaperProjectJson): "paper" {
  const id = project.project_id ?? project.project?.id;
  if (id !== "paper") {
    throw new Error(`Invalid PaperMC project JSON: expected paper project, got ${String(id)}`);
  }
  return id;
}

function paperProjectName(project: PaperProjectJson): string {
  return project.project_name ?? project.project?.name ?? "Paper";
}

function paperProjectVersions(project: PaperProjectJson): string[] {
  if (Array.isArray(project.versions)) {
    return project.versions;
  }
  return Object.values(project.versions).flat();
}

function paperProjectVersionGroups(project: PaperProjectJson): string[] {
  if (Array.isArray(project.version_groups)) {
    return project.version_groups;
  }
  if (!Array.isArray(project.versions)) {
    return Object.keys(project.versions);
  }
  return [...new Set(project.versions.map((version) => version.split(".").slice(0, 2).join(".")))];
}

function isSupportedReleaseVersion(version: string): boolean {
  if (version.includes("-")) {
    return false;
  }
  const [major, minor] = version.split(".");
  if (major === "1") {
    return Number(minor) >= 13;
  }
  return Number(major) >= 26;
}

function compareMinecraftVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function supportedReleaseVersions(project: PaperProjectJson): string[] {
  return paperProjectVersions(project)
    .filter(isSupportedReleaseVersion)
    .sort(compareMinecraftVersions);
}

function supportedVersionGroups(project: PaperProjectJson): string[] {
  return paperProjectVersionGroups(project)
    .filter((group) => {
      const [major, minor] = group.split(".");
      if (major === "1") {
        return Number(minor) >= 13;
      }
      return Number(major) >= 26;
    })
    .sort(compareMinecraftVersions);
}

export function buildPaperPluginData(options: {
  projectJson: unknown;
  javaLatest: string;
  retrievedAt: string;
}): PaperPluginData {
  assertPaperProject(options.projectJson);

  const versions = supportedReleaseVersions(options.projectJson);
  const latestVersion = versions.at(-1);
  if (!latestVersion) {
    throw new Error("PaperMC project JSON did not contain supported 1.13+ release versions");
  }

  return {
    schemaVersion: 1,
    projectId: paperProjectId(options.projectJson),
    projectName: paperProjectName(options.projectJson),
    latest: {
      minecraftVersion: latestVersion,
      build: 0,
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
    versionGroups: supportedVersionGroups(options.projectJson),
    versions,
    versionBuilds: [],
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
        id: "papermc-downloads-project-paper",
        kind: "official",
        url: "https://fill.papermc.io/v3/projects/paper",
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
      {
        id: "papermc-docs-paper-dev",
        kind: "official-docs",
        url: "https://docs.papermc.io/paper/dev/",
        retrievedAt: options.retrievedAt,
      },
      {
        id: "papermc-docs-paper-scheduling",
        kind: "official-docs",
        url: "https://docs.papermc.io/paper/dev/scheduler/",
        retrievedAt: options.retrievedAt,
      },
      {
        id: "papermc-docs-paper-folia-support",
        kind: "official-docs",
        url: "https://docs.papermc.io/paper/dev/folia-support/",
        retrievedAt: options.retrievedAt,
      },
      {
        id: "papermc-docs-folia-overview",
        kind: "official-docs",
        url: "https://docs.papermc.io/folia/reference/overview/",
        retrievedAt: options.retrievedAt,
      },
    ],
  };
}
