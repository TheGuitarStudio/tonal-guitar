# Research Template

Template for the Phase 1 research output. The lead agent merges findings from both
research agents (codebase + product) into this structure.

---

```markdown
# Research: {Feature Name}

**Date:** {YYYY-MM-DD} | **Issue:** #{number}

---

## Codebase Research

### Relevant Data Models

{Existing Prisma models, fields, and relations that relate to this feature.
Include file paths and line numbers.}

### Relevant API Patterns

{Existing tRPC routers and procedures that are similar or related.
Note patterns to follow: protectedProcedure, input validation, error handling.
Include file paths and line numbers.}

### Relevant UI Patterns

{Existing components, pages, and layouts that can be reused or extended.
Note form patterns, navigation structure, component composition.
Include file paths.}

### Related Code

{Other code that this feature depends on or interacts with.
Include utility functions, shared types, configuration.}

### Suggested Code Placement

{Where new files should be created, following existing package structure:}

| New File    | Package   | Rationale  |
| ----------- | --------- | ---------- |
| {file path} | {package} | {why here} |

---

## Product Research

### Roadmap Alignment

{How this feature relates to the current roadmap.
Reference specific roadmap items.}

**Alignment:** {Strong | Moderate | Weak | New direction}

### Related Specifications

{Existing specs or feature docs that relate to this work:}

| Document | Relevance        |
| -------- | ---------------- |
| {path}   | {how it relates} |

### User Context

{Who benefits from this feature, what workflows it supports,
what's the user impact.}

### Scope Assessment

**In Scope:**

- {what this feature should include}

**Out of Scope:**

- {what this feature should NOT include}

**Adjacent Features (separate efforts):**

- {related features that should be their own specification}

---

## Risks & Dependencies

| Risk/Dependency | Severity | Mitigation |
| --------------- | -------- | ---------- | ---- | ---------------- |
| {description}   | {High    | Medium     | Low} | {how to address} |

## Open Questions

- {Questions that need answering during the Shape phase}
```
