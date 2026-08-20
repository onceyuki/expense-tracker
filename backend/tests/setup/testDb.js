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
  // Supabase's session-mode pooler allows only 15 clients; cap Prisma's pool so
  // parallel queries queue instead of exhausting the pooler.
  url.searchParams.set('connection_limit', '5');
  return url.toString();
}
