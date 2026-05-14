"use client";

interface SequenceStepProps {
  motifName: string;
  motifNames: string[];
  customMotif: string;
  walkFullShape: boolean;
  direction: "ascending" | "descending";
  onMotifChange: (name: string) => void;
  onCustomChange: (value: string) => void;
  onWalkFullShapeChange: (value: boolean) => void;
  onDirectionChange: (d: "ascending" | "descending") => void;
}

export function SequenceStep({
  motifName,
  motifNames,
  customMotif,
  walkFullShape,
  direction,
  onMotifChange,
  onCustomChange,
  onWalkFullShapeChange,
  onDirectionChange,
}: SequenceStepProps) {
  const isCustom = motifName === "Custom";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={motifName}
          onChange={(e) => onMotifChange(e.target.value)}
          className="rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm"
        >
          {motifNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <div className="inline-flex rounded-md border border-fd-border text-xs">
          {(["ascending", "descending"] as const).map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => onDirectionChange(d)}
              className={`${i === 0 ? "rounded-l-md" : "rounded-r-md"} px-3 py-1 transition-colors ${
                direction === d
                  ? "bg-fd-primary text-fd-primary-foreground"
                  : "hover:bg-fd-muted"
              }`}
            >
              {d === "ascending" ? "↑ Ascending" : "↓ Descending"}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={walkFullShape}
            onChange={(e) => onWalkFullShapeChange(e.target.checked)}
            className="accent-fd-primary"
          />
          Walk full shape
        </label>
      </div>

      {isCustom && (
        <div>
          <label className="mb-1 block text-xs text-fd-muted-foreground">
            Comma-separated motif (e.g. <code>1,3</code> for thirds,{" "}
            <code>1,3,5</code> for triads, <code>1,2,3,5</code> for the “1235” run)
          </label>
          <input
            type="text"
            value={customMotif}
            onChange={(e) => onCustomChange(e.target.value)}
            className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm"
            placeholder="1,3,5"
          />
        </div>
      )}

      <p className="text-xs text-fd-muted-foreground">
        {walkFullShape
          ? "Applies the motif at every position in the shape, in pitch order, ending on the highest note. Uses walkShapeMotif."
          : "Plays the motif once, at the lowest occurrence of degree 1 in the scale. Uses walkPattern."}
      </p>
    </div>
  );
}
