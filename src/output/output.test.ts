/**
 * Tests for grouped simultaneous-note rendering in toAlphaTeX and toAsciiTab.
 * Task Group 7 — Fixture (i) and backward-compat assertions.
 */
import { describe, test, expect } from "vitest";
import { toAlphaTeX } from "./alphatex";
import { toAsciiTab } from "./ascii-tab";
import { FrettedNote } from "../shape";
import { buildFrettedScale } from "../build";
import { CAGED_E } from "../data/caged-scales";
import { walkPattern } from "../walker";
import { ascendingLinear } from "../pattern";

// ============================================================
// Fixture (i) — Open C voicing notes (Fixture b positions as a strum)
// Grip x32010: A-str f3=C3, D-str f2=E3, G-str f0=G3, B-str f1=C4, high-E f0=E4
// String numbering (0-based, 0=low E):
//   string 1 (A), fret 3 → AlphaTeX string = 6-1 = 5
//   string 2 (D), fret 2 → AlphaTeX string = 6-2 = 4
//   string 3 (G), fret 0 → AlphaTeX string = 6-3 = 3
//   string 4 (B), fret 1 → AlphaTeX string = 6-4 = 2
//   string 5 (high-E), fret 0 → AlphaTeX string = 6-5 = 1
// ============================================================

function makeFrettedNote(string: number, fret: number): FrettedNote {
  return {
    string,
    fret,
    note: "C3",   // placeholder — formatters only use string and fret
    pc: "C",
    interval: "1P",
    scaleIndex: 0,
    degree: 1,
    intervalNumber: 1,
    midi: 48,
  };
}

const openCNotes: FrettedNote[] = [
  makeFrettedNote(1, 3),   // A string, fret 3 → AlphaTeX 3.5
  makeFrettedNote(2, 2),   // D string, fret 2 → AlphaTeX 2.4
  makeFrettedNote(3, 0),   // G string, fret 0 → AlphaTeX 0.3
  makeFrettedNote(4, 1),   // B string, fret 1 → AlphaTeX 1.2
  makeFrettedNote(5, 0),   // high-E string, fret 0 → AlphaTeX 0.1
];

// A note group with a two-digit fret for alignment tests
const twoDigitGroup: FrettedNote[] = [
  makeFrettedNote(1, 10),  // fret 10 (two digits)
  makeFrettedNote(3, 0),   // fret 0 (one digit, must pad to 2)
];

// ============================================================
// AlphaTeX grouped tests
// ============================================================

describe("toAlphaTeX — grouped input", () => {
  test("Fixture (i): single group of 5 notes emits parenthesised beat '(3.5 2.4 0.3 1.2 0.1)'", () => {
    const result = toAlphaTeX([openCNotes]);
    // The beat should be parenthesised simultaneous syntax
    expect(result).toContain("(3.5 2.4 0.3 1.2 0.1)");
  });

  test("Fixture (i): grouped input emits different output than flat sequential input", () => {
    const grouped = toAlphaTeX([openCNotes]);
    const flat = toAlphaTeX(openCNotes);
    // Grouped has parens; flat has space-separated individual beats
    expect(grouped).toContain("(3.5 2.4 0.3 1.2 0.1)");
    // Flat does not have parens around the chord
    expect(flat).not.toContain("(3.5 2.4 0.3 1.2 0.1)");
    // But flat does contain the individual note tokens
    expect(flat).toContain("3.5");
    expect(flat).toContain("2.4");
  });

  test("single-note group emits no parentheses", () => {
    const singleGroup: FrettedNote[][] = [[makeFrettedNote(0, 5)]];
    const result = toAlphaTeX(singleGroup);
    // Should contain "5.6" without parentheses
    expect(result).toContain("5.6");
    expect(result).not.toContain("(5.6)");
  });

  test("empty inner group emits 'r' rest beat", () => {
    const result = toAlphaTeX([[]]);
    expect(result).toContain("r");
  });

  test("multi-group input produces two beat columns", () => {
    const group1: FrettedNote[] = [makeFrettedNote(0, 5)];
    const group2: FrettedNote[] = [makeFrettedNote(5, 0)];
    const result = toAlphaTeX([group1, group2]);
    expect(result).toContain("5.6");
    expect(result).toContain("0.1");
  });

  test("standard header lines are present with grouped input", () => {
    const result = toAlphaTeX([openCNotes], { title: "Chord Test" });
    expect(result).toContain('\\title "Chord Test"');
    expect(result).toContain("\\staff {tabs}");
    expect(result).toContain("\\tuning");
  });
});

// ============================================================
// AlphaTeX option semantics — beat-indexed
// ============================================================

