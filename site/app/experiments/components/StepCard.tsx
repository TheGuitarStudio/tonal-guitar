"use client";

import { useState, type ReactNode } from "react";

interface StepCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function StepCard({ title, subtitle, children }: StepCardProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-fd-border bg-fd-card">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold">{title}</span>
          {subtitle && (
            <span className="text-sm text-fd-muted-foreground">{subtitle}</span>
          )}
        </div>
        <span className="text-fd-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="border-t border-fd-border px-4 py-3">{children}</div>}
    </div>
  );
}
