import { describe, expect, it } from "vitest";
import { DEFAULT_ROUTE, parseRoute, routeToHash, type Route } from "./router";

describe("parseRoute", () => {
  it("defaults to board for an empty hash", () => {
    expect(parseRoute("")).toEqual(DEFAULT_ROUTE);
  });

  it("defaults to board for a bare '#'", () => {
    expect(parseRoute("#")).toEqual(DEFAULT_ROUTE);
  });

  it("parses #/board", () => {
    expect(parseRoute("#/board")).toEqual({ type: "board" });
  });

  it("parses #/export", () => {
    expect(parseRoute("#/export")).toEqual({ type: "export" });
  });

  it("parses #/editor/<id>", () => {
    expect(parseRoute("#/editor/A Shape Major")).toEqual({
      type: "editor",
      id: "A Shape Major",
    });
  });

  it("decodes a URI-encoded editor id", () => {
    expect(parseRoute("#/editor/A%20Shape%20Major")).toEqual({
      type: "editor",
      id: "A Shape Major",
    });
  });

  it("parses a slotKey-shaped editor id (rowKey::columnKey)", () => {
    expect(parseRoute("#/editor/m7::C")).toEqual({ type: "editor", id: "m7::C" });
  });

  it("falls back to board for #/editor with no id", () => {
    expect(parseRoute("#/editor")).toEqual(DEFAULT_ROUTE);
  });

  it("falls back to board for #/editor/ with a trailing slash and nothing else", () => {
    expect(parseRoute("#/editor/")).toEqual(DEFAULT_ROUTE);
  });

  it("falls back to board for an unknown route", () => {
    expect(parseRoute("#/graph")).toEqual(DEFAULT_ROUTE);
  });

  it("falls back to board for a garbage hash", () => {
    expect(parseRoute("#not-a-real-route")).toEqual(DEFAULT_ROUTE);
  });

  it("tolerates a hash with no leading '#'", () => {
    expect(parseRoute("/export")).toEqual({ type: "export" });
  });

  it("tolerates a hash with no leading slash", () => {
    expect(parseRoute("#export")).toEqual({ type: "export" });
  });
});

describe("routeToHash", () => {
  it("round-trips board", () => {
    const route: Route = { type: "board" };
    expect(parseRoute(routeToHash(route))).toEqual(route);
  });

  it("round-trips export", () => {
    const route: Route = { type: "export" };
    expect(parseRoute(routeToHash(route))).toEqual(route);
  });

  it("round-trips editor, encoding special characters in the id", () => {
    const route: Route = { type: "editor", id: "A Shape Major" };
    expect(routeToHash(route)).toBe("#/editor/A%20Shape%20Major");
    expect(parseRoute(routeToHash(route))).toEqual(route);
  });
});
