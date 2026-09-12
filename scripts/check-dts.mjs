/**
 * Post-build guards on the published declaration output. Two failure modes,
 * both of which reach consumers as confusing type errors rather than as a
 * build failure here:
 *
 * 1. **Stub emit.** A tsup dts-emit race observed on CI runners occasionally
 *    produces a ~1.6 KB declaration file containing only the final
 *    `export { ... }` statement, with every declaration missing. Consumers
 *    with skipLibCheck then see all exports silently typed as error types.
 *    Every published entry point gets a minimum byte size and a marker
 *    declaration that must survive bundling. `minBytes` is a floor well under
 *    the real emit, not a target — bump it only if an entry point grows a lot.
 *
 * 2. **Unreachable subpath types.** A subpath declared only in `exports` is
 *    invisible to TypeScript's node10 resolver (`"moduleResolution": "node"`),
 *    which ignores `exports` entirely — the consumer gets TS2307 with the
 *    unhelpful "There are types at ..., but this result could not be resolved"
 *    hint. `typesVersions` is the shim that makes node10 find them, and it is
 *    easy to drop or let drift from `exports`. Rather than assert the field's
 *    shape, this runs TypeScript's own resolver against a throwaway consumer
 *    once per subpath, under node10 and nodenext, and requires both to land on
 *    the emitted `.d.ts`.
 */
import { statSync, readFileSync, mkdtempSync, mkdirSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG_NAME = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
).name;

const ENTRIES = [
  {
    files: ["dist/index.d.ts", "dist/index.d.mts"],
    marker: "interface FrettedNote",
    minBytes: 10_000,
  },
  {
    files: ["dist/chord-types.d.ts", "dist/chord-types.d.mts"],
    marker: "CHORD_TYPE_TABLE",
    minBytes: 1_000,
  },
];

// Subpath exports whose types every consumer must be able to resolve, whatever
// its `moduleResolution` setting. The bare package root is covered by the
// top-level `types` field and needs no shim.
const SUBPATHS = [{ specifier: "chord-types", expected: "dist/chord-types.d.ts" }];

let failed = false;

// ---- 1. stub-emit guard ----------------------------------------------------

for (const { files, marker, minBytes } of ENTRIES) {
  for (const file of files) {
    let size;
    try {
      size = statSync(path.join(REPO_ROOT, file)).size;
    } catch {
      console.error(`${file} is missing -- the build did not emit it.`);
      failed = true;
      continue;
    }

    const hasDeclarations = readFileSync(
      path.join(REPO_ROOT, file),
      "utf8",
    ).includes(marker);
    if (size < minBytes || !hasDeclarations) {
      console.error(
        `${file} looks like a stub emit (${size} bytes, ` +
          `${marker} declaration ${hasDeclarations ? "present" : "MISSING"}). ` +
          `Declaration bundling failed -- rerun the build.`,
      );
      failed = true;
    }
  }
}

// ---- 2. subpath type-resolution guard --------------------------------------

/**
 * Resolves `<pkg>/<specifier>` the way a consumer would, from a throwaway
 * project whose `node_modules/<pkg>` is a symlink to this checkout. Returns
 * the resolved declaration file, or `undefined` when the resolver finds
 * nothing.
 */
function resolveSubpathTypes(projectDir, specifier, moduleResolution) {
  const resolved = ts.resolveModuleName(
    `${PKG_NAME}/${specifier}`,
    path.join(projectDir, "probe.ts"),
    { moduleResolution, target: ts.ScriptTarget.ES2022 },
    ts.sys,
  ).resolvedModule;
  return resolved?.resolvedFileName;
}

let projectDir;
try {
  projectDir = mkdtempSync(path.join(tmpdir(), "check-dts-resolve-"));
  mkdirSync(path.join(projectDir, "node_modules"), { recursive: true });
  symlinkSync(REPO_ROOT, path.join(projectDir, "node_modules", PKG_NAME), "dir");

  const MODES = [
    // The one that regressed: TypeScript's pre-`exports` resolver, still the
    // default for `"module": "commonjs"` and used by this package's own
    // downstream consumer. Reaches subpath types only through `typesVersions`.
    ["node10", ts.ModuleResolutionKind.Node10],
    ["nodenext", ts.ModuleResolutionKind.NodeNext],
    ["bundler", ts.ModuleResolutionKind.Bundler],
  ];

  for (const { specifier, expected } of SUBPATHS) {
    for (const [label, moduleResolution] of MODES) {
      const resolvedFileName = resolveSubpathTypes(
        projectDir,
        specifier,
        moduleResolution,
      );

      if (resolvedFileName === undefined) {
        console.error(
          `${PKG_NAME}/${specifier} does not resolve under moduleResolution ` +
            `"${label}" -- a consumer on that setting gets TS2307. ` +
            `node10 needs a "typesVersions" entry pointing at ./${expected}; ` +
            `node16/nodenext/bundler need the "exports" entry.`,
        );
        failed = true;
        continue;
      }

      const relative = path.relative(REPO_ROOT, resolvedFileName);
      if (relative !== expected.split("/").join(path.sep)) {
        console.error(
          `${PKG_NAME}/${specifier} resolves to "${relative}" under ` +
            `moduleResolution "${label}", expected "${expected}".`,
        );
        failed = true;
      }
    }
  }
} finally {
  if (projectDir) rmSync(projectDir, { recursive: true, force: true });
}

if (failed) {
  process.exit(1);
}

console.log(
  "check-dts: declaration output verified, subpath types resolve under node10/nodenext/bundler",
);
