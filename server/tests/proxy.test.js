import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRepositories } from '../src/repositories/index.js';
import { loadConfig } from '../src/config/env.js';

describe('client IP behind proxies', () => {
  it('uses the real client IP when Vercel forwards to Render (TRUST_PROXY=2)', async () => {
    const config = loadConfig({ NODE_ENV: 'test', DATA_STORE: 'memory', TRUST_PROXY: '2', SERVE_CLIENT: 'false' });
    const app = createApp({ config, repos: await createRepositories('memory'), usda: null, aiCoach: null });
    app.get('/ip', (req, res) => res.json({ ip: req.ip }));
    // x-forwarded-for as Render passes it on: "<client>, <vercel edge>"
    const res = await request(app).get('/ip').set('X-Forwarded-For', '203.0.113.7, 76.76.21.21');
    expect(res.body.ip).toBe('203.0.113.7');
  });
});

describe('deployment health check', () => {
  it('returns an uncached 503 when the database probe fails', async () => {
    const config = loadConfig({ NODE_ENV: 'test', DATA_STORE: 'memory', SERVE_CLIENT: 'false' });
    const app = createApp({
      config,
      repos: await createRepositories('memory'),
      usda: null,
      aiCoach: null,
      healthCheck: async () => { throw new Error('database unavailable'); },
    });

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({ status: 'degraded', db: false });
  });
});
