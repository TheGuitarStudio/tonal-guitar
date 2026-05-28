import { effectiveModeForSystem } from "fretboard-ui";

/**
 * A snapshot of pipeline inputs sufficient to regenerate a sequence —
 * either the live preview or a frozen chain entry.
 */
export interface PipelineRecipe {
  tuningName: string;
  /** Library constant for the tuning, e.g. "STANDARD". */
  tuningConst: string;
  shapeName: string;
  shapeSystem: string;
  root: string;
  modeId: string;
  showOpenStrings: boolean;
  /** Resolved motif (degree array) — empty means "no motif, just play the scale". */
  motif: number[];
  /** Display name (e.g. "Thirds (1,3)") — used in human-readable comments. */
  motifName: string;
  walkFullShape: boolean;
  direction: "ascending" | "descending";
}

export type Selection =
  | { kind: "current" }
  | { kind: "chainEntry"; index: number }
  | { kind: "chain" };

export interface CodeGenInput {
  selection: Selection;
  current: PipelineRecipe;
  chain: Array<{ label: string; recipe: PipelineRecipe }>;
  outputFormat: "ascii" | "alphatex" | "json";
  tempo: number;
  duration: 4 | 8 | 16;
  bridgeEnabled: boolean;
  connectorsAndNextNotes: Array<{
    connector: unknown[];
    nextNotes: unknown[];
    strategy: "none" | "extend" | "reach-back";
  }>;
}

interface CodeGenResult {
  code: string;
}

function buildImportBlock(pkg: string, symbols: Set<string>): string {
  if (symbols.size === 0) return "";
  const sorted = [...symbols].sort();
  if (sorted.length <= 3) {
    return `import { ${sorted.join(", ")} } from "${pkg}";`;
  }
  return `import {\n${sorted.map((s) => `  ${s}`).join(",\n")},\n} from "${pkg}";`;
}

/**
 * Emit the code for a single segment (one buildFrettedScale + optional walk).
 * Returns the lines plus the variable name holding the resulting FrettedNote[].
 *
 * When `suffix` is empty, vars are unsuffixed (`shape`, `scale`, `notes`) so
 * a one-shot preview reads naturally. With a suffix, vars become `shape1`,
 * `scale1`, `notes1` so multiple segments can coexist.
 */
function emitSegment(
  recipe: PipelineRecipe,
  suffix: string,
  tonal: Set<string>,
  fretboardUi: Set<string>,
): { lines: string[]; notesVar: string; scaleVar: string; motifVar: string } {
  const lines: string[] = [];
  const shapeVar = `shape${suffix}`;
  const scaleVar = `scale${suffix}`;
  const motifVar = `motif${suffix}`;
  const notesVar = `notes${suffix}`;
  const buildRootVar = `buildRoot${suffix}`;

  tonal.add("get");
  tonal.add(recipe.tuningConst);
  tonal.add("buildFrettedScale");
  lines.push(`const ${shapeVar} = get(${JSON.stringify(recipe.shapeName)});`);

  // Modal context: shift root to the parent (e.g. B dorian -> A ionian).
  const effective = effectiveModeForSystem(recipe.modeId, recipe.shapeSystem);
  const needsModalShift =
    effective != null &&
    effective !== "ionian" &&
    effective !== "major-pent" &&
    recipe.modeId !== "ionian" &&
    recipe.modeId !== "major-pent";

  let buildRootExpr = JSON.stringify(recipe.root);
  if (needsModalShift) {
    fretboardUi.add("parentRoot");
    lines.push(
      `// "${recipe.root}" + ${recipe.modeId} -> parent = ${effective}`,
    );
    lines.push(
      `const ${buildRootVar} = parentRoot(${JSON.stringify(recipe.root)}, ${JSON.stringify(effective)}) ?? ${JSON.stringify(recipe.root)};`,
    );
    buildRootExpr = buildRootVar;
  }

  const buildOpts = !recipe.showOpenStrings
    ? ", { allowOpenStrings: false }"
    : "";
  lines.push(
    `const ${scaleVar} = buildFrettedScale(${shapeVar}, ${buildRootExpr}, ${recipe.tuningConst}${buildOpts});`,
  );

  const descending = recipe.direction === "descending";

  if (recipe.motif.length === 0) {
    // No motif — just play the scale's notes (possibly reversed for descending).
    lines.push(`const ${motifVar} = [];`);
    if (descending) {
      lines.push(
        `const ${notesVar} = [...${scaleVar}.notes].sort((a, b) => b.midi - a.midi);`,
      );
    } else {
      lines.push(`const ${notesVar} = ${scaleVar}.notes;`);
    }
    return { lines, notesVar, scaleVar, motifVar };
  }

  const motifLiteral = `[${recipe.motif.join(", ")}]`;
  lines.push(`const ${motifVar} = ${motifLiteral};`);
  if (recipe.walkFullShape) {
    tonal.add("walkShapeMotif");
    lines.push(
      `const ${notesVar} = walkShapeMotif(${scaleVar}, ${motifVar}${descending ? `, { direction: "descending" }` : ""});`,
    );
  } else {
    tonal.add("walkPattern");
    if (descending) {
      lines.push(
        `const ${notesVar} = walkPattern(${scaleVar}, [...${motifVar}].reverse());`,
      );
    } else {
      lines.push(`const ${notesVar} = walkPattern(${scaleVar}, ${motifVar});`);
    }
  }

  return { lines, notesVar, scaleVar, motifVar };
}

