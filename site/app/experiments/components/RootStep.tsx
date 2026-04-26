"use client";

interface RootStepProps {
  root: string;
  roots: string[];
  onChange: (root: string) => void;
}

export function RootStep({ root, roots, onChange }: RootStepProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {roots.map((r) => (
        <button
          key={r}
          type="button"
          className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
            r === root
              ? "border-fd-primary bg-fd-primary text-fd-primary-foreground"
              : "border-fd-border hover:border-fd-primary/50"
          }`}
          onClick={() => onChange(r)}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
