/**
 * Ported from `site/app/shapes/components/ChordDetailView.tsx`. The root
 * panel (`ShapeDetailPanel.tsx`, including `buildDetail`, which produces
 * the `ChordDetail` this view renders) is a sibling module, not an
 * ancestor: the shared presentational primitives and the `ChordDetail`
 * type live in `./detailPrimitives`/`./detailTypes` so this view doesn't
 * import back from the panel (CR-035 — keeps the import graph a DAG).
 *
 * The site's `CompactFretboard.tsx` (alternate-fingering thumbnails with a
 * hover/focus enlarged preview) isn't part of this package's public
 * component list (spec §5.3) — its behavior is folded in here as an
 * unexported `AlternateFingeringThumbnail`, built on `ShapeDiagram`'s
 * shared helpers rather than duplicating them. Read-only: never emits
 * `data-tg-edit`.
 */
import { useState } from "react";
import type { ChordShape, ContainingScale, ScalesContainingChordResult } from "tonal-guitar";
import { chordDisplaySymbol, type ChordCatalogEntry, type InversionGroupsResult, type ShapeCatalogEntry } from "shape-catalog";
import { Fretboard } from "fretboard-ui";
import { buildFretMarkers, fretRangeFor, fretSummary, MONOCHROME_THEME } from "./ShapeDiagram";
import { ShapeCardDiagram } from "./ShapeCardDiagram";
import { ShapeCardChordTable } from "./ShapeCardChordTable";
import { FeaturedMark, IssueBadges } from "./IssueBadges";
import { ReportProblemLink, Section, SiblingStepper, siblingIndexAt } from "./detailPrimitives";
import type { ChordDetail } from "./detailTypes";

export function ChordDetailView({
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
    const targetIndex = siblingIndexAt(stepper, offset, siblings.length);
    return targetIndex === undefined ? undefined : chordCatalogByName.get(siblings[targetIndex].name);
  }

  const prevEntry = siblingAt(-1);
  const nextEntry = siblingAt(1);

  return (
    <div>
      <div className="tg-detail-header">
        <div className="tg-card-header">
          <h2 className="tg-detail-title">{chordDisplaySymbol(entry)}</h2>
          {entry.shape.featured && <FeaturedMark />}
          {entry.shape.voicingFamily && <span className="tg-tag">{entry.shape.voicingFamily}</span>}
        </div>
        <p className="tg-muted tg-detail-subtitle">
          {entry.shape.baseFret !== undefined ? `Base fret ${entry.shape.baseFret}` : "No base fret"} · Root {entry.renderRoot}
        </p>
        <div className="tg-detail-issues">
          <IssueBadges issues={entry.issues} />
        </div>
        <div className="tg-detail-stepper">
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

      <ReportProblemLink entry={entry} />
    </div>
  );
}

function IdentifiedChordSection({ identified }: { identified: string[] }) {
  return (
    <Section title="Identified chord">
      {identified.length === 0 ? (
        <p className="tg-muted">Could not identify these notes.</p>
      ) : (
        <p>
          <strong>{identified[0]}</strong>
          {identified.length > 1 && <span className="tg-muted"> — also: {identified.slice(1).join(", ")}</span>}
        </p>
      )}
    </Section>
  );
}

function containmentCaption(scale: ContainingScale): string {
  const fit = scale.extraTones === 0 ? "exact fit" : `${scale.extraTones} extra tone${scale.extraTones === 1 ? "" : "s"}`;
  if (scale.omittedTones.length > 0) {
    return `${fit}; missing ${scale.omittedTones.join(", ")}`;
  }
  return `contains every chord tone (${fit})`;
}

