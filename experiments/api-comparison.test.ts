/**
 * Experiment: API Design Comparison
 *
 * Tests 3 viable API approaches side-by-side with the same use case:
 * "A major ascending 3rds in E CAGED shape, output as AlphaTeX"
 *
 * Approach 1: Simple Functions (Tonal-aligned, musicians first)
 * Approach 2: Pipe/Compose (power users, functional)
 * Approach 3: Fluent/Builder (IDE discoverability)
 *
 * Also demonstrates: shape override, custom tuning, custom patterns
 *
 * Run: npm test -- packages/guitar/experiments/api-comparison.test.ts
 */
import { describe, expect, test } from "vitest";
import Note from "@tonaljs/note";

// ============================================================
// Shared types and engine (same as all-shapes.test.ts)
// ============================================================

interface Tuning { name: string; notes: string[] }
interface FrettedNote { string: number; fret: number; note: string; pc: string; interval: string; degree: number; midi: number }
interface FrettedScale { root: string; shapeName: string; tuning: Tuning; notes: FrettedNote[] }
interface ScaleShape { name: string; system: string; strings: (string[] | null)[]; rootString: number }

const STANDARD: Tuning = { name: "Standard", notes: ["E2", "A2", "D3", "G3", "B3", "E4"] };
const DROP_D: Tuning = { name: "Drop D", notes: ["D2", "A2", "D3", "G3", "B3", "E4"] };

// Shapes
const CAGED_E: ScaleShape = {
  name: "E Shape", system: "caged", rootString: 0,
  strings: [["1P","2M"],["4P","5P"],["7M","1P","2M"],["3M","4P","5P"],["6M","7M"],["1P","2M","3M"]],
};

const CAGED_A: ScaleShape = {
  name: "A Shape", system: "caged", rootString: 1,
  strings: [["7M","1P"],["3M","4P","5P"],["6M","7M","1P"],["2M","3M","4P"],["5P","6M"],["1P","2M"]],
};

// Engine
function buildFrettedScale(shape: ScaleShape, root: string, tuning: Tuning = STANDARD): FrettedScale {
  const notes: FrettedNote[] = [];
  const rootFret = findNearestFret(tuning, shape.rootString, root);
  if (rootFret == null) return { root, shapeName: shape.name, tuning, notes };
  for (let s = 0; s < shape.strings.length && s < tuning.notes.length; s++) {
    const intervals = shape.strings[s];
    if (!intervals) continue;
    for (const ivl of intervals) {
      const targetPc = Note.transpose(root, ivl);
      if (!targetPc) continue;
      const fret = findFretInPosition(tuning, s, targetPc, rootFret);
      if (fret == null) continue;
      const openMidi = Note.midi(tuning.notes[s]);
      if (openMidi == null) continue;
      const midi = openMidi + fret;
      const chroma = Note.chroma(targetPc);
      const octave = chroma != null ? Math.floor((midi - chroma) / 12) - 1 : null;
      const fullNote = octave != null ? `${targetPc}${octave}` : targetPc;
      const degree = parseInt(ivl.match(/(\d+)/)?.[1] || "0");
      notes.push({ string: s, fret, note: fullNote, pc: targetPc, interval: ivl, degree, midi });
    }
  }
  notes.sort((a, b) => a.midi - b.midi || a.string - b.string);
  return { root, shapeName: shape.name, tuning, notes };
}
function findNearestFret(t: Tuning, s: number, pc: string) { const o = Note.chroma(t.notes[s]); const c = Note.chroma(pc); if (o==null||c==null) return null; let f=c-o; if(f<0)f+=12; return f; }
function findFretInPosition(t: Tuning, s: number, pc: string, ref: number) { const o = Note.chroma(t.notes[s]); const c = Note.chroma(pc); if(o==null||c==null)return null; let f=c-o; if(f<0)f+=12; while(f<ref-5)f+=12; while(f>ref+9)f-=12; return f>=0?f:null; }

