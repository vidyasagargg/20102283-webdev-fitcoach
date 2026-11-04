/** `npm run seed`: creates or resets the demo account in MongoDB. */
import mongoose from 'mongoose';
import { loadConfig } from '../config/env.js';
import { createRepositories } from '../repositories/index.js';
import { seedDemo, DEMO_ACCOUNTS, DEMO_PASSWORD } from './demoData.js';

const config = loadConfig();
await mongoose.connect(config.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/fitcoach');
const repos = await createRepositories('mongo');
await seedDemo(repos);
console.log('Demo accounts ready (password for all: ' + DEMO_PASSWORD + '):');
DEMO_ACCOUNTS.forEach((email) => console.log(`  ${email}`));
await mongoose.disconnect();
