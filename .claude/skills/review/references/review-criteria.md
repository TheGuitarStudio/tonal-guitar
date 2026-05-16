# Review Criteria

Consolidated review criteria organized by domain. Each section lists items with their severity
and the phase(s) where they are evaluated.

---

## 1. Architecture (Phase 3)

### Dependency Direction

- **[Critical]** Packages must never import from apps. Apps can import from any package.
- **[Critical]** No circular dependencies between packages.
- **[Important]** Use `@tonal-guitar/*` path aliases for cross-package imports, never relative paths across package boundaries.
- **[Important]** Within apps, use `@/` alias or relative imports — not `../../../packages/`.

### Separation of Concerns

- **[Critical]** Business logic must not live in UI components. Extract to hooks, utilities, or API procedures.
- **[Important]** Database queries belong in `packages/api` or `packages/db`, not in apps.
- **[Important]** Validation schemas belong in `packages/validation`, not co-located with components or routes.
- **[Suggestion]** Keep component files focused on rendering; extract complex logic to custom hooks.

### Router Organization

- **[Important]** tRPC routers grouped by resource in `packages/api/src/routers/`.
- **[Important]** Each router file exports a single router with related procedures.
- **[Suggestion]** Avoid deeply nested router structures — prefer flat resource-based routing.

### Component Structure

- **[Important]** Feature components in `apps/web/src/components/features/`.
- **[Important]** Shared UI primitives in `packages/ui/`.
- **[Important]** Layout components in `apps/web/src/components/layout/`.
- **[Suggestion]** Co-locate component tests and stories with the component file.

### State Management

- **[Important]** Server state via TanStack Query hooks in `apps/web/src/hooks/queries/`.
- **[Important]** Client state via Zustand stores in `apps/web/src/hooks/stores/`.
- **[Critical]** Never duplicate server state in client stores — use TanStack Query as the source of truth.
- **[Suggestion]** Prefer component-local state when data doesn't need to be shared.

---

## 2. Code Quality (Phase 5)

### Dead Code

- **[Important]** Remove unused imports, variables, functions, and components.
- **[Important]** Remove commented-out code blocks — use version control instead.
- **[Suggestion]** Remove unused type definitions and interfaces.

### Complexity

- **[Important]** Functions should not exceed ~50 lines. Extract sub-functions if longer.
- **[Important]** Avoid nesting deeper than 3 levels (if/for/try). Use early returns or extract functions.
- **[Suggestion]** Reduce cyclomatic complexity — prefer guard clauses over deeply nested conditionals.

### DRY Violations

- **[Important]** Extract duplicated logic (3+ similar blocks) into shared utilities or hooks.
- **[Suggestion]** Look for repeated patterns across components that could be abstracted into a shared component.
- **[Suggestion]** But avoid premature abstraction — three similar lines is better than one premature helper.

### Naming

- **[Important]** Variables and functions use camelCase. Components use PascalCase. Files use kebab-case.
- **[Important]** Names should reveal intent — avoid abbreviations and single-letter variables outside loops.
- **[Suggestion]** Boolean variables should read as questions: `isLoading`, `hasPermission`, `canEdit`.

### Comments

- **[Important]** Comments explain "why", not "what". Code should be self-documenting.
- **[Important]** Remove stale comments that no longer match the code.
- **[Suggestion]** Don't add comments to code you didn't change during this review.

---

## 3. Type Safety (Phase 7)

### No `any`

- **[Critical]** Never use `any`. Use `unknown` with type guards, or define proper types.
- **[Critical]** Avoid `as any` type assertions — they bypass the type system entirely.
- **[Important]** If `unknown` is needed, add a type guard function or Zod parse before using the value.

### Zod/TypeScript Alignment

- **[Critical]** Zod schemas in `packages/validation` must match Prisma model fields.
- **[Important]** Use `z.infer<typeof schema>` for type inference — don't manually duplicate types.
- **[Important]** Form field names must match Zod schema keys and Prisma model fields.

### Return Types

- **[Suggestion]** Exported functions should have explicit return types for better documentation and safety.
- **[Suggestion]** tRPC procedures benefit from explicit return types for client-side inference.

### Null Safety

