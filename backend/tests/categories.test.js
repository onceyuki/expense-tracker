import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;

function post(body) {
  return request(app).post('/api/categories').set('Authorization', `Bearer ${token}`).send(body);
}
function list() {
  return request(app).get('/api/categories').set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'categories@test.com'));
});

describe('categories', () => {
  let travel;

  it('requires auth', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(401);
  });

  it('lists the default categories seeded at registration', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.categories.map((c) => c.name).sort()).toEqual(['Needs', 'Savings', 'Wants']);
    expect(res.body.categories[0].color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('creates a category with an auto-assigned color', async () => {
    const res = await post({ name: 'Travel' });
    expect(res.status).toBe(201);
    expect(res.body.category.name).toBe('Travel');
    expect(res.body.category.color).toMatch(/^#[0-9a-f]{6}$/i);
    travel = res.body.category;
  });

  it('creates a category with an explicit color', async () => {
    const res = await post({ name: 'Gifts', color: '#123abc' });
    expect(res.status).toBe(201);
    expect(res.body.category.color).toBe('#123abc');
  });

  it('rejects an invalid color', async () => {
    const res = await post({ name: 'BadColor', color: 'red' });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate name with 409', async () => {
    const res = await post({ name: 'Travel' });
    expect(res.status).toBe(409);
  });

  it('renames a category and cascades the new name onto existing expenses', async () => {
    const expense = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Flight', amount: 300, category: 'Travel', date: '2026-07-01' });
    expect(expense.status).toBe(201);

    const rename = await request(app)
      .put(`/api/categories/${travel.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Trips' });
    expect(rename.status).toBe(200);
    expect(rename.body.category.name).toBe('Trips');

    const updated = await request(app)
      .get(`/api/expenses/${expense.body.expense.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(updated.body.expense.category).toBe('Trips');
  });

  it('blocks deleting a category still used by an expense', async () => {
    const res = await request(app)
      .delete(`/api/categories/${travel.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('deletes an unused category', async () => {
    const gifts = (await list()).body.categories.find((c) => c.name === 'Gifts');
    const res = await request(app)
      .delete(`/api/categories/${gifts.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it('rejects an unknown category on expense create', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'X', amount: 10, category: 'DoesNotExist', date: '2026-07-01' });
    expect(res.status).toBe(400);
  });
});
