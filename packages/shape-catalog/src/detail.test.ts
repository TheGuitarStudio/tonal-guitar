import { describe, expect, it } from "vitest";
import { auditAllShapes } from "tonal-guitar";
import { buildCatalog } from "./catalog";
import { buildDetail, buildEntryNameMap, chordTypeSiblings, scaleSiblings } from "./detail";

const catalog = buildCatalog(auditAllShapes());

describe("buildDetail", () => {
  it("builds a chord payload with siblings and a stepper positioned on the entry", () => {
    const entry = catalog.find((e) => e.kind === "chord" && e.shape.chordType !== undefined);
    if (entry?.kind !== "chord") throw new Error("registry has no typed chord shape");
    const detail = buildDetail(entry, catalog);
    expect(detail.kind).toBe("chord");
    expect(detail.entry).toBe(entry);
    expect(detail.siblings).toEqual(chordTypeSiblings(entry));
    expect(detail.stepper.total).toBe(detail.siblings.length);
  });

  it("builds a scale payload from the catalog's same-system/quality siblings", () => {
    const entry = catalog.find((e) => e.kind === "scale");
    if (entry?.kind !== "scale") throw new Error("registry has no scale shape");
    const detail = buildDetail(entry, catalog);
    expect(detail.kind).toBe("scale");
    expect(detail.siblings).toEqual(scaleSiblings(entry, catalog));
    expect(detail.stepper.index).toBe(detail.siblings.findIndex((s) => s.name === entry.name));
  });
});

describe("buildEntryNameMap", () => {
  it("maps names to entries of the requested kind only", () => {
    const chords = buildEntryNameMap(catalog, "chord");
    expect(chords.size).toBe(catalog.filter((e) => e.kind === "chord").length);
    for (const [name, entry] of chords) {
      expect(entry.kind).toBe("chord");
      expect(entry.name).toBe(name);
    }
  });
});
