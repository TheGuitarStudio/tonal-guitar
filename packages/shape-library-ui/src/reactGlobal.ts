/**
 * `fretboard-ui`'s components (e.g. `Fretboard.tsx`) rely on their
 * consuming bundler injecting the automatic JSX runtime, the way Next.js's
 * SWC pipeline does — that package's own `tsconfig.json` sets
 * `"jsx": "preserve"`, deferring the actual transform to whichever bundler
 * consumes it, and its `.tsx` files never `import React` themselves.
 *
 * This package's own `tsconfig.json` sets `"jsx": "react-jsx"` so its own
 * files transform correctly under Vite/esbuild's per-file tsconfig
 * detection, but that detection is per-file: `fretboard-ui`'s own files
 * still resolve against `fretboard-ui`'s tsconfig, which still means
 * classic-mode `React.createElement` calls with no `React` import — a
 * `ReferenceError` under a bundler-less test runner (Vitest's raw esbuild
 * transform), even though it works fine inside Next.js (automatic JSX) or
 * Vite-with-`@vitejs/plugin-react` (also automatic).
 *
 * A bare identifier reference in any module falls back to `globalThis`
 * properties when nothing shadows it locally, so exposing `React` there
 * lets `fretboard-ui`'s classic-transformed `React.createElement` resolve
 * without editing that package. Side-effect-only; imported once by every
 * module in this package that renders a `fretboard-ui` component.
 */
import * as React from "react";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
