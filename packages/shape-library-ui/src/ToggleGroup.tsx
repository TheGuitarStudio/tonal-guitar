"use client";

/**
 * Segmented single-choice control shared by every `tg-toggle-group` in the
 * library (FilterBar's kind toggle, `ColumnsToggle`, `DiagramOrientationToggle`)
 * and its consumers (the site's Grid/Board toggle). A `role="group"` of
 * `aria-pressed` buttons — not a `tablist`, since none of these own a
 * tabpanel. Read-only, capability-independent: never emits `data-tg-edit`.
 */

export interface ToggleGroupOption<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
  title?: string;
}

export interface ToggleGroupProps<V extends string> {
  options: readonly ToggleGroupOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Accessible name for the group (`aria-label`). */
  label: string;
  className?: string;
}

export function ToggleGroup<V extends string>({ options, value, onChange, label, className }: ToggleGroupProps<V>) {
  return (
    <div className={["tg-toggle-group", className].filter(Boolean).join(" ")} role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          disabled={opt.disabled}
          title={opt.title}
          onClick={() => {
            if (!opt.disabled) onChange(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
