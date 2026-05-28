# Decisions: Connector lab integration

Technical decisions made during the Shape phase. Each decision is numbered
sequentially and captures the context, options, and rationale.

---

## D-001: Pass connector data via a parallel array, not via ChainEntry mutation

**Context:** `ChainEntry` was scaffolded with an optional `connector?:
FrettedNote[]` field (`ChainSection.tsx:6–23`) anticipating the connector
algorithm. With `connectSequences` now landed, the data needs to flow from
the `connectorsAndNextNotes` memo to `ChainSection`. Two paths exist: mutate
`ChainEntry.connector` on every recompute (via a derived view of chain), or
keep `ChainEntry` frozen at add-time and pass a parallel
`connectorsAndNextNotes` array.

**Options Considered:**

| Option                              | Pros                                                                                       | Cons                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Parallel `connectorsAndNextNotes` array | Frozen entries stay frozen; cleaner data flow; aligns with research recommendation         | Two state shapes (chain + parallel array) for `ChainSection` consumers; minor API surface growth                      |
| Mutate `ChainEntry.connector`       | Single state shape; uses the pre-existing field; no new prop surface                       | Re-creates entries on every recompute; defeats the freeze-at-add-time design; conflates input data with derived data |

**Decision:** Parallel `connectorsAndNextNotes` array.

**Rationale:** `ChainEntry` is intentionally frozen at add-time (label, notes,
recipe captured in `addToChain` at `PipelineBuilder.tsx:288–295`). Mutating
`.connector` on every recompute would re-create entries and conflate input
data with derived state. The parallel array is research-recommended and the
cleaner separation. Easily reversible (single prop refactor) if the API surface
ever becomes a problem. The `ChainEntry.connector` field will be removed in a
follow-up cleanup (out of scope here) or left as a noop.

---

## D-002: `connectorsAndNextNotes` memo runs unconditionally

**Context:** The memo could either run always (regardless of
`bridgeEnabled`) or gate on `bridgeEnabled === true`. Tradeoff:
toggle-on freshness vs. wasted computation when off.

**Options Considered:**

| Option              | Pros                                                                                           | Cons                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Always run          | Data is fresh the instant the toggle flips on; simpler dep array; no stale-state edge cases    | One `rebuildScale + connectSequences` call per pair on every chain change even when bridge is off   |
| Gate on `bridgeEnabled` | Skip work entirely when bridge is off                                                          | One-frame stale state on toggle-on; more complex dep array; minor cognitive overhead                |

**Decision:** Always run.

**Rationale:** Cost is negligible for the lab's typical chain size (≤5
entries). `rebuildScale` is pure and cheap (one `buildFrettedScale` call per
entry). Freshness on toggle-on is the better user experience. The
optimization is reversible if profiling ever shows it matters.

---

## D-003: Bridge toggle labeled "Bridge", visible only when chain has 2+ entries

**Context:** A new toggle must be added to the `ChainSection` header to
control bridge behavior. Decisions: label text and visibility condition.

**Options Considered:**

| Option                                | Pros                                                                  | Cons                                                                       |
| ------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `"Bridge"`, show when `chain.length ≥ 2` | Concise label; avoids rendering a no-op control on empty/single chains | Slightly less self-explanatory than a longer phrase                        |
| `"Bridge"`, always visible            | Discoverability — users see the control before adding entries          | No-op when `chain.length < 2`; clutters header                              |
| `"Continuous arc"`, conditional       | More descriptive; communicates the musical intent                     | Longer; competes for header space with note-count and existing buttons     |

**Decision:** Label `"Bridge"`, render only when `chain.length ≥ 2`.

**Rationale:** Conditional rendering keeps the header clean and prevents a
no-op control from appearing. `"Bridge"` is the term used throughout the
spec, FEATURE.md context, and `ConnectorSlot` already labels its output as
`"connector"` — consistent terminology. Discoverability is acceptable because
the toggle appears the moment a second entry is added (the only state where
it matters). Reversing this (longer label or always-on visibility) is a one-line
prop tweak.