- **[Important]** Handle nullable values explicitly. Avoid non-null assertions (`!`) unless truly safe.
- **[Important]** Use optional chaining (`?.`) and nullish coalescing (`??`) appropriately.
- **[Suggestion]** Prefer early returns for null checks over deeply nested conditionals.

### Type Assertions

- **[Important]** Minimize `as Type` assertions. Prefer type narrowing (type guards, `instanceof`, `in` checks).
- **[Critical]** Never use `as` to narrow from `unknown` without validation — use Zod or type guards.

---

## 4. Security (Phase 7)

### SQL Injection

- **[Critical]** Never use raw SQL with string interpolation. Use Prisma's parameterized queries.
- **[Critical]** If `$queryRaw` is needed, always use tagged template literals: `` prisma.$queryRaw`...` ``

### Authentication & Authorization

- **[Critical]** All data-modifying endpoints must use `protectedProcedure` (requires auth).
- **[Critical]** Verify resource ownership: `where: { userId: ctx.user.id }` in all queries.
- **[Important]** Public procedures should only expose non-sensitive, read-only data.

### XSS Prevention

- **[Critical]** Never use `dangerouslySetInnerHTML` without sanitization.
- **[Important]** Sanitize user-generated content before rendering.
- **[Important]** Validate and sanitize URL parameters before use.

### Sensitive Data

- **[Critical]** Never log passwords, tokens, or API keys.
- **[Critical]** Never expose internal error details (stack traces, DB errors) to clients.
- **[Important]** Environment variables with secrets must not be prefixed with `VITE_` (would expose to client).

### Input Validation

- **[Critical]** All API inputs must be validated with Zod schemas from `packages/validation`.
- **[Important]** Validate file uploads: check size, type, and sanitize filenames.
- **[Important]** Rate-limit endpoints that accept user input.

---

## 5. Accessibility (Phase 7)

### Semantic HTML

- **[Important]** Use semantic elements: `<nav>`, `<main>`, `<section>`, `<article>`, `<button>`, `<a>`.
- **[Important]** Don't use `<div>` with click handlers — use `<button>` for actions, `<a>` for navigation.
- **[Suggestion]** Use heading levels (`h1`-`h6`) in proper hierarchical order.

### Keyboard Navigation

- **[Important]** All interactive elements must be keyboard accessible (focusable, operable).
- **[Important]** Visible focus indicators on all focusable elements.
- **[Important]** Logical tab order — don't use positive `tabIndex` values.
- **[Suggestion]** Support common keyboard shortcuts (Escape to close modals, Enter to submit).

### ARIA Labels

- **[Important]** Icon-only buttons must have `aria-label` or visually hidden text.
- **[Important]** Form inputs must have associated `<label>` elements or `aria-label`.
- **[Suggestion]** Use `aria-live` regions for dynamic content updates (toasts, loading states).

### Color Contrast

- **[Important]** Text must meet WCAG AA contrast ratios: 4.5:1 for normal text, 3:1 for large text.
- **[Suggestion]** Don't rely solely on color to convey information — add icons or text labels.

### Screen Reader

- **[Important]** Images have meaningful `alt` text (or `alt=""` for decorative images).
- **[Suggestion]** Use `aria-describedby` for complex elements that need additional context.
- **[Suggestion]** Test with screen reader to verify content makes sense when read linearly.

---

## 6. Performance (Phase 3 + Phase 5)

### Database Queries (Phase 3)

- **[Critical]** No N+1 query patterns. Use Prisma `include` or `select` to load relations in one query.
- **[Important]** Use `select` to fetch only needed fields for list views.
- **[Important]** Add pagination for any query that could return unbounded results.
- **[Suggestion]** Consider database indexes for frequently filtered/sorted columns.

### React Rendering (Phase 5)

- **[Important]** Memoize expensive computations with `useMemo` when inputs change infrequently.
- **[Important]** Use `useCallback` for functions passed to memoized children or effect dependencies.
- **[Important]** Avoid creating objects/arrays in JSX props — they cause unnecessary re-renders.
- **[Suggestion]** Split large components to isolate expensive renders from cheap ones.

### Bundle Size (Phase 5)

- **[Important]** Use dynamic `import()` for routes and heavy components.
- **[Important]** Avoid importing entire libraries when only specific functions are needed.
- **[Suggestion]** Check for duplicate dependencies across packages.

