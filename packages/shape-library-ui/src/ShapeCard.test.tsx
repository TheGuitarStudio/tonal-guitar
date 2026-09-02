import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ShapeCard } from "./ShapeCard";
import { ShapeLibraryProvider } from "./capabilities";
import { chordEntry } from "./testFixtures";

describe("ShapeCard", () => {
  it("renders under renderToString with no window access", () => {
    expect(() => renderToString(<ShapeCard entry={chordEntry} onSelect={() => {}} isSelected={false} />)).not.toThrow();
  });

  it("emits zero data-tg-edit elements without a provider", () => {
    const html = renderToString(<ShapeCard entry={chordEntry} onSelect={() => {}} isSelected={false} />);
    expect(html).not.toContain("data-tg-edit");
  });

  it("emits zero data-tg-edit elements when capabilities.edit is undefined", () => {
    const html = renderToString(
      <ShapeLibraryProvider capabilities={{}}>
        <ShapeCard entry={chordEntry} onSelect={() => {}} isSelected={false} />
      </ShapeLibraryProvider>,
    );
    expect(html).not.toContain("data-tg-edit");
  });

  it("renders an Edit affordance carrying data-tg-edit when onEditShape is injected", () => {
    const html = renderToString(
      <ShapeLibraryProvider capabilities={{ edit: { onEditShape: () => {} } }}>
        <ShapeCard entry={chordEntry} onSelect={() => {}} isSelected={false} />
      </ShapeLibraryProvider>,
    );
    expect(html).toContain("data-tg-edit");
    expect(html).toContain(`Edit ${chordEntry.name}`);
  });

  it("shows the card as selected via aria-pressed/aria-current", () => {
    const html = renderToString(<ShapeCard entry={chordEntry} onSelect={() => {}} isSelected={true} />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-current="true"');
  });
});
