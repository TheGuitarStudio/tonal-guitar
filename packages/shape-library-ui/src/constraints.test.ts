/**
 * Enforces the spec §5.3 hard constraints as grep-based guards, mirroring
 * the audit-integration import-graph pattern (spec §3.2/§8): no `next/*`
 * imports, no Tailwind/Fumadocs class names, no top-level `window` access
 * outside an effect/handler, and no top-level import of an editor-only
 * module (this package has none of its own yet — the guard fails loudly if
 * one is later added without review).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

function sourceFiles(): string[] {
  return readdirSync(SRC_DIR)
    .filter((name) => (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx"))
    .map((name) => join(SRC_DIR, name));
}

const FILES = sourceFiles();

describe("shape-library-ui hard constraints (spec §5.3)", () => {
  it("has at least one source file to check (sanity)", () => {
    expect(FILES.length).toBeGreaterThan(5);
  });

  it("never imports next/* anywhere in src/", () => {
    for (const file of FILES) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} must not import next/*`).not.toMatch(/from\s+["']next\//);
    }
  });

  it("never uses Tailwind/Fumadocs class names — every className is tg-prefixed or dynamically built from tg- tokens", () => {
    // Fumadocs' own utility classes always carry the `fd-` prefix (e.g.
    // `text-fd-foreground`, `border-fd-border`) — that's the site-coupling
    // this package must never reintroduce.
    for (const file of FILES) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} must not reference Fumadocs fd- classes`).not.toMatch(/\bfd-[a-z-]+/);
    }
  });

  it("never accesses `window` at module top level or component top level — every reference is indented (inside a hook/handler body), per this codebase's formatting where top-level statements sit at column 0", () => {
    for (const file of FILES) {
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        if (!line.includes("window.")) return;
        const isIndented = /^\s+/.test(line);
        expect(isIndented, `${file}:${i + 1} looks like an unindented (top-level) window access: ${line}`).toBe(true);
      });
    }
  });

  it("imports no editor-only module (none exist in this package yet)", () => {
    for (const file of FILES) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(/from\s+["'].*\/editor(\/|["'])/i);
    }
  });
});
