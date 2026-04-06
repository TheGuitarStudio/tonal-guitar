/**
 * Pattern generators for melodic scale exercises.
 *
 * Pure functions that produce degree sequences (number arrays).
 * These sequences can be passed to Scale.degrees() to resolve
 * actual notes, or to a fretboard pattern walker.
 */

/**
 * Generate ascending interval pattern over a scale.
 *
 * For 3rds (interval=2) over 7-note scale:
 *   [1,3, 2,4, 3,5, 4,6, 5,7, 6,8]
 * For 4ths (interval=3):
 *   [1,4, 2,5, 3,6, 4,7, 5,8]
 *
 * @param scaleLength - number of notes in the scale (e.g. 7 for diatonic)
 * @param interval - the interval size in scale steps (2=3rds, 3=4ths, 5=6ths)
 * @param octaves - how many octaves to span (default 1)
 */
export function ascendingIntervals(
  scaleLength: number,
  interval: number,
  octaves: number = 1,
): number[] {
  const result: number[] = [];
  const totalDegrees = scaleLength * octaves + 1; // +1 to include the octave
  for (let i = 1; i <= totalDegrees - interval; i++) {
    result.push(i, i + interval);
  }
  return result;
}

/**
 * Generate descending interval pattern.
 *
 * For 3rds (interval=2) over 7-note scale starting at octave (8):
 *   [8,6, 7,5, 6,4, 5,3, 4,2, 3,1]
 *
 * @param scaleLength - number of notes in the scale (e.g. 7 for diatonic)
 * @param interval - the interval size in scale steps (2=3rds, 3=4ths, 5=6ths)
 * @param startDegree - starting degree (default: scaleLength + 1, i.e. the octave)
 */
export function descendingIntervals(
  scaleLength: number,
  interval: number,
  startDegree?: number,
): number[] {
  const result: number[] = [];
  const start = startDegree ?? scaleLength + 1;
  for (let i = start; i >= 1 + interval; i--) {
    result.push(i, i - interval);
  }
  return result;
}

/**
 * Generate ascending linear pattern: [from, from+1, ..., to]
 *
 * @param from - starting degree (inclusive)
 * @param to - ending degree (inclusive)
 */
export function ascendingLinear(from: number, to: number): number[] {
  const result: number[] = [];
  for (let i = from; i <= to; i++) {
    result.push(i);
  }
  return result;
}

/**
 * Generate descending linear pattern: [from, from-1, ..., to]
 *
 * @param from - starting degree (inclusive)
 * @param to - ending degree (inclusive)
 */
export function descendingLinear(from: number, to: number): number[] {
  const result: number[] = [];
  for (let i = from; i >= to; i--) {
    result.push(i);
  }
  return result;
}

/**
 * Generate a grouping pattern where each group starts one step higher.
 *
 * grouping(7, 4, 1) → [1,2,3,4, 2,3,4,5, 3,4,5,6, 4,5,6,7]
 *
 * @param scaleLength - number of notes in the scale
 * @param groupSize - how many notes per group
 * @param step - how many steps to advance between groups (default 1)
 */
export function grouping(
  scaleLength: number,
  groupSize: number,
  step: number = 1,
): number[] {
  const result: number[] = [];
  for (let i = 1; i <= scaleLength - groupSize + 1; i += step) {
    for (let j = 0; j < groupSize; j++) {
      result.push(i + j);
    }
  }
  return result;
}

/**
 * Convenience wrapper: ascending 3rds (interval=2).
 */
export function thirds(scaleLength: number): number[] {
  return ascendingIntervals(scaleLength, 2);
}

/**
 * Convenience wrapper: ascending 4ths (interval=3).
 */
export function fourths(scaleLength: number): number[] {
  return ascendingIntervals(scaleLength, 3);
}

/**
 * Convenience wrapper: ascending 6ths (interval=5).
 */
export function sixths(scaleLength: number): number[] {
  return ascendingIntervals(scaleLength, 5);
}
