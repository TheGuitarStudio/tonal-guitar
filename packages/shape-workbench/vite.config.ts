import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VERSION } from "tonal-guitar";
import { workbenchIoPlugin } from "./src/plugins/workbench-io";

// packages/shape-workbench/vite.config.ts -> repo root is two levels up.
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

export default defineConfig({
  resolve: {
    // packages/* are file:-linked (no npm workspaces) — a package-local
    // `npm install` can leave its own copy of React in
    // packages/shape-workbench/node_modules, distinct from the one
    // fretboard-ui/shape-library-ui resolve to. Two React instances in one
    // bundle break hooks; dedupe pins every import to a single copy
    // (mirrors root vitest.config.ts's identical fix for the test run).
    dedupe: ["react", "react-dom"],
  },
  plugins: [
    react(),
    // `apply: "serve"` — this plugin (and everything it imports) is only
    // ever wired in here, a Node-side config file `vite build` never
    // bundles. No client-side module may import `./src/plugins/workbench-io`
    // directly; that's what keeps it out of the production bundle.
    workbenchIoPlugin({ repoRoot, libraryVersion: VERSION }),
  ],
});
