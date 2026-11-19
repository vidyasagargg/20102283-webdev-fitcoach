/**
 * Test harness. By default the API tests run against the in-memory
 * repositories. Set TEST_MONGODB_URI (as the CI workflow does) to run the
 * same suite against a real MongoDB.
 */
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createRepositories } from '../src/repositories/index.js';
import { loadConfig } from '../src/config/env.js';

export const fakeUsda = {
  async searchPer100g(q) {
    if (q.includes('quinoa')) return { description: 'Quinoa, cooked', per100: { kcal: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fibre: 2.8, sugar: 0.9 } };
    return null;
  },
};

export async function buildTestApp() {
  const useMongo = Boolean(process.env.TEST_MONGODB_URI);
  const config = loadConfig({ NODE_ENV: 'test', DATA_STORE: useMongo ? 'mongo' : 'memory', BCRYPT_ROUNDS: '4', ADMIN_EMAILS: 'admin@test.dev', SERVE_CLIENT: 'false' });
  if (useMongo && mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
    await mongoose.connection.db.dropDatabase();
  }
  const repos = await createRepositories(config.DATA_STORE);
  const app = createApp({ config, repos, usda: fakeUsda, aiCoach: null });
  return { app, repos, config };
}

let counter = 0;
/** Registers a fresh user and returns a supertest agent that keeps the session cookie. */
export async function signedInAgent(app, overrides = {}) {
  const agent = request.agent(app);
  counter += 1;
  const body = { name: 'Test User', email: `user${counter}-${Date.now()}@test.dev`, password: 'Str0ngPassw0rd', ...overrides };
  const res = await agent.post('/api/auth/register').set('X-Requested-With', 'fitcoach').set('X-Client-Date', '2026-10-11').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body, credentials: body, cookie: res.headers['set-cookie'][0].split(';')[0] };
}

/** Adds the CSRF header to every state-changing request. */
export const api = (agent) => ({
  get: (url) => agent.get(url),
  post: (url, body) => agent.post(url).set('X-Requested-With', 'fitcoach').send(body),
  put: (url, body) => agent.put(url).set('X-Requested-With', 'fitcoach').send(body),
  del: (url) => agent.delete(url).set('X-Requested-With', 'fitcoach'),
});

export const closeDb = async () => {
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
};
