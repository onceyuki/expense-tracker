import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;

const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const year = String(now.getFullYear());

function get(path, query = {}) {
  return request(app).get(path).query(query).set('Authorization', `Bearer ${token}`);
}

function binary(req) {
  return req.buffer().parse((res, cb) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });
}

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'reports@test.com'));
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  await auth(request(app).post('/api/income')).send({
    source: 'Salary',
    amount: 2000,
    date: new Date(now.getFullYear(), now.getMonth(), 1, 9).toISOString(),
  });
  await auth(request(app).post('/api/expenses')).send({
    title: 'Rent payment',
    amount: 800,
    category: 'Rent',
    paymentMethod: 'Bank Transfer',
    date: new Date(now.getFullYear(), now.getMonth(), 2, 9).toISOString(),
  });
});

describe('reports', () => {
  it('monthly report (json) sums income/expenses and breaks down categories', async () => {
    const res = await get('/api/reports/monthly', { month });
    expect(res.status).toBe(200);
    expect(res.body.income).toBe(2000);
    expect(res.body.expenses).toBe(800);
    expect(res.body.savings).toBe(1200);
    expect(res.body.byCategory).toContainEqual({ category: 'Rent', amount: 800 });
  });

  it('yearly report (json) contains 12 months and totals', async () => {
    const res = await get('/api/reports/yearly', { year });
    expect(res.status).toBe(200);
    expect(res.body.months).toHaveLength(12);
    const m = res.body.months.find((x) => x.month === month);
    expect(m.income).toBe(2000);
    expect(m.expenses).toBe(800);
    expect(res.body.totals.net).toBe(1200);
  });

  it('category report (json) includes percentages', async () => {
    const res = await get('/api/reports/categories');
    expect(res.status).toBe(200);
    const rent = res.body.categories.find((c) => c.category === 'Rent');
    expect(rent.amount).toBe(800);
    expect(rent.percent).toBe(100);
  });

  it('exports monthly report as CSV', async () => {
    const res = await get('/api/reports/monthly', { month, format: 'csv' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Rent');
  });

  it('exports monthly report as Excel', async () => {
    const res = await binary(get('/api/reports/monthly', { month, format: 'xlsx' }));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('exports monthly report as PDF', async () => {
    const res = await binary(get('/api/reports/monthly', { month, format: 'pdf' }));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });
});
