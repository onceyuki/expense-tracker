import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useWalletsStore = defineStore('wallets', {
  state: () => ({
    wallets: [],
    loading: false,
    loaded: false,
    transfers: [],
    transfersTotal: 0,
    transfersPage: 1,
    transfersPageSize: 10,
    transfersTotalPages: 1,
    transfersLoading: false,
  }),

  getters: {
    options: (state) => state.wallets.map((w) => ({ value: w.id, label: w.name })),
    nameOf: (state) => (id) => state.wallets.find((w) => w.id === id)?.name ?? '—',
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
        const { data } = await api.get('/wallets');
        this.wallets = data.wallets;
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      const { data } = await api.post('/wallets', payload);
      await this.fetch();
      return data.wallet;
    },

    async update(id, payload) {
      const { data } = await api.put(`/wallets/${id}`, payload);
      await this.fetch();
      return data.wallet;
    },

    async remove(id) {
      await api.delete(`/wallets/${id}`);
      await this.fetch();
    },

    async fetchTransfers() {
      this.transfersLoading = true;
      try {
        const { data } = await api.get('/transfers', {
          params: { page: this.transfersPage, pageSize: this.transfersPageSize },
        });
        this.transfers = data.items;
        this.transfersTotal = data.total;
        this.transfersTotalPages = data.totalPages;
      } finally {
        this.transfersLoading = false;
      }
    },

    // Transfers move balances, so wallet totals refetch alongside the list.
    async createTransfer(payload) {
      await api.post('/transfers', payload);
      await Promise.all([this.fetchTransfers(), this.fetch()]);
    },

    async updateTransfer(id, payload) {
      await api.put(`/transfers/${id}`, payload);
      await Promise.all([this.fetchTransfers(), this.fetch()]);
    },

    async removeTransfer(id) {
      await api.delete(`/transfers/${id}`);
      await Promise.all([this.fetchTransfers(), this.fetch()]);
    },

    setTransfersPage(page) {
      this.transfersPage = page;
      this.fetchTransfers();
    },
  },
});
