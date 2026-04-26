"use client";

import type { FrettedScale } from "tonal-guitar";

interface BuildResultProps {
  scale: FrettedScale;
}

export function BuildResult({ scale }: BuildResultProps) {
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-fd-muted-foreground">
        Notes
      </p>
      <div className="max-h-48 overflow-auto rounded border border-fd-border bg-fd-background p-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-fd-muted-foreground">
              <th className="px-2 py-1 text-left">Str</th>
              <th className="px-2 py-1 text-left">Fret</th>
              <th className="px-2 py-1 text-left">Note</th>
              <th className="px-2 py-1 text-left">Interval</th>
              <th className="px-2 py-1 text-left">Degree</th>
              <th className="px-2 py-1 text-left">MIDI</th>
            </tr>
          </thead>
          <tbody>
            {scale.notes.map((n, i) => (
              <tr key={i} className="border-t border-fd-border/50">
                <td className="px-2 py-0.5">{n.string}</td>
                <td className="px-2 py-0.5">{n.fret}</td>
                <td className="px-2 py-0.5 font-medium">{n.note}</td>
                <td className="px-2 py-0.5">{n.interval}</td>
                <td className="px-2 py-0.5">{n.degree}</td>
                <td className="px-2 py-0.5">{n.midi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
