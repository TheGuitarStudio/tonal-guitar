# Specification Quality Criteria

Quality criteria for evaluating feature specifications produced during Phase 2 (Shape).
Used by the synthesis agent and for external review.

---

## Completeness Criteria

### Goal Section

- [ ] States WHAT the feature does in 2-3 sentences
- [ ] States WHY the feature matters (user benefit)
- [ ] Is specific enough to evaluate success/failure

### User Stories

- [ ] Covers all primary use cases (at least 2-3 stories)
- [ ] Uses proper format: "As a {type}, I want {action} so that {benefit}"
- [ ] Stories are independent and non-overlapping
- [ ] Covers both happy path and key edge cases

### Data Model Requirements

- [ ] All new models specify fields with types and constraints
- [ ] Relations are defined with cascade behavior
- [ ] Indexes are specified for query patterns
- [ ] Table naming follows `@@map("snake_case")` convention
- [ ] Fields have appropriate defaults and optionality

### Validation Requirements

- [ ] Zod schemas defined for all input shapes
- [ ] Field constraints match data model (lengths, types, required/optional)
- [ ] TypeScript types are exported for each schema
- [ ] Error messages are descriptive

### API Requirements

- [ ] All procedures specify input and output shapes
- [ ] Error handling is defined (what errors, what codes)
- [ ] Query patterns specified (pagination, filtering, sorting)
- [ ] Authorization is addressed (user scoping)
- [ ] Procedures use `protectedProcedure` pattern

### UI Requirements

- [ ] Component hierarchy is clear (what contains what)
- [ ] Form fields are specified with validation behavior
- [ ] Interaction patterns are described (what happens on click, submit, etc.)
- [ ] Existing component library is referenced for primitives
- [ ] Responsive behavior is addressed

### Integration Points

- [ ] Navigation changes are specified
- [ ] Route definitions are listed
- [ ] State management approach is described
- [ ] Error and success feedback patterns defined (toasts, etc.)

---

## Quality Signals

### Strong Spec Indicators

- Specific field names and types (not just "a text field")
- File paths for existing code to leverage
- Edge cases identified and addressed
- Clear scope boundaries (in/out of scope)
- Builds on research findings with specific code references

### Weak Spec Indicators

- Vague requirements ("make it user-friendly")
- Missing field types or constraints
- No reference to existing patterns
- No edge cases identified
- Scope is ambiguous

---

## Evaluation Rubric

| Dimension        | Excellent                                     | Adequate                           | Needs Work                            |
| ---------------- | --------------------------------------------- | ---------------------------------- | ------------------------------------- |
| **Clarity**      | Every requirement is unambiguous and testable | Most requirements are clear        | Requirements are vague or ambiguous   |
| **Completeness** | All layers covered with specific details      | Major layers covered but some gaps | Missing entire sections               |
| **Consistency**  | No contradictions, all names/types align      | Minor inconsistencies              | Conflicting requirements              |
| **Feasibility**  | Grounded in existing code patterns            | Mostly feasible with some unknowns | Relies on non-existent infrastructure |
| **Scope**        | Clear in/out boundaries, right-sized          | Boundaries mostly clear            | Scope creep or unclear boundaries     |

---

## Common Issues to Check

1. **Field name mismatches** — Frontend form field names must match validation schema field names must match Prisma model field names
2. **Missing cascade deletes** — When a parent is deleted, what happens to children?
3. **Pagination not specified** — List endpoints need pagination from the start
4. **No error states** — What happens when things fail?
5. **Authorization gaps** — Are all queries scoped to the authenticated user?
6. **Missing indexes** — Are there query patterns that need database indexes?
7. **Type gaps** — Are all TypeScript types exported from validation schemas?
8. **Route conflicts** — Do new routes conflict with existing ones?