// Pattern generator
function ascendingIntervals(len: number, interval: number): number[] {
  const r: number[] = [];
  for (let i = 1; i <= len + 1 - interval; i++) r.push(i, i + interval);
  return r;
}

// Pattern walker
function walkPattern(scale: FrettedScale, pattern: number[]): FrettedNote[] {
  const byDeg = new Map<number, FrettedNote[]>();
  for (const n of scale.notes) { if (!byDeg.has(n.degree)) byDeg.set(n.degree, []); byDeg.get(n.degree)!.push(n); }
  const result: FrettedNote[] = [];
  let lastMidi = -Infinity;
  for (const deg of pattern) {
    const base = ((deg-1)%7)+1;
    const cands = byDeg.get(base);
    if (!cands) continue;
    let best = cands.find(c => c.midi > lastMidi) || cands[cands.length-1];
    result.push(best);
    lastMidi = best.midi;
  }
  return result;
}

// AlphaTeX formatter
function toAlphaTeX(notes: FrettedNote[], opts: { title?: string; tempo?: number; duration?: number; key?: string; tuning?: Tuning } = {}): string {
  const { title="Exercise", tempo=120, duration=8, key="C", tuning=STANDARD } = opts;
  const sc = tuning.notes.length;
  const lines = [
    `\\title "${title}"`, `\\tempo ${tempo}`,
    `\\track "Guitar" "Gtr"`, `\\staff {tabs}`,
    `\\tuning ${[...tuning.notes].reverse().join(" ")}`,
    `\\ts 4 4 \\ks ${key}`, "",
  ];
  const noteParts = notes.map(n => `${n.fret}.${sc - n.string}`);
  // Group into bars of (duration-appropriate) notes
  const perBar = duration === 16 ? 16 : duration === 8 ? 8 : 4;
  for (let i = 0; i < noteParts.length; i += perBar) {
    const bar = noteParts.slice(i, i + perBar).join(" ");
    lines.push(i === 0 ? `| :${duration} ${bar} |` : `| ${bar} |`);
  }
  return lines.join("\n");
}

// ASCII tab
function toAsciiTab(notes: FrettedNote[], tuning: Tuning = STANDARD): string {
  const labels = ["e","B","G","D","A","E","B7"];
  const sc = tuning.notes.length;
  const lines: string[] = [];
  for (let d = 0; d < sc; d++) {
    const s = sc-1-d;
    const parts = notes.map(n => n.string === s ? String(n.fret) : "-".repeat(String(n.fret).length));
    lines.push(`${labels[d]}|${parts.join("-")}|`);
  }
  return lines.join("\n");
}


// ============================================================
// APPROACH 1: Simple Functions
//
// Direct, explicit, Tonal-aligned. Each step is a function call.
// The user controls the flow. No magic.
//
// Pros: Clear, debuggable, tree-shakeable, Tonal-consistent
// Cons: Verbose for complex chains
// ============================================================

describe("Approach 1: Simple Functions", () => {
  test("A major scale in E shape", () => {
    const scale = buildFrettedScale(CAGED_E, "A");
    console.log("\n[Simple] A Major (E shape):");
    console.log(toAsciiTab(scale.notes));
    expect(scale.notes.length).toBeGreaterThan(10);
  });

  test("A major ascending 3rds in E shape", () => {
    const scale = buildFrettedScale(CAGED_E, "A");
    const pattern = ascendingIntervals(7, 2);
    const walked = walkPattern(scale, pattern);
    console.log("\n[Simple] A Major 3rds (E shape):");
    console.log(toAsciiTab(walked));
    expect(walked.length).toBe(12);
  });

  test("A major ascending 3rds → AlphaTeX", () => {
    const scale = buildFrettedScale(CAGED_E, "A");
    const pattern = ascendingIntervals(7, 2);
    const walked = walkPattern(scale, pattern);
    const tex = toAlphaTeX(walked, { title: "A Major 3rds", key: "A" });
    console.log("\n[Simple] AlphaTeX:");
    console.log(tex);
    expect(tex).toContain("\\title");
  });

  test("override shape — custom E shape", () => {
    const customE: ScaleShape = {
      ...CAGED_E,
      name: "Custom E Shape",
      // Teacher's variation: different notes on string 4
      strings: [["1P","2M"],["4P","5P"],["7M","1P","2M"],["3M","4P","5P"],["5P","6M","7M"],["1P","2M","3M"]],
    };
    const scale = buildFrettedScale(customE, "A");
    expect(scale.notes.length).toBeGreaterThan(10);
    console.log("\n[Simple] Custom E Shape:");
    console.log(toAsciiTab(scale.notes));
  });

  test("custom tuning — Drop D", () => {
    const scale = buildFrettedScale(CAGED_E, "A", DROP_D);
    expect(scale.notes.length).toBeGreaterThan(10);
    console.log("\n[Simple] Drop D tuning:");
    console.log(toAsciiTab(scale.notes, DROP_D));
  });
});


