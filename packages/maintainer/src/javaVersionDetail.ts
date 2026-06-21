import { readFileSync } from "node:fs";
import { readZipEntry } from "./zip.js";

type MojangDownload = {
  sha1: string;
  size: number;
  url: string;
};

type MojangVersionJson = {
  id: string;
  type: string;
  releaseTime: string;
  time: string;
  assetIndex?: {
    id: string;
    sha1: string;
    size: number;
    totalSize: number;
    url: string;
  };
  downloads?: Record<string, MojangDownload>;
  javaVersion?: {
    component: string;
    majorVersion: number;
  };
};

type JarVersionJson = {
  id: string;
  world_version?: number;
  protocol_version?: number;
  pack_version?:
    | number
    | {
        resource?: number;
        resource_major?: number;
        resource_minor?: number;
        data?: number;
        data_major?: number;
        data_minor?: number;
      };
  java_component?: string;
  java_version?: number;
  stable?: boolean;
};

type JarPackMcmeta = {
  pack?: {
    pack_format?: number;
  };
};

type JarMetadata = {
  versionJson?: JarVersionJson;
  packMcmeta?: JarPackMcmeta;
};

type JavaVersionDetail = {
  schemaVersion: 1;
  edition: "java";
  version: string;
  type: string;
  releaseTime: string;
  coverage: "version-json" | "version-json-and-jar";
  protocolVersion: number | null;
  worldVersion: number | null;
  stable: boolean | null;
  javaVersion: {
    component: string | null;
    majorVersion: number | null;
  };
  assetIndex: MojangVersionJson["assetIndex"] | null;
  downloads: Record<string, MojangDownload>;
  packFormats: {
    data: number | null;
    dataMinor: number | null;
    resource: number | null;
    resourceMinor: number | null;
    status: "extracted" | "not-extracted";
  };
  domains: {
    datapack: {
      status: string;
      facts: string[];
      unknowns: string[];
    };
    resourcepack: {
      status: string;
      facts: string[];
      unknowns: string[];
    };
    "paper-plugin": {
      status: string;
      facts: string[];
      unknowns: string[];
    };
  };
  sources: Array<{
    id: string;
    kind: string;
    url: string;
    retrievedAt: string;
  }>;
};

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function readJarVersionJson(path: string): JarVersionJson {
  const content = readZipEntry(readFileSync(path), "version.json").toString("utf8");
  return JSON.parse(content) as JarVersionJson;
}

function readJarPackMcmeta(path: string): JarPackMcmeta {
  const content = readZipEntry(readFileSync(path), "pack.mcmeta").toString("utf8");
  return JSON.parse(content) as JarPackMcmeta;
}

function readJarMetadata(path: string): JarMetadata {
  try {
    return {
      versionJson: readJarVersionJson(path),
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Zip entry not found: version.json") {
      return {
        packMcmeta: readJarPackMcmeta(path),
      };
    }
    throw error;
  }
}

export function buildJavaVersionDetail(options: {
  versionJsonPath: string;
  clientJarPath?: string;
  versionJsonUrl?: string;
  retrievedAt: string;
}): JavaVersionDetail {
  const versionJson = readJsonFile<MojangVersionJson>(options.versionJsonPath);
  const jarMetadata = options.clientJarPath ? readJarMetadata(options.clientJarPath) : undefined;
  const jarVersion = jarMetadata?.versionJson;
  const packVersion = jarVersion?.pack_version;
  const commonPackVersion = typeof packVersion === "number" ? packVersion : null;
  const structuredPackVersion = typeof packVersion === "object" ? packVersion : undefined;
  const legacyPackFormat = jarMetadata?.packMcmeta?.pack?.pack_format ?? null;
  const packFormats = {
    data:
      structuredPackVersion?.data_major ??
      structuredPackVersion?.data ??
      commonPackVersion ??
      legacyPackFormat,
    dataMinor: structuredPackVersion?.data_minor ?? null,
    resource:
      structuredPackVersion?.resource_major ??
      structuredPackVersion?.resource ??
      commonPackVersion ??
      legacyPackFormat,
    resourceMinor: structuredPackVersion?.resource_minor ?? null,
    status: packVersion || legacyPackFormat ? "extracted" : "not-extracted",
  } as const;

  return {
    schemaVersion: 1,
    edition: "java",
    version: versionJson.id,
    type: versionJson.type,
    releaseTime: versionJson.releaseTime,
    coverage: jarMetadata ? "version-json-and-jar" : "version-json",
    protocolVersion: jarVersion?.protocol_version ?? null,
    worldVersion: jarVersion?.world_version ?? null,
    stable: jarVersion?.stable ?? null,
    javaVersion: {
      component: jarVersion?.java_component ?? versionJson.javaVersion?.component ?? null,
      majorVersion: jarVersion?.java_version ?? versionJson.javaVersion?.majorVersion ?? null,
    },
    assetIndex: versionJson.assetIndex ?? null,
    downloads: versionJson.downloads ?? {},
    packFormats,
    domains: {
      datapack: {
        status: packFormats.data ? "extracted" : "seed",
        facts: packFormats.data ? [`data_pack_format=${packFormats.data}`] : [],
        unknowns: packFormats.data
          ? ["command_tree", "registries", "vanilla_reports"]
          : ["data_pack_format", "command_tree", "registries", "vanilla_reports"],
      },
      resourcepack: {
        status: packFormats.resource ? "extracted" : "seed",
        facts: packFormats.resource ? [`resource_pack_format=${packFormats.resource}`] : [],
        unknowns: packFormats.resource
          ? ["asset_index_contents", "model_schema"]
          : ["resource_pack_format", "asset_index", "model_schema"],
      },
      "paper-plugin": {
        status: "seed",
        facts: [],
        unknowns: ["paper_api_version", "server_api_changes", "folia_compatibility_notes"],
      },
    },
    sources: [
      {
        id: "mojang-version-json",
        kind: "official",
        url: options.versionJsonUrl ?? `file://${options.versionJsonPath}`,
        retrievedAt: options.retrievedAt,
      },
      ...(options.clientJarPath
        ? [
            {
              id: jarVersion ? "mojang-client-jar-version-json" : "mojang-client-jar-pack-mcmeta",
              kind: "official-extracted",
              url: versionJson.downloads?.client?.url ?? "client.jar",
              retrievedAt: options.retrievedAt,
            },
          ]
        : []),
    ],
  };
}
