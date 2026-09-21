import { compareCodeUnits } from "./compareCodeUnits.js";
/** Offline comparison only: acquisition, normalization and render provenance are caller evidence. */
export type MigrationSnapshot = {
  version: string;
  coverage: string;
  complete: boolean;
  records: Array<{ key: string; value: unknown }>;
};

const MAX_RECORDS = 100_000;
const MAX_JSON_BYTES = 16 * 1024 * 1024;

function canonical(value: unknown, depth = 0, budget = { nodes: 0, characters: 0 }): string {
  if (++budget.nodes > 1_000_000) throw new Error("Snapshot value node limit exceeded");
  if (typeof value === "string") {
    budget.characters += value.length;
    if (budget.characters > MAX_JSON_BYTES) throw new Error("Snapshot string limit exceeded");
  }
  if (depth > 32) throw new Error("Snapshot nesting exceeds 32 levels");
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${Array.from(value, (entry) => canonical(entry, depth + 1, budget)).join(",")}]`;
  if (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return `{${Object.keys(value)
      .sort(compareCodeUnits)
      .map(
        (key) =>
          `${canonical(key, depth + 1, budget)}:${canonical((value as Record<string, unknown>)[key], depth + 1, budget)}`,
      )
      .join(",")}}`;
  }
  throw new Error("Snapshots accept finite, plain JSON values only");
}

function snapshot(value: unknown): { input: MigrationSnapshot; records: Map<string, string> } {
  if (!value || typeof value !== "object") throw new Error("Expected snapshot object");
  const input = value as MigrationSnapshot;
  if (
    typeof input.version !== "string" ||
    !input.version ||
    typeof input.coverage !== "string" ||
    !input.coverage ||
    typeof input.complete !== "boolean" ||
    !Array.isArray(input.records) ||
    input.records.length > MAX_RECORDS
  ) {
    throw new Error("Snapshot requires version, coverage, complete and at most 100000 records");
  }
  const records = new Map<string, string>();
  let size = 0;
  for (const record of input.records) {
    if (
      !record ||
      typeof record.key !== "string" ||
      record.key.length === 0 ||
      record.key.length > 512 ||
      records.has(record.key)
    )
      throw new Error(
        "Snapshot record keys must be unique nonempty strings of at most 512 characters",
      );
    const encoded = canonical(record.value);
    size += Buffer.byteLength(record.key) + Buffer.byteLength(encoded);
    if (size > MAX_JSON_BYTES) throw new Error("Snapshot exceeds 16 MiB of normalized data");
    records.set(record.key, encoded);
  }
  return { input, records };
}

/** Compares keyed normalized blocks, entities or items, without inferring NBT conversion semantics. */
export function compareMigrationSnapshots(beforeValue: unknown, afterValue: unknown) {
  const before = snapshot(beforeValue);
  const after = snapshot(afterValue);
  const changes: Array<{ key: string; kind: "added" | "removed" | "changed" }> = [];
  let differenceCount = 0;
  for (const key of [...new Set([...before.records.keys(), ...after.records.keys()])].sort(
    compareCodeUnits,
  )) {
    if (before.records.get(key) === after.records.get(key)) continue;
    differenceCount++;
    if (changes.length < 100)
      changes.push({
        key,
        kind: !before.records.has(key) ? "added" : !after.records.has(key) ? "removed" : "changed",
      });
  }
  const comparable =
    before.input.complete &&
    after.input.complete &&
    before.input.coverage === after.input.coverage &&
    before.records.size > 0 &&
    after.records.size > 0;
  return {
    schemaVersion: 1,
    status: comparable ? (differenceCount === 0 ? "equal" : "different") : "incomplete",
    comparisonStrength: "caller-normalized-records",
    beforeVersion: before.input.version,
    afterVersion: after.input.version,
    coverageMatches: before.input.coverage === after.input.coverage,
    beforeRecords: before.records.size,
    afterRecords: after.records.size,
    differenceCount,
    changes,
    truncated: differenceCount > changes.length,
    limitations: [
      "Does not read worlds, validate caller coverage, infer version conversions, or prove gameplay/render equivalence.",
    ],
  };
}
