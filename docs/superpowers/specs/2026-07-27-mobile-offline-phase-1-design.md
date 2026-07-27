# Offline-First Mobile App — Phase 1: Shell, Local Store & Repository Seam

**Date:** 2026-07-27
**Status:** Approved
**Phase:** 1 of 5

## Background

Why Am I Like This (Financially) is a Vue 3 + Pinia web app backed by an Express/Prisma
API. The goal is an offline-first Android app that reuses `frontend/` rather than forking
it: same pages, same stores, same components, with a local-first data layer underneath.

The full request spans five subsystems — Capacitor packaging, a local SQLite store, a
ported aggregation engine, a two-way sync engine (which requires a backend migration), and
a mobile UX rebuild. That is too much for one spec, so the work is split into five phases.
**This document covers Phase 1 only.** Later phases get their own spec and their own
review gate.

### Findings from the existing codebase

These shaped the decisions below and are recorded because they are non-obvious:

1. **Sync will require a backend migration.** Only `Expense` and `Income` carry
   `updatedAt` (`schema.prisma:121`, `:137`). `Category`, `Wallet`, `Transfer`, `Debt`,
   `SavingsGoal`, `SavingsContribution` have `createdAt` only, and **`Budget` has no
   timestamps at all**. No soft-delete column exists anywhere. An `updatedSince` cursor,
   last-write-wins, and delete propagation each need new columns. Deferred to Phase 3.
2. **IDs are `String @id @default(cuid())`**, generated server-side. The column type
   accepts any string, so client-generated IDs need no type migration — only the API's
   willingness to accept one, which is a Phase 3 change.
3. **Four unique constraints will collide across devices**: `Category[userId,name]`,
   `Wallet[userId,name]`, `SavingsGoal[userId,name]`, `Budget[userId,category,month]`.
   Two devices offline both creating "Groceries" is a guaranteed 409 that no timestamp
   policy resolves. Phase 3 problem, noted here so the local schema anticipates it.
4. **The reports endpoints are dead code in the frontend.** `/api/reports/{monthly,
   yearly,categories}` exist with PDF/XLSX output, but nothing under `frontend/src`
   references them. The only export the UI exposes is `/expenses/export` as CSV/XLSX
   (`stores/expenses.js:97`). "Reports/exports parity" is therefore one button, not three
   endpoints, unless reports are deliberately added as new mobile UI.
5. **Date bucketing is timezone-fragile today.** Dates arrive as `YYYY-MM-DD`
   (`expenseRoutes.js:16`) and hit `new Date(data.date)` (`expenseService.js:77`), which
   parses date-only strings as **UTC midnight**. Every bucket boundary, however, is built
   local-time — `monthRange` returns `new Date(2026, 6, 1)` (`budgetService.js:7`) and
   `localDayKey` reads `getDate()` (`statsService.js:12`). These agree only when the
   process runs at UTC or an eastern offset. On a server at UTC−5, July's range starts at
   `2026-07-01T05:00Z` while an expense dated July 1 is stored at `2026-07-01T00:00Z`, so
   it falls into June. The deployment runs UTC, so this is latent rather than active.

### Decisions made during brainstorming

- **Five phased specs**, not one mega-spec.
- **Repository seam** between stores and data. Two implementations (HTTP, SQLite) chosen
  at startup. Stores and pages never learn which is active. A separate `mobile/` workspace
  was considered and rejected: every future feature would be built twice and the copies
  would silently drift.
- **Client-generated UUIDv7** for records created on device. Foreign keys are correct at
  creation, so there is no temp-ID remap pass — the most bug-prone part of most sync
  engines is designed out rather than debugged later.
- **Dates stored as `YYYY-MM-DD` TEXT**, bucketed by string operations. No `Date` object
  and no timezone participates in aggregation, so output is identical on every device in
  every timezone, and matches the API wherever the server runs UTC.
- **Amounts stored as `REAL`, not integer cents.** Cents would be better in a greenfield
  app, but the API does float arithmetic then `Math.round(n*100)/100`
  (`statsService.js:5`). Matching its output exactly — including its rounding artifacts —
  requires doing the same float math.
