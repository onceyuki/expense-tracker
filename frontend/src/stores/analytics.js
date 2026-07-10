import { defineStore } from 'pinia';
import { api } from '../services/api.js';

function rangeFor(preset) {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  switch (preset) {
    case 'week': {
      const from = new Date(now);
      from.setDate(from.getDate() - 7 * 12); // last 12 weeks
      return { from: iso(from), to: iso(now), granularity: 'week' };
    }
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return { from: iso(from), to: iso(now), granularity: 'month' };
    }
    case 'year': {
      const from = new Date(now.getFullYear() - 4, 0, 1);
      return { from: iso(from), to: iso(now), granularity: 'year' };
    }
    default:
      return { granularity: 'month' };
  }
}

export const useAnalyticsStore = defineStore('analytics', {
  state: () => ({
    preset: 'month', // week | month | year | custom
    customFrom: '',
    customTo: '',
    data: null,
    loading: false,
  }),

  actions: {
    async fetch() {
      this.loading = true;
      try {
        const params =
          this.preset === 'custom'
            ? {
                from: this.customFrom || undefined,
                to: this.customTo || undefined,
                granularity: 'month',
              }
            : rangeFor(this.preset);
        const { data } = await api.get('/analytics', { params });
        this.data = data;
      } finally {
        this.loading = false;
      }
    },

    setPreset(preset) {
      this.preset = preset;
      if (preset !== 'custom') this.fetch();
    },
  },
});
