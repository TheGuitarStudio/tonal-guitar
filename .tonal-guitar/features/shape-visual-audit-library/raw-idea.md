## Problem

Shape-data defects — misordered interval arrays, impossible fingerings, wrong `voicingFamily` tags — are invisible in TypeScript literals and only surface when a shape is rendered or built (e.g. #94's unplayable 9-fret aug shapes, the #39 metadata audit). There is no way to see all registered shapes with their properties in one place, so auditing means reading data files or writing one-off scripts, and a guitar expert can't review the catalog without a dev environment.

## Proposed Solution

A public "Shape Library" page on the deployed site that renders every registered scale and chord shape as a fretboard diagram (via `fretboard-ui`) alongside its full properties (name, system, intervals, rootString, fingers, barres, voicingFamily, canonicalRoot, quality/parentShape), with filter/search by type, system, and family. Known defect-class invariant checks (fret span, finger-0-on-movable, repeated-fingers-without-barre, voicingFamily/baseFret consistency) run client-side and badge failing shapes so triage starts with the likely-broken ones. Each shape card carries a "report problem" link opening a prefilled GitHub issue; fixes flow through the existing dev-only admin ShapeEditor and the `/fix` pipeline.

## User Stories

- As a maintainer, I want every registered shape rendered with its metadata so I can audit data quality without reading TS files.
- As a guitar-expert reviewer, I want to browse shapes in a plain browser and flag wrong ones so I can contribute without running the repo.
- As a maintainer, I want automated invariant badges so the audit starts with the shapes most likely broken.
- As a fixer, I want flagged issues prefilled with the shape's identity and properties so `/fix` agents get full context.

## Context

- **Roadmap alignment:** No formal roadmap doc; direct follow-on to the #39/#94 data-quality work and the existing site Guitar Lab.
- **Related features:** `site/app/experiments` (Guitar Lab), `site/app/admin` ShapeEditor (dev-only fix loop — the "fix" half already exists).
- **Existing infrastructure:** `fretboard-ui` `Fretboard`/`FretboardEditor`; shape registries (`names()`, `get()`, `chordShapes.query`); `buildFrettedScale`/`applyChordShape` to realize shapes (how the #94 bug was confirmed); PR #93's data-invariant tests as reference implementations for the badge checks.

## Open Questions

- Does `fretboard-ui` render chord fingering (finger numbers, barres) yet? If not, extend it, or show fingering as a property table in v1.
- What root/tuning to render movable shapes at — `canonicalRoot` when present, else a sensible default?
- Grouping/navigation: by data file, by system (CAGED / 3nps / pentatonic / open / jazz / extended), or by quality?
- Codify the badge checks as library data tests too (deferred — badges-only for now, natural follow-up).

## Rough Assessment

- **Size:** M
- **Priority:** P1
- **Depends on:** None hard; the #94 fix landing first gives the fret-span check a known-good fixture.

---

_Captured via `/idea` brainstorming session on 2026-07-14_
