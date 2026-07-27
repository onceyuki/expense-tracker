import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

const nodeBuiltinsPlugin = {
  name: 'node-builtins',
  resolveId(id) {
    if (id.startsWith('node:') || id === 'sqlite') {
      return false; // Let Node.js handle it
    }
  },
};

export default defineConfig({
  plugins: [nodeBuiltinsPlugin, vue(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      external: ['node:sqlite'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    environmentMatchGlobs: [['src/data/db/__tests__/**', 'node']],
  },
});
