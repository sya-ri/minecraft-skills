import { readFileSync } from "node:fs";
import { listZipEntries, readZipEntry, type ZipEntry } from "./zip.js";

type SectionInventory = {
  entryCount: number;
  namespaces: string[];
  topLevel: Array<{
    path: string;
    count: number;
    jsonCount: number;
    samples: string[];
  }>;
};

type VanillaInventory = {
  schemaVersion: 1;
  edition: "java";
  version: string;
  coverage: "client-assets-and-server-data";
  resources: SectionInventory;
  datapack: SectionInventory;
  sources: Array<{
    id: string;
    kind: string;
    url: string;
    retrievedAt: string;
  }>;
};

export type VanillaPathIndex = {
  resourcepack: string[];
  datapack: string[];
};

function countEntries(entries: string[], prefix: string): SectionInventory {
  const files = entries.filter((entry) => entry.startsWith(prefix));
  const namespaces = new Set<string>();
  const groups = new Map<string, { count: number; jsonCount: number; samples: string[] }>();

  for (const file of files) {
    const parts = file.split("/");
    const namespace = parts[1];
    const top = parts[2] ?? "";
    if (!namespace || !top) {
      continue;
    }
    namespaces.add(namespace);
    const path = `${parts[0]}/${namespace}/${top}`;
    const group = groups.get(path) ?? { count: 0, jsonCount: 0, samples: [] };
    group.count += 1;
    if (file.endsWith(".json")) {
      group.jsonCount += 1;
    }
    if (group.samples.length < 5) {
      group.samples.push(file);
    }
    groups.set(path, group);
  }

  return {
    entryCount: files.length,
    namespaces: [...namespaces].sort(),
    topLevel: [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, group]) => ({
        path,
        ...group,
      })),
  };
}

function fileEntries(entries: ZipEntry[]): string[] {
  return entries
    .filter((entry) => !entry.directory)
    .map((entry) => entry.name)
    .sort();
}

function readBundledServerInnerJar(serverJar: Buffer): Buffer {
  const versionList = readZipEntry(serverJar, "META-INF/versions.list").toString("utf8").trim();
  const firstLine = versionList.split(/\r?\n/)[0];
  const innerPath = firstLine?.split(/\s+/)[2];
  if (!innerPath) {
    throw new Error("Could not resolve inner server jar from META-INF/versions.list");
  }
  return readZipEntry(serverJar, `META-INF/versions/${innerPath}`);
}

function listServerEntries(serverJarPath: string): string[] {
  const serverJar = readFileSync(serverJarPath);
  const outerEntries = listZipEntries(serverJar);
  if (outerEntries.some((entry) => entry.name === "META-INF/versions.list")) {
    return fileEntries(listZipEntries(readBundledServerInnerJar(serverJar)));
  }
  return fileEntries(outerEntries);
}

export function buildVanillaInventory(options: {
  version: string;
  clientJarPath: string;
  serverJarPath: string;
  clientJarUrl: string;
  serverJarUrl: string;
  retrievedAt: string;
}): VanillaInventory {
  return buildVanillaData(options).inventory;
}

export function buildVanillaData(options: {
  version: string;
  clientJarPath: string;
  serverJarPath: string;
  clientJarUrl: string;
  serverJarUrl: string;
  retrievedAt: string;
}): { inventory: VanillaInventory; paths: VanillaPathIndex } {
  const clientEntries = fileEntries(listZipEntries(readFileSync(options.clientJarPath)));
  const serverEntries = listServerEntries(options.serverJarPath);

  return {
    inventory: {
      schemaVersion: 1,
      edition: "java",
      version: options.version,
      coverage: "client-assets-and-server-data",
      resources: countEntries(clientEntries, "assets/"),
      datapack: countEntries(serverEntries, "data/"),
      sources: [
        {
          id: "mojang-client-jar-assets",
          kind: "official-extracted",
          url: options.clientJarUrl,
          retrievedAt: options.retrievedAt,
        },
        {
          id: "mojang-server-jar-data",
          kind: "official-extracted",
          url: options.serverJarUrl,
          retrievedAt: options.retrievedAt,
        },
      ],
    },
    paths: {
      resourcepack: clientEntries.filter((entry) => entry.startsWith("assets/")),
      datapack: serverEntries.filter((entry) => entry.startsWith("data/")),
    },
  };
}
