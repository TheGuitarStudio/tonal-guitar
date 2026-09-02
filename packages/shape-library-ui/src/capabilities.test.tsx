import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ShapeLibraryProvider, useLibraryCapabilities, type LibraryCapabilities } from "./capabilities";

function Probe() {
  const capabilities = useLibraryCapabilities();
  return createElement("div", { "data-has-edit": capabilities.edit !== undefined });
}

describe("useLibraryCapabilities", () => {
  it("defaults to {} (no edit) when rendered outside any provider", () => {
    const html = renderToString(createElement(Probe));
    expect(html).toContain('data-has-edit="false"');
  });

  it("defaults to {} when ShapeLibraryProvider is rendered with no capabilities prop", () => {
    const html = renderToString(createElement(ShapeLibraryProvider, null, createElement(Probe)));
    expect(html).toContain('data-has-edit="false"');
  });

  it("stays edit-less when capabilities.edit is explicitly undefined", () => {
    const capabilities: LibraryCapabilities = { edit: undefined };
    const html = renderToString(createElement(ShapeLibraryProvider, { capabilities }, createElement(Probe)));
    expect(html).toContain('data-has-edit="false"');
  });

  it("passes through injected edit capabilities", () => {
    const capabilities: LibraryCapabilities = { edit: {} };
    const html = renderToString(createElement(ShapeLibraryProvider, { capabilities }, createElement(Probe)));
    expect(html).toContain('data-has-edit="true"');
  });
});
