import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'wallets@test.com', 'Wallet Tester', ['Food']));
});

describe('wallets', () => {
  let gcash;

  it('requires auth', async () => {
    expect((await request(app).get('/api/wallets')).status).toBe(401);
  });

  it('registration seeded a default Cash wallet', async () => {
    const res = await auth(request(app).get('/api/wallets'));
    expect(res.status).toBe(200);
    expect(res.body.wallets.map((w) => w.name)).toContain('Cash');
  });

  it('creates a wallet with initial balance', async () => {
    const res = await auth(request(app).post('/api/wallets')).send({ name: 'GCash', color: '#2a78d6', initialBalance: 500 });
    expect(res.status).toBe(201);
    expect(res.body.wallet.name).toBe('GCash');
    gcash = res.body.wallet;
  });

  it('rejects a duplicate wallet name', async () => {
    expect((await auth(request(app).post('/api/wallets')).send({ name: 'GCash' })).status).toBe(409);
  });

  it('computes balance from initial + income − expenses', async () => {
    await auth(request(app).post('/api/income')).send({ source: 'Salary', amount: 300, date: '2026-07-01', walletId: gcash.id });
    await auth(request(app).post('/api/expenses')).send({ title: 'Lunch', amount: 120, category: 'Food', date: '2026-07-02', walletId: gcash.id });
    const res = await auth(request(app).get('/api/wallets'));
    const w = res.body.wallets.find((x) => x.id === gcash.id);
    expect(w.totalIncome).toBe(300);
    expect(w.totalExpenses).toBe(120);
    expect(w.balance).toBe(680); // 500 + 300 − 120
  });

  it('updates name and initial balance', async () => {
    const res = await auth(request(app).put(`/api/wallets/${gcash.id}`)).send({ name: 'GCash Main', initialBalance: 600 });
    expect(res.status).toBe(200);
    expect(res.body.wallet.name).toBe('GCash Main');
  });

  it('blocks deleting a wallet still referenced by expenses/income', async () => {
    const res = await auth(request(app).delete(`/api/wallets/${gcash.id}`));
    expect(res.status).toBe(409);
  });

  it('deletes an unreferenced wallet', async () => {
    const created = await auth(request(app).post('/api/wallets')).send({ name: 'Temp' });
    const res = await auth(request(app).delete(`/api/wallets/${created.body.wallet.id}`));
    expect(res.status).toBe(204);
  });

  it("404s on another user's wallet", async () => {
    const other = await createTestUser(app, 'wallets-other@test.com');
    const res = await request(app)
      .delete(`/api/wallets/${gcash.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});
