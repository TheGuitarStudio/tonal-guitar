import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { ShapeAuditIssue } from "tonal-guitar";
import { FeaturedMark, IssueBadges } from "./IssueBadges";

const issues: ShapeAuditIssue[] = [
  { id: "warn-check", severity: "warning", message: "a warning" },
  { id: "err-check", severity: "error", message: "an error" },
];

describe("IssueBadges", () => {
  it("renders under renderToString with no window access", () => {
    expect(() => renderToString(<IssueBadges issues={issues} />)).not.toThrow();
    expect(() => renderToString(<FeaturedMark />)).not.toThrow();
  });

  it("never emits data-tg-edit (read-only, capability-independent)", () => {
    const html = renderToString(<IssueBadges issues={issues} />);
    expect(html).not.toContain("data-tg-edit");
  });

  it("renders nothing for an empty issue list", () => {
    expect(renderToString(<IssueBadges issues={[]} />)).toBe("");
  });

  it("sorts errors before warnings", () => {
    const html = renderToString(<IssueBadges issues={issues} />);
    expect(html.indexOf("err-check")).toBeLessThan(html.indexOf("warn-check"));
  });
});
