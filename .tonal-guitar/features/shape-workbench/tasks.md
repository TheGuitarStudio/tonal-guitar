# Task Breakdown: Shape Workbench

## Overview

**Total task groups:** 30, organized across 8 layers: Tooling, Library / Types, Core Logic, Integration, Data Corrections, Merge Script, Packages, Site, and a final Testing/gap-analysis pass.

**Surfaces touched:**

- `src/` — new/extended types, registries, resolvers, build engine, audit engine, integration helpers, changeset schema, data corrections and additions.
- `scripts/` — new `shapes-merge.mjs` CLI + `scripts/lib/render-shape.mjs` printer + fixture tests (the riskiest code path — the only writer of published `src/data/*.ts` source).
- `packages/` — extends `fretboard-ui`; adds three new `file:`-linked packages: `shape-catalog` (pure), `shape-library-ui` (framework-neutral React), `shape-workbench` (Vite app, first Vite consumer in the repo).
- `site/` — `site/app/shapes` migrates incrementally onto the shared packages; `site/app/admin` is retired.
- Root tooling — `vitest.config.ts`, ESLint globs, `.github/workflows/ci.yml`, `package.json` (`shapes:merge`, `workbench` scripts), `.gitignore` (`.workbench/`).

This feature absorbs and closes **#66** (chord fingering/barre export) and **#57** (CAGED minor triads), and lays additive groundwork for arpeggio registries (#58) without seeding data. No database, API server, or validation-library layer exists in this codebase — the analogous "riskiest mutation path" layer here is the merge script, treated with the same rigor a schema/API layer would get elsewhere.

---

## Task List

### Tooling

#### Group 1: Vitest Include Globs & Lint Globs Expansion

**Dependencies:** None — do this first so every subsequent group's new test files are picked up by `npm test` as they land.

- [ ] 1.1 Extend `vitest.config.ts:5` `test.include` from `["src/**/*.test.ts"]` to `["src/**/*.test.ts", "scripts/**/*.test.mjs", "packages/*/src/**/*.test.{ts,tsx}"]` (spec §8).
- [ ] 1.2 Extend the `lint` script glob in `package.json:38-39` (`eslint 'src/**/*.ts'` / `lint:fix`) to also cover `packages/*/src/**/*.{ts,tsx}` and `scripts/**/*.mjs` (spec §8). Add or reuse an ESLint config appropriate for `.tsx`/JSX if the root config doesn't already support it (check `eslint.config.*` at repo root).
- [ ] 1.3 Add `.workbench/` to `.gitignore` (currently absent — D-008, spec §6.7).
- [ ] 1.4 Add placeholder root scripts referenced later so later groups only need to fill in implementations, not add new script keys under time pressure: `"shapes:merge": "node scripts/shapes-merge.mjs"` and `"workbench": "npm --prefix packages/shape-workbench run dev"` in `package.json` `scripts` (spec §6.6, §5.4). Leave `scripts/shapes-merge.mjs` and `packages/shape-workbench` to fail loudly (not exist yet) until their groups land — do not stub fake success.
- [ ] 1.5 Run `npm test` and `npm run lint` to confirm the config change alone doesn't break anything (zero new test files yet, so counts are unchanged).

**Acceptance Criteria:**

- `vitest.config.ts` include array matches spec §8 exactly.
- `npm run lint` glob covers all three surfaces without erroring on the (currently nonexistent) `packages/*/src` / `scripts/*.mjs` paths.
- `.gitignore` contains `.workbench/`.
- `npm test` and `npm run build` still pass unchanged (no behavior change yet).

---

### Library / Types (`src/shape.ts`, zero-Tonal-dep tier)

#### Group 2: Shape Data Model — Additive Fields & New Interfaces

**Dependencies:** None.

- [ ] 2.1 **Test-first** (`src/shape.test.ts`): add cases asserting the new optional fields round-trip on `ChordShape`/`ScaleShape` object literals (TypeScript compile-time check via a `satisfies`/assignment test, not a runtime assertion) and that `VoicingFamily` accepts `"triad"`.
- [ ] 2.2 Add `export type CagedPosition = "C" | "A" | "G" | "E" | "D";` to `src/shape.ts` (spec §1.1).
- [ ] 2.3 Add optional fields to `ChordShape` (`src/shape.ts:51-73`): `cagedPosition?: CagedPosition`, `movable?: boolean`, `parentShape?: string`, `tags?: string[]`, `tuning?: string[]`, `overrides?: string`, `notes?: string` (spec §1.2). Document `movable`'s default (`canonicalRoot === undefined`) in a JSDoc comment; do not set it on any existing data.
- [ ] 2.4 Add optional fields to `ScaleShape` (`src/shape.ts:22-36`): `cagedPosition?: CagedPosition`, `chordType?: string`, `tags?: string[]`, `tuning?: string[]`, `overrides?: string`, `notes?: string` (spec §1.3). Do **not** re-add `parentShape` — it already exists at `src/shape.ts:29`. Document that `chordType`, when present, is always `Chord.get(...).symbol`, never `detect()` output.
- [ ] 2.5 Add `"triad"` to the `VoicingFamily` union (`src/shape.ts:38-47`); confirm `"extended"` is already present (it is, per spec §1.4 — no change needed there).
- [ ] 2.6 Add the new `ArpeggioShape` interface to `src/shape.ts` extending `ScaleShape`, with `chordType: string` **required** (unlike the optional `ScaleShape.chordType`), plus `fingers?: (number | null)[][]`, `chordShape?: string`, `cagedPosition?: CagedPosition`, `overrides?: string` (spec §1.5, exact shape). Document that it is structurally a `ScaleShape` so `buildFrettedScale`/`walkShape`/`inferShapeContext`/`checkScaleBuildLoss` work unchanged — no seeded data in this feature.
- [ ] 2.7 Add the JSDoc block on the registry section (see Group 3) stating registries are the project's sanctioned mutation seam and that `remove`/replace-on-add do not violate the "pure functions only" convention (spec §1.6, last bullet) — write it here since it documents the fields' mutability story, wire it into Group 3's registry code.

**Acceptance Criteria:**

- `npm run build` (tsc via tsup) succeeds with zero new type errors anywhere in `src/`.
- No existing `src/data/*.ts` literal needs a type-assertion change (fields are additive-only).
- `git grep -n "@tonaljs" src/shape.ts` returns nothing (tier contract preserved).
- `npm test -- src/shape.test.ts` passes.

**Files to Modify:** `src/shape.ts`, `src/shape.test.ts`

---

#### Group 3: Registry Mechanics — Replace-on-Add, `remove()`, `arpeggioShapes` Registry

**Dependencies:** Group 2

- [ ] 3.1 **Test-first** (`src/shape.test.ts`): replace-on-same-name `add()` preserves array index/position in `all()`/`chordShapes.all()`/`arpeggioShapes.all()` (not append-and-dedupe); `remove(name)` returns `true`/`false` correctly and updates both the array and index map on all three registries; `arpeggioShapes` CRUD (`get`/`all`/`names`/`add`/`remove`/`removeAll`/`query`) exercises every filter key including tag-superset matching.
- [ ] 3.2 Rewrite the scale registry `add()` (`src/shape.ts:141-145`) to replace-in-place when `shape.name` already exists in `index`, preserving the array slot; otherwise push (spec §1.6). Add module-level `export function remove(name: string): boolean` mirroring `add`/`removeAll`.
- [ ] 3.3 Apply the identical replace-on-add + `remove` treatment to the `chordShapes` object (`src/shape.ts:159-177`).
- [ ] 3.4 Extend `chordShapes.query` (`src/shape.ts:178-201`) with `cagedPosition?: CagedPosition` and `tags?: string[]` (superset match — shape must carry every requested tag), preserving existing filter semantics for `chordType`/`system`/`voicingFamily`/`stringSet` (spec §1.6).
- [ ] 3.5 Add the new `arpeggioShapes` registry object mirroring `chordShapes`'s shape exactly: `{ get, all, names, add, remove, removeAll, query }`, with `query(filter: { chordType?, system?, cagedPosition?, tags?, chordShape?, overrides? })`. Ships with zero seeded data (spec §1.6).
- [ ] 3.6 Add the JSDoc block from Group 2.7 directly above the registry section, documenting registries as the sanctioned mutable seam.
- [ ] 3.7 Verify no existing registered shape name collides under the new replace-on-add semantics (a duplicate name today would have silently produced two entries — confirm none exist via `chordShapes.all().length === new Set(chordShapes.names()).size` and the scale equivalent, in a new test).

**Acceptance Criteria:**

- `npm test -- src/shape.test.ts` covers replace-on-add index stability, `remove` on all three registries, `arpeggioShapes` CRUD + tag-superset `query`.
- No existing test in `src/index.test.ts` / `src/data/data.test.ts` regresses (registry ordering unchanged for all currently-distinct names).
- `arpeggioShapes.all()` returns `[]` immediately after `import "./index"` (no seed data).

**Files to Modify:** `src/shape.ts`, `src/shape.test.ts`

---

#### Group 4: Arpeggio Resolver Layer

**Dependencies:** Group 3

- [ ] 4.1 **Test-first** (`src/shape.test.ts`): `arpeggioSlotKey` stability/determinism for identical inputs and distinctness across `system`/`chordType`/`cagedPosition`/`rootString` variations, using the `` `${system ?? "*"}|${chordType}|${cagedPosition ?? "*"}|${rootString}` `` format; `resolveArpeggioForSlot` override→core→derived precedence, `alternatives` populated correctly when two overrides target the same slot (deterministic "last registered" pick); `visibleArpeggios()` include/exclude of `overrides`-targeted entries.
- [ ] 4.2 Add `ArpeggioSlot`, `ArpeggioTier`, `ArpeggioResolution` interfaces/types to `src/shape.ts` exactly per spec §1.7.
- [ ] 4.3 Implement `arpeggioSlotKey(slot: ArpeggioSlot): string` using the exact format above.
- [ ] 4.4 Implement `slotForChordShape(shape: ChordShape): ArpeggioSlot` (derives `chordType`, `cagedPosition`, `system`, `rootString`, `chordShapeName: shape.name` from the chord shape).
- [ ] 4.5 Implement `resolveArpeggioForSlot(slot: ArpeggioSlot): ArpeggioResolution`: query `arpeggioShapes` for the slot; a candidate is an override iff its `overrides` field names another registered arpeggio in the same slot; core preference is `featured === true` first, else first registered; multiple overrides resolve to the last-registered one with the rest in `alternatives`; tier is `"derived"` when no stored candidate exists (no `shape` field set in that case).
- [ ] 4.6 Implement `visibleArpeggios(options?: { includeOverridden?: boolean }): ArpeggioShape[]` excluding every shape that is the `overrides` target of another registered shape, unless `includeOverridden: true`.

**Acceptance Criteria:**

- `npm test -- src/shape.test.ts` covers override→core→derived precedence and both `visibleArpeggios` modes.
- Resolver functions are pure and registry-only (no `@tonaljs/*` import in `src/shape.ts`).

**Files to Modify:** `src/shape.ts`, `src/shape.test.ts`

---

#### Group 5: Shape Identity & Geometry Helpers

**Dependencies:** Group 2 (parallel-eligible with Groups 3–4 — these helpers do not depend on registry/resolver work)

