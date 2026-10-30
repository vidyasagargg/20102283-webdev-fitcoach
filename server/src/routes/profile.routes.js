import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/httpError.js';
import { profileSchema } from '../validation/schemas.js';
import { mergeProfile, withDefaults } from '../services/profileDefaults.js';
import { clearSession } from '../middleware/auth.js';
import { publicUser } from './auth.routes.js';
import { COLLECTIONS } from '../repositories/index.js';

export function profileRouter({ repos, config }) {
  const router = Router();

  /** Profile with defaults filled in, so the UI always has every target. */
  router.get('/', (req, res) => res.json({ ...publicUser(req.user), profile: withDefaults(req.user.profile) }));

  router.put(
    '/',
    validate(profileSchema),
    asyncHandler(async (req, res) => {
      const { name, profile } = req.valid.body;
      const patch = {};
      if (name) patch.name = name;
      if (profile) patch.profile = mergeProfile(req.user.profile ?? {}, profile);
      const updated = await repos.users.updateOne({ id: req.user.id }, patch);
      res.json({ ...publicUser(updated), profile: withDefaults(updated.profile) });
    }),
  );

  /** Right to erasure: delete the account and every record it owns. */
  router.delete(
    '/',
    asyncHandler(async (req, res) => {
      await Promise.all(
        COLLECTIONS.filter((c) => c !== 'users').map((c) => repos[c].deleteMany({ userId: req.user.id })),
      );
      await repos.users.deleteOne({ id: req.user.id });
      clearSession(res, config);
      res.status(204).end();
    }),
  );

  return router;
}
