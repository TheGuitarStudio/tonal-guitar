import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import { renderToString } from "react-dom/server";
import type { ScaleFacetSelection } from "shape-catalog";
import { FilterBar } from "./FilterBar";
import { catalog, stripReactComments } from "./testFixtures";

const noop = () => {};

function renderChordBar(extra: Partial<ComponentProps<typeof FilterBar>> = {}) {
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
      {...extra}
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
  it("offers only Scale and Chord kind toggles by default", () => {
    const html = renderChordBar();
    expect(html).toContain("Scale");
    expect(html).toContain("Chord");
    expect(html).not.toContain("Arpeggio");
  });

  it("offers an Arpeggio toggle when kinds includes it, and no facet rows for the arpeggio kind", () => {
    const html = renderChordBar({ kind: "arpeggio", kinds: ["scale", "chord", "arpeggio"] });
    expect(html).toContain("Arpeggio");
    expect(html).toContain("Failing only");
    expect(html).not.toContain("Sort chord shapes");
  });

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