---

## D-004: ConnectorSlot displays strategy alongside note count

**Context:** `ConnectorSlot` currently renders `"connector · {N} note(s)"` or
`"no connector (TODO)"` (`ChainSection.tsx:199–222`). The connector algorithm
returns a `ConnectorStrategy` (`"none" | "extend" | "reach-back"`). Whether to
surface the strategy in the UI was originally flagged out-of-scope but is a
trivial cost.

**Options Considered:**

| Option                  | Pros                                                                                                               | Cons                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Show strategy           | Educational transparency — users see *how* the algorithm bridged; trivial code change; aids verification harness role | Slightly more text in the slot                                              |
| Count only              | Strictly matches original scope; less to render                                                                    | Loses educational value; verification-via-lab is harder to read at a glance |

**Decision:** Show strategy. Render `"connector · {N} note{s} ({strategy})"`
when a connector exists; existing fallback when not.

**Rationale:** Lab's primary product role is a verification harness for the
connector algorithm. Showing the strategy directly fulfills that role and
costs nothing. Easily reversible — drop one prop and one substring.

---

## D-005: codeGen emits identical output as bridge-off when chain has fewer than 2 entries

**Context:** When the user enables the Bridge toggle but the chain has only
0 or 1 entry, `codeGen` must decide: emit `connectSequences`-aware code
anyway, or fall through to the bridge-off path?

**Options Considered:**

| Option                                       | Pros                                                                                              | Cons                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Emit unchanged (same as bridge-off)          | No spurious imports; no dead `connectSequences` call; matches the runtime behavior (empty connectors) | Two branches in `codeGen` for the `bridgeEnabled` case (chain length conditional)                     |
| Wrap in `connectSequences`-aware shape always | Single bridge-on emission path                                                                    | Emits an import and possibly a single-arg `connectSequences` call that the runtime never actually uses |

**Decision:** Emit unchanged. When `bridgeEnabled === true && chain.length <
2`, the generated code is identical to `bridgeEnabled === false`.

**Rationale:** No seams = no bridge = nothing to emit. The generated code is
intended to be copy-pasteable by library consumers; an unused
`connectSequences` import would be noise. The runtime behavior already
matches (a single-entry chain produces no connectors), so the codeGen
output stays faithful to runtime output.

---

## D-006: Manual verification checklist as acceptance criteria

**Context:** `site/` has no automated test infrastructure (verification is
manual; adding one is a separate, larger effort). The spec needs explicit
acceptance criteria the implementer can confirm before merging.

**Options Considered:**

| Option                                    | Pros                                                                                  | Cons                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Enumerated must-verify chains             | Concrete pass/fail criteria; covers both strategies + both edge cases                 | Manual; can drift from reality if scenarios become irrelevant                 |
| Defer to reviewer judgment                | No upfront enumeration                                                                | Acceptance becomes subjective; no traceable confirmation in the implementation |

**Decision:** Lock in four must-verify chains as acceptance criteria:

1. `E↑ → D↓` (extend strategy)
2. `E↓ → A↑` (reach-back strategy)
3. Same-direction with bridge on (expects empty connector — Decision #3
   of connector-algorithm spec holds)
4. Single-entry chain with bridge on (expects no output change; no
   `connectSequences` in codeGen)

For each scenario, the implementer toggles bridge on and off, confirms:
- `ConnectorSlot` text matches expectations (count + strategy, or fallback)
- `selectedNotes` output ASCII tab / AlphaTeX matches the expected note sequence
- `CodePreview` includes (or correctly omits) `connectSequences(...)` calls

**Rationale:** Concrete acceptance criteria are required when automated tests
don't exist. The four scenarios cover both implemented strategies (`extend`,
`reach-back`), the Decision #3 same-direction default, and the single-entry
edge case (D-005). Future contributors can re-run these chains as a smoke
test. Reversible — additional scenarios can be appended without invalidating
existing ones.
