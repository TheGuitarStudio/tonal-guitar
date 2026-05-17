import { describe, expect, test } from "vitest";

// ============================================================
// Task Group 1 — Module Scaffolding (spec §4.1, tasks 1.1–1.4)
// ============================================================

// 1. Import smoke: connectSequences is importable from src/connect.ts
import {
  connectSequences,
  type ChainDirection,
  type ConnectSequencesInput,
  type ConnectorOptions,
  type ConnectorStrategy,
  type ConnectSequencesResult,
} from "./connect";

// 2. Re-export smoke: all five types and connectSequences are re-exported from src/index.ts
import {
  connectSequences as connectSequencesFromIndex,
  type ChainDirection as ChainDirectionFromIndex,
  type ConnectSequencesInput as ConnectSequencesInputFromIndex,
  type ConnectorOptions as ConnectorOptionsFromIndex,
  type ConnectorStrategy as ConnectorStrategyFromIndex,
  type ConnectSequencesResult as ConnectSequencesResultFromIndex,
} from "./index";

describe("Task Group 1: Module Scaffolding", () => {
  test("connectSequences is importable from src/connect.ts without throwing at import time", () => {
    // Verify the import resolved to a function value
    expect(typeof connectSequences).toBe("function");
  });

  test("all five types compile when imported from src/connect.ts", () => {
    // Type-only check: construct values that use the imported types.
    // If any type is missing the TypeScript compiler would reject this file.
    const _direction: ChainDirection = "ascending";
    const _strategy: ConnectorStrategy = "none";

    // Minimal objects that satisfy the interfaces — proves they compile
    const _opts: ConnectorOptions = { strategy: "auto", dedupSeam: true };
    const _result: ConnectSequencesResult = {
      connector: [],
      nextNotes: [],
      strategy: "none",
    };

    // We need ConnectSequencesInput to reference FrettedScale / FrettedNote,
    // so just verify the type can be named without error.
    type _InputAlias = ConnectSequencesInput;

    expect(_direction).toBe("ascending");
    expect(_strategy).toBe("none");
    expect(_opts.strategy).toBe("auto");
    expect(_result.strategy).toBe("none");
  });

  test("connectSequences is re-exported from src/index.ts", () => {
    expect(typeof connectSequencesFromIndex).toBe("function");
    // Verify they are the same function reference
    expect(connectSequencesFromIndex).toBe(connectSequences);
  });

  test("all five types are re-exported from src/index.ts", () => {
    // Type-level check mirrored from the connect.ts test above, but using
    // the index re-exports.  Compilation failure = missing re-export.
    const _direction: ChainDirectionFromIndex = "descending";
    const _strategy: ConnectorStrategyFromIndex = "extend";
    const _opts: ConnectorOptionsFromIndex = { dedupSeam: false };
    const _result: ConnectSequencesResultFromIndex = {
      connector: [],
      nextNotes: [],
      strategy: "reach-back",
    };
    type _InputAlias = ConnectSequencesInputFromIndex;

    expect(_direction).toBe("descending");
    expect(_strategy).toBe("extend");
    expect(_opts.dedupSeam).toBe(false);
    expect(_result.strategy).toBe("reach-back");
  });
});
