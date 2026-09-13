import { expect, it } from "vitest";
import { migrateLegacyItemModel } from "./legacyItemModel.js";

it("preserves geometry and creates a separate definition without mutating input", () => {
  const input = {
    parent: "item/generated",
    textures: { layer0: "example:item/wand" },
    overrides: [
      { predicate: { custom_model_data: 1 }, model: "example:wand_red" },
      { predicate: { custom_model_data: 3 }, model: "example:wand_blue" },
    ],
  };
  const result = migrateLegacyItemModel("example:item/wand", input);
  expect(result.status).toBe("converted");
  expect(result.generated?.geometry).toEqual({ parent: input.parent, textures: input.textures });
  expect(result.generated?.itemDefinition.model.entries.map((entry) => entry.threshold)).toEqual([
    1, 3,
  ]);
  expect(input.overrides).toHaveLength(2);
  expect(migrateLegacyItemModel("example:item/wand", result.generated?.geometry).status).toBe(
    "unchanged",
  );
});
it.each([
  [{ predicate: { damage: 0.1 }, model: "example:broken" }],
  [{ predicate: { custom_model_data: 1, damaged: 1 }, model: "example:mixed" }],
  [
    { predicate: { custom_model_data: 2 }, model: "example:a" },
    { predicate: { custom_model_data: 1 }, model: "example:b" },
  ],
  [
    { predicate: { custom_model_data: 1 }, model: "example:a" },
    { predicate: { custom_model_data: 1 }, model: "example:b" },
  ],
  [{ predicate: { custom_model_data: 16777217 }, model: "example:a" }],
  [{ predicate: { custom_model_data: 0 }, model: "example:a" }],
  [{ predicate: { custom_model_data: -1 }, model: "example:a" }],
])("does not silently approximate unsupported override semantics", (...overrides) => {
  expect(migrateLegacyItemModel("example:item/test", { overrides }).status).toBe("unsupported");
});
