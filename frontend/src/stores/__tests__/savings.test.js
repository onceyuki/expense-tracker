import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api.js';
import { useSavingsStore } from '../savings.js';

const GOALS = [{ id: 'g1', name: 'Japan 2027', target: 150000, total: 5434.05, thisMonth: 5434.05, lastMonth: 0, contributions: [] }];

describe('savings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetch loads goals', async () => {
    api.get.mockResolvedValue({ data: { goals: GOALS } });
    const store = useSavingsStore();
    await store.fetch();
    expect(api.get).toHaveBeenCalledWith('/savings-goals');
    expect(store.goals).toHaveLength(1);
  });

  it('addContribution posts to the goal then refetches', async () => {
    api.post.mockResolvedValue({ data: { contribution: { id: 'c1' } } });
    api.get.mockResolvedValue({ data: { goals: GOALS } });
    const store = useSavingsStore();
    await store.addContribution('g1', { amount: 100, date: '2026-07-01' });
    expect(api.post).toHaveBeenCalledWith('/savings-goals/g1/contributions', { amount: 100, date: '2026-07-01' });
    expect(api.get).toHaveBeenCalled();
  });
});
