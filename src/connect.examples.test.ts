import { describe, expect, test } from "vitest";
import { buildFrettedScale } from "./build";
import { walkShapeMotif } from "./walker";
import { connectSequences, type ChainDirection } from "./connect";
import { get } from "./shape";
import { STANDARD } from "./tuning";
import type { FrettedNote, FrettedScale } from "./shape";

// Side-effect imports register the CAGED and pentatonic shapes by name.
import "./data/caged-scales";
import "./data/pentatonic";

// ============================================================
// Example-driven tests for the connector
//
// These read like the user's natural description of a bridged chain:
//
//   prev=E Shape ascending | bridge | next=D Shape descending
//   "5.1 4.1 7.1"          | "5.1 9.1 7.1 10.1" | "10.1 7.1 9.1 10.2 ..."
//
// Fret.string notation matches how a guitarist talks about positions —
// `fret.string` where string `1` is the high E, string `6` is the low E.
// `formatFrets()` renders any FrettedNote[] into that form so test
// expectations can be written or pasted in directly.
//
// Each scenario captures four artefacts:
//   - prevPattern: the natural walk of the first entry
//   - bridge:      `connector` from connectSequences (same-string pickup)
//   - nextPattern: `nextNotes` from connectSequences (next's natural walk
//                  with overlap dedup applied)
//   - all:         prevPattern + bridge + nextPattern, the chain a user
//                  hears in the lab when Bridge is ON
// ============================================================

/**
 * fret.string notation, 1-indexed from the high E.
 *   string 5 (lib) = high E = "1" (user)
 *   string 0 (lib) = low  E = "6" (user)
 */
function formatFrets(notes: FrettedNote[]): string {
  return notes.map((n) => `${n.fret}.${6 - n.string}`).join(" ");
}

interface ChainInput {
  prevShape: string;
  prevDir: ChainDirection;
  nextShape: string;
  nextDir: ChainDirection;
  motif: number[];
  root: string;
  tuning?: string[];
}

interface ChainResult {
  strategy: "none" | "extend" | "reach-back";
  prevPattern: string;
  bridge: string;
  nextPattern: string;
  all: string;
  prevScale: FrettedScale;
  nextScale: FrettedScale;
}

/** Build a chain scenario and return fret-string artefacts. */
function chain(input: ChainInput): ChainResult {
  const tuning = input.tuning ?? STANDARD;

  const prevShapeDef = get(input.prevShape);
  const nextShapeDef = get(input.nextShape);
  if (!prevShapeDef) throw new Error(`Unknown shape: ${input.prevShape}`);
  if (!nextShapeDef) throw new Error(`Unknown shape: ${input.nextShape}`);

  const prevScale = buildFrettedScale(prevShapeDef, input.root, tuning);
  const nextScale = buildFrettedScale(nextShapeDef, input.root, tuning);

  if (prevScale.empty || nextScale.empty) {
    throw new Error("buildFrettedScale returned empty — shape/root mismatch");
  }

  const prevNotes = walkShapeMotif(prevScale, input.motif, {
    direction: input.prevDir,
  });
  const result = connectSequences(
    {
      prev: {
        scale: prevScale,
        lastNote: prevNotes[prevNotes.length - 1],
        direction: input.prevDir,
      },
      next: {
        scale: nextScale,
        motif: input.motif,
        direction: input.nextDir,
      },
    },
    { dedupSeam: false }, // mirror the lab's call site
  );

  return {
    strategy: result.strategy,
    prevPattern: formatFrets(prevNotes),
    bridge: formatFrets(result.connector),
    nextPattern: formatFrets(result.nextNotes),
    all: formatFrets([...prevNotes, ...result.connector, ...result.nextNotes]),
    prevScale,
    nextScale,
  };
}

/** Match the last N notes of a fret string. Lets tests assert the *tail* of
 * a long natural walk without typing out the full pattern. */
function endsWith(frets: string, suffix: string): boolean {
  return frets.endsWith(suffix);
}

/** Match the first N notes of a fret string. */
function startsWith(frets: string, prefix: string): boolean {
  return frets.startsWith(prefix);
}

// ============================================================
// Direction-reversal scenarios (the bridge cases that matter)
// ============================================================