// ============================================================
// APPROACH 2: Pipe/Compose
//
// Functional composition with a pipe utility. Each step is a
// transform function. Highly composable and reusable.
//
// Pros: Composable, reusable transforms, pure, extensible
// Cons: Requires understanding of function composition
// ============================================================

// Pipe utility — chains functions left to right
function pipe<T>(initial: T, ...fns: ((arg: any) => any)[]): any {
  return fns.reduce((acc, fn) => fn(acc), initial);
}

// Transform functions (curried for pipe)
const withShape = (shape: ScaleShape, tuning?: Tuning) =>
  (root: string): FrettedScale => buildFrettedScale(shape, root, tuning);

const withPattern = (patternFn: () => number[]) =>
  (scale: FrettedScale): FrettedNote[] => walkPattern(scale, patternFn());

const withLinear = () =>
  (scale: FrettedScale): FrettedNote[] => scale.notes;

const asAlphaTeX = (opts?: Parameters<typeof toAlphaTeX>[1]) =>
  (notes: FrettedNote[]): string => toAlphaTeX(notes, opts);

const asAsciiTab = (tuning?: Tuning) =>
  (notes: FrettedNote[]): string => toAsciiTab(notes, tuning);

// Pattern factories
const thirds = () => ascendingIntervals(7, 2);
const fourths = () => ascendingIntervals(7, 3);
const sixths = () => ascendingIntervals(7, 5);

describe("Approach 2: Pipe/Compose", () => {
  test("A major scale in E shape", () => {
    const tab = pipe("A", withShape(CAGED_E), withLinear(), asAsciiTab());
    console.log("\n[Pipe] A Major (E shape):");
    console.log(tab);
    expect(tab).toContain("|");
  });

  test("A major ascending 3rds in E shape", () => {
    const tab = pipe("A", withShape(CAGED_E), withPattern(thirds), asAsciiTab());
    console.log("\n[Pipe] A Major 3rds:");
    console.log(tab);
    expect(tab).toContain("|");
  });

  test("A major ascending 3rds → AlphaTeX", () => {
    const tex = pipe("A",
      withShape(CAGED_E),
      withPattern(thirds),
      asAlphaTeX({ title: "A Major 3rds", key: "A", tempo: 80 }),
    );
    console.log("\n[Pipe] AlphaTeX:");
    console.log(tex);
    expect(tex).toContain("\\title");
  });

  test("override shape", () => {
    const customE: ScaleShape = { ...CAGED_E, name: "Custom E",
      strings: [["1P","2M"],["4P","5P"],["7M","1P","2M"],["3M","4P","5P"],["5P","6M","7M"],["1P","2M","3M"]],
    };
    const tab = pipe("A", withShape(customE), withLinear(), asAsciiTab());
    console.log("\n[Pipe] Custom shape:");
    console.log(tab);
    expect(tab).toContain("|");
  });

  test("custom tuning", () => {
    const tab = pipe("A", withShape(CAGED_E, DROP_D), withLinear(), asAsciiTab(DROP_D));
    console.log("\n[Pipe] Drop D:");
    console.log(tab);
    expect(tab).toContain("|");
  });

  test("reusable pipeline — same exercise in multiple keys", () => {
    // Define the exercise once, apply to many keys
    const exerciseInKey = (key: string) =>
      pipe(key, withShape(CAGED_E), withPattern(thirds), asAsciiTab());

    const keys = ["A", "C", "G", "E"];
    console.log("\n[Pipe] Same exercise, multiple keys:");
    for (const k of keys) {
      console.log(`\n  ${k} major:`);
      console.log(exerciseInKey(k));
    }
  });

  test("compose different patterns with same setup", () => {
    const inEShape = (root: string) => pipe(root, withShape(CAGED_E));

    const scale = inEShape("A");
    const tab3rds = pipe(scale, withPattern(thirds), asAsciiTab());
    const tab4ths = pipe(scale, withPattern(fourths), asAsciiTab());
    const tab6ths = pipe(scale, withPattern(sixths), asAsciiTab());

    console.log("\n[Pipe] Multiple patterns:");
    console.log("3rds:", tab3rds);
    console.log("4ths:", tab4ths);
    console.log("6ths:", tab6ths);
  });
});


