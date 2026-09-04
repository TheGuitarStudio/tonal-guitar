import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { DiagramOrientationToggle } from "./DiagramOrientationToggle";

describe("DiagramOrientationToggle", () => {
  it("renders under renderToString with no window access", () => {
    expect(() => renderToString(<DiagramOrientationToggle value="horizontal" onChange={() => {}} />)).not.toThrow();
  });

  it("never emits data-tg-edit (read-only, capability-independent)", () => {
    const html = renderToString(<DiagramOrientationToggle value="vertical" onChange={() => {}} />);
    expect(html).not.toContain("data-tg-edit");
  });

  it("marks exactly the active orientation's button via aria-pressed", () => {
    const html = renderToString(<DiagramOrientationToggle value="vertical" onChange={() => {}} />);
    expect(html).toContain('aria-pressed="true">Vertical</button>');
    expect(html).toContain('aria-pressed="false">Horizontal</button>');
  });
});
