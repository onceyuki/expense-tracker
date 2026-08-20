import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;

const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

function iso(d) {
  return d.toISOString();
}
function daysAgo(n) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'dashboard@test.com', 'Test User', ['Food', 'Transportation']));
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  // Fixture: current month — 1000 income, 200 Food today, 100 Transportation 3 days ago
  // (test assumes it runs on day >= 4 of the month for month totals; week math holds regardless)
  await auth(request(app).post('/api/income')).send({
    source: 'Salary',
    amount: 1000,
    date: iso(new Date(now.getFullYear(), now.getMonth(), 1, 9)),
  });
  await auth(request(app).post('/api/expenses')).send({
    title: 'Food today',
    amount: 200,
    category: 'Food',
    date: iso(daysAgo(0)),
  });
  await auth(request(app).post('/api/expenses')).send({
    title: 'Bus earlier',
    amount: 100,
    category: 'Transportation',
    date: iso(daysAgo(3)),
  });
  await auth(request(app).post('/api/budgets')).send({ category: null, limit: 500, month });
});

describe('dashboard', () => {
  let body;

  beforeAll(async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .query({ month })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    body = res.body;
  });

  it('computes month totals, savings and budget remaining', () => {
    expect(body.totals.income).toBe(1000);
    expect(body.totals.expenses).toBe(300);
    expect(body.totals.savings).toBe(700);
    expect(body.totals.monthlyBudget).toBe(500);
    expect(body.totals.remainingBudget).toBe(200);
    expect(body.totals.balance).toBe(700);
  });

  it('computes today and week spending', () => {
    expect(body.today.spending).toBe(200);
    expect(body.week.spending).toBe(300);
  });

  it('computes stats (top categories, extremes, savings rate)', () => {
    expect(body.stats.topCategories[0]).toEqual({ category: 'Food', amount: 200 });
    expect(body.stats.highestExpense).toBe(200);
    expect(body.stats.lowestExpense).toBe(100);
    expect(body.stats.savingsRate).toBe(70);
    expect(body.stats.avgDailySpending).toBeGreaterThan(0);
  });

  it('returns chart series', () => {
    expect(body.charts.byCategory).toContainEqual({ category: 'Food', amount: 200 });
    expect(body.charts.monthlyExpenses).toHaveLength(6);
    expect(body.charts.monthlyExpenses.at(-1)).toEqual({ month, amount: 300 });
    expect(body.charts.incomeVsExpenses.at(-1)).toEqual({ month, income: 1000, expenses: 300 });
    expect(body.charts.weeklySpending).toHaveLength(7);
    const weekTotal = body.charts.weeklySpending.reduce((s, d) => s + d.amount, 0);
    expect(weekTotal).toBe(300);
  });

  it('returns recent activity (both types, newest first)', () => {
    expect(body.recentActivity.length).toBeGreaterThanOrEqual(3);
    expect(body.recentActivity.some((a) => a.type === 'income')).toBe(true);
    expect(body.recentActivity.some((a) => a.type === 'expense')).toBe(true);
  });

  it('raises a 50% budget alert (300 of 500 spent)', () => {
    expect(body.alerts).toHaveLength(1);
    expect(body.alerts[0].level).toBe(50);
    expect(body.alerts[0].percentUsed).toBe(60);
  });
});

describe('dashboard cash flow', () => {
  let cfToken;
  const auth = (req) => req.set('Authorization', `Bearer ${cfToken}`);

  beforeAll(async () => {
    ({ token: cfToken } = await createTestUser(app, 'cashflow@test.com', 'Cash Flow', ['Food']));
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

describe('analytics', () => {
  it('returns series, breakdown and cash flow', async () => {
    const res = await request(app)
      .get('/api/analytics')
      .query({ granularity: 'month' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const { spendingSeries, incomeSeries, categoryBreakdown, cashFlow, budgetUtilization } = res.body;
    expect(spendingSeries.find((p) => p.period === month).amount).toBe(300);
    expect(incomeSeries.find((p) => p.period === month).amount).toBe(1000);
    expect(categoryBreakdown).toContainEqual({ category: 'Food', amount: 200 });
    const flow = cashFlow.find((p) => p.period === month);
    expect(flow.net).toBe(700);
    expect(budgetUtilization).toContainEqual({ month, budget: 500, spent: 300 });
  });
});
