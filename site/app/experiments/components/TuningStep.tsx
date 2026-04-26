"use client";

interface TuningStepProps {
  tuningName: string;
  tuningNames: string[];
  onChange: (name: string) => void;
}

export function TuningStep({ tuningName, tuningNames, onChange }: TuningStepProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tuningNames.map((name) => (
        <button
          key={name}
          type="button"
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            name === tuningName
              ? "border-fd-primary bg-fd-primary text-fd-primary-foreground"
              : "border-fd-border hover:border-fd-primary/50"
          }`}
          onClick={() => onChange(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