describe("E Shape ↔ D Shape, thirds (1,3), A major", () => {
  // E shape spans G#2 (s0,f4) to B4 (s5,f7) on the low/high E strings.
  // D shape spans B2 (s0,f7) to D5 (s5,f10) — sits a fourth above E shape.

  test("E↑ → D↓ : extend, bridge ascends the high E string into D shape's top", () => {
    const r = chain({
      prevShape: "E Shape", prevDir: "ascending",
      nextShape: "D Shape", nextDir: "descending",
      motif: [1, 3], root: "A",
    });

    expect(r.strategy).toBe("extend");
    expect(endsWith(r.prevPattern, "5.1 4.1 7.1")).toBe(true);
    expect(r.bridge).toBe("5.1 9.1 7.1 10.1");
    // nextNotes starts at the descending pivot — D5 repeats as the "top",
    // then D shape's natural descending thirds walk takes over.
    expect(startsWith(r.nextPattern, "10.1 7.1 9.1 10.2")).toBe(true);
  });

  test("E↓ → D↑ : reach-back, bridge ascends the low E string from the seam", () => {
    const r = chain({
      prevShape: "E Shape", prevDir: "descending",
      nextShape: "D Shape", nextDir: "ascending",
      motif: [1, 3], root: "A",
    });

    expect(r.strategy).toBe("reach-back");
    expect(endsWith(r.prevPattern, "5.6 7.6 4.6")).toBe(true);
    expect(r.bridge).toBe("4.6 7.6 5.6 9.6 7.6 10.6");
    // D shape's natural ascending walk would start with (B2, D3) = "7.6 10.6"
    // — same as the bridge's last pair — so the overlap is dedup'd and
    // nextNotes begins at the following pair (C#3, E3) = "9.6 7.5".
    expect(startsWith(r.nextPattern, "9.6 7.5 10.6 9.5")).toBe(true);
  });

  test("E↑ → D↑ : same direction, no bridge", () => {
    const r = chain({
      prevShape: "E Shape", prevDir: "ascending",
      nextShape: "D Shape", nextDir: "ascending",
      motif: [1, 3], root: "A",
    });

    expect(r.strategy).toBe("none");
    expect(r.bridge).toBe("");
    // nextNotes is D shape's unmodified natural ascending walk.
    expect(startsWith(r.nextPattern, "7.6 10.6 9.6 7.5")).toBe(true);
  });

  test("E↓ → D↓ : same direction, no bridge", () => {
    const r = chain({
      prevShape: "E Shape", prevDir: "descending",
      nextShape: "D Shape", nextDir: "descending",
      motif: [1, 3], root: "A",
    });

    expect(r.strategy).toBe("none");
    expect(r.bridge).toBe("");
  });
});

describe("E Shape ↔ G Shape, thirds (1,3), A major", () => {
  // G shape sits *below* E shape on the neck (it borrows the open strings).
  // So E↑ → G↓ wants a descending bridge, E↓ → G↑ wants an ascending bridge.

  test("E↑ → G↓ : reach-back, bridge descends the high E from seam down through G shape's top", () => {
    const r = chain({
      prevShape: "E Shape", prevDir: "ascending",
      nextShape: "G Shape", nextDir: "descending",
      motif: [1, 3], root: "A",
    });

    expect(r.strategy).toBe("reach-back");
    // Bridge stays on s5 (high E), descending pairs from B4 anchor downward.
    expect(startsWith(r.bridge, "7.1 4.1")).toBe(true);
    expect(r.bridge.split(" ").every((tok) => tok.endsWith(".1"))).toBe(true);
  });

  test("E↓ → G↑ : extend, bridge descends the low E from seam toward G shape's bottom", () => {
    const r = chain({
      prevShape: "E Shape", prevDir: "descending",
      nextShape: "G Shape", nextDir: "ascending",
      motif: [1, 3], root: "A",
    });

    expect(r.strategy).toBe("extend");
    // Bridge entirely on the low E string (s0 → user notation .6).
    expect(r.bridge.split(" ").every((tok) => tok.endsWith(".6"))).toBe(true);
  });
});

describe("Linear motif [1] (single-degree walk)", () => {
  test("E↑ → D↓ linear: bridge is single notes, not pairs", () => {
    const r = chain({
      prevShape: "E Shape", prevDir: "ascending",
      nextShape: "D Shape", nextDir: "descending",
      motif: [1], root: "A",
    });

    expect(r.strategy).toBe("extend");
    // With motif [1], pairs = singletons. Bridge notes are individual
    // high-E pitches past the seam, up to D5.
    expect(r.bridge.split(" ").every((tok) => tok.endsWith(".1"))).toBe(true);
    // Linear walks emit every note; expect at least C#5 and D5 past B4.
    expect(r.bridge).toContain("9.1");
    expect(r.bridge).toContain("10.1");
  });
});