- **Three database adapters**: native (`@capacitor-community/sqlite`), jeep-sqlite
  (dev-only, dynamically imported so it never enters the production web bundle), and
  `node:sqlite` for tests (built into Node 24, no new dependency).
- **Verification via Android Studio** on a device or emulator.
- **Offline auth moved into Phase 2**, up from Phase 5: "usable in airplane mode from
  cold start" is unreachable while a cold start with no network strands the user on a
  login screen.

### Known limitation: iOS cannot be verified here

The `ios/` project will be generated and committed, but building it requires macOS and
Xcode. On Windows that check is impossible. "iOS builds" remains an unverified claim
until someone opens it on a Mac.

## Roadmap

| Phase | Delivers | Decisions its spec settles | Backend touched |
|-------|----------|---------------------------|-----------------|
| **1** | Capacitor + Android/iOS projects, SQLite adapter, local schema, repository seam, hydrate-on-login | *(settled in this doc)* | none |
| **2** | Ported aggregations with parity tests, offline auth unlock, true offline cold start | offline unlock mechanism | none |
| **3** | Sync engine + backend migration | conflicts, tombstones, referential ordering, sync endpoint contract | **yes** |
| **4** | Mobile UX rebuild | navigation pattern, list/filter/chart patterns | none |
| **5** | Exports + hardening | on-device vs online-only exports | maybe |

Phases 1 and 2 touch **zero backend code** — deliberately, so the web app cannot regress
while the risky data work happens.

## 1. Capacitor integration

Capacitor is added to the existing `frontend/` workspace. No new package, no duplicated
dependencies.

New dependencies: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`,
`@capacitor/ios`, `@capacitor-community/sqlite`, `uuid` (v7 generation).

`capacitor.config.ts`:

```ts
{
  appId: 'com.gabatino.whyamilikethis',
  appName: 'Why Am I Like This',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: { androidIsEncryption: false },
  },
}
```

Requirements confirmed against current Capacitor docs: Node ≥ 22 (this machine has
24.16), Android Studio ≥ 2025.2.1 (which bundles the JDK — no separate install),
`minSdkVersion 24`, `compileSdkVersion 36`, `targetSdkVersion 36`.

New scripts in `frontend/package.json`:

```
"build:mobile": "vite build --mode mobile",
"sync:android": "npm run build:mobile && cap sync android",
"open:android":  "cap open android"
```

`android/` and `ios/` are committed; their build outputs (`android/app/build`,
`android/.gradle`, `ios/App/Pods`, etc.) are gitignored.

### 1.1 API base URL

`api.js` uses `baseURL: '/api'` and depends on the Vite dev proxy (`vite.config.js`).
A WebView has no proxy. The base URL becomes `import.meta.env.VITE_API_BASE_URL ?? '/api'`,
so the web build is unchanged and the mobile build points at an absolute URL. Reaching a
LAN dev server over plain HTTP additionally needs an Android network security config
permitting cleartext to that host; production points at HTTPS and does not.

### 1.2 The refresh-cookie problem

Auth issues a short-lived bearer token plus an **httpOnly refresh cookie**, and `api.js`
sets `withCredentials: true`. In a Capacitor WebView the page origin is `https://localhost`
while the API is a different origin, so that cookie is third-party — it may be silently
dropped, breaking login and refresh on device.

Phase 1 mitigation is to route native HTTP through the `CapacitorHttp` plugin, which
performs requests natively and manages cookies outside the WebView's third-party rules.
If that proves insufficient, the alternative is returning the refresh token in the
response body for native clients — **that is a backend behavior change the web app
depends on, so it would be raised as its own proposal, not made silently.**

This is the highest-risk unknown in Phase 1 and is spiked first.

### 1.3 Router redirect on 401

`api.js:47` calls `location.assign('/login')`, a full document reload. In a WebView that
reloads the whole app. It is replaced with a router navigation, which behaves identically
on web.

## 2. Layer architecture

```
pages/ + components/      unchanged
stores/*.js               unchanged in shape; call repos, never axios
  └─ data/repos/          one interface per domain
       ├─ http/           today's axios calls, lifted verbatim out of the stores
       └─ sqlite/         local reads and writes
            └─ data/db/   adapter: native | jeep-sqlite (dev) | node:sqlite (tests)
```

