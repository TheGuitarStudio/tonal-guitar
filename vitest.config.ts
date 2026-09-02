import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "scripts/**/*.test.mjs",
      "packages/*/src/**/*.test.{ts,tsx}",
    ],
  },
});
