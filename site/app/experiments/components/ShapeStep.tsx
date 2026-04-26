"use client";

interface ShapeStepProps {
  shapeName: string;
  shapeNames: string[];
  onChange: (name: string) => void;
}

export function ShapeStep({ shapeName, shapeNames, onChange }: ShapeStepProps) {
  // Group shapes by system prefix
  const groups: Record<string, string[]> = {};
  for (const name of shapeNames) {
    const prefix = name.includes("CAGED")
      ? "CAGED"
      : name.includes("3NPS")
        ? "3NPS"
        : name.includes("Pentatonic")
          ? "Pentatonic"
          : "Other";
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(name);
  }

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-fd-muted-foreground">
            {group}
          </p>
          <div className="flex flex-wrap gap-2">
            {items.map((name) => (
              <button
                key={name}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  name === shapeName
                    ? "border-fd-primary bg-fd-primary text-fd-primary-foreground"
                    : "border-fd-border hover:border-fd-primary/50"
                }`}
                onClick={() => onChange(name)}
              >
                {name.replace("CAGED ", "").replace("3NPS ", "").replace("Pentatonic ", "")}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
