"use client";

import type { FrettedNote } from "tonal-guitar";

export interface ChainEntry {
  /** Human-readable label, e.g. "A maj E shape — Thirds ↑". */
  label: string;
  /** Snapshot of the pipeline's notes at the time the entry was added. */
  notes: FrettedNote[];
  /**
   * Optional connector phrase to play before this entry — used to bridge
   * the previous entry's last note into this entry's first. Empty until
   * the connector algorithm lands; the UI shows a placeholder slot.
   */
  connector?: FrettedNote[];
}

type Selection =
  | { kind: "current" }
  | { kind: "chainEntry"; index: number }
  | { kind: "chain" };

interface ChainSectionProps {
  entries: ChainEntry[];
  selection: Selection;
  /** Disabled when there's nothing to add (no current outputNotes). */
  canAdd: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onClear: () => void;
  onSelectCurrent: () => void;
  onSelectChain: () => void;
  onSelectEntry: (index: number) => void;
}

export function ChainSection({
  entries,
  selection,
  canAdd,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  onClear,
  onSelectCurrent,
  onSelectChain,
  onSelectEntry,
}: ChainSectionProps) {
  const totalNotes = entries.reduce((sum, e) => sum + e.notes.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="rounded-md border border-fd-primary bg-fd-primary px-3 py-1 text-xs text-fd-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          + Add current to chain
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={entries.length === 0}
          className="rounded-md border border-fd-border px-3 py-1 text-xs transition-colors hover:bg-fd-muted disabled:opacity-50"
        >
          Clear chain
        </button>
        <span className="text-xs text-fd-muted-foreground">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"} ·{" "}
          {totalNotes} total notes
        </span>
      </div>

      <SelectableRow
        label="Current (unsaved)"
        selected={selection.kind === "current"}
        onClick={onSelectCurrent}
      />

      {entries.length > 0 && (
        <SelectableRow
          label={`Whole chain · ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
          selected={selection.kind === "chain"}
          onClick={onSelectChain}
          accent
        />
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">
          Nothing chained yet. Configure a sequence above and click “Add
          current to chain” to queue it. Add as many as you want, then click
          “Whole chain” to play them back-to-back in the Output below.
        </p>
      ) : (
        <ol className="space-y-1">
          {entries.map((e, i) => (
            <li key={i}>
              {i > 0 && <ConnectorSlot connector={e.connector} />}
              <div
                className={`group flex items-center gap-2 rounded-md border bg-fd-card px-3 py-1.5 text-sm transition-colors ${
                  selection.kind === "chainEntry" && selection.index === i
                    ? "border-fd-primary bg-fd-primary/10"
                    : "border-fd-border hover:border-fd-primary/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectEntry(i)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className="w-6 text-xs text-fd-muted-foreground">
                    {i + 1}.
                  </span>
                  <span className="flex-1">{e.label}</span>
                  <span className="text-xs text-fd-muted-foreground">
                    {e.notes.length} notes
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onMoveUp(i)}
                  disabled={i === 0}
                  className="rounded border border-fd-border px-1.5 text-xs disabled:opacity-30"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoveDown(i)}
                  disabled={i === entries.length - 1}
                  className="rounded border border-fd-border px-1.5 text-xs disabled:opacity-30"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="rounded border border-fd-border px-1.5 text-xs hover:bg-fd-muted"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

interface SelectableRowProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  accent?: boolean;
}

function SelectableRow({
  label,
  selected,
  onClick,
  accent = false,
}: SelectableRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-left text-sm transition-colors ${
        selected
          ? "border-fd-primary bg-fd-primary/10"
          : "border-fd-border hover:border-fd-primary/50"
      } ${accent ? "font-medium" : ""}`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          selected ? "bg-fd-primary" : "bg-fd-border"
        }`}
      />
      <span className="flex-1">{label}</span>
    </button>
  );
}

interface ConnectorSlotProps {
  connector?: FrettedNote[];
}

/**
 * Placeholder for the bridge phrase between two chain entries. The
 * connector algorithm (transition / passing notes) isn't built yet —
 * the slot just shows the seam.
 */
function ConnectorSlot({ connector }: ConnectorSlotProps) {
  return (
    <div className="my-1 ml-8 flex items-center gap-2 text-xs text-fd-muted-foreground">
      <span className="h-px flex-1 bg-fd-border" />
      {connector && connector.length > 0 ? (
        <span>
          connector · {connector.length} note{connector.length === 1 ? "" : "s"}
        </span>
      ) : (
        <span className="italic">no connector (TODO)</span>
      )}
      <span className="h-px flex-1 bg-fd-border" />
    </div>
  );
}
