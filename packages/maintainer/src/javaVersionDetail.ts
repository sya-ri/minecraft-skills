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
  pack_version?: {
    resource_major?: number;
    resource_minor?: number;
    data_major?: number;
    data_minor?: number;
  };
  java_component?: string;
  java_version?: number;
  stable?: boolean;
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

export function buildJavaVersionDetail(options: {
  versionJsonPath: string;
  clientJarPath?: string;
  versionJsonUrl?: string;
  retrievedAt: string;
}): JavaVersionDetail {
  const versionJson = readJsonFile<MojangVersionJson>(options.versionJsonPath);
  const jarVersion = options.clientJarPath ? readJarVersionJson(options.clientJarPath) : undefined;
  const packVersion = jarVersion?.pack_version;
  const packFormats = {
    data: packVersion?.data_major ?? null,
    dataMinor: packVersion?.data_minor ?? null,
    resource: packVersion?.resource_major ?? null,
    resourceMinor: packVersion?.resource_minor ?? null,
    status: packVersion ? "extracted" : "not-extracted",
  } as const;

  return {
    schemaVersion: 1,
    edition: "java",
    version: versionJson.id,
    type: versionJson.type,
    releaseTime: versionJson.releaseTime,
    coverage: jarVersion ? "version-json-and-jar" : "version-json",
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
        status: packVersion ? "extracted" : "seed",
        facts: packVersion?.data_major ? [`data_pack_format=${packVersion.data_major}`] : [],
        unknowns: packVersion
          ? ["command_tree", "registries", "vanilla_reports"]
          : ["data_pack_format", "command_tree", "registries", "vanilla_reports"],
      },
      resourcepack: {
        status: packVersion ? "extracted" : "seed",
        facts: packVersion?.resource_major
          ? [`resource_pack_format=${packVersion.resource_major}`]
          : [],
        unknowns: packVersion
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
              id: "mojang-client-jar-version-json",
              kind: "official-extracted",
              url: versionJson.downloads?.client?.url ?? "client.jar",
              retrievedAt: options.retrievedAt,
            },
          ]
        : []),
    ],
  };
}
