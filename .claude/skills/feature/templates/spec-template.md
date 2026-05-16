# Specification Template

Template for the Phase 2 specification output. The synthesis agent produces this
from research, requirements, and decisions. Follows the project's canonical spec format
as established in `docs/specs/`.

---

```markdown
# Specification: {Feature Name}

## Goal

{2-3 sentence summary of what this feature accomplishes and why it matters.}

## User Stories

- As a {user type}, I want to {action} so that {benefit}
- As a {user type}, I want to {action} so that {benefit}
- As a {user type}, I want to {action} so that {benefit}

## Specific Requirements

**{Data Model / Database Layer}**

- {Detailed requirement with field names, types, constraints}
- {Relationship definitions}
- {Index requirements}
- {Migration considerations}

**{Validation Layer}**

- {Zod schema requirements with field constraints}
- {Type export requirements}
- {Shared validation patterns}

**{API Layer}**

- {tRPC procedure definitions with input/output shapes}
- {Business logic requirements}
- {Error handling requirements}
- {Query patterns (pagination, filtering, sorting)}

**{UI Components}**

- {Component requirements with props and behavior}
- {Form field specifications}
- {Interaction patterns}
- {Reusable component identification}

**{Pages / Navigation}**

- {Page requirements with routes}
- {Navigation integration}
- {Layout requirements}

## Visual Design

{UI/UX guidance for this feature:}

- {Reference existing patterns to follow}
- {Component library usage}
- {Styling approach (reference existing theme)}
- {Responsive considerations}

## Existing Code to Leverage

{Specific files and patterns to reuse:}

**{Pattern Category}**

- Located at `{file path}`
- {What to reuse and how}

## Out of Scope

- {Explicit exclusion 1}
- {Explicit exclusion 2}
- {Explicit exclusion 3}
```

---

## Spec Quality Checklist

Before finalizing, verify:

- [ ] Goal is specific and measurable
- [ ] User stories cover all primary use cases
- [ ] Data model specifies all fields with types and constraints
- [ ] API procedures specify input schemas and output shapes
- [ ] UI requirements reference existing component patterns
- [ ] Edge cases are identified and addressed in requirements
- [ ] Out of scope section explicitly excludes adjacent features
- [ ] Existing code references include file paths
- [ ] No requirements contradict each other
- [ ] Requirements are testable (can write acceptance criteria)
