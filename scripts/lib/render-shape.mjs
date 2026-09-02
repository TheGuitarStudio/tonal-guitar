/**
 * Single TS printer for chord/scale/arpeggio shape constants (shape-workbench
 * spec §6.5). This module is the ONE place that owns:
 *
 *   - export identifier naming (`exportIdentifierFor`)
 *   - key order for the printed object literal
 *   - string/number/null quoting and literal formatting
 *   - overall statement formatting (indentation, line-wrapping, trailing
 *     commas)
 *
 * `packages/shape-catalog` re-exports `renderShape` (as `renderShapeTs`) so
 * the Shape Workbench's "Copy TS" output and `scripts/shapes-merge.mjs`'s
 * generated `src/data/*.ts` source are byte-identical — never reimplement
 * this printer elsewhere.
 *
 * Zero required runtime dependencies: `prettier` is used opportunistically
 * (it is already a `devDependency`, see package.json) when it can be
 * `import()`-ed; when it cannot (e.g. this module is ever used outside this
 * repo's own `node_modules`), the printer's own deterministic formatter
 * below produces the output instead. Either way, `renderShape` is a pure
 * function of its inputs: calling it twice on the same shape produces
 * byte-identical text (spec §6.5 "output is deterministic").
 */

// ============================================================
// Identifier naming
// ============================================================

const KIND_PREFIX = /** @type {const} */ ({
  chord: "CHORD",
  scale: "SCALE",
  arpeggio: "ARPEGGIO",
});

const TYPE_NAME = /** @type {const} */ ({
  chord: "ChordShape",
  scale: "ScaleShape",
  arpeggio: "ArpeggioShape",
});

const VALID_KINDS = Object.keys(KIND_PREFIX);

function assertKind(kind) {
  if (!Object.prototype.hasOwnProperty.call(KIND_PREFIX, kind)) {
    throw new TypeError(
      `renderShape: unknown kind "${kind}" (expected one of ${VALID_KINDS.join(", ")})`
    );
  }
}

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Slugifies a shape `name` into UPPER_SNAKE_CASE: upper-cased, every run of
 * non-alphanumeric characters (apostrophes and diacritics included) collapsed
 * to a single underscore, leading and trailing underscores trimmed.
 *
 * Byte-identical to `exportIdentifierFor` in `src/shape.ts` (spec §1.8) so
 * merge-time collision checks and printed identifiers can never diverge.
 */
function upperSnake(name) {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (slug === "") {
    throw new TypeError(`exportIdentifierFor: shape name "${name}" produced an empty identifier`);
  }
  return slug;
}

/**
 * Deterministic export identifier for a shape: `<KIND_PREFIX>_<NAME_UPPER_SNAKE>`,
 * e.g. `("chord", { name: "E Shape Minor" })` -> `"CHORD_E_SHAPE_MINOR"`.
 *
 * This is NOT an attempt to derive the project's existing hand-written
 * shorthand (e.g. `CAGED_CHORD_EM`) — that requires an explicit `ident`
 * override passed to `renderShape`'s `options`. Collision detection against
 * the live registry/`src/data` is the merge script's job (spec §3.1
 * `checkNameUnique`), not this printer's.
 */
export function exportIdentifierFor(kind, shape) {
  assertKind(kind);
  if (!shape || typeof shape.name !== "string" || shape.name.trim() === "") {
    throw new TypeError("exportIdentifierFor: shape.name must be a non-empty string");
  }
  return `${KIND_PREFIX[kind]}_${upperSnake(shape.name)}`;
}

// ============================================================
// Key order
// ============================================================

// Mirrors the field declaration order in `src/shape.ts`'s `ChordShape`.
const CHORD_FIELD_ORDER = [
  "name",
  "system",
  "strings",
  "fingers",
  "barres",
  "rootString",
  "chordType",
  "inversion",
  "voicingFamily",
  "stringSet",
  "omittedIntervals",
  "canonicalRoot",
  "baseFret",
  "featured",
  "cagedPosition",
  "movable",
  "parentShape",
  "tags",
  "tuning",
  "overrides",
  "notes",
];

// Mirrors the field declaration order in `src/shape.ts`'s `ScaleShape`.
const SCALE_FIELD_ORDER = [
  "name",
  "system",
  "strings",
  "rootString",
  "span",
  "quality",
  "parentShape",
  "featured",
  "cagedPosition",
  "chordType",
  "tags",
  "tuning",
  "overrides",
  "notes",
];

// `ArpeggioShape extends ScaleShape`; inherited fields keep ScaleShape's
// order, and the arpeggio-only additions (`fingers`, `chordShape`) are
// inserted next to the `chordType` they qualify.
const ARPEGGIO_FIELD_ORDER = [
  "name",
  "system",
  "strings",
  "rootString",
  "span",
  "quality",
  "parentShape",
  "featured",
  "cagedPosition",
  "chordType",
  "fingers",
  "chordShape",
  "tags",
  "tuning",
  "overrides",
  "notes",
];

const FIELD_ORDER = /** @type {const} */ ({
  chord: CHORD_FIELD_ORDER,
  scale: SCALE_FIELD_ORDER,
  arpeggio: ARPEGGIO_FIELD_ORDER,
});

// `src/shape.ts`'s `Barre` field order.
const BARRE_KEYS = ["fret", "fromString", "toString", "finger"];

/**
 * Known keys (in canonical order) that are present and defined on `shape`,
 * followed by any keys NOT in the canonical list (alphabetized) so a shape
 * carrying a field this printer doesn't yet know about still round-trips
 * instead of being silently dropped.
 */
