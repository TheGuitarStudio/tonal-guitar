/**
 * Unit tests for the workbench-io plugin's pure logic — path containment,
 * schema validation, and the read/write functions against a real scratch
 * directory — all independent of a running Vite server (spec/tasks 24.1).
 */
import { Buffer } from "node:buffer";
import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import type { IncomingMessage } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CHANGESET_FILE_NAME,
  isJsonContentType,
  isSameOriginRequest,
  MAX_REQUEST_BODY_BYTES,
  readRequestBody,
  RequestBodyTooLargeError,
  resolveChangesetPath,
  resolveWithinWorkbench,
  resolveWorkbenchDir,
  validateChangesetPayload,
  writeChangesetFile,
} from "./workbench-io";

const validChangeset = {
  $schema: "tonal-guitar/changeset@1",
  version: "0.2.0",
  tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
  changes: [
    {
      op: "add",
      kind: "chord",
      file: "caged-chords",
      shape: { name: "A Shape Major", system: "caged", strings: [], fingers: [], barres: [], rootString: 0 },
    },
  ],
};

describe("resolveWithinWorkbench", () => {
  const repoRoot = "/repo";

  it("resolves a plain filename to <repoRoot>/.workbench/<file>", () => {
    expect(resolveWithinWorkbench(repoRoot, "changeset.json")).toBe(
      path.join(resolveWorkbenchDir(repoRoot), "changeset.json"),
    );
  });

  it("resolves a nested relative path that stays inside .workbench/", () => {
    expect(resolveWithinWorkbench(repoRoot, "sub/dir/file.json")).toBe(
      path.join(resolveWorkbenchDir(repoRoot), "sub", "dir", "file.json"),
    );
  });

  it("rejects a path that escapes .workbench/ via ..", () => {
    expect(resolveWithinWorkbench(repoRoot, "../outside.json")).toBeNull();
  });

  it("rejects a path that escapes further up the tree", () => {
    expect(resolveWithinWorkbench(repoRoot, "../../etc/passwd")).toBeNull();
  });

  it("rejects an absolute path elsewhere on disk", () => {
    expect(resolveWithinWorkbench(repoRoot, "/etc/passwd")).toBeNull();
  });

  it("rejects the .workbench directory itself (not a file target)", () => {
    expect(resolveWithinWorkbench(repoRoot, ".")).toBeNull();
  });
});

describe("validateChangesetPayload", () => {
  it("accepts a well-formed changeset", () => {
    const result = validateChangesetPayload(validChangeset);
    expect(result).toEqual({ ok: true, changeCount: 1 });
  });

  it("rejects a non-object payload", () => {
    expect(validateChangesetPayload("nope")).toMatchObject({ ok: false });
    expect(validateChangesetPayload(undefined)).toMatchObject({ ok: false });
  });

  it("rejects the wrong $schema", () => {
    const result = validateChangesetPayload({ ...validChangeset, $schema: "wrong" });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing/non-string version", () => {
    const { version, ...rest } = validChangeset;
    void version;
    expect(validateChangesetPayload(rest).ok).toBe(false);
  });

  it("rejects a non-array tuning", () => {
    expect(validateChangesetPayload({ ...validChangeset, tuning: "E2 A2" }).ok).toBe(false);
  });

  it("rejects an empty changes array", () => {
    expect(validateChangesetPayload({ ...validChangeset, changes: [] }).ok).toBe(false);
  });

  it("rejects an add change with a malformed file basename", () => {
    const bad = {
      ...validChangeset,
      changes: [{ ...validChangeset.changes[0], file: "not valid!" }],
    };
    expect(validateChangesetPayload(bad).ok).toBe(false);
  });

  it("rejects an update change missing patch", () => {
    const bad = { ...validChangeset, changes: [{ op: "update", kind: "chord", name: "X" }] };
    expect(validateChangesetPayload(bad).ok).toBe(false);
  });

  it("accepts a remove change", () => {
    const good = { ...validChangeset, changes: [{ op: "remove", kind: "chord", name: "X" }] };
    expect(validateChangesetPayload(good)).toEqual({ ok: true, changeCount: 1 });
  });

  it("rejects an unknown op", () => {
    const bad = { ...validChangeset, changes: [{ op: "delete", kind: "chord", name: "X" }] };
    expect(validateChangesetPayload(bad).ok).toBe(false);
  });
});

describe("isJsonContentType (CR-102)", () => {
  it("accepts a bare application/json", () => {
    expect(isJsonContentType("application/json")).toBe(true);
  });

  it("accepts application/json with a charset parameter", () => {
    expect(isJsonContentType("application/json; charset=utf-8")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isJsonContentType("Application/JSON")).toBe(true);
  });

  it("rejects text/plain (CSRF-simple-request content type)", () => {
    expect(isJsonContentType("text/plain")).toBe(false);
  });

  it("rejects a missing content-type header", () => {
    expect(isJsonContentType(undefined)).toBe(false);
  });
});

