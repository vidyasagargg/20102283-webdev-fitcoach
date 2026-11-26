/** Entry point: load config, connect the database, start HTTP, shut down gracefully. */
import mongoose from 'mongoose';
import { loadConfig } from './config/env.js';
import { createRepositories } from './repositories/index.js';
import { createApp } from './app.js';

// `npm run demo`: in-memory store with a demo account, works the same on Windows, macOS and Linux
if (process.argv.includes('--demo')) {
  process.env.DATA_STORE = 'memory';
  process.env.SEED_DEMO = 'true';
}

const config = loadConfig();

if (config.DATA_STORE === 'mongo') {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/fitcoach', {
    serverSelectionTimeoutMS: 10000,
  });
  console.log('Connected to MongoDB');
} else {
  console.warn('DATA_STORE=memory: data is kept in memory and lost on restart (demo/test mode).');
}

const repos = await createRepositories(config.DATA_STORE);
if (config.DATA_STORE === 'memory' && process.env.SEED_DEMO === 'true') {
  const { seedDemo, DEMO_ACCOUNTS, DEMO_PASSWORD } = await import('./scripts/demoData.js');
  await seedDemo(repos);
  console.log(`Demo accounts (password ${DEMO_PASSWORD}): ${DEMO_ACCOUNTS.join(', ')}`);
}
const healthCheck = async () => {
  if (config.DATA_STORE === 'memory') return true;
  if (mongoose.connection.readyState !== 1) return false;
  await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 3000 });
  return true;
};
const app = createApp({ config, repos, healthCheck });

const server = app.listen(config.PORT, () => {
  console.log(`FitCoach API listening on port ${config.PORT} (${config.NODE_ENV})`);
  if (config.DATA_STORE === 'memory') console.log(`Open http://localhost:${config.PORT} in your browser`);
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
