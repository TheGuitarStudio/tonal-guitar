# Agent Prompt Templates

Templates for spawning research, synthesis, and planning agents. The lead agent fills in the
`{placeholders}` before passing the prompt to the Task tool.

---

## Phase 1: Codebase Research Agent

Used for the codebase-focused research agent in the `feature-research` team.

```
You are researching the codebase for the feature: "{feature-name}"

## Feature Description

{feature-description — from raw-idea.md, issue body, or user description}

## Research Focus

Investigate the codebase to understand what exists that's relevant to this feature.
Follow these investigation areas:

### 1. Data Model Patterns
- Existing Prisma models related to this feature
- Schema conventions (@@map, @default, relations, indexes)
- Related validation schemas in packages/validation

### 2. API Patterns
- Existing tRPC routers with similar functionality
- Procedure patterns (protectedProcedure, input validation, error handling)
- Query patterns (pagination, filtering, includes)

### 3. UI Patterns
- Existing components that could be reused or extended
- Page layout patterns and navigation structure
- Form patterns (react-hook-form, zodResolver, mutations)

### 4. Related Features
- Features in .tonal-guitar/features/ that relate to this work
- Specs in docs/specs/ that are similar
- Existing code that this feature might depend on or interact with

### 5. Infrastructure
- Package structure and where new code should live
- Build and test patterns for affected packages
- Environment and configuration considerations

## Output Format

Write your findings as structured markdown following the research template format:
- Use clear headings for each investigation area
- Include specific file paths and line numbers
- Quote relevant code patterns (keep quotes concise)
- Note any gaps, risks, or dependencies discovered
- Recommend where new code should be placed

Do NOT write code. Only research and document findings.
```

---

## Phase 1: Product Research Agent

Used for the product-focused research agent in the `feature-research` team.

```
You are researching the product context for the feature: "{feature-name}"

## Feature Description

{feature-description}

## Research Focus

Investigate product documentation and project context to understand how this feature
fits into the broader product vision.

### 1. Product Alignment
- Read docs/product/mission.md for product mission and values
- Read docs/product/roadmap.md for current priorities and planned work
- Determine where this feature fits in the roadmap

### 2. Related Specifications
- Check docs/specs/ for existing specs that relate to this feature
- Check .tonal-guitar/features/ for related feature documents
- Note any dependencies or conflicts with other planned work

### 3. User Context
- What user workflows does this feature support?
- Are there existing user stories or requirements that mention this?
- What's the user impact of having vs. not having this feature?

### 4. Scope Boundaries
- What should be explicitly in scope?
- What should be explicitly out of scope?
- Are there adjacent features that should be separate efforts?

### 5. GitHub Project Context
- Check existing GitHub issues for related discussions
- Note any existing labels, milestones, or project items

## Output Format

Write your findings as structured markdown:
- Clear headings for each research area
- Specific references to documents and their content
- Assessment of product alignment (strong/moderate/weak)
- Identified dependencies and risks
- Recommended scope boundaries

Do NOT write code. Only research and document findings.
```

---

## Phase 2: Specification Synthesis Agent

Used after the interactive requirements discussion to synthesize a full specification.

```
You are synthesizing a feature specification for: "{feature-name}"

## Input Documents

Read and synthesize these documents into a cohesive specification:

### Research Findings
{path to research.md}

### Requirements (Q&A with User)
{path to requirements.md}

### Technical Decisions
{path to decisions.md}

{if review feedback exists:}
### Research Review Feedback
{path to reviews/research-review.md}

## Output Format

Produce a specification following this exact structure:

# Specification: {Feature Name}

## Goal
{2-3 sentence summary of what this feature accomplishes}

## User Stories
{Bullet list of user stories in "As a... I want... so that..." format}

## Specific Requirements

**{Layer/Category Name}**
{Detailed requirements for this layer — data model, API, UI, etc.}

## Visual Design
{UI/UX guidance — reference existing patterns, component library usage}

## Existing Code to Leverage
{Specific files and patterns to reuse, with paths}

## Out of Scope
{Explicit list of what this feature does NOT include}

## Quality Criteria

Reference the quality criteria from the spec-criteria file:
- All requirements must be specific and testable
- Data models must specify all fields with types and constraints
- API procedures must specify input/output shapes
- UI requirements must reference existing component patterns
- Edge cases must be identified and addressed

Write the specification to spec.md in the feature directory.
```

---

## Phase 3: Task Planner Agent

Used for breaking the specification into implementation tasks.

```
You are breaking down the feature specification into implementation tasks for: "{feature-name}"

## Input Documents

### Specification
{path to spec.md}

### Research
{path to research.md}

{if review feedback exists:}
### Spec Review Feedback
{path to reviews/spec-review.md}

## Task Breakdown Rules

1. **Group by layer** in this order:
   - Database Layer (Prisma schema, migrations)
   - Validation Layer (Zod schemas)
   - API Layer (tRPC routers, procedures)
   - Frontend Components (reusable UI pieces)
   - Frontend Pages (page-level integration)
   - Testing (test review and gap analysis)

2. **Each task group must include:**
   - Dependencies on other task groups
   - Numbered subtasks (N.1, N.2, etc.)
   - Acceptance criteria
   - Files to create and files to modify

3. **Task sizing guidance:**
   - Each task group should be completable in one focused session
   - If a task group has more than 8 subtasks, consider splitting
   - Testing should be integrated into each group (test-first)

4. **Follow existing patterns:**
   - Reference the project's canonical task format
   - Include specific file paths for all files to create/modify
   - Specify the test file location for each group

## Output Format

Follow the tasks template format with:
- Overview section with total task groups
- Each task group with dependencies, subtasks, acceptance criteria
- Execution order recommendation
- Files to Create and Files to Modify summary tables
- Technical Notes section with relevant patterns

Write the task breakdown to tasks.md in the feature directory.
```

---

## Phase 3: Plan Reviewer Agent

Used to verify the task breakdown against the specification.

```
You are reviewing the task breakdown for completeness against the specification.

Feature: "{feature-name}"

## Documents to Compare

### Specification
{path to spec.md}

### Task Breakdown
{path to tasks.md}

## Review Checklist

1. **Completeness:** Does every requirement in the spec have a corresponding task?
2. **Dependencies:** Are task dependencies correct? Does the execution order make sense?
3. **File coverage:** Are all files-to-create and files-to-modify listed?
4. **Test coverage:** Does each task group include test subtasks?
5. **Acceptance criteria:** Are criteria specific and verifiable?
6. **Missing work:** Are there implied requirements not covered by tasks?
7. **Sizing:** Are task groups reasonably sized (not too large or too small)?
8. **Patterns:** Do tasks reference the correct project patterns and conventions?

## Output Format

Provide a structured review:

### Coverage Analysis
- Requirements covered: N/N
- Missing coverage: {list any gaps}

### Dependency Issues
- {list any ordering problems}

### Recommendations
- {specific suggestions for improvement}

### Verdict
- PASS: Task breakdown is complete and ready for implementation
- NEEDS REVISION: {list specific items to fix}

Do NOT modify the tasks.md file. Only review and report findings.
```

---

## Placeholders Reference

| Placeholder             | Source                                      |
| ----------------------- | ------------------------------------------- |
| `{feature-name}`        | Feature title from FEATURE.md or issue      |
| `{feature-description}` | From raw-idea.md, issue body, or user input |
| `{slug}`                | Derived from feature title (kebab-case)     |
| `{path to X.md}`        | `.tonal-guitar/features/{slug}/X.md`       |
