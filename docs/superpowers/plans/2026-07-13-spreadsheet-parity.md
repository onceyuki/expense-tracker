# Spreadsheet Parity Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add wallets (accounts with computed balances), transfers, a debt tracker, savings goals, and a month-carryover cash-flow dashboard to Ledgerly, replacing the static `paymentMethod` field — per the approved spec `docs/superpowers/specs/2026-07-13-spreadsheet-parity-design.md`.

**Architecture:** Backend follows the existing layering `routes → validate(Zod) → controllers → services → prisma`; wallet balances are always computed on read (never stored). Frontend follows the existing pattern: Pinia stores own server state, pages read from stores. Tests run against a dedicated `tests` schema on the same Supabase Postgres database (Task 1 repairs the currently-broken suite first).

**Tech Stack:** Express 4 (ESM), Prisma 5 (PostgreSQL/Supabase), Zod 3, Vitest + Supertest; Vue 3 Composition API, Pinia, Vue Router, Tailwind v4.

## Global Constraints

- Both `backend/prisma/schema.prisma` and `backend/prisma/schema.postgres.prisma` must receive identical model changes (kept in sync manually).
- Controllers read validated query params from `req.validatedQuery`, never `req.query`.
- All list endpoints return `{ items, total, page, pageSize, totalPages }`.
- Services throw `ApiError(status, message)` (from `src/utils/ApiError.js`); controllers only try/catch-next.
- Wallet/category colors are hex strings applied via inline `style`, never Tailwind classes built from runtime strings.
- Backend tests: Vitest + Supertest against the real DB; `fileParallelism: false` must stay (single shared `tests` schema). Run from `backend/` with `npm test`.
- Frontend tests: run from `frontend/` with `npm test`.
- All backend commands run from `backend/`, frontend commands from `frontend/`.
- Commit after every task (small, task-scoped commits).

---

### Task 1: Repair the test suite for Postgres

The project just moved from SQLite to Supabase Postgres, but `vitest.config.js` and `tests/setup/globalSetup.js` still hardcode `DATABASE_URL: 'file:./test.db'`. Also, Prisma's `contains` filter is case-insensitive on SQLite but case-sensitive on Postgres, so two search tests will fail without `mode: 'insensitive'`.

**Files:**
- Create: `backend/tests/setup/testDb.js`
- Modify: `backend/vitest.config.js`
- Modify: `backend/tests/setup/globalSetup.js`
- Modify: `backend/src/services/expenseService.js` (buildWhere search)
- Modify: `backend/src/services/incomeService.js` (buildWhere search)

**Interfaces:**
- Produces: `testDatabaseUrl(): string` — the dev `DATABASE_URL` from `backend/.env` with its `schema` query param set to `tests` (or `TEST_DATABASE_URL` verbatim if set). Used by both vitest config and globalSetup.

- [ ] **Step 1: Confirm the suite is currently broken**

Run: `cd backend && npm test`
Expected: FAIL during global setup — Prisma error that the URL must start with `postgresql://` (the schema provider is `postgresql` but the test URL is `file:./test.db`).

- [ ] **Step 2: Create the shared test-URL helper**

Create `backend/tests/setup/testDb.js`:

```js
import dotenv from 'dotenv';

// Tests run against a dedicated `tests` schema on the same Postgres database
// as development, so one provider covers dev, tests and production.
dotenv.config();

export function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL is not set — configure backend/.env');
  const url = new URL(base);
  url.searchParams.set('schema', 'tests');
  return url.toString();
}
```

- [ ] **Step 3: Point vitest and globalSetup at the tests schema**

Replace `backend/vitest.config.js` with:

```js
import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './tests/setup/testDb.js';

export default defineConfig({
  test: {
    // Isolated `tests` schema on the dev Postgres database (see tests/setup/testDb.js)
    env: {
      DATABASE_URL: testDatabaseUrl(),
      JWT_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    },
    globalSetup: './tests/setup/globalSetup.js',
    // All test files share the single `tests` schema: keep runs sequential
    fileParallelism: false,
    testTimeout: 15000,
  },
});
```

Replace `backend/tests/setup/globalSetup.js` with:

```js
import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './testDb.js';

export default function globalSetup() {
  execSync('npx prisma db push --skip-generate --accept-data-loss --force-reset', {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'inherit',
  });
}
```

- [ ] **Step 4: Make search case-insensitive on Postgres**

In `backend/src/services/expenseService.js`, `buildWhere`, change the `OR` block to:

```js
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { notes: { contains: query.search, mode: 'insensitive' } },
    ];
  }
```

In `backend/src/services/incomeService.js`, `buildWhere`, change the `OR` block to:

```js
  if (query.search) {
    where.OR = [
      { source: { contains: query.search, mode: 'insensitive' } },
      { notes: { contains: query.search, mode: 'insensitive' } },
    ];
  }
```

- [ ] **Step 5: Run the suite until green**

Run: `cd backend && npm test`
Expected: PASS (57 tests). The remote DB makes this slower than SQLite; if `prisma db push` in global setup exceeds a timeout, re-run once (cold Supabase pooler connection). If any other test fails with a Postgres-specific behavior difference, fix it in this task — the deliverable is a green suite.

- [ ] **Step 6: Commit**

```bash
git add backend/vitest.config.js backend/tests/setup/ backend/src/services/expenseService.js backend/src/services/incomeService.js
git commit -m "test: run suite against dedicated Postgres tests schema, fix case-insensitive search"
```

---

### Task 2: Schema migration — new models + replace paymentMethod with walletId

Atomic breaking change: add `Wallet`, `Transfer`, `Debt`, `SavingsGoal`, `SavingsContribution`; swap `Expense.paymentMethod` for optional `walletId`; add `Income.walletId`; migrate existing data; update every backend file and test that referenced `paymentMethod`. The suite must be green at the end of this task.

**Files:**
- Modify: `backend/prisma/schema.prisma` (full new content below)
- Modify: `backend/prisma/schema.postgres.prisma` (same model changes)
- Create: `backend/prisma/migrations/<timestamp>_wallets_transfers_debts_savings/migration.sql` (via `--create-only`, then hand-edit)
- Modify: `backend/src/utils/constants.js`
- Create: `backend/src/services/walletService.js` (seed + assert only; full CRUD in Task 3)
- Modify: `backend/src/services/authService.js`
- Modify: `backend/src/routes/expenseRoutes.js`
- Modify: `backend/src/services/expenseService.js`
- Modify: `backend/src/controllers/expenseController.js`
- Modify: `backend/src/routes/incomeRoutes.js`
- Modify: `backend/src/services/incomeService.js`
- Modify: `backend/src/controllers/reportController.js`
- Modify: `backend/src/services/statsService.js` (`getMonthlyReport` include)
- Modify: `backend/prisma/seed.js` (minimal validity fix; full demo data in Task 8)
- Modify: `backend/tests/expenses.test.js`, `backend/tests/reports.test.js`, `backend/tests/dashboard.test.js`, `backend/tests/budgets.test.js`, `backend/tests/categories.test.js`

**Interfaces:**
- Produces: Prisma models `Wallet`, `Transfer`, `Debt`, `SavingsGoal`, `SavingsContribution`; `Expense.walletId: String?`, `Income.walletId: String?`.
- Produces: `walletService.seedDefaultWallets(userId)`, `walletService.assertWalletExists(userId, walletId)` (400 `Unknown wallet` when not owned/missing; no-op when `walletId == null`).
- Produces: expense/income create/update bodies accept optional `walletId`; expense list/get/export items include `wallet: { id, name, color } | null`; expense list filter `walletId`.
- Produces: `DEFAULT_WALLETS` in `utils/constants.js`; `PAYMENT_METHODS` is gone.

- [ ] **Step 1: Update `backend/prisma/schema.prisma`**

Replace the whole file with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(cuid())
  name         String
  email        String        @unique
  password     String
  avatar       String?
  createdAt    DateTime      @default(now())
  expenses     Expense[]
  incomes      Income[]
  budgets      Budget[]
  categories   Category[]
  wallets      Wallet[]
  transfers    Transfer[]
  debts        Debt[]
  savingsGoals SavingsGoal[]
}

model Category {
  id        String   @id @default(cuid())
  userId    String
  name      String
  color     String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, name])
  @@index([userId])
}

model Wallet {
  id             String     @id @default(cuid())
  userId         String
  name           String
  color          String?
  initialBalance Float      @default(0)
  createdAt      DateTime   @default(now())
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
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  fromWallet   Wallet   @relation("TransferFrom", fields: [fromWalletId], references: [id])
  toWallet     Wallet   @relation("TransferTo", fields: [toWalletId], references: [id])

  @@index([userId, date])
}

model Debt {
  id        String   @id @default(cuid())
  userId    String
  person    String
  amount    Float
  date      DateTime
  paid      Boolean  @default(false)
  notes     String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date])
}

model SavingsGoal {
  id            String                @id @default(cuid())
  userId        String
  name          String
  target        Float?
  createdAt     DateTime              @default(now())
  user          User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
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

model Expense {
  id        String   @id @default(cuid())
  userId    String
  title     String
  amount    Float
  category  String
  walletId  String?
  notes     String?
  date      DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  wallet    Wallet?  @relation(fields: [walletId], references: [id])

  @@index([userId, date])
}

model Income {
  id        String   @id @default(cuid())
  userId    String
  source    String
  amount    Float
  walletId  String?
  date      DateTime
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  wallet    Wallet?  @relation(fields: [walletId], references: [id])

  @@index([userId, date])
}

model Budget {
  id       String  @id @default(cuid())
  userId   String
  category String?
  limit    Float
  month    String
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, category, month])
  @@index([userId, month])
}
```

Apply the exact same model changes to `backend/prisma/schema.postgres.prisma` (its models must end up identical; only the file header comment may differ).

- [ ] **Step 2: Generate the migration without applying it**

Run: `cd backend && npx prisma migrate dev --create-only --name wallets_transfers_debts_savings`
Expected: a new folder `backend/prisma/migrations/<timestamp>_wallets_transfers_debts_savings/` containing `migration.sql` with `CREATE TABLE` statements for the five new tables, `ALTER TABLE "Expense"` (drops `paymentMethod`, adds `walletId`), `ALTER TABLE "Income"` (adds `walletId`), plus indexes and FK constraints.

- [ ] **Step 3: Hand-edit the migration to migrate paymentMethod data**

In the generated `migration.sql`, the generated statement for Expense looks like:

```sql
ALTER TABLE "Expense" DROP COLUMN "paymentMethod",
ADD COLUMN     "walletId" TEXT;
```

Replace it with (add column → copy data → drop column, in this order):

```sql
ALTER TABLE "Expense" ADD COLUMN "walletId" TEXT;

-- Convert each user's distinct payment methods in use into wallets…
INSERT INTO "Wallet" ("id", "userId", "name", "initialBalance", "createdAt")
SELECT gen_random_uuid()::text, "userId", "paymentMethod", 0, CURRENT_TIMESTAMP
FROM "Expense"
GROUP BY "userId", "paymentMethod";

-- …and point existing expenses at them.
UPDATE "Expense" e
SET "walletId" = w."id"
FROM "Wallet" w
WHERE w."userId" = e."userId" AND w."name" = e."paymentMethod";

ALTER TABLE "Expense" DROP COLUMN "paymentMethod";
```

The `INSERT INTO "Wallet"` must come **after** the `CREATE TABLE "Wallet"` statement — if the generator emitted the ALTER before the CREATEs, move the whole edited block below them.

- [ ] **Step 4: Apply the migration**

Run: `cd backend && npx prisma migrate dev`
Expected: migration applied to the dev database, Prisma Client regenerated. Verify data survived: `npx prisma studio` is interactive — instead run a quick check:

```bash
cd backend && node -e "import('./src/utils/prisma.js').then(async ({prisma}) => { console.log('wallets:', await prisma.wallet.count(), 'linked expenses:', await prisma.expense.count({ where: { walletId: { not: null } } })); await prisma.\$disconnect(); })"
```

Expected: wallet count > 0 and linked expenses equal to the total expense count (every seeded expense had a paymentMethod).

- [ ] **Step 5: Swap constants and add the minimal wallet service**

Replace the `PAYMENT_METHODS` export in `backend/src/utils/constants.js` with:

```js
// Seeded onto every new user at registration, like DEFAULT_CATEGORIES.
export const DEFAULT_WALLETS = [{ name: 'Cash', color: '#1baf7a' }];
```

Create `backend/src/services/walletService.js`:

```js
import { prisma } from '../utils/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { DEFAULT_WALLETS } from '../utils/constants.js';

export async function seedDefaultWallets(userId) {
  // Called once right after user creation (same convention as seedDefaultCategories).
  await prisma.wallet.createMany({
    data: DEFAULT_WALLETS.map((w) => ({ userId, name: w.name, color: w.color })),
  });
}

export async function assertWalletExists(userId, walletId) {
  if (walletId == null) return;
  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId } });
  if (!wallet) throw new ApiError(400, 'Unknown wallet');
}
```

In `backend/src/services/authService.js` add the import and seed call:

```js
import { seedDefaultWallets } from './walletService.js';
```

and in `register`, after `await seedDefaultCategories(user.id);` add:

```js
  await seedDefaultWallets(user.id);
```

- [ ] **Step 6: Swap paymentMethod → walletId in expense routes/service/controller**

`backend/src/routes/expenseRoutes.js` — remove the `PAYMENT_METHODS` import, and change the two schemas:

```js
const expenseBody = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  category: z.string().trim().min(1).max(40),
  walletId: z.string().min(1).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const filterQuery = z.object({
  search: z.string().optional(),
  category: z.string().trim().min(1).max(40).optional(),
  walletId: z.string().min(1).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
});
```

`backend/src/services/expenseService.js`:
- Add import: `import { assertWalletExists } from './walletService.js';`
- In `buildWhere`, replace `if (query.paymentMethod) where.paymentMethod = query.paymentMethod;` with `if (query.walletId) where.walletId = query.walletId;`
- Define once near the top: `const walletSelect = { wallet: { select: { id: true, name: true, color: true } } };`
- Add `include: walletSelect` to the `findMany` in `listExpenses`, to `listAllForExport`, and to the `findFirst` in `getExpense` (`prisma.expense.findFirst({ where: { id, userId }, include: walletSelect })`).
- In `createExpense` and `updateExpense`, after `assertCategoryExists`, add `await assertWalletExists(userId, data.walletId);` and add `include: walletSelect` to the create/update calls.
- In `duplicateExpense`, replace `paymentMethod: source.paymentMethod,` with `walletId: source.walletId,` and add `include: walletSelect` to the create call.

`backend/src/controllers/expenseController.js` — replace the export columns and row mapping:

```js
const EXPORT_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'title', header: 'Title' },
  { key: 'category', header: 'Category' },
  { key: 'amount', header: 'Amount' },
  { key: 'wallet', header: 'Wallet' },
  { key: 'notes', header: 'Notes' },
];
```

and in `exportExpenses`:

```js
    const data = rows.map((e) => ({
      ...e,
      wallet: e.wallet?.name ?? '',
      date: e.date.toISOString().slice(0, 10),
    }));
