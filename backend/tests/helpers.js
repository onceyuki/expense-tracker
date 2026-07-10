import request from 'supertest';
import { prisma } from '../src/utils/prisma.js';

// Registers a fresh user (deleting any previous run's copy) and returns auth context.
// `categories` are created via the categories API on top of the auto-seeded defaults,
// so fixtures can use expense/budget categories beyond Wants/Needs/Savings.
export async function createTestUser(app, email, name = 'Test User', categories = []) {
  await prisma.user.deleteMany({ where: { email } });
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'Secret123!' });
  if (res.status !== 201) throw new Error(`Failed to register test user: ${res.status}`);
  const { user, accessToken: token } = res.body;
  for (const categoryName of categories) {
    await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: categoryName });
  }
  return { user, token };
}
