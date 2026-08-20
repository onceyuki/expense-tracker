import { prisma } from '../utils/prisma.js';
import { ApiError } from '../utils/ApiError.js';

const walletInclude = {
  fromWallet: { select: { id: true, name: true, color: true } },
  toWallet: { select: { id: true, name: true, color: true } },
};

async function assertOwnedWallet(userId, walletId) {
  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId } });
  if (!wallet) throw new ApiError(400, 'Unknown wallet');
}

export async function listTransfers(userId, query) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.transfer.findMany({
      where,
      include: walletInclude,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transfer.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getTransfer(userId, id) {
  const transfer = await prisma.transfer.findFirst({ where: { id, userId } });
  if (!transfer) throw new ApiError(404, 'Transfer not found');
  return transfer;
}

export async function createTransfer(userId, data) {
  if (data.fromWalletId === data.toWalletId) {
    throw new ApiError(400, 'Cannot transfer to the same wallet');
  }
  await Promise.all([
    assertOwnedWallet(userId, data.fromWalletId),
    assertOwnedWallet(userId, data.toWalletId),
  ]);
  return prisma.transfer.create({
    data: { ...data, userId, date: new Date(data.date) },
    include: walletInclude,
  });
}

export async function updateTransfer(userId, id, data) {
  const existing = await getTransfer(userId, id);
  const from = data.fromWalletId ?? existing.fromWalletId;
  const to = data.toWalletId ?? existing.toWalletId;
  if (from === to) throw new ApiError(400, 'Cannot transfer to the same wallet');
  if (data.fromWalletId) await assertOwnedWallet(userId, data.fromWalletId);
  if (data.toWalletId) await assertOwnedWallet(userId, data.toWalletId);
  return prisma.transfer.update({
    where: { id },
    data: { ...data, date: data.date ? new Date(data.date) : undefined },
    include: walletInclude,
  });
}

export async function deleteTransfer(userId, id) {
  await getTransfer(userId, id);
  await prisma.transfer.delete({ where: { id } });
}
