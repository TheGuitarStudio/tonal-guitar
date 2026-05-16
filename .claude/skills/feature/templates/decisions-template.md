# Decisions Template

Template for the Phase 2 decision log. Each technical decision is captured with
context, options considered, and rationale.

---

```markdown
# Decisions: {Feature Name}

Technical decisions made during the Shape phase. Each decision is numbered sequentially
(D-001, D-002, etc.) and captures the context, options, and rationale.

---

## D-001: {Decision Title}

**Context:** {What situation or question prompted this decision?}

**Options Considered:**

| Option     | Pros         | Cons            |
| ---------- | ------------ | --------------- |
| {Option A} | {advantages} | {disadvantages} |
| {Option B} | {advantages} | {disadvantages} |

**Decision:** {Which option was chosen}

**Rationale:** {Why this option was selected over alternatives}

---

## D-002: {Decision Title}

**Context:** {context}

**Options Considered:**

| Option     | Pros         | Cons            |
| ---------- | ------------ | --------------- |
| {Option A} | {advantages} | {disadvantages} |
| {Option B} | {advantages} | {disadvantages} |

**Decision:** {chosen option}

**Rationale:** {reasoning}

---

{Continue with D-003, D-004, etc. as needed}
```

---

## Decision Categories

Common categories of decisions that arise during feature shaping:

| Category        | Example Decisions                                           |
| --------------- | ----------------------------------------------------------- |
| **Data Model**  | Field types, relation patterns, indexing strategy           |
| **API Design**  | Procedure structure, input/output shapes, error handling    |
| **UI Approach** | Component composition, interaction patterns, layout choices |
| **Scope**       | What to include/exclude, MVP boundaries                     |
| **Integration** | How this feature connects to existing features              |
| **Performance** | Caching, pagination, query optimization approaches          |
| **Migration**   | How to handle existing data, backward compatibility         |

## Decision Quality Criteria

A good decision entry:

1. **Has clear context** — explains WHY the decision was needed
2. **Lists real options** — not just the chosen option, but alternatives considered
3. **Includes trade-offs** — pros and cons for each option
4. **States the rationale** — WHY this option was chosen (not just what)
5. **Is reversible-aware** — notes if the decision is easily reversible or not