- [ ] 5.1 **Test-first** (`src/shape.test.ts`): `isMovable` default (`movable ?? canonicalRoot === undefined`) against both a movable and a canonical-root shape; `playedStringSet`/`impliedStringSet` against a shape with an explicit `stringSet` and one without (falls back to `playedStringSet`) — port the existing local helper semantics from `src/data/extended-chords.test.ts:84-89`; `gripBaseFret` on frets arrays with/without open strings/mutes; `absoluteBarreFret` and `sourceGripBaseFret` on representative fixtures; `exportIdentifierFor` determinism and the `CHORD_E_SHAPE_MINOR`-style naming rule (never `CAGED_CHORD_EM`-style guessing).
- [ ] 5.2 Implement `isMovable(shape: ChordShape): boolean` in `src/shape.ts` (spec §1.8). No behavior change anywhere — no shape sets `movable` yet.
- [ ] 5.3 Implement `playedStringSet(shape: ChordShape): number[]` (indices where `strings[i] != null`) and `impliedStringSet(shape: ChordShape): number[]` (`shape.stringSet ?? playedStringSet(shape)`).
- [ ] 5.4 Implement `gripBaseFret(frets: (number | null)[]): number` (min non-null, non-zero fret; `0` if none) per D-010's redefinition.
- [ ] 5.5 Implement `absoluteBarreFret(barre: Barre, gripBase: number): number` (`gripBase + barre.fret`).
- [ ] 5.6 Implement `sourceGripBaseFret(shape: ChordShape, sourceFrets: (number|null)[]): number` — the source-diagram analog of `gripBaseFret`, used by the barre migration against `chordShapeGeometry(shape).sourceFrets`.
- [ ] 5.7 Implement `exportIdentifierFor(kind: "chord"|"scale"|"arpeggio", shape: { name: string }): string` per the exact rule in spec §1.8: `<KIND_PREFIX>_<NAME_UPPER_SNAKE>`, e.g. `("chord", { name: "E Shape Minor" }) → "CHORD_E_SHAPE_MINOR"`. Do not attempt to derive the existing hand-written shorthand (`CAGED_CHORD_EM`) — that requires an explicit `ident` override in the changeset, handled in Group 7/17.
- [ ] 5.8 Update the `Barre` type doc (`src/shape.ts:75-80`) to state the new offset-from-grip-base convention (D-010), and update `src/data/open-chords.ts:25-26`'s `absFret` header comment in the same commit to point at the new convention (the actual data migration is Group 13 — this is doc-only here).

**Acceptance Criteria:**

- `npm test -- src/shape.test.ts` covers every helper with at least one representative fixture.
- `exportIdentifierFor` never collides two distinct shape names it's exercised against in tests.
- `Barre`'s JSDoc and `open-chords.ts`'s header comment both describe the offset convention (no behavior change to the still-absolute data yet — Group 13 migrates the data).

**Files to Modify:** `src/shape.ts`, `src/shape.test.ts`, `src/data/open-chords.ts` (comment only)

---

#### Group 6: Chord-Scale Rule Module

**Dependencies:** None (parallel-eligible with Groups 2–5)

- [ ] 6.1 **Test-first** (new `src/chord-scale.test.ts`): the v1 mapping table exact values (`M`→`major`, `maj7`→`major`, `m`→`aeolian` with alternates `["dorian","major"]`, `m7`→`aeolian` with the same alternates, `"7"`→`mixolydian`, `m7b5`→`locrian`); `dim`/`dim7`/`aug` return `undefined`; `CHORD_SCALE_RULE_VERSION === 1`.
- [ ] 6.2 Create `src/chord-scale.ts` (zero-Tonal-dep, per CLAUDE.md — the table is pure data): `export const CHORD_SCALE_RULE_VERSION = 1;`, `ChordScaleEntry` interface, `CHORD_SCALE_RULE` record, `scaleTypeForChordType(chordType): ChordScaleEntry | undefined` (spec §1.10, exact table).
- [ ] 6.3 Confirm `src/chord-scale.ts` imports nothing beyond nothing (no `@tonaljs/*`, no `./shape`) — the module is standalone data + one lookup function.

**Acceptance Criteria:**

- `npm test -- src/chord-scale.test.ts` passes and covers every table entry plus the three intentionally-absent chord types.
- `git grep -n "import" src/chord-scale.ts` shows zero imports (or only type-only imports if unavoidable — spec requires zero Tonal deps).

**Files to Create:** `src/chord-scale.ts`, `src/chord-scale.test.ts`

---

#### Group 7: Changeset Schema Types

**Dependencies:** None (parallel-eligible with Groups 2–6)

- [ ] 7.1 **Test-first**: a lightweight type-only test (`src/changeset.test.ts` or inline in `src/shape.test.ts`) asserting a representative `Changeset` object literal (one `AddChange`, one `UpdateChange`, one `RemoveChange`) type-checks against the exported interfaces — TypeScript compile check, not runtime logic (there is none at this layer).
- [ ] 7.2 Create `src/changeset.ts` with the exact interfaces from spec §6.1: `Changeset`, `ChangesetKind`, `ChangesetChange` (union), `AddChange`, `UpdateChange`, `RemoveChange`. The `$schema` field is the literal string type `"tonal-guitar/changeset@1"`. Import only `./shape` for the `ChordShape | ScaleShape | ArpeggioShape` union used in `AddChange.shape` — zero `@tonaljs/*` imports.
- [ ] 7.3 Document in a top-of-file comment that this module is exported as public types even though the merge script that consumes it (Group 17) is internal tooling, per spec §6.1.

**Acceptance Criteria:**

- `npm run build` type-checks the new module with no errors.
- `src/changeset.ts` has zero `@tonaljs/*` imports (verified via `git grep`).

**Files to Create:** `src/changeset.ts`, (test coverage folded into `src/shape.test.ts` or a small dedicated `src/changeset.test.ts`)

---

### Core Logic

#### Group 8: `Fingering` Carries Fingers/Barres + `autoFingering`

**Dependencies:** Group 2 (data model fields), Group 5 (`gripBaseFret` + the Barre offset convention from 5.8)

