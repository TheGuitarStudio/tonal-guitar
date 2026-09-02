import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { FilterBar, FILTER_ALL } from "./FilterBar";
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
      system={FILTER_ALL}
      onSystemChange={noop}
      quality={FILTER_ALL}
      onQualityChange={noop}
      nameQuery=""
      onNameQueryChange={noop}
      failingOnly={false}
      onFailingOnlyChange={noop}
      shownCount={10}
      totalCount={20}
    />,
  );
}

function renderScaleBar() {
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
      scaleSelection={{}}
      system={FILTER_ALL}
      onSystemChange={noop}
      quality={FILTER_ALL}
      onQualityChange={noop}
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
});
