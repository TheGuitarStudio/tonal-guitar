import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ToggleGroup } from "./ToggleGroup";

const OPTIONS = [
  { value: "grid", label: "Grid" },
  { value: "board", label: "Board", disabled: true, title: "Board view is chord-only" },
] as const;

describe("ToggleGroup", () => {
  const html = renderToString(<ToggleGroup options={OPTIONS} value="grid" onChange={() => {}} label="Library view" />);

  it("renders a labelled role=group", () => {
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Library view"');
  });

  it("marks exactly the active option via aria-pressed", () => {
    expect(html).toContain('aria-pressed="true">Grid</button>');
    expect(html).toMatch(/aria-pressed="false"[^>]*>Board<\/button>/);
  });

  it("forwards per-option disabled and title", () => {
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="Board view is chord-only"[^>]*>Board</);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Grid</);
  });

  it("never emits data-tg-edit (read-only, capability-independent)", () => {
    expect(html).not.toContain("data-tg-edit");
  });
});
