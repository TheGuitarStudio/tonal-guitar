/**
 * D-003 vertical slice (spec §7): `/shapes` now renders the shared
 * `ShapeCard` from `shape-library-ui` instead of a local implementation.
 * This file stays in place as a thin re-export shim so existing import
 * sites (and this module's history) don't need to change — Group 29's full
 * component migration removes it once every call site imports directly
 * from `shape-library-ui`.
 */
export { ShapeCard, type ShapeCardProps } from "shape-library-ui";
