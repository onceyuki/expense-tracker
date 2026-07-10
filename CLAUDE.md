# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ledgerly — a full-stack budget & expense tracker (Vue 3 frontend, Express/Prisma backend). Built from [project-spec.md](project-spec.md); see [README.md](README.md) for the full feature list and API overview.

## Commands

Backend (`cd backend`):
```bash
npm run dev              # API on :4000 (nodemon)
npm test                 # vitest run — full suite, isolated SQLite test db
npm test -- expenses     # run a single test file (matches tests/expenses.test.js)
npx prisma migrate dev   # create/update SQLite dev db + run seed
npm run seed             # re-run prisma/seed.js manually
```

Frontend (`cd frontend`):
```bash
npm run dev    # Vite dev server on :5173, proxies /api to :4000
npm run build
npm test       # vitest run (component + store tests)
```

Demo login: `demo@example.com` / `Password123!`.

## Architecture

**Backend** (`backend/src`, ESM, Express 4): layered as `routes` → `middleware/validate` (Zod) → `controllers` → `services` → `prisma`. Routes define the Zod request schemas inline and pass them to `validate()`; controllers stay thin and delegate business logic to `services`. `statsService.js` is the shared aggregation layer behind the dashboard, analytics, and reports endpoints — look there first for anything involving computed totals/percentages. Auth is stateless JWT: a short-lived access token is returned in the response body (client sends it as `Authorization: Bearer`), and a rotating refresh token lives in an httpOnly cookie (`requireAuth` middleware in `middleware/auth.js` only checks the bearer token; refresh-cookie handling is in `authRoutes`/`authService`).

Two Prisma schemas exist on purpose: `prisma/schema.prisma` (SQLite, used for dev/tests) and `prisma/schema.postgres.prisma` (Postgres, swapped in by the Docker backend image at boot since the datasource provider can't be templated from an env var). When changing the data model, update both schema files.

Categories are per-user data (`Category` model: `userId`, `name`, `color`), not a hardcoded enum — see `categoryService.js`. `DEFAULT_CATEGORIES` in `utils/constants.js` is only the starter set seeded onto a new user at registration (`authService.register`) and is unrelated to `seed.js`'s own richer 11-category demo set. Expense/budget `category` fields are plain validated strings (`assertCategoryExists`), not FKs — deleting a category is blocked while it's still referenced by an expense/budget, and renaming one cascades the new name onto existing expenses/budgets (`categoryService.updateCategory`).

Tests (`backend/tests/*.test.js`, Vitest + Supertest) run against a real isolated SQLite file (`test.db`), reset via `tests/setup/globalSetup.js` (`prisma db push --force-reset`) — not mocked. `fileParallelism` is disabled in `vitest.config.js` because SQLite write-locks across test files; keep new test files independent of execution order. `tests/helpers.js` has `createTestUser()` for getting an authed request context.

**Frontend** (`frontend/src`, Composition API only): Pinia stores (`stores/`) own all server state and API calls per domain (auth, expenses, income, budgets, dashboard, analytics); pages/components read from stores rather than calling `services/api.js` directly. `services/api.js` is a single axios instance that attaches the bearer token from `sessionStorage`/`localStorage` (session vs. "remember me") and auto-refreshes on a 401 by POSTing `/auth/refresh`, deduping concurrent refreshes through a shared in-flight promise before retrying the original request. Router guards in `router/index.js` gate on `meta.requiresAuth`/`meta.guest` and call `auth.fetchMe()` on first load if a token is present but no user is loaded yet.

## Non-obvious gotchas

- `validate.js` assigns parsed query params to `req.validatedQuery` instead of reassigning `req.query`, because `req.query` is a getter-only property — controllers must read `req.validatedQuery`, not `req.query`, for anything that went through query validation.
- Both Prisma schema files must stay in sync manually (see Architecture above) — there's no automation enforcing it.
- SQLite doesn't support Prisma's `createMany({ skipDuplicates: true })` — `categoryService.seedDefaultCategories` relies on running only once (right after user creation) instead.
- Category chip/chart colors are per-category hex values stored in the database, not Tailwind classes — Tailwind's JIT can't pick up class names built from runtime strings, so `utils/format.js`'s `categoryChipStyle()` and the doughnut chart apply the hex via inline `style`, not `:class`.