- [ ] 8.1 **Test-first** (new `src/build.test.ts`): `applyChordShape` result now has `fingers` (exact copy of `shape.fingers`, same length as `tuning.length`, never mutated) and `barres` (each entry's `fret` resolved to `gripBaseFret(frets) + shape.barres[i].fret`, other fields — `fromString`/`toString`/`finger` — passed through unchanged); confirm `positions`/`frets`/`root`/`shapeName`/`startFret` are byte-identical to current behavior on at least 3 existing registered shapes (regression guard — this is an additive-only change per spec §2.1). `autoFingering` determinism: lowest fretted fret → finger 1, increasing fret → increasing finger capped at 4, equal frets on ≥2 adjacent strings collapse into a shared-finger `Barre`, open strings → `0`, muted → `null`.
- [ ] 8.2 Extend the `Fingering` interface (`src/build.ts:270-276`) with `fingers: (number | null)[]` and `barres: Barre[]` (spec §2.1). Import `Barre` type from `./shape` if not already imported.
- [ ] 8.3 Update `applyChordShape` (`src/build.ts:283-313`) to populate `fingers`/`barres` using `gripBaseFret`/`absoluteBarreFret` from Group 5 — no change to note placement or `startFret` logic.
- [ ] 8.4 Implement `autoFingering(shape: Omit<ChordShape, "fingers"|"barres">, root: string, tuning?: string[]): { fingers: (number|null)[]; barres: Barre[] }` in `src/build.ts` per the deterministic rule in spec §2.2.
- [ ] 8.5 Confirm `src/build.ts`'s import list stays within the required-peer tier (no new imports beyond `./shape` per CLAUDE.md — `applyChordShape` already imports `@tonaljs/note`/`@tonaljs/interval`, which is unchanged).

**Acceptance Criteria:**

- `npm test -- src/build.test.ts` passes, including the byte-identical regression guard on existing shapes' `positions`/`frets`/`startFret`.
- Every current call site of `applyChordShape` across `src/` and `src/data/*.test.ts` continues to compile and pass unchanged (additive-only fields).
- `autoFingering` output is deterministic across repeated calls with identical inputs.

**Files to Create:** `src/build.test.ts`
**Files to Modify:** `src/build.ts`

---

#### Group 9: Required-Tier Audit Checks

**Dependencies:** Group 5 (`isMovable`, `impliedStringSet`, `playedStringSet`, `gripBaseFret`), Group 8 (`Fingering.fingers`/`barres`)

- [ ] 9.1 **Test-first** (`src/audit.test.ts`): `checkStringsetMismatch` — flags when `shape.stringSet` is defined and diverges from `playedStringSet(shape)`; skipped when `stringSet` absent. `checkTuningMismatch` — flags when `shape.tuning` is defined and diverges from the build tuning; skipped when absent. `checkBarreFretOrigin` — flags `barre.fret < 0`, `>` the shape's fretted span, or (for `baseFret`-carrying shapes) equal to an absolute source-diagram fret while a valid offset exists; details carry `{ barreIndex, fret, span, gripBase, suggestedOffset }`. `checkNameUnique` — errors when `shape.name` is already registered in the target registry or its `exportIdentifierFor` collides with an existing `src/data` identifier, via `checkNameUnique(shape, kind, options?: { knownNames?: Set<string>; knownIdentifiers?: Set<string> })` so the merge script can pass merge-time sets without touching the live registry. Also test `checkFingerZeroOnMovable` now delegates to `isMovable(shape)` (no behavior change on existing data — no shape sets `movable` yet). Also test `auditArpeggioShape` running only build-loss/`position-span`/`fingering-complete`/`overrides-target` on a hand-built `ArpeggioShape` fixture (no seeded data exists yet, so this is fixture-only).
- [ ] 9.2 Add `CHECK_STRINGSET_MISMATCH = "stringset-mismatch"`, `CHECK_TUNING_MISMATCH = "tuning-mismatch"`, `CHECK_BARRE_FRET_ORIGIN = "barre-fret-origin"`, `CHECK_NAME_UNIQUE = "name-unique"` constants to `src/audit.ts` (spec §3.1 table).
- [ ] 9.3 Implement the four new check functions in `src/audit.ts`, importing only `./build`, `./shape`, `./tuning`, `@tonaljs/note` (existing tier contract, `src/audit.ts:4-8`) — no new imports beyond what's already there plus `./shape`'s new helpers.
- [ ] 9.4 Switch `checkFingerZeroOnMovable` (`src/audit.ts:125-137`) from the open-coded `shape.canonicalRoot !== undefined` check to `!isMovable(shape)` (imported from `./shape`) — verify equivalence: `isMovable` defaults to `canonicalRoot === undefined` when `movable` is unset, matching current behavior exactly for all existing data.
- [ ] 9.5 Update `auditChordShape` (`src/audit.ts:476-492`) to compose the four new checks alongside the existing six, reusing the single hoisted `applyChordShape` build (CR-001 optimization preserved — pass `built` into any new check that needs a build).
- [ ] 9.6 Implement `auditArpeggioShape(shape: ArpeggioShape, options?): ShapeAuditIssue[]` running only the tier-safe checks: build-loss (`checkScaleBuildLoss`), `position-span`, `fingering-complete`, `overrides-target` (verifies the named core shape exists in `arpeggioShapes`). Note: `position-span`/`fingering-complete` are new check names implied by spec §3.1's `auditArpeggioShape` description but not separately tabled — define them analogously to `checkFretSpan`/`checkChordBuildLoss` scoped to arpeggio geometry; keep their constant names consistent with the `CHECK_*` naming convention (e.g. `CHECK_POSITION_SPAN`, `CHECK_FINGERING_COMPLETE`, `CHECK_OVERRIDES_TARGET`).
- [ ] 9.7 Run a registry-wide zero-issue sweep test for `stringset-mismatch`/`tuning-mismatch` against every currently-registered chord shape (none of them set `stringSet`/`tuning` inconsistently today, so this should be a clean pass and serves as the regression gate).

**Acceptance Criteria:**

- `npm test -- src/audit.test.ts` covers all four new checks plus `auditArpeggioShape`, including registry-wide sweeps.
- `src/audit.ts`'s import list is unchanged in tier (`./build`, `./shape`, `./tuning`, `@tonaljs/note` only) — verified via `git grep -n "^import" src/audit.ts`.
- `checkFingerZeroOnMovable`'s existing tests still pass unchanged.

**Files to Modify:** `src/audit.ts`, `src/audit.test.ts`

---

#### Group 10: Optional-Tier Audit Integration (D-006)

**Dependencies:** Group 9

- [ ] 10.1 **Test-first** (new `src/audit-integration.test.ts`): `identify-mismatch` positive (Tonal `detect()` on the built grip does not include `shape.chordType`) and negative cases; skipped (`[]`) when `chordType` is undefined; the three arpeggio chord-tone checks (`CHECK_CHORD_TONES_ONLY`, `CHECK_COVERS_CHORD`, `CHECK_CONTAINS_CHORD_GRIP`) against fixture `ArpeggioShape`s; an **import-graph assertion** that `src/audit.ts` never (even transitively) reaches `@tonaljs/chord` — e.g. by asserting `src/audit.ts`'s static import list contains no `./audit-integration` or `@tonaljs/chord` and that `src/audit-integration.ts` is never imported by `src/audit.ts` (grep-based test is acceptable).
- [ ] 10.2 Create `src/audit-integration.ts` importing only `./audit`, `./build`, `./shape`, `./tuning`, `@tonaljs/chord`, `@tonaljs/note`. It MUST NOT be imported by `src/audit.ts` (spec §3.2).
- [ ] 10.3 Implement `CHECK_IDENTIFY_MISMATCH = "identify-mismatch"` (warning): Tonal `detect()` on the built grip's pitch classes at the build root does not include `shape.chordType`; details `{ detected: string[], expected: string, root: string }`; skipped when `chordType` is undefined.
- [ ] 10.4 Implement `CHECK_CHORD_TONES_ONLY`, `CHECK_COVERS_CHORD`, `CHECK_CONTAINS_CHORD_GRIP` (all warning) for arpeggio shapes, using `Chord.get(chordType).intervals`.
- [ ] 10.5 Implement the aggregates: `auditChordShapeIntegration(shape, options)`, `auditArpeggioShapeIntegration(shape, options)`, `auditAllShapesIntegration(options)`, and the composer `auditChordShapeFull(shape, options) = base ++ integration`.
- [ ] 10.6 Export everything from `src/audit-integration.ts` — the actual `src/index.ts` re-export happens in Group 12, since `src/index.ts` already pulls the optional tier via `./integration`.

**Acceptance Criteria:**

- `npm test -- src/audit-integration.test.ts` passes, including the import-graph boundary assertion.
- `src/audit.ts` remains importable with zero optional peers present (confirmed by the existing tier-contract convention).

**Files to Create:** `src/audit-integration.ts`, `src/audit-integration.test.ts`

---

#### Group 11: Parent-Box Selection & Arpeggio Derivation

**Dependencies:** Group 4 (resolver layer), Group 6 (chord-scale rule)

- [ ] 11.1 **Test-first** (`src/integration.test.ts`): `parentBoxForChordShape` returns the registered scale shape whose `rootString` matches the grip's `rootString` after relabeling, for at least one chord type with a rule entry (e.g. `"m"` → aeolian) and one root; returns `undefined` for a chord type absent from `CHORD_SCALE_RULE` (`dim`/`dim7`/`aug`) and for a rotation-incompatible box. `arpeggioFor` — tier `"override"`/`"core"` builds the stored shape via `buildFrettedScale`; tier `"derived"` composes `parentBoxForChordShape` + the already-shipped `arpeggioFromShape` (`src/integration.ts:118-128`) with zero new arpeggio primitives.
- [ ] 11.2 Implement `parentBoxForChordShape(shape: ChordShape, root: string, tuning?: string[]): { box: ScaleShape; scaleName: string; ruleVersion: number } | undefined` in `src/integration.ts`: calls `scaleTypeForChordType(shape.chordType)` (Group 6), then finds the registered scale shape whose `rootString` equals the grip's `rootString` after `relabelShapeToScale(box, `${root} ${scaleType}`)` (`src/integration.ts:200-211`). Returns `undefined` when the chord type has no rule entry or no rotation-compatible box exists (spec §2.3). Note unregistered mode boxes (mixolydian/dorian/locrian) are derived on demand via `relabelShapeToScale` — no new seeding in this feature.
- [ ] 11.3 Implement `arpeggioFor(shape: ChordShape, root: string, tuning?: string[]): { resolution: ArpeggioResolution; fretted: FrettedScale }`: calls `resolveArpeggioForSlot(slotForChordShape(shape))` (Group 4); for `"override"`/`"core"` builds the stored shape via `buildFrettedScale`; for `"derived"` uses `parentBoxForChordShape` + `arpeggioFromShape` (spec §2.4).
- [ ] 11.4 Confirm `src/integration.ts` imports for these two functions stay within the already-established optional tier (`@tonaljs/scale`/`@tonaljs/chord` etc. already imported at the top of the file) — no new peer packages introduced.

**Acceptance Criteria:**

- `npm test -- src/integration.test.ts` covers `parentBoxForChordShape`'s rule-hit, rule-miss, and rotation-incompatible cases, plus `arpeggioFor`'s three tiers.
- `src/shape.ts` remains untouched by this group (the derive fallback lives entirely in the optional tier, per spec §2.4).

**Files to Modify:** `src/integration.ts`, `src/integration.test.ts`

---

### Integration (library-level)

#### Group 12: Public API Exports

**Dependencies:** Groups 2–11 (exports their combined public surface)

- [ ] 12.1 **Test-first** (`src/index.test.ts`): a smoke test importing every new export named in spec §1.11 from `"./index"` (or the package root in built form) and asserting each is defined (`typeof x !== "undefined"`) — catches typos/omissions mechanically.
- [ ] 12.2 Add type exports to `src/index.ts`: `CagedPosition`, `ArpeggioShape`, `ArpeggioSlot`, `ArpeggioResolution`, `ArpeggioTier`, `ChordScaleEntry`, `Changeset`, `ChangesetChange`, `AddChange`, `UpdateChange`, `RemoveChange`, `ChangesetKind`.
- [ ] 12.3 Add value exports: `arpeggioShapes`, `remove`, `isMovable`, `playedStringSet`, `impliedStringSet`, `gripBaseFret`, `absoluteBarreFret`, `sourceGripBaseFret`, `exportIdentifierFor`, `arpeggioSlotKey`, `slotForChordShape`, `resolveArpeggioForSlot`, `visibleArpeggios`, `CHORD_SCALE_RULE`, `CHORD_SCALE_RULE_VERSION`, `scaleTypeForChordType`.
- [ ] 12.4 Add the audit-tier exports: the four new `CHECK_*` constants and check functions from Group 9, plus `auditArpeggioShape`; and from `src/audit-integration.ts` (Group 10): `CHECK_IDENTIFY_MISMATCH`, `CHECK_CHORD_TONES_ONLY`, `CHECK_COVERS_CHORD`, `CHECK_CONTAINS_CHORD_GRIP`, `auditChordShapeIntegration`, `auditArpeggioShapeIntegration`, `auditAllShapesIntegration`, `auditChordShapeFull` (spec §3.2 — exported from `src/index.ts`, which already pulls the optional tier via `./integration`).
- [ ] 12.5 Add the integration-tier exports from Group 11: `parentBoxForChordShape`, `arpeggioFor`.
- [ ] 12.6 Add `autoFingering` export from Group 8, and confirm `Fingering`'s new `fingers`/`barres` fields flow through the existing `export type { Fingering }` (`src/index.ts:46`) without further changes.
- [ ] 12.7 Wrap the data-imports block (`src/index.ts:161-170`) in the `shapes-merge:begin/end data-imports` markers per spec §6.3, in preparation for Group 15/17 — content unchanged in this group, markers only.
- [ ] 12.8 Run `node scripts/check-dts.mjs` (via `npm run build`) to confirm the generated `.d.ts` surface is complete and non-broken.

**Acceptance Criteria:**

- `npm run build` succeeds, including the `check-dts.mjs` step.
- `npm test -- src/index.test.ts` smoke test passes for every newly-added export.
- Existing exports and their ordering in `src/index.ts` are unchanged except for the additive lines and the new marker comments.

**Files to Modify:** `src/index.ts`, `src/index.test.ts`

---

### Data Corrections (`src/data/*`)

#### Group 13: Barre-Fret Offset Migration (own gated task, D-010)

**Dependencies:** Group 5 (`gripBaseFret`, `absoluteBarreFret`, `sourceGripBaseFret`), Group 9 (`barre-fret-origin` check), Group 12 (public exports)

- [ ] 13.1 **Test-first** (`src/data/data.test.ts`, or a new `src/data/open-chords.barre-migration.test.ts`): fixture assertions for the three worked classes in spec §4.1 exactly as specified — `"A Major Open"` (`x02220`, `baseFret: 1`, barre `fret: 2` on strings 2–4) → offset `0`; `"C Sus2 Open"` (`baseFret: 1`, barre `fret: 3`) → offset `= 3 − gripBase`; `"C Minor Open"` (`x35543`, `baseFret: 3`, barre `fret: 3`) → offset `0`; `"E Form Major Barre"` (`baseFret: 1`, barre `fret: 0`, already an offset) → **stays `0`** (the trap a blanket `fret − baseFret` transform would break, yielding `-1`).
- [ ] 13.2 Migrate all 35 `barres` entries across the 70 chord shapes in `src/data/open-chords.ts`: `newFret = absoluteFret − sourceGripBase`, where `sourceGripBase` is the minimum **non-zero** fret of the shape's source diagram — using `sourceGripBaseFret` (Group 5) fed by `chordShapeGeometry(shape).sourceFrets` (`src/audit.ts:390-403`). The 10 already-offset movable barre entries (`fret: 0`, `baseFret: 1`) must be verified unchanged by the transform, not blindly rewritten.
- [ ] 13.3 Update `ShapeCardChordTable.tsx:43-45`'s `barreLabel` function to render `offset N (fret M at <root>)` using `absoluteBarreFret`, importing it from `"tonal-guitar"` (spec §4.1). Update the `barreLabel` call site's prop signature if it needs the shape's `gripBaseFret` (or built `frets`) to compute the absolute fret.
- [ ] 13.4 Search for and update every test that encodes a literal (pre-migration) barre value — start from `src/data/data.test.ts` and any component test that snapshots `ShapeCardChordTable` output.
- [ ] 13.5 Run a registry-wide sweep asserting `checkBarreFretOrigin` (Group 9) reports **zero** issues across all registered chord shapes post-migration — this is the regression gate specified in spec §4.1's last line.
- [ ] 13.6 Update the `open-chords.ts:25-26` header comment fully (already doc-updated in Group 5.8 — confirm it reflects the *actual* migrated data now, not just the convention).

**Acceptance Criteria:**

- `npm test` passes with the three worked-example fixtures asserting exact offset values.
- `checkBarreFretOrigin` sweep across the full registry returns zero issues.
- `ShapeCardChordTable` renders the new `offset N (fret M at <root>)` label; any existing snapshot/DOM test is updated deliberately, not silently.
- `applyChordShape` and `checkRepeatedFingerNoBarre` (`src/audit.ts:147`) behavior is unchanged (neither reads `barre.fret`) — confirmed by the existing test suite passing unmodified for those paths.

**Files to Modify:** `src/data/open-chords.ts`, `site/app/shapes/components/ShapeCardChordTable.tsx`, `src/data/data.test.ts` (and any other test file encoding literal barre values)

---

#### Group 14: Jazz Shells 16 → 8 Correction (D-012)

**Dependencies:** None (independent data fix — parallel-eligible with Groups 2–13; hand-authored, not merge-script-mediated per spec §4.2)

- [ ] 14.1 **Test-first** (`src/data/data.test.ts`): rewrite the shell-shape tests to the new pairing and naming *before* changing `jazz-shells.ts`, so the test run fails red first: `:683` `toHaveLength(16)` → `8`; the shape-finding tests at `:667-755` switch from `name.includes("R37")`/`"R73"` + separate `stringSet` matching to the new `"Shell <type> E-root"` / `"Shell <type> A-root"` names with `stringSet` `[0,2,3]` (E-root) / `[1,2,3]` (A-root); `:897` `shellCount` `16` → `8`.
- [ ] 14.2 Rewrite `src/data/jazz-shells.ts`'s generation loop (`:150-165`) to pair each ordering with exactly one string set instead of the full cross product: **E-root, R·x·7·3** on strings 6·4·3 → `stringSet [0, 2, 3]` using the `R-7-3` pattern (`strings[0] = "1P"`, `strings[2] = <7th>`, `strings[3] = <3rd>`); **A-root, R·3·7** on strings 5·4·3 → `stringSet [1, 2, 3]` using the `R-3-7` pattern. Result: 4 chord types × 2 root strings = 8 shapes.
- [ ] 14.3 Rename generated shapes to `"Shell <type> E-root"` / `"Shell <type> A-root"` (replacing `"Shell <type> R37 012"` etc.) in `buildShellShape` (`src/data/jazz-shells.ts:113-148`).
- [ ] 14.4 Confirm `SHELL_DICTIONARY` (`src/data/jazz-shells.ts:40-46`, public API exported at `src/index.ts:173`) keeps its `VoicingPatternDictionary` shape and values unchanged — only the generation pairing changes (spec §4.2, edge case 7).
- [ ] 14.5 Confirm `omittedIntervals`, `voicingFamily: "shell"`, `system: "shell"`, `inversion: 0`, and `rootString` semantics are unchanged; m7 and m7b5 keep sharing geometry (differing only in `omittedIntervals`: `5P` vs `5d`).
- [ ] 14.6 Propagate the total-chord-shape-count change (132 → 124) to every dependent assertion — search `src/data/data.test.ts` and `src/index.test.ts` for hard-coded totals; re-verify the `featured` chord count (`:1289`, currently `32`) is unaffected (no shell shape sets `featured`) and update only if that changes.

**Acceptance Criteria:**

- `npm test` passes with `SHELL_SHAPES` at length 8 and the new naming/string-set conventions throughout.
- `SHELL_DICTIONARY`'s exported keys/values are byte-identical to before this change (verified by a dedicated equality test).
- Total chord-shape-count assertions across the suite are updated deliberately (not left stale).

**Files to Modify:** `src/data/jazz-shells.ts`, `src/data/data.test.ts`, `src/index.test.ts` (if it carries any dependent total)

---

### Merge Script (`scripts/`, D-005)

#### Group 15: Generator-Owned-Block Prep — Markers & Count Annotations

**Dependencies:** Group 12 (public exports stable, so the shapes going through owned blocks match the final data model)

- [ ] 15.1 Add per-constant `// shapes-merge:begin <IDENT>` / `// shapes-merge:end <IDENT>` marker pairs around each of the 5 exported constants in `src/data/caged-chords.ts` (`CAGED_CHORD_E`, `CAGED_CHORD_A`, `CAGED_CHORD_D`, `CAGED_CHORD_C`, `CAGED_CHORD_G`) — this is the one-time, human-reviewed prep step from spec §6.3, and the sole write-allow-listed hand-written file for this feature.
- [ ] 15.2 Wrap the registration-order block in `src/index.ts` (already bracketed with markers in Group 12.7) — confirm the marker names/content match the `shapes-merge:begin/end data-imports` format shown in spec §6.3 exactly (comment-only, byte-preserving outside markers).
- [ ] 15.3 Add `// shapes-merge:count <name>` marker comments next to each hard-coded registry-count assertion the merge script's `--update-counts` flag will be allowed to rewrite: at minimum `src/data/data.test.ts:683/891/897/1111/1289/1355` (post-Group-13/14 line numbers may shift — locate by content, not line number, at implementation time) and `src/index.test.ts:388/393/398/402`. Do not annotate every count in the file — only the ones the merge script may legitimately touch (registry totals the CAGED-minor-triad add will affect).
- [ ] 15.4 Write a small `scripts/shapes-merge.test.mjs` placeholder (or a dedicated marker-parsing unit test) asserting the marker regex/parser (built in Group 17) can locate all 5 `caged-chords.ts` markers and the `data-imports` block by name — this validates the prep step mechanically rather than by eyeballing the diff.

**Acceptance Criteria:**

- `git diff` for this group touches only comments — zero behavior change, `npm test` output identical before/after.
- Every marker name is unique within its file and matches the `exportIdentifierFor`/anchor conventions the merge script will rely on in Group 17.

**Files to Modify:** `src/data/caged-chords.ts`, `src/index.ts`, `src/data/data.test.ts`, `src/index.test.ts`

---

#### Group 16: Single TS Printer — `scripts/lib/render-shape.mjs`

**Dependencies:** Group 2 (final field set), Group 7 (changeset types for the object shape being printed)

- [ ] 16.1 **Test-first** (`scripts/shapes-merge.test.mjs` or a dedicated `scripts/lib/render-shape.test.mjs`): given a representative `ChordShape`/`ScaleShape`/`ArpeggioShape` object, `renderShape(kind, shape, options?)` produces deterministic TS source text with stable identifier naming (`exportIdentifierFor`-equivalent, respecting an explicit `ident` override), stable key order, consistent quoting, and stable formatting; running it twice on the same input is byte-identical (idempotence).
- [ ] 16.2 Create `scripts/lib/render-shape.mjs` (plus `scripts/lib/render-shape.d.ts` for TS consumers) implementing the single TS printer: owns identifier naming, key order, quoting, and formatting for chord/scale/arpeggio constants (spec §6.5).
- [ ] 16.3 If `prettier` (already a devDependency per `package.json:73`) is resolvable at runtime, format output through the repo's Prettier config; otherwise fall back to the printer's own stable formatting. **No new runtime dependencies** — Node builtins only, per spec §6.5.
- [ ] 16.4 Confirm the printer's output for the 5 existing `caged-chords.ts` constants (fed back through the printer as a round-trip check) matches — modulo whitespace/formatting — the hand-written source, proving the printer isn't inventing a divergent convention.

**Acceptance Criteria:**

- `npm test -- scripts` passes the determinism/idempotence tests.
- `scripts/lib/render-shape.mjs` has zero `npm install`-required dependencies beyond what's already a devDependency (`prettier`, optional) and Node builtins.

**Files to Create:** `scripts/lib/render-shape.mjs`, `scripts/lib/render-shape.d.ts`, test coverage in `scripts/shapes-merge.test.mjs` (or a sibling `render-shape.test.mjs`)

---

#### Group 17: Merge Script Core — `scripts/shapes-merge.mjs`

**Dependencies:** Group 7 (changeset schema), Group 9/10 (audit for merge-time validation — `checkNameUnique`, `auditChordShapeFull`/`auditArpeggioShape*`/`auditScaleShape`), Group 15 (markers), Group 16 (printer)

- [ ] 17.1 **Test-first** (`scripts/shapes-merge.test.mjs`): stub the full set of refusal scenarios from spec §6.2 as failing-fast fixtures before implementing the validator: wrong `$schema`, version drift (refused unless `--force`), non-`STANDARD` tuning (refused unless `--force`), missing per-kind required fields, `file` not matching `/^[a-z0-9-]+$/` or hitting the computed-file deny list (`caged-scales-minor`, `pentatonic-minor` — refused **even with `--force`**), name/identifier collisions (registry + within-changeset), unresolvable `overrides` targets, audit-error refusal (warnings print and continue), and `update`/`remove` targets outside a generator-owned region.
- [ ] 17.2 Implement `scripts/shapes-merge.mjs` reading a `changeset@1` JSON file, running all validations from spec §6.2 in order (all before any write), and writing via the generator-owned-block strategy from spec §6.3: new files get the `// GENERATED FILE — managed by \`npm run shapes:merge\`. Edit via the Shape Workbench.` header; existing files (write allow-list: `src/data/caged-chords.ts` + any script-created file) are only rewritten inside the per-constant markers from Group 15; `open-chords.ts`/`extended-chords.ts`/`caged-chords-7th.ts`/`jazz-shells.ts` stay unmanaged and refuse with an explanatory message.
- [ ] 17.3 Implement registration-order insertion in `src/index.ts`'s owned `data-imports` block: new file inserted after its `after` anchor (default: the file declaring the shape's `parentShape`, else end of block); the block is regenerated whole, content outside markers byte-preserved.
- [ ] 17.4 Implement the CLI flags exactly per spec §6.6: `--dry-run` (validate + unified diff + "files that will change" summary, writes nothing, exit 0), `--check` (validate + assert working tree already reflects the changeset, exit 1 with diff otherwise — CI-safe gate), `--force` (bypasses only version-drift/tuning-mismatch, never audit errors/deny-list/collisions), `--out <ident>` (print generated TS for one change to stdout), `--root <dir>` (alternate repo root for fixture isolation), `--json` (machine-readable `{ added, updated, removed, filesWritten, warnings, countsTouched }`).
- [ ] 17.5 Implement `--update-counts`: rewrites only lines annotated with `// shapes-merge:count <name>` (Group 15.3); everything unannotated is reported, never edited. Default behavior (no flag) reports every count it would invalidate without editing.
- [ ] 17.6 Implement human-readable console output mirroring the canvas Export screen format: `✔ N shapes added, M updated`, per-file lines, `✔ audit: X errors, Y warnings in changed shapes`, `→ review with: git diff --stat`, `Undo: git checkout -- src/data`.
- [ ] 17.7 Verify idempotence: re-running the same changeset against an already-merged tree produces zero diff (this is both a runtime property and Group 18's dedicated test).
- [ ] 17.8 Confirm `package.json`'s `"shapes:merge"` script (stubbed in Group 1.4) now actually functions end-to-end against a hand-authored smoke-test changeset.

**Acceptance Criteria:**

- Every refusal scenario in spec §6.2 has a passing test and produces zero writes.
- `--dry-run` and `--check` never write to disk (verified by mtime/hash comparison in tests).
- Re-running an already-merged changeset via `--check` exits 0 with no diff.
- `--force` never bypasses audit-error or computed-file-deny-list refusals (dedicated negative test).

**Files to Create:** `scripts/shapes-merge.mjs`
**Files to Modify:** `package.json` (script already stubbed in Group 1)

---

#### Group 18: Merge Script Fixtures & Tests

**Dependencies:** Group 17

- [ ] 18.1 Create committed fixture changesets under `scripts/__fixtures__/changesets/*.json` (D-008) covering: new-file add, owned-block update, remove, identifier collision, name collision, version drift, non-standard tuning, computed-file refusal, audit-error refusal, unmanaged-file refusal.
- [ ] 18.2 Create expected output trees under `scripts/__fixtures__/expected/` for each fixture that results in a write, generated by running the merge script once against a temp copy (`--root`) and hand-reviewing the diff before committing it as the expectation.
- [ ] 18.3 Write `scripts/shapes-merge.test.mjs` (if not already scaffolded in Group 15/17) exercising every fixture, plus: `--dry-run` writes nothing, `--check` no-op detection, idempotence (run twice → zero diff), `--update-counts` touching only annotated lines, and printer parity between `scripts/lib/render-shape.mjs`'s output and `shape-catalog`'s `renderShapeTs` re-export (this last assertion can be a placeholder that's completed once Group 22 exists — track it, don't skip it silently).
- [ ] 18.4 All tests run against a temp copy of the repo tree via `--root`, never touching real `src/data` (verify via a test that asserts the real `src/data/caged-chords.ts` mtime is unchanged after the full fixture suite runs).

**Acceptance Criteria:**

- `npm test -- scripts/shapes-merge.test.mjs` passes all fixture scenarios.
- Real `src/data/*` is provably untouched by the test run (mtime/hash check).
- Fixture changesets and expected trees are committed (not gitignored — they live outside `.workbench/`).

**Files to Create:** `scripts/__fixtures__/changesets/*.json`, `scripts/__fixtures__/expected/**`, `scripts/shapes-merge.test.mjs`

---

#### Group 19: CAGED Data Changeset — Minor Triads + Major Metadata Backfill (closes #57)

**Dependencies:** Group 15, Group 17, Group 18, Group 26, Group 27 — the changeset MUST be authored in the running workbench (spec §4.3's dogfooding acceptance criterion), so the Editor and Export screens must exist first.

- [ ] 19.1 **Test-first**: rewrite `src/audit.test.ts:714-773`'s `checkChordMetadataCompleteness` docstring/assertions to expect **zero** metadata-completeness warnings for the 5 CAGED majors post-backfill (spec §4.4, edge case 4) — this test should go red before the changeset is merged.
- [ ] 19.2 Author the changeset by driving the running workbench (`npm run workbench`, Groups 26/27) and writing `.workbench/changeset.json` from the Export screen — spec §4.3 requires this data be **authored in the workbench, not hand-written**. The resulting changeset (the input to 19.3) must contain: 5 `add` ops for `"C Shape Minor"`/`"A Shape Minor"`/`"G Shape Minor"`/`"E Shape Minor"`/`"D Shape Minor"` targeting `file: "caged-chords-minor"`, each carrying `system: "caged"`, `cagedPosition`, `chordType: "m"`, `voicingFamily: "caged"`, `inversion: 0`, `stringSet`, `rootString`, `fingers`, `barres` (offset convention from Group 13), `parentShape: "<X> Shape Major"`, `tags: ["caged","triad","core"]`; plus 5 `update` ops against `src/data/caged-chords.ts`'s owned markers backfilling `chordType: "M"`, `voicingFamily: "caged"`, `cagedPosition: "E"|"A"|"D"|"C"|"G"` per the canvas's worked `"A Shape Major"` example (spec §4.4).
- [ ] 19.3 Run `npm run shapes:merge -- <changeset> --dry-run` to review the diff, then run it for real: generates `src/data/caged-chords-minor.ts` (GENERATED FILE header) and rewrites the 5 marked constants in `src/data/caged-chords.ts` in place.
- [ ] 19.4 Confirm `src/index.ts`'s `data-imports` owned block gets `import "./data/caged-chords-minor";` inserted immediately after `import "./data/caged-chords";` (the `parentShape` anchor, per spec §4.3).
- [ ] 19.5 Update `src/data/data.test.ts` / `src/index.test.ts` count assertions deliberately for the 5 new chord shapes (total chord-shape count increases by 5 from wherever Group 14 left it).
- [ ] 19.6 Verify `barre-fret-origin` (Group 9) and `checkFingerZeroOnMovable`/`checkRepeatedFingerNoBarre` report zero issues for the 5 new minor-triad shapes, and that `checkChordMetadataCompleteness` reports zero warnings for the 5 backfilled majors (closing the loop with 19.1).
- [ ] 19.7 Cross-reference: `cagedPosition` backfill on `src/data/caged-chords-7th.ts` (11 shapes) is in scope for the same changeset **only if** the merge script's owned-block coverage already includes that file; since Group 17's write allow-list is `caged-chords.ts` only, this is **out of scope here** — leave it deferred and note it as a tracked follow-up, per spec §4.4's explicit fallback.

**Acceptance Criteria:**

- `npm run shapes:merge -- <changeset> --check` exits 0 (working tree matches the changeset) after the merge.
- `npm test` passes with the rewritten `audit.test.ts` metadata-completeness assertions and updated counts.
- Issue #57 is closeable: CAGED now has 10/10 shapes (5 major + 5 minor).
- `src/data/caged-chords-minor.ts` carries the `// GENERATED FILE` header and was produced exclusively by `shapes:merge`, not hand-written.
- The changeset itself was produced by the workbench UI (written via the Export screen to `.workbench/changeset.json`), not hand-authored — spec §4.3's dogfooding criterion. Commit a copy of it as the record (e.g. under `scripts/__fixtures__/` or the feature directory).

**Files to Create:** `src/data/caged-chords-minor.ts` (generated), the changeset fixture used to produce it
**Files to Modify:** `src/data/caged-chords.ts` (owned-block content only), `src/index.ts` (data-imports block), `src/audit.test.ts`, `src/data/data.test.ts`, `src/index.test.ts`

---

### Packages

#### Group 20: `packages/fretboard-ui` — Editing Extensions

**Dependencies:** None (independent — additive-only extension of an existing, already-shipped package)

- [ ] 20.1 **Test-first**: if `packages/fretboard-ui` has existing tests, add cases for `cellsToChordShape` (one interval per string, returns `null` when no root marked) and confirm `EditorCell`'s new optional fields don't break `cellsToScaleShapeStrings`/`frettedNotesToCells` (`packages/fretboard-ui/src/FretboardEditor.tsx:14-33,217-251`). If no test file exists yet for this package, create `packages/fretboard-ui/src/FretboardEditor.test.tsx`.
- [ ] 20.2 Add `finger?: number | null` and `muted?: boolean` to `EditorCell` (`packages/fretboard-ui/src/FretboardEditor.tsx:14-18`).
- [ ] 20.3 Add `tool?: "select"|"note"|"root"|"finger"|"barre"|"mute"`, `activeFinger?: 1|2|3|4`, `barres?: { fret: number; fromString: number; toString: number; finger: number }[]`, `onBarresChange?`, `ghostMarkers?: FretMarker[]` to `FretboardEditorProps`.
- [ ] 20.4 Implement `cellsToChordShape(cells, tuning, rootPitchClass): { strings: (string|null)[]; fingers: (number|null)[]; barres: Barre[]; rootString: number } | null` as a companion to `cellsToScaleShapeStrings` — one interval per string; returns `null` when no root is marked (spec §5.1).
- [ ] 20.5 Confirm `Orientation` and `FretboardLayout.orientation` (`packages/fretboard-ui/src/types.ts:8,72`) already exist and need no change — the diagram toggle (Group 23) reuses them as-is.
- [ ] 20.6 Confirm `site/app/shapes` still builds unchanged after these additions (`npm --prefix site run build` — all existing exports/behavior preserved, additive-only).

**Acceptance Criteria:**

- `packages/fretboard-ui` package tests pass.
- `npm --prefix site run build` succeeds unchanged.
- No existing `fretboard-ui` export's signature narrows or removes a field.

**Files to Modify:** `packages/fretboard-ui/src/FretboardEditor.tsx`, `packages/fretboard-ui/src/types.ts` (if `Barre`/`FretMarker` types need re-exporting), new/updated test file under `packages/fretboard-ui/src/`

---

#### Group 21: `packages/shape-catalog` — Move-Only Extraction

**Dependencies:** Group 12 (stable public library surface for the imports being moved)

- [ ] 21.1 **Test-first**: before moving, run the existing site test suite (`npm --prefix site test` if it exists, or the relevant component tests) to capture a baseline; after the move, re-run to confirm zero regression (move-only, no logic change).
- [ ] 21.2 Scaffold `packages/shape-catalog/package.json` mirroring `packages/fretboard-ui`'s exact packaging shape: `"name": "shape-catalog"`, `private: true`, `main`/`types` → `src/index.ts`, peer deps `tonal-guitar` + the Tonal peers, `devDependencies` mirroring `fretboard-ui`'s (`"tonal-guitar": "file:../.."`). Add `packages/shape-catalog/tsconfig.json` mirroring `fretboard-ui`'s.
- [ ] 21.3 Move `site/app/shapes/components/shapeLibraryUtils.ts` (1010 lines) → `packages/shape-catalog/src/catalog.ts` verbatim (zero-React already; only site coupling is `REPO_SLUG` at `shapeLibraryUtils.ts:28`, used only by `REPORT_ISSUE_BASE_URL`/`buildReportUrl`).
- [ ] 21.4 Move `site/app/shapes/components/shapeDetailUtils.ts` (350 lines) → `packages/shape-catalog/src/detail.ts` verbatim.
- [ ] 21.5 Replace the `REPO_SLUG` module-level constant with an injected `CatalogConfig` interface (`{ repoSlug: string }`) and change `buildReportUrl(entry, config: CatalogConfig): string` to take it as a parameter (spec §5.2).
- [ ] 21.6 Create `packages/shape-catalog/src/index.ts` re-exporting everything from `catalog.ts`/`detail.ts`.
- [ ] 21.7 Update `site/app/shapes/components/*` call sites to import from `"shape-catalog"` instead of the local files, passing `{ repoSlug: REPO_SLUG }` from `site/lib/repo.ts`; delete the two moved source files from `site/app/shapes/components/`. Add `"shape-catalog": "file:../packages/shape-catalog"` to `site/package.json` and `"shape-catalog"` to `site/next.config.mjs`'s `transpilePackages` (`site/next.config.mjs:13`, currently `["fretboard-ui"]`).
- [ ] 21.8 Colocate moved tests: if `shapeLibraryUtils`/`shapeDetailUtils` had existing site-side tests, move them to `packages/shape-catalog/src/*.test.ts` alongside the moved source.

**Acceptance Criteria:**

- `npm --prefix site run build` and `npm --prefix site test` (if applicable) pass unchanged after the move.
- `npm test -- packages/shape-catalog` passes the moved tests with zero logic changes (diff should show only import-path and `REPO_SLUG`→`config.repoSlug` changes, no behavioral edits).
- No `next/*`, Tailwind, or DOM import exists anywhere in `packages/shape-catalog/src/`.

**Files to Create:** `packages/shape-catalog/package.json`, `packages/shape-catalog/tsconfig.json`, `packages/shape-catalog/src/index.ts`, `packages/shape-catalog/src/catalog.ts`, `packages/shape-catalog/src/detail.ts`
**Files to Modify:** `site/package.json`, `site/next.config.mjs`, every `site/app/shapes/components/*.tsx` that imported the moved utils
**Files to Delete:** `site/app/shapes/components/shapeLibraryUtils.ts`, `site/app/shapes/components/shapeDetailUtils.ts`

---

#### Group 22: `packages/shape-catalog` — New Pure Models

**Dependencies:** Group 21, Group 16 (printer), Group 7 (changeset types), Group 4 (`ArpeggioSlot`)

- [ ] 22.1 **Test-first** (`packages/shape-catalog/src/*.test.ts`): `boardModel` gap/count/column/row correctness against a small synthetic catalog fixture (not the full live registry, to keep the test isolated); `buildChangeset` construction correctness including `exportIdentifierFor`/collision detection; `diffShape` field-level diffing including `geometryChanged` detection; `renderShapeTs`/merge-script printer parity (completes the placeholder from Group 18.3).
- [ ] 22.2 Implement `boardModel(catalog, options)` in a new `packages/shape-catalog/src/board.ts`: `options = { kind, axis, rowGrouping, typeFilter?, search?, drafts? }` → `{ columns, rows, cells: Map<string, BoardCell>, counts: { shown, total, gaps } }`, with `BoardCell = { key, rowKey, columnKey, state: "filled"|"gap"|"draft", entry?, slot: ArpeggioSlot | ChordSlot }` (spec §5.2, exact shape).
- [ ] 22.3 Implement `renderShapeTs(kind, shape, options?)` in `packages/shape-catalog/src/render.ts` as a re-export of `scripts/lib/render-shape.mjs` (Group 16) — a relative import with a hand-written `.d.ts` shim if Node ESM interop requires it — so the workbench's "Copy TS" and the merge script's output are byte-identical (write the parity test here, resolving Group 18.3's placeholder).
- [ ] 22.4 Implement `draftToChange(draft)` / `buildChangeset(state)` in `packages/shape-catalog/src/changeset.ts`: pure construction of a `Changeset` (Group 7) from workbench draft state, including `exportIdentifierFor` and collision checks (reusing `checkNameUnique` from Group 9 where applicable). `DraftShape` must track whether the draft originated from a gap (new shape) or from an existing registered shape, so `draftToChange` emits `AddChange` vs `UpdateChange` correctly — the update path is what the §4.4 metadata backfill (Group 19) rides on.
- [ ] 22.5 Implement `diffShape(before, after) → { added: string[]; removed: string[]; changed: {field,before,after}[]; geometryChanged: boolean }` in `packages/shape-catalog/src/diff.ts` for the Export screen's per-change diff.
- [ ] 22.6 Re-export all of the above from `packages/shape-catalog/src/index.ts`.

**Acceptance Criteria:**

- `npm test -- packages/shape-catalog` passes, including the printer-parity assertion (matches `scripts/shapes-merge.test.mjs`'s printer output byte-for-byte).
- `boardModel`'s gap/count math matches a hand-computed expectation for the fixture catalog.
- Zero React/DOM imports anywhere in `packages/shape-catalog/src/`.

**Files to Create:** `packages/shape-catalog/src/board.ts`, `packages/shape-catalog/src/render.ts`, `packages/shape-catalog/src/changeset.ts`, `packages/shape-catalog/src/diff.ts`, corresponding `*.test.ts` files
**Files to Modify:** `packages/shape-catalog/src/index.ts`

---

#### Group 23: `packages/shape-library-ui` — Components & Capability Contract

**Dependencies:** Group 20 (fretboard-ui extensions), Group 22 (catalog models)

- [ ] 23.1 **Test-first** (`packages/shape-library-ui/src/*.test.tsx`): the capability invariant — rendering any component without a `ShapeLibraryProvider` (or with `capabilities.edit === undefined`) produces markup containing **zero** elements with `data-tg-edit`; gap cells render as inert `<div data-tg-gap>` instead of `<button>Create …</button>` (spec §5.3, the testable invariant, verbatim). SSR-safety — every component renders under `renderToString` with no `window` access (assert via a `window`-throwing test shim or `jsdom`-absent environment).
- [ ] 23.2 Scaffold `packages/shape-library-ui/package.json`: `"name": "shape-library-ui"`, `private: true`, `main`/`types` → `src/index.ts`; peer deps `react`, `react-dom`, `tonal-guitar`; `file:` deps `fretboard-ui`, `shape-catalog`. Add `tsconfig.json` mirroring the sibling packages.
- [ ] 23.3 Implement `EditCapabilities`, `LibraryCapabilities`, `ShapeLibraryProvider`, `useLibraryCapabilities()` (defaults to `{}`) in `packages/shape-library-ui/src/capabilities.ts` exactly per spec §5.3's interfaces.
- [ ] 23.4 Implement the read-only-capable components: `ShapeBoard`, `BoardCellCard`, `ShapeCard`, `ShapeCardDiagram`, `ShapeCardChordTable`, `IssueBadges`, `FilterBar`, `ShapeDetailPanel`, `ChordDetailView`, `ScaleDetailView`, `ShapeDiagram` (orientation-aware wrapper over `fretboard-ui`'s `Fretboard`), `DiagramOrientationToggle`, `ColumnsToggle` — porting logic from the existing `site/app/shapes/components/*` presentational components (`ShapeCard.tsx`, `ShapeCardDiagram.tsx`, `ShapeCardChordTable.tsx`, `IssueBadges.tsx`, `FilterBar.tsx`, `CompactFretboard.tsx`, `LazyShapeCard.tsx`, `ShapeDetailPanel.tsx`, `ChordDetailView.tsx`, `ScaleDetailView.tsx`), which already delegate all fretboard drawing to `fretboard-ui` — this is porting/generalizing, not move-only, since capability props must be threaded through.
- [ ] 23.5 Ship `packages/shape-library-ui/src/styles.css`: plain stylesheet with `tg-`-prefixed class names driven by CSS custom properties (`--tg-surface`, `--tg-border`, `--tg-fg`, `--tg-muted`, `--tg-accent`, `--tg-warn`, `--tg-error`, `--tg-gap`). No Tailwind dependency inside the package.
- [ ] 23.6 Enforce the hard constraints as lint/test guards: no `next/*` imports, no Tailwind/Fumadocs class names, no `window` access during render, no top-level import of any editor-only module (grep-based test acceptable, mirroring Group 10.1's import-graph pattern).
- [ ] 23.7 Port the responsive behavior (board grid collapses to single column below 768px, detail panel switches sidebar↔bottom-sheet) behind a prop, with no `window` access during render — preserving `ShapeLibrary.tsx:52`'s existing breakpoint value.

**Acceptance Criteria:**

- `npm test -- packages/shape-library-ui` passes both the capability invariant and SSR-safety tests for every exported component.
- `renderToString(<ShapeBoard .../>)` (no provider) never throws and never emits `data-tg-edit`.
- Zero `next/*` imports anywhere in `packages/shape-library-ui/src/` (grep-verified).

**Files to Create:** `packages/shape-library-ui/package.json`, `packages/shape-library-ui/tsconfig.json`, `packages/shape-library-ui/src/index.ts`, `packages/shape-library-ui/src/capabilities.ts`, `packages/shape-library-ui/src/styles.css`, one `.tsx` per component listed in 23.4, corresponding `*.test.tsx` files

---

#### Group 24: `packages/shape-workbench` — App Skeleton, Store & Dev-Server Plugin

**Dependencies:** Group 23

- [ ] 24.1 **Test-first**: unit tests for the hash router (unknown hash → `#/board`), the `WorkbenchStore` reducer (drafts keyed by slotKey/name, `changes` accumulation, `localStorage` persistence on every change), and the dev-server plugin's path-containment logic (every write target resolved and asserted under `<repoRoot>/.workbench/`; anything else is a 400) — the plugin logic is unit-testable independent of a running Vite server.
- [ ] 24.2 Scaffold `packages/shape-workbench` as a Vite 5 + React 18 + TypeScript app: `package.json` with `file:` deps `tonal-guitar` (`file:../..`), `fretboard-ui`, `shape-catalog`, `shape-library-ui`; devDeps `vite`, `@vitejs/plugin-react`, `typescript`; `vite.config.ts`; `index.html`; `src/main.tsx`.
- [ ] 24.3 Implement hash-based routing with no router dependency: `#/board` (default), `#/editor/<slotKey|shapeName>`, `#/export`; unknown hash → `#/board` (spec §5.4).
- [ ] 24.4 Implement `WorkbenchState`/`WorkbenchStore` (React context + `useReducer`) exactly per spec §5.4's shape: `tuning` (locked to `STANDARD` in MVP), `authorRoot` (default `"A"`), `orientation`, `columnAxis`, `drafts: Record<string, DraftShape>`, `changes: ChangesetChange[]`, `lastWrittenAt?`. Persist to `localStorage` on every state change; persist to `.workbench/changeset.json` only on explicit "Write changeset.json" (wired to the dev-server plugin in 24.5).
- [ ] 24.5 Implement `src/plugins/workbench-io.ts`, a Vite dev-server-only plugin (`apply: "serve"` — **never** in `build`) exposing: `GET /__workbench/status` → `{ writable: true, repoRoot, libraryVersion }`; `GET /__workbench/changeset` → current `.workbench/changeset.json` or `404`; `POST /__workbench/changeset` → validates the payload against the `Changeset` schema (Group 7), writes `<repoRoot>/.workbench/changeset.json` (creating the dir), returns `{ path, bytes, changeCount }`. Enforce path containment: every write target resolved and asserted to live under `<repoRoot>/.workbench/`; anything else → 400.
- [ ] 24.6 Wire `packages/shape-workbench` into `ShapeLibraryProvider` (Group 23) with `capabilities.edit` always populated (never runtime dev-server sniffing, no separate entry points, per D-002/spec §5.3). Populate **all six** `EditCapabilities` handlers from spec §5.3 — `onCreateShape`, `onEditShape`, `onDuplicateToPosition`, `onAddTag`, `draftFor`, `exportState` — backed by `WorkbenchStore` actions; the screens consume them in Groups 25–27 (which implement the behavior behind each handler).
- [ ] 24.7 Fix the root `"workbench"` script (stubbed in Group 1.4) to actually run `npm --prefix packages/shape-workbench run dev` against a working Vite dev server.

**Acceptance Criteria:**

- `npm run workbench` starts a Vite dev server that resolves `#/board`, `#/editor/anything`, `#/export`, and falls back to `#/board` for unknown hashes.
- `npm --prefix packages/shape-workbench run build` (typecheck + bundle) succeeds and the built output contains **no** `apply: "serve"` plugin code (verify the plugin is excluded from the production bundle).
- A `POST /__workbench/changeset` request targeting a path outside `.workbench/` returns 400 in a plugin unit test.
- `npm test -- packages/shape-workbench` passes the reducer/router/plugin unit tests.

**Files to Create:** `packages/shape-workbench/package.json`, `packages/shape-workbench/vite.config.ts`, `packages/shape-workbench/index.html`, `packages/shape-workbench/src/main.tsx`, `packages/shape-workbench/src/router.ts` (+ test), `packages/shape-workbench/src/store.ts` (+ test), `packages/shape-workbench/src/plugins/workbench-io.ts` (+ test)
**Files to Modify:** root `package.json` (`workbench` script, already stubbed)

---

#### Group 25: `packages/shape-workbench` — Board Screen

**Dependencies:** Group 24, Group 22 (`boardModel`)

- [ ] 25.1 **Test-first**: Board screen renders the expected column/row grid from a fixture `boardModel` result, header summary text matches `Showing N of M · K gaps` format, and "Create <X> Shape <type>" buttons appear on gap cells only when `capabilities.edit` is present (reusing Group 23's capability invariant test pattern).
- [ ] 25.2 Implement the CAGED grid (chord type rows × C·A·G·E·D columns) sourced from `boardModel` (Group 22); wire family/type filters and search from `shape-catalog`.
- [ ] 25.3 Implement per-cell state rendering: filled / gap / draft, with "Create <X> Shape <type>" on gaps when `capabilities.edit` is injected.
- [ ] 25.4 Implement the header: `Showing N of M · K gaps` and the pending-changes count from `WorkbenchStore.changes.length`.
- [ ] 25.5 Wire the Columns control (CAGED position · String set · Inversion) and Diagrams control (Vertical · Horizontal) using `boardModel`'s `axis` option and `fretboard-ui`'s existing `Orientation`.

**Acceptance Criteria:**

- `npm test -- packages/shape-workbench` covers the Board screen's gap/filled/draft rendering and header text.
- Clicking "Create <X> Shape <type>" on a gap navigates to `#/editor/<slotKey>`.

**Files to Create:** `packages/shape-workbench/src/screens/Board.tsx` (+ test)

---

#### Group 26: `packages/shape-workbench` — Editor Screen (closes #66)

**Dependencies:** Group 25, Group 8 (`autoFingering`), Group 9 (`auditChordShape`), Group 10 (`auditChordShapeIntegration`), Group 22 (`renderShapeTs`)

- [ ] 26.1 **Test-first**: the editor refuses to save a shape without a marked `1P` root (spec §9, edge case 9); the tools (Select/Note/Root/Finger 1–4/Barre/Mute) update `EditorCell` state correctly via `cellsToChordShape` (Group 20); the Live Checks card renders one row per `auditChordShape` + `auditChordShapeIntegration` check id, updated on every edit; Output preview TS is byte-identical to `renderShapeTs`'s output for the same shape.
- [ ] 26.2 Implement the tool palette (Select · Note · Root · Finger 1-4 · Barre · Mute), Author-at-root selector, Labels toggle (intervals/notes/fingers), fret window (0–12), Open-strings toggle (present but **disabled** in MVP), diagram orientation toggle, legend, and the editing fretboard via `fretboard-ui`'s `FretboardEditor` (Group 20's extended props).
- [ ] 26.3 Wire "stored as intervals, never frets" persistence: on save, convert the editor's cell state via `cellsToChordShape`; the lowest string carrying `1P` becomes `rootString`; **refuse to save without a `1P`** with a clear message ("marking a root is what makes the shape movable").
- [ ] 26.4 Render the interval/finger/fret/note table plus the barre summary line: `barre · finger 1: strings 0–5 @ offset 0 (fret 5 at A)`, using `absoluteBarreFret`/`gripBaseFret` (Group 5).
- [ ] 26.5 Implement the right-hand panel: Identify row (Tonal `detect` of the built grip vs. declared `chordType`), "At other roots" strip (`applyChordShape` at C/D/E/G/A with open strings disabled), Output preview (TS via `renderShapeTs`, JSON via the `changeset@1` change object) with Copy buttons and the target file line, Properties form exposing every field from spec §1.2 plus `featured` and the derived `movable` reason string, and the Checks card composing `auditChordShape` + `auditChordShapeIntegration` (rule from spec §3.3: every check-id in the UI maps 1:1 to an exported check function — no reimplementation).
- [ ] 26.6 Seed new-shape drafts from `autoFingering` (Group 8) as the starting fingers/barres; the author may override; the Checks card runs the same audit either way.
- [ ] 26.7 Wire Discard / Run checks / Save to changeset actions against `WorkbenchStore` (Group 24), and the breadcrumb + draft status (`draft · not in changeset`).
- [ ] 26.8 Wire the remaining `EditCapabilities` behaviors (spec §5.3): `onEditShape` — open an existing/filled registered shape into the editor (`draftFor` seeds the draft from the registered shape) so saving emits an `UpdateChange` (the §4.4 metadata-backfill path Group 19 depends on); `onDuplicateToPosition` — seed a new draft at another CAGED position from an existing shape (emits `AddChange`); `onAddTag` — inline tag add producing a metadata-only `UpdateChange`. Test: editing an existing shape emits `UpdateChange`, authoring from a gap emits `AddChange` (via Group 22.4's origin tracking).

**Acceptance Criteria:**

- `npm test -- packages/shape-workbench` covers the no-`1P`-no-save refusal, the Checks card's 1:1 mapping to exported check ids, and TS/printer parity.
- Editing an existing registered shape emits `UpdateChange`; authoring from a gap emits `AddChange` (26.8's test).
- Manually authoring one chord end-to-end in the running dev server (`npm run workbench`) produces a valid `ChangesetChange` with `fingers`/`barres` populated — this is the #66 closure proof, exercised again formally in Group 30.

**Files to Create:** `packages/shape-workbench/src/screens/Editor.tsx` (+ test), supporting editor sub-components as needed

---

#### Group 27: `packages/shape-workbench` — Export Screen

**Dependencies:** Group 26, Group 17 (merge script/CLI), Group 22 (`buildChangeset`/`diffShape`)

- [ ] 27.1 **Test-first**: Export screen lists pending changes with the correct op glyph (`+`/`~`/`−`) per change type, target file, and check status; per-change diff view renders TS-diff/JSON/before-after tabs with a "geometry unchanged" badge for metadata-only edits (via `diffShape`'s `geometryChanged` flag); "Write changeset.json" POSTs to the dev-server plugin (Group 24.5) and updates `lastWrittenAt`.
- [ ] 27.2 Implement the change list (op glyph, shape name, target file, check status) built from `WorkbenchStore.changes` via `buildChangeset`/`diffShape` (Group 22).
- [ ] 27.3 Implement the written-file path display, "Test counts touched" summary, and a conflicts row (name/identifier collisions detected client-side using the same logic the merge script uses server-side, for early feedback).
- [ ] 27.4 Implement Copy-TS / Write-changeset.json buttons and the exact `npm run shapes:merge -- .workbench/changeset.json` command display with a sample transcript, plus `Dry run: --check` and `Undo: git checkout -- src/data` hints (spec's Export screen requirements, verbatim).
- [ ] 27.5 Implement the per-change diff view (TS-diff/JSON/before-after tabs) using `diffShape` and `renderShapeTs`.
- [ ] 27.6 Wire `exportState` from spec §5.3 (`pendingCount`, `onExport()`) so the Board header's pending-changes affordance (Group 25.4) opens the Export screen, keeping the capability contract fully exercised end-to-end.

**Acceptance Criteria:**

- `npm test -- packages/shape-workbench` covers the Export screen's change list, diff view, and "Write changeset.json" round-trip against a mocked dev-server plugin endpoint.
- The displayed merge command is copy-pasteable and matches the real `shapes:merge` CLI signature exactly.

**Files to Create:** `packages/shape-workbench/src/screens/Export.tsx` (+ test)

---

### Site

#### Group 28: Site — Vertical Slice Integration (D-003 gate)

**Dependencies:** Group 23 (`shape-library-ui`), Group 26 (Editor), Group 27 (Export), Group 17/18 (merge script)

- [ ] 28.1 **Test-first**: a smoke test (can be a manual/scripted integration test, e.g. `npm --prefix site run build` after wiring) proving `site/app/shapes` renders the same `ShapeCard`/`ShapeBoard` components from `shape-library-ui` that the workbench renders, with `capabilities.edit` never set.
- [ ] 28.2 Add `"shape-library-ui": "file:../packages/shape-library-ui"` to `site/package.json` (alongside `shape-catalog` from Group 21); add `"shape-library-ui"` to `site/next.config.mjs`'s `transpilePackages` (now `["fretboard-ui", "shape-catalog", "shape-library-ui"]`).
- [ ] 28.3 Swap `site/app/shapes/components/ShapeCard.tsx` (and its direct dependents in the render path used by the default `/shapes` view) to import `ShapeCard`/`ShapeBoard` from `shape-library-ui` instead of the local implementation, wrapped in `ShapeLibraryProvider` with `capabilities` omitted (read-only).
- [ ] 28.4 Execute the full D-003 vertical-slice proof once, by hand or scripted: author one chord in the running workbench (`npm run workbench`) → `.workbench/changeset.json` written → `npm run shapes:merge -- .workbench/changeset.json --dry-run` clean → merge for real → `npm test` passes → `npm --prefix site run dev` (or build) renders the merged shape read-only via the shared `ShapeCard`. Document the exact commands run as a reproducible check (this becomes the basis of Group 30's automated version).
- [ ] 28.5 Confirm the static-export build (`DEPLOY=true npm --prefix site run build`, per `site/package.json:10`) still succeeds with the shared components and stays fully read-only (no `data-tg-edit` in the generated `out/` HTML — grep-verifiable).

**Acceptance Criteria:**

- `npm --prefix site run build` succeeds with `ShapeCard`/`ShapeBoard` sourced from `shape-library-ui`.
- The D-003 vertical-slice sequence (28.4) completes without manual workarounds and is documented step-by-step.
- Zero `data-tg-edit` markup in the static-export output.

**Files to Modify:** `site/package.json`, `site/next.config.mjs`, `site/app/shapes/components/ShapeCard.tsx` (and minimal call sites needed to route through the shared component for this slice)

---

#### Group 29: Site — Incremental Migration & `/admin` Retirement

**Dependencies:** Group 28

- [ ] 29.1 **Test-first**: for each component swap below, capture the existing site test/behavior baseline first, then confirm parity after the swap (move-then-verify pattern, mirroring Group 21).
- [ ] 29.2 Replace `ShapeCardDiagram`, `ShapeCardChordTable`, `IssueBadges`, `CompactFretboard` with their `shape-library-ui` equivalents (spec §7, migration step 2).
- [ ] 29.3 Replace `FilterBar` with its `shape-library-ui` equivalent (migration step 3).
- [ ] 29.4 Replace `ShapeDetailPanel`/`ChordDetailView`/`ScaleDetailView` with their `shape-library-ui` equivalents, preserving the site's `next/dynamic({ ssr: false })` code-split (`ShapeLibrary.tsx:34-37`) by dynamically importing the shared component instead of the local one (migration step 4).
- [ ] 29.5 Reduce `ShapeLibrary.tsx` to a thin Next adapter owning **only** URL state (`parseShapesUrlState`/`serializeShapesUrlState`), the mobile-breakpoint media query, and the dynamic import; move `LazyShapeCard`'s IntersectionObserver behavior into `shape-library-ui` behind a prop, staying SSR-safe (migration step 5).
- [ ] 29.6 Add the read-only Board view (columns toggle + diagram orientation toggle) to `/shapes`; gap cells render inert, never "Create" buttons (confirmed by the capability invariant test from Group 23 running against the site's actual provider usage).
- [ ] 29.7 Retire `/admin`: delete `site/app/admin/page.tsx`, `site/app/admin/layout.tsx`, `site/app/admin/components/ShapeEditor.tsx` (the ScaleShape-only editor this feature's workbench supersedes — `ShapeEditor.tsx:409-414`, exactly #66's gap); document `npm run workbench` as its replacement in the README/CONTRIBUTING doc that referenced `/admin`.
- [ ] 29.8 Add the CI steps from spec §8 to `.github/workflows/ci.yml`, after the existing lint/test/build steps: `npm --prefix packages/shape-workbench run build` (typecheck + bundle) and `npm --prefix site run build` (static-export smoke, now consuming the shared packages).

**Acceptance Criteria:**

- `npm --prefix site run build` and (if present) `npm --prefix site test` pass after every swap.
- `site/app/admin` no longer exists; nothing in `site/` references it.
- `.github/workflows/ci.yml` runs the workbench build and site build after the existing steps.
- `/shapes` shows the read-only Board view with inert gap cells.

**Files to Modify:** `site/app/shapes/components/ShapeLibrary.tsx` and its remaining component files, `.github/workflows/ci.yml`
**Files to Delete:** `site/app/admin/page.tsx`, `site/app/admin/layout.tsx`, `site/app/admin/components/ShapeEditor.tsx`, any now-orphaned `site/app/shapes/components/*` file fully superseded by `shape-library-ui`

---

### Testing

#### Group 30: Full Regression, CI Pipeline & Gap Analysis

**Dependencies:** All preceding groups

- [ ] 30.1 Run `npm test` at the repo root and confirm every new/updated test file from Groups 1–29 passes together (not just in isolation) — catches cross-group interaction regressions (e.g. Group 13's barre migration + Group 19's new minor-triad barres both touching `checkBarreFretOrigin`'s registry-wide sweep).
- [ ] 30.2 Run `npm run lint` across `src/**/*.ts`, `packages/*/src/**/*.{ts,tsx}`, `scripts/**/*.mjs` (Group 1's expanded globs) and fix any stragglers.
- [ ] 30.3 Run `npm run build` (library), `npm --prefix packages/fretboard-ui run build` (if it has one), `npm --prefix packages/shape-catalog` typecheck, `npm --prefix packages/shape-library-ui` typecheck, `npm --prefix packages/shape-workbench run build`, and `npm --prefix site run build` — the full multi-package build matrix.
- [ ] 30.4 Re-verify every edge case in spec §9 has an explicit test: (1) registry override resolution via resolver, not replace-on-add alone; (2) the three barre-fret migration fixture classes; (3) every `data.test.ts`/`index.test.ts` hard-coded count invalidated by this feature is updated in the same commit it's invalidated in (audit the final diff for any count left stale); (4) `checkChordMetadataCompleteness` docstring + tests rewritten together with the backfill; (5) static-export renders with zero `window` access and zero `data-tg-edit`; (6) dependency-tier boundaries (`src/shape.ts`/`src/chord-scale.ts` zero-Tonal, `src/build.ts`/`src/audit.ts` required-peer, `src/audit-integration.ts`/`arpeggioFor`/`parentBoxForChordShape` optional-tier) hold via import-graph tests; (7) `SHELL_DICTIONARY`'s public shape/values are unchanged; (8) the merge script's computed-file deny list refuses `caged-scales-minor`/`pentatonic-minor` even with `--force`; (9) the editor refuses to save without `1P`; (10) `parentBoxForChordShape` returns `undefined` rather than guessing for unregistered mode boxes.
- [ ] 30.5 Verify `src/version.ts`'s `VERSION` (`0.2.0`) and `package.json`'s `"version"` are bumped together per CLAUDE.md if this feature ships as a release-worthy change (coordinate with the release process — do not bump speculatively if the feature lands as a pre-release/unpublished increment).
- [ ] 30.6 Confirm issue closure criteria are met end-to-end: **#66** — a chord authored in the workbench round-trips `fingers`/`barres` through `Fingering`, the merge script, and back into the shared read-only `ShapeCard` on `/shapes`; **#57** — CAGED has 10/10 shapes registered (5 major + 5 minor) via `chordShapes.query({ system: "caged" })`.
- [ ] 30.7 Confirm out-of-scope boundaries were respected (no accidental scope creep): no arpeggio seed data registered in `arpeggioShapes`, no Graph/standalone Chords screens built, no auth code, no alternate-tuning/open-string authoring enabled, no `"triad"` closed-triad core data set, no silent auto-fix of pre-existing data debt beyond the shells fix and barre migration.
- [ ] 30.8 Final review pass on generated artifacts: `src/data/caged-chords-minor.ts` carries its `GENERATED FILE` header and was never hand-edited; `.workbench/` is absent from `git status` (gitignored, per Group 1.3); the committed fixture changesets under `scripts/__fixtures__/` are the only committed changeset-shaped JSON in the repo.

**Acceptance Criteria:**

- `npm test`, `npm run lint`, `npm run build` all green at the repo root; `npm --prefix packages/shape-workbench run build` and `npm --prefix site run build` both green.
- Every spec §9 edge case has a named, passing test traceable in the final diff.
- #66 and #57 are demonstrably closed by the criteria in 30.6.
- No out-of-scope surface area was built (30.7 checklist clean).

**Files to Modify:** none new — this group is verification-only, with fixes applied back into the owning group's files if gaps are found.

---

## Execution Order

**Sequential spine (must run in this order):**

1. Group 1 (tooling config) — first, unblocks all test-file additions.
2. Groups 2 → 3 → 4 (shape data model → registry mechanics → resolver layer) — strict chain within `src/shape.ts`.
3. Group 5 depends only on Group 2 — can start as soon as Group 2 lands, in parallel with Groups 3–4.
4. Groups 6 and 7 are independent of everything above and of each other — start immediately after (or even alongside) Group 1.
5. Group 8 depends on Groups 2 and 5.
6. Group 9 depends on Groups 5 and 8; Group 10 depends on Group 9.
7. Group 11 depends on Groups 4 and 6.
8. Group 12 depends on all of Groups 2–11 (the export surface).
9. Group 13 (barre migration, gated) depends on Groups 5, 9, 12.
10. Group 14 (shells fix) is independent — can run any time after Group 1, in parallel with the entire Groups 2–13 chain.
11. Group 15 depends on Group 12; Group 16 depends on Groups 2 and 7; Group 17 depends on Groups 7, 9/10, 15, 16; Group 18 depends on Group 17.
12. Group 19 depends on Groups 15, 17, 18, **26, and 27** — the changeset is authored in the running workbench per spec §4.3 (and benefits from Group 13's barre convention already landed).
13. Group 20 is independent — run any time.
14. Group 21 depends on Group 12; Group 22 depends on Groups 21, 16, 7, 4.
15. Group 23 depends on Groups 20, 22.
16. Group 24 depends on Group 23; Groups 25 → 26 → 27 chain sequentially after Group 24, with 26 also depending on Groups 8, 9, 10, 22, and 27 also depending on Group 17, 22.
17. Group 28 depends on Groups 23, 26, 27, 17/18 — the D-003 gate; do not start Group 29 before Group 28 passes.
18. Group 29 depends on Group 28.
19. Group 30 runs last, after everything.

**Parallel-dispatch opportunities** (independent Core Logic / package groups that `/implement` can run concurrently):

- **Wave A** (after Group 1): Groups 2, 6, 7, 14, 20 can all start in parallel — none depend on each other.
- **Wave B** (after Group 2): Groups 3 and 5 can run in parallel.
- **Wave C** (after Wave B): Group 4 (needs 3) and Group 8 (needs 2, 5) can run in parallel.
- **Wave D**: Group 9 (needs 5, 8) and Group 11 (needs 4, 6) can run in parallel; Group 10 follows Group 9.
- **Wave E**: Group 16 (needs 2, 7) can start as early as Wave A/B finishes 2 and 7; it does not need to wait for Groups 3–5/8–11.
- Groups 21 and 20 can run in parallel (21 needs Group 12, which is the true late-joiner; 20 is fully independent).
- Group 14 (shells) can be dispatched at any point from Wave A onward and merged whenever convenient before Group 30 — it never blocks or is blocked by the library-model chain.

---

## Files to Create

| File | Task |
| --- | --- |
| `src/chord-scale.ts` | 6 |
| `src/chord-scale.test.ts` | 6 |
| `src/changeset.ts` | 7 |
| `src/build.test.ts` | 8 |
| `src/audit-integration.ts` | 10 |
| `src/audit-integration.test.ts` | 10 |
| `scripts/lib/render-shape.mjs` | 16 |
| `scripts/lib/render-shape.d.ts` | 16 |
| `scripts/shapes-merge.mjs` | 17 |
| `scripts/__fixtures__/changesets/*.json` | 18 |
| `scripts/__fixtures__/expected/**` | 18 |
| `scripts/shapes-merge.test.mjs` | 15, 17, 18 |
| `src/data/caged-chords-minor.ts` (generated) | 19 |
| `packages/shape-catalog/package.json`, `tsconfig.json`, `src/index.ts`, `src/catalog.ts`, `src/detail.ts` | 21 |
| `packages/shape-catalog/src/board.ts`, `src/render.ts`, `src/changeset.ts`, `src/diff.ts` (+ tests) | 22 |
| `packages/shape-library-ui/package.json`, `tsconfig.json`, `src/index.ts`, `src/capabilities.ts`, `src/styles.css` | 23 |
| `packages/shape-library-ui/src/*.tsx` (components) + `*.test.tsx` | 23 |
| `packages/shape-workbench/package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/router.ts`, `src/store.ts`, `src/plugins/workbench-io.ts` (+ tests) | 24 |
| `packages/shape-workbench/src/screens/Board.tsx` (+ test) | 25 |
| `packages/shape-workbench/src/screens/Editor.tsx` (+ test) | 26 |
| `packages/shape-workbench/src/screens/Export.tsx` (+ test) | 27 |

## Files to Modify

| File | Task |
| --- | --- |
| `vitest.config.ts` | 1 |
| `package.json` | 1, 17, 24 |
| `.gitignore` | 1 |
| `src/shape.ts` | 2, 3, 4, 5 |
| `src/shape.test.ts` | 2, 3, 4, 5, 7 |
| `src/build.ts` | 8 |
| `src/audit.ts` | 9 |
| `src/audit.test.ts` | 9, 19 |
| `src/integration.ts` | 11 |
| `src/integration.test.ts` | 11 |
| `src/index.ts` | 12, 15, 19 |
| `src/index.test.ts` | 12, 14, 19 |
| `src/data/open-chords.ts` | 5 (comment), 13 |
| `site/app/shapes/components/ShapeCardChordTable.tsx` | 13, 21, 29 |
| `src/data/data.test.ts` | 13, 14, 15, 19 |
| `src/data/jazz-shells.ts` | 14 |
| `src/data/caged-chords.ts` | 15, 19 |
| `packages/fretboard-ui/src/FretboardEditor.tsx` | 20 |
| `packages/fretboard-ui/src/types.ts` | 20 |
| `site/package.json` | 21, 28 |
| `site/next.config.mjs` | 21, 28 |
| `site/app/shapes/components/*.tsx` | 21, 28, 29 |
| `packages/shape-catalog/src/index.ts` | 22 |
| `site/app/shapes/components/ShapeLibrary.tsx` | 29 |
| `.github/workflows/ci.yml` | 29 |

## Files to Delete

| File | Task |
| --- | --- |
| `site/app/shapes/components/shapeLibraryUtils.ts` | 21 |
| `site/app/shapes/components/shapeDetailUtils.ts` | 21 |
| `site/app/admin/page.tsx` | 29 |
| `site/app/admin/layout.tsx` | 29 |
| `site/app/admin/components/ShapeEditor.tsx` | 29 |

---

## Technical Notes

- **Dependency tiers (CLAUDE.md §Dependency layers).** Zero-Tonal-dep: `src/shape.ts` (Groups 2–5), `src/chord-scale.ts` (Group 6). Required-peer: `src/build.ts` (Group 8), `src/audit.ts` (Group 9) — imports must stay exactly `./build`, `./shape`, `./tuning`, `@tonaljs/note` (`src/audit.ts:4-8`). Optional-tier: `src/integration.ts` (Group 11), `src/audit-integration.ts` (Group 10, new, MUST NOT be imported by `src/audit.ts` — D-006). Every group that touches these files must re-verify its import list against this contract before merging.
- **Registries are the sanctioned mutation seam.** `src/shape.ts:141-145` (scale `add`) and `:159-202` (`chordShapes`) currently push unconditionally with no `remove` — Group 3 rewrites both to replace-on-same-name and adds `remove`. This does not violate "pure functions only, no side effects" (CLAUDE.md §Design conventions) because registries are explicitly the one documented exception (spec §1.6, JSDoc requirement in Group 2.7/3.6).
- **`Barre.fret` redefinition (D-010) is the highest-risk data change.** `src/audit.ts:147` (`checkRepeatedFingerNoBarre`) reads `finger`/`fromString`/`toString` but not `fret`, so it's unaffected — but `checkGeometryMismatch` (`src/audit.ts:416-451`) and any future consumer that assumes absolute frets must be re-audited. The three worked fixture classes in spec §4.1 (open-with-open-strings, fixed-barre, movable-barre-already-offset) are the regression gate — Group 13.1 must encode all three before touching `open-chords.ts`.
- **CR-001 hoisted-build optimization must be preserved.** `auditChordShape` (`src/audit.ts:476-492`) builds `applyChordShape` once and threads it into `checkFretSpan`/`checkChordBuildLoss` via their `prebuilt` param — Group 9's four new checks that need a build must follow the same pattern, not introduce a second rebuild.
- **`impliedStringSet` promotion.** `src/data/extended-chords.test.ts:84-89` has a local test-only implementation that Group 5 promotes to `src/shape.ts` production code — after Group 5 lands, that test file should import the production helper instead of keeping its own copy (dedupe, don't just add a parallel implementation).
- **Merge script is the analog of a "DB migration" layer in this codebase.** There is no ORM/schema-validation library here — `scripts/shapes-merge.mjs` (Group 17) is hand-rolled validation over `Changeset` (Group 7) types, deliberately avoiding new dependencies (D-005 explicitly rejected `ts-morph`/AST tooling in favor of generator-owned blocks). Treat its refusal-ordering (spec §6.2, all checks before any write) with the same rigor a migration-safety review would get.
- **`packages/fretboard-ui` is the packaging precedent.** `packages/fretboard-ui/package.json` and its `file:`-linking pattern (`site/package.json:20`, `"tonal-guitar": "file:../.."` shown in `packages/fretboard-ui`'s own devDependencies) is the exact template Groups 21/23/24 must copy for `shape-catalog`, `shape-library-ui`, `shape-workbench` — no npm workspaces anywhere in this repo (spec §5, confirmed by `research.md`'s "no workspaces" finding).
- **Capability props are the only read/write switch (D-002).** No runtime dev-server detection, no separate entry points. `useLibraryCapabilities()` defaulting to `{}` and the `data-tg-edit` invariant (Group 23.1, spec §5.3) is the mechanism every future auth'd deployment would build on — do not add any alternate gating mechanism.
- **Static-export SSR safety.** `site/next.config.mjs:7` (`output: "export"`) means every `shape-library-ui` component must render under `renderToString` with zero `window` access — Group 23.1/23.6's SSR test and import-graph guard are not optional polish, they're the mechanism that keeps editor code out of the deployed static bundle.
- **Test-count discipline (spec §6.4, edge case 3).** Hard-coded registry counts exist at `src/data/data.test.ts:683,891,897,1111,1289,1355` and `src/index.test.ts:388,393,398,402` (pre-migration line numbers — will shift as Groups 13/14/19 edit these files; locate by content). The merge script (Group 17) must never silently edit an unannotated count; only lines carrying a `// shapes-merge:count <name>` marker (added in Group 15) are eligible for `--update-counts`.
