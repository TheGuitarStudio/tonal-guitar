"use client";

// Non-modal detail slide-over (D-005) for the shape library catalog. No
// backdrop, no focus trap — the grid behind stays interactive and clicking
// another card swaps this panel's content in place. Below `md` it renders as
// a full-height bottom sheet instead of a sidebar (spec's mobile variant).
//
// Every Tonal-derived value the panel needs (identified chord, scales over a
// chord, alternate fingerings, inversions, sibling steppers, related scales,
// compatible shapes, the report-problem URL) is computed once in
// `buildDetail`, invoked from a single `useMemo` keyed on `entry` — never for
// the full ~159-entry catalog. `buildDetail` itself only calls the pure
// helpers in `shapeDetailUtils.ts` — every Tonal-touching call (including
// `identifyChord`/`STANDARD`) lives there, keeping this component free of
// direct library calls in JSX.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ChordShape, ScalesContainingChordResult } from "tonal-guitar";
import type {
  ChordCatalogEntry,
  ScaleCatalogEntry,
  ShapeCatalogEntry,
} from "./shapeLibraryUtils";
import {
  alternateFingerings,
  buildReportUrl,
  chordDetailFor,
  chordTypeSiblings,
  compatibleShapesForEntry,
  inversionGroups,
  relatedScalesForEntry,
  scaleSiblings,
  siblingScaleStepper,
  siblingStepper,
  type CompatibleShapesResult,
  type InversionGroupsResult,
  type SiblingStepperInfo,
} from "./shapeDetailUtils";
import { ChordDetailView } from "./ChordDetailView";
import { ScaleDetailView } from "./ScaleDetailView";

export interface ShapeDetailPanelProps {
  /** The currently selected catalog entry, or `undefined` when no card is
   * selected — the panel renders nothing in that case. */
  entry: ShapeCatalogEntry | undefined;
  /** Full shape catalog (as built by `buildCatalog`) — needed to resolve
   * sibling/parent/compatible-shape names back to selectable catalog
   * entries, and for the scale sibling stepper's `(system, quality)` sweep. */
  catalog: readonly ShapeCatalogEntry[];
  /**
   * Called on ✕ / Esc / mobile-handle-tap. The panel owns none of the
   * triggering card's DOM — the parent is expected to remember which card
   * was clicked (e.g. via a ref captured in its own `onSelect` handler) and
   * move focus back to it here, satisfying the spec's "Esc closes and
   * returns focus to the triggering card" keyboard model.
   */
  onClose: () => void;
  /** Called when the user swaps to a different shape from inside the panel
   * (sibling stepper, alternate-fingering thumbnail, inversion link,
   * parent-shape lineage link, compatible-shape chip). */
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
  /**
   * Bumped by the parent whenever the panel opens (or its entry changes)
   * from OUTSIDE the panel — a grid card click or the deep-link mount-time
   * open — never for swaps originating inside the panel itself (see
   * `ShapeLibrary`'s `handleGridSelectEntry` vs. `handleSelectEntry`). The
   * panel watches this key to move focus into its own root (CR-026); its
   * initial value (`0`) never triggers a focus move.
   */
  focusOnOpenKey: number;
}

// ============================================================
// Detail computation — the panel's single Tonal-derivation useMemo
// ============================================================

export interface ChordDetail {
  kind: "chord";
  entry: ChordCatalogEntry;
  /** Full `identifyChord` result — first entry is "primary", the rest are
   * alternates. `[]` renders the "Could not identify these notes" state.
   * `identified`, `chordName`, and `scales` all come from a single
   * `chordDetailFor(entry)` call (one `identifyChord` pass — see
   * `shapeDetailUtils.ts`), not three separate re-derivations. */
  identified: string[];
  /** Heading text for "Scales over {chord}"; `undefined` means that section
   * is skipped entirely. */
  chordName: string | undefined;
  scales: ScalesContainingChordResult | undefined;
  /** `chordTypeSiblings(entry)` — INCLUDES `entry` itself; shared by the
   * stepper, the inversion grouping, and Prev/Next voicing navigation. */
  siblings: ChordShape[];
  stepper: SiblingStepperInfo;
  alternates: ChordShape[];
  inversions: InversionGroupsResult;
  reportUrl: string;
}

