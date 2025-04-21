import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/**/!(*.test).ts"],
  format: ["esm"],
  outDir: "dist",
  treeshake: true,
  bundle: false,
  splitting: false,
});
