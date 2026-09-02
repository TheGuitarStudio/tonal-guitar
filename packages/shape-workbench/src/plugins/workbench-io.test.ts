/**
 * Unit tests for the workbench-io plugin's pure logic — path containment,
 * schema validation, and the read/write functions against a real scratch
 * directory — all independent of a running Vite server (spec/tasks 24.1).
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CHANGESET_FILE_NAME,
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
