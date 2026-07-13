import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser } from './helpers.js';

const app = createApp();
let token;

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

function isoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

beforeAll(async () => {
  ({ token } = await createTestUser(app, 'savings@test.com'));
});

describe('savings goals', () => {
  let goal;

  it('requires auth', async () => {
    expect((await request(app).get('/api/savings-goals')).status).toBe(401);
  });

  it('creates a goal with an optional target', async () => {
    const res = await auth(request(app).post('/api/savings-goals')).send({ name: 'Japan 2027', target: 150000 });
    expect(res.status).toBe(201);
    expect(res.body.goal.target).toBe(150000);
    goal = res.body.goal;
  });

  it('rejects a duplicate goal name', async () => {
    expect((await auth(request(app).post('/api/savings-goals')).send({ name: 'Japan 2027' })).status).toBe(409);
  });

  it('adds contributions and computes monthly rollups', async () => {
    const now = new Date();
    const thisMonthDay = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const lastMonthDay = isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 15));
    await auth(request(app).post(`/api/savings-goals/${goal.id}/contributions`)).send({ amount: 5000, date: thisMonthDay });
    await auth(request(app).post(`/api/savings-goals/${goal.id}/contributions`)).send({ amount: 434.05, date: thisMonthDay });
    await auth(request(app).post(`/api/savings-goals/${goal.id}/contributions`)).send({ amount: 1000, date: lastMonthDay });

    const res = await auth(request(app).get('/api/savings-goals'));
    const g = res.body.goals.find((x) => x.id === goal.id);
    expect(g.total).toBe(6434.05);
    expect(g.thisMonth).toBe(5434.05);
    expect(g.lastMonth).toBe(1000);
    expect(g.contributions).toHaveLength(3);
  });

  it('404s adding a contribution to an unknown goal', async () => {
    const res = await auth(request(app).post('/api/savings-goals/nope/contributions')).send({ amount: 10, date: '2026-07-01' });
    expect(res.status).toBe(404);
  });

  it('deletes a contribution', async () => {
    const list = await auth(request(app).get('/api/savings-goals'));
    const g = list.body.goals.find((x) => x.id === goal.id);
    const cid = g.contributions[0].id;
    expect((await auth(request(app).delete(`/api/savings-goals/${goal.id}/contributions/${cid}`))).status).toBe(204);
  });

  it('updates a goal', async () => {
    const res = await auth(request(app).put(`/api/savings-goals/${goal.id}`)).send({ name: 'Japan Trip 2027' });
    expect(res.status).toBe(200);
    expect(res.body.goal.name).toBe('Japan Trip 2027');
  });

  it('deletes a goal (cascades contributions)', async () => {
    expect((await auth(request(app).delete(`/api/savings-goals/${goal.id}`))).status).toBe(204);
    const res = await auth(request(app).get('/api/savings-goals'));
    expect(res.body.goals.find((x) => x.id === goal.id)).toBeUndefined();
  });
});
