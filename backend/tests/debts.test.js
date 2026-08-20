import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'debts@test.com'));
});

describe('debts', () => {
  let debt;

  it('requires auth', async () => {
    expect((await request(app).get('/api/debts')).status).toBe(401);
  });

  it('creates a debt (unpaid by default)', async () => {
    const res = await auth(request(app).post('/api/debts')).send({
      person: 'Alice', amount: 750, date: '2026-07-05', notes: 'Lunch money',
    });
    expect(res.status).toBe(201);
    expect(res.body.debt.paid).toBe(false);
    debt = res.body.debt;
  });

  it('rejects non-positive amounts', async () => {
    expect((await auth(request(app).post('/api/debts')).send({ person: 'X', amount: 0, date: '2026-07-05' })).status).toBe(400);
  });

  it('lists debts with unpaid/paid totals', async () => {
    await auth(request(app).post('/api/debts')).send({ person: 'Bob', amount: 250, date: '2026-07-06', paid: true });
    const res = await auth(request(app).get('/api/debts'));
    expect(res.status).toBe(200);
    expect(res.body.totals.unpaid).toBe(750);
    expect(res.body.totals.paid).toBe(250);
  });

  it('toggles paid via PUT', async () => {
    const res = await auth(request(app).put(`/api/debts/${debt.id}`)).send({ paid: true });
    expect(res.status).toBe(200);
    expect(res.body.debt.paid).toBe(true);
    const list = await auth(request(app).get('/api/debts'));
    expect(list.body.totals.unpaid).toBe(0);
  });

  it('deletes a debt', async () => {
    expect((await auth(request(app).delete(`/api/debts/${debt.id}`))).status).toBe(204);
  });

  it("404s on another user's debt", async () => {
    const other = await createTestUser(app, 'debts-other@test.com');
    const created = await auth(request(app).post('/api/debts')).send({ person: 'C', amount: 10, date: '2026-07-05' });
    const res = await request(app)
      .delete(`/api/debts/${created.body.debt.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});
