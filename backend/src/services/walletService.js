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