`data/source.js` selects the implementation once at startup and exports the active set.
Nothing above the repository line branches on platform.

### 2.1 Repository interfaces

Derived from what the stores call today, so the refactor is mechanical:

| Repo | Methods |
|------|---------|
| `expenseRepo` | `list({page,pageSize,sortBy,sortDir,...filters})` → `{items,total,page,pageSize,totalPages}`; `create`; `update`; `remove`; `duplicate`; `listAllForExport(filters)` |
| `incomeRepo` | `list`, `create`, `update`, `remove` |
| `budgetRepo` | `list(month)`, `create`, `update`, `remove` |
| `categoryRepo` | `list`, `create`, `update`, `remove` |
| `walletRepo` | `list()` (balances computed), `create`, `update`, `remove` |
| `transferRepo` | `list({page,pageSize})`, `create`, `update`, `remove` |
| `debtRepo` | `list`, `create`, `update`, `remove` |
| `savingsRepo` | `listGoals`, `createGoal`, `updateGoal`, `removeGoal`, `addContribution`, `removeContribution` |
| `statsRepo` | `dashboard(month)`, `analytics({from,to,granularity})` |
| `authRepo` | `login`, `register`, `me`, `updateProfile`, `logout` |

The SQLite `expenseRepo.list` must implement filtering, sorting, and pagination in SQL —
the store drives all three through `activeParams` (`stores/expenses.js:14`). It must also
join the wallet and return it as a nested `{id,name,color}` object, matching the API's
`walletSelect` (`expenseService.js:6`); pages read `expense.wallet.name` directly, so a
flat `wallet_id` would break them. The same applies to `incomeRepo`.

### 2.2 What Phase 1 does not implement locally

`statsRepo` has **no SQLite implementation in Phase 1**; porting the aggregations is
Phase 2's entire purpose. Until then the mobile Dashboard and Analytics pages continue to
call HTTP and are online-only. This is a known, temporary gap, not an oversight.

## 3. Database adapter

A single small interface, so the three backends stay interchangeable:

```js
{
  open(name),
  exec(sql),                     // schema/DDL statements
  query(sql, params) -> rows,
  run(sql, params) -> { changes },
  transaction(fn),
  close(),
}
```

Implementations:

- **native** — `@capacitor-community/sqlite`, used on Android and iOS.
- **web (dev only)** — jeep-sqlite, a Stencil custom element over sql.js persisting to
  IndexedDB, requiring a mandatory `initWebStore()` call. Dynamically imported behind a
  dev-mode check so it never lands in the production web bundle. Its purpose is
  developing the offline path at `:5173` without a device round-trip.
- **node** — `node:sqlite`, for Vitest. Built into Node 24, so no native compile step and
  no new dependency.

PRAGMAs on open: `foreign_keys = ON` everywhere; `journal_mode = WAL` on native only
(sql.js has no meaningful WAL support).

## 4. Local schema

Ten domain tables mirroring `backend/prisma/schema.prisma`, plus a `_meta` key/value
table. Every domain table carries four sync columns — `updated_at`, `deleted_at`,
`dirty`, `synced_at`. Reserving them now costs four columns; adding them later would mean
an on-device migration against live user data. New *tables* (the Phase 3 sync queue) are
cheap to add later and are not pre-created.

Of those four, only `updated_at` is live in Phase 1: it is `NOT NULL`, so every local
write stamps it, which is free and avoids a backfill in Phase 3. `deleted_at`, `dirty`,
and `synced_at` are inert until the sync engine exists. Hydration (§5) copies the
server's `updatedAt` where the model has one — only `Expense` and `Income` do — and falls
back to the server's `createdAt` for every other model.

The `users` table deliberately has **no password column**. What credential material, if
any, gets cached on device is Phase 2's decision, and inventing a column for it now would
prejudge that answer.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
  avatar TEXT, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, deleted_at TEXT, dirty INTEGER NOT NULL DEFAULT 0, synced_at TEXT
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, deleted_at TEXT, dirty INTEGER NOT NULL DEFAULT 0, synced_at TEXT
);
CREATE UNIQUE INDEX ux_categories_user_name ON categories(user_id, name) WHERE deleted_at IS NULL;

