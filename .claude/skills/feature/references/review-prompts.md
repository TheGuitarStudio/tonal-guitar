# External Review Prompt Templates

Templates for generating prompts to send to another LLM (ChatGPT, Gemini, etc.) for an
outside perspective on feature artifacts. Used by the `--review` flag.

The prompts point the reviewer at the file to read — they do NOT embed the file contents.
This keeps prompts short and copy-pasteable.

---

## Research Review Prompt

Generated after Phase 1 (Research) completes.

```
Review the following research document for a feature in Tonal Guitar, a practice management app for guitar students.

Read the file: .tonal-guitar/features/{slug}/research.md

Evaluate from both product and architectural perspectives:

**Product lens:**
- Are the scope boundaries well-drawn? Anything missing from MVP that should be there, or included that should be deferred?
- Do the user workflows cover the key scenarios? Any gaps?
- Are the risk assessments accurate? Any under- or over-estimated?

**Architecture lens:**
- Is the suggested code placement the right call?
- Are the identified API gaps complete? Any missing?
- Is the auth/infrastructure approach sound?
- Are there infrastructure concerns not addressed (build pipeline, testing strategy, deployment)?

**General:**
- What's unclear or underspecified?
- What would you challenge or push back on?
- What's the biggest risk that needs early validation?

Save your review to: .tonal-guitar/features/{slug}/reviews/research-review.md
```

---

## Spec Review Prompt

Generated after Phase 2 (Shape) completes.

```
Review the following feature specification for Tonal Guitar, a practice management app for guitar students.

Read these files:
- Specification: .tonal-guitar/features/{slug}/spec.md
- Decisions: .tonal-guitar/features/{slug}/decisions.md

Evaluate from product, technical, and UX perspectives:

**Product lens:**
- Are there obvious requirements missing? Things users would expect but aren't specified?
- Is the scope right-sized? Too big? Too small?

**Technical lens:**
- Do the technical decisions make sense? Are there better approaches?
- Is the data model complete? Missing fields, wrong types, missing relations or indexes?
- Are the API definitions complete? Missing endpoints, wrong input/output shapes?
- Do field names, types, and patterns align across layers (database -> validation -> API -> UI)?

**UX lens:**
- Are there usability issues with the specified interactions?
- Missing states (loading, error, empty)?
- Edge cases that aren't addressed?

**General:**
- What would you challenge or push back on?
- What's the biggest risk in this spec?

Save your review to: .tonal-guitar/features/{slug}/reviews/spec-review.md
```

---

## Tasks Review Prompt

Generated after Phase 3 (Plan) completes.

```
Review the following task breakdown for a feature in Tonal Guitar, a practice management app for guitar students.

Read these files:
- Specification (for reference): .tonal-guitar/features/{slug}/spec.md
- Task breakdown: .tonal-guitar/features/{slug}/tasks.md

Evaluate the task plan against the specification:

**Completeness:**
- Does every requirement in the spec have a corresponding task? Any gaps?
- Is there implied work that isn't captured (error handling, loading states, empty states, migrations, seed data)?

**Ordering & sizing:**
- Do dependencies make sense? Tasks that should be reordered or could run in parallel?
- Are task groups right-sized? Too large (should split)? Too small (should merge)?

**Quality:**
- Are acceptance criteria specific and verifiable?
- Does each task group include appropriate test subtasks?
- Do the files-to-create and files-to-modify lists look complete?

**General:**
- What would you change about this plan?
- What's most likely to cause problems during implementation?

Save your review to: .tonal-guitar/features/{slug}/reviews/tasks-review.md
```

---

## Usage Instructions

When the lead agent generates a review prompt:

1. Read the appropriate template above
2. Replace `{slug}` with the feature slug
3. Present the complete prompt to the user (formatted for copy-paste)
4. Tell the user:
   ```
   Copy this prompt and paste it into another Claude Code session, ChatGPT, Gemini, or another LLM.
   The prompt tells the reviewer which file to read and where to save their review.
   ```
5. The review will be automatically incorporated when the next phase runs or
   the current phase is re-run.
