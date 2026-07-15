# Adversarial Review: Phase 1 Research for Shape Visual Audit Library

## Executive Take

The research is directionally right: a public, read-only shape catalog is a good v1, and the architecture should not keep the invariant logic trapped in the site. The strongest part of the document is the recommendation to promote test-only checks into a pure library audit module and have both Vitest and the site consume that same implementation.

The weak part is that it treats the proposed badges as more settled than they are. The biggest factual miss is `baseFret`: the research says it is "declared but never set", but `src/data/open-chords.ts` sets it throughout the open/barre imported data and documents the source-database semantics. The true problem is not lack of data; it is that `applyChordShape` ignores `baseFret`, while the source comments say non-1 `baseFret` changes absolute frets. That is exactly the kind of mismatch this feature must surface early.

## Factual Corrections

1. **`baseFret` is not unused as data.**

   The research states that `ChordShape.baseFret` is declared but never set. That is false. `src/data/open-chords.ts` documents `baseFret` as "lowest fretted fret in the source diagram" and sets it on many shapes, including `OPEN_C_MAJOR.baseFret = 1` and `OPEN_C_MINOR.baseFret = 3` (`src/data/open-chords.ts:14-26`, `src/data/open-chords.ts:41-74`). It is fair to say `baseFret` is not consumed by the build engine, but not that it has no data.

2. **The proposed "voicingFamily/baseFret consistency" badge is not a no-op; it is underspecified.**

   Since `baseFret` is populated for open-chords data, this badge could catch real defects. But the document does not define the rule. Possible rules differ:
   - `voicingFamily: "open"` should usually imply `canonicalRoot` and at least one open string/finger `0`.
   - `voicingFamily: "barre"` should usually imply no `canonicalRoot`.
   - `baseFret > 1` with no open strings is strong evidence the grip is not open-position.
   - `system` and `voicingFamily` should agree for open/barre families.

   The review should not accept this badge until those semantics are explicit.

3. **The "render-root default" recommendation is too hand-wavy.**

   The research suggests `canonicalRoot ?? form-letter-from-name ?? "C"`. That may work for some E/A forms, but it is not a library invariant and it is brittle for names like `C Minor Open` that are tagged `system: "barre"` with no `canonicalRoot` despite carrying an open-family name (`src/data/open-chords.ts:56-75`). The page needs an explicit `displayRootForChordShape(shape)` rule with tests or snapshots against representative open, barre, shell, caged, and extended shapes.

4. **The shape count claim is plausible but should be treated as code-derived, not manually asserted.**

   The research says 27 scale shapes and 132 chord shapes. The data-test count expects `102 + EXTENDED_CHORD_SHAPES.length`, and extended-chords tests assert 30 shapes, so 132 is consistent. But the page should compute from registries at runtime/build time rather than encode counts in UI copy.

## Product Lens

### Scope Boundaries

The v1 boundary is mostly right: public read-only catalog, filters, invariant badges, shape diagrams, metadata, and prefilled problem reports. Editing, auth, and full fingering/barre overlays are correctly deferred.

I would push back on three product choices:

1. **"All 159 cards on one page" is not automatically a usable audit workflow.**

   A maintainer audit workflow is about finding anomalies, not browsing a wall. The v1 needs at least a default "show failing/warning shapes first" view or a prominent failures filter. Without that, the page risks becoming a catalog with badges rather than an audit tool.

2. **The guitar-expert workflow is missing a low-friction visual review path.**

   "Report problem" is useful, but a non-developer expert will need to compare the rendered diagram to enough source metadata to explain what is wrong. The v1 should include the rendered frets, interval row, fingering row, barre row, root used for rendering, and failing audit details in the card and in the GitHub issue URL. Otherwise reports will be vague and hard to act on.

3. **The report-problem -> `/fix` pipeline needs a stable issue payload, not just a prefilled link.**

   The research says the link should include identity, properties, and failing badges, but does not define the schema. The issue body should be designed as an input contract: shape kind, shape name, registry metadata, render root, frets from `applyChordShape`, raw `strings`, `fingers`, `barres`, audit result IDs, and current package/site version if available.

### Missing From v1

- A dedicated failures-only or warnings-first mode.
- A deterministic display-root policy with visible "rendered as root X" text.
- Badge severity definitions: error vs warning vs info.
- A build-loss badge: `applyChordShape` can silently drop notes when the scale-window logic cannot place every interval. Extended-chord tests already check built note count against the implied string set, but the research does not include that as a library audit. For a visual audit library, "diagram does not include every played string" is a first-class failure.
- A metadata completeness badge for chord shapes: missing `chordType`, `voicingFamily`, `stringSet`, `canonicalRoot` where expected, or inconsistent `system`/`voicingFamily`.

### Should Anything Be Deferred?

The redefined voicing-family badge should be deferred unless the rule is made precise in Shape phase. It is better to ship three correct structural checks plus build-loss/fret-span than to ship a vague "consistency" badge that encodes accidental assumptions about naming.

Rendering all fingers/barres as a property table is a reasonable v1 compromise. Extending `fretboard-ui` is rightly out of scope because `FretMarker` has no `finger` field and only supports per-note marker metadata (`packages/fretboard-ui/src/types.ts:35-51`).

### Risk Assessment

Some risks are underestimated:

