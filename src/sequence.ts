import { FrettedNote, FrettedScale } from "./shape";
import { walkPattern } from "./walker";

export interface SequenceOptions {
  incremental?: boolean; // start from each successive degree (default: false)
  boundToShape?: boolean; // clip to shape's note range (default: true)
  startDegree?: number; // which degree to start from (default: 1)
  passes?: number; // how many incremental passes (default: all that fit)
}

/**
 * Apply a degree sequence to a fretted scale, optionally incrementing.
 *
 * When incremental=true:
 * - Pass 1: pattern as-is (offset by startDegree - 1)
 * - Pass 2: each degree in pattern += 1
 * - Pass 3: each degree in pattern += 2
 * - ...continues until bounded by shape's range or passes limit
 *
 * When boundToShape=true (default):
 * - A pass is truncated if any note would fall outside the shape's available notes
 * - "Outside" means walkPattern can't find a note for that degree
 *
 * Returns one FrettedNote[] array per pass.
 */
export function applySequence(
  scale: FrettedScale,
  sequence: number[],
  options?: SequenceOptions,
): FrettedNote[][] {
  const {
    incremental = false,
    boundToShape = true,
    startDegree = 1,
    passes: maxPasses,
  } = options ?? {};

  const scaleLen = new Set(scale.notes.map((n) => n.scaleIndex)).size;
  if (scaleLen === 0) return [];

  const result: FrettedNote[][] = [];
  const numPasses = incremental ? (maxPasses ?? scaleLen) : 1;
  const offset = startDegree - 1;

  for (let pass = 0; pass < numPasses; pass++) {
    const adjustedPattern = sequence.map((d) => d + offset + pass);
    const walked = walkPattern(scale, adjustedPattern, { direction: "auto" });

    // Bound check: if we got fewer notes than the pattern, stop
    if (boundToShape && walked.length < sequence.length) {
      break;
    }

    result.push(walked);
  }

  return result;
}

/**
 * Flatten multiple passes into a single note array.
 */
export function flattenSequence(passes: FrettedNote[][]): FrettedNote[] {
  return passes.flat();
}