export interface ScaleDetail {
  kind: "scale";
  entry: ScaleCatalogEntry;
  /** Same-`(system, quality)` siblings, INCLUDING `entry`, sorted by name —
   * `shapeDetailUtils.scaleSiblings`, passed straight into `siblingScaleStepper`
   * for its `index`/`total`, so the stepper's `index` always lines up with
   * this array for Prev/Next navigation. */
  siblings: ScaleCatalogEntry[];
  stepper: SiblingStepperInfo;
  related: Array<{ root: string; scale: string }>;
  compatible: CompatibleShapesResult;
  reportUrl: string;
}

type PanelDetail = ChordDetail | ScaleDetail;

function buildDetail(
  entry: ShapeCatalogEntry,
  catalog: readonly ShapeCatalogEntry[],
): PanelDetail {
  if (entry.kind === "chord") {
    const siblings = chordTypeSiblings(entry);
    const { identified, chordName, scales } = chordDetailFor(entry);
    return {
      kind: "chord",
      entry,
      identified,
      chordName,
      scales,
      siblings,
      stepper: siblingStepper(entry, siblings),
      alternates: alternateFingerings(entry),
      inversions: inversionGroups(entry, siblings),
      reportUrl: buildReportUrl(entry),
    };
  }

  const scaleSiblingsList = scaleSiblings(entry, catalog);
  return {
    kind: "scale",
    entry,
    siblings: scaleSiblingsList,
    stepper: siblingScaleStepper(entry, scaleSiblingsList),
    related: relatedScalesForEntry(entry),
    compatible: compatibleShapesForEntry(entry),
    reportUrl: buildReportUrl(entry),
  };
}

function buildEntryNameMap<K extends ShapeCatalogEntry["kind"]>(
  catalog: readonly ShapeCatalogEntry[],
  kind: K,
): Map<string, Extract<ShapeCatalogEntry, { kind: K }>> {
  const map = new Map<string, Extract<ShapeCatalogEntry, { kind: K }>>();
  for (const candidate of catalog) {
    if (candidate.kind === kind) {
      map.set(candidate.name, candidate as Extract<ShapeCatalogEntry, { kind: K }>);
    }
  }
  return map;
}

// ============================================================
// Root component
// ============================================================

/**
 * Non-modal shape detail slide-over. Structural chrome only — kind-specific
 * content lives in `ChordDetailView`/`ScaleDetailView` below.
 */
