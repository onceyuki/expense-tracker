import { prisma } from '../utils/prisma.js';
import { ApiError } from '../utils/ApiError.js';

// Shared by list and export so exported files honor the active filters.
export function buildWhere(userId, query) {
  const where = { userId };

  if (query.search) {
    where.OR = [
      { title: { contains: query.search } },
      { notes: { contains: query.search } },
    ];
  }
  if (query.category) where.category = query.category;
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
  if (query.dateFrom || query.dateTo) {
    where.date = {};
    if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      to.setHours(23, 59, 59, 999);
      where.date.lte = to;
    }
  }
  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    where.amount = {};
    if (query.minAmount !== undefined) where.amount.gte = query.minAmount;
    if (query.maxAmount !== undefined) where.amount.lte = query.maxAmount;
  }
  return where;
}

export async function listExpenses(userId, query) {
  const where = buildWhere(userId, query);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const sortBy = query.sortBy ?? 'date';
  const sortDir = query.sortDir ?? 'desc';

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.expense.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listAllForExport(userId, query) {
  return prisma.expense.findMany({
    where: buildWhere(userId, query),
    orderBy: { date: 'desc' },
  });
}

export async function getExpense(userId, id) {
  const expense = await prisma.expense.findFirst({ where: { id, userId } });
  if (!expense) throw new ApiError(404, 'Expense not found');
  return expense;
}

export async function createExpense(userId, data) {
  return prisma.expense.create({
    data: { ...data, userId, date: new Date(data.date) },
  });
}

export async function updateExpense(userId, id, data) {
  await getExpense(userId, id);
  return prisma.expense.update({
    where: { id },
    data: { ...data, date: data.date ? new Date(data.date) : undefined },
  });
}

export async function deleteExpense(userId, id) {
  await getExpense(userId, id);
  await prisma.expense.delete({ where: { id } });
}

export async function duplicateExpense(userId, id) {
  const source = await getExpense(userId, id);
  return prisma.expense.create({
    data: {
      userId,
      title: source.title,
      amount: source.amount,
      category: source.category,
      paymentMethod: source.paymentMethod,
      notes: source.notes,
      date: new Date(),
    },
  });
}
