"use client";

interface PatternStepProps {
  patternType: string;
  patternTypes: string[];
  customPattern: string;
  onTypeChange: (type: string) => void;
  onCustomChange: (value: string) => void;
}

export function PatternStep({
  patternType,
  patternTypes,
  customPattern,
  onTypeChange,
  onCustomChange,
}: PatternStepProps) {
  return (
    <div className="space-y-3">
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

      {patternType === "Custom Degrees" && (
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
    </div>
  );
}
