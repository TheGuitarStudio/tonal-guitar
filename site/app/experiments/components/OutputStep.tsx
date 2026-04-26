"use client";

import { useState } from "react";

interface OutputStepProps {
  format: "ascii" | "alphatex" | "json";
  tempo: number;
  output: string;
  onFormatChange: (format: "ascii" | "alphatex" | "json") => void;
  onTempoChange: (tempo: number) => void;
}

export function OutputStep({
  format,
  tempo,
  output,
  onFormatChange,
  onTempoChange,
}: OutputStepProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-fd-border p-0.5">
          {(["ascii", "alphatex", "json"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`rounded px-3 py-1 text-sm transition-colors ${
                f === format
                  ? "bg-fd-primary text-fd-primary-foreground"
                  : "hover:bg-fd-accent"
              }`}
              onClick={() => onFormatChange(f)}
            >
              {f === "ascii" ? "ASCII Tab" : f === "alphatex" ? "AlphaTeX" : "JSON"}
            </button>
          ))}
        </div>

        {format === "alphatex" && (
          <label className="flex items-center gap-2 text-sm">
            Tempo:
            <input
              type="number"
              value={tempo}
              onChange={(e) => onTempoChange(parseInt(e.target.value, 10) || 120)}
              className="w-20 rounded-md border border-fd-border bg-fd-background px-2 py-1 text-sm"
              min={40}
              max={300}
            />
          </label>
        )}
      </div>

      {output ? (
        <div className="relative">
          <pre className="max-h-96 overflow-auto rounded-md border border-fd-border bg-fd-background p-3 text-xs leading-relaxed">
            {output}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2 top-2 rounded border border-fd-border bg-fd-background px-2 py-1 text-xs hover:bg-fd-accent"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-fd-muted-foreground">
          No output — build a scale and optionally apply a pattern or sequence above.
        </p>
      )}
    </div>
  );
}
