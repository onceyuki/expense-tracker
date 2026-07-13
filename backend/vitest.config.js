import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './tests/setup/testDb.js';

export default defineConfig({
  test: {
    // Isolated `tests` schema on the dev Postgres database (see tests/setup/testDb.js)
    env: {
      DATABASE_URL: testDatabaseUrl(),
      JWT_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    },
    globalSetup: './tests/setup/globalSetup.js',
    // All test files share the single `tests` schema: keep runs sequential
    fileParallelism: false,
    testTimeout: 15000,
  },
});
