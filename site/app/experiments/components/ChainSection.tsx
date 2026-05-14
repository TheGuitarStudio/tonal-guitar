"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { FrettedNote } from "tonal-guitar";
import { toAlphaTeX } from "tonal-guitar";

const AlphaTabPlayer = dynamic(
  () => import("./AlphaTabPlayer").then((m) => m.AlphaTabPlayer),
  { ssr: false, loading: () => <p className="text-xs">Loading player…</p> },
);

export interface ChainEntry {
  /** Human-readable label, e.g. "A maj G shape — Thirds ↑". */
  label: string;
  /** Snapshot of the pipeline's notes at the time the entry was added. */
  notes: FrettedNote[];
}

interface ChainSectionProps {
  entries: ChainEntry[];
  tuning: string[];
  tempo: number;
  duration: 4 | 8 | 16;
  /** Title to embed in the AlphaTeX header (any string). */
  chainTitle?: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onClear: () => void;
  /** Disabled when there's nothing to add (no current outputNotes). */
  canAdd: boolean;
}

export function ChainSection({
  entries,
  tuning,
  tempo,
  duration,
  chainTitle = "Chained Sequence",
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  onClear,
  canAdd,
}: ChainSectionProps) {
  const [copied, setCopied] = useState(false);

  const combinedNotes: FrettedNote[] = entries.flatMap((e) => e.notes);
  const combinedAlphaTex = combinedNotes.length
    ? toAlphaTeX(combinedNotes, {
        title: chainTitle,
        tempo,
        duration,
        tuning,
        key: "C",
      })
    : "";

  function copy() {
    if (!combinedAlphaTex) return;
    navigator.clipboard.writeText(combinedAlphaTex).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

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
          {combinedNotes.length} total notes
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">
          Nothing chained yet. Configure a sequence above and click “Add
          current to chain” to queue it. Add as many as you want, then play
          them back-to-back as one piece below.
        </p>
      ) : (
        <ol className="space-y-1">
          {entries.map((e, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md border border-fd-border bg-fd-card px-3 py-1.5 text-sm"
            >
              <span className="w-6 text-xs text-fd-muted-foreground">
                {i + 1}.
              </span>
              <span className="flex-1">{e.label}</span>
              <span className="text-xs text-fd-muted-foreground">
                {e.notes.length} notes
              </span>
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
            </li>
          ))}
        </ol>
      )}

      {entries.length > 0 && combinedAlphaTex && (
        <>
          <AlphaTabPlayer alphaTex={combinedAlphaTex} />
          <div className="relative">
            <pre className="max-h-64 overflow-auto rounded-md border border-fd-border bg-fd-background p-3 text-xs leading-relaxed">
              {combinedAlphaTex}
            </pre>
            <button
              type="button"
              onClick={copy}
              className="absolute right-2 top-2 rounded border border-fd-border bg-fd-background px-2 py-1 text-xs hover:bg-fd-accent"
            >
              {copied ? "Copied" : "Copy AlphaTeX"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
