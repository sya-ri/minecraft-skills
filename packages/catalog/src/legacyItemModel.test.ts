import { expect, it } from "vitest";
import { migrateLegacyItemModel } from "./legacyItemModel.js";

type Model = NonNullable<
  ReturnType<typeof migrateLegacyItemModel>["generated"]
>["itemDefinition"]["model"];
function select(node: Model, value: number, damaged = false): string {
  if (node.type === "minecraft:model") return node.model;
  if (node.type === "minecraft:condition")
    return select(damaged ? node.on_true : node.on_false, value, damaged);
  return select(
    node.entries.filter((e) => e.threshold <= Math.fround(value)).at(-1)?.model ?? node.fallback,
    value,
    damaged,
  );
}
function converted(input: object) {
  const result = migrateLegacyItemModel("example:item/base", input);
  expect(result.status).toBe("converted");
  if (!result.generated) throw new Error("Expected converted model");
  return result.generated;
}

it("preserves geometry without mutating the input", () => {
  const input = {
    parent: "item/generated",
    textures: { layer0: "example:item/wand" },
    overrides: [
      { predicate: { custom_model_data: 1 }, model: "example:red" },
      { predicate: { custom_model_data: 3 }, model: "example:blue" },
    ],
  };
  const result = converted(input);
  expect(result.geometry).toEqual({ parent: input.parent, textures: input.textures });
  expect([0, 1, 2, 3, 100].map((v) => select(result.itemDefinition.model, v))).toEqual([
    "example:item/base",
    "example:red",
    "example:red",
    "example:blue",
    "example:blue",
  ]);
  expect(input.overrides).toHaveLength(2);
  expect(migrateLegacyItemModel("example:item/base", result.geometry).status).toBe("unchanged");
});

it("retains source order for duplicates and lower thresholds that shadow earlier entries", () => {
  const result = converted({
    overrides: [
      { predicate: { custom_model_data: 8 }, model: "example:high" },
      { predicate: { custom_model_data: 2 }, model: "example:early" },
      { predicate: { custom_model_data: 2 }, model: "example:late" },
      { predicate: { custom_model_data: 5 }, model: "example:middle" },
    ],
  });
  expect([0, 2, 4, 5, 8, 99].map((v) => select(result.itemDefinition.model, v))).toEqual([
    "example:item/base",
    "example:late",
    "example:late",
    "example:middle",
    "example:middle",
    "example:middle",
  ]);
});

it("preserves normalized damage boundaries and both damaged branches", () => {
  const result = converted({
    overrides: [
      { predicate: { damage: 0.1, damaged: 0 }, model: "example:base" },
      { predicate: { damage: 0.2, damaged: 1 }, model: "example:used" },
      { predicate: { damage: 0.4 }, model: "example:shared" },
    ],
  });
  expect(select(result.itemDefinition.model, 0.2, false)).toBe("example:base");
  expect(select(result.itemDefinition.model, 0.2, true)).toBe("example:used");
  expect(select(result.itemDefinition.model, 0.4, false)).toBe("example:shared");
  expect(select(result.itemDefinition.model, 0.4, true)).toBe("example:shared");
});

it("compares a wide durability dispatch against the independent last-match evaluator", () => {
  const overrides = Array.from({ length: 2048 }, (_, i) => ({
    predicate: { damage: ((i * 641) % 2048) / 2048, damaged: i % 3 === 0 ? 1 : 0 },
    model: `example:variant_${i % 7}`,
  }));
  const model = converted({ overrides }).itemDefinition.model;
  for (const damaged of [false, true]) {
    for (let damage = 0; damage <= 4096; damage++) {
      const value = Math.fround(damage / 4096);
      const expected =
        overrides.findLast(
          (o) => value >= Math.fround(o.predicate.damage) && Number(damaged) >= o.predicate.damaged,
        )?.model ?? "example:item/base";
      expect(select(model, value, damaged)).toBe(expected);
    }
  }
});

it.each([
  [{ predicate: { damage: 0.1, custom_model_data: 2 }, model: "example:mixed" }],
  [{ predicate: { custom_model_data: 1, damaged: 1 }, model: "example:mixed" }],
  [{ predicate: { damage: 0.1, damaged: null }, model: "example:null" }],
  [{ predicate: { damage: 0.1, damaged: 0.5 }, model: "example:fraction" }],
  [{ predicate: { custom_model_data: 16777217 }, model: "example:inexact" }],
  [{ predicate: { custom_model_data: 0 }, model: "example:zero" }],
  [{ predicate: { damage: -1 }, model: "example:negative" }],
  [{ predicate: { damage: 2 }, model: "example:outside" }],
  [{ predicate: { pulling: 1 }, model: "example:unknown" }],
  [
    { predicate: { damage: 0.1 }, model: "example:damage" },
    { predicate: { custom_model_data: 1 }, model: "example:cmd" },
  ],
])("rejects unsupported semantics instead of approximating them", (...overrides) => {
  expect(migrateLegacyItemModel("example:item/base", { overrides }).status).toBe("unsupported");
});

it("bounds oversized override arrays and model input", () => {
  const override = { predicate: { damage: 0.1 }, model: "example:item/a" };
  expect(() =>
    migrateLegacyItemModel("example:item/base", { overrides: Array(4097).fill(override) }),
  ).toThrow("4096");
  expect(() =>
    migrateLegacyItemModel("example:item/base", { text: "x".repeat(2 * 1024 * 1024) }),
  ).toThrow("2 MiB");
});
