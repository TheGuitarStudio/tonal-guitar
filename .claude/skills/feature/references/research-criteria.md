# Research Criteria

What research agents investigate per feature type. Use this to guide the focus areas
for Phase 1 research agents.

---

## Universal Investigation Areas

These apply to every feature regardless of type:

### 1. Existing Patterns

- **Data models:** Scan `packages/db/prisma/schema.prisma` for related models, field conventions, relation patterns
- **Validation:** Scan `packages/validation/src/` for related schemas, export patterns
- **API routes:** Scan `packages/api/src/routers/` for similar procedure patterns
- **UI components:** Scan `packages/ui/src/` for reusable components at each atomic level
- **Pages:** Scan `apps/web/src/pages/` for similar page patterns and layouts

### 2. Convention Compliance

- Table naming: `@@map("snake_case")`
- ID generation: `@default(cuid())`
- Timestamps: `@default(now())` and `@updatedAt`
- Relations: `onDelete: Cascade` where appropriate
- Router patterns: `protectedProcedure`, `ctx.prisma`, `ctx.auth.userId`
- Form patterns: `react-hook-form` + `zodResolver`

### 3. Package Boundaries

- Where should new code live? (which package)
- Are there cross-package imports to consider?
- Does the feature touch source-only packages (api, db, validation, storage) that have no build step?

### 4. Related Work

- Existing features in `.tonal-guitar/features/`
- Existing specs in `docs/specs/`
- Existing product docs in `docs/product/`
- GitHub issues or project items

---

## Feature-Type Specific Areas

### Data-Heavy Features

Features that primarily involve new data models or schema changes.

**Extra investigation:**

- Existing indexes and query patterns
- Migration history and approach
- JSON field usage patterns
- Cascade delete implications
- Seed data patterns

### UI-Heavy Features

Features that primarily involve new pages or complex UI interactions.

**Extra investigation:**

- Layout templates in `packages/ui/src/templates/`
- Existing component composition patterns
- Navigation structure and routing
- Form component patterns and validation display
- Toast/notification patterns
- Responsive design approach
- Storybook story patterns

### API-Heavy Features

Features that primarily involve new API endpoints or complex business logic.

**Extra investigation:**

- Error handling patterns (TRPCError codes and messages)
- Input validation depth (what Zod schemas validate)
- Transaction patterns for multi-step operations
- Pagination and cursor patterns
- Rate limiting or auth patterns

### Integration Features

Features that connect existing systems or add cross-cutting concerns.

**Extra investigation:**

- How existing features communicate
- Shared types and interfaces
- Event patterns or side effects
- Configuration and environment variables
- External service integrations

---

## Research Output Quality Criteria

Research is high quality when it:

1. **Has specific file paths** — not just "the API router" but `packages/api/src/routers/lesson.ts:45-80`
2. **Quotes relevant patterns** — short code excerpts showing the convention to follow
3. **Identifies gaps** — what doesn't exist yet that will need to be created
4. **Notes risks** — potential conflicts, performance concerns, or breaking changes
5. **Suggests placement** — where new files and code should live, following existing structure
6. **Connects to product** — how this feature relates to the roadmap and mission
