import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listZipEntries, readZipEntry, type ZipEntry } from "./zip.js";

type ValueKind = "array" | "boolean" | "null" | "number" | "object" | "string";

type FieldAccumulator = {
  count: number;
  valueKinds: Map<ValueKind, number>;
  samples: string[];
};

type KindAccumulator = {
  files: Set<string>;
  topLevelKeys: Map<string, FieldAccumulator>;
  fieldPaths: Map<string, FieldAccumulator>;
};

type ObservedDatapackSchemaSurface = {
  schemaVersion: 1;
  edition: "java";
  version: string;
  coverage: "vanilla-observed-datapack-json-shape";
  notes: string[];
  kindCount: number;
  fileCount: number;
  kinds: Array<{
    kind: string;
    fileCount: number;
    topLevelKeys: Array<{
      path: string;
      count: number;
      valueKinds: Array<{ kind: ValueKind; count: number }>;
      samples: string[];
    }>;
    fieldPaths: Array<{
      path: string;
      count: number;
      valueKinds: Array<{ kind: ValueKind; count: number }>;
      samples: string[];
    }>;
  }>;
  sources: Array<{
    id: string;
    kind: string;
    url: string;
    retrievedAt: string;
  }>;
};

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

function readServerJar(serverJarPath: string): Buffer {
  const serverJar = readFileSync(serverJarPath);
  const outerEntries = listZipEntries(serverJar);
  if (outerEntries.some((entry) => entry.name === "META-INF/versions.list")) {
    return readBundledServerInnerJar(serverJar);
  }
  return serverJar;
}

function valueKind(value: unknown): ValueKind {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "object") {
    return "object";
  }
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  return "string";
}

function recordField(
  fields: Map<string, FieldAccumulator>,
  path: string,
  value: unknown,
  sample: string,
): void {
  const field = fields.get(path) ?? {
    count: 0,
    valueKinds: new Map<ValueKind, number>(),
    samples: [],
  };
  const kind = valueKind(value);
  field.count += 1;
  field.valueKinds.set(kind, (field.valueKinds.get(kind) ?? 0) + 1);
  if (field.samples.length < 5 && !field.samples.includes(sample)) {
    field.samples.push(sample);
  }
  fields.set(path, field);
}

function visitJson(
  value: unknown,
  path: string,
  sample: string,
  fields: Map<string, FieldAccumulator>,
): void {
  recordField(fields, path, value, sample);
  if (Array.isArray(value)) {
    for (const item of value) {
      visitJson(item, `${path}[]`, sample, fields);
    }
    return;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(object)) {
      visitJson(child, path ? `${path}.${key}` : key, sample, fields);
    }
  }
}

function datapackKind(path: string): string | undefined {
  const parts = path.split("/");
  if (parts[0] !== "data" || !parts[1] || !parts[2] || !path.endsWith(".json")) {
    return undefined;
  }
  if (parts[2] === "tags") {
    return parts[3] ? `tag/${parts[3]}` : "tag";
  }
  if (parts[2] === "worldgen") {
    return parts[3] ? `worldgen/${parts[3]}` : "worldgen";
  }
  return parts[2];
}

function serializeFields(
  fields: Map<string, FieldAccumulator>,
): ObservedDatapackSchemaSurface["kinds"][number]["fieldPaths"] {
  return [...fields.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, field]) => ({
      path,
      count: field.count,
      valueKinds: [...field.valueKinds.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([kind, count]) => ({ kind, count })),
      samples: field.samples.sort(),
    }));
}

export function buildObservedDatapackSchemaSurface(options: {
  version: string;
  serverJarPath: string;
  serverJarUrl: string;
  retrievedAt: string;
}): ObservedDatapackSchemaSurface {
  const serverJar = readServerJar(options.serverJarPath);
  const entries = fileEntries(listZipEntries(serverJar)).filter(
    (entry) => entry.startsWith("data/") && entry.endsWith(".json"),
  );
  const kinds = new Map<string, KindAccumulator>();

  for (const entry of entries) {
    const kind = datapackKind(entry);
    if (!kind) {
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(readZipEntry(serverJar, entry).toString("utf8")) as unknown;
    } catch {
      continue;
    }
    const accumulator = kinds.get(kind) ?? {
      files: new Set<string>(),
      topLevelKeys: new Map<string, FieldAccumulator>(),
      fieldPaths: new Map<string, FieldAccumulator>(),
    };
    accumulator.files.add(entry);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
        recordField(accumulator.topLevelKeys, key, value, entry);
      }
    }
    visitJson(json, "$", entry, accumulator.fieldPaths);
    kinds.set(kind, accumulator);
  }

  const serializedKinds = [...kinds.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, accumulator]) => ({
      kind,
      fileCount: accumulator.files.size,
      topLevelKeys: serializeFields(accumulator.topLevelKeys),
      fieldPaths: serializeFields(accumulator.fieldPaths),
    }));

  return {
    schemaVersion: 1,
    edition: "java",
    version: options.version,
    coverage: "vanilla-observed-datapack-json-shape",
    notes: [
      "This is an observed field-shape summary of vanilla JSON files bundled in the official server jar.",
      "It is not a normative JSON schema and does not describe accepted custom values beyond observed vanilla examples.",
    ],
    kindCount: serializedKinds.length,
    fileCount: serializedKinds.reduce((total, kind) => total + kind.fileCount, 0),
    kinds: serializedKinds,
    sources: [
      {
        id: "mojang-server-jar-data",
        kind: "official-extracted",
        url: options.serverJarUrl,
        retrievedAt: options.retrievedAt,
      },
    ],
  };
}

export function writeObservedDatapackSchemaSurface(options: {
  root: string;
  surface: ObservedDatapackSchemaSurface;
}): string {
  const outputRoot = join(options.root, "packages/data/data/java/datapack-schema-surfaces");
  mkdirSync(outputRoot, { recursive: true });
  const output = join(outputRoot, `${options.surface.version}.json`);
  writeFileSync(output, `${JSON.stringify(options.surface, null, 2)}\n`);
  return output;
}
