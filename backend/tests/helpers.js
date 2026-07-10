import request from 'supertest';
import { prisma } from '../src/utils/prisma.js';

// Registers a fresh user (deleting any previous run's copy) and returns auth context.
export async function createTestUser(app, email, name = 'Test User') {
  await prisma.user.deleteMany({ where: { email } });
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'Secret123!' });
  if (res.status !== 201) throw new Error(`Failed to register test user: ${res.status}`);
  return { user: res.body.user, token: res.body.accessToken };
}
