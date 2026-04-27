"use client";

interface PatternStepProps {
  patternType: string;
  patternTypes: string[];
  customPattern: string;
  walkFullShape: boolean;
  onTypeChange: (type: string) => void;
  onCustomChange: (value: string) => void;
  onWalkFullShapeChange: (value: boolean) => void;
}

export function PatternStep({
  patternType,
  patternTypes,
  customPattern,
  walkFullShape,
  onTypeChange,
  onCustomChange,
  onWalkFullShapeChange,
}: PatternStepProps) {
  const customPatternMode = patternType === "Custom Degrees";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={patternType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm"
        >
          {patternTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label
          className={`inline-flex items-center gap-1.5 text-xs ${
            customPatternMode
              ? "text-fd-muted-foreground opacity-50"
              : "text-fd-foreground"
          }`}
        >
          <input
            type="checkbox"
            checked={walkFullShape && !customPatternMode}
            disabled={customPatternMode}
            onChange={(e) => onWalkFullShapeChange(e.target.checked)}
            className="accent-fd-primary"
          />
          Walk full shape (end on highest note)
        </label>
      </div>

      {customPatternMode && (
        <div>
          <label className="mb-1 block text-xs text-fd-muted-foreground">
            Comma-separated degrees (e.g. 1,3,5,7,6,5,4,3,2,1)
          </label>
          <input
            type="text"
            value={customPattern}
            onChange={(e) => onCustomChange(e.target.value)}
            className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm"
            placeholder="1,3,5,7,6,5,4,3,2,1"
          />
        </div>
      )}

      <p className="text-xs text-fd-muted-foreground">
        {walkFullShape && !customPatternMode
          ? "Visits every position in the shape in pitch order, ending on the highest note. Uses walkShape / walkShapeIntervals."
          : "Walks one octave's worth of degrees from the scale's first occurrence. Uses walkPattern with the chosen degree pattern."}
      </p>
    </div>
  );
}
