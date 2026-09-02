import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ShapeDetailPanel } from "./ShapeDetailPanel";
import { ShapeLibraryProvider } from "./capabilities";
import { catalog, chordEntry, chordEntryWithSiblings, scaleEntry } from "./testFixtures";

const noop = () => {};

describe("ShapeDetailPanel", () => {
  it("renders nothing (null) when entry is undefined", () => {
    const html = renderToString(
      <ShapeDetailPanel entry={undefined} catalog={catalog} onClose={noop} onSelectEntry={noop} focusOnOpenKey={0} />,
    );
    expect(html).toBe("");
  });

  it("renders a chord entry under renderToString with no window access", () => {
    expect(() =>
      renderToString(
        <ShapeDetailPanel entry={chordEntryWithSiblings} catalog={catalog} onClose={noop} onSelectEntry={noop} focusOnOpenKey={1} />,
      ),
    ).not.toThrow();
  });

  it("renders a scale entry under renderToString with no window access", () => {
    expect(() =>
      renderToString(
        <ShapeDetailPanel entry={scaleEntry} catalog={catalog} onClose={noop} onSelectEntry={noop} focusOnOpenKey={1} />,
      ),
    ).not.toThrow();
  });

  it("renders the bottom-sheet layout when renderAsBottomSheet is true, still with no window access", () => {
    expect(() =>
      renderToString(
        <ShapeDetailPanel
          entry={chordEntry}
          catalog={catalog}
          onClose={noop}
          onSelectEntry={noop}
          focusOnOpenKey={1}
          renderAsBottomSheet
        />,
      ),
    ).not.toThrow();
  });

  it("emits zero data-tg-edit elements without a provider (chord)", () => {
    const html = renderToString(
      <ShapeDetailPanel entry={chordEntryWithSiblings} catalog={catalog} onClose={noop} onSelectEntry={noop} focusOnOpenKey={1} />,
    );
    expect(html).not.toContain("data-tg-edit");
  });

  it("emits zero data-tg-edit elements without a provider (scale)", () => {
    const html = renderToString(
      <ShapeDetailPanel entry={scaleEntry} catalog={catalog} onClose={noop} onSelectEntry={noop} focusOnOpenKey={1} />,
    );
    expect(html).not.toContain("data-tg-edit");
  });

  it("emits zero data-tg-edit elements when capabilities.edit is undefined", () => {
    const html = renderToString(
      <ShapeLibraryProvider capabilities={{}}>
        <ShapeDetailPanel entry={chordEntry} catalog={catalog} onClose={noop} onSelectEntry={noop} focusOnOpenKey={1} />
      </ShapeLibraryProvider>,
    );
    expect(html).not.toContain("data-tg-edit");
  });

  it("renders Edit / Duplicate / Add-tag affordances (each carrying data-tg-edit) when injected", () => {
    const html = renderToString(
      <ShapeLibraryProvider
        capabilities={{
          edit: {
            onEditShape: () => {},
            onDuplicateToPosition: () => {},
            onAddTag: () => {},
          },
        }}
      >
        <ShapeDetailPanel entry={chordEntry} catalog={catalog} onClose={noop} onSelectEntry={noop} focusOnOpenKey={1} />
      </ShapeLibraryProvider>,
    );
    expect(html).toContain("data-tg-edit");
    expect(html).toContain("Edit shape");
    expect(html).toContain("Duplicate to");
    expect(html).toContain("Add tag");
  });

  it("renders the report-a-problem link only when reportIssueUrl is injected", () => {
    const withoutReport = renderToString(
      <ShapeDetailPanel entry={chordEntry} catalog={catalog} onClose={noop} onSelectEntry={noop} focusOnOpenKey={1} />,
    );
    expect(withoutReport).not.toContain("Report a problem");

    const withReport = renderToString(
      <ShapeLibraryProvider capabilities={{ reportIssueUrl: (entry) => `https://example.test/report/${entry.name}` }}>
        <ShapeDetailPanel entry={chordEntry} catalog={catalog} onClose={noop} onSelectEntry={noop} focusOnOpenKey={1} />
      </ShapeLibraryProvider>,
    );
    expect(withReport).toContain("Report a problem");
    expect(withReport).toContain(`https://example.test/report/${chordEntry.name}`);
  });
});
