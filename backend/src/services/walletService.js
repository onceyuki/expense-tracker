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
