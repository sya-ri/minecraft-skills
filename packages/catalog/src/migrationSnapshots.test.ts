import { describe, expect, it } from "vitest";
import { compareMigrationSnapshots } from "./migrationSnapshots.js";

const snapshot = (records: Array<{ key: string; value: unknown }>) => ({
  version: "source",
  coverage: "fixture:region+normalization-v1",
  complete: true,
  records,
});

describe("migration record comparison", () => {
  it("compares values independent of object or record ordering", () => {
    const a = snapshot([
      { key: "0,1,0", value: { block: "example:stone", properties: { facing: "north" } } },
    ]);
    const b = snapshot([
      { key: "0,1,0", value: { properties: { facing: "north" }, block: "example:stone" } },
    ]);
    expect(compareMigrationSnapshots(a, { ...b, version: "target" }).status).toBe("equal");
  });
  it("reports changed, removed and added coordinates without contents", () => {
    const result = compareMigrationSnapshots(
      snapshot([
        { key: "a", value: 1 },
        { key: "b", value: "private-text" },
      ]),
      snapshot([
        { key: "a", value: 2 },
        { key: "c", value: 1 },
      ]),
    );
    expect(result.differenceCount).toBe(3);
    expect(result.changes.map((change) => change.kind)).toEqual(["changed", "removed", "added"]);
    expect(JSON.stringify(result)).not.toContain("private-text");
  });
  it("never approves missing, incomplete or different coverage", () => {
    const a = snapshot([{ key: "a", value: 1 }]);
    expect(compareMigrationSnapshots(a, { ...a, complete: false }).status).toBe("incomplete");
    expect(compareMigrationSnapshots(a, { ...a, coverage: "elsewhere" }).status).toBe("incomplete");
    expect(compareMigrationSnapshots(snapshot([]), snapshot([])).status).toBe("incomplete");
  });
  it("rejects duplicate keys, nonfinite values and cycles", () => {
    expect(() =>
      compareMigrationSnapshots(
        snapshot([
          { key: "a", value: 1 },
          { key: "a", value: 2 },
        ]),
        snapshot([]),
      ),
    ).toThrow();
    expect(() =>
      compareMigrationSnapshots(snapshot([{ key: "a", value: NaN }]), snapshot([])),
    ).toThrow();
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    expect(() =>
      compareMigrationSnapshots(snapshot([{ key: "a", value: cyclic }]), snapshot([])),
    ).toThrow();
  });
  it("bounds returned changes without concealing total count", () => {
    const records = Array.from({ length: 101 }, (_, i) => ({ key: String(i), value: i }));
    const result = compareMigrationSnapshots(
      snapshot(records),
      snapshot(records.map((r) => ({ ...r, value: -1 }))),
    );
    expect(result.differenceCount).toBe(101);
    expect(result.changes).toHaveLength(100);
    expect(result.truncated).toBe(true);
  });
});