describe("isSameOriginRequest (CR-102)", () => {
  it("allows a request with no Origin header at all (CLI/tooling clients)", () => {
    expect(isSameOriginRequest(undefined, "localhost:5173")).toBe(true);
  });

  it("allows a same-origin Origin header", () => {
    expect(isSameOriginRequest("http://localhost:5173", "localhost:5173")).toBe(true);
  });

  it("rejects a cross-origin Origin header", () => {
    expect(isSameOriginRequest("http://evil.example", "localhost:5173")).toBe(false);
  });

  it("rejects an Origin header when the Host header is missing", () => {
    expect(isSameOriginRequest("http://localhost:5173", undefined)).toBe(false);
  });

  it("rejects an unparsable Origin header rather than treating it as same-origin", () => {
    expect(isSameOriginRequest("not a url", "localhost:5173")).toBe(false);
  });
});

/** A hand-written `IncomingMessage`-like fake (EventEmitter + `destroy()`)
 * so `readRequestBody` can be exercised without a real HTTP connection —
 * mirrors this suite's existing no-mocking-library style. `emit()`s happen
 * on a microtask so `readRequestBody`'s listeners are attached first. */
function fakeRequest(chunks: Buffer[]): { req: IncomingMessage; wasDestroyed: () => boolean } {
  const emitter = new EventEmitter();
  let destroyed = false;
  Object.assign(emitter, {
    destroy: () => {
      destroyed = true;
    },
  });
  queueMicrotask(() => {
    for (const chunk of chunks) emitter.emit("data", chunk);
    emitter.emit("end");
  });
  return { req: emitter as unknown as IncomingMessage, wasDestroyed: () => destroyed };
}

describe("readRequestBody (CR-103)", () => {
  it("resolves the concatenated UTF-8 body when under the byte cap", async () => {
    const { req } = fakeRequest([Buffer.from("hello "), Buffer.from("world")]);
    await expect(readRequestBody(req, 1024)).resolves.toBe("hello world");
  });

  it("defaults the cap to 8 MB", () => {
    expect(MAX_REQUEST_BODY_BYTES).toBe(8 * 1024 * 1024);
  });

  it("rejects with RequestBodyTooLargeError and destroys the request once the cap is exceeded", async () => {
    const { req, wasDestroyed } = fakeRequest([Buffer.alloc(10), Buffer.alloc(10)]);
    await expect(readRequestBody(req, 15)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(wasDestroyed()).toBe(true);
  });

  it("accepts a body exactly at the cap", async () => {
    const { req } = fakeRequest([Buffer.alloc(15)]);
    await expect(readRequestBody(req, 15)).resolves.toHaveLength(15);
  });
});

describe("writeChangesetFile", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shape-workbench-io-test-"));
  });

  afterEach(async () => {
    await fs.rm(repoRoot, { recursive: true, force: true });
  });

  it("writes a valid changeset under <repoRoot>/.workbench/, creating the directory", async () => {
    const result = await writeChangesetFile(repoRoot, CHANGESET_FILE_NAME, validChangeset);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.path).toBe(resolveChangesetPath(repoRoot));
    expect(result.changeCount).toBe(1);

    const written = JSON.parse(await fs.readFile(result.path, "utf8"));
    expect(written).toEqual(validChangeset);
  });

  it("returns 400 and writes nothing when the target path escapes .workbench/", async () => {
    const result = await writeChangesetFile(repoRoot, "../outside.json", validChangeset);
    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "Refusing to write outside .workbench/: ../outside.json",
    });

    await expect(fs.access(path.join(repoRoot, "..", "outside.json"))).rejects.toThrow();
    await expect(fs.access(resolveWorkbenchDir(repoRoot))).rejects.toThrow();
  });

  it("returns 400 and writes nothing for a schema-invalid payload, even with a contained path", async () => {
    const result = await writeChangesetFile(repoRoot, CHANGESET_FILE_NAME, { not: "a changeset" });
    expect(result).toMatchObject({ ok: false, status: 400 });
    await expect(fs.access(resolveChangesetPath(repoRoot))).rejects.toThrow();
  });

  it("is idempotent: re-writing the same changeset produces the same file contents", async () => {
    await writeChangesetFile(repoRoot, CHANGESET_FILE_NAME, validChangeset);
    const second = await writeChangesetFile(repoRoot, CHANGESET_FILE_NAME, validChangeset);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("unreachable");
    const written = JSON.parse(await fs.readFile(second.path, "utf8"));
    expect(written).toEqual(validChangeset);
  });
});
