import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

const app = createApp();

const user = {
  name: 'Alice Test',
  email: 'alice@test.com',
  password: 'Secret123!',
};

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
});

describe('auth', () => {
  let accessToken;

  it('registers a new user and returns user + access token', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    expect(res.headers['set-cookie']?.join(';')).toContain('refreshToken=');
  });

  it('rejects duplicate email with 409', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(409);
  });

  it('rejects invalid registration payload with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'x', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toBeInstanceOf(Array);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    accessToken = res.body.accessToken;
  });

  it('rejects wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'WrongPass1!' });
    expect(res.status).toBe(401);
  });

  it('GET /me returns current user with token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it('GET /me without token returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('refresh returns a new access token from the cookie', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    const cookie = login.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('refresh without cookie returns 401', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('updates profile name and password (requires current password)', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Alice Updated', currentPassword: user.password, newPassword: 'NewSecret123!' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Alice Updated');

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'NewSecret123!' });
    expect(relogin.status).toBe(200);
  });

  it('rejects password change with wrong current password', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'nope', newPassword: 'Whatever123!' });
    expect(res.status).toBe(401);
  });

  it('logout clears the refresh cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'].join(';')).toContain('refreshToken=;');
  });

  it('forgot-password always responds with success message', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'whoever@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeTruthy();
  });
});
