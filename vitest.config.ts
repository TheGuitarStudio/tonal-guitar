import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The packages/* directories are file:-linked (no npm workspaces), so a
    // package-local `npm install` can leave its own copy of React in
    // packages/<pkg>/node_modules. Two React instances in one test process
    // break hooks ("Invalid hook call"); dedupe pins every import of
    // react/react-dom to the root install.
    dedupe: ["react", "react-dom"],
  },
  test: {
    include: [
      "src/**/*.test.ts",
      "scripts/**/*.test.mjs",
      "packages/*/src/**/*.test.{ts,tsx}",
    ],
  },
});
