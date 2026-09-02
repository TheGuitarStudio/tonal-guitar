/**
 * Vite dev-server-only plugin (spec §5.4) exposing the three
 * `/__workbench/*` endpoints the app uses to read/write
 * `.workbench/changeset.json`:
 *
 *  - `GET  /__workbench/status`     -> `{ writable, repoRoot, libraryVersion }`
 *  - `GET  /__workbench/changeset`  -> current changeset JSON, or 404
 *  - `POST /__workbench/changeset`  -> validates + writes, or 400
 *
 * `apply: "serve"` — this plugin (and everything it imports) must NEVER
 * ship in the production bundle. It's only ever imported from
 * `vite.config.ts` (a Node-side, build-time file); no client-side module
 * (`main.tsx`, `App.tsx`, or anything they import) may import this file —
 * that's what keeps it out of `vite build`'s output.
 *
 * The write path enforces path containment (spec §5.4: "every write target
 * resolved and asserted to live under `<repoRoot>/.workbench/`; anything
 * else is a 400. The plugin writes nowhere else, ever.") via
 * `resolveWithinWorkbench`, which is exported and unit-tested directly so
 * the containment logic doesn't need a running server to verify (spec/tasks
 * 24.1). `writeChangesetFile` always calls it with the fixed
 * `changeset.json` target in real operation, but accepts an arbitrary
 * candidate path so a test can also exercise the traversal-rejection path
 * directly.
 */
import { promises as fs, constants as fsConstants } from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

export const WORKBENCH_DIR_NAME = ".workbench";
export const CHANGESET_FILE_NAME = "changeset.json";
const STATUS_PATH = "/__workbench/status";
const CHANGESET_PATH = "/__workbench/changeset";

export interface WorkbenchIoOptions {
  /** Absolute path to the repo root. Required (not defaulted here) — the
   * caller (`vite.config.ts`) computes it from its own file location, so
   * tests can point it at a scratch directory instead. */
  repoRoot: string;
  /** Overridable for tests; defaults to the real `tonal-guitar` version. */
  libraryVersion?: string;
}

export function resolveWorkbenchDir(repoRoot: string): string {
  return path.resolve(repoRoot, WORKBENCH_DIR_NAME);
}

export function resolveChangesetPath(repoRoot: string): string {
  return path.join(resolveWorkbenchDir(repoRoot), CHANGESET_FILE_NAME);
}

/**
 * Resolves `candidate` (a path, relative or absolute) against
 * `<repoRoot>/.workbench/` and asserts the result still lives inside that
 * directory. Returns the resolved absolute path when contained, `null`
 * otherwise (a `..` escape, an absolute path elsewhere, or exactly the
 * directory itself).
 */
export function resolveWithinWorkbench(repoRoot: string, candidate: string): string | null {
  const workbenchDir = resolveWorkbenchDir(repoRoot);
  const resolved = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(workbenchDir, candidate);
  const relative = path.relative(workbenchDir, resolved);

  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

// ============================================================
// Changeset payload validation (schema-shape only — the full audit/registry
// validation belongs to `scripts/shapes-merge.mjs`, run explicitly by the
// author; this is just enough to reject a malformed POST body).
// ============================================================

export interface ChangesetValidationOk {
  ok: true;
  changeCount: number;
}
export interface ChangesetValidationError {
  ok: false;
  message: string;
}

function isChangesetKind(value: unknown): value is "chord" | "arpeggio" | "scale" {
  return value === "chord" || value === "arpeggio" || value === "scale";
}

function validateChange(change: unknown, index: number): string | null {
  if (typeof change !== "object" || change === null) {
    return `changes[${index}] must be an object`;
  }
  const record = change as Record<string, unknown>;
  if (!isChangesetKind(record.kind)) {
    return `changes[${index}].kind must be "chord" | "arpeggio" | "scale"`;
  }
  if (record.op === "add") {
    if (typeof record.file !== "string" || !/^[a-z0-9-]+$/.test(record.file)) {
      return `changes[${index}].file must match /^[a-z0-9-]+$/`;
    }
    if (typeof record.shape !== "object" || record.shape === null) {
      return `changes[${index}].shape is required for an "add" change`;
    }
    return null;
  }
  if (record.op === "update") {
    if (typeof record.name !== "string" || record.name.length === 0) {
      return `changes[${index}].name is required for an "update" change`;
    }
    if (typeof record.patch !== "object" || record.patch === null) {
      return `changes[${index}].patch is required for an "update" change`;
    }
    return null;
  }
  if (record.op === "remove") {
    if (typeof record.name !== "string" || record.name.length === 0) {
      return `changes[${index}].name is required for a "remove" change`;
    }
    return null;
  }
  return `changes[${index}].op must be "add" | "update" | "remove"`;
}

/** Structural validation against the `tonal-guitar/changeset@1` schema
 * (spec §6.1) — checks shape, not registry/audit correctness. */
export function validateChangesetPayload(payload: unknown): ChangesetValidationOk | ChangesetValidationError {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, message: "changeset payload must be a JSON object" };
  }
  const record = payload as Record<string, unknown>;

  if (record.$schema !== "tonal-guitar/changeset@1") {
    return { ok: false, message: '$schema must be exactly "tonal-guitar/changeset@1"' };
  }
  if (typeof record.version !== "string") {
    return { ok: false, message: "version must be a string" };
  }
  if (!Array.isArray(record.tuning) || !record.tuning.every((note) => typeof note === "string")) {
    return { ok: false, message: "tuning must be a string[]" };
  }
  if (!Array.isArray(record.changes) || record.changes.length === 0) {
    return { ok: false, message: "changes must be a non-empty array" };
  }

  for (let index = 0; index < record.changes.length; index += 1) {
    const error = validateChange(record.changes[index], index);
    if (error) return { ok: false, message: error };
  }

  return { ok: true, changeCount: record.changes.length };
}

