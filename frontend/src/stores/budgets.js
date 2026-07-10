import { defineStore } from 'pinia';
import { api } from '../services/api.js';
import { currentMonthKey } from '../utils/format.js';

export const useBudgetsStore = defineStore('budgets', {
  state: () => ({
    month: currentMonthKey(),
    budgets: [],
    loading: false,
  }),

  getters: {
    overall: (state) => state.budgets.find((b) => b.category === null) ?? null,
    byCategory: (state) => state.budgets.filter((b) => b.category !== null),
  },

  actions: {
    async fetch() {
      this.loading = true;
      try {
        const { data } = await api.get('/budgets', { params: { month: this.month } });
        this.budgets = data.budgets;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      await api.post('/budgets', { ...payload, month: this.month });
      await this.fetch();
    },

    async update(id, payload) {
      await api.put(`/budgets/${id}`, payload);
      await this.fetch();
    },

    async remove(id) {
      await api.delete(`/budgets/${id}`);
      await this.fetch();
    },

    setMonth(month) {
      this.month = month;
      this.fetch();
    },
  },
});
