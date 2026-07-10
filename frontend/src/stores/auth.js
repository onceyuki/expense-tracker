import { defineStore } from 'pinia';
import { api, setToken, clearToken, getToken } from '../services/api.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    hasToken: () => !!getToken(),
    initials: (state) =>
      (state.user?.name ?? '')
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
  },

  actions: {
    async register(payload) {
      const { data } = await api.post('/auth/register', payload);
      setToken(data.accessToken, true);
      this.user = data.user;
    },

    async login({ email, password, remember }) {
      const { data } = await api.post('/auth/login', { email, password, remember });
      setToken(data.accessToken, remember);
      this.user = data.user;
    },

    async fetchMe() {
      if (!getToken()) return;
      this.loading = true;
      try {
        const { data } = await api.get('/auth/me');
        this.user = data.user;
      } catch {
        clearToken();
        this.user = null;
      } finally {
        this.loading = false;
      }
    },

    async updateProfile(payload) {
      const { data } = await api.put('/auth/profile', payload);
      this.user = data.user;
      return data.user;
    },

    async logout() {
      try {
        await api.post('/auth/logout');
      } catch {
        // Best-effort: clear local session regardless
      } finally {
        clearToken();
        this.user = null;
      }
    },
  },
});
