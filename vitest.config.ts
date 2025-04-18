import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.[jt]s?(x)"],
    environment: "jsdom",
    typecheck: {
      tsconfig: "./tsconfig.json",
    },
  },
});