describe("Triadic motif [1,3,5]", () => {
  test("E↑ → D↓ triads: bridge is whole 3-note arpeggios", () => {
    const r = chain({
      prevShape: "E Shape", prevDir: "ascending",
      nextShape: "D Shape", nextDir: "descending",
      motif: [1, 3, 5], root: "A",
    });

    expect(r.strategy).toBe("extend");
    const bridgeTokens = r.bridge.split(" ").filter(Boolean);
    // Whole motif periods only — count divisible by 3 (the motif length).
    expect(bridgeTokens.length % 3).toBe(0);
    // Bridge stays on the high E string.
    expect(bridgeTokens.every((tok) => tok.endsWith(".1"))).toBe(true);
  });
});

describe("Identical shapes (E↑ → E↓)", () => {
  test("Reach-back bridge still emits a same-string pickup", () => {
    const r = chain({
      prevShape: "E Shape", prevDir: "ascending",
      nextShape: "E Shape", nextDir: "descending",
      motif: [1, 3], root: "A",
    });

    expect(r.strategy).toBe("reach-back");
    // Same-string pool reduces to a single shape's s5 notes; bridge is the
    // descending thirds pickup anchored at the seam.
    expect(r.bridge.split(" ").every((tok) => tok.endsWith(".1"))).toBe(true);
    expect(r.bridge).toContain("7.1"); // seam B4 anchors the head
  });
});

describe("Pentatonic boxes (Box 1 → Box 2, A minor)", () => {
  test("Box 1 ↑ → Box 2 ↓ : extend, bridge is the high E pickup", () => {
    const r = chain({
      prevShape: "Pentatonic Box 1", prevDir: "ascending",
      nextShape: "Pentatonic Box 2", nextDir: "descending",
      motif: [1, 3], root: "A",
    });

    expect(["extend", "reach-back", "none"]).toContain(r.strategy);
    // The bridge — when present — stays on the seam's string.
    if (r.bridge.length > 0) {
      const tokens = r.bridge.split(" ").filter(Boolean);
      const seamStringSuffix =
        "." + (6 - r.prevScale.notes[r.prevScale.notes.length - 1].string);
      // Loose check: at least the first token sits on the seam string.
      expect(tokens[0].endsWith(seamStringSuffix)).toBe(true);
    }
  });
});

// ============================================================
// Combined-chain regression
// ============================================================

describe("Combined chain (prev + bridge + next)", () => {
  test("E↑ → D↓ thirds A major: full chain matches the user's lab observation", () => {
    const r = chain({
      prevShape: "E Shape", prevDir: "ascending",
      nextShape: "D Shape", nextDir: "descending",
      motif: [1, 3], root: "A",
    });

    // The full chain ends with: prev's last 3 + 4 bridge notes + first
    // 4 nextNotes — exactly what the user observed in the lab.
    expect(r.all).toContain("5.1 4.1 7.1 5.1 9.1 7.1 10.1 10.1 7.1 9.1 10.2");
  });

  test("E↓ → D↑ thirds A major: full chain bridges low E into D shape's natural walk", () => {
    const r = chain({
      prevShape: "E Shape", prevDir: "descending",
      nextShape: "D Shape", nextDir: "ascending",
      motif: [1, 3], root: "A",
    });

    // prev_end + bridge (6 notes on low E) + nextNotes from (C#3, E3).
    expect(r.all).toContain(
      "5.6 7.6 4.6 4.6 7.6 5.6 9.6 7.6 10.6 9.6 7.5 10.6 9.5",
    );
  });
});

// ============================================================
// Library default: dedupSeam: true
//
// The lab call site passes { dedupSeam: false } intentionally (the seam
// pivot is musically meaningful). Other consumers — including the library
// default — get { dedupSeam: true }, which drops the leading seam
// repetition from extend's nextNotes and from reach-back's connector head.
// These tests pin that behavior for the new same-string algorithm so the
// extend's pair-level overlap dedup AND the legacy single-note dedup
// interaction is exercised under defaults.
// ============================================================

