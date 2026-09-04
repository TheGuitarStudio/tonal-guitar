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
  // `fretboard-ui` ships raw .tsx source with `"jsx": "preserve"` in its own
  // tsconfig.json, deliberately deferring the JSX transform to whichever
  // bundler consumes it (Next's SWC and Vite-with-@vitejs/plugin-react both
  // always use the automatic runtime regardless of that per-package
  // tsconfig). Vitest's own transform is plain esbuild with no such plugin,
  // so without an explicit override it picks up "preserve" per-file via the
  // nearest tsconfig and falls back to classic mode (`React.createElement`
  // with no `React` import in scope) — a ReferenceError under test. Forcing
  // the automatic runtime here for every test file matches what Next/Vite
  // already do, so this is a testing-environment-only fix (CR-036).
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: [
      "src/**/*.test.ts",
      "scripts/**/*.test.mjs",
      "packages/*/src/**/*.test.{ts,tsx}",
    ],
  },
});
