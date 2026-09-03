/**
 * Pure tool-driven interpretation of `FretboardEditor`'s controlled
 * `cells`/`onChange` pair (spec §5.4 Editor requirements: "Tools: Select /
 * Note / Root / Finger (1–4) / Barre (drag across strings) / Mute").
 *
 * `fretboard-ui`'s `FretboardEditor` has no concept of tools: its internal
 * double-click-to-add/remove and "Set root"/"Clear" buttons always run the
 * same plain-note semantics regardless of which tool is selected here.
 * Group 26 owns turning that raw `cells` diff into the six tools' real
 * semantics, without touching `fretboard-ui` (out of scope for this group).
 *
 * The approach: intercept every `onChange(nextCells)` call, diff it against
 * the previous `cells`, and reinterpret a single add/remove according to the
 * active tool. Anything that isn't a clean single add/remove (the built-in
 * "Clear" button emptying the board, or "Set root" flipping `isRoot` across
 * the existing cells with the array length unchanged) is passed through
 * unmodified — both of those already do exactly what "Note"/"Root" tools
 * want, so no interception is needed for them.
 */
import type { EditorCell } from "fretboard-ui";

export type EditorTool = "select" | "note" | "root" | "finger" | "barre" | "mute";
export type ActiveFinger = 1 | 2 | 3 | 4;

function cellKey(c: EditorCell): string {
  return `${c.string}:${c.fret}`;
}

/**
 * Reinterprets one `FretboardEditor` `onChange` call under the active tool.
 *
 * - **Select** / **Barre**: never mutate note placement. Barre spans are
 *   authored through a separate control (they aren't `EditorCell`-shaped),
 *   and Select is a non-destructive inspection mode.
 * - **Note**: passes the raw add/remove through unchanged — this is
 *   `FretboardEditor`'s native behavior.
 * - **Root**: a newly added cell becomes the sole root (`isRoot: true`,
 *   cleared on every other cell); an attempted removal is ignored — switch
 *   to Note to delete a placed note.
 * - **Finger**: a newly added cell carries `finger: activeFinger`; an
 *   attempted removal of an *existing* cell instead updates that cell's
 *   `finger` in place (so re-clicking an already-placed note re-fingers it
 *   rather than deleting it).
 * - **Mute**: a newly added cell carries `muted: true`; an attempted
 *   removal instead toggles `muted` on the existing cell in place.
 *
 * Anything that isn't a clean single add or single remove (the "Clear"
 * button's full reset, or the "Set root" button's in-place `isRoot` flip
 * across the same-length array) passes through as `nextCells` verbatim —
 * both already implement exactly what "Note"/"Root" need.
 */
export function applyCellsChange(
  prevCells: EditorCell[],
  nextCells: EditorCell[],
  tool: EditorTool,
  activeFinger: ActiveFinger,
): EditorCell[] {
  if (tool === "select" || tool === "barre") {
    return prevCells;
  }

  const prevKeys = new Set(prevCells.map(cellKey));
  const nextKeys = new Set(nextCells.map(cellKey));

  const addedKeys = nextCells.filter((c) => !prevKeys.has(cellKey(c)));
  const removedKeys = prevCells.filter((c) => !nextKeys.has(cellKey(c)));

  const isSingleAdd = nextCells.length === prevCells.length + 1 && addedKeys.length === 1;
  const isSingleRemove = nextCells.length === prevCells.length - 1 && removedKeys.length === 1;

  if (isSingleAdd) {
    const added = addedKeys[0];
    if (tool === "note") return nextCells;
    if (tool === "root") {
      const cleared = prevCells.map((c) => (c.isRoot ? { ...c, isRoot: false } : c));
      return [...cleared, { string: added.string, fret: added.fret, isRoot: true }];
    }
    if (tool === "finger") {
      return [...prevCells, { string: added.string, fret: added.fret, finger: activeFinger }];
    }
    // "mute"
    return [...prevCells, { string: added.string, fret: added.fret, muted: true }];
  }

  if (isSingleRemove) {
    const removed = removedKeys[0];
    if (tool === "note") return nextCells;
    if (tool === "root") return prevCells;
    if (tool === "finger") {
      return prevCells.map((c) => (c === removed ? { ...c, finger: activeFinger } : c));
    }
    // "mute"
    return prevCells.map((c) => (c === removed ? { ...c, muted: !c.muted } : c));
  }

  return nextCells;
}
