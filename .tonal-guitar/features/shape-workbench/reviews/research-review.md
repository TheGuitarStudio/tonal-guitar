# Research Review — Shape Workbench

**Reviewer:** Codex CLI (external) | **Date:** 2026-08-30 | **Subject:** research.md (Phase 1)

---

**Findings**

- **High: shared-UI scope is under-specified.** The research leans toward `packages/shape-catalog` as a pure-utils extraction, but the user direction says “reuse all the UI.” Today only `packages/fretboard-ui` is truly shared React. The actual Shape Library UI lives in [site/app/shapes/components](/Users/coryleistikow/code/worktrees/tonal-guitar/feat-shape-workbench/site/app/shapes/components) and is coupled to Next, Tailwind/Fumadocs classes, `next/dynamic`, URL state, and site-only styling. If the workbench and docs are meant to share the Board, Shape cards, detail panels, filters, export-safe read-only affordances, and later editor shell, the architecture needs a shared React package, not just `shape-catalog` pure helpers. I would split this as:
  - `packages/shape-catalog`: pure catalog/detail/audit-derived model.
  - `packages/shape-library-ui`: React components, framework-neutral, no Next imports, styling strategy decided.
  - `site/app/shapes`: thin Next adapter for URL state/static export.
  - `packages/shape-workbench`: Vite adapter plus editing state/dev-server persistence.

- **High: merge-script robustness is underplayed.** `scripts/shapes-merge.mjs` is the riskiest code path, because it edits public source data and registration order. The proposal says “no new dependencies” and “applies update patches field-by-field,” but this should not be implemented with ad hoc text replacement. Use TypeScript AST tooling or a tightly constrained generator that owns whole generated blocks. It needs identifier collision checks, stable formatting, dry-run snapshots, version drift handling, schema validation, computed-file refusal, and tests with fixture changesets.

- **Medium: some research claims are wrong or too broad.**
  - `ScaleShape.parentShape` already exists in [src/shape.ts](/Users/coryleistikow/code/worktrees/tonal-guitar/feat-shape-workbench/src/shape.ts:22). The doc is correct only if it means `parentShape` is absent from `ChordShape`.
  - The product raw section says `arpeggioFromShape` / `arpeggioFromScale` are in `src/arpeggio.ts`; live code has them in [src/integration.ts](/Users/coryleistikow/code/worktrees/tonal-guitar/feat-shape-workbench/src/integration.ts:67), and `src/arpeggio.ts` explicitly does not own those wrappers.
  - The canvas says `stringset-mismatch` has a helper “already exists in `extended-chords.test.ts`.” It exists only as a local test helper, not reusable production code.
  - `open-chords.ts` has 70 chord shapes, 71 `baseFret` occurrences, and 35 barre entries, not “~50 shapes” as the research sometimes implies. The count matters for migration blast-radius estimates.

- **Medium: `Barre.fret` migration is riskier than “display label only.”** It is true that `applyChordShape` does not consume `barres`, and the obvious UI consumer is [ShapeCardChordTable.tsx](/Users/coryleistikow/code/worktrees/tonal-guitar/feat-shape-workbench/site/app/shapes/components/ShapeCardChordTable.tsx:43). But [audit.ts](/Users/coryleistikow/code/worktrees/tonal-guitar/feat-shape-workbench/src/audit.ts:147) uses barre ranges/fingers for repeated-finger validation, and tests encode current barre values. The migration should include explicit before/after fixtures for open, fixed barre, and movable barre shapes. Also clarify the convention: current movable barre forms mostly already look offset-like because `baseFret: 1`; open/fixed shapes are the inconsistent part.

- **Medium: override semantics need a clearer registry contract.** “Consumers that register an override get it back from `get()` / `query()` in place of the core, and the core stays reachable as the override’s parent” is not enough. If `add()` replaces by name, that solves duplicate names, not “override a different core name.” The proposal needs a resolver layer, e.g. `resolveArpeggioForSlot()` or `visibleAll({ includeOverridden: false })`, because raw registry `all()` cannot both hide core entries and keep them reachable without explicit policy.

**Product Review**

