import { readFileSync } from "node:fs";
import { listZipEntries, readZipEntry } from "./zip.js";

type CountSample = {
  value: string;
  count: number;
  samples: string[];
};

type ResourcepackModelSummary = {
  schemaVersion: 1;
  edition: "java";
  version: string;
  coverage: "client-resourcepack-models";
  files: {
    models: {
      count: number;
      groups: CountSample[];
    };
    itemDefinitions: {
      count: number;
      groups: CountSample[];
    };
  };
  modelJson: {
    topLevelKeys: CountSample[];
    fieldPaths: CountSample[];
    displayContexts: CountSample[];
    textureVariables: CountSample[];
    overridePredicateKeys: CountSample[];
  };
  itemDefinitionJson: {
    topLevelKeys: CountSample[];
    fieldPaths: CountSample[];
    modelTypes: CountSample[];
    propertyKeys: CountSample[];
  };
  sources: Array<{
    id: string;
    kind: string;
    url: string;
    retrievedAt: string;
  }>;
};

type Counter = Map<string, { count: number; samples: string[] }>;

function addCount(counter: Counter, value: string, sample: string): void {
  const entry = counter.get(value) ?? { count: 0, samples: [] };
  entry.count += 1;
  if (entry.samples.length < 5) {
    entry.samples.push(sample);
  }
  counter.set(value, entry);
}

function toCountSamples(counter: Counter): CountSample[] {
  return [...counter.entries()]
    .sort(([leftValue, left], [rightValue, right]) => {
      const countDifference = right.count - left.count;
      return countDifference === 0 ? leftValue.localeCompare(rightValue) : countDifference;
    })
    .map(([value, entry]) => ({ value, ...entry }));
}

function groupPath(path: string): string {
  const parts = path.split("/");
  if (parts[2] === "items") {
    return parts.slice(0, 3).join("/");
  }
  return parts.slice(0, 4).join("/");
}

