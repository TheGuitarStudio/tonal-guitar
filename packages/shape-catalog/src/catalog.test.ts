/**
 * Unit tests for `toggleInAllOnSet` (CR-040): moved here from
 * `shape-library-ui/src/FilterBar.tsx` since it's pure facet business
 * logic, not UI. Covers the "empty = all-on" invariant it exists to
 * maintain — toggling away from the implicit all-on state materializes an
 * explicit set, and toggling back up to cover every option in `all`
 * collapses back to `[]`.
 */
import { describe, it, expect } from "vitest";
import { toggleInAllOnSet } from "./catalog";

describe("toggleInAllOnSet", () => {
  const all = ["a", "b", "c"];

  it("materializes an explicit set on the first toggle away from the implicit all-on state", () => {
    // active === [] means "every option in `all` is on" — toggling one
    // option off should leave the other two explicitly active.
    const result = toggleInAllOnSet([], all, "a");
    expect(result.sort()).toEqual(["b", "c"]);
  });

  it("collapses back to [] once every option in `all` is re-activated", () => {
    const withAOff = toggleInAllOnSet([], all, "a");
    const backToAllOn = toggleInAllOnSet(withAOff, all, "a");
    expect(backToAllOn).toEqual([]);
  });

  it("removes a value from an already-explicit active set", () => {
    const result = toggleInAllOnSet(["a", "b"], all, "a");
    expect(result).toEqual(["b"]);
  });

  it("adds a value to an already-explicit active set without collapsing early", () => {
    const result = toggleInAllOnSet(["a"], all, "b");
    expect(result.sort()).toEqual(["a", "b"]);
  });

  it("full set collapses to [] regardless of the order values were toggled on in", () => {
    let active: string[] = [];
    active = toggleInAllOnSet(active, all, "a"); // -> [b, c] (off a)
    active = toggleInAllOnSet(active, all, "a"); // -> [] (back to all-on)
    active = toggleInAllOnSet(active, all, "b"); // -> [a, c] (off b)
    active = toggleInAllOnSet(active, all, "c"); // -> [a] (off b, c)
    active = toggleInAllOnSet(active, all, "b"); // -> [a, b]
    active = toggleInAllOnSet(active, all, "c"); // -> [a, b, c] === all, collapses
    expect(active).toEqual([]);
  });
});