function collectKeys(shape, knownOrder) {
  const known = new Set(knownOrder);
  const present = knownOrder.filter(
    (key) => Object.prototype.hasOwnProperty.call(shape, key) && shape[key] !== undefined
  );
  const extra = Object.keys(shape)
    .filter((key) => !known.has(key) && shape[key] !== undefined)
    .sort();
  return [...present, ...extra];
}

/**
 * Key order for a nested plain-object value. `Barre` objects (identified by
 * their exact key set) use the declared `Barre` field order; any other
 * nested object (none exist in the current shape types, but this keeps the
 * printer forward-compatible) falls back to a sorted key order so output
 * never depends on the input object's own insertion order.
 */
function nestedObjectKeys(obj) {
  const keys = Object.keys(obj).filter((key) => obj[key] !== undefined);
  const keySet = new Set(keys);
  const isBarreLike = BARRE_KEYS.length === keySet.size && BARRE_KEYS.every((key) => keySet.has(key));
  return isBarreLike ? BARRE_KEYS.slice() : keys.sort();
}

// ============================================================
// Deterministic printer (fallback formatter, and the source prettier polishes)
// ============================================================

const PRINT_WIDTH = 80;
const INDENT_UNIT = "  ";

function indent(depth) {
  return INDENT_UNIT.repeat(depth);
}

function fitsOneLine(candidate, depth) {
  return !candidate.includes("\n") && depth * INDENT_UNIT.length + candidate.length <= PRINT_WIDTH;
}

function renderPrimitive(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  throw new TypeError(`renderShape: unsupported value in shape literal: ${JSON.stringify(value)}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function renderArray(arr, depth) {
  if (arr.length === 0) return "[]";
  const items = arr.map((item) => renderValue(item, depth + 1));
  const singleLine = `[${items.join(", ")}]`;
  if (fitsOneLine(singleLine, depth)) return singleLine;
  const body = items.map((item) => `${indent(depth + 1)}${item},`).join("\n");
  return `[\n${body}\n${indent(depth)}]`;
}

function renderNestedObject(obj, depth) {
  const keys = nestedObjectKeys(obj);
  if (keys.length === 0) return "{}";
  const items = keys.map((key) => `${key}: ${renderValue(obj[key], depth + 1)}`);
  const singleLine = `{ ${items.join(", ")} }`;
  if (fitsOneLine(singleLine, depth)) return singleLine;
  const body = keys.map((key) => `${indent(depth + 1)}${key}: ${renderValue(obj[key], depth + 1)},`).join("\n");
  return `{\n${body}\n${indent(depth)}}`;
}

function renderValue(value, depth) {
  if (value === null) return "null";
  if (Array.isArray(value)) return renderArray(value, depth);
  if (isPlainObject(value)) return renderNestedObject(value, depth);
  return renderPrimitive(value);
}

/**
 * The top-level shape object always prints one field per line (never
 * collapsed to a single line), matching the hand-written convention in
 * `src/data/caged-chords.ts` regardless of how few fields a shape carries.
 */
function renderTopLevelObject(shape, keys) {
  if (keys.length === 0) return "{}";
  const body = keys.map((key) => `${indent(1)}${key}: ${renderValue(shape[key], 1)},`).join("\n");
  return `{\n${body}\n}`;
}

function buildCandidateSource(kind, shape, ident) {
  const keys = collectKeys(shape, FIELD_ORDER[kind]);
  const body = renderTopLevelObject(shape, keys);
  return `export const ${ident}: ${TYPE_NAME[kind]} = ${body};\n`;
}

// ============================================================
// Optional prettier polish
// ============================================================

let prettierModulePromise;

function loadPrettier() {
  if (!prettierModulePromise) {
    prettierModulePromise = import("prettier").catch(() => null);
  }
  return prettierModulePromise;
}

async function tryFormatWithPrettier(source) {
  const prettier = await loadPrettier();
  if (!prettier) return null;
  try {
    const config = (await prettier.resolveConfig(process.cwd())) ?? {};
    return await prettier.format(source, { ...config, parser: "typescript" });
  } catch {
    // Any failure (missing parser support, malformed source, resolveConfig
    // error, ...) falls back to the printer's own formatting below.
    return null;
  }
}

// ============================================================
// Public API
// ============================================================

function assertShape(shape) {
  if (shape === null || typeof shape !== "object" || Array.isArray(shape)) {
    throw new TypeError("renderShape: shape must be a plain object");
  }
}

function resolveIdent(kind, shape, options) {
  if (options.ident === undefined) {
    return exportIdentifierFor(kind, shape);
  }
  if (typeof options.ident !== "string" || !IDENTIFIER_PATTERN.test(options.ident)) {
    throw new TypeError(`renderShape: options.ident "${options.ident}" is not a valid identifier`);
  }
  return options.ident;
}

/**
 * Renders a `ChordShape | ScaleShape | ArpeggioShape` object to a
 * deterministic `export const <IDENT>: <Type> = { ... };\n` TS statement.
 *
 * @param {"chord"|"scale"|"arpeggio"} kind
 * @param {Record<string, unknown>} shape
 * @param {{ ident?: string, usePrettier?: boolean }} [options]
 *   `ident` overrides the generated `exportIdentifierFor` identifier (spec
 *   §1.8/§6.1 `AddChange.ident`). `usePrettier` defaults to `true`; pass
 *   `false` to force the printer's own fallback formatting (useful for
 *   testing that fallback path deterministically without uninstalling
 *   prettier).
 * @returns {Promise<string>}
 */
export async function renderShape(kind, shape, options = {}) {
  assertKind(kind);
  assertShape(shape);
  const ident = resolveIdent(kind, shape, options);
  const candidate = buildCandidateSource(kind, shape, ident);
  if (options.usePrettier === false) {
    return candidate;
  }
  const formatted = await tryFormatWithPrettier(candidate);
  return formatted ?? candidate;
}
