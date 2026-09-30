import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { ScaleFacetSelection } from "shape-catalog";
import { FilterBar } from "./FilterBar";
import { catalog, stripReactComments } from "./testFixtures";

const noop = () => {};

function renderChordBar() {
  return renderToString(
    <FilterBar
      entries={catalog}
      kind="chord"
      onKindChange={noop}
      chordSelection={{}}
      onQualityGroupChange={noop}
      onActiveTypesChange={noop}
      onActiveVoicingFamiliesChange={noop}
      onRootChange={noop}
      chordSort="baseFret"
      onChordSortChange={noop}
      scaleSelection={{}}
      onActiveSystemsChange={noop}
      onActiveQualitiesChange={noop}
      nameQuery=""
      onNameQueryChange={noop}
      failingOnly={false}
      onFailingOnlyChange={noop}
      shownCount={10}
      totalCount={20}
    />,
  );
}

function renderScaleBar(scaleSelection: ScaleFacetSelection = {}) {
  return renderToString(
    <FilterBar
      entries={catalog}
      kind="scale"
      onKindChange={noop}
      chordSelection={{}}
      onQualityGroupChange={noop}
      onActiveTypesChange={noop}
      onActiveVoicingFamiliesChange={noop}
      onRootChange={noop}
      chordSort="baseFret"
      onChordSortChange={noop}
      scaleSelection={scaleSelection}
      onActiveSystemsChange={noop}
      onActiveQualitiesChange={noop}
      nameQuery=""
      onNameQueryChange={noop}
      failingOnly={false}
      onFailingOnlyChange={noop}
      shownCount={10}
      totalCount={20}
    />,
  );
}

describe("FilterBar", () => {
  it("renders under renderToString with no window access, in both chord and scale mode", () => {
    expect(() => renderChordBar()).not.toThrow();
    expect(() => renderScaleBar()).not.toThrow();
  });

  it("never emits data-tg-edit (read-only, capability-independent)", () => {
    expect(renderChordBar()).not.toContain("data-tg-edit");
    expect(renderScaleBar()).not.toContain("data-tg-edit");
  });

  it("shows the live Showing N of M count", () => {
    expect(stripReactComments(renderChordBar())).toContain("Showing 10 of 20");
  });

  it("derives scale chip pressed state from scaleSelection (single-select, empty = All)", () => {
    const pressedLabels = (html: string) =>
      [...stripReactComments(html).matchAll(/aria-pressed="true"[^>]*>([^<]+)/g)].map((m) => m[1].trim());

    expect(pressedLabels(renderScaleBar())).toEqual(["Scale", "All", "All"]);

    const scale = catalog.find((e) => e.kind === "scale");
    if (scale?.kind !== "scale") throw new Error("fixture has no scale entry");
    const system = scale.shape.system;
    const pressed = pressedLabels(renderScaleBar({ activeSystems: [system] }));
    expect(pressed).toContain(system);
    expect(pressed.filter((label) => label === "All")).toHaveLength(1);
  });
});
