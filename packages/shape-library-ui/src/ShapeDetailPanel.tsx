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
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { CagedPosition, ChordShape, ScalesContainingChordResult } from "tonal-guitar";
import type { ChordCatalogEntry, ScaleCatalogEntry, ShapeCatalogEntry } from "shape-catalog";
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
  type CompatibleShapesResult,
  type InversionGroupsResult,
  type SiblingStepperInfo,
} from "shape-catalog";
import { ChordDetailView } from "./ChordDetailView";
import { ScaleDetailView } from "./ScaleDetailView";
import { useLibraryCapabilities } from "./capabilities";

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
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
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

// ============================================================
// Detail computation — the panel's single Tonal-derivation useMemo
// ============================================================

export interface ChordDetail {
  kind: "chord";
  entry: ChordCatalogEntry;
  identified: string[];
  chordName: string | undefined;
  scales: ScalesContainingChordResult | undefined;
  siblings: ChordShape[];
  stepper: SiblingStepperInfo;
  alternates: ChordShape[];
  inversions: InversionGroupsResult;
}

export interface ScaleDetail {
  kind: "scale";
  entry: ScaleCatalogEntry;
  siblings: ScaleCatalogEntry[];
  stepper: SiblingStepperInfo;
  related: Array<{ root: string; scale: string }>;
  compatible: CompatibleShapesResult;
}

type PanelDetail = ChordDetail | ScaleDetail;

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
        <ChordDetailView detail={detail} chordCatalogByName={chordCatalogByName} onSelectEntry={onSelectEntry} />
      ) : (
        <ScaleDetailView detail={detail} scaleCatalogByName={scaleCatalogByName} onSelectEntry={onSelectEntry} />
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

// ============================================================
// Shared presentational primitives
// ============================================================

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tg-section">
      <h3 className="tg-section-title">{title}</h3>
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
    <div className="tg-stepper">
      <button type="button" onClick={onPrev} disabled={index <= 0} aria-label={`Previous ${itemLabel}`} className="tg-chip">
        &#8592;
      </button>
      <span>
        {itemLabel} {position} of {total}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={index === -1 || index >= total - 1}
        aria-label={`Next ${itemLabel}`}
        className="tg-chip"
      >
        &#8594;
      </button>
    </div>
  );
}

/**
 * Bounds-checked target index for a Prev/Next sibling-stepper step:
 * `stepper.index + offset`, or `undefined` when the stepper has no current
 * position (`index === -1`) or the target would fall outside `[0, total)`.
 */
export function siblingIndexAt(stepper: SiblingStepperInfo, offset: number, total: number): number | undefined {
  if (stepper.index === -1) return undefined;
  const targetIndex = stepper.index + offset;
  if (targetIndex < 0 || targetIndex >= total) return undefined;
  return targetIndex;
}

/** "Report a problem" link — reads `reportIssueUrl` from `LibraryCapabilities`
 * (not `EditCapabilities`: both the read-only site and the workbench may
 * want it). Renders nothing when no such capability is injected. */
export function ReportProblemLink({ entry }: { entry: ShapeCatalogEntry }) {
  const capabilities = useLibraryCapabilities();
  const reportUrl = capabilities.reportIssueUrl?.(entry);
  if (!reportUrl) return null;
  return (
    <p className="tg-report-link">
      <a href={reportUrl} target="_blank" rel="noreferrer" className="tg-link">
        Report a problem with this shape
      </a>
    </p>
  );
}
