import { expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

it("advertises and dispatches compare_migration_captures", async () => {
  expect(tools.some((t) => t.name === "compare_migration_captures")).toBe(true);
  const result = await callMinecraftSkillsTool("compare_migration_captures", {
    before: {},
    after: {},
  });
  expect(result.isError).toBe(true);
});