export function ShapeDetailPanel({
  entry,
  catalog,
  onClose,
  onSelectEntry,
  focusOnOpenKey,
}: ShapeDetailPanelProps) {
  const isOpen = entry !== undefined;

  // The panel's own root — focus target for the non-modal disclosure
  // pattern below. No focus TRAP is installed (the spec forbids one: the
  // panel is non-modal and the grid behind it stays reachable), just a
  // one-time focus MOVE on open, mirroring the standard "disclosure widget"
  // keyboard contract.
  const panelRef = useRef<HTMLElement | null>(null);

  // Mobile "translateY(100%) -> 0" entrance transition, triggered only on
  // the closed->open edge (not on every entry swap while already open, and
  // not replayed just because `catalog` identity changes).
  const [entered, setEntered] = useState(isOpen);
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setEntered(false);
      const frame = requestAnimationFrame(() => setEntered(true));
      wasOpenRef.current = true;
      return () => cancelAnimationFrame(frame);
    }
    if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  // Esc closes (and, per the parent-owned focus contract, returns focus to
  // the triggering card) whenever the panel is open.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // CR-026: move focus into the panel when `focusOnOpenKey` changes away
  // from its initial `0` — i.e. only for opens/swaps the parent flagged as
  // originating outside the panel (grid card click, deep-link mount-time
  // open). Swaps initiated from inside the panel (sibling stepper,
  // alternate-fingering thumbnails, inversion/related/compatible links)
  // never bump this key, so focus correctly stays wherever the user already
  // is inside the panel.
  useEffect(() => {
    if (!isOpen || focusOnOpenKey === 0) return;
    panelRef.current?.focus({ preventScroll: false });
  }, [isOpen, focusOnOpenKey]);

  const chordCatalogByName = useMemo(() => buildEntryNameMap(catalog, "chord"), [catalog]);
  const scaleCatalogByName = useMemo(() => buildEntryNameMap(catalog, "scale"), [catalog]);

  // The single useMemo gathering every Tonal-derived value the panel needs,
  // keyed on `entry` (and `catalog`, for the scale sibling sweep) — computed
  // once per selection, never for the whole catalog.
  const detail = useMemo<PanelDetail | undefined>(
    () => (entry ? buildDetail(entry, catalog) : undefined),
    [entry, catalog],
  );

  if (!entry || !detail) return null;

  // Below `md`, the panel is a FULL-HEIGHT bottom sheet (`inset-0`, spec's
  // "Mobile behavior") rather than a capped bottom drawer — it covers the
  // single-column grid entirely since the page can't shift left on a phone.
  // `translate-y-full -> translate-y-0` still drives the slide-in.
  const wrapperClassName = [
    "fixed inset-0 z-40 flex flex-col overflow-y-auto",
    "border-t border-fd-border bg-fd-background p-4 pt-3 shadow-2xl",
    "transition-transform duration-300 ease-out",
    entered ? "translate-y-0" : "translate-y-full",
    "md:sticky md:top-4 md:inset-x-auto md:bottom-auto md:z-auto md:max-h-[calc(100vh-2rem)]",
    "md:w-[380px] md:flex-none md:translate-y-0 md:rounded-none md:border-l md:border-t-0",
    "md:pt-4 md:shadow-none md:transition-none",
  ].join(" ");

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      role="complementary"
      aria-label={`${entry.kind === "chord" ? "Chord" : "Scale"} shape details`}
      className={`${wrapperClassName} focus:outline-none focus:ring-2 focus:ring-inset focus:ring-fd-primary`}
    >
      {/* Announces swaps for assistive tech — the panel is non-modal, so
          nothing else moves focus here on its own. */}
      <div aria-live="polite" className="sr-only">
        {`Showing details for ${entry.name}`}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close (drag to dismiss)"
        className="mx-auto mb-2 block h-1.5 w-10 flex-none rounded-full bg-fd-border md:hidden"
      />

      <div className="relative flex-none">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close shape details"
          className="absolute right-0 top-0 rounded-md p-1 text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      {detail.kind === "chord" ? (
        <ChordDetailView
          detail={detail}
          chordCatalogByName={chordCatalogByName}
          onSelectEntry={onSelectEntry}
        />
      ) : (
        <ScaleDetailView
          detail={detail}
          scaleCatalogByName={scaleCatalogByName}
          onSelectEntry={onSelectEntry}
        />
      )}
    </aside>
  );
}

// ============================================================
// Shared presentational primitives
// ============================================================

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 border-t border-fd-border pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="mb-2 text-sm font-semibold text-fd-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function SiblingStepper({
  index,
  total,
  itemLabel,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  itemLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total <= 1) return null;
  const position = index === -1 ? "?" : index + 1;
  return (
    <div className="flex items-center gap-2 text-xs text-fd-muted-foreground">
      <button
        type="button"
        onClick={onPrev}
        disabled={index <= 0}
        aria-label={`Previous ${itemLabel}`}
        className="rounded border border-fd-border px-2 py-0.5 disabled:opacity-30"
      >
        ←
      </button>
      <span>
        {itemLabel} {position} of {total}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={index === -1 || index >= total - 1}
        aria-label={`Next ${itemLabel}`}
        className="rounded border border-fd-border px-2 py-0.5 disabled:opacity-30"
      >
        →
      </button>
    </div>
  );
}

/**
 * Bounds-checked target index for a Prev/Next sibling-stepper step:
 * `stepper.index + offset`, or `undefined` when the stepper has no current
 * position (`index === -1`) or the target would fall outside `[0, total)`.
 * Shared by `ChordDetailView`/`ScaleDetailView`'s own `siblingAt` helpers,
 * which differ only in how they resolve the index into a catalog entry
 * (chord `siblings` are `ChordShape[]`, needing a name lookup; scale
 * `siblings` are already `ScaleCatalogEntry[]`).
 */
export function siblingIndexAt(
  stepper: SiblingStepperInfo,
  offset: number,
  total: number,
): number | undefined {
  if (stepper.index === -1) return undefined;
  const targetIndex = stepper.index + offset;
  if (targetIndex < 0 || targetIndex >= total) return undefined;
  return targetIndex;
}

export function ReportProblemLink({ reportUrl }: { reportUrl: string }) {
  return (
    <p className="mt-4 text-xs">
      <a
        href={reportUrl}
        target="_blank"
        rel="noreferrer"
        className="text-fd-muted-foreground underline"
      >
        Report a problem with this shape
      </a>
    </p>
  );
}
