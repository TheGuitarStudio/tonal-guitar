import { createMDX } from "fumadocs-mdx/next";
import { fileURLToPath } from "node:url";

const withMDX = createMDX();

// `transpilePackages` below are `file:`-linked, so webpack follows the
// symlinks and compiles their sources from `../packages/*/src`. Imports in
// those files (their peer deps: `tonal-guitar`, `shape-catalog`, ...) would
// then only resolve from `../packages/*/node_modules`, which exist only if
// each package was installed separately. Fall back to the site's own
// `node_modules`, where every one of those peers is a direct dependency, so a
// plain `npm ci` in `site/` is enough to build.
const siteNodeModules = fileURLToPath(new URL("./node_modules", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: process.env.DEPLOY ? "/tonal-guitar" : "",
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  transpilePackages: ["fretboard-ui", "shape-catalog", "shape-library-ui"],
  webpack: (config) => {
    config.resolve.modules = [...(config.resolve.modules ?? ["node_modules"]), siteNodeModules];
    return config;
  },
};

export default withMDX(nextConfig);