function emitOutput(
  notesVar: string,
  tuningConst: string,
  key: string,
  title: string,
  input: Pick<CodeGenInput, "outputFormat" | "tempo" | "duration">,
  tonal: Set<string>,
): string[] {
  const lines: string[] = [];
  if (input.outputFormat === "ascii") {
    tonal.add("toAsciiTab");
    lines.push(
      `console.log(toAsciiTab(${notesVar}, { tuning: ${tuningConst} }));`,
    );
  } else if (input.outputFormat === "alphatex") {
    tonal.add("toAlphaTeX");
    lines.push(`console.log(`);
    lines.push(`  toAlphaTeX(${notesVar}, {`);
    lines.push(`    title: ${JSON.stringify(title)},`);
    lines.push(`    tempo: ${input.tempo},`);
    lines.push(`    duration: ${input.duration},`);
    lines.push(`    tuning: ${tuningConst},`);
    lines.push(`    key: ${JSON.stringify(key)},`);
    lines.push(`  }),`);
    lines.push(`);`);
  } else {
    lines.push(`console.log(JSON.stringify(${notesVar}, null, 2));`);
  }
  return lines;
}

export function generateCode(input: CodeGenInput): CodeGenResult {
  const tonal = new Set<string>();
  const fretboardUi = new Set<string>();
  const lines: string[] = [];

  // Pick which recipe(s) to emit based on selection.
  if (input.selection.kind === "chain" && input.chain.length > 0) {
    // Multi-segment chain. Suffixed vars per entry, then concat.
    const scaleVars: string[] = [];
    const motifVars: string[] = [];
    const notesVars: string[] = [];
    input.chain.forEach((entry, i) => {
      const suffix = String(i + 1);
      if (i > 0) lines.push("");
      lines.push(`// ${i + 1}. ${entry.label}`);
      const seg = emitSegment(entry.recipe, suffix, tonal, fretboardUi);
      lines.push(...seg.lines);
      scaleVars.push(seg.scaleVar);
      motifVars.push(seg.motifVar);
      notesVars.push(seg.notesVar);
    });
    lines.push("");
    if (input.bridgeEnabled && input.chain.length >= 2) {
      tonal.add("connectSequences");
      for (let k = 1; k < input.chain.length; k++) {
        const strategy = input.connectorsAndNextNotes[k - 1].strategy;
        lines.push(`// seam ${k + 1}: ${strategy}`);
        lines.push(
          `const seam${k + 1} = connectSequences({ prev: { scale: ${scaleVars[k - 1]}, lastNote: ${notesVars[k - 1]}[${notesVars[k - 1]}.length - 1], direction: ${JSON.stringify(input.chain[k - 1].recipe.direction)} }, next: { scale: ${scaleVars[k]}, motif: ${motifVars[k]}, direction: ${JSON.stringify(input.chain[k].recipe.direction)} } });`,
        );
        lines.push(`const connector${k + 1} = seam${k + 1}.connector;`);
        lines.push(`const nextNotes${k + 1} = seam${k + 1}.nextNotes;`);
      }
      const concatParts: string[] = [`...${notesVars[0]}`];
      for (let k = 1; k < input.chain.length; k++) {
        concatParts.push(`...connector${k + 1}`);
        concatParts.push(`...nextNotes${k + 1}`);
      }
      lines.push(`const chain = [${concatParts.join(", ")}];`);
    } else {
      lines.push(
        `const chain = [${notesVars.map((v) => `...${v}`).join(", ")}];`,
      );
    }
    lines.push("");
    // Tuning/key for the rendering match the runtime: it uses the current
    // pipeline's tuning + root, even when entries differ (alphaTab tracks
    // are single-tuning anyway).
    lines.push(
      ...emitOutput(
        "chain",
        input.current.tuningConst,
        input.current.root,
        "Chain",
        input,
        tonal,
      ),
    );
  } else {
    // Single segment — either "current" or one chain entry.
    let recipe = input.current;
    let title = `${recipe.root} ${recipe.shapeName}`;
    if (
      input.selection.kind === "chainEntry" &&
      input.chain[input.selection.index]
    ) {
      const entry = input.chain[input.selection.index];
      recipe = entry.recipe;
      title = entry.label;
    }
    const seg = emitSegment(recipe, "", tonal, fretboardUi);
    lines.push(...seg.lines);
    lines.push("");
    lines.push(
      ...emitOutput(
        seg.notesVar,
        recipe.tuningConst,
        recipe.root,
        title,
        input,
        tonal,
      ),
    );
  }

  const imports: string[] = [];
  const tg = buildImportBlock("tonal-guitar", tonal);
  if (tg) imports.push(tg);
  const fb = buildImportBlock("fretboard-ui", fretboardUi);
  if (fb) imports.push(fb);

  const code = [imports.join("\n"), lines.join("\n")]
    .filter(Boolean)
    .join("\n\n");
  return { code };
}