The boundary is mostly right: local editing, static read-only docs, changeset export, no auth, no alternate tunings/open-string authoring in MVP. Chords-first is the right MVP because it closes the concrete pain in #66 and makes CAGED minor triads tractable.

I would defer Graph and the full Chords page unless they are needed to validate the arpeggio relationship model. They are useful, but not MVP-critical. The first product milestone should prove: browse gaps, create/edit a chord, assign fingers/barres, run live checks, export changeset, merge to `src/data`, and see the same component render read-only in docs.

The two workflows cover the main users, but one workflow is missing: reviewer/maintainer. The changeset/diff path should explicitly support reviewing generated changes before they mutate source, because this is a published npm data library. Add `--check`, `--dry-run`, fixture output, and “what files will change” as first-class UX, not just implementation detail.

Risk assessment is directionally right, but it underestimates shared-React extraction and merge tooling, and overstates the safety of the barre migration. It correctly identifies the dependency-tier problem for `identify-mismatch`.

**Architecture Review**

Suggested placement is mostly sound:

- `src/shape.ts` for additive fields, `isMovable`, registry `remove`, replace-on-same-name, `VoicingFamily: "triad"`, and `arpeggioShapes`.
- `src/build.ts` for `Fingering.fingers` / `barres` pass-through.
- `src/audit.ts` for required-peer checks only.
- optional-tier identify checks should live outside `audit.ts`, probably `src/audit-integration.ts`, not behind a flag that pulls optional peers into the base audit module.
- `packages/shape-catalog` is right for pure catalog logic.
- add a separate shared React package if “reuse all UI” is literal.
- `packages/shape-workbench` as Vite is reasonable, since [site/next.config.mjs](/Users/coryleistikow/code/worktrees/tonal-guitar/feat-shape-workbench/site/next.config.mjs:6) is static export.
- `scripts/shapes-merge.mjs` is right, but needs rigorous tests and an AST/generator strategy.

Library API gaps are mostly complete, but I would add:

- `isMovable(shape)` exported and used everywhere instead of repeating `canonicalRoot === undefined`.
- `playedStringSet(shape)` / `impliedStringSet(shape)` production helper.
- `absoluteBarreFret(shape, barre)` and/or `barreFretOffset` helper during migration.
- resolver APIs for override/core/derived arpeggio slots.
- shape identity helpers: stable export identifier generation, slot key generation, and duplicate-name/export collision checks.
- a public changeset schema type, even if the merge script remains internal.

**Open Questions**

1. **How much UI ships read-only to docs?** Ship the Board/grid, filters, cards, diagrams, and detail panels as shared read-only components. Keep editor/export controls workbench-only. Use a shared React package, not utils-only sharing.

2. **Read-only/edit mode switch?** Prefer separate entry points: `shape-library-ui/read-only` and `shape-library-ui/editor`, or component props with capabilities injected. Do not rely on runtime dev-server detection for core rendering behavior.

3. **m7 alternate scale frame?** Use aeolian as v1 default, expose dorian/relative-major as later alternates. Store the rule explicitly so it can evolve without changing authored data.

4. **`identify-mismatch` tiering?** Put it in an optional-tier sibling module, e.g. `audit-integration.ts`. Keep `audit.ts` clean per [CLAUDE.md](/Users/coryleistikow/code/worktrees/tonal-guitar/feat-shape-workbench/CLAUDE.md:13).

5. **Replace `site/app/shapes` now or later?** Extract pure catalog first, then move shared React read-only components in the same phase only if there is a small vertical slice. Avoid a big-bang rewrite of every Shape Library component before the workbench proves the package boundary.

6. **Absorb #66?** Yes. Treat #66 as a Phase-2 subtask of #161 and close/link it as absorbed once chord fingering/barre export lands.

7. **Where does `.workbench/changeset.json` live?** Gitignored working file by default. Allow committed sample changesets under a fixtures/examples path, not `.workbench/`.

**Biggest Early Validation**

Build one end-to-end vertical slice before filling data: shared read-only chord card/board component rendered in both Next static export and Vite, editing one chord with fingers/barres, writing `changeset@1`, dry-running merge, and passing tests. That validates the hard parts: package boundaries, file-link ergonomics, static/Vite compatibility, and merge safety.