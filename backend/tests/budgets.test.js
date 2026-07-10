import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;
const MONTH = '2026-07';

function post(body) {
  return request(app).post('/api/budgets').set('Authorization', `Bearer ${token}`).send(body);
}

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'budgets@test.com'));
  // spending fixture: 300 Food in July
  await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`).send({
    title: 'Big shop',
    amount: 300,
    category: 'Food',
    paymentMethod: 'Cash',
    date: '2026-07-03',
  });
});

describe('budgets', () => {
  let overall;
  let foodBudget;

  it('creates an overall monthly budget (category null)', async () => {
    const res = await post({ category: null, limit: 2000, month: MONTH });
    expect(res.status).toBe(201);
    expect(res.body.budget.category).toBeNull();
    overall = res.body.budget;
  });

  it('creates a category budget', async () => {
    const res = await post({ category: 'Food', limit: 600, month: MONTH });
    expect(res.status).toBe(201);
    foodBudget = res.body.budget;
  });

  it('rejects duplicate budget for same user/category/month with 409', async () => {
    const res = await post({ category: 'Food', limit: 500, month: MONTH });
    expect(res.status).toBe(409);
  });

  it('rejects bad month format', async () => {
    const res = await post({ category: 'Travel', limit: 100, month: 'July 2026' });
    expect(res.status).toBe(400);
  });

  it('lists budgets for a month with computed spending', async () => {
    const res = await request(app)
      .get('/api/budgets')
      .query({ month: MONTH })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const food = res.body.budgets.find((b) => b.category === 'Food');
    expect(food.spent).toBe(300);
    expect(food.remaining).toBe(300);
    expect(food.percentUsed).toBe(50);
    const all = res.body.budgets.find((b) => b.category === null);
    expect(all.spent).toBe(300);
    expect(all.percentUsed).toBe(15);
  });

  it('updates a budget limit', async () => {
    const res = await request(app)
      .put(`/api/budgets/${foodBudget.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ limit: 900 });
    expect(res.status).toBe(200);
    expect(res.body.budget.limit).toBe(900);
  });

  it('deletes a budget', async () => {
    const res = await request(app)
      .delete(`/api/budgets/${overall.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});
