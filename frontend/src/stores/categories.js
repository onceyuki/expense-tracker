import { defineStore } from 'pinia';
import { api } from '../services/api.js';

const FALLBACK_COLOR = '#64748b';

export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    categories: [],
    loading: false,
    loaded: false,
  }),

  getters: {
    names: (state) => state.categories.map((c) => c.name),
    colorOf: (state) => (name) => state.categories.find((c) => c.name === name)?.color ?? FALLBACK_COLOR,
  },

  actions: {
    // Cheap to call from every page that needs the list; only hits the API once.
    async ensureLoaded() {
      if (this.loaded || this.loading) return;
      await this.fetch();
    },

    async fetch() {
      this.loading = true;
      try {
        const { data } = await api.get('/categories');
        this.categories = data.categories;
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      const { data } = await api.post('/categories', payload);
      await this.fetch();
      return data.category;
    },

    async update(id, payload) {
      const { data } = await api.put(`/categories/${id}`, payload);
      await this.fetch();
      return data.category;
    },

    async remove(id) {
      await api.delete(`/categories/${id}`);
      await this.fetch();
    },
  },
});
