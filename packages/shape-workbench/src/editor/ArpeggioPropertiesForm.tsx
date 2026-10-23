/**
 * Properties form for arpeggio drafts — the `ArpeggioShape` counterpart of
 * `PropertiesForm` (same field testids and `file`/`ident` handling for
 * `"gap"`-origin drafts). Purely controlled: every field change calls
 * `onShapeChange` with a `Partial<ArpeggioShape>` patch.
 */
import type { ChangeEvent } from "react";
import type { ArpeggioShape, CagedPosition } from "tonal-guitar";
import { CAGED_ORDER, type DraftShape } from "shape-catalog";

/** Default target data file for a new arpeggio (`src/data/caged-arpeggios.ts`). */
export const DEFAULT_ARPEGGIO_FILE = "caged-arpeggios";

export interface ArpeggioPropertiesFormProps {
  draft: DraftShape;
  shape: ArpeggioShape;
  onShapeChange: (patch: Partial<ArpeggioShape>) => void;
  onFileChange: (file: string) => void;
  onIdentChange: (ident: string) => void;
}

function parseTags(raw: string): string[] | undefined {
  const tags = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return tags.length === 0 ? undefined : tags;
}

function parseOptionalString(raw: string): string | undefined {
  return raw.trim().length === 0 ? undefined : raw;
}

export function ArpeggioPropertiesForm({
  draft,
  shape,
  onShapeChange,
  onFileChange,
  onIdentChange,
}: ArpeggioPropertiesFormProps) {
  function textField(
    label: string,
    value: string | undefined,
    onChange: (raw: string) => void,
    testId: string,
  ) {
    return (
      <label className="tg-facet-row">
        <span className="tg-facet-label">{label}</span>
        <input
          className="tg-input"
          type="text"
          data-testid={testId}
          value={value ?? ""}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      </label>
    );
  }

  return (
    <div className="tg-section" data-testid="properties-form">
      <h3 className="tg-section-title">Properties</h3>

      {textField("Name", shape.name, (v) => onShapeChange({ name: v }), "field-name")}
      {/* `chordType` is required on an arpeggio, so it is never cleared to undefined. */}
      {textField("Chord type", shape.chordType, (v) => onShapeChange({ chordType: v }), "field-chordType")}

      <label className="tg-facet-row">
        <span className="tg-facet-label">CAGED position</span>
        <select
          className="tg-select"
          data-testid="field-cagedPosition"
          value={shape.cagedPosition ?? ""}
          onChange={(e) =>
            onShapeChange({ cagedPosition: (e.target.value || undefined) as CagedPosition | undefined })
          }
        >
          <option value="">(none)</option>
          {CAGED_ORDER.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      {textField("Parent shape", shape.parentShape, (v) => onShapeChange({ parentShape: parseOptionalString(v) }), "field-parentShape")}
      {textField("Chord shape", shape.chordShape, (v) => onShapeChange({ chordShape: parseOptionalString(v) }), "field-chordShape")}
      {textField("Tags (comma-separated)", shape.tags?.join(", "), (v) => onShapeChange({ tags: parseTags(v) }), "field-tags")}

      <label className="tg-facet-row">
        <span className="tg-facet-label">Tuning</span>
        <span className="tg-muted" data-testid="field-tuning-locked">
          STANDARD (locked in MVP)
        </span>
      </label>

      {draft.origin === "gap" && (
        <>
          {textField("Target file", draft.file, onFileChange, "field-file")}
          {textField("Export identifier (optional)", draft.ident, onIdentChange, "field-ident")}
        </>
      )}
    </div>
  );
}
