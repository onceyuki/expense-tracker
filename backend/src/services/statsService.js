import { prisma } from '../utils/prisma.js';
import { listBudgets, monthRange } from './budgetService.js';

const round2 = (n) => Math.round(n * 100) / 100;

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function localDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function sum(rows) {
  return round2(rows.reduce((acc, r) => acc + r.amount, 0));
}

function groupSum(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const key = keyFn(r);
    map.set(key, (map.get(key) ?? 0) + r.amount);
  }
  return map;
}

export async function getDashboard(userId, month = monthKey(new Date())) {
  const now = new Date();
  const { start, end } = monthRange(month);
  const sixMonthsAgo = new Date(start.getFullYear(), start.getMonth() - 5, 1);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const [expenses, incomes, allExp, allInc, budgets, recentExpenses, recentIncomes] =
    await Promise.all([
      prisma.expense.findMany({ where: { userId, date: { gte: sixMonthsAgo, lt: end } } }),
      prisma.income.findMany({ where: { userId, date: { gte: sixMonthsAgo, lt: end } } }),
      prisma.expense.aggregate({ where: { userId }, _sum: { amount: true } }),
      prisma.income.aggregate({ where: { userId }, _sum: { amount: true } }),
      listBudgets(userId, month),
      prisma.expense.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.income.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

  const monthExpenses = expenses.filter((e) => e.date >= start && e.date < end);
  const monthIncomes = incomes.filter((i) => i.date >= start && i.date < end);

  const totalExpenses = sum(monthExpenses);
  const totalIncome = sum(monthIncomes);
  const overallBudget = budgets.find((b) => b.category === null);
  const monthlyBudget = overallBudget?.limit ?? 0;

  // Week/today are relative to the real current date, not the selected month
  const weekExpenses = (
    await prisma.expense.findMany({ where: { userId, date: { gte: weekStart } } })
  ).filter((e) => e.date <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
  const todayKey = localDayKey(now);
  const todaySpending = sum(weekExpenses.filter((e) => localDayKey(e.date) === todayKey));

  const byCategoryMap = groupSum(monthExpenses, (e) => e.category);
  const byCategory = [...byCategoryMap.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const amounts = monthExpenses.map((e) => e.amount);
  const isCurrentMonth = month === monthKey(now);
  const daysElapsed = isCurrentMonth
    ? now.getDate()
    : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();

  // Last 6 month series (oldest → newest)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    months.push(monthKey(new Date(start.getFullYear(), start.getMonth() - i, 1)));
  }
  const expByMonth = groupSum(expenses, (e) => monthKey(e.date));
  const incByMonth = groupSum(incomes, (i) => monthKey(i.date));

  // Last 7 day series (oldest → newest)
  const weekDays = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const spentByDay = groupSum(weekExpenses, (e) => localDayKey(e.date));
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    weekDays.push({
      day: dayNames[d.getDay()],
      date: localDayKey(d),
      amount: round2(spentByDay.get(localDayKey(d)) ?? 0),
    });
  }

  const recentActivity = [
    ...recentExpenses.map((e) => ({
      type: 'expense',
      id: e.id,
      title: e.title,
      category: e.category,
      amount: e.amount,
      date: e.date,
      createdAt: e.createdAt,
    })),
    ...recentIncomes.map((i) => ({
      type: 'income',
      id: i.id,
      title: i.source,
      category: null,
      amount: i.amount,
      date: i.date,
      createdAt: i.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  const alerts = budgets
    .filter((b) => b.percentUsed >= 50)
    .map((b) => ({
      budgetId: b.id,
      category: b.category,
      percentUsed: b.percentUsed,
      level: b.percentUsed >= 100 ? 100 : b.percentUsed >= 90 ? 90 : b.percentUsed >= 75 ? 75 : 50,
    }));

  return {
    month,
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      remainingBudget: round2(monthlyBudget - totalExpenses),
      savings: round2(totalIncome - totalExpenses),
      monthlyBudget,
      balance: round2((allInc._sum.amount ?? 0) - (allExp._sum.amount ?? 0)),
    },
    week: { spending: sum(weekExpenses) },
    today: { spending: todaySpending },
    stats: {
      topCategories: byCategory.slice(0, 5),
      highestExpense: amounts.length ? Math.max(...amounts) : null,
      lowestExpense: amounts.length ? Math.min(...amounts) : null,
      avgDailySpending: round2(totalExpenses / daysElapsed),
      savingsRate: totalIncome > 0 ? round2(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
    },
    charts: {
      byCategory,
      monthlyExpenses: months.map((m) => ({ month: m, amount: round2(expByMonth.get(m) ?? 0) })),
      incomeVsExpenses: months.map((m) => ({
        month: m,
        income: round2(incByMonth.get(m) ?? 0),
        expenses: round2(expByMonth.get(m) ?? 0),
      })),
      weeklySpending: weekDays,
    },
    recentActivity,
    alerts,
    budgets,
  };
}

function isoWeekKey(date) {
  // Thursday of the same ISO week determines the year/week number
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function getAnalytics(userId, { from, to, granularity = 'month' } = {}) {
  const now = new Date();
  const rangeStart = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const rangeEnd = to ? new Date(to) : now;
  rangeEnd.setHours(23, 59, 59, 999);

  const keyFn =
    granularity === 'year'
      ? (d) => String(d.getFullYear())
      : granularity === 'week'
        ? (d) => isoWeekKey(d)
        : (d) => monthKey(d);

  const [expenses, incomes, budgets] = await Promise.all([
    prisma.expense.findMany({ where: { userId, date: { gte: rangeStart, lte: rangeEnd } } }),
    prisma.income.findMany({ where: { userId, date: { gte: rangeStart, lte: rangeEnd } } }),
    prisma.budget.findMany({ where: { userId, category: null } }),
  ]);

  const expByPeriod = groupSum(expenses, (e) => keyFn(e.date));
  const incByPeriod = groupSum(incomes, (i) => keyFn(i.date));
  const periods = [...new Set([...expByPeriod.keys(), ...incByPeriod.keys()])].sort();

  const byCategoryMap = groupSum(expenses, (e) => e.category);
  const categoryBreakdown = [...byCategoryMap.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const expByMonth = groupSum(expenses, (e) => monthKey(e.date));
  const budgetUtilization = budgets
    .filter((b) => expByMonth.has(b.month) || (b.month >= monthKey(rangeStart) && b.month <= monthKey(rangeEnd)))
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((b) => ({ month: b.month, budget: b.limit, spent: round2(expByMonth.get(b.month) ?? 0) }));

  return {
    granularity,
    spendingSeries: periods.map((p) => ({ period: p, amount: round2(expByPeriod.get(p) ?? 0) })),
    incomeSeries: periods.map((p) => ({ period: p, amount: round2(incByPeriod.get(p) ?? 0) })),
    categoryBreakdown,
    cashFlow: periods.map((p) => {
      const income = round2(incByPeriod.get(p) ?? 0);
      const spent = round2(expByPeriod.get(p) ?? 0);
      return { period: p, income, expenses: spent, net: round2(income - spent) };
    }),
    budgetUtilization,
  };
}

export async function getMonthlyReport(userId, month) {
  const { start, end } = monthRange(month);
  const [expenses, incomes] = await Promise.all([
    prisma.expense.findMany({ where: { userId, date: { gte: start, lt: end } }, orderBy: { date: 'asc' } }),
    prisma.income.findMany({ where: { userId, date: { gte: start, lt: end } } }),
  ]);
  const totalExpenses = sum(expenses);
  const totalIncome = sum(incomes);
  const byCategory = [...groupSum(expenses, (e) => e.category).entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  return {
    month,
    income: totalIncome,
    expenses: totalExpenses,
    savings: round2(totalIncome - totalExpenses),
    savingsRate: totalIncome > 0 ? round2(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
    byCategory,
    transactions: expenses,
  };
}

export async function getYearlyReport(userId, year) {
  const start = new Date(Number(year), 0, 1);
  const end = new Date(Number(year) + 1, 0, 1);
  const [expenses, incomes] = await Promise.all([
    prisma.expense.findMany({ where: { userId, date: { gte: start, lt: end } } }),
    prisma.income.findMany({ where: { userId, date: { gte: start, lt: end } } }),
  ]);
  const expByMonth = groupSum(expenses, (e) => monthKey(e.date));
  const incByMonth = groupSum(incomes, (i) => monthKey(i.date));

  const months = [];
  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`;
    const income = round2(incByMonth.get(key) ?? 0);
    const spent = round2(expByMonth.get(key) ?? 0);
    months.push({ month: key, income, expenses: spent, net: round2(income - spent) });
  }
  const totalIncome = sum(incomes);
  const totalExpenses = sum(expenses);

  return {
    year: String(year),
    months,
    totals: { income: totalIncome, expenses: totalExpenses, net: round2(totalIncome - totalExpenses) },
  };
}

export async function getCategoryReport(userId, { from, to } = {}) {
  const where = { userId };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }
  const expenses = await prisma.expense.findMany({ where });
  const total = sum(expenses);
  const map = new Map();
  for (const e of expenses) {
    const entry = map.get(e.category) ?? { amount: 0, count: 0 };
    entry.amount += e.amount;
    entry.count += 1;
    map.set(e.category, entry);
  }
  const categories = [...map.entries()]
    .map(([category, { amount, count }]) => ({
      category,
      amount: round2(amount),
      count,
      percent: total > 0 ? round2((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { from: from ?? null, to: to ?? null, total, categories };
}
