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
import type {
  AuditSeverity,
  ChordShape,
  ContainingScale,
  ScalesContainingChordResult,
  ShapeAuditIssue,
} from "tonal-guitar";
import {
  chordDisplaySymbol,
  type ChordCatalogEntry,
  type ScaleCatalogEntry,
  type ShapeCatalogEntry,
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
import { CompactFretboard } from "./CompactFretboard";
import { ShapeCardDiagram } from "./ShapeCardDiagram";
import { ShapeCardChordTable } from "./ShapeCardChordTable";

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
}

// ============================================================
// Detail computation — the panel's single Tonal-derivation useMemo
// ============================================================

interface ChordDetail {
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

interface ScaleDetail {
  kind: "scale";
  entry: ScaleCatalogEntry;
  /** Same-`(system, quality)` siblings, INCLUDING `entry`, sorted by name —
   * `shapeDetailUtils.scaleSiblings`, the same list `siblingScaleStepper`
   * derives its `index`/`total` from internally, so the stepper's `index`
   * always lines up with this array for Prev/Next navigation. */
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

  return {
    kind: "scale",
    entry,
    siblings: scaleSiblings(entry, catalog),
    stepper: siblingScaleStepper(entry, catalog),
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
}: ShapeDetailPanelProps) {
  const isOpen = entry !== undefined;

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
      role="complementary"
      aria-label={`${entry.kind === "chord" ? "Chord" : "Scale"} shape details`}
      className={wrapperClassName}
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 border-t border-fd-border pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="mb-2 text-sm font-semibold text-fd-foreground">{title}</h3>
      {children}
    </section>
  );
}

function severityRank(severity: AuditSeverity): number {
  return severity === "error" ? 0 : 1;
}

function badgeClassFor(severity: AuditSeverity): string {
  if (severity === "error") {
    return "bg-red-500/10 text-red-700 dark:text-red-600 border border-red-500/40";
  }
  return "bg-amber-500/10 text-amber-700 dark:text-amber-600 border border-amber-500/40";
}

/** Mirrors `ShapeCard.tsx`'s own (non-exported) issue-badge treatment —
 * duplicated locally, matching the rest of this feature's sibling-file
 * pattern (`CompactFretboard.tsx`'s local `fretSummary`) rather than adding
 * a cross-file dependency for a few lines of formatting. */
