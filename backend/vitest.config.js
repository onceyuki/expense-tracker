import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Isolated SQLite database for tests (relative to prisma/schema.prisma)
    env: {
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    },
    globalSetup: './tests/setup/globalSetup.js',
    // SQLite write locks: run test files sequentially
    fileParallelism: false,
    testTimeout: 15000,
  },
});
