import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { validate } from '../middleware/validate.js';
import { issueSession, clearSession, requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { asyncHandler, conflict, unauthorized, badRequest } from '../utils/httpError.js';
import { registerSchema, loginSchema, changePasswordSchema, isoDate } from '../validation/schemas.js';
import { todayIso } from '../utils/dates.js';

/** Fields that are safe to send to the browser (never the password hash). */
export const publicUser = ({ id, name, email, role, profile, createdAt }) => ({ id, name, email, role, profile, createdAt });

// Hash compared against when the email does not exist, so login timing is the same
// whether or not an account exists (prevents user enumeration).
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

export function authRouter({ repos, config }) {
  const router = Router();
  const limiter = authLimiter(config);

  router.post(
    '/register',
    limiter,
    validate(registerSchema),
    asyncHandler(async (req, res) => {
      const { name, email, password } = req.valid.body;
      if (await repos.users.findOne({ email })) throw conflict('An account with that email already exists');
      const startDate = isoDate.safeParse(req.get('X-Client-Date')).success ? req.get('X-Client-Date') : todayIso();
      const user = await repos.users.create({
        name,
        email,
        passwordHash: await bcrypt.hash(password, config.BCRYPT_ROUNDS),
        role: config.adminEmails.includes(email) ? 'admin' : 'user',
        tokenVersion: 0,
        profile: { startDate, schedule: { cycleStart: startDate }, onboarded: false },
      });
      issueSession(res, user, config);
      res.status(201).json(publicUser(user));
    }),
  );

  router.post(
    '/login',
    limiter,
    validate(loginSchema),
    asyncHandler(async (req, res) => {
      const { email, password } = req.valid.body;
      const user = await repos.users.findOne({ email });
      const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !ok) throw unauthorized('Email or password is incorrect');
      issueSession(res, user, config);
      res.json(publicUser(user));
    }),
  );

  router.post('/logout', (req, res) => {
    clearSession(res, config);
    res.status(204).end();
  });

  const auth = requireAuth({ repos, config });

  router.get('/me', auth, (req, res) => res.json(publicUser(req.user)));

  /** Signs out every device by invalidating all previously issued tokens. */
  router.post(
    '/logout-all',
    auth,
    asyncHandler(async (req, res) => {
      await repos.users.updateOne({ id: req.user.id }, { tokenVersion: (req.user.tokenVersion ?? 0) + 1 });
      clearSession(res, config);
      res.status(204).end();
    }),
  );

  router.post(
    '/change-password',
    auth,
    limiter,
    validate(changePasswordSchema),
    asyncHandler(async (req, res) => {
      const { currentPassword, newPassword } = req.valid.body;
      if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) {
        throw badRequest('Current password is incorrect', { currentPassword: 'Current password is incorrect' });
      }
      const updated = await repos.users.updateOne(
        { id: req.user.id },
        { passwordHash: await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS), tokenVersion: (req.user.tokenVersion ?? 0) + 1 },
      );
      issueSession(res, updated, config); // keep this device signed in, sign out the rest
      res.status(204).end();
    }),
  );

  return router;
}
