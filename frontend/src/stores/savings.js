import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useSavingsStore = defineStore('savings', {
  state: () => ({
    goals: [],
    loading: false,
  }),

  actions: {
    async fetch() {
      this.loading = true;
      try {
        const { data } = await api.get('/savings-goals');
        this.goals = data.goals;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      await api.post('/savings-goals', payload);
      await this.fetch();
    },

    async update(id, payload) {
      await api.put(`/savings-goals/${id}`, payload);
      await this.fetch();
    },

    async remove(id) {
      await api.delete(`/savings-goals/${id}`);
      await this.fetch();
    },

    async addContribution(goalId, payload) {
      await api.post(`/savings-goals/${goalId}/contributions`, payload);
      await this.fetch();
    },

    async removeContribution(goalId, contributionId) {
      await api.delete(`/savings-goals/${goalId}/contributions/${contributionId}`);
      await this.fetch();
    },
  },
});
