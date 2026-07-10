import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('app', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('unknown routes return 404 envelope', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('Not found');
  });

  it('serves swagger docs', async () => {
    const res = await request(createApp()).get('/api/docs/').redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });
});
