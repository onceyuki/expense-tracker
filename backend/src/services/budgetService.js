import { prisma } from '../utils/prisma.js';
import { ApiError } from '../utils/ApiError.js';

export function monthRange(month) {
  const [year, m] = month.split('-').map(Number);
  return { start: new Date(year, m - 1, 1), end: new Date(year, m, 1) };
}

// Returns budgets for the month enriched with spent/remaining/percentUsed.
export async function listBudgets(userId, month) {
  const budgets = await prisma.budget.findMany({
    where: { userId, month },
    orderBy: { category: 'asc' },
  });
  const { start, end } = monthRange(month);

  const grouped = await prisma.expense.groupBy({
    by: ['category'],
    where: { userId, date: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  const spentByCategory = Object.fromEntries(grouped.map((g) => [g.category, g._sum.amount ?? 0]));
  const totalSpent = grouped.reduce((sum, g) => sum + (g._sum.amount ?? 0), 0);

  return budgets.map((b) => {
    const spent = round2(b.category === null ? totalSpent : (spentByCategory[b.category] ?? 0));
    return {
      ...b,
      spent,
      remaining: round2(b.limit - spent),
      percentUsed: b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0,
    };
  });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export async function createBudget(userId, { category, limit, month }) {
  const existing = await prisma.budget.findFirst({
    where: { userId, category: category ?? null, month },
  });
  if (existing) {
    throw new ApiError(409, 'A budget for this category and month already exists');
  }
  return prisma.budget.create({ data: { userId, category: category ?? null, limit, month } });
}

export async function updateBudget(userId, id, data) {
  const budget = await prisma.budget.findFirst({ where: { id, userId } });
  if (!budget) throw new ApiError(404, 'Budget not found');
  return prisma.budget.update({ where: { id }, data });
}

export async function deleteBudget(userId, id) {
  const budget = await prisma.budget.findFirst({ where: { id, userId } });
  if (!budget) throw new ApiError(404, 'Budget not found');
  await prisma.budget.delete({ where: { id } });
}
