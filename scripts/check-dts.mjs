/**
 * Guards against a tsup dts-emit race observed on CI runners: the bundled
 * declaration file occasionally comes out as a ~1.6 KB stub containing only
 * the final `export { ... }` statement, with every declaration missing.
 * Consumers with skipLibCheck then see all exports silently typed as error
 * types instead of a build failure, which is miserable to diagnose downstream.
 * Fail the build loudly instead.
 */
import { statSync, readFileSync } from "node:fs";

const MIN_BYTES = 10_000;

for (const file of ["dist/index.d.ts", "dist/index.d.mts"]) {
  const size = statSync(file).size;
  const hasDeclarations = readFileSync(file, "utf8").includes("interface FrettedNote");
  if (size < MIN_BYTES || !hasDeclarations) {
    console.error(
      `${file} looks like a stub emit (${size} bytes, ` +
        `FrettedNote declaration ${hasDeclarations ? "present" : "MISSING"}). ` +
        `Declaration bundling failed -- rerun the build.`
    );
    process.exit(1);
  }
}

console.log("check-dts: declaration output verified");
