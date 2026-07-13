# Ledgerly — Budget & Expense Tracker

A full-stack personal finance application: track expenses and income, set monthly and per-category budgets, and explore spending through an interactive dashboard and analytics — with a clean, minimal UI in light and dark mode.

Built from [project-spec.md](project-spec.md).

## Features

- **Auth** — register, login (remember me), JWT access tokens + rotating httpOnly refresh cookie, protected routes, profile & password update, forgot-password stub
- **Expenses** — full CRUD plus duplicate; search (title/notes), filters (category, wallet, date range, amount range), sorting, pagination; CSV and Excel export honoring active filters; draft auto-save; keyboard shortcuts (`n` new expense, `/` focus search)
- **Income** — full CRUD with search and pagination; optional wallet link
- **Budgets** — overall monthly budget and per-category budgets with computed spend, remaining, and % used; color-shifting progress bars; month navigation
- **Wallets** — named accounts (Cash, GCash, …) with an initial balance and a running balance computed from linked income, expenses and transfers; deletion blocked while referenced
- **Transfers** — move money between wallets; balances update on both sides
- **Debts** — who/amount/date with a paid/unpaid toggle and unpaid/paid totals
- **Savings goals** — named goals (e.g. "Japan 2027") with dated contributions, this-month/last-month/total rollups, and an optional target with progress
- **Dashboard** — income/expenses/savings/budget/balance stat cards, month-carryover cash flow (start/end balance, debt, savings vs last month), wallet balances snapshot, today & weekly spending, top categories, highest/lowest expense, average daily spend, savings rate; category doughnut, monthly expenses line, income-vs-expenses bar, weekly spending bar; recent activity; budget alerts at 50/75/90/100% surfaced as toasts
- **Analytics** — weekly/monthly/yearly/custom-range views: spending trend, income growth, cash flow, category breakdown, budget utilization
- **Reports** — monthly, yearly, and category reports as JSON, CSV, Excel, or PDF (`/api/reports/*`)
- **UI** — responsive (sidebar → drawer on mobile), dark mode, skeleton loaders, toasts, confirmation dialogs, empty states, error pages, smooth transitions
- **API docs** — Swagger UI at `/api/docs`

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 (Composition API), Vite, Pinia, Vue Router, Tailwind CSS v4, Chart.js (vue-chartjs), Axios |
| Backend | Node.js, Express, Prisma ORM, Zod validation, JWT (jsonwebtoken), bcryptjs, ExcelJS, PDFKit, swagger-ui-express |
| Database | PostgreSQL (Supabase in development; tests use an isolated `tests` schema) |
| Testing | Vitest + Supertest (API), Vitest + Vue Test Utils (components/stores) |

## Getting started

Requires Node.js 20+.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env          # adjust secrets if you like
npx prisma migrate dev        # creates SQLite db + runs the seed
npm run dev                   # API on http://localhost:4000
```

If the seed didn't run automatically: `npm run seed`.

**Demo account:** `demo@example.com` / `Password123!` (6 months of expenses, income, and budgets).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # app on http://localhost:5173 (proxies /api to :4000)
```

### Environment variables

`backend/.env` (see `.env.example`):

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Prisma connection string (Postgres; add `?connection_limit=8` when using Supabase's session pooler, which caps at 15 clients) | — |
| `JWT_SECRET` | Signs 15-minute access tokens | — |
| `JWT_REFRESH_SECRET` | Signs 7-day refresh tokens | — |
| `PORT` | API port | `4000` |
| `CLIENT_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |

The frontend needs no env vars in development (Vite proxy). For a custom API host set `VITE_API_URL` and adjust `src/services/api.js` baseURL if you deploy the API separately.

## Tests

```bash
cd backend && npm test      # 100 API tests (isolated `tests` schema on the Postgres DATABASE_URL)
cd frontend && npm test     # component + store tests
```

## Docker

```bash
docker compose up --build
```

- Frontend (nginx): http://localhost:8080
- Backend API: http://localhost:4000
- PostgreSQL 16 with a persistent volume

The backend image swaps in `prisma/schema.postgres.prisma` (PostgreSQL provider — Prisma providers can't come from env vars), pushes the schema on boot, and seeds the demo user. Set real values for `JWT_SECRET` / `JWT_REFRESH_SECRET` in `docker-compose.yml` before deploying anywhere public.

## Project structure

```
backend/
  prisma/            schema.prisma (SQLite), schema.postgres.prisma, seed.js, migrations/
  src/
    config/          env config, OpenAPI spec
    controllers/     request handlers (auth, expenses, income, budgets, dashboard, reports)
    middleware/      requireAuth (JWT), zod validation, error handler
    routes/          route definitions + request schemas
    services/        business logic & aggregations (statsService = dashboard/analytics/reports)
    utils/           prisma client, ApiError, CSV/Excel/PDF exporters, constants
  tests/             vitest + supertest suites
frontend/
  src/
    assets/          Tailwind theme, design tokens, transitions
    components/      ui/ (buttons, modals, table, toasts…), charts/, expense form & filters
    composables/     useDebounce
    layouts/         AppLayout (sidebar + topbar), AuthLayout
    pages/           Dashboard, Expenses, Income, Budgets, Wallets, Debts, Savings, Analytics, Profile, auth, 404/500
    router/          routes + auth guards
    services/        axios instance with token refresh
    stores/          Pinia stores (auth, ui, expenses, income, budgets, wallets, debts, savings, dashboard, analytics)
    utils/           formatters, category metadata
docker-compose.yml   postgres + backend + frontend (nginx)
```

## API overview

Full interactive docs at `http://localhost:4000/api/docs`. Highlights:

- `POST /api/auth/register | login | refresh | logout | forgot-password`, `GET /api/auth/me`, `PUT /api/auth/profile`
- `GET/POST /api/expenses`, `GET/PUT/DELETE /api/expenses/:id`, `POST /api/expenses/:id/duplicate`, `GET /api/expenses/export?format=csv|xlsx`
- `GET/POST /api/income`, `PUT/DELETE /api/income/:id`
- `GET /api/wallets` (computed balances), `POST /api/wallets`, `PUT/DELETE /api/wallets/:id`
- `GET/POST /api/transfers`, `PUT/DELETE /api/transfers/:id`
- `GET/POST /api/debts`, `PUT/DELETE /api/debts/:id` (PUT toggles paid)
- `GET/POST /api/savings-goals`, `PUT/DELETE /api/savings-goals/:id`, `POST /api/savings-goals/:id/contributions`, `DELETE /api/savings-goals/:id/contributions/:cid`
- `GET /api/budgets?month=YYYY-MM` (with computed progress), `POST /api/budgets`, `PUT/DELETE /api/budgets/:id`
- `GET /api/dashboard?month=YYYY-MM`, `GET /api/analytics?granularity=week|month|year`
- `GET /api/reports/monthly | yearly | categories` with `format=json|csv|xlsx|pdf`

All list endpoints return `{ items, total, page, pageSize, totalPages }`.

## Deployment notes

- Run the API behind HTTPS so the refresh cookie is sent with `secure` (enabled when `NODE_ENV=production`).
- Generate strong values for both JWT secrets.
- With PostgreSQL, prefer `prisma migrate deploy` with committed Postgres migrations for production-grade migration history (the compose setup uses `db push` for simplicity).
- The nginx config proxies `/api/` to the backend container and serves the SPA with history-mode fallback.

## Scope notes

Deliberately out of scope (marked optional in the spec): receipt upload, expense archiving, upcoming bills. Forgot-password returns a success message without sending email (no SMTP configured); wire a mailer in `authController.forgotPassword` to complete it.
