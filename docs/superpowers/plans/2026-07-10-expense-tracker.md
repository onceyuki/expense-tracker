# Budget & Expense Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Budget & Expense Tracker web app from `project-spec.md` — full-stack, tested, documented, dockerized.

**Architecture:** Monorepo with `backend/` (Express + Prisma + SQLite-dev/Postgres-prod, JWT auth with refresh tokens) and `frontend/` (Vue 3 + Vite + Pinia + Vue Router + Tailwind v4 + Chart.js). REST API under `/api/*`; frontend dev server proxies to backend. Aggregations (dashboard/analytics/reports) computed server-side in service modules.

**Tech Stack:** Node 24, Express 4, Prisma 5, SQLite (dev) / PostgreSQL (docker), jsonwebtoken, bcryptjs, zod (validation), exceljs (Excel), pdfkit (PDF), swagger-ui-express; Vue 3 Composition API, Vite, Pinia, vue-router, Tailwind CSS, axios, chart.js + vue-chartjs; Vitest + supertest (backend tests), Vitest + @vue/test-utils (frontend tests).

## Global Constraints

- Composition API only in Vue components (`<script setup>`).
- All protected endpoints behind JWT middleware; passwords hashed with bcrypt.
- All incoming request bodies/queries validated (zod schemas) with centralized error handler.
- Environment variables via `.env` (backend: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `CLIENT_ORIGIN`; frontend: `VITE_API_URL`).
- Amounts stored as floats (Prisma `Float`); dates as ISO DateTime.
- Categories fixed list: Food, Transportation, Shopping, Utilities, Rent, Entertainment, Health, Education, Bills, Travel, Other.
- Payment methods fixed list: Cash, Credit Card, Debit Card, Bank Transfer, Mobile Payment, Other.
- Optional spec items deliberately skipped (YAGNI): receipt upload, expense archive, upcoming bills. Duplicate expense IS implemented.
- Commit after every task.

## Scope decisions (recorded)

- **DB:** SQLite for dev (spec allows); docker-compose ships Postgres. Prisma schema uses provider from env-compatible datasource.
- **Refresh token:** httpOnly cookie `refreshToken`, rotating; access token in memory/localStorage (localStorage when "Remember me").
- **Forgot password:** UI link + endpoint stub that always returns success message (no SMTP in scope) — documented in README.
- **Notifications:** budget-threshold alerts (50/75/90/100%) computed server-side, returned by `GET /api/dashboard`, shown as toasts + notification bell.
- **Exports:** Expenses CSV + Excel; Reports CSV/Excel/PDF.

---

### Task 1: Repo scaffold + backend foundation (app, config, errors, Prisma schema, seed)

**Files:**
- Create: `.gitignore`, `backend/package.json`, `backend/.env`, `backend/.env.example`
- Create: `backend/prisma/schema.prisma`, `backend/prisma/seed.js`
- Create: `backend/src/app.js`, `backend/src/server.js`, `backend/src/config/index.js`
- Create: `backend/src/middleware/errorHandler.js`, `backend/src/middleware/validate.js`, `backend/src/utils/ApiError.js`, `backend/src/utils/prisma.js`
- Test: `backend/tests/app.test.js`

**Interfaces:**
- Produces: `app` (Express instance, exported without listening — supertest-able), `prisma` singleton, `ApiError(status, message)`, `validate({ body?, query?, params? })` middleware, error handler returning `{ error: { message, details? } }`.

**Prisma schema (exact):**

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"  url = env("DATABASE_URL") }

model User {
  id        String    @id @default(cuid())
  name      String
  email     String    @unique
  password  String
  avatar    String?
  createdAt DateTime  @default(now())
  expenses  Expense[]
  incomes   Income[]
  budgets   Budget[]
}

model Expense {
  id            String   @id @default(cuid())
  userId        String
  title         String
  amount        Float
  category      String
  paymentMethod String
  notes         String?
  date          DateTime
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, date])
}

model Income {
  id        String   @id @default(cuid())
  userId    String
  source    String
  amount    Float
  date      DateTime
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, date])
}