// ============================================================
// APPROACH 3: Fluent Builder
//
// Chainable methods with IDE autocomplete. Each method returns
// `this` for chaining.
//
// Pros: Discoverable via IDE, readable chains
// Cons: Mutable state, harder to tree-shake, not Tonal-aligned
// ============================================================

class GuitarExercise {
  private _shape: ScaleShape = CAGED_E;
  private _root: string = "C";
  private _tuning: Tuning = STANDARD;
  private _pattern: number[] | null = null;

  static create(root: string): GuitarExercise {
    const g = new GuitarExercise();
    g._root = root;
    return g;
  }

  shape(s: ScaleShape): this { this._shape = s; return this; }
  tuning(t: Tuning): this { this._tuning = t; return this; }
  pattern(p: number[]): this { this._pattern = p; return this; }
  ascending3rds(): this { this._pattern = ascendingIntervals(7, 2); return this; }
  ascending4ths(): this { this._pattern = ascendingIntervals(7, 3); return this; }

  build(): FrettedScale { return buildFrettedScale(this._shape, this._root, this._tuning); }

  notes(): FrettedNote[] {
    const scale = this.build();
    return this._pattern ? walkPattern(scale, this._pattern) : scale.notes;
  }

  toTab(): string { return toAsciiTab(this.notes(), this._tuning); }

  toAlphaTeX(opts?: Parameters<typeof toAlphaTeX>[1]): string {
    return toAlphaTeX(this.notes(), { ...opts, tuning: this._tuning });
  }
}

describe("Approach 3: Fluent Builder", () => {
  test("A major scale in E shape", () => {
    const tab = GuitarExercise.create("A").shape(CAGED_E).toTab();
    console.log("\n[Builder] A Major (E shape):");
    console.log(tab);
    expect(tab).toContain("|");
  });

  test("A major ascending 3rds in E shape", () => {
    const tab = GuitarExercise.create("A").shape(CAGED_E).ascending3rds().toTab();
    console.log("\n[Builder] A Major 3rds:");
    console.log(tab);
    expect(tab).toContain("|");
  });

  test("A major ascending 3rds → AlphaTeX", () => {
    const tex = GuitarExercise.create("A")
      .shape(CAGED_E)
      .ascending3rds()
      .toAlphaTeX({ title: "A Major 3rds", key: "A" });
    console.log("\n[Builder] AlphaTeX:");
    console.log(tex);
    expect(tex).toContain("\\title");
  });

  test("override shape", () => {
    const custom: ScaleShape = { ...CAGED_E, name: "Custom",
      strings: [["1P","2M"],["4P","5P"],["7M","1P","2M"],["3M","4P","5P"],["5P","6M","7M"],["1P","2M","3M"]],
    };
    const tab = GuitarExercise.create("A").shape(custom).toTab();
    console.log("\n[Builder] Custom shape:");
    console.log(tab);
    expect(tab).toContain("|");
  });

  test("custom tuning", () => {
    const tab = GuitarExercise.create("A").shape(CAGED_E).tuning(DROP_D).toTab();
    console.log("\n[Builder] Drop D:");
    console.log(tab);
    expect(tab).toContain("|");
  });
});


