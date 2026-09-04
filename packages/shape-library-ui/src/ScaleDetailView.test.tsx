import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { scaleSiblings, siblingScaleStepper, relatedScalesForEntry, compatibleShapesForEntry } from "shape-catalog";
import { ScaleDetailView } from "./ScaleDetailView";
import { scaleEntry, catalog } from "./testFixtures";

function buildScaleDetail() {
  const entry = scaleEntry;
  const siblings = scaleSiblings(entry, catalog);
  return {
    kind: "scale" as const,
    entry,
    siblings,
    stepper: siblingScaleStepper(entry, siblings),
    related: relatedScalesForEntry(entry),
    compatible: compatibleShapesForEntry(entry),
  };
}

function scaleCatalogByName() {
  const map = new Map<string, (typeof catalog)[number] & { kind: "scale" }>();
  for (const e of catalog) if (e.kind === "scale") map.set(e.name, e as never);
  return map;
}

describe("ScaleDetailView", () => {
  it("renders under renderToString with no window access", () => {
    const detail = buildScaleDetail();
    expect(() =>
      renderToString(<ScaleDetailView detail={detail} scaleCatalogByName={scaleCatalogByName()} onSelectEntry={() => {}} />),
    ).not.toThrow();
  });

  it("never emits data-tg-edit (read-only, capability-independent)", () => {
    const detail = buildScaleDetail();
    const html = renderToString(<ScaleDetailView detail={detail} scaleCatalogByName={scaleCatalogByName()} onSelectEntry={() => {}} />);
    expect(html).not.toContain("data-tg-edit");
  });
});
