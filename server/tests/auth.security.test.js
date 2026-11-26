import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildTestApp, signedInAgent, api, closeDb } from './helpers.js';

let app;
let repos;
beforeAll(async () => ({ app, repos } = await buildTestApp()));
afterAll(closeDb);

describe('authentication', () => {
  it('registers, sets an httpOnly SameSite=Strict cookie and never returns the hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Requested-With', 'fitcoach')
      .send({ name: 'Charan', email: 'charan@test.dev', password: 'Str0ngPassw0rd' });
    expect(res.status).toBe(201);
    expect(res.body.passwordHash).toBeUndefined();
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    const stored = await repos.users.findOne({ email: 'charan@test.dev' });
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt
  });

  it('rejects weak passwords with field messages', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Requested-With', 'fitcoach')
      .send({ name: 'A', email: 'weak@test.dev', password: 'password' });
    expect(res.status).toBe(400);
    expect(res.body.fields.password).toBeDefined();
  });

  it('rejects duplicate emails', async () => {
    const body = { name: 'A', email: 'dup@test.dev', password: 'Str0ngPassw0rd' };
    await request(app).post('/api/auth/register').set('X-Requested-With', 'fitcoach').send(body);
    const res = await request(app).post('/api/auth/register').set('X-Requested-With', 'fitcoach').send(body);
    expect(res.status).toBe(409);
  });

  it('uses the same error for unknown email and wrong password', async () => {
    const { credentials } = await signedInAgent(app);
    const wrongPw = await request(app).post('/api/auth/login').set('X-Requested-With', 'fitcoach').send({ email: credentials.email, password: 'Nope12345678' });
    const noUser = await request(app).post('/api/auth/login').set('X-Requested-With', 'fitcoach').send({ email: 'ghost@test.dev', password: 'Nope12345678' });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body.error).toBe(noUser.body.error);
  });

  it('logs in, reads /me, and logout-all invalidates tokens on every device', async () => {
    const { agent, cookie, credentials } = await signedInAgent(app);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    const login = await request(app).post('/api/auth/login').set('X-Requested-With', 'fitcoach').send({ email: credentials.email, password: credentials.password });
    expect(login.status).toBe(200);
    const otherDevice = login.headers['set-cookie'][0].split(';')[0];
    await api(agent).post('/api/auth/logout-all');
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', otherDevice)).status).toBe(401);
  });

  it('requires authentication for protected routes', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });

  it('rejects a forged token', async () => {
    const res = await request(app).get('/api/profile').set('Cookie', 'fc_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.');
    expect(res.status).toBe(401);
  });
});

describe('security controls', () => {
  it('blocks state-changing requests without the CSRF header', async () => {
    const { agent } = await signedInAgent(app);
    const res = await agent.post('/api/water').send({ date: '2026-10-11', ml: 250 });
    expect(res.status).toBe(403);
  });

  it('rejects NoSQL operator injection in login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'fitcoach')
      .send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  it('rejects mass-assignment of privileged fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Requested-With', 'fitcoach')
      .send({ name: 'X', email: 'mass@test.dev', password: 'Str0ngPassw0rd', role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('stores script tags as inert text (React escapes on output; CSP blocks inline scripts)', async () => {
    const { agent } = await signedInAgent(app);
    const res = await api(agent).post('/api/meals', {
      date: '2026-10-11',
      slot: 'lunch',
      description: '<script>alert(1)</script>',
      items: [{ name: '<img src=x onerror=alert(1)>', kcal: 100 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.items[0].name).toBe('<img src=x onerror=alert(1)>');
  });

  it('sends security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('prevents users from reading or changing each other’s records (IDOR)', async () => {
    const a = await signedInAgent(app);
    const b = await signedInAgent(app);
    const created = await api(a.agent).post('/api/water', { date: '2026-10-11', ml: 500 });
    expect(created.status).toBe(201);
    expect((await b.agent.get(`/api/water/${created.body.id}`)).status).toBe(404);
    expect((await api(b.agent).put(`/api/water/${created.body.id}`, { date: '2026-10-11', ml: 1 })).status).toBe(404);
    expect((await api(b.agent).del(`/api/water/${created.body.id}`)).status).toBe(404);
    expect((await b.agent.get('/api/water?date=2026-10-11')).body).toHaveLength(0);
  });

  it('restricts admin routes by role', async () => {
    const user = await signedInAgent(app);
    expect((await user.agent.get('/api/admin/stats')).status).toBe(403);
    const admin = await signedInAgent(app, { email: 'admin@test.dev' });
    const res = await admin.agent.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.counts.users).toBeGreaterThan(0);
  });

  it('lets admins investigate account activity and revoke or restore account access', async () => {
    const member = await signedInAgent(app);
    const admin = await signedInAgent(app);
    await repos.users.updateOne({ id: admin.user.id }, { role: 'admin' });
    const account = `/api/admin/users/${member.user.id}`;
    const actions = `${account}/actions`;
    await api(member.agent).post('/api/water', { date: '2026-10-11', ml: 500 }).expect(201);

    await member.agent.get('/api/admin/users').expect(403);
    await member.agent.get(account).expect(403);
    await api(member.agent).post(actions, { action: 'suspend' }).expect(403);
    const list = await admin.agent.get('/api/admin/users').query({ email: member.user.email }).expect(200);
    expect(list.headers['cache-control']).toBe('no-store');
    expect(list.body).toMatchObject({ page: 1, pageSize: 25, total: 1, users: [{ id: member.user.id }] });
    expect(list.body.users[0]).not.toHaveProperty('passwordHash');
    expect(list.body.users[0]).not.toHaveProperty('profile');
    const detail = await admin.agent.get(account).expect(200);
    expect(detail.body.counts.water).toBe(1);
    await api(admin.agent).post(`/api/admin/users/${admin.user.id}/actions`, { action: 'suspend' }).expect(403);

    const login = () => api(member.agent).post('/api/auth/login', { email: member.credentials.email, password: member.credentials.password });
    await api(admin.agent).post(actions, { action: 'revoke-sessions' }).expect(200);
    await member.agent.get('/api/profile').expect(401);
    await login().expect(200);
    await api(admin.agent).post(actions, { action: 'suspend' }).expect(200);
    await member.agent.get('/api/profile').expect(401);
    await login().expect(403);
    await api(admin.agent).post(actions, { action: 'reactivate' }).expect(200);
    await member.agent.get('/api/profile').expect(401);
    await login().expect(200);
  });

  it('returns JSON 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'fitcoach')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JSON/);
  });
});
