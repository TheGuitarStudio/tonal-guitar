---
title: Transform
description: Relabel a ScaleShape's intervals into a different interval frame
---

```js
import * as Guitar from "tonal-guitar";

const em = Guitar.relabelShape(Guitar.get("G Shape"), ["1P", "2M", "3m", "4P", "5P", "6m", "7m"], {
  name: "Em Shape",
  quality: "minor",
  parentShape: "G Shape",
});
```

`transform.ts` is a pure-tier module (zero optional Tonal peers) that rewrites a `ScaleShape`'s per-string interval labels into a different, rotation-compatible interval frame. Geometry (which string/fret each note lands on) never changes — only interval labels, `rootString`, `name`, `quality`, and `parentShape` are rewritten. This is the primitive that powers the 10 registered minor-quality shapes (see [Shapes](/docs/guitar/shapes)) and the `buildFromScale` pitch-correctness fix (see [Integration](/docs/guitar/integration)).

## relabelShape

`relabelShape(shape: ScaleShape, targetIntervals: string[], options?: RelabelOptions) => ScaleShape | undefined`

```ts
interface RelabelOptions {
  name?: string; // override the derived name (default: input shape.name)
  quality?: string; // value written to result.quality
  parentShape?: string; // value written to result.parentShape (default: shape.name)
}
```

Rewrites `shape`'s interval labels into `targetIntervals` (e.g. `["1P","2M","3m","4P","5P","6m","7m"]` for natural minor). Returns a **new** `ScaleShape` -- the input is never mutated.

The algorithm is chroma-anchored and enharmonic-safe:

1. Reduce `targetIntervals` to a `chroma -> interval` map (first interval wins on a chroma collision).
2. Collect the set of chromas used by the shape's (non-null) strings.
3. Find a tonic offset `t`: the first chroma (ascending) in the shape's own chroma set such that every shape chroma, shifted by `-t`, lands in the target chroma set. Identity (`t = 0`) wins when the shape already fits the target frame, so relabeling a shape into its own frame is a no-op.
4. Rewrite every per-string interval by that offset, preserving array order and `null` string entries.
5. Recompute `rootString` as the **lowest string index** whose original intervals contain the new tonic (chroma `t`).

Returns `undefined` (never throws -- the project's empty-result convention) when no tonic offset satisfies step 3 -- e.g. relabeling a 7-note CAGED shape into a 5-note pentatonic frame, or an all-null/empty shape.

### Worked example: CAGED_G -> "Em Shape"

`relabelShape(get("G Shape"), ["1P","2M","3m","4P","5P","6m","7m"], { name: "Em Shape", quality: "minor", parentShape: "G Shape" })` selects tonic offset `t = 9` (the `"G Shape"` chroma of `6M`) and rewrites every interval by that mapping:

| Parent (major frame) | Chroma | -9 mod 12 | Target (natural-minor frame) |
| --- | --- | --- | --- |
| 6M | 9 | 0 | 1P |
| 7M | 11 | 2 | 2M |
| 1P | 0 | 3 | 3m |
| 2M | 2 | 5 | 4P |
| 3M | 4 | 7 | 5P |
| 4P | 5 | 8 | 6m |
| 5P | 7 | 10 | 7m |

The result's `rootString` becomes `0` (the lowest string carrying `6M` in `"G Shape"`), `name` is `"Em Shape"`, `quality` is `"minor"`, and `parentShape` is `"G Shape"`. This is exactly how `src/data/caged-scales-minor.ts` derives its 5 entries, and `src/data/pentatonic-minor.ts` derives its 5 entries with `targetIntervals = ["1P","3m","4P","5P","7m"]`.

```js
buildFrettedScale(get("G Shape"), "C").notes; // C-major positions, C=1P
buildFrettedScale(get("Em Shape"), "A").notes; // SAME fret positions, A=1P, C=3m
```

`relabelShape` is a general primitive, not limited to natural minor -- any rotation-compatible target frame works, including the other diatonic modes (e.g. relabeling into dorian's `["1P","2M","3m","4P","5P","6M","7m"]` succeeds with `t = 2`).

## relabelShapeToScale

See [Integration](/docs/guitar/integration#relabelshapetoscale) for the scale-name-driven wrapper (`relabelShapeToScale(shape, scaleName, options?)`), which resolves `scaleName` via Tonal's `Scale.get()` and delegates to `relabelShape`.

## ScaleShape metadata: `quality` and `parentShape`

`ScaleShape` (see [Shapes](/docs/guitar/shapes)) carries two optional fields used by relabeled entries:

```ts
interface ScaleShape {
  name: string;
  system: string;
  strings: (string[] | null)[];
  rootString: number;
  span?: number;
  quality?: string; // interval-frame quality tag, e.g. "major" | "minor" | "minor-pentatonic"
  parentShape?: string; // name of the source shape a relabeled entry was derived from, e.g. "G Shape"
}
```

- `quality` -- the registry-facing quality label of the interval frame. Hand-authored major source shapes (`"E Shape"`, `"Pentatonic Box 1"`, etc.) leave it `undefined`; every relabeled entry sets it (`"minor"` for the 5 CAGED-minor shapes, `"minor-pentatonic"` for the 5 pentatonic-minor boxes).
- `parentShape` -- the `name` of the shape a derived entry was relabeled from. `undefined` on hand-authored source shapes.

```js
get("Em Shape"); // => { name: "Em Shape", quality: "minor", parentShape: "G Shape", ... }
get("Pentatonic Box 1 Minor"); // => { name: "Pentatonic Box 1 Minor", quality: "minor-pentatonic", parentShape: "Pentatonic Box 1", ... }
get("G Shape").quality; // => undefined
```
