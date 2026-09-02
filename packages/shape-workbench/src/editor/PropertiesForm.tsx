/**
 * Properties form (spec §5.4: "Properties panel exposes every field in
 * §1.2 plus `featured`, and shows the derived `movable` reason") plus the
 * `DraftShape`-level fields a `"gap"`-origin draft needs before it can be
 * saved/previewed at all (`file`/`ident`, spec §6.1 `AddChange`).
 *
 * Purely a controlled form: every field change calls `onShapeChange` with a
 * `Partial<ChordShape>` patch (merged by the caller) or, for the two
 * draft-level fields, `onFileChange`/`onIdentChange` directly.
 */
import type { ChangeEvent } from "react";
import type { CagedPosition, ChordShape, VoicingFamily } from "tonal-guitar";
import type { DraftShape } from "shape-catalog";
import { movableReason } from "./deriveShape";

export interface PropertiesFormProps {
  draft: DraftShape;
  shape: ChordShape;
  onShapeChange: (patch: Partial<ChordShape>) => void;
  onFileChange: (file: string) => void;
  onIdentChange: (ident: string) => void;
}

const CAGED_POSITIONS: CagedPosition[] = ["C", "A", "G", "E", "D"];
const VOICING_FAMILIES: VoicingFamily[] = [
  "caged",
  "extended",
  "triad",
  "shell",
  "open",
  "barre",
  "drop2",
  "drop3",
  "drop2+4",
  "sweep",
];

function parseTags(raw: string): string[] | undefined {
  const tags = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return tags.length === 0 ? undefined : tags;
}

function parseStringSet(raw: string): number[] | undefined {
  if (raw.trim().length === 0) return undefined;
  const values = raw
    .split(",")
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((v) => !Number.isNaN(v));
  return values.length === 0 ? undefined : values;
}

function parseOptionalInt(raw: string): number | undefined {
  if (raw.trim().length === 0) return undefined;
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isNaN(value) ? undefined : value;
}

function parseOptionalString(raw: string): string | undefined {
  return raw.trim().length === 0 ? undefined : raw;
}

export function PropertiesForm({ draft, shape, onShapeChange, onFileChange, onIdentChange }: PropertiesFormProps) {
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
      {textField("Chord type", shape.chordType, (v) => onShapeChange({ chordType: parseOptionalString(v) }), "field-chordType")}

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
          {CAGED_POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="tg-facet-row">
        <span className="tg-facet-label">Voicing family</span>
        <select
          className="tg-select"
          data-testid="field-voicingFamily"
          value={shape.voicingFamily ?? ""}
          onChange={(e) =>
            onShapeChange({ voicingFamily: (e.target.value || undefined) as VoicingFamily | undefined })
          }
        >
          <option value="">(none)</option>
          {VOICING_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      {textField(
        "Inversion",
        shape.inversion === undefined ? "" : String(shape.inversion),
        (v) => onShapeChange({ inversion: parseOptionalInt(v) }),
        "field-inversion",
      )}
      {textField(
        "String set",
        shape.stringSet?.join(", "),
        (v) => onShapeChange({ stringSet: parseStringSet(v) }),
        "field-stringSet",
      )}
      {textField("Canonical root", shape.canonicalRoot, (v) => onShapeChange({ canonicalRoot: parseOptionalString(v) }), "field-canonicalRoot")}
      {textField(
        "Base fret",
        shape.baseFret === undefined ? "" : String(shape.baseFret),
        (v) => onShapeChange({ baseFret: parseOptionalInt(v) }),
        "field-baseFret",
      )}

      <label className="tg-facet-row">
        <span className="tg-facet-label">Movable</span>
        <select
          className="tg-select"
          data-testid="field-movable"
          value={shape.movable === undefined ? "default" : String(shape.movable)}
          onChange={(e) => {
            const v = e.target.value;
            onShapeChange({ movable: v === "default" ? undefined : v === "true" });
          }}
        >
          <option value="default">(default)</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <span className="tg-muted" data-testid="movable-reason">
          {movableReason(shape)}
        </span>
      </label>

      {textField("Parent shape", shape.parentShape, (v) => onShapeChange({ parentShape: parseOptionalString(v) }), "field-parentShape")}
      {textField("Tags (comma-separated)", shape.tags?.join(", "), (v) => onShapeChange({ tags: parseTags(v) }), "field-tags")}
      {textField("Overrides", shape.overrides, (v) => onShapeChange({ overrides: parseOptionalString(v) }), "field-overrides")}

      <label className="tg-facet-row">
        <span className="tg-facet-label">Notes</span>
        <textarea
          className="tg-input"
          data-testid="field-notes"
          value={shape.notes ?? ""}
          onChange={(e) => onShapeChange({ notes: parseOptionalString(e.target.value) })}
        />
      </label>

      <label className="tg-checkbox-label">
        <input
          type="checkbox"
          data-testid="field-featured"
          checked={shape.featured ?? false}
          onChange={(e) => onShapeChange({ featured: e.target.checked || undefined })}
        />
        Featured
      </label>

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