function IssueBadges({ issues }: { issues: ShapeAuditIssue[] }) {
  const sorted = [...issues].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );
  if (sorted.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sorted.map((issue, i) => (
        <span
          key={`${issue.id}-${i}`}
          title={issue.message}
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${badgeClassFor(issue.severity)}`}
        >
          {issue.id}
        </span>
      ))}
    </div>
  );
}

function FeaturedMark() {
  return (
    <span aria-label="Featured" title="Featured shape" className="text-amber-500">
      ★
    </span>
  );
}

function SiblingStepper({
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

function ReportProblemLink({ reportUrl }: { reportUrl: string }) {
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

// ============================================================
// Chord-entry content (spec §Site "Chord entries")
// ============================================================

function ChordDetailView({
  detail,
  chordCatalogByName,
  onSelectEntry,
}: {
  detail: ChordDetail;
  chordCatalogByName: Map<string, ChordCatalogEntry>;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
}) {
  const { entry, siblings, stepper } = detail;

  function siblingAt(offset: number): ChordCatalogEntry | undefined {
    if (stepper.index === -1) return undefined;
    const targetIndex = stepper.index + offset;
    if (targetIndex < 0 || targetIndex >= siblings.length) return undefined;
    return chordCatalogByName.get(siblings[targetIndex].name);
  }

  const prevEntry = siblingAt(-1);
  const nextEntry = siblingAt(1);

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="text-lg font-semibold text-fd-foreground">
            {chordDisplaySymbol(entry)}
          </h2>
          {entry.shape.featured && <FeaturedMark />}
          {entry.shape.voicingFamily && (
            <span className="rounded bg-fd-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fd-muted-foreground">
              {entry.shape.voicingFamily}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-fd-muted-foreground">
          {entry.shape.baseFret !== undefined
            ? `Base fret ${entry.shape.baseFret}`
            : "No base fret"}{" "}
          · Root {entry.renderRoot}
        </p>
        <div className="mt-2">
          <IssueBadges issues={entry.issues} />
        </div>
        <div className="mt-2">
          <SiblingStepper
            index={stepper.index}
            total={stepper.total}
            itemLabel="Voicing"
            onPrev={() => prevEntry && onSelectEntry(prevEntry)}
            onNext={() => nextEntry && onSelectEntry(nextEntry)}
          />
        </div>
      </div>

      <ShapeCardDiagram entry={entry} />

      <IdentifiedChordSection identified={detail.identified} />
      <ScalesOverChordSection chordName={detail.chordName} scales={detail.scales} />
      <AlternateFingeringsSection
        alternates={detail.alternates}
        chordCatalogByName={chordCatalogByName}
        currentName={entry.name}
        reportUrl={detail.reportUrl}
        onSelectEntry={onSelectEntry}
      />
      <InversionsSection
        inversions={detail.inversions}
        chordCatalogByName={chordCatalogByName}
        currentName={entry.name}
        onSelectEntry={onSelectEntry}
      />

      <Section title="Shape data">
        <ShapeCardChordTable
          chordShape={entry.shape}
          builtFrets={entry.builtFrets}
          sourceFrets={entry.sourceFrets}
          gripRoot={entry.gripRoot}
          renderRoot={entry.renderRoot}
          issues={entry.issues}
        />
      </Section>

      <ReportProblemLink reportUrl={detail.reportUrl} />
    </div>
  );
}

function IdentifiedChordSection({ identified }: { identified: string[] }) {
  return (
    <Section title="Identified chord">
      {identified.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">Could not identify these notes.</p>
      ) : (
        <p className="text-sm">
          <strong className="text-fd-foreground">{identified[0]}</strong>
          {identified.length > 1 && (
            <span className="text-fd-muted-foreground">
              {" "}
              — also: {identified.slice(1).join(", ")}
            </span>
          )}
        </p>
      )}
    </Section>
  );
}

/** "Fit" caption for one containing scale — chord-tones "why" this scale is
 * listed, built entirely from `ContainingScale`'s own fields (no extra Tonal
 * calls needed: `extraTones`/`omittedTones` already carry everything the
 * caption needs). */
function containmentCaption(scale: ContainingScale): string {
  const fit =
    scale.extraTones === 0
      ? "exact fit"
      : `${scale.extraTones} extra tone${scale.extraTones === 1 ? "" : "s"}`;
  if (scale.omittedTones.length > 0) {
    return `${fit}; missing ${scale.omittedTones.join(", ")}`;
  }
  return `contains every chord tone (${fit})`;
}

function ContainingScaleList({
  scales,
  emptyLabel,
}: {
  scales: ContainingScale[];
  emptyLabel: string;
}) {
  if (scales.length === 0) {
    return emptyLabel ? (
      <p className="text-sm text-fd-muted-foreground">{emptyLabel}</p>
    ) : null;
  }
  return (
    <ul className="space-y-1 text-sm">
      {scales.map((scale) => (
        <li
          key={`${scale.name}-${scale.scaleType}`}
          className="flex flex-wrap items-baseline gap-x-2"
        >
          <span className="font-medium text-fd-foreground">{scale.name}</span>
          <span className="text-xs text-fd-muted-foreground">
            {containmentCaption(scale)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ScalesOverChordSection({
  chordName,
  scales,
}: {
  chordName: string | undefined;
  scales: ScalesContainingChordResult | undefined;
}) {
  if (chordName === undefined || scales === undefined) return null;

  const hasAny = scales.rootAnchored.length > 0 || scales.otherRoots.length > 0;

  return (
    <Section title={`Scales over ${chordName}`}>
      {!hasAny ? (
        <p className="text-sm text-fd-muted-foreground">
          No scales in the library's corpus fully contain this chord's tones.
        </p>
      ) : (
        <>
          <ContainingScaleList
            scales={scales.rootAnchored}
            emptyLabel="No root-anchored scales found."
          />
          {scales.otherRoots.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-fd-muted-foreground">
                Other parent scales (any root) — {scales.otherRoots.length}
              </summary>
              <div className="mt-2">
                <ContainingScaleList scales={scales.otherRoots} emptyLabel="" />
              </div>
            </details>
          )}
        </>
      )}
    </Section>
  );
}

function AlternateFingeringsSection({
  alternates,
  chordCatalogByName,
  currentName,
  reportUrl,
  onSelectEntry,
}: {
  alternates: ChordShape[];
  chordCatalogByName: Map<string, ChordCatalogEntry>;
  currentName: string;
  reportUrl: string;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
}) {
  return (
    <Section title="Alternate fingerings">
      {alternates.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">
          No other registered fingerings for this chord type.{" "}
          <a href={reportUrl} target="_blank" rel="noreferrer" className="underline">
            Suggest one
          </a>
          .
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {alternates.map((shape) => {
            const altEntry = chordCatalogByName.get(shape.name);
            if (!altEntry) return null;
            return (
              <CompactFretboard
                key={shape.name}
                entry={altEntry}
                onSelect={() => onSelectEntry(altEntry)}
                selected={altEntry.name === currentName}
              />
            );
          })}
        </div>
      )}
    </Section>
  );
}

const INVERSION_LABELS: Readonly<Record<number, string>> = {
  0: "Root position",
  1: "1st inversion",
  2: "2nd inversion",
  3: "3rd inversion",
};

function inversionLabelFor(n: number): string {
  return INVERSION_LABELS[n] ?? `${n}th inversion`;
}

function ShapeLinkList({
  shapes,
  chordCatalogByName,
  currentName,
  onSelectEntry,
}: {
  shapes: ChordShape[];
  chordCatalogByName: Map<string, ChordCatalogEntry>;
  currentName: string;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {shapes.map((shape) => {
        const isCurrent = shape.name === currentName;
        const siblingEntry = chordCatalogByName.get(shape.name);
        if (isCurrent || !siblingEntry) {
          return (
            <span
              key={shape.name}
              className={
                isCurrent ? "font-medium text-fd-foreground" : "text-fd-muted-foreground"
              }
            >
              {shape.name}
              {isCurrent ? " (current)" : ""}
            </span>
          );
        }
        return (
          <button
            key={shape.name}
            type="button"
            onClick={() => onSelectEntry(siblingEntry)}
            className="underline decoration-dotted hover:text-fd-primary"
          >
            {shape.name}
          </button>
        );
      })}
    </span>
  );
}

/**
 * Inversion groups: `"inversion"` mode walks the canonical root/1st/2nd/3rd
 * labels so a chord type registered with only, say, a root-position voicing
 * still shows "1st inversion — Not registered" rather than silently omitting
 * it. `"voicingFamily"` mode (the base-CAGED-major degrade case, no
 * `chordType`/`inversion` at all) just lists whatever groups
 * `inversionGroups` produced.
 */
function InversionsSection({
  inversions,
  chordCatalogByName,
  currentName,
  onSelectEntry,
}: {
  inversions: InversionGroupsResult;
  chordCatalogByName: Map<string, ChordCatalogEntry>;
  currentName: string;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
}) {
  if (inversions.mode === "voicingFamily") {
    return (
      <Section title="Inversions">
        <p className="mb-2 text-xs text-fd-muted-foreground">
          This shape has no chord-type/inversion metadata, so siblings are
          grouped by voicing family instead.
        </p>
        <ul className="space-y-1 text-sm">
          {inversions.groups.map((group) => (
            <li key={group.key}>
              <span className="font-medium text-fd-foreground">{group.label}</span>:{" "}
              <ShapeLinkList
                shapes={group.shapes}
                chordCatalogByName={chordCatalogByName}
                currentName={currentName}
                onSelectEntry={onSelectEntry}
              />
            </li>
          ))}
        </ul>
      </Section>
    );
  }

  const unknownGroup = inversions.groups.find((g) => g.key === "unknown");

  return (
    <Section title="Inversions">
      <ul className="space-y-1 text-sm">
        {[0, 1, 2, 3].map((n) => {
          const group = inversions.groups.find((g) => g.key === String(n));
          return (
            <li key={n}>
              <span className="font-medium text-fd-foreground">{inversionLabelFor(n)}</span>
              :{" "}
              {group ? (
                <ShapeLinkList
                  shapes={group.shapes}
                  chordCatalogByName={chordCatalogByName}
                  currentName={currentName}
                  onSelectEntry={onSelectEntry}
                />
              ) : (
                <span className="text-fd-muted-foreground">Not registered</span>
              )}
            </li>
          );
        })}
      </ul>
      {unknownGroup && (
        <p className="mt-2 text-xs text-fd-muted-foreground">
          {unknownGroup.shapes.length} sibling shape(s) have no inversion tagged:{" "}
          <ShapeLinkList
            shapes={unknownGroup.shapes}
            chordCatalogByName={chordCatalogByName}
            currentName={currentName}
            onSelectEntry={onSelectEntry}
          />
        </p>
      )}
    </Section>
  );
}

// ============================================================
// Scale-entry content (spec §Site "Scale entries")
// ============================================================

function ScaleDetailView({
  detail,
  scaleCatalogByName,
  onSelectEntry,
}: {
  detail: ScaleDetail;
  scaleCatalogByName: Map<string, ScaleCatalogEntry>;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
}) {
  const { entry, siblings, stepper } = detail;

  function siblingAt(offset: number): ScaleCatalogEntry | undefined {
    if (stepper.index === -1) return undefined;
    const targetIndex = stepper.index + offset;
    if (targetIndex < 0 || targetIndex >= siblings.length) return undefined;
    return siblings[targetIndex];
  }

  const prevEntry = siblingAt(-1);
  const nextEntry = siblingAt(1);
  const parentEntry = entry.shape.parentShape
    ? scaleCatalogByName.get(entry.shape.parentShape)
    : undefined;

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="text-lg font-semibold text-fd-foreground">{entry.name}</h2>
          {entry.shape.featured && <FeaturedMark />}
          <span className="rounded bg-fd-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fd-muted-foreground">
            {entry.shape.system}
          </span>
          {entry.shape.quality && (
            <span className="rounded bg-fd-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fd-muted-foreground">
              {entry.shape.quality}
            </span>
          )}
        </div>
        {entry.shape.parentShape && (
          <p className="mt-1 text-xs text-fd-muted-foreground">
            Derived from{" "}
            {parentEntry ? (
              <button
                type="button"
                onClick={() => onSelectEntry(parentEntry)}
                className="underline decoration-dotted hover:text-fd-primary"
              >
                {entry.shape.parentShape}
              </button>
            ) : (
              <span>{entry.shape.parentShape}</span>
            )}
          </p>
        )}
        <div className="mt-2">
          <IssueBadges issues={entry.issues} />
        </div>
        <div className="mt-2">
          <SiblingStepper
            index={stepper.index}
            total={stepper.total}
            itemLabel="Shape"
            onPrev={() => prevEntry && onSelectEntry(prevEntry)}
            onNext={() => nextEntry && onSelectEntry(nextEntry)}
          />
        </div>
      </div>

      <ShapeCardDiagram entry={entry} />

      <RelatedScalesSection related={detail.related} />
      <CompatibleShapesSection
        compatible={detail.compatible}
        scaleCatalogByName={scaleCatalogByName}
        onSelectEntry={onSelectEntry}
      />

      <ReportProblemLink reportUrl={detail.reportUrl} />
    </div>
  );
}

function RelatedScalesSection({
  related,
}: {
  related: Array<{ root: string; scale: string }>;
}) {
  return (
    <Section title="Related scales / modes">
      {related.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">
          No related scale/mode data available for this shape's quality.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {related.map(({ root, scale }) => (
            <li key={`${root}-${scale}`}>
              {root} {scale}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function CompatibleShapesSection({
  compatible,
  scaleCatalogByName,
  onSelectEntry,
}: {
  compatible: CompatibleShapesResult;
  scaleCatalogByName: Map<string, ScaleCatalogEntry>;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
}) {
  return (
    <Section title="Compatible shapes">
      {compatible.shapes.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">
          No other registered shapes are compatible with this scale.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {compatible.shapes.map((shape) => {
            const shapeEntry = scaleCatalogByName.get(shape.name);
            return (
              <li key={shape.name}>
                {shapeEntry ? (
                  <button
                    type="button"
                    onClick={() => onSelectEntry(shapeEntry)}
                    className="rounded-full border border-fd-border px-2.5 py-1 text-xs hover:border-fd-primary/50"
                  >
                    {shape.name}
                  </button>
                ) : (
                  <span className="rounded-full border border-fd-border px-2.5 py-1 text-xs text-fd-muted-foreground">
                    {shape.name}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {compatible.q4Footnote && (
        <p className="mt-2 text-xs text-fd-muted-foreground">
          Note (Q4): 3-notes-per-string shapes carry traditional modal names
          in the registry that this Tonal-derived compatibility check does
          not corroborate — it is not an assertion that the names match.
        </p>
      )}
    </Section>
  );
}
