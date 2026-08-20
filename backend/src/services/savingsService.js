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
