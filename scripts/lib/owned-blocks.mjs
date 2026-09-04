/**
 * Parser for `shapes-merge` owned-block and count markers (shape-workbench
 * spec §6.3/§6.4).
 *
 * `scripts/shapes-merge.mjs` (Task Group 17) is the only writer of these
 * regions: it must never text-patch a hand-written file outside a marker
 * pair, and it must only rewrite a hard-coded test count when the assertion
 * line carries a `// shapes-merge:count <name>` annotation. This module is
 * the single place that knows how to find both, so the merge script and any
 * validation/tests import it rather than re-implementing the regexes.
 *
 * Marker shapes recognized here:
 *
 *   // shapes-merge:begin <IDENT>
 *   ...owned content...
 *   // shapes-merge:end <IDENT>
 *
 *   expect(x).toBe(N); // shapes-merge:count <name>
 *
 * `<IDENT>`/`<name>` are `/^[A-Za-z0-9_-]+$/` — upper-snake export
 * identifiers (`CAGED_CHORD_A`), the `data-imports` registration block, or a
 * kebab-case count-marker name (`chord-shape-total`).
 */

const MARKER_NAME = "[A-Za-z0-9_-]+";

/** Matches a full line consisting of only a `shapes-merge:begin <IDENT>` comment. */
export const BEGIN_MARKER_PATTERN = new RegExp(`^\\s*//\\s*shapes-merge:begin\\s+(${MARKER_NAME})\\s*$`);

/** Matches a full line consisting of only a `shapes-merge:end <IDENT>` comment. */
export const END_MARKER_PATTERN = new RegExp(`^\\s*//\\s*shapes-merge:end\\s+(${MARKER_NAME})\\s*$`);

/**
 * Matches a `// shapes-merge:count <name>` annotation trailing at the end of
 * a line (e.g. appended after `expect(...).toBe(8);`).
 */
export const COUNT_MARKER_PATTERN = new RegExp(`//\\s*shapes-merge:count\\s+(${MARKER_NAME})\\s*$`);

/**
 * Splits `source` into lines the way the markers are line-oriented: on
 * `\n`, tolerating a trailing `\r` from CRLF line endings.
 */
function splitLines(source) {
  return source.split("\n").map((line) => line.replace(/\r$/, ""));
}

/**
 * Parses every `// shapes-merge:begin <IDENT>` / `// shapes-merge:end
 * <IDENT>` pair in `source`. Blocks are expected to appear in a flat,
 * non-nested sequence (spec §6.3 never nests owned blocks); a begin marker
 * still open when the file ends, an end marker with no matching begin, a
 * begin/end pair whose identifiers don't match, or two blocks sharing a
 * name all throw.
 *
 * Returns blocks in source order, each as:
 *   {
 *     name,          // the <IDENT>
 *     beginLine,      // 1-based line number of the begin marker
 *     endLine,        // 1-based line number of the end marker
 *     content,        // joined text strictly between the two marker lines
 *   }
 */
export function parseOwnedBlocks(source) {
  const lines = splitLines(source);
  const blocks = [];
  let open = null;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const beginMatch = line.match(BEGIN_MARKER_PATTERN);
    if (beginMatch) {
      if (open) {
        throw new Error(
          `owned-blocks: "shapes-merge:begin ${beginMatch[1]}" at line ${lineNumber} opens ` +
            `before "shapes-merge:begin ${open.name}" (line ${open.beginLine}) was closed`,
        );
      }
      open = { name: beginMatch[1], beginLine: lineNumber, contentStart: index + 1 };
      return;
    }

    const endMatch = line.match(END_MARKER_PATTERN);
    if (endMatch) {
      const name = endMatch[1];
      if (!open) {
        throw new Error(`owned-blocks: unmatched "shapes-merge:end ${name}" at line ${lineNumber}`);
      }
      if (open.name !== name) {
        throw new Error(
          `owned-blocks: "shapes-merge:begin ${open.name}" at line ${open.beginLine} is closed by ` +
            `"shapes-merge:end ${name}" at line ${lineNumber} — names must match`,
        );
      }
      blocks.push({
        name,
        beginLine: open.beginLine,
        endLine: lineNumber,
        content: lines.slice(open.contentStart, index).join("\n"),
      });
      open = null;
    }
  });

  if (open) {
    throw new Error(`owned-blocks: unclosed "shapes-merge:begin ${open.name}" at line ${open.beginLine}`);
  }

  const seen = new Set();
  for (const block of blocks) {
    if (seen.has(block.name)) {
      throw new Error(`owned-blocks: duplicate marker name "${block.name}" (must be unique per file)`);
    }
    seen.add(block.name);
  }

  return blocks;
}

/**
 * Convenience wrapper over `parseOwnedBlocks` for looking up a single block
 * by name (e.g. an export identifier, or `"data-imports"`). Returns
 * `undefined` when no block with that name exists.
 */
export function findOwnedBlock(source, name) {
  return parseOwnedBlocks(source).find((block) => block.name === name);
}

/**
 * Parses every `// shapes-merge:count <name>` annotation in `source`,
 * returning `{ name, line, lineText }` for each in source order. Two
 * annotations sharing a `name` within the same file throw — `--update-counts`
 * (spec §6.4) resolves a count purely by name and can't disambiguate
 * duplicates.
 */
export function parseCountMarkers(source) {
  const lines = splitLines(source);
  const markers = [];

  lines.forEach((line, index) => {
    const match = line.match(COUNT_MARKER_PATTERN);
    if (match) {
      markers.push({ name: match[1], line: index + 1, lineText: line });
    }
  });

  const seen = new Set();
  for (const marker of markers) {
    if (seen.has(marker.name)) {
      throw new Error(`owned-blocks: duplicate count marker name "${marker.name}" at line ${marker.line}`);
    }
    seen.add(marker.name);
  }

  return markers;
}
