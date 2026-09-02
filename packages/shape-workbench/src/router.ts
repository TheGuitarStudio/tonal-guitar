/**
 * Hash-based routing for the Shape Workbench (spec §5.4) — no router
 * dependency. Three routes: `#/board` (default), `#/editor/<slotKey|shapeName>`,
 * `#/export`. Any hash that doesn't parse into one of these falls back to
 * `#/board`.
 *
 * Pure — no `window`/DOM access here, so `parseRoute`/`routeToHash` are
 * unit-testable without a browser environment. The DOM-touching half
 * (subscribing to `hashchange`, writing `window.location.hash`) lives in
 * `useRoute.ts`.
 */

export type Route = { type: "board" } | { type: "editor"; id: string } | { type: "export" };

export const DEFAULT_ROUTE: Route = { type: "board" };

/**
 * Parses a `window.location.hash`-shaped string (with or without the
 * leading `#`, with or without the leading `/`) into a `Route`. Any hash
 * that doesn't resolve to a known route — including `#/editor` with no id —
 * falls back to `DEFAULT_ROUTE` (spec §5.4: "Unknown hash → `#/board`").
 */
export function parseRoute(hash: string): Route {
  const withoutHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const segments = withoutHash.split("/").filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return DEFAULT_ROUTE;
  }

  const [head, ...rest] = segments;

  if (head === "board") {
    return { type: "board" };
  }
  if (head === "export") {
    return { type: "export" };
  }
  if (head === "editor") {
    const encodedId = rest.join("/");
    if (encodedId.length === 0) {
      return DEFAULT_ROUTE;
    }
    return { type: "editor", id: decodeURIComponent(encodedId) };
  }

  return DEFAULT_ROUTE;
}

/** Inverse of `parseRoute` — produces the canonical hash string for a route. */
export function routeToHash(route: Route): string {
  switch (route.type) {
    case "board":
      return "#/board";
    case "export":
      return "#/export";
    case "editor":
      return `#/editor/${encodeURIComponent(route.id)}`;
  }
}
