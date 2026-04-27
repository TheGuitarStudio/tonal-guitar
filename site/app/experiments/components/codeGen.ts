import { effectiveModeForSystem } from "fretboard-ui";

export interface CodeGenInput {
  tuningName: string;
  /** Library constant for the tuning, e.g. "STANDARD". */
  tuningConst: string;
  shapeName: string;
  shapeSystem: string;
  root: string;
  modeId: string;
  showOpenStrings: boolean;

  /** Resolved motif (degree array) — empty array means "no motif, just play the scale". */
  motif: number[];
  /** Display name (e.g. "Thirds (1,3)") — used to detect the "Linear (1)" shorthand. */
  motifName: string;
  walkFullShape: boolean;

  outputFormat: "ascii" | "alphatex" | "json";
  tempo: number;
}

interface CodeGenResult {
  code: string;
}

function buildImportBlock(
  pkg: string,
  symbols: Set<string>,
): string {
  if (symbols.size === 0) return "";
  const sorted = [...symbols].sort();
  if (sorted.length <= 3) {
    return `import { ${sorted.join(", ")} } from "${pkg}";`;
  }
  return `import {\n${sorted.map((s) => `  ${s}`).join(",\n")},\n} from "${pkg}";`;
}

export function generateCode(input: CodeGenInput): CodeGenResult {
  const tonal = new Set<string>();
  const fretboardUi = new Set<string>();
  const lines: string[] = [];

  // Tuning
  tonal.add(input.tuningConst);

  // Shape
  tonal.add("get");
  lines.push(`const shape = get(${JSON.stringify(input.shapeName)});`);

  // Modal context
  const effective = effectiveModeForSystem(input.modeId, input.shapeSystem);
  const needsModalShift =
    effective != null &&
    effective !== "ionian" &&
    effective !== "major-pent" &&
    input.modeId !== "ionian" &&
    input.modeId !== "major-pent";

  let buildRootExpr = JSON.stringify(input.root);
  if (needsModalShift) {
    fretboardUi.add("parentRoot");
    lines.push(
      `// "${input.root}" + ${input.modeId} -> parent = ${effective}`,
    );
    lines.push(
      `const buildRoot = parentRoot(${JSON.stringify(input.root)}, ${JSON.stringify(effective)}) ?? ${JSON.stringify(input.root)};`,
    );
    buildRootExpr = "buildRoot";
  }

  // Build
  tonal.add("buildFrettedScale");
  const buildOpts = !input.showOpenStrings
    ? ", { allowOpenStrings: false }"
    : "";
  lines.push(
    `const scale = buildFrettedScale(shape, ${buildRootExpr}, ${input.tuningConst}${buildOpts});`,
  );

  // Sequence (motif application)
  let resultVar = "scale.notes";
  if (input.motif.length > 0) {
    const motifLiteral = `[${input.motif.join(", ")}]`;
    if (input.walkFullShape) {
      tonal.add("walkShapeMotif");
      lines.push("");
      lines.push(`const motif = ${motifLiteral};`);
      lines.push(`const notes = walkShapeMotif(scale, motif);`);
    } else {
      tonal.add("walkPattern");
      lines.push("");
      lines.push(`const motif = ${motifLiteral};`);
      lines.push(`const notes = walkPattern(scale, motif);`);
    }
    resultVar = "notes";
  }

  // Output
  lines.push("");
  if (input.outputFormat === "ascii") {
    tonal.add("toAsciiTab");
    lines.push(
      `console.log(toAsciiTab(${resultVar}, { tuning: ${input.tuningConst} }));`,
    );
  } else if (input.outputFormat === "alphatex") {
    tonal.add("toAlphaTeX");
    lines.push(`console.log(`);
    lines.push(`  toAlphaTeX(${resultVar}, {`);
    lines.push(
      `    title: ${JSON.stringify(`${input.root} ${input.shapeName}`)},`,
    );
    lines.push(`    tempo: ${input.tempo},`);
    lines.push(`    duration: 8,`);
    lines.push(`    tuning: ${input.tuningConst},`);
    lines.push(`    key: ${JSON.stringify(input.root)},`);
    lines.push(`  }),`);
    lines.push(`);`);
  } else {
    lines.push(`console.log(JSON.stringify(${resultVar}, null, 2));`);
  }

  const imports: string[] = [];
  const tg = buildImportBlock("tonal-guitar", tonal);
  if (tg) imports.push(tg);
  const fb = buildImportBlock("fretboard-ui", fretboardUi);
  if (fb) imports.push(fb);

  const code = [imports.join("\n"), lines.join("\n")].filter(Boolean).join("\n\n");
  return { code };
}