function ContainingScaleList({ scales, emptyLabel }: { scales: ContainingScale[]; emptyLabel: string }) {
  if (scales.length === 0) {
    return emptyLabel ? <p className="tg-muted">{emptyLabel}</p> : null;
  }
  return (
    <ul className="tg-scale-list">
      {scales.map((scale) => (
        <li key={`${scale.name}-${scale.scaleType}`}>
          <span className="tg-card-title">{scale.name}</span>{" "}
          <span className="tg-muted">{containmentCaption(scale)}</span>
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
        <p className="tg-muted">No scales in the library's corpus fully contain this chord's tones.</p>
      ) : (
        <>
          <ContainingScaleList scales={scales.rootAnchored} emptyLabel="No root-anchored scales found." />
          {scales.otherRoots.length > 0 && (
            <details className="tg-detail-disclosure">
              <summary className="tg-muted">Other parent scales (any root) — {scales.otherRoots.length}</summary>
              <div>
                <ContainingScaleList scales={scales.otherRoots} emptyLabel="" />
              </div>
            </details>
          )}
        </>
      )}
    </Section>
  );
}

const THUMBNAIL_LAYOUT = { cellWidth: 16, cellHeight: 12, markerRadius: 4, showFretNumbers: false, showStringLabels: false };
const ENLARGED_LAYOUT = { orientation: "horizontal" as const };

/**
 * Thumbnail-scale adapter over `<Fretboard>` for the alternate-fingerings
 * strip — parallel to `ShapeDiagram` (the grid/detail-scale adapter) rather
 * than a new `fretboard-ui` component. Ported from the site's
 * `CompactFretboard.tsx`.
 */
function AlternateFingeringThumbnail({
  entry,
  onSelect,
  selected,
}: {
  entry: ChordCatalogEntry;
  onSelect: () => void;
  selected: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const enlarged = hovered || focused;
  const { frettedScale, renderRoot, name } = entry;

  if (frettedScale.notes.length === 0) {
    return <div className="tg-diagram-empty">No diagram</div>;
  }

  const markers = buildFretMarkers(entry);
  const fretRange = fretRangeFor(entry);
  const label = `${name} at ${renderRoot}, frets low to high: ${fretSummary(entry)}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={selected ? `${label} (selected)` : label}
      aria-pressed={selected}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={["tg-thumbnail", selected ? "tg-thumbnail-selected" : ""].filter(Boolean).join(" ")}
    >
      <div aria-hidden="true">
        <Fretboard tuning={frettedScale.tuning} markers={markers} fretRange={fretRange} labelMode="none" layout={THUMBNAIL_LAYOUT} theme={MONOCHROME_THEME} />
      </div>
      <span className="tg-thumbnail-label">{name}</span>

      {enlarged && (
        <div aria-hidden="true" className="tg-thumbnail-enlarged">
          <Fretboard
            tuning={frettedScale.tuning}
            markers={markers}
            fretRange={fretRange}
            labelMode="intervals"
            layout={ENLARGED_LAYOUT}
            theme={MONOCHROME_THEME}
            className="tg-mono"
          />
          <p className="tg-muted tg-thumbnail-enlarged-label">{name}</p>
        </div>
      )}
    </button>
  );
}

function AlternateFingeringsSection({
  alternates,
  chordCatalogByName,
  currentName,
  onSelectEntry,
}: {
  alternates: ChordShape[];
  chordCatalogByName: Map<string, ChordCatalogEntry>;
  currentName: string;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
}) {
  return (
    <Section title="Alternate fingerings">
      {alternates.length === 0 ? (
        <p className="tg-muted">No other registered fingerings for this chord type.</p>
      ) : (
        <div className="tg-thumbnail-row">
          {alternates.map((shape) => {
            const altEntry = chordCatalogByName.get(shape.name);
            if (!altEntry) return null;
            return (
              <AlternateFingeringThumbnail
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
    <span className="tg-link-list">
      {shapes.map((shape) => {
        const isCurrent = shape.name === currentName;
        const siblingEntry = chordCatalogByName.get(shape.name);
        if (isCurrent || !siblingEntry) {
          return (
            <span key={shape.name} className={isCurrent ? "tg-card-title" : "tg-muted"}>
              {shape.name}
              {isCurrent ? " (current)" : ""}
            </span>
          );
        }
        return (
          <button key={shape.name} type="button" onClick={() => onSelectEntry(siblingEntry)} className="tg-link">
            {shape.name}
          </button>
        );
      })}
    </span>
  );
}

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
        <p className="tg-muted">This shape has no chord-type/inversion metadata, so siblings are grouped by voicing family instead.</p>
        <ul className="tg-scale-list">
          {inversions.groups.map((group) => (
            <li key={group.key}>
              <span className="tg-card-title">{group.label}</span>:{" "}
              <ShapeLinkList shapes={group.shapes} chordCatalogByName={chordCatalogByName} currentName={currentName} onSelectEntry={onSelectEntry} />
            </li>
          ))}
        </ul>
      </Section>
    );
  }

  const unknownGroup = inversions.groups.find((g) => g.key === "unknown");

  return (
    <Section title="Inversions">
      <ul className="tg-scale-list">
        {[0, 1, 2, 3].map((n) => {
          const group = inversions.groups.find((g) => g.key === String(n));
          return (
            <li key={n}>
              <span className="tg-card-title">{inversionLabelFor(n)}</span>:{" "}
              {group ? (
                <ShapeLinkList shapes={group.shapes} chordCatalogByName={chordCatalogByName} currentName={currentName} onSelectEntry={onSelectEntry} />
              ) : (
                <span className="tg-muted">Not registered</span>
              )}
            </li>
          );
        })}
      </ul>
      {unknownGroup && (
        <p className="tg-muted tg-detail-footnote">
          {unknownGroup.shapes.length} sibling shape(s) have no inversion tagged:{" "}
          <ShapeLinkList shapes={unknownGroup.shapes} chordCatalogByName={chordCatalogByName} currentName={currentName} onSelectEntry={onSelectEntry} />
        </p>
      )}
    </Section>
  );
}
