import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/!(*.test).ts"],
  outDir: "dist",
  format: ["esm"],
  clean: true,
  dts: true,
  treeshake: true,
  unbundle: true,
});
