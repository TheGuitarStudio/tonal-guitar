/**
 * The single read-only/editing switch for every `shape-library-ui` component
 * (spec §5.3, D-002). Every component in this package renders read-only by
 * default — no `ShapeLibraryProvider` in the tree, or a provider whose
 * `capabilities.edit` is `undefined`, must never emit an element carrying
 * `data-tg-edit`, and a board gap cell must render as an inert
 * `<div data-tg-gap>` rather than a `<button>`.
 *
 * The docs site never passes `edit`; the Shape Workbench always does. There
 * is no dev-server sniffing and no separate entry points — the same
 * component tree serves both surfaces by threading these props through.
 *
 * Zero `next/*`, zero `window` access at module scope or during render —
 * `createContext`'s default value below is a plain object literal, safe
 * under `renderToString` and Next's `output: "export"` prerender.
 */
import { createContext, createElement, useContext, type ReactNode } from "react";
import type { CagedPosition } from "tonal-guitar";
import type { BoardSlot, ShapeCatalogEntry } from "shape-catalog";

export interface DraftBadgeInfo {
  label: string;
  status: "draft" | "in-changeset";
}

export interface EditCapabilities {
  onCreateShape?(slot: BoardSlot): void;
  onEditShape?(entry: ShapeCatalogEntry): void;
  onDuplicateToPosition?(entry: ShapeCatalogEntry, position: CagedPosition): void;
  onAddTag?(entry: ShapeCatalogEntry, tag: string): void;
  draftFor?(slotKey: string): DraftBadgeInfo | undefined;
  exportState?: { pendingCount: number; onExport(): void };
}

export interface LibraryCapabilities {
  edit?: EditCapabilities;
  reportIssueUrl?(entry: ShapeCatalogEntry): string;
}

/** Module-scope constant — never recreated per render, so components that
 * depend on referential stability of "no capabilities" (e.g. memoized
 * children) don't re-render on every provider-less mount. */
const NO_CAPABILITIES: LibraryCapabilities = {};

const LibraryCapabilitiesContext = createContext<LibraryCapabilities>(NO_CAPABILITIES);

export interface ShapeLibraryProviderProps {
  capabilities?: LibraryCapabilities;
  children?: ReactNode;
}

/**
 * Injects `capabilities` for every `shape-library-ui` component beneath it.
 * Omitting `capabilities` (or the whole provider) is equivalent to
 * `capabilities.edit === undefined` — the read-only default.
 */
export function ShapeLibraryProvider({
  capabilities = NO_CAPABILITIES,
  children,
}: ShapeLibraryProviderProps) {
  return createElement(LibraryCapabilitiesContext.Provider, { value: capabilities }, children);
}

/** Reads the nearest `ShapeLibraryProvider`'s capabilities, defaulting to
 * `{}` (no `edit`, no `reportIssueUrl`) when rendered outside one. */
export function useLibraryCapabilities(): LibraryCapabilities {
  return useContext(LibraryCapabilitiesContext);
}
