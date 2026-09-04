/**
 * "Write changeset.json" (spec §5.4 Export requirements): builds the full
 * `Changeset` envelope from `WorkbenchState.changes` via `shape-catalog`'s
 * `buildChangeset` (never reimplemented here) and POSTs it to the
 * dev-server plugin's `/__workbench/changeset` endpoint
 * (`../plugins/workbench-io.ts`), then dispatches `SET_LAST_WRITTEN_AT` on
 * success.
 *
 * `FetchLike` is a narrow structural type (not `typeof fetch`) so tests can
 * inject a fake endpoint instead of touching the network or reaching for a
 * mocking library — the same harness-style injection `handlers.test.ts`
 * uses for `dispatch`/`navigate`.
 *
 * No React import — `screens/Export.tsx`'s "Write changeset.json" button
 * calls `writeChangesetAndDispatch` directly and renders its `WriteOutcome`.
 */
import { VERSION } from "tonal-guitar";
import { buildChangeset } from "shape-catalog";
import type { WorkbenchAction, WorkbenchState } from "../store";

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** A minimal, hand-written stand-in for the DOM lib's `RequestInit` — that
 * type has no corresponding runtime global (nothing assigns
 * `window.RequestInit`), so referencing it by name trips this repo's
 * non-type-aware `no-undef` ESLint rule. Only the fields `postChangeset`
 * actually sets are declared. */
export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export type FetchLike = (url: string, init?: FetchInit) => Promise<FetchResponseLike>;

/** The dev-server plugin's write endpoint (`plugins/workbench-io.ts`'s
 * `CHANGESET_PATH`) — kept as a literal here (not imported) since that
 * module is `apply: "serve"`-only and must never be reachable from
 * client-side code (see that file's own doc comment). */
export const CHANGESET_ENDPOINT = "/__workbench/changeset";

/** The dev-server plugin's status endpoint (`plugins/workbench-io.ts`'s
 * `STATUS_PATH`) — a literal for the same reason as `CHANGESET_ENDPOINT`
 * above. Only ever reachable when the app is running under `vite dev`; a
 * `vite preview`/`vite build` static server has no such route and falls
 * back to the SPA's `index.html`, which is what `fetchWorkbenchStatus`
 * below is built to detect and report as "unreachable" (CR-060). */
export const STATUS_ENDPOINT = "/__workbench/status";

export type WorkbenchStatus =
  | { reachable: true; writable: boolean }
  | { reachable: false };

/**
 * Whether "Write changeset.json" should be disabled, and why (CR-121): the
 * CR-060 gate only checked `reachable`, so a reachable-but-read-only
 * `.workbench/` (e.g. wrong filesystem permissions) still showed an
 * enabled button that would fail at POST time instead of being caught up
 * front by the very probe meant to catch exactly this. A pure function
 * (rather than inlining the boolean expression in `screens/Export.tsx`) so
 * each gate reason is independently unit-testable without the status
 * probe's `useEffect` actually running — this package's `renderToString`-only
 * component tests never execute effects (see `fetchWorkbenchStatus`'s own
 * tests above for the same reason this is split out).
 */
export function isWriteDisabled(status: WorkbenchStatus | undefined, collisionCount: number): boolean {
  if (status === undefined) return true;
  if (!status.reachable) return true;
  if (!status.writable) return true;
  return collisionCount > 0;
}

/**
 * Probes the dev-server plugin's `GET /__workbench/status` endpoint. Used
 * to gate the "Write changeset.json" button (CR-060): under `vite preview`
 * or a static build there is no such route, so the response is either a
 * non-JSON SPA fallback (`response.json()` throws) or simply not `ok` —
 * both collapse to `{ reachable: false }` here rather than surfacing a
 * cryptic JSON-parse error at write time.
 */
export async function fetchWorkbenchStatus(fetchImpl: FetchLike): Promise<WorkbenchStatus> {
  try {
    const response = await fetchImpl(STATUS_ENDPOINT);
    if (!response.ok) return { reachable: false };
    const body = (await response.json()) as { writable?: unknown };
    return { reachable: true, writable: body.writable === true };
  } catch {
    return { reachable: false };
  }
}

export type WriteOutcome =
  | { ok: true; path: string; bytes: number; changeCount: number; writtenAt: string }
  | { ok: false; message: string };

function messageFrom(body: unknown, status: number): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof (body as { message: unknown }).message === "string"
  ) {
    return (body as { message: string }).message;
  }
  return `request failed with status ${status}`;
}

/**
 * CR-104: structural validation of the write endpoint's success body
 * (`{ path, bytes, changeCount }`, `plugins/workbench-io.ts`'s
 * `handleChangesetPost`), mirroring `messageFrom`'s error-path style —
 * `postChangeset` no longer trusts an unchecked `as` cast on a 2xx response
 * body that could be anything (a proxy, a misbehaving/compromised dev
 * server, ...). Returns `undefined` when the body doesn't match, which the
 * caller turns into an `ok: false` result instead of a bogus `ok: true`.
 */
function successBodyFrom(body: unknown): { path: string; bytes: number; changeCount: number } | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.path !== "string") return undefined;
  if (typeof record.bytes !== "number") return undefined;
  if (typeof record.changeCount !== "number") return undefined;
  return { path: record.path, bytes: record.bytes, changeCount: record.changeCount };
}

/**
 * POSTs `changeset` to the dev-server plugin's write endpoint. Pure network
 * call — no store access, no dispatch — so it's independently testable
 * against a fake `FetchLike`, mirroring
 * `plugins/workbench-io.ts`'s `{ path, bytes, changeCount }` success body
 * and `{ message }` error body exactly.
 */
export async function postChangeset(
  changeset: unknown,
  fetchImpl: FetchLike,
  now: () => string = () => new Date().toISOString(),
): Promise<WriteOutcome> {
  try {
    const response = await fetchImpl(CHANGESET_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changeset),
    });
    const body = await response.json();
    if (!response.ok) {
      return { ok: false, message: messageFrom(body, response.status) };
    }
    const parsed = successBodyFrom(body);
    if (!parsed) {
      return {
        ok: false,
        message: "malformed response from the workbench write endpoint (expected { path, bytes, changeCount })",
      };
    }
    return { ok: true, path: parsed.path, bytes: parsed.bytes, changeCount: parsed.changeCount, writtenAt: now() };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "network error writing changeset.json",
    };
  }
}

/**
 * The full "Write changeset.json" action (spec §5.4): builds the changeset
 * envelope (`buildChangeset`), POSTs it, and dispatches
 * `SET_LAST_WRITTEN_AT` on success — the store update the Export screen's
 * "Last written" line reads. Dispatch-free on failure: nothing about
 * `WorkbenchState` changes when the write is refused.
 */
export async function writeChangesetAndDispatch(
  state: WorkbenchState,
  dispatch: (action: WorkbenchAction) => void,
  fetchImpl: FetchLike,
  now: () => string = () => new Date().toISOString(),
): Promise<WriteOutcome> {
  const timestamp = now();
  const { changeset } = buildChangeset({
    version: VERSION,
    tuning: state.tuning,
    changes: state.changes,
    generator: "shape-workbench",
    createdAt: timestamp,
  });
  const outcome = await postChangeset(changeset, fetchImpl, () => timestamp);
  if (outcome.ok) {
    dispatch({ type: "SET_LAST_WRITTEN_AT", timestamp: outcome.writtenAt });
  }
  return outcome;
}
