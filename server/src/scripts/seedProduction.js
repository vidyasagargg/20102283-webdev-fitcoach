import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createRepositories } from '../repositories/index.js';
import { password } from '../validation/schemas.js';
import { todayIso } from '../utils/dates.js';
import { SAMPLE_MEMBER_COUNT, seedSampleMembers } from './demoData.js';

const adminEmail = 'vidyaadmin@fitcoach.app';
const adminName = 'vidyaadmin';
const uri = process.env.FITCOACH_SEED_MONGODB_URI;
const adminPassword = process.env.FITCOACH_SEED_ADMIN_PASSWORD;

if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
  throw new Error('Set FITCOACH_SEED_MONGODB_URI to the intended MongoDB connection string.');
}
if (!password.safeParse(adminPassword).success || Buffer.byteLength(adminPassword) > 72) {
  throw new Error('Set FITCOACH_SEED_ADMIN_PASSWORD to a valid FitCoach password of at most 72 bytes.');
}

async function checkAdmin(repos) {
  const existing = await repos.users.findOne({ email: adminEmail });
  if (!existing) return false;
  if (existing.role !== 'admin' || existing.name !== adminName || existing.suspended ||
      !existing.passwordHash || !(await bcrypt.compare(adminPassword, existing.passwordHash))) {
    throw new Error('The administrator address is already in use. Resolve the existing account before retrying.');
  }
  return true;
}

async function seed() {
  mongoose.set('transactionAsyncLocalStorage', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  if (mongoose.connection.name !== 'fitcoach_dev') {
    throw new Error('Expected the FitCoach production database fitcoach_dev.');
  }
  const repos = await createRepositories('mongo');
  await checkAdmin(repos);
  const sampleHash = await bcrypt.hash(randomBytes(32).toString('base64url'), 12);
  const created = await seedSampleMembers(repos, {
    passwordHash: sampleHash,
    transaction: (work) => mongoose.connection.transaction(work),
  });
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const adminCreated = await mongoose.connection.transaction(async () => {
    if (await checkAdmin(repos)) return false;
    const date = todayIso();
    await repos.users.create({
      name: adminName, email: adminEmail, passwordHash: adminHash, role: 'admin',
      profile: { startDate: date, schedule: { cycleStart: date }, onboarded: true },
    });
    return true;
  });
  console.log(`${SAMPLE_MEMBER_COUNT} sample members ready (${created} created). Administrator ${adminEmail} ${adminCreated ? 'created' : 'verified'}.`);
}

try {
  await seed();
} catch (error) {
  // Connection errors can contain credentials or host topology.
  const messages = ['Expected the FitCoach production database fitcoach_dev.', 'The administrator address is already in use. Resolve the existing account before retrying.'];
  const safeMessage = messages.includes(error.message) || /^Sample member address already in use: sample-member-\d{2}@fitcoach\.example$/.test(error.message);
  console.error(safeMessage ? error.message : `Production seed failed (${error.name}${typeof error.code === 'number' ? ` ${error.code}` : ''}).`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
