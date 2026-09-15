import { expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

it("advertises and dispatches migrate_legacy_item_model", async () => {
  expect(tools.some((t) => t.name === "migrate_legacy_item_model")).toBe(true);
  const result = await callMinecraftSkillsTool("migrate_legacy_item_model", {
    modelId: "example:item/base",
    model: { overrides: [{ predicate: { custom_model_data: 1 }, model: "example:wand" }] },
  });
  expect(JSON.parse(result.content[0]?.text ?? "").status).toBe("converted");
});
