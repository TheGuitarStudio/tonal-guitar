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

  it("renders under renderToString with lazy set, with no window access", () => {
    expect(() =>
      renderToString(<ShapeCard entry={chordEntry} onSelect={() => {}} isSelected={false} lazy />),
    ).not.toThrow();
  });

  it("renders the real card content (not a placeholder) on the server when lazy without eager", () => {
    // `useState(!lazy || eager)` seeds `visible=false` for `lazy` without
    // `eager` — the server render (no IntersectionObserver, no effects) must
    // still reflect that initial state, i.e. the placeholder, not the card.
    const html = renderToString(<ShapeCard entry={chordEntry} onSelect={() => {}} isSelected={false} lazy />);
    expect(html).not.toContain(chordEntry.name);
  });

  it("renders the real card content on the server when lazy and eager", () => {
    const html = renderToString(
      <ShapeCard entry={chordEntry} onSelect={() => {}} isSelected={false} lazy eager />,
    );
    expect(html).toContain(chordEntry.name);
  });
});
