import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;
let otherToken;

function post(body) {
  return request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`).send(body);
}

const base = {
  title: 'Groceries',
  amount: 54.2,
  category: 'Food',
  paymentMethod: 'Credit Card',
  date: '2026-07-01T10:00:00.000Z',
  notes: 'weekly shop',
};

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'expenses@test.com', 'Test User', [
    'Food', 'Transportation', 'Entertainment', 'Utilities', 'Shopping',
  ]));
  ({ token: otherToken } = await createTestUser(app, 'expenses-other@test.com'));
});

describe('expenses CRUD', () => {
  let created;

  it('requires auth', async () => {
    const res = await request(app).get('/api/expenses');
    expect(res.status).toBe(401);
  });

  it('creates an expense', async () => {
    const res = await post(base);
    expect(res.status).toBe(201);
    expect(res.body.expense.title).toBe('Groceries');
    expect(res.body.expense.amount).toBe(54.2);
    created = res.body.expense;
  });

  it('rejects negative amount and unknown category', async () => {
    expect((await post({ ...base, amount: -5 })).status).toBe(400);
    expect((await post({ ...base, category: 'Nonsense' })).status).toBe(400);
  });

  it('gets an expense by id', async () => {
    const res = await request(app)
      .get(`/api/expenses/${created.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.expense.id).toBe(created.id);
  });

  it("returns 404 for another user's expense", async () => {
    const res = await request(app)
      .get(`/api/expenses/${created.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('updates an expense', async () => {
    const res = await request(app)
      .put(`/api/expenses/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...base, title: 'Groceries updated', amount: 60 });
    expect(res.status).toBe(200);
    expect(res.body.expense.title).toBe('Groceries updated');
    expect(res.body.expense.amount).toBe(60);
  });

  it('duplicates an expense', async () => {
    const res = await request(app)
      .post(`/api/expenses/${created.id}/duplicate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.expense.id).not.toBe(created.id);
    expect(res.body.expense.title).toBe('Groceries updated');
  });

  it('deletes an expense', async () => {
    const res = await request(app)
      .delete(`/api/expenses/${created.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
    const after = await request(app)
      .get(`/api/expenses/${created.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(404);
  });
});

describe('expenses list: search, filter, sort, paginate, export', () => {
  beforeAll(async () => {
    // fixture set: distinct categories, amounts, dates
    const rows = [
      { title: 'Coffee beans', amount: 15, category: 'Food', paymentMethod: 'Cash', date: '2026-06-01T09:00:00.000Z' },
      { title: 'Bus pass', amount: 40, category: 'Transportation', paymentMethod: 'Debit Card', date: '2026-06-05T09:00:00.000Z' },
      { title: 'Concert', amount: 120, category: 'Entertainment', paymentMethod: 'Credit Card', date: '2026-06-10T09:00:00.000Z', notes: 'front row' },
      { title: 'Electric bill', amount: 85, category: 'Utilities', paymentMethod: 'Bank Transfer', date: '2026-07-02T09:00:00.000Z' },
      { title: 'New shoes', amount: 95, category: 'Shopping', paymentMethod: 'Credit Card', date: '2026-07-05T09:00:00.000Z' },
    ];
    for (const row of rows) await post(row);
  });

  function list(query) {
    return request(app).get('/api/expenses').query(query).set('Authorization', `Bearer ${token}`);
  }

  it('paginates with envelope', async () => {
    const res = await list({ page: 1, pageSize: 2 });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(5);
    expect(res.body.totalPages).toBe(Math.ceil(res.body.total / 2));
  });

  it('searches title and notes', async () => {
    const byTitle = await list({ search: 'coffee' });
    expect(byTitle.body.items.some((e) => e.title === 'Coffee beans')).toBe(true);
    const byNotes = await list({ search: 'front row' });
    expect(byNotes.body.items).toHaveLength(1);
    expect(byNotes.body.items[0].title).toBe('Concert');
  });

  it('filters by category, payment method, date range, amount range', async () => {
    const cat = await list({ category: 'Utilities' });
    expect(cat.body.items.every((e) => e.category === 'Utilities')).toBe(true);
    expect(cat.body.items.length).toBe(1);

    const pay = await list({ paymentMethod: 'Credit Card' });
    expect(pay.body.items.every((e) => e.paymentMethod === 'Credit Card')).toBe(true);

    const dates = await list({ dateFrom: '2026-07-01', dateTo: '2026-07-31' });
    expect(dates.body.items.every((e) => e.date >= '2026-07-01')).toBe(true);

    const amounts = await list({ minAmount: 90, maxAmount: 130 });
    expect(amounts.body.items.every((e) => e.amount >= 90 && e.amount <= 130)).toBe(true);
    expect(amounts.body.items.length).toBe(2);
  });

  it('sorts by amount ascending', async () => {
    const res = await list({ sortBy: 'amount', sortDir: 'asc', pageSize: 50 });
    const amounts = res.body.items.map((e) => e.amount);
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  it('exports CSV with filters applied', async () => {
    const res = await request(app)
      .get('/api/expenses/export')
      .query({ format: 'csv', category: 'Food' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Coffee beans');
    expect(res.text).not.toContain('Concert');
  });

  it('exports Excel', async () => {
    const res = await request(app)
      .get('/api/expenses/export')
      .query({ format: 'xlsx' })
      .set('Authorization', `Bearer ${token}`)
      .buffer()
      .parse((res2, cb) => {
        const chunks = [];
        res2.on('data', (c) => chunks.push(c));
        res2.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.body.length).toBeGreaterThan(1000);
  });
});
