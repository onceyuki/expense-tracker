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
