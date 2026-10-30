/**
 * Factory that builds a full REST CRUD router for a user-owned resource.
 *
 *   GET    /            ?date=YYYY-MM-DD  or  ?from=…&to=…   list
 *   GET    /:id                                             read one
 *   POST   /                                                create
 *   PUT    /:id                                             replace
 *   DELETE /:id                                             delete
 *
 * Authorisation: every query includes `userId: req.user.id`, so a user can only
 * see or change their own records. A guessed id belonging to someone else
 * returns 404 (not 403), so ids cannot be probed (OWASP A01, IDOR).
 */
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler, notFound } from '../utils/httpError.js';
import { objectIdLike, rangeQuery } from '../validation/schemas.js';

const idParams = z.object({ id: objectIdLike });

export function ownedResourceRouter({ repo, schema, beforeSave = async (data) => data, sort = { date: 1, time: 1 } }) {
  const router = Router();

  router.get(
    '/',
    validate(rangeQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { date, from, to } = req.valid.query;
      const filter = { userId: req.user.id };
      if (date) filter.date = date;
      else if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
      res.json(await repo.find(filter, { sort, limit: 1000 }));
    }),
  );

  router.get(
    '/:id',
    validate(idParams, 'params'),
    asyncHandler(async (req, res) => {
      const doc = await repo.findOne({ id: req.valid.params.id, userId: req.user.id });
      if (!doc) throw notFound();
      res.json(doc);
    }),
  );

  router.post(
    '/',
    validate(schema),
    asyncHandler(async (req, res) => {
      const data = await beforeSave(req.valid.body, req);
      const doc = await repo.create({ ...data, userId: req.user.id });
      res.status(201).json(doc);
    }),
  );

  router.put(
    '/:id',
    validate(idParams, 'params'),
    validate(schema),
    asyncHandler(async (req, res) => {
      const data = await beforeSave(req.valid.body, req);
      const doc = await repo.updateOne({ id: req.valid.params.id, userId: req.user.id }, data);
      if (!doc) throw notFound();
      res.json(doc);
    }),
  );

  router.delete(
    '/:id',
    validate(idParams, 'params'),
    asyncHandler(async (req, res) => {
      const ok = await repo.deleteOne({ id: req.valid.params.id, userId: req.user.id });
      if (!ok) throw notFound();
      res.status(204).end();
    }),
  );

  return router;
}
