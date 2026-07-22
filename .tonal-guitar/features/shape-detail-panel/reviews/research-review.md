**Product Lens**

The scope is mostly well drawn, but I would tighten the first slice. The panel, chord ID, alternate fingerings, inversion grouping, and page reorganization are coherent. The riskiest piece is “scales containing this chord”; it sounds simple in UI copy but has a lot of music-theory ambiguity. I would either validate it early or ship it in a narrower form with explicit language like “Common parent scales” or “Common scales matching these chord tones.”

I would defer `analyzeInKey` as the research suggests. There is no key context on `/shapes`, and adding a key picker turns this from a shape detail panel into harmonic analysis UI.

The workflow coverage is good for maintainers and learners, but a few expected interactions are underspecified:

- Deep-link behavior should be decided, not left optional. If users can open a panel, `?shape=` is worth doing because the existing page already treats filter state as shareable.
- Keyboard and focus behavior need to be first-slice requirements. `ShapeCard` is currently a static `div`; making the whole card clickable needs real button semantics or a dedicated “details” button so it does not conflict with the existing “Report a problem” link.
- Mobile behavior is a major product decision. A side panel on desktop probably becomes a full-screen sheet or bottom sheet on mobile, and that affects focus trapping, scroll locking, and discoverability.
- Alternate fingering interaction should be defined: are thumbnails passive references, or can clicking one make it the active selected shape? I would make them selectable because users will expect that once the panel shows sibling shapes.

Risk assessment is directionally accurate. I would raise the visual reorganization risk from “medium” to “medium-high” because `/shapes` is currently an audit tool with failure-first sorting as a key invariant. Grouping can easily dilute that workflow unless error/warning visibility remains obvious across groups.

**Architecture Lens**

The suggested component placement is broadly right: `ShapeDetailPanel.tsx` beside the existing shape page components, with pure derivation helpers in a sibling utility file. Passing `ShapeCatalogEntry` into the panel is the right local contract because `buildCatalog` already centralizes render root, built frets, source frets, grip root, and audit issues.

I would push back on putting the chord-scale containment algorithm only in `site/app/shapes/components/shapeDetailUtils.ts` if it becomes more than display sorting. “Given a chord, find scales whose pitch classes contain it” is library-domain math, not docs-site UI. The site can own presentation, candidate limits, and labels, but the containment helper itself belongs in `src/integration.ts` with tests if it is intended to be trusted.

The research correctly identifies the `relatedScales` gap. `relatedScales(frettedScale)` only works when `root` and `scaleType` are populated, and `buildCatalog` currently builds scale entries with `buildFrettedScale`, leaving `scaleType: ""`. So scale entries need either `buildFromScale` or a catalog change that records the intended scale name.

For chord entries, feeding chord types into `modeNames` is the wrong abstraction. The mitigation options are reasonable, but I would favor a chroma-subset sweep over a curated chordType-to-scale mapping, with a deliberately small candidate scale list. Curated mappings will become subjective and stale quickly. The helper should probably:

- Resolve chord tones through `@tonaljs/chord` from a concrete chord name, preferably using detected chord names or `${renderRoot}${shape.chordType}`.
- Compare pitch-class chroma sets against a fixed candidate scale corpus.
- Rank/present a small set of familiar results.
- Clearly handle omitted chord tones, because many registered guitar voicings omit intervals.

There is also a root ambiguity to resolve: “scales containing Cmaj7” could mean C-rooted scales containing C-E-G-B, or all parent scales across all roots/modes whose pitch classes contain those tones. Those are different products.

Infrastructure concerns are real and should be explicit in the spec. `site/package.json` does not declare `@tonaljs/*`, while `tonal-guitar` exports integration functions from `src/index.ts` that import optional peer deps. The research’s recommendation to add explicit site dependencies is sound. Static export compatibility is also correctly called out: no server routes, no runtime API assumptions, and URL parsing must stay hydration-safe as in `ShapeLibrary.tsx`.

Bundle size deserves more attention. Importing `tonal-guitar` already pulls the integration surface through `src/index.ts`, but adding more panel logic may make the `/shapes` client bundle heavier. Compute-on-open helps runtime cost, but not necessarily bundle cost. The spec should require checking the production build output, and consider lazy-loading the panel/detail derivation if the bundle grows materially.

**General**

The biggest unclear area is the exact definition of “scales containing this chord.” That needs product language, algorithm, candidate universe, ranking, and empty-state behavior before implementation.

I would challenge the assumption that no library work is required. For a UI-only panel shell, true. For trustworthy Tonal-powered scale containment, probably not. This is exactly the kind of helper that should be tested in `src/`, especially because `relatedScales` is not the right API for chords.

I would also challenge “visual reorganization pass” as too vague. The spec should say whether this means grouping by system, voicing family, collapsible sections, sticky filters, density changes, or a master/detail layout. Otherwise it risks becoming broad UI churn around a feature that already has enough uncertainty.

The biggest early validation risk is the chord-to-scale containment output. If the first few examples produce surprising, noisy, or theoretically questionable results, the panel’s main value proposition weakens. Prototype that helper against representative chord types before designing the final UI around it.

**Top 3 To Resolve Before Spec**

1. Define “scales containing this chord”: candidate scale list, root semantics, ranking, naming, omitted-tone handling, and whether the helper lives in `src/integration.ts`.

2. Lock the panel interaction model: URL `shape` param, desktop/mobile presentation, focus management, keyboard access, and how alternate thumbnails behave.

3. Decide infrastructure requirements: explicit `@tonaljs/*` site dependencies, static export verification, and a bundle-size check or lazy-loading strategy for the detail panel.