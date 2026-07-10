import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../services/api.js', () => ({
  api: { post: vi.fn(), get: vi.fn(), put: vi.fn() },
  setToken: vi.fn(),
  clearToken: vi.fn(),
  getToken: vi.fn(() => 'stored-token'),
}));

import { api, setToken, clearToken } from '../../services/api.js';
import { useAuthStore } from '../auth.js';

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('login stores token (respecting remember) and user', async () => {
    api.post.mockResolvedValue({
      data: { user: { id: '1', name: 'Ada Lovelace', email: 'ada@x.com' }, accessToken: 'tok' },
    });
    const store = useAuthStore();
    await store.login({ email: 'ada@x.com', password: 'pw', remember: false });

    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'ada@x.com',
      password: 'pw',
      remember: false,
    });
    expect(setToken).toHaveBeenCalledWith('tok', false);
    expect(store.isAuthenticated).toBe(true);
    expect(store.initials).toBe('AL');
  });

  it('fetchMe populates user from /auth/me', async () => {
    api.get.mockResolvedValue({ data: { user: { id: '1', name: 'Ada', email: 'a@x.com' } } });
    const store = useAuthStore();
    await store.fetchMe();
    expect(store.user.name).toBe('Ada');
  });

  it('fetchMe clears token when the call fails', async () => {
    api.get.mockRejectedValue(new Error('401'));
    const store = useAuthStore();
    await store.fetchMe();
    expect(clearToken).toHaveBeenCalled();
    expect(store.user).toBeNull();
  });

  it('logout clears state even if the API call fails', async () => {
    api.post.mockRejectedValue(new Error('network'));
    const store = useAuthStore();
    store.user = { id: '1', name: 'Ada' };
    await store.logout();
    expect(clearToken).toHaveBeenCalled();
    expect(store.user).toBeNull();
  });
});
