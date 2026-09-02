import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ColumnsToggle } from "./ColumnsToggle";

describe("ColumnsToggle", () => {
  it("renders under renderToString with no window access", () => {
    expect(() => renderToString(<ColumnsToggle value="cagedPosition" onChange={() => {}} />)).not.toThrow();
  });

  it("never emits data-tg-edit (read-only, capability-independent)", () => {
    const html = renderToString(<ColumnsToggle value="stringSet" onChange={() => {}} />);
    expect(html).not.toContain("data-tg-edit");
  });

  it("marks exactly the active axis's button via aria-pressed", () => {
    const html = renderToString(<ColumnsToggle value="inversion" onChange={() => {}} />);
    expect(html).toContain('aria-pressed="true">Inversion</button>');
    expect(html).toContain('aria-pressed="false">CAGED position</button>');
  });

  it("restricts options when the options prop is passed", () => {
    const html = renderToString(<ColumnsToggle value="cagedPosition" onChange={() => {}} options={["cagedPosition", "inversion"]} />);
    expect(html).not.toContain("String set");
  });
});