function jsonType(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function recordFieldPaths(value: unknown, path: string, sample: string, counter: Counter): void {
  if (Array.isArray(value)) {
    addCount(counter, `${path}[]`, sample);
    for (const item of value) {
      recordFieldPaths(item, `${path}[]`, sample, counter);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      addCount(counter, `${nextPath}:${jsonType(nested)}`, sample);
      recordFieldPaths(nested, nextPath, sample, counter);
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function collectObjectKeys(value: unknown, counter: Counter, sample: string): void {
  const record = asRecord(value);
  if (!record) {
    return;
  }
  for (const key of Object.keys(record)) {
    addCount(counter, key, sample);
  }
}

function collectStringField(value: unknown, key: string, counter: Counter, sample: string): void {
  const record = asRecord(value);
  const nested = record?.[key];
  if (typeof nested === "string") {
    addCount(counter, nested, sample);
  }
}

function parseJson(buffer: Buffer, path: string): unknown {
  try {
    return JSON.parse(buffer.toString("utf8")) as unknown;
  } catch (error) {
    throw new Error(`Failed to parse ${path}: ${error instanceof Error ? error.message : error}`);
  }
}

function collectModelJson(json: unknown, path: string, counters: ResourcepackModelCounters): void {
  const record = asRecord(json);
  if (!record) {
    return;
  }

  collectObjectKeys(record, counters.modelTopLevelKeys, path);
  recordFieldPaths(record, "", path, counters.modelFieldPaths);
  collectObjectKeys(record.display, counters.displayContexts, path);
  collectObjectKeys(record.textures, counters.textureVariables, path);

  if (Array.isArray(record.overrides)) {
    for (const override of record.overrides) {
      const overrideRecord = asRecord(override);
      collectObjectKeys(overrideRecord?.predicate, counters.overridePredicateKeys, path);
    }
  }
}

function collectItemDefinitionJson(
  json: unknown,
  path: string,
  counters: ResourcepackModelCounters,
): void {
  const record = asRecord(json);
  if (!record) {
    return;
  }

  collectObjectKeys(record, counters.itemDefinitionTopLevelKeys, path);
  recordFieldPaths(record, "", path, counters.itemDefinitionFieldPaths);
  collectStringField(record.model, "type", counters.itemDefinitionModelTypes, path);

  const model = asRecord(record.model);
  if (typeof model?.property === "string") {
    addCount(counters.itemDefinitionPropertyKeys, model.property, path);
  }
  collectStringField(model?.property, "type", counters.itemDefinitionPropertyKeys, path);
  collectStringField(model?.property, "property", counters.itemDefinitionPropertyKeys, path);
}

type ResourcepackModelCounters = {
  modelGroups: Counter;
  itemDefinitionGroups: Counter;
  modelTopLevelKeys: Counter;
  modelFieldPaths: Counter;
  displayContexts: Counter;
  textureVariables: Counter;
  overridePredicateKeys: Counter;
  itemDefinitionTopLevelKeys: Counter;
  itemDefinitionFieldPaths: Counter;
  itemDefinitionModelTypes: Counter;
  itemDefinitionPropertyKeys: Counter;
};

function createCounters(): ResourcepackModelCounters {
  return {
    modelGroups: new Map(),
    itemDefinitionGroups: new Map(),
    modelTopLevelKeys: new Map(),
    modelFieldPaths: new Map(),
    displayContexts: new Map(),
    textureVariables: new Map(),
    overridePredicateKeys: new Map(),
    itemDefinitionTopLevelKeys: new Map(),
    itemDefinitionFieldPaths: new Map(),
    itemDefinitionModelTypes: new Map(),
    itemDefinitionPropertyKeys: new Map(),
  };
}

export function buildResourcepackModelSummary(options: {
  version: string;
  clientJarPath: string;
  clientJarUrl: string;
  retrievedAt: string;
}): ResourcepackModelSummary {
  const jar = readFileSync(options.clientJarPath);
  const entries = listZipEntries(jar)
    .filter((entry) => !entry.directory)
    .map((entry) => entry.name)
    .sort();
  const modelFiles = entries.filter(
    (entry) => entry.startsWith("assets/") && entry.includes("/models/") && entry.endsWith(".json"),
  );
  const itemDefinitionFiles = entries.filter(
    (entry) => entry.startsWith("assets/") && entry.includes("/items/") && entry.endsWith(".json"),
  );
  const counters = createCounters();

  for (const path of modelFiles) {
    addCount(counters.modelGroups, groupPath(path), path);
    collectModelJson(parseJson(readZipEntry(jar, path), path), path, counters);
  }

  for (const path of itemDefinitionFiles) {
    addCount(counters.itemDefinitionGroups, groupPath(path), path);
    collectItemDefinitionJson(parseJson(readZipEntry(jar, path), path), path, counters);
  }

  return {
    schemaVersion: 1,
    edition: "java",
    version: options.version,
    coverage: "client-resourcepack-models",
    files: {
      models: {
        count: modelFiles.length,
        groups: toCountSamples(counters.modelGroups),
      },
      itemDefinitions: {
        count: itemDefinitionFiles.length,
        groups: toCountSamples(counters.itemDefinitionGroups),
      },
    },
    modelJson: {
      topLevelKeys: toCountSamples(counters.modelTopLevelKeys),
      fieldPaths: toCountSamples(counters.modelFieldPaths),
      displayContexts: toCountSamples(counters.displayContexts),
      textureVariables: toCountSamples(counters.textureVariables),
      overridePredicateKeys: toCountSamples(counters.overridePredicateKeys),
    },
    itemDefinitionJson: {
      topLevelKeys: toCountSamples(counters.itemDefinitionTopLevelKeys),
      fieldPaths: toCountSamples(counters.itemDefinitionFieldPaths),
      modelTypes: toCountSamples(counters.itemDefinitionModelTypes),
      propertyKeys: toCountSamples(counters.itemDefinitionPropertyKeys),
    },
    sources: [
      {
        id: "mojang-client-jar-resourcepack-models",
        kind: "official-extracted",
        url: options.clientJarUrl,
        retrievedAt: options.retrievedAt,
      },
    ],
  };
}