model Budget {
  id       String  @id @default(cuid())
  userId   String
  category String?          // null = overall monthly budget
  limit    Float
  month    String           // "YYYY-MM"
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, category, month])
  @@index([userId, month])
}
```

**Steps:**
- [ ] Scaffold backend package.json (`type: module`, scripts: dev/start/test/prisma), install deps: express cors cookie-parser jsonwebtoken bcryptjs zod exceljs pdfkit swagger-ui-express dotenv; dev: prisma vitest supertest nodemon. `@prisma/client` runtime.
- [ ] Write schema.prisma above; `npx prisma migrate dev --name init`.
- [ ] Write app.js (json, cors credentials, cookie-parser, `/api/health` → `{status:"ok"}`, mount routers later, 404 + error handler).
- [ ] Write failing test `GET /api/health` returns 200 `{status:"ok"}`; run (fail), implement, run (pass).
- [ ] Seed: demo user `demo@example.com` / `Password123!`, ~120 expenses over last 6 months across categories, ~12 incomes, budgets for current month (overall + 4 categories).
- [ ] Commit.

### Task 2: Auth (register, login, refresh, me, logout, profile update)

**Files:**
- Create: `backend/src/services/authService.js`, `backend/src/controllers/authController.js`, `backend/src/routes/authRoutes.js`, `backend/src/middleware/auth.js`
- Test: `backend/tests/auth.test.js`

**Interfaces:**
- Produces: `requireAuth` middleware setting `req.user = { id, email }`; endpoints `POST /api/auth/register {name,email,password}`, `POST /api/auth/login {email,password,remember?}`, `POST /api/auth/refresh` (cookie), `GET /api/auth/me`, `POST /api/auth/logout`, `PUT /api/auth/profile {name?,email?,avatar?,currentPassword?,newPassword?}`, `POST /api/auth/forgot-password {email}` (stub).
- Access token: 15m JWT `{ sub, email }` signed `JWT_SECRET`. Refresh: 7d JWT signed `JWT_REFRESH_SECRET`, httpOnly cookie path `/api/auth`.
- Responses: `{ user: {id,name,email,avatar,createdAt}, accessToken }`.

**Steps:**
- [ ] Failing tests: register creates user + returns token; duplicate email 409; login wrong password 401; `GET /me` with token 200 / without 401; refresh rotates; profile update changes name & password (old password required).
- [ ] Implement service (bcrypt 10 rounds), controller, routes, requireAuth. Run tests → pass. Commit.

### Task 3: Expenses CRUD + query engine + duplicate + CSV/Excel export

**Files:**
- Create: `backend/src/services/expenseService.js`, `backend/src/controllers/expenseController.js`, `backend/src/routes/expenseRoutes.js`, `backend/src/utils/exporters.js`
- Test: `backend/tests/expenses.test.js`

**Interfaces:**
- `GET /api/expenses?search=&category=&paymentMethod=&dateFrom=&dateTo=&minAmount=&maxAmount=&sortBy=date|amount|title|category&sortDir=asc|desc&page=1&pageSize=10` → `{ items, total, page, pageSize, totalPages }`
- `GET/POST/PUT/DELETE /api/expenses/:id` standard; `POST /api/expenses/:id/duplicate` clones with today's date.
- `GET /api/expenses/export?format=csv|xlsx&<same filters>` streams file.
- Produces for later tasks: `exporters.toCSV(rows, columns)`, `exporters.toExcel(rows, columns, sheetName)` returning Buffer.

**Steps:**
- [ ] Failing tests: create/validate (400 on negative amount, bad category), list pagination + search (title/notes), filters (category, date range, amount range), sort, update ownership (user B gets 404 on user A's expense), delete, duplicate.
- [ ] Implement; run → pass. Commit.

### Task 4: Income + Budgets CRUD (with budget progress)

**Files:**
- Create: `backend/src/services/incomeService.js`, `backend/src/controllers/incomeController.js`, `backend/src/routes/incomeRoutes.js`
- Create: `backend/src/services/budgetService.js`, `backend/src/controllers/budgetController.js`, `backend/src/routes/budgetRoutes.js`
- Test: `backend/tests/income.test.js`, `backend/tests/budgets.test.js`

**Interfaces:**
- Income: `GET /api/income` (same pagination/filter pattern minus category/paymentMethod, filter by source search + date range), POST/PUT/DELETE.
- Budgets: `GET /api/budgets?month=YYYY-MM` → `[{ id, category, limit, month, spent, remaining, percentUsed }]` (spent computed from expenses in that month; overall budget row has `category: null`). POST (409 on duplicate user+category+month), PUT, DELETE.

**Steps:**
- [ ] Failing tests both resources incl. `spent`/`percentUsed` math and duplicate-budget 409. Implement → pass. Commit.

### Task 5: Dashboard + Analytics + Reports endpoints

**Files:**
- Create: `backend/src/services/statsService.js`, `backend/src/controllers/dashboardController.js`, `backend/src/routes/dashboardRoutes.js`
- Create: `backend/src/controllers/reportController.js`, `backend/src/routes/reportRoutes.js`, `backend/src/utils/pdf.js`
- Test: `backend/tests/dashboard.test.js`, `backend/tests/reports.test.js`

**Interfaces:**
- `GET /api/dashboard?month=YYYY-MM` → `{ totals: { income, expenses, remainingBudget, savings, monthlyBudget, balance }, week: { spending }, today: { spending }, stats: { topCategories: [{category, amount}], highestExpense, lowestExpense, avgDailySpending, savingsRate }, charts: { byCategory: [{category, amount}], monthlyExpenses: [{month, amount}] (last 6), incomeVsExpenses: [{month, income, expenses}] (last 6), weeklySpending: [{day, amount}] (last 7 days) }, recentActivity: [{type: "expense"|"income", id, title, amount, date}] (10), alerts: [{budgetId, category, percentUsed, level: 50|75|90|100}] }`
- `GET /api/analytics?from=&to=&granularity=week|month|year` → `{ spendingSeries, incomeSeries, categoryBreakdown, cashFlow: [{period, income, expenses, net}], budgetUtilization: [{month, budget, spent}] }`
- Reports: `GET /api/reports/monthly?month=`, `GET /api/reports/yearly?year=`, `GET /api/reports/categories?from=&to=` each with `&format=json|csv|xlsx|pdf`.

**Steps:**
- [ ] Failing tests with seeded fixture data asserting aggregation math (totals, savings rate = (income-expenses)/income, alert levels). Implement statsService with Prisma aggregate/groupBy → pass.
- [ ] Reports: JSON path tested; csv/xlsx/pdf smoke-tested (content-type + non-empty body). Commit.

### Task 6: Swagger docs + Docker

**Files:**
- Create: `backend/src/config/openapi.js` (OpenAPI 3 spec object covering all endpoints), mount at `/api/docs`
- Create: `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` (postgres + backend + frontend/nginx), `frontend/nginx.conf`

**Steps:**
- [ ] OpenAPI spec + swagger-ui at `/api/docs`; test 200. Dockerfiles + compose (backend runs `prisma migrate deploy` on start; compose sets `DATABASE_URL` to postgres — note in README that schema provider flips to postgresql via the committed `prisma/schema.postgres.prisma` or env swap). Commit.

### Task 7: Frontend scaffold (Vite, Tailwind, router, Pinia, axios, layouts, dark mode)

**Files:**
- Create: `frontend/` via Vite vue template; `frontend/src/services/api.js` (axios instance, auth header, 401→refresh→retry interceptor)
- Create: `frontend/src/stores/auth.js`, `frontend/src/stores/ui.js` (dark mode, toasts)
- Create: `frontend/src/router/index.js` (routes + guards), `frontend/src/layouts/AppLayout.vue` (sidebar + topbar, mobile drawer), `frontend/src/layouts/AuthLayout.vue`
- Create: `frontend/src/assets/main.css` (Tailwind, design tokens)

**Interfaces:**
- `useAuthStore()`: `user, accessToken, login(), register(), logout(), fetchMe(), updateProfile()`; router guard redirects unauth → /login.
- `useUiStore()`: `dark, toggleDark(), toasts, toast(message, type)`, `confirm(opts)` promise-based.
- Routes: `/login /register /` (dashboard) `/expenses /income /budgets /analytics /profile` + 404 catch-all + `/500`.

**Steps:**
- [ ] Scaffold, Tailwind config with `dark` class strategy, base components dir. Vite proxy `/api` → `localhost:4000`. Layout with sidebar nav (Dashboard, Expenses, Income, Budgets, Analytics), topbar (search omitted here; theme toggle, notification bell, avatar menu). Commit.

### Task 8: Shared UI components

**Files:**
- Create in `frontend/src/components/ui/`: `BaseCard.vue`, `BaseButton.vue`, `BaseInput.vue`, `BaseSelect.vue`, `BaseModal.vue`, `ConfirmDialog.vue`, `ToastHost.vue`, `SkeletonLoader.vue`, `EmptyState.vue`, `DataTable.vue` (slots, sortable headers, sticky header, responsive), `PaginationBar.vue`, `ProgressBar.vue`, `StatCard.vue`
- Test: `frontend/src/components/ui/__tests__/` for `DataTable`, `PaginationBar`, `ConfirmDialog`

**Steps:**
- [ ] Build components (rounded-2xl cards, soft shadows, transitions). Vitest + @vue/test-utils tests: DataTable renders rows/emits sort, PaginationBar emits page change, ConfirmDialog confirm/cancel. Commit.

### Task 9: Auth pages

**Files:**
- Create: `frontend/src/pages/LoginPage.vue`, `frontend/src/pages/RegisterPage.vue`
- Test: store test `frontend/src/stores/__tests__/auth.test.js`

**Steps:**
- [ ] Login (email, password, remember me, forgot password link → inline stub flow), Register (name, email, password, confirm with instant validation). Wire to auth store; error toasts. Commit.

### Task 10: Dashboard page

**Files:**
- Create: `frontend/src/pages/DashboardPage.vue`, `frontend/src/stores/dashboard.js`, `frontend/src/components/charts/{PieChart,LineChart,BarChart}.vue`, `frontend/src/components/QuickAddExpense.vue`
- Modify: `frontend/src/components/ui/StatCard.vue` if needed

**Steps:**
- [ ] Stat cards (6), 4 charts (category pie, monthly line, income-vs-expense bar, weekly bar), recent activity list, quick-add expense modal, budget alert toasts on load, skeletons while loading, empty states. Commit.

### Task 11: Expenses page (+ add/edit modal, filters, export)

**Files:**
- Create: `frontend/src/pages/ExpensesPage.vue`, `frontend/src/stores/expenses.js`, `frontend/src/components/ExpenseFormModal.vue`, `frontend/src/components/ExpenseFilters.vue`, `frontend/src/composables/useDebounce.js`

**Steps:**
- [ ] Table (date, title, category chip, amount, payment method, notes, actions view/edit/delete/duplicate), debounced search, filter panel (category, payment, date range, amount range), sort, pagination, CSV/Excel export (download via axios blob), floating Add button, delete confirm, optimistic updates, draft auto-save (localStorage) in form modal, keyboard shortcut `n` = new expense, `/` = focus search. Commit.

### Task 12: Income, Budgets, Analytics, Profile pages

**Files:**
- Create: `frontend/src/pages/IncomePage.vue`, `frontend/src/stores/income.js`
- Create: `frontend/src/pages/BudgetsPage.vue`, `frontend/src/stores/budgets.js`
- Create: `frontend/src/pages/AnalyticsPage.vue`, `frontend/src/stores/analytics.js`
- Create: `frontend/src/pages/ProfilePage.vue`
- Create: `frontend/src/pages/NotFoundPage.vue`, `frontend/src/pages/ServerErrorPage.vue`

**Steps:**
- [ ] Income CRUD page (table + modal). Budgets page: month picker, overall + per-category budgets with progress bars (color shifts at 75/90/100%). Analytics: period filter (week/month/year/custom range) + charts (spending trend, income growth, category breakdown, cash flow, budget utilization). Profile: name/email/avatar (URL or initials), password change. Error pages. Commit.

### Task 13: Polish + README + full verification

**Files:**
- Create: `README.md`
- Modify: any rough edges found

**Steps:**
- [ ] Page transitions, responsive audit (sidebar → drawer on mobile), run full backend + frontend test suites, `npm run build` both, launch both servers and drive the app end-to-end with browser (login with seed user, add/edit/delete expense, set budget, check dashboard numbers, export CSV).
- [ ] README: overview, features, tech stack, setup, env vars, scripts, project structure, API docs pointer, docker usage, deployment notes, test instructions. Final commit.

## Self-Review Notes

- Spec coverage: all pages, endpoints, exports, notifications, auth, seed, docker, swagger, tests, README covered in Tasks 1–13. Skipped optional items recorded in Global Constraints.
- Type consistency: pagination envelope `{ items, total, page, pageSize, totalPages }` used by expenses + income; budget row shape shared between Task 4 API and Task 12 UI; dashboard payload defined once in Task 5 and consumed in Task 10.
