/**
 * Authentication and authorisation.
 * Sessions are stateless JWTs held in an httpOnly, SameSite=Strict cookie, so
 * page scripts (and therefore XSS payloads) cannot read the token. Each token carries
 * the user's `tokenVersion`; bumping it (logout-everywhere, password change)
 * invalidates every token issued before.
 */
import jwt from 'jsonwebtoken';
import { unauthorized, forbidden } from '../utils/httpError.js';

export const COOKIE_NAME = 'fc_session';

export function cookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function issueSession(res, user, config) {
  const token = jwt.sign({ sub: user.id, v: user.tokenVersion ?? 0, role: user.role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  });
  res.cookie(COOKIE_NAME, token, cookieOptions(config));
}

export function clearSession(res, config) {
  const { maxAge: _ignored, ...opts } = cookieOptions(config);
  res.clearCookie(COOKIE_NAME, opts);
}

export function requireAuth({ repos, config }) {
  return async (req, _res, next) => {
    try {
      const token = req.cookies?.[COOKIE_NAME];
      if (!token) throw unauthorized();
      let payload;
      try {
        payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
      } catch {
        throw unauthorized('Your session has expired. Please sign in again.');
      }
      const user = await repos.users.findOne({ id: payload.sub });
      if (!user || (user.tokenVersion ?? 0) !== payload.v) {
        throw unauthorized('Your session has expired. Please sign in again.');
      }
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Role-based access control: only the listed roles may continue. */
export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role) ? next() : next(forbidden());
