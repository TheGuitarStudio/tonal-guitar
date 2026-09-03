#!/usr/bin/env node
/**
 * shapes-merge.mjs — merges a `tonal-guitar/changeset@1` JSON file (shape-
 * workbench spec §6.1) into `src/data/*.ts` + `src/index.ts`, following the
 * generator-owned-block write strategy (spec §6.3).
 *
 * Usage:
 *   node scripts/shapes-merge.mjs <changeset.json> [--dry-run] [--check]
 *     [--force] [--update-counts] [--out <ident>] [--root <dir>] [--json]
 *
 * ---------------------------------------------------------------------------
 * Library import strategy (documented per Task Group 17's instructions):
 *
 * This script always imports the repo's own BUILT library from
 * `../dist/index.mjs` (relative to this file's location), never from
 * `--root`. `--root` only redirects where changeset SOURCE FILES
 * (`src/data/*.ts`, `src/index.ts`, `src/data/data.test.ts`,
 * `src/index.test.ts`) are read and written, so fixture tests can point
 * `--root` at a temporary copy of those files without needing to build a
 * separate `dist` for it.
 *
 * Registry-backed checks (name-uniqueness's live-registry half via
 * `checkNameUnique`, `overrides` target resolution, and the base object an
 * `update` patch is merged onto) always reflect the real repo's registered
 * shapes. Fixture tests are expected to either (a) use synthetic shape names
 * that don't collide with real registered data, or (b) copy real
 * `src/data`/`src/index.ts` verbatim into the fixture root before merging,
 * so the registry-backed base objects line up with the fixture's on-disk
 * source. `npm run build` must be run (directly, or via `npm install`'s
 * `prepare` hook) before invoking this script or its test suite, so `dist`
 * is in sync with `src`.
 *
 * `export identifier unique across all of src/data` (spec §6.2 rule 6) is
 * NOT derived from the live registry (identifiers aren't tracked at
 * runtime) — it's computed by scanning `<root>/src/data/*.ts` for
 * `export const IDENT` declarations, which also catches hand-authored
 * shorthand identifiers (e.g. `CAGED_CHORD_EM`) that don't match the
 * generated `exportIdentifierFor` formula.
 * ---------------------------------------------------------------------------
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  unlinkSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseOwnedBlocks, findOwnedBlock, parseCountMarkers } from "./lib/owned-blocks.mjs";
import { renderShape, exportIdentifierFor as scriptExportIdentifierFor } from "./lib/render-shape.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_REPO_ROOT = path.resolve(__dirname, "..");

export const GENERATED_HEADER =
  "// GENERATED FILE — managed by `npm run shapes:merge`. Edit via the Shape Workbench.";

// spec §6.2 rule 5 — computed-file deny list, refused even with --force.
const COMPUTED_FILE_DENY_LIST = new Set(["caged-scales-minor", "pentatonic-minor"]);

// spec §6.3 — hand-written files on the write allow-list (prepped with
// per-constant markers as a one-time step). Every other hand-written file
// (open-chords, extended-chords, caged-chords-7th, jazz-shells, ...) stays
// unmanaged in MVP.
const HAND_WRITTEN_MANAGED_FILES = new Set(["caged-chords"]);

const IMPORT_LINE = {
  chord: 'import { chordShapes, ChordShape } from "../shape";',
  scale: 'import { add, ScaleShape } from "../shape";',
  arpeggio: 'import { arpeggioShapes, ArpeggioShape } from "../shape";',
};

const REGISTER_LINE = {
  chord: (names) => `[${names.join(", ")}].forEach(chordShapes.add.bind(chordShapes));`,
  scale: (names) => `[${names.join(", ")}].forEach(add);`,
  arpeggio: (names) => `[${names.join(", ")}].forEach(arpeggioShapes.add.bind(arpeggioShapes));`,
};

// spec §6.4 — which changes touch which annotated test-count assertions.
// Only markers with a KNOWN, unambiguous meaning are listed; a changeset
// touching a shape that matches a rule's predicate invalidates that count by
// +1 (add) / -1 (remove). `update` never touches a count (conservative
// default — see module doc on --update-counts below).
const COUNT_RULES = {
  "chord-shape-total": (shape, kind) => kind === "chord",
  "scale-shape-total": (shape, kind) => kind === "scale",
  "shell-shape-total": (shape, kind) => kind === "chord" && shape.voicingFamily === "shell",
  "shell-voicing-family-count": (shape, kind) => kind === "chord" && shape.voicingFamily === "shell",
  "featured-chord-total": (shape, kind) => kind === "chord" && shape.featured === true,
  "featured-scale-total": (shape, kind) => kind === "scale" && shape.featured === true,
  "caged-scale-total": (shape, kind) => kind === "scale" && shape.system === "caged",
  "three-nps-scale-total": (shape, kind) => kind === "scale" && shape.system === "3nps",
  "pentatonic-scale-total": (shape, kind) => kind === "scale" && shape.system === "pentatonic",
};

// Only a bare integer literal argument is ever auto-rewritten by
// --update-counts; anything else (e.g. `94 + EXTENDED_CHORD_SHAPES.length`)
// is reported but never auto-edited — rewriting an arithmetic expression
// blind is unsafe.
const SIMPLE_COUNT_CALL = /(toBe|toHaveLength)\((\d+)\)/;

// ============================================================
// Errors
// ============================================================

class UsageError extends Error {}

/** Thrown by any of the 9 ordered validations in spec §6.2 — refuses the
 * whole merge before any write happens. */
class MergeRefusal extends Error {
  constructor(rule, message) {
    super(message);
    this.rule = rule;
  }
}

// ============================================================
// CLI parsing
// ============================================================

export function parseArgs(argv) {
  const args = {
    changesetPath: undefined,
    dryRun: false,
    check: false,
    force: false,
    updateCounts: false,
    json: false,
    out: undefined,
    root: undefined,
  };
  const rest = [...argv];
  while (rest.length > 0) {
    const token = rest.shift();
    switch (token) {
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--check":
        args.check = true;
        break;
      case "--force":
        args.force = true;
        break;
      case "--update-counts":
        args.updateCounts = true;
        break;
      case "--json":
        args.json = true;
        break;
      case "--out":
        args.out = rest.shift();
        if (args.out === undefined) throw new UsageError("--out requires an <ident> argument");
        break;
      case "--root":
        args.root = rest.shift();
        if (args.root === undefined) throw new UsageError("--root requires a <dir> argument");
        break;
      default:
        if (token.startsWith("--")) {
          throw new UsageError(`unknown flag: ${token}`);
        }
        if (args.changesetPath !== undefined) {
          throw new UsageError(`unexpected extra argument: ${token}`);
        }
        args.changesetPath = token;
    }
  }
  if (args.changesetPath === undefined) {
    throw new UsageError(
      "usage: shapes-merge.mjs <changeset.json> [--dry-run] [--check] [--force] " +
        "[--update-counts] [--out <ident>] [--root <dir>] [--json]",
    );
  }
  return args;
}

// ============================================================
// Small utilities
// ============================================================

function deepEqualArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Structural equality over the JSON-safe shape objects this script deals
 * in (strings/numbers/booleans/null/arrays/plain objects) — used by
 * CR-021's rename-fallback verification. `undefined`-valued keys are
 * treated as absent on both sides, matching how `renderShape` already
 * treats them (and how `JSON.stringify`/a changeset's own `patch` do). */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object") {
    const aKeys = Object.keys(a).filter((k) => a[k] !== undefined);
    const bKeys = Object.keys(b).filter((k) => b[k] !== undefined);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

function readTextIfExists(absPath) {
  return existsSync(absPath) ? readFileSync(absPath, "utf8") : undefined;
}

function listDataFiles(dataDir) {
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
}

function basenameOf(file) {
  return file.replace(/\.ts$/, "");
}

function isHandWrittenManaged(fileBasename) {
  return HAND_WRITTEN_MANAGED_FILES.has(fileBasename);
}

/** True when `source` starts with the generated-file header (script-owned). */
function isGeneratedSource(source) {
  return source !== undefined && source.startsWith(GENERATED_HEADER);
}

function nameNeedle(shapeName) {
  return `name: ${JSON.stringify(shapeName)}`;
}

/**
 * Locates which `src/data/*.ts` file declares a shape with the given
 * `name` (by scanning for the literal `name: "<name>"` field), scanning
 * ALL data files regardless of managed status — used both for the
 * `parentShape` registration-order anchor (spec §6.3/17.3) and for
 * producing a precise refusal message when an update/remove target lives
 * in an unmanaged file.
 */
function locateShapeFile(dataDir, files, shapeName) {
  const needle = nameNeedle(shapeName);
  for (const file of files) {
    const source = readFileSync(path.join(dataDir, file), "utf8");
    if (source.includes(needle)) return basenameOf(file);
  }
  return undefined;
}

/** Declared type annotation (`ChordShape`/`ScaleShape`/`ArpeggioShape`) of
 * an owned block's `export const IDENT: <Type> = ...` line, mapped back to
 * its changeset `kind` — `undefined` when the content doesn't parse as one
 * of the three known declarations. */
function blockDeclaredKind(blockContent) {
  const match = blockContent.match(/export const \w+\s*:\s*(ChordShape|ScaleShape|ArpeggioShape)\s*=/);
  return match ? TYPE_TO_KIND[match[1]] : undefined;
}

/**
 * Resolves the generator-owned region (spec §6.2 rule 9) for an
 * update/remove target: which file declares it, whether that file is on
 * the write allow-list, and (when it is) the owned-block identifier that
 * wraps it.
 *
 * CR-020: kind-aware — names are unique only WITHIN a kind (a chord and a
 * scale may legitimately share a `name`), so a candidate owned block is
 * only accepted when its own declared type annotation matches `kind`.
 * Matching is against each block's own PARSED content, never a raw
 * whole-file substring search, so a `name: "..."` occurrence sitting in a
 * comment (or inside a same-named block of the WRONG kind) can never be
 * mistaken for the real target.
 */
function locateOwnedRegion(dataDir, files, shapeName, kind) {
  const needle = nameNeedle(shapeName);
  // Pass 1: every file, looking ONLY for a genuine kind-matching owned
  // block — must scan every file before falling back to pass 2 below, or a
  // wrong-kind (or unmanaged-file) match in an EARLIER file would shadow
  // the real, kind-matching block sitting in a LATER file.
  for (const file of files) {
    const base = basenameOf(file);
    const source = readFileSync(path.join(dataDir, file), "utf8");
    const managed = isHandWrittenManaged(base) || isGeneratedSource(source);
    const blocks = parseOwnedBlocks(source);
    const block = blocks.find(
      (b) => (kind === undefined || blockDeclaredKind(b.content) === kind) && b.content.includes(needle),
    );
    if (block) {
      return { file: base, managed, ident: block.name, insideBlock: true };
    }
  }
  // Pass 2: no kind-matching owned block anywhere — but the name may still
  // appear in some file (a comment, an unmanaged file with no markers at
  // all, or a same-named block of the wrong kind). Report the first such
  // file (with `insideBlock: false`, always a refusal at the call site)
  // purely so the refusal message can point at a real location, without
  // letting a raw substring match stand in for a genuine resolution.
  for (const file of files) {
    const base = basenameOf(file);
    const source = readFileSync(path.join(dataDir, file), "utf8");
    if (source.includes(needle)) {
      const managed = isHandWrittenManaged(base) || isGeneratedSource(source);
      return { file: base, managed, ident: undefined, insideBlock: false };
    }
  }
  return undefined;
}

/**
 * Resolves an owned region directly by its marker identifier (the
 * `shapes-merge:begin <IDENT>` name), regardless of what `name:` field the
 * block's content currently holds. Used as the rename fallback below — an
 * owned block's marker identifier never changes across `update`s (it's
 * fixed at `add` time), even when the shape's `name` field does.
 */
function locateOwnedRegionByIdent(dataDir, files, ident) {
  for (const file of files) {
    const base = basenameOf(file);
    const source = readFileSync(path.join(dataDir, file), "utf8");
    const block = findOwnedBlock(source, ident);
    if (!block) continue;
    const managed = isHandWrittenManaged(base) || isGeneratedSource(source);
    return { file: base, managed, ident: block.name, insideBlock: true };
  }
  return undefined;
}

/**
 * Fallback region resolution for an `UpdateChange` whose `name` no longer
 * matches anything on disk — the common cause is a *previous* run of this
 * very changeset already having applied a `patch.name` rename, which makes
 * `locateOwnedRegion(..., change.name)` (looking for the OLD name) fail on
 * every subsequent run (`--check` included), even though the change is
 * fully applied and re-running it should be a no-op (spec §6.6
 * "idempotent"), not a refusal.
 *
 * Two independent strategies, either sufficient:
 *   1. Locate by export identifier — stable across renames since it's fixed
 *      at `add` time: an explicit `change.ident` (not part of the
 *      documented `UpdateChange` schema, but honored if present), else the
 *      identifier `exportIdentifierFor` would generate from the change's
 *      target name (covers shapes this script itself added).
 *   2. Locate by the patch's own new `name` — covers hand-authored files
 *      (e.g. `caged-chords.ts`) whose marker identifiers are hand-picked
 *      shorthands (`CAGED_CHORD_A`) that never matched the generated
 *      formula in the first place. CR-021: this strategy has no identifier
 *      to anchor on, so a coincidental name match against some OTHER,
 *      unrelated registered shape is only ruled out by kind (via
 *      `locateOwnedRegion`'s own `kind` filter) plus verifying the match
 *      is genuinely idempotent below — same kind alone isn't proof, but
 *      combined with "re-applying this exact patch changes nothing" it's
 *      strong evidence this block already IS the renamed target, not a
 *      different shape that happens to already carry the new name.
 * Whichever finds the block, re-merging `change.patch`/`change.unset` onto
 * its already-patched content is a true no-op — the merged object is
 * deep-equal to what's already there, so `renderShape` (a pure function of
 * its input) reproduces byte-identical text and nothing is written. Both
 * strategies below verify exactly that before returning.
 */
function resolveRenamedUpdateRegion(dataDir, files, change) {
  let candidateIdent;
  try {
    candidateIdent = change.ident ?? scriptExportIdentifierFor(change.kind, { name: change.name });
  } catch {
    candidateIdent = undefined;
  }
  if (candidateIdent !== undefined) {
    const byIdent = locateOwnedRegionByIdent(dataDir, files, candidateIdent);
    if (byIdent) return byIdent;
  }
  if (typeof change.patch?.name === "string") {
    const byName = locateOwnedRegion(dataDir, files, change.patch.name, change.kind);
    if (byName === undefined || !byName.insideBlock) return undefined;
    const absPath = path.join(dataDir, `${byName.file}.ts`);
    const block = findOwnedBlock(readFileSync(absPath, "utf8"), byName.ident);
    const current = parseShapeLiteral(block.content);
    const reapplied = { ...current, ...change.patch };
    for (const field of change.unset ?? []) delete reapplied[field];
    if (!deepEqual(reapplied, current)) return undefined;
    return byName;
  }
  return undefined;
}

function detectGeneratedFileKind(source) {
  for (const [kind, line] of Object.entries(IMPORT_LINE)) {
    if (source.includes(line)) return kind;
  }
  return undefined;
}

/** Replaces the content of owned block `blockName` in `source` with
 * `newContent` (no trailing newline), leaving everything else — including
 * the marker lines themselves — byte-identical. */
function replaceOwnedBlockContent(source, blockName, newContent) {
  const block = findOwnedBlock(source, blockName);
  if (!block) {
    throw new Error(`replaceOwnedBlockContent: no owned block named "${blockName}" found`);
  }
  const lines = source.split("\n");
  const before = lines.slice(0, block.beginLine);
  const after = lines.slice(block.endLine - 1);
  const newLines = newContent.replace(/\n$/, "").split("\n");
  return [...before, ...newLines, ...after].join("\n");
}

function buildGeneratedFileText(kind, blocks) {
  const importLine = IMPORT_LINE[kind];
  const registerLine = REGISTER_LINE[kind](blocks.map((b) => b.name));
  const blockText = blocks
    .map((b) => `// shapes-merge:begin ${b.name}\n${b.content}\n// shapes-merge:end ${b.name}`)
    .join("\n\n");
  return `${GENERATED_HEADER}\n\n${importLine}\n\n${blockText}\n\n${registerLine}\n`;
}

/**
 * CR-016: `buildGeneratedFileText` only ever emits the header + import line
 * + owned blocks + register line — nothing else. Reconstructing a
 * generator-owned file from a modified block set is only safe when THAT
 * fixed structure is *everything* the file currently contains: verifies
 * `buildGeneratedFileText(kind, blocks)` (the CURRENT, unmodified block
 * set) reproduces `source` byte-for-byte before letting a modified block
 * set overwrite it, and refuses instead of silently dropping whatever
 * doesn't round-trip (a hand-added comment, a stray import, reordered
 * content, ...).
 */
function assertReconstructible(source, kind, blocks, relPath) {
  const reconstructed = buildGeneratedFileText(kind, blocks);
  if (reconstructed !== source) {
    throw new MergeRefusal(
      "unrecognized-content",
      `${relPath}: contains content outside the recognized generator-owned structure ` +
        `(header / import line / owned blocks / register line) — refusing to rewrite this file and ` +
        `silently drop it. Move any hand-added content into an owned block, or a separate hand-written file.`,
    );
  }
}

// ============================================================
// In-memory file editing (all validation happens before any of this is
// flushed to disk — see FileStates.apply()).
// ============================================================

class FileStates {
  constructor() {
    this.states = new Map(); // absPath -> { originalText: string|undefined, currentText: string|undefined|null, relPath }
  }

  touch(absPath, relPath) {
    if (!this.states.has(absPath)) {
      const originalText = readTextIfExists(absPath);
      this.states.set(absPath, { originalText, currentText: originalText, relPath });
    }
    return this.states.get(absPath);
  }

  currentText(absPath, relPath) {
    return this.touch(absPath, relPath).currentText;
  }

  setText(absPath, relPath, text) {
    this.touch(absPath, relPath).currentText = text;
  }

  deleteFile(absPath, relPath) {
    this.touch(absPath, relPath).currentText = null;
  }

  /** Files whose planned content differs from what's currently on disk. */
  changed() {
    return [...this.states.entries()]
      .filter(([, s]) => s.currentText !== s.originalText)
      .map(([absPath, s]) => ({ absPath, relPath: s.relPath, before: s.originalText, after: s.currentText }));
  }

  /**
   * CR-014: flushes every planned change to disk, staging each write to a
   * temp file + `renameSync` (atomic on POSIX/NTFS for same-directory
   * renames — no reader ever observes a partially-written file) and, if any
   * operation in the sequence throws (disk full, permissions, ...), rolling
   * back every already-applied write/unlink before re-throwing — restoring
   * `before` (re-creating a deleted file, rewriting a written one, or
   * deleting a file that didn't exist before this call) so a failure
   * mid-loop never leaves a half-merged tree. `before`/`after` were already
   * captured by `touch()`/`setText()`/`deleteFile()` during planning, well
   * before any of this runs, so the rollback data needs no extra work here.
   * Not a true multi-file transaction (no filesystem gives us one across
   * several independent paths) — but every individual file transitions
   * atomically, and a failure partway through the set is fully undone
   * rather than left half-applied.
   */
  apply() {
    const changes = this.changed();
    const applied = []; // { absPath, before } for every change flushed so far
    try {
      for (const { absPath, before, after } of changes) {
        if (after === null) {
          if (before !== undefined) unlinkSync(absPath);
        } else {
          mkdirSync(path.dirname(absPath), { recursive: true });
          const tmpPath = `${absPath}.shapes-merge-tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
          writeFileSync(tmpPath, after, "utf8");
          renameSync(tmpPath, absPath);
        }
        applied.push({ absPath, before });
      }
    } catch (err) {
      for (const { absPath, before } of applied.reverse()) {
        try {
          if (before === undefined) {
            if (existsSync(absPath)) unlinkSync(absPath);
          } else {
            mkdirSync(path.dirname(absPath), { recursive: true });
            writeFileSync(absPath, before, "utf8");
          }
        } catch {
          // Best-effort rollback — surface the original failure below
          // regardless of whether every restore succeeded.
        }
      }
      throw err;
    }
  }
}

// ============================================================
// Diffing (no new dependencies — a small LCS-based line diff)
// ============================================================

function diffLines(oldText, newText) {
  const a = oldText == null ? [] : oldText.split("\n");
  const b = newText == null ? [] : newText.split("\n");
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "ctx", line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "del", line: a[i] });
      i++;
    } else {
      ops.push({ type: "add", line: b[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: "del", line: a[i] });
    i++;
  }
  while (j < m) {
    ops.push({ type: "add", line: b[j] });
    j++;
  }
  return ops;
}

function formatUnifiedDiff(relPath, oldText, newText) {
  if (oldText === newText) return "";
  if (oldText === undefined) {
    const body = (newText ?? "").split("\n").map((l) => `+${l}`).join("\n");
    return `--- /dev/null\n+++ b/${relPath}\n${body}\n`;
  }
  if (newText === null) {
    const body = oldText.split("\n").map((l) => `-${l}`).join("\n");
    return `--- a/${relPath}\n+++ /dev/null\n${body}\n`;
  }
  const ops = diffLines(oldText, newText);
  const body = ops
    .map((op) => (op.type === "ctx" ? ` ${op.line}` : op.type === "del" ? `-${op.line}` : `+${op.line}`))
    .join("\n");
  return `--- a/${relPath}\n+++ b/${relPath}\n${body}\n`;
}

// ============================================================
// Per-kind required-field validation (spec §6.2 rule 4)
// ============================================================

// Per-kind required fields (mirrors `validateRequiredFields` below and the
// `ChordShape`/`ScaleShape`/`ArpeggioShape` interfaces in `src/shape.ts`) —
// also doubles as the "may an `UpdateChange.unset` entry name this field"
// deny list: unsetting a required field would produce a shape
// `validateRequiredFields`/the audit can't rescue, so it's refused up front
// rather than left to fail later with a less specific message.
const REQUIRED_FIELDS_BY_KIND = {
  chord: ["name", "system", "strings", "fingers", "barres", "rootString"],
  scale: ["name", "system", "strings", "rootString"],
  arpeggio: ["name", "system", "strings", "rootString", "chordType"],
};

function validateRequiredFields(kind, shape, tuningLength) {
  const errors = [];
  const requireNonEmptyString = (field) => {
    if (typeof shape[field] !== "string" || shape[field].trim() === "") {
      errors.push(`shape.${field} must be a non-empty string`);
    }
  };

  requireNonEmptyString("name");
  requireNonEmptyString("system");

  if (!Array.isArray(shape.strings)) {
    errors.push("shape.strings must be an array");
  } else if (kind === "chord") {
    if (shape.strings.length !== tuningLength) {
      errors.push(
        `shape.strings length (${shape.strings.length}) must equal the changeset tuning length (${tuningLength})`,
      );
    }
    if (shape.strings.some((s) => s !== null && typeof s !== "string")) {
      errors.push("chord shape.strings entries must each be a string interval or null");
    }
  } else {
    if (shape.strings.some((s) => s !== null && !Array.isArray(s))) {
      errors.push("scale/arpeggio shape.strings entries must each be a string[] or null");
    }
  }

  if (kind === "chord") {
    if (!Array.isArray(shape.fingers)) {
      errors.push("shape.fingers must be an array");
    } else if (Array.isArray(shape.strings) && shape.fingers.length !== shape.strings.length) {
      errors.push(
        `shape.fingers length (${shape.fingers.length}) must equal shape.strings length (${shape.strings.length})`,
      );
    }
    if (!Array.isArray(shape.barres)) {
      errors.push("shape.barres must be an array");
    }
  }

  if (typeof shape.rootString !== "number" || !Number.isInteger(shape.rootString)) {
    errors.push("shape.rootString must be an integer");
  } else if (Array.isArray(shape.strings) && (shape.rootString < 0 || shape.rootString >= shape.strings.length)) {
    errors.push(`shape.rootString (${shape.rootString}) is out of range [0, ${shape.strings.length - 1}]`);
  }

  if (kind === "arpeggio") {
    if (typeof shape.chordType !== "string" || shape.chordType.trim() === "") {
      errors.push("arpeggio shape.chordType is required and must be a non-empty string");
    }
  }

  return errors;
}

// ============================================================
// Merge planning — every validation from spec §6.2, in order, all before
// any write. Returns a plan the caller can print (--dry-run/--check) or
// flush to disk (default / real merge). Throws MergeRefusal on the first
// failing validation category.
// ============================================================

async function planMerge(changeset, ctx) {
  const { library, root, force } = ctx;
  const dataDir = path.join(root, "src/data");
  const indexPath = path.join(root, "src/index.ts");
  const dataTestPath = path.join(root, "src/data/data.test.ts");
  const indexTestPath = path.join(root, "src/index.test.ts");

  const files = new FileStates();
  const warnings = [];
  const outputs = new Map(); // ident -> full rendered "export const ..." text

  // ---- structural sanity (JSON shape) ------------------------------------
  if (!Array.isArray(changeset.changes) || changeset.changes.length === 0) {
    throw new MergeRefusal("structure", "changeset.changes must be a non-empty array");
  }

  // ---- rule 1: $schema ----------------------------------------------------
  if (changeset.$schema !== "tonal-guitar/changeset@1") {
    throw new MergeRefusal(
      "schema",
      `invalid $schema: expected "tonal-guitar/changeset@1", got ${JSON.stringify(changeset.$schema)}`,
    );
  }

  // ---- rule 2: version drift ----------------------------------------------
  if (changeset.version !== library.VERSION) {
    if (!force) {
      throw new MergeRefusal(
        "version-drift",
        `version drift: changeset was authored against "${changeset.version}", the ` +
          `library is currently at "${library.VERSION}" (pass --force to override)`,
      );
    }
    warnings.push(
      `--force: proceeding despite version drift ("${changeset.version}" !== "${library.VERSION}")`,
    );
  }

  // ---- rule 3: tuning -------------------------------------------------------
  if (!deepEqualArray(changeset.tuning, library.STANDARD)) {
    if (!force) {
      throw new MergeRefusal(
        "tuning-mismatch",
        `unsupported tuning: changeset.tuning must equal STANDARD [${library.STANDARD.join(", ")}], ` +
          `got [${(changeset.tuning ?? []).join(", ")}] (pass --force to override)`,
      );
    }
    warnings.push("--force: proceeding despite a non-STANDARD changeset.tuning");
  }

  const addChanges = changeset.changes.filter((c) => c.op === "add");
  const updateChanges = changeset.changes.filter((c) => c.op === "update");
  const removeChanges = changeset.changes.filter((c) => c.op === "remove");
  for (const c of changeset.changes) {
    if (c.op !== "add" && c.op !== "update" && c.op !== "remove") {
      throw new MergeRefusal("structure", `unknown change op: ${JSON.stringify(c.op)}`);
    }
    if (c.kind !== "chord" && c.kind !== "scale" && c.kind !== "arpeggio") {
      throw new MergeRefusal("structure", `unknown change kind: ${JSON.stringify(c.kind)}`);
    }
  }

  // ---- ident validation (CR-017) -------------------------------------------
  // An explicit `ident` (`AddChange.ident`, or the undocumented
  // `UpdateChange.ident` the rename fallback above honors) must round-trip
  // through BOTH `scripts/lib/owned-blocks.mjs`'s marker grammar
  // (`[A-Za-z0-9_-]+`) AND JS identifier syntax — their intersection
  // excludes `$` (valid JS, not a valid marker character), hyphens, and a
  // leading digit (valid marker characters, not valid JS). An ident outside
  // that intersection would either never parse as a marker (so its block
  // becomes invisible to every future merge and gets silently destroyed by
  // the next `add` to the same file) or produce invalid TypeScript.
  const IDENT_GRAMMAR = /^[A-Za-z_][A-Za-z0-9_]*$/;
  for (const change of changeset.changes) {
    if (typeof change.ident === "string" && !IDENT_GRAMMAR.test(change.ident)) {
      throw new MergeRefusal(
        "invalid-ident",
        `${change.op} ${change.kind} "${change.shape?.name ?? change.name}": ident ${JSON.stringify(change.ident)} ` +
          `must match ${IDENT_GRAMMAR} — the intersection of the owned-block marker grammar and JS identifier ` +
          `syntax (no "$", hyphens, or leading digit)`,
      );
    }
  }

  // ---- rule 4: per-kind required fields (add only) -------------------------
  for (const change of addChanges) {
    const errors = validateRequiredFields(change.kind, change.shape ?? {}, changeset.tuning.length);
    if (errors.length > 0) {
      throw new MergeRefusal(
        "required-fields",
        `add ${change.kind} "${change.shape?.name ?? "?"}": ${errors.join("; ")}`,
      );
    }
  }

  // ---- unset validation (update only, changeset@1's additive `unset` field) -
  // Refused BEFORE any write: an `unset` entry may never name a per-kind
  // required field (unsetting `rootString`/`name`/... would produce a shape
  // no audit can rescue) nor a field also present in the SAME change's
  // `patch` (setting and clearing the same field in one update is
  // contradictory — which one would "win" is undefined).
  for (const change of updateChanges) {
    const unset = change.unset ?? [];
    if (!Array.isArray(unset) || unset.some((field) => typeof field !== "string")) {
      throw new MergeRefusal(
        "structure",
        `update ${change.kind} "${change.name}": unset must be a string[]`,
      );
    }
    const required = REQUIRED_FIELDS_BY_KIND[change.kind] ?? [];
    const patch = change.patch ?? {};
    for (const field of unset) {
      if (required.includes(field)) {
        throw new MergeRefusal(
          "required-fields",
          `update ${change.kind} "${change.name}": cannot unset "${field}" — it is a required field for ${change.kind} shapes`,
        );
      }
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        throw new MergeRefusal(
          "unset-conflict",
          `update ${change.kind} "${change.name}": "${field}" appears in both patch and unset — contradictory`,
        );
      }
    }
  }

  // ---- rule 9: update/remove targets must live in a generator-owned region -
  // (moved ahead of rules 5-8 in this implementation, out of numeric order:
  // locating the owned region is also how this script determines whether an
  // update/remove target exists at all — spec §6.1's "name must resolve to
  // exactly one registered shape" doc contract on UpdateChange/RemoveChange —
  // and rule 8's audit needs the resolved base object below. Rule 9's own
  // refusal (not-owned / not-found) fires first as a structural
  // prerequisite; every other numbered rule keeps its documented order.)
  const dataFileList = listDataFiles(dataDir);
  const regionByChange = new Map();
  // CR-022: a `remove` whose target is already absent is satisfied (a
  // no-op), not a refusal — the same idempotence contract every other op
  // already gets (spec §6.6). `update` keeps refusing on an unresolvable
  // name (there's no well-defined "already updated to nothing" state to
  // treat as satisfied).
  const alreadySatisfiedRemoves = new Set();
  for (const change of [...updateChanges, ...removeChanges]) {
    // CR-020: kind-aware — `change.kind` filters candidate owned blocks so a
    // chord and a scale sharing a `name` can never resolve to each other's
    // block.
    let region = locateOwnedRegion(dataDir, dataFileList, change.name, change.kind);
    if (region === undefined && change.op === "update") {
      // Rename fallback (oversight fix C) — see resolveRenamedUpdateRegion's
      // doc comment: a prior run may have already applied a `patch.name`
      // rename, so the change's original `name` no longer resolves.
      region = resolveRenamedUpdateRegion(dataDir, dataFileList, change);
    }
    if (region === undefined) {
      if (change.op === "remove") {
        alreadySatisfiedRemoves.add(change);
        continue;
      }
      throw new MergeRefusal(
        "unowned-region",
        `${change.op} ${change.kind} "${change.name}": not found in any src/data/*.ts file`,
      );
    }
    if (!region.managed || !region.insideBlock) {
      throw new MergeRefusal(
        "unowned-region",
        `${change.op} ${change.kind} "${change.name}": lives in src/data/${region.file}.ts, which is not ` +
          `a generator-owned file — hand-edit it directly (unmanaged files: open-chords, extended-chords, ` +
          `caged-chords-7th, jazz-shells stay unmanaged in MVP)`,
      );
    }
    if (change.op === "remove" && region.file === "caged-chords") {
      throw new MergeRefusal(
        "unowned-region",
        `remove ${change.kind} "${change.name}": src/data/caged-chords.ts is a hand-written allow-listed ` +
          `file managed only via "update" — removing a constant would strand its hand-written registration ` +
          `array. Remove it by hand instead.`,
      );
    }
    regionByChange.set(change, region);
  }

  // Base object for each `update`: parsed back from the *current* owned
  // block's printed object literal (safe: renderShape only ever prints
  // JSON-safe values — strings/numbers/booleans/null/arrays/plain objects —
  // never functions or computed expressions), not the live dist import.
  // This keeps `update` correct against whatever `--root` actually holds on
  // disk right now, rather than requiring the target repo's `dist` to be
  // rebuilt after every merge (fixture tests never touch the real dist).
  const baseByUpdate = new Map();
  for (const change of updateChanges) {
    const region = regionByChange.get(change);
    const absPath = path.join(dataDir, `${region.file}.ts`);
    const block = findOwnedBlock(readFileSync(absPath, "utf8"), region.ident);
    baseByUpdate.set(change, parseShapeLiteral(block.content));
  }

  // Same recovery, for `remove` — computeCountsTouched (oversight fix B)
  // needs the removed shape's full field set (voicingFamily/system/
  // featured/…) to know which family/system/featured-scoped count markers
  // it invalidates, not just its `kind`.
  const baseByRemove = new Map();
  for (const change of removeChanges) {
    if (alreadySatisfiedRemoves.has(change)) continue; // CR-022: nothing to recover — already absent
    const region = regionByChange.get(change);
    const absPath = path.join(dataDir, `${region.file}.ts`);
    const block = findOwnedBlock(readFileSync(absPath, "utf8"), region.ident);
    baseByRemove.set(change, parseShapeLiteral(block.content));
  }

  // ---- rule 5: file naming + computed-file deny list (add only) -----------
  for (const change of addChanges) {
    if (!/^[a-z0-9-]+$/.test(change.file ?? "")) {
      throw new MergeRefusal(
        "file-name",
        `add ${change.kind} "${change.shape?.name}": file ${JSON.stringify(change.file)} must match /^[a-z0-9-]+$/`,
      );
    }
    if (COMPUTED_FILE_DENY_LIST.has(change.file)) {
      // Refused unconditionally — even with --force (spec §6.2 rule 5, §9.8).
      throw new MergeRefusal(
        "computed-file-deny-list",
        `add ${change.kind} "${change.shape?.name}": file "${change.file}" is a computed data file ` +
          `(calls relabelShape at import time) and is never a shapes:merge write target, even with --force`,
      );
    }
  }

  // ---- rule 6: name / identifier uniqueness (registry + within changeset) --
  // "The registry" here means the target tree's own src/data files (scanned
  // by kind + export identifier), not the live dist import — see the module
  // doc comment at the top of this file. This is exactly the merge-time
  // snapshot `checkNameUnique`'s `knownNames`/`knownIdentifiers` options
  // exist for.
  //
  // Each add's own target file is excluded from its own scan: re-running an
  // already-merged `add` targets the same file/identifier it wrote last
  // time, which must be idempotent (spec §6.6 "re-running the same
  // changeset produces zero diff"), not a self-collision. A name/identifier
  // that exists in a DIFFERENT file is still a real collision.
  const changesetNames = { chord: new Set(), scale: new Set(), arpeggio: new Set() };
  const changesetIdentifiers = new Set();
  const identByChange = new Map();

  for (const change of addChanges) {
    const otherFiles = dataFileList.filter((f) => basenameOf(f) !== change.file);
    const { byKind: registeredByKind, identifiers: knownIdentifiers } = scanRegisteredShapes(dataDir, otherFiles);
    const knownNames = new Set([...registeredByKind[change.kind], ...changesetNames[change.kind]]);
    const known = new Set([...knownIdentifiers, ...changesetIdentifiers]);
    // checkNameUnique derives the identifier it checks from shape.name alone
    // (exportIdentifierFor(kind, shape)) — it has no way to know about an
    // AddChange.ident override, so a custom shorthand ident (e.g.
    // "CAGED_CHORD_EM") needs its own explicit collision check below.
    const issues = library.checkNameUnique(change.shape, change.kind, {
      knownNames,
      knownIdentifiers: known,
    });
    if (issues.length > 0) {
      throw new MergeRefusal(
        "name-unique",
        issues.map((i) => i.message).join("; "),
      );
    }
    const ident = change.ident ?? scriptExportIdentifierFor(change.kind, change.shape);
    if (change.ident !== undefined && known.has(ident)) {
      throw new MergeRefusal(
        "name-unique",
        `add ${change.kind} "${change.shape.name}": explicit ident "${ident}" collides with an existing ` +
          `src/data export identifier`,
      );
    }
    identByChange.set(change, ident);
    changesetNames[change.kind].add(change.shape.name);
    changesetIdentifiers.add(ident);
  }

  // ---- rule 6b (CR-019): a renaming `update` must not collide -------------
  // Rule 6 above only scans `add` changes — `patch.name` renames (supported
  // since `packages/shape-catalog/src/changeset.ts`'s `draftToChange`) were
  // never checked for uniqueness on the merge side, so a rename onto an
  // already-registered name merged cleanly into a duplicate registration.
  // Scans the same src/data snapshot rule 6 uses (not the live registry —
  // see the module doc comment), excluding the shape's own current entry
  // (identified via `baseByUpdate`, whose `name` is already the target on
  // an idempotent re-run) so this never self-collides.
  for (const change of updateChanges) {
    const newName = change.patch?.name;
    if (typeof newName !== "string" || newName === change.name) continue;
    const { byKind } = scanRegisteredShapes(dataDir, dataFileList);
    const ownCurrentName = baseByUpdate.get(change)?.name;
    const collides = byKind[change.kind].has(newName) && ownCurrentName !== newName;
    if (collides) {
      throw new MergeRefusal(
        "name-unique",
        `update ${change.kind} "${change.name}": renaming to "${newName}" collides with an existing ` +
          `${change.kind} already registered under that name`,
      );
    }
  }

  // ---- rule 7: overrides targets must exist (registry or same changeset) --
  const { byKind: allRegisteredByKind } = scanRegisteredShapes(dataDir, dataFileList);
  const addedNamesByKind = { chord: new Set(), scale: new Set(), arpeggio: new Set() };
  for (const change of addChanges) addedNamesByKind[change.kind].add(change.shape.name);

  for (const change of addChanges) {
    const overrides = change.shape.overrides;
    if (overrides === undefined) continue;
    if (!allRegisteredByKind[change.kind].has(overrides) && !addedNamesByKind[change.kind].has(overrides)) {
      throw new MergeRefusal(
        "overrides-target",
        `add ${change.kind} "${change.shape.name}": overrides target "${overrides}" not found in the ` +
          `${change.kind} registry or elsewhere in this changeset`,
      );
    }
  }
  for (const change of updateChanges) {
    if (!("overrides" in (change.patch ?? {})) || change.patch.overrides === undefined) continue;
    if (
      !allRegisteredByKind[change.kind].has(change.patch.overrides) &&
      !addedNamesByKind[change.kind].has(change.patch.overrides)
    ) {
      throw new MergeRefusal(
        "overrides-target",
        `update ${change.kind} "${change.name}": overrides target "${change.patch.overrides}" not found in ` +
          `the ${change.kind} registry or elsewhere in this changeset`,
      );
    }
  }

  // ---- CR-023: inbound-reference validation (mirrors rule 7's style) ------
  // Rule 7 above refuses an OUTBOUND `overrides`/`parentShape` reference to a
  // missing target; this refuses removing a shape (or renaming it away from
  // its current name) while some OTHER shape's `overrides`/`parentShape`
  // still points at that name, which would otherwise leave a dangling
  // reference behind. Two exemptions, both "this same changeset already
  // handles it": a referrer that's ALSO being removed here won't be around
  // to dangle, and a referrer whose OWN `update` in this changeset touches
  // that exact field (patches it to something else, or unsets it) is
  // trusted to be a coordinated fix-up rather than an oversight.
  const inboundByKind = scanInboundReferences(dataDir, dataFileList);
  const removedNamesByKind = { chord: new Set(), scale: new Set(), arpeggio: new Set() };
  for (const change of removeChanges) removedNamesByKind[change.kind].add(change.name);
  const referenceManagedByKind = { chord: new Set(), scale: new Set(), arpeggio: new Set() };
  for (const change of updateChanges) {
    const touchesRefField =
      Object.prototype.hasOwnProperty.call(change.patch ?? {}, "overrides") ||
      Object.prototype.hasOwnProperty.call(change.patch ?? {}, "parentShape") ||
      (change.unset ?? []).some((f) => f === "overrides" || f === "parentShape");
    if (touchesRefField) referenceManagedByKind[change.kind].add(change.name);
  }
  const inboundExempt = (kind, refererName) =>
    removedNamesByKind[kind].has(refererName) || referenceManagedByKind[kind].has(refererName);

  for (const change of removeChanges) {
    if (alreadySatisfiedRemoves.has(change)) continue;
    const refs = (inboundByKind[change.kind].get(change.name) ?? []).filter(
      (ref) => !inboundExempt(change.kind, ref.refererName),
    );
    if (refs.length > 0) {
      throw new MergeRefusal(
        "inbound-reference",
        `remove ${change.kind} "${change.name}": still referenced by ` +
          `${refs.map((r) => `${r.field} on "${r.refererName}"`).join(", ")} — update or remove those first`,
      );
    }
  }
  for (const change of updateChanges) {
    const newName = change.patch?.name;
    if (typeof newName !== "string" || newName === change.name) continue;
    const refs = (inboundByKind[change.kind].get(change.name) ?? []).filter(
      (ref) => !inboundExempt(change.kind, ref.refererName) && ref.refererName !== change.name,
    );
    if (refs.length > 0) {
      throw new MergeRefusal(
        "inbound-reference",
        `update ${change.kind} "${change.name}": renaming to "${newName}" would orphan a reference from ` +
          `${refs.map((r) => `${r.field} on "${r.refererName}"`).join(", ")} — update those first`,
      );
    }
  }

  // ---- rule 8: audit every added/updated shape -----------------------------
  const auditOptions = { tuning: changeset.tuning };
  function auditFor(kind, shape) {
    if (kind === "chord") return library.auditChordShapeFull(shape, auditOptions);
    if (kind === "scale") return library.auditScaleShape(shape, auditOptions);
    return [...library.auditArpeggioShape(shape, auditOptions), ...library.auditArpeggioShapeIntegration(shape, auditOptions)];
  }

  const mergedShapeByUpdate = new Map();
  const auditErrors = [];
  const auditWarnings = [];
  // CR-018: exposed alongside the audit's own already-applied detection so
  // `computeCountsTouched` below can skip re-accumulating a count delta for
  // an add that's already landed — without this, re-running an applied
  // changeset with `--update-counts` would bump an annotated count a
  // second time even though no file actually changes (spec §6.6
  // idempotence, mirroring the same guard the audit path already has).
  const alreadyAppliedByAdd = new Map();

  for (const change of addChanges) {
    // CHECK_NAME_UNIQUE is filtered for an ALREADY-APPLIED add (its ident
    // AND name are present in its own target file): once the add has merged
    // and the library has been rebuilt, the live dist registry legitimately
    // contains the shape, so the aggregate audit's registry-backed
    // name-unique check would refuse every idempotent re-run/--check (spec
    // §6.6 "re-running the same changeset produces zero diff"). A genuinely
    // NEW colliding add is unaffected — its ident/name are not yet in its
    // target file, and rule 6 above still owns merge-time uniqueness.
    const ownFile = dataFileList.filter((f) => basenameOf(f) === change.file);
    const ownScan = scanRegisteredShapes(dataDir, ownFile);
    const alreadyApplied =
      ownScan.identifiers.has(identByChange.get(change)) &&
      ownScan.byKind[change.kind].has(change.shape.name);
    alreadyAppliedByAdd.set(change, alreadyApplied);
    const issues = auditFor(change.kind, change.shape).filter(
      (issue) => !(alreadyApplied && issue.id === library.CHECK_NAME_UNIQUE),
    );
    for (const issue of issues) {
      const line = `add ${change.kind} "${change.shape.name}": [${issue.id}] ${issue.message}`;
      (issue.severity === "error" ? auditErrors : auditWarnings).push(line);
    }
  }
  for (const change of updateChanges) {
    const base = baseByUpdate.get(change);
    const merged = { ...base, ...change.patch };
    for (const field of change.unset ?? []) {
      delete merged[field];
    }
    mergedShapeByUpdate.set(change, merged);
    // CHECK_NAME_UNIQUE is filtered out here: the aggregate audit functions
    // run it unconditionally against the LIVE dist registry with no
    // knownNames/knownIdentifiers override, and `merged` is always a fresh
    // object (never `===` the registry's stored entry) — so it would flag a
    // false "already registered" collision against the very shape being
    // updated on every single run. Rule 6 above already owns name/identifier
    // uniqueness for `add`; `update` never introduces a new name/identifier.
    const issues = auditFor(change.kind, merged).filter((issue) => issue.id !== library.CHECK_NAME_UNIQUE);
    for (const issue of issues) {
      const line = `update ${change.kind} "${change.name}": [${issue.id}] ${issue.message}`;
      (issue.severity === "error" ? auditErrors : auditWarnings).push(line);
    }
  }

  if (auditErrors.length > 0) {
    throw new MergeRefusal("audit-error", auditErrors.join("\n"));
  }
  warnings.push(...auditWarnings);

  // ===========================================================================
  // All validations passed. Build the write plan (still nothing on disk yet).
  // ===========================================================================

  // -- add: group by target file --------------------------------------------
  const addsByFile = new Map();
  for (const change of addChanges) {
    if (!addsByFile.has(change.file)) addsByFile.set(change.file, []);
    addsByFile.get(change.file).push(change);
  }

  const newlyCreatedFiles = new Set();
  const importInsertions = []; // { file, after }

  for (const [fileBasename, changes] of addsByFile) {
    const absPath = path.join(dataDir, `${fileBasename}.ts`);
    const relPath = path.relative(root, absPath);
    const isNewOnDisk = !existsSync(absPath);

    let priorKind;
    let existingBlocks = [];
    if (!isNewOnDisk) {
      const source = readFileSync(absPath, "utf8");
      if (fileBasename === "caged-chords" || !isGeneratedSource(source)) {
        throw new MergeRefusal(
          "unowned-region",
          `add: cannot add new constants to src/data/${fileBasename}.ts — it is a hand-written file, not a ` +
            `generator-created file. Add to a new file instead.`,
        );
      }
      priorKind = detectGeneratedFileKind(source);
      if (priorKind !== undefined && changes.some((c) => c.kind !== priorKind)) {
        throw new MergeRefusal(
          "structure",
          `add: src/data/${fileBasename}.ts already holds "${priorKind}" shapes; cannot add a different kind`,
        );
      }
      existingBlocks = parseOwnedBlocks(source).map((b) => ({ name: b.name, content: b.content }));
      // CR-016: refuse rather than silently reconstruct if this file holds
      // anything `buildGeneratedFileText` wouldn't itself emit.
      assertReconstructible(source, priorKind ?? changes[0].kind, existingBlocks, relPath);
    }

    for (const change of changes) {
      const ident = identByChange.get(change);
      const rendered = await renderShape(change.kind, change.shape, { ident });
      outputs.set(ident, rendered);
      const body = rendered.replace(/\n$/, "");
      const idx = existingBlocks.findIndex((b) => b.name === ident);
      if (idx !== -1) {
        existingBlocks[idx] = { name: ident, content: body };
      } else {
        existingBlocks.push({ name: ident, content: body });
      }
    }

    const kind = changes[0].kind;
    const newText = buildGeneratedFileText(kind, existingBlocks);
    files.setText(absPath, relPath, newText);

    if (isNewOnDisk) {
      newlyCreatedFiles.add(fileBasename);
    }
    // CR-015: pushed unconditionally, not gated on `isNewOnDisk` — after a
    // partial failure (CR-014's rollback aside, an out-of-process
    // interruption is still possible), the data file may already exist on
    // disk while src/index.ts's import was never written, which made a
    // re-run skip this insertion entirely and left `--check` reporting a
    // false no-op. The `order.includes(file)` dedupe below keeps re-running
    // idempotent either way. Anchor for registration order (Task 17.3):
    // explicit `after`, else the file declaring the shape's parentShape,
    // else undefined (end of block).
    const change = changes[0];
    const anchor =
      change.after ?? (change.shape.parentShape ? locateShapeFile(dataDir, dataFileList, change.shape.parentShape) : undefined);
    importInsertions.push({ file: fileBasename, after: anchor });
  }

  // -- update: surgical in-place replace of the owned block ------------------
  const updated = [];
  for (const change of updateChanges) {
    const region = regionByChange.get(change);
    const merged = mergedShapeByUpdate.get(change);
    const rendered = await renderShape(change.kind, merged, { ident: region.ident });
    outputs.set(region.ident, rendered);
    const absPath = path.join(dataDir, `${region.file}.ts`);
    const relPath = path.relative(root, absPath);
    const currentText = files.currentText(absPath, relPath);
    const newText = replaceOwnedBlockContent(currentText, region.ident, rendered);
    files.setText(absPath, relPath, newText);
    updated.push(change);
  }

  // -- remove: drop the owned block; delete the file (and its import) if it
  // was the last constant in a generator-created file. --------------------
  const removedFilesNowEmpty = new Set();
  const removed = [];
  for (const change of removeChanges) {
    // CR-022: an already-absent target is satisfied — no file touched, but
    // still counted as "removed" (the final state IS removed, whether from
    // this run or an earlier one), matching how `added`/`updated` already
    // count every changeset entry regardless of idempotent no-ops.
    if (alreadySatisfiedRemoves.has(change)) {
      removed.push(change);
      continue;
    }
    const region = regionByChange.get(change);
    const absPath = path.join(dataDir, `${region.file}.ts`);
    const relPath = path.relative(root, absPath);
    const source = files.currentText(absPath, relPath);
    const blocks = parseOwnedBlocks(source).map((b) => ({ name: b.name, content: b.content }));
    const kind = detectGeneratedFileKind(source) ?? change.kind;
    // CR-016: refuse rather than silently reconstruct (or outright delete)
    // a file that holds anything `buildGeneratedFileText` wouldn't itself
    // emit — checked before deciding whether the file becomes empty
    // (deleted outright) or is rewritten with the target block dropped, so
    // unrecognized content can't be lost either way.
    assertReconstructible(source, kind, blocks, relPath);
    const remaining = blocks.filter((b) => b.name !== region.ident);
    if (remaining.length === 0) {
      files.deleteFile(absPath, relPath);
      removedFilesNowEmpty.add(region.file);
    } else {
      files.setText(absPath, relPath, buildGeneratedFileText(kind, remaining));
    }
    removed.push(change);
  }

  // -- src/index.ts data-imports block (Task 17.3) ---------------------------
  if (importInsertions.length > 0 || removedFilesNowEmpty.size > 0) {
    const indexSource = files.currentText(indexPath, path.relative(root, indexPath));
    if (indexSource === undefined) {
      throw new MergeRefusal("structure", `${path.relative(root, indexPath)} does not exist`);
    }
    const block = findOwnedBlock(indexSource, "data-imports");
    if (!block) {
      throw new MergeRefusal("structure", `${path.relative(root, indexPath)}: no "data-imports" owned block found`);
    }
    let order = [...block.content.matchAll(/import\s+"\.\/data\/([a-z0-9-]+)";/g)].map((m) => m[1]);
    for (const file of removedFilesNowEmpty) {
      order = order.filter((f) => f !== file);
    }
    for (const { file, after } of importInsertions) {
      if (order.includes(file)) continue;
      const anchorIndex = after !== undefined ? order.indexOf(after) : -1;
      if (anchorIndex !== -1) {
        order.splice(anchorIndex + 1, 0, file);
      } else {
        order.push(file);
      }
    }
    const newContent = order.map((f) => `import "./data/${f}";`).join("\n");
    const newIndexText = replaceOwnedBlockContent(indexSource, "data-imports", newContent);
    files.setText(indexPath, path.relative(root, indexPath), newIndexText);
  }

  // -- test-count reporting / --update-counts (spec §6.4, task 17.5) --------
  const countsTouched = computeCountsTouched({
    changeset,
    addChanges,
    removeChanges,
    baseByRemove,
    alreadyAppliedByAdd,
    dataTestPath,
    indexTestPath,
    files,
    root,
    applyEdits: ctx.updateCounts,
  });

  return {
    files,
    outputs,
    warnings,
    added: addChanges.length,
    updated: updated.length,
    removed: removed.length,
    countsTouched,
    identByChange,
  };
}

const TYPE_TO_KIND = { ChordShape: "chord", ScaleShape: "scale", ArpeggioShape: "arpeggio" };

/**
 * Scans every `<dataDir>/*.ts` file (managed or not) for every top-level
 * `export const IDENT: (ChordShape|ScaleShape|ArpeggioShape) = { ... }`
 * declaration, bucketing each declared shape's `name` field by kind and
 * collecting every export identifier — the merge-time snapshot rule 6/7 use
 * in place of the live dist registry (see module doc comment).
 */
function scanRegisteredShapes(dataDir, files) {
  const byKind = { chord: new Set(), scale: new Set(), arpeggio: new Set() };
  const identifiers = new Set();
  for (const file of files) {
    const source = readFileSync(path.join(dataDir, file), "utf8");
    const declPattern = /export const ([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*(ChordShape|ScaleShape|ArpeggioShape)\s*=/g;
    const matches = [...source.matchAll(declPattern)];
    matches.forEach((m, i) => {
      identifiers.add(m[1]);
      const kind = TYPE_TO_KIND[m[2]];
      const start = m.index;
      const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
      const nameMatch = source.slice(start, end).match(/name:\s*"((?:[^"\\]|\\.)*)"/);
      if (kind && nameMatch) byKind[kind].add(JSON.parse(`"${nameMatch[1]}"`));
    });
  }
  return { byKind, identifiers };
}

/**
 * CR-023: the inbound half of rule 7's outbound `overrides`/`parentShape`
 * check — scans every declared shape for those two string fields and
 * indexes them by the TARGET name they reference (bucketed by the
 * REFERRER's kind, since both fields are same-kind), so
 * `remove`/renaming-`update` planning can look up "who still points at
 * this name" before dropping/renaming it.
 */
function scanInboundReferences(dataDir, files) {
  const byKind = { chord: new Map(), scale: new Map(), arpeggio: new Map() };
  for (const file of files) {
    const source = readFileSync(path.join(dataDir, file), "utf8");
    const declPattern = /export const ([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*(ChordShape|ScaleShape|ArpeggioShape)\s*=/g;
    const matches = [...source.matchAll(declPattern)];
    matches.forEach((m, i) => {
      const kind = TYPE_TO_KIND[m[2]];
      if (!kind) return;
      const start = m.index;
      const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
      const chunk = source.slice(start, end);
      const nameMatch = chunk.match(/name:\s*"((?:[^"\\]|\\.)*)"/);
      const refererName = nameMatch ? JSON.parse(`"${nameMatch[1]}"`) : undefined;
      if (refererName === undefined) return;
      for (const field of ["overrides", "parentShape"]) {
        const fieldMatch = chunk.match(new RegExp(`${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
        if (!fieldMatch) continue;
        const target = JSON.parse(`"${fieldMatch[1]}"`);
        const list = byKind[kind].get(target) ?? [];
        list.push({ refererName, field });
        byKind[kind].set(target, list);
      }
    });
  }
  return byKind;
}

/**
 * Recovers the plain JS shape object printed by `renderShape` inside an
 * owned block's content (`export const IDENT: Type = { ... };`). Safe
 * because `renderShape` only ever prints JSON-safe literals — strings,
 * numbers, booleans, null, arrays, plain objects — never functions or
 * computed expressions (mirrors the `evalPrintedShape` helper this test
 * suite already relies on in scripts/lib/render-shape.test.mjs).
 */
function parseShapeLiteral(blockContent) {
  const match = blockContent.match(/=\s*([\s\S]*);\s*$/);
  if (!match) {
    throw new Error("parseShapeLiteral: could not locate an object literal in owned block content");
  }
  return (0, eval)(`(${match[1]})`);
}

function computeCountsTouched({
  addChanges,
  removeChanges,
  baseByRemove,
  alreadyAppliedByAdd,
  dataTestPath,
  indexTestPath,
  files,
  root,
  applyEdits,
}) {
  const deltas = new Map(); // markerName -> delta
  function accumulate(shape, kind, delta) {
    for (const [name, predicate] of Object.entries(COUNT_RULES)) {
      if (predicate(shape, kind)) {
        deltas.set(name, (deltas.get(name) ?? 0) + delta);
      }
    }
  }
  // CR-018: skip an add that's already applied — the same guard the rule-8
  // audit loop uses (`alreadyAppliedByAdd`, computed there). Without this,
  // re-running an already-merged changeset with `--update-counts` bumped
  // the annotated count a second time even though `renderShape`'s output
  // (and so the data file) doesn't change at all on that re-run — breaking
  // the §6.6 idempotence contract specifically for `--update-counts`.
  for (const change of addChanges) {
    if (alreadyAppliedByAdd.get(change)) continue;
    accumulate(change.shape, change.kind, 1);
  }
  // `update` (patch OR unset) never touches a count — same conservative
  // default either way: a `patch.featured` value flip already doesn't
  // invalidate `featured-*-total` today, so an `unset` of `featured` is
  // treated identically, not as a new special case. See the module doc
  // comment on COUNT_RULES above.
  //
  // remove changes carry only a `name` on the changeset itself, but the
  // removed shape's full field set (voicingFamily/system/featured/…) is
  // recoverable from its owned-block content before the block is dropped
  // — see `baseByRemove`, built the same way `update`'s base object is
  // (oversight fix B) — so every count rule, not just the kind-only ones,
  // gets evaluated for a remove. CR-022: a remove already satisfied before
  // this run has no entry in `baseByRemove` (nothing left to recover) — its
  // count was already decremented on the run that actually removed it, so
  // it's skipped here rather than double-decrementing.
  for (const change of removeChanges) {
    const base = baseByRemove.get(change);
    if (base === undefined) continue;
    accumulate(base, change.kind, -1);
  }

  if (deltas.size === 0) return [];

  const touched = [];
  for (const [testPath, relLabel] of [
    [dataTestPath, path.relative(root, dataTestPath)],
    [indexTestPath, path.relative(root, indexTestPath)],
  ]) {
    if (!existsSync(testPath)) continue;
    const originalSource = readFileSync(testPath, "utf8");
    const markers = parseCountMarkers(originalSource);
    let workingSource = originalSource;
    let mutated = false;
    for (const marker of markers) {
      const delta = deltas.get(marker.name);
      if (delta === undefined || delta === 0) continue;
      const simple = marker.lineText.match(SIMPLE_COUNT_CALL);
      const entry = {
        file: relLabel,
        line: marker.line,
        name: marker.name,
        delta,
        editable: Boolean(simple),
      };
      if (simple) {
        const from = Number(simple[2]);
        const to = from + delta;
        entry.from = from;
        entry.to = to;
        if (applyEdits) {
          const newLineText = marker.lineText.replace(SIMPLE_COUNT_CALL, `$1(${to})`);
          workingSource = workingSource
            .split("\n")
            .map((line, idx) => (idx + 1 === marker.line ? newLineText : line))
            .join("\n");
          mutated = true;
        }
      }
      touched.push(entry);
    }
    if (mutated) {
      files.setText(testPath, relLabel, workingSource);
    }
  }
  return touched;
}

// ============================================================
// Console / JSON output (spec §6.6)
// ============================================================

function printPlanSummary(plan) {
  console.log(`✔ ${plan.added} shape(s) added, ${plan.updated} updated, ${plan.removed} removed`);
  const changedFiles = plan.files.changed();
  for (const { relPath, after } of changedFiles) {
    console.log(`  ${after === null ? "delete" : "write "} ${relPath}`);
  }
  const errorCount = 0; // any audit error would have refused the merge already
  const warningCount = plan.warnings.filter((w) => !w.startsWith("--force")).length;
  console.log(`✔ audit: ${errorCount} errors, ${warningCount} warnings in changed shapes`);
  for (const warning of plan.warnings) {
    console.log(`  ! ${warning}`);
  }
  if (plan.countsTouched.length > 0) {
    console.log("test counts touched:");
    for (const c of plan.countsTouched) {
      if (c.editable) {
        console.log(`  ${c.file}:${c.line} ${c.name} ${c.from} -> ${c.to}`);
      } else {
        console.log(`  ${c.file}:${c.line} ${c.name} (complex expression — review manually)`);
      }
    }
  }
  console.log("→ review with: git diff --stat");
  console.log("Undo: git checkout -- src/data");
}

function toJsonSummary(plan) {
  return {
    added: plan.added,
    updated: plan.updated,
    removed: plan.removed,
    filesWritten: plan.files.changed().map((f) => f.relPath),
    warnings: plan.warnings,
    countsTouched: plan.countsTouched,
  };
}

// ============================================================
// Main
// ============================================================

async function loadLibrary() {
  const url = pathToFileURL(path.join(SCRIPT_REPO_ROOT, "dist/index.mjs"));
  try {
    return await import(url.href);
  } catch (err) {
    throw new Error(
      `shapes-merge: could not import ${url.href} — run "npm run build" first.\n${err.message}`,
    );
  }
}

export async function runMerge(argv) {
  const args = parseArgs(argv);
  const root = args.root ? path.resolve(args.root) : SCRIPT_REPO_ROOT;
  const changesetPath = path.resolve(args.changesetPath);

  let changeset;
  try {
    changeset = JSON.parse(readFileSync(changesetPath, "utf8"));
  } catch (err) {
    throw new MergeRefusal("structure", `could not read/parse ${changesetPath}: ${err.message}`);
  }

  const library = await loadLibrary();
  const plan = await planMerge(changeset, { library, root, force: args.force, updateCounts: args.updateCounts });

  if (args.out !== undefined) {
    const text = plan.outputs.get(args.out);
    if (text === undefined) {
      throw new MergeRefusal(
        "structure",
        `--out ${args.out}: no add/update change in this changeset resolved to that identifier`,
      );
    }
    process.stdout.write(text);
    return { mode: "out", plan };
  }

  const changedFiles = plan.files.changed();

  if (args.check) {
    if (changedFiles.length === 0) {
      if (args.json) {
        console.log(JSON.stringify({ ok: true, ...toJsonSummary(plan) }, null, 2));
      } else {
        console.log("✔ working tree already reflects this changeset (no-op)");
      }
      return { mode: "check", ok: true, plan };
    }
    if (args.json) {
      console.log(JSON.stringify({ ok: false, ...toJsonSummary(plan) }, null, 2));
    } else {
      console.error("✘ --check: working tree does NOT reflect this changeset yet:");
      for (const f of changedFiles) {
        console.error(formatUnifiedDiff(f.relPath, f.before, f.after));
      }
    }
    return { mode: "check", ok: false, plan };
  }

  if (args.dryRun) {
    if (args.json) {
      console.log(JSON.stringify({ dryRun: true, ...toJsonSummary(plan) }, null, 2));
    } else {
      for (const f of changedFiles) {
        const diff = formatUnifiedDiff(f.relPath, f.before, f.after);
        if (diff) console.log(diff);
      }
      console.log(`files that will change (${changedFiles.length}):`);
      for (const f of changedFiles) console.log(`  ${f.relPath}`);
      printPlanSummary(plan);
    }
    return { mode: "dry-run", plan };
  }

  // Real merge: flush the plan to disk.
  plan.files.apply();
  if (args.json) {
    console.log(JSON.stringify(toJsonSummary(plan), null, 2));
  } else {
    printPlanSummary(plan);
  }
  return { mode: "merge", plan };
}

async function main() {
  try {
    const result = await runMerge(process.argv.slice(2));
    if (result.mode === "check" && !result.ok) {
      process.exitCode = 1;
    }
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(err.message);
      process.exitCode = 2;
      return;
    }
    if (err instanceof MergeRefusal) {
      console.error(`✘ shapes-merge refused (${err.rule}):\n${err.message}`);
      process.exitCode = 1;
      return;
    }
    console.error(err.stack ?? String(err));
    process.exitCode = 1;
  }
}

const isMain = (() => {
  try {
    return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? "");
  } catch {
    return false;
  }
})();

if (isMain) {
  main();
}

export { MergeRefusal, UsageError };
