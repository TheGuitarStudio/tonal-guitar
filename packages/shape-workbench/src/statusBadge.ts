import type { ChangeCheckStatus } from "./export/changeInfo";

/** Badge classes for a check status — shared by the editor's Checks card
 * (`pass`/`warning`/`error` rows) and the Export change list, which adds
 * `n/a` for removals. */
export const STATUS_BADGE_CLASS: Record<ChangeCheckStatus, string> = {
  pass: "tg-badge",
  warning: "tg-badge tg-badge-warning",
  error: "tg-badge tg-badge-error",
  "n/a": "tg-badge",
};
