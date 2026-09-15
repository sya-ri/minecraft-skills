import { expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

it("exposes and routes texture metadata validation", async () => {
  expect(tools.find((t) => t.name === "validate_texture_metadata")?.inputSchema).toMatchObject({
    required: ["metadata", "width", "height"],
    additionalProperties: false,
  });
  const result = await callMinecraftSkillsTool("validate_texture_metadata", {
    metadata: { animation: { frames: [0, 3] } },
    width: 16,
    height: 64,
  });
  expect(result.isError).toBeUndefined();
  expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
    valid: true,
    validationComplete: true,
    frameCount: 4,
  });
  const bad = await callMinecraftSkillsTool("validate_texture_metadata", {
    metadata: { animation: { frames: [4] } },
    width: 16,
    height: 64,
  });
  expect(JSON.parse(bad.content[0]?.text ?? "{}").valid).toBe(false);
});
