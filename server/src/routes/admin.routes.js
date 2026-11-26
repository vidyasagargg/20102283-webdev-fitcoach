import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { COLLECTIONS } from '../repositories/index.js';
import { withDefaults } from '../services/profileDefaults.js';
import { asyncHandler, forbidden, notFound } from '../utils/httpError.js';

const activityCollections = COLLECTIONS.filter((name) => name !== 'users');
const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  email: z.string().trim().toLowerCase().pipe(z.email()).optional(),
}).strict();
const userParams = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }).strict();
const detailParams = userParams.extend({ section: z.enum(['profile', ...activityCollections]) });
const detailQuery = listQuery.pick({ page: true });
const actionBody = z.object({ action: z.enum(['suspend', 'reactivate', 'revoke-sessions']) }).strict();
const pageSize = 25;
const demoAdminEmails = new Set(['admin@fitcoach.app', 'admin@fitcoach.ie']);
const profileFields = ['age', 'heightCm', 'dietNotes', 'startDate', 'baseline', 'goals', 'targets', 'safety', 'schedule', 'reminders', 'onboarded'];

function accountSummary({ id, name, email, role, suspended, profile, createdAt }) {
  return { id, name, email, role: role ?? 'user', suspended: suspended === true, onboarded: profile?.onboarded === true, createdAt };
}

async function countsFor(repos, collections, filter) {
  const pairs = await Promise.all(collections.map(async (name) => [name, await repos[name].count(filter)]));
  return Object.fromEntries(pairs);
}

export function adminRouter({ repos, config }) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(requireRole('admin'));
  router.use((req, _res, next) => {
    if (config.isProd && demoAdminEmails.has(req.user.email?.toLowerCase())) {
      return next(forbidden('Use a dedicated administrator account in production.'));
    }
    next();
  });

  router.get('/stats', asyncHandler(async (_req, res) => {
    const counts = await countsFor(repos, COLLECTIONS, {});
    res.json({ counts, generatedAt: new Date().toISOString() });
  }));

  router.get('/users', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
    const { page, email } = req.valid.query;
    const filter = email ? { email } : {};
    const [users, total] = await Promise.all([
      repos.users.find(filter, { sort: { email: 1 }, skip: (page - 1) * pageSize, limit: pageSize }),
      repos.users.count(filter),
    ]);
    res.json({ users: users.map(accountSummary), page, pageSize, total });
  }));

  router.get('/users/:id', validate(userParams, 'params'), asyncHandler(async (req, res) => {
    const { id } = req.valid.params;
    const user = await repos.users.findOne({ id });
    if (!user) throw notFound('Account not found');
    const counts = await countsFor(repos, activityCollections, { userId: id });
    res.json({ user: accountSummary(user), counts });
  }));

  router.get('/users/:id/details/:section', validate(detailParams, 'params'), validate(detailQuery, 'query'), asyncHandler(async (req, res) => {
    const { id, section } = req.valid.params;
    const { page } = req.valid.query;
    const user = await repos.users.findOne({ id });
    if (!user) throw notFound('Account not found');

    let details;
    if (section === 'profile') {
      const profile = withDefaults(user.profile);
      details = { profile: Object.fromEntries(profileFields.map((field) => [field, profile[field]])) };
    } else {
      const filter = { userId: id };
      const [records, total] = await Promise.all([
        repos[section].find(filter, { sort: { date: -1, createdAt: -1, id: -1 }, skip: (page - 1) * pageSize, limit: pageSize }),
        repos[section].count(filter),
      ]);
      details = { records, total, page, pageSize };
    }
    if (config.isProd) console.info(JSON.stringify({
      event: 'admin-member-details-view', actorId: req.user.id, targetId: id, section, at: new Date().toISOString(),
    }));
    res.json(details);
  }));

  router.post('/users/:id/actions', validate(userParams, 'params'), validate(actionBody), asyncHandler(async (req, res) => {
    const { id } = req.valid.params;
    const { action } = req.valid.body;
    const user = await repos.users.findOne({ id });
    if (!user) throw notFound('Account not found');
    if (user.role === 'admin') throw forbidden('Support actions are unavailable for administrator accounts.');

    const patch = action === 'revoke-sessions' ? {} : { suspended: action === 'suspend' };
    const updated = await repos.users.updateOne(
      { id, role: { $ne: 'admin' } }, patch, { increment: { tokenVersion: 1 } },
    );
    if (!updated) throw notFound('Account is no longer available for this action');
    if (config.isProd) console.info(JSON.stringify({ event: 'admin-account-action', actorId: req.user.id, targetId: id, action }));
    res.json(accountSummary(updated));
  }));

  return router;
}
