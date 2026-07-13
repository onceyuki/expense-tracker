# Spreadsheet Parity Features — Design

**Date:** 2026-07-13
**Status:** Approved

## Background

The user maintains a manual Google Sheets monthly budget tracker. Comparing it against
Ledgerly, five features are missing. This spec adds them, plus a required repair to the
test infrastructure after the project's recent migration from SQLite to Supabase Postgres.

### Gap analysis

Already in Ledgerly: per-category budgets vs spend, income CRUD, expense CRUD,
dashboard cash stats, per-user colored categories.

Missing (all in scope):

1. **Wallets** — named accounts (Cash, GCash, Maya, GoTyme, PayPal, Shopee Pay, Beep
   Card) with an initial balance and a running balance that reflects linked income,
   expenses, and transfers.
2. **Transfers** — money moved between two wallets.
3. **Debt tracker** — date, person ("Source/To Who"), amount, paid/unpaid status, and a
   Debt line in the dashboard cash flow.
4. **Savings goals** — named goals (e.g. "Japan 2027") with dated contributions and
   last-month / this-month / total rollups.
5. **Month-carryover cash flow** — Start Balance carried from the prior month's End
   Balance; dashboard shows Start Balance, Income, Expense, Debt, Savings, End Balance
   for This Month vs Last Month.

### Decisions made during brainstorming

- Implement **all five** features.
- Wallets **replace** the static `paymentMethod` string on expenses (existing values are
  migrated into per-user wallets). Income rows also gain a wallet link.
- Transfers move wallet balances; **debt and savings goals are standalone** trackers
  (they do not touch wallet balances), matching the spreadsheet.
- Wallet balances are **computed on read**, never stored — consistent with the existing
  `statsService` / budget-progress pattern.
- Tests move to a **dedicated Postgres schema** (`tests`) on the same Supabase instance,
  replacing the now-broken SQLite test database.

## 1. Data model

Applies to **both** `backend/prisma/schema.prisma` and
`backend/prisma/schema.postgres.prisma` (kept in sync manually, per project convention).

```prisma
model Wallet {
  id             String   @id @default(cuid())
  userId         String
  name           String
  color          String?
  initialBalance Float    @default(0)
  createdAt      DateTime @default(now())
  user           User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  expenses       Expense[]
  incomes        Income[]
  transfersFrom  Transfer[] @relation("TransferFrom")
  transfersTo    Transfer[] @relation("TransferTo")

  @@unique([userId, name])
  @@index([userId])
}

model Transfer {
  id           String   @id @default(cuid())
  userId       String
  fromWalletId String
  toWalletId   String
  amount       Float
  date         DateTime
  notes        String?
  createdAt    DateTime @default(now())
  user         User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  fromWallet   Wallet @relation("TransferFrom", fields: [fromWalletId], references: [id])
  toWallet     Wallet @relation("TransferTo", fields: [toWalletId], references: [id])

  @@index([userId, date])
}

model Debt {
  id        String   @id @default(cuid())
  userId    String
  person    String   // the sheet's "Source / To Who"
  amount    Float
  date      DateTime
  paid      Boolean  @default(false)
  notes     String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date])
}

model SavingsGoal {
  id            String   @id @default(cuid())
  userId        String
  name          String
  target        Float?
  createdAt     DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  contributions SavingsContribution[]

  @@unique([userId, name])
  @@index([userId])
}

model SavingsContribution {
  id        String      @id @default(cuid())
  goalId    String
  amount    Float
  date      DateTime
  notes     String?
  createdAt DateTime    @default(now())
  goal      SavingsGoal @relation(fields: [goalId], references: [id], onDelete: Cascade)

  @@index([goalId, date])
}
```

Changes to existing models:

- `Expense`: **remove `paymentMethod`**, add `walletId String?` + `wallet Wallet?`
  relation.
- `Income`: add `walletId String?` + relation.
- `User`: add `wallets`, `transfers`, `debts`, `savingsGoals` relations.

### Semantics

- **Wallet balance (computed):** `initialBalance + Σ income.amount − Σ expense.amount +
  Σ transfersIn.amount − Σ transfersOut.amount`, over all time. Never persisted.
- **Wallet deletion** is blocked (409) while any expense, income, or transfer references
  the wallet — same UX as category deletion. Rename needs no cascade (FK link).
- **`walletId` is optional** on expenses and income (the sheet also has walletless rows).
- **Contribution amounts are positive**; corrections happen by deleting the entry.

### Migration

One new Prisma migration (Postgres):

1. Create the four new tables.
2. Add nullable `walletId` to `Expense` and `Income`.
3. Data step: for each user, `INSERT` a wallet per distinct `paymentMethod` value in use
   (initialBalance 0), then set `Expense.walletId` accordingly.
4. Drop `Expense.paymentMethod`.

`PAYMENT_METHODS` in `utils/constants.js` is removed; a `DEFAULT_WALLETS` starter set
(just "Cash") is seeded at registration, like `DEFAULT_CATEGORIES`.

## 2. Backend API

New route → validate(Zod) → controller → service triples, following the existing layering:

