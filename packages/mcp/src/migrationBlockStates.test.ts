import { expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

it("advertises and dispatches report-backed block-state normalization", async () => {
  expect(tools.some((t) => t.name === "normalize_migration_block_states")).toBe(true);
  const result = await callMinecraftSkillsTool("normalize_migration_block_states", {
    version: "fixture",
    source: "fixture report",
    blocks: { "test:block": { states: [{ id: 0, default: true }] } },
    states: [{ Name: "test:block" }],
  });
  expect(JSON.parse(result.content[0]?.text ?? "").states).toEqual([
    { Name: "test:block", Properties: {} },
  ]);
});
