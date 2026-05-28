// Pure helpers — no React imports
import { get, buildFrettedScale } from "tonal-guitar";
import type { FrettedScale } from "tonal-guitar";
import {
  effectiveModeForSystem,
  isModeCompatibleWithSystem,
  parentRoot,
} from "fretboard-ui";
import type { PipelineRecipe } from "./codeGen";

export function rebuildScale(
  recipe: PipelineRecipe,
  tuning: string[],
): FrettedScale | null {
  // Step 1: resolve shape from registry
  const shape = get(recipe.shapeName);
  if (!shape) return null;

  // Step 2: compute modal root derivation (reproduces PipelineBuilder.tsx:134-140)
  const compatible = isModeCompatibleWithSystem(recipe.modeId, recipe.shapeSystem);
  const effectiveMode =
    effectiveModeForSystem(recipe.modeId, recipe.shapeSystem) ?? recipe.modeId;
  const buildRoot = compatible
    ? (parentRoot(recipe.root, effectiveMode) ?? recipe.root)
    : recipe.root;

  // Step 3: build and return the fretted scale
  const result = buildFrettedScale(shape, buildRoot, tuning, {
    allowOpenStrings: recipe.showOpenStrings,
  });
  return result.empty ? null : result;
}
