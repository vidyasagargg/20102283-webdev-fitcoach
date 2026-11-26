/** Coach reviews, progress analytics and data export routes. */
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest } from '../utils/httpError.js';
import { isoDate } from '../validation/schemas.js';
import { addDays, diffDays, todayIso } from '../utils/dates.js';
import { buildReminderCalendar } from '../services/ics.service.js';
import { withDefaults } from '../services/profileDefaults.js';
import { COLLECTIONS } from '../repositories/index.js';
import { publicUser } from './auth.routes.js';

const dateParams = z.object({ date: isoDate }).strict();

function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(tz);
  } catch {
    return false;
  }
}

export function coachRouter({ repos, coach }) {
  const router = Router();

  router.get(
    '/reviews',
    validate(z.object({ kind: z.enum(['daily', 'weekly']).optional(), limit: z.coerce.number().int().min(1).max(200).default(60) }).strict(), 'query'),
    asyncHandler(async (req, res) => {
      const { kind, limit } = req.valid.query;
      const filter = { userId: req.user.id, ...(kind && { kind }) };
      res.json(await repos.reviews.find(filter, { sort: { date: -1 }, limit }));
    }),
  );

  router.post(
    '/daily/:date',
    validate(dateParams, 'params'),
    asyncHandler(async (req, res) => res.json(await coach.daily(req.user, req.valid.params.date))),
  );

  router.post(
    '/weekly/:date',
    validate(dateParams, 'params'),
    asyncHandler(async (req, res) => res.json(await coach.weekly(req.user, req.valid.params.date))),
  );

  return router;
}

export function progressRouter({ progress }) {
  const router = Router();
  router.get(
    '/',
    validate(z.object({ from: isoDate, to: isoDate }).strict(), 'query'),
    asyncHandler(async (req, res) => {
      const { from, to } = req.valid.query;
      if (from > to) throw badRequest('from must be before to');
      if (diffDays(from, to) > 731) throw badRequest('Range can be at most two years');
      res.json(await progress.summary(req.user, from, to));
    }),
  );
  return router;
}

export function exportRouter({ repos }) {
  const router = Router();

  /** Download all of the user's data as JSON (data portability). */
  router.get(
    '/data.json',
    asyncHandler(async (req, res) => {
      const data = { exportedAt: new Date().toISOString(), user: publicUser(req.user) };
      for (const c of COLLECTIONS.filter((x) => x !== 'users')) {
        data[c] = await repos[c].find({ userId: req.user.id }, { sort: { date: 1 } });
      }
      res.setHeader('Content-Disposition', 'attachment; filename="fitcoach-data.json"');
      res.json(data);
    }),
  );

  router.get(
    '/reminders.ics',
    validate(
      z
        .object({
          tz: z
            .string()
            .max(64)
            .refine(isValidTimeZone, 'Unknown time zone')
            .default('Asia/Kolkata'),
          days: z.coerce.number().int().min(1).max(365).default(28),
          start: isoDate.optional(),
        })
        .strict(),
      'query',
    ),
    (req, res) => {
      const { tz, days, start } = req.valid.query;
      const profile = withDefaults(req.user.profile);
      const ics = buildReminderCalendar({
        reminders: profile.reminders,
        startDate: start ?? addDays(todayIso(), 0),
        days,
        timezone: tz,
        appUrl: `${req.protocol}://${req.get('host')}`,
      });
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="fitcoach-reminders.ics"');
      res.send(ics);
    },
  );

  return router;
}
