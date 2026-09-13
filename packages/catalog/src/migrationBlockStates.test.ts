import { expect, it } from "vitest";
import { normalizeMigrationBlockStates } from "./migrationBlockStates.js";

function input(states: unknown[] = [{ Name: "test:gate" }]) {
  return {
    version: "fixture-version",
    source: "generated fixture report",
    blocks: {
      "test:gate": {
        properties: { powered: ["false", "true"] },
        states: [
          { id: 1, default: true, properties: { powered: "false" } },
          { id: 2, properties: { powered: "true" } },
        ],
      },
      "test:stone": { states: [{ id: 3, default: true }] },
    },
    states,
  };
}
it("fills only report defaults and preserves explicit state differences", () => {
  const source = input([
    { Name: "test:gate" },
    { Name: "test:gate", Properties: { powered: "true" } },
    { Name: "test:stone" },
  ]);
  const saved = structuredClone(source);
  const result = normalizeMigrationBlockStates(source);
  expect(result.states).toEqual([
    { Name: "test:gate", Properties: { powered: "false" } },
    { Name: "test:gate", Properties: { powered: "true" } },
    { Name: "test:stone", Properties: {} },
  ]);
  expect(result.defaultedStates).toBe(1);
  expect(result.defaultedProperties).toBe(1);
  expect(source).toEqual(saved);
  expect(normalizeMigrationBlockStates(input(result.states)).states).toEqual(result.states);
});
it.each(
  [
    [{ Name: "test:unknown" }],
    [{ Name: "test:gate", Properties: { powered: "maybe" } }],
    [{ Name: "test:gate", Properties: { missing: "false" } }],
    [{ Name: "test:gate", extra: true }],
    [],
  ].map((states) => ({ states })),
)("rejects unknown or empty input coverage: %j", ({ states }) => {
  expect(() => normalizeMigrationBlockStates(input(states))).toThrow();
});
it("requires exactly one report default and unique combinations", () => {
  const missing = input();
  missing.blocks["test:gate"].states = missing.blocks["test:gate"].states.map((s) => ({
    ...s,
    default: false,
  }));
  expect(() => normalizeMigrationBlockStates(missing)).toThrow("no default");
  const multiple = input();
  multiple.blocks["test:gate"].states = multiple.blocks["test:gate"].states.map((s) => ({
    ...s,
    default: true,
  }));
  expect(() => normalizeMigrationBlockStates(multiple)).toThrow("More than one");
  const duplicate = input();
  duplicate.blocks["test:gate"].states.push({ id: 3, properties: { powered: "true" } });
  expect(() => normalizeMigrationBlockStates(duplicate)).toThrow("Duplicate");
});
it("rejects a combination absent from the report, even if individual values exist", () => {
  const value = {
    version: "v",
    source: "fixture",
    blocks: {
      "test:pair": {
        properties: { a: ["false", "true"], b: ["false", "true"] },
        states: [
          { default: true, properties: { a: "false", b: "false" } },
          { properties: { a: "true", b: "true" } },
        ],
      },
    },
    states: [{ Name: "test:pair", Properties: { a: "true" } }],
  };
  expect(() => normalizeMigrationBlockStates(value)).toThrow("combination");
});
it("rejects malformed reports, prototypes and excessive state lists", () => {
  expect(() => normalizeMigrationBlockStates({ ...input(), blocks: {} })).toThrow();
  expect(() =>
    normalizeMigrationBlockStates({ ...input(), blocks: Object.create(null) }),
  ).toThrow();
  expect(() =>
    normalizeMigrationBlockStates(input(Array(100001).fill({ Name: "test:stone" }))),
  ).toThrow();
  const bad = input();
  bad.blocks["test:gate"].properties.powered.push("false");
  expect(() => normalizeMigrationBlockStates(bad)).toThrow("Duplicate report property");
});
