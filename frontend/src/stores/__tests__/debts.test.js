import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api.js';
import { useDebtsStore } from '../debts.js';

const LIST = {
  items: [{ id: 'd1', person: 'Alice', amount: 750, paid: false }],
  total: 1, page: 1, pageSize: 10, totalPages: 1,
  totals: { unpaid: 750, paid: 0 },
};

describe('debts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetch loads items and totals', async () => {
    api.get.mockResolvedValue({ data: LIST });
    const store = useDebtsStore();
    await store.fetch();
    expect(store.items).toHaveLength(1);
    expect(store.totals.unpaid).toBe(750);
  });

  it('togglePaid PUTs the flipped value and refetches', async () => {
    api.get.mockResolvedValue({ data: LIST });
    api.put.mockResolvedValue({ data: { debt: { ...LIST.items[0], paid: true } } });
    const store = useDebtsStore();
    await store.fetch();
    await store.togglePaid(store.items[0]);
    expect(api.put).toHaveBeenCalledWith('/debts/d1', { paid: true });
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
