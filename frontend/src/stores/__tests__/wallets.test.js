import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api.js';
import { useWalletsStore } from '../wallets.js';

const WALLETS = [
  { id: 'w1', name: 'Cash', color: '#1baf7a', balance: 500 },
  { id: 'w2', name: 'GCash', color: '#2a78d6', balance: 1200 },
];

describe('wallets store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetch loads wallets', async () => {
    api.get.mockResolvedValue({ data: { wallets: WALLETS } });
    const store = useWalletsStore();
    await store.fetch();
    expect(api.get).toHaveBeenCalledWith('/wallets');
    expect(store.wallets).toHaveLength(2);
    expect(store.loaded).toBe(true);
  });

  it('ensureLoaded only fetches once', async () => {
    api.get.mockResolvedValue({ data: { wallets: WALLETS } });
    const store = useWalletsStore();
    await store.ensureLoaded();
    await store.ensureLoaded();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('options getter maps id/name pairs', async () => {
    api.get.mockResolvedValue({ data: { wallets: WALLETS } });
    const store = useWalletsStore();
    await store.fetch();
    expect(store.options).toEqual([
      { value: 'w1', label: 'Cash' },
      { value: 'w2', label: 'GCash' },
    ]);
    expect(store.nameOf('w2')).toBe('GCash');
  });

  it('create posts then refetches', async () => {
    api.post.mockResolvedValue({ data: { wallet: WALLETS[0] } });
    api.get.mockResolvedValue({ data: { wallets: WALLETS } });
    const store = useWalletsStore();
    await store.create({ name: 'Cash' });
    expect(api.post).toHaveBeenCalledWith('/wallets', { name: 'Cash' });
    expect(api.get).toHaveBeenCalled();
  });

  it('createTransfer posts then refetches transfers and wallets', async () => {
    api.post.mockResolvedValue({ data: { transfer: { id: 't1' } } });
    api.get.mockResolvedValue({ data: { wallets: WALLETS, items: [], total: 0, totalPages: 1 } });
    const store = useWalletsStore();
    await store.createTransfer({ fromWalletId: 'w1', toWalletId: 'w2', amount: 100, date: '2026-07-01' });
    expect(api.post).toHaveBeenCalledWith('/transfers', { fromWalletId: 'w1', toWalletId: 'w2', amount: 100, date: '2026-07-01' });
    expect(api.get).toHaveBeenCalledWith('/transfers', expect.anything());
    expect(api.get).toHaveBeenCalledWith('/wallets');
  });
});
