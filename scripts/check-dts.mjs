/**
 * Guards against a tsup dts-emit race observed on CI runners: the bundled
 * declaration file occasionally comes out as a ~1.6 KB stub containing only
 * the final `export { ... }` statement, with every declaration missing.
 * Consumers with skipLibCheck then see all exports silently typed as error
 * types instead of a build failure, which is miserable to diagnose downstream.
 * Fail the build loudly instead.
 *
 * Every published entry point gets a check: a minimum byte size and a marker
 * declaration that must survive bundling. `minBytes` is a floor well under the
 * real emit, not a target — bump it only if an entry point grows a lot.
 */
import { statSync, readFileSync } from "node:fs";

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

let failed = false;

for (const { files, marker, minBytes } of ENTRIES) {
  for (const file of files) {
    let size;
    try {
      size = statSync(file).size;
    } catch {
      console.error(`${file} is missing -- the build did not emit it.`);
      failed = true;
      continue;
    }

    const hasDeclarations = readFileSync(file, "utf8").includes(marker);
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

if (failed) {
  process.exit(1);
}

console.log("check-dts: declaration output verified");
