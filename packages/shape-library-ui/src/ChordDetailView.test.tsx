import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { chordTypeSiblings, chordDetailFor, alternateFingerings, inversionGroups, siblingStepper } from "shape-catalog";
import { ChordDetailView } from "./ChordDetailView";
import { chordEntryWithSiblings, catalog } from "./testFixtures";

function buildChordDetail() {
  const entry = chordEntryWithSiblings;
  const siblings = chordTypeSiblings(entry);
  const { identified, chordName, scales } = chordDetailFor(entry);
  return {
    kind: "chord" as const,
    entry,
    identified,
    chordName,
    scales,
    siblings,
    stepper: siblingStepper(entry, siblings),
    alternates: alternateFingerings(entry),
    inversions: inversionGroups(entry, siblings),
  };
}

function chordCatalogByName() {
  const map = new Map<string, (typeof catalog)[number] & { kind: "chord" }>();
  for (const e of catalog) if (e.kind === "chord") map.set(e.name, e as never);
  return map;
}

describe("ChordDetailView", () => {
  it("renders under renderToString with no window access", () => {
    const detail = buildChordDetail();
    expect(() =>
      renderToString(<ChordDetailView detail={detail} chordCatalogByName={chordCatalogByName()} onSelectEntry={() => {}} />),
    ).not.toThrow();
  });

  it("never emits data-tg-edit (read-only, capability-independent)", () => {
    const detail = buildChordDetail();
    const html = renderToString(<ChordDetailView detail={detail} chordCatalogByName={chordCatalogByName()} onSelectEntry={() => {}} />);
    expect(html).not.toContain("data-tg-edit");
  });
});
