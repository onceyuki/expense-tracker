import { defineStore } from 'pinia';

let toastId = 0;

export const useUiStore = defineStore('ui', {
  state: () => ({
    dark: document.documentElement.classList.contains('dark'),
    sidebarOpen: false,
    toasts: [],
    confirmState: null, // { title, message, confirmLabel, danger, resolve }
  }),

  actions: {
    toggleDark() {
      this.dark = !this.dark;
      document.documentElement.classList.toggle('dark', this.dark);
      localStorage.setItem('et_dark', this.dark ? '1' : '0');
    },

    toast(message, type = 'success', timeout = 3500) {
      const id = ++toastId;
      this.toasts.push({ id, message, type });
      if (timeout) setTimeout(() => this.dismissToast(id), timeout);
    },

    dismissToast(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },

    // Promise-based confirmation dialog; ConfirmDialog.vue renders confirmState
    confirm({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', danger = false } = {}) {
      return new Promise((resolve) => {
        this.confirmState = { title, message, confirmLabel, danger, resolve };
      });
    },

    resolveConfirm(result) {
      this.confirmState?.resolve(result);
      this.confirmState = null;
    },
  },
});
