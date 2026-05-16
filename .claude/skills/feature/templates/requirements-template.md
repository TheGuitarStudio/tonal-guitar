# Requirements Template

Template for the Phase 2 interactive requirements gathering. The lead agent uses this
structure to guide the Q&A discussion with the user.

---

```markdown
# Requirements: {Feature Name}

## Initial Description

{Brief description of the feature from the idea or issue body.}

## Requirements Discussion

### Round 1 Questions

{Agent asks 5-8 targeted questions based on research findings.
Each question should address a specific design decision or clarification need.}

**Q1:** {Question about data model or schema design}
**Answer:** {User's response}

**Q2:** {Question about user interaction or UX approach}
**Answer:** {User's response}

**Q3:** {Question about API design or business logic}
**Answer:** {User's response}

**Q4:** {Question about scope boundaries}
**Answer:** {User's response}

**Q5:** {Question about edge cases or error handling}
**Answer:** {User's response}

### Existing Code to Reference

**Similar Features Identified:**

{List features from research that serve as patterns:}

- Feature: {name} - Path: {file path}
  - {What pattern to reuse from this feature}

### Follow-up Questions

{Additional questions that arise from the first round answers.}

**Follow-up 1:** {Clarification or deeper question}
**Answer:** {User's response}

## Visual Assets

### Files Provided:

{List any screenshots, mockups, or design files the user provides.
"No visual assets provided" if none.}

### Visual Guidance:

{Notes about visual approach — reference existing patterns, component library, etc.}

## Requirements Summary

### Functional Requirements

{Synthesized list of what the feature must do, organized by area:}

- **{Area 1}:**
  - {Requirement}
  - {Requirement}

- **{Area 2}:**
  - {Requirement}
  - {Requirement}

### Reusability Opportunities

{Existing code/patterns that can be reused:}

- {Pattern from existing feature}

### Scope Boundaries

**In Scope:**

- {What's included}

**Out of Scope:**

- {What's explicitly excluded}

### Technical Considerations

{Key technical decisions or constraints:}

- {Consideration}
```
