/**
 * Defence-in-depth middleware (OWASP A03 Injection, A05 Misconfiguration,
 * A01 Broken Access Control / CSRF).
 */
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { HttpError } from '../utils/httpError.js';

/** Security headers including a strict Content Security Policy (blocks injected scripts). */
export const securityHeaders = () =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"], // inline style attributes used by charts
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

/**
 * Removes keys that start with "$" or contain "." from body and params,
 * the usual way to smuggle MongoDB operators. Zod's strict schemas already reject
 * them; this also covers any route that might lack a schema.
 */
export function stripMongoOperators(req, _res, next) {
  const clean = (value) => {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([k]) => !k.startsWith('$') && !k.includes('.'))
          .map(([k, v]) => [k, clean(v)]),
      );
    }
    return value;
  };
  if (req.body) req.body = clean(req.body);
  if (req.params) req.params = clean(req.params);
  next();
}

/**
 * CSRF protection: state-changing API calls must carry a custom header.
 * Browsers will not let another site add custom headers to a cross-origin
 * request without a CORS preflight, which our CORS policy refuses. This combines with
 * the SameSite=Strict session cookie.
 */
export function requireCsrfHeader(req, _res, next) {
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (safe || req.get('X-Requested-With') === 'fitcoach') return next();
  next(new HttpError(403, 'Missing request header'));
}

/** Brute-force protection for login/registration. */
export const authLimiter = (config) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.NODE_ENV === 'test' ? 1000 : 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
  });

/** General API rate limit to protect the server and external API quotas. */
export const apiLimiter = (config) =>
  rateLimit({
    windowMs: 60 * 1000,
    limit: config.NODE_ENV === 'test' ? 10000 : 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });
