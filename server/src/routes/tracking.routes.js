/**
 * Daily tracking routes: body check (daily log), schedule, workouts, meals,
 * water and tape measurements.
 */
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest } from '../utils/httpError.js';
import {
  dailySchema,
  dayStatusSchema,
  isoDate,
  mealSchema,
  estimateSchema,
  measurementSchema,
  waterSchema,
  workoutSchema,
  workoutParseSchema,
  rangeQuery,
} from '../validation/schemas.js';
import { ownedResourceRouter } from './ownedResource.js';
import { parseWorkout } from '../services/workoutParser.js';
import { upcoming } from '../services/schedule.service.js';
import { withDefaults } from '../services/profileDefaults.js';
import { suggestLoads } from '../services/progression.service.js';
import { PER_SIDE_EXERCISES } from '../services/plan.js';

const dateParams = z.object({ date: isoDate }).strict();

export function dailyRouter({ repos, dayData }) {
  const router = Router();

  router.get(
    '/',
    validate(rangeQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { from, to } = req.valid.query;
      if (!from || !to) throw badRequest('from and to are required');
      res.json(await repos.daily.find({ userId: req.user.id, date: { $gte: from, $lte: to } }));
    }),
  );

  /** Everything for one day in a single request (used by the Today screen). */
  router.get(
    '/:date',
    validate(dateParams, 'params'),
    asyncHandler(async (req, res) => {
      const { date } = req.valid.params;
      const [day, review] = await Promise.all([
        dayData.day(req.user, date),
        repos.reviews.findOne({ userId: req.user.id, date, kind: 'daily' }),
      ]);
      res.json({ ...day, review });
    }),
  );

  router.put(
    '/:date',
    validate(dateParams, 'params'),
    validate(dailySchema),
    asyncHandler(async (req, res) => {
      const doc = await repos.daily.upsert({ userId: req.user.id, date: req.valid.params.date }, req.valid.body);
      res.json(doc);
    }),
  );

  /** Skip a lifting day (shifts the plan), take complete rest, or undo. */
  router.put(
    '/:date/status',
    validate(dateParams, 'params'),
    validate(dayStatusSchema),
    asyncHandler(async (req, res) => {
      const { date } = req.valid.params;
      const { status } = req.valid.body;
      const current = await dayData.scheduleFor(req.user, date, 'normal');
      if (status === 'skipped' && !current.canSkip) throw badRequest('Only lifting days can be skipped');
      if (status === 'complete_rest' && !current.canCompleteRest) {
        throw badRequest('Complete rest replaces an active rest day only');
      }
      await repos.daily.upsert({ userId: req.user.id, date }, { dayStatus: status });
      res.json(await dayData.scheduleFor(req.user, date));
    }),
  );

  return router;
}

export function scheduleRouter({ repos, dayData }) {
  const router = Router();

  /** Planned session for a date, with double-progression load suggestions. */
  router.get(
    '/:date',
    validate(dateParams, 'params'),
    asyncHandler(async (req, res) => {
      const { date } = req.valid.params;
      const day = await dayData.scheduleFor(req.user, date);
      const history = await repos.workouts.find({ userId: req.user.id, date: { $lt: date } }, { sort: { date: -1 }, limit: 60 });
      const exercises = suggestLoads(day.exercises, history);
      const profile = withDefaults(req.user.profile);
      const next = upcoming(date, 10, { schedule: profile.schedule, skippedDates: await dayData.skippedDates(req.user.id) });
      res.json({ ...day, exercises, upcoming: next });
    }),
  );

  return router;
}

export function workoutsRouter({ repos }) {
  const router = Router();

  /** Convert pasted notes to structured data. Nothing is saved: the user reviews first. */
  router.post(
    '/parse',
    validate(workoutParseSchema),
    asyncHandler(async (req, res) => {
      res.json(parseWorkout(req.valid.body.text, { date: req.valid.body.date }));
    }),
  );

  const normalise = async (data) => ({
    ...data,
    exercises: data.exercises.map((e) => ({ ...e, perSide: e.perSide ?? PER_SIDE_EXERCISES.has(e.name) })),
  });
  router.use('/', ownedResourceRouter({ repo: repos.workouts, schema: workoutSchema, beforeSave: normalise, sort: { date: 1 } }));
  return router;
}

export function mealsRouter({ repos, nutrition }) {
  const router = Router();

  router.post(
    '/estimate',
    validate(estimateSchema),
    asyncHandler(async (req, res) => res.json(await nutrition.estimate(req.valid.body.text))),
  );

  // Totals are always recomputed on the server; items are estimated if the client sent none.
  const beforeSave = async (data) => {
    let items = data.items;
    if (!items || !items.length) {
      if (!data.description) throw badRequest('Describe the meal or add at least one item');
      items = (await nutrition.estimate(data.description)).items;
    }
    return { ...data, items, totals: nutrition.sumTotals(items) };
  };
  router.use('/', ownedResourceRouter({ repo: repos.meals, schema: mealSchema, beforeSave, sort: { date: 1, time: 1 } }));
  return router;
}

export const waterRouter = ({ repos }) =>
  ownedResourceRouter({ repo: repos.water, schema: waterSchema, sort: { date: 1, time: 1 } });

export function measurementsRouter({ repos }) {
  const router = Router();
  // One entry per date: POST updates the existing entry for that date if there is one
  router.post(
    '/',
    validate(measurementSchema),
    asyncHandler(async (req, res) => {
      const { date, ...rest } = req.valid.body;
      res.status(201).json(await repos.measurements.upsert({ userId: req.user.id, date }, rest));
    }),
  );
  router.use('/', ownedResourceRouter({ repo: repos.measurements, schema: measurementSchema, sort: { date: 1 } }));
  return router;
}
