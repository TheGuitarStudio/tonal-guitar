/**
 * Ported from `site/app/shapes/components/ShapeDetailPanel.tsx`. Non-modal
 * detail slide-over. No backdrop, no focus trap — the grid behind stays
 * interactive and clicking another card swaps this panel's content in
 * place. Below 768px it renders as a full-height bottom sheet instead of a
 * sidebar (`renderAsBottomSheet` prop — spec §5.3/§7 "no `window` access
 * during render"; the caller decides the breakpoint outside render, e.g.
 * via a `matchMedia` listener in a `useEffect`, and passes the boolean in).
 *
 * Every Tonal-derived value the panel needs (identified chord, scales over a
 * chord, alternate fingerings, inversions, sibling steppers, related scales,
 * compatible shapes) is computed once in `buildDetail`, invoked from a
 * single `useMemo` keyed on `entry` — never for the full catalog.
 * `buildDetail` itself only calls the pure helpers in `shape-catalog`.
 *
 * Capability-gated: the Edit / Duplicate-to-position / Add-tag affordances
 * (each carrying `data-tg-edit`) render only when the corresponding
 * `EditCapabilities` callback is provided (spec §5.3 D-002 invariant).
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { CagedPosition } from "tonal-guitar";
import type { ShapeCatalogEntry } from "shape-catalog";
import {
  alternateFingerings,
  chordDetailFor,
  chordTypeSiblings,
  compatibleShapesForEntry,
  inversionGroups,
  relatedScalesForEntry,
  scaleSiblings,
  siblingScaleStepper,
  siblingStepper,
} from "shape-catalog";
import { ChordDetailView } from "./ChordDetailView";
import { ScaleDetailView } from "./ScaleDetailView";
import { useLibraryCapabilities } from "./capabilities";
import { Section, SiblingStepper, siblingIndexAt, ReportProblemLink } from "./detailPrimitives";
import type { ChordDetail, ScaleDetail, PanelDetail } from "./detailTypes";

// Re-exported so the package barrel (`index.ts`) — and any code importing
// directly from this module — keep working unchanged after the CR-035
// extraction into `detailPrimitives.tsx`/`detailTypes.ts`.
export { Section, SiblingStepper, siblingIndexAt, ReportProblemLink };
export type { ChordDetail, ScaleDetail };

export interface ShapeDetailPanelProps {
  /** The currently selected catalog entry, or `undefined` when no card is
   * selected — the panel renders nothing in that case. */
  entry: ShapeCatalogEntry | undefined;
  /** Full shape catalog — needed to resolve sibling/parent/compatible-shape
   * names back to selectable catalog entries. */
  catalog: readonly ShapeCatalogEntry[];
  /** Called on close / Esc / mobile-handle-tap. The panel owns none of the
   * triggering card's DOM — the parent is expected to move focus back to it. */
  onClose: () => void;
  /** Called when the user swaps to a different shape from inside the panel. */
  onSelectEntry?: (entry: ShapeCatalogEntry) => void;
  /** Bumped by the parent whenever the panel opens (or its entry changes)
   * from OUTSIDE the panel — never for swaps originating inside the panel. */
  focusOnOpenKey: number;
  /**
   * Renders the panel as a full-height bottom sheet instead of a docked
   * sidebar (spec §7's mobile variant). The caller computes this outside
   * render (e.g. a `matchMedia` listener) — this component never touches
   * `window` itself, so it stays safe under `renderToString`/SSR prerender.
   */
  renderAsBottomSheet?: boolean;
}

// `onSelectEntry` is optional on `ShapeDetailPanelProps` (CR-044 — matches
// `ShapeBoard`/`BoardCellCard`), but `ChordDetailView`/`ScaleDetailView`
// still require a real callback; this fills the gap when the caller omits
// one rather than threading optionality through every sibling-link/stepper
// helper inside those views.
const NOOP_SELECT_ENTRY = () => {};

// ============================================================
// Detail computation — the panel's single Tonal-derivation useMemo
// ============================================================