```

- [ ] **Step 7: Add walletId to income routes/service**

`backend/src/routes/incomeRoutes.js` — add to `incomeBody`:

```js
  walletId: z.string().min(1).nullable().optional(),
```

`backend/src/services/incomeService.js`:
- Add import: `import { assertWalletExists } from './walletService.js';`
- Define `const walletSelect = { wallet: { select: { id: true, name: true, color: true } } };` and add `include: walletSelect` to the `findMany` in `listIncome`.
- In `createIncome`: `await assertWalletExists(userId, data.walletId);` before the create, and `include: walletSelect` on the create.
- In `updateIncome`: `await assertWalletExists(userId, data.walletId);` after `getIncome`, and `include: walletSelect` on the update.

- [ ] **Step 8: Keep openapi.js loading (minimal fix — full docs land in Task 9)**

`backend/src/config/openapi.js` imports `PAYMENT_METHODS` and is loaded at app boot — leaving it broken fails every test. Remove the import and patch the three usages:
- In `expenseFilterParams`, replace the `paymentMethod` entry with `{ name: 'walletId', in: 'query', schema: { type: 'string' } }`.
- In the `Expense` schema, replace `paymentMethod: { type: 'string', enum: PAYMENT_METHODS },` with `walletId: { type: 'string', nullable: true },`.
- In `ExpenseInput`, remove `paymentMethod` from the `required` array and replace its property with `walletId: { type: 'string', nullable: true },`.

- [ ] **Step 9: Fix reports**

`backend/src/services/statsService.js`, `getMonthlyReport` — include the wallet on transactions:

```js
    prisma.expense.findMany({
      where: { userId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
      include: { wallet: { select: { id: true, name: true, color: true } } },
    }),
```

`backend/src/controllers/reportController.js` — in the monthly report's export section, replace `{ key: 'paymentMethod', header: 'Payment Method' }` with `{ key: 'wallet', header: 'Wallet' }`, and in its `rows:` mapping add `wallet: t.wallet?.name ?? '',` alongside the existing `date`/`amount` mappings.

- [ ] **Step 10: Keep seed.js valid (minimal fix; full demo data lands in Task 8)**

In `backend/prisma/seed.js`:
- Delete the `const PAYMENT_METHODS = [...]` line.
- After the `prisma.category.createMany(...)` call, add:

```js
  const walletNames = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Mobile Payment'];
  await prisma.wallet.createMany({
    data: walletNames.map((name) => ({ userId: user.id, name })),
  });
  const wallets = await prisma.wallet.findMany({ where: { userId: user.id } });
  const walletIds = wallets.map((w) => w.id);
```

- Replace the rent expense's `paymentMethod: 'Bank Transfer',` with `walletId: wallets.find((w) => w.name === 'Bank Transfer').id,` and the random expenses' `paymentMethod: pick(PAYMENT_METHODS),` with `walletId: pick(walletIds),`.

- [ ] **Step 11: Update existing tests (this is the red→green cycle for the swap)**

Run: `cd backend && npm test`
Expected: FAIL — fixtures still send `paymentMethod`, which Zod now rejects (`Validation failed`) or assertions reference it.

Fix, in each of `backend/tests/expenses.test.js`, `reports.test.js`, `dashboard.test.js`, `budgets.test.js`, `categories.test.js`:
- Delete every `paymentMethod: '...'` line from request fixtures (walletId is optional — plain omission is valid).
- Delete/replace assertions on `paymentMethod`. In `expenses.test.js`, replace the paymentMethod filter test with a walletId filter test (create the wallet directly with prisma — the wallet API arrives in Task 3):

```js
import { prisma } from '../src/utils/prisma.js';

it('filters by wallet', async () => {
  const { user: u, token: t } = await createTestUser(app, 'wallet-filter@test.com', 'Wallet Filter', ['Food']);
  const wallet = await prisma.wallet.create({ data: { userId: u.id, name: 'GCash' } });
  await request(app).post('/api/expenses').set('Authorization', `Bearer ${t}`)
    .send({ title: 'With wallet', amount: 10, category: 'Food', date: '2026-07-01', walletId: wallet.id });
  await request(app).post('/api/expenses').set('Authorization', `Bearer ${t}`)
    .send({ title: 'Without wallet', amount: 5, category: 'Food', date: '2026-07-01' });
  const res = await request(app).get('/api/expenses').query({ walletId: wallet.id }).set('Authorization', `Bearer ${t}`);
  expect(res.body.items).toHaveLength(1);
  expect(res.body.items[0].wallet.name).toBe('GCash');
});
```

(If the file structures its tests around a shared `token`, a dedicated user as above still works — it keeps the filter counts independent of other fixtures.)

- Add one assertion in the expense-create test that a created expense without walletId has `expense.wallet === null` (include makes it explicit), and that CSV export headers contain `Wallet` instead of `Payment Method` if the export test asserts headers.

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add backend/prisma backend/src backend/tests
git commit -m "feat(backend): wallet data model — replace expense paymentMethod with walletId, add transfer/debt/savings tables"
```

---

### Task 3: Wallet API (CRUD + computed balances)

**Files:**
- Test: `backend/tests/wallets.test.js`
- Modify: `backend/src/services/walletService.js` (add CRUD + balance computation)
- Create: `backend/src/controllers/walletController.js`
- Create: `backend/src/routes/walletRoutes.js`
- Modify: `backend/src/app.js` (mount `/api/wallets`)

**Interfaces:**
- Consumes: `assertWalletExists`, `seedDefaultWallets` from Task 2.
- Produces: `walletService.listWallets(userId)` → array of `{ id, userId, name, color, initialBalance, createdAt, totalIncome, totalExpenses, transfersIn, transfersOut, balance }` where `balance = initialBalance + totalIncome − totalExpenses + transfersIn − transfersOut` (all rounded to 2dp). REST: `GET /api/wallets` → `{ wallets }`, `POST /api/wallets` → 201 `{ wallet }`, `PUT /api/wallets/:id` → `{ wallet }`, `DELETE /api/wallets/:id` → 204; 409 on duplicate name or delete-while-referenced; 404 unknown id.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/wallets.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'wallets@test.com', 'Wallet Tester', ['Food']));
});

