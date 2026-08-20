import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;
let cash;
let gcash;

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'transfers@test.com'));
  const wallets = (await auth(request(app).get('/api/wallets'))).body.wallets;
  cash = wallets.find((w) => w.name === 'Cash');
  gcash = (await auth(request(app).post('/api/wallets')).send({ name: 'GCash', initialBalance: 1000 })).body.wallet;
});

describe('transfers', () => {
  let created;

  it('requires auth', async () => {
    expect((await request(app).get('/api/transfers')).status).toBe(401);
  });

  it('creates a transfer between wallets', async () => {
    const res = await auth(request(app).post('/api/transfers')).send({
      fromWalletId: gcash.id, toWalletId: cash.id, amount: 500, date: '2026-07-03',
    });
    expect(res.status).toBe(201);
    expect(res.body.transfer.fromWallet.name).toBe('GCash');
    expect(res.body.transfer.toWallet.name).toBe('Cash');
    created = res.body.transfer;
  });

  it('moves wallet balances', async () => {
    const wallets = (await auth(request(app).get('/api/wallets'))).body.wallets;
    expect(wallets.find((w) => w.id === gcash.id).balance).toBe(500); // 1000 − 500
    expect(wallets.find((w) => w.id === cash.id).balance).toBe(500); // 0 + 500
  });

  it('rejects a same-wallet transfer', async () => {
    const res = await auth(request(app).post('/api/transfers')).send({
      fromWalletId: cash.id, toWalletId: cash.id, amount: 10, date: '2026-07-03',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a wallet the user does not own', async () => {
    const other = await createTestUser(app, 'transfers-other@test.com');
    const res = await request(app).post('/api/transfers').set('Authorization', `Bearer ${other.token}`)
      .send({ fromWalletId: gcash.id, toWalletId: cash.id, amount: 10, date: '2026-07-03' });
    expect(res.status).toBe(400);
  });

  it('lists transfers with the pagination envelope', async () => {
    const res = await auth(request(app).get('/api/transfers'));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('totalPages');
  });

  it('updates a transfer', async () => {
    const res = await auth(request(app).put(`/api/transfers/${created.id}`)).send({ amount: 250 });
    expect(res.status).toBe(200);
    expect(res.body.transfer.amount).toBe(250);
  });

  it('deletes a transfer and restores balances', async () => {
    expect((await auth(request(app).delete(`/api/transfers/${created.id}`))).status).toBe(204);
    const wallets = (await auth(request(app).get('/api/wallets'))).body.wallets;
    expect(wallets.find((w) => w.id === gcash.id).balance).toBe(1000);
  });
});