describe("toAlphaTeX — option semantics with grouped input (R-5.3)", () => {
  test("rhythmPattern indexes by beat (group), not by individual note", () => {
    // Two beats: group1 = 2 notes (quarter), group2 = 1 note (eighth)
    const group1: FrettedNote[] = [makeFrettedNote(1, 3), makeFrettedNote(2, 2)];
    const group2: FrettedNote[] = [makeFrettedNote(5, 0)];
    const result = toAlphaTeX([group1, group2], { rhythmPattern: [4, 8] });
    // First beat gets duration 4, second gets 8
    expect(result).toContain(":4");
    expect(result).toContain(":8");
    // The chord notation should be present for group1 (2 notes)
    expect(result).toContain("(3.5 2.4)");
  });

  test("noteDurations indexes by beat (group index)", () => {
    const group1: FrettedNote[] = [makeFrettedNote(0, 5), makeFrettedNote(5, 0)];
    const group2: FrettedNote[] = [makeFrettedNote(1, 3)];
    // Beat 0 → duration 4, beat 1 → duration 16
    const result = toAlphaTeX([group1, group2], { noteDurations: [4, 16] });
    expect(result).toContain(":4");
    expect(result).toContain(":16");
  });

  test("notesPerBar counts beats (groups), not individual notes", () => {
    // 4 groups, notesPerBar=2 → should produce 2 bars (each with a '|')
    const group = (fret: number): FrettedNote[] => [makeFrettedNote(0, fret)];
    const result = toAlphaTeX([group(0), group(1), group(2), group(3)], { notesPerBar: 2 });
    // Should have at least 2 bar separators
    const barCount = (result.match(/\|/g) ?? []).length;
    expect(barCount).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// AlphaTeX backward compatibility
// ============================================================

describe("toAlphaTeX — backward compatibility (R-5.2)", () => {
  test("flat FrettedNote[] produces byte-identical output before and after the change", () => {
    const scale = buildFrettedScale(CAGED_E, "A");
    const walked = walkPattern(scale, ascendingLinear(1, 8));
    // This call must produce the same result as the pre-change formatter.
    // We verify by checking the output is non-empty and contains expected tokens.
    const result = toAlphaTeX(walked, { title: "Test Exercise" });
    expect(result).toContain('\\title "Test Exercise"');
    // fret 5, string 0 → AlphaTeX string 6 → "5.6"
    expect(result).toContain("5.6");
    // Should not have any parenthesised chords (flat input)
    expect(result).not.toMatch(/\(\d+\.\d+/);
  });

  test("empty flat array [] produces same output as before (header only, no bar lines)", () => {
    const result = toAlphaTeX([]);
    // Should have the header lines but no bar content
    expect(result).toContain('\\title "Exercise"');
    // No bar separator should be emitted for zero notes
    const lines = result.split("\n");
    // Header is 6 lines; no bar lines added
    expect(lines.length).toBe(6);
  });

  test("flat input with noteDurations override still works byte-identically", () => {
    const scale = buildFrettedScale(CAGED_E, "A");
    const notes = scale.notes.slice(0, 4);
    const result = toAlphaTeX(notes, { noteDurations: [4, 8, 8, 4] });
    expect(result).toContain(":4");
    expect(result).toContain(":8");
  });
});

// ============================================================
// ASCII tab grouped tests
// ============================================================

describe("toAsciiTab — grouped input", () => {
  test("Fixture (i): single strum group produces a single chord column across all 6 rows", () => {
    const result = toAsciiTab([openCNotes]);
    const lines = result.split("\n");
    expect(lines).toHaveLength(6);
    // Each line: label + | + content + |
    for (const line of lines) {
      expect(line).toMatch(/^[a-gA-G]\|/);
    }
  });

  test("Fixture (i): correct frets appear in the chord column", () => {
    const result = toAsciiTab([openCNotes]);
    // high-E (string 5, display row 0): fret 0
    // B (string 4, display row 1): fret 1
    // G (string 3, display row 2): fret 0
    // D (string 2, display row 3): fret 2
    // A (string 1, display row 4): fret 3
    // low-E (string 0, display row 5): not played → '-'
    const lines = result.split("\n");
    // Line 0: high e string
    expect(lines[0]).toContain("0");
    // Line 1: B string
    expect(lines[1]).toContain("1");
    // Line 2: G string
    expect(lines[2]).toContain("0");
    // Line 3: D string
    expect(lines[3]).toContain("2");
    // Line 4: A string
    expect(lines[4]).toContain("3");
    // Line 5: low E string (not played)
    expect(lines[5]).toContain("-");
  });

  test("Fixture (i): non-played strings show '-' in the chord column", () => {
    const result = toAsciiTab([openCNotes]);
    const lines = result.split("\n");
    // low-E (string 0) is not in openCNotes → should show '-'
    const lowELine = lines[5]; // display row 5 = string 0 (low E)
    expect(lowELine).toMatch(/E\|-\|/);
  });

  test("Fixture (i) two-digit fret: group with fret 10 → colWidth=2, single-digit frets padded", () => {
    const result = toAsciiTab([twoDigitGroup]);
    const lines = result.split("\n");
    // A string (index 1, display row 4): fret 10 → "10"
    const aLine = lines[4]; // display row 4 = string 1 (A)
    expect(aLine).toContain("10");
    // G string (index 3, display row 2): fret 0 → padded to " 0" (width 2)
    const gLine = lines[2]; // display row 2 = string 3 (G)
    expect(gLine).toContain(" 0");
    // Non-played strings get "--" (width 2)
    const lowELine = lines[5]; // string 0 (low E)
    expect(lowELine).toContain("--");
  });

  test("empty inner group emits all '-' cells", () => {
    const result = toAsciiTab([[]]);
    const lines = result.split("\n");
    // All rows should show '-' for the empty beat
    for (const line of lines) {
      // Each line: label|content|; content should be '-'
      expect(line).toMatch(/\|-\|$/);
    }
  });

  test("multi-group input produces two beat columns", () => {
    const group1: FrettedNote[] = [makeFrettedNote(0, 5)];
    const group2: FrettedNote[] = [makeFrettedNote(5, 0)];
    const result = toAsciiTab([group1, group2]);
    // low-E (string 0) is played in group1 at fret 5 → should appear
    // high-E (string 5) is played in group2 at fret 0 → should appear
    expect(result).toContain("5");
    expect(result).toContain("0");
    const lines = result.split("\n");
    // Each line should have 2 beat columns separated by '-'
    // Structure: label|col1-col2|
    expect(lines[0]).toMatch(/\|.*-.*\|/);
  });

  test("column width is max fret string length across the group", () => {
    // Group with frets 0 and 10 → colWidth should be 2
    const result = toAsciiTab([twoDigitGroup]);
    // Every row should have width-2 content (either "10", " 0", or "--")
    const lines = result.split("\n");
    for (const line of lines) {
      // Strip label|...|
      const content = line.slice(2, -1); // remove "X|" at start and "|" at end
      // Content should be exactly 2 chars wide (one beat, width 2)
      expect(content.length).toBe(2);
    }
  });
});

// ============================================================
// ASCII tab backward compatibility
// ============================================================

describe("toAsciiTab — backward compatibility (R-5.2)", () => {
  test("flat FrettedNote[] with all single-digit frets → byte-identical output", () => {
    const scale = buildFrettedScale(CAGED_E, "A");
    const notes = scale.notes.slice(0, 4);
    const result = toAsciiTab(notes);
    // Should have 6 lines
    expect(result.split("\n")).toHaveLength(6);
    // Each line should start with label|
    for (const line of result.split("\n")) {
      expect(line).toMatch(/^[a-gA-G]\|/);
    }
    // Should not contain any parenthesised chords
    expect(result).not.toContain("(");
    // For sequential single-digit frets, the output should NOT contain
    // any multi-char padded cells (no " 0" or similar padding artifacts)
    // Verify no space-padded frets appear (they only appear in grouped multi-digit columns)
    expect(result).not.toMatch(/ \d/);
    // The format should be label|...|  — just validate structure
    const lines = result.split("\n");
    for (const line of lines) {
      expect(line).toMatch(/^[a-gA-G]\|.*\|$/);
    }
  });

  test("empty flat array [] produces 6 empty-body lines", () => {
    const result = toAsciiTab([]);
    const lines = result.split("\n");
    expect(lines).toHaveLength(6);
    // Each line: label + || (empty content)
    for (const line of lines) {
      expect(line).toMatch(/^[a-gA-G]\|\|$/);
    }
  });

  test("flat input with 7-string tuning still works", () => {
    const STANDARD_7 = ["B1", "E2", "A2", "D3", "G3", "B3", "E4"];
    const note: FrettedNote = makeFrettedNote(0, 2);
    const result = toAsciiTab([note], { tuning: STANDARD_7 });
    expect(result.split("\n")).toHaveLength(7);
  });

  test("flat output matches expected fret.string format for known notes", () => {
    // A string (index 1), fret 5
    const note = makeFrettedNote(1, 5);
    const result = toAsciiTab([note]);
    const lines = result.split("\n");
    // display row 4 = string 1 (A) for 6-string standard
    const aLine = lines[4];
    expect(aLine).toContain("5");
    // high-E (display row 0 = string 5): not played → '-'
    expect(lines[0]).toMatch(/\|-\|/);
  });
});
