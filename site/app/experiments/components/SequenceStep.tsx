"use client";

interface SequenceStepProps {
  seqType: string;
  seqTypes: string[];
  customSeq: string;
  incremental: boolean;
  maxPasses: number;
  onTypeChange: (type: string) => void;
  onCustomChange: (value: string) => void;
  onIncrementalChange: (value: boolean) => void;
  onMaxPassesChange: (value: number) => void;
}

export function SequenceStep({
  seqType,
  seqTypes,
  customSeq,
  incremental,
  maxPasses,
  onTypeChange,
  onCustomChange,
  onIncrementalChange,
  onMaxPassesChange,
}: SequenceStepProps) {
  return (
    <div className="space-y-3">
      <select
        value={seqType}
        onChange={(e) => onTypeChange(e.target.value)}
        className="rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm"
      >
        {seqTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {seqType !== "None" && (
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={incremental}
              onChange={(e) => onIncrementalChange(e.target.checked)}
              className="rounded"
            />
            Incremental
          </label>

          <label className="flex items-center gap-2 text-sm">
            Max passes:
            <input
              type="number"
              value={maxPasses}
              onChange={(e) => onMaxPassesChange(parseInt(e.target.value, 10) || 0)}
              className="w-16 rounded-md border border-fd-border bg-fd-background px-2 py-1 text-sm"
              min={0}
              placeholder="0=all"
            />
          </label>
        </div>
      )}

      {seqType === "Custom" && (
        <div>
          <label className="mb-1 block text-xs text-fd-muted-foreground">
            Comma-separated degrees
          </label>
          <input
            type="text"
            value={customSeq}
            onChange={(e) => onCustomChange(e.target.value)}
            className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm"
            placeholder="1,2,3,5"
          />
        </div>
      )}
    </div>
  );
}
