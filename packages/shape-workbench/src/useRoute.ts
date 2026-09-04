/**
 * DOM-touching half of the hash router: subscribes to `window`'s
 * `hashchange` event and writes new hashes. The parsing/formatting logic
 * itself (`parseRoute`/`routeToHash`) lives in `./router` and is unit-tested
 * there without any DOM; this file is untested glue, kept intentionally
 * small.
 */
import { useEffect, useState } from "react";
import { parseRoute, routeToHash, type Route } from "./router";

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    // The hash may have changed between the initial useState() read and
    // this effect's subscription; resync once on mount.
    onHashChange();
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}

/** Navigates by writing `window.location.hash` — triggers `hashchange`,
 * which `useHashRoute` picks up. Used by the store-backed `EditCapabilities`
 * handlers (`./handlers.ts`) to move between screens after a store update. */
export function navigateToRoute(route: Route): void {
  window.location.hash = routeToHash(route);
}