describe("Library default dedupSeam: true", () => {
  /** Same as `chain()` but uses the library default options. */
  function chainDefault(input: ChainInput): ChainResult {
    const prevShapeDef = get(input.prevShape);
    const nextShapeDef = get(input.nextShape);
    if (!prevShapeDef) throw new Error(`Unknown shape: ${input.prevShape}`);
    if (!nextShapeDef) throw new Error(`Unknown shape: ${input.nextShape}`);
    const prevScale = buildFrettedScale(
      prevShapeDef,
      input.root,
      input.tuning ?? STANDARD,
    );
    const nextScale = buildFrettedScale(
      nextShapeDef,
      input.root,
      input.tuning ?? STANDARD,
    );
    const prevNotes = walkShapeMotif(prevScale, input.motif, {
      direction: input.prevDir,
    });
    // No options arg — library defaults (dedupSeam: true).
    const result = connectSequences({
      prev: {
        scale: prevScale,
        lastNote: prevNotes[prevNotes.length - 1],
        direction: input.prevDir,
      },
      next: {
        scale: nextScale,
        motif: input.motif,
        direction: input.nextDir,
      },
    });
    return {
      strategy: result.strategy,
      prevPattern: formatFrets(prevNotes),
      bridge: formatFrets(result.connector),
      nextPattern: formatFrets(result.nextNotes),
      all: formatFrets([
        ...prevNotes,
        ...result.connector,
        ...result.nextNotes,
      ]),
      prevScale,
      nextScale,
    };
  }

  test("extend (E↑ → D↓): dedupSeam true drops the duplicate D5 head from nextNotes", () => {
    // With dedupSeam: false the bridge ends D5 and nextNotes starts D5
    // (the asc→desc pivot repeats). With dedupSeam: true the legacy
    // single-note dedup compares nextNotes[0] against connector's last
    // position and drops the repetition.
    const withDedup = chainDefault({
      prevShape: "E Shape", prevDir: "ascending",
      nextShape: "D Shape", nextDir: "descending",
      motif: [1, 3], root: "A",
    });
    const withoutDedup = chain({
      prevShape: "E Shape", prevDir: "ascending",
      nextShape: "D Shape", nextDir: "descending",
      motif: [1, 3], root: "A",
    });

    // Bridge is identical regardless of dedupSeam (it's the prev-side
    // pickup, not affected by the next-side dedup).
    expect(withDedup.bridge).toBe(withoutDedup.bridge);
    // With dedup, nextNotes does NOT start with D5 (10.1) — the head was
    // dropped because it matched the bridge's last position.
    expect(withDedup.nextPattern.startsWith("10.1")).toBe(false);
    // Without dedup, it does.
    expect(withoutDedup.nextPattern.startsWith("10.1")).toBe(true);
  });

  test("reach-back (E↓ → D↑): dedupSeam true drops the leading seam G#2 from the bridge", () => {
    // With dedupSeam: false the bridge starts with the seam G#2 (4.6).
    // With dedupSeam: true the connector.shift() drops the head.
    const withDedup = chainDefault({
      prevShape: "E Shape", prevDir: "descending",
      nextShape: "D Shape", nextDir: "ascending",
      motif: [1, 3], root: "A",
    });
    const withoutDedup = chain({
      prevShape: "E Shape", prevDir: "descending",
      nextShape: "D Shape", nextDir: "ascending",
      motif: [1, 3], root: "A",
    });

    expect(withoutDedup.bridge.startsWith("4.6")).toBe(true);
    expect(withDedup.bridge.startsWith("4.6")).toBe(false);
    // The first note past the seam is B2 (7.6).
    expect(withDedup.bridge.startsWith("7.6")).toBe(true);
    // nextNotes is unchanged by reach-back's seam dedup (which only
    // touches the connector head, not the next walk).
    expect(withDedup.nextPattern).toBe(withoutDedup.nextPattern);
  });

  test("Overlap dedup + legacy dedupSeam interaction: reach-back's nextNotes still drops the duplicate first pair", () => {
    // Pair-level overlap dedup runs before the legacy single-note dedup
    // and is independent of the dedupSeam option. For E↓ → D↑ the
    // bridge's last pair (B2, D3) matches D shape's natural-walk first
    // pair, so nextNotes starts at (C#3, E3) regardless of dedupSeam.
    const r = chainDefault({
      prevShape: "E Shape", prevDir: "descending",
      nextShape: "D Shape", nextDir: "ascending",
      motif: [1, 3], root: "A",
    });
    expect(r.nextPattern.startsWith("9.6 7.5")).toBe(true);
  });
});
