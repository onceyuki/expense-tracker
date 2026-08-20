import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useDebtsStore = defineStore('debts', {
  state: () => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    totals: { unpaid: 0, paid: 0 },
    loading: false,
  }),

  actions: {
    async fetch() {
      this.loading = true;
      try {
        const { data } = await api.get('/debts', { params: { page: this.page, pageSize: this.pageSize } });
        this.items = data.items;
        this.total = data.total;
        this.totalPages = data.totalPages;
        this.totals = data.totals;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      await api.post('/debts', payload);
      await this.fetch();
    },

    async update(id, payload) {
      await api.put(`/debts/${id}`, payload);
      await this.fetch();
    },

    async remove(id) {
      await api.delete(`/debts/${id}`);
      await this.fetch();
    },

    async togglePaid(debt) {
      await api.put(`/debts/${debt.id}`, { paid: !debt.paid });
      await this.fetch();
    },

    setPage(page) {
      this.page = page;
      this.fetch();
    },
  },
});
