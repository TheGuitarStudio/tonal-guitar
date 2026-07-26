# Decisions: Shape Library Detail Side Panel

Technical decisions made during the Shape phase.

---

## D-001: "Scales containing this chord" semantics — both groups, root-anchored primary

**Context:** `relatedScales`/`modeNames` can't answer this for chords, and the phrase is
ambiguous: C-rooted scales containing Cmaj7's tones vs. all scales at any root whose
pitch classes contain them (Codex review flagged these as different products).

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Root-anchored only | Matches chord-scale mental model; small familiar list | Hides legitimate parent scales (e.g. Cmaj7 ⊂ G major) |
| All parent scales only | Theoretically complete | Noisy; needs root grouping; weak first read |
| Both, grouped | Complete and readable; primary list stays familiar | Most algorithm + UI work in slice one |

**Decision:** Both, grouped — root-anchored list first, expandable "other parent
scales" section below.

**Rationale:** User choice; serves both the practical improviser question and the
theory-complete view without compromising either. Reversible (UI can hide the second
group later).

---

## D-002: Chord→scales containment helper lives in the library

**Context:** The containment algorithm (chroma-subset sweep over a scale corpus) could
live in site utils (fast, untested) or `src/integration.ts` (tested public API).

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| `src/integration.ts` public fn | Tested (site has no test infra); reusable API; documented | Adds library surface + docs work to the feature |
| Site-only helper | Zero library change; faster | Untested by convention; not reusable; music-theory logic in UI layer |

**Decision:** New tested public function in `src/integration.ts` (working name
`scalesContainingChord`), chroma-subset sweep, fixed scale corpus, explicit
omitted-tone handling.

**Rationale:** User choice, matching Codex review: it's library-domain math whose
trustworthiness is the panel's core value; the site owns only presentation, limits,
and labels. Not easily reversible after release (public API) — name and signature get
extra care in the spec.

---

## D-003: Visual reorganization scope — grouped sections, sticky filter bar, count badges; chord-first taxonomy with voicing as tags

**Context:** "Visual reorganization pass" was vague (Codex flagged it); grouping risks
diluting the failures-first audit invariant.

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Flat grid + polish only | Zero risk to audit workflow | Doesn't address 159-card wall or naming taxonomy |
| Grouped sections + sticky bar + counts | Browsable; audit invariant preserved via pinned failing section | More layout work |
| Full chord-first IA rework | Matches user's mental model | Big; needs validation |

**Decision:** Grouped sections (failing shapes pinned in a top section), sticky filter
bar, per-group count badges — plus adopt the chord-first taxonomy direction: **voicing
family is a tag/category, not part of the display name.** The chord entity is "Em7b5";
open/drop-2/drop-3/shell are its versions, surfaced as badges and sub-filters. Registry
names are unchanged (display layer derives from `chordType`/`voicingFamily`/
`canonicalRoot`). The exact interaction form (sub-filter chips vs modal vs page morph
when filtered) is deferred to design experiments (D-004).

**Rationale:** User selections + explicit naming critique ("Open shouldn't be in the
name"). Pinning the failing section keeps D-004 of the audit-library spec intact.

---

## D-004: Panel presentation form decided by design experiments, not discussion

**Context:** Slide-over vs docked master-detail vs expanding card (and the taxonomy
interaction form) are look-and-feel judgments the user wants to evaluate visually.

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Pick from descriptions/ASCII | Fast | Committing blind on a primarily visual call |
| Build test HTML pages | Real evaluation; cheap throwaway; captured in repo | Delays spec by one experiment round |

**Decision:** Build self-contained HTML design experiments under
`.tonal-guitar/features/shape-detail-panel/experiments/` using real registry names and
plausible data: candidate panel presentations and the chord-first taxonomy/grouping
treatment, including small-SVG thumbnails with hover-to-enlarge. User reviews in
browser; the winning direction gets encoded in spec.md.

**Rationale:** User request. Presentation is the highest-variance UX call in the
feature; an hour of mockups beats respinning the implementation later. Fully
reversible.

---

## D-005: Panel form — non-modal slide-over with click-to-swap; compact card grid

**Context:** User evaluated the three D-004 experiments in browser.

**Options Considered:** slide-over (01), docked master-detail (02), page-morph (03).

**Decision:** Slide-over wins, but **non-modal**: no backdrop, no focus trap; the page
stays fully interactive while the panel is open. Clicking any other card swaps its
details into the open panel; the selected card gets a highlighted border; page content
shifts left so the panel covers nothing. Close via ✕ or Esc. Additionally: **cards get
significantly smaller/denser** — seeing more chords at a glance is a primary goal, so
per-card metadata is trimmed (name + voicing tag + diagram) with detail deferred to
the panel.

**Rationale:** User feedback verbatim: likes the slide-over but wants to "keep the rest
of the page interactive allowing you to click on other chords and just have it replace
in the side panel," and wants chord examples "a bit smaller so we can get more on
there — seeing more at a glance is helpful." Experiment 01 was updated in place to
this behavior and re-verified. Note for spec: non-modal means no focus trap; keyboard
model = focus stays in grid, Esc closes, panel is a complementary landmark region
(`role="complementary"`/`aria-live` on swaps).

**Open (pending research):** Filtering/sorting model — user wants exploration of how
existing chord tools categorize (toggleable category chips, root pickers, type pickers,
sort orders). Web research dispatched; will become D-006.

---

## D-006: Filter/sort model — faceted chips (Proposal A), library-sourced data, scales included

**Context:** Filter-research survey (see `filter-research.md`) produced three
proposals; experiment 04 implemented Proposal A; user evaluated it in browser.

**Decision:** Adopt Proposal A (experiment 04) with amendments:

1. **Facets:** quality-group chips expanding to multi-select type chips; voicing-family
   multi-select chips with live counts (grey at zero); chromatic root strip;
   sort default base-fret ascending; spotlight (★ featured) tier first with
   "Show all N" per group; alias-aware search (ø / half-dim → m7b5).
2. **No interval color-coding** on dots in v1. Later (optional, not this slice): a
   toggle that shows the interval label of each note. Dots stay monochrome.
3. **All displayed data MUST come from the tonal-guitar library (or Tonal.js).** The
   page is a showcase of the library — no site-side curated musical data. Implication:
   the spotlight/`featured` flag is library shape metadata (new optional field on
   shape types + registry data), not a site-side list; chord symbols, groupings,
   counts, scales, and panel content all derive from registries + library functions
   at render time.
4. **Scales and scale shapes are first-class in the same page.** The existing
   scale/chord kind toggle stays; scale shapes (CAGED, 3NPS, pentatonic boxes, minor
   variants) get the equivalent treatment: facets appropriate to scales (system,
   quality), same compact grid + non-modal panel (panel content: related scales/modes,
   compatible-shape context, parentShape lineage, sibling-shape stepper).

**Purpose framing (drives spec priorities):** this page is the base for (a) seeing
every chord/scale shape in the library, (b) testing and auditing them, (c) having
professionals review correctness. The audit surface (failing-first pinned section,
badges, report flow) remains first-class. A future **edit layer** (edits saved to a
file that can be fed back into the library data) is explicitly anticipated but out of
scope for this feature — the design should not preclude it.

**Rationale:** User selection after clicking through experiment 04; amendments are
verbatim user constraints. Library-sourced data also matches the audit-library spec's
"derived, never hardcoded" rule.
