# Plan Review — Connector Algorithm

**Reviewer:** `feature-dev:code-reviewer` (sonnet) | **Date:** 2026-05-17 | **Verdict:** PASS

## Coverage Analysis

**Requirements covered:** 43/44

All 8 scenario fingerprints from spec §3.4 appear in explicit test assertions
(note names, `[string, fret]` positions, `nextNotes[0]` head checks):

- Scenarios 1, 4 — Group 3 (extend)
- Scenarios 2, 3, 7 — Group 4 (reach-back)
- Scenarios 5, 6, 8 — Group 5 (integration / edge cases)

All spec §3 strategy semantics, §4 API contract, and §5 edge cases have corresponding tasks.

## Dependency Issues

None. Dependency chain is correct:

- Groups 3 and 4 both depend only on Group 2 → parallelizable
- Group 5 depends on Groups 3 and 4
- Group 6 depends on Groups 1–5

## Minor Gaps Identified (Addressed Inline)

1. **Group 3.1** — Empty-connector dedup assertion. Original wording mentioned dedup
   parenthetically; reviewer asked for an explicit test assertion. **Fixed:** added
   "Empty-connector dedup" line to Group 3.1.

2. **Group 4.1** — Reach-back dedup comparison target. Reviewer asked to lock in that
   reach-back compares against `prev.lastNote.(string, fret)`, NOT `connector.at(-1)`
   (which is undefined for reach-back). **Fixed:** expanded the `dedupSeam: false` test
   line in Group 4.1.

3. **Technical Notes** — `src/walker.ts:57` should be `:56`. **Fixed.**

4. **3NPS export names** — Reviewer flagged a lookup risk: confirm `NPS_PATTERN_1` /
   `NPS_PATTERN_2` are the actual export names. Verified in `src/data/three-nps.ts:13,27`
   — names are correct. No tasks.md change needed.

## Verdict

**PASS** — Task breakdown is complete and ready for implementation. The three minor gaps
were addressed inline; the planning artifact is now consistent with the spec's full test
contract.

## Notes for Implementation

- Group 3 and Group 4 should be dispatched in parallel by `/implement`.
- Group 6 has budget for up to 8 additional tests; reviewer's gaps fit well within that
  budget if not pre-empted by inline edits.
