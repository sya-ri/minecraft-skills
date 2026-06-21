import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  deps: {
    neverBundle: ["@minecraft-skills/catalog", "@minecraft-skills/data"],
  },
});