| Endpoint | Behavior |
|---|---|
| `GET /api/wallets` | All wallets with computed `balance`, `totalIncome`, `totalExpenses`, `transfersIn`, `transfersOut` |
| `POST /api/wallets` | Create (name unique per user; optional color, initialBalance) |
| `PUT /api/wallets/:id` | Update name/color/initialBalance |
| `DELETE /api/wallets/:id` | 409 if referenced by expense/income/transfer |
| `GET /api/transfers` | Paginated list (standard `{ items, total, page, pageSize, totalPages }`), newest first, wallet names included |
| `POST /api/transfers` | Create; `fromWalletId ≠ toWalletId`, both must belong to user |
| `PUT /api/transfers/:id` / `DELETE` | Update / delete |
| `GET /api/debts` | Paginated list + `totals: { unpaid, paid }` |
| `POST /api/debts` / `PUT /:id` / `DELETE /:id` | CRUD; `PUT` covers the paid toggle |
| `GET /api/savings-goals` | Goals with computed `lastMonth`, `thisMonth`, `total` (and `target` if set) |
| `POST /api/savings-goals` / `PUT /:id` / `DELETE /:id` | CRUD; delete cascades contributions |
| `POST /api/savings-goals/:id/contributions` | Add contribution (amount > 0, date, notes) |
| `DELETE /api/savings-goals/:id/contributions/:cid` | Remove contribution |

Changes to existing endpoints:

- **Expenses**: `walletId` (optional, ownership-validated via a new `assertWalletExists`)
  replaces `paymentMethod` in create/update schemas, list filters, sort options, and
  CSV/Excel export columns (export prints wallet *name*).
- **Income**: gains optional `walletId` in create/update and list responses.
- **Dashboard** (`statsService`): new `cashFlow` object —
  `{ startBalance, income, expense, debt, savings, endBalance }` for `thisMonth` and
  `lastMonth`, where `startBalance = Σ wallet.initialBalance + all-time net (income −
  expense) dated before the month start`, `debt = Σ unpaid debt amounts` (all-time,
  point-in-time figure), `savings = Σ contributions in the month`, and
  `endBalance = startBalance + income − expense`. Also a `wallets` array
  (`{ id, name, color, balance }`) for the dashboard snapshot.
- **Auth/registration**: seeds the `DEFAULT_WALLETS` starter set alongside default
  categories.
- **OpenAPI spec** (`src/config`): all new endpoints documented.
- **`seed.js`**: demo user gets the sheet's 7 wallets, sample transfers, a few debts
  (mixed paid/unpaid), and two savings goals ("Personal", "Japan 2027") with
  contributions across recent months.

### Error handling

- Zod (400): non-positive amounts, missing fields, `fromWalletId === toWalletId`.
- 404: wallet/goal/debt/transfer not found or not owned by the requester.
- 409: deleting a wallet still referenced; duplicate wallet/goal name for the user.

## 3. Frontend

Follows the existing pattern: Pinia stores own server state; pages read from stores.

- **New stores**: `wallets` (wallet list + balances + transfer CRUD), `debts`, `savings`.
- **New pages** (+ router entries with `meta.requiresAuth`, + sidebar links):
  - **WalletsPage** — wallet cards (name, computed balance, initial, in/out totals),
    create/edit/delete modals, transfer history table with create/edit/delete
    (form: from-wallet, to-wallet, amount, date, notes).
  - **DebtsPage** — table (date, person, amount, notes, paid checkbox that PUTs the
    toggle), unpaid/paid totals, create/edit/delete.
  - **SavingsPage** — goal cards showing this-month, total, and target progress bar when
    a target is set; expandable contribution list per goal; add/delete contributions.
- **ExpenseForm / expense filters**: payment-method dropdown → wallet dropdown (options
  from the wallets store; empty option allowed).
- **Income form**: gains the same optional wallet dropdown.
- **DashboardPage**: new Cash Flow card mirroring the sheet (Start Balance, Income,
  Expense, Debt, Savings, End Balance; This Month vs Last Month columns) and a wallet
  balances snapshot widget.
- Wallet colors follow the category convention: hex values applied via inline `style`
  (Tailwind JIT cannot see runtime class names).

## 4. Test infrastructure repair (prerequisite)

The project just moved dev to Supabase Postgres (`schema.prisma` provider is now
`postgresql`), which breaks the test suite: `vitest.config.js` and
`tests/setup/globalSetup.js` both hardcode `DATABASE_URL: 'file:./test.db'`.

Fix, before any feature work:

- `vitest.config.js` loads `backend/.env` (dotenv), derives a test URL from
  `DATABASE_URL` by setting the `schema=tests` query parameter, and injects it into the
  test env. `TEST_DATABASE_URL`, if present, overrides the derivation.
- `globalSetup.js` uses the same derived URL for
  `prisma db push --force-reset` (resets only the `tests` schema).
- `fileParallelism: false` stays (single shared schema).
- Comments referencing SQLite are updated.

## 5. Tests

- **New API suites** (Vitest + Supertest, real DB, `createTestUser()` helper):
  `wallets.test.js` (CRUD, computed balance math, delete-blocked-while-referenced,
  duplicate name), `transfers.test.js` (CRUD, same-wallet rejection, ownership,
  balance effect), `debts.test.js` (CRUD, paid toggle, totals), `savings.test.js`
  (goal CRUD, contributions, monthly rollups).
- **Updated suites**: `expenses` (walletId create/filter/export replaces
  paymentMethod), `income` (walletId), `dashboard` (cashFlow block, wallets snapshot).
- **Frontend**: store tests for `wallets`, `debts`, `savings` mirroring existing store
  test patterns.

## 6. Documentation

- README: feature list, API overview, project structure.
- CLAUDE.md: test-db section (Postgres `tests` schema instead of SQLite), wallet
  conventions (computed balances, FK + delete-block pattern).

## Out of scope

- Linking debt payments or savings contributions to wallet balances (deliberate:
  standalone trackers, like the sheet).
- Multi-currency; the app stays single-currency (₱ formatting already exists).
- Reports (`/api/reports/*`) additions for the new entities.
