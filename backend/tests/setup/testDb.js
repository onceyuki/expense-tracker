import dotenv from 'dotenv';

// Tests run against a dedicated `tests` schema on the same Postgres database
// as development, so one provider covers dev, tests and production.
dotenv.config();

export function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL is not set — configure backend/.env');
  const url = new URL(base);
  url.searchParams.set('schema', 'tests');
  return url.toString();
}
