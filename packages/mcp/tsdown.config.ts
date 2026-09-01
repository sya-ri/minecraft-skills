import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  deps: {
    alwaysBundle: ["@minecraft-skills/evaluation-core"],
    neverBundle: ["@minecraft-skills/catalog", "@modelcontextprotocol/sdk"],
  },
});
