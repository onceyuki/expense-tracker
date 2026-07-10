import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    data: null,
    loading: false,
    alertsShown: false,
  }),

  actions: {
    async fetch(month) {
      this.loading = true;
      try {
        const { data } = await api.get('/dashboard', { params: month ? { month } : {} });
        this.data = data;
      } finally {
        this.loading = false;
      }
    },
  },
});
