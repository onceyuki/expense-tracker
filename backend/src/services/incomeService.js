import { prisma } from '../utils/prisma.js';
import { ApiError } from '../utils/ApiError.js';

function buildWhere(userId, query) {
  const where = { userId };
  if (query.search) {
    where.OR = [
      { source: { contains: query.search, mode: 'insensitive' } },
      { notes: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.dateFrom || query.dateTo) {
    where.date = {};
    if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      to.setHours(23, 59, 59, 999);
      where.date.lte = to;
    }
  }
  return where;
}

export async function listIncome(userId, query) {
  const where = buildWhere(userId, query);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;

  const [items, total] = await Promise.all([
    prisma.income.findMany({
      where,
      orderBy: { [query.sortBy ?? 'date']: query.sortDir ?? 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.income.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getIncome(userId, id) {
  const income = await prisma.income.findFirst({ where: { id, userId } });
  if (!income) throw new ApiError(404, 'Income record not found');
  return income;
}

export async function createIncome(userId, data) {
  return prisma.income.create({ data: { ...data, userId, date: new Date(data.date) } });
}

export async function updateIncome(userId, id, data) {
  await getIncome(userId, id);
  return prisma.income.update({
    where: { id },
    data: { ...data, date: data.date ? new Date(data.date) : undefined },
  });
}

export async function deleteIncome(userId, id) {
  await getIncome(userId, id);
  await prisma.income.delete({ where: { id } });
}