CREATE TABLE wallets (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT,
  initial_balance REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, deleted_at TEXT, dirty INTEGER NOT NULL DEFAULT 0, synced_at TEXT
);
CREATE UNIQUE INDEX ux_wallets_user_name ON wallets(user_id, name) WHERE deleted_at IS NULL;

CREATE TABLE expenses (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, amount REAL NOT NULL,
  category TEXT NOT NULL, wallet_id TEXT REFERENCES wallets(id), notes TEXT,
  date TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, deleted_at TEXT, dirty INTEGER NOT NULL DEFAULT 0, synced_at TEXT
);
CREATE INDEX ix_expenses_user_date ON expenses(user_id, date);

-- incomes, transfers, debts, savings_goals, savings_contributions, budgets follow the
-- same pattern; full DDL lives in the implementation plan.
```

Conventions:

- `date` columns are `TEXT` as `YYYY-MM-DD`. `created_at`/`updated_at` are full ISO
  instants, since those are genuine timestamps rather than calendar dates.
- Amounts are `REAL` (see rationale above).
- `paid` on `debts` is `INTEGER` 0/1, mapped to boolean in the repo.
- The budget limit column is named **`limit_amount`**, because `limit` is a SQLite
  reserved word; the repo maps it back to `limit` so the store contract is unchanged.
- Unique indexes are **partial** (`WHERE deleted_at IS NULL`) so a tombstoned row does
  not block re-creating a record with the same name.
- Deletes in Phase 1 are hard deletes. `deleted_at` exists but nothing writes it until
  Phase 3 chooses a tombstone policy.

### 4.1 The budget uniqueness trap

`Budget` is `@@unique([userId, category, month])` with a nullable `category`. In both
Postgres and SQLite, NULLs compare as distinct in a unique index, so that constraint does
**not** prevent two "overall" budgets for the same month. The API compensates with an
explicit `findFirst` check (`budgetService.js:43`). The SQLite repo must replicate that
explicit check rather than trust the index, or offline users will create duplicate
overall budgets that the server later rejects.

### 4.2 Migrations

`PRAGMA user_version` holds the schema version. A migration runner applies an ordered
array of steps inside a transaction, so a partial upgrade cannot leave a half-migrated
database on a user's phone.

## 5. Getting data onto the device

Phase 3 brings real two-way sync. Phase 1 needs something simpler to make local reads
meaningful: on a **successful online login**, the HTTP repos pull every resource once and
write the rows into SQLite ("hydration"). Subsequent reads come from local SQLite.

Consequences, stated plainly:

- First login must be online. Offline cold start arrives in Phase 2 with offline auth.
- Local writes made in Phase 1 stay local — nothing pushes them until Phase 3.
- Hydration is a one-way pull that Phase 3 upgrades into the sync engine's initial-pull
  path, so it is a stepping stone rather than throwaway work.

## 6. Testing

- **Adapter conformance suite** — one shared set of assertions exported from a helper and
  run against `node:sqlite` in CI, and runnable against the native adapter on device.
- **Migration tests** — fresh install reaches the current version; re-running is a no-op.
- **Repository tests** — CRUD per domain against `node:sqlite`, including expense
  filtering, sorting, and pagination, and the budget duplicate-overall guard.
- Data-layer tests run under `@vitest-environment node`; existing jsdom component tests
  are untouched.
- **Existing suites must stay green**: `frontend` (component + store tests, which now
  exercise stores through HTTP repos) and `backend` (untouched in this phase).

## 7. Out of scope for Phase 1

Ported aggregations (Phase 2), offline auth (Phase 2), sync engine and backend migration
(Phase 3), mobile navigation and data-dense screen rework (Phase 4), exports (Phase 5).

## 8. Risks

| Risk | Mitigation |
|------|------------|
| Refresh cookie dropped in WebView (§1.2) — blocks login on device | Spiked first; `CapacitorHttp` native requests. Fallback requires a flagged backend change. |
| jeep-sqlite dev adapter behaves differently from native SQLite | Conformance suite runs against every adapter; device verification each phase. |
| Store refactor to repositories regresses the web app | Existing frontend tests must pass unchanged; HTTP repos lift the axios calls verbatim. |
| iOS build unverifiable on Windows | Stated as a known limitation, not claimed as done. |
