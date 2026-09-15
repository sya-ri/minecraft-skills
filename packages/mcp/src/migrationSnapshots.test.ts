import { expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

it("advertises and dispatches compare_migration_snapshots", async () => {
  expect(tools.some((t) => t.name === "compare_migration_snapshots")).toBe(true);
  const result = await callMinecraftSkillsTool("compare_migration_snapshots", {
    before: {
      version: "source",
      coverage: "test",
      complete: true,
      records: [{ key: "a", value: 1 }],
    },
    after: {
      version: "target",
      coverage: "test",
      complete: true,
      records: [{ key: "a", value: 1 }],
    },
  });
  expect(JSON.parse(result.content[0]?.text ?? "").status).toBe("equal");
});
