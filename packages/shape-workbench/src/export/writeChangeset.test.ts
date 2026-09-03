/**
 * "Write changeset.json" round-trip against a mocked plugin endpoint
 * (tasks.md 27.1's acceptance criterion). `FetchLike` is a plain function
 * type, so the mock here is a hand-written fake — no mocking library
 * needed, matching `handlers.test.ts`'s dispatched/navigated harness style.
 */
import { describe, expect, it } from "vitest";
import type { AddChange } from "tonal-guitar";
import { initialWorkbenchState, type WorkbenchAction, type WorkbenchState } from "../store";
import {
  CHANGESET_ENDPOINT,
  fetchWorkbenchStatus,
  postChangeset,
  STATUS_ENDPOINT,
  writeChangesetAndDispatch,
  type FetchInit,
  type FetchLike,
  type FetchResponseLike,
} from "./writeChangeset";

const addChange: AddChange = {
  op: "add",
  kind: "chord",
  file: "caged-chords-minor",
  shape: {
    name: "A Shape Minor",
    system: "caged",
    strings: [null, "1P", "5P", "1P", "b3m", "5P"],
    fingers: [null, 1, 3, 4, 2, 1],
    barres: [],
    rootString: 1,
  },
};

function fakeFetch(response: FetchResponseLike, capture?: { url?: string; init?: FetchInit }): FetchLike {
  return async (url, init) => {
    if (capture) {
      capture.url = url;
      capture.init = init;
    }
    return response;
  };
}

describe("postChangeset", () => {
  it("returns ok:true with the endpoint's { path, bytes, changeCount } on a 200 response", async () => {
    const capture: { url?: string; init?: FetchInit } = {};
    const fetchImpl = fakeFetch(
      { ok: true, status: 200, json: async () => ({ path: "/repo/.workbench/changeset.json", bytes: 512, changeCount: 1 }) },
      capture,
    );
    const result = await postChangeset({ $schema: "tonal-guitar/changeset@1" }, fetchImpl, () => "2026-09-02T00:00:00.000Z");

    expect(result).toEqual({
      ok: true,
      path: "/repo/.workbench/changeset.json",
      bytes: 512,
      changeCount: 1,
      writtenAt: "2026-09-02T00:00:00.000Z",
    });
    expect(capture.url).toBe(CHANGESET_ENDPOINT);
    expect(capture.init?.method).toBe("POST");
    expect(JSON.parse(String(capture.init?.body))).toEqual({ $schema: "tonal-guitar/changeset@1" });
  });

  it("returns ok:false with the endpoint's { message } on a non-2xx response", async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 400, json: async () => ({ message: "invalid changeset" }) });
    const result = await postChangeset({}, fetchImpl);
    expect(result).toEqual({ ok: false, message: "invalid changeset" });
  });

  it("returns ok:false with a generic message when the error body has no message field", async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 500, json: async () => ({}) });
    const result = await postChangeset({}, fetchImpl);
    expect(result).toEqual({ ok: false, message: "request failed with status 500" });
  });

  it("returns ok:false when the fetch itself rejects (network error)", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("offline");
    };
    const result = await postChangeset({}, fetchImpl);
    expect(result).toEqual({ ok: false, message: "offline" });
  });

  it("returns ok:false (not a bogus ok:true) when a 2xx body is missing path/bytes/changeCount (CR-104)", async () => {
    const fetchImpl = fakeFetch({ ok: true, status: 200, json: async () => ({ path: "/repo/.workbench/changeset.json" }) });
    const result = await postChangeset({}, fetchImpl);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.message).toMatch(/malformed/i);
  });

  it("returns ok:false when a 2xx body's fields have the wrong types (CR-104)", async () => {
    const fetchImpl = fakeFetch({
      ok: true,
      status: 200,
      json: async () => ({ path: 123, bytes: "512", changeCount: null }),
    });
    const result = await postChangeset({}, fetchImpl);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when a 2xx body is not an object at all (CR-104)", async () => {
    const fetchImpl = fakeFetch({ ok: true, status: 200, json: async () => "not an object" });
    const result = await postChangeset({}, fetchImpl);
    expect(result.ok).toBe(false);
  });
});

describe("fetchWorkbenchStatus (CR-060)", () => {
  it("reports reachable:true with the endpoint's `writable` flag on a 200 response", async () => {
    const capture: { url?: string } = {};
    const fetchImpl = fakeFetch(
      { ok: true, status: 200, json: async () => ({ writable: true, repoRoot: "/repo", libraryVersion: "0.2.0" }) },
      capture,
    );
    const result = await fetchWorkbenchStatus(fetchImpl);
    expect(result).toEqual({ reachable: true, writable: true });
    expect(capture.url).toBe(STATUS_ENDPOINT);
  });

  it("reports reachable:false on a non-2xx response (e.g. vite preview's SPA fallback returning a 404/200-HTML)", async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 404, json: async () => ({}) });
    const result = await fetchWorkbenchStatus(fetchImpl);
    expect(result).toEqual({ reachable: false });
  });

  it("reports reachable:false when the response body isn't JSON (vite preview's SPA fallback serves index.html)", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
    });
    const result = await fetchWorkbenchStatus(fetchImpl);
    expect(result).toEqual({ reachable: false });
  });

  it("reports reachable:false when the fetch itself rejects (no dev server running at all)", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("offline");
    };
    const result = await fetchWorkbenchStatus(fetchImpl);
    expect(result).toEqual({ reachable: false });
  });
});

describe("writeChangesetAndDispatch", () => {
  function harness(state: WorkbenchState = { ...initialWorkbenchState, changes: [addChange] }) {
    const dispatched: WorkbenchAction[] = [];
    return { state, dispatch: (action: WorkbenchAction) => dispatched.push(action), dispatched };
  }

  it("builds the changeset via buildChangeset, POSTs it, and dispatches SET_LAST_WRITTEN_AT on success", async () => {
    const { state, dispatch, dispatched } = harness();
    const capture: { url?: string; init?: FetchInit } = {};
    const fetchImpl = fakeFetch(
      { ok: true, status: 200, json: async () => ({ path: ".workbench/changeset.json", bytes: 100, changeCount: 1 }) },
      capture,
    );

    const outcome = await writeChangesetAndDispatch(state, dispatch, fetchImpl, () => "2026-09-02T12:00:00.000Z");

    expect(outcome).toEqual({
      ok: true,
      path: ".workbench/changeset.json",
      bytes: 100,
      changeCount: 1,
      writtenAt: "2026-09-02T12:00:00.000Z",
    });
    expect(dispatched).toEqual([{ type: "SET_LAST_WRITTEN_AT", timestamp: "2026-09-02T12:00:00.000Z" }]);

    const body = JSON.parse(String(capture.init?.body));
    expect(body.$schema).toBe("tonal-guitar/changeset@1");
    expect(body.changes).toEqual([addChange]);
    expect(body.generator).toBe("shape-workbench");
    expect(body.createdAt).toBe("2026-09-02T12:00:00.000Z");
  });

  it("does not dispatch anything when the write is refused", async () => {
    const { state, dispatch, dispatched } = harness();
    const fetchImpl = fakeFetch({ ok: false, status: 400, json: async () => ({ message: "refused" }) });

    const outcome = await writeChangesetAndDispatch(state, dispatch, fetchImpl);

    expect(outcome).toEqual({ ok: false, message: "refused" });
    expect(dispatched).toEqual([]);
  });
});
