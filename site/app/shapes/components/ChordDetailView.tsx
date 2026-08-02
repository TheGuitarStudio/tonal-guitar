"use client";

// ============================================================
// Chord-entry content (spec §Site "Chord entries")
// ============================================================
//
// Split out of `ShapeDetailPanel.tsx` (CR-021) — the root panel, the shared
// presentational primitives, and `buildDetail` (which produces the
// `ChordDetail` this view renders) all live there.
import type {
  ChordShape,
  ContainingScale,
  ScalesContainingChordResult,
} from "tonal-guitar";
import {
  chordDisplaySymbol,
  type ChordCatalogEntry,
  type ShapeCatalogEntry,
} from "./shapeLibraryUtils";
import type { InversionGroupsResult } from "./shapeDetailUtils";
import { CompactFretboard } from "./CompactFretboard";
import { ShapeCardDiagram } from "./ShapeCardDiagram";
import { ShapeCardChordTable } from "./ShapeCardChordTable";
import { FeaturedMark, IssueBadges } from "./IssueBadges";
import {
  ReportProblemLink,
  Section,
  SiblingStepper,
  siblingIndexAt,
  type ChordDetail,
} from "./ShapeDetailPanel";

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
    return targetIndex === undefined
      ? undefined
      : chordCatalogByName.get(siblings[targetIndex].name);
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
