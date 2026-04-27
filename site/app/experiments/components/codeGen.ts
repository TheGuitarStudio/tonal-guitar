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

  patternType: string;
  customPattern: string;
  scaleLen: number;
  walkFullShape: boolean;

  seqType: string;
  customSeq: string;
  incremental: boolean;
  maxPasses: number;

  outputFormat: "ascii" | "alphatex" | "json";
  tempo: number;
}

interface CodeGenResult {
  code: string;
}

function patternExpr(
  type: string,
  scaleLen: number,
  customPattern: string,
): { expr: string; fn: string | null } {
  switch (type) {
    case "Ascending Thirds":
      return { expr: `thirds(${scaleLen})`, fn: "thirds" };
    case "Ascending Fourths":
      return { expr: `fourths(${scaleLen})`, fn: "fourths" };
    case "Ascending Sixths":
      return { expr: `sixths(${scaleLen})`, fn: "sixths" };
    case "Descending Thirds":
      return {
        expr: `descendingIntervals(${scaleLen}, 2)`,
        fn: "descendingIntervals",
      };
    case "Ascending Linear":
      return {
        expr: `ascendingLinear(1, ${scaleLen + 1})`,
        fn: "ascendingLinear",
      };
    case "Descending Linear":
      return {
        expr: `descendingLinear(${scaleLen + 1}, 1)`,
        fn: "descendingLinear",
      };
    case "Grouping (4s)":
      return { expr: `grouping(${scaleLen}, 4)`, fn: "grouping" };
    case "Custom Degrees": {
      const arr = customPattern
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      return { expr: `[${arr.join(", ")}]`, fn: null };
    }
    default:
      return { expr: "[]", fn: null };
  }
}

function shapeWalkerCall(
  type: string,
): { fn: string; expr: string } | null {
  switch (type) {
    case "Ascending Linear":
      return { fn: "walkShape", expr: `walkShape(scale)` };
    case "Descending Linear":
      return {
        fn: "walkShape",
        expr: `walkShape(scale, { direction: "descending" })`,
      };
    case "Ascending Thirds":
      return {
        fn: "walkShapeIntervals",
        expr: `walkShapeIntervals(scale, 2)`,
      };
    case "Ascending Fourths":
      return {
        fn: "walkShapeIntervals",
        expr: `walkShapeIntervals(scale, 3)`,
      };
    case "Ascending Sixths":
      return {
        fn: "walkShapeIntervals",
        expr: `walkShapeIntervals(scale, 5)`,
      };
    case "Descending Thirds":
      return {
        fn: "walkShapeIntervals",
        expr: `walkShapeIntervals(scale, 2, { direction: "descending" })`,
      };
    default:
      return null;
  }
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

  // Modal context — only relabel/translate if the effective mode shifts
  // away from the canonical (ionian for diatonic, major-pent for pent).
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

  // Pattern
  let walkedVar: string | null = null;
  if (input.patternType !== "None") {
    const customMode = input.patternType === "Custom Degrees";
    if (input.walkFullShape && !customMode) {
      // Shape-aware walkers — visit every position in the shape, end on the highest note.
      const call = shapeWalkerCall(input.patternType);
      if (call) {
        tonal.add(call.fn);
        lines.push("");
        lines.push(`const notes = ${call.expr};`);
        walkedVar = "notes";
      }
    } else {
      const p = patternExpr(
        input.patternType,
        input.scaleLen,
        input.customPattern,
      );
      tonal.add("walkPattern");
      if (p.fn) tonal.add(p.fn);
      lines.push("");
      lines.push(`const pattern = ${p.expr};`);
      lines.push(`const notes = walkPattern(scale, pattern);`);
      walkedVar = "notes";
    }
  }

  // Sequence
  let sequenceVar: string | null = null;
  if (input.seqType !== "None") {
    let seqExpr: string;
    if (input.seqType === "Custom") {
      const arr = input.customSeq
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      seqExpr = `[${arr.join(", ")}]`;
    } else {
      seqExpr = input.seqType;
      tonal.add(input.seqType);
    }
    tonal.add("applySequence");
    tonal.add("flattenSequence");
    const optParts = [
      `incremental: ${input.incremental}`,
      `boundToShape: true`,
    ];
    if (input.maxPasses > 0) optParts.push(`passes: ${input.maxPasses}`);
    lines.push("");
    lines.push(`const passes = applySequence(scale, ${seqExpr}, {`);
    optParts.forEach((p) => lines.push(`  ${p},`));
    lines.push(`});`);
    lines.push(`const allNotes = flattenSequence(passes);`);
    sequenceVar = "allNotes";
  }

  // Output
  const finalVar = sequenceVar ?? walkedVar ?? "scale.notes";
  lines.push("");
  if (input.outputFormat === "ascii") {
    tonal.add("toAsciiTab");
    lines.push(
      `console.log(toAsciiTab(${finalVar}, { tuning: ${input.tuningConst} }));`,
    );
  } else if (input.outputFormat === "alphatex") {
    tonal.add("toAlphaTeX");
    lines.push(`console.log(`);
    lines.push(`  toAlphaTeX(${finalVar}, {`);
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
    lines.push(`console.log(JSON.stringify(${finalVar}, null, 2));`);
  }

  const imports: string[] = [];
  const tg = buildImportBlock("tonal-guitar", tonal);
  if (tg) imports.push(tg);
  const fb = buildImportBlock("fretboard-ui", fretboardUi);
  if (fb) imports.push(fb);

  const code = [imports.join("\n"), lines.join("\n")].filter(Boolean).join("\n\n");
  return { code };
}