describe('wallets', () => {
  let gcash;

  it('requires auth', async () => {
    expect((await request(app).get('/api/wallets')).status).toBe(401);
  });

  it('registration seeded a default Cash wallet', async () => {
    const res = await auth(request(app).get('/api/wallets'));
    expect(res.status).toBe(200);
    expect(res.body.wallets.map((w) => w.name)).toContain('Cash');
  });

  it('creates a wallet with initial balance', async () => {
    const res = await auth(request(app).post('/api/wallets')).send({ name: 'GCash', color: '#2a78d6', initialBalance: 500 });
    expect(res.status).toBe(201);
    expect(res.body.wallet.name).toBe('GCash');
    gcash = res.body.wallet;
  });

  it('rejects a duplicate wallet name', async () => {
    expect((await auth(request(app).post('/api/wallets')).send({ name: 'GCash' })).status).toBe(409);
  });

  it('computes balance from initial + income − expenses', async () => {
    await auth(request(app).post('/api/income')).send({ source: 'Salary', amount: 300, date: '2026-07-01', walletId: gcash.id });
    await auth(request(app).post('/api/expenses')).send({ title: 'Lunch', amount: 120, category: 'Food', date: '2026-07-02', walletId: gcash.id });
    const res = await auth(request(app).get('/api/wallets'));
    const w = res.body.wallets.find((x) => x.id === gcash.id);
    expect(w.totalIncome).toBe(300);
    expect(w.totalExpenses).toBe(120);
    expect(w.balance).toBe(680); // 500 + 300 − 120
  });

  it('updates name and initial balance', async () => {
    const res = await auth(request(app).put(`/api/wallets/${gcash.id}`)).send({ name: 'GCash Main', initialBalance: 600 });
    expect(res.status).toBe(200);
    expect(res.body.wallet.name).toBe('GCash Main');
  });

  it('blocks deleting a wallet still referenced by expenses/income', async () => {
    const res = await auth(request(app).delete(`/api/wallets/${gcash.id}`));
    expect(res.status).toBe(409);
  });

  it('deletes an unreferenced wallet', async () => {
    const created = await auth(request(app).post('/api/wallets')).send({ name: 'Temp' });
    const res = await auth(request(app).delete(`/api/wallets/${created.body.wallet.id}`));
    expect(res.status).toBe(204);
  });

  it('404s on another user\'s wallet', async () => {
    const other = await createTestUser(app, 'wallets-other@test.com');
    const res = await request(app)
      .delete(`/api/wallets/${gcash.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npm test -- wallets`
Expected: FAIL — 404s from missing `/api/wallets` route.

- [ ] **Step 3: Implement service, controller, routes, mount**

Append to `backend/src/services/walletService.js`:

```js
const round2 = (n) => Math.round(n * 100) / 100;

export async function listWallets(userId) {
  const [wallets, expenseSums, incomeSums, outSums, inSums] = await Promise.all([
    prisma.wallet.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.expense.groupBy({ by: ['walletId'], where: { userId, walletId: { not: null } }, _sum: { amount: true } }),
    prisma.income.groupBy({ by: ['walletId'], where: { userId, walletId: { not: null } }, _sum: { amount: true } }),
    prisma.transfer.groupBy({ by: ['fromWalletId'], where: { userId }, _sum: { amount: true } }),
    prisma.transfer.groupBy({ by: ['toWalletId'], where: { userId }, _sum: { amount: true } }),
  ]);
  const sumMap = (rows, key) => new Map(rows.map((r) => [r[key], r._sum.amount ?? 0]));
  const exp = sumMap(expenseSums, 'walletId');
  const inc = sumMap(incomeSums, 'walletId');
  const out = sumMap(outSums, 'fromWalletId');
  const tin = sumMap(inSums, 'toWalletId');

  return wallets.map((w) => {
    const totalIncome = round2(inc.get(w.id) ?? 0);
    const totalExpenses = round2(exp.get(w.id) ?? 0);
    const transfersIn = round2(tin.get(w.id) ?? 0);
    const transfersOut = round2(out.get(w.id) ?? 0);
    return {
      ...w,
      totalIncome,
      totalExpenses,
      transfersIn,
      transfersOut,
      balance: round2(w.initialBalance + totalIncome - totalExpenses + transfersIn - transfersOut),
    };
  });
}

export async function createWallet(userId, { name, color, initialBalance }) {
  const existing = await prisma.wallet.findFirst({ where: { userId, name } });
  if (existing) throw new ApiError(409, 'A wallet with this name already exists');
  return prisma.wallet.create({
    data: { userId, name, color: color ?? null, initialBalance: initialBalance ?? 0 },
  });
}

export async function updateWallet(userId, id, { name, color, initialBalance }) {
  const wallet = await prisma.wallet.findFirst({ where: { id, userId } });
  if (!wallet) throw new ApiError(404, 'Wallet not found');
  if (name !== undefined && name !== wallet.name) {
    const clash = await prisma.wallet.findFirst({ where: { userId, name } });
    if (clash) throw new ApiError(409, 'A wallet with this name already exists');
  }
  return prisma.wallet.update({ where: { id }, data: { name, color, initialBalance } });
}

export async function deleteWallet(userId, id) {
  const wallet = await prisma.wallet.findFirst({ where: { id, userId } });
  if (!wallet) throw new ApiError(404, 'Wallet not found');
  const [expenseCount, incomeCount, transferCount] = await Promise.all([
    prisma.expense.count({ where: { walletId: id } }),
    prisma.income.count({ where: { walletId: id } }),
    prisma.transfer.count({ where: { OR: [{ fromWalletId: id }, { toWalletId: id }] } }),
  ]);
  if (expenseCount + incomeCount + transferCount > 0) {
    throw new ApiError(
      409,
      `"${wallet.name}" is used by ${expenseCount} expense(s), ${incomeCount} income record(s) and ${transferCount} transfer(s) — reassign or remove those first`,
    );
  }
  await prisma.wallet.delete({ where: { id } });
}
```

Create `backend/src/controllers/walletController.js`:

```js
import * as walletService from '../services/walletService.js';

export async function list(req, res, next) {
  try {
    res.json({ wallets: await walletService.listWallets(req.user.id) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const wallet = await walletService.createWallet(req.user.id, req.body);
    res.status(201).json({ wallet });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const wallet = await walletService.updateWallet(req.user.id, req.params.id, req.body);
    res.json({ wallet });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await walletService.deleteWallet(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
```

Create `backend/src/routes/walletRoutes.js`:

```js
import { Router } from 'express';
import { z } from 'zod';
import * as walletController from '../controllers/walletController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const walletBody = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  initialBalance: z.number().optional(),
});

router.get('/', walletController.list);
router.post('/', validate({ body: walletBody }), walletController.create);
router.put('/:id', validate({ body: walletBody.partial() }), walletController.update);
router.delete('/:id', walletController.remove);

export default router;
```

In `backend/src/app.js`, add `import walletRoutes from './routes/walletRoutes.js';` and `app.use('/api/wallets', walletRoutes);` next to the other mounts.

- [ ] **Step 4: Run tests**

Run: `cd backend && npm test -- wallets` then `cd backend && npm test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/tests/wallets.test.js
git commit -m "feat(backend): wallet CRUD API with computed balances"
```

---

### Task 4: Transfer API

**Files:**
- Test: `backend/tests/transfers.test.js`
- Create: `backend/src/services/transferService.js`
- Create: `backend/src/controllers/transferController.js`
- Create: `backend/src/routes/transferRoutes.js`
- Modify: `backend/src/app.js` (mount `/api/transfers`)

**Interfaces:**
- Consumes: `walletService.listWallets` (balance assertions in tests).
- Produces: `GET /api/transfers` → `{ items, total, page, pageSize, totalPages }`, items include `fromWallet`/`toWallet` as `{ id, name, color }`; `POST /api/transfers` → 201 `{ transfer }`; `PUT /api/transfers/:id` → `{ transfer }`; `DELETE /api/transfers/:id` → 204. 400 when `fromWalletId === toWalletId` or a wallet isn't owned; 404 unknown transfer.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/transfers.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;
let cash;
let gcash;

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'transfers@test.com'));
  const wallets = (await auth(request(app).get('/api/wallets'))).body.wallets;
  cash = wallets.find((w) => w.name === 'Cash');
  gcash = (await auth(request(app).post('/api/wallets')).send({ name: 'GCash', initialBalance: 1000 })).body.wallet;
});

describe('transfers', () => {
  let created;

  it('requires auth', async () => {
    expect((await request(app).get('/api/transfers')).status).toBe(401);
  });

  it('creates a transfer between wallets', async () => {
    const res = await auth(request(app).post('/api/transfers')).send({
      fromWalletId: gcash.id, toWalletId: cash.id, amount: 500, date: '2026-07-03',
    });
    expect(res.status).toBe(201);
    expect(res.body.transfer.fromWallet.name).toBe('GCash');
    expect(res.body.transfer.toWallet.name).toBe('Cash');
    created = res.body.transfer;
  });

  it('moves wallet balances', async () => {
    const wallets = (await auth(request(app).get('/api/wallets'))).body.wallets;
    expect(wallets.find((w) => w.id === gcash.id).balance).toBe(500); // 1000 − 500
    expect(wallets.find((w) => w.id === cash.id).balance).toBe(500); // 0 + 500
  });

  it('rejects a same-wallet transfer', async () => {
    const res = await auth(request(app).post('/api/transfers')).send({
      fromWalletId: cash.id, toWalletId: cash.id, amount: 10, date: '2026-07-03',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a wallet the user does not own', async () => {
    const other = await createTestUser(app, 'transfers-other@test.com');
    const res = await request(app).post('/api/transfers').set('Authorization', `Bearer ${other.token}`)
      .send({ fromWalletId: gcash.id, toWalletId: cash.id, amount: 10, date: '2026-07-03' });
    expect(res.status).toBe(400);
  });

  it('lists transfers with the pagination envelope', async () => {
    const res = await auth(request(app).get('/api/transfers'));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('totalPages');
  });

  it('updates a transfer', async () => {
    const res = await auth(request(app).put(`/api/transfers/${created.id}`)).send({ amount: 250 });
    expect(res.status).toBe(200);
    expect(res.body.transfer.amount).toBe(250);
  });

  it('deletes a transfer and restores balances', async () => {
    expect((await auth(request(app).delete(`/api/transfers/${created.id}`))).status).toBe(204);
    const wallets = (await auth(request(app).get('/api/wallets'))).body.wallets;
    expect(wallets.find((w) => w.id === gcash.id).balance).toBe(1000);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npm test -- transfers`
Expected: FAIL — missing route (404s).

- [ ] **Step 3: Implement**

Create `backend/src/services/transferService.js`:

```js
import { prisma } from '../utils/prisma.js';
import { ApiError } from '../utils/ApiError.js';

const walletInclude = {
  fromWallet: { select: { id: true, name: true, color: true } },
  toWallet: { select: { id: true, name: true, color: true } },
};

async function assertOwnedWallet(userId, walletId) {
  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId } });
  if (!wallet) throw new ApiError(400, 'Unknown wallet');
}

export async function listTransfers(userId, query) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.transfer.findMany({
      where,
      include: walletInclude,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transfer.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getTransfer(userId, id) {
  const transfer = await prisma.transfer.findFirst({ where: { id, userId } });
  if (!transfer) throw new ApiError(404, 'Transfer not found');
  return transfer;
}

export async function createTransfer(userId, data) {
  if (data.fromWalletId === data.toWalletId) {
    throw new ApiError(400, 'Cannot transfer to the same wallet');
  }
  await Promise.all([
    assertOwnedWallet(userId, data.fromWalletId),
    assertOwnedWallet(userId, data.toWalletId),
  ]);
  return prisma.transfer.create({
    data: { ...data, userId, date: new Date(data.date) },
    include: walletInclude,
  });
}

export async function updateTransfer(userId, id, data) {
  const existing = await getTransfer(userId, id);
  const from = data.fromWalletId ?? existing.fromWalletId;
  const to = data.toWalletId ?? existing.toWalletId;
  if (from === to) throw new ApiError(400, 'Cannot transfer to the same wallet');
  if (data.fromWalletId) await assertOwnedWallet(userId, data.fromWalletId);
  if (data.toWalletId) await assertOwnedWallet(userId, data.toWalletId);
  return prisma.transfer.update({
    where: { id },
    data: { ...data, date: data.date ? new Date(data.date) : undefined },
    include: walletInclude,
  });
}

export async function deleteTransfer(userId, id) {
  await getTransfer(userId, id);
  await prisma.transfer.delete({ where: { id } });
}
```

Create `backend/src/controllers/transferController.js`:

```js
import * as transferService from '../services/transferService.js';

export async function list(req, res, next) {
  try {
    res.json(await transferService.listTransfers(req.user.id, req.validatedQuery));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const transfer = await transferService.createTransfer(req.user.id, req.body);
    res.status(201).json({ transfer });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const transfer = await transferService.updateTransfer(req.user.id, req.params.id, req.body);
    res.json({ transfer });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await transferService.deleteTransfer(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
```

Create `backend/src/routes/transferRoutes.js`:

```js
import { Router } from 'express';
import { z } from 'zod';
import * as transferController from '../controllers/transferController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const transferBody = z.object({
  fromWalletId: z.string().min(1),
  toWalletId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes: z.string().max(1000).nullable().optional(),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

router.get('/', validate({ query: listQuery }), transferController.list);
router.post('/', validate({ body: transferBody }), transferController.create);
router.put('/:id', validate({ body: transferBody.partial() }), transferController.update);
router.delete('/:id', transferController.remove);

export default router;
```

In `backend/src/app.js`, add `import transferRoutes from './routes/transferRoutes.js';` and `app.use('/api/transfers', transferRoutes);`.

- [ ] **Step 4: Run tests**

Run: `cd backend && npm test -- transfers` then `cd backend && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/tests/transfers.test.js
git commit -m "feat(backend): transfers between wallets"
```

---

### Task 5: Debt API

**Files:**
- Test: `backend/tests/debts.test.js`
- Create: `backend/src/services/debtService.js`
- Create: `backend/src/controllers/debtController.js`
- Create: `backend/src/routes/debtRoutes.js`
- Modify: `backend/src/app.js` (mount `/api/debts`)

**Interfaces:**
- Produces: `GET /api/debts` → `{ items, total, page, pageSize, totalPages, totals: { unpaid, paid } }` (totals across ALL the user's debts, not just the page); `POST /api/debts` → 201 `{ debt }`; `PUT /api/debts/:id` → `{ debt }` (used for the paid toggle); `DELETE /api/debts/:id` → 204.
- Produces (for Task 7): unpaid debts queryable via `prisma.debt.findMany({ where: { userId, paid: false } })`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/debts.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'debts@test.com'));
});

describe('debts', () => {
  let debt;

  it('requires auth', async () => {
    expect((await request(app).get('/api/debts')).status).toBe(401);
  });

  it('creates a debt (unpaid by default)', async () => {
    const res = await auth(request(app).post('/api/debts')).send({
      person: 'Alice', amount: 750, date: '2026-07-05', notes: 'Lunch money',
    });
    expect(res.status).toBe(201);
    expect(res.body.debt.paid).toBe(false);
    debt = res.body.debt;
  });

  it('rejects non-positive amounts', async () => {
    expect((await auth(request(app).post('/api/debts')).send({ person: 'X', amount: 0, date: '2026-07-05' })).status).toBe(400);
  });

  it('lists debts with unpaid/paid totals', async () => {
    await auth(request(app).post('/api/debts')).send({ person: 'Bob', amount: 250, date: '2026-07-06', paid: true });
    const res = await auth(request(app).get('/api/debts'));
    expect(res.status).toBe(200);
    expect(res.body.totals.unpaid).toBe(750);
    expect(res.body.totals.paid).toBe(250);
  });

  it('toggles paid via PUT', async () => {
    const res = await auth(request(app).put(`/api/debts/${debt.id}`)).send({ paid: true });
    expect(res.status).toBe(200);
    expect(res.body.debt.paid).toBe(true);
    const list = await auth(request(app).get('/api/debts'));
    expect(list.body.totals.unpaid).toBe(0);
  });

  it('deletes a debt', async () => {
    expect((await auth(request(app).delete(`/api/debts/${debt.id}`))).status).toBe(204);
  });

  it('404s on another user\'s debt', async () => {
    const other = await createTestUser(app, 'debts-other@test.com');
    const created = await auth(request(app).post('/api/debts')).send({ person: 'C', amount: 10, date: '2026-07-05' });
    const res = await request(app)
      .delete(`/api/debts/${created.body.debt.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npm test -- debts`
Expected: FAIL — missing route.

- [ ] **Step 3: Implement**

Create `backend/src/services/debtService.js`:

```js
import { prisma } from '../utils/prisma.js';
import { ApiError } from '../utils/ApiError.js';

const round2 = (n) => Math.round(n * 100) / 100;

export async function listDebts(userId, query) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const where = { userId };
  const [items, total, groups] = await Promise.all([
    prisma.debt.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.debt.count({ where }),
    prisma.debt.groupBy({ by: ['paid'], where, _sum: { amount: true } }),
  ]);
  const totals = {
    unpaid: round2(groups.find((g) => g.paid === false)?._sum.amount ?? 0),
    paid: round2(groups.find((g) => g.paid === true)?._sum.amount ?? 0),
  };
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), totals };
}

export async function getDebt(userId, id) {
  const debt = await prisma.debt.findFirst({ where: { id, userId } });
  if (!debt) throw new ApiError(404, 'Debt not found');
  return debt;
}

export async function createDebt(userId, data) {
  return prisma.debt.create({ data: { ...data, userId, date: new Date(data.date) } });
}

export async function updateDebt(userId, id, data) {
  await getDebt(userId, id);
  return prisma.debt.update({
    where: { id },
    data: { ...data, date: data.date ? new Date(data.date) : undefined },
  });
}

export async function deleteDebt(userId, id) {
  await getDebt(userId, id);
  await prisma.debt.delete({ where: { id } });
}
```

Create `backend/src/controllers/debtController.js`:

```js
import * as debtService from '../services/debtService.js';

export async function list(req, res, next) {
  try {
    res.json(await debtService.listDebts(req.user.id, req.validatedQuery));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const debt = await debtService.createDebt(req.user.id, req.body);
    res.status(201).json({ debt });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const debt = await debtService.updateDebt(req.user.id, req.params.id, req.body);
    res.json({ debt });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await debtService.deleteDebt(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
```

Create `backend/src/routes/debtRoutes.js`:

```js
import { Router } from 'express';
import { z } from 'zod';
import * as debtController from '../controllers/debtController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const debtBody = z.object({
  person: z.string().trim().min(1).max(200),
  amount: z.number().positive(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  paid: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

router.get('/', validate({ query: listQuery }), debtController.list);
router.post('/', validate({ body: debtBody }), debtController.create);
router.put('/:id', validate({ body: debtBody.partial() }), debtController.update);
router.delete('/:id', debtController.remove);

export default router;
```

In `backend/src/app.js`, add `import debtRoutes from './routes/debtRoutes.js';` and `app.use('/api/debts', debtRoutes);`.

- [ ] **Step 4: Run tests**

Run: `cd backend && npm test -- debts` then `cd backend && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/tests/debts.test.js
git commit -m "feat(backend): debt tracker with paid/unpaid totals"
```

---

### Task 6: Savings goals API

**Files:**
- Test: `backend/tests/savings.test.js`
- Create: `backend/src/services/savingsService.js`
- Create: `backend/src/controllers/savingsController.js`
- Create: `backend/src/routes/savingsRoutes.js`
- Modify: `backend/src/app.js` (mount `/api/savings-goals`)

**Interfaces:**
- Produces: `GET /api/savings-goals` → `{ goals }` where each goal is `{ id, userId, name, target, createdAt, contributions: [...], total, thisMonth, lastMonth }` (contributions newest-first; rollups rounded 2dp, relative to the real current date); `POST /api/savings-goals` → 201 `{ goal }`; `PUT /api/savings-goals/:id` → `{ goal }`; `DELETE /api/savings-goals/:id` → 204 (cascades contributions); `POST /api/savings-goals/:id/contributions` → 201 `{ contribution }`; `DELETE /api/savings-goals/:id/contributions/:cid` → 204. 409 duplicate goal name; 404 unknown/unowned goal or contribution.
- Produces (for Task 7): contributions queryable via `prisma.savingsContribution.findMany({ where: { goal: { userId }, ... } })`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/savings.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

function isoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'savings@test.com'));
});

describe('savings goals', () => {
  let goal;

  it('requires auth', async () => {
    expect((await request(app).get('/api/savings-goals')).status).toBe(401);
  });

  it('creates a goal with an optional target', async () => {
    const res = await auth(request(app).post('/api/savings-goals')).send({ name: 'Japan 2027', target: 150000 });
    expect(res.status).toBe(201);
    expect(res.body.goal.target).toBe(150000);
    goal = res.body.goal;
  });

  it('rejects a duplicate goal name', async () => {
    expect((await auth(request(app).post('/api/savings-goals')).send({ name: 'Japan 2027' })).status).toBe(409);
  });

  it('adds contributions and computes monthly rollups', async () => {
    const now = new Date();
    const thisMonthDay = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const lastMonthDay = isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 15));
    await auth(request(app).post(`/api/savings-goals/${goal.id}/contributions`)).send({ amount: 5000, date: thisMonthDay });
    await auth(request(app).post(`/api/savings-goals/${goal.id}/contributions`)).send({ amount: 434.05, date: thisMonthDay });
    await auth(request(app).post(`/api/savings-goals/${goal.id}/contributions`)).send({ amount: 1000, date: lastMonthDay });

    const res = await auth(request(app).get('/api/savings-goals'));
    const g = res.body.goals.find((x) => x.id === goal.id);
    expect(g.total).toBe(6434.05);
    expect(g.thisMonth).toBe(5434.05);
    expect(g.lastMonth).toBe(1000);
    expect(g.contributions).toHaveLength(3);
  });

  it('404s adding a contribution to an unknown goal', async () => {
    const res = await auth(request(app).post('/api/savings-goals/nope/contributions')).send({ amount: 10, date: '2026-07-01' });
    expect(res.status).toBe(404);
  });

  it('deletes a contribution', async () => {
    const list = await auth(request(app).get('/api/savings-goals'));
    const g = list.body.goals.find((x) => x.id === goal.id);
    const cid = g.contributions[0].id;
    expect((await auth(request(app).delete(`/api/savings-goals/${goal.id}/contributions/${cid}`))).status).toBe(204);
  });

  it('updates a goal', async () => {
    const res = await auth(request(app).put(`/api/savings-goals/${goal.id}`)).send({ name: 'Japan Trip 2027' });
    expect(res.status).toBe(200);
    expect(res.body.goal.name).toBe('Japan Trip 2027');
  });

  it('deletes a goal (cascades contributions)', async () => {
    expect((await auth(request(app).delete(`/api/savings-goals/${goal.id}`))).status).toBe(204);
    const res = await auth(request(app).get('/api/savings-goals'));
    expect(res.body.goals.find((x) => x.id === goal.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npm test -- savings`
Expected: FAIL — missing route.

- [ ] **Step 3: Implement**

Create `backend/src/services/savingsService.js`:

```js
import { prisma } from '../utils/prisma.js';
import { ApiError } from '../utils/ApiError.js';

const round2 = (n) => Math.round(n * 100) / 100;

export async function listGoals(userId) {
  const goals = await prisma.savingsGoal.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { contributions: { orderBy: { date: 'desc' } } },
  });
  const now = new Date();
  const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return goals.map((goal) => {
    const total = round2(goal.contributions.reduce((acc, c) => acc + c.amount, 0));
    const thisMonth = round2(
      goal.contributions.filter((c) => c.date >= thisStart).reduce((acc, c) => acc + c.amount, 0),
    );
    const lastMonth = round2(
      goal.contributions
        .filter((c) => c.date >= lastStart && c.date < thisStart)
        .reduce((acc, c) => acc + c.amount, 0),
    );
    return { ...goal, total, thisMonth, lastMonth };
  });
}

export async function getGoal(userId, id) {
  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
  if (!goal) throw new ApiError(404, 'Savings goal not found');
  return goal;
}

export async function createGoal(userId, { name, target }) {
  const existing = await prisma.savingsGoal.findFirst({ where: { userId, name } });
  if (existing) throw new ApiError(409, 'A savings goal with this name already exists');
  return prisma.savingsGoal.create({ data: { userId, name, target: target ?? null } });
}

export async function updateGoal(userId, id, { name, target }) {
  const goal = await getGoal(userId, id);
  if (name !== undefined && name !== goal.name) {
    const clash = await prisma.savingsGoal.findFirst({ where: { userId, name } });
    if (clash) throw new ApiError(409, 'A savings goal with this name already exists');
  }
  return prisma.savingsGoal.update({ where: { id }, data: { name, target } });
}

export async function deleteGoal(userId, id) {
  await getGoal(userId, id);
  await prisma.savingsGoal.delete({ where: { id } });
}

export async function addContribution(userId, goalId, data) {
  await getGoal(userId, goalId);
  return prisma.savingsContribution.create({
    data: { ...data, goalId, date: new Date(data.date) },
  });
}

export async function removeContribution(userId, goalId, contributionId) {
  await getGoal(userId, goalId);
  const contribution = await prisma.savingsContribution.findFirst({
    where: { id: contributionId, goalId },
  });
  if (!contribution) throw new ApiError(404, 'Contribution not found');
  await prisma.savingsContribution.delete({ where: { id: contributionId } });
}
```

Create `backend/src/controllers/savingsController.js`:

```js
import * as savingsService from '../services/savingsService.js';

export async function list(req, res, next) {
  try {
    res.json({ goals: await savingsService.listGoals(req.user.id) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const goal = await savingsService.createGoal(req.user.id, req.body);
    res.status(201).json({ goal });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const goal = await savingsService.updateGoal(req.user.id, req.params.id, req.body);
    res.json({ goal });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await savingsService.deleteGoal(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function addContribution(req, res, next) {
  try {
    const contribution = await savingsService.addContribution(req.user.id, req.params.id, req.body);
    res.status(201).json({ contribution });
  } catch (err) {
    next(err);
  }
}

export async function removeContribution(req, res, next) {
  try {
    await savingsService.removeContribution(req.user.id, req.params.id, req.params.cid);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
```

Create `backend/src/routes/savingsRoutes.js`:

```js
import { Router } from 'express';
import { z } from 'zod';
import * as savingsController from '../controllers/savingsController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const goalBody = z.object({
  name: z.string().trim().min(1).max(60),
  target: z.number().positive().nullable().optional(),
});

const contributionBody = z.object({
  amount: z.number().positive(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes: z.string().max(1000).nullable().optional(),
});

router.get('/', savingsController.list);
router.post('/', validate({ body: goalBody }), savingsController.create);
router.put('/:id', validate({ body: goalBody.partial() }), savingsController.update);
router.delete('/:id', savingsController.remove);
router.post('/:id/contributions', validate({ body: contributionBody }), savingsController.addContribution);
router.delete('/:id/contributions/:cid', savingsController.removeContribution);

export default router;
```

In `backend/src/app.js`, add `import savingsRoutes from './routes/savingsRoutes.js';` and `app.use('/api/savings-goals', savingsRoutes);`.

- [ ] **Step 4: Run tests**

Run: `cd backend && npm test -- savings` then `cd backend && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/tests/savings.test.js
git commit -m "feat(backend): savings goals with contributions and monthly rollups"
```

---

### Task 7: Dashboard cash flow + wallet snapshot

**Files:**
- Test: `backend/tests/dashboard.test.js` (add a describe block)
- Modify: `backend/src/services/statsService.js` (`getDashboard`)

**Interfaces:**
- Consumes: `walletService.listWallets`, Debt and SavingsContribution tables.
- Produces: dashboard response gains
  `cashFlow: { thisMonth: { startBalance, income, expense, debt, savings, endBalance }, lastMonth: { same } }` and
  `wallets: [{ id, name, color, balance }]`.
  Semantics: `startBalance(M) = Σ wallet.initialBalance + Σ income dated < M-start − Σ expenses dated < M-start`; `debt(M) = Σ unpaid debts dated < M-end` (point-in-time as of that month's end); `savings(M) = Σ contributions within M`; `endBalance = startBalance + income − expense`. "thisMonth" is the dashboard's selected `month` param; "lastMonth" is the calendar month before it.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/dashboard.test.js` (reuse the file's existing app/token setup — create a dedicated user inside the block to keep sums deterministic):

```js
describe('dashboard cash flow', () => {
  let cfToken;
  const auth = (req) => req.set('Authorization', `Bearer ${cfToken}`);

  beforeAll(async () => {
    ({ token: cfToken } = await createTestUser(app, 'cashflow@test.com', 'Cash Flow', ['Food']));
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const day = (d) => `${thisMonth}-${String(d).padStart(2, '0')}`;

    const wallet = (await auth(request(app).post('/api/wallets')).send({ name: 'GCash', initialBalance: 100 })).body.wallet;
    await auth(request(app).post('/api/income')).send({ source: 'Salary', amount: 50, date: day(1), walletId: wallet.id });
    await auth(request(app).post('/api/expenses')).send({ title: 'Snack', amount: 20, category: 'Food', date: day(2), walletId: wallet.id });
    await auth(request(app).post('/api/debts')).send({ person: 'Alice', amount: 40, date: day(3) });
    const goal = (await auth(request(app).post('/api/savings-goals')).send({ name: 'Fund' })).body.goal;
    await auth(request(app).post(`/api/savings-goals/${goal.id}/contributions`)).send({ amount: 25, date: day(4) });
  });

  it('returns cashFlow and wallet balances', async () => {
    const res = await auth(request(app).get('/api/dashboard'));
    expect(res.status).toBe(200);
    const { cashFlow, wallets } = res.body;
    // Default 'Cash' wallet (0) + GCash (100 initial)
    expect(cashFlow.thisMonth.startBalance).toBe(100);
    expect(cashFlow.thisMonth.income).toBe(50);
    expect(cashFlow.thisMonth.expense).toBe(20);
    expect(cashFlow.thisMonth.debt).toBe(40);
    expect(cashFlow.thisMonth.savings).toBe(25);
    expect(cashFlow.thisMonth.endBalance).toBe(130); // 100 + 50 − 20
    expect(cashFlow.lastMonth.income).toBe(0);
    const gcash = wallets.find((w) => w.name === 'GCash');
    expect(gcash.balance).toBe(130);
  });
});
```

(Add `beforeAll` to the vitest import in that file if not already imported, and `createTestUser` is already imported.)

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npm test -- dashboard`
Expected: FAIL — `cashFlow` is undefined.

- [ ] **Step 3: Implement in statsService**

In `backend/src/services/statsService.js`:

Add import at top:

```js
import { listWallets } from './walletService.js';
```

In `getDashboard`, after the `const sixMonthsAgo = ...` line add:

```js
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
```

Extend the big `Promise.all` with these additional queries (append to the destructuring and the array):

```js
  const [
    expenses, incomes, allExp, allInc, budgets, recentExpenses, recentIncomes,
    wallets, unpaidDebts, cfContributions, expBeforeStart, incBeforeStart, expBeforePrev, incBeforePrev,
  ] = await Promise.all([
    // …the seven existing queries stay unchanged…
    listWallets(userId),
    prisma.debt.findMany({ where: { userId, paid: false } }),
    prisma.savingsContribution.findMany({ where: { goal: { userId }, date: { gte: prevStart, lt: end } } }),
    prisma.expense.aggregate({ where: { userId, date: { lt: start } }, _sum: { amount: true } }),
    prisma.income.aggregate({ where: { userId, date: { lt: start } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { userId, date: { lt: prevStart } }, _sum: { amount: true } }),
    prisma.income.aggregate({ where: { userId, date: { lt: prevStart } }, _sum: { amount: true } }),
  ]);
```

After the `monthExpenses`/`monthIncomes` lines add:

```js
  const prevExpenses = expenses.filter((e) => e.date >= prevStart && e.date < start);
  const prevIncomes = incomes.filter((i) => i.date >= prevStart && i.date < start);

  const initialTotal = wallets.reduce((acc, w) => acc + w.initialBalance, 0);

  function cashFlowFor(windowStart, windowEnd, incomeSum, expenseSum, priorInc, priorExp) {
    const startBalance = round2(initialTotal + priorInc - priorExp);
    const debt = round2(
      unpaidDebts.filter((d) => d.date < windowEnd).reduce((acc, d) => acc + d.amount, 0),
    );
    const savings = round2(
      cfContributions
        .filter((c) => c.date >= windowStart && c.date < windowEnd)
        .reduce((acc, c) => acc + c.amount, 0),
    );
    return {
      startBalance,
      income: incomeSum,
      expense: expenseSum,
      debt,
      savings,
      endBalance: round2(startBalance + incomeSum - expenseSum),
    };
  }

  const cashFlow = {
    thisMonth: cashFlowFor(
      start, end, totalIncome, totalExpenses,
      incBeforeStart._sum.amount ?? 0, expBeforeStart._sum.amount ?? 0,
    ),
    lastMonth: cashFlowFor(
      prevStart, start, sum(prevIncomes), sum(prevExpenses),
      incBeforePrev._sum.amount ?? 0, expBeforePrev._sum.amount ?? 0,
    ),
  };
```

(`cashFlowFor` must appear after `totalIncome`/`totalExpenses` are computed.)

Add to the returned object, alongside `recentActivity`/`alerts`/`budgets`:

```js
    cashFlow,
    wallets: wallets.map((w) => ({ id: w.id, name: w.name, color: w.color, balance: w.balance })),
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npm test -- dashboard` then `cd backend && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/statsService.js backend/tests/dashboard.test.js
git commit -m "feat(backend): month-carryover cash flow and wallet snapshot on dashboard"
```

---

### Task 8: Demo seed data for the new entities

**Files:**
- Modify: `backend/prisma/seed.js`

**Interfaces:**
- Consumes: all Task 2 tables.
- Produces: demo user with the spreadsheet's 7 wallets, walletIds on expenses/income, ~4 transfers, 3 debts (1 paid), 2 savings goals with contributions across the seeded months.

- [ ] **Step 1: Replace the minimal wallet block from Task 2 with the full demo set**

In `backend/prisma/seed.js`, replace the `walletNames`/`createMany` block added in Task 2 with:

```js
  const WALLET_DEFS = [
    { name: 'Cash', color: '#1baf7a', initialBalance: 950 },
    { name: 'GCash', color: '#2a78d6', initialBalance: 6500 },
    { name: 'Maya', color: '#008300', initialBalance: 300 },
    { name: 'GoTyme', color: '#0891b2', initialBalance: 20 },
    { name: 'PayPal', color: '#4a3aa7', initialBalance: 30 },
    { name: 'Shopee Pay', color: '#eb6834', initialBalance: 0 },
    { name: 'Beep Card', color: '#eda100', initialBalance: 110 },
  ];
  await prisma.wallet.createMany({
    data: WALLET_DEFS.map((w) => ({ userId: user.id, ...w })),
  });
  const wallets = await prisma.wallet.findMany({ where: { userId: user.id } });
  const walletIds = wallets.map((w) => w.id);
  const walletByName = (name) => wallets.find((w) => w.name === name);
```

Keep the existing expense/income generation, with `walletId: pick(walletIds)` on the random expenses, `walletId: walletByName('GCash').id` on the rent expense (replacing the Task 2 'Bank Transfer' line — that wallet no longer exists), and add `walletId: walletByName('GCash').id` to the salary income rows and `walletId: pick(walletIds)` to the freelance rows.

- [ ] **Step 2: Add transfers, debts and savings goals after the budget block**

```js
  await prisma.transfer.createMany({
    data: [
      { userId: user.id, fromWalletId: walletByName('GCash').id, toWalletId: walletByName('Cash').id, amount: 500, date: new Date(now.getFullYear(), now.getMonth(), 3, 10), notes: 'Cash out' },
      { userId: user.id, fromWalletId: walletByName('GCash').id, toWalletId: walletByName('Maya').id, amount: 250, date: new Date(now.getFullYear(), now.getMonth(), 8, 14), notes: null },
      { userId: user.id, fromWalletId: walletByName('Cash').id, toWalletId: walletByName('Beep Card').id, amount: 100, date: new Date(now.getFullYear(), now.getMonth() - 1, 20, 9), notes: 'Commute top-up' },
      { userId: user.id, fromWalletId: walletByName('PayPal').id, toWalletId: walletByName('GCash').id, amount: 30, date: new Date(now.getFullYear(), now.getMonth() - 2, 12, 16), notes: null },
    ],
  });

  await prisma.debt.createMany({
    data: [
      { userId: user.id, person: 'Alice', amount: 750, date: new Date(now.getFullYear(), now.getMonth(), 5), paid: false, notes: 'Concert tickets' },
      { userId: user.id, person: 'Ben', amount: 1200, date: new Date(now.getFullYear(), now.getMonth() - 1, 18), paid: false, notes: null },
      { userId: user.id, person: 'Carla', amount: 300, date: new Date(now.getFullYear(), now.getMonth() - 2, 9), paid: true, notes: 'Repaid in full' },
    ],
  });

  const personal = await prisma.savingsGoal.create({ data: { userId: user.id, name: 'Personal', target: null } });
  const japan = await prisma.savingsGoal.create({ data: { userId: user.id, name: 'Japan 2027', target: 150000 } });
  const contributions = [];
  for (let m = 5; m >= 0; m--) {
    contributions.push(
      { goalId: personal.id, amount: randBetween(200, 900), date: new Date(now.getFullYear(), now.getMonth() - m, 10), notes: null },
      { goalId: japan.id, amount: randBetween(2000, 6000), date: new Date(now.getFullYear(), now.getMonth() - m, 2), notes: 'Monthly set-aside' },
    );
  }
  await prisma.savingsContribution.createMany({ data: contributions });
```

Update the final `console.log` to mention wallets, transfers, debts and goals.

- [ ] **Step 3: Run the seed and the suite**

Run: `cd backend && npm run seed`
Expected: success log listing the new counts.
Run: `cd backend && npm test`
Expected: PASS (seed does not affect the tests schema).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed.js
git commit -m "feat(backend): seed demo wallets, transfers, debts and savings goals"
```

---

### Task 9: OpenAPI, README, CLAUDE.md

**Files:**
- Modify: `backend/src/config/openapi.js`
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the OpenAPI spec**

In `backend/src/config/openapi.js` (the `PAYMENT_METHODS` removal already happened in Task 2 Step 8):
- In the `Expense` schema, next to the `walletId` property added in Task 2, add:

```js
          wallet: {
            type: 'object', nullable: true,
            properties: { id: { type: 'string' }, name: { type: 'string' }, color: { type: 'string', nullable: true } },
          },
```

- Add `walletId: { type: 'string', nullable: true }` to the income input schema.
- Add component schemas:

```js
      Wallet: {
        type: 'object',
        properties: {
          id: { type: 'string' }, userId: { type: 'string' }, name: { type: 'string' },
          color: { type: 'string', nullable: true }, initialBalance: { type: 'number' },
          totalIncome: { type: 'number' }, totalExpenses: { type: 'number' },
          transfersIn: { type: 'number' }, transfersOut: { type: 'number' }, balance: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Transfer: {
        type: 'object',
        properties: {
          id: { type: 'string' }, fromWalletId: { type: 'string' }, toWalletId: { type: 'string' },
          amount: { type: 'number' }, date: { type: 'string', format: 'date-time' },
          notes: { type: 'string', nullable: true },
        },
      },
      Debt: {
        type: 'object',
        properties: {
          id: { type: 'string' }, person: { type: 'string' }, amount: { type: 'number' },
          date: { type: 'string', format: 'date-time' }, paid: { type: 'boolean' },
          notes: { type: 'string', nullable: true },
        },
      },
      SavingsGoal: {
        type: 'object',
        properties: {
          id: { type: 'string' }, name: { type: 'string' }, target: { type: 'number', nullable: true },
          total: { type: 'number' }, thisMonth: { type: 'number' }, lastMonth: { type: 'number' },
          contributions: { type: 'array', items: { type: 'object' } },
        },
      },
```

- Add paths following the exact style of the existing entries (`security: bearerAuth`, `ok(...)` helper, tags):

```js
    '/api/wallets': {
      get: { tags: ['Wallets'], security: bearerAuth, summary: 'List wallets with computed balances', responses: ok('Wallet list') },
      post: { tags: ['Wallets'], security: bearerAuth, summary: 'Create wallet', responses: { 201: { description: 'Created' }, 409: { description: 'Duplicate name' } } },
    },
    '/api/wallets/{id}': {
      put: { tags: ['Wallets'], security: bearerAuth, parameters: [idParam], summary: 'Update wallet', responses: ok('Updated') },
      delete: { tags: ['Wallets'], security: bearerAuth, parameters: [idParam], summary: 'Delete wallet (blocked while referenced)', responses: { 204: { description: 'Deleted' }, 409: { description: 'Still referenced' } } },
    },
    '/api/transfers': {
      get: { tags: ['Transfers'], security: bearerAuth, parameters: paginationParams, summary: 'List transfers', responses: ok('Transfer list') },
      post: { tags: ['Transfers'], security: bearerAuth, summary: 'Create transfer between wallets', responses: { 201: { description: 'Created' }, 400: { description: 'Same wallet or unknown wallet' } } },
    },
    '/api/transfers/{id}': {
      put: { tags: ['Transfers'], security: bearerAuth, parameters: [idParam], summary: 'Update transfer', responses: ok('Updated') },
      delete: { tags: ['Transfers'], security: bearerAuth, parameters: [idParam], summary: 'Delete transfer', responses: { 204: { description: 'Deleted' } } },
    },
    '/api/debts': {
      get: { tags: ['Debts'], security: bearerAuth, parameters: paginationParams, summary: 'List debts with unpaid/paid totals', responses: ok('Debt list') },
      post: { tags: ['Debts'], security: bearerAuth, summary: 'Create debt', responses: { 201: { description: 'Created' } } },
    },
    '/api/debts/{id}': {
      put: { tags: ['Debts'], security: bearerAuth, parameters: [idParam], summary: 'Update debt / toggle paid', responses: ok('Updated') },
      delete: { tags: ['Debts'], security: bearerAuth, parameters: [idParam], summary: 'Delete debt', responses: { 204: { description: 'Deleted' } } },
    },
    '/api/savings-goals': {
      get: { tags: ['Savings'], security: bearerAuth, summary: 'List savings goals with rollups', responses: ok('Goal list') },
      post: { tags: ['Savings'], security: bearerAuth, summary: 'Create savings goal', responses: { 201: { description: 'Created' }, 409: { description: 'Duplicate name' } } },
    },
    '/api/savings-goals/{id}': {
      put: { tags: ['Savings'], security: bearerAuth, parameters: [idParam], summary: 'Update savings goal', responses: ok('Updated') },
      delete: { tags: ['Savings'], security: bearerAuth, parameters: [idParam], summary: 'Delete savings goal', responses: { 204: { description: 'Deleted' } } },
    },
    '/api/savings-goals/{id}/contributions': {
      post: { tags: ['Savings'], security: bearerAuth, parameters: [idParam], summary: 'Add contribution', responses: { 201: { description: 'Created' } } },
    },
    '/api/savings-goals/{id}/contributions/{cid}': {
      delete: {
        tags: ['Savings'], security: bearerAuth,
        parameters: [idParam, { name: 'cid', in: 'path', required: true, schema: { type: 'string' } }],
        summary: 'Delete contribution', responses: { 204: { description: 'Deleted' } },
      },
    },
```

Then run `cd backend && npm test` (the app imports openapi.js at boot — a syntax error would fail every test).

- [ ] **Step 2: Update README.md**

- Features list: replace the paymentMethod mention in the Expenses bullet with wallet; add bullets:
  - **Wallets** — named accounts (initial balance + computed running balance from income, expenses and transfers); wallet dropdowns on expense/income forms
  - **Transfers** — move money between wallets
  - **Debts** — who/amount/date with paid-unpaid toggle and totals
  - **Savings goals** — named goals with contributions, monthly and total rollups, optional target
  - Dashboard bullet: mention the cash-flow card (start/end balance carryover, debt, savings) and wallet snapshot
- API overview: add the four new endpoint families.
- Database line: SQLite is gone — dev/tests/production all run PostgreSQL (dev/tests on Supabase; tests use a dedicated `tests` schema).
- Project structure: add the new pages/stores.

- [ ] **Step 3: Update CLAUDE.md**

- Commands: note `npm test` now targets a `tests` schema on the Postgres `DATABASE_URL` (see `tests/setup/testDb.js`); remove "isolated SQLite test db" wording; `npx prisma migrate dev` now targets Supabase Postgres.
- Architecture: update the two-schema note (both files are now `postgresql`; schema.postgres.prisma remains for the Docker image swap; keep models in sync). Add: wallets are FK-linked (`walletId`) unlike categories (validated strings); wallet balances are computed in `walletService.listWallets`, never stored; deletes are blocked while referenced (409).
- Gotchas: replace the SQLite `createMany skipDuplicates`/write-lock notes with the Postgres reality (tests still run sequentially because they share one `tests` schema; `contains` needs `mode: 'insensitive'`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/config/openapi.js README.md CLAUDE.md
git commit -m "docs: API docs and project docs for wallets, transfers, debts, savings"
```

---

### Task 10: Frontend — wallets store, Wallets page, navigation

**Files:**
- Create: `frontend/src/stores/wallets.js`
- Create: `frontend/src/pages/WalletsPage.vue`
- Test: `frontend/src/stores/__tests__/wallets.test.js`
- Modify: `frontend/src/router/index.js` (route)
- Modify: `frontend/src/layouts/AppLayout.vue` (nav item)
- Modify: `frontend/src/components/ui/Icon.vue` (new icons)

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/wallets` (Task 3).
- Produces: `useWalletsStore` with state `{ wallets, loading, loaded }`, getters `options` (`[{ value: id, label: name }]`) and `nameOf(id)`, actions `ensureLoaded/fetch/create/update/remove` — Tasks 11, 12, 15 rely on `options` and `ensureLoaded`.

- [ ] **Step 1: Write the failing store test**

Create `frontend/src/stores/__tests__/wallets.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api.js';
import { useWalletsStore } from '../wallets.js';

const WALLETS = [
  { id: 'w1', name: 'Cash', color: '#1baf7a', balance: 500 },
  { id: 'w2', name: 'GCash', color: '#2a78d6', balance: 1200 },
];

describe('wallets store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetch loads wallets', async () => {
    api.get.mockResolvedValue({ data: { wallets: WALLETS } });
    const store = useWalletsStore();
    await store.fetch();
    expect(api.get).toHaveBeenCalledWith('/wallets');
    expect(store.wallets).toHaveLength(2);
    expect(store.loaded).toBe(true);
  });

  it('ensureLoaded only fetches once', async () => {
    api.get.mockResolvedValue({ data: { wallets: WALLETS } });
    const store = useWalletsStore();
    await store.ensureLoaded();
    await store.ensureLoaded();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('options getter maps id/name pairs', async () => {
    api.get.mockResolvedValue({ data: { wallets: WALLETS } });
    const store = useWalletsStore();
    await store.fetch();
    expect(store.options).toEqual([
      { value: 'w1', label: 'Cash' },
      { value: 'w2', label: 'GCash' },
    ]);
    expect(store.nameOf('w2')).toBe('GCash');
  });

  it('create posts then refetches', async () => {
    api.post.mockResolvedValue({ data: { wallet: WALLETS[0] } });
    api.get.mockResolvedValue({ data: { wallets: WALLETS } });
    const store = useWalletsStore();
    await store.create({ name: 'Cash' });
    expect(api.post).toHaveBeenCalledWith('/wallets', { name: 'Cash' });
    expect(api.get).toHaveBeenCalled();
  });
});
```

Run: `cd frontend && npm test`
Expected: FAIL — `../wallets.js` doesn't exist.

- [ ] **Step 2: Implement the store**

Create `frontend/src/stores/wallets.js`:

```js
import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useWalletsStore = defineStore('wallets', {
  state: () => ({
    wallets: [],
    loading: false,
    loaded: false,
  }),

  getters: {
    options: (state) => state.wallets.map((w) => ({ value: w.id, label: w.name })),
    nameOf: (state) => (id) => state.wallets.find((w) => w.id === id)?.name ?? '—',
  },

  actions: {
    // Cheap to call from every page that needs the list; only hits the API once.
    async ensureLoaded() {
      if (this.loaded || this.loading) return;
      await this.fetch();
    },

    async fetch() {
      this.loading = true;
      try {
        const { data } = await api.get('/wallets');
        this.wallets = data.wallets;
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      const { data } = await api.post('/wallets', payload);
      await this.fetch();
      return data.wallet;
    },

    async update(id, payload) {
      const { data } = await api.put(`/wallets/${id}`, payload);
      await this.fetch();
      return data.wallet;
    },

    async remove(id) {
      await api.delete(`/wallets/${id}`);
      await this.fetch();
    },
  },
});
```

Run: `cd frontend && npm test` — Expected: PASS.

- [ ] **Step 3: Add icons**

In `frontend/src/components/ui/Icon.vue`, add to the `paths` object:

```js
  'credit-card': 'M2 5h20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM1 10h22',
  scale: 'M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM7 21h10M12 3v18M3 7h18',
  coins: 'M8 8m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82',
  'arrow-right-left': 'M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4',
```

- [ ] **Step 4: Create the Wallets page**

Create `frontend/src/pages/WalletsPage.vue`:

```vue
<script setup>
import { onMounted, ref, reactive, computed, watch } from 'vue';
import { useWalletsStore } from '../stores/wallets.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import { formatMoney } from '../utils/format.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseModal from '../components/ui/BaseModal.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import Icon from '../components/ui/Icon.vue';

const SWATCHES = [
  '#eda100', '#2a78d6', '#1baf7a', '#e87ba4', '#4a3aa7', '#eb6834',
  '#e34948', '#008300', '#0891b2', '#4d7c0f', '#9333ea', '#64748b',
];

const store = useWalletsStore();
const ui = useUiStore();

const formOpen = ref(false);
const editing = ref(null);
const saving = ref(false);
const touched = reactive({});
const form = reactive({ name: '', color: '', initialBalance: '' });

const errors = computed(() => ({
  name: touched.name && !form.name.trim() ? 'Give this wallet a name' : '',
}));

watch(formOpen, (open) => {
  if (!open) return;
  touched.name = false;
  if (editing.value) {
    form.name = editing.value.name;
    form.color = editing.value.color ?? '';
    form.initialBalance = editing.value.initialBalance;
  } else {
    form.name = '';
    form.color = SWATCHES[store.wallets.length % SWATCHES.length];
    form.initialBalance = '';
  }
});

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(wallet) {
  editing.value = wallet;
  formOpen.value = true;
}

async function save() {
  touched.name = true;
  if (errors.value.name) return;

  saving.value = true;
  const payload = {
    name: form.name.trim(),
    color: form.color || null,
    initialBalance: Number(form.initialBalance) || 0,
  };
  try {
    if (editing.value) {
      await store.update(editing.value.id, payload);
      ui.toast('Wallet updated');
    } else {
      await store.create(payload);
      ui.toast('Wallet added');
    }
    formOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save wallet'), 'error');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(wallet) {
  const confirmed = await ui.confirm({
    title: 'Delete this wallet?',
    message: `"${wallet.name}" will be removed. This is blocked while expenses, income or transfers still use it.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.remove(wallet.id);
    ui.toast('Wallet deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not delete wallet'), 'error');
  }
}

onMounted(() => store.fetch());
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Balances update automatically from income, expenses and transfers.
      </p>
      <BaseButton @click="openCreate">
        <Icon name="plus" :size="16" />
        Add wallet
      </BaseButton>
    </div>

    <SkeletonLoader v-if="store.loading && !store.wallets.length" variant="card" :count="3" />

    <div v-else-if="store.wallets.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <BaseCard v-for="wallet in store.wallets" :key="wallet.id">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: wallet.color ?? '#64748b' }" />
            <span class="text-sm font-bold">{{ wallet.name }}</span>
          </div>
          <div class="flex gap-0.5">
            <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit wallet" title="Edit" @click="openEdit(wallet)">
              <Icon name="edit" :size="15" />
            </button>
            <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete wallet" title="Delete" @click="confirmDelete(wallet)">
              <Icon name="trash" :size="15" />
            </button>
          </div>
        </div>
        <p class="amount mt-3 text-2xl font-extrabold tracking-tight">{{ formatMoney(wallet.balance) }}</p>
        <dl class="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <dt class="font-semibold uppercase tracking-wider">Initial</dt>
            <dd class="amount mt-0.5">{{ formatMoney(wallet.initialBalance) }}</dd>
          </div>
          <div>
            <dt class="font-semibold uppercase tracking-wider">In</dt>
            <dd class="amount mt-0.5 text-brand-600 dark:text-brand-400">{{ formatMoney(wallet.totalIncome + wallet.transfersIn) }}</dd>
          </div>
          <div>
            <dt class="font-semibold uppercase tracking-wider">Out</dt>
            <dd class="amount mt-0.5 text-rose-600 dark:text-rose-400">{{ formatMoney(wallet.totalExpenses + wallet.transfersOut) }}</dd>
          </div>
        </dl>
      </BaseCard>
    </div>

    <BaseCard v-else>
      <EmptyState icon="credit-card" title="No wallets yet" message="Add wallets like Cash or GCash to track where your money lives.">
        <template #action>
          <BaseButton @click="openCreate">
            <Icon name="plus" :size="16" />
            Add wallet
          </BaseButton>
        </template>
      </EmptyState>
    </BaseCard>

    <BaseModal :open="formOpen" :title="editing ? 'Edit wallet' : 'Add wallet'" @close="formOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseInput v-model="form.name" label="Name" placeholder="e.g. GCash" :error="errors.name" required @blur="touched.name = true" />
        <BaseInput v-model="form.initialBalance" label="Initial balance" type="number" step="0.01" placeholder="0.00" />
        <div>
          <span class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Color</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="swatch in SWATCHES"
              :key="swatch"
              type="button"
              class="h-7 w-7 rounded-full ring-offset-2 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-slate-900"
              :class="form.color === swatch ? 'ring-2 ring-slate-900 dark:ring-white' : ''"
              :style="{ backgroundColor: swatch }"
              :aria-label="`Choose color ${swatch}`"
              @click="form.color = swatch"
            />
          </div>
        </div>
        <button type="submit" class="hidden" aria-hidden="true" />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">Cancel</BaseButton>
        <BaseButton :loading="saving" @click="save">{{ editing ? 'Save changes' : 'Add wallet' }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
```

- [ ] **Step 5: Register route and nav**

In `frontend/src/router/index.js`, add to the authed children after the `budgets` entry:

```js
      { path: 'wallets', name: 'wallets', component: () => import('../pages/WalletsPage.vue'), meta: { title: 'Wallets' } },
```

In `frontend/src/layouts/AppLayout.vue`, add to the `nav` array after the `budgets` item:

```js
  { name: 'wallets', label: 'Wallets', icon: 'credit-card', to: '/wallets' },
```

- [ ] **Step 6: Verify**

Run: `cd frontend && npm test`
Expected: PASS.
Run: `cd frontend && npm run build`
Expected: build succeeds (catches template/import errors).

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): wallets store, Wallets page and navigation"
```

---

### Task 11: Frontend — transfers UI on the Wallets page

**Files:**
- Modify: `frontend/src/stores/wallets.js` (transfer state + actions)
- Create: `frontend/src/components/TransferFormModal.vue`
- Modify: `frontend/src/pages/WalletsPage.vue` (transfer history section)
- Test: `frontend/src/stores/__tests__/wallets.test.js` (add transfer action tests)

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/transfers` (Task 4); `useWalletsStore.options`.
- Produces: store gains `transfers, transfersTotal, transfersPage, transfersTotalPages, transfersLoading` state and `fetchTransfers/createTransfer/updateTransfer/removeTransfer/setTransfersPage` actions. Creating/updating/removing a transfer refetches wallets too (balances change).

- [ ] **Step 1: Extend the store test**

Append to `frontend/src/stores/__tests__/wallets.test.js` inside the describe block:

```js
  it('createTransfer posts then refetches transfers and wallets', async () => {
    api.post.mockResolvedValue({ data: { transfer: { id: 't1' } } });
    api.get.mockResolvedValue({ data: { wallets: WALLETS, items: [], total: 0, totalPages: 1 } });
    const store = useWalletsStore();
    await store.createTransfer({ fromWalletId: 'w1', toWalletId: 'w2', amount: 100, date: '2026-07-01' });
    expect(api.post).toHaveBeenCalledWith('/transfers', { fromWalletId: 'w1', toWalletId: 'w2', amount: 100, date: '2026-07-01' });
    expect(api.get).toHaveBeenCalledWith('/transfers', expect.anything());
    expect(api.get).toHaveBeenCalledWith('/wallets');
  });
```

Run: `cd frontend && npm test` — Expected: FAIL (`createTransfer` is not a function).

- [ ] **Step 2: Extend the store**

In `frontend/src/stores/wallets.js` add to `state`:

```js
    transfers: [],
    transfersTotal: 0,
    transfersPage: 1,
    transfersPageSize: 10,
    transfersTotalPages: 1,
    transfersLoading: false,
```

and add these actions:

```js
    async fetchTransfers() {
      this.transfersLoading = true;
      try {
        const { data } = await api.get('/transfers', {
          params: { page: this.transfersPage, pageSize: this.transfersPageSize },
        });
        this.transfers = data.items;
        this.transfersTotal = data.total;
        this.transfersTotalPages = data.totalPages;
      } finally {
        this.transfersLoading = false;
      }
    },

    async createTransfer(payload) {
      await api.post('/transfers', payload);
      await Promise.all([this.fetchTransfers(), this.fetch()]);
    },

    async updateTransfer(id, payload) {
      await api.put(`/transfers/${id}`, payload);
      await Promise.all([this.fetchTransfers(), this.fetch()]);
    },

    async removeTransfer(id) {
      await api.delete(`/transfers/${id}`);
      await Promise.all([this.fetchTransfers(), this.fetch()]);
    },

    setTransfersPage(page) {
      this.transfersPage = page;
      this.fetchTransfers();
    },
```

Run: `cd frontend && npm test` — Expected: PASS.

- [ ] **Step 3: Create the transfer modal**

Create `frontend/src/components/TransferFormModal.vue`:

```vue
<script setup>
import { reactive, computed, ref, watch } from 'vue';
import { useWalletsStore } from '../stores/wallets.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import { toDateInput } from '../utils/format.js';
import BaseModal from './ui/BaseModal.vue';
import BaseInput from './ui/BaseInput.vue';
import BaseSelect from './ui/BaseSelect.vue';
import BaseButton from './ui/BaseButton.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  // transfer = edit mode; null = create mode
  transfer: { type: Object, default: null },
});

const emit = defineEmits(['close']);

const wallets = useWalletsStore();
const ui = useUiStore();

const form = reactive({ fromWalletId: '', toWalletId: '', amount: '', date: toDateInput(), notes: '' });
const touched = reactive({});
const saving = ref(false);
const isEdit = computed(() => !!props.transfer);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    Object.keys(touched).forEach((k) => delete touched[k]);
    if (props.transfer) {
      Object.assign(form, {
        fromWalletId: props.transfer.fromWalletId,
        toWalletId: props.transfer.toWalletId,
        amount: props.transfer.amount,
        date: toDateInput(props.transfer.date),
        notes: props.transfer.notes ?? '',
      });
    } else {
      Object.assign(form, { fromWalletId: '', toWalletId: '', amount: '', date: toDateInput(), notes: '' });
    }
  },
);

const errors = computed(() => ({
  fromWalletId: touched.fromWalletId && !form.fromWalletId ? 'Pick a source wallet' : '',
  toWalletId:
    touched.toWalletId && !form.toWalletId
      ? 'Pick a destination wallet'
      : touched.toWalletId && form.toWalletId && form.toWalletId === form.fromWalletId
        ? 'Pick a different wallet'
        : '',
  amount: touched.amount && (!form.amount || Number(form.amount) <= 0) ? 'Enter an amount above zero' : '',
  date: touched.date && !form.date ? 'Pick a date' : '',
}));

async function save() {
  ['fromWalletId', 'toWalletId', 'amount', 'date'].forEach((k) => (touched[k] = true));
  if (Object.values(errors.value).some(Boolean)) return;

  saving.value = true;
  const payload = {
    fromWalletId: form.fromWalletId,
    toWalletId: form.toWalletId,
    amount: Number(form.amount),
    date: form.date,
    notes: form.notes.trim() || null,
  };
  try {
    if (isEdit.value) {
      await wallets.updateTransfer(props.transfer.id, payload);
      ui.toast('Transfer updated');
    } else {
      await wallets.createTransfer(payload);
      ui.toast('Transfer recorded');
    }
    emit('close');
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save transfer'), 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" :title="isEdit ? 'Edit transfer' : 'New transfer'" @close="emit('close')">
    <form class="space-y-4" novalidate @submit.prevent="save">
      <div class="grid grid-cols-2 gap-4">
        <BaseSelect v-model="form.fromWalletId" label="From" :options="wallets.options" placeholder="Source" :error="errors.fromWalletId" required @blur="touched.fromWalletId = true" />
        <BaseSelect v-model="form.toWalletId" label="To" :options="wallets.options" placeholder="Destination" :error="errors.toWalletId" required @blur="touched.toWalletId = true" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <BaseInput v-model="form.amount" label="Amount" type="number" step="0.01" min="0" placeholder="0.00" :error="errors.amount" required @blur="touched.amount = true" />
        <BaseInput v-model="form.date" label="Date" type="date" :error="errors.date" required @blur="touched.date = true" />
      </div>
      <BaseInput v-model="form.notes" label="Notes" placeholder="Optional details" />
      <button type="submit" class="hidden" aria-hidden="true" />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancel</BaseButton>
      <BaseButton :loading="saving" @click="save">{{ isEdit ? 'Save changes' : 'Record transfer' }}</BaseButton>
    </template>
  </BaseModal>
</template>
```

- [ ] **Step 4: Add the transfer history section to WalletsPage**

In `frontend/src/pages/WalletsPage.vue`:

Script additions — imports:

```js
import DataTable from '../components/ui/DataTable.vue';
import PaginationBar from '../components/ui/PaginationBar.vue';
import TransferFormModal from '../components/TransferFormModal.vue';
import { formatDate } from '../utils/format.js';
```

(merge `formatDate` into the existing `format.js` import), state:

```js
const transferOpen = ref(false);
const editingTransfer = ref(null);

const transferColumns = [
  { key: 'date', label: 'Date' },
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'amount', label: 'Amount', align: 'right', class: 'amount font-semibold' },
  { key: 'actions', label: '', align: 'right' },
];

function openNewTransfer() {
  editingTransfer.value = null;
  transferOpen.value = true;
}

function openEditTransfer(transfer) {
  editingTransfer.value = transfer;
  transferOpen.value = true;
}

async function confirmDeleteTransfer(transfer) {
  const confirmed = await ui.confirm({
    title: 'Delete this transfer?',
    message: `${formatMoney(transfer.amount)} from ${transfer.fromWallet?.name} to ${transfer.toWallet?.name} will be removed and balances restored.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.removeTransfer(transfer.id);
    ui.toast('Transfer deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}
```

and change `onMounted` to:

```js
onMounted(() => {
  store.fetch();
  store.fetchTransfers();
});
```

Template — add before the closing `</div>` of the page (after the wallet-form `BaseModal`):

```vue
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-base font-bold tracking-tight">Transfers</h3>
      <BaseButton variant="secondary" :disabled="store.wallets.length < 2" @click="openNewTransfer">
        <Icon name="arrow-right-left" :size="16" />
        New transfer
      </BaseButton>
    </div>

    <BaseCard :padded="false">
      <SkeletonLoader v-if="store.transfersLoading && !store.transfers.length" variant="table" :count="3" class="p-5" />
      <template v-else-if="store.transfers.length">
        <DataTable :columns="transferColumns" :rows="store.transfers">
          <template #cell-date="{ row }">
            <span class="whitespace-nowrap text-slate-500 dark:text-slate-400">{{ formatDate(row.date) }}</span>
          </template>
          <template #cell-from="{ row }">{{ row.fromWallet?.name ?? '—' }}</template>
          <template #cell-to="{ row }">{{ row.toWallet?.name ?? '—' }}</template>
          <template #cell-amount="{ row }">{{ formatMoney(row.amount) }}</template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-0.5">
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit transfer" title="Edit" @click="openEditTransfer(row)">
                <Icon name="edit" :size="15" />
              </button>
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete transfer" title="Delete" @click="confirmDeleteTransfer(row)">
                <Icon name="trash" :size="15" />
              </button>
            </div>
          </template>
        </DataTable>
        <div class="border-t border-slate-100 px-4 dark:border-slate-800">
          <PaginationBar
            :page="store.transfersPage"
            :total-pages="store.transfersTotalPages"
            :total="store.transfersTotal"
            :page-size="store.transfersPageSize"
            @update:page="store.setTransfersPage($event)"
          />
        </div>
      </template>
      <EmptyState v-else icon="arrow-right-left" title="No transfers yet" message="Move money between wallets — balances update on both sides." />
    </BaseCard>

    <TransferFormModal :open="transferOpen" :transfer="editingTransfer" @close="transferOpen = false" />
```

- [ ] **Step 5: Verify and commit**

Run: `cd frontend && npm test && npm run build`
Expected: PASS / build succeeds.

```bash
git add frontend/src
git commit -m "feat(frontend): transfers between wallets on the Wallets page"
```

---

### Task 12: Frontend — swap paymentMethod for wallet on expense & income UI

**Files:**
- Modify: `frontend/src/utils/format.js` (remove `PAYMENT_METHODS`)
- Modify: `frontend/src/components/ExpenseFormModal.vue`
- Modify: `frontend/src/components/ExpenseFilters.vue`
- Modify: `frontend/src/stores/expenses.js`
- Modify: `frontend/src/pages/ExpensesPage.vue`
- Modify: `frontend/src/pages/IncomePage.vue`

**Interfaces:**
- Consumes: `useWalletsStore.options` / `ensureLoaded` (Task 10); backend `walletId` fields (Task 2).
- Produces: expense/income payloads send `walletId: string | null`; expense filter param is `walletId`.

- [ ] **Step 1: Remove the constant**

Delete the `PAYMENT_METHODS` export from `frontend/src/utils/format.js`.

- [ ] **Step 2: ExpenseFormModal — wallet select (optional field)**

In `frontend/src/components/ExpenseFormModal.vue`:
- Replace the `PAYMENT_METHODS` import with nothing (keep `toDateInput`), and add `import { useWalletsStore } from '../stores/wallets.js';` plus `const wallets = useWalletsStore();` and extend `onMounted` to `onMounted(() => { categories.ensureLoaded(); wallets.ensureLoaded(); });`
- In `blank()` replace `paymentMethod: ''` with `walletId: ''`.
- In the edit-mode `Object.assign` replace `paymentMethod: props.expense.paymentMethod,` with `walletId: props.expense.walletId ?? '',`.
- In `errors`, delete the `paymentMethod` line (wallet is optional).
- In `save()`, change the touched array to `['title', 'amount', 'date', 'category']` and the payload line to `walletId: form.walletId || null,` (replacing `paymentMethod: form.paymentMethod,`).
- Replace the payment-method `BaseSelect` in the template with:

```vue
      <BaseSelect
        v-model="form.walletId"
        label="Wallet"
        :options="wallets.options"
        placeholder="No wallet"
      />
```

- [ ] **Step 3: ExpenseFilters — wallet filter**

In `frontend/src/components/ExpenseFilters.vue`:
- Replace the `PAYMENT_METHODS` import with `import { useWalletsStore } from '../stores/wallets.js';`, add `const wallets = useWalletsStore();`, and extend `onMounted` to also call `wallets.ensureLoaded()`.
- Replace the payment-method select with:

```vue
    <BaseSelect v-model="props.filters.walletId" label="Wallet" :options="wallets.options" placeholder="All wallets" />
```

- [ ] **Step 4: Expenses store + page**

In `frontend/src/stores/expenses.js`, `defaultFilters`, replace `paymentMethod: '',` with `walletId: '',`.

In `frontend/src/pages/ExpensesPage.vue`:
- Replace the column `{ key: 'paymentMethod', label: 'Payment' }` with `{ key: 'wallet', label: 'Wallet' }`.
- Add a cell template inside the DataTable (wallet is an object, so the default renderer can't print it):

```vue
          <template #cell-wallet="{ row }">{{ row.wallet?.name ?? '—' }}</template>
```

- In the expense-detail modal, replace the Payment method row with:

```vue
        <div class="flex justify-between gap-4">
          <dt class="font-semibold text-slate-500">Wallet</dt>
          <dd>{{ viewing.wallet?.name ?? '—' }}</dd>
        </div>
```

- [ ] **Step 5: IncomePage — optional wallet on the form and table**

In `frontend/src/pages/IncomePage.vue`:
- Add imports: `import BaseSelect from '../components/ui/BaseSelect.vue';` and `import { useWalletsStore } from '../stores/wallets.js';`; add `const wallets = useWalletsStore();` and change `onMounted` to `onMounted(() => { store.fetch(); wallets.ensureLoaded(); });`
- Add `walletId: ''` to the `form` reactive and to both `Object.assign` branches (`walletId: editing.value.walletId ?? ''` in edit mode, `walletId: ''` in the reset).
- Add `walletId: form.walletId || null,` to the `payload` in `save()`.
- In the form template, after the amount/date grid, add:

```vue
        <BaseSelect v-model="form.walletId" label="Wallet" :options="wallets.options" placeholder="No wallet" />
```

- Add a wallet column: insert `{ key: 'wallet', label: 'Wallet' },` after the `source` column definition, and add the cell template inside the DataTable:

```vue
          <template #cell-wallet="{ row }">{{ row.wallet?.name ?? '—' }}</template>
```

- [ ] **Step 6: Sweep for leftovers, verify, commit**

Run: `grep -rn "paymentMethod\|PAYMENT_METHODS" frontend/src` — Expected: no matches.
Run: `cd frontend && npm test && npm run build` — Expected: PASS / build succeeds.

```bash
git add frontend/src
git commit -m "feat(frontend): wallet selection replaces payment method on expense and income UI"
```

---

### Task 13: Frontend — Debts page

**Files:**
- Create: `frontend/src/stores/debts.js`
- Create: `frontend/src/pages/DebtsPage.vue`
- Test: `frontend/src/stores/__tests__/debts.test.js`
- Modify: `frontend/src/router/index.js`, `frontend/src/layouts/AppLayout.vue`

**Interfaces:**
- Consumes: `/api/debts` endpoints (Task 5).
- Produces: `useDebtsStore` with `{ items, total, page, pageSize, totalPages, totals: { unpaid, paid }, loading }` and actions `fetch/create/update/remove/togglePaid/setPage`.

- [ ] **Step 1: Write the failing store test**

Create `frontend/src/stores/__tests__/debts.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api.js';
import { useDebtsStore } from '../debts.js';

const LIST = {
  items: [{ id: 'd1', person: 'Alice', amount: 750, paid: false }],
  total: 1, page: 1, pageSize: 10, totalPages: 1,
  totals: { unpaid: 750, paid: 0 },
};

describe('debts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetch loads items and totals', async () => {
    api.get.mockResolvedValue({ data: LIST });
    const store = useDebtsStore();
    await store.fetch();
    expect(store.items).toHaveLength(1);
    expect(store.totals.unpaid).toBe(750);
  });

  it('togglePaid PUTs the flipped value and refetches', async () => {
    api.get.mockResolvedValue({ data: LIST });
    api.put.mockResolvedValue({ data: { debt: { ...LIST.items[0], paid: true } } });
    const store = useDebtsStore();
    await store.fetch();
    await store.togglePaid(store.items[0]);
    expect(api.put).toHaveBeenCalledWith('/debts/d1', { paid: true });
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
```

Run: `cd frontend && npm test` — Expected: FAIL (missing store).

- [ ] **Step 2: Implement the store**

Create `frontend/src/stores/debts.js`:

```js
import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useDebtsStore = defineStore('debts', {
  state: () => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    totals: { unpaid: 0, paid: 0 },
    loading: false,
  }),

  actions: {
    async fetch() {
      this.loading = true;
      try {
        const { data } = await api.get('/debts', { params: { page: this.page, pageSize: this.pageSize } });
        this.items = data.items;
        this.total = data.total;
        this.totalPages = data.totalPages;
        this.totals = data.totals;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      await api.post('/debts', payload);
      await this.fetch();
    },

    async update(id, payload) {
      await api.put(`/debts/${id}`, payload);
      await this.fetch();
    },

    async remove(id) {
      await api.delete(`/debts/${id}`);
      await this.fetch();
    },

    async togglePaid(debt) {
      await api.put(`/debts/${debt.id}`, { paid: !debt.paid });
      await this.fetch();
    },

    setPage(page) {
      this.page = page;
      this.fetch();
    },
  },
});
```

Run: `cd frontend && npm test` — Expected: PASS.

- [ ] **Step 3: Create the page**

Create `frontend/src/pages/DebtsPage.vue` (same page skeleton as IncomePage — search box omitted, totals cards added):

```vue
<script setup>
import { onMounted, ref, reactive, computed, watch } from 'vue';
import { useDebtsStore } from '../stores/debts.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import { formatMoney, formatDate, toDateInput } from '../utils/format.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseModal from '../components/ui/BaseModal.vue';
import DataTable from '../components/ui/DataTable.vue';
import PaginationBar from '../components/ui/PaginationBar.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import Icon from '../components/ui/Icon.vue';

const store = useDebtsStore();
const ui = useUiStore();

const formOpen = ref(false);
const editing = ref(null);
const saving = ref(false);

const columns = [
  { key: 'paid', label: '' },
  { key: 'date', label: 'Date' },
  { key: 'person', label: 'Source / To who' },
  { key: 'amount', label: 'Amount', align: 'right', class: 'amount font-semibold' },
  { key: 'notes', label: 'Notes', class: 'max-w-[200px] truncate text-slate-500' },
  { key: 'actions', label: '', align: 'right' },
];

const form = reactive({ person: '', amount: '', date: toDateInput(), notes: '' });
const touched = reactive({});

const errors = computed(() => ({
  person: touched.person && !form.person.trim() ? 'Who is this debt with?' : '',
  amount: touched.amount && (!form.amount || Number(form.amount) <= 0) ? 'Enter an amount above zero' : '',
  date: touched.date && !form.date ? 'Pick a date' : '',
}));

watch(formOpen, (open) => {
  if (!open) return;
  Object.keys(touched).forEach((k) => delete touched[k]);
  if (editing.value) {
    Object.assign(form, {
      person: editing.value.person,
      amount: editing.value.amount,
      date: toDateInput(editing.value.date),
      notes: editing.value.notes ?? '',
    });
  } else {
    Object.assign(form, { person: '', amount: '', date: toDateInput(), notes: '' });
  }
});

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(debt) {
  editing.value = debt;
  formOpen.value = true;
}

async function save() {
  ['person', 'amount', 'date'].forEach((k) => (touched[k] = true));
  if (Object.values(errors.value).some(Boolean)) return;

  saving.value = true;
  const payload = {
    person: form.person.trim(),
    amount: Number(form.amount),
    date: form.date,
    notes: form.notes.trim() || null,
  };
  try {
    if (editing.value) {
      await store.update(editing.value.id, payload);
      ui.toast('Debt updated');
    } else {
      await store.create(payload);
      ui.toast('Debt added');
    }
    formOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save debt'), 'error');
  } finally {
    saving.value = false;
  }
}

async function togglePaid(debt) {
  try {
    await store.togglePaid(debt);
    ui.toast(debt.paid ? 'Marked as unpaid' : 'Marked as paid');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

async function confirmDelete(debt) {
  const confirmed = await ui.confirm({
    title: 'Delete this debt?',
    message: `"${debt.person}" (${formatMoney(debt.amount)}) will be removed permanently.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.remove(debt.id);
    ui.toast('Debt deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

onMounted(() => store.fetch());
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <BaseCard>
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Unpaid</p>
        <p class="amount mt-1 text-lg font-semibold text-rose-600 dark:text-rose-400">{{ formatMoney(store.totals.unpaid) }}</p>
      </BaseCard>
      <BaseCard>
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Paid</p>
        <p class="amount mt-1 text-lg font-semibold text-brand-600 dark:text-brand-400">{{ formatMoney(store.totals.paid) }}</p>
      </BaseCard>
    </div>

    <div class="flex justify-end">
      <BaseButton @click="openCreate">
        <Icon name="plus" :size="16" />
        Add debt
      </BaseButton>
    </div>

    <BaseCard :padded="false">
      <SkeletonLoader v-if="store.loading && !store.items.length" variant="table" :count="5" class="p-5" />

      <template v-else-if="store.items.length">
        <DataTable :columns="columns" :rows="store.items">
          <template #cell-paid="{ row }">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
              :checked="row.paid"
              :aria-label="row.paid ? 'Mark as unpaid' : 'Mark as paid'"
              @change="togglePaid(row)"
            />
          </template>
          <template #cell-date="{ value }">
            <span class="whitespace-nowrap text-slate-500 dark:text-slate-400">{{ formatDate(value) }}</span>
          </template>
          <template #cell-person="{ row }">
            <span class="font-semibold" :class="row.paid ? 'text-slate-400 line-through dark:text-slate-500' : ''">{{ row.person }}</span>
          </template>
          <template #cell-amount="{ value }">{{ formatMoney(value) }}</template>
          <template #cell-notes="{ value }">{{ value || '—' }}</template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-0.5">
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit debt" title="Edit" @click="openEdit(row)">
                <Icon name="edit" :size="15" />
              </button>
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete debt" title="Delete" @click="confirmDelete(row)">
                <Icon name="trash" :size="15" />
              </button>
            </div>
          </template>
        </DataTable>

        <div class="border-t border-slate-100 px-4 dark:border-slate-800">
          <PaginationBar
            :page="store.page"
            :total-pages="store.totalPages"
            :total="store.total"
            :page-size="store.pageSize"
            @update:page="store.setPage($event)"
          />
        </div>
      </template>

      <EmptyState
        v-else
        icon="scale"
        title="No debts tracked"
        message="Record money you owe (or lent out) and tick it off when it's settled."
      >
        <template #action>
          <BaseButton @click="openCreate">
            <Icon name="plus" :size="16" />
            Add debt
          </BaseButton>
        </template>
      </EmptyState>
    </BaseCard>

    <BaseModal :open="formOpen" :title="editing ? 'Edit debt' : 'Add debt'" @close="formOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseInput v-model="form.person" label="Source / To who" placeholder="Who is this with?" :error="errors.person" required @blur="touched.person = true" />
        <div class="grid grid-cols-2 gap-4">
          <BaseInput v-model="form.amount" label="Amount" type="number" step="0.01" min="0" placeholder="0.00" :error="errors.amount" required @blur="touched.amount = true" />
          <BaseInput v-model="form.date" label="Date" type="date" :error="errors.date" required @blur="touched.date = true" />
        </div>
        <BaseInput v-model="form.notes" label="Notes" placeholder="Optional details" />
        <button type="submit" class="hidden" aria-hidden="true" />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">Cancel</BaseButton>
        <BaseButton :loading="saving" @click="save">{{ editing ? 'Save changes' : 'Add debt' }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
```

- [ ] **Step 4: Route + nav**

Router children (after `wallets`): `{ path: 'debts', name: 'debts', component: () => import('../pages/DebtsPage.vue'), meta: { title: 'Debts' } },`
Nav array (after `wallets`): `{ name: 'debts', label: 'Debts', icon: 'scale', to: '/debts' },`

- [ ] **Step 5: Verify and commit**

Run: `cd frontend && npm test && npm run build` — Expected: PASS / build succeeds.

```bash
git add frontend/src
git commit -m "feat(frontend): debts page with paid toggle and totals"
```

---

### Task 14: Frontend — Savings page

**Files:**
- Create: `frontend/src/stores/savings.js`
- Create: `frontend/src/pages/SavingsPage.vue`
- Test: `frontend/src/stores/__tests__/savings.test.js`
- Modify: `frontend/src/router/index.js`, `frontend/src/layouts/AppLayout.vue`

**Interfaces:**
- Consumes: `/api/savings-goals` endpoints (Task 6).
- Produces: `useSavingsStore` with `{ goals, loading }` and actions `fetch/create/update/remove/addContribution/removeContribution`.

- [ ] **Step 1: Write the failing store test**

Create `frontend/src/stores/__tests__/savings.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api.js';
import { useSavingsStore } from '../savings.js';

const GOALS = [{ id: 'g1', name: 'Japan 2027', target: 150000, total: 5434.05, thisMonth: 5434.05, lastMonth: 0, contributions: [] }];

describe('savings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetch loads goals', async () => {
    api.get.mockResolvedValue({ data: { goals: GOALS } });
    const store = useSavingsStore();
    await store.fetch();
    expect(api.get).toHaveBeenCalledWith('/savings-goals');
    expect(store.goals).toHaveLength(1);
  });

  it('addContribution posts to the goal then refetches', async () => {
    api.post.mockResolvedValue({ data: { contribution: { id: 'c1' } } });
    api.get.mockResolvedValue({ data: { goals: GOALS } });
    const store = useSavingsStore();
    await store.addContribution('g1', { amount: 100, date: '2026-07-01' });
    expect(api.post).toHaveBeenCalledWith('/savings-goals/g1/contributions', { amount: 100, date: '2026-07-01' });
    expect(api.get).toHaveBeenCalled();
  });
});
```

Run: `cd frontend && npm test` — Expected: FAIL (missing store).

- [ ] **Step 2: Implement the store**

Create `frontend/src/stores/savings.js`:

```js
import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useSavingsStore = defineStore('savings', {
  state: () => ({
    goals: [],
    loading: false,
  }),

  actions: {
    async fetch() {
      this.loading = true;
      try {
        const { data } = await api.get('/savings-goals');
        this.goals = data.goals;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      await api.post('/savings-goals', payload);
      await this.fetch();
    },

    async update(id, payload) {
      await api.put(`/savings-goals/${id}`, payload);
      await this.fetch();
    },

    async remove(id) {
      await api.delete(`/savings-goals/${id}`);
      await this.fetch();
    },

    async addContribution(goalId, payload) {
      await api.post(`/savings-goals/${goalId}/contributions`, payload);
      await this.fetch();
    },

    async removeContribution(goalId, contributionId) {
      await api.delete(`/savings-goals/${goalId}/contributions/${contributionId}`);
      await this.fetch();
    },
  },
});
```

Run: `cd frontend && npm test` — Expected: PASS.

- [ ] **Step 3: Create the page**

Create `frontend/src/pages/SavingsPage.vue`:

```vue
<script setup>
import { onMounted, ref, reactive, computed, watch } from 'vue';
import { useSavingsStore } from '../stores/savings.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import { formatMoney, formatDate, toDateInput } from '../utils/format.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseModal from '../components/ui/BaseModal.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import Icon from '../components/ui/Icon.vue';

const store = useSavingsStore();
const ui = useUiStore();

const goalFormOpen = ref(false);
const editingGoal = ref(null);
const savingGoal = ref(false);
const goalTouched = reactive({});
const goalForm = reactive({ name: '', target: '' });

const contribFormOpen = ref(false);
const contribGoal = ref(null);
const savingContrib = ref(false);
const contribTouched = reactive({});
const contribForm = reactive({ amount: '', date: toDateInput(), notes: '' });

const expanded = ref(null);

const goalErrors = computed(() => ({
  name: goalTouched.name && !goalForm.name.trim() ? 'Give this goal a name' : '',
}));

const contribErrors = computed(() => ({
  amount: contribTouched.amount && (!contribForm.amount || Number(contribForm.amount) <= 0) ? 'Enter an amount above zero' : '',
  date: contribTouched.date && !contribForm.date ? 'Pick a date' : '',
}));

watch(goalFormOpen, (open) => {
  if (!open) return;
  goalTouched.name = false;
  if (editingGoal.value) {
    goalForm.name = editingGoal.value.name;
    goalForm.target = editingGoal.value.target ?? '';
  } else {
    goalForm.name = '';
    goalForm.target = '';
  }
});

watch(contribFormOpen, (open) => {
  if (!open) return;
  Object.keys(contribTouched).forEach((k) => delete contribTouched[k]);
  Object.assign(contribForm, { amount: '', date: toDateInput(), notes: '' });
});

function progressOf(goal) {
  if (!goal.target) return null;
  return Math.min(100, Math.round((goal.total / goal.target) * 100));
}

function openCreateGoal() {
  editingGoal.value = null;
  goalFormOpen.value = true;
}

function openEditGoal(goal) {
  editingGoal.value = goal;
  goalFormOpen.value = true;
}

function openContribute(goal) {
  contribGoal.value = goal;
  contribFormOpen.value = true;
}

async function saveGoal() {
  goalTouched.name = true;
  if (goalErrors.value.name) return;

  savingGoal.value = true;
  const payload = {
    name: goalForm.name.trim(),
    target: goalForm.target ? Number(goalForm.target) : null,
  };
  try {
    if (editingGoal.value) {
      await store.update(editingGoal.value.id, payload);
      ui.toast('Goal updated');
    } else {
      await store.create(payload);
      ui.toast('Goal added');
    }
    goalFormOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save goal'), 'error');
  } finally {
    savingGoal.value = false;
  }
}

async function saveContribution() {
  ['amount', 'date'].forEach((k) => (contribTouched[k] = true));
  if (Object.values(contribErrors.value).some(Boolean)) return;

  savingContrib.value = true;
  try {
    await store.addContribution(contribGoal.value.id, {
      amount: Number(contribForm.amount),
      date: contribForm.date,
      notes: contribForm.notes.trim() || null,
    });
    ui.toast('Contribution added');
    contribFormOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not add contribution'), 'error');
  } finally {
    savingContrib.value = false;
  }
}

async function confirmDeleteGoal(goal) {
  const confirmed = await ui.confirm({
    title: 'Delete this goal?',
    message: `"${goal.name}" and all its contributions will be removed permanently.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.remove(goal.id);
    ui.toast('Goal deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

async function confirmDeleteContribution(goal, contribution) {
  const confirmed = await ui.confirm({
    title: 'Remove this contribution?',
    message: `${formatMoney(contribution.amount)} on ${formatDate(contribution.date)} will be removed.`,
    confirmLabel: 'Remove',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.removeContribution(goal.id, contribution.id);
    ui.toast('Contribution removed');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

onMounted(() => store.fetch());
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Set money aside for named goals and watch them grow month by month.
      </p>
      <BaseButton @click="openCreateGoal">
        <Icon name="plus" :size="16" />
        Add goal
      </BaseButton>
    </div>

    <SkeletonLoader v-if="store.loading && !store.goals.length" variant="card" :count="2" />

    <div v-else-if="store.goals.length" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BaseCard v-for="goal in store.goals" :key="goal.id">
        <div class="flex items-start justify-between gap-2">
          <span class="text-sm font-bold">{{ goal.name }}</span>
          <div class="flex gap-0.5">
            <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit goal" title="Edit" @click="openEditGoal(goal)">
              <Icon name="edit" :size="15" />
            </button>
            <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete goal" title="Delete" @click="confirmDeleteGoal(goal)">
              <Icon name="trash" :size="15" />
            </button>
          </div>
        </div>

        <p class="amount mt-2 text-2xl font-extrabold tracking-tight">{{ formatMoney(goal.total) }}</p>
        <p v-if="goal.target" class="text-xs text-slate-500 dark:text-slate-400">of {{ formatMoney(goal.target) }} target</p>

        <div v-if="goal.target" class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div class="h-full rounded-full bg-brand-500 transition-all" :style="{ width: `${progressOf(goal)}%` }" />
        </div>

        <dl class="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <dt class="font-semibold uppercase tracking-wider">This month</dt>
            <dd class="amount mt-0.5">{{ formatMoney(goal.thisMonth) }}</dd>
          </div>
          <div>
            <dt class="font-semibold uppercase tracking-wider">Last month</dt>
            <dd class="amount mt-0.5">{{ formatMoney(goal.lastMonth) }}</dd>
          </div>
        </dl>

        <div class="mt-4 flex items-center gap-2">
          <BaseButton size="sm" @click="openContribute(goal)">
            <Icon name="plus" :size="14" />
            Contribute
          </BaseButton>
          <button
            class="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            @click="expanded = expanded === goal.id ? null : goal.id"
          >
            {{ expanded === goal.id ? 'Hide' : 'Show' }} contributions ({{ goal.contributions.length }})
          </button>
        </div>

        <ul v-if="expanded === goal.id && goal.contributions.length" class="mt-3 divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
          <li v-for="c in goal.contributions" :key="c.id" class="flex items-center gap-3 py-2 text-sm">
            <span class="flex-1 text-slate-500 dark:text-slate-400">{{ formatDate(c.date) }}</span>
            <span class="amount font-semibold">{{ formatMoney(c.amount) }}</span>
            <button class="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Remove contribution" title="Remove" @click="confirmDeleteContribution(goal, c)">
              <Icon name="trash" :size="14" />
            </button>
          </li>
        </ul>
      </BaseCard>
    </div>

    <BaseCard v-else>
      <EmptyState icon="coins" title="No savings goals yet" message="Create a goal like 'Emergency fund' or 'Japan 2027' and add contributions as you save.">
        <template #action>
          <BaseButton @click="openCreateGoal">
            <Icon name="plus" :size="16" />
            Add goal
          </BaseButton>
        </template>
      </EmptyState>
    </BaseCard>

    <BaseModal :open="goalFormOpen" :title="editingGoal ? 'Edit goal' : 'Add goal'" @close="goalFormOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="saveGoal">
        <BaseInput v-model="goalForm.name" label="Name" placeholder="e.g. Japan 2027" :error="goalErrors.name" required @blur="goalTouched.name = true" />
        <BaseInput v-model="goalForm.target" label="Target amount (optional)" type="number" step="0.01" min="0" placeholder="No target" />
        <button type="submit" class="hidden" aria-hidden="true" />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="goalFormOpen = false">Cancel</BaseButton>
        <BaseButton :loading="savingGoal" @click="saveGoal">{{ editingGoal ? 'Save changes' : 'Add goal' }}</BaseButton>
      </template>
    </BaseModal>

    <BaseModal :open="contribFormOpen" :title="`Contribute to ${contribGoal?.name ?? ''}`" @close="contribFormOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="saveContribution">
        <div class="grid grid-cols-2 gap-4">
          <BaseInput v-model="contribForm.amount" label="Amount" type="number" step="0.01" min="0" placeholder="0.00" :error="contribErrors.amount" required @blur="contribTouched.amount = true" />
          <BaseInput v-model="contribForm.date" label="Date" type="date" :error="contribErrors.date" required @blur="contribTouched.date = true" />
        </div>
        <BaseInput v-model="contribForm.notes" label="Notes" placeholder="Optional details" />
        <button type="submit" class="hidden" aria-hidden="true" />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="contribFormOpen = false">Cancel</BaseButton>
        <BaseButton :loading="savingContrib" @click="saveContribution">Add contribution</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
```

Note: if `BaseButton` has no `size` prop, drop the `size="sm"` attribute.

- [ ] **Step 4: Route + nav**

Router children (after `debts`): `{ path: 'savings', name: 'savings', component: () => import('../pages/SavingsPage.vue'), meta: { title: 'Savings' } },`
Nav array (after `debts`): `{ name: 'savings', label: 'Savings', icon: 'coins', to: '/savings' },`

- [ ] **Step 5: Verify and commit**

Run: `cd frontend && npm test && npm run build` — Expected: PASS / build succeeds.

```bash
git add frontend/src
git commit -m "feat(frontend): savings goals page with contributions"
```

---

### Task 15: Frontend — dashboard cash flow card + wallet snapshot

**Files:**
- Create: `frontend/src/components/CashFlowCard.vue`
- Create: `frontend/src/components/WalletBalancesCard.vue`
- Modify: `frontend/src/pages/DashboardPage.vue`

**Interfaces:**
- Consumes: dashboard response fields `cashFlow` and `wallets` (Task 7).

- [ ] **Step 1: Create CashFlowCard**

Create `frontend/src/components/CashFlowCard.vue`:

```vue
<script setup>
import { formatMoney } from '../utils/format.js';
import BaseCard from './ui/BaseCard.vue';

defineProps({
  // { thisMonth: { startBalance, income, expense, debt, savings, endBalance }, lastMonth: {...} }
  cashFlow: { type: Object, required: true },
});

const ROWS = [
  { key: 'startBalance', label: 'Start balance' },
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expense' },
  { key: 'debt', label: 'Debt (unpaid)' },
  { key: 'savings', label: 'Savings' },
  { key: 'endBalance', label: 'End balance' },
];
</script>

<template>
  <BaseCard title="Cash flow">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <th class="pb-2 text-left font-bold"></th>
          <th class="pb-2 text-right font-bold">Last month</th>
          <th class="pb-2 text-right font-bold">This month</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
        <tr v-for="row in ROWS" :key="row.key" :class="row.key === 'endBalance' ? 'font-bold' : ''">
          <td class="py-2 font-semibold text-slate-600 dark:text-slate-300">{{ row.label }}</td>
          <td class="amount py-2 text-right text-slate-500 dark:text-slate-400">{{ formatMoney(cashFlow.lastMonth[row.key]) }}</td>
          <td class="amount py-2 text-right">{{ formatMoney(cashFlow.thisMonth[row.key]) }}</td>
        </tr>
      </tbody>
    </table>
  </BaseCard>
</template>
```

- [ ] **Step 2: Create WalletBalancesCard**

Create `frontend/src/components/WalletBalancesCard.vue`:

```vue
<script setup>
import { formatMoney } from '../utils/format.js';
import BaseCard from './ui/BaseCard.vue';
import EmptyState from './ui/EmptyState.vue';

defineProps({
  // [{ id, name, color, balance }]
  wallets: { type: Array, required: true },
});
</script>

<template>
  <BaseCard title="Wallets">
    <ul v-if="wallets.length" class="divide-y divide-slate-100 dark:divide-slate-800">
      <li v-for="wallet in wallets" :key="wallet.id" class="flex items-center gap-3 py-2.5">
        <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: wallet.color ?? '#64748b' }" />
        <span class="flex-1 truncate text-sm font-semibold">{{ wallet.name }}</span>
        <span class="amount text-sm font-semibold" :class="wallet.balance < 0 ? 'text-rose-600 dark:text-rose-400' : ''">
          {{ formatMoney(wallet.balance) }}
        </span>
      </li>
    </ul>
    <EmptyState v-else title="No wallets yet" message="Add wallets to see balances here." />
  </BaseCard>
</template>
```

- [ ] **Step 3: Place both on the dashboard**

In `frontend/src/pages/DashboardPage.vue`:

Add imports:

```js
import CashFlowCard from '../components/CashFlowCard.vue';
import WalletBalancesCard from '../components/WalletBalancesCard.vue';
```

Insert between the "Secondary stats strip" `</div>` and the `<!-- Charts -->` comment:

```vue
    <!-- Cash flow + wallets -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SkeletonLoader v-if="dashboard.loading || !d" variant="card" />
      <CashFlowCard v-else :cash-flow="d.cashFlow" />
      <SkeletonLoader v-if="dashboard.loading || !d" variant="card" />
      <WalletBalancesCard v-else :wallets="d.wallets" />
    </div>
```

- [ ] **Step 4: Verify and commit**

Run: `cd frontend && npm test && npm run build` — Expected: PASS / build succeeds.

Manual smoke check (optional but recommended): `cd backend && npm run dev` plus `cd frontend && npm run dev`, log in as `demo@example.com` / `Password123!`, confirm the dashboard shows the cash-flow table and wallet balances, and the Wallets/Debts/Savings pages work end-to-end.

```bash
git add frontend/src
git commit -m "feat(frontend): dashboard cash flow card and wallet balances snapshot"
```

---

## Final verification

- [ ] `cd backend && npm test` — full suite green.
- [ ] `cd frontend && npm test && npm run build` — green + builds.
- [ ] `grep -rn "paymentMethod\|PAYMENT_METHODS" backend/src frontend/src` — only hits allowed: none. (`backend/prisma/migrations/` may still reference the dropped column — that's history, leave it.)
- [ ] Both Prisma schema files contain identical models.
- [ ] Manual walkthrough of the five features against the spec's gap-analysis list.
