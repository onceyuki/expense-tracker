import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useIncomeStore = defineStore('income', {
  state: () => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    search: '',
    loading: false,
  }),

  actions: {
    async fetch() {
      this.loading = true;
      try {
        const params = { page: this.page, pageSize: this.pageSize };
        if (this.search) params.search = this.search;
        const { data } = await api.get('/income', { params });
        this.items = data.items;
        this.total = data.total;
        this.totalPages = data.totalPages;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      await api.post('/income', payload);
      await this.fetch();
    },

    async update(id, payload) {
      const { data } = await api.put(`/income/${id}`, payload);
      const index = this.items.findIndex((i) => i.id === id);
      if (index !== -1) this.items[index] = data.income;
    },

    async remove(id) {
      await api.delete(`/income/${id}`);
      await this.fetch();
    },

    setPage(page) {
      this.page = page;
      this.fetch();
    },

    applySearch() {
      this.page = 1;
      this.fetch();
    },
  },
});