// ============================================================
// Shape Override Patterns (following Tonal conventions)
// ============================================================

describe("Shape overrides — following Tonal patterns", () => {

  // Pattern A: Parameter injection (like VoicingDictionary)
  // Pass custom shapes as function arguments
  test("Pattern A: parameter injection", () => {
    const myShapes: Record<string, ScaleShape> = {
      E: { ...CAGED_E, name: "My E Shape",
        strings: [["1P","2M"],["4P","5P"],["7M","1P","2M"],["3M","4P","5P"],["5P","6M","7M"],["1P","2M","3M"]],
      },
    };

    // Use custom shape directly — no global state
    const scale = buildFrettedScale(myShapes.E, "A");
    expect(scale.notes.length).toBeGreaterThan(10);
    console.log("\n[Override A] Parameter injection:");
    console.log(toAsciiTab(scale.notes));
  });

  // Pattern B: Global registry with add/remove (like ChordType)
  test("Pattern B: mutable registry", () => {
    // Simulating Tonal's registry pattern
    const registry = new Map<string, ScaleShape>();

    function addShape(shape: ScaleShape) { registry.set(shape.name, shape); }
    function getShape(name: string) { return registry.get(name); }
    function removeAll() { registry.clear(); }

    // Register defaults
    addShape(CAGED_E);
    addShape(CAGED_A);

    // User overrides E shape
    addShape({ ...CAGED_E, name: "E Shape",
      strings: [["1P","2M"],["4P","5P"],["7M","1P","2M"],["3M","4P","5P"],["5P","6M","7M"],["1P","2M","3M"]],
    });

    const shape = getShape("E Shape")!;
    const scale = buildFrettedScale(shape, "A");
    expect(scale.notes.length).toBeGreaterThan(10);
  });

  // Pattern C: Spread/merge (functional override)
  test("Pattern C: spread/merge defaults", () => {
    const defaults: Record<string, ScaleShape> = {
      E: CAGED_E,
      A: CAGED_A,
    };

    const userOverrides: Record<string, ScaleShape> = {
      E: { ...CAGED_E, name: "Teacher Bob's E Shape",
        strings: [["1P","2M"],["4P","5P"],["7M","1P","2M"],["3M","4P","5P"],["5P","6M","7M"],["1P","2M","3M"]],
      },
    };

    // Merge: user overrides win
    const shapes = { ...defaults, ...userOverrides };

    expect(shapes.E.name).toBe("Teacher Bob's E Shape");
    expect(shapes.A.name).toBe("A Shape"); // unchanged
  });

  // Recommendation test
  test("RECOMMENDED: Pattern C (spread/merge) + Pattern A (parameter injection)", () => {
    // This combines the best of both:
    // - Defaults are plain data objects (not global state)
    // - Users merge their overrides with spread
    // - Functions accept shapes as parameters (no hidden state)

    const DEFAULTS = { E: CAGED_E, A: CAGED_A };

    // User creates their config once
    const myShapes = {
      ...DEFAULTS,
      E: { ...CAGED_E, name: "My E Shape",
        strings: [["1P","2M"],["4P","5P"],["7M","1P","2M"],["3M","4P","5P"],["5P","6M","7M"],["1P","2M","3M"]],
      },
    };

    // Then uses it everywhere — explicit, no global state
    const scale = buildFrettedScale(myShapes.E, "A");
    const tab = toAsciiTab(scale.notes);
    console.log("\n[Override RECOMMENDED] Merge + inject:");
    console.log(tab);
    expect(tab).toContain("|");
  });
});