- **Display correctness risk is High, not Low/Medium.** The whole product depends on the diagram matching the intended grip. `applyChordShape` converts a `ChordShape` into a single-interval scale shape and ignores `fingers`, `barres`, `canonicalRoot`, and `baseFret` (`src/build.ts:283-312`). That is fine for interval placement in many movable cases, but it is not necessarily equivalent to rendering the source chord diagram.
- **Static export/basePath risk is Medium.** The config is simple (`site/next.config.mjs:6-13`), but prefilled GitHub links, internal navigation, and any client-only imports must be verified under `DEPLOY=true` because the deployed site lives under `/tonal-guitar`.
- **No site tests is a real risk.** The research says manual acceptance follows precedent. That is acceptable only if all badge logic is in `src/audit.ts` with library tests and the site layer stays thin.

Some risks are overestimated:

- **159 diagrams is probably not the primary performance risk.** SVG rendering has a cost, but 159 small diagrams is likely fine in a static Next client page if card components are reasonably memoized. The bigger risk is usability and correctness of the rendered frets.

## Architecture Lens

### Code Placement

I agree with adding a pure `src/audit.ts`, exporting it from `src/index.ts`, reusing it in `src/data/data.test.ts`, and consuming it client-side from the site.

The alternative, site-only checks, would be a mistake. The existing checks live in tests (`src/data/data.test.ts:477-505`, `src/data/data.test.ts:825-855`), and duplicating them in a Next page would create two sources of truth. The library already exports the shape registries and build engine from `src/index.ts` (`src/index.ts:22-46`) and imports built-in data for registration (`src/index.ts:122-132`), so a library audit module fits the public API.

I would make the audit API explicit and data-oriented, for example:

```ts
type AuditSeverity = "error" | "warning" | "info";

interface ShapeAuditIssue {
  id: string;
  severity: AuditSeverity;
  message: string;
  details?: Record<string, unknown>;
}

interface ChordShapeAuditInput {
  shape: ChordShape;
  root: string;
  tuning?: string[];
  maxFretSpan?: number;
}
```

The site should not infer pass/fail by parsing strings. It should render structured audit issue IDs.

### API Gaps

The research correctly identifies:

- There is no scale-shape `query()` helper; scale registry has only `get`, `all`, `names`, `add`, `removeAll` (`src/shape.ts:116-136`), while `chordShapes.query` exists for chord filters (`src/shape.ts:165-188`).
- `applyChordShape` does not surface fingers or barres; callers must pair `shape.fingers`/`shape.barres` with built frets themselves (`src/build.ts:283-312`).
- `fretboard-ui` cannot render barre paths or finger numbers natively (`packages/fretboard-ui/src/types.ts:35-51`).

Missing API gaps:

- **No source-diagram-to-absolute-frets helper.** `open-chords.ts` documents `baseFret` conversion (`src/data/open-chords.ts:25-26`), but the library exposes no helper that renders the original diagram frets from `baseFret`/finger metadata. This is the biggest gap for auditing imported chord diagrams.
- **No canonical display-root helper.** Every consumer will reinvent the same root policy unless `src/audit.ts` or a site utility owns it.
- **No "build completeness" helper.** Tests already check that built intervals/frets match played strings in extended-chords, but this is not public reusable logic.
- **No stable shape identity beyond name + kind.** Scale and chord registries are separate, but a GitHub report link should include `kind` because names alone are not a robust long-term identifier.

### Build, Deploy, and Testing

The site constraints are accurately identified: static export, deploy basePath, source-only `fretboard-ui` transpilation, no server routes (`site/next.config.mjs:6-13`). The admin page's production `notFound()` guard is a real anti-pattern to avoid for this feature (`site/app/admin/page.tsx:8-10`).

I would require these implementation checks before accepting the feature:

- `npm test` at the repo root for `src/audit.ts`.
- `npm run build` at the repo root to verify package exports and declarations.
- `npm run build` in `site/`.
- `DEPLOY=true npm run build` in `site/` to catch basePath/static-export regressions.
- Manual browser verification of `/shapes` locally and under exported output assumptions, especially prefilled GitHub links.

## Biggest Risk To Validate Early

**The single biggest risk is whether `applyChordShape` renders the same fret geometry that the curated chord source data intends, especially for open-chords entries with `baseFret > 1`.**

This must be validated before building the full UI. The research assumes the build output is the right visual truth. But `open-chords.ts` preserves source-diagram `baseFret` semantics, while `applyChordShape` rebuilds from intervals and ignores `baseFret`, `fingers`, and `barres`. If those disagree, the audit page could confidently display a mathematically transposed shape while hiding the actual source-data defect.

Early validation should be a small spike:

1. Pick representative shapes: one canonical open shape, one `baseFret > 1` barre-tagged open-chords shape, one current #96 known-bad shape, one caged barre, one shell, one extended E-form, and one extended A-form.
2. Compute frets via `applyChordShape`.
3. Compute expected source-diagram frets where `baseFret`/fingers imply them.
4. Compare built frets, span, dropped notes, and displayed root.
5. Decide whether the audit page's visual source of truth is build-engine geometry, source-diagram geometry, or both.

If this fails, `src/audit.ts` is still valuable, but the product needs to label diagrams precisely: "built from intervals" vs "source fingering", rather than pretending they are the same.

## Recommendation

Proceed to Shape phase, but tighten the spec before implementation:

- Keep `src/audit.ts` in scope and make it the single source of truth for badge checks.
- Correct the `baseFret` claim in the research/spec and define exact voicing-family/baseFret rules or defer that badge.
- Add build-completeness and metadata-consistency checks to v1.
- Add a deterministic display-root helper.
- Make "failures first" the primary maintainer workflow.
- Validate build geometry versus source-diagram geometry before investing in the full 159-card UI.
