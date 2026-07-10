import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;

function post(body) {
  return request(app).post('/api/income').set('Authorization', `Bearer ${token}`).send(body);
}

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'income@test.com'));
});

describe('income CRUD', () => {
  let created;

  it('requires auth', async () => {
    expect((await request(app).get('/api/income')).status).toBe(401);
  });

  it('creates an income record', async () => {
    const res = await post({ source: 'Salary', amount: 4200, date: '2026-07-01', notes: 'July' });
    expect(res.status).toBe(201);
    expect(res.body.income.source).toBe('Salary');
    created = res.body.income;
  });

  it('rejects non-positive amount', async () => {
    expect((await post({ source: 'X', amount: 0, date: '2026-07-01' })).status).toBe(400);
  });

  it('lists income with pagination envelope', async () => {
    await post({ source: 'Freelance', amount: 800, date: '2026-06-15' });
    const res = await request(app)
      .get('/api/income')
      .query({ page: 1, pageSize: 1 })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('searches by source', async () => {
    const res = await request(app)
      .get('/api/income')
      .query({ search: 'free' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items.some((i) => i.source === 'Freelance')).toBe(true);
    expect(res.body.items.some((i) => i.source === 'Salary')).toBe(false);
  });

  it('updates an income record', async () => {
    const res = await request(app)
      .put(`/api/income/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 4500 });
    expect(res.status).toBe(200);
    expect(res.body.income.amount).toBe(4500);
  });

  it('deletes an income record', async () => {
    const res = await request(app)
      .delete(`/api/income/${created.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});
