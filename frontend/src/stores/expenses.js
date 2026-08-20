import { defineStore } from 'pinia';
import { api, downloadFile } from '../services/api.js';

const defaultFilters = () => ({
  search: '',
  category: '',
  walletId: '',
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
});

function activeParams(state) {
  const params = {
    page: state.page,
    pageSize: state.pageSize,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
  };
  for (const [key, value] of Object.entries(state.filters)) {
    if (value !== '' && value !== null) params[key] = value;
  }
  return params;
}

export const useExpensesStore = defineStore('expenses', {
  state: () => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    sortBy: 'date',
    sortDir: 'desc',
    filters: defaultFilters(),
    loading: false,
  }),

  getters: {
    hasActiveFilters: (state) =>
      Object.values(state.filters).some((v) => v !== '' && v !== null),
  },

  actions: {
    async fetch() {
      this.loading = true;
      try {
        const { data } = await api.get('/expenses', { params: activeParams(this) });
        this.items = data.items;
        this.total = data.total;
        this.totalPages = data.totalPages;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      const { data } = await api.post('/expenses', payload);
      await this.fetch();
      return data.expense;
    },

    async update(id, payload) {
      const { data } = await api.put(`/expenses/${id}`, payload);
      const index = this.items.findIndex((e) => e.id === id);
      if (index !== -1) this.items[index] = data.expense;
      return data.expense;
    },

    // Optimistic delete: remove locally, restore on failure
    async remove(id) {
      const snapshot = this.items;
      this.items = this.items.filter((e) => e.id !== id);
      this.total -= 1;
      try {
        await api.delete(`/expenses/${id}`);
        await this.fetch();
      } catch (error) {
        this.items = snapshot;
        this.total += 1;
        throw error;
      }
    },

    async duplicate(id) {
      const { data } = await api.post(`/expenses/${id}/duplicate`);
      await this.fetch();
      return data.expense;
    },

    async exportFile(format) {
      const params = { ...activeParams(this), format };
      delete params.page;
      delete params.pageSize;
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadFile('/expenses/export', params, `expenses-${stamp}.${format}`);
    },

    setSort({ sortBy, sortDir }) {
      this.sortBy = sortBy;
      this.sortDir = sortDir;
      this.fetch();
    },

    setPage(page) {
      this.page = page;
      this.fetch();
    },

    applyFilters() {
      this.page = 1;
      this.fetch();
    },

    resetFilters() {
      this.filters = defaultFilters();
      this.page = 1;
      this.fetch();
    },
  },
});