function buildDetail(entry: ShapeCatalogEntry, catalog: readonly ShapeCatalogEntry[]): PanelDetail {
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
  renderAsBottomSheet = false,
}: ShapeDetailPanelProps) {
  const isOpen = entry !== undefined;
  const capabilities = useLibraryCapabilities();

  // The panel's own root — focus target for the non-modal disclosure
  // pattern below. No focus TRAP is installed: the panel is non-modal and
  // the grid behind it stays reachable.
  const panelRef = useRef<HTMLElement | null>(null);

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

  // Esc closes whenever the panel is open. `window` is only touched inside
  // an effect (post-mount), never during render — safe under SSR.
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

  useEffect(() => {
    if (!isOpen || focusOnOpenKey === 0) return;
    panelRef.current?.focus({ preventScroll: false });
  }, [isOpen, focusOnOpenKey]);

  const chordCatalogByName = useMemo(() => buildEntryNameMap(catalog, "chord"), [catalog]);
  const scaleCatalogByName = useMemo(() => buildEntryNameMap(catalog, "scale"), [catalog]);

  const detail = useMemo<PanelDetail | undefined>(
    () => (entry ? buildDetail(entry, catalog) : undefined),
    [entry, catalog],
  );

  if (!entry || !detail) return null;

  const wrapperClassName = ["tg-panel", renderAsBottomSheet ? "" : "tg-panel-sidebar", entered ? "" : "tg-panel-hidden"]
    .filter(Boolean)
    .join(" ");

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      role="complementary"
      aria-label={`${entry.kind === "chord" ? "Chord" : "Scale"} shape details`}
      className={wrapperClassName}
    >
      {/* Announces swaps for assistive tech — the panel is non-modal, so
          nothing else moves focus here on its own. */}
      <div aria-live="polite" className="tg-sr-only">
        {`Showing details for ${entry.name}`}
      </div>

      {renderAsBottomSheet && (
        <button type="button" onClick={onClose} aria-label="Close (drag to dismiss)" className="tg-panel-handle" />
      )}

      <div className="tg-panel-topbar">
        <button type="button" onClick={onClose} aria-label="Close shape details" className="tg-panel-close">
          <span aria-hidden="true">&#10005;</span>
        </button>
      </div>

      <EditControls entry={entry} capabilities={capabilities} />

      {detail.kind === "chord" ? (
        <ChordDetailView detail={detail} chordCatalogByName={chordCatalogByName} onSelectEntry={onSelectEntry ?? NOOP_SELECT_ENTRY} />
      ) : (
        <ScaleDetailView detail={detail} scaleCatalogByName={scaleCatalogByName} onSelectEntry={onSelectEntry ?? NOOP_SELECT_ENTRY} />
      )}
    </aside>
  );
}

const CAGED_POSITIONS: CagedPosition[] = ["C", "A", "G", "E", "D"];

/**
 * Edit / Duplicate-to-position / Add-tag affordances — a single block so
 * every `data-tg-edit` element in the panel lives in one place. Renders
 * nothing at all (not even a wrapper) when `capabilities.edit` is
 * `undefined`, satisfying the D-002 invariant.
 */
function EditControls({
  entry,
  capabilities,
}: {
  entry: ShapeCatalogEntry;
  capabilities: ReturnType<typeof useLibraryCapabilities>;
}) {
  const edit = capabilities.edit;
  const [tagInput, setTagInput] = useState("");

  if (!edit) return null;

  function handleAddTag(e: FormEvent) {
    e.preventDefault();
    const tag = tagInput.trim();
    if (tag.length === 0) return;
    edit?.onAddTag?.(entry, tag);
    setTagInput("");
  }

  return (
    <div data-tg-edit className="tg-edit-controls">
      {edit.onEditShape && (
        <button type="button" data-tg-edit onClick={() => edit.onEditShape?.(entry)} className="tg-link">
          Edit shape
        </button>
      )}

      {edit.onDuplicateToPosition && (
        <div data-tg-edit className="tg-edit-controls-row">
          <span className="tg-muted">Duplicate to:</span>
          {CAGED_POSITIONS.map((position) => (
            <button
              key={position}
              type="button"
              data-tg-edit
              onClick={() => edit.onDuplicateToPosition?.(entry, position)}
              className="tg-chip"
            >
              {position}
            </button>
          ))}
        </div>
      )}

      {edit.onAddTag && (
        <form data-tg-edit onSubmit={handleAddTag} className="tg-edit-controls-row">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add tag"
            aria-label="Add tag"
            className="tg-input"
          />
          <button type="submit" data-tg-edit className="tg-link">
            Add
          </button>
        </form>
      )}
    </div>
  );
}

// Shared presentational primitives (Section, SiblingStepper, siblingIndexAt,
// ReportProblemLink) live in `./detailPrimitives` and are re-exported near
// the top of this file — see the CR-035 comment there.
