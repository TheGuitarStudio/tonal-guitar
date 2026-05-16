# Brainstorming Protocol

Structured brainstorming guide for the `/idea` skill. Follow this protocol during interactive
brainstorming sessions to ensure ideas are well-explored before capture.

---

## Session Structure

A brainstorming session has three phases: **Explore**, **Refine**, **Capture**.

### Phase 1: Explore (Divergent)

Goal: Understand the problem space broadly. Ask open-ended questions.

**Opening questions (pick 2-3 relevant ones):**

1. **The Problem:** "What pain point or frustration does this address? When does it come up?"
2. **The User:** "Who experiences this? Is it all users or a specific workflow?"
3. **The Trigger:** "What made you think of this? Did something specific happen?"
4. **The Current State:** "How do users handle this today? What's the workaround?"
5. **The Dream:** "If this worked perfectly, what would it look like?"

**Exploration prompts:**

- "What would this look like in the simplest possible version?"
- "Are there other apps that do something similar? What do you like/dislike about their approach?"
- "How often would someone use this? Daily? Weekly? Once?"
- "What happens if we don't build this?"

### Phase 2: Refine (Convergent)

Goal: Narrow to a specific, actionable idea. Challenge assumptions.

**Scoping questions:**

1. **Size check:** "Is this a single feature, a feature set, or a whole new area of the app?"
2. **Dependency check:** "Does this depend on anything we haven't built yet?"
3. **Effort check:** "Does this feel like it's an XS (a day), S (a few days), M (a week), L (2 weeks), or XL (a month+)?"
4. **Priority check:** "Where does this fit relative to what we're working on now?"

**Feasibility probes:**

- Read the codebase for existing patterns that support this idea
- Check `docs/product/roadmap.md` for related planned work
- Check `docs/product/mission.md` for alignment with product direction
- Look at existing `.tonal-guitar/features/` for related features

**Challenge prompts:**

- "What's the simplest version that still provides value?"
- "Could this be a configuration of an existing feature instead?"
- "What would make this NOT worth building?"
- "Is there a way to validate this idea before full implementation?"

**Explore approaches:**

Before converging on a direction, present 2-3 different approaches with trade-offs:

- Propose each approach with a short description and key trade-offs
- Lead with your recommended approach and explain why
- Use multiple choice questions when the approaches are distinct
- Let the user pick or combine elements from different approaches
- YAGNI: ruthlessly cut features that aren't core to the problem

### Phase 3: Capture (Synthesis)

Goal: Distill the conversation into a structured idea document.

1. Summarize the problem and proposed solution in 2-3 sentences
2. List 2-4 user stories
3. Note key open questions or unknowns
4. Assess rough size and priority
5. Identify connections to existing features or roadmap items
6. Format using the [idea issue template](../templates/idea-issue-template.md)

---

## Brainstorming Principles

1. **Start broad, then narrow.** Don't jump to solutions in Phase 1.
2. **"Yes, and..." before "No, but..."** Build on ideas before critiquing them.
3. **Concrete over abstract.** Use user stories and scenarios, not abstract descriptions.
4. **Name the unknowns.** It's OK to not have all answers — capture what's unknown.
5. **Small over big.** Bias toward the smallest useful version of an idea.
6. **Connect to existing work.** Reference what exists in the codebase and roadmap.

---

## Anti-Patterns

- **Solutioning too early:** Jumping to implementation details before the problem is clear
- **Scope creep:** Trying to capture everything in one idea — split into multiple if needed
- **Vague capture:** "Make it better" — always specify what "better" means concretely
- **Ignoring context:** Not checking the roadmap or existing features for overlap
- **Overcomplicating:** Adding features to the idea that aren't core to the problem

---

## Reflection Sessions (`--reflect`)

When continuing an existing idea:

1. Re-read the current idea content
2. Ask: "What's changed since we last discussed this?"
3. Ask: "Are there new questions or concerns?"
4. Apply Phase 2 (Refine) prompts to the existing idea
5. Update the idea with new insights, resolved questions, or refined scope
6. If the idea has grown significantly, suggest splitting into multiple ideas
