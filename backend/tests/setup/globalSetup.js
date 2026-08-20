import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './testDb.js';

export default function globalSetup() {
  execSync('npx prisma db push --skip-generate --accept-data-loss --force-reset', {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'inherit',
  });
}
