import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { buildScaleDetail, buildEntryNameMap } from "shape-catalog";
import { ScaleDetailView } from "./ScaleDetailView";
import { scaleEntry, catalog } from "./testFixtures";

function scaleDetail() {
  return buildScaleDetail(scaleEntry, catalog);
}

function scaleCatalogByName() {
  return buildEntryNameMap(catalog, "scale");
}

describe("ScaleDetailView", () => {
  it("renders under renderToString with no window access", () => {
    const detail = scaleDetail();
    expect(() =>
      renderToString(<ScaleDetailView detail={detail} scaleCatalogByName={scaleCatalogByName()} onSelectEntry={() => {}} />),
    ).not.toThrow();
  });

  it("never emits data-tg-edit (read-only, capability-independent)", () => {
    const detail = scaleDetail();
    const html = renderToString(<ScaleDetailView detail={detail} scaleCatalogByName={scaleCatalogByName()} onSelectEntry={() => {}} />);
    expect(html).not.toContain("data-tg-edit");
  });
});