// ============================================================
// Write path
// ============================================================

export type WriteChangesetResult =
  | { ok: true; path: string; bytes: number; changeCount: number }
  | { ok: false; status: number; message: string };

/**
 * Validates and writes `payload` to `<repoRoot>/.workbench/<targetPath>`,
 * creating the directory as needed. `targetPath` is normally always
 * `CHANGESET_FILE_NAME` (the only write the running plugin ever performs) —
 * it's a parameter (not hardcoded) so the containment guard can be
 * exercised directly in a unit test with a deliberately-escaping path,
 * independent of any HTTP layer.
 */
export async function writeChangesetFile(
  repoRoot: string,
  targetPath: string,
  payload: unknown,
): Promise<WriteChangesetResult> {
  const resolved = resolveWithinWorkbench(repoRoot, targetPath);
  if (!resolved) {
    return { ok: false, status: 400, message: `Refusing to write outside .workbench/: ${targetPath}` };
  }

  const validation = validateChangesetPayload(payload);
  if (!validation.ok) {
    return { ok: false, status: 400, message: validation.message };
  }

  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(resolved, json, "utf8");

  return {
    ok: true,
    path: resolved,
    bytes: Buffer.byteLength(json, "utf8"),
    changeCount: validation.changeCount,
  };
}

async function isWritableDir(dir: string): Promise<boolean> {
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.access(dir, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(json);
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleStatus(
  req: IncomingMessage,
  res: ServerResponse,
  options: WorkbenchIoOptions,
): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { message: "GET only" });
    return;
  }
  const writable = await isWritableDir(resolveWorkbenchDir(options.repoRoot));
  sendJson(res, 200, {
    writable,
    repoRoot: options.repoRoot,
    libraryVersion: options.libraryVersion,
  });
}

async function handleChangesetGet(res: ServerResponse, repoRoot: string): Promise<void> {
  try {
    const text = await fs.readFile(resolveChangesetPath(repoRoot), "utf8");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(text);
  } catch (error) {
    if (isEnoent(error)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    sendJson(res, 500, { message: error instanceof Error ? error.message : "Unknown error" });
  }
}

async function handleChangesetPost(
  req: IncomingMessage,
  res: ServerResponse,
  repoRoot: string,
): Promise<void> {
  let payload: unknown;
  try {
    const raw = await readRequestBody(req);
    payload = raw.length > 0 ? JSON.parse(raw) : undefined;
  } catch {
    sendJson(res, 400, { message: "Request body must be valid JSON" });
    return;
  }

  const result = await writeChangesetFile(repoRoot, CHANGESET_FILE_NAME, payload);
  if (!result.ok) {
    sendJson(res, result.status, { message: result.message });
    return;
  }
  sendJson(res, 200, { path: result.path, bytes: result.bytes, changeCount: result.changeCount });
}

async function handleChangeset(
  req: IncomingMessage,
  res: ServerResponse,
  repoRoot: string,
): Promise<void> {
  if (req.method === "GET") {
    await handleChangesetGet(res, repoRoot);
    return;
  }
  if (req.method === "POST") {
    await handleChangesetPost(req, res, repoRoot);
    return;
  }
  sendJson(res, 405, { message: "GET or POST only" });
}

export function workbenchIoPlugin(options: WorkbenchIoOptions): Plugin {
  const resolvedOptions: WorkbenchIoOptions = {
    repoRoot: options.repoRoot,
    libraryVersion: options.libraryVersion ?? "unknown",
  };

  return {
    name: "tonal-guitar:workbench-io",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(STATUS_PATH, (req, res, next) => {
        handleStatus(req, res, resolvedOptions).catch(next);
      });
      server.middlewares.use(CHANGESET_PATH, (req, res, next) => {
        handleChangeset(req, res, resolvedOptions.repoRoot).catch(next);
      });
    },
  };
}
