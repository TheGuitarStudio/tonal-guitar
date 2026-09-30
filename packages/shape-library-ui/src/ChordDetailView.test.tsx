import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { buildChordDetail, buildEntryNameMap } from "shape-catalog";
import { ChordDetailView } from "./ChordDetailView";
import { chordEntryWithSiblings, catalog } from "./testFixtures";

function chordDetail() {
  return buildChordDetail(chordEntryWithSiblings);
}

function chordCatalogByName() {
  return buildEntryNameMap(catalog, "chord");
}

describe("ChordDetailView", () => {
  it("renders under renderToString with no window access", () => {
    const detail = chordDetail();
    expect(() =>
      renderToString(<ChordDetailView detail={detail} chordCatalogByName={chordCatalogByName()} onSelectEntry={() => {}} />),
    ).not.toThrow();
  });

  it("never emits data-tg-edit (read-only, capability-independent)", () => {
    const detail = chordDetail();
    const html = renderToString(<ChordDetailView detail={detail} chordCatalogByName={chordCatalogByName()} onSelectEntry={() => {}} />);
    expect(html).not.toContain("data-tg-edit");
  });
});
