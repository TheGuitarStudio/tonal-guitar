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
    const parsed = body as { path: string; bytes: number; changeCount: number };
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