---

## 7. React Patterns (Phase 5)

### Composition

- **[Important]** Prefer composition over prop drilling — use `children`, render props, or context.
- **[Important]** Use compound components for related UI elements (e.g., Card + CardHeader + CardContent).
- **[Suggestion]** Extract reusable layout patterns into composition components.

### Hooks

- **[Important]** Custom hooks should start with `use` and follow the rules of hooks.
- **[Important]** Keep hooks focused — one responsibility per hook.
- **[Important]** Don't call hooks conditionally or inside loops.
- **[Suggestion]** Extract complex state logic into custom hooks for reusability and testing.

### State Management Patterns

- **[Important]** Derive state when possible instead of syncing with `useEffect`.
- **[Important]** Lift state only as high as needed — not higher.
- **[Critical]** Don't use `useEffect` for transforming data that could be computed during render.

### Component Structure

- **[Important]** Separate container (data-fetching) components from presentational components.
- **[Suggestion]** Keep component files under ~200 lines. Extract sub-components if longer.
- **[Suggestion]** Props interfaces should be defined near the component, not in a separate types file.

---

## 8. API Patterns (Phase 3 + Phase 5)

### tRPC Procedures (Phase 3)

- **[Important]** Queries for read operations, mutations for write operations.
- **[Important]** Input validated with Zod schemas from `@tonal-guitar/validation`.
- **[Important]** Use `protectedProcedure` for authenticated endpoints.
- **[Suggestion]** Group related procedures in domain-specific routers.

### Data Loading (Phase 5)

- **[Important]** Use TanStack Query hooks for server state management.
- **[Important]** Handle loading, error, and empty states in all data-fetching components.
- **[Suggestion]** Use `initialData` or `placeholderData` for better perceived performance.
- **[Suggestion]** Implement optimistic updates for mutations that should feel instant.

### Error Handling (Phase 3)

- **[Critical]** All procedures must handle errors with appropriate tRPC error codes.
- **[Important]** User-facing error messages should be clear and actionable.
- **[Important]** Log server-side errors with sufficient context for debugging.
- **[Suggestion]** Use error boundaries to catch and display React rendering errors.

---

## 9. Database Patterns (Phase 3)

### Schema Conventions

- **[Important]** Models use PascalCase. Fields use camelCase.
- **[Important]** All models have `id`, `createdAt`, `updatedAt` fields.
- **[Important]** Use `@default(cuid())` for ID generation.
- **[Suggestion]** Add `@@index` for fields commonly used in `where` clauses.

### Relations

- **[Important]** Define both sides of relations (parent has children, child references parent).
- **[Important]** Use `onDelete: Cascade` or `onDelete: SetNull` explicitly — don't rely on defaults.
- **[Suggestion]** Document complex relations with comments in the schema.

### Migrations

- **[Critical]** If `schema.prisma` has changed, a corresponding migration file must exist. Schema changes without migrations will break production deployments.
- **[Important]** Migration names should be descriptive (e.g., `add-user-avatar-column`, not `update`).
- **[Important]** Destructive migrations (dropping columns/tables) must have a data migration plan or confirmation that the data is no longer needed.

### Query Safety

- **[Critical]** Always scope queries by `userId` for multi-tenant data isolation.
- **[Important]** Use transactions for operations that modify multiple related records.
- **[Suggestion]** Use `findUniqueOrThrow` / `findFirstOrThrow` when the record must exist.

---

## 10. Testing (Phase 5)

### Coverage Strategy

- **[Important]** Test core user flows end-to-end, not individual implementation details.
- **[Important]** Test API procedures with realistic input data and edge cases.
- **[Suggestion]** Focus on behavior, not implementation — test what the code does, not how.

### Test Quality

- **[Important]** Tests should be independent — no shared mutable state between tests.
- **[Important]** Use descriptive test names that explain the expected behavior.
- **[Important]** Avoid testing framework internals or third-party library behavior.
- **[Suggestion]** Use factories or fixtures for test data instead of inline object literals.

### What NOT to Test

- **[Suggestion]** Skip trivial getters/setters and type definitions.
- **[Suggestion]** Don't test Prisma queries directly — test the procedures that use them.
- **[Suggestion]** Don't test UI components that are purely presentational with no logic.
